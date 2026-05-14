using Hangfire;
using IabConnect.Api.Extensions;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-026: API-Endpoints für E-Mail-Kampagnen-Verwaltung
/// </summary>
public static class EmailCampaignEndpoints
{
    public static IEndpointRouteBuilder MapEmailCampaignEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/email-campaigns")
            .WithTags("Email Campaigns")
            .RequireAuthorization("RequireVorstand")
            .RequireAuthorization("Module:communication"); // REQ-087 (E10-S3): communication module gate

        // CRUD Endpoints
        group.MapGet("/", GetCampaigns).WithName("GetEmailCampaigns");
        group.MapGet("/{id:guid}", GetCampaignById).WithName("GetEmailCampaign");
        group.MapPost("/", CreateCampaign).WithName("CreateEmailCampaign");
        group.MapPut("/{id:guid}", UpdateCampaign).WithName("UpdateEmailCampaign");
        group.MapDelete("/{id:guid}", DeleteCampaign).WithName("DeleteEmailCampaign");

        // Actions
        group.MapPost("/{id:guid}/send", SendCampaign).WithName("SendEmailCampaign");
        group.MapPost("/{id:guid}/test", SendTestEmail).WithName("SendTestEmail");
        group.MapPost("/{id:guid}/schedule", ScheduleCampaign).WithName("ScheduleEmailCampaign");
        group.MapPost("/{id:guid}/cancel", CancelCampaign).WithName("CancelEmailCampaign");
        group.MapPost("/{id:guid}/resend", ResendCampaign).WithName("ResendEmailCampaign");
        group.MapPost("/{id:guid}/resend-failed", ResendFailedCampaign).WithName("ResendFailedEmailCampaign");

        // Recipients
        group.MapGet("/{id:guid}/recipients", GetRecipients).WithName("GetEmailRecipients");
        group.MapPost("/{id:guid}/recipients/preview", PreviewRecipients).WithName("PreviewEmailRecipients");

        // Statistics
        group.MapGet("/{id:guid}/statistics", GetStatistics).WithName("GetEmailCampaignStatistics");

