using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;

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

    public async Task<List<Transaction>> GetAllAsync(DateTime? from = null, DateTime? to = null, TransactionType? type = null, CancellationToken ct = default)
    {
        var query = _context.Transactions
            .AsNoTracking()
            .Include(t => t.Account)
            .Include(t => t.Category)
            .AsQueryable();

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

    public async Task<List<Invoice>> GetAllAsync(InvoiceStatus? status = null, CancellationToken ct = default)
    {
        var query = _context.Invoices
            .AsNoTracking()
            .Include(i => i.Items)
            .AsQueryable();

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

        var lastNumber = await _context.Invoices
            .AsNoTracking()
            .IgnoreQueryFilters()
            .Where(i => i.InvoiceNumber.StartsWith(prefix))
            .OrderByDescending(i => i.InvoiceNumber)
            .Select(i => i.InvoiceNumber)
            .FirstOrDefaultAsync(ct);

        var nextSequence = 1;

        if (lastNumber is not null)
        {
            var numericPart = lastNumber[prefix.Length..];
            if (int.TryParse(numericPart, out var parsed))
                nextSequence = parsed + 1;
        }

        return $"{prefix}{nextSequence:D4}";
    }

    public async Task<Invoice?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Invoices
            .IgnoreQueryFilters()
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == id, ct);
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

    public async Task<List<Receipt>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.Receipts
            .AsNoTracking()
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
            _context.InvoiceTemplates.Remove(template);
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
