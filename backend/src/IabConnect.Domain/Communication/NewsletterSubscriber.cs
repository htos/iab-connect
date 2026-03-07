using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-029: External newsletter subscriber (no account required).
/// Mitglieder nutzen das Consent-System; diese Entity ist für externe Abonnenten.
/// </summary>
public sealed class NewsletterSubscriber : Entity
{
    public string Email { get; private set; } = string.Empty;
    public string? FirstName { get; private set; }
    public string? LastName { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime SubscribedAt { get; private set; }
    public DateTime? UnsubscribedAt { get; private set; }
    public DateTime? ConfirmedAt { get; private set; }
    public string? IpAddress { get; private set; }

    private NewsletterSubscriber() { }

    public static NewsletterSubscriber Create(
        string email,
        string? firstName = null,
        string? lastName = null,
        string? ipAddress = null)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        return new NewsletterSubscriber
        {
            Email = email.ToLowerInvariant().Trim(),
            FirstName = firstName?.Trim(),
            LastName = lastName?.Trim(),
            IsActive = true,
            SubscribedAt = DateTime.UtcNow,
            ConfirmedAt = DateTime.UtcNow, // For MVP: immediate confirmation
            IpAddress = ipAddress
        };
    }

    public void Unsubscribe()
    {
        IsActive = false;
        UnsubscribedAt = DateTime.UtcNow;
    }

    public void Resubscribe(string? ipAddress = null)
    {
        IsActive = true;
        UnsubscribedAt = null;
        SubscribedAt = DateTime.UtcNow;
        IpAddress = ipAddress;
    }
}
