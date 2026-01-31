namespace IabConnect.Infrastructure.Email;

/// <summary>
/// REQ-026: Interface für E-Mail-Versand
/// </summary>
public interface IEmailSender
{
    /// <summary>
    /// Sendet eine E-Mail
    /// </summary>
    Task SendAsync(
        string to,
        string subject,
        string htmlContent,
        string? plainTextContent,
        string fromName,
        string fromEmail,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sendet eine E-Mail an mehrere Empfänger
    /// </summary>
    Task SendBulkAsync(
        IEnumerable<string> recipients,
        string subject,
        string htmlContent,
        string? plainTextContent,
        string fromName,
        string fromEmail,
        CancellationToken cancellationToken = default);
}
