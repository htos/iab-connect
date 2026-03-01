using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for AccountingPostingService (REQ-077, REQ-078, REQ-082)
/// </summary>
public class AccountingPostingServiceTests
{
    private readonly Mock<IFinanceProfileRepository> _profileRepoMock = new();
    private readonly Mock<IPostingMappingRepository> _mappingRepoMock = new();
    private readonly Mock<IJournalEntryRepository> _journalRepoMock = new();
    private readonly Mock<IFiscalPeriodRepository> _periodRepoMock = new();
    private readonly AccountingPostingService _sut;

    private static readonly Guid ProfileId = Guid.NewGuid();
    private static readonly Guid BankAccountId = Guid.NewGuid();
    private static readonly Guid CategoryId = Guid.NewGuid();
    private static readonly Guid BankLedgerAccountId = Guid.NewGuid();
    private static readonly Guid RevenueLedgerAccountId = Guid.NewGuid();
    private static readonly Guid ExpenseLedgerAccountId = Guid.NewGuid();
    private static readonly Guid TaxLedgerAccountId = Guid.NewGuid();

    public AccountingPostingServiceTests()
    {
        _sut = new AccountingPostingService(
            _profileRepoMock.Object,
            _mappingRepoMock.Object,
            _journalRepoMock.Object,
            _periodRepoMock.Object);
    }

    #region IsDoubleEntryEnabledAsync Tests

