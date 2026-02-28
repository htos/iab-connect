using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Queries;

public sealed record DunningNoticeDto(
    Guid Id, Guid InvoiceId, string? InvoiceNumber, string? RecipientName,
    int Level, DateTime Date,
    DateTime DueDate, string Status, DateTime? SentAt,
    string? Notes, string CreatedBy);

/// <summary>
/// Query to get all dunning notices, optionally filtered by invoice (REQ-042) with pagination support
/// </summary>
public sealed record GetDunningNoticesQuery(Guid? InvoiceId = null) : IRequest<PagedResult<DunningNoticeDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
