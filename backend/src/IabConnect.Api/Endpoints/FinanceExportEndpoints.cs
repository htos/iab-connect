using IabConnect.Application.Finance.Exports.Queries;
using MediatR;

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

        group.MapGet("/vat-summary", ExportVatSummary)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ExportVatSummary")
            .WithSummary("Export VAT summary as CSV")
            .WithDescription("REQ-062: Exports VAT summary grouped by tax code for a date range. Audited.");
    }

    private static async Task<IResult> ExportJournal(
        ISender sender, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var result = await sender.Send(new ExportJournalQuery(from, to), ct);
        return Results.File(result.Content, result.ContentType, result.FileName);
    }

    private static async Task<IResult> ExportOpenItems(ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new ExportOpenItemsQuery(), ct);
        return Results.File(result.Content, result.ContentType, result.FileName);
    }

    private static async Task<IResult> ExportVatSummary(
        ISender sender, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var result = await sender.Send(new ExportVatSummaryQuery(from, to), ct);
        return Results.File(result.Content, result.ContentType, result.FileName);
    }
}
