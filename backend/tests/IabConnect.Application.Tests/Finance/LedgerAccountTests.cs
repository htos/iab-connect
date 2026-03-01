using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for LedgerAccount entity (REQ-075)
/// </summary>
public class LedgerAccountTests
{
    private static readonly Guid FinanceProfileId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var account = LedgerAccount.Create(
            number: "1000",
            name: "Bank",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            description: "Main bank account",
            sortOrder: 1);

        // Assert
        account.Number.Should().Be("1000");
        account.Name.Should().Be("Bank");
        account.AccountClass.Should().Be(LedgerAccountClass.Asset);
        account.NormalBalance.Should().Be(NormalBalance.Debit);
        account.FinanceProfileId.Should().Be(FinanceProfileId);
        account.CreatedBy.Should().Be("admin");
        account.Description.Should().Be("Main bank account");
        account.SortOrder.Should().Be(1);
        account.IsActive.Should().BeTrue();
        account.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var account = CreateValidAccount();

        // Assert
        account.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetCreatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var account = CreateValidAccount();

        // Assert
        account.CreatedAt.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Create_ShouldTrimFields()
    {
        // Act
        var account = LedgerAccount.Create(
            number: "  1000  ",
            name: "  Bank  ",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            description: "  Desc  ");

        // Assert
        account.Number.Should().Be("1000");
        account.Name.Should().Be("Bank");
        account.Description.Should().Be("Desc");
    }

    [Fact]
    public void Create_WithEmptyNumber_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => LedgerAccount.Create(
            number: "",
            name: "Bank",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("number");
    }

    [Fact]
    public void Create_WithEmptyName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => LedgerAccount.Create(
            number: "1000",
            name: "",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_WithParentAccountId_ShouldSetParent()
    {
        // Arrange
        var parentId = Guid.NewGuid();

        // Act
        var account = LedgerAccount.Create(
            number: "1010",
            name: "Sub-account",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            parentAccountId: parentId);

        // Assert
        account.ParentAccountId.Should().Be(parentId);
    }

    [Theory]
    [InlineData(LedgerAccountClass.Asset, NormalBalance.Debit)]
    [InlineData(LedgerAccountClass.Liability, NormalBalance.Credit)]
    [InlineData(LedgerAccountClass.Equity, NormalBalance.Credit)]
    [InlineData(LedgerAccountClass.Revenue, NormalBalance.Credit)]
    [InlineData(LedgerAccountClass.Expense, NormalBalance.Debit)]
    public void Create_WithDifferentAccountClasses_ShouldAcceptAnyNormalBalance(
        LedgerAccountClass accountClass, NormalBalance normalBalance)
    {
        // Act
        var account = LedgerAccount.Create(
            number: "1000",
            name: "Test",
            accountClass: accountClass,
            normalBalance: normalBalance,
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        // Assert
        account.AccountClass.Should().Be(accountClass);
        account.NormalBalance.Should().Be(normalBalance);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_WithValidData_ShouldUpdateAllFields()
    {
        // Arrange
        var account = CreateValidAccount();
        var parentId = Guid.NewGuid();

        // Act
        account.Update(
            number: "2000",
            name: "Updated Name",
            accountClass: LedgerAccountClass.Liability,
            normalBalance: NormalBalance.Credit,
            updatedBy: "admin2",
            description: "Updated",
            parentAccountId: parentId,
            sortOrder: 5);

        // Assert
        account.Number.Should().Be("2000");
        account.Name.Should().Be("Updated Name");
        account.AccountClass.Should().Be(LedgerAccountClass.Liability);
        account.NormalBalance.Should().Be(NormalBalance.Credit);
        account.UpdatedBy.Should().Be("admin2");
        account.Description.Should().Be("Updated");
        account.ParentAccountId.Should().Be(parentId);
        account.SortOrder.Should().Be(5);
        account.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_ShouldSetUpdatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);
        var account = CreateValidAccount();

        // Act
        account.Update("1000", "Bank", LedgerAccountClass.Asset, NormalBalance.Debit, "admin");

        // Assert
        account.UpdatedAt.Should().NotBeNull();
        account.UpdatedAt!.Value.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Update_WithEmptyNumber_ShouldThrowArgumentException()
    {
        // Arrange
        var account = CreateValidAccount();

        // Act & Assert
        var act = () => account.Update("", "Name", LedgerAccountClass.Asset, NormalBalance.Debit, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("number");
    }

    [Fact]
    public void Update_WithEmptyName_ShouldThrowArgumentException()
    {
        // Arrange
        var account = CreateValidAccount();

        // Act & Assert
        var act = () => account.Update("1000", "", LedgerAccountClass.Asset, NormalBalance.Debit, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    #endregion

    #region Activate / Deactivate Tests

    [Fact]
    public void Deactivate_ShouldSetIsActiveToFalse()
    {
        // Arrange
        var account = CreateValidAccount();

        // Act
        account.Deactivate();

        // Assert
        account.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Activate_ShouldSetIsActiveToTrue()
    {
        // Arrange
        var account = CreateValidAccount();
        account.Deactivate();

        // Act
        account.Activate();

        // Assert
        account.IsActive.Should().BeTrue();
    }

    #endregion

    #region SoftDelete / Restore Tests

    [Fact]
    public void SoftDelete_ShouldSetDeletedFields()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);
        var account = CreateValidAccount();

        // Act
        account.SoftDelete("admin");

        // Assert
        account.IsDeleted.Should().BeTrue();
        account.DeletedBy.Should().Be("admin");
        account.DeletedAt.Should().NotBeNull();
        account.DeletedAt!.Value.Should().BeAfter(before);
    }

    [Fact]
    public void Restore_ShouldClearDeletedFields()
    {
        // Arrange
        var account = CreateValidAccount();
        account.SoftDelete("admin");

        // Act
        account.Restore();

        // Assert
        account.IsDeleted.Should().BeFalse();
        account.DeletedAt.Should().BeNull();
        account.DeletedBy.Should().BeNull();
    }

    #endregion

    #region Helpers

    private static LedgerAccount CreateValidAccount()
    {
        return LedgerAccount.Create(
            number: "1000",
            name: "Bank",
            accountClass: LedgerAccountClass.Asset,
            normalBalance: NormalBalance.Debit,
            financeProfileId: FinanceProfileId,
            createdBy: "admin");
    }

    #endregion
}
