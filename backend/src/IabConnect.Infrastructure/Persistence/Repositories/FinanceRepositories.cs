using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-038: Account repository implementation
/// </summary>
public sealed class AccountRepository : IAccountRepository
{
    private readonly ApplicationDbContext _context;

    public AccountRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Account>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.Accounts
            .AsNoTracking()
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);
    }

    public async Task<Account?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Accounts
            .FirstOrDefaultAsync(a => a.Id == id, ct);
    }

    public async Task<Account?> GetByNumberAsync(string number, CancellationToken ct = default)
    {
        return await _context.Accounts
            .FirstOrDefaultAsync(a => a.Number == number, ct);
    }

    public async Task AddAsync(Account account, CancellationToken ct = default)
    {
        await _context.Accounts.AddAsync(account, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Account account, CancellationToken ct = default)
    {
        _context.Accounts.Update(account);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var account = await _context.Accounts.FindAsync([id], ct);
        if (account is not null)
        {
            account.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-038: Category repository implementation
/// </summary>
public sealed class CategoryRepository : ICategoryRepository
{
    private readonly ApplicationDbContext _context;

    public CategoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Category>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<Category?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id, ct);
    }

    public async Task AddAsync(Category category, CancellationToken ct = default)
    {
        await _context.Categories.AddAsync(category, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Category category, CancellationToken ct = default)
    {
        _context.Categories.Update(category);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var category = await _context.Categories.FindAsync([id], ct);
        if (category is not null)
        {
            category.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-038: Transaction repository implementation
/// </summary>
public sealed class TransactionRepository : ITransactionRepository
{
    private readonly ApplicationDbContext _context;

    public TransactionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Transaction>> GetAllAsync(DateTime? from = null, DateTime? to = null, TransactionType? type = null, bool includeArchived = false, CancellationToken ct = default)
    {
        var query = _context.Transactions
            .AsNoTracking()
            .Include(t => t.Account)
            .Include(t => t.Category)
            .AsQueryable();

        if (!includeArchived)
            query = query.Where(t => !t.IsArchived);

        if (from.HasValue)
            query = query.Where(t => t.Date >= from.Value);

        if (to.HasValue)
            query = query.Where(t => t.Date <= to.Value);

        if (type.HasValue)
            query = query.Where(t => t.Type == type.Value);

        return await query
            .OrderByDescending(t => t.Date)
            .ToListAsync(ct);
    }

    public async Task<Transaction?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Transactions
            .Include(t => t.Account)
            .Include(t => t.Category)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task AddAsync(Transaction transaction, CancellationToken ct = default)
    {
        await _context.Transactions.AddAsync(transaction, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Transaction transaction, CancellationToken ct = default)
    {
        _context.Transactions.Update(transaction);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var transaction = await _context.Transactions.FindAsync([id], ct);
        if (transaction is not null)
        {
            transaction.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }

    public async Task<(decimal totalIncome, decimal totalExpense)> GetSummaryAsync(DateTime? from = null, DateTime? to = null, CancellationToken ct = default)
    {
        var query = _context.Transactions.AsNoTracking().AsQueryable();

        if (from.HasValue)
            query = query.Where(t => t.Date >= from.Value);

        if (to.HasValue)
            query = query.Where(t => t.Date <= to.Value);

        var totalIncome = await query
            .Where(t => t.Type == TransactionType.Income)
            .SumAsync(t => t.Amount, ct);

        var totalExpense = await query
            .Where(t => t.Type == TransactionType.Expense)
            .SumAsync(t => t.Amount, ct);

        return (totalIncome, totalExpense);
    }

    public async Task<List<Transaction>> GetArchivedAsync(CancellationToken ct = default)
    {
        return await _context.Transactions
            .AsNoTracking()
            .Include(t => t.Account)
            .Include(t => t.Category)
            .Where(t => t.IsArchived)
            .OrderByDescending(t => t.ArchivedAt)
            .ToListAsync(ct);
    }
}

/// <summary>
/// REQ-039: Invoice repository implementation
/// </summary>
public sealed class InvoiceRepository : IInvoiceRepository
{
    private readonly ApplicationDbContext _context;

    public InvoiceRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Invoice>> GetAllAsync(InvoiceStatus? status = null, bool includeArchived = false, CancellationToken ct = default)
    {
        var query = _context.Invoices
            .AsNoTracking()
            .Include(i => i.Items)
            .AsQueryable();

        if (!includeArchived)
            query = query.Where(i => !i.IsArchived);

        if (status.HasValue)
            query = query.Where(i => i.Status == status.Value);

        return await query
            .OrderByDescending(i => i.Date)
            .ToListAsync(ct);
    }

    public async Task<Invoice?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Invoices
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<Invoice?> GetByNumberAsync(string invoiceNumber, CancellationToken ct = default)
    {
        return await _context.Invoices
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.InvoiceNumber == invoiceNumber, ct);
    }

    public async Task AddAsync(Invoice invoice, CancellationToken ct = default)
    {
        await _context.Invoices.AddAsync(invoice, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Invoice invoice, CancellationToken ct = default)
    {
        _context.Invoices.Update(invoice);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await _context.Invoices.FindAsync([id], ct);
        if (invoice is not null)
        {
            invoice.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }

    public async Task<List<Invoice>> GetOpenItemsAsync(CancellationToken ct = default)
    {
        return await _context.Invoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Where(i => i.Status == InvoiceStatus.Sent || i.Status == InvoiceStatus.Overdue)
            .OrderByDescending(i => i.Date)
            .ToListAsync(ct);
    }

    public async Task<string> GetNextInvoiceNumberAsync(CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"INV-{year}-";

        // REQ-071: Use atomic PostgreSQL UPSERT for concurrency-safe numbering.
        // The ON CONFLICT … DO UPDATE acquires a row-level lock, preventing
        // two concurrent callers from ever reading the same counter value.
        var profileId = await GetDefaultProfileIdAsync(ct);

        var connection = _context.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(ct);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO invoice_number_counters (id, finance_profile_id, fiscal_year, prefix, current_value, updated_at)
            VALUES (gen_random_uuid(), @profileId, @fiscalYear, @prefix, 1, now())
            ON CONFLICT (finance_profile_id, fiscal_year)
            DO UPDATE SET current_value = invoice_number_counters.current_value + 1,
                          updated_at = now()
            RETURNING current_value
            """;

        var p1 = command.CreateParameter();
        p1.ParameterName = "profileId";
        p1.Value = profileId;
        command.Parameters.Add(p1);

        var p2 = command.CreateParameter();
        p2.ParameterName = "fiscalYear";
        p2.Value = year;
        command.Parameters.Add(p2);

        var p3 = command.CreateParameter();
        p3.ParameterName = "prefix";
        p3.Value = prefix;
        command.Parameters.Add(p3);

        // Enlist in the current EF Core transaction if one is active
        if (_context.Database.CurrentTransaction is not null)
            command.Transaction = _context.Database.CurrentTransaction.GetDbTransaction();

        var result = await command.ExecuteScalarAsync(ct);
        var nextValue = Convert.ToInt32(result);

        return $"{prefix}{nextValue:D4}";
    }

    /// <summary>
    /// Returns the active FinanceProfile Id, or a deterministic sentinel GUID
    /// when no profile exists yet (e.g. during initial setup / tests).
    /// </summary>
    private async Task<Guid> GetDefaultProfileIdAsync(CancellationToken ct)
    {
        var profileId = await _context.FinanceProfiles
            .AsNoTracking()
            .Where(fp => fp.IsActive)
            .Select(fp => (Guid?)fp.Id)
            .FirstOrDefaultAsync(ct);

        // Deterministic sentinel so the counter row is stable even without a profile
        return profileId ?? Guid.Parse("00000000-0000-0000-0000-000000000001");
    }

    public async Task<Invoice?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Invoices
            .IgnoreQueryFilters()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
    }

    public async Task<List<Invoice>> GetArchivedAsync(CancellationToken ct = default)
    {
        return await _context.Invoices
            .AsNoTracking()
            .Include(i => i.Items)
            .Where(i => i.IsArchived)
            .OrderByDescending(i => i.ArchivedAt)
            .ToListAsync(ct);
    }
}

/// <summary>
/// REQ-040: Payment repository implementation
/// </summary>
public sealed class PaymentRepository : IPaymentRepository
{
    private readonly ApplicationDbContext _context;

    public PaymentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Payment>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
            .OrderByDescending(p => p.Date)
            .ToListAsync(ct);
    }

    public async Task<Payment?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Payments
            .Include(p => p.Invoice)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public async Task<List<Payment>> GetByIdsAsync(List<Guid> ids, CancellationToken ct = default)
    {
        return await _context.Payments
            .Include(p => p.Invoice)
            .Where(p => ids.Contains(p.Id))
            .OrderByDescending(p => p.Date)
            .ToListAsync(ct);
    }

    public async Task<List<Payment>> GetByInvoiceIdAsync(Guid invoiceId, CancellationToken ct = default)
    {
        return await _context.Payments
            .AsNoTracking()
            .Include(p => p.Invoice)
            .Where(p => p.InvoiceId == invoiceId)
            .OrderByDescending(p => p.Date)
            .ToListAsync(ct);
    }

    public async Task AddAsync(Payment payment, CancellationToken ct = default)
    {
        await _context.Payments.AddAsync(payment, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Payment payment, CancellationToken ct = default)
    {
        _context.Payments.Update(payment);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var payment = await _context.Payments.FindAsync([id], ct);
        if (payment is not null)
        {
            payment.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-041: Bank import repository implementation
/// </summary>
public sealed class BankImportRepository : IBankImportRepository
{
    private readonly ApplicationDbContext _context;

    public BankImportRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<BankImport>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.BankImports
            .AsNoTracking()
            .Include(b => b.Items)
            .OrderByDescending(b => b.ImportDate)
            .ToListAsync(ct);
    }

    public async Task<BankImport?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.BankImports
            .Include(b => b.Items)
            .FirstOrDefaultAsync(b => b.Id == id, ct);
    }

    public async Task AddAsync(BankImport bankImport, CancellationToken ct = default)
    {
        await _context.BankImports.AddAsync(bankImport, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(BankImport bankImport, CancellationToken ct = default)
    {
        _context.BankImports.Update(bankImport);
        await _context.SaveChangesAsync(ct);
    }
}

/// <summary>
/// REQ-042: Dunning notice repository implementation
/// </summary>
public sealed class DunningNoticeRepository : IDunningNoticeRepository
{
    private readonly ApplicationDbContext _context;

    public DunningNoticeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<DunningNotice>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.DunningNotices
            .AsNoTracking()
            .Include(d => d.Invoice)
            .OrderByDescending(d => d.Date)
            .ToListAsync(ct);
    }

    public async Task<DunningNotice?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.DunningNotices
            .Include(d => d.Invoice)
            .FirstOrDefaultAsync(d => d.Id == id, ct);
    }

    public async Task<List<DunningNotice>> GetByInvoiceIdAsync(Guid invoiceId, CancellationToken ct = default)
    {
        return await _context.DunningNotices
            .AsNoTracking()
            .Include(d => d.Invoice)
            .Where(d => d.InvoiceId == invoiceId)
            .OrderByDescending(d => d.Date)
            .ToListAsync(ct);
    }

    public async Task AddAsync(DunningNotice notice, CancellationToken ct = default)
    {
        await _context.DunningNotices.AddAsync(notice, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(DunningNotice notice, CancellationToken ct = default)
    {
        _context.DunningNotices.Update(notice);
        await _context.SaveChangesAsync(ct);
    }
}

/// <summary>
/// REQ-043: Receipt repository implementation
/// </summary>
public sealed class ReceiptRepository : IReceiptRepository
{
    private readonly ApplicationDbContext _context;

    public ReceiptRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Receipt>> GetAllAsync(bool includeArchived = false, CancellationToken ct = default)
    {
        var query = _context.Receipts
            .AsNoTracking()
            .AsQueryable();

        if (!includeArchived)
            query = query.Where(r => !r.IsArchived);

        return await query
            .OrderByDescending(r => r.UploadedAt)
            .ToListAsync(ct);
    }

    public async Task<Receipt?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Receipts
            .FirstOrDefaultAsync(r => r.Id == id, ct);
    }

    public async Task AddAsync(Receipt receipt, CancellationToken ct = default)
    {
        await _context.Receipts.AddAsync(receipt, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Receipt receipt, CancellationToken ct = default)
    {
        _context.Receipts.Update(receipt);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var receipt = await _context.Receipts.FindAsync([id], ct);
        if (receipt is not null)
        {
            receipt.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }

    public async Task<List<Receipt>> GetArchivedAsync(CancellationToken ct = default)
    {
        return await _context.Receipts
            .AsNoTracking()
            .Where(r => r.IsArchived)
            .OrderByDescending(r => r.ArchivedAt)
            .ToListAsync(ct);
    }

    public async Task<List<Receipt>> GetExpiredArchivedAsync(DateTimeOffset asOf, CancellationToken ct = default)
    {
        return await _context.Receipts
            .Where(r => r.IsArchived && r.RetainUntil <= asOf)
            .ToListAsync(ct);
    }

    public async Task RemoveAsync(Receipt receipt, CancellationToken ct = default)
    {
        _context.Receipts.Remove(receipt);
        await _context.SaveChangesAsync(ct);
    }
}

/// <summary>
/// REQ-060: Finance profile repository implementation
/// </summary>
public sealed class FinanceProfileRepository : IFinanceProfileRepository
{
    private readonly ApplicationDbContext _context;

    public FinanceProfileRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<FinanceProfile?> GetActiveProfileAsync(CancellationToken ct = default)
    {
        return await _context.FinanceProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(fp => fp.IsActive, ct);
    }

    public async Task<FinanceProfile?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.FinanceProfiles
            .FirstOrDefaultAsync(fp => fp.Id == id, ct);
    }

    public async Task AddAsync(FinanceProfile profile, CancellationToken ct = default)
    {
        await _context.FinanceProfiles.AddAsync(profile, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(FinanceProfile profile, CancellationToken ct = default)
    {
        _context.FinanceProfiles.Update(profile);
        await _context.SaveChangesAsync(ct);
    }
}

/// <summary>
/// REQ-062: Tax code repository implementation
/// </summary>
public sealed class TaxCodeRepository : ITaxCodeRepository
{
    private readonly ApplicationDbContext _context;

    public TaxCodeRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<TaxCode>> GetAllActiveAsync(CancellationToken ct = default)
    {
        return await _context.TaxCodes
            .AsNoTracking()
            .Where(tc => tc.IsActive)
            .OrderBy(tc => tc.Code)
            .ToListAsync(ct);
    }

    public async Task<TaxCode?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.TaxCodes
            .FirstOrDefaultAsync(tc => tc.Id == id, ct);
    }

    public async Task<TaxCode?> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        return await _context.TaxCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(tc => tc.Code == code, ct);
    }

    public async Task AddAsync(TaxCode taxCode, CancellationToken ct = default)
    {
        await _context.TaxCodes.AddAsync(taxCode, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(TaxCode taxCode, CancellationToken ct = default)
    {
        _context.TaxCodes.Update(taxCode);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var taxCode = await _context.TaxCodes.FindAsync([id], ct);
        if (taxCode is not null)
        {
            taxCode.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-066: Fiscal period repository implementation
/// </summary>
public sealed class FiscalPeriodRepository : IFiscalPeriodRepository
{
    private readonly ApplicationDbContext _context;

    public FiscalPeriodRepository(ApplicationDbContext context) => _context = context;

    public async Task<List<FiscalPeriod>> GetAllAsync(int? year = null, CancellationToken ct = default)
    {
        var query = _context.FiscalPeriods.AsQueryable();
        if (year.HasValue)
            query = query.Where(p => p.Year == year.Value);
        return await query.OrderBy(p => p.Year).ThenBy(p => p.Month).ToListAsync(ct);
    }

    public async Task<FiscalPeriod?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _context.FiscalPeriods.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<FiscalPeriod?> GetByYearAndMonthAsync(int year, int month, CancellationToken ct = default)
        => await _context.FiscalPeriods.FirstOrDefaultAsync(p => p.Year == year && p.Month == month, ct);

    public async Task<FiscalPeriod?> GetByDateAsync(DateTime date, CancellationToken ct = default)
    {
        var utcDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        return await _context.FiscalPeriods
            .FirstOrDefaultAsync(p => utcDate >= p.StartDate && utcDate <= p.EndDate, ct);
    }

    public async Task AddAsync(FiscalPeriod period, CancellationToken ct = default)
        => await _context.FiscalPeriods.AddAsync(period, ct);

    public async Task AddRangeAsync(IEnumerable<FiscalPeriod> periods, CancellationToken ct = default)
        => await _context.FiscalPeriods.AddRangeAsync(periods, ct);

    public Task UpdateAsync(FiscalPeriod period, CancellationToken ct = default)
    {
        _context.FiscalPeriods.Update(period);
        return Task.CompletedTask;
    }
}

/// <summary>
/// REQ-067: Expense claim repository implementation
/// </summary>
public sealed class ExpenseClaimRepository : IExpenseClaimRepository
{
    private readonly ApplicationDbContext _context;

    public ExpenseClaimRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ExpenseClaim>> GetAllAsync(ExpenseClaimStatus? status = null, Guid? claimantId = null, CancellationToken ct = default)
    {
        var query = _context.ExpenseClaims
            .AsNoTracking()
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(e => e.Status == status.Value);

        if (claimantId.HasValue)
            query = query.Where(e => e.ClaimantId == claimantId.Value);

        return await query
            .OrderByDescending(e => e.Date)
            .ToListAsync(ct);
    }

    public async Task<ExpenseClaim?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.ExpenseClaims
            .FirstOrDefaultAsync(e => e.Id == id, ct);
    }

    public async Task AddAsync(ExpenseClaim claim, CancellationToken ct = default)
    {
        await _context.ExpenseClaims.AddAsync(claim, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ExpenseClaim claim, CancellationToken ct = default)
    {
        _context.ExpenseClaims.Update(claim);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var claim = await _context.ExpenseClaims.FindAsync([id], ct);
        if (claim is not null)
        {
            claim.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-064: Invoice template repository implementation
/// </summary>
public sealed class InvoiceTemplateRepository : IInvoiceTemplateRepository
{
    private readonly ApplicationDbContext _context;

    public InvoiceTemplateRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<InvoiceTemplate>> GetAllAsync(Jurisdiction? jurisdiction = null, CancellationToken ct = default)
    {
        var query = _context.InvoiceTemplates
            .AsNoTracking()
            .AsQueryable();

        if (jurisdiction.HasValue)
            query = query.Where(t => t.Jurisdiction == jurisdiction.Value);

        return await query
            .OrderBy(t => t.Name)
            .ToListAsync(ct);
    }

    public async Task<InvoiceTemplate?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.InvoiceTemplates
            .FirstOrDefaultAsync(t => t.Id == id, ct);
    }

    public async Task<InvoiceTemplate?> GetDefaultForJurisdictionAsync(Jurisdiction jurisdiction, CancellationToken ct = default)
    {
        return await _context.InvoiceTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Jurisdiction == jurisdiction && t.IsDefault, ct);
    }

    public async Task AddAsync(InvoiceTemplate template, CancellationToken ct = default)
    {
        await _context.InvoiceTemplates.AddAsync(template, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(InvoiceTemplate template, CancellationToken ct = default)
    {
        _context.InvoiceTemplates.Update(template);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _context.InvoiceTemplates.FindAsync([id], ct);
        if (template is not null)
        {
            template.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-068: Activity area repository implementation
/// </summary>
public sealed class ActivityAreaRepository : IActivityAreaRepository
{
    private readonly ApplicationDbContext _context;

    public ActivityAreaRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ActivityArea>> GetAllActiveAsync(CancellationToken ct = default)
    {
        return await _context.ActivityAreas
            .AsNoTracking()
            .Where(a => a.IsActive)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);
    }

    public async Task<ActivityArea?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.ActivityAreas
            .FirstOrDefaultAsync(a => a.Id == id, ct);
    }

    public async Task<ActivityArea?> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        return await _context.ActivityAreas
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Code == code, ct);
    }

    public async Task AddAsync(ActivityArea area, CancellationToken ct = default)
    {
        await _context.ActivityAreas.AddAsync(area, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(ActivityArea area, CancellationToken ct = default)
    {
        _context.ActivityAreas.Update(area);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var area = await _context.ActivityAreas.FindAsync([id], ct);
        if (area is not null)
        {
            area.SoftDelete();
            await _context.SaveChangesAsync(ct);
        }
    }
}

// ─── Double-Entry Bookkeeping (REQ-074..085) ───

/// <summary>
/// REQ-075: Ledger account (chart of accounts) repository implementation
/// </summary>
public sealed class LedgerAccountRepository : ILedgerAccountRepository
{
    private readonly ApplicationDbContext _context;

    public LedgerAccountRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<LedgerAccount>> GetAllByProfileAsync(Guid financeProfileId, CancellationToken ct = default)
    {
        return await _context.LedgerAccounts
            .AsNoTracking()
            .Where(la => la.FinanceProfileId == financeProfileId)
            .OrderBy(la => la.SortOrder)
            .ThenBy(la => la.Number)
            .ToListAsync(ct);
    }

    public async Task<LedgerAccount?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.LedgerAccounts
            .FirstOrDefaultAsync(la => la.Id == id, ct);
    }

    public async Task<LedgerAccount?> GetByNumberAsync(Guid financeProfileId, string number, CancellationToken ct = default)
    {
        return await _context.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(la => la.FinanceProfileId == financeProfileId && la.Number == number, ct);
    }

    public async Task<List<LedgerAccount>> GetByClassAsync(Guid financeProfileId, LedgerAccountClass accountClass, CancellationToken ct = default)
    {
        return await _context.LedgerAccounts
            .AsNoTracking()
            .Where(la => la.FinanceProfileId == financeProfileId && la.AccountClass == accountClass)
            .OrderBy(la => la.SortOrder)
            .ThenBy(la => la.Number)
            .ToListAsync(ct);
    }

    public async Task AddAsync(LedgerAccount account, CancellationToken ct = default)
    {
        await _context.LedgerAccounts.AddAsync(account, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(LedgerAccount account, CancellationToken ct = default)
    {
        _context.LedgerAccounts.Update(account);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, string deletedBy, CancellationToken ct = default)
    {
        var account = await _context.LedgerAccounts.FindAsync([id], ct);
        if (account is not null)
        {
            account.SoftDelete(deletedBy);
            await _context.SaveChangesAsync(ct);
        }
    }
}

/// <summary>
/// REQ-076: Journal entry repository implementation
/// </summary>
public sealed class JournalEntryRepository : IJournalEntryRepository
{
    private readonly ApplicationDbContext _context;

    public JournalEntryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Npgsql requires DateTimeKind.Utc for 'timestamp with time zone' columns.
    /// Query-string dates arrive as Kind=Unspecified; normalise them here.
    /// </summary>
    private static DateTime? ToUtc(DateTime? dt) =>
        dt.HasValue ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc) : null;

    public async Task<List<JournalEntry>> GetAllAsync(Guid financeProfileId, DateTime? from = null, DateTime? to = null, JournalEntryStatus? status = null, CancellationToken ct = default)
    {
        var utcFrom = ToUtc(from);
        var utcTo = ToUtc(to);

        var query = _context.JournalEntries
            .AsNoTracking()
            .Include(je => je.Lines)
            .Where(je => je.FinanceProfileId == financeProfileId);

        if (utcFrom.HasValue)
            query = query.Where(je => je.Date >= utcFrom.Value);
        if (utcTo.HasValue)
            query = query.Where(je => je.Date <= utcTo.Value);
        if (status.HasValue)
            query = query.Where(je => je.Status == status.Value);

        return await query
            .OrderByDescending(je => je.Date)
            .ThenByDescending(je => je.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<JournalEntry?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.JournalEntries
            .FirstOrDefaultAsync(je => je.Id == id, ct);
    }

    public async Task<JournalEntry?> GetByIdWithLinesAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.JournalEntries
            .Include(je => je.Lines)
                .ThenInclude(l => l.LedgerAccount)
            .Include(je => je.Lines)
                .ThenInclude(l => l.TaxCode)
            .Include(je => je.Lines)
                .ThenInclude(l => l.ActivityArea)
            .FirstOrDefaultAsync(je => je.Id == id, ct);
    }

    public async Task<List<JournalEntry>> GetBySourceAsync(string sourceType, Guid sourceId, CancellationToken ct = default)
    {
        return await _context.JournalEntries
            .AsNoTracking()
            .Include(je => je.Lines)
            .Where(je => je.SourceType == sourceType && je.SourceId == sourceId)
            .OrderByDescending(je => je.Date)
            .ToListAsync(ct);
    }

    public async Task<List<JournalEntry>> GetByLedgerAccountAsync(Guid ledgerAccountId, DateTime? from = null, DateTime? to = null, CancellationToken ct = default)
    {
        var utcFrom = ToUtc(from);
        var utcTo = ToUtc(to);

        var query = _context.JournalEntries
            .AsNoTracking()
            .Include(je => je.Lines)
            .Where(je => je.Lines.Any(l => l.LedgerAccountId == ledgerAccountId));

        if (utcFrom.HasValue)
            query = query.Where(je => je.Date >= utcFrom.Value);
        if (utcTo.HasValue)
            query = query.Where(je => je.Date <= utcTo.Value);

        return await query
            .OrderByDescending(je => je.Date)
            .ToListAsync(ct);
    }

    public async Task<List<JournalEntry>> GetByFiscalPeriodAsync(Guid fiscalPeriodId, CancellationToken ct = default)
    {
        return await _context.JournalEntries
            .AsNoTracking()
            .Include(je => je.Lines)
            .Where(je => je.FiscalPeriodId == fiscalPeriodId)
            .OrderByDescending(je => je.Date)
            .ToListAsync(ct);
    }

    public async Task AddAsync(JournalEntry entry, CancellationToken ct = default)
    {
        await _context.JournalEntries.AddAsync(entry, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(JournalEntry entry, CancellationToken ct = default)
    {
        // Explicitly remove lines that are no longer in the collection
        // (EF orphan detection can be unreliable with private backing fields).
        var existingLines = await _context.JournalEntryLines
            .Where(l => l.JournalEntryId == entry.Id)
            .ToListAsync(ct);

        var currentLineIds = entry.Lines.Select(l => l.Id).ToHashSet();
        var linesToRemove = existingLines.Where(l => !currentLineIds.Contains(l.Id)).ToList();
        if (linesToRemove.Count > 0)
            _context.JournalEntryLines.RemoveRange(linesToRemove);

        _context.JournalEntries.Update(entry);
        await _context.SaveChangesAsync(ct);
    }
}

/// <summary>
/// REQ-077/082: Posting mapping repository implementation
/// </summary>
public sealed class PostingMappingRepository : IPostingMappingRepository
{
    private readonly ApplicationDbContext _context;

    public PostingMappingRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<PostingMapping>> GetAllByProfileAsync(Guid financeProfileId, CancellationToken ct = default)
    {
        return await _context.PostingMappings
            .AsNoTracking()
            .Include(pm => pm.LedgerAccount)
            .Include(pm => pm.TaxLedgerAccount)
            .Where(pm => pm.FinanceProfileId == financeProfileId)
            .OrderBy(pm => pm.MappingType)
            .ToListAsync(ct);
    }

    public async Task<PostingMapping?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.PostingMappings
            .Include(pm => pm.LedgerAccount)
            .Include(pm => pm.TaxLedgerAccount)
            .FirstOrDefaultAsync(pm => pm.Id == id, ct);
    }

    public async Task<PostingMapping?> GetBySourceAsync(Guid financeProfileId, PostingMappingType mappingType, Guid sourceId, CancellationToken ct = default)
    {
        return await _context.PostingMappings
            .AsNoTracking()
            .Include(pm => pm.LedgerAccount)
            .Include(pm => pm.TaxLedgerAccount)
            .FirstOrDefaultAsync(pm =>
                pm.FinanceProfileId == financeProfileId &&
                pm.MappingType == mappingType &&
                pm.SourceId == sourceId, ct);
    }

    public async Task AddAsync(PostingMapping mapping, CancellationToken ct = default)
    {
        await _context.PostingMappings.AddAsync(mapping, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(PostingMapping mapping, CancellationToken ct = default)
    {
        _context.PostingMappings.Update(mapping);
        await _context.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var mapping = await _context.PostingMappings.FindAsync([id], ct);
        if (mapping is not null)
        {
            _context.PostingMappings.Remove(mapping);
            await _context.SaveChangesAsync(ct);
        }
    }
}
