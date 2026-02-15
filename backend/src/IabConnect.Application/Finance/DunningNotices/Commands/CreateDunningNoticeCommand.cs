using IabConnect.Application.Finance.DunningNotices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

/// <summary>
/// Command to create a dunning notice (REQ-042)
/// </summary>
public sealed record CreateDunningNoticeCommand : IRequest<DunningNoticeDto?>
{
    public required Guid InvoiceId { get; init; }
    public required int Level { get; init; }
    public required DateTime DueDate { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
