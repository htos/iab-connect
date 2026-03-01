using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Accounting;

/// <summary>
/// REQ-077/082: Service that creates journal entries from subledger transactions
/// when the finance profile is configured for double-entry bookkeeping.
/// </summary>
public interface IAccountingPostingService
{
    /// <summary>
    /// Creates a journal entry from a transaction if AccountingMode is DoubleEntry.
    /// Returns the created JournalEntry or null if not applicable.
    /// </summary>
    Task<JournalEntry?> PostTransactionAsync(Transaction transaction, string userName, CancellationToken ct = default);

    /// <summary>
    /// Creates a journal entry from a payment if AccountingMode is DoubleEntry.
    /// Returns the created JournalEntry or null if not applicable.
    /// </summary>
    Task<JournalEntry?> PostPaymentAsync(Payment payment, string userName, CancellationToken ct = default);

    /// <summary>
    /// Creates a reversal (Storno) journal entry for a given source entity.
    /// REQ-078: Storno must reverse all debit/credit lines.
    /// </summary>
    Task<JournalEntry?> ReversePostingAsync(string sourceType, Guid sourceId, string userName, string? reason = null, CancellationToken ct = default);

    /// <summary>
    /// Checks whether double-entry bookkeeping is enabled for the active profile.
    /// </summary>
    Task<bool> IsDoubleEntryEnabledAsync(CancellationToken ct = default);
}
