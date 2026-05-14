using FluentAssertions;
using IabConnect.Application.Events.Volunteers.Commands;
using IabConnect.Domain.Events.Volunteers;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) AC-10 / R4-P-S3-4: handler-level tests for shift creation. The validator
/// (capacity / title / date bounds) is covered separately in
/// <see cref="CreateEventVolunteerShiftCommandValidatorTests"/>; these tests cover the handler's
/// role-resolution guards (M-S3-8 deactivated role, cross-event role) and the happy-path
/// persistence + DTO projection.
/// </summary>
public sealed class CreateEventVolunteerShiftCommandHandlerTests
{
    private readonly Mock<IEventVolunteerShiftRepository> _shifts = new(MockBehavior.Strict);
    private readonly Mock<IEventVolunteerRoleRepository> _roles = new(MockBehavior.Strict);

    private static CreateEventVolunteerShiftCommand Command(Guid eventId, Guid roleId) => new(
        EventId: eventId,
        RoleId: roleId,
        Title: "Cash desk",
        Description: "Front of house",
        StartsAt: DateTime.UtcNow.AddDays(1),
        EndsAt: DateTime.UtcNow.AddDays(1).AddHours(3),
        Capacity: 4,
        AllowWaitlist: true,
        AllowSelfSignup: true,
        Notes: "Bring float",
        CreatedBy: Guid.NewGuid());

    [Fact]
    public async Task Handle_RoleNotFound_ThrowsKeyNotFoundException()
    {
        var eventId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        _roles
            .Setup(r => r.GetByIdAsync(roleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((EventVolunteerRole?)null);

        var sut = new CreateEventVolunteerShiftCommandHandler(_shifts.Object, _roles.Object);

        await FluentActions
            .Awaiting(() => sut.Handle(Command(eventId, roleId), CancellationToken.None))
            .Should().ThrowAsync<KeyNotFoundException>();
        _shifts.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_RoleBelongsToDifferentEvent_ThrowsInvalidOperationException()
    {
        var eventId = Guid.NewGuid();
        var otherEventId = Guid.NewGuid();
        var role = EventVolunteerRole.Create(otherEventId, "Greeter", null, Guid.NewGuid());
        _roles
            .Setup(r => r.GetByIdAsync(role.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(role);

        var sut = new CreateEventVolunteerShiftCommandHandler(_shifts.Object, _roles.Object);

        await FluentActions
            .Awaiting(() => sut.Handle(Command(eventId, role.Id), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*does not belong*");
        _shifts.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_DeactivatedRole_ThrowsInvalidOperationException()
    {
        // M-S3-8: shifts MUST NOT be created against a deactivated role.
        var eventId = Guid.NewGuid();
        var role = EventVolunteerRole.Create(eventId, "Greeter", null, Guid.NewGuid());
        role.Deactivate();
        _roles
            .Setup(r => r.GetByIdAsync(role.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(role);

        var sut = new CreateEventVolunteerShiftCommandHandler(_shifts.Object, _roles.Object);

        await FluentActions
            .Awaiting(() => sut.Handle(Command(eventId, role.Id), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*deactivated*");
        _shifts.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_ValidCommand_PersistsShift_AndReturnsDtoWithRoleNameAndZeroCounts()
    {
        var eventId = Guid.NewGuid();
        var role = EventVolunteerRole.Create(eventId, "Cash desk", null, Guid.NewGuid());
        _roles
            .Setup(r => r.GetByIdAsync(role.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(role);
        EventVolunteerShift? persisted = null;
        _shifts
            .Setup(s => s.AddAsync(It.IsAny<EventVolunteerShift>(), It.IsAny<CancellationToken>()))
            .Callback<EventVolunteerShift, CancellationToken>((s, _) => persisted = s)
            .Returns(Task.CompletedTask);

        var sut = new CreateEventVolunteerShiftCommandHandler(_shifts.Object, _roles.Object);
        var dto = await sut.Handle(Command(eventId, role.Id), CancellationToken.None);

        persisted.Should().NotBeNull();
        persisted!.EventId.Should().Be(eventId);
        persisted.RoleId.Should().Be(role.Id);
        persisted.Title.Should().Be("Cash desk");

        dto.RoleName.Should().Be("Cash desk");
        dto.ConfirmedCount.Should().Be(0);
        dto.WaitlistCount.Should().Be(0);
        dto.Capacity.Should().Be(4);
        dto.AllowWaitlist.Should().BeTrue();
        dto.AllowSelfSignup.Should().BeTrue();
        _shifts.Verify(s => s.AddAsync(It.IsAny<EventVolunteerShift>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
