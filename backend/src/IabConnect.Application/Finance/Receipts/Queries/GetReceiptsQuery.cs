using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed record ReceiptDto(
    Guid Id, string FileName, string FilePath, string ContentType, long FileSize,
    string? FileHash, DateTime UploadedAt, string UploadedBy, string? Notes,
    string DownloadUrl);

/// <summary>
/// Query to get all receipts (REQ-043)
/// </summary>
public sealed record GetReceiptsQuery : IRequest<List<ReceiptDto>>;
