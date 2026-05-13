using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5): Public anonymous calendar feed. Visibility = Public + Status = Published.
/// </summary>
public sealed record GetPublicCalendarFeedQuery(string BaseUrl) : IRequest<CalendarFeed>;

public sealed record CalendarFeed(string IcsContent);

public sealed class GetPublicCalendarFeedQueryHandler
    : IRequestHandler<GetPublicCalendarFeedQuery, CalendarFeed>
{
    private readonly IEventRepository _events;
    private readonly ICalendarFeedBuilder _builder;

    public GetPublicCalendarFeedQueryHandler(IEventRepository events, ICalendarFeedBuilder builder)
    {
        _events = events;
        _builder = builder;
    }

    public async Task<CalendarFeed> Handle(GetPublicCalendarFeedQuery request, CancellationToken cancellationToken)
    {
        // Post-review M-S5-2: bound the feed window so a malformed event with a year-3000
        // end date can't blow up the ICS body or page count. Mirrors the member-feed window.
        var now = DateTime.UtcNow;
        var events = await _events.GetPublicEventsAsync(from: now.AddDays(-90), cancellationToken);
        var bounded = events.Where(e => e.EndDate <= now.AddYears(2));
        return new CalendarFeed(_builder.Build(bounded, request.BaseUrl));
    }
}
