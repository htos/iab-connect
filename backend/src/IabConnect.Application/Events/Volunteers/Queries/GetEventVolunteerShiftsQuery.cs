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

    public GetEventVolunteerShiftsQueryHandler(
        IEventVolunteerShiftRepository shifts,
        IEventVolunteerRoleRepository roles,
        IEventVolunteerAssignmentRepository assignments)
    {
        _shifts = shifts;
        _roles = roles;
        _assignments = assignments;
    }

    public async Task<IReadOnlyList<EventVolunteerShiftDto>> Handle(
        GetEventVolunteerShiftsQuery request,
        CancellationToken cancellationToken)
    {
        var shifts = await _shifts.GetByEventIdAsync(request.EventId, cancellationToken);
        var rolesById = (await _roles.GetByEventIdAsync(request.EventId, cancellationToken))
            .ToDictionary(r => r.Id, r => r.Name);

        var dtos = new List<EventVolunteerShiftDto>(shifts.Count);
        foreach (var shift in shifts)
        {
            var confirmed = await _assignments.CountConfirmedAsync(shift.Id, cancellationToken);
            var waitlisted = await _assignments.CountWaitlistedAsync(shift.Id, cancellationToken);
            var roleName = rolesById.TryGetValue(shift.RoleId, out var name) ? name : string.Empty;
            dtos.Add(EventVolunteerShiftDto.FromEntity(shift, roleName, confirmed, waitlisted));
        }
        return dtos;
    }
}
