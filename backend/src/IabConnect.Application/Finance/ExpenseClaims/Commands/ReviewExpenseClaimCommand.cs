using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Review a submitted expense claim (Kassier)
/// </summary>
public sealed record ReviewExpenseClaimCommand(Guid Id, string? Comment, string UserName) : IRequest<ExpenseClaimDto>;
