using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for JournalEntry entity (REQ-076, REQ-078)
/// </summary>
public class JournalEntryTests
{
    private static readonly Guid FinanceProfileId = Guid.NewGuid();
    private static readonly Guid LedgerAccountId1 = Guid.NewGuid();
    private static readonly Guid LedgerAccountId2 = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Arrange
        var date = new DateTime(2025, 3, 1, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var entry = JournalEntry.Create(
            date: date,
            description: "Test journal entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            reference: "REF-001",
            sourceType: "Transaction",
            sourceId: Guid.NewGuid(),
            fiscalPeriodId: Guid.NewGuid());

        // Assert
        entry.Date.Should().Be(date);
        entry.Description.Should().Be("Test journal entry");
        entry.FinanceProfileId.Should().Be(FinanceProfileId);
        entry.CreatedBy.Should().Be("admin");
        entry.Reference.Should().Be("REF-001");
        entry.SourceType.Should().Be("Transaction");
        entry.Status.Should().Be(JournalEntryStatus.Draft);
        entry.Lines.Should().BeEmpty();
        entry.PostedAt.Should().BeNull();
        entry.PostedBy.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        // Assert
        entry.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetCreatedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        // Assert
        entry.CreatedAt.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Create_ShouldTrimDescription()
    {
        // Act
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "  Trimmed  ",
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            reference: "  REF  ");

        // Assert
        entry.Description.Should().Be("Trimmed");
        entry.Reference.Should().Be("REF");
    }

