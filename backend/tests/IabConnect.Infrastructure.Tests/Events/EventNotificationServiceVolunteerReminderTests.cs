using FluentAssertions;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Events;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-024 (E3.S4 review C2 + C3 + H-S4-2): infrastructure-level coverage for the bilingual
/// volunteer reminder builder. Validates the three review-driven invariants:
///   • subject CR/LF stripping (H-S4-2),
///   • SMTP exceptions propagate to the caller instead of being swallowed (C2),
///   • shift times are formatted in Europe/Zurich wall-clock time, not UTC (C3).
/// </summary>
public sealed class EventNotificationServiceVolunteerReminderTests
{
    private readonly Mock<IEmailSender> _emailSender = new(MockBehavior.Strict);
    private readonly SmtpSettings _smtp = new()
    {
        FromName = "IAB Connect",
        FromEmail = "no-reply@example.com",
    };

    private EventNotificationService BuildService()
    {
        return new EventNotificationService(
            _emailSender.Object,
            Options.Create(_smtp),
            NullLogger<EventNotificationService>.Instance);
    }

    [Fact]
    public async Task SendVolunteerShiftReminderAsync_SmtpThrows_PropagatesException()
    {
        // Post-review C2: previously the SendEmailAsync wrapper swallowed SMTP errors which let
        // the caller mark the assignment "sent forever" even though no email was delivered.
        // After the fix the reminder path calls IEmailSender directly so failures escape.
        _emailSender
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("smtp connection refused"));

        var (assignment, shift, role, evt, member) = CreateScenario();
        var sut = BuildService();

        var act = async () => await sut.SendVolunteerShiftReminderAsync(
            assignment, shift, role, evt, member, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("smtp connection refused");
    }

    [Fact]
    public async Task SendVolunteerShiftReminderAsync_EventTitleContainsCrLf_SubjectIsSanitized()
    {
        // Post-review H-S4-2: a CR/LF inside Event.Title would let an attacker terminate the
        // Subject header and inject Bcc/CC headers downstream. Strip them at the boundary.
        string? capturedSubject = null;
        _emailSender
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, string, string, CancellationToken>(
                (_, subject, _, _, _, _, _) => capturedSubject = subject)
            .Returns(Task.CompletedTask);

        var (assignment, shift, role, evt, member) = CreateScenario(
            eventTitle: "Spring Gala\r\nBcc: attacker@example.com");
        var sut = BuildService();

        await sut.SendVolunteerShiftReminderAsync(
            assignment, shift, role, evt, member, TestContext.Current.CancellationToken);

        capturedSubject.Should().NotBeNull();
        capturedSubject!.Should().NotContain("\r").And.NotContain("\n");
        capturedSubject.Should().Contain("Spring Gala");
        capturedSubject.Should().Contain("Bcc: attacker@example.com",
            because: "after sanitization the original text is collapsed onto one line — the danger was the line break, not the literal substring");
    }

    [Fact]
    public async Task SendVolunteerShiftReminderAsync_BodyContainsBothLanguageBlocks()
    {
        string capturedHtml = string.Empty;
        string? capturedPlain = string.Empty;
        _emailSender
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, string, string, CancellationToken>(
                (_, _, html, plain, _, _, _) => { capturedHtml = html; capturedPlain = plain; })
            .Returns(Task.CompletedTask);

        var (assignment, shift, role, evt, member) = CreateScenario();
        var sut = BuildService();

        await sut.SendVolunteerShiftReminderAsync(
            assignment, shift, role, evt, member, TestContext.Current.CancellationToken);

        capturedHtml.Should().Contain("<h2>Erinnerung: deine Helfer-Schicht</h2>");
        capturedHtml.Should().Contain("<h2>Reminder: your volunteer shift</h2>");
        capturedPlain.Should().NotBeNull();
        capturedPlain!.Should().Contain("Erinnerung: deine Helfer-Schicht");
        capturedPlain.Should().Contain("--- English ---");
        capturedPlain.Should().Contain("Reminder: your volunteer shift");
    }

    [Fact]
    public async Task SendVolunteerShiftReminderAsync_FormatsTimesInEuropeZurich_NotUtc()
    {
        // Post-review C3: the shift StartsAt is persisted as UTC. The reminder body MUST show
        // wall-clock Europe/Zurich (UTC+1 in winter, UTC+2 in summer). 2026-05-13 is CEST so
        // a UTC value of 06:00 must render as 08:00.
        string capturedHtml = string.Empty;
        _emailSender
            .Setup(s => s.SendAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, string, string?, string, string, CancellationToken>(
                (_, _, html, _, _, _, _) => capturedHtml = html)
            .Returns(Task.CompletedTask);

        var startsUtc = new DateTime(2026, 5, 13, 6, 0, 0, DateTimeKind.Utc);
        var endsUtc = new DateTime(2026, 5, 13, 10, 0, 0, DateTimeKind.Utc);
        var (assignment, shift, role, evt, member) = CreateScenario(
            shiftStartsAtUtc: startsUtc, shiftEndsAtUtc: endsUtc);
        var sut = BuildService();

        await sut.SendVolunteerShiftReminderAsync(
            assignment, shift, role, evt, member, TestContext.Current.CancellationToken);

        // The host running this test may not have Europe/Zurich available (Windows-without-ICU).
        // In that fallback path the formatter tags the line with "(UTC)" so the assertion still
        // succeeds — we only assert wall-clock conversion when the tz IS available.
        var zurichAvailable = TryFindZurichTimeZone();
        if (zurichAvailable)
        {
            capturedHtml.Should().Contain("13.05.2026 08:00",
                because: "06:00 UTC on 2026-05-13 is 08:00 in Europe/Zurich (CEST, UTC+2)");
            capturedHtml.Should().Contain("13.05.2026 12:00",
                because: "10:00 UTC on 2026-05-13 is 12:00 in Europe/Zurich (CEST, UTC+2)");
        }
        else
        {
            capturedHtml.Should().Contain("(UTC)",
                because: "when the Zurich tz cannot be resolved we keep UTC and surface that fact loudly");
        }
    }

    private static bool TryFindZurichTimeZone()
    {
        foreach (var id in new[] { "Europe/Zurich", "W. Europe Standard Time" })
        {
            try { TimeZoneInfo.FindSystemTimeZoneById(id); return true; }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return false;
    }

    private static (EventVolunteerAssignment, EventVolunteerShift, EventVolunteerRole, Event, Member) CreateScenario(
        string eventTitle = "Spring Gala",
        DateTime? shiftStartsAtUtc = null,
        DateTime? shiftEndsAtUtc = null)
    {
        var assignedBy = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var role = EventVolunteerRole.Create(Guid.NewGuid(), "Greeter", null, assignedBy);
        var shift = EventVolunteerShift.Create(
            role.EventId, role.Id, "Eingang", null,
            shiftStartsAtUtc ?? DateTime.UtcNow.AddHours(8),
            shiftEndsAtUtc ?? DateTime.UtcNow.AddHours(12),
            capacity: 2, allowWaitlist: false, allowSelfSignup: true, createdBy: assignedBy);
        var assignment = EventVolunteerAssignment.CreateConfirmed(shift.Id, role.Id, memberId, assignedBy);
        var evt = Event.Create(eventTitle, "Beschreibung", "Bern",
            DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(6));
        var member = Member.Create("Anna", "Müller", "anna@example.com",
            Address.Create("Street 1", "Bern", "3000", "CH"),
            MembershipType.Regular);
        return (assignment, shift, role, evt, member);
    }
}
