using FluentAssertions;
using IabConnect.Application.Finance.Accounts.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for CreateAccountCommandValidator (REQ-038)
/// </summary>
public class CreateAccountCommandValidatorTests
{
    private readonly CreateAccountCommandValidator _validator = new();

    private static CreateAccountCommand CreateValidCommand() => new()
    {
        Name = "Vereinskonto",
        Number = "1000",
        Type = "Cash",
        Description = "Main account",
        SortOrder = 1,
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
    public void Validate_EmptyName_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Name = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
    }

    [Fact]
    public void Validate_NameTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Name = new string('A', 201) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Name");
    }

    [Fact]
    public void Validate_EmptyNumber_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Number = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Number");
    }

    [Fact]
    public void Validate_NumberTooLong_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Number = new string('1', 51) };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Number");
    }

    [Fact]
    public void Validate_EmptyType_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Type = "" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Type");
    }

    [Fact]
    public void Validate_InvalidType_ShouldHaveError()
    {
        // Arrange
        var command = CreateValidCommand() with { Type = "InvalidType" };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Type");
    }

    [Theory]
    [InlineData("Cash")]
    [InlineData("Bank")]
    [InlineData("Other")]
    public void Validate_ValidAccountTypes_ShouldPass(string type)
    {
        // Arrange
        var command = CreateValidCommand() with { Type = type };

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
    public void Validate_NullDescription_ShouldPass()
    {
        // Arrange
        var command = CreateValidCommand() with { Description = null };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }
}
