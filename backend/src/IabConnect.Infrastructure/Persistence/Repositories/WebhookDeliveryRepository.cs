using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>REQ-058 (E8-S4): EF Core repository for <see cref="WebhookDelivery"/>.</summary>
public sealed class WebhookDeliveryRepository : IWebhookDeliveryRepository
{
    private readonly ApplicationDbContext _context;

    public WebhookDeliveryRepository(ApplicationDbContext context) => _context = context;

    public async Task<WebhookDelivery?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.WebhookDeliveries.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

    public async Task<IReadOnlyList<WebhookDelivery>> GetRecentForSubscriptionAsync(
        Guid subscriptionId, int limit, CancellationToken cancellationToken = default)
        => await _context.WebhookDeliveries
            .Where(d => d.SubscriptionId == subscriptionId)
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

    public async Task<(IReadOnlyList<WebhookDelivery> Items, int TotalCount)> GetPagedAsync(
        Guid? subscriptionId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.WebhookDeliveries.AsQueryable();
        if (subscriptionId.HasValue)
            query = query.Where(d => d.SubscriptionId == subscriptionId.Value);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        return (items, total);
    }

    public async Task AddAsync(WebhookDelivery delivery, CancellationToken cancellationToken = default)
    {
        await _context.WebhookDeliveries.AddAsync(delivery, cancellationToken);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Claim-before-send (A66): on a unique-DedupKey collision the failed row must NOT stay
            // tracked in Added state — otherwise the next AddAsync on this DbContext would re-attempt
            // the doomed insert and poison an unrelated delivery in the same emit loop. Detach + rethrow
            // so the dispatch service can abandon this one delivery cleanly.
            _context.Entry(delivery).State = EntityState.Detached;
            throw;
        }
    }

    public async Task UpdateAsync(WebhookDelivery delivery, CancellationToken cancellationToken = default)
    {
        _context.WebhookDeliveries.Update(delivery);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
