using FluentAssertions;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Application.Events.Volunteers.Commands;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-10 / R4-P-S3-3: handler-level tests for the manager-driven assignment
/// command. The transactional capacity/waitlist decision lives in
/// <see cref="IEventVolunteerAssignmentService"/> and is integration-tested against real
/// PostgreSQL in <c>EventVolunteerAssignmentConcurrencyTests</c>; here the service is mocked so
/// these tests assert the handler's routing + DTO projection.
///
/// <para>The capacity-matrix <see cref="Theory"/> drives the mock with the outcome the real
/// service would decide for each <c>(confirmedCount, capacity, allowWaitlist,
/// allowWaitlistFallback)</c> cell — it documents the decision table AC-10 calls for and
/// proves the handler maps every cell to the right <see cref="VolunteerAssignmentCommandResult"/>.</para>
/// </summary>
public sealed class AssignVolunteerCommandHandlerTests
{
    private readonly Mock<IEventVolunteerAssignmentService> _service = new(MockBehavior.Strict);
    private readonly Mock<IMemberRepository> _members = new(MockBehavior.Strict);

    private static Member NewMember() =>
        Member.Create("Asha", "Patel", "asha@example.com",
            Address.Create("Street 1", "City", "1000", "Country"), MembershipType.Regular);

    /// <summary>
    /// AC-10 capacity / waitlist decision matrix — ≥8 rows covering slot-available, at-capacity,
    /// waitlist-allowed-vs-not, and fallback-requested-vs-not.
    /// </summary>
    public static TheoryData<int, int, bool, bool, VolunteerAssignmentOutcome> CapacityMatrix() => new()
    {
        // confirmedCount, capacity, allowWaitlist, allowWaitlistFallback, expectedOutcome
        { 0, 3, false, false, VolunteerAssignmentOutcome.Confirmed },   // free slot
        { 2, 3, false, false, VolunteerAssignmentOutcome.Confirmed },   // last free slot
        { 3, 3, false, false, VolunteerAssignmentOutcome.ShiftFull },   // full, no waitlist
        { 3, 3, true,  false, VolunteerAssignmentOutcome.ShiftFull },   // full, waitlist on but fallback not requested
        { 3, 3, false, true,  VolunteerAssignmentOutcome.ShiftFull },   // full, fallback requested but shift has no waitlist
        { 3, 3, true,  true,  VolunteerAssignmentOutcome.Waitlisted },  // full, waitlist on + fallback requested
        { 5, 3, true,  true,  VolunteerAssignmentOutcome.Waitlisted },  // over capacity, waitlisted
        { 0, 1, true,  true,  VolunteerAssignmentOutcome.Confirmed },   // free slot — fallback irrelevant
        { 1, 1, true,  true,  VolunteerAssignmentOutcome.Waitlisted },  // single-slot shift, full → waitlist
    };

