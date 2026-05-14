using FluentAssertions;
using Hangfire;
using IabConnect.Api;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-024 (E3.S4) AC-9 / Task-8 / R4-P-S4-3: startup-registration assertions for the daily
/// volunteer-shift reminder recurring job. The job is wired in
/// <see cref="DependencyInjection.UseApiPipeline"/> via Hangfire's <c>IRecurringJobManager</c>,
/// which needs live Hangfire storage and is skipped in the Testing environment — so instead of
/// standing up storage these tests pin the registration's stable inputs: the recurring-job id,
/// the cron schedule (daily 09:00), and the Europe/Zurich timezone resolution.
/// </summary>
public sealed class VolunteerShiftReminderJobRegistrationTests
{
    [Fact]
    public void RecurringJobId_IsStableContract()
    {
        // Hangfire keys recurring jobs by id — changing this silently orphans the old schedule
        // and registers a duplicate, so the id is a contract worth pinning.
        DependencyInjection.VolunteerReminderJobId.Should().Be("send-volunteer-shift-reminders");
    }

    [Fact]
    public void RecurringJobCron_IsDailyAtNineInJobTimeZone()
    {
        // AC-5: the pass runs once a day at 09:00 (Europe/Zurich). Cron.Daily(9) is Hangfire's
        // canonical "0 9 * * *"; asserting equivalence catches an accidental schedule change.
        DependencyInjection.VolunteerReminderCron.Should().Be("0 9 * * *");
        DependencyInjection.VolunteerReminderCron.Should().Be(Cron.Daily(9));
    }

    [Fact]
    public void ResolveReminderJobTimeZone_ReturnsZurich_WhenHostCanResolveIt()
    {
        // The resolver prefers the IANA id, then the legacy Windows id, then UTC as a last
        // resort. On any host with ICU (Windows) or tzdata (Linux) — i.e. every CI + dev box —
        // it must return the Zurich zone, NOT the UTC fallback.
        var resolved = DependencyInjection.ResolveReminderJobTimeZone(NullLogger.Instance);

        resolved.Should().NotBeNull();

        TimeZoneInfo? zurich = null;
        foreach (var id in new[] { "Europe/Zurich", "W. Europe Standard Time" })
        {
            try { zurich = TimeZoneInfo.FindSystemTimeZoneById(id); break; }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }

        if (zurich is not null)
        {
            resolved.Id.Should().Be(zurich.Id, "the resolver must prefer the real Zurich zone over the UTC fallback");
            resolved.Should().NotBe(TimeZoneInfo.Utc);
        }
        else
        {
            // No tz database on this host — the resolver degrades to UTC by design.
            resolved.Should().Be(TimeZoneInfo.Utc);
        }
    }
}
