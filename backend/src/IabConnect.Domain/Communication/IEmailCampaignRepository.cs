namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-026: Repository-Interface für E-Mail-Kampagnen
/// </summary>
public interface IEmailCampaignRepository
{
    /// <summary>Kampagne nach ID abrufen</summary>
    Task<EmailCampaign?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Kampagne mit Empfängern abrufen</summary>
    Task<EmailCampaign?> GetByIdWithRecipientsAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Alle Kampagnen abrufen (paginiert)</summary>
    Task<(IReadOnlyList<EmailCampaign> Items, int TotalCount)> GetAllAsync(
        EmailCampaignFilterOptions? filter = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default);

    /// <summary>Kampagnen nach Status abrufen</summary>
    Task<IReadOnlyList<EmailCampaign>> GetByStatusAsync(
        EmailCampaignStatus status,
        CancellationToken cancellationToken = default);

    /// <summary>Geplante Kampagnen abrufen, die versendet werden sollen</summary>
    Task<IReadOnlyList<EmailCampaign>> GetScheduledCampaignsReadyToSendAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Kampagne hinzufügen</summary>
    Task AddAsync(EmailCampaign campaign, CancellationToken cancellationToken = default);

    /// <summary>Kampagne aktualisieren</summary>
    Task UpdateAsync(EmailCampaign campaign, CancellationToken cancellationToken = default);

    /// <summary>Kampagne löschen</summary>
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Empfänger für Kampagne abrufen (paginiert)</summary>
    Task<(IReadOnlyList<EmailRecipient> Items, int TotalCount)> GetRecipientsAsync(
        Guid campaignId,
        EmailRecipientStatus? statusFilter = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default);

    /// <summary>Empfänger nach ID abrufen</summary>
    Task<EmailRecipient?> GetRecipientByIdAsync(Guid recipientId, CancellationToken cancellationToken = default);

    /// <summary>Empfänger nach externem Message-ID abrufen</summary>
    Task<EmailRecipient?> GetRecipientByExternalIdAsync(
        string externalMessageId,
        CancellationToken cancellationToken = default);

    /// <summary>Empfänger aktualisieren</summary>
    Task UpdateRecipientAsync(EmailRecipient recipient, CancellationToken cancellationToken = default);

    /// <summary>Statistiken für Kampagne abrufen</summary>
    Task<EmailCampaignStatistics> GetStatisticsAsync(Guid campaignId, CancellationToken cancellationToken = default);

    /// <summary>Prüfen ob E-Mail bereits in Kampagne ist</summary>
    Task<bool> IsEmailInCampaignAsync(Guid campaignId, string email, CancellationToken cancellationToken = default);
}

/// <summary>
/// Filter-Optionen für Kampagnen-Abfragen
/// </summary>
public class EmailCampaignFilterOptions
{
    public string? SearchTerm { get; set; }
    public EmailCampaignStatus? Status { get; set; }
    public DateTime? CreatedFrom { get; set; }
    public DateTime? CreatedTo { get; set; }
    public Guid? CreatedById { get; set; }
    public string SortBy { get; set; } = "CreatedAt";
    public bool SortDescending { get; set; } = true;
}

/// <summary>
/// Statistiken für eine E-Mail-Kampagne
/// </summary>
public record EmailCampaignStatistics(
    int TotalRecipients,
    int PendingCount,
    int SentCount,
    int DeliveredCount,
    int OpenedCount,
    int ClickedCount,
    int BouncedCount,
    int FailedCount,
    int SkippedCount,
    decimal OpenRate,
    decimal ClickRate,
    decimal BounceRate);
