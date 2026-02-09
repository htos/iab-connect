using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

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

    private static async Task<IResult> GetAll(
        IPaymentRepository repository,
        CancellationToken ct)
    {
        var payments = await repository.GetAllAsync(ct);
        var response = payments.Select(MapToResponse);
        return Results.Ok(response);
    }

    private static async Task<IResult> Create(
        CreatePaymentRequest request,
        IPaymentRepository paymentRepo,
        IInvoiceRepository invoiceRepo,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
            return Results.BadRequest(new { Message = $"Invalid payment method '{request.Method}'." });

        var payment = Payment.Create(
            request.Date, request.Amount, method, request.Reference,
            request.InvoiceId, request.TransactionId, request.Notes,
            userName ?? "system");

        await paymentRepo.AddAsync(payment, ct);

        // Check if linked invoice is now fully paid
        if (request.InvoiceId.HasValue)
        {
            var invoice = await invoiceRepo.GetByIdAsync(request.InvoiceId.Value, ct);
            if (invoice is not null && invoice.Status is InvoiceStatus.Sent or InvoiceStatus.Overdue)
            {
                var allPayments = await paymentRepo.GetByInvoiceIdAsync(invoice.Id, ct);
                var totalPaid = allPayments.Sum(p => p.Amount) + request.Amount;
                if (totalPaid >= invoice.Total)
                {
                    invoice.MarkAsPaid(userName ?? "system");
                    await invoiceRepo.UpdateAsync(invoice, ct);
                }
            }
        }

        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Payment of {payment.Amount:N2} recorded ({payment.Method})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/payments/{payment.Id}", MapToResponse(payment));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdatePaymentRequest request,
        IPaymentRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var payment = await repository.GetByIdAsync(id, ct);
        if (payment is null)
            return Results.NotFound(new { Message = "Payment not found." });

        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<PaymentMethod>(request.Method, true, out var method))
            return Results.BadRequest(new { Message = $"Invalid payment method '{request.Method}'." });

        payment.Update(
            request.Date, request.Amount, method, request.Reference,
            request.InvoiceId, request.TransactionId, request.Notes,
            userName ?? "system");

        await repository.UpdateAsync(payment, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Payment {payment.Id} updated ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return Results.Ok(MapToResponse(payment));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IPaymentRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var payment = await repository.GetByIdAsync(id, ct);
        if (payment is null)
            return Results.NotFound(new { Message = "Payment not found." });

        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Payment deleted ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    private static PaymentResponse MapToResponse(Payment p) =>
        new(p.Id, p.Date, p.Amount, p.Method.ToString(), p.Reference,
            p.InvoiceId, p.TransactionId, p.Notes,
            p.CreatedAt, p.CreatedBy, p.UpdatedAt, p.UpdatedBy);

    // DTOs
    public sealed record CreatePaymentRequest(DateTime Date, decimal Amount, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
    public sealed record UpdatePaymentRequest(DateTime Date, decimal Amount, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes);
    public sealed record PaymentResponse(Guid Id, DateTime Date, decimal Amount, string Method,
        string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes,
        DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);
}
