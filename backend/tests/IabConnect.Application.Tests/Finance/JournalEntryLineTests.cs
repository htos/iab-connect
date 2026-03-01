using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for JournalEntryLine entity (REQ-076)
/// </summary>
public class JournalEntryLineTests
{
    private static readonly Guid LedgerAccountId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithDebitOnly_ShouldSetDebitAmount()
    {
        // Act
        var line = JournalEntryLine.Create(LedgerAccountId, debitAmount: 100);

        // Assert
        line.LedgerAccountId.Should().Be(LedgerAccountId);
        line.DebitAmount.Should().Be(100);
        line.CreditAmount.Should().Be(0);
    }

    [Fact]
    public void Create_WithCreditOnly_ShouldSetCreditAmount()
    {
        // Act
        var line = JournalEntryLine.Create(LedgerAccountId, creditAmount: 250.50m);

        // Assert
        line.LedgerAccountId.Should().Be(LedgerAccountId);
        line.DebitAmount.Should().Be(0);
        line.CreditAmount.Should().Be(250.50m);
    }

    [Fact]
    public void Create_WithAllOptionalFields_ShouldSetAll()
    {
        // Arrange
        var taxCodeId = Guid.NewGuid();
        var activityAreaId = Guid.NewGuid();

        // Act
        var line = JournalEntryLine.Create(
            LedgerAccountId,
            debitAmount: 100,
            taxCodeId: taxCodeId,
            netAmount: 92.59m,
            taxAmount: 7.41m,
            activityAreaId: activityAreaId);

        // Assert
        line.TaxCodeId.Should().Be(taxCodeId);
        line.NetAmount.Should().Be(92.59m);
        line.TaxAmount.Should().Be(7.41m);
        line.ActivityAreaId.Should().Be(activityAreaId);
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var line = JournalEntryLine.Create(LedgerAccountId, debitAmount: 100);

        // Assert
        line.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_WithNegativeDebit_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntryLine.Create(LedgerAccountId, debitAmount: -10);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*negative*");
    }

    [Fact]
    public void Create_WithNegativeCredit_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntryLine.Create(LedgerAccountId, creditAmount: -10);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*negative*");
    }

    [Fact]
    public void Create_WithBothZero_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntryLine.Create(LedgerAccountId, debitAmount: 0, creditAmount: 0);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*greater than zero*");
    }

    [Fact]
    public void Create_WithBothPositive_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => JournalEntryLine.Create(LedgerAccountId, debitAmount: 100, creditAmount: 50);
        act.Should().Throw<ArgumentException>()
            .WithMessage("*both debit and credit*");
    }

    #endregion
}
