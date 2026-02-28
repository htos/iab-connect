using System.Security.Claims;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.EInvoice;
using IabConnect.Application.Finance.Invoices.Commands;
using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;
using Microsoft.Extensions.Configuration;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for invoice management (REQ-039, REQ-062)
/// </summary>
public static class InvoiceEndpoints
{
    public static void MapInvoiceEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/invoices")
            .WithTags("Finance - Invoices");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetInvoices")
            .WithSummary("List invoices with optional status filter")
            .WithDescription("REQ-039: Returns invoices filtered by status.");

        group.MapGet("/open", GetOpenItems)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetOpenInvoices")
            .WithSummary("List open invoices (Sent/Overdue)")
            .WithDescription("REQ-039: Returns invoices with status Sent or Overdue.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetInvoiceById")
            .WithSummary("Get invoice by ID with items")
            .WithDescription("REQ-039: Returns a single invoice with its line items.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateInvoice")
            .WithSummary("Create an invoice with items")
            .WithDescription("REQ-039: Creates a new invoice with line items. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateInvoice")
            .WithSummary("Update a draft invoice")
            .WithDescription("REQ-039: Updates a draft invoice. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteInvoice")
            .WithSummary("Delete an invoice")
            .WithDescription("REQ-039: Deletes an invoice. Audited.");

        group.MapPost("/{id:guid}/send", MarkAsSent)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("SendInvoice")
            .WithSummary("Mark invoice as sent")
            .WithDescription("REQ-039: Marks a draft invoice as sent. Audited.");

        group.MapPost("/{id:guid}/cancel", CancelInvoice)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CancelInvoice")
            .WithSummary("Cancel (storno) an invoice")
            .WithDescription("REQ-039: Cancels a sent/overdue invoice with storno reversal transaction. Audited.");

        group.MapPost("/{id:guid}/mark-overdue", MarkAsOverdue)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("MarkInvoiceAsOverdue")
            .WithSummary("Mark invoice as overdue")
            .WithDescription("REQ-039: Marks a sent invoice as overdue when due date has passed. Audited.");

        group.MapGet("/{id:guid}/pdf", DownloadPdf)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("DownloadInvoicePdf")
            .WithSummary("Download invoice as PDF")
            .WithDescription("REQ-039: Generates and returns a PDF for a non-draft invoice.")
            .Produces(200, contentType: "application/pdf")
            .ProducesProblem(400)
            .ProducesProblem(404);

        group.MapGet("/{id:guid}/einvoice", DownloadEInvoice)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("DownloadEInvoice")
            .WithSummary("Download invoice as eInvoice XML (EN 16931)")
            .WithDescription("REQ-065: Generates and returns an EN 16931 compliant UBL XML document. Feature-flagged.")
            .Produces(200, contentType: "application/xml")
            .ProducesProblem(400)
            .ProducesProblem(404);

