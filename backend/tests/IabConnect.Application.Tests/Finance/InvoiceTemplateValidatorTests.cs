using FluentAssertions;
using IabConnect.Application.Finance.InvoiceTemplates.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for InvoiceTemplate validators (REQ-064)
/// </summary>
public class InvoiceTemplateValidatorTests
{
    #region CreateInvoiceTemplateCommandValidator

    private readonly CreateInvoiceTemplateCommandValidator _createValidator = new();

    private static CreateInvoiceTemplateCommand CreateValidCreateCommand() => new()
    {
        Name = "EU Standard",
        Jurisdiction = "EU",
        CountryCode = "DE",
        IsDefault = true,
        ShowVatId = true,
        Language = "en"
    };

    [Fact]
    public void Create_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = CreateValidCreateCommand();

        // Act
        var result = _createValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Create_Should_Fail_When_Name_Empty()
    {
        // Arrange
        var command = CreateValidCreateCommand() with { Name = "" };

        // Act
        var result = _createValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
    }

    [Fact]
    public void Create_Should_Fail_When_Jurisdiction_Invalid()
    {
        // Arrange
        var command = CreateValidCreateCommand() with { Jurisdiction = "INVALID" };

        // Act
        var result = _createValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Jurisdiction");
    }

    [Fact]
    public void Create_Should_Fail_When_Language_Empty()
    {
        // Arrange
        var command = CreateValidCreateCommand() with { Language = "" };

        // Act
        var result = _createValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Language");
    }

    #endregion

    #region UpdateInvoiceTemplateCommandValidator

    private readonly UpdateInvoiceTemplateCommandValidator _updateValidator = new();

    private static UpdateInvoiceTemplateCommand CreateValidUpdateCommand() => new()
    {
        Id = Guid.NewGuid(),
        Name = "Updated Template",
        IsDefault = false,
        ShowVatId = true,
        Language = "de"
    };

    [Fact]
    public void Update_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = CreateValidUpdateCommand();

        // Act
        var result = _updateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Update_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var command = CreateValidUpdateCommand() with { Id = Guid.Empty };

        // Act
        var result = _updateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }

    #endregion
}
