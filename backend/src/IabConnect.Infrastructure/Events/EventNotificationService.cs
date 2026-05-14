using System.Globalization;
using System.Net;
using IabConnect.Application.Common;
using IabConnect.Application.Events;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
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
    private readonly ISystemSettingsRepository _settingsRepository;
    private readonly ILogger<EventNotificationService> _logger;

    public EventNotificationService(
        IEmailSender emailSender,
        IOptions<SmtpSettings> smtpSettings,
        ISystemSettingsRepository settingsRepository,
        ILogger<EventNotificationService> logger)
    {
        _emailSender = emailSender;
        _smtpSettings = smtpSettings.Value;
        _settingsRepository = settingsRepository;
        _logger = logger;
    }

    public async Task SendWaitlistConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var appName = (await _settingsRepository.GetSettingsAsync(ct)).ApplicationName;
        var subject = $"Waitlist Confirmation – {evt.Title}";
        var html = BuildWaitlistConfirmationHtml(registration, evt, appName);
        var plain = BuildWaitlistConfirmationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Waitlist confirmation sent to {Email} for event {EventTitle} (position {Position})",
            registration.ParticipantEmail, evt.Title, registration.WaitlistPosition);
    }

    public async Task SendWaitlistPromotionAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var appName = (await _settingsRepository.GetSettingsAsync(ct)).ApplicationName;
        var subject = $"You're In! – {evt.Title}";
        var html = BuildWaitlistPromotionHtml(registration, evt, appName);
        var plain = BuildWaitlistPromotionPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Waitlist promotion notification sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    public async Task SendRegistrationConfirmationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var appName = (await _settingsRepository.GetSettingsAsync(ct)).ApplicationName;
        var subject = $"Registration Confirmed – {evt.Title}";
        var html = BuildRegistrationConfirmationHtml(registration, evt, appName);
        var plain = BuildRegistrationConfirmationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Registration confirmation sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    public async Task SendCancellationNotificationAsync(EventRegistration registration, Event evt, CancellationToken ct = default)
    {
        var appName = (await _settingsRepository.GetSettingsAsync(ct)).ApplicationName;
        var subject = $"Registration Cancelled – {evt.Title}";
        var html = BuildCancellationHtml(registration, evt, appName);
        var plain = BuildCancellationPlain(registration, evt);

        await SendEmailAsync(registration.ParticipantEmail, subject, html, plain, ct);

        _logger.LogInformation(
            "Cancellation notification sent to {Email} for event {EventTitle}",
            registration.ParticipantEmail, evt.Title);
    }

    // REQ-024 (E3.S4 review C3 + M-S4-5): Resolve Europe/Zurich once per process. Linux uses
    // the IANA id "Europe/Zurich"; Windows-without-ICU falls back to the Windows id
    // "W. Europe Standard Time". If neither resolves we surface the failure via a static
    // null sentinel — callers convert times when the zone is available, otherwise leave UTC
    // and tag the formatted line with "(UTC)" so volunteers are not misled.
    private static readonly TimeZoneInfo? ZurichTimeZone = ResolveZurichTimeZone();

    private static TimeZoneInfo? ResolveZurichTimeZone()
    {
        foreach (var id in new[] { "Europe/Zurich", "W. Europe Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return null;
    }

    public async Task SendVolunteerShiftReminderAsync(
        EventVolunteerAssignment assignment,
        EventVolunteerShift shift,
        EventVolunteerRole role,
        Event evt,
        Member member,
        CancellationToken ct = default)
    {
        // REQ-024 (E3.S4 review H-S4-2): strip CR/LF from the subject to defuse header-injection
        // via a malicious / sloppy event title (e.g. a title containing "\nBcc: attacker@…").
        var safeEventTitle = SanitizeHeaderValue(evt.Title);
        var subject = $"Erinnerung / Reminder — {safeEventTitle}";

        // REQ-024 (E3.S4 review C3): the shift StartsAt/EndsAt are persisted as Kind=Utc — we
        // convert to Europe/Zurich here so the email body says wall-clock local time, not UTC.
        // If the zone is unavailable on the host we fall back to UTC and tag the formatted
        // strings with "(UTC)" to keep the recipient honest.
        var (startsFormatted, endsFormatted) = FormatShiftWindowInLocalZone(shift);

        var html = BuildVolunteerShiftReminderHtml(shift, role, evt, member, startsFormatted, endsFormatted);
        var plain = BuildVolunteerShiftReminderPlain(shift, role, evt, member, startsFormatted, endsFormatted);

        // REQ-024 (E3.S4 review C2 + H-S4-1): bypass the swallowing SendEmailAsync wrapper so
        // SMTP failures propagate to VolunteerShiftReminderService — that caller skips
        // MarkReminderSentAsync when this throws, so a transient SMTP outage is retried on the
        // next daily run instead of being silently marked-sent-forever.
        await _emailSender.SendAsync(
            member.Email, subject, html, plain,
            _smtpSettings.FromName, _smtpSettings.FromEmail, ct);

        _logger.LogInformation(
            "Volunteer shift reminder sent to {Email} for shift {ShiftTitle} at event {EventTitle}",
            member.Email, shift.Title, evt.Title);
    }

    private static string SanitizeHeaderValue(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        // Drop CR, LF, and the NUL byte — the three characters that SMTP / RFC 5322 treat as
        // header terminators. Collapse them to a single space to keep the title readable.
        var sanitized = value.Replace('\r', ' ').Replace('\n', ' ').Replace('\0', ' ');
        return sanitized.Trim();
    }

    private static (string StartsFormatted, string EndsFormatted) FormatShiftWindowInLocalZone(EventVolunteerShift shift)
    {
        var culture = CultureInfo.GetCultureInfo("de-CH");
        if (ZurichTimeZone is null)
        {
            return (
                shift.StartsAt.ToString("dd.MM.yyyy HH:mm", culture) + " (UTC)",
                shift.EndsAt.ToString("dd.MM.yyyy HH:mm", culture) + " (UTC)");
        }
        // Assume Kind=Utc on the persisted aggregate; ConvertTimeFromUtc enforces that contract
        // and throws ArgumentException on Kind=Local which would surface a data bug loudly.
        var startsUtc = DateTime.SpecifyKind(shift.StartsAt, DateTimeKind.Utc);
        var endsUtc = DateTime.SpecifyKind(shift.EndsAt, DateTimeKind.Utc);
        var startsLocal = TimeZoneInfo.ConvertTimeFromUtc(startsUtc, ZurichTimeZone);
        var endsLocal = TimeZoneInfo.ConvertTimeFromUtc(endsUtc, ZurichTimeZone);
        return (
            startsLocal.ToString("dd.MM.yyyy HH:mm", culture),
            endsLocal.ToString("dd.MM.yyyy HH:mm", culture));
    }

    // REQ-024 (E3.S4) story decision D8: bilingual single-email reminder (DE + EN both
    // concatenated). Strings stay as const literals here per the locked decision — no
    // server-side i18n plumbing in this story.
    private static string BuildVolunteerShiftReminderHtml(
        EventVolunteerShift shift, EventVolunteerRole role, Event evt, Member member,
        string startsLocal, string endsLocal)
    {
        var memberName = WebUtility.HtmlEncode($"{member.FirstName} {member.LastName}".Trim());
        var eventTitle = WebUtility.HtmlEncode(evt.Title);
        var roleName = WebUtility.HtmlEncode(role.Name);
        var shiftTitle = WebUtility.HtmlEncode(shift.Title);
        var location = WebUtility.HtmlEncode(evt.Location);

        // REQ-024 (E3.S4 Round-3 R3-M-S4-1): add <meta http-equiv> charset (the canonical email-
        // client signal) and <html lang="de"> on the German block + <div lang="en"> wrapper on
        // the English block so screen-readers + email clients render Umlauts and language-tag
        // pronunciation correctly. Older Outlook builds key off `http-equiv content-type`
        // specifically rather than the HTML5 `<meta charset>` shortcut.
        return $@"<!DOCTYPE html>
<html lang=""de"">
<head>
  <meta http-equiv=""Content-Type"" content=""text/html; charset=utf-8"">
  <meta charset=""utf-8"">
  <title>Helfer-Schicht Erinnerung</title>
</head>
<body style=""font-family: sans-serif; color: #222;"">
  <h2>Erinnerung: deine Helfer-Schicht</h2>
  <p>Hallo {memberName},</p>
  <p>Dies ist eine Erinnerung an deine bevorstehende Helfer-Schicht für <strong>{eventTitle}</strong>.</p>
  <ul>
    <li><strong>Rolle:</strong> {roleName}</li>
    <li><strong>Schicht:</strong> {shiftTitle}</li>
    <li><strong>Beginn:</strong> {startsLocal}</li>
    <li><strong>Ende:</strong> {endsLocal}</li>
    <li><strong>Ort:</strong> {location}</li>
  </ul>
  <p>Bitte sei pünktlich. Vielen Dank für deinen Einsatz!</p>
  <hr>
  <div lang=""en"">
    <h2>Reminder: your volunteer shift</h2>
    <p>Hello {memberName},</p>
    <p>This is a reminder for your upcoming volunteer shift at <strong>{eventTitle}</strong>.</p>
    <ul>
      <li><strong>Role:</strong> {roleName}</li>
      <li><strong>Shift:</strong> {shiftTitle}</li>
      <li><strong>Start:</strong> {startsLocal}</li>
      <li><strong>End:</strong> {endsLocal}</li>
      <li><strong>Location:</strong> {location}</li>
    </ul>
    <p>Please arrive on time. Thanks for volunteering!</p>
  </div>
</body>
</html>";
    }

    private static string BuildVolunteerShiftReminderPlain(
        EventVolunteerShift shift, EventVolunteerRole role, Event evt, Member member,
        string startsLocal, string endsLocal)
    {
        var memberName = $"{member.FirstName} {member.LastName}".Trim();

        return $@"Erinnerung: deine Helfer-Schicht

Hallo {memberName},

Dies ist eine Erinnerung an deine bevorstehende Helfer-Schicht fuer {evt.Title}.

Rolle:    {role.Name}
Schicht:  {shift.Title}
Beginn:   {startsLocal}
Ende:     {endsLocal}
Ort:      {evt.Location}

Bitte sei puenktlich. Vielen Dank fuer deinen Einsatz!

--- English ---

Reminder: your volunteer shift

Hello {memberName},

This is a reminder for your upcoming volunteer shift at {evt.Title}.

Role:     {role.Name}
Shift:    {shift.Title}
Start:    {startsLocal}
End:      {endsLocal}
Location: {evt.Location}

Please arrive on time. Thanks for volunteering!
";
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

    private static string BuildWaitlistConfirmationHtml(EventRegistration registration, Event evt, string appName)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">{WebUtility.HtmlEncode(appName)}</h1>
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

    private static string BuildWaitlistPromotionHtml(EventRegistration registration, Event evt, string appName)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">{WebUtility.HtmlEncode(appName)}</h1>
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

    private static string BuildRegistrationConfirmationHtml(EventRegistration registration, Event evt, string appName)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">{WebUtility.HtmlEncode(appName)}</h1>
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

    private static string BuildCancellationHtml(EventRegistration registration, Event evt, string appName)
    {
        return $"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #EA580C; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">{WebUtility.HtmlEncode(appName)}</h1>
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
