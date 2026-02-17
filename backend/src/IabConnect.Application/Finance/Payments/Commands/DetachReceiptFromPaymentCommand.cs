using IabConnect.Application.Finance.Payments.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// Command to detach a receipt from a payment (REQ-061)
/// </summary>
public sealed record DetachReceiptFromPaymentCommand(Guid PaymentId) : IRequest<PaymentDto?>;
