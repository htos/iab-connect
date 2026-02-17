using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// REQ-067: Reject a submitted payment
/// </summary>
public sealed record RejectPaymentCommand(Guid Id, string Reason, string UserName) : IRequest<Unit>;
