using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Payments.Commands;
using IabConnect.Application.Finance.Payments.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for payment management (REQ-040)
/// </summary>
public static class PaymentEndpoints
{
    public static void MapPaymentEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/payments")
            .WithTags("Finance - Payments")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetPayments_Finance")
            .WithSummary("List all payments")
            .WithDescription("REQ-040: Returns all payment records.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreatePayment")
            .WithSummary("Create a payment")
            .WithDescription("REQ-040: Creates a new payment. If linked to an invoice, marks invoice as paid when fully paid. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdatePayment")
            .WithSummary("Update a payment")
            .WithDescription("REQ-040: Updates a payment record. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeletePayment")
            .WithSummary("Delete a payment")
            .WithDescription("REQ-040: Deletes a payment record. Audited.");

        // REQ-067: Payment approval workflow
        group.MapPost("/{id:guid}/submit", SubmitPayment).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/approve", ApprovePayment).RequireAuthorization("RequireVorstand");
        group.MapPost("/{id:guid}/reject", RejectPayment).RequireAuthorization("RequireVorstand");
        group.MapPost("/{id:guid}/mark-paid", MarkAsPaid).RequireAuthorization("RequireFinanceWrite");

        // REQ-061: Receipt attachment
        group.MapPost("/{id:guid}/receipt", AttachReceipt)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("AttachReceiptToPayment")
            .WithSummary("Attach a receipt to a payment")
            .WithDescription("REQ-061: Attaches an existing receipt to a payment. Audited.");

        group.MapDelete("/{id:guid}/receipt", DetachReceipt)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DetachReceiptFromPayment")
            .WithSummary("Detach receipt from a payment")
            .WithDescription("REQ-061: Removes the receipt link from a payment. Audited.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var payments = await sender.Send(new GetPaymentsQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(payments);
    }

    private static async Task<IResult> Create(
        CreatePaymentRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreatePaymentCommand
        {
            Date = request.Date,
            Amount = request.Amount,
            Direction = request.Direction,
            Method = request.Method,
            Reference = request.Reference,
            InvoiceId = request.InvoiceId,
            TransactionId = request.TransactionId,
            Notes = request.Notes,
            UserName = httpContext.GetUserName()
        }, ct);
        return Results.Created($"/api/v1/finance/payments/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdatePaymentRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdatePaymentCommand
        {
            Id = id,
            Date = request.Date,
            Amount = request.Amount,
            Direction = request.Direction,
            Method = request.Method,
            Reference = request.Reference,
            InvoiceId = request.InvoiceId,
            TransactionId = request.TransactionId,
            Notes = request.Notes,
            UserName = httpContext.GetUserName()
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Payment not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeletePaymentCommand(id, httpContext.GetUserName()), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Payment not found." });
    }

    // REQ-067: Payment approval workflow handlers
    private static async Task<IResult> SubmitPayment(Guid id, HttpContext ctx, ISender sender, CancellationToken ct)
    {
        var command = new SubmitPaymentCommand(id, ctx.GetUserName());
        await sender.Send(command, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> ApprovePayment(Guid id, ApprovePaymentRequest? request, HttpContext ctx, ISender sender, CancellationToken ct)
    {
        var command = new ApprovePaymentCommand(id, request?.Comment, ctx.GetUserName());
        await sender.Send(command, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> RejectPayment(Guid id, RejectPaymentRequest request, HttpContext ctx, ISender sender, CancellationToken ct)
    {
        var command = new RejectPaymentCommand(id, request.Reason, ctx.GetUserName());
        await sender.Send(command, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> MarkAsPaid(Guid id, HttpContext ctx, ISender sender, CancellationToken ct)
    {
        var command = new MarkPaymentAsPaidCommand(id, ctx.GetUserName());
        await sender.Send(command, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> AttachReceipt(
        Guid id, AttachReceiptRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new AttachReceiptToPaymentCommand(id, request.ReceiptId), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Payment or receipt not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> DetachReceipt(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new DetachReceiptFromPaymentCommand(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Payment not found." })
            : Results.Ok(dto);
    }

    // DTOs
    public sealed record CreatePaymentRequest(DateTime Date, decimal Amount, string Direction, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
    public sealed record UpdatePaymentRequest(DateTime Date, decimal Amount, string Direction, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
    public sealed record ApprovePaymentRequest(string? Comment);
    public sealed record RejectPaymentRequest(string Reason);
    public sealed record AttachReceiptRequest(Guid ReceiptId);
}
