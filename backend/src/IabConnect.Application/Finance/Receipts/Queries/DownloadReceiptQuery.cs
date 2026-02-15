using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

/// <summary>
/// Result of receipt download
/// </summary>
public sealed record ReceiptDownloadResult(Stream Stream, string ContentType, string FileName);

/// <summary>
/// Query to download a receipt file (REQ-061)
/// </summary>
public sealed record DownloadReceiptQuery(Guid Id) : IRequest<ReceiptDownloadResult?>;
