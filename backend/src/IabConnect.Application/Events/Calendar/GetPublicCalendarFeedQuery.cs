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
        // REQ-025 (E3.S5 R4-P-S5-1): both window bounds are now pushed into SQL via the
        // GetPublicEventsAsync(from, to) overload — `EndDate >= now-90d AND EndDate <= now+2y`.
        // This is the unauthenticated `/calendar.ics` endpoint, so the previous "load every
        // published public event ever created, filter in memory" shape was an unbounded-load
        // surface. Filtering on EndDate (not StartDate) keeps the R3-H-S5-9 semantic — a yearly
        // festival that started 100d ago but is still ongoing stays in the feed — while the
        // forward bound caps the row count the anonymous endpoint can be made to materialise.
        var now = DateTime.UtcNow;
        var events = await _events.GetPublicEventsAsync(
            from: now.AddDays(-90),
            to: now.AddYears(2),
            ct: cancellationToken);
        return new CalendarFeed(_builder.Build(events, request.BaseUrl));
    }
}
