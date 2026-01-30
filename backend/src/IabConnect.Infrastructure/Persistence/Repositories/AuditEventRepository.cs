using IabConnect.Domain.Audit;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository implementation for audit events (REQ-011)
/// </summary>
public class AuditEventRepository : IAuditEventRepository
{
    private readonly ApplicationDbContext _context;

    public AuditEventRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default)
    {
        _context.AuditEvents.Add(auditEvent);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<(IReadOnlyList<AuditEvent> Items, int TotalCount)> GetAsync(
        AuditEventFilter filter,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        var query = _context.AuditEvents.AsQueryable();

        // Apply filters
        if (filter.FromDate.HasValue)
            query = query.Where(e => e.Timestamp >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            query = query.Where(e => e.Timestamp <= filter.ToDate.Value);

        if (filter.EventType.HasValue)
            query = query.Where(e => e.EventType == filter.EventType.Value);

        if (filter.Category.HasValue)
            query = query.Where(e => e.Category == filter.Category.Value);

        if (filter.Severity.HasValue)
            query = query.Where(e => e.Severity == filter.Severity.Value);

        if (!string.IsNullOrEmpty(filter.UserId))
            query = query.Where(e => e.UserId == filter.UserId);

        if (!string.IsNullOrEmpty(filter.EntityType))
            query = query.Where(e => e.EntityType == filter.EntityType);

        if (!string.IsNullOrEmpty(filter.EntityId))
            query = query.Where(e => e.EntityId == filter.EntityId);

        if (filter.Success.HasValue)
            query = query.Where(e => e.Success == filter.Success.Value);

        if (!string.IsNullOrEmpty(filter.SearchTerm))
        {
            var searchLower = filter.SearchTerm.ToLower();
            query = query.Where(e =>
                (e.Action != null && e.Action.ToLower().Contains(searchLower)) ||
                (e.UserName != null && e.UserName.ToLower().Contains(searchLower)) ||
                (e.EntityId != null && e.EntityId.ToLower().Contains(searchLower)));
        }

        // Get total count
        var totalCount = await query.CountAsync(ct);

        // Apply ordering and pagination
        var items = await query
            .OrderByDescending(e => e.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<AuditEvent>> GetByEntityAsync(
        string entityType,
        string entityId,
        CancellationToken ct = default)
    {
        return await _context.AuditEvents
            .Where(e => e.EntityType == entityType && e.EntityId == entityId)
            .OrderByDescending(e => e.Timestamp)
            .Take(100)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<AuditEvent>> GetByUserAsync(
        string userId,
        int limit = 100,
        CancellationToken ct = default)
    {
        return await _context.AuditEvents
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.Timestamp)
            .Take(limit)
            .ToListAsync(ct);
    }
}
