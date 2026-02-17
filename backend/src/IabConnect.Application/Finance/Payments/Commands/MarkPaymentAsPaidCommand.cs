using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// REQ-067: Mark a payment as paid (checks approval thresholds)
/// </summary>
public sealed record MarkPaymentAsPaidCommand(Guid Id, string UserName) : IRequest<Unit>;
