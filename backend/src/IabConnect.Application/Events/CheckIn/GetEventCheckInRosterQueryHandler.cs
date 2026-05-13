using IabConnect.Application.Common;
using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S1 review H-S1-3): result envelope so the endpoint can map archive-expired
/// to its spec-required "Event archive lookup expired" message instead of the generic
/// "Event not found" used for true 404s.
/// </summary>
public sealed record EventCheckInRosterLookup(EventCheckInRosterDto? Roster, bool ArchiveExpired)
{
    public static EventCheckInRosterLookup NotFound { get; } = new(null, ArchiveExpired: false);
    public static EventCheckInRosterLookup Expired { get; } = new(null, ArchiveExpired: true);
    public static EventCheckInRosterLookup Found(EventCheckInRosterDto roster) => new(roster, ArchiveExpired: false);
}

/// <summary>
/// REQ-023: Handler for <see cref="GetEventCheckInRosterQuery"/>.
/// Roster filtering and ordering are deterministic — see story E3.S1, AC 1-3 + 7.
/// </summary>
public sealed class GetEventCheckInRosterQueryHandler
    : IRequestHandler<GetEventCheckInRosterQuery, EventCheckInRosterLookup>
{
    /// <summary>
    /// Cancelled events stop exposing registrant PII after this many days.
    /// Aligns with project-context retention guidance.
    /// </summary>
    public static readonly TimeSpan ArchiveExpiry = TimeSpan.FromDays(90);

    private readonly IEventRepository _eventRepository;
    private readonly IEventRegistrationRepository _registrationRepository;

    public GetEventCheckInRosterQueryHandler(
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository)
    {
        _eventRepository = eventRepository;
        _registrationRepository = registrationRepository;
    }

    public async Task<EventCheckInRosterLookup> Handle(
        GetEventCheckInRosterQuery request,
        CancellationToken cancellationToken)
    {
        var evt = await _eventRepository.GetByIdAsync(request.EventId, cancellationToken);
        if (evt is null || evt.IsDeleted)
            return EventCheckInRosterLookup.NotFound;

        if (evt.Status == EventStatus.Cancelled
            && evt.CancelledAt.HasValue
            && evt.CancelledAt.Value < DateTime.UtcNow - ArchiveExpiry)
        {
            // REQ-023 (E3.S1 review H-S1-3): distinguish archive-expired from not-found so the
            // endpoint can surface the spec-required "Event archive lookup expired" message.
            return EventCheckInRosterLookup.Expired;
        }

        var registrations = await _registrationRepository.GetByEventIdAsync(
            request.EventId,
            filter: null,
            cancellationToken);

        var rosterItems = registrations
            .Where(r => IsIncluded(r, request.IncludeWaitlisted))
            .OrderBy(r => TextNormalization.FoldName(r.ParticipantName), StringComparer.Ordinal)
            .ThenBy(r => r.RegisteredAt)
            .Select(MapToItem)
            .ToList();

        var dto = new EventCheckInRosterDto
        {
            EventId = evt.Id,
            EventTitle = evt.Title,
            EventStartDate = evt.StartDate,
            EventLocation = evt.Location,
            GeneratedAt = DateTime.UtcNow,
            // REQ-023 (E3.S1 review D-S1-2): naming kept for backwards-compat with the published
            // DTO contract; the semantics are documented as "rows in the current roster view"
            // on EventCheckInRosterDto so callers reading "23 / TotalRegistrations" understand
            // they are looking at the filtered slice rather than the pre-filter total.
            TotalRegistrations = rosterItems.Count,
            CheckedInCount = rosterItems.Count(i => i.IsCheckedIn),
            Items = rosterItems
        };
        return EventCheckInRosterLookup.Found(dto);
    }

    private static bool IsIncluded(EventRegistration r, bool includeWaitlisted)
    {
        if (r.Status == RegistrationStatus.Pending || r.Status == RegistrationStatus.Cancelled)
            return false;

        // REQ-023 (E3.S1 review H-S1-1): use Status only. The legacy IsWaitlisted flag is
        // historical (a promoted waitlister keeps IsWaitlisted=true even after Status flips
        // to Confirmed and they were checked in), so the previous `Status==Waitlisted ||
        // IsWaitlisted` check would silently drop confirmed-but-historically-waitlisted
        // rows from the day-of roster.
        if (r.Status == RegistrationStatus.Waitlisted)
            return includeWaitlisted;

        return true;
    }

    private static EventCheckInRosterItemDto MapToItem(EventRegistration r) => new()
    {
        RegistrationId = r.Id,
        QrCodeToken = r.QrCodeToken,
        ParticipantName = r.ParticipantName,
        NumberOfGuests = r.NumberOfGuests,
        Status = r.Status.ToString(),
        IsWaitlisted = r.IsWaitlisted,
        IsCheckedIn = r.IsCheckedIn,
        CheckedInAt = r.CheckedInAt,
        SpecialRequirements = r.SpecialRequirements
    };
}
