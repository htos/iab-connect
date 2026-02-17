using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

/// <summary>
/// REQ-067: Query to get expense claims with optional filters
/// </summary>
public sealed record GetExpenseClaimsQuery(ExpenseClaimStatus? Status = null, Guid? ClaimantId = null)
    : IRequest<List<ExpenseClaimDto>>;
