using Hangfire;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Email;

/// <summary>
/// REQ-026: Hangfire-basierter Service für E-Mail-Kampagnen-Versand
/// </summary>
public interface IEmailCampaignJobService
{
    /// <summary>
    /// Startet den sofortigen Versand einer Kampagne
    /// </summary>
    string EnqueueCampaignSending(Guid campaignId);

    /// <summary>
    /// Plant den Versand einer Kampagne für einen bestimmten Zeitpunkt
    /// </summary>
    string ScheduleCampaignSending(Guid campaignId, DateTimeOffset scheduledAt);

    /// <summary>
    /// Bricht einen geplanten Job ab
    /// </summary>
    bool CancelScheduledJob(string jobId);
}

public sealed class EmailCampaignJobService : IEmailCampaignJobService
{
    private readonly ILogger<EmailCampaignJobService> _logger;

    public EmailCampaignJobService(ILogger<EmailCampaignJobService> logger)
    {
        _logger = logger;
    }

    public string EnqueueCampaignSending(Guid campaignId)
    {
        _logger.LogInformation("Enqueueing immediate send for campaign {CampaignId}", campaignId);
        var jobId = BackgroundJob.Enqueue<EmailCampaignSendJob>(job => job.ExecuteAsync(campaignId, CancellationToken.None));
        _logger.LogInformation("Campaign {CampaignId} enqueued with job ID {JobId}", campaignId, jobId);
        return jobId;
    }

    public string ScheduleCampaignSending(Guid campaignId, DateTimeOffset scheduledAt)
    {
        _logger.LogInformation("Scheduling send for campaign {CampaignId} at {ScheduledAt}", campaignId, scheduledAt);
        var jobId = BackgroundJob.Schedule<EmailCampaignSendJob>(
            job => job.ExecuteAsync(campaignId, CancellationToken.None),
            scheduledAt);
        _logger.LogInformation("Campaign {CampaignId} scheduled with job ID {JobId}", campaignId, jobId);
        return jobId;
    }

    public bool CancelScheduledJob(string jobId)
    {
        _logger.LogInformation("Cancelling scheduled job {JobId}", jobId);
        return BackgroundJob.Delete(jobId);
    }
}

/// <summary>
/// Hangfire Job für den tatsächlichen E-Mail-Versand
/// </summary>
public sealed class EmailCampaignSendJob
{
    private readonly IEmailCampaignRepository _campaignRepository;
    private readonly IMemberRepository _memberRepository;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<EmailCampaignSendJob> _logger;

    public EmailCampaignSendJob(
        IEmailCampaignRepository campaignRepository,
        IMemberRepository memberRepository,
        IEmailSender emailSender,
        ILogger<EmailCampaignSendJob> logger)
    {
        _campaignRepository = campaignRepository;
        _memberRepository = memberRepository;
        _emailSender = emailSender;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    public async Task ExecuteAsync(Guid campaignId, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting email send job for campaign {CampaignId}", campaignId);

        var campaign = await _campaignRepository.GetByIdWithRecipientsAsync(campaignId);
        if (campaign == null)
        {
            _logger.LogWarning("Campaign {CampaignId} not found", campaignId);
            return;
        }

        // Prüfen ob Kampagne bereits versendet wird oder abgebrochen wurde
        if (campaign.Status == EmailCampaignStatus.Sent ||
            campaign.Status == EmailCampaignStatus.Cancelled)
        {
            _logger.LogWarning("Campaign {CampaignId} has status {Status}, skipping", campaignId, campaign.Status);
            return;
        }

        try
        {
            // Falls noch keine Empfänger geladen: Empfänger basierend auf Segment laden
            if (campaign.Recipients.Count == 0)
            {
                var recipients = await LoadRecipientsForCampaign(campaign);
                foreach (var recipient in recipients)
                {
                    campaign.AddRecipient(recipient);
                }
                await _campaignRepository.UpdateAsync(campaign);
            }

            // Status auf Sending setzen falls noch nicht geschehen
            if (campaign.Status == EmailCampaignStatus.Draft ||
                campaign.Status == EmailCampaignStatus.Scheduled)
            {
                campaign.StartSending();
                await _campaignRepository.UpdateAsync(campaign);
            }

            _logger.LogInformation("Sending {Count} emails for campaign {CampaignId}",
                campaign.Recipients.Count, campaignId);

            // E-Mails versenden
            foreach (var recipient in campaign.Recipients)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    _logger.LogWarning("Cancellation requested for campaign {CampaignId}", campaignId);
                    break;
                }

                // Bereits versendete überspringen
                if (recipient.SentAt.HasValue)
                    continue;

                try
                {
                    var personalizedHtml = PersonalizeContent(campaign.HtmlContent, recipient);
                    var personalizedText = campaign.PlainTextContent != null
                        ? PersonalizeContent(campaign.PlainTextContent, recipient)
                        : null;

                    await _emailSender.SendAsync(
                        recipient.Email,
                        campaign.Subject,
                        personalizedHtml,
                        personalizedText,
                        campaign.FromName,
                        campaign.FromEmail);

                    recipient.MarkAsSent();
                    await _campaignRepository.UpdateRecipientAsync(recipient);

                    _logger.LogDebug("Email sent to {Email} for campaign {CampaignId}",
                        recipient.Email, campaignId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send email to {Email} for campaign {CampaignId}",
                        recipient.Email, campaignId);
                    recipient.MarkAsFailed(ex.Message);
                    await _campaignRepository.UpdateRecipientAsync(recipient);
                }
            }

            // Statistiken aktualisieren und Kampagne abschließen
            var stats = await _campaignRepository.GetStatisticsAsync(campaign.Id);
            campaign.UpdateStatistics(
                stats.SentCount,
                stats.DeliveredCount,
                stats.OpenedCount,
                stats.ClickedCount,
                stats.BouncedCount,
                stats.FailedCount);
            campaign.CompleteSending();
            await _campaignRepository.UpdateAsync(campaign);

            _logger.LogInformation("Completed email send job for campaign {CampaignId}. Sent: {SentCount}, Failed: {FailedCount}",
                campaignId, stats.SentCount, stats.FailedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during email send job for campaign {CampaignId}", campaignId);
            throw; // Hangfire wird automatisch retry versuchen
        }
    }

    private async Task<List<EmailRecipient>> LoadRecipientsForCampaign(EmailCampaign campaign)
    {
        var recipients = new List<EmailRecipient>();

        // Für MVP: Alle aktiven Mitglieder (gleiche Logik wie in EmailCampaignEndpoints)
        var (members, _) = await _memberRepository.GetPagedAsync(
            page: 1,
            pageSize: 10000,
            status: MembershipStatus.Active);

        foreach (var member in members.Where(m => !string.IsNullOrEmpty(m.Email)))
        {
            recipients.Add(EmailRecipient.CreateForMember(
                campaign.Id,
                member.Id,
                member.Email,
                member.FirstName,
                member.LastName));
        }

        return recipients;
    }

    private static string PersonalizeContent(string content, EmailRecipient recipient)
    {
        return content
            .Replace("{{firstName}}", recipient.FirstName ?? "")
            .Replace("{{lastName}}", recipient.LastName ?? "")
            .Replace("{{email}}", recipient.Email)
            .Replace("{{fullName}}", recipient.FullName);
    }
}
