using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Soft-delete an expense claim
/// </summary>
public sealed record DeleteExpenseClaimCommand(Guid Id, string UserName) : IRequest<bool>;
