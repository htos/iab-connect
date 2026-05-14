using FluentAssertions;
using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events.Calendar;

/// <summary>
/// REQ-086 (E9-S3) AC-2/AC-4: the ICS <c>PRODID</c> is config-driven via
/// <see cref="CalendarFeedSettings"/>. The default exactly preserves the previous hardcoded
/// literal (behaviour-preserving forward-fix into the done Epic 3), and the per-event
/// <c>UID</c> domain suffix is deliberately left untouched so already-issued calendar
/// subscriptions keep matching.
/// </summary>
public sealed class CalendarFeedSettingsTests
{
    private const string BaseUrl = "https://events.example";

    [Fact]
    public void Build_WithDefaultSettings_EmitsThePreviousProdIdLiteral()
    {
        var builder = new CalendarFeedBuilder(new CalendarFeedSettings());

        var ics = builder.Build(Array.Empty<Event>(), BaseUrl);

        ics.Should().Contain("PRODID:-//IAB Connect//Events//EN");
    }

    [Fact]
    public void Build_WithConfiguredProdId_EmitsTheConfiguredValue()
    {
        var builder = new CalendarFeedBuilder(
            new CalendarFeedSettings { ProdId = "-//Acme Verein//Events//EN" });

        var ics = builder.Build(Array.Empty<Event>(), BaseUrl);

        ics.Should().Contain("PRODID:-//Acme Verein//Events//EN");
        ics.Should().NotContain("PRODID:-//IAB Connect//Events//EN");
    }

    [Fact]
    public void Build_DoesNotChangeTheEventUidDomainSuffix()
    {
        // AC-4: the @iabconnect UID suffix is a machine identifier — changing it would break
        // already-issued calendar UIDs, so it stays even when PRODID is reconfigured.
        var builder = new CalendarFeedBuilder(
            new CalendarFeedSettings { ProdId = "-//Acme Verein//Events//EN" });
        var evt = Event.Create(
            "Festival", "Desc", "Hall",
            DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(3));

        var ics = builder.Build([evt], BaseUrl);

        ics.Should().Contain($"UID:{evt.Id:D}@iabconnect");
    }
}
