// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Linq.Expressions;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using IabConnect.Api;
using Microsoft.AspNetCore.Hosting;
using Moq;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 AC-6 (E15-S3 / ADR-019 / ADR-020): registration-side assertions for the
/// daily encrypted PostgreSQL backup + 30-day prune Hangfire recurring jobs. Wired
/// in <see cref="DependencyInjection.RegisterDailyBackupJob"/>. Beta + Production
/// register both; Development calls <c>RemoveIfExists</c> on both ids so an
/// orphaned schedule from a prior environment is cleaned up.
///
/// <para>Mirrors the test shape of <see cref="RetentionEnforcementJobRegistrationTests"/>:
/// stubbed <see cref="IRecurringJobManager"/>, stubbed <see cref="IWebHostEnvironment"/>;
/// no Hangfire storage stand-up.</para>
/// </summary>
public sealed class RegisterDailyBackupJobTests
{
    private static Mock<IWebHostEnvironment> Env(string environmentName)
    {
        var env = new Mock<IWebHostEnvironment>(MockBehavior.Loose);
        env.SetupGet(e => e.EnvironmentName).Returns(environmentName);
        return env;
    }

    [Fact]
    public void RecurringJobIds_AreStableContracts()
    {
        // Hangfire keys recurring jobs by id — changing these silently orphans the
        // old schedule and registers a duplicate, so the ids are contracts worth
        // pinning. Cron expressions are also pinned because operators reading the
        // doc Section 15.1 schedule (03:00 + 04:00 UTC) need the source-of-truth.
        DependencyInjection.DailyBackupJobId.Should().Be("daily-pg-backup");
        DependencyInjection.PruneOldBackupsJobId.Should().Be("prune-old-backups");
        DependencyInjection.DailyBackupCron.Should().Be("0 3 * * *");
        DependencyInjection.PruneOldBackupsCron.Should().Be("0 4 * * *");
    }

    [Fact]
    public void RecurringJobIds_AreGloballyUnique_AcrossAllRegisteredJobs()
    {
        // E15-S3 boundary review P8: Hangfire's AddOrUpdate is keyed by job id, so
        // two registrations sharing an id silently overwrite each other in the
        // recurringjob storage table. The six currently-registered job ids must
        // therefore be distinct — pinned here so a future refactor that copy-pastes
        // a new job from an existing block (a known footgun) is caught at test time
        // rather than during a 03:00 UTC deploy.
        var ids = new[]
        {
            "mark-invoices-overdue",                               // UseApiPipeline line ~327
            "generate-dunning-notices",                            // UseApiPipeline line ~333
            DependencyInjection.RetentionJobId,                    // RegisterRetentionEnforcementJob
            DependencyInjection.VolunteerReminderJobId,            // VolunteerShiftReminderJob
            DependencyInjection.DailyBackupJobId,                  // RegisterDailyBackupJob — E15-S3
            DependencyInjection.PruneOldBackupsJobId,              // RegisterDailyBackupJob — E15-S3
            DependencyInjection.AutomationDispatchJobId,           // AutomationDispatchJob — E5-S2
        };
        ids.Should().OnlyHaveUniqueItems();
        ids.Should().HaveCount(7, "the project currently registers exactly 7 recurring jobs; bump this count when adding an 8th");
    }

    [Fact]
    public void Register_AddsBothJobs_InBetaEnvironment()
    {
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);
        jobManager.Setup(m => m.AddOrUpdate(
            DependencyInjection.DailyBackupJobId,
            It.IsAny<Job>(),
            DependencyInjection.DailyBackupCron,
            It.IsAny<RecurringJobOptions>()));
        jobManager.Setup(m => m.AddOrUpdate(
            DependencyInjection.PruneOldBackupsJobId,
            It.IsAny<Job>(),
            DependencyInjection.PruneOldBackupsCron,
            It.IsAny<RecurringJobOptions>()));

        DependencyInjection.RegisterDailyBackupJob(jobManager.Object, Env("Beta").Object);

        jobManager.Verify(m => m.AddOrUpdate(
            DependencyInjection.DailyBackupJobId,
            It.IsAny<Job>(),
            DependencyInjection.DailyBackupCron,
            It.IsAny<RecurringJobOptions>()), Times.Once);
        jobManager.Verify(m => m.AddOrUpdate(
            DependencyInjection.PruneOldBackupsJobId,
            It.IsAny<Job>(),
            DependencyInjection.PruneOldBackupsCron,
            It.IsAny<RecurringJobOptions>()), Times.Once);
        // No RemoveIfExists in the Beta path.
        jobManager.Verify(m => m.RemoveIfExists(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public void Register_AddsBothJobs_InProductionEnvironment()
    {
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);
        jobManager.Setup(m => m.AddOrUpdate(
            It.IsAny<string>(),
            It.IsAny<Job>(),
            It.IsAny<string>(),
            It.IsAny<RecurringJobOptions>()));

        DependencyInjection.RegisterDailyBackupJob(jobManager.Object, Env("Production").Object);

        jobManager.Verify(m => m.AddOrUpdate(
            It.IsAny<string>(),
            It.IsAny<Job>(),
            It.IsAny<string>(),
            It.IsAny<RecurringJobOptions>()), Times.Exactly(2));
    }

    [Fact]
    public void Register_RemovesBothJobs_InDevelopmentEnvironment()
    {
        // ADR-020 inverse + E11-S2 review D4 RemoveIfExists pattern: a Dev install
        // that previously ran Beta in the same Hangfire storage must clean up the
        // orphaned schedules so pg_dump doesn't fire every morning against the dev
        // database. AddOrUpdate is idempotent on the on-state but does NOT clean up
        // on the off-state — RemoveIfExists does.
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);
        jobManager.Setup(m => m.RemoveIfExists(DependencyInjection.DailyBackupJobId));
        jobManager.Setup(m => m.RemoveIfExists(DependencyInjection.PruneOldBackupsJobId));

        DependencyInjection.RegisterDailyBackupJob(jobManager.Object, Env("Development").Object);

        jobManager.Verify(m => m.RemoveIfExists(DependencyInjection.DailyBackupJobId), Times.Once);
        jobManager.Verify(m => m.RemoveIfExists(DependencyInjection.PruneOldBackupsJobId), Times.Once);
        jobManager.Verify(m => m.AddOrUpdate(
            It.IsAny<string>(),
            It.IsAny<Job>(),
            It.IsAny<string>(),
            It.IsAny<RecurringJobOptions>()), Times.Never);
    }
}
