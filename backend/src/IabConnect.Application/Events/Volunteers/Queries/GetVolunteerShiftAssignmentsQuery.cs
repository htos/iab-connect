using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Queries;

public sealed record GetVolunteerShiftAssignmentsQuery(Guid ShiftId)
    : IRequest<IReadOnlyList<EventVolunteerAssignmentDto>>;

public sealed class GetVolunteerShiftAssignmentsQueryHandler
    : IRequestHandler<GetVolunteerShiftAssignmentsQuery, IReadOnlyList<EventVolunteerAssignmentDto>>
{
    private readonly IEventVolunteerAssignmentRepository _assignments;
    private readonly IMemberRepository _members;

    public GetVolunteerShiftAssignmentsQueryHandler(
        IEventVolunteerAssignmentRepository assignments,
        IMemberRepository members)
    {
        _assignments = assignments;
        _members = members;
    }

    public async Task<IReadOnlyList<EventVolunteerAssignmentDto>> Handle(
        GetVolunteerShiftAssignmentsQuery request,
        CancellationToken cancellationToken)
    {
        var assignments = await _assignments.GetByShiftIdAsync(request.ShiftId, cancellationToken);
        // M-S3-6: exclude cancelled rows from the member-facing roster — cancelled assignments
        // are retained for audit but must NOT leak PII (member name) on the roster endpoint.
        var visible = assignments.Where(a => a.Status != VolunteerAssignmentStatus.Cancelled).ToList();
        if (visible.Count == 0) return Array.Empty<EventVolunteerAssignmentDto>();

        var memberIds = visible.Select(a => a.MemberId).Distinct().ToList();
        var membersById = new Dictionary<Guid, Member>();
        foreach (var id in memberIds)
        {
            var member = await _members.GetByIdAsync(id, cancellationToken);
            if (member is not null) membersById[id] = member;
        }

        return visible.Select(a => new EventVolunteerAssignmentDto(
            a.Id, a.ShiftId, a.RoleId, a.MemberId,
            membersById.TryGetValue(a.MemberId, out var m) ? $"{m.FirstName} {m.LastName}".Trim() : "(unknown)",
            a.Status, a.Position, a.AssignedAt)).ToList();
    }
}
