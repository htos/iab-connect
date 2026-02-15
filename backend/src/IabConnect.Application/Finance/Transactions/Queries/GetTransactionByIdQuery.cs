using MediatR;

namespace IabConnect.Application.Finance.Transactions.Queries;

/// <summary>
/// Query to get a transaction by ID (REQ-038)
/// </summary>
public sealed record GetTransactionByIdQuery(Guid Id) : IRequest<TransactionDto?>;
