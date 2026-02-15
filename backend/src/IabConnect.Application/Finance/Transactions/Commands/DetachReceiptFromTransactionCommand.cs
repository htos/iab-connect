using IabConnect.Application.Finance.Transactions.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

/// <summary>
/// Command to detach a receipt from a transaction (REQ-061)
/// </summary>
public sealed record DetachReceiptFromTransactionCommand(Guid TransactionId) : IRequest<TransactionDto?>;
