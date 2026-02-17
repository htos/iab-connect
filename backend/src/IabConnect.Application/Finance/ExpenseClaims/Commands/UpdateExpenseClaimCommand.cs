using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

/// <summary>
/// REQ-067: Update a draft expense claim
/// </summary>
public sealed record UpdateExpenseClaimCommand : IRequest<ExpenseClaimDto?>
{
    public required Guid Id { get; init; }
    public required string Title { get; init; }
    public required string Description { get; init; }
    public required decimal Amount { get; init; }
    public required DateTime Date { get; init; }
    public Guid? ReceiptId { get; init; }
    public required string UserName { get; init; }
}
