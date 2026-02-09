using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for invoice management (REQ-039)
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
    }

    private static async Task<IResult> GetAll(
        IInvoiceRepository repository,
        string? status,
        CancellationToken ct)
    {
        InvoiceStatus? invoiceStatus = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<InvoiceStatus>(status, true, out var parsed))
            invoiceStatus = parsed;

        var invoices = await repository.GetAllAsync(invoiceStatus, ct);
        var response = invoices.Select(MapToListResponse);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetOpenItems(
        IInvoiceRepository repository,
        CancellationToken ct)
    {
        var invoices = await repository.GetOpenItemsAsync(ct);
        var response = invoices.Select(MapToListResponse);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetById(
        Guid id,
        IInvoiceRepository repository,
        CancellationToken ct)
    {
        var invoice = await repository.GetByIdAsync(id, ct);
        if (invoice is null)
            return Results.NotFound(new { Message = "Invoice not found." });

        return Results.Ok(MapToDetailResponse(invoice));
    }

    private static async Task<IResult> Create(
        CreateInvoiceRequest request,
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<RecipientType>(request.RecipientType, true, out var recipientType))
            return Results.BadRequest(new { Message = $"Invalid recipient type '{request.RecipientType}'." });

        var invoiceNumber = await repository.GetNextInvoiceNumberAsync(ct);

        var invoice = Invoice.Create(
            invoiceNumber, request.Date, request.DueDate,
            recipientType, request.RecipientId, request.RecipientName,
            request.RecipientAddress, request.TaxRate, request.Notes,
            userName ?? "system");

        foreach (var item in request.Items)
        {
            invoice.AddItem(item.Description, item.Quantity, item.UnitPrice);
        }

        await repository.AddAsync(invoice, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Invoice '{invoice.InvoiceNumber}' created for {invoice.RecipientName} ({invoice.Total:N2})",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/invoices/{invoice.Id}", MapToDetailResponse(invoice));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateInvoiceRequest request,
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var invoice = await repository.GetByIdAsync(id, ct);
        if (invoice is null)
            return Results.NotFound(new { Message = "Invoice not found." });

        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<RecipientType>(request.RecipientType, true, out var recipientType))
            return Results.BadRequest(new { Message = $"Invalid recipient type '{request.RecipientType}'." });

        invoice.Update(
            request.Date, request.DueDate, recipientType,
            request.RecipientId, request.RecipientName,
            request.RecipientAddress, request.TaxRate, request.Notes,
            userName ?? "system");

        // Replace items
        var newItems = request.Items
            .Select(i => InvoiceItem.Create(invoice.Id, i.Description, i.Quantity, i.UnitPrice))
            .ToList();
        invoice.SetItems(newItems);

        await repository.UpdateAsync(invoice, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Invoice '{invoice.InvoiceNumber}' updated",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return Results.Ok(MapToDetailResponse(invoice));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var invoice = await repository.GetByIdAsync(id, ct);
        if (invoice is null)
            return Results.NotFound(new { Message = "Invoice not found." });

        var invoiceNumber = invoice.InvoiceNumber;
        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Invoice '{invoiceNumber}' deleted",
            entityType: "Invoice",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    private static async Task<IResult> MarkAsSent(
        Guid id,
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var invoice = await repository.GetByIdAsync(id, ct);
        if (invoice is null)
            return Results.NotFound(new { Message = "Invoice not found." });

        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        invoice.MarkAsSent(userName ?? "system");

        await repository.UpdateAsync(invoice, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Invoice '{invoice.InvoiceNumber}' marked as sent",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return Results.Ok(MapToDetailResponse(invoice));
    }

    private static InvoiceListResponse MapToListResponse(Invoice inv) =>
        new(inv.Id, inv.InvoiceNumber, inv.Date, inv.DueDate, inv.Status.ToString(),
            inv.RecipientType.ToString(), inv.RecipientName, inv.Total,
            inv.CreatedAt, inv.CreatedBy);

    private static InvoiceDetailResponse MapToDetailResponse(Invoice inv) =>
        new(inv.Id, inv.InvoiceNumber, inv.Date, inv.DueDate, inv.Status.ToString(),
            inv.RecipientType.ToString(), inv.RecipientId, inv.RecipientName,
            inv.RecipientAddress, inv.SubTotal, inv.TaxRate, inv.TaxAmount, inv.Total,
            inv.Notes, inv.Items.Select(i => new InvoiceItemResponse(
                i.Id, i.Description, i.Quantity, i.UnitPrice, i.Amount)).ToList(),
            inv.CreatedAt, inv.CreatedBy, inv.UpdatedAt, inv.UpdatedBy);

    // DTOs
    public sealed record CreateInvoiceRequest(DateTime Date, DateTime DueDate,
        string RecipientType, Guid? RecipientId, string RecipientName,
        string? RecipientAddress, decimal TaxRate, string? Notes,
        List<CreateInvoiceItemRequest> Items);
    public sealed record CreateInvoiceItemRequest(string Description, decimal Quantity, decimal UnitPrice);
    public sealed record UpdateInvoiceRequest(DateTime Date, DateTime DueDate,
        string RecipientType, Guid? RecipientId, string RecipientName,
        string? RecipientAddress, decimal TaxRate, string? Notes,
        List<CreateInvoiceItemRequest> Items);
    public sealed record InvoiceListResponse(Guid Id, string InvoiceNumber, DateTime Date, DateTime DueDate,
        string Status, string RecipientType, string RecipientName, decimal Total,
        DateTime CreatedAt, string CreatedBy);
    public sealed record InvoiceDetailResponse(Guid Id, string InvoiceNumber, DateTime Date, DateTime DueDate,
        string Status, string RecipientType, Guid? RecipientId, string RecipientName,
        string? RecipientAddress, decimal SubTotal, decimal TaxRate, decimal TaxAmount, decimal Total,
        string? Notes, List<InvoiceItemResponse> Items,
        DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);
    public sealed record InvoiceItemResponse(Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal Amount);
}
