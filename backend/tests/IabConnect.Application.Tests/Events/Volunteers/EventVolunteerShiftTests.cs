using FluentAssertions;
using IabConnect.Domain.Events.Volunteers;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-1 + AC-10 domain invariants for <see cref="EventVolunteerShift"/>.
/// </summary>
public sealed class EventVolunteerShiftTests
{
    private readonly Guid _eventId = Guid.NewGuid();
    private readonly Guid _roleId = Guid.NewGuid();
    private readonly Guid _createdBy = Guid.NewGuid();

    [Fact]
    public void Create_WithValidData_ProducesShift()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var endsAt = startsAt.AddHours(4);

        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "Greeter", "Welcome attendees", startsAt, endsAt,
            capacity: 5, allowWaitlist: true, allowSelfSignup: true, _createdBy);

        shift.EventId.Should().Be(_eventId);
        shift.RoleId.Should().Be(_roleId);
        shift.Title.Should().Be("Greeter");
        shift.Description.Should().Be("Welcome attendees");
        shift.StartsAt.Should().Be(startsAt);
        shift.EndsAt.Should().Be(endsAt);
        shift.Capacity.Should().Be(5);
        shift.AllowWaitlist.Should().BeTrue();
        shift.AllowSelfSignup.Should().BeTrue();
        shift.UpdatedAt.Should().BeNull();
    }

    [Fact]
    public void Create_EndsAtBeforeStartsAt_Throws()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        Action act = () => EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddMinutes(-1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        act.Should().Throw<ArgumentException>().WithMessage("*EndsAt must be greater than StartsAt*");
    }

    [Fact]
    public void Create_EndsAtEqualsStartsAt_Throws()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        Action act = () => EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt,
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-10000)]
    public void Create_ZeroOrNegativeCapacity_Throws(int capacity)
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        Action act = () => EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: capacity, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        act.Should().Throw<ArgumentException>().WithMessage("*Capacity*");
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(int.MaxValue / 2)]
    public void Create_MinimumAndLargeCapacity_Accepted(int capacity)
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: capacity, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        shift.Capacity.Should().Be(capacity);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_BlankTitle_Throws(string? title)
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        Action act = () => EventVolunteerShift.Create(
            _eventId, _roleId, title!, null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_TitleOverMaxLength_Throws()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var longTitle = new string('a', EventVolunteerShift.TitleMaxLength + 1);
        Action act = () => EventVolunteerShift.Create(
            _eventId, _roleId, longTitle, null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void UpdateCapacity_BelowCurrentConfirmed_Throws()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 5, allowWaitlist: false, allowSelfSignup: false, _createdBy);

        Action act = () => shift.UpdateCapacity(3, currentConfirmedCount: 4);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot reduce capacity below current confirmed count*");
    }

    [Fact]
    public void UpdateCapacity_AtOrAboveCurrentConfirmed_Succeeds()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 5, allowWaitlist: false, allowSelfSignup: false, _createdBy);

        shift.UpdateCapacity(10, currentConfirmedCount: 5);

        shift.Capacity.Should().Be(10);
        shift.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void UpdateCapacity_DecreasesToCurrentConfirmed_Succeeds()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 10, allowWaitlist: false, allowSelfSignup: false, _createdBy);

        // Capacity decrease is permitted down to current confirmed count.
        shift.UpdateCapacity(4, currentConfirmedCount: 4);

        shift.Capacity.Should().Be(4);
    }

    [Fact]
    public void Toggles_AreIdempotentAndMarkUpdated()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);

        shift.EnableWaitlist();
        shift.AllowWaitlist.Should().BeTrue();
        shift.UpdatedAt.Should().NotBeNull();

        var firstUpdate = shift.UpdatedAt!.Value;
        shift.EnableWaitlist(); // already on — should no-op
        shift.UpdatedAt.Should().Be(firstUpdate);

        shift.EnableSelfSignup();
        shift.AllowSelfSignup.Should().BeTrue();
    }

    [Fact]
    public void Cancel_FlipsStatusAndStampsCancelledAt()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        shift.Status.Should().Be(VolunteerShiftStatus.Active);

        shift.Cancel("venue lost");

        shift.Status.Should().Be(VolunteerShiftStatus.Cancelled);
        shift.CancelledAt.Should().NotBeNull();
        shift.CancellationReason.Should().Be("venue lost");
    }

    [Fact]
    public void Cancel_IsIdempotent()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);
        shift.Cancel("first");
        var firstTimestamp = shift.CancelledAt;
        var firstReason = shift.CancellationReason;

        // Idempotent second call leaves the original timestamp + reason in place.
        shift.Cancel("second");

        shift.CancelledAt.Should().Be(firstTimestamp);
        shift.CancellationReason.Should().Be(firstReason);
    }

    [Fact]
    public void Cancel_ReasonOverMaxLength_Throws()
    {
        var startsAt = DateTime.UtcNow.AddDays(1);
        var shift = EventVolunteerShift.Create(
            _eventId, _roleId, "X", null, startsAt, startsAt.AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, _createdBy);

        var longReason = new string('r', EventVolunteerShift.CancellationReasonMaxLength + 1);
        Action act = () => shift.Cancel(longReason);
        act.Should().Throw<ArgumentException>();
    }
}
