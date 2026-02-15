using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Queries;

public sealed record DunningNoticeDto(
    Guid Id, Guid InvoiceId, string? InvoiceNumber, string? RecipientName,
    int Level, DateTime Date,
    DateTime DueDate, string Status, DateTime? SentAt,
    string? Notes, string CreatedBy);

/// <summary>
/// Query to get all dunning notices (REQ-042)
/// </summary>
public sealed record GetDunningNoticesQuery : IRequest<List<DunningNoticeDto>>;
