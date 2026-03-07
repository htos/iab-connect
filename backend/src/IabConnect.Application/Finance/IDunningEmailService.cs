using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance;

/// <summary>
/// TECH-003: Service to send dunning notification emails.
/// Resolves recipient email from Member/Sponsor/Supplier and sends level-appropriate reminders.
/// </summary>
public interface IDunningEmailService
{
    /// <summary>
    /// Sends a dunning email for the given notice and invoice.
    /// Returns true if the email was sent successfully, false if the recipient email could not be resolved.
    /// </summary>
    Task<bool> SendDunningEmailAsync(DunningNotice notice, Invoice invoice, CancellationToken ct = default);
}
