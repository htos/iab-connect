using System.Security.Claims;
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
            .WithTags("Finance - Payments");

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
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(ISender sender, CancellationToken ct)
    {
        var payments = await sender.Send(new GetPaymentsQuery(), ct);
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
            Method = request.Method,
            Reference = request.Reference,
            InvoiceId = request.InvoiceId,
            TransactionId = request.TransactionId,
            Notes = request.Notes,
            UserName = GetUserName(httpContext)
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
            Method = request.Method,
            Reference = request.Reference,
            InvoiceId = request.InvoiceId,
            TransactionId = request.TransactionId,
            Notes = request.Notes,
            UserName = GetUserName(httpContext)
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Payment not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeletePaymentCommand(id, GetUserName(httpContext)), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Payment not found." });
    }

    // DTOs
    public sealed record CreatePaymentRequest(DateTime Date, decimal Amount, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
    public sealed record UpdatePaymentRequest(DateTime Date, decimal Amount, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
}
