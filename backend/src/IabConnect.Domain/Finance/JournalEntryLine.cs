using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-076: A single debit or credit line within a journal entry.
/// Each line references a ledger account and carries either a debit or credit amount.
/// </summary>
public class JournalEntryLine : Entity
{
    public Guid JournalEntryId { get; private set; }
    public Guid LedgerAccountId { get; private set; }
    public decimal DebitAmount { get; private set; }
    public decimal CreditAmount { get; private set; }
    public Guid? TaxCodeId { get; private set; }
    public decimal? NetAmount { get; private set; }
    public decimal? TaxAmount { get; private set; }
    public Guid? ActivityAreaId { get; private set; }

    // Navigation
    public JournalEntry? JournalEntry { get; private set; }
    public LedgerAccount? LedgerAccount { get; private set; }
    public TaxCode? TaxCode { get; private set; }
    public ActivityArea? ActivityArea { get; private set; }

    private JournalEntryLine() { }

    public static JournalEntryLine Create(
        Guid ledgerAccountId,
        decimal debitAmount = 0,
        decimal creditAmount = 0,
        Guid? taxCodeId = null,
        decimal? netAmount = null,
        decimal? taxAmount = null,
        Guid? activityAreaId = null)
    {
        if (debitAmount < 0)
            throw new ArgumentException("Debit amount must not be negative.", nameof(debitAmount));
        if (creditAmount < 0)
            throw new ArgumentException("Credit amount must not be negative.", nameof(creditAmount));
        if (debitAmount == 0 && creditAmount == 0)
            throw new ArgumentException("Either debit or credit amount must be greater than zero.");
        if (debitAmount > 0 && creditAmount > 0)
            throw new ArgumentException("A line cannot have both debit and credit amounts. Use one side only.");

        return new JournalEntryLine
        {
            LedgerAccountId = ledgerAccountId,
            DebitAmount = debitAmount,
            CreditAmount = creditAmount,
            TaxCodeId = taxCodeId,
            NetAmount = netAmount,
            TaxAmount = taxAmount,
            ActivityAreaId = activityAreaId
        };
    }
}
