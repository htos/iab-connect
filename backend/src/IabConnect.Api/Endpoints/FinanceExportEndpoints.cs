using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for finance CSV exports (REQ-044)
/// </summary>
public static class FinanceExportEndpoints
{
    public static void MapFinanceExportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/exports")
            .WithTags("Finance - Exports");

        group.MapGet("/journal", ExportJournal)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ExportJournal")
            .WithSummary("Export transaction journal as CSV")
            .WithDescription("REQ-044: Exports all transactions in a date range as CSV. Audited.");

        group.MapGet("/open-items", ExportOpenItems)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ExportOpenItems")
            .WithSummary("Export open invoices as CSV")
            .WithDescription("REQ-044: Exports all open invoices (Sent/Overdue) as CSV. Audited.");
    }

    private static async Task<IResult> ExportJournal(
        ITransactionRepository repository,
        IAuditService auditService,
        DateTime? from, DateTime? to,
        CancellationToken ct)
    {
        var transactions = await repository.GetAllAsync(from, to, ct: ct);

        var sb = new StringBuilder();
        sb.AppendLine("Date;Description;Amount;Type;AccountId;CategoryId;Reference;Notes");

        foreach (var t in transactions)
        {
            sb.AppendLine(string.Join(";",
                t.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                EscapeCsv(t.Description),
                t.Amount.ToString("F2", CultureInfo.InvariantCulture),
                t.Type.ToString(),
                t.AccountId,
                t.CategoryId?.ToString() ?? "",
                EscapeCsv(t.Reference),
                EscapeCsv(t.Notes)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"journal_{(from?.ToString("yyyyMMdd") ?? "all")}_{(to?.ToString("yyyyMMdd") ?? "now")}.csv";

        await auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"Transaction journal exported ({transactions.Count} records)",
            entityType: "Transaction",
            details: $"from={from?.ToString("yyyy-MM-dd")}, to={to?.ToString("yyyy-MM-dd")}",
            ct: ct);

        return Results.File(bytes, "text/csv", fileName);
    }

    private static async Task<IResult> ExportOpenItems(
        IInvoiceRepository repository,
        IAuditService auditService,
        CancellationToken ct)
    {
        var invoices = await repository.GetOpenItemsAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("InvoiceNumber;Date;DueDate;Status;RecipientName;Total");

        foreach (var inv in invoices)
        {
            sb.AppendLine(string.Join(";",
                EscapeCsv(inv.InvoiceNumber),
                inv.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                inv.DueDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                inv.Status.ToString(),
                EscapeCsv(inv.RecipientName),
                inv.Total.ToString("F2", CultureInfo.InvariantCulture)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());

        await auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"Open items exported ({invoices.Count} invoices)",
            entityType: "Invoice",
            ct: ct);

        return Results.File(bytes, "text/csv", "open_items.csv");
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
