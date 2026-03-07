using IabConnect.Application.Events;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Email;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-021: Sends event registration notification emails.
/// Follows the same pattern as DunningEmailService.
/// </summary>
public sealed class EventNotificationService : IEventNotificationService
{
    private readonly IEmailSender _emailSender;
    private readonly SmtpSettings _smtpSettings;
    private readonly ILogger<EventNotificationService> _logger;

    public EventNotificationService(
        IEmailSender emailSender,
        IOptions<SmtpSettings> smtpSettings,
        ILogger<EventNotificationService> logger)
    {
        _emailSender = emailSender;
        _smtpSettings = smtpSettings.Value;
        _logger = logger;
    }

    public async Task SendWaitlistConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var subject = $"Waitlist Confirmation – {evt.Title}";
        var html = BuildWaitlistConfirmationHtml(registration, evt);
        var plain = BuildWaitlistConfirmationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Waitlist confirmation sent to {Email} for event {EventTitle} (position {Position})",
            registration.ParticipantEmail, evt.Title, registration.WaitlistPosition);
    }

    public async Task SendWaitlistPromotionAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var subject = $"You're In! – {evt.Title}";
        var html = BuildWaitlistPromotionHtml(registration, evt);
        var plain = BuildWaitlistPromotionPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Waitlist promotion notification sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    public async Task SendRegistrationConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var subject = $"Registration Confirmed – {evt.Title}";
        var html = BuildRegistrationConfirmationHtml(registration, evt);
        var plain = BuildRegistrationConfirmationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Registration confirmation sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    public async Task SendCancellationNotificationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var subject = $"Registration Cancelled – {evt.Title}";
        var html = BuildCancellationHtml(registration, evt);
        var plain = BuildCancellationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Cancellation notification sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    private async Task SendEmailAsync(string to, string subject, string html, string plain, CancellationToken ct)
    {
        try
        {
            await _emailSender.SendAsync(
                to, subject, html, plain,
                _smtpSettings.FromName, _smtpSettings.FromEmail, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send event notification email to {Email}", to);
            // Don't rethrow – email failure should not break the registration flow
        }
    }

    private static string FormatDate(DateTime date) => date.ToString("dd/MM/yyyy");
    private static string FormatDateTime(DateTime date) => date.ToString("dd/MM/yyyy HH:mm");

    // --- Waitlist Confirmation ---

    private static string BuildWaitlistConfirmationHtml(EventRegistration registration, Event evt)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">IAB Connect</h1>
                </div>
                <div style="border: 1px solid #E5E7EB; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">You're on the Waitlist</h2>
                    <p style="color: #4B5563;">Dear {registration.ParticipantName},</p>
                    <p style="color: #4B5563;">
                        Thank you for your interest in <strong>{evt.Title}</strong>. The event is currently fully booked,
                        but you have been added to the waitlist.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Event</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{FormatDateTime(evt.StartDate)}</td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Location</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Location}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Your Waitlist Position</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;"><strong>#{registration.WaitlistPosition}</strong></td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Guests</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{registration.NumberOfGuests}</td>
                        </tr>
                    </table>
                    <p style="color: #4B5563;">
                        We will notify you immediately if a spot becomes available. You will be promoted automatically
                        based on your position in the queue.
                    </p>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        If you no longer wish to attend, please cancel your registration so others can take your place.
                    </p>
                </div>
            </body>
            </html>
            """;
    }

    private static string BuildWaitlistConfirmationPlain(EventRegistration registration, Event evt)
    {
        return $"""
            You're on the Waitlist

            Dear {registration.ParticipantName},

            Thank you for your interest in {evt.Title}. The event is currently fully booked,
            but you have been added to the waitlist.

            Event: {evt.Title}
            Date: {FormatDateTime(evt.StartDate)}
            Location: {evt.Location}
            Your Waitlist Position: #{registration.WaitlistPosition}
            Guests: {registration.NumberOfGuests}

            We will notify you immediately if a spot becomes available.

            If you no longer wish to attend, please cancel your registration so others can take your place.
            """;
    }

    // --- Waitlist Promotion ---

    private static string BuildWaitlistPromotionHtml(EventRegistration registration, Event evt)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">IAB Connect</h1>
                </div>
                <div style="border: 1px solid #E5E7EB; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #16A34A; margin-top: 0;">🎉 Great News – You're In!</h2>
                    <p style="color: #4B5563;">Dear {registration.ParticipantName},</p>
                    <p style="color: #4B5563;">
                        A spot has opened up for <strong>{evt.Title}</strong> and you have been promoted from the waitlist.
                        Your registration is now <strong>confirmed</strong>!
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Event</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{FormatDateTime(evt.StartDate)}</td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Location</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Location}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Status</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">
                                <span style="background-color: #DCFCE7; color: #16A34A; padding: 4px 12px; border-radius: 9999px; font-weight: bold;">
                                    ✓ Confirmed
                                </span>
                            </td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Guests</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{registration.NumberOfGuests}</td>
                        </tr>
                    </table>
                    <p style="color: #4B5563;">
                        We look forward to seeing you at the event!
                    </p>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        If you can no longer attend, please cancel your registration as soon as possible
                        so the next person on the waitlist can take your spot.
                    </p>
                </div>
            </body>
            </html>
            """;
    }

    private static string BuildWaitlistPromotionPlain(EventRegistration registration, Event evt)
    {
        return $"""
            Great News – You're In!

            Dear {registration.ParticipantName},

            A spot has opened up for {evt.Title} and you have been promoted from the waitlist.
            Your registration is now CONFIRMED!

            Event: {evt.Title}
            Date: {FormatDateTime(evt.StartDate)}
            Location: {evt.Location}
            Status: Confirmed
            Guests: {registration.NumberOfGuests}

            We look forward to seeing you at the event!

            If you can no longer attend, please cancel your registration as soon as possible
            so the next person on the waitlist can take your spot.
            """;
    }

    // --- Registration Confirmation ---

    private static string BuildRegistrationConfirmationHtml(EventRegistration registration, Event evt)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">IAB Connect</h1>
                </div>
                <div style="border: 1px solid #E5E7EB; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">Registration Confirmed</h2>
                    <p style="color: #4B5563;">Dear {registration.ParticipantName},</p>
                    <p style="color: #4B5563;">
                        Your registration for <strong>{evt.Title}</strong> has been confirmed.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Event</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{FormatDateTime(evt.StartDate)}</td>
                        </tr>
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Location</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Location}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Guests</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{registration.NumberOfGuests}</td>
                        </tr>
                    </table>
                    <p style="color: #4B5563;">
                        We look forward to seeing you there!
                    </p>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        If you can no longer attend, please cancel your registration in advance.
                    </p>
                </div>
            </body>
            </html>
            """;
    }

    private static string BuildRegistrationConfirmationPlain(EventRegistration registration, Event evt)
    {
        return $"""
            Registration Confirmed

            Dear {registration.ParticipantName},

            Your registration for {evt.Title} has been confirmed.

            Event: {evt.Title}
            Date: {FormatDateTime(evt.StartDate)}
            Location: {evt.Location}
            Guests: {registration.NumberOfGuests}

            We look forward to seeing you there!

            If you can no longer attend, please cancel your registration in advance.
            """;
    }

    // --- Cancellation Notification ---

    private static string BuildCancellationHtml(EventRegistration registration, Event evt)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">IAB Connect</h1>
                </div>
                <div style="border: 1px solid #E5E7EB; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
                    <h2 style="color: #111827; margin-top: 0;">Registration Cancelled</h2>
                    <p style="color: #4B5563;">Dear {registration.ParticipantName},</p>
                    <p style="color: #4B5563;">
                        Your registration for <strong>{evt.Title}</strong> has been cancelled.
                    </p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Event</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{evt.Title}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Date</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{FormatDateTime(evt.StartDate)}</td>
                        </tr>
                        {(string.IsNullOrWhiteSpace(registration.CancellationReason) ? "" : $"""
                        <tr style="background-color: #F9FAFB;">
                            <td style="padding: 12px; border: 1px solid #E5E7EB; font-weight: bold;">Reason</td>
                            <td style="padding: 12px; border: 1px solid #E5E7EB;">{registration.CancellationReason}</td>
                        </tr>
                        """)}
                    </table>
                    <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                        If this was a mistake, you can register again as long as spots are available.
                    </p>
                </div>
            </body>
            </html>
            """;
    }

    private static string BuildCancellationPlain(EventRegistration registration, Event evt)
    {
        return $"""
            Registration Cancelled

            Dear {registration.ParticipantName},

            Your registration for {evt.Title} has been cancelled.

            Event: {evt.Title}
            Date: {FormatDateTime(evt.StartDate)}
            {(string.IsNullOrWhiteSpace(registration.CancellationReason) ? "" : $"Reason: {registration.CancellationReason}")}

            If this was a mistake, you can register again as long as spots are available.
            """;
    }
}
