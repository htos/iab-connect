namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Repository for <see cref="EventVolunteerAssignment"/>. The methods mirror
/// <see cref="IEventRegistrationRepository"/> conventions for symmetric query patterns
/// (action item A2 — Symmetric-Guard checklist).
/// </summary>
public interface IEventVolunteerAssignmentRepository
{
    Task AddAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default);
    Task UpdateAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default);
    Task<EventVolunteerAssignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Inserts a new assignment; on race-loss against the partial-unique index
    /// <c>ix_event_volunteer_assignments_shift_member_active</c> returns the existing
    /// active row with <c>Created = false</c>. Application-layer code stays free of
    /// <c>DbUpdateException</c>. Mirrors
    /// <see cref="IabConnect.Domain.Members.IDuplicateCandidateDismissalRepository"/>.
    /// </summary>
    Task<(EventVolunteerAssignment Persisted, bool Created)> AddAtomicAsync(
        EventVolunteerAssignment assignment,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts active <see cref="VolunteerAssignmentStatus.Confirmed"/> assignments for a shift.
    /// Predicate is symmetric with <c>IEventRegistrationRepository.CountConfirmedAsync</c>:
    /// excludes cancelled / waitlisted rows.
    /// </summary>
    Task<int> CountConfirmedAsync(Guid shiftId, CancellationToken cancellationToken = default);

    Task<int> CountWaitlistedAsync(Guid shiftId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns waitlisted assignments for the shift ordered by <c>Position ASC</c>.
    /// </summary>
    Task<IReadOnlyList<EventVolunteerAssignment>> GetWaitlistAsync(Guid shiftId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EventVolunteerAssignment>> GetByShiftIdAsync(Guid shiftId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EventVolunteerAssignment>> GetByMemberIdAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns true when a non-cancelled assignment exists for the (shift, member) pair.
    /// Used by the no-double-signup pre-check.
    /// </summary>
    Task<bool> ExistsActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads the active (non-cancelled) assignment for the (shift, member) pair, if any.
    /// </summary>
    Task<EventVolunteerAssignment?> GetActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-024 (E3.S4): Mark-only write of <see cref="EventVolunteerAssignment.ReminderSentAt"/>
    /// via <c>ExecuteUpdate</c> (no aggregate load). Returns true when the row was updated.
    /// Avoids optimistic-concurrency clashes with concurrent withdraw/cancel.
    /// </summary>
    Task<bool> MarkReminderSentAsync(Guid assignmentId, DateTime sentAtUtc, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-024 (E3.S4): Returns Confirmed assignments whose parent shift starts within the
    /// supplied window and whose reminder has NOT yet been sent. Used by the daily reminder job.
    /// Excludes assignments whose parent event is <c>EventStatus.Cancelled</c>.
    /// </summary>
    Task<IReadOnlyList<VolunteerReminderDueRow>> GetRemindersDueAsync(
        DateTime windowStartUtc,
        DateTime windowEndUtc,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-024 (E3.S4): Projection row returned by <see cref="IEventVolunteerAssignmentRepository.GetRemindersDueAsync"/>.
/// Bundles the four entities the notification builder needs in a single query.
/// </summary>
public sealed record VolunteerReminderDueRow(
    EventVolunteerAssignment Assignment,
    EventVolunteerShift Shift,
    EventVolunteerRole Role,
    IabConnect.Domain.Events.Event Event);
