using MediatR;

namespace IabConnect.Application.Finance.Accounts.Queries;

/// <summary>
/// Query to get a single financial account by ID (REQ-038)
/// </summary>
public sealed record GetAccountByIdQuery(Guid Id) : IRequest<AccountDto?>;
