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
    // REQ-086 (E9-S3): neutral code-level defaults — the deployment supplies the real
    // sender identity via appsettings (Smtp:FromName / Smtp:FromEmail).
    public string FromName { get; set; } = "Organization";
    public string FromEmail { get; set; } = "noreply@example.org";
}
