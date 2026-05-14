using FluentAssertions;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Application.Events.Volunteers.Commands;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-10 / R4-P-S3-3: handler-level tests for assignment cancellation. The
/// handler resolves the caller's <see cref="Member"/> id (following <c>MergedIntoMemberId</c>
/// once per R3-H-S3-4) and passes it plus the staff flag into
/// <see cref="IEventVolunteerAssignmentService.CancelAssignmentAsync"/>. The C1 ownership +
/// H-S3-2 cross-event enforcement itself lives in the service and is integration-tested in
/// <c>EventVolunteerAssignmentConcurrencyTests</c>.
/// </summary>
public sealed class CancelVolunteerAssignmentCommandHandlerTests
{
    private readonly Mock<IEventVolunteerAssignmentService> _service = new(MockBehavior.Strict);
    private readonly Mock<IMemberRepository> _members = new(MockBehavior.Strict);

    private static Member NewMember() =>
        Member.Create("Meera", "Iyer", "meera@example.com",
            Address.Create("Street 1", "City", "1000", "Country"), MembershipType.Regular);

    [Fact]
    public async Task Handle_StaffCaller_PassesNullCallerMemberId_AndStaffTrue_WithoutResolvingMember()
    {
        var eventId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var callerKeycloakId = Guid.NewGuid();
        var ownerMemberId = Guid.NewGuid();

        var cancelled = EventVolunteerAssignment.CreateConfirmed(Guid.NewGuid(), Guid.NewGuid(), ownerMemberId, Guid.NewGuid());
        _service
            .Setup(s => s.CancelAssignmentAsync(assignmentId, "no longer needed", eventId, null, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Cancelled, cancelled));
        _members
            .Setup(m => m.GetByIdAsync(ownerMemberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var sut = new CancelVolunteerAssignmentCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new CancelVolunteerAssignmentCommand(eventId, assignmentId, "no longer needed", callerKeycloakId, CallerIsStaff: true),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Cancelled);
        // Staff callers never need a Member record — GetByKeycloakUserIdAsync must not be called.
        _members.Verify(m => m.GetByKeycloakUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _service.Verify(
            s => s.CancelAssignmentAsync(assignmentId, "no longer needed", eventId, /* callerMemberId */ null, /* callerIsStaff */ true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_NonStaffCaller_WithNoLinkedMember_ReturnsNotAuthorized_WithoutCallingService()
    {
        var callerKeycloakId = Guid.NewGuid();
        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(callerKeycloakId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var sut = new CancelVolunteerAssignmentCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new CancelVolunteerAssignmentCommand(Guid.NewGuid(), Guid.NewGuid(), null, callerKeycloakId, CallerIsStaff: false),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.NotAuthorized);
        result.Assignment.Should().BeNull();
        // Strict mock: CancelAssignmentAsync was never set up — the handler must short-circuit.
        _service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_NonStaffCaller_WithLinkedMember_PassesResolvedMemberId()
    {
        var eventId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var callerKeycloakId = Guid.NewGuid();
        var caller = NewMember();

        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(callerKeycloakId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(caller);
        var cancelled = EventVolunteerAssignment.CreateConfirmed(Guid.NewGuid(), Guid.NewGuid(), caller.Id, Guid.NewGuid());
        _service
            .Setup(s => s.CancelAssignmentAsync(assignmentId, null, eventId, caller.Id, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Cancelled, cancelled));
        _members
            .Setup(m => m.GetByIdAsync(caller.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(caller);

        var sut = new CancelVolunteerAssignmentCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new CancelVolunteerAssignmentCommand(eventId, assignmentId, null, callerKeycloakId, CallerIsStaff: false),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Cancelled);
        result.Assignment!.MemberDisplayName.Should().Be("Meera Iyer");
        _service.Verify(
            s => s.CancelAssignmentAsync(assignmentId, null, eventId, /* callerMemberId */ caller.Id, /* callerIsStaff */ false, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_NonStaffMergedCaller_FollowsMergedIntoMemberId_ForOwnershipCheck()
    {
        // R3-H-S3-4: a soft-merged member must still be able to cancel an assignment they made
        // under their pre-merge row. The handler resolves the SURVIVING member id.
        var eventId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var callerKeycloakId = Guid.NewGuid();
        var survivingMember = NewMember();
        var mergedSourceMember = NewMember();
        mergedSourceMember.MarkMergedInto(survivingMember.Id, Guid.NewGuid());

        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(callerKeycloakId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(mergedSourceMember);
        _members
            .Setup(m => m.GetByIdAsync(survivingMember.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(survivingMember);
        var cancelled = EventVolunteerAssignment.CreateConfirmed(Guid.NewGuid(), Guid.NewGuid(), survivingMember.Id, Guid.NewGuid());
        _service
            .Setup(s => s.CancelAssignmentAsync(assignmentId, null, eventId, survivingMember.Id, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Cancelled, cancelled));

        var sut = new CancelVolunteerAssignmentCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new CancelVolunteerAssignmentCommand(eventId, assignmentId, null, callerKeycloakId, CallerIsStaff: false),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Cancelled);
        _service.Verify(
            s => s.CancelAssignmentAsync(assignmentId, null, eventId, /* surviving */ survivingMember.Id, false, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ServiceReturnsNullAssignment_ReturnsOutcomeWithNullDto()
    {
        var eventId = Guid.NewGuid();
        var assignmentId = Guid.NewGuid();
        var callerKeycloakId = Guid.NewGuid();

        _service
            .Setup(s => s.CancelAssignmentAsync(assignmentId, null, eventId, null, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null));

        var sut = new CancelVolunteerAssignmentCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new CancelVolunteerAssignmentCommand(eventId, assignmentId, null, callerKeycloakId, CallerIsStaff: true),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.AssignmentNotFound);
        result.Assignment.Should().BeNull();
    }
}
