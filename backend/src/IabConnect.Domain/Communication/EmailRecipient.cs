using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-026: Empfänger einer E-Mail-Kampagne mit Tracking-Informationen
/// </summary>
public sealed class EmailRecipient : Entity
{
    public Guid CampaignId { get; private set; }

    // Empfänger-Daten
    public Guid? MemberId { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string? FirstName { get; private set; }
    public string? LastName { get; private set; }

    // Status
    public EmailRecipientStatus Status { get; private set; } = EmailRecipientStatus.Pending;

    // Tracking
    public DateTime? SentAt { get; private set; }
    public DateTime? DeliveredAt { get; private set; }
    public DateTime? OpenedAt { get; private set; }
    public DateTime? ClickedAt { get; private set; }
    public DateTime? BouncedAt { get; private set; }
    public DateTime? UnsubscribedAt { get; private set; }

    // Bounce Details
    public BounceType BounceType { get; private set; } = BounceType.None;
    public string? BounceMessage { get; private set; }

    // Fehlerdetails
    public string? ErrorMessage { get; private set; }

    // Provider-spezifische ID für Tracking
    public string? ExternalMessageId { get; private set; }

    private EmailRecipient() { }

    /// <summary>
    /// Factory-Methode für einen Mitglieds-Empfänger
    /// </summary>
    public static EmailRecipient CreateForMember(
        Guid campaignId,
        Guid memberId,
        string email,
        string? firstName,
        string? lastName)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        return new EmailRecipient
        {
            CampaignId = campaignId,
            MemberId = memberId,
            Email = email.ToLowerInvariant().Trim(),
            FirstName = firstName,
            LastName = lastName,
            Status = EmailRecipientStatus.Pending
        };
    }

    /// <summary>
    /// Factory-Methode für einen externen Empfänger
    /// </summary>
    public static EmailRecipient CreateExternal(
        Guid campaignId,
        string email,
        string? firstName = null,
        string? lastName = null)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required", nameof(email));

        return new EmailRecipient
        {
            CampaignId = campaignId,
            Email = email.ToLowerInvariant().Trim(),
            FirstName = firstName,
            LastName = lastName,
            Status = EmailRecipientStatus.Pending
        };
    }

    /// <summary>
    /// Als versendet markieren
    /// </summary>
    public void MarkAsSent(string? externalMessageId = null)
    {
        Status = EmailRecipientStatus.Sent;
        SentAt = DateTime.UtcNow;
        ExternalMessageId = externalMessageId;
    }

    /// <summary>
    /// Als zugestellt markieren
    /// </summary>
    public void MarkAsDelivered()
    {
        if (Status < EmailRecipientStatus.Delivered)
        {
            Status = EmailRecipientStatus.Delivered;
        }
        DeliveredAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Als geöffnet markieren
    /// </summary>
    public void MarkAsOpened()
    {
        if (OpenedAt == null)
        {
            OpenedAt = DateTime.UtcNow;
        }
        if (Status < EmailRecipientStatus.Opened)
        {
            Status = EmailRecipientStatus.Opened;
        }
    }

    /// <summary>
    /// Als geklickt markieren
    /// </summary>
    public void MarkAsClicked()
    {
        if (ClickedAt == null)
        {
            ClickedAt = DateTime.UtcNow;
        }
        if (Status < EmailRecipientStatus.Clicked)
        {
            Status = EmailRecipientStatus.Clicked;
        }
    }

    /// <summary>
    /// Als Bounce markieren
    /// </summary>
    public void MarkAsBounced(BounceType bounceType, string? message = null)
    {
        Status = EmailRecipientStatus.Bounced;
        BounceType = bounceType;
        BounceMessage = message;
        BouncedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Als abgemeldet markieren
    /// </summary>
    public void MarkAsUnsubscribed()
    {
        Status = EmailRecipientStatus.Unsubscribed;
        UnsubscribedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Als Spam-Beschwerde markieren
    /// </summary>
    public void MarkAsComplained()
    {
        Status = EmailRecipientStatus.Complained;
    }

    /// <summary>
    /// Als fehlgeschlagen markieren
    /// </summary>
    public void MarkAsFailed(string errorMessage)
    {
        Status = EmailRecipientStatus.Failed;
        ErrorMessage = errorMessage;
    }

    /// <summary>
    /// Als übersprungen markieren
    /// </summary>
    public void MarkAsSkipped(string reason)
    {
        Status = EmailRecipientStatus.Skipped;
        ErrorMessage = reason;
    }

    /// <summary>
    /// Zurücksetzen auf Pending-Status für erneutes Senden
    /// </summary>
    public void ResetToPending()
    {
        Status = EmailRecipientStatus.Pending;
        SentAt = null;
        DeliveredAt = null;
        OpenedAt = null;
        ClickedAt = null;
        BouncedAt = null;
        BounceType = BounceType.None;
        BounceMessage = null;
        ErrorMessage = null;
        ExternalMessageId = null;
    }

    /// <summary>
    /// Vollständiger Name
    /// </summary>
    public string FullName => $"{FirstName} {LastName}".Trim();
}
