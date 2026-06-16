using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9 cleanup): transactional, row-locked
/// implementation of calendar-token rotate + revoke.
///
/// <para>A single transaction wraps a <c>SELECT ... FOR UPDATE</c> row lock on the calling
/// member, the entity mutation, and the <c>SaveChanges</c>. Two rotate calls from the same
/// member (a double-click) now serialise: the second observes the first's persisted hash,
/// so the token returned to each caller always matches what is stored. Mirrors
/// <see cref="EventRegistrationCheckInService"/> / <c>MemberMergeService</c> — the
/// transaction primitive stays in Infrastructure, the Application layer stays EF-free.</para>
/// </summary>
public sealed class CalendarTokenService : ICalendarTokenService
{
    private readonly ApplicationDbContext _context;
    private readonly byte[]? _pepper;

    public CalendarTokenService(
        ApplicationDbContext context,
        IOptions<CalendarTokenOptions> calendarTokenOptions)
    {
        _context = context;
        _pepper = calendarTokenOptions.Value.PepperBytes;
    }

    public async Task<CalendarTokenRotationResult> RotateAsync(
        Guid keycloakUserId,
        CancellationToken cancellationToken = default)
    {
        // Retrying-strategy compatible: the FOR UPDATE row lock, the mutation, and the SaveChanges
        // run as one retriable transactional unit (a raw BeginTransactionAsync is rejected under
        // EnableRetryOnFailure). Returning from the delegate commits — releasing the lock on the
        // not-found path too.
        return await _context.ExecuteTransactionalAsync(async () =>
        {
            var member = await LockAndLoadByKeycloakIdAsync(keycloakUserId, cancellationToken);
            if (member is null)
                return CalendarTokenRotationResult.NotFound();

            // Epic-3-retro §9 (R3-H-S5-3): HMAC-key the stored hash with the configured pepper when
            // one is set; null pepper keeps the backwards-compatible plain SHA-256.
            var token = member.RegenerateCalendarToken(_pepper);
            await _context.SaveChangesAsync(cancellationToken);
            return CalendarTokenRotationResult.Rotated(member.Id, token);
        }, cancellationToken);
    }

    public async Task<bool> RevokeAsync(
        Guid keycloakUserId,
        CancellationToken cancellationToken = default)
    {
        // Retrying-strategy compatible (see RotateAsync): lock + mutate + SaveChanges as one
        // retriable unit; the delegate's return commits and releases the FOR UPDATE lock.
        return await _context.ExecuteTransactionalAsync(async () =>
        {
            var member = await LockAndLoadByKeycloakIdAsync(keycloakUserId, cancellationToken);
            if (member is null)
                return false;

            member.RevokeCalendarToken();
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }, cancellationToken);
    }

    /// <summary>
    /// FOR UPDATE row-locks the member row inside the active transaction. The lock is held
    /// until the transaction commits. Mirrors <c>MemberMergeService</c>'s lock on the
    /// <c>members</c> table. Merged-retired members are excluded — a soft-retired member must
    /// not rotate a feed credential — matching <c>MemberRepository.GetByKeycloakUserIdAsync</c>.
    /// </summary>
    private async Task<Member?> LockAndLoadByKeycloakIdAsync(
        Guid keycloakUserId,
        CancellationToken cancellationToken)
    {
        var rows = await _context.Members
            .FromSqlInterpolated(
                $"SELECT * FROM members WHERE keycloak_user_id = {keycloakUserId} AND merged_into_member_id IS NULL FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        return rows.Count == 0 ? null : rows[0];
    }
}
