using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Transaction entity (REQ-038, REQ-062)
/// </summary>
public class TransactionTests
{
    private static readonly Guid AccountId = Guid.NewGuid();
    private static readonly Guid CategoryId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_IncomeTransaction_ShouldSetProperties()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Mitgliedsbeitrag", 100m, TransactionType.Income,
            AccountId, CategoryId, "REF-001", "Note", "admin");

        // Assert
        tx.Description.Should().Be("Mitgliedsbeitrag");
        tx.Amount.Should().Be(100m);
        tx.Type.Should().Be(TransactionType.Income);
        tx.AccountId.Should().Be(AccountId);
        tx.CategoryId.Should().Be(CategoryId);
        tx.Reference.Should().Be("REF-001");
        tx.Notes.Should().Be("Note");
        tx.CreatedBy.Should().Be("admin");
    }

    [Fact]
    public void Create_ExpenseTransaction_ShouldSetExpenseType()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Büromaterial", 50m, TransactionType.Expense,
            AccountId, null, null, null, "admin");

        // Assert
        tx.Type.Should().Be(TransactionType.Expense);
        tx.CategoryId.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Test", 10m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        // Assert
        tx.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_WithZeroAmount_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Transaction.Create(
            DateTime.UtcNow, "Test", 0m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("amount");
    }

    [Fact]
    public void Create_WithNegativeAmount_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Transaction.Create(
            DateTime.UtcNow, "Test", -10m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("amount");
    }

    [Fact]
    public void Create_WithEmptyDescription_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Transaction.Create(
            DateTime.UtcNow, "", 100m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("description");
    }

    [Fact]
    public void Create_ShouldTrimStrings()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "  Trimmed  ", 10m, TransactionType.Income,
            AccountId, null, "  REF  ", "  Note  ", "admin");

        // Assert
        tx.Description.Should().Be("Trimmed");
        tx.Reference.Should().Be("REF");
        tx.Notes.Should().Be("Note");
    }

    #endregion

    #region Tax Calculation Tests

    [Fact]
    public void Create_WithTaxCode_ShouldCalculateTaxFromGrossAmount()
    {
        // Arrange — 8.1% MWST, amount = 108.10 gross
        var taxCodeId = Guid.NewGuid();
        decimal taxRate = 0.081m;

        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Einkauf", 108.10m, TransactionType.Expense,
            AccountId, null, null, null, "admin",
            taxCodeId: taxCodeId, taxRate: taxRate);

        // Assert — tax = 108.10 * 0.081 / (1 + 0.081) = ~8.10
        tx.TaxCodeId.Should().Be(taxCodeId);
        tx.TaxRate.Should().Be(taxRate);
        tx.TaxAmount.Should().BeApproximately(8.10m, 0.01m);
        tx.NetAmount.Should().Be(tx.Amount - tx.TaxAmount!.Value);
    }

    [Fact]
    public void Create_WithoutTaxCode_ShouldHaveNullTaxFields()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Einkauf", 100m, TransactionType.Expense,
            AccountId, null, null, null, "admin");

        // Assert
        tx.TaxCodeId.Should().BeNull();
        tx.TaxRate.Should().BeNull();
        tx.TaxAmount.Should().BeNull();
        tx.NetAmount.Should().BeNull();
    }

    [Fact]
    public void Create_WithZeroTaxRate_ShouldCalculateZeroTax()
    {
        // Act
        var tx = Transaction.Create(
            DateTime.UtcNow, "Exempt", 100m, TransactionType.Income,
            AccountId, null, null, null, "admin",
            taxCodeId: Guid.NewGuid(), taxRate: 0m);

        // Assert
        tx.TaxAmount.Should().Be(0m);
        tx.NetAmount.Should().Be(100m);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldRecalculateTax()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Original", 100m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        // Act — update with tax
        tx.Update(
            DateTime.UtcNow, "Updated", 200m, TransactionType.Expense,
            AccountId, CategoryId, "REF", "Notes", "editor",
            taxCodeId: Guid.NewGuid(), taxRate: 0.077m);

        // Assert
        tx.Amount.Should().Be(200m);
        tx.TaxRate.Should().Be(0.077m);
        tx.TaxAmount.Should().NotBeNull();
        tx.NetAmount.Should().NotBeNull();
        tx.UpdatedBy.Should().Be("editor");
        tx.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_RemoveTax_ShouldClearTaxFields()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Original", 100m, TransactionType.Income,
            AccountId, null, null, null, "admin",
            taxCodeId: Guid.NewGuid(), taxRate: 0.077m);

        // Act — update without tax
        tx.Update(
            DateTime.UtcNow, "Updated", 100m, TransactionType.Income,
            AccountId, null, null, null, "editor");

        // Assert
        tx.TaxCodeId.Should().BeNull();
        tx.TaxRate.Should().BeNull();
        tx.TaxAmount.Should().BeNull();
        tx.NetAmount.Should().BeNull();
    }

    #endregion

    #region Receipt Tests

    [Fact]
    public void AttachReceipt_ShouldSetReceiptId()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Test", 10m, TransactionType.Income,
            AccountId, null, null, null, "admin");
        var receiptId = Guid.NewGuid();

        // Act
        tx.AttachReceipt(receiptId);

        // Assert
        tx.ReceiptId.Should().Be(receiptId);
    }

    [Fact]
    public void DetachReceipt_ShouldClearReceiptId()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Test", 10m, TransactionType.Income,
            AccountId, null, null, null, "admin");
        tx.AttachReceipt(Guid.NewGuid());

        // Act
        tx.DetachReceipt();

        // Assert
        tx.ReceiptId.Should().BeNull();
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Test", 10m, TransactionType.Income,
            AccountId, null, null, null, "admin");

        // Act
        tx.SoftDelete("admin");

        // Assert
        tx.IsDeleted.Should().BeTrue();
        tx.DeletedAt.Should().NotBeNull();
        tx.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var tx = Transaction.Create(
            DateTime.UtcNow, "Test", 10m, TransactionType.Income,
            AccountId, null, null, null, "admin");
        tx.SoftDelete("admin");

        // Act
        tx.Restore();

        // Assert
        tx.IsDeleted.Should().BeFalse();
        tx.DeletedAt.Should().BeNull();
        tx.DeletedBy.Should().BeNull();
    }

    #endregion
}
