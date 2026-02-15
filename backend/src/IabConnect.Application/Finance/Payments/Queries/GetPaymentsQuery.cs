using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

public sealed record PaymentDto(
    Guid Id, DateTime Date, decimal Amount, string Method,
    string? Reference, Guid? InvoiceId, Guid? TransactionId, string? Notes,
    DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);

/// <summary>
/// Query to get all payments (REQ-040)
/// </summary>
public sealed record GetPaymentsQuery : IRequest<List<PaymentDto>>;
