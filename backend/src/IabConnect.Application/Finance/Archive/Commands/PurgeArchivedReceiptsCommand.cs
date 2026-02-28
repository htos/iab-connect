using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Command to purge archived receipts past their retention period (Admin only).
/// </summary>
public sealed record PurgeArchivedReceiptsCommand(string UserName) : IRequest<int>;