        group.MapPost("/{id:guid}/validate-einvoice", ValidateEInvoice)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("ValidateEInvoice")
            .WithSummary("Validate invoice eInvoice XML (EN 16931)")
            .WithDescription("REQ-072: Generates UBL XML and validates against EN 16931 business rules. Returns validation result.")
            .Produces<EInvoiceValidationResult>(200)
            .ProducesProblem(400)
            .ProducesProblem(404);
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        ISender sender, string? status, int? page, int? pageSize, string? sort, string? filter,
        CancellationToken ct)
    {
        var invoices = await sender.Send(new GetInvoicesQuery(status)
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(invoices);
    }

    private static async Task<IResult> GetOpenItems(ISender sender, CancellationToken ct)
    {
        var invoices = await sender.Send(new GetOpenInvoicesQuery(), ct);
        return Results.Ok(invoices);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetInvoiceByIdQuery(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Create(
        CreateInvoiceRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateInvoiceCommand
        {
            Date = request.Date,
            DueDate = request.DueDate,
            RecipientType = request.RecipientType,
            RecipientId = request.RecipientId,
            RecipientName = request.RecipientName,
            RecipientAddress = request.RecipientAddress,
            TaxRate = request.TaxRate,
            Notes = request.Notes,
            PaymentTerms = request.PaymentTerms,
            TemplateId = request.TemplateId,
            Items = request.Items.Select(i => new CreateInvoiceItemInput(
                i.Description, i.Quantity, i.UnitPrice, i.TaxCodeId, i.IsGrossEntry, i.ActivityAreaId)).ToList(),
            UserName = GetUserName(httpContext)
        }, ct);
        return Results.Created($"/api/v1/finance/invoices/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateInvoiceRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateInvoiceCommand
        {
            Id = id,
            Date = request.Date,
            DueDate = request.DueDate,
            RecipientType = request.RecipientType,
            RecipientId = request.RecipientId,
            RecipientName = request.RecipientName,
            RecipientAddress = request.RecipientAddress,
            TaxRate = request.TaxRate,
            Notes = request.Notes,
            PaymentTerms = request.PaymentTerms,
            TemplateId = request.TemplateId,
            Items = request.Items.Select(i => new CreateInvoiceItemInput(
                i.Description, i.Quantity, i.UnitPrice, i.TaxCodeId, i.IsGrossEntry, i.ActivityAreaId)).ToList(),
            UserName = GetUserName(httpContext)
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteInvoiceCommand(id, GetUserName(httpContext)), ct);
        if (!result.IsSuccess)
            return Results.BadRequest(new { Message = result.Error });
        return Results.NoContent();
    }

    private static async Task<IResult> MarkAsSent(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new SendInvoiceCommand(id, GetUserName(httpContext)), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> CancelInvoice(
        Guid id, CancelInvoiceRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var result = await sender.Send(new CancelInvoiceCommand
        {
            Id = id,
            Reason = request.Reason,
            AccountId = request.AccountId,
            UserName = GetUserName(httpContext)
        }, ct);
        if (!result.IsSuccess)
            return Results.BadRequest(new { Message = result.Error });
        return Results.Ok(result.Value);
    }

    private static async Task<IResult> MarkAsOverdue(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        try
        {
            var dto = await sender.Send(new MarkInvoiceAsOverdueCommand(id, GetUserName(httpContext)), ct);
            return dto is null
                ? Results.NotFound(new { Message = "Invoice not found." })
                : Results.Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Message = ex.Message });
        }
    }

    private static async Task<IResult> DownloadPdf(Guid id, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new GenerateInvoicePdfQuery(id), ct);
        if (result is null)
            return Results.NotFound(new { Message = "Invoice not found or is in draft status." });
        return Results.File(result.PdfBytes, contentType: "application/pdf", fileDownloadName: result.FileName);
    }

    private static async Task<IResult> DownloadEInvoice(Guid id, ISender sender, IConfiguration configuration, string? format, CancellationToken ct)
    {
        // REQ-065: Feature flag check
        var featureEnabled = configuration.GetValue<bool>("Features:EInvoiceExport");
        if (!featureEnabled)
            return Results.BadRequest(new { Message = "eInvoice export is not enabled. Set Features:EInvoiceExport to true in configuration." });

        var result = await sender.Send(new GenerateEInvoiceQuery(id, format ?? "UBL"), ct);
        if (result is null)
            return Results.NotFound(new { Message = "Invoice not found or is in draft status." });
        return Results.File(result.XmlBytes, contentType: result.ContentType, fileDownloadName: result.FileName);
    }

    private static async Task<IResult> ValidateEInvoice(Guid id, ISender sender, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new ValidateEInvoiceQuery(id), ct);
            if (result is null)
                return Results.NotFound(new { Message = "Invoice not found." });
            return Results.Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Message = ex.Message });
        }
    }

    // DTOs
    public sealed record CreateInvoiceRequest(DateTime Date, DateTime DueDate,
        string RecipientType, Guid? RecipientId, string RecipientName,
        string? RecipientAddress, decimal TaxRate, string? Notes,
        string? PaymentTerms, Guid? TemplateId,
        List<CreateInvoiceItemRequest> Items);
    public sealed record CreateInvoiceItemRequest(string Description, decimal Quantity, decimal UnitPrice,
        Guid? TaxCodeId = null, bool IsGrossEntry = false, Guid? ActivityAreaId = null);
    public sealed record UpdateInvoiceRequest(DateTime Date, DateTime DueDate,
        string RecipientType, Guid? RecipientId, string RecipientName,
        string? RecipientAddress, decimal TaxRate, string? Notes,
        string? PaymentTerms, Guid? TemplateId,
        List<CreateInvoiceItemRequest> Items);
    public sealed record CancelInvoiceRequest(string Reason, Guid AccountId);
}
