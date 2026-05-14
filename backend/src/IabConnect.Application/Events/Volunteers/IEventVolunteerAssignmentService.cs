using IabConnect.Domain.Events.Volunteers;

namespace IabConnect.Application.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) story decision D10: Encapsulates the transactional, FOR-UPDATE-locked
/// assignment / cancellation flow. Lives in Application as an abstraction; Infrastructure
/// implements with EF Core (DbContext + BeginTransactionAsync + FromSqlInterpolated).
/// Mirrors the <see cref="IabConnect.Application.Members.IMemberMergeService"/> precedent.
/// </summary>
public interface IEventVolunteerAssignmentService
{
    /// <summary>
    /// Assigns a volunteer to a shift under a FOR UPDATE shift-row lock. Determines
    /// Confirmed vs Waitlisted based on capacity + flags. Used by both the manager-assign
    /// and member-self-signup paths.
    /// </summary>
    Task<VolunteerAssignmentResult> AssignAsync(
        Guid eventId,
        Guid shiftId,
        Guid memberId,
        Guid assignedBy,
        bool allowWaitlistFallback,
        bool isSelfSignup,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels a specific assignment. When the cancelled row was Confirmed and the shift has
    /// a waitlist, promotes the head of the waitlist and shifts remaining positions up by one
    /// — all inside the same transaction with a FOR UPDATE lock on the shift.
    /// <para><b>H-S3-2:</b> When <paramref name="eventId"/> is supplied (non-empty), the service
    /// asserts the assignment's parent shift belongs to that event and returns
    /// <see cref="VolunteerAssignmentOutcome.AssignmentNotFound"/> otherwise — prevents
    /// cross-event tampering via GUID-guessing on the URL.</para>
    /// <para><b>C1:</b> When <paramref name="callerMemberId"/> is supplied, the service asserts
    /// the caller is either the assignment's owner OR <paramref name="callerIsStaff"/> is true;
    /// otherwise it returns <see cref="VolunteerAssignmentOutcome.NotAuthorized"/>.</para>
    /// </summary>
    Task<VolunteerAssignmentResult> CancelAssignmentAsync(
        Guid assignmentId,
        string? reason,
        Guid eventId,
        Guid? callerMemberId,
        bool callerIsStaff,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cancels every non-cancelled assignment for a shift in a single transaction. Used by
    /// <c>CancelEventVolunteerShiftCommand</c>. Also flips the parent shift's
    /// <c>Status</c> to <see cref="VolunteerShiftStatus.Cancelled"/> per H-S3-6 so that
    /// subsequent <c>AssignAsync</c> calls return <see cref="VolunteerAssignmentOutcome.ShiftCancelled"/>.
    /// <para><b>H-S3-2:</b> Asserts the shift's parent event matches <paramref name="eventId"/>.</para>
    /// </summary>
    Task<CancelShiftServiceResult> CancelAllAssignmentsForShiftAsync(
        Guid eventId,
        Guid shiftId,
        string? reason,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-024 (E3.S3, post-review H-S3-5): Updates the shift's capacity under a FOR UPDATE
    /// row-lock so a concurrent self-signup at the old capacity cannot slip past the new
    /// lower bound. Re-reads the confirmed count inside the locked scope and delegates to
    /// <see cref="EventVolunteerShift.UpdateCapacity"/>. Returns the updated shift or a
    /// service-level failure outcome.
    /// <para><b>H-S3-2:</b> Asserts the shift's parent event matches <paramref name="eventId"/>.</para>
    /// </summary>
    Task<UpdateShiftCapacityResult> UpdateShiftCapacityAsync(
        Guid eventId,
        Guid shiftId,
        int newCapacity,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-024 (E3.S3 Round-3 R3-M-S3-1): Updates ALL of a shift's mutable fields under a
    /// single FOR UPDATE row-lock, closing the TOCTOU window between the locked capacity
    /// change and the subsequent unlocked field update. Callers previously did two-phase
    /// (capacity inside lock, fields outside) which allowed a concurrent writer to mutate
    /// the row between phases. This method applies capacity + title/description/dates/flags/
    /// notes inside the same transaction.
    /// <para><b>H-S3-2:</b> Asserts the shift's parent event matches <paramref name="eventId"/>.</para>
    /// </summary>
    Task<UpdateShiftCapacityResult> UpdateShiftAsync(
        Guid eventId,
        Guid shiftId,
        string title,
        string? description,
        DateTime startsAt,
        DateTime endsAt,
        int capacity,
        bool allowWaitlist,
        bool allowSelfSignup,
        string? notes,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-024 (E3.S3, post-review H-S3-5): Result of a locked capacity change.
/// </summary>
public sealed record UpdateShiftCapacityResult(
    UpdateShiftCapacityOutcome Outcome,
    int? NewCapacity,
    int? CurrentConfirmedCount);

public enum UpdateShiftCapacityOutcome
{
    Updated,
    ShiftNotFound,
    BelowCurrentConfirmed,
    InvalidCapacity,
}

/// <summary>
/// REQ-024 (E3.S3, post-review H-S3-6): Result of a bulk-cancel call. Distinguishes
/// "shift not found / belongs to another event" (404) from "successfully cancelled N rows".
///
/// <para>REQ-024 (E3.S3 Round-3 R3-H-S3-1): added <see cref="WrongEvent"/> to distinguish a
/// legitimate "shift does not exist" from a "shift exists but in another event" — the latter
/// is an attacker probing cross-event tampering and the endpoint emits a
/// <c>LogAccessDenied</c> audit row. The shared <see cref="ShiftFound"/> flag stays
/// <c>false</c> for both cases so the response is still opaque to the client.</para>
/// </summary>
public sealed record CancelShiftServiceResult(bool ShiftFound, int CancelledAssignmentCount, bool WrongEvent = false);

/// <summary>
/// REQ-024 (E3.S3): Typed result of an assignment-altering call. The endpoint maps each
/// <see cref="VolunteerAssignmentOutcome"/> to a specific HTTP shape per AC-5 / AC-8.
/// </summary>
public sealed record VolunteerAssignmentResult(
    VolunteerAssignmentOutcome Outcome,
    EventVolunteerAssignment? Assignment);

public enum VolunteerAssignmentOutcome
{
    Confirmed,
    Waitlisted,
    AlreadyAssigned,       // member already has a non-cancelled assignment for the shift
    ShiftFull,             // capacity reached, no waitlist permitted
    SignupNotAllowed,      // self-signup attempted but shift.AllowSelfSignup == false
    ShiftNotFound,
    AssignmentNotFound,
    Cancelled,             // returned by CancelAssignmentAsync on success

    /// <summary>Post-review H-S3-6: shift has been cancelled — assignment is rejected.</summary>
    ShiftCancelled,

    /// <summary>Post-review M-S3-2: assignment refers to a non-existent member.</summary>
    MemberNotFound,

    /// <summary>Post-review C1: caller is neither the assignment owner nor an event-staff role.</summary>
    NotAuthorized,

    /// <summary>
    /// Round-3 R3-M-S3-3: the calling Keycloak user has no linked <c>Member</c> record, so
    /// self-signup cannot resolve a member id. Previously surfaced as an
    /// <c>InvalidOperationException</c> mapped to 403 via string-message inspection.
    /// </summary>
    NoMemberLink,

    /// <summary>
    /// Round-3 R3-H-S3-3: a partial-unique-index race-loser saw the active row disappear
    /// between the rollback-to-savepoint and the re-fetch (concurrent caller cancelled it in
    /// the same millisecond). The endpoint maps to a 409 retry-style response rather than
    /// raising a raw <c>DbUpdateException</c> as a 500.
    /// </summary>
    Transient,
}
