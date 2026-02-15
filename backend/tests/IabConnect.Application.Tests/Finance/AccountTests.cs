using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Account entity (REQ-038)
/// </summary>
public class AccountTests
{
    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var account = Account.Create("Vereinskonto", "1000", AccountType.Asset, "Main account", 1, "admin");

        // Assert
        account.Name.Should().Be("Vereinskonto");
        account.Number.Should().Be("1000");
        account.Type.Should().Be(AccountType.Asset);
        account.Description.Should().Be("Main account");
        account.SortOrder.Should().Be(1);
        account.CreatedBy.Should().Be("admin");
        account.IsActive.Should().BeTrue();
        account.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var account = Account.Create("Konto", "1001", AccountType.Income, null, 0, "admin");

        // Assert
        account.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetCreatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var account = Account.Create("Konto", "1001", AccountType.Income, null, 0, "admin");

        // Assert
        account.CreatedAt.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Create_ShouldTrimNameAndNumber()
    {
        // Act
        var account = Account.Create("  Konto  ", "  1001  ", AccountType.Income, "  Desc  ", 0, "admin");

        // Assert
        account.Name.Should().Be("Konto");
        account.Number.Should().Be("1001");
        account.Description.Should().Be("Desc");
    }

    [Fact]
    public void Create_WithEmptyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Account.Create("", "1000", AccountType.Income, null, 0, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_WithWhitespaceOnlyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Account.Create("   ", "1000", AccountType.Income, null, 0, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_WithEmptyNumber_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Account.Create("Konto", "", AccountType.Income, null, 0, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("number");
    }

    [Theory]
    [InlineData(AccountType.Income)]
    [InlineData(AccountType.Expense)]
    [InlineData(AccountType.Asset)]
    [InlineData(AccountType.Liability)]
    public void Create_WithDifferentTypes_ShouldSetCorrectType(AccountType type)
    {
        // Act
        var account = Account.Create("Konto", "1000", type, null, 0, "admin");

        // Assert
        account.Type.Should().Be(type);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        // Arrange
        var account = Account.Create("Old", "1000", AccountType.Income, null, 0, "admin");

        // Act
        account.Update("New", "2000", AccountType.Expense, "Updated desc", 5, "editor");

        // Assert
        account.Name.Should().Be("New");
        account.Number.Should().Be("2000");
        account.Type.Should().Be(AccountType.Expense);
        account.Description.Should().Be("Updated desc");
        account.SortOrder.Should().Be(5);
        account.UpdatedBy.Should().Be("editor");
        account.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_WithEmptyName_ShouldThrowArgumentException()
    {
        // Arrange
        var account = Account.Create("Konto", "1000", AccountType.Income, null, 0, "admin");

        // Act & Assert
        var act = () => account.Update("", "1000", AccountType.Income, null, 0, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    #endregion

    #region Activate / Deactivate Tests

    [Fact]
    public void Deactivate_ShouldSetIsActiveFalse()
    {
        // Arrange
        var account = Account.Create("Konto", "1000", AccountType.Income, null, 0, "admin");

        // Act
        account.Deactivate();

        // Assert
        account.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Activate_AfterDeactivate_ShouldSetIsActiveTrue()
    {
        // Arrange
        var account = Account.Create("Konto", "1000", AccountType.Income, null, 0, "admin");
        account.Deactivate();

        // Act
        account.Activate();

        // Assert
        account.IsActive.Should().BeTrue();
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var account = Account.Create("Konto", "1000", AccountType.Income, null, 0, "admin");

        // Act
        account.SoftDelete("admin");

        // Assert
        account.IsDeleted.Should().BeTrue();
        account.DeletedAt.Should().NotBeNull();
        account.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var account = Account.Create("Konto", "1000", AccountType.Income, null, 0, "admin");
        account.SoftDelete("admin");

        // Act
        account.Restore();

        // Assert
        account.IsDeleted.Should().BeFalse();
        account.DeletedAt.Should().BeNull();
        account.DeletedBy.Should().BeNull();
    }

    #endregion
}
