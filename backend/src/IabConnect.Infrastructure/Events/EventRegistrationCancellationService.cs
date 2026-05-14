using IabConnect.Application.Events;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-021 (E3.S2 H-S2-5 / Epic-3-retro §9 cleanup): transactional, row-locked implementation
/// of registration cancellation + waitlist promotion.
///
/// <para>A single transaction wraps a <c>FOR UPDATE</c> lock on the event row, a
/// <c>FOR UPDATE</c> lock on the registration row, the <c>Cancel</c> mutation, and the
/// waitlist promotion. The event-row lock serialises every cancellation for that event, so
/// two concurrent cancellations promote two distinct waitlisted registrations rather than
/// racing on the same "next on waitlist" read. Lock order is event-then-registration
/// throughout; the check-in service only ever locks the registration row, so the two paths
/// cannot deadlock. Mirrors <see cref="EventRegistrationCheckInService"/> /
/// <c>MemberMergeService</c>.</para>
/// </summary>
public sealed class EventRegistrationCancellationService : IEventRegistrationCancellationService
{
    private readonly ApplicationDbContext _context;

    public EventRegistrationCancellationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<CancelRegistrationResult> CancelAsync(
        Guid eventId,
        Guid registrationId,
        string? reason,
        bool cancelledByParticipant,
        CancellationToken cancellationToken = default)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // Lock the event row first — the serialisation point for every cancel/promote on this
        // event. Two concurrent cancellations now queue here instead of both reading the same
        // "next on waitlist" row.
        var evt = await LockEventAsync(eventId, cancellationToken);
        if (evt is null)
        {
            await transaction.CommitAsync(cancellationToken);
            return CancelRegistrationResult.NotFound();
        }

        // Lock the registration row — serialises against a concurrent check-in on the same row.
        var registration = await LockRegistrationAsync(registrationId, cancellationToken);
        if (registration is null || registration.EventId != eventId)
        {
            await transaction.CommitAsync(cancellationToken);
            return CancelRegistrationResult.NotFound();
        }

        registration.Cancel(reason, cancelledByParticipant);

        EventRegistration? promoted = null;
        if (evt.WaitlistEnabled)
        {
            // Read the next waitlisted registration under the event lock — no other cancel for
            // this event can be reading it concurrently.
            promoted = await _context.EventRegistrations
                .Where(r => r.EventId == eventId
                            && r.IsWaitlisted
                            && r.Status == RegistrationStatus.Waitlisted)
                .OrderBy(r => r.WaitlistPosition)
                .FirstOrDefaultAsync(cancellationToken);
            promoted?.PromoteFromWaitlist();
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return CancelRegistrationResult.Cancelled(registration, promoted, evt);
    }

    private async Task<Event?> LockEventAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var rows = await _context.Events
            .FromSqlInterpolated($"SELECT * FROM events WHERE id = {eventId} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);
        return rows.Count == 0 ? null : rows[0];
    }

    private async Task<EventRegistration?> LockRegistrationAsync(
        Guid registrationId, CancellationToken cancellationToken)
    {
        var rows = await _context.EventRegistrations
            .FromSqlInterpolated($"SELECT * FROM event_registrations WHERE id = {registrationId} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);
        return rows.Count == 0 ? null : rows[0];
    }
}
