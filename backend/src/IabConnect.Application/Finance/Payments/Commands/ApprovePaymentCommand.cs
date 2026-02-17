using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// REQ-067: Approve a submitted payment
/// </summary>
public sealed record ApprovePaymentCommand(Guid Id, string? Comment, string UserName) : IRequest<Unit>;
