using IabConnect.Application.Finance.Receipts.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Commands;

/// <summary>
/// Command to upload a receipt (REQ-061)
/// </summary>
public sealed record UploadReceiptCommand : IRequest<ReceiptDto>
{
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public required long FileSize { get; init; }
    public required Stream FileStream { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
