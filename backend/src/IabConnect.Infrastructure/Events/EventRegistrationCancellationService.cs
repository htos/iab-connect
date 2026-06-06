using IabConnect.Application.Audit;
using IabConnect.Application.Events;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
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
    private readonly IAuditService _auditService;

    public EventRegistrationCancellationService(ApplicationDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
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

        // REQ-022 (E4-S2 / AC-4): dispose the linked finance invoice per finance-compliance rules
        // — never a hard delete. Draft → soft-delete; Sent/Overdue → Cancel(reason); Paid → leave
        // intact and flag for a manual Kassier refund (no auto-refund — no PSP). Done inside the
        // same transaction as the registration cancel so the two never diverge.
        var (invoiceForAudit, invoiceDisposition) =
            await DisposeLinkedInvoiceAsync(registrationId, reason, cancellationToken);

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

        // AC-9: audit the invoice disposition after the cancellation commits (best-effort — the
        // cancellation is already committed, so an audit-sink failure must not fail the request).
        if (invoiceForAudit is not null && invoiceDisposition is not null)
        {
            try
            {
                await _auditService.LogActionAsync(
                    AuditEventType.FinanceStatusChanged,
                    $"Event-registration cancellation: {invoiceDisposition}",
                    entityType: "Invoice",
                    entityId: invoiceForAudit.Id.ToString(),
                    details: $"registrationId={registrationId}; eventId={eventId}",
                    ct: cancellationToken);
            }
            catch
            {
                /* committed already — audit failure must not fail the cancellation */
            }
        }

        return CancelRegistrationResult.Cancelled(registration, promoted, evt);
    }

    /// <summary>
    /// REQ-022 (E4-S2 / AC-4): apply the finance-compliant disposition to the invoice linked to a
    /// cancelled registration. Returns the invoice + a human-readable disposition for the audit
    /// trail, or (null, null) for a free registration with no linked invoice.
    /// </summary>
    private async Task<(Invoice? invoice, string? disposition)> DisposeLinkedInvoiceAsync(
        Guid registrationId, string? reason, CancellationToken cancellationToken)
    {
        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.EventRegistrationId == registrationId, cancellationToken);
        if (invoice is null)
            return (null, null);

        switch (invoice.Status)
        {
            case InvoiceStatus.Draft:
                invoice.SoftDelete("System (registration cancellation)");
                return (invoice, $"draft invoice {invoice.InvoiceNumber} soft-deleted");

            case InvoiceStatus.Sent:
            case InvoiceStatus.Overdue:
                invoice.Cancel(
                    string.IsNullOrWhiteSpace(reason) ? "Event registration cancelled" : reason,
                    "System (registration cancellation)");
                return (invoice, $"invoice {invoice.InvoiceNumber} cancelled");

            case InvoiceStatus.Paid:
                // No auto-refund (no PSP). Leave Paid; flag for a manual Kassier refund/reversal.
                return (invoice, $"paid invoice {invoice.InvoiceNumber} left intact — manual refund required");

            default:
                // Already Cancelled: nothing to do.
                return (null, null);
        }
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
