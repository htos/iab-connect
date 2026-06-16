using IabConnect.Application.Events.Volunteers;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IabConnect.Infrastructure.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3) story decision D10: Transactional, FOR-UPDATE-locked implementation of
/// the volunteer-assignment service. Two staff hitting <c>/manual-assign</c> (or two members
/// hitting <c>/self-signup</c>) for the same one-slot shift observe exactly one Confirmed
/// and one (Waitlisted or rejected), guaranteed by the shift-row lock + the partial unique
/// index on <c>(shift_id, member_id) WHERE status &lt;&gt; 'Cancelled'</c>.
/// Mirrors the <see cref="IabConnect.Infrastructure.Members.MemberMergeService"/> pattern.
/// <para>
/// Post-Epic-3 review patches: H-S3-1 (savepoint in <see cref="EventVolunteerAssignmentRepository.AddAtomicAsync"/>),
/// H-S3-2 (cross-event checks), H-S3-6 (shift cancellation state), M-S3-2 (FK violation
/// translates to <see cref="VolunteerAssignmentOutcome.MemberNotFound"/>),
/// M-S3-4 (<c>FirstOrDefaultAsync</c> on the race-disappeared row), and the H-S3-3 doc note.
/// </para>
/// </summary>
public sealed class EventVolunteerAssignmentService : IEventVolunteerAssignmentService
{
    /// <summary>Postgres SQLSTATE for foreign-key violation (member_id RESTRICT / missing row).</summary>
    private const string ForeignKeyViolationSqlState = "23503";

    private readonly ApplicationDbContext _context;
    private readonly IEventVolunteerAssignmentRepository _assignmentRepository;

    public EventVolunteerAssignmentService(
        ApplicationDbContext context,
        IEventVolunteerAssignmentRepository assignmentRepository)
    {
        _context = context;
        _assignmentRepository = assignmentRepository;
    }

    public async Task<VolunteerAssignmentResult> AssignAsync(
        Guid eventId,
        Guid shiftId,
        Guid memberId,
        Guid assignedBy,
        bool allowWaitlistFallback,
        bool isSelfSignup,
        CancellationToken cancellationToken = default)
    {
        return await _context.ExecuteTransactionalAsync(async () =>
        {
            // FOR UPDATE row lock on the shift — serialises capacity decisions across concurrent calls.
            // H-S3-3 note: the count / idempotency queries below run on the SAME DbContext / Npgsql
            // connection that holds this transaction; Npgsql's connection-affinity inside an
            // ApplicationDbContext guarantees they participate in the FOR UPDATE scope. The
            // EventVolunteerAssignmentConcurrencyTests two-task race tests prove the property
            // (one Confirmed + one Waitlisted/ShiftFull on every run). DO NOT switch to a query
            // executed on a separate context — it would bypass the lock.
            var shifts = await _context.EventVolunteerShifts
                .FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {shiftId} FOR UPDATE")
                .AsTracking()
                .ToListAsync(cancellationToken);
            if (shifts.Count == 0)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftNotFound, null);

            var shift = shifts[0];
            if (shift.EventId != eventId)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftNotFound, null);

            // H-S3-6: reject assignments on a cancelled shift.
            if (shift.Status == VolunteerShiftStatus.Cancelled)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftCancelled, null);

