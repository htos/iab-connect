using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-023 (E3.S2): Transactional, row-locked implementation of the check-in flow.
///
/// <para>Concurrency strategy is <b>option B</b> from story Decision D2 — a single
/// transaction wraps a <c>SELECT ... FOR UPDATE</c> row lock on the target registration,
/// the entity-level <c>CheckIn</c> mutation, and the <c>SaveChanges</c>. Two staff
/// scanning the same QR token concurrently observe exactly one
/// <see cref="CheckInOutcome.CheckedIn"/> and one <see cref="CheckInOutcome.AlreadyCheckedIn"/>;
/// the DB row carries a single <c>CheckedInAt</c> + <c>CheckedInBy</c>.</para>
///
/// <para>Mirrors <see cref="IabConnect.Infrastructure.Members.MemberMergeService"/> (REQ-018
/// E2.S3) — same <c>FromSqlInterpolated</c> + <c>FOR UPDATE</c> pattern. The lock is held
/// until the <see cref="Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction"/> commits
/// or rolls back, which is guaranteed by the surrounding <c>await using</c> block even if
/// an <see cref="OperationCanceledException"/> trips mid-flow.</para>
/// </summary>
public sealed class EventRegistrationCheckInService : IEventRegistrationCheckInService
{
    private readonly ApplicationDbContext _context;

    public EventRegistrationCheckInService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CheckInResultDto> CheckInByIdAsync(
        Guid eventId,
        Guid registrationId,
        Guid checkedInBy,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        var registration = await LockAndLoadByIdAsync(registrationId, cancellationToken);
        if (registration is null || registration.EventId != eventId)
        {
            return CheckInResultDto.NotFound();
        }

        var result = await ApplyCheckInAsync(registration, checkedInBy, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<CheckInResultDto> CheckInByQrCodeAsync(
        string qrCodeToken,
        Guid checkedInBy,
        CancellationToken cancellationToken = default)
    {
        // REQ-023 (E3.S2 Round-3 R3-M-S2-1): the previous structure opened the transaction
        // BEFORE the lock-and-load and then `return`-ed out of it on the "row deleted between
        // resolve and lock" path. `await using` did dispose the transaction on early return,
        // but the dispose-rollback semantics depend on the EF/Npgsql transaction provider being
        // in a state where rollback is meaningful — an opened-but-empty transaction is
        // technically a no-op but it briefly holds a connection and produces a stray
        // BEGIN/ROLLBACK pair in Postgres logs. The fix: resolve the token → id, open the
        // transaction, run the lock + apply path INSIDE a single guarded scope; the
        // "row deleted between resolve and lock" branch returns NotFound after an explicit
        // CommitAsync so the transaction visibly closes with no side effects.
        var resolved = await _context.EventRegistrations
            .AsNoTracking()
            .Where(r => r.QrCodeToken == qrCodeToken)
            .Select(r => new { r.Id })
            .FirstOrDefaultAsync(cancellationToken);

        if (resolved is null)
        {
            return CheckInResultDto.NotFound();
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        var registration = await LockAndLoadByIdAsync(resolved.Id, cancellationToken);
        if (registration is null)
        {
            // Row deleted between resolve and lock — close the (empty) transaction cleanly
            // so the connection state stays clean and the log shows a paired BEGIN/COMMIT.
            await transaction.CommitAsync(cancellationToken);
            return CheckInResultDto.NotFound();
        }

        var result = await ApplyCheckInAsync(registration, checkedInBy, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private async Task<EventRegistration?> LockAndLoadByIdAsync(
        Guid registrationId,
        CancellationToken cancellationToken)
    {
        // FOR UPDATE row-lock the registration row inside the active transaction. Lock is held
        // until the transaction commits or rolls back. Mirrors MemberMergeService (REQ-018 E2.S3).
        var rows = await _context.EventRegistrations
            .FromSqlInterpolated($"SELECT * FROM event_registrations WHERE id = {registrationId} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }

    private async Task<CheckInResultDto> ApplyCheckInAsync(
        EventRegistration registration,
        Guid checkedInBy,
        CancellationToken cancellationToken)
    {
        try
        {
            var checkInResult = registration.CheckIn(checkedInBy);

            if (!checkInResult.WasAlreadyCheckedIn)
            {
                await _context.SaveChangesAsync(cancellationToken);
                return CheckInResultDto.Success(EventRegistrationDto.FromEntity(registration));
            }

            return CheckInResultDto.Idempotent(EventRegistrationDto.FromEntity(registration));
        }
        catch (InvalidOperationException ex)
        {
            // R4-P-S2-1: the entity throws for every non-checkin-eligible status (Cancelled,
            // Waitlisted, Pending, NoShow — review H-S2-4). Map ALL of them to a typed Conflict
            // so the three endpoints return a uniform 409 (AC-5). The previous code only mapped
            // Cancelled/Waitlisted; Pending/NoShow fell through to the rethrow below and — since
            // the check-in endpoints have no try/catch — surfaced as an unhandled 500.
            return registration.Status switch
            {
                RegistrationStatus.Cancelled => CheckInResultDto.Cancelled(EventRegistrationDto.FromEntity(registration)),
                RegistrationStatus.Waitlisted => CheckInResultDto.Waitlisted(EventRegistrationDto.FromEntity(registration)),
                RegistrationStatus.Pending => CheckInResultDto.Pending(EventRegistrationDto.FromEntity(registration)),
                RegistrationStatus.NoShow => CheckInResultDto.NoShow(EventRegistrationDto.FromEntity(registration)),
                // Defensive: if the entity ever adds a new throw branch for a status not handled
                // here, surface it rather than silently swallow.
                _ => throw new InvalidOperationException(
                    $"Unexpected entity state '{registration.Status}' during check-in.", ex),
            };
        }
    }
}
