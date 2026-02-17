using FluentAssertions;
using IabConnect.Application.Finance.FiscalPeriods.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for FiscalPeriod command validators (REQ-066)
/// </summary>
public class FiscalPeriodValidatorTests
{
    #region GenerateFiscalPeriodsCommandValidator

    private readonly GenerateFiscalPeriodsCommandValidator _generateValidator = new();

    [Fact]
    public void Generate_Should_Pass_With_Valid_Year()
    {
        // Arrange
        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "admin" };

        // Act
        var result = _generateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Generate_Should_Fail_When_Year_Below_2000()
    {
        // Arrange
        var command = new GenerateFiscalPeriodsCommand { Year = 1999, UserName = "admin" };

        // Act
        var result = _generateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Year");
    }

    [Fact]
    public void Generate_Should_Fail_When_Year_Above_2100()
    {
        // Arrange
        var command = new GenerateFiscalPeriodsCommand { Year = 2101, UserName = "admin" };

        // Act
        var result = _generateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Year");
    }

    [Fact]
    public void Generate_Should_Fail_When_UserName_Empty()
    {
        // Arrange
        var command = new GenerateFiscalPeriodsCommand { Year = 2026, UserName = "" };

        // Act
        var result = _generateValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    #endregion

    #region LockFiscalPeriodCommandValidator

    private readonly LockFiscalPeriodCommandValidator _lockValidator = new();

    [Fact]
    public void Lock_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = new LockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = _lockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Lock_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var command = new LockFiscalPeriodCommand { Id = Guid.Empty, UserName = "admin" };

        // Act
        var result = _lockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }

    [Fact]
    public void Lock_Should_Fail_When_UserName_Empty()
    {
        // Arrange
        var command = new LockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "" };

        // Act
        var result = _lockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    #endregion

    #region UnlockFiscalPeriodCommandValidator

    private readonly UnlockFiscalPeriodCommandValidator _unlockValidator = new();

    [Fact]
    public void Unlock_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = new UnlockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = _unlockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Unlock_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var command = new UnlockFiscalPeriodCommand { Id = Guid.Empty, UserName = "admin" };

        // Act
        var result = _unlockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }

    [Fact]
    public void Unlock_Should_Fail_When_UserName_Empty()
    {
        // Arrange
        var command = new UnlockFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "" };

        // Act
        var result = _unlockValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    #endregion

    #region CloseFiscalPeriodCommandValidator

    private readonly CloseFiscalPeriodCommandValidator _closeValidator = new();

    [Fact]
    public void Close_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = new CloseFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = _closeValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Close_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var command = new CloseFiscalPeriodCommand { Id = Guid.Empty, UserName = "admin" };

        // Act
        var result = _closeValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }

    [Fact]
    public void Close_Should_Fail_When_UserName_Empty()
    {
        // Arrange
        var command = new CloseFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "" };

        // Act
        var result = _closeValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    #endregion

    #region ReopenFiscalPeriodCommandValidator

    private readonly ReopenFiscalPeriodCommandValidator _reopenValidator = new();

    [Fact]
    public void Reopen_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var command = new ReopenFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "admin" };

        // Act
        var result = _reopenValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Reopen_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var command = new ReopenFiscalPeriodCommand { Id = Guid.Empty, UserName = "admin" };

        // Act
        var result = _reopenValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }

    [Fact]
    public void Reopen_Should_Fail_When_UserName_Empty()
    {
        // Arrange
        var command = new ReopenFiscalPeriodCommand { Id = Guid.NewGuid(), UserName = "" };

        // Act
        var result = _reopenValidator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserName");
    }

    #endregion
}
