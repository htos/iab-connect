using IabConnect.Application.Finance.Transactions.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

/// <summary>
/// Command to attach a receipt to a transaction (REQ-061)
/// </summary>
public sealed record AttachReceiptToTransactionCommand(Guid TransactionId, Guid ReceiptId) : IRequest<TransactionDto?>;
