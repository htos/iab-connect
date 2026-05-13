namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3, post-review H-S3-6): Lifecycle status of an <see cref="EventVolunteerShift"/>.
/// <para><b>Active</b> — the default state; the shift accepts new assignments subject to the
/// per-shift policy flags (<c>AllowWaitlist</c>, <c>AllowSelfSignup</c>) and capacity.</para>
/// <para><b>Cancelled</b> — the shift has been explicitly cancelled by an event manager. New
/// self-signups and manager-assignments MUST be rejected. Existing non-cancelled assignments
/// were transactionally cancelled at the same time (see
/// <see cref="IabConnect.Application.Events.Volunteers.IEventVolunteerAssignmentService.CancelAllAssignmentsForShiftAsync"/>).</para>
/// </summary>
public enum VolunteerShiftStatus
{
    Active = 0,
    Cancelled = 1,
}
