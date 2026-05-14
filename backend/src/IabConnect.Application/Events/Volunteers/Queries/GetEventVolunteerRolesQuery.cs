using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Queries;

public sealed record GetEventVolunteerRolesQuery(Guid EventId) : IRequest<IReadOnlyList<EventVolunteerRoleDto>>;

public sealed class GetEventVolunteerRolesQueryHandler
    : IRequestHandler<GetEventVolunteerRolesQuery, IReadOnlyList<EventVolunteerRoleDto>>
{
    private readonly IEventVolunteerRoleRepository _roles;
    private readonly IEventRepository _events;

    public GetEventVolunteerRolesQueryHandler(
        IEventVolunteerRoleRepository roles,
        IEventRepository events)
    {
        _roles = roles;
        _events = events;
    }

    public async Task<IReadOnlyList<EventVolunteerRoleDto>> Handle(
        GetEventVolunteerRolesQuery request,
        CancellationToken cancellationToken)
    {
        // R4-P-S3-2: verify the event exists before returning its volunteer roles. Without this,
        // any RequireEventStaffOrMember caller could probe whether an event GUID exists (and read
        // its volunteer roster) by enumerating GUIDs. Mirrors the existence check in
        // GetVolunteerShiftAssignmentsQueryHandler (R3-C3) and GetEventCheckInRosterQueryHandler.
        var evt = await _events.GetByIdAsync(request.EventId, cancellationToken);
        if (evt is null || evt.IsDeleted)
            throw new KeyNotFoundException($"Event {request.EventId} not found.");

        var entities = await _roles.GetByEventIdAsync(request.EventId, cancellationToken);
        return entities.Select(EventVolunteerRoleDto.FromEntity).ToList();
    }
}
