using IabConnect.Application.Finance.Payments.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// Command to update a payment (REQ-040)
/// </summary>
public sealed record UpdatePaymentCommand : IRequest<PaymentDto?>
{
    public required Guid Id { get; init; }
    public required DateTime Date { get; init; }
    public required decimal Amount { get; init; }
    public required string Direction { get; init; }
    public required string Method { get; init; }
    public string? Reference { get; init; }
    public Guid? InvoiceId { get; init; }
    public Guid? TransactionId { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
