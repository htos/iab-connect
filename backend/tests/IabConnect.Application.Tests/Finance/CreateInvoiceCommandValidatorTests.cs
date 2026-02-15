using FluentAssertions;
using IabConnect.Application.Finance.Invoices.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for CreateInvoiceCommandValidator (REQ-039)
/// </summary>
public class CreateInvoiceCommandValidatorTests
{
    private readonly CreateInvoiceCommandValidator _validator = new();

    private static CreateInvoiceCommand CreateValidCommand() => new()
    {
        Date = DateTime.UtcNow,
        DueDate = DateTime.UtcNow.AddDays(30),
        RecipientType = "Member",
        RecipientId = Guid.NewGuid(),
        RecipientName = "Max Mustermann",
        RecipientAddress = "Teststrasse 1, 3000 Bern",
        TaxRate = 7.7m,
        Notes = "Test",
        Items = [new("Mitgliedsbeitrag", 1, 100m)],
        UserName = "admin"
    };

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
    public void Validate_EmptyRecipientName_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { RecipientName = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RecipientName");
    }

    [Fact]
    public void Validate_RecipientNameTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { RecipientName = new string('A', 301) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RecipientName");
    }

    [Fact]
    public void Validate_EmptyItems_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Items = [] };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Items");
    }

    [Fact]
    public void Validate_EmptyRecipientType_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { RecipientType = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RecipientType");
    }

    [Fact]
    public void Validate_InvalidRecipientType_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { RecipientType = "InvalidType" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "RecipientType");
    }

    [Theory]
    [InlineData("Member")]
    [InlineData("Sponsor")]
    [InlineData("Vendor")]
    [InlineData("Other")]
    public void Validate_ValidRecipientTypes_ShouldPass(string type)
    {
        // Arrange
        var command = CreateValidCommand() with { RecipientType = type };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyUserName_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { UserName = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    [Fact]
    public void Validate_ItemWithEmptyDescription_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with
        {
            Items = [new("", 1, 100m)]
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("Description"));
    }

    [Fact]
    public void Validate_ItemWithZeroQuantity_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with
        {
            Items = [new("Item", 0, 100m)]
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("Quantity"));
    }

    [Fact]
    public void Validate_ItemWithNegativeUnitPrice_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with
        {
            Items = [new("Item", 1, -10m)]
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName.Contains("UnitPrice"));
    }

    [Fact]
    public void Validate_ItemWithZeroUnitPrice_ShouldPass()
    {
        // Arrange — zero price is allowed (e.g., free items)
        var command = CreateValidCommand() with
        {
            Items = [new("Free Item", 1, 0m)]
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_MultipleValidItems_ShouldPass()
    {
        // Arrange
        var command = CreateValidCommand() with
        {
            Items =
            [
                new("Item 1", 1, 100m),
                new("Item 2", 2, 50m),
                new("Item 3", 1, 200m)
            ]
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