            if (isSelfSignup && !shift.AllowSelfSignup)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.SignupNotAllowed, null);

            // Idempotent: if the member already has an active assignment on this shift, return it.
            var existing = await _assignmentRepository.GetActiveForMemberAsync(shiftId, memberId, cancellationToken);
            if (existing is not null)
            {
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AlreadyAssigned, existing);
            }

            var confirmedCount = await _assignmentRepository.CountConfirmedAsync(shiftId, cancellationToken);
            var slotAvailable = confirmedCount < shift.Capacity;

            EventVolunteerAssignment assignment;
            VolunteerAssignmentOutcome outcome;

            if (slotAvailable)
            {
                assignment = EventVolunteerAssignment.CreateConfirmed(shift.Id, shift.RoleId, memberId, assignedBy);
                outcome = VolunteerAssignmentOutcome.Confirmed;
            }
            else if (shift.AllowWaitlist && allowWaitlistFallback)
            {
                var waitlistCount = await _assignmentRepository.CountWaitlistedAsync(shiftId, cancellationToken);
                assignment = EventVolunteerAssignment.CreateWaitlisted(
                    shift.Id, shift.RoleId, memberId, assignedBy, position: waitlistCount + 1);
                outcome = VolunteerAssignmentOutcome.Waitlisted;
            }
            else
            {
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftFull, null);
            }

            try
            {
                var (persisted, created) = await _assignmentRepository.AddAtomicAsync(assignment, cancellationToken);

                if (!created)
                {
                    // R3-H-S3-3: the repository returns `(null, false)` when the unique-violation
                    // fired AND the re-fetch of the existing active row also returned null (a
                    // concurrent caller cancelled the racing row in the same millisecond). Map
                    // this to a typed Transient outcome so the endpoint can surface a clean 409
                    // retry-style response rather than a 500.
                    if (persisted is null)
                    {
                        return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Transient, null);
                    }

                    // Honest race-loser: the partial unique index fired between our pre-check and insert.
                    // Return the winning row as AlreadyAssigned.
                    return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AlreadyAssigned, persisted);
                }

                return new VolunteerAssignmentResult(outcome, persisted);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == ForeignKeyViolationSqlState)
            {
                // M-S3-2: a non-existent member id surfaces as a foreign-key violation on insert.
                // Translate to a domain-meaningful outcome the endpoint maps to 404.
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.MemberNotFound, null);
            }
        }, cancellationToken);
    }

    public async Task<VolunteerAssignmentResult> CancelAssignmentAsync(
        Guid assignmentId,
        string? reason,
        Guid eventId,
        Guid? callerMemberId,
        bool callerIsStaff,
        CancellationToken cancellationToken = default)
    {
        // M-S3-4: FirstOrDefaultAsync — handle race-disappeared row cleanly.
        var assignment = await _context.EventVolunteerAssignments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == assignmentId, cancellationToken);
        if (assignment is null)
            return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null);

        // C1 + R4-P-S3-5: caller-ownership / staff check BEFORE we touch state. Fails CLOSED —
        // a non-staff caller with no resolved member id is rejected rather than allowed through.
        // The previous `callerMemberId.HasValue &&` short-circuit let a (callerMemberId: null,
        // callerIsStaff: false) caller cancel anyone's assignment; it only worked because the
        // command handler happened to reject that case first.
        if (!callerIsStaff && (callerMemberId is null || callerMemberId.Value != assignment.MemberId))
            return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.NotAuthorized, null);

        // H-S3-2: confirm the assignment's parent shift belongs to the route's event.
        if (eventId != Guid.Empty)
        {
            var parentEventId = await _context.EventVolunteerShifts
                .Where(s => s.Id == assignment.ShiftId)
                .Select(s => (Guid?)s.EventId)
                .FirstOrDefaultAsync(cancellationToken);
            if (parentEventId is null || parentEventId.Value != eventId)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null);
        }

        return await _context.ExecuteTransactionalAsync(async () =>
        {
            // Lock the shift to serialise position-shift logic against concurrent assigns.
            var shifts = await _context.EventVolunteerShifts
                .FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {assignment.ShiftId} FOR UPDATE")
                .AsTracking()
                .ToListAsync(cancellationToken);
            if (shifts.Count == 0)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftNotFound, null);

            // R4-P-S3-6: re-assert the H-S3-2 cross-event check against the LOCKED shift row, not
            // only the pre-transaction snapshot. shifts[0] is the assignment's parent shift, so its
            // EventId is authoritative here.
            if (eventId != Guid.Empty && shifts[0].EventId != eventId)
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null);

            // M-S3-4: a concurrent caller may have deleted the row between the AsNoTracking read and
            // the lock. FirstOrDefaultAsync handles the race-disappeared case cleanly.
            var tracked = await _context.EventVolunteerAssignments
                .FirstOrDefaultAsync(a => a.Id == assignmentId, cancellationToken);
            if (tracked is null)
            {
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null);
            }

            // R4-P-S3-6: re-assert the C1 ownership check against the locked entity. MemberId is
            // immutable today, so this is defense-in-depth — but it closes the TOCTOU window so a
            // future mutable-MemberId change cannot silently reopen the authorization gap.
            if (!callerIsStaff && (callerMemberId is null || callerMemberId.Value != tracked.MemberId))
            {
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.NotAuthorized, null);
            }
            if (tracked.Status == VolunteerAssignmentStatus.Cancelled)
            {
                // Idempotent: already cancelled.
                return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Cancelled, tracked);
            }

            var wasConfirmed = tracked.Status == VolunteerAssignmentStatus.Confirmed;
            var cancelledPosition = tracked.Position;

            tracked.Cancel(reason);
            await _context.SaveChangesAsync(cancellationToken);

            if (wasConfirmed)
            {
                // Promote the head of the waitlist (if any) and shift remaining positions up by one.
                var waitlist = await _context.EventVolunteerAssignments
                    .Where(a => a.ShiftId == tracked.ShiftId && a.Status == VolunteerAssignmentStatus.Waitlisted)
                    .OrderBy(a => a.Position)
                    .ToListAsync(cancellationToken);

                if (waitlist.Count > 0)
                {
                    waitlist[0].PromoteFromWaitlist();
                    for (int i = 1; i < waitlist.Count; i++)
                    {
                        waitlist[i].UpdateWaitlistPosition(i);
                    }
                    await _context.SaveChangesAsync(cancellationToken);
                }
            }
            else if (cancelledPosition is not null)
            {
                // Waitlisted assignment was cancelled — shift positions > cancelled.Position down by one.
                var below = await _context.EventVolunteerAssignments
                    .Where(a => a.ShiftId == tracked.ShiftId
                                && a.Status == VolunteerAssignmentStatus.Waitlisted
                                && a.Position > cancelledPosition)
                    .OrderBy(a => a.Position)
                    .ToListAsync(cancellationToken);
                foreach (var item in below)
                {
                    item.UpdateWaitlistPosition(item.Position!.Value - 1);
                }
                if (below.Count > 0)
                    await _context.SaveChangesAsync(cancellationToken);
            }

            return new VolunteerAssignmentResult(VolunteerAssignmentOutcome.Cancelled, tracked);
        }, cancellationToken);
    }

    public async Task<CancelShiftServiceResult> CancelAllAssignmentsForShiftAsync(
        Guid eventId,
        Guid shiftId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        return await _context.ExecuteTransactionalAsync(async () =>
        {
            var shifts = await _context.EventVolunteerShifts
                .FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {shiftId} FOR UPDATE")
                .AsTracking()
                .ToListAsync(cancellationToken);
            if (shifts.Count == 0)
            {
                return new CancelShiftServiceResult(ShiftFound: false, CancelledAssignmentCount: 0);
            }

            var shift = shifts[0];
            // H-S3-2 + R3-H-S3-1: reject when the shift belongs to a different event. The
            // WrongEvent flag lets the endpoint distinguish probing (audit-log + 404) from genuine
            // not-found (404 only). The client-visible body is identical to keep the response
            // opaque.
            if (eventId != Guid.Empty && shift.EventId != eventId)
            {
                return new CancelShiftServiceResult(
                    ShiftFound: false,
                    CancelledAssignmentCount: 0,
                    WrongEvent: true);
            }

            // REQ-024 (E3.S3 Round-3 R3-M-S3-2): use ExecuteUpdate so concurrent CancelAssignment
            // calls cannot lose-update us. ExecuteUpdate runs a single SQL UPDATE … WHERE status
            // <> 'Cancelled', which is atomic at the row level; rows that another writer already
            // cancelled in parallel keep their specific reason / timestamp. The previous load-
            // then-foreach pattern would silently overwrite a more specific cancellation reason
            // recorded by a concurrent caller.
            // We capture nowUtc once at the start so the audit timestamp is stable across the batch.
            var nowUtc = DateTime.UtcNow;
            var cancelledCount = await _context.EventVolunteerAssignments
                .Where(a => a.ShiftId == shiftId && a.Status != VolunteerAssignmentStatus.Cancelled)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.Status, VolunteerAssignmentStatus.Cancelled)
                    .SetProperty(a => a.CancelledAt, nowUtc)
                    .SetProperty(a => a.CancellationReason, reason)
                    // R4-P-S3-7: the per-row domain EventVolunteerAssignment.Cancel() clears Position;
                    // this bulk path bypasses the change tracker, so clear it explicitly to keep the
                    // "Cancelled rows never carry a Position" invariant the single-row path guarantees.
                    .SetProperty(a => a.Position, (int?)null),
                    cancellationToken);

            // H-S3-6: flip the parent shift's status so subsequent self-signups are rejected.
            // The shift entity itself is tracked, so its mutation needs SaveChangesAsync.
            shift.Cancel(reason);
            await _context.SaveChangesAsync(cancellationToken);

            return new CancelShiftServiceResult(ShiftFound: true, CancelledAssignmentCount: cancelledCount);
        }, cancellationToken);
    }

    public async Task<UpdateShiftCapacityResult> UpdateShiftCapacityAsync(
        Guid eventId,
        Guid shiftId,
        int newCapacity,
        CancellationToken cancellationToken = default)
    {
        if (newCapacity < 1)
            return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.InvalidCapacity, null, null);

        return await _context.ExecuteTransactionalAsync(async () =>
        {
            // FOR UPDATE — serialise capacity reads with concurrent self-signup/manager-assign callers.
            var shifts = await _context.EventVolunteerShifts
                .FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {shiftId} FOR UPDATE")
                .AsTracking()
                .ToListAsync(cancellationToken);
            if (shifts.Count == 0)
            {
                return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.ShiftNotFound, null, null);
            }

            var shift = shifts[0];
            if (eventId != Guid.Empty && shift.EventId != eventId)
            {
                return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.ShiftNotFound, null, null);
            }

            // Re-read confirmed count UNDER the lock — this is the H-S3-5 fix.
            var confirmed = await _assignmentRepository.CountConfirmedAsync(shiftId, cancellationToken);
            if (newCapacity < confirmed)
            {
                return new UpdateShiftCapacityResult(
                    UpdateShiftCapacityOutcome.BelowCurrentConfirmed,
                    newCapacity,
                    confirmed);
            }

            shift.UpdateCapacity(newCapacity, confirmed);
            await _context.SaveChangesAsync(cancellationToken);
            return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.Updated, newCapacity, confirmed);
        }, cancellationToken);
    }

    public async Task<UpdateShiftCapacityResult> UpdateShiftAsync(
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
        CancellationToken cancellationToken = default)
    {
        if (capacity < 1)
            return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.InvalidCapacity, null, null);

        // REQ-024 (E3.S3 Round-3 R3-M-S3-1): single FOR UPDATE transaction over capacity AND
        // field updates so a concurrent writer cannot mutate the row between the two phases.
        return await _context.ExecuteTransactionalAsync(async () =>
        {
            var shifts = await _context.EventVolunteerShifts
                .FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {shiftId} FOR UPDATE")
                .AsTracking()
                .ToListAsync(cancellationToken);
            if (shifts.Count == 0)
            {
                return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.ShiftNotFound, null, null);
            }

            var shift = shifts[0];
            if (eventId != Guid.Empty && shift.EventId != eventId)
            {
                return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.ShiftNotFound, null, null);
            }

            if (capacity != shift.Capacity)
            {
                var confirmed = await _assignmentRepository.CountConfirmedAsync(shiftId, cancellationToken);
                if (capacity < confirmed)
                {
                    return new UpdateShiftCapacityResult(
                        UpdateShiftCapacityOutcome.BelowCurrentConfirmed,
                        capacity,
                        confirmed);
                }
                shift.UpdateCapacity(capacity, confirmed);
            }

            shift.UpdateDetails(title, description, startsAt, endsAt, allowWaitlist, allowSelfSignup, notes);
            await _context.SaveChangesAsync(cancellationToken);
            return new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.Updated, capacity, null);
        }, cancellationToken);
    }
}
