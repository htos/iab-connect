using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-019: Event repository implementation
/// </summary>
public sealed class EventRepository : IEventRepository
{
    private readonly ApplicationDbContext _context;

    public EventRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Event?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Events
            .FirstOrDefaultAsync(e => e.Id == id, ct);
    }

    public async Task<IReadOnlyList<Event>> GetAllAsync(CancellationToken ct = default)
    {
        return await _context.Events
            .OrderByDescending(e => e.StartDate)
            .ToListAsync(ct);
    }

    public async Task<(IReadOnlyList<Event> Items, int TotalCount)> GetPagedAsync(
        EventFilterOptions filter,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var query = BuildFilterQuery(filter);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(e => e.StartDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<Event>> GetUpcomingAsync(int count = 10, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        return await _context.Events
            .Where(e => e.Status == EventStatus.Published)
            .Where(e => e.EndDate >= now)
            .OrderBy(e => e.StartDate)
            .Take(count)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Event>> GetByOrganizerAsync(Guid organizerId, CancellationToken ct = default)
    {
        return await _context.Events
            .Where(e => e.OrganizerId == organizerId)
            .OrderByDescending(e => e.StartDate)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Event>> GetByDateRangeAsync(DateTime start, DateTime end, CancellationToken ct = default)
    {
        return await _context.Events
            .Where(e => e.StartDate >= start && e.StartDate <= end)
            .OrderBy(e => e.StartDate)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<Event>> GetPublicEventsAsync(
        DateTime? from = null,
        DateTime? to = null,
        CancellationToken ct = default)
    {
        var fromDate = from ?? DateTime.UtcNow;

        var query = _context.Events
            .Where(e => e.Visibility == EventVisibility.Public)
            .Where(e => e.Status == EventStatus.Published)
            .Where(e => e.EndDate >= fromDate);

        // R4-P-S5-1: optional forward bound pushed into SQL so the unauthenticated calendar
        // feed no longer materialises every published public event before filtering in memory.
        if (to.HasValue)
            query = query.Where(e => e.EndDate <= to.Value);

        return await query
            .OrderBy(e => e.StartDate)
            .ToListAsync(ct);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Events.AnyAsync(e => e.Id == id, ct);
    }

    public async Task<int> GetCountAsync(EventFilterOptions? filter = null, CancellationToken ct = default)
    {
        if (filter == null)
            return await _context.Events.CountAsync(ct);

        return await BuildFilterQuery(filter).CountAsync(ct);
    }

    public async Task AddAsync(Event evt, CancellationToken ct = default)
    {
        await _context.Events.AddAsync(evt, ct);
    }

    public void Update(Event evt)
    {
        _context.Events.Update(evt);
    }

    public void Remove(Event evt)
    {
        // Soft delete via the entity method
        evt.Delete();
        _context.Events.Update(evt);
    }

    private IQueryable<Event> BuildFilterQuery(EventFilterOptions filter)
    {
        IQueryable<Event> query = _context.Events;

        // Handle soft delete filter
        if (filter.IncludeDeleted)
        {
            query = _context.Events.IgnoreQueryFilters();
        }

        // Public only filter
        if (filter.PublicOnly)
        {
            query = query.Where(e => e.Visibility == EventVisibility.Public && e.Status == EventStatus.Published);
        }

        // Search term
        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.ToLower();
            query = query.Where(e =>
                e.Title.ToLower().Contains(term) ||
                e.Description.ToLower().Contains(term) ||
                e.Location.ToLower().Contains(term) ||
                (e.OrganizerName != null && e.OrganizerName.ToLower().Contains(term)));
        }

        // Status filter
        if (filter.Status.HasValue)
        {
            query = query.Where(e => e.Status == filter.Status.Value);
        }

        // Visibility filter
        if (filter.Visibility.HasValue)
        {
            query = query.Where(e => e.Visibility == filter.Visibility.Value);
        }

        // Category filter
        if (filter.Category.HasValue)
        {
            query = query.Where(e => e.Category == filter.Category.Value);
        }

        // Organizer filter
        if (filter.OrganizerId.HasValue)
        {
            query = query.Where(e => e.OrganizerId == filter.OrganizerId.Value);
        }

        // Date range filter
        if (filter.FromDate.HasValue)
        {
            query = query.Where(e => e.StartDate >= filter.FromDate.Value);
        }

        if (filter.ToDate.HasValue)
        {
            query = query.Where(e => e.StartDate <= filter.ToDate.Value);
        }

        if (filter.EndDateFrom.HasValue)
        {
            query = query.Where(e => e.EndDate >= filter.EndDateFrom.Value);
        }

        // Free events filter
        if (filter.IsFree.HasValue)
        {
            if (filter.IsFree.Value)
            {
                query = query.Where(e => !e.Cost.HasValue || e.Cost.Value == 0);
            }
            else
            {
                query = query.Where(e => e.Cost.HasValue && e.Cost.Value > 0);
            }
        }

        return query;
    }
}
