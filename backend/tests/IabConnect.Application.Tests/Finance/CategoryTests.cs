using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Category entity (REQ-038)
/// </summary>
public class CategoryTests
{
    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var category = Category.Create("Mitgliedsbeiträge", TransactionType.Income, "#22c55e", "admin");

        // Assert
        category.Name.Should().Be("Mitgliedsbeiträge");
        category.Type.Should().Be(TransactionType.Income);
        category.Color.Should().Be("#22c55e");
        category.CreatedBy.Should().Be("admin");
        category.IsActive.Should().BeTrue();
        category.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var category = Category.Create("Kategorie", TransactionType.Income, "#000000", "admin");

        // Assert
        category.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldTrimName()
    {
        // Act
        var category = Category.Create("  Trimmed  ", TransactionType.Income, "#000000", "admin");

        // Assert
        category.Name.Should().Be("Trimmed");
    }

    [Fact]
    public void Create_WithEmptyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Category.Create("", TransactionType.Income, "#000000", "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_WithWhitespaceOnlyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Category.Create("   ", TransactionType.Expense, "#000000", "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Theory]
    [InlineData(TransactionType.Income)]
    [InlineData(TransactionType.Expense)]
    public void Create_WithDifferentTypes_ShouldSetCorrectType(TransactionType type)
    {
        // Act
        var category = Category.Create("Kategorie", type, "#000000", "admin");

        // Assert
        category.Type.Should().Be(type);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        // Arrange
        var category = Category.Create("Old", TransactionType.Income, "#000000", "admin");

        // Act
        category.Update("New", TransactionType.Expense, "#ff0000");

        // Assert
        category.Name.Should().Be("New");
        category.Type.Should().Be(TransactionType.Expense);
        category.Color.Should().Be("#ff0000");
    }

    #endregion

    #region Activate / Deactivate Tests

    [Fact]
    public void Deactivate_ShouldSetIsActiveFalse()
    {
        // Arrange
        var category = Category.Create("Kat", TransactionType.Income, "#000000", "admin");

        // Act
        category.Deactivate();

        // Assert
        category.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Activate_AfterDeactivate_ShouldSetIsActiveTrue()
    {
        // Arrange
        var category = Category.Create("Kat", TransactionType.Income, "#000000", "admin");
        category.Deactivate();

        // Act
        category.Activate();

        // Assert
        category.IsActive.Should().BeTrue();
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var category = Category.Create("Kat", TransactionType.Income, "#000000", "admin");

        // Act
        category.SoftDelete("admin");

        // Assert
        category.IsDeleted.Should().BeTrue();
        category.DeletedAt.Should().NotBeNull();
        category.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var category = Category.Create("Kat", TransactionType.Income, "#000000", "admin");
        category.SoftDelete("admin");

        // Act
        category.Restore();

        // Assert
        category.IsDeleted.Should().BeFalse();
        category.DeletedAt.Should().BeNull();
        category.DeletedBy.Should().BeNull();
    }

    #endregion
}
