using IabConnect.Application.Finance.DunningNotices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

/// <summary>
/// Command to mark a dunning notice as sent (REQ-042)
/// </summary>
public sealed record SendDunningNoticeCommand(Guid Id) : IRequest<DunningNoticeDto?>;
