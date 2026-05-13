using IabConnect.Domain.Events.Volunteers;

namespace IabConnect.Application.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): API-facing projection of <see cref="EventVolunteerShift"/>.
/// ConfirmedCount + WaitlistCount come from the assignment repository's counters.
/// </summary>
public sealed record EventVolunteerShiftDto(
    Guid Id,
    Guid EventId,
    Guid RoleId,
    string RoleName,
    string Title,
    string? Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int Capacity,
    int ConfirmedCount,
    int WaitlistCount,
    bool AllowWaitlist,
    bool AllowSelfSignup,
    string? Notes,
    DateTime CreatedAt)
{
    public static EventVolunteerShiftDto FromEntity(
        EventVolunteerShift shift,
        string roleName,
        int confirmedCount,
        int waitlistCount) =>
        new(shift.Id, shift.EventId, shift.RoleId, roleName, shift.Title, shift.Description,
            shift.StartsAt, shift.EndsAt, shift.Capacity, confirmedCount, waitlistCount,
            shift.AllowWaitlist, shift.AllowSelfSignup, shift.Notes, shift.CreatedAt);
}
