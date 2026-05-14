using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Queries;

public sealed record GetEventVolunteerShiftsQuery(Guid EventId) : IRequest<IReadOnlyList<EventVolunteerShiftDto>>;

public sealed class GetEventVolunteerShiftsQueryHandler
    : IRequestHandler<GetEventVolunteerShiftsQuery, IReadOnlyList<EventVolunteerShiftDto>>
{
    private readonly IEventVolunteerShiftRepository _shifts;
    private readonly IEventVolunteerRoleRepository _roles;
    private readonly IEventVolunteerAssignmentRepository _assignments;
    private readonly IEventRepository _events;

    public GetEventVolunteerShiftsQueryHandler(
        IEventVolunteerShiftRepository shifts,
        IEventVolunteerRoleRepository roles,
        IEventVolunteerAssignmentRepository assignments,
        IEventRepository events)
    {
        _shifts = shifts;
        _roles = roles;
        _assignments = assignments;
        _events = events;
    }

    public async Task<IReadOnlyList<EventVolunteerShiftDto>> Handle(
        GetEventVolunteerShiftsQuery request,
        CancellationToken cancellationToken)
    {
        // R4-P-S3-2: verify the event exists before returning its shifts — closes the same
        // GUID-enumeration gap as GetEventVolunteerRolesQueryHandler. An empty shift list and a
        // non-existent event must not be indistinguishable to a probing caller.
        var evt = await _events.GetByIdAsync(request.EventId, cancellationToken);
        if (evt is null || evt.IsDeleted)
            throw new KeyNotFoundException($"Event {request.EventId} not found.");

        // REQ-024 (E3.S3 Round-3 R3-H-S3-5): three queries total instead of 2N+2.
        // 1) shifts for the event, 2) roles for the event, 3) batched counts via GROUP BY.
        var shifts = await _shifts.GetByEventIdAsync(request.EventId, cancellationToken);
        if (shifts.Count == 0) return Array.Empty<EventVolunteerShiftDto>();

        var rolesById = (await _roles.GetByEventIdAsync(request.EventId, cancellationToken))
            .ToDictionary(r => r.Id, r => r.Name);

        var shiftIds = shifts.Select(s => s.Id).ToList();
        var counts = await _assignments.GetShiftCountsAsync(shiftIds, cancellationToken);

        return shifts.Select(shift =>
        {
            counts.TryGetValue(shift.Id, out var c);
            var roleName = rolesById.TryGetValue(shift.RoleId, out var name) ? name : string.Empty;
            return EventVolunteerShiftDto.FromEntity(shift, roleName, c.Confirmed, c.Waitlisted);
        }).ToList();
    }
}
