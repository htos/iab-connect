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
        //
        // REQ-025 (E3.S5 Round-3 R3-H-S5-9): the previous implementation called
        // `GetPublicEventsAsync(from: now-90d)` which filters on `StartDate >= now-90d` per
        // the repo convention — a yearly festival whose StartDate is 100d ago but still
        // ongoing was silently dropped from the calendar feed while still appearing in the
        // public events list. We now load with no `from` cutoff and apply BOTH bounds
        // in-memory on `EndDate`: rows whose end-date hasn't passed the 90d back-window AND
        // whose end-date is within the 2-year forward window. This matches the member-feed
        // semantic (EndDateFrom) without forcing a new repo method onto every caller of
        // GetPublicEventsAsync. The public events surface is bounded so the load is
        // negligible.
        var now = DateTime.UtcNow;
        var events = await _events.GetPublicEventsAsync(from: null, cancellationToken);
        var bounded = events.Where(e => e.EndDate >= now.AddDays(-90) && e.EndDate <= now.AddYears(2));
        return new CalendarFeed(_builder.Build(bounded, request.BaseUrl));
    }
}
