using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Command to restore a receipt from archive (Admin only).
/// </summary>
public sealed record RestoreReceiptCommand(Guid ReceiptId, string UserName) : IRequest<bool>;
