using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023: Query for the event check-in roster. Returns a lookup envelope that distinguishes
/// "event not found" from "archive expired" (review H-S1-3) so the endpoint can return the
/// correct 404 message.
/// </summary>
public sealed record GetEventCheckInRosterQuery(Guid EventId, bool IncludeWaitlisted = false)
    : IRequest<EventCheckInRosterLookup>;
