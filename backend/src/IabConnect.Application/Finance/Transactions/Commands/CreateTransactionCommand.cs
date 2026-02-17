using IabConnect.Application.Finance.Transactions.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

/// <summary>
/// Command to create a financial transaction (REQ-038)
/// </summary>
public sealed record CreateTransactionCommand : IRequest<TransactionDto>
{
    public required DateTime Date { get; init; }
    public required string Description { get; init; }
    public required decimal Amount { get; init; }
    public required string Type { get; init; }
    public required Guid AccountId { get; init; }
    public Guid? CategoryId { get; init; }
    public string? Reference { get; init; }
    public string? Notes { get; init; }
    public Guid? TaxCodeId { get; init; }
    public decimal? TaxRate { get; init; }
    public Guid? ActivityAreaId { get; init; }
    public required string UserName { get; init; }
}
