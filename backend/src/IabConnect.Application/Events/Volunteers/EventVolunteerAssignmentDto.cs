using IabConnect.Domain.Events.Volunteers;

namespace IabConnect.Application.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Privacy-bounded API projection of <see cref="EventVolunteerAssignment"/>.
///
/// <para>Deliberately omits the assignee's contact data (<c>Email</c>, <c>Phone</c>,
/// <c>Address</c>, <c>KeycloakUserId</c>) and the manager's identity (<c>AssignedBy</c>)
/// — staff and members see only the display name on the roster. Mirrors the privacy bound
/// enforced in <see cref="IabConnect.Application.Members.Duplicates.DuplicateCandidateDto"/>
/// (Epic-2 retro lesson).</para>
/// </summary>
public sealed record EventVolunteerAssignmentDto(
    Guid Id,
    Guid ShiftId,
    Guid RoleId,
    Guid MemberId,
    string MemberDisplayName,
    VolunteerAssignmentStatus Status,
    int? Position,
    DateTime AssignedAt);
