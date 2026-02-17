using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Create a new expense claim
/// </summary>
public sealed record CreateExpenseClaimCommand : IRequest<ExpenseClaimDto>
{
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required decimal Amount { get; init; }
    public required string Currency { get; init; }
    public required DateTime Date { get; init; }
    public required Guid ClaimantId { get; init; }
    public required string ClaimantName { get; init; }
    public Guid? ReceiptId { get; init; }
    public required string UserName { get; init; }
}
