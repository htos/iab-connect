// SPDX-License-Identifier: AGPL-3.0-or-later
using FluentAssertions;
using IabConnect.Api;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-028 (E5-S2) AC-8: the automation dispatch job-id + cron are stable contracts (Hangfire keys
/// recurring jobs by id; a drift silently orphans the old schedule). Global uniqueness across all 7
/// recurring jobs is asserted by <see cref="RegisterDailyBackupJobTests.RecurringJobIds_AreGloballyUnique_AcrossAllRegisteredJobs"/>.
/// </summary>
public sealed class AutomationDispatchJobRegistrationTests
{
    [Fact]
    public void AutomationDispatchJobId_AndCron_AreStableContracts()
    {
        DependencyInjection.AutomationDispatchJobId.Should().Be("dispatch-automations");
        DependencyInjection.AutomationDispatchCron.Should().Be("0 * * * *"); // hourly (DEC-3)
    }
}
