using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance;

/// <summary>
/// REQ-038: Repository for financial accounts
/// </summary>
public interface IAccountRepository
{
    Task<List<Account>> GetAllAsync(CancellationToken ct = default);
    Task<Account?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Account?> GetByNumberAsync(string number, CancellationToken ct = default);
    Task AddAsync(Account account, CancellationToken ct = default);
    Task UpdateAsync(Account account, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-038: Repository for transaction categories
/// </summary>
public interface ICategoryRepository
{
    Task<List<Category>> GetAllAsync(CancellationToken ct = default);
    Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Category category, CancellationToken ct = default);
    Task UpdateAsync(Category category, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-038: Repository for financial transactions (Buchungen)
/// </summary>
public interface ITransactionRepository
{
    Task<List<Transaction>> GetAllAsync(DateTime? from = null, DateTime? to = null, TransactionType? type = null, bool includeArchived = false, CancellationToken ct = default);
    Task<Transaction?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Transaction transaction, CancellationToken ct = default);
    Task UpdateAsync(Transaction transaction, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<(decimal totalIncome, decimal totalExpense)> GetSummaryAsync(DateTime? from = null, DateTime? to = null, CancellationToken ct = default);
    Task<List<Transaction>> GetArchivedAsync(CancellationToken ct = default);
}

/// <summary>
/// REQ-039: Repository for invoices
/// </summary>
public interface IInvoiceRepository
{
    Task<List<Invoice>> GetAllAsync(InvoiceStatus? status = null, bool includeArchived = false, CancellationToken ct = default);
    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Invoice?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default);
    Task<Invoice?> GetByNumberAsync(string invoiceNumber, CancellationToken ct = default);
    Task AddAsync(Invoice invoice, CancellationToken ct = default);
    Task UpdateAsync(Invoice invoice, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<Invoice>> GetOpenItemsAsync(CancellationToken ct = default);
    Task<string> GetNextInvoiceNumberAsync(CancellationToken ct = default);
    Task<List<Invoice>> GetArchivedAsync(CancellationToken ct = default);
}

/// <summary>
/// REQ-040: Repository for payments
/// </summary>
public interface IPaymentRepository
{
    Task<List<Payment>> GetAllAsync(CancellationToken ct = default);
    Task<Payment?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<Payment>> GetByIdsAsync(List<Guid> ids, CancellationToken ct = default);
    Task<List<Payment>> GetByInvoiceIdAsync(Guid invoiceId, CancellationToken ct = default);
    Task AddAsync(Payment payment, CancellationToken ct = default);
    Task UpdateAsync(Payment payment, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-041: Repository for bank imports
/// </summary>
public interface IBankImportRepository
{
    Task<List<BankImport>> GetAllAsync(CancellationToken ct = default);
    Task<BankImport?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(BankImport bankImport, CancellationToken ct = default);
    Task UpdateAsync(BankImport bankImport, CancellationToken ct = default);
}

/// <summary>
/// REQ-042: Repository for dunning notices
/// </summary>
public interface IDunningNoticeRepository
{
    Task<List<DunningNotice>> GetAllAsync(CancellationToken ct = default);
    Task<DunningNotice?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<List<DunningNotice>> GetByInvoiceIdAsync(Guid invoiceId, CancellationToken ct = default);
    Task AddAsync(DunningNotice notice, CancellationToken ct = default);
    Task UpdateAsync(DunningNotice notice, CancellationToken ct = default);
}

/// <summary>
/// REQ-043: Repository for receipts
/// </summary>
public interface IReceiptRepository
{
    Task<List<Receipt>> GetAllAsync(bool includeArchived = false, CancellationToken ct = default);
    Task<Receipt?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Receipt receipt, CancellationToken ct = default);
    Task UpdateAsync(Receipt receipt, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<Receipt>> GetArchivedAsync(CancellationToken ct = default);
    Task<List<Receipt>> GetExpiredArchivedAsync(DateTimeOffset asOf, CancellationToken ct = default);
    Task RemoveAsync(Receipt receipt, CancellationToken ct = default);
}

/// <summary>
/// REQ-060: Repository for finance profiles
/// </summary>
public interface IFinanceProfileRepository
{
    Task<FinanceProfile?> GetActiveProfileAsync(CancellationToken ct = default);
    Task<FinanceProfile?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(FinanceProfile profile, CancellationToken ct = default);
    Task UpdateAsync(FinanceProfile profile, CancellationToken ct = default);
}

/// <summary>
/// REQ-062: Repository for tax codes (MWST/VAT)
/// </summary>
public interface ITaxCodeRepository
{
    Task<List<TaxCode>> GetAllActiveAsync(CancellationToken ct = default);
    Task<TaxCode?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<TaxCode?> GetByCodeAsync(string code, CancellationToken ct = default);
    Task AddAsync(TaxCode taxCode, CancellationToken ct = default);
    Task UpdateAsync(TaxCode taxCode, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-066: Repository for fiscal periods
/// </summary>
public interface IFiscalPeriodRepository
{
    Task<List<FiscalPeriod>> GetAllAsync(int? year = null, CancellationToken ct = default);
    Task<FiscalPeriod?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<FiscalPeriod?> GetByYearAndMonthAsync(int year, int month, CancellationToken ct = default);
    Task<FiscalPeriod?> GetByDateAsync(DateTime date, CancellationToken ct = default);
    Task AddAsync(FiscalPeriod period, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<FiscalPeriod> periods, CancellationToken ct = default);
    Task UpdateAsync(FiscalPeriod period, CancellationToken ct = default);
}

/// <summary>
/// REQ-067: Repository for expense claims
/// </summary>
public interface IExpenseClaimRepository
{
    Task<List<ExpenseClaim>> GetAllAsync(ExpenseClaimStatus? status = null, Guid? claimantId = null, CancellationToken ct = default);
    Task<ExpenseClaim?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(ExpenseClaim claim, CancellationToken ct = default);
    Task UpdateAsync(ExpenseClaim claim, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-064: Repository for invoice templates
/// </summary>
public interface IInvoiceTemplateRepository
{
    Task<List<InvoiceTemplate>> GetAllAsync(Jurisdiction? jurisdiction = null, CancellationToken ct = default);
    Task<InvoiceTemplate?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<InvoiceTemplate?> GetDefaultForJurisdictionAsync(Jurisdiction jurisdiction, CancellationToken ct = default);
    Task AddAsync(InvoiceTemplate template, CancellationToken ct = default);
    Task UpdateAsync(InvoiceTemplate template, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// REQ-068: Repository for activity areas / project dimension tags
/// </summary>
public interface IActivityAreaRepository
{
    Task<List<ActivityArea>> GetAllActiveAsync(CancellationToken ct = default);
    Task<ActivityArea?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ActivityArea?> GetByCodeAsync(string code, CancellationToken ct = default);
    Task AddAsync(ActivityArea area, CancellationToken ct = default);
    Task UpdateAsync(ActivityArea area, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

// ─── Double-Entry Bookkeeping (REQ-074..085) ───

/// <summary>
/// REQ-075: Repository for ledger accounts (chart of accounts)
/// </summary>
public interface ILedgerAccountRepository
{
    Task<List<LedgerAccount>> GetAllByProfileAsync(Guid financeProfileId, CancellationToken ct = default);
    Task<LedgerAccount?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<LedgerAccount?> GetByNumberAsync(Guid financeProfileId, string number, CancellationToken ct = default);
    Task<List<LedgerAccount>> GetByClassAsync(Guid financeProfileId, LedgerAccountClass accountClass, CancellationToken ct = default);
    Task AddAsync(LedgerAccount account, CancellationToken ct = default);
    Task UpdateAsync(LedgerAccount account, CancellationToken ct = default);
    Task DeleteAsync(Guid id, string deletedBy, CancellationToken ct = default);
}

/// <summary>
/// REQ-076: Repository for journal entries (Buchungssätze)
/// </summary>
public interface IJournalEntryRepository
{
    Task<List<JournalEntry>> GetAllAsync(Guid financeProfileId, DateTime? from = null, DateTime? to = null, JournalEntryStatus? status = null, CancellationToken ct = default);
    Task<JournalEntry?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<JournalEntry?> GetByIdWithLinesAsync(Guid id, CancellationToken ct = default);
    Task<List<JournalEntry>> GetBySourceAsync(string sourceType, Guid sourceId, CancellationToken ct = default);
    Task<List<JournalEntry>> GetByLedgerAccountAsync(Guid ledgerAccountId, DateTime? from = null, DateTime? to = null, CancellationToken ct = default);
    Task<List<JournalEntry>> GetByFiscalPeriodAsync(Guid fiscalPeriodId, CancellationToken ct = default);
    Task AddAsync(JournalEntry entry, CancellationToken ct = default);
    Task UpdateAsync(JournalEntry entry, CancellationToken ct = default);
}

/// <summary>
/// REQ-077/082: Repository for posting mappings (subledger → GL mappings)
/// </summary>
public interface IPostingMappingRepository
{
    Task<List<PostingMapping>> GetAllByProfileAsync(Guid financeProfileId, CancellationToken ct = default);
    Task<PostingMapping?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PostingMapping?> GetBySourceAsync(Guid financeProfileId, PostingMappingType mappingType, Guid sourceId, CancellationToken ct = default);
    Task AddAsync(PostingMapping mapping, CancellationToken ct = default);
    Task UpdateAsync(PostingMapping mapping, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
