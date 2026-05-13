using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): A single member's commitment to a volunteer shift. Tracks lifecycle
/// (Confirmed / Waitlisted / Cancelled), waitlist position when applicable, and audit fields.
///
/// <para>Concurrency note: insertions are guarded by the partial unique index
/// <c>ix_event_volunteer_assignments_shift_member_active</c> on
/// <c>(shift_id, member_id) WHERE status &lt;&gt; 'Cancelled'</c>; this is the database-level
/// last-resort for double-signup. The application protocol takes a <c>FOR UPDATE</c> lock on
/// the parent <see cref="EventVolunteerShift"/> row BEFORE reading capacity counts, so the
/// unique-index fallback only fires for honest races (see AC-6 / story decision D3).</para>
/// </summary>
public sealed class EventVolunteerAssignment : Entity
{
    public const int CancellationReasonMaxLength = 500;

    public Guid ShiftId { get; private set; }
    public Guid RoleId { get; private set; }
    public Guid MemberId { get; private set; }
    public VolunteerAssignmentStatus Status { get; private set; }
    public int? Position { get; private set; }
    public DateTime AssignedAt { get; private set; }
    public Guid AssignedBy { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancellationReason { get; private set; }

    /// <summary>
    /// REQ-024 (E3.S4): Timestamp when the 24h-pre-shift reminder email was dispatched.
    /// Set ONCE by <c>VolunteerShiftReminderJob</c> via the repository's mark-only path
    /// (<see cref="MarkReminderSent"/>) so the Hangfire job is idempotent across re-runs.
    /// </summary>
    public DateTime? ReminderSentAt { get; private set; }

    private EventVolunteerAssignment() { }

    public static EventVolunteerAssignment CreateConfirmed(Guid shiftId, Guid roleId, Guid memberId, Guid assignedBy)
    {
        ValidateFactoryInputs(shiftId, roleId, memberId, assignedBy);
        return new EventVolunteerAssignment
        {
            Id = Guid.NewGuid(),
            ShiftId = shiftId,
            RoleId = roleId,
            MemberId = memberId,
            Status = VolunteerAssignmentStatus.Confirmed,
            Position = null,
            AssignedAt = DateTime.UtcNow,
            AssignedBy = assignedBy,
        };
    }

    public static EventVolunteerAssignment CreateWaitlisted(
        Guid shiftId,
        Guid roleId,
        Guid memberId,
        Guid assignedBy,
        int position)
    {
        ValidateFactoryInputs(shiftId, roleId, memberId, assignedBy);
        if (position < 1)
            throw new ArgumentException("Waitlist position must be 1 or greater", nameof(position));
        return new EventVolunteerAssignment
        {
            Id = Guid.NewGuid(),
            ShiftId = shiftId,
            RoleId = roleId,
            MemberId = memberId,
            Status = VolunteerAssignmentStatus.Waitlisted,
            Position = position,
            AssignedAt = DateTime.UtcNow,
            AssignedBy = assignedBy,
        };
    }

    private static void ValidateFactoryInputs(Guid shiftId, Guid roleId, Guid memberId, Guid assignedBy)
    {
        if (shiftId == Guid.Empty) throw new ArgumentException("ShiftId is required", nameof(shiftId));
        if (roleId == Guid.Empty) throw new ArgumentException("RoleId is required", nameof(roleId));
        if (memberId == Guid.Empty) throw new ArgumentException("MemberId is required", nameof(memberId));
        if (assignedBy == Guid.Empty) throw new ArgumentException("AssignedBy is required", nameof(assignedBy));
    }

    public void PromoteFromWaitlist()
    {
        if (Status != VolunteerAssignmentStatus.Waitlisted)
            throw new InvalidOperationException("Assignment is not on the waitlist");
        Status = VolunteerAssignmentStatus.Confirmed;
        Position = null;
    }

    public void UpdateWaitlistPosition(int position)
    {
        if (Status != VolunteerAssignmentStatus.Waitlisted)
            throw new InvalidOperationException("Assignment is not on the waitlist");
        if (position < 1)
            throw new ArgumentException("Waitlist position must be 1 or greater", nameof(position));
        Position = position;
    }

    /// <summary>
    /// REQ-024 (E3.S4): Marks that the reminder email has been dispatched. Internal — only the
    /// repository's mark-only path may set this, to avoid concurrency clashes with a concurrent
    /// member withdraw / manager cancel.
    /// </summary>
    internal void MarkReminderSent(DateTime sentAtUtc)
    {
        ReminderSentAt = sentAtUtc;
    }

    public void Cancel(string? reason)
    {
        if (Status == VolunteerAssignmentStatus.Cancelled)
            throw new InvalidOperationException("Assignment is already cancelled");
        var trimmedReason = reason?.Trim();
        if (trimmedReason is { Length: > CancellationReasonMaxLength })
            throw new ArgumentException($"Cancellation reason cannot exceed {CancellationReasonMaxLength} characters", nameof(reason));
        Status = VolunteerAssignmentStatus.Cancelled;
        Position = null;
        CancelledAt = DateTime.UtcNow;
        CancellationReason = string.IsNullOrEmpty(trimmedReason) ? null : trimmedReason;
    }
}
