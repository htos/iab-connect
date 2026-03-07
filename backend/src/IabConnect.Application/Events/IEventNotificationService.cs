using IabConnect.Domain.Events;

namespace IabConnect.Application.Events;

/// <summary>
/// REQ-021: Service to send event registration notification emails.
/// Sends waitlist confirmations, promotion notifications, and cancellation notifications.
/// </summary>
public interface IEventNotificationService
{
    /// <summary>
    /// Sends a notification when a participant is added to the waitlist.
    /// Includes their current position.
    /// </summary>
    Task SendWaitlistConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification when a participant is promoted from the waitlist.
    /// Informs them their registration is now confirmed.
    /// </summary>
    Task SendWaitlistPromotionAsync(EventRegistration registration, Event evt, CancellationToken ct = default);

    /// <summary>
    /// Sends a confirmation when a participant successfully registers for an event.
    /// </summary>
    Task SendRegistrationConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default);

    /// <summary>
    /// Sends a notification when a registration is cancelled.
    /// </summary>
    Task SendCancellationNotificationAsync(EventRegistration registration, Event evt, CancellationToken ct = default);
}
