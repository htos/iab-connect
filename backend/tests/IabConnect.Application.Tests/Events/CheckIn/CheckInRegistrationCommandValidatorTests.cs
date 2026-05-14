using System.Security.Claims;
using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-1: The XOR(RegistrationId, QrCodeToken) rule on
/// <see cref="CheckInRegistrationCommand"/>.
///
/// <para>Round-3 R3-DN-3: commands now carry a <see cref="ClaimsPrincipal"/> for handler-side
/// audit logging. The validator does NOT validate the principal — an anonymous principal is
/// fine in these tests, which focus on shape rules.</para>
/// <para>Round-3 R3-H-S2-1: a <c>MaximumLength(50)</c> bound on QrCodeToken matches the DB
/// column cap; a megabyte token is now a clean 400 rather than a DB-constraint 500.</para>
/// </summary>
public sealed class CheckInRegistrationCommandValidatorTests
{
    private static readonly ClaimsPrincipal TestUser = new(new ClaimsIdentity());

    private readonly CheckInRegistrationCommandValidator _sut = new();

    [Fact]
    public void Validate_BothRegistrationIdAndQrToken_Fails()
    {
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.NewGuid(),
            RegistrationId: Guid.NewGuid(),
            QrCodeToken: "tok-abc",
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

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
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

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
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

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
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

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
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

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
            CheckedInBy: Guid.Empty,
            User: TestUser);

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
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_QrTokenOver50Chars_Fails()
    {
        // R3-H-S2-1: cap matches the DB column max length (50). Anything longer is a DoS-risk
        // attacker payload and should fail validation before hitting the DB.
        var oversizedToken = new string('A', 51);
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.Empty,
            RegistrationId: null,
            QrCodeToken: oversizedToken,
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "QrCodeToken");
    }

    [Fact]
    public void Validate_QrTokenAtExactly50Chars_Passes()
    {
        // R3-H-S2-1 boundary: exactly 50 chars is allowed (matches DB max).
        var maxLengthToken = new string('A', 50);
        var cmd = new CheckInRegistrationCommand(
            EventId: Guid.Empty,
            RegistrationId: null,
            QrCodeToken: maxLengthToken,
            CheckedInBy: Guid.NewGuid(),
            User: TestUser);

        var result = _sut.Validate(cmd);

        result.IsValid.Should().BeTrue();
    }
}