        return app;
    }

    /// <summary>
    /// Alle Kampagnen abrufen (paginiert)
    /// </summary>
    private static async Task<IResult> GetCampaigns(
        [FromServices] IEmailCampaignRepository repository,
        [FromQuery] string? search,
        [FromQuery] EmailCampaignStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var filter = new EmailCampaignFilterOptions
        {
            SearchTerm = search,
            Status = status
        };

        var (items, totalCount) = await repository.GetAllAsync(filter, page, pageSize);

        return Results.Ok(new
        {
            items = items.Select(MapToDto),
            page,
            pageSize,
            totalCount,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    /// <summary>
    /// Kampagne nach ID abrufen
    /// </summary>
    private static async Task<IResult> GetCampaignById(
        [FromServices] IEmailCampaignRepository repository,
        Guid id)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        return Results.Ok(MapToDetailDto(campaign));
    }

    /// <summary>
    /// Neue Kampagne erstellen
    /// </summary>
    private static async Task<IResult> CreateCampaign(
        [FromServices] IEmailCampaignRepository repository,
        [FromBody] CreateEmailCampaignRequest request,
        HttpContext httpContext)
    {
        var userId = httpContext.GetUserId();
        var userName = httpContext.GetUserName();

        var campaign = EmailCampaign.Create(
            request.Name,
            request.Subject,
            request.HtmlContent,
            request.FromName,
            request.FromEmail,
            userId,
            userName,
            request.SegmentType);

        if (!string.IsNullOrEmpty(request.PlainTextContent))
        {
            campaign.Update(
                request.Name,
                request.Subject,
                request.HtmlContent,
                request.PlainTextContent,
                request.FromName,
                request.FromEmail,
                request.ReplyToEmail);
        }

        if (!string.IsNullOrEmpty(request.SegmentFilter))
        {
            campaign.SetSegment(request.SegmentType, request.SegmentFilter, request.EventId);
        }

        await repository.AddAsync(campaign);

        return Results.Created($"/api/v1/email-campaigns/{campaign.Id}", MapToDetailDto(campaign));
    }

    /// <summary>
    /// Kampagne aktualisieren
    /// </summary>
    private static async Task<IResult> UpdateCampaign(
        [FromServices] IEmailCampaignRepository repository,
        Guid id,
        [FromBody] UpdateEmailCampaignRequest request)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        campaign.Update(
            request.Name,
            request.Subject,
            request.HtmlContent,
            request.PlainTextContent,
            request.FromName,
            request.FromEmail,
            request.ReplyToEmail);

        campaign.SetSegment(request.SegmentType, request.SegmentFilter, request.EventId);

        await repository.UpdateAsync(campaign);
        return Results.Ok(MapToDetailDto(campaign));
    }

    /// <summary>
    /// Kampagne löschen (nur Drafts)
    /// </summary>
    private static async Task<IResult> DeleteCampaign(
        [FromServices] IEmailCampaignRepository repository,
        Guid id)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        if (campaign.Status != EmailCampaignStatus.Draft)
            return Results.BadRequest(new { error = "Only draft campaigns can be deleted" });

        await repository.DeleteAsync(id);
        return Results.NoContent();
    }

    /// <summary>
    /// Kampagne sofort versenden
    /// </summary>
    private static async Task<IResult> SendCampaign(
        [FromServices] IEmailCampaignRepository repository,
        [FromServices] IMemberRepository memberRepository,
        [FromServices] IConsentRepository consentRepository,
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromServices] IMemberSegmentRepository memberSegmentRepository,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] IEmailCampaignJobService jobService,
        Guid id)
    {
        var campaign = await repository.GetByIdWithRecipientsAsync(id);
        if (campaign == null)
            return Results.NotFound();

            // Empfänger basierend auf Segment laden
            var recipients = await LoadRecipientsForCampaign(campaign, memberRepository, consentRepository, subscriberRepository, memberSegmentRepository, dbContext);
            foreach (var recipient in recipients)
            {
                campaign.AddRecipient(recipient);
            }

            campaign.StartSending();
            await repository.UpdateAsync(campaign);

            // E-Mails via Hangfire im Hintergrund versenden (zuverlässig)
            var jobId = jobService.EnqueueCampaignSending(campaign.Id);

            return Results.Ok(new
            {
                message = "Campaign sending started",
                recipientCount = campaign.TotalRecipients,
                jobId
            });
    }

    /// <summary>
    /// Test-E-Mail versenden
    /// </summary>
    private static async Task<IResult> SendTestEmail(
        [FromServices] IEmailCampaignRepository repository,
        [FromServices] IEmailSender emailSender,
        Guid id,
        [FromBody] SendTestEmailRequest request)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        await emailSender.SendAsync(
            request.TestEmail,
            $"[TEST] {campaign.Subject}",
            campaign.HtmlContent,
            campaign.PlainTextContent,
            campaign.FromName,
            campaign.FromEmail);

        return Results.Ok(new { message = $"Test email sent to {request.TestEmail}" });
    }

    /// <summary>
    /// Kampagne für späteren Versand planen
    /// </summary>
    private static async Task<IResult> ScheduleCampaign(
        [FromServices] IEmailCampaignRepository repository,
        [FromServices] IMemberRepository memberRepository,
        [FromServices] IConsentRepository consentRepository,
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromServices] IMemberSegmentRepository memberSegmentRepository,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] IEmailCampaignJobService jobService,
        Guid id,
        [FromBody] ScheduleCampaignRequest request)
    {
        var campaign = await repository.GetByIdWithRecipientsAsync(id);
        if (campaign == null)
            return Results.NotFound();

            // Empfänger vorab laden
            var recipients = await LoadRecipientsForCampaign(campaign, memberRepository, consentRepository, subscriberRepository, memberSegmentRepository, dbContext);
            foreach (var recipient in recipients)
            {
                campaign.AddRecipient(recipient);
            }

            campaign.Schedule(request.ScheduledAt);
            await repository.UpdateAsync(campaign);

            // Hangfire Job für den geplanten Zeitpunkt erstellen
            var jobId = jobService.ScheduleCampaignSending(campaign.Id, request.ScheduledAt);

            return Results.Ok(new
            {
                id = campaign.Id,
                name = campaign.Name,
                status = campaign.Status,
                scheduledAt = campaign.ScheduledAt,
                totalRecipients = campaign.TotalRecipients,
                hangfireJobId = jobId
            });
    }

    /// <summary>
    /// Kampagne abbrechen
    /// </summary>
    private static async Task<IResult> CancelCampaign(
        [FromServices] IEmailCampaignRepository repository,
        Guid id)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        campaign.Cancel();
        await repository.UpdateAsync(campaign);
        return Results.Ok(MapToDetailDto(campaign));
    }

    /// <summary>
    /// Kampagne erneut an alle Empfänger senden
    /// </summary>
    private static async Task<IResult> ResendCampaign(
        [FromServices] IEmailCampaignRepository repository,
        [FromServices] IEmailCampaignJobService jobService,
        Guid id)
    {
        var campaign = await repository.GetByIdWithRecipientsAsync(id);
        if (campaign == null)
            return Results.NotFound();

        if (campaign.Status != EmailCampaignStatus.Sent)
            return Results.BadRequest(new { error = "Only sent campaigns can be resent" });

        // Reset all recipients to pending status
        foreach (var recipient in campaign.Recipients)
        {
            recipient.ResetToPending();
        }

        campaign.StartResending();
        await repository.UpdateAsync(campaign);

        // E-Mails via Hangfire im Hintergrund versenden
        var jobId = jobService.EnqueueCampaignSending(campaign.Id);

        return Results.Ok(new
        {
            message = "Campaign resend started",
            recipientCount = campaign.TotalRecipients,
            jobId
        });
    }

    /// <summary>
    /// Nur fehlgeschlagene E-Mails erneut senden
    /// </summary>
    private static async Task<IResult> ResendFailedCampaign(
        [FromServices] IEmailCampaignRepository repository,
        [FromServices] IEmailCampaignJobService jobService,
        Guid id)
    {
        var campaign = await repository.GetByIdWithRecipientsAsync(id);
        if (campaign == null)
            return Results.NotFound();

        if (campaign.Status != EmailCampaignStatus.Sent)
            return Results.BadRequest(new { error = "Only sent campaigns can be resent" });

        var failedRecipients = campaign.Recipients
            .Where(r => r.Status == EmailRecipientStatus.Failed || r.Status == EmailRecipientStatus.Bounced)
            .ToList();

        if (!failedRecipients.Any())
            return Results.BadRequest(new { error = "No failed recipients to resend" });

        // Reset only failed recipients to pending status
        foreach (var recipient in failedRecipients)
        {
            recipient.ResetToPending();
        }

        campaign.StartResending();
        await repository.UpdateAsync(campaign);

        // E-Mails via Hangfire im Hintergrund versenden
        var jobId = jobService.EnqueueCampaignSending(campaign.Id);

        return Results.Ok(new
        {
            message = "Campaign resend for failed recipients started",
            recipientCount = failedRecipients.Count,
            jobId
        });
    }

    /// <summary>
    /// Empfänger einer Kampagne abrufen
    /// </summary>
    private static async Task<IResult> GetRecipients(
        [FromServices] IEmailCampaignRepository repository,
        Guid id,
        [FromQuery] EmailRecipientStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var (items, totalCount) = await repository.GetRecipientsAsync(id, status, page, pageSize);

        return Results.Ok(new
        {
            items = items.Select(MapRecipientToDto),
            page,
            pageSize,
            totalCount,
            totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    /// <summary>
    /// Vorschau der Empfänger basierend auf Segment
    /// </summary>
    private static async Task<IResult> PreviewRecipients(
        [FromServices] IMemberRepository memberRepository,
        [FromServices] IConsentRepository consentRepository,
        [FromServices] INewsletterSubscriberRepository subscriberRepository,
        [FromServices] IMemberSegmentRepository memberSegmentRepository,
        [FromServices] ApplicationDbContext dbContext,
        Guid id,
        [FromBody] PreviewRecipientsRequest request)
    {
        var members = await GetMembersForSegment(memberRepository, consentRepository, request.SegmentType, request.SegmentFilter, memberSegmentRepository, dbContext);

        var memberPreviews = members.Take(10).Select(m => new
        {
            m.Id,
            m.Email,
            m.FirstName,
            m.LastName
        }).ToList();

        var totalCount = members.Count;

        // Include external newsletter subscribers in preview
        if (request.SegmentType == RecipientSegmentType.NewsletterSubscribers)
        {
            var subscribers = await subscriberRepository.GetActiveSubscribersAsync();
            totalCount += subscribers.Count;
        }

        return Results.Ok(new
        {
            totalCount,
            preview = memberPreviews
        });
    }

    /// <summary>
    /// Statistiken einer Kampagne abrufen
    /// </summary>
    private static async Task<IResult> GetStatistics(
        [FromServices] IEmailCampaignRepository repository,
        Guid id)
    {
        var campaign = await repository.GetByIdAsync(id);
        if (campaign == null)
            return Results.NotFound();

        var stats = await repository.GetStatisticsAsync(id);

        return Results.Ok(stats);
    }

    // Helper Methods

    private static async Task<List<EmailRecipient>> LoadRecipientsForCampaign(
        EmailCampaign campaign,
        IMemberRepository memberRepository,
        IConsentRepository consentRepository,
        INewsletterSubscriberRepository subscriberRepository,
        IMemberSegmentRepository? memberSegmentRepository = null,
        ApplicationDbContext? dbContext = null)
    {
        var members = await GetMembersForSegment(memberRepository, consentRepository, campaign.SegmentType, campaign.SegmentFilter, memberSegmentRepository, dbContext);

        var recipients = members.Select(m => EmailRecipient.CreateForMember(
            campaign.Id,
            m.Id,
            m.Email,
            m.FirstName,
            m.LastName)).ToList();

        // Include external newsletter subscribers
        if (campaign.SegmentType == RecipientSegmentType.NewsletterSubscribers)
        {
            var subscribers = await subscriberRepository.GetActiveSubscribersAsync();
            var memberEmails = new HashSet<string>(recipients.Select(r => r.Email), StringComparer.OrdinalIgnoreCase);
            foreach (var sub in subscribers.Where(s => !memberEmails.Contains(s.Email)))
            {
                recipients.Add(EmailRecipient.CreateExternal(
                    campaign.Id,
                    sub.Email,
                    sub.FirstName,
                    sub.LastName));
            }
        }

        return recipients;
    }

    private static async Task<List<Member>> GetMembersForSegment(
        IMemberRepository memberRepository,
        IConsentRepository consentRepository,
        RecipientSegmentType segmentType,
        string? segmentFilter,
        IMemberSegmentRepository? memberSegmentRepository = null,
        ApplicationDbContext? dbContext = null)
    {
        // REQ-017: Handle MemberSegment type
        if (segmentType == RecipientSegmentType.MemberSegment
            && memberSegmentRepository != null
            && dbContext != null
            && Guid.TryParse(segmentFilter, out var segmentId))
        {
            var segment = await memberSegmentRepository.GetByIdWithAssignmentsAsync(segmentId);
            if (segment == null) return [];

            IQueryable<Member> membersQuery;
            if (segment.SegmentType == SegmentType.Dynamic && !string.IsNullOrWhiteSpace(segment.CriteriaJson))
            {
                var criteria = JsonSerializer.Deserialize<SegmentCriteria>(
                    segment.CriteriaJson,
                    MemberSegmentEndpoints.JsonOptionsInternal);
                membersQuery = dbContext.Members.AsQueryable();
                if (criteria != null)
                    membersQuery = MemberSegmentEndpoints.ApplyCriteria(membersQuery, criteria);
            }
            else
            {
                var memberIds = segment.Assignments.Select(a => a.MemberId).ToList();
                membersQuery = dbContext.Members.Where(m => memberIds.Contains(m.Id));
            }

            return await membersQuery.Where(m => !string.IsNullOrEmpty(m.Email)).ToListAsync();
        }

        var (members, _) = await memberRepository.GetPagedAsync(
            page: 1,
            pageSize: 10000,
            status: MembershipStatus.Active);

        var activeWithEmail = members.Where(m => !string.IsNullOrEmpty(m.Email)).ToList();

        // REQ-029: Filter by newsletter consent when segment is NewsletterSubscribers
        if (segmentType == RecipientSegmentType.NewsletterSubscribers)
        {
            var consentedUserIds = await consentRepository.GetUsersWithConsentAsync(ConsentType.Newsletter);
            activeWithEmail = activeWithEmail
                .Where(m => m.KeycloakUserId.HasValue && consentedUserIds.Contains(m.KeycloakUserId.Value))
                .ToList();
        }

        return activeWithEmail;
    }

    private static async Task SendEmailsAsync(
        EmailCampaign campaign,
        IEmailSender emailSender,
        IEmailCampaignRepository repository)
    {
        foreach (var recipient in campaign.Recipients)
        {
            try
            {
                var personalizedHtml = PersonalizeContent(campaign.HtmlContent, recipient);
                var personalizedText = campaign.PlainTextContent != null
                    ? PersonalizeContent(campaign.PlainTextContent, recipient)
                    : null;

                await emailSender.SendAsync(
                    recipient.Email,
                    campaign.Subject,
                    personalizedHtml,
                    personalizedText,
                    campaign.FromName,
                    campaign.FromEmail);

                recipient.MarkAsSent();
                await repository.UpdateRecipientAsync(recipient);
            }
            catch (Exception ex)
            {
                recipient.MarkAsFailed(ex.Message);
                await repository.UpdateRecipientAsync(recipient);
            }
        }

        var stats = await repository.GetStatisticsAsync(campaign.Id);
        campaign.UpdateStatistics(
            stats.SentCount,
            stats.DeliveredCount,
            stats.OpenedCount,
            stats.ClickedCount,
            stats.BouncedCount,
            stats.FailedCount);
        campaign.CompleteSending();
        await repository.UpdateAsync(campaign);
    }

    private static string PersonalizeContent(string content, EmailRecipient recipient, string? unsubscribeLink = null)
    {
        var result = content
            .Replace("{{firstName}}", recipient.FirstName ?? "")
            .Replace("{{lastName}}", recipient.LastName ?? "")
            .Replace("{{email}}", recipient.Email)
            .Replace("{{fullName}}", recipient.FullName);

        if (unsubscribeLink != null)
            result = result.Replace("{{unsubscribeLink}}", unsubscribeLink);

        return result;
    }

    // DTO Mappings
    private static object MapToDto(EmailCampaign campaign) => new
    {
        campaign.Id,
        campaign.Name,
        campaign.Subject,
        campaign.Status,
        campaign.SegmentType,
        campaign.TotalRecipients,
        campaign.SentCount,
        campaign.OpenedCount,
        campaign.CreatedAt,
        campaign.ScheduledAt,
        campaign.SentAt,
        campaign.CreatedByName
    };

    private static object MapToDetailDto(EmailCampaign campaign) => new
    {
        campaign.Id,
        campaign.Name,
        campaign.Subject,
        campaign.HtmlContent,
        campaign.PlainTextContent,
        campaign.FromName,
        campaign.FromEmail,
        campaign.ReplyToEmail,
        campaign.SegmentType,
        campaign.SegmentFilter,
        campaign.EventId,
        campaign.Status,
        campaign.ScheduledAt,
        campaign.SentAt,
        campaign.CompletedAt,
        campaign.TotalRecipients,
        campaign.SentCount,
        campaign.DeliveredCount,
        campaign.OpenedCount,
        campaign.ClickedCount,
        campaign.BouncedCount,
        campaign.FailedCount,
        campaign.CreatedById,
        campaign.CreatedByName,
        campaign.CreatedAt,
        campaign.UpdatedAt
    };

    private static object MapRecipientToDto(EmailRecipient recipient) => new
    {
        recipient.Id,
        recipient.Email,
        recipient.FirstName,
        recipient.LastName,
        recipient.Status,
        recipient.SentAt,
        recipient.DeliveredAt,
        recipient.OpenedAt,
        recipient.ClickedAt,
        recipient.BouncedAt,
        recipient.BounceType,
        recipient.BounceMessage,
        recipient.ErrorMessage
    };
}

// Request DTOs
public record CreateEmailCampaignRequest(
    string Name,
    string Subject,
    string HtmlContent,
    string? PlainTextContent,
    string FromName,
    string FromEmail,
    string? ReplyToEmail,
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    Guid? EventId);

public record UpdateEmailCampaignRequest(
    string Name,
    string Subject,
    string HtmlContent,
    string? PlainTextContent,
    string FromName,
    string FromEmail,
    string? ReplyToEmail,
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    Guid? EventId);

public record SendTestEmailRequest(string TestEmail);

public record ScheduleCampaignRequest(DateTime ScheduledAt);

public record PreviewRecipientsRequest(
    RecipientSegmentType SegmentType,
    string? SegmentFilter);
