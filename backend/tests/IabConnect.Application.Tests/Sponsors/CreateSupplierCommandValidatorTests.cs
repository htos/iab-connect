using FluentAssertions;
using IabConnect.Application.Sponsors.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for CreateSupplierCommandValidator
/// REQ-032: Lieferantenverwaltung - Validation
/// </summary>
public class CreateSupplierCommandValidatorTests
{
    private readonly CreateSupplierCommandValidator _validator = new();

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
        var command = new CreateSupplierCommand
        {
            CompanyName = "Minimal Corp"
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
        var command = CreateValidCommand() with { Email = "invalid-email" };

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

    #endregion

    #region Category Validation

    [Fact]
    public void Validate_CategoryTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Category = new string('C', 101) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Category");
    }

    [Fact]
    public void Validate_ValidCategory_ShouldNotHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Category = "Catering" };

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

    #region Helpers

    private static CreateSupplierCommand CreateValidCommand() => new()
    {
        CompanyName = "Test Catering AG",
        ContactPerson = "Anna Meier",
        Email = "anna@catering.ch",
        Phone = "+41 79 333 33 33",
        Website = "https://catering.ch",
        Category = "Catering",
        Notes = "Test notes"
    };

    #endregion
}
