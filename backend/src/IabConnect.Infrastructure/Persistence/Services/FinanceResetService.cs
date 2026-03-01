using IabConnect.Application.Finance;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Services;

/// <summary>
/// Service to reset (delete) ALL finance data using TRUNCATE CASCADE.
/// Admin-only, destructive operation.
/// </summary>
public sealed class FinanceResetService : IFinanceResetService
{
    private readonly ApplicationDbContext _context;

    public FinanceResetService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> ResetAllFinanceDataAsync(CancellationToken ct = default)
    {
        // All finance-related tables in the system.
        // TRUNCATE CASCADE handles FK dependencies automatically.
        var financeTables = new[]
        {
            // Child tables first (though CASCADE handles it)
            "journal_entry_lines",
            "journal_entries",
            "posting_mappings",
            "ledger_accounts",
            "invoice_items",
            "invoices",
            "invoice_number_counters",
            "invoice_templates",
            "payments",
            "bank_import_items",
            "bank_imports",
            "dunning_notices",
            "receipts",
            "expense_claims",
            "transactions",
            "categories",
            "accounts",
            "tax_codes",
            "fiscal_periods",
            "activity_areas",
            "finance_profiles",
        };

        var tableList = string.Join(", ", financeTables);
        var sql = "TRUNCATE TABLE " + tableList + " CASCADE;";
        await _context.Database.ExecuteSqlRawAsync(sql, ct);

        return financeTables.Length;
    }
}
