using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-029: Repository implementation for external newsletter subscribers
/// </summary>
public sealed class NewsletterSubscriberRepository : INewsletterSubscriberRepository
{
    private readonly ApplicationDbContext _context;

    public NewsletterSubscriberRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<NewsletterSubscriber?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        return await _context.NewsletterSubscribers
            .FirstOrDefaultAsync(s => s.Email == email.ToLowerInvariant().Trim(), ct);
    }

    public async Task<IReadOnlyList<NewsletterSubscriber>> GetActiveSubscribersAsync(CancellationToken ct = default)
    {
        return await _context.NewsletterSubscribers
            .Where(s => s.IsActive && s.ConfirmedAt != null)
            .ToListAsync(ct);
    }

    public async Task AddAsync(NewsletterSubscriber subscriber, CancellationToken ct = default)
    {
        await _context.NewsletterSubscribers.AddAsync(subscriber, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(NewsletterSubscriber subscriber, CancellationToken ct = default)
    {
        _context.NewsletterSubscribers.Update(subscriber);
        await _context.SaveChangesAsync(ct);
    }
}
