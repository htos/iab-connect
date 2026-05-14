using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-024 (E3.S3): EF-backed repository for <see cref="EventVolunteerAssignment"/>.
/// </summary>
public sealed class EventVolunteerAssignmentRepository : IEventVolunteerAssignmentRepository
{
    /// <summary>Postgres SQLSTATE for unique-violation; used by the AddAtomicAsync race-recovery path.</summary>
    private const string UniqueViolationSqlState = "23505";

    private readonly ApplicationDbContext _context;

    public EventVolunteerAssignmentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default)
    {
        await _context.EventVolunteerAssignments.AddAsync(assignment, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default)
    {
        _context.EventVolunteerAssignments.Update(assignment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public Task<EventVolunteerAssignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.EventVolunteerAssignments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public async Task<(EventVolunteerAssignment? Persisted, bool Created)> AddAtomicAsync(
        EventVolunteerAssignment assignment,
        CancellationToken cancellationToken = default)
    {
        // REQ-024 (E3.S3, post-review H-S3-1): SAVEPOINT/ROLLBACK TO so the outer transaction
        // survives a unique-violation. Without this, the outer Postgres transaction is left
        // in `aborted` state and the subsequent GetActiveForMemberAsync re-fetch raises
        // SQLSTATE 25P02 (in_failed_sql_transaction). When the caller has not opened an
        // outer transaction we skip the savepoint dance entirely — EF Core auto-creates an
        // implicit transaction per SaveChangesAsync, so the legacy single-call path keeps
        // working unchanged.
        const string savepoint = "add_assignment";
        var outerTransaction = _context.Database.CurrentTransaction;
        if (outerTransaction is not null)
            await outerTransaction.CreateSavepointAsync(savepoint, cancellationToken);

        await _context.EventVolunteerAssignments.AddAsync(assignment, cancellationToken);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            if (outerTransaction is not null)
                await outerTransaction.ReleaseSavepointAsync(savepoint, cancellationToken);
            return (assignment, true);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == UniqueViolationSqlState)
        {
            // Partial unique index ix_event_volunteer_assignments_shift_member_active fired.
            // Roll back to the savepoint so the outer tx is reusable; discard the just-Added
            // entry from the change tracker; then re-fetch the existing active row for the pair.
            if (outerTransaction is not null)
                await outerTransaction.RollbackToSavepointAsync(savepoint, cancellationToken);
            _context.Entry(assignment).State = EntityState.Detached;

            // REQ-024 (E3.S3 Round-3 R3-H-S3-3): if the existing row vanished between the
            // unique-violation and the re-fetch (a concurrent caller cancelled it in the same
            // millisecond), surface the transient race rather than rethrowing the raw
            // DbUpdateException (which the service would propagate as a 500). When `existing`
            // is non-null we return it (the caller treats it as AlreadyAssigned, identical to
            // pre-fix behavior); when null we return the (null, false) sentinel that the
            // caller maps to VolunteerAssignmentOutcome.Transient → 409.
            var existing = await GetActiveForMemberAsync(assignment.ShiftId, assignment.MemberId, cancellationToken);
            return (existing, false);
        }
        catch (DbUpdateException)
        {
            // R4-P-S3-8: any OTHER DbUpdateException (notably SQLSTATE 23503 foreign-key
            // violation — the documented MemberNotFound case) also leaves the outer Postgres
            // transaction in `aborted` state. The previous code let it escape WITHOUT rolling
            // back to the savepoint, so the outer transaction was only salvaged by `await using`
            // disposal — fragile if any code is later added between the service's catch and the
            // dispose. Roll back to the savepoint here so the transaction stays reusable and the
            // savepoint bookkeeping is symmetric with the unique-violation path, then rethrow for
            // the service layer to translate (AssignAsync maps 23503 → MemberNotFound).
            if (outerTransaction is not null)
                await outerTransaction.RollbackToSavepointAsync(savepoint, cancellationToken);
            _context.Entry(assignment).State = EntityState.Detached;
            throw;
        }
    }

    public Task<int> CountConfirmedAsync(Guid shiftId, CancellationToken cancellationToken = default)
        => _context.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId && a.Status == VolunteerAssignmentStatus.Confirmed)
            .CountAsync(cancellationToken);

    public Task<int> CountWaitlistedAsync(Guid shiftId, CancellationToken cancellationToken = default)
        => _context.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId && a.Status == VolunteerAssignmentStatus.Waitlisted)
            .CountAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, (int Confirmed, int Waitlisted)>> GetShiftCountsAsync(
        IReadOnlyCollection<Guid> shiftIds,
        CancellationToken cancellationToken = default)
    {
        if (shiftIds.Count == 0)
            return new Dictionary<Guid, (int, int)>();

        // R3-H-S3-5: single SQL `GROUP BY (shift_id, status) COUNT(*)` translates to a single
        // Postgres aggregate; replaces 2N+2 per-shift round-trips with one. Status filter is the
        // same as CountConfirmedAsync / CountWaitlistedAsync (Cancelled rows excluded by neither
        // predicate firing).
        var groups = await _context.EventVolunteerAssignments
            .Where(a => shiftIds.Contains(a.ShiftId)
                     && (a.Status == VolunteerAssignmentStatus.Confirmed
                      || a.Status == VolunteerAssignmentStatus.Waitlisted))
            .GroupBy(a => new { a.ShiftId, a.Status })
            .Select(g => new { g.Key.ShiftId, g.Key.Status, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, (int Confirmed, int Waitlisted)>(shiftIds.Count);
        foreach (var row in groups)
        {
            result.TryGetValue(row.ShiftId, out var prior);
            if (row.Status == VolunteerAssignmentStatus.Confirmed)
                result[row.ShiftId] = (row.Count, prior.Waitlisted);
            else
                result[row.ShiftId] = (prior.Confirmed, row.Count);
        }
        return result;
    }

    public async Task<IReadOnlyList<EventVolunteerAssignment>> GetWaitlistAsync(Guid shiftId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId && a.Status == VolunteerAssignmentStatus.Waitlisted)
            .OrderBy(a => a.Position)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<EventVolunteerAssignment>> GetByShiftIdAsync(Guid shiftId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId)
            .OrderBy(a => a.Status)
            .ThenBy(a => a.Position ?? int.MaxValue)
            .ThenBy(a => a.AssignedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<EventVolunteerAssignment>> GetByMemberIdAsync(Guid memberId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerAssignments
            .Where(a => a.MemberId == memberId)
            .OrderByDescending(a => a.AssignedAt)
            .ToListAsync(cancellationToken);

    public Task<bool> ExistsActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default)
        => _context.EventVolunteerAssignments
            .AnyAsync(a => a.ShiftId == shiftId
                        && a.MemberId == memberId
                        && a.Status != VolunteerAssignmentStatus.Cancelled,
                cancellationToken);

    public Task<EventVolunteerAssignment?> GetActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default)
        => _context.EventVolunteerAssignments
            .FirstOrDefaultAsync(a => a.ShiftId == shiftId
                                   && a.MemberId == memberId
                                   && a.Status != VolunteerAssignmentStatus.Cancelled,
                cancellationToken);

    public async Task<bool> MarkReminderSentAsync(Guid assignmentId, DateTime sentAtUtc, CancellationToken cancellationToken = default)
    {
        var rows = await _context.EventVolunteerAssignments
            .Where(a => a.Id == assignmentId && a.ReminderSentAt == null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(a => a.ReminderSentAt, sentAtUtc),
                cancellationToken);
        return rows > 0;
    }

    public async Task<IReadOnlyList<VolunteerReminderDueRow>> GetRemindersDueAsync(
        DateTime windowStartUtc,
        DateTime windowEndUtc,
        CancellationToken cancellationToken = default)
    {
        var rows = await (
            from a in _context.EventVolunteerAssignments
            join s in _context.EventVolunteerShifts on a.ShiftId equals s.Id
            join r in _context.EventVolunteerRoles on a.RoleId equals r.Id
            join e in _context.Events on s.EventId equals e.Id
            join m in _context.Members on a.MemberId equals m.Id
            where a.Status == VolunteerAssignmentStatus.Confirmed
                  && a.ReminderSentAt == null
                  && s.StartsAt >= windowStartUtc
                  && s.StartsAt <= windowEndUtc
                  && e.Status != IabConnect.Domain.Events.EventStatus.Cancelled
                  // REQ-024 (E3.S4 review H-S4-5): exclude cancelled shifts — the H-S3-6 fix
                  // added VolunteerShiftStatus, and reminders for a cancelled shift would be
                  // misleading even though the assignment status hasn't been cascade-updated.
                  && s.Status != VolunteerShiftStatus.Cancelled
                  // REQ-024 (E3.S4 Round-3 R3-M-S4-5): member-status filter at the DB layer so
                  // Inactive / merged-into members never even surface in the due-set. The
                  // VolunteerShiftReminderService has a defense-in-depth in-memory check as
                  // well, but pulling the filter into the SQL avoids the unnecessary load and
                  // the noisy log entry for skipped rows.
                  && m.Status == MembershipStatus.Active
                  && m.MergedIntoMemberId == null
            select new { Assignment = a, Shift = s, Role = r, Event = e })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return rows.Select(x => new VolunteerReminderDueRow(x.Assignment, x.Shift, x.Role, x.Event)).ToList();
    }
}
