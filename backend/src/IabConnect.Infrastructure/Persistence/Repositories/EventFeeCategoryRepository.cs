using IabConnect.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-022 (E4-S1): EF-backed repository for <see cref="EventFeeCategory"/>.
/// </summary>
public sealed class EventFeeCategoryRepository : IEventFeeCategoryRepository
{
    private readonly ApplicationDbContext _context;

    public EventFeeCategoryRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EventFeeCategory category, CancellationToken cancellationToken = default)
    {
        await _context.EventFeeCategories.AddAsync(category, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(EventFeeCategory category, CancellationToken cancellationToken = default)
    {
        _context.EventFeeCategories.Update(category);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public Task<EventFeeCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.EventFeeCategories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<IReadOnlyList<EventFeeCategory>> GetByEventIdAsync(
        Guid eventId, bool includeInactive = false, CancellationToken cancellationToken = default)
        => await _context.EventFeeCategories
            .Where(c => c.EventId == eventId && (includeInactive || c.IsActive))
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

    public Task<bool> ActiveNameExistsAsync(
        Guid eventId, string name, Guid? excludingId = null, CancellationToken cancellationToken = default)
    {
        var trimmed = (name ?? string.Empty).Trim();
        return _context.EventFeeCategories.AnyAsync(
            c => c.EventId == eventId
                 && c.IsActive
                 && c.Name.ToLower() == trimmed.ToLower()
                 && (excludingId == null || c.Id != excludingId),
            cancellationToken);
    }
}
