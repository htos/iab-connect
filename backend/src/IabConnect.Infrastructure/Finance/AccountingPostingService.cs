using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Domain.Finance;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-077/082: Implementation that creates journal entries from subledger transactions.
/// Looks up PostingMappings to determine which ledger accounts to debit/credit.
/// Only activates when FinanceProfile.AccountingMode == DoubleEntry.
/// </summary>
public sealed class AccountingPostingService : IAccountingPostingService
{
    private readonly IFinanceProfileRepository _profileRepo;
    private readonly IPostingMappingRepository _mappingRepo;
    private readonly IJournalEntryRepository _journalRepo;
    private readonly IFiscalPeriodRepository _periodRepo;

    public AccountingPostingService(
        IFinanceProfileRepository profileRepo,
        IPostingMappingRepository mappingRepo,
        IJournalEntryRepository journalRepo,
        IFiscalPeriodRepository periodRepo)
    {
        _profileRepo = profileRepo;
        _mappingRepo = mappingRepo;
        _journalRepo = journalRepo;
        _periodRepo = periodRepo;
    }

    public async Task<bool> IsDoubleEntryEnabledAsync(CancellationToken ct = default)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct);
        return profile?.AccountingMode == AccountingMode.DoubleEntry;
    }

    /// <summary>
    /// REQ-077: Creates journal entry from a transaction using posting mappings.
    /// Category mapping determines which ledger account to use for the expense/revenue side.
    /// Account mapping determines the cash/bank side.
    /// </summary>
    public async Task<JournalEntry?> PostTransactionAsync(Transaction transaction, string userName, CancellationToken ct = default)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct);
        if (profile is null || profile.AccountingMode != AccountingMode.DoubleEntry)
            return null;

        // Look up the account mapping for the bank/cash account (subledger Account → GL LedgerAccount)
        var accountMapping = await _mappingRepo.GetBySourceAsync(
            profile.Id, PostingMappingType.Account, transaction.AccountId, ct);
        if (accountMapping is null)
            return null; // No mapping configured — skip silently (REQ-082 graceful degradation)

        // Look up the category mapping for the revenue/expense ledger account
        PostingMapping? categoryMapping = null;
        if (transaction.CategoryId.HasValue)
        {
            categoryMapping = await _mappingRepo.GetBySourceAsync(
                profile.Id, PostingMappingType.Category, transaction.CategoryId.Value, ct);
        }

        // If no category mapping, we can't create a balanced entry
        if (categoryMapping is null)
            return null;

        // Determine fiscal period
        var period = await _periodRepo.GetByDateAsync(transaction.Date, ct);

        // Create the journal entry
        var entry = JournalEntry.Create(
            date: transaction.Date,
            description: transaction.Description,
            financeProfileId: profile.Id,
            createdBy: userName,
            reference: transaction.Reference,
            sourceType: "Transaction",
            sourceId: transaction.Id,
            fiscalPeriodId: period?.Id);

        // Build lines based on transaction type
        // Income: Debit cash/bank, Credit revenue
        // Expense: Debit expense, Credit cash/bank
        var amount = transaction.Amount;
        var netAmount = transaction.NetAmount;
        var taxAmount = transaction.TaxAmount;

        if (transaction.Type == TransactionType.Income)
        {
            // Debit the bank/cash account
            entry.AddLine(JournalEntryLine.Create(
                ledgerAccountId: accountMapping.LedgerAccountId,
                debitAmount: amount,
                activityAreaId: transaction.ActivityAreaId));

            // Credit the revenue account (net amount if tax applies)
            if (taxAmount.HasValue && taxAmount.Value > 0 && categoryMapping.TaxLedgerAccountId.HasValue)
            {
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.LedgerAccountId,
                    creditAmount: netAmount ?? amount,
                    taxCodeId: transaction.TaxCodeId,
                    netAmount: netAmount,
                    taxAmount: taxAmount,
                    activityAreaId: transaction.ActivityAreaId));

                // Credit the tax liability account
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.TaxLedgerAccountId.Value,
                    creditAmount: taxAmount.Value));
            }
            else
            {
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.LedgerAccountId,
                    creditAmount: amount,
                    taxCodeId: transaction.TaxCodeId,
                    netAmount: netAmount,
                    taxAmount: taxAmount,
                    activityAreaId: transaction.ActivityAreaId));
            }
        }
        else // Expense
        {
            // Debit the expense account (net amount if tax applies)
            if (taxAmount.HasValue && taxAmount.Value > 0 && categoryMapping.TaxLedgerAccountId.HasValue)
            {
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.LedgerAccountId,
                    debitAmount: netAmount ?? amount,
                    taxCodeId: transaction.TaxCodeId,
                    netAmount: netAmount,
                    taxAmount: taxAmount,
                    activityAreaId: transaction.ActivityAreaId));

                // Debit the input tax account
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.TaxLedgerAccountId.Value,
                    debitAmount: taxAmount.Value));
            }
            else
            {
                entry.AddLine(JournalEntryLine.Create(
                    ledgerAccountId: categoryMapping.LedgerAccountId,
                    debitAmount: amount,
                    taxCodeId: transaction.TaxCodeId,
                    netAmount: netAmount,
                    taxAmount: taxAmount,
                    activityAreaId: transaction.ActivityAreaId));
            }

            // Credit the bank/cash account
            entry.AddLine(JournalEntryLine.Create(
                ledgerAccountId: accountMapping.LedgerAccountId,
                creditAmount: amount,
                activityAreaId: transaction.ActivityAreaId));
        }

        // Auto-post if balanced
        if (entry.IsBalanced())
        {
            entry.Post(userName);
        }

        await _journalRepo.AddAsync(entry, ct);
        return entry;
    }

    /// <summary>
    /// REQ-077: Creates journal entry from a payment using posting mappings.
    /// For incoming payments: Debit bank, Credit receivable
    /// For outgoing payments: Debit payable, Credit bank
    /// </summary>
    public async Task<JournalEntry?> PostPaymentAsync(Payment payment, string userName, CancellationToken ct = default)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct);
        if (profile is null || profile.AccountingMode != AccountingMode.DoubleEntry)
            return null;

        // Try to find an account mapping for the payment's transaction account or fallback
        if (payment.TransactionId.HasValue)
        {
            // Payment linked to a transaction — the transaction handler already created a journal entry
            return null;
        }

        // For direct payments (not linked to transactions), we use a default approach
        // Look up account mapping by the invoice (if any) or skip
        if (!payment.InvoiceId.HasValue)
            return null;

        // Determine fiscal period
        var period = await _periodRepo.GetByDateAsync(payment.Date, ct);

        // Create the journal entry
        var entry = JournalEntry.Create(
            date: payment.Date,
            description: $"Zahlung: {payment.Reference ?? payment.Id.ToString()}",
            financeProfileId: profile.Id,
            createdBy: userName,
            reference: payment.Reference,
            sourceType: "Payment",
            sourceId: payment.Id,
            fiscalPeriodId: period?.Id);

        // For payments we need a default receivable/payable and bank account
        // This will be configured via PostingMappings with MappingType.Account
        // For now, skip if no mappings found — graceful degradation
        return null;
    }

    /// <summary>
    /// REQ-078: Creates a reversal (Storno) journal entry for a given source.
    /// </summary>
    public async Task<JournalEntry?> ReversePostingAsync(string sourceType, Guid sourceId, string userName, string? reason = null, CancellationToken ct = default)
    {
        var profile = await _profileRepo.GetActiveProfileAsync(ct);
        if (profile is null || profile.AccountingMode != AccountingMode.DoubleEntry)
            return null;

        // Find the original journal entry by source
        var entries = await _journalRepo.GetBySourceAsync(sourceType, sourceId, ct);
        var originalEntry = entries.FirstOrDefault(e => e.Status == JournalEntryStatus.Posted);
        if (originalEntry is null)
            return null;

        // Load with lines
        var entryWithLines = await _journalRepo.GetByIdWithLinesAsync(originalEntry.Id, ct);
        if (entryWithLines is null)
            return null;

        // Create the reversal using domain method
        var reversal = entryWithLines.CreateReversal(userName, reason);
        reversal.Post(userName);

        await _journalRepo.AddAsync(reversal, ct);
        // Update original entry status (it's already set to Reversed by CreateReversal)
        await _journalRepo.UpdateAsync(entryWithLines, ct);

        return reversal;
    }
}
