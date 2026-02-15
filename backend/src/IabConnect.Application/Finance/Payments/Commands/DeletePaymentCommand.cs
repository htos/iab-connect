using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

/// <summary>
/// Command to soft-delete a payment (REQ-040)
/// </summary>
public sealed record DeletePaymentCommand(Guid Id, string UserName) : IRequest<bool>;
