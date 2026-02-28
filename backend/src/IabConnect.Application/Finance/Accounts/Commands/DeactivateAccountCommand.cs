using IabConnect.Application.Finance.Accounts.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Accounts.Commands;

/// <summary>
/// Command to deactivate a financial account (REQ-038)
/// </summary>
public sealed record DeactivateAccountCommand(Guid Id, string UserName) : IRequest<AccountDto?>;
