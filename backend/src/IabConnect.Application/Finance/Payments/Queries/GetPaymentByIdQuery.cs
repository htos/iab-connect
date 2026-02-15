using MediatR;

namespace IabConnect.Application.Finance.Payments.Queries;

/// <summary>
/// Query to get a payment by ID (REQ-040)
/// </summary>
public sealed record GetPaymentByIdQuery(Guid Id) : IRequest<PaymentDto?>;
