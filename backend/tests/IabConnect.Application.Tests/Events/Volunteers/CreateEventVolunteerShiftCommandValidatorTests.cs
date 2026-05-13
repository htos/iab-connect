using FluentAssertions;
using IabConnect.Application.Events.Volunteers.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Events.Volunteers;

public sealed class CreateEventVolunteerShiftCommandValidatorTests
{
    private readonly CreateEventVolunteerShiftCommandValidator _sut = new();

    private static CreateEventVolunteerShiftCommand Valid() => new(
        EventId: Guid.NewGuid(),
        RoleId: Guid.NewGuid(),
        Title: "Greeter",
        Description: null,
        StartsAt: DateTime.UtcNow.AddDays(1),
        EndsAt: DateTime.UtcNow.AddDays(1).AddHours(2),
        Capacity: 3,
        AllowWaitlist: true,
        AllowSelfSignup: true,
        Notes: null,
        CreatedBy: Guid.NewGuid());

    [Fact]
    public void Validate_ValidCommand_Passes() => _sut.Validate(Valid()).IsValid.Should().BeTrue();

    [Fact]
    public void Validate_ZeroCapacity_Fails() =>
        _sut.Validate(Valid() with { Capacity = 0 }).IsValid.Should().BeFalse();

    [Fact]
    public void Validate_NegativeCapacity_Fails() =>
        _sut.Validate(Valid() with { Capacity = -5 }).IsValid.Should().BeFalse();

    [Fact]
    public void Validate_EndsAtBeforeStartsAt_Fails() =>
        _sut.Validate(Valid() with { EndsAt = Valid().StartsAt.AddHours(-1) }).IsValid.Should().BeFalse();

    [Fact]
    public void Validate_EmptyTitle_Fails() =>
        _sut.Validate(Valid() with { Title = "" }).IsValid.Should().BeFalse();

    [Fact]
    public void Validate_TitleOverMaxLength_Fails()
    {
        var longTitle = new string('a', 201);
        _sut.Validate(Valid() with { Title = longTitle }).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmptyEventId_Fails() =>
        _sut.Validate(Valid() with { EventId = Guid.Empty }).IsValid.Should().BeFalse();

    [Fact]
    public void Validate_StartsAtInPast_Fails()
    {
        // Post-review M-S3-9: a StartsAt older than the 5-minute clock-skew grace is rejected.
        var past = DateTime.UtcNow.AddMinutes(-15);
        var cmd = Valid() with { StartsAt = past, EndsAt = past.AddHours(1) };
        _sut.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WhitespaceOnlyTitle_Fails()
    {
        // Post-review M-S3-10: whitespace-only title is rejected at the validator (not 500
        // from the domain factory's ArgumentException).
        _sut.Validate(Valid() with { Title = "   " }).IsValid.Should().BeFalse();
    }
}
