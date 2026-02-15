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
    Task<List<Transaction>> GetAllAsync(DateTime? from = null, DateTime? to = null, TransactionType? type = null, CancellationToken ct = default);
    Task<Transaction?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Transaction transaction, CancellationToken ct = default);
    Task UpdateAsync(Transaction transaction, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<(decimal totalIncome, decimal totalExpense)> GetSummaryAsync(DateTime? from = null, DateTime? to = null, CancellationToken ct = default);
}

/// <summary>
/// REQ-039: Repository for invoices
/// </summary>
public interface IInvoiceRepository
{
    Task<List<Invoice>> GetAllAsync(InvoiceStatus? status = null, CancellationToken ct = default);
    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Invoice?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default);
    Task<Invoice?> GetByNumberAsync(string invoiceNumber, CancellationToken ct = default);
    Task AddAsync(Invoice invoice, CancellationToken ct = default);
    Task UpdateAsync(Invoice invoice, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<Invoice>> GetOpenItemsAsync(CancellationToken ct = default);
    Task<string> GetNextInvoiceNumberAsync(CancellationToken ct = default);
}

/// <summary>
/// REQ-040: Repository for payments
/// </summary>
public interface IPaymentRepository
{
    Task<List<Payment>> GetAllAsync(CancellationToken ct = default);
    Task<Payment?> GetByIdAsync(Guid id, CancellationToken ct = default);
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
    Task<List<Receipt>> GetAllAsync(CancellationToken ct = default);
    Task<Receipt?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task AddAsync(Receipt receipt, CancellationToken ct = default);
    Task UpdateAsync(Receipt receipt, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
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
