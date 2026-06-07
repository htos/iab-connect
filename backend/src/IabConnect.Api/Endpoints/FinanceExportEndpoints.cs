using IabConnect.Application.Finance.Exports.Pain001;
using IabConnect.Application.Finance.Exports.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for finance exports (REQ-044, REQ-073)
/// </summary>
public static class FinanceExportEndpoints
{
    public static void MapFinanceExportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/exports")
            .WithTags("Finance - Exports")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

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

        // REQ-044 (E6-S3): budget-vs-actual (Soll/Ist) report export
        group.MapGet("/budget-vs-actual", ExportBudgetVsActual)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ExportBudgetVsActual")
            .WithSummary("Export budget-vs-actual report as CSV")
            .WithDescription("REQ-044: Exports the Soll/Ist report for a fiscal period as CSV. Audited.");

        // REQ-073: pain.001 ISO 20022 payment export
        group.MapPost("/pain001", ExportPain001)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("ExportPain001")
            .WithSummary("Export approved payments as pain.001 XML")
            .WithDescription("REQ-073: Generates ISO 20022 pain.001.001.09 XML for credit transfer initiation. Supports CH SPS and SEPA.");

        group.MapPost("/pain001/validate", ValidatePain001)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ValidatePain001")
            .WithSummary("Validate payments for pain.001 export")
            .WithDescription("REQ-073: Validates payments and config for pain.001 export without generating XML.");
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

    private static async Task<IResult> ExportBudgetVsActual(
        ISender sender, Guid fiscalPeriodId, Guid? activityAreaId, CancellationToken ct)
    {
        var result = await sender.Send(
            new IabConnect.Application.Finance.Budgets.Queries.ExportBudgetVsActualQuery(fiscalPeriodId, activityAreaId), ct);
        return result is null
            ? Results.NotFound(new { Message = "Fiscal period not found." })
            : Results.File(result.Content, result.ContentType, result.FileName);
    }

    private static async Task<IResult> ExportPain001(
        ISender sender, ExportPain001Query query, CancellationToken ct)
    {
        var result = await sender.Send(query, ct);

        if (!result.Validation.IsValid)
        {
            return Results.BadRequest(result.Validation);
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(result.Xml);
        return Results.File(bytes, "application/xml", result.FileName);
    }

    private static async Task<IResult> ValidatePain001(
        ISender sender, ValidatePain001Query query, CancellationToken ct)
    {
        var result = await sender.Send(query, ct);
        return Results.Ok(result);
    }
}
