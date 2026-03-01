using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-076: Journal entry header for double-entry bookkeeping.
/// Each entry consists of at least two lines where total debit equals total credit.
/// </summary>
public class JournalEntry : Entity
{
    public DateTime Date { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string? Reference { get; private set; }
    public JournalEntryStatus Status { get; private set; } = JournalEntryStatus.Draft;

    // REQ-083: Source traceability (subledger link)
    public string? SourceType { get; private set; }
    public Guid? SourceId { get; private set; }

    public Guid? FiscalPeriodId { get; private set; }
    public Guid FinanceProfileId { get; private set; }

    // REQ-078: Reversal/Storno link
    public Guid? ReversalOfEntryId { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? PostedAt { get; private set; }
    public string? PostedBy { get; private set; }

    // Navigation
    public JournalEntry? ReversalOfEntry { get; private set; }
    public FiscalPeriod? FiscalPeriod { get; private set; }
    public FinanceProfile? FinanceProfile { get; private set; }
    private readonly List<JournalEntryLine> _lines = [];
    public IReadOnlyList<JournalEntryLine> Lines => _lines.AsReadOnly();

    private JournalEntry() { }

    public static JournalEntry Create(
        DateTime date,
        string description,
        Guid financeProfileId,
        string createdBy,
        string? reference = null,
        string? sourceType = null,
        Guid? sourceId = null,
        Guid? fiscalPeriodId = null)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));

        return new JournalEntry
        {
            Date = date,
            Description = description.Trim(),
            Reference = reference?.Trim(),
            SourceType = sourceType,
            SourceId = sourceId,
            FiscalPeriodId = fiscalPeriodId,
            FinanceProfileId = financeProfileId,
            Status = JournalEntryStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void AddLine(JournalEntryLine line)
    {
        _lines.Add(line);
    }

    /// <summary>
    /// Updates header fields of a Draft journal entry.
    /// </summary>
    public void Update(DateTime date, string description, string? reference)
    {
        if (Status != JournalEntryStatus.Draft)
            throw new InvalidOperationException("Only draft journal entries can be updated.");

        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));

        Date = date;
        Description = description.Trim();
        Reference = reference?.Trim();
    }

    /// <summary>
    /// Removes all existing lines so they can be replaced.
    /// Only allowed on Draft entries.
    /// </summary>
    public void ClearLines()
    {
        if (Status != JournalEntryStatus.Draft)
            throw new InvalidOperationException("Only draft journal entries can have lines replaced.");

        _lines.Clear();
    }

    /// <summary>
    /// Validates and posts the journal entry.
    /// REQ-076: Soll must equal Haben, minimum 2 lines.
    /// </summary>
    public void Post(string postedBy)
    {
        if (Status != JournalEntryStatus.Draft)
            throw new InvalidOperationException("Only draft journal entries can be posted.");

        if (_lines.Count < 2)
            throw new InvalidOperationException("A journal entry must have at least two lines.");

        var totalDebit = _lines.Sum(l => l.DebitAmount);
        var totalCredit = _lines.Sum(l => l.CreditAmount);

        if (totalDebit != totalCredit)
            throw new InvalidOperationException(
                $"Journal entry is not balanced. Total debit ({totalDebit:N2}) does not equal total credit ({totalCredit:N2}).");

        Status = JournalEntryStatus.Posted;
        PostedAt = DateTime.UtcNow;
        PostedBy = postedBy;
    }

    /// <summary>
    /// REQ-078: Creates a reversal entry (Storno). Original entry status is set to Reversed.
    /// </summary>
    public JournalEntry CreateReversal(string createdBy, string? reason = null)
    {
        if (Status != JournalEntryStatus.Posted)
            throw new InvalidOperationException("Only posted journal entries can be reversed.");

        Status = JournalEntryStatus.Reversed;

        var reversalDescription = string.IsNullOrWhiteSpace(reason)
            ? $"Storno: {Description}"
            : $"Storno: {Description} - {reason}";

        var reversal = new JournalEntry
        {
            Date = DateTime.UtcNow.Date,
            Description = reversalDescription,
            Reference = Reference,
            SourceType = SourceType,
            SourceId = SourceId,
            FiscalPeriodId = FiscalPeriodId,
            FinanceProfileId = FinanceProfileId,
            ReversalOfEntryId = Id,
            Status = JournalEntryStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };

        // Reverse all lines: swap debit and credit
        foreach (var line in _lines)
        {
            reversal.AddLine(JournalEntryLine.Create(
                line.LedgerAccountId,
                debitAmount: line.CreditAmount,
                creditAmount: line.DebitAmount,
                taxCodeId: line.TaxCodeId,
                netAmount: line.NetAmount,
                taxAmount: line.TaxAmount,
                activityAreaId: line.ActivityAreaId));
        }

        return reversal;
    }

    /// <summary>
    /// RQ-076: Check if the entry is balanced (sum debit == sum credit)
    /// </summary>
    public bool IsBalanced()
    {
        var totalDebit = _lines.Sum(l => l.DebitAmount);
        var totalCredit = _lines.Sum(l => l.CreditAmount);
        return totalDebit == totalCredit;
    }

    public decimal TotalDebit => _lines.Sum(l => l.DebitAmount);
    public decimal TotalCredit => _lines.Sum(l => l.CreditAmount);
}
