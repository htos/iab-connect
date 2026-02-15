using IabConnect.Application.Finance.Transactions.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

/// <summary>
/// Command to update a financial transaction (REQ-038)
/// </summary>
public sealed record UpdateTransactionCommand : IRequest<TransactionDto?>
{
    public required Guid Id { get; init; }
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
    public required string UserName { get; init; }
}
