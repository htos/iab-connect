using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5): Per-member subscribable calendar feed. Resolves opaque token to Member,
/// then returns Public + MembersOnly published events from the last 90d forward.
/// Null return signals "token not found / member retired" — the endpoint maps to 404.
/// </summary>
public sealed record GetMemberCalendarFeedQuery(string Token, string BaseUrl) : IRequest<CalendarFeed?>;

public sealed class GetMemberCalendarFeedQueryHandler
    : IRequestHandler<GetMemberCalendarFeedQuery, CalendarFeed?>
{
    private const int FeedPageSize = 500;

    private readonly IMemberRepository _members;
    private readonly IEventRepository _events;
    private readonly ICalendarFeedBuilder _builder;

    public GetMemberCalendarFeedQueryHandler(
        IMemberRepository members,
        IEventRepository events,
        ICalendarFeedBuilder builder)
    {
        _members = members;
        _events = events;
        _builder = builder;
    }

    public async Task<CalendarFeed?> Handle(GetMemberCalendarFeedQuery request, CancellationToken cancellationToken)
    {
        var member = await _members.GetByCalendarTokenAsync(request.Token, cancellationToken);
        if (member is null) return null;

        // Post-review M-S5-5: filter by EndDate so multi-day events that started before the
        // window but are still ongoing (or end within it) remain in the feed.
        // Post-review M-S5-2: also bound the forward edge so a malicious/buggy event with a
        // distant future end date can't unbalance the feed page count.
        var now = DateTime.UtcNow;
        var filter = new EventFilterOptions
        {
            Status = EventStatus.Published,
            EndDateFrom = now.AddDays(-90),
            ToDate = now.AddYears(2),
        };

        // R4-P-S5-2: page through ALL events in the window instead of fetching only the first
        // page of FeedPageSize. The previous single-page call silently truncated a member's
        // subscribed feed at 500 events with no log or error. The loop is bounded in practice by
        // the EndDateFrom/ToDate window in the filter, so it cannot run away.
        var collected = new List<Event>();
        var page = 1;
        while (true)
        {
            var (pageItems, _) = await _events.GetPagedAsync(filter, page, FeedPageSize, cancellationToken);
            collected.AddRange(pageItems);
            if (pageItems.Count < FeedPageSize) break;
            page++;
        }

        // Public + MembersOnly only — Hidden and InviteOnly are out of scope.
        var filtered = collected
            .Where(e => !e.IsDeleted)
            .Where(e => e.Visibility == EventVisibility.Public || e.Visibility == EventVisibility.MembersOnly);

        return new CalendarFeed(_builder.Build(filtered, request.BaseUrl));
    }
}
