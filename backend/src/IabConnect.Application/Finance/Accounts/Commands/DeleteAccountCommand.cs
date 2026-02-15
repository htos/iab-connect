using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

/// <summary>
/// Command to soft-delete a financial account (REQ-038)
/// </summary>
public sealed record DeleteAccountCommand(Guid Id, string UserName) : IRequest<bool>;
