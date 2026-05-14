using FluentAssertions;
using IabConnect.Application.Events;
using IabConnect.Application.Events.Jobs;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Jobs;

/// <summary>
/// REQ-024 (E3.S4) AC-9: behavioural coverage for the volunteer-shift reminder service.
/// All collaborators are mocked; <see cref="FakeTimeProvider"/> drives deterministic windows.
/// </summary>
public sealed class VolunteerShiftReminderServiceTests
{
    private readonly Mock<IEventVolunteerAssignmentRepository> _assignments = new(MockBehavior.Strict);
    private readonly Mock<IEventNotificationService> _notifications = new(MockBehavior.Strict);
    private readonly Mock<IMemberRepository> _members = new(MockBehavior.Strict);
    private readonly FakeTimeProvider _time = new();

    public VolunteerShiftReminderServiceTests()
    {
        _time.SetUtcNow(new DateTimeOffset(2026, 5, 13, 9, 0, 0, TimeSpan.Zero));
    }

    private VolunteerShiftReminderService Sut() => new(
        _assignments.Object, _notifications.Object, _members.Object, _time,
        NullLogger<VolunteerShiftReminderService>.Instance);

    [Fact]
    public async Task ExecuteAsync_NoRowsInWindow_ReturnsZero_AndDoesNotSend()
    {
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<VolunteerReminderDueRow>());

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(0);
        _notifications.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ExecuteAsync_ThreeDueRows_AllSent_AndMarked()
    {
        var rows = new[] { CreateDueRow(), CreateDueRow(), CreateDueRow() };
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(rows);

        foreach (var row in rows)
        {
            _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(CreateMember(row.Assignment.MemberId));
            _notifications
                .Setup(n => n.SendVolunteerShiftReminderAsync(
                    row.Assignment, row.Shift, row.Role, row.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            _assignments
                .Setup(a => a.MarkReminderSentAsync(row.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
        }

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(3);
        _notifications.Verify(n => n.SendVolunteerShiftReminderAsync(
            It.IsAny<EventVolunteerAssignment>(), It.IsAny<EventVolunteerShift>(),
            It.IsAny<EventVolunteerRole>(), It.IsAny<Event>(), It.IsAny<Member>(),
            It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task ExecuteAsync_SendFailsForOneRow_OtherRowsStillSent()
    {
        var ok1 = CreateDueRow();
        var fail = CreateDueRow();
        var ok2 = CreateDueRow();

        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { ok1, fail, ok2 });

        foreach (var row in new[] { ok1, fail, ok2 })
        {
            _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(CreateMember(row.Assignment.MemberId));
        }

        _notifications
            .Setup(n => n.SendVolunteerShiftReminderAsync(
                ok1.Assignment, ok1.Shift, ok1.Role, ok1.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _notifications
            .Setup(n => n.SendVolunteerShiftReminderAsync(
                fail.Assignment, fail.Shift, fail.Role, fail.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("smtp boom"));
        _notifications
            .Setup(n => n.SendVolunteerShiftReminderAsync(
                ok2.Assignment, ok2.Shift, ok2.Role, ok2.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _assignments.Setup(a => a.MarkReminderSentAsync(ok1.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _assignments.Setup(a => a.MarkReminderSentAsync(ok2.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(2, "the SMTP failure must not stop the next row");
        _assignments.Verify(a => a.MarkReminderSentAsync(fail.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_MemberNotFound_SkipsRow_AndContinues()
    {
        var row = CreateDueRow();
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { row });
        _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(0);
        _notifications.Verify(n => n.SendVolunteerShiftReminderAsync(
            It.IsAny<EventVolunteerAssignment>(), It.IsAny<EventVolunteerShift>(),
            It.IsAny<EventVolunteerRole>(), It.IsAny<Event>(), It.IsAny<Member>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_QueryWindow_IsNowToNowPlus36h()
    {
        // Post-review H-S4-4: window extended from 24h to 36h so the daily 09:00 Europe/Zurich
        // cron catches shifts that start between 09:01 and 23:59 the following day. With a 24h
        // window an evening shift starting tomorrow at 20:00 would be missed entirely.
        DateTime capturedStart = default, capturedEnd = default;
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Callback<DateTime, DateTime, CancellationToken>((s, e, _) => { capturedStart = s; capturedEnd = e; })
            .ReturnsAsync(Array.Empty<VolunteerReminderDueRow>());

        await Sut().ExecuteAsync(CancellationToken.None);

        capturedStart.Should().Be(_time.GetUtcNow().UtcDateTime);
        capturedEnd.Should().Be(_time.GetUtcNow().UtcDateTime.AddHours(36));
    }

    [Fact]
    public async Task ExecuteAsync_MemberEmailNullOrEmpty_SkipsRow_DoesNotMark()
    {
        // Post-review H-S4-6: a null/empty Member.Email previously caused the SMTP layer to
        // throw, which was swallowed and then the row was marked-sent-forever. After the fix,
        // we surface a LogWarning and intentionally leave ReminderSentAt null so the row
        // resurfaces if the operator backfills the email address.
        var row = CreateDueRow();
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { row });
        _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateMember(row.Assignment.MemberId, email: ""));

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(0);
        _notifications.Verify(n => n.SendVolunteerShiftReminderAsync(
            It.IsAny<EventVolunteerAssignment>(), It.IsAny<EventVolunteerShift>(),
            It.IsAny<EventVolunteerRole>(), It.IsAny<Event>(), It.IsAny<Member>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _assignments.Verify(a => a.MarkReminderSentAsync(
            row.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_MarkReturnsFalse_DoesNotIncrementSent_AndContinues()
    {
        // Post-review M-S4-1: when MarkReminderSentAsync returns false (row already marked, e.g.
        // overlapping cron + manual enqueue) we log a warning but do NOT abort the batch.
        var row1 = CreateDueRow();
        var row2 = CreateDueRow();
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { row1, row2 });

        foreach (var row in new[] { row1, row2 })
        {
            _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(CreateMember(row.Assignment.MemberId));
            _notifications
                .Setup(n => n.SendVolunteerShiftReminderAsync(
                    row.Assignment, row.Shift, row.Role, row.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        }

        _assignments.Setup(a => a.MarkReminderSentAsync(row1.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _assignments.Setup(a => a.MarkReminderSentAsync(row2.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(1, "row1's mark returned false so it does not count, but row2 still ran");
    }

    [Fact]
    public async Task ExecuteAsync_SendThrows_RowIsNotMarked()
    {
        // Post-review C2: the SMTP throw must NOT result in MarkReminderSentAsync being
        // called — otherwise a transient outage marks the row sent-forever.
        var row = CreateDueRow();
        _assignments
            .Setup(a => a.GetRemindersDueAsync(It.IsAny<DateTime>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { row });
        _members.Setup(m => m.GetByIdAsync(row.Assignment.MemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateMember(row.Assignment.MemberId));
        _notifications
            .Setup(n => n.SendVolunteerShiftReminderAsync(
                row.Assignment, row.Shift, row.Role, row.Event, It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("smtp boom"));

        var sent = await Sut().ExecuteAsync(CancellationToken.None);

        sent.Should().Be(0);
        _assignments.Verify(a => a.MarkReminderSentAsync(
            row.Assignment.Id, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private static VolunteerReminderDueRow CreateDueRow()
    {
        var memberId = Guid.NewGuid();
        var assignedBy = Guid.NewGuid();
        var assignment = EventVolunteerAssignment.CreateConfirmed(
            Guid.NewGuid(), Guid.NewGuid(), memberId, assignedBy);
        var role = EventVolunteerRole.Create(Guid.NewGuid(), "Greeter", null, assignedBy);
        var shift = EventVolunteerShift.Create(
            role.EventId, role.Id, "Shift", null,
            DateTime.UtcNow.AddHours(2), DateTime.UtcNow.AddHours(4),
            capacity: 2, allowWaitlist: false, allowSelfSignup: true, createdBy: assignedBy);
        var evt = Event.Create("Test event", "desc", "venue", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(3));
        return new VolunteerReminderDueRow(assignment, shift, role, evt);
    }

    private static Member CreateMember(Guid id, string? email = null)
    {
        var resolvedEmail = email ?? $"{id:N}@example.com";
        var member = Member.Create("Test", "Person", resolvedEmail,
            Address.Create("Street 1", "City", "1000", "Country"),
            MembershipType.Regular);
        // R3-M-S4-5: the reminder service now also filters Inactive / Pending / merged members
        // in-memory (defense-in-depth on top of the DB-side filter in GetRemindersDueAsync).
        // Test fixture members were Pending by default — activate them so the existing tests
        // exercise the reminder send path rather than the new skip-on-inactive branch.
        member.Activate();
        return member;
    }
}
