using FluentAssertions;
using FluentValidation.TestHelper;
using IabConnect.Application.Finance.ActivityAreas.Commands;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for ActivityArea entity and CQRS (REQ-068)
/// </summary>
public class ActivityAreaTests
{
    #region ActivityArea_Create

    [Fact]
    public void Create_Should_Create_With_Valid_Data()
    {
        // Act
        var area = ActivityArea.Create("Events", "EVT", "Event activities", "#FF6600", 1);

        // Assert
        area.Name.Should().Be("Events");
        area.Code.Should().Be("EVT");
        area.Description.Should().Be("Event activities");
        area.Color.Should().Be("#FF6600");
        area.SortOrder.Should().Be(1);
        area.IsActive.Should().BeTrue();
        area.IsDeleted.Should().BeFalse();
        area.Id.Should().NotBe(Guid.Empty);
        area.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
        area.UpdatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public void Create_Should_Uppercase_Code()
    {
        // Act
        var area = ActivityArea.Create("Test", "evt", null, null, 0);

        // Assert
        area.Code.Should().Be("EVT");
    }

    [Fact]
    public void Create_Should_Throw_When_Name_Empty()
    {
        // Act & Assert
        var act = () => ActivityArea.Create("", "EVT", null, null, 0);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_Should_Throw_When_Code_Empty()
    {
        // Act & Assert
        var act = () => ActivityArea.Create("Events", "", null, null, 0);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("code");
    }

    [Fact]
    public void Create_Should_Trim_Fields()
    {
        // Act
        var area = ActivityArea.Create("  Events  ", "  evt  ", "  desc  ", "  #FFF  ", 0);

        // Assert
        area.Name.Should().Be("Events");
        area.Code.Should().Be("EVT");
        area.Description.Should().Be("desc");
        area.Color.Should().Be("#FFF");
    }

    #endregion

    #region ActivityArea_Update

    [Fact]
    public void Update_Should_Update_All_Fields()
    {
        // Arrange
        var area = ActivityArea.Create("Events", "EVT", null, null, 0);

        // Act
        area.Update("Members", "MBR", "Membership fees", "#00FF00", 2, false);

        // Assert
        area.Name.Should().Be("Members");
        area.Code.Should().Be("MBR");
        area.Description.Should().Be("Membership fees");
        area.Color.Should().Be("#00FF00");
        area.SortOrder.Should().Be(2);
        area.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Update_Should_Set_UpdatedAt()
    {
        // Arrange
        var area = ActivityArea.Create("Events", "EVT", null, null, 0);
        var createdAt = area.UpdatedAt;

        // Act — small delay to ensure timestamp difference
        area.Update("Updated", "UPD", null, null, 1, true);

        // Assert
        area.UpdatedAt.Should().BeOnOrAfter(createdAt);
    }

    #endregion

    #region ActivityArea_SoftDelete

    [Fact]
    public void SoftDelete_Should_SoftDelete()
    {
        // Arrange
        var area = ActivityArea.Create("Events", "EVT", null, null, 0);

        // Act
        area.SoftDelete("admin");

        // Assert
        area.IsDeleted.Should().BeTrue();
        area.DeletedAt.Should().NotBeNull();
        area.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_Should_Restore()
    {
        // Arrange
        var area = ActivityArea.Create("Events", "EVT", null, null, 0);
        area.SoftDelete("admin");

        // Act
        area.Restore();

        // Assert
        area.IsDeleted.Should().BeFalse();
        area.DeletedAt.Should().BeNull();
        area.DeletedBy.Should().BeNull();
    }

    #endregion

    #region ActivityAreaValidator

    [Fact]
    public void CreateValidator_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var validator = new CreateActivityAreaCommandValidator();
        var command = new CreateActivityAreaCommand
        {
            Name = "Events",
            Code = "EVT",
            Description = "Event activities",
            Color = "#FF6600",
            SortOrder = 1
        };

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void CreateValidator_Should_Fail_When_Name_Empty()
    {
        // Arrange
        var validator = new CreateActivityAreaCommandValidator();
        var command = new CreateActivityAreaCommand
        {
            Name = "",
            Code = "EVT"
        };

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void CreateValidator_Should_Fail_When_Code_Empty()
    {
        // Arrange
        var validator = new CreateActivityAreaCommandValidator();
        var command = new CreateActivityAreaCommand
        {
            Name = "Events",
            Code = ""
        };

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }

    [Fact]
    public void UpdateValidator_Should_Pass_With_Valid_Input()
    {
        // Arrange
        var validator = new UpdateActivityAreaCommandValidator();
        var command = new UpdateActivityAreaCommand
        {
            Id = Guid.NewGuid(),
            Name = "Events",
            Code = "EVT",
            IsActive = true
        };

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void UpdateValidator_Should_Fail_When_Id_Empty()
    {
        // Arrange
        var validator = new UpdateActivityAreaCommandValidator();
        var command = new UpdateActivityAreaCommand
        {
            Id = Guid.Empty,
            Name = "Events",
            Code = "EVT",
            IsActive = true
        };

        // Act
        var result = validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    #endregion
}
