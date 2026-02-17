using IabConnect.Application.Finance.Payments.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// Command to attach a receipt to a payment (REQ-061)
/// </summary>
public sealed record AttachReceiptToPaymentCommand(Guid PaymentId, Guid ReceiptId) : IRequest<PaymentDto?>;
