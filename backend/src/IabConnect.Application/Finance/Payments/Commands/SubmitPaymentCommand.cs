using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// REQ-067: Submit a payment for approval
/// </summary>
public sealed record SubmitPaymentCommand(Guid Id, string UserName) : IRequest<Unit>;