    [Fact]
    public async Task IsDoubleEntryEnabledAsync_WhenDoubleEntry_ShouldReturnTrue()
    {
        // Arrange
        var profile = CreateDoubleEntryProfile();
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Act
        var result = await _sut.IsDoubleEntryEnabledAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsDoubleEntryEnabledAsync_WhenSimpleCash_ShouldReturnFalse()
    {
        // Arrange
        var profile = CreateSimpleCashProfile();
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Act
        var result = await _sut.IsDoubleEntryEnabledAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IsDoubleEntryEnabledAsync_WhenNoProfile_ShouldReturnFalse()
    {
        // Arrange
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        // Act
        var result = await _sut.IsDoubleEntryEnabledAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region PostTransactionAsync Tests

    [Fact]
    public async Task PostTransactionAsync_WhenSimpleCash_ShouldReturnNull()
    {
        // Arrange
        var profile = CreateSimpleCashProfile();
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);
        var transaction = CreateIncomeTransaction();

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
        _journalRepoMock.Verify(r => r.AddAsync(It.IsAny<JournalEntry>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PostTransactionAsync_WhenNoProfile_ShouldReturnNull()
    {
        // Arrange
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);
        var transaction = CreateIncomeTransaction();

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task PostTransactionAsync_WhenNoAccountMapping_ShouldReturnNull()
    {
        // Arrange
        SetupDoubleEntryProfile();
        var transaction = CreateIncomeTransaction();
        // No account mapping configured
        _mappingRepoMock.Setup(r => r.GetBySourceAsync(ProfileId, PostingMappingType.Account, BankAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((PostingMapping?)null);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task PostTransactionAsync_WhenNoCategoryMapping_ShouldReturnNull()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        var transaction = CreateIncomeTransaction();
        // No category mapping configured
        _mappingRepoMock.Setup(r => r.GetBySourceAsync(ProfileId, PostingMappingType.Category, CategoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((PostingMapping?)null);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task PostTransactionAsync_IncomeWithoutTax_ShouldCreateBalancedEntry()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMapping(RevenueLedgerAccountId);
        var transaction = CreateIncomeTransaction(amount: 500);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.SourceType.Should().Be("Transaction");
        result.SourceId.Should().Be(transaction.Id);
        result.Status.Should().Be(JournalEntryStatus.Posted);
        result.Lines.Should().HaveCount(2);
        result.TotalDebit.Should().Be(500);
        result.TotalCredit.Should().Be(500);

        _journalRepoMock.Verify(r => r.AddAsync(It.IsAny<JournalEntry>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PostTransactionAsync_Income_ShouldDebitBankCreditRevenue()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMapping(RevenueLedgerAccountId);
        var transaction = CreateIncomeTransaction(amount: 1000);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        // Line 1: Debit bank account
        var debitLine = result!.Lines.First(l => l.DebitAmount > 0);
        debitLine.LedgerAccountId.Should().Be(BankLedgerAccountId);
        debitLine.DebitAmount.Should().Be(1000);

        // Line 2: Credit revenue account
        var creditLine = result.Lines.First(l => l.CreditAmount > 0);
        creditLine.LedgerAccountId.Should().Be(RevenueLedgerAccountId);
        creditLine.CreditAmount.Should().Be(1000);
    }

    [Fact]
    public async Task PostTransactionAsync_Expense_ShouldDebitExpenseCreditBank()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMapping(ExpenseLedgerAccountId);
        var transaction = CreateExpenseTransaction(amount: 200);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        // Line 1: Debit expense account
        var debitLine = result!.Lines.First(l => l.DebitAmount > 0);
        debitLine.LedgerAccountId.Should().Be(ExpenseLedgerAccountId);
        debitLine.DebitAmount.Should().Be(200);

        // Line 2: Credit bank account
        var creditLine = result.Lines.First(l => l.CreditAmount > 0);
        creditLine.LedgerAccountId.Should().Be(BankLedgerAccountId);
        creditLine.CreditAmount.Should().Be(200);
    }

    [Fact]
    public async Task PostTransactionAsync_IncomeWithTax_ShouldCreate3Lines()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMappingWithTax(RevenueLedgerAccountId);
        var transaction = CreateIncomeTransactionWithTax(amount: 108, netAmount: 100, taxAmount: 8);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Lines.Should().HaveCount(3);
        result.IsBalanced().Should().BeTrue();
        result.TotalDebit.Should().Be(108);
        result.TotalCredit.Should().Be(108);

        // Line 1: Debit bank 108
        result.Lines.Where(l => l.LedgerAccountId == BankLedgerAccountId)
            .Sum(l => l.DebitAmount).Should().Be(108);

        // Line 2: Credit revenue (net) 100
        result.Lines.Where(l => l.LedgerAccountId == RevenueLedgerAccountId)
            .Sum(l => l.CreditAmount).Should().Be(100);

        // Line 3: Credit tax account 8
        result.Lines.Where(l => l.LedgerAccountId == TaxLedgerAccountId)
            .Sum(l => l.CreditAmount).Should().Be(8);
    }

    [Fact]
    public async Task PostTransactionAsync_ExpenseWithTax_ShouldCreate3Lines()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMappingWithTax(ExpenseLedgerAccountId);
        var transaction = CreateExpenseTransactionWithTax(amount: 108, netAmount: 100, taxAmount: 8);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Lines.Should().HaveCount(3);
        result.IsBalanced().Should().BeTrue();

        // Debit expense (net) + debit tax = total debit
        result.TotalDebit.Should().Be(108);
        // Credit bank = total credit
        result.TotalCredit.Should().Be(108);
    }

    [Fact]
    public async Task PostTransactionAsync_ShouldAutoPostBalancedEntry()
    {
        // Arrange
        SetupDoubleEntryProfile();
        SetupAccountMapping();
        SetupCategoryMapping(RevenueLedgerAccountId);
        var transaction = CreateIncomeTransaction(amount: 300);

        // Act
        var result = await _sut.PostTransactionAsync(transaction, "admin", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be(JournalEntryStatus.Posted);
        result.PostedBy.Should().Be("admin");
        result.PostedAt.Should().NotBeNull();
    }

    #endregion

    #region ReversePostingAsync Tests

    [Fact]
    public async Task ReversePostingAsync_WhenSimpleCash_ShouldReturnNull()
    {
        // Arrange
        var profile = CreateSimpleCashProfile();
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Act
        var result = await _sut.ReversePostingAsync("Transaction", Guid.NewGuid(), "admin", ct: TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task ReversePostingAsync_WhenNoOriginalEntry_ShouldReturnNull()
    {
        // Arrange
        SetupDoubleEntryProfile();
        var sourceId = Guid.NewGuid();
        _journalRepoMock.Setup(r => r.GetBySourceAsync("Transaction", sourceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry>());

        // Act
        var result = await _sut.ReversePostingAsync("Transaction", sourceId, "admin", ct: TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task ReversePostingAsync_WithPostedEntry_ShouldCreateReversalAndSave()
    {
        // Arrange
        SetupDoubleEntryProfile();
        var sourceId = Guid.NewGuid();
        var originalEntry = CreatePostedEntryWithLines(sourceId);

        _journalRepoMock.Setup(r => r.GetBySourceAsync("Transaction", sourceId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry> { originalEntry });
        _journalRepoMock.Setup(r => r.GetByIdWithLinesAsync(originalEntry.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(originalEntry);

        // Act
        var result = await _sut.ReversePostingAsync("Transaction", sourceId, "admin", "Correction", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be(JournalEntryStatus.Posted);
        result.Description.Should().Contain("Storno");
        result.Description.Should().Contain("Correction");

        // Original should now be Reversed
        originalEntry.Status.Should().Be(JournalEntryStatus.Reversed);

        _journalRepoMock.Verify(r => r.AddAsync(It.IsAny<JournalEntry>(), It.IsAny<CancellationToken>()), Times.Once);
        _journalRepoMock.Verify(r => r.UpdateAsync(originalEntry, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Helpers

    private static FinanceProfile CreateDoubleEntryProfile()
    {
        return FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Verein", "Address", "Bern", "3000", "CH",
            null, null, null, null, null, null, null,
            accountingMode: AccountingMode.DoubleEntry);
    }

    private static FinanceProfile CreateSimpleCashProfile()
    {
        return FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Verein", "Address", "Bern", "3000", "CH",
            null, null, null, null, null, null, null,
            accountingMode: AccountingMode.SimpleCash);
    }

    private void SetupDoubleEntryProfile()
    {
        var profile = CreateDoubleEntryProfile();
        // Use reflection to set the Id to our known ProfileId
        typeof(IabConnect.Domain.Common.Entity)
            .GetProperty("Id")!
            .SetValue(profile, ProfileId);
        _profileRepoMock.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);
    }

    private void SetupAccountMapping()
    {
        var accountMapping = PostingMapping.Create(
            financeProfileId: ProfileId,
            mappingType: PostingMappingType.Account,
            sourceId: BankAccountId,
            ledgerAccountId: BankLedgerAccountId,
            createdBy: "admin");

        _mappingRepoMock.Setup(r => r.GetBySourceAsync(
                It.IsAny<Guid>(), PostingMappingType.Account, BankAccountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(accountMapping);
    }

    private void SetupCategoryMapping(Guid ledgerAccountId, Guid? taxLedgerAccountId = null)
    {
        var categoryMapping = PostingMapping.Create(
            financeProfileId: ProfileId,
            mappingType: PostingMappingType.Category,
            sourceId: CategoryId,
            ledgerAccountId: ledgerAccountId,
            createdBy: "admin",
            taxLedgerAccountId: taxLedgerAccountId);

        _mappingRepoMock.Setup(r => r.GetBySourceAsync(
                It.IsAny<Guid>(), PostingMappingType.Category, CategoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(categoryMapping);
    }

    private void SetupCategoryMappingWithTax(Guid ledgerAccountId)
    {
        SetupCategoryMapping(ledgerAccountId, TaxLedgerAccountId);
    }

    private Transaction CreateIncomeTransaction(decimal amount = 500)
    {
        return Transaction.Create(
            date: DateTime.UtcNow,
            description: "Income transaction",
            amount: amount,
            type: TransactionType.Income,
            accountId: BankAccountId,
            categoryId: CategoryId,
            reference: "INC-001",
            notes: null,
            createdBy: "admin");
    }

    private Transaction CreateExpenseTransaction(decimal amount = 200)
    {
        return Transaction.Create(
            date: DateTime.UtcNow,
            description: "Expense transaction",
            amount: amount,
            type: TransactionType.Expense,
            accountId: BankAccountId,
            categoryId: CategoryId,
            reference: "EXP-001",
            notes: null,
            createdBy: "admin");
    }

    private Transaction CreateIncomeTransactionWithTax(decimal amount, decimal netAmount, decimal taxAmount)
    {
        var transaction = Transaction.Create(
            date: DateTime.UtcNow,
            description: "Income with tax",
            amount: amount,
            type: TransactionType.Income,
            accountId: BankAccountId,
            categoryId: CategoryId,
            reference: "INC-TAX",
            notes: null,
            createdBy: "admin",
            taxCodeId: Guid.NewGuid(),
            taxRate: taxAmount / netAmount);

        return transaction;
    }

    private Transaction CreateExpenseTransactionWithTax(decimal amount, decimal netAmount, decimal taxAmount)
    {
        var transaction = Transaction.Create(
            date: DateTime.UtcNow,
            description: "Expense with tax",
            amount: amount,
            type: TransactionType.Expense,
            accountId: BankAccountId,
            categoryId: CategoryId,
            reference: "EXP-TAX",
            notes: null,
            createdBy: "admin",
            taxCodeId: Guid.NewGuid(),
            taxRate: taxAmount / netAmount);

        return transaction;
    }

    private JournalEntry CreatePostedEntryWithLines(Guid sourceId)
    {
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Posted entry",
            financeProfileId: ProfileId,
            createdBy: "admin",
            sourceType: "Transaction",
            sourceId: sourceId);

        entry.AddLine(JournalEntryLine.Create(BankLedgerAccountId, debitAmount: 500));
        entry.AddLine(JournalEntryLine.Create(RevenueLedgerAccountId, creditAmount: 500));
        entry.Post("admin");
        return entry;
    }

    #endregion
}
