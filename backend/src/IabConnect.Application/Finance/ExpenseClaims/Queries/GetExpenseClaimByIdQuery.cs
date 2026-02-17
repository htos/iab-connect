using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Queries;

/// <summary>
/// REQ-067: Query to get a single expense claim by ID
/// </summary>
public sealed record GetExpenseClaimByIdQuery(Guid Id) : IRequest<ExpenseClaimDto?>;
