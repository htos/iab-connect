using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

/// <summary>
/// REQ-067: Query to get expense claims with optional filters and pagination
/// </summary>
public sealed record GetExpenseClaimsQuery(ExpenseClaimStatus? Status = null, Guid? ClaimantId = null)
    : IRequest<PagedResult<ExpenseClaimDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
