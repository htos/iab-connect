using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-026: E-Mail-Kampagne für Massen-Mailings
/// </summary>
public sealed class EmailCampaign : Entity
{
    public string Name { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public string HtmlContent { get; private set; } = string.Empty;
    public string? PlainTextContent { get; private set; }

    // Sender
    public string FromName { get; private set; } = string.Empty;
    public string FromEmail { get; private set; } = string.Empty;
    public string? ReplyToEmail { get; private set; }

    // Segment
    public RecipientSegmentType SegmentType { get; private set; }
    public string? SegmentFilter { get; private set; } // JSON für benutzerdefinierte Filter
    public Guid? EventId { get; private set; } // Für EventParticipants-Segment

    // Status
    public EmailCampaignStatus Status { get; private set; } = EmailCampaignStatus.Draft;

    // Scheduling
    public DateTime? ScheduledAt { get; private set; }
    public DateTime? SentAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    // Statistics (cached)
    public int TotalRecipients { get; private set; }
    public int SentCount { get; private set; }
    public int DeliveredCount { get; private set; }
    public int OpenedCount { get; private set; }
    public int ClickedCount { get; private set; }
    public int BouncedCount { get; private set; }
    public int FailedCount { get; private set; }

    // Creator
    public Guid CreatedById { get; private set; }
    public string CreatedByName { get; private set; } = string.Empty;

    // Audit
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    // Navigation
    private readonly List<EmailRecipient> _recipients = [];
    public IReadOnlyList<EmailRecipient> Recipients => _recipients.AsReadOnly();

    private EmailCampaign() { }

    /// <summary>
    /// Factory-Methode zum Erstellen einer neuen Kampagne
    /// </summary>
    public static EmailCampaign Create(
        string name,
        string subject,
        string htmlContent,
        string fromName,
        string fromEmail,
        Guid createdById,
        string createdByName,
        RecipientSegmentType segmentType = RecipientSegmentType.AllActiveMembers)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Campaign name is required", nameof(name));
        if (string.IsNullOrWhiteSpace(subject))
            throw new ArgumentException("Subject is required", nameof(subject));
        if (string.IsNullOrWhiteSpace(htmlContent))
            throw new ArgumentException("HTML content is required", nameof(htmlContent));
        if (string.IsNullOrWhiteSpace(fromEmail))
            throw new ArgumentException("From email is required", nameof(fromEmail));

        return new EmailCampaign
        {
            Name = name,
            Subject = subject,
            HtmlContent = htmlContent,
            FromName = fromName,
            FromEmail = fromEmail,
            CreatedById = createdById,
            CreatedByName = createdByName,
            SegmentType = segmentType,
            Status = EmailCampaignStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Kampagne aktualisieren (nur im Draft-Status)
    /// </summary>
    public void Update(
        string name,
        string subject,
        string htmlContent,
        string? plainTextContent,
        string fromName,
        string fromEmail,
        string? replyToEmail)
    {
        if (Status != EmailCampaignStatus.Draft)
            throw new InvalidOperationException("Only draft campaigns can be edited");

        Name = name ?? throw new ArgumentException("Name is required", nameof(name));
        Subject = subject ?? throw new ArgumentException("Subject is required", nameof(subject));
        HtmlContent = htmlContent ?? throw new ArgumentException("HTML content is required", nameof(htmlContent));
        PlainTextContent = plainTextContent;
        FromName = fromName ?? throw new ArgumentException("From name is required", nameof(fromName));
        FromEmail = fromEmail ?? throw new ArgumentException("From email is required", nameof(fromEmail));
        ReplyToEmail = replyToEmail;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Segment konfigurieren
    /// </summary>
    public void SetSegment(RecipientSegmentType segmentType, string? segmentFilter = null, Guid? eventId = null)
    {
        if (Status != EmailCampaignStatus.Draft)
            throw new InvalidOperationException("Only draft campaigns can be edited");

        SegmentType = segmentType;
        SegmentFilter = segmentFilter;
        EventId = eventId;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Kampagne planen für späteren Versand
    /// </summary>
    public void Schedule(DateTime scheduledAt)
    {
        if (Status != EmailCampaignStatus.Draft)
            throw new InvalidOperationException("Only draft campaigns can be scheduled");
        if (scheduledAt <= DateTime.UtcNow)
            throw new ArgumentException("Scheduled time must be in the future", nameof(scheduledAt));

        ScheduledAt = scheduledAt;
        Status = EmailCampaignStatus.Scheduled;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Versand starten
    /// </summary>
    public void StartSending()
    {
        if (Status != EmailCampaignStatus.Draft && Status != EmailCampaignStatus.Scheduled)
            throw new InvalidOperationException($"Cannot start sending campaign in status {Status}");

        Status = EmailCampaignStatus.Sending;
        SentAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Erneut senden (für bereits gesendete Kampagnen)
    /// </summary>
    public void StartResending()
    {
        if (Status != EmailCampaignStatus.Sent)
            throw new InvalidOperationException($"Cannot resend campaign in status {Status}");

        Status = EmailCampaignStatus.Sending;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Versand abschließen
    /// </summary>
    public void CompleteSending()
    {
        if (Status != EmailCampaignStatus.Sending)
            throw new InvalidOperationException("Campaign is not sending");

        Status = EmailCampaignStatus.Sent;
        CompletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Versand abbrechen
    /// </summary>
    public void Cancel()
    {
        if (Status == EmailCampaignStatus.Sent || Status == EmailCampaignStatus.Cancelled)
            throw new InvalidOperationException($"Cannot cancel campaign in status {Status}");

        Status = EmailCampaignStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Versand fehlgeschlagen markieren
    /// </summary>
    public void MarkAsFailed()
    {
        Status = EmailCampaignStatus.Failed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Empfänger hinzufügen
    /// </summary>
    public void AddRecipient(EmailRecipient recipient)
    {
        if (Status != EmailCampaignStatus.Draft)
            throw new InvalidOperationException("Recipients can only be added to draft campaigns");

        _recipients.Add(recipient);
        TotalRecipients = _recipients.Count;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Mehrere Empfänger hinzufügen
    /// </summary>
    public void AddRecipients(IEnumerable<EmailRecipient> recipients)
    {
        if (Status != EmailCampaignStatus.Draft)
            throw new InvalidOperationException("Recipients can only be added to draft campaigns");

        _recipients.AddRange(recipients);
        TotalRecipients = _recipients.Count;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Statistiken aktualisieren
    /// </summary>
    public void UpdateStatistics(
        int sentCount,
        int deliveredCount,
        int openedCount,
        int clickedCount,
        int bouncedCount,
        int failedCount)
    {
        SentCount = sentCount;
        DeliveredCount = deliveredCount;
        OpenedCount = openedCount;
        ClickedCount = clickedCount;
        BouncedCount = bouncedCount;
        FailedCount = failedCount;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Für Tests: Empfänger laden
    /// </summary>
    public void LoadRecipients(IEnumerable<EmailRecipient> recipients)
    {
        _recipients.Clear();
        _recipients.AddRange(recipients);
    }
}