    [Fact]
    public void Create_WithEmptyDescription_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("description");
    }

    [Fact]
    public void Create_WithWhitespaceOnlyDescription_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "   ",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("description");
    }

    [Fact]
    public void Create_WithOptionalFieldsNull_ShouldSucceed()
    {
        // Act
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Minimal entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");

        // Assert
        entry.Reference.Should().BeNull();
        entry.SourceType.Should().BeNull();
        entry.SourceId.Should().BeNull();
        entry.FiscalPeriodId.Should().BeNull();
        entry.ReversalOfEntryId.Should().BeNull();
    }

    #endregion

    #region AddLine Tests

    [Fact]
    public void AddLine_ShouldAddLineToCollection()
    {
        // Arrange
        var entry = CreateValidEntry();
        var line = JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100);

        // Act
        entry.AddLine(line);

        // Assert
        entry.Lines.Should().HaveCount(1);
        entry.Lines[0].Should().Be(line);
    }

    [Fact]
    public void AddLine_MultipleTimes_ShouldAccumulateLines()
    {
        // Arrange
        var entry = CreateValidEntry();

        // Act
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 100));

        // Assert
        entry.Lines.Should().HaveCount(2);
    }

    #endregion

    #region Post Tests

    [Fact]
    public void Post_DraftWithBalancedLines_ShouldSetStatusToPosted()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 500));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 500));

        // Act
        entry.Post("admin");

        // Assert
        entry.Status.Should().Be(JournalEntryStatus.Posted);
        entry.PostedBy.Should().Be("admin");
        entry.PostedAt.Should().NotBeNull();
    }

    [Fact]
    public void Post_ShouldSetPostedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);
        var entry = CreateBalancedDraftEntry();

        // Act
        entry.Post("admin");

        // Assert
        entry.PostedAt.Should().NotBeNull();
        entry.PostedAt!.Value.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Post_NotDraft_ShouldThrowInvalidOperationException()
    {
        // Arrange — create a posted entry
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act & Assert — posting again should fail
        var act = () => entry.Post("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public void Post_LessThanTwoLines_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100));

        // Act & Assert
        var act = () => entry.Post("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*two lines*");
    }

    [Fact]
    public void Post_NoLines_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var entry = CreateValidEntry();

        // Act & Assert
        var act = () => entry.Post("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*two lines*");
    }

    [Fact]
    public void Post_UnbalancedLines_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 500));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 300));

        // Act & Assert
        var act = () => entry.Post("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*not balanced*");
    }

    [Fact]
    public void Post_WithMultipleBalancedLines_ShouldSucceed()
    {
        // Arrange — 3-line entry (common for tax split)
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 1000));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 923.08m));
        entry.AddLine(JournalEntryLine.Create(Guid.NewGuid(), creditAmount: 76.92m));

        // Act
        entry.Post("admin");

        // Assert
        entry.Status.Should().Be(JournalEntryStatus.Posted);
        entry.Lines.Should().HaveCount(3);
    }

    #endregion

    #region IsBalanced Tests

    [Fact]
    public void IsBalanced_BalancedEntry_ShouldReturnTrue()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 250.50m));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 250.50m));

        // Act & Assert
        entry.IsBalanced().Should().BeTrue();
    }

    [Fact]
    public void IsBalanced_UnbalancedEntry_ShouldReturnFalse()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 99.99m));

        // Act & Assert
        entry.IsBalanced().Should().BeFalse();
    }

    [Fact]
    public void IsBalanced_EmptyEntry_ShouldReturnTrue()
    {
        // Arrange
        var entry = CreateValidEntry();

        // Act & Assert — 0 == 0
        entry.IsBalanced().Should().BeTrue();
    }

    #endregion

    #region TotalDebit / TotalCredit Tests

    [Fact]
    public void TotalDebit_ShouldReturnSumOfDebitAmounts()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, debitAmount: 200));
        entry.AddLine(JournalEntryLine.Create(Guid.NewGuid(), creditAmount: 300));

        // Act & Assert
        entry.TotalDebit.Should().Be(300);
    }

    [Fact]
    public void TotalCredit_ShouldReturnSumOfCreditAmounts()
    {
        // Arrange
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 300));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 150));
        entry.AddLine(JournalEntryLine.Create(Guid.NewGuid(), creditAmount: 150));

        // Act & Assert
        entry.TotalCredit.Should().Be(300);
    }

    #endregion

    #region CreateReversal Tests

    [Fact]
    public void CreateReversal_PostedEntry_ShouldCreateReversalEntry()
    {
        // Arrange
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act
        var reversal = entry.CreateReversal("admin");

        // Assert
        reversal.Should().NotBeNull();
        reversal.ReversalOfEntryId.Should().Be(entry.Id);
        reversal.FinanceProfileId.Should().Be(entry.FinanceProfileId);
        reversal.Status.Should().Be(JournalEntryStatus.Draft);
        reversal.CreatedBy.Should().Be("admin");
    }

    [Fact]
    public void CreateReversal_ShouldSetOriginalToReversed()
    {
        // Arrange
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act
        entry.CreateReversal("admin");

        // Assert
        entry.Status.Should().Be(JournalEntryStatus.Reversed);
    }

    [Fact]
    public void CreateReversal_ShouldSwapDebitAndCredit()
    {
        // Arrange
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act
        var reversal = entry.CreateReversal("admin");

        // Assert
        reversal.Lines.Should().HaveCount(2);
        // Original: debit 500 on account1, credit 500 on account2
        // Reversal: credit 500 on account1, debit 500 on account2
        var line1 = reversal.Lines.First(l => l.LedgerAccountId == LedgerAccountId1);
        line1.DebitAmount.Should().Be(0);
        line1.CreditAmount.Should().Be(500);

        var line2 = reversal.Lines.First(l => l.LedgerAccountId == LedgerAccountId2);
        line2.DebitAmount.Should().Be(500);
        line2.CreditAmount.Should().Be(0);
    }

    [Fact]
    public void CreateReversal_WithReason_ShouldIncludeReasonInDescription()
    {
        // Arrange
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act
        var reversal = entry.CreateReversal("admin", "Incorrect posting");

        // Assert
        reversal.Description.Should().Contain("Storno");
        reversal.Description.Should().Contain("Incorrect posting");
    }

    [Fact]
    public void CreateReversal_WithoutReason_ShouldHaveStornoDescription()
    {
        // Arrange
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");

        // Act
        var reversal = entry.CreateReversal("admin");

        // Assert
        reversal.Description.Should().StartWith("Storno:");
    }

    [Fact]
    public void CreateReversal_NotPosted_ShouldThrowInvalidOperationException()
    {
        // Arrange — entry is still Draft
        var entry = CreateValidEntry();

        // Act & Assert
        var act = () => entry.CreateReversal("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*posted*");
    }

    [Fact]
    public void CreateReversal_AlreadyReversed_ShouldThrowInvalidOperationException()
    {
        // Arrange — reverse once
        var entry = CreateBalancedDraftEntry();
        entry.Post("admin");
        entry.CreateReversal("admin");

        // Act & Assert — reverse again
        var act = () => entry.CreateReversal("admin");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*posted*");
    }

    [Fact]
    public void CreateReversal_ShouldPreserveSourceInfo()
    {
        // Arrange
        var sourceId = Guid.NewGuid();
        var entry = JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin",
            sourceType: "Transaction",
            sourceId: sourceId);
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 100));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 100));
        entry.Post("admin");

        // Act
        var reversal = entry.CreateReversal("admin");

        // Assert
        reversal.SourceType.Should().Be("Transaction");
        reversal.SourceId.Should().Be(sourceId);
    }

    #endregion

    #region Helpers

    private static JournalEntry CreateValidEntry()
    {
        return JournalEntry.Create(
            date: DateTime.UtcNow,
            description: "Test entry",
            financeProfileId: FinanceProfileId,
            createdBy: "admin");
    }

    private static JournalEntry CreateBalancedDraftEntry()
    {
        var entry = CreateValidEntry();
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId1, debitAmount: 500));
        entry.AddLine(JournalEntryLine.Create(LedgerAccountId2, creditAmount: 500));
        return entry;
    }

    #endregion
}
