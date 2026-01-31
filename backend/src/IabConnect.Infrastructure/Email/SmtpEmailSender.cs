using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Email;

/// <summary>
/// REQ-026: SMTP E-Mail-Sender für Mailhog (Development) und Produktion
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly SmtpSettings _settings;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<SmtpSettings> settings, ILogger<SmtpEmailSender> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task SendAsync(
        string to,
        string subject,
        string htmlContent,
        string? plainTextContent,
        string fromName,
        string fromEmail,
        CancellationToken cancellationToken = default)
    {
        using var client = new SmtpClient(_settings.Host, _settings.Port)
        {
            EnableSsl = _settings.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrEmpty(_settings.Username))
        {
            client.Credentials = new NetworkCredential(_settings.Username, _settings.Password);
        }

        var from = new MailAddress(fromEmail, fromName);
        var toAddress = new MailAddress(to);

        using var message = new MailMessage(from, toAddress)
        {
            Subject = subject,
            Body = htmlContent,
            IsBodyHtml = true
        };

        // Plain-Text-Alternative hinzufügen
        if (!string.IsNullOrEmpty(plainTextContent))
        {
            var plainView = AlternateView.CreateAlternateViewFromString(plainTextContent, null, "text/plain");
            var htmlView = AlternateView.CreateAlternateViewFromString(htmlContent, null, "text/html");
            message.AlternateViews.Add(plainView);
            message.AlternateViews.Add(htmlView);
            message.Body = plainTextContent;
            message.IsBodyHtml = false;
        }

        _logger.LogInformation("Sending email to {To} with subject '{Subject}'", to, subject);

        try
        {
            await client.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Email sent successfully to {To}", to);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
            throw;
        }
    }

    public async Task SendBulkAsync(
        IEnumerable<string> recipients,
        string subject,
        string htmlContent,
        string? plainTextContent,
        string fromName,
        string fromEmail,
        CancellationToken cancellationToken = default)
    {
        foreach (var recipient in recipients)
        {
            await SendAsync(recipient, subject, htmlContent, plainTextContent, fromName, fromEmail, cancellationToken);
        }
    }
}
