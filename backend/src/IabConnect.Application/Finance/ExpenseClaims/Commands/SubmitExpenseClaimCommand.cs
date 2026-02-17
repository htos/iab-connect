using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Submit an expense claim for review
/// </summary>
public sealed record SubmitExpenseClaimCommand(Guid Id, string UserName) : IRequest<ExpenseClaimDto>;
