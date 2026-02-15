using FluentAssertions;
using IabConnect.Application.Finance.TaxCodes.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for CreateTaxCodeCommandValidator (REQ-062)
/// </summary>
public class CreateTaxCodeCommandValidatorTests
{
    private readonly CreateTaxCodeCommandValidator _validator = new();

    private static CreateTaxCodeCommand CreateValidCommand() => new()
    {
        Code = "MWST77",
        Label = "MWST 7.7%",
        Rate = 0.077m,
        IsDefault = false
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
    public void Validate_EmptyCode_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Code = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Code");
    }

    [Fact]
    public void Validate_CodeTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Code = new string('A', 21) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Code");
    }

    [Fact]
    public void Validate_EmptyLabel_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Label = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Label");
    }

    [Fact]
    public void Validate_LabelTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Label = new string('A', 101) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Label");
    }

    [Fact]
    public void Validate_NegativeRate_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Rate = -0.01m };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Rate");
    }

    [Fact]
    public void Validate_RateGreaterThanOne_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Rate = 1.01m };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Rate");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(0.077)]
    [InlineData(0.081)]
    [InlineData(0.5)]
    [InlineData(1)]
    public void Validate_ValidRates_ShouldPass(double rate)
    {
        // Arrange
        var command = CreateValidCommand() with { Rate = (decimal)rate };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_ZeroRate_ShouldPass()
    {
        // Arrange — exempt tax code
        var command = CreateValidCommand() with { Rate = 0m };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_ExactlyOneRate_ShouldPass()
    {
        // Arrange — edge case: 100% tax
        var command = CreateValidCommand() with { Rate = 1m };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
