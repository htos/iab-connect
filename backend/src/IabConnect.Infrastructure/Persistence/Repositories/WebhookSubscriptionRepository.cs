using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>REQ-058 (E8-S3): EF Core repository for <see cref="WebhookSubscription"/>.</summary>
public sealed class WebhookSubscriptionRepository : IWebhookSubscriptionRepository
{
    private readonly ApplicationDbContext _context;

    public WebhookSubscriptionRepository(ApplicationDbContext context) => _context = context;

    public async Task<WebhookSubscription?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.WebhookSubscriptions.FirstOrDefaultAsync(w => w.Id == id, cancellationToken);

    public async Task<IReadOnlyList<WebhookSubscription>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _context.WebhookSubscriptions
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<WebhookSubscription>> GetActiveForEventTypeAsync(
        string eventType, CancellationToken cancellationToken = default)
    {
        // EventTypes is a converted comma-joined column; filter Active in SQL, then match the
        // subscribed set in memory (the set is small per subscription).
        var active = await _context.WebhookSubscriptions
            .Where(w => w.Status == WebhookSubscriptionStatus.Active)
            .ToListAsync(cancellationToken);
        return active.Where(w => w.EventTypes.Contains(eventType)).ToList();
    }

    public async Task AddAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default)
    {
        await _context.WebhookSubscriptions.AddAsync(subscription, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default)
    {
        _context.WebhookSubscriptions.Update(subscription);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default)
    {
        _context.WebhookSubscriptions.Remove(subscription);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
