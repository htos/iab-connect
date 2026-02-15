using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

/// <summary>
/// DTO for transaction summary
/// </summary>
public sealed record TransactionSummaryDto(decimal TotalIncome, decimal TotalExpense, decimal Balance);

/// <summary>
/// Query to get transaction summary totals (REQ-038)
/// </summary>
public sealed record GetTransactionSummaryQuery : IRequest<TransactionSummaryDto>
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}
