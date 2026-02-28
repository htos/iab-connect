using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Command to archive a receipt.
/// </summary>
public sealed record ArchiveReceiptCommand(Guid ReceiptId, string Reason, string UserName) : IRequest<bool>;
