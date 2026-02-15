using MediatR;

namespace IabConnect.Application.Finance.Receipts.Commands;

/// <summary>
/// Command to delete a receipt (REQ-043)
/// </summary>
public sealed record DeleteReceiptCommand(Guid Id, string UserName) : IRequest<bool>;
