using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

public sealed record PaymentDto(
    Guid Id, DateTime Date, decimal Amount, string Direction, string Method,
    string? Reference, Guid? InvoiceId, string? InvoiceNumber, Guid? TransactionId, string? Notes,
    string Status, string? ApprovedBy, DateTime? ApprovedAt, string? ApprovalComment,
    string? RejectedBy, DateTime? RejectedAt, string? RejectionReason,
    Guid? ReceiptId,
    DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);

/// <summary>
/// Query to get all payments (REQ-040)
/// </summary>
public sealed record GetPaymentsQuery : IRequest<List<PaymentDto>>;
