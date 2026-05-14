using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Events.Volunteers.Queries;

/// <summary>
/// REQ-024 (E3.S3 Round-3 R3-C3): added <see cref="EventId"/> to close a cross-event IDOR on
/// the volunteer-roster endpoint. The previous shape relied solely on <see cref="ShiftId"/>;
/// any <c>RequireMember</c> caller could enumerate volunteer rosters across all events by
/// guessing shift GUIDs. The handler now asserts <c>shift.EventId == request.EventId</c> and
/// throws <see cref="KeyNotFoundException"/> (mapped to 404) on mismatch — opaque error so
/// the response is indistinguishable from "shift does not exist".
/// </summary>
public sealed record GetVolunteerShiftAssignmentsQuery(Guid EventId, Guid ShiftId)
    : IRequest<IReadOnlyList<EventVolunteerAssignmentDto>>;

public sealed class GetVolunteerShiftAssignmentsQueryHandler
    : IRequestHandler<GetVolunteerShiftAssignmentsQuery, IReadOnlyList<EventVolunteerAssignmentDto>>
{
    private readonly IEventVolunteerAssignmentRepository _assignments;
    private readonly IEventVolunteerShiftRepository _shifts;
    private readonly IMemberRepository _members;

    public GetVolunteerShiftAssignmentsQueryHandler(
        IEventVolunteerAssignmentRepository assignments,
        IEventVolunteerShiftRepository shifts,
        IMemberRepository members)
    {
        _assignments = assignments;
        _shifts = shifts;
        _members = members;
    }

    public async Task<IReadOnlyList<EventVolunteerAssignmentDto>> Handle(
        GetVolunteerShiftAssignmentsQuery request,
        CancellationToken cancellationToken)
    {
        // R3-C3: opaque 404 on cross-event tampering. Identical message to "shift does not exist".
        var shift = await _shifts.GetByIdAsync(request.ShiftId, cancellationToken);
        if (shift is null || shift.EventId != request.EventId)
            throw new KeyNotFoundException($"Shift {request.ShiftId} not found.");

        var assignments = await _assignments.GetByShiftIdAsync(request.ShiftId, cancellationToken);
        // M-S3-6: exclude cancelled rows from the member-facing roster — cancelled assignments
        // are retained for audit but must NOT leak PII (member name) on the roster endpoint.
        var visible = assignments.Where(a => a.Status != VolunteerAssignmentStatus.Cancelled).ToList();
        if (visible.Count == 0) return Array.Empty<EventVolunteerAssignmentDto>();

        // REQ-024 (E3.S3 Round-3 R3-H-S3-6): batch-load members so a 500-person shift produces
        // 1 DB query instead of 500. The previous per-id loop was a textbook N+1 on a hot
        // member-facing read path.
        var memberIds = visible.Select(a => a.MemberId).Distinct().ToList();
        var membersById = await _members.GetByIdsAsync(memberIds, cancellationToken);

        return visible.Select(a => new EventVolunteerAssignmentDto(
            a.Id, a.ShiftId, a.RoleId, a.MemberId,
            membersById.TryGetValue(a.MemberId, out var m) ? $"{m.FirstName} {m.LastName}".Trim() : "(unknown)",
            a.Status, a.Position, a.AssignedAt)).ToList();
    }
}
