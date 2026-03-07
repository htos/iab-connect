using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-026: Repository-Implementierung für E-Mail-Kampagnen
/// </summary>
public sealed class EmailCampaignRepository : IEmailCampaignRepository
{
    private readonly ApplicationDbContext _context;

    public EmailCampaignRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<EmailCampaign?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.EmailCampaigns
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task<EmailCampaign?> GetByIdWithRecipientsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.EmailCampaigns
            .Include(c => c.Recipients)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
    }

    public async Task<(IReadOnlyList<EmailCampaign> Items, int TotalCount)> GetAllAsync(
        EmailCampaignFilterOptions? filter = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EmailCampaigns.AsQueryable();

        if (filter != null)
        {
            if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
            {
                var term = filter.SearchTerm.ToLower();
                query = query.Where(c =>
                    c.Name.ToLower().Contains(term) ||
                    c.Subject.ToLower().Contains(term));
            }

            if (filter.Status.HasValue)
            {
                query = query.Where(c => c.Status == filter.Status.Value);
            }

            if (filter.CreatedFrom.HasValue)
            {
                query = query.Where(c => c.CreatedAt >= filter.CreatedFrom.Value);
            }

            if (filter.CreatedTo.HasValue)
            {
                query = query.Where(c => c.CreatedAt <= filter.CreatedTo.Value);
            }

            if (filter.CreatedById.HasValue)
            {
                query = query.Where(c => c.CreatedById == filter.CreatedById.Value);
            }

            // Sorting
            query = filter.SortBy?.ToLower() switch
            {
                "name" => filter.SortDescending ? query.OrderByDescending(c => c.Name) : query.OrderBy(c => c.Name),
                "status" => filter.SortDescending ? query.OrderByDescending(c => c.Status) : query.OrderBy(c => c.Status),
                "sentat" => filter.SortDescending ? query.OrderByDescending(c => c.SentAt) : query.OrderBy(c => c.SentAt),
                _ => filter.SortDescending ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(c => c.CreatedAt);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<EmailCampaign>> GetByStatusAsync(
        EmailCampaignStatus status,
        CancellationToken cancellationToken = default)
    {
        return await _context.EmailCampaigns
            .Where(c => c.Status == status)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EmailCampaign>> GetScheduledCampaignsReadyToSendAsync(
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        return await _context.EmailCampaigns
            .Where(c => c.Status == EmailCampaignStatus.Scheduled &&
                        c.ScheduledAt.HasValue &&
                        c.ScheduledAt.Value <= now)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(EmailCampaign campaign, CancellationToken cancellationToken = default)
    {
        await _context.EmailCampaigns.AddAsync(campaign, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(EmailCampaign campaign, CancellationToken cancellationToken = default)
    {
        _context.EmailCampaigns.Update(campaign);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var campaign = await GetByIdAsync(id, cancellationToken);
        if (campaign != null)
        {
            _context.EmailCampaigns.Remove(campaign);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<(IReadOnlyList<EmailRecipient> Items, int TotalCount)> GetRecipientsAsync(
        Guid campaignId,
        EmailRecipientStatus? statusFilter = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EmailRecipients
            .Where(r => r.CampaignId == campaignId);

        if (statusFilter.HasValue)
        {
            query = query.Where(r => r.Status == statusFilter.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(r => r.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<EmailRecipient?> GetRecipientByIdAsync(
        Guid recipientId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EmailRecipients
            .FirstOrDefaultAsync(r => r.Id == recipientId, cancellationToken);
    }

    public async Task<EmailRecipient?> GetRecipientByExternalIdAsync(
        string externalMessageId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EmailRecipients
            .FirstOrDefaultAsync(r => r.ExternalMessageId == externalMessageId, cancellationToken);
    }

    public async Task UpdateRecipientAsync(EmailRecipient recipient, CancellationToken cancellationToken = default)
    {
        _context.EmailRecipients.Update(recipient);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<EmailCampaignStatistics> GetStatisticsAsync(Guid campaignId, CancellationToken cancellationToken = default)
    {
        var recipients = await _context.EmailRecipients
            .Where(r => r.CampaignId == campaignId)
            .ToListAsync(cancellationToken);

        var total = recipients.Count;
        var pending = recipients.Count(r => r.Status == EmailRecipientStatus.Pending);
        var sent = recipients.Count(r => r.Status >= EmailRecipientStatus.Sent);
        var delivered = recipients.Count(r => r.Status >= EmailRecipientStatus.Delivered || r.DeliveredAt.HasValue);
        var opened = recipients.Count(r => r.OpenedAt.HasValue);
        var clicked = recipients.Count(r => r.ClickedAt.HasValue);
        var bounced = recipients.Count(r => r.Status == EmailRecipientStatus.Bounced);
        var failed = recipients.Count(r => r.Status == EmailRecipientStatus.Failed);
        var skipped = recipients.Count(r => r.Status == EmailRecipientStatus.Skipped);

        var openRate = delivered > 0 ? Math.Round((decimal)opened / delivered * 100, 2) : 0;
        var clickRate = opened > 0 ? Math.Round((decimal)clicked / opened * 100, 2) : 0;
        var bounceRate = sent > 0 ? Math.Round((decimal)bounced / sent * 100, 2) : 0;

        return new EmailCampaignStatistics(
            total, pending, sent, delivered, opened, clicked, bounced, failed, skipped,
            openRate, clickRate, bounceRate);
    }

    public async Task<bool> IsEmailInCampaignAsync(Guid campaignId, string email, CancellationToken cancellationToken = default)
    {
        return await _context.EmailRecipients
            .AnyAsync(r => r.CampaignId == campaignId && r.Email == email.ToLower(), cancellationToken);
    }
}
