using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Approve an expense claim under review (Vorstand)
/// </summary>
public sealed record ApproveExpenseClaimCommand(Guid Id, string? Comment, string UserName) : IRequest<ExpenseClaimDto>;
