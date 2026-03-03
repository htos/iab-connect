using FluentAssertions;
using IabConnect.Application.Sponsors.Commands;
using IabConnect.Domain.Sponsors;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for CreateSponsorCommandValidator
/// REQ-031: Sponsorenverwaltung - Validation
/// </summary>
public class CreateSponsorCommandValidatorTests
{
    private readonly CreateSponsorCommandValidator _validator = new();

    #region Valid Command

    [Fact]
    public void Validate_ValidCommand_ShouldNotHaveErrors()
    {
        // Arrange
        var command = CreateValidCommand();

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_MinimalValidCommand_ShouldNotHaveErrors()
    {
        // Arrange
        var command = new CreateSponsorCommand
        {
            CompanyName = "Test Corp",
            Tier = SponsorTier.Bronze
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region CompanyName Validation

    [Fact]
    public void Validate_EmptyCompanyName_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { CompanyName = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "CompanyName");
    }

    [Fact]
    public void Validate_CompanyNameTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { CompanyName = new string('A', 201) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "CompanyName");
    }

    #endregion

    #region Email Validation

    [Fact]
    public void Validate_InvalidEmail_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Email = "not-an-email" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email");
    }

    [Fact]
    public void Validate_NullEmail_ShouldNotHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Email = null };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyEmail_ShouldNotHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Email = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Optional Field Length Validation

    [Fact]
    public void Validate_ContactPersonTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { ContactPerson = new string('A', 201) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ContactPerson");
    }

    [Fact]
    public void Validate_PhoneTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Phone = new string('1', 51) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Phone");
    }

    [Fact]
    public void Validate_WebsiteTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Website = new string('w', 501) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Website");
    }

    [Fact]
    public void Validate_NotesTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Notes = new string('n', 2001) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Notes");
    }

    #endregion

    #region Tier Validation

    [Fact]
    public void Validate_InvalidTier_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Tier = (SponsorTier)999 };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Tier");
    }

    [Theory]
    [InlineData(SponsorTier.Bronze)]
    [InlineData(SponsorTier.Silver)]
    [InlineData(SponsorTier.Gold)]
    [InlineData(SponsorTier.Platinum)]
    public void Validate_ValidTier_ShouldNotHaveError(SponsorTier tier)
    {
        // Arrange
        var command = CreateValidCommand() with { Tier = tier };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    #endregion

    #region Helpers

    private static CreateSponsorCommand CreateValidCommand() => new()
    {
        CompanyName = "Test Corp AG",
        ContactPerson = "Max Mustermann",
        Email = "max@testcorp.ch",
        Phone = "+41 79 111 11 11",
        Website = "https://testcorp.ch",
        Tier = SponsorTier.Gold,
        Notes = "Test notes"
    };

    #endregion
}
