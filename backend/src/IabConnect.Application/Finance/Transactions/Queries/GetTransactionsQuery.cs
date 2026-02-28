using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

/// <summary>
/// Shared DTO for transaction data
/// </summary>
public sealed record TransactionDto(
    Guid Id, DateTime Date, string Description, decimal Amount,
    string Type, Guid AccountId, Guid? CategoryId, string? Reference,
    string? Notes, Guid? ReceiptId,
    Guid? TaxCodeId, decimal? TaxRate, decimal? TaxAmount, decimal? NetAmount,
    Guid? ActivityAreaId, string? ActivityAreaName, string? ActivityAreaCode,
    DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);

/// <summary>
/// Query to get transactions with optional filters (REQ-038) with pagination support
/// </summary>
public sealed record GetTransactionsQuery : IRequest<PagedResult<TransactionDto>>
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? Type { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
