using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Archive.Commands;
using IabConnect.Application.Finance.Archive.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-070: API endpoints for archive/retention management (Swiss OR Art. 958f).
/// </summary>
public static class ArchiveEndpoints
{
    public static void MapArchiveEndpoints(this IEndpointRouteBuilder routes)
    {
        var receipts = routes.MapGroup("/api/v1/finance/receipts")
            .WithTags("Finance - Receipts")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        receipts.MapPost("/{id:guid}/archive", ArchiveReceipt)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("ArchiveReceipt")
            .WithSummary("Archive a receipt")
            .WithDescription("REQ-070: Archives a receipt with 10-year retention. Archived items become read-only.");

        receipts.MapPost("/{id:guid}/restore", RestoreReceipt)
            .RequireAuthorization("RequireAdmin")
            .WithName("RestoreReceipt")
            .WithSummary("Restore a receipt from archive")
            .WithDescription("REQ-070: Restores a receipt from archive (Admin only).");

        var invoices = routes.MapGroup("/api/v1/finance/invoices")
            .WithTags("Finance - Invoices")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        invoices.MapPost("/{id:guid}/archive", ArchiveInvoice)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("ArchiveInvoice")
            .WithSummary("Archive an invoice")
            .WithDescription("REQ-070: Archives an invoice with 10-year retention. Archived items become read-only.");

        invoices.MapPost("/{id:guid}/restore", RestoreInvoice)
            .RequireAuthorization("RequireAdmin")
            .WithName("RestoreInvoice")
            .WithSummary("Restore an invoice from archive")
            .WithDescription("REQ-070: Restores an invoice from archive (Admin only).");

        var admin = routes.MapGroup("/api/v1/admin/finance")
            .WithTags("Finance - Admin")
            // REQ-087 (E10-S3, Q3): admin/finance archive tooling is finance data — module-gated.
            .RequireAuthorization("Module:finance");

        admin.MapPost("/purge-archived", PurgeArchived)
            .RequireAuthorization("RequireAdmin")
            .WithName("PurgeArchivedReceipts")
            .WithSummary("Purge expired archived receipts")
            .WithDescription("REQ-070: Physically deletes archived receipts past their retention period (Admin only).");

        admin.MapGet("/archived", GetArchivedItems)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetArchivedItems")
            .WithSummary("List all archived items")
            .WithDescription("REQ-070: Returns all archived items across receipts, invoices, and transactions.");
    }

    private static async Task<IResult> ArchiveReceipt(
        Guid id, ArchiveRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(
            new ArchiveReceiptCommand(id, request.Reason, httpContext.GetUserName()), ct);
        return found
            ? Results.Ok(new { Message = "Receipt archived successfully." })
            : Results.NotFound(new { Message = "Receipt not found." });
    }

    private static async Task<IResult> RestoreReceipt(
        Guid id, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(
            new RestoreReceiptCommand(id, httpContext.GetUserName()), ct);
        return found
            ? Results.Ok(new { Message = "Receipt restored from archive." })
            : Results.NotFound(new { Message = "Receipt not found." });
    }

    private static async Task<IResult> ArchiveInvoice(
        Guid id, ArchiveRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(
            new ArchiveInvoiceCommand(id, request.Reason, httpContext.GetUserName()), ct);
        return found
            ? Results.Ok(new { Message = "Invoice archived successfully." })
            : Results.NotFound(new { Message = "Invoice not found." });
    }

    private static async Task<IResult> RestoreInvoice(
        Guid id, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(
            new RestoreInvoiceCommand(id, httpContext.GetUserName()), ct);
        return found
            ? Results.Ok(new { Message = "Invoice restored from archive." })
            : Results.NotFound(new { Message = "Invoice not found." });
    }

    private static async Task<IResult> PurgeArchived(
        ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var count = await sender.Send(
            new PurgeArchivedReceiptsCommand(httpContext.GetUserName()), ct);
        return Results.Ok(new { Message = $"{count} expired archived receipt(s) purged.", Count = count });
    }

    private static async Task<IResult> GetArchivedItems(
        ISender sender, CancellationToken ct)
    {
        var items = await sender.Send(new GetArchivedItemsQuery(), ct);
        return Results.Ok(items);
    }
}

/// <summary>
/// Request body for archive operations.
/// </summary>
public sealed record ArchiveRequest(string Reason);
