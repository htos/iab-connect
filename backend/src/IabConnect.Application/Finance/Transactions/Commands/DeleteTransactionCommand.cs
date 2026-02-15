using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

/// <summary>
/// Command to soft-delete a transaction (REQ-038)
/// </summary>
public sealed record DeleteTransactionCommand(Guid Id, string UserName) : IRequest<bool>;
