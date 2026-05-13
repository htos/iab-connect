using FluentAssertions;
using IabConnect.Domain.Events.Volunteers;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-1 + AC-10 domain invariants for <see cref="EventVolunteerAssignment"/>.
/// </summary>
public sealed class EventVolunteerAssignmentTests
{
    private readonly Guid _shiftId = Guid.NewGuid();
    private readonly Guid _roleId = Guid.NewGuid();
    private readonly Guid _memberId = Guid.NewGuid();
    private readonly Guid _assignedBy = Guid.NewGuid();

    [Fact]
    public void CreateConfirmed_PopulatesFields()
    {
        var assignment = EventVolunteerAssignment.CreateConfirmed(_shiftId, _roleId, _memberId, _assignedBy);

        assignment.ShiftId.Should().Be(_shiftId);
        assignment.RoleId.Should().Be(_roleId);
        assignment.MemberId.Should().Be(_memberId);
        assignment.AssignedBy.Should().Be(_assignedBy);
        assignment.Status.Should().Be(VolunteerAssignmentStatus.Confirmed);
        assignment.Position.Should().BeNull();
        assignment.AssignedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void CreateWaitlisted_PopulatesFields()
    {
        var assignment = EventVolunteerAssignment.CreateWaitlisted(_shiftId, _roleId, _memberId, _assignedBy, position: 3);

        assignment.Status.Should().Be(VolunteerAssignmentStatus.Waitlisted);
        assignment.Position.Should().Be(3);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void CreateWaitlisted_ZeroOrNegativePosition_Throws(int position)
    {
        Action act = () => EventVolunteerAssignment.CreateWaitlisted(_shiftId, _roleId, _memberId, _assignedBy, position);
        act.Should().Throw<ArgumentException>().WithMessage("*Waitlist position must be 1 or greater*");
    }

    [Fact]
    public void Create_EmptyGuidArg_Throws()
    {
        Action act = () => EventVolunteerAssignment.CreateConfirmed(Guid.Empty, _roleId, _memberId, _assignedBy);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void PromoteFromWaitlist_Confirms_AndClearsPosition()
    {
        var assignment = EventVolunteerAssignment.CreateWaitlisted(_shiftId, _roleId, _memberId, _assignedBy, position: 1);

        assignment.PromoteFromWaitlist();

        assignment.Status.Should().Be(VolunteerAssignmentStatus.Confirmed);
        assignment.Position.Should().BeNull();
    }

    [Fact]
    public void PromoteFromWaitlist_NotWaitlisted_Throws()
    {
        var assignment = EventVolunteerAssignment.CreateConfirmed(_shiftId, _roleId, _memberId, _assignedBy);
        Action act = () => assignment.PromoteFromWaitlist();
        act.Should().Throw<InvalidOperationException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void UpdateWaitlistPosition_ZeroOrNegative_Throws(int position)
    {
        var assignment = EventVolunteerAssignment.CreateWaitlisted(_shiftId, _roleId, _memberId, _assignedBy, position: 2);
        Action act = () => assignment.UpdateWaitlistPosition(position);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void UpdateWaitlistPosition_NotWaitlisted_Throws()
    {
        var assignment = EventVolunteerAssignment.CreateConfirmed(_shiftId, _roleId, _memberId, _assignedBy);
        Action act = () => assignment.UpdateWaitlistPosition(1);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Cancel_TransitionsToCancelled_AndStampsReason()
    {
        var assignment = EventVolunteerAssignment.CreateConfirmed(_shiftId, _roleId, _memberId, _assignedBy);

        assignment.Cancel("conflict");

        assignment.Status.Should().Be(VolunteerAssignmentStatus.Cancelled);
        assignment.CancelledAt.Should().NotBeNull();
        assignment.CancellationReason.Should().Be("conflict");
        assignment.Position.Should().BeNull();
    }

    [Fact]
    public void Cancel_AlreadyCancelled_Throws()
    {
        var assignment = EventVolunteerAssignment.CreateConfirmed(_shiftId, _roleId, _memberId, _assignedBy);
        assignment.Cancel(null);
        Action act = () => assignment.Cancel(null);
        act.Should().Throw<InvalidOperationException>();
    }
}
