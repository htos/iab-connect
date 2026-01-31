namespace IabConnect.Infrastructure.Email;

/// <summary>
/// REQ-026: Konfiguration für SMTP E-Mail-Versand
/// </summary>
public sealed class SmtpSettings
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025; // Mailhog default
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = false;
    public string FromName { get; set; } = "IAB Connect";
    public string FromEmail { get; set; } = "noreply@iabconnect.local";
}
