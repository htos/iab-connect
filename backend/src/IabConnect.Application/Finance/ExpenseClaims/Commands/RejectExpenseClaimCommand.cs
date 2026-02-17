using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Reject an expense claim
/// </summary>
public sealed record RejectExpenseClaimCommand(Guid Id, string Reason, string UserName) : IRequest<ExpenseClaimDto>;
