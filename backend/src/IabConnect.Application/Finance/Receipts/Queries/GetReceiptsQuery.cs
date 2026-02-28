using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed record ReceiptDto(
    Guid Id, string FileName, string FilePath, string ContentType, long FileSize,
    string? FileHash, DateTime UploadedAt, string UploadedBy, string? Notes,
    string DownloadUrl);

/// <summary>
/// Query to get all receipts (REQ-043) with pagination support
/// </summary>
public sealed record GetReceiptsQuery : IRequest<PagedResult<ReceiptDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
