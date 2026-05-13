using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-1: The XOR(RegistrationId, QrCodeToken) rule on
/// <see cref="CheckInRegistrationCommand"/>.
/// </summary>
public sealed class CheckInRegistrationCommandValidatorTests
{
    private readonly CheckInRegistrationCommandValidator _sut = new();

    [Fact]
    public void Validate_BothRegistrationIdAndQrToken_Fails()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: Guid.NewGuid(),
            QrCodeToken: "tok-abc",
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_NeitherRegistrationIdNorQrToken_Fails()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: null,
            QrCodeToken: null,
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_QrTokenOnly_Passes()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.Empty,
            RegistrationId: null,
            QrCodeToken: "tok-abc",
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_RegistrationIdOnlyWithEventId_Passes()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: Guid.NewGuid(),
            QrCodeToken: null,
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_RegistrationIdWithoutEventId_Fails()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.Empty,
            RegistrationId: Guid.NewGuid(),
            QrCodeToken: null,
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmptyCheckedInBy_Fails()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: Guid.NewGuid(),
            QrCodeToken: null,
            CheckedInBy: Guid.Empty);

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WhitespaceQrToken_TreatedAsAbsent_FailsXor()
    {
        // Whitespace-only token is not a valid discriminator.
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: null,
            QrCodeToken: "   ",
            CheckedInBy: Guid.NewGuid());

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }
}