    [Theory]
    [MemberData(nameof(CapacityMatrix))]
    public async Task Handle_CapacityMatrix_MapsServiceOutcomeAndProjectsDto(
        int confirmedCount,
        int capacity,
        bool allowWaitlist,
        bool allowWaitlistFallback,
        VolunteerAssignmentOutcome expectedOutcome)
    {
        // Self-check: the expected outcome of each theory row IS the documented capacity-decision
        // rule applied to the four inputs — confirmed when a slot is free, waitlisted only when the
        // shift permits a waitlist AND the caller opted into the fallback, full otherwise. This
        // keeps the matrix internally consistent and exercises every parameter.
        var slotAvailable = confirmedCount < capacity;
        var derivedExpected = slotAvailable
            ? VolunteerAssignmentOutcome.Confirmed
            : allowWaitlist && allowWaitlistFallback
                ? VolunteerAssignmentOutcome.Waitlisted
                : VolunteerAssignmentOutcome.ShiftFull;
        derivedExpected.Should().Be(expectedOutcome,
            "the theory row must match the documented capacity-decision rule");

        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        var assignedBy = Guid.NewGuid();
        var member = NewMember();

        var producesAssignment = expectedOutcome is VolunteerAssignmentOutcome.Confirmed
            or VolunteerAssignmentOutcome.Waitlisted;
        EventVolunteerAssignment? assignment = expectedOutcome switch
        {
            VolunteerAssignmentOutcome.Confirmed =>
                EventVolunteerAssignment.CreateConfirmed(shiftId, roleId, member.Id, assignedBy),
            VolunteerAssignmentOutcome.Waitlisted =>
                EventVolunteerAssignment.CreateWaitlisted(shiftId, roleId, member.Id, assignedBy, position: confirmedCount - capacity + 1),
            _ => null,
        };

        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, member.Id, assignedBy, allowWaitlistFallback, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(expectedOutcome, assignment));
        if (producesAssignment)
        {
            _members
                .Setup(m => m.GetByIdAsync(member.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(member);
        }

        var sut = new AssignVolunteerCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new AssignVolunteerCommand(eventId, shiftId, member.Id, allowWaitlistFallback, assignedBy),
            CancellationToken.None);

        result.Outcome.Should().Be(expectedOutcome);
        if (producesAssignment)
        {
            result.Assignment.Should().NotBeNull();
            result.Assignment!.MemberId.Should().Be(member.Id);
            result.Assignment.MemberDisplayName.Should().Be("Asha Patel");
            result.Assignment.Status.Should().Be(
                expectedOutcome == VolunteerAssignmentOutcome.Confirmed
                    ? VolunteerAssignmentStatus.Confirmed
                    : VolunteerAssignmentStatus.Waitlisted);
        }
        else
        {
            result.Assignment.Should().BeNull();
        }
    }

    [Fact]
    public async Task Handle_ServiceReturnsNullAssignment_ReturnsOutcomeWithNullDto_AndSkipsMemberLookup()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var assignedBy = Guid.NewGuid();

        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, memberId, assignedBy, false, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftNotFound, null));

        var sut = new AssignVolunteerCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new AssignVolunteerCommand(eventId, shiftId, memberId, false, assignedBy),
            CancellationToken.None);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.ShiftNotFound);
        result.Assignment.Should().BeNull();
        // Strict mock: GetByIdAsync was never set up, so a call would throw — proving the
        // handler short-circuits DTO projection when there is no assignment.
        _members.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_AlwaysCallsService_AsManagerAssign_NotSelfSignup()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var member = NewMember();
        var assignedBy = Guid.NewGuid();

        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, member.Id, assignedBy, true, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(
                VolunteerAssignmentOutcome.Confirmed,
                EventVolunteerAssignment.CreateConfirmed(shiftId, Guid.NewGuid(), member.Id, assignedBy)));
        _members
            .Setup(m => m.GetByIdAsync(member.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);

        var sut = new AssignVolunteerCommandHandler(_service.Object, _members.Object);
        await sut.Handle(
            new AssignVolunteerCommand(eventId, shiftId, member.Id, true, assignedBy),
            CancellationToken.None);

        _service.Verify(
            s => s.AssignAsync(eventId, shiftId, member.Id, assignedBy, true, /* isSelfSignup */ false, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ConfirmedButMemberRowMissing_FallsBackToUnknownDisplayName()
    {
        var eventId = Guid.NewGuid();
        var shiftId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var assignedBy = Guid.NewGuid();

        _service
            .Setup(s => s.AssignAsync(eventId, shiftId, memberId, assignedBy, false, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new VolunteerAssignmentResult(
                VolunteerAssignmentOutcome.Confirmed,
                EventVolunteerAssignment.CreateConfirmed(shiftId, Guid.NewGuid(), memberId, assignedBy)));
        _members
            .Setup(m => m.GetByIdAsync(memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var sut = new AssignVolunteerCommandHandler(_service.Object, _members.Object);
        var result = await sut.Handle(
            new AssignVolunteerCommand(eventId, shiftId, memberId, false, assignedBy),
            CancellationToken.None);

        result.Assignment!.MemberDisplayName.Should().Be("(unknown)");
    }
}
