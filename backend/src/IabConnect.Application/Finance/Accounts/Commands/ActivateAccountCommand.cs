using IabConnect.Application.Finance.Accounts.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

/// <summary>
/// Command to activate a financial account (REQ-038)
/// </summary>
public sealed record ActivateAccountCommand(Guid Id, string UserName) : IRequest<AccountDto?>;
