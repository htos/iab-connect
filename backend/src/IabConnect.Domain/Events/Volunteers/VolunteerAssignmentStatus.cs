namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Lifecycle status of an <see cref="EventVolunteerAssignment"/>.
/// </summary>
public enum VolunteerAssignmentStatus
{
    Confirmed,
    Waitlisted,
    Cancelled,
}
