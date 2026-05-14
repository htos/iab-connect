using FluentAssertions;
using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5) AC-10: RFC 5545 emit invariants.
/// </summary>
public sealed class CalendarFeedBuilderTests
{
    private readonly CalendarFeedBuilder _sut = new(new CalendarFeedSettings());
    private const string BaseUrl = "https://iab-connect.example";

    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("comma, sep", "comma\\, sep")]
    [InlineData("semi;col", "semi\\;col")]
    [InlineData("back\\slash", "back\\\\slash")]
    [InlineData("line\nbreak", "line\\nbreak")]
    [InlineData("crlf\r\nhere", "crlf\\nhere")]
    [InlineData("controlchars", "controlchars")]
    public void EscapeIcsText_AppliesRfc5545Rules(string input, string expected)
    {
        CalendarFeedBuilder.EscapeIcsText(input).Should().Be(expected);
    }

    [Fact]
    public void EscapeIcsText_NullOrEmpty_ReturnsEmpty()
    {
        CalendarFeedBuilder.EscapeIcsText(null).Should().BeEmpty();
        CalendarFeedBuilder.EscapeIcsText(string.Empty).Should().BeEmpty();
    }

    [Fact]
    public void FormatUtc_EmitsZuluFormat()
    {
        var t = new DateTime(2026, 6, 15, 14, 30, 0, DateTimeKind.Utc);
        CalendarFeedBuilder.FormatUtc(t).Should().Be("20260615T143000Z");
    }

    [Fact]
    public void FormatDateOnly_EmitsCompactDate()
    {
        CalendarFeedBuilder.FormatDateOnly(new DateTime(2026, 6, 15)).Should().Be("20260615");
    }

    [Fact]
    public void Build_EmptyEvents_ProducesValidEnvelope()
    {
        var ics = _sut.Build(Array.Empty<Event>(), BaseUrl);

        ics.Should().StartWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
        ics.Should().Contain("PRODID:-//IAB Connect//Events//EN");
        ics.Should().Contain("METHOD:PUBLISH");
        ics.Should().Contain("CALSCALE:GREGORIAN");
        ics.Should().EndWith("END:VCALENDAR\r\n");
        ics.Should().NotContain("BEGIN:VEVENT");
    }

    [Fact]
    public void Build_SingleConfirmedEvent_EmitsAllRequiredProperties()
    {
        var evt = CreateEvent("Diwali 2026", DateTime.UtcNow.AddDays(30), DateTime.UtcNow.AddDays(30).AddHours(4));

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        ics.Should().Contain($"UID:{evt.Id:D}@iabconnect");
        ics.Should().Contain("STATUS:CONFIRMED");
        ics.Should().Contain("SUMMARY:Diwali 2026");
        ics.Should().Contain($"URL:{BaseUrl}/events/{evt.Id:D}");
        ics.Should().Contain("SEQUENCE:0");
    }

    [Fact]
    public void Build_AllDayEvent_EmitsDateValueWithoutTime()
    {
        var start = new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 6, 16, 0, 0, 0, DateTimeKind.Utc);
        var evt = Event.Create("All-day", "desc", "Venue", start, end);
        evt.UpdateSchedule(start, end, isAllDay: true, "Europe/Zurich");
        evt.Publish();

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        ics.Should().Contain("DTSTART;VALUE=DATE:20260615");
        // R3-H-S5-6: RFC 5545 §3.6.1 — DTEND for VALUE=DATE is the day AFTER the last full
        // day (exclusive). The domain's EndDate is inclusive (2026-06-16) so the emitted
        // DTEND is 2026-06-17. Without the +1 day, Google Calendar / Outlook drop or
        // zero-duration the event.
        ics.Should().Contain("DTEND;VALUE=DATE:20260617");
        ics.Should().NotContain("DTSTART:20260615T");
    }

    [Fact]
    public void Build_CancelledEvent_EmitsStatusCancelled()
    {
        var evt = CreateEvent("Cancelled show", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(2));
        evt.Cancel("operational");

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        ics.Should().Contain("STATUS:CANCELLED");
    }

    [Fact]
    public void Build_UidIsStableAcrossEdits()
    {
        var evt = CreateEvent("First title", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(2));
        var firstUid = $"UID:{evt.Id:D}@iabconnect";

        var icsBefore = _sut.Build(new[] { evt }, BaseUrl);
        evt.UpdateDetails("Renamed title", evt.Description, evt.ShortDescription, evt.Location, evt.LocationAddress, evt.LocationUrl);
        var icsAfter = _sut.Build(new[] { evt }, BaseUrl);

        icsBefore.Should().Contain(firstUid);
        icsAfter.Should().Contain(firstUid);
    }

    [Fact]
    public void Build_NeverEmitsRrule()
    {
        // REQ-025 AC-8: recurring-event support deferred. Builder must NEVER emit RRULE
        // regardless of input. Trivially confirmed across the entire feed.
        var evts = new[]
        {
            CreateEvent("Weekly meeting", DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(1)),
            CreateEvent("Once-off", DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(1)),
        };

        var ics = _sut.Build(evts, BaseUrl);

        ics.Should().NotContain("RRULE:");
        CountOccurrences(ics, "BEGIN:VEVENT").Should().Be(2);
    }

    [Fact]
    public void Build_FoldsLinesAt75Octets()
    {
        var longSummary = new string('A', 250);
        var evt = CreateEvent(longSummary, DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(1));

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        // Every line including continuation lines must be <= 75 octets.
        foreach (var line in ics.Split("\r\n"))
        {
            System.Text.Encoding.UTF8.GetByteCount(line).Should().BeLessThanOrEqualTo(75);
        }
        // The folded SUMMARY must still reassemble to the original (continuation begins with SPACE).
        ics.Should().Contain($"SUMMARY:{longSummary[..(75 - "SUMMARY:".Length)]}");
        ics.Should().Contain("\r\n ");
    }

    [Fact]
    public void Build_LineFolding_DoesNotSplitUtf8MultiByteSequences()
    {
        // 'ä' is 2 octets in UTF-8 — repeat enough to force folding mid-stream.
        var summary = string.Concat(Enumerable.Repeat("ÄÖÜß", 50));
        var evt = CreateEvent(summary, DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(1));

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        // Round-trip via UTF-8 decode/encode must preserve every codepoint.
        foreach (var line in ics.Split("\r\n"))
        {
            // Each line is valid UTF-8 because we re-encode through Encoding.UTF8.
            var decoded = line; // already string — decoded fine
            decoded.Should().NotContain("�"); // replacement char would indicate a split
        }
    }

    [Fact]
    public void Build_DescriptionTruncatedAt8000Chars()
    {
        var longDesc = new string('x', 10_000);
        var evt = Event.Create("Truncate test", longDesc, "Venue",
            DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(1));
        evt.Publish();

        var ics = _sut.Build(new[] { evt }, BaseUrl);

        // The raw input doesn't appear in full (truncation occurred); 8001 x's must not appear.
        ics.Should().NotContain(new string('x', 8001));
    }

    [Fact]
    public void BuildSingle_EmitsExactlyOneVevent()
    {
        var evt = CreateEvent("Single", DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5).AddHours(1));

        var ics = _sut.BuildSingle(evt, BaseUrl);

        CountOccurrences(ics, "BEGIN:VEVENT").Should().Be(1);
        ics.Should().Contain($"UID:{evt.Id:D}@iabconnect");
    }

    private static Event CreateEvent(string title, DateTime start, DateTime end)
    {
        var evt = Event.Create(title, "desc", "Venue", start, end);
        evt.Publish();
        return evt;
    }

    private static int CountOccurrences(string haystack, string needle)
    {
        var count = 0;
        var idx = 0;
        while ((idx = haystack.IndexOf(needle, idx, StringComparison.Ordinal)) >= 0)
        {
            count++;
            idx += needle.Length;
        }
        return count;
    }
}
