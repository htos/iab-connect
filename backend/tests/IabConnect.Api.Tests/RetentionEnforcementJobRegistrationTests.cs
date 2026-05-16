// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Linq.Expressions;
using FluentAssertions;
using Hangfire;
using Hangfire.Common;
using IabConnect.Api;
using IabConnect.Infrastructure.Retention;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 (E11-S2 / ADR-020): registration-side assertions for the weekly retention-
/// enforcement recurring job. The job is wired in
/// <see cref="DependencyInjection.RegisterRetentionEnforcementJob"/> (extracted from
/// <c>UseApiPipeline</c> so the flag-conditional registration is unit-testable without
/// standing up Hangfire storage). Beta deployments set
/// <c>RetentionEnforcement:Enabled = false</c> in <c>appsettings.Beta.json</c> so tester
/// data is not retention-deleted during the validation window; Production keeps the
/// default <c>true</c>.
/// </summary>
public sealed class RetentionEnforcementJobRegistrationTests
{
    [Fact]
    public void RecurringJobId_IsStableContract()
    {
        // Hangfire keys recurring jobs by id — changing this silently orphans the old
        // schedule and registers a duplicate, so the id is a contract worth pinning.
        DependencyInjection.RetentionJobId.Should().Be("enforce-retention-policies");
    }

    [Fact]
    public void Register_AddsJob_WhenFlagIsTrue()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RetentionEnforcement:Enabled"] = "true",
            })
            .Build();
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);
        jobManager
            .Setup(m => m.AddOrUpdate(
                DependencyInjection.RetentionJobId,
                It.IsAny<Job>(),
                It.IsAny<string>(),
                It.IsAny<RecurringJobOptions>()));

        DependencyInjection.RegisterRetentionEnforcementJob(configuration, jobManager.Object);

        jobManager.Verify(m => m.AddOrUpdate(
            DependencyInjection.RetentionJobId,
            It.IsAny<Job>(),
            It.IsAny<string>(),
            It.IsAny<RecurringJobOptions>()), Times.Once);
    }

    [Fact]
    public void Register_DoesNothing_WhenFlagIsFalse()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RetentionEnforcement:Enabled"] = "false",
            })
            .Build();
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);

        DependencyInjection.RegisterRetentionEnforcementJob(configuration, jobManager.Object);

        // Strict mock with no setups → any AddOrUpdate call would throw. Verify no
        // interactions touched the manager when the flag is false.
        jobManager.VerifyNoOtherCalls();
    }

    [Fact]
    public void Register_AddsJob_WhenFlagIsAbsent()
    {
        // ADR-020: default value is true. An absent flag must NOT silently skip the job
        // (would suppress retention enforcement in any env that forgot to set the key).
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var jobManager = new Mock<IRecurringJobManager>(MockBehavior.Strict);
        jobManager
            .Setup(m => m.AddOrUpdate(
                DependencyInjection.RetentionJobId,
                It.IsAny<Job>(),
                It.IsAny<string>(),
                It.IsAny<RecurringJobOptions>()));

        DependencyInjection.RegisterRetentionEnforcementJob(configuration, jobManager.Object);

        jobManager.Verify(m => m.AddOrUpdate(
            DependencyInjection.RetentionJobId,
            It.IsAny<Job>(),
            It.IsAny<string>(),
            It.IsAny<RecurringJobOptions>()), Times.Once);
    }
}
