using IabConnect.Domain.Events;

namespace IabConnect.Application.Events.PaidRegistration;

/// <summary>
/// REQ-022 (E4-S2): Cross-module coordinator for paid event registration. Atomically persists an
/// <see cref="EventRegistration"/> together with a finance <c>Invoice</c> raised for the applicable
/// fee category — both in ONE <c>SaveChangesAsync</c> so a finance-side failure (locked fiscal
/// period, currency mismatch, DB error) never leaves a registered-but-un-invoiced attendee.
///
/// <para>Implemented in Infrastructure with direct <c>ApplicationDbContext</c> access (mirroring
/// <c>EventRegistrationCancellationService</c>) because the per-aggregate repositories each call
/// <c>SaveChangesAsync</c> internally and cannot be composed into a single atomic unit. The invoice
/// is built through the SAME building blocks the normal create path uses (next-invoice-number,
/// fiscal-period lock, recipient rules) — no finance rule is re-implemented or skipped.</para>
/// </summary>
public interface IPaidRegistrationService
{
    /// <summary>
    /// Atomically persists <paramref name="registration"/> and a linked invoice (one line item for
    /// <paramref name="feeCategory"/>, quantity = the registration's number of attendees). Throws
    /// <see cref="InvalidOperationException"/> on a locked fiscal period or a currency mismatch
    /// between the fee category and the active finance profile — in which case NOTHING is persisted.
    /// </summary>
    Task<PaidRegistrationResult> CreatePaidRegistrationAsync(
        EventRegistration registration,
        EventFeeCategory feeCategory,
        string eventTitle,
        DateTime? dueDate,
        CancellationToken cancellationToken = default);
}

/// <summary>REQ-022 (E4-S2): outcome of a successful paid registration.</summary>
public sealed record PaidRegistrationResult(
    EventRegistration Registration,
    Guid InvoiceId,
    string InvoiceNumber);
