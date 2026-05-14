using FluentAssertions;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Application.Events.Volunteers.Commands;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-10 / R4-P-S3-3: handler-level tests for member-driven self-signup. The
/// handler resolves the calling Keycloak user to a <see cref="Member"/>, then delegates to
/// <see cref="IEventVolunteerAssignmentService.AssignAsync"/> with <c>isSelfSignup: true</c>.
/// The capacity decision itself is integration-tested in <c>EventVolunteerAssignmentConcurrencyTests</c>.
/// </summary>
public sealed class SelfSignUpForVolunteerShiftCommandHandlerTests
{
    private readonly Mock<IEventVolunteerAssignmentService> _service = new(MockBehavior.Strict);
    private readonly Mock<IMemberRepository> _members = new(MockBehavior.Strict);

    private static Member NewMember() =>
        Member.Create("Ravi", "Sharma", "ravi@example.com",
            Address.Create("Street 1", "City", "1000", "Country"), MembershipType.Regular);

    [Fact]
    public async Task Handle_NoLinkedMember_ReturnsNoMemberLink_AndNeverCallsService()
    {
        var keycloakUserId = Guid.NewGuid();
        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(keycloakUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var sut = new SelfSignUpForVolunteerShiftCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new SelfSignUpForVolunteerShiftCommand(Guid.NewGuid(), Guid.NewGuid(), keycloakUserId, AllowWaitlistFallback: false),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.NoMemberLink);
        result.Assignment.Should().BeNull();
        // Strict mock: AssignAsync was never set up, so the handler must not have called it.
        _service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_LinkedMember_DelegatesWithResolvedMemberId_AndSelfSignupTrue()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var keycloakUserId = Guid.NewGuid();
        var member = NewMember();

        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(keycloakUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);
        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, member.Id, keycloakUserId, true, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(
                VolunteerAssignmentOutcome.Confirmed,
                EventVolunteerAssignment.CreateConfirmed(shiftId, Guid.NewGuid(), member.Id, keycloakUserId)));

        var sut = new SelfSignUpForVolunteerShiftCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new SelfSignUpForVolunteerShiftCommand(eventId, shiftId, keycloakUserId, AllowWaitlistFallback: true),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Confirmed);
        result.Assignment!.MemberDisplayName.Should().Be("Ravi Sharma");
        _service.Verify(
            s => s.AssignAsync(eventId, shiftId, member.Id, keycloakUserId, true, /* isSelfSignup */ true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ServiceReturnsNullAssignment_ReturnsOutcomeWithNullDto()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var keycloakUserId = Guid.NewGuid();
        var member = NewMember();

        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(keycloakUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);
        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, member.Id, keycloakUserId, false, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.SignupNotAllowed, null));

        var sut = new SelfSignUpForVolunteerShiftCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new SelfSignUpForVolunteerShiftCommand(eventId, shiftId, keycloakUserId, AllowWaitlistFallback: false),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.SignupNotAllowed);
        result.Assignment.Should().BeNull();
    }

    [Fact]
    public async Task Handle_Waitlisted_ProjectsWaitlistPositionOntoDto()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var keycloakUserId = Guid.NewGuid();
        var member = NewMember();

        _members
            .Setup(m => m.GetByKeycloakUserIdAsync(keycloakUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);
        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, member.Id, keycloakUserId, true, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(
                VolunteerAssignmentOutcome.Waitlisted,
                EventVolunteerAssignment.CreateWaitlisted(shiftId, Guid.NewGuid(), member.Id, keycloakUserId, position: 2)));

        var sut = new SelfSignUpForVolunteerShiftCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new SelfSignUpForVolunteerShiftCommand(eventId, shiftId, keycloakUserId, AllowWaitlistFallback: true),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Waitlisted);
        result.Assignment!.Status.Should().Be(VolunteerAssignmentStatus.Waitlisted);
        result.Assignment.Position.Should().Be(2);
    }
}
