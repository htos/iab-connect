using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Reimburse an approved expense claim (creates a Payment)
/// </summary>
public sealed record ReimburseExpenseClaimCommand : IRequest<ExpenseClaimDto>
{
    public required Guid Id { get; init; }
    public required string Method { get; init; }
    public string? Reference { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
