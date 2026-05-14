using IabConnect.Domain.Events;

namespace IabConnect.Application.Events;

/// <summary>
/// REQ-021 (E3.S2 H-S2-5 / Epic-3-retro §9 cleanup): transactional, <c>FOR UPDATE</c>
/// row-locked registration cancellation.
///
/// <para>Cancelling a registration can promote the next person off the waitlist. Without a
/// lock, two concurrent cancellations for the same event both read the same "next on
/// waitlist" row and both promote it — the second <c>PromoteFromWaitlist</c> throws (the row
/// is no longer waitlisted) and surfaces as a 500, and one freed slot goes unfilled. This
/// service wraps the cancel + waitlist promotion in a single transaction that takes a
/// <c>FOR UPDATE</c> lock on the event row (serialises every cancel/promote for that event)
/// and on the registration row (serialises against a concurrent check-in).</para>
///
/// <para>Mirrors <c>IEventRegistrationCheckInService</c> — the transaction primitive stays in
/// Infrastructure, the Application layer stays EF-free.</para>
/// </summary>
public interface IEventRegistrationCancellationService
{
    /// <summary>
    /// Cancels <paramref name="registrationId"/> under a row lock and, if the event has the
    /// waitlist enabled, promotes the next waitlisted registration in the same transaction.
    /// Returns <see cref="CancelRegistrationOutcome.NotFound"/> when the event or registration
    /// does not exist or the registration does not belong to the event.
    /// </summary>
    Task<CancelRegistrationResult> CancelAsync(
        Guid eventId,
        Guid registrationId,
        string? reason,
        bool cancelledByParticipant,
        CancellationToken cancellationToken = default);
}

public enum CancelRegistrationOutcome
{
    Cancelled,
    NotFound,
}

/// <summary>
/// Outcome of <see cref="IEventRegistrationCancellationService.CancelAsync"/>. On
/// <see cref="CancelRegistrationOutcome.Cancelled"/>, <see cref="Registration"/> and
/// <see cref="Event"/> are non-null; <see cref="PromotedFromWaitlist"/> is non-null only when a
/// waitlisted registration was promoted into the freed slot. The entities are returned so the
/// caller can send notifications outside the transaction.
/// </summary>
public sealed record CancelRegistrationResult(
    CancelRegistrationOutcome Outcome,
    EventRegistration? Registration,
    EventRegistration? PromotedFromWaitlist,
    Event? Event)
{
    public static CancelRegistrationResult NotFound() =>
        new(CancelRegistrationOutcome.NotFound, null, null, null);

    public static CancelRegistrationResult Cancelled(
        EventRegistration registration, EventRegistration? promoted, Event @event) =>
        new(CancelRegistrationOutcome.Cancelled, registration, promoted, @event);
}
