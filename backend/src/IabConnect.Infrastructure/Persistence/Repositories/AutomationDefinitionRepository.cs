using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-028 (E5-S1): EF Core repository for <see cref="AutomationDefinition"/>. Mirrors
/// <see cref="EmailCampaignRepository"/> (paged list with filter, get-by-id, add/update; AddAsync
/// and UpdateAsync own their <c>SaveChangesAsync</c> like the campaign repo).
/// </summary>
public sealed class AutomationDefinitionRepository : IAutomationDefinitionRepository
{
    private readonly ApplicationDbContext _context;

    public AutomationDefinitionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<AutomationDefinition?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.AutomationDefinitions.FirstOrDefaultAsync(a => a.Id == id, cancellationToken);

    public async Task<(IReadOnlyList<AutomationDefinition> Items, int TotalCount)> GetAllAsync(
        AutomationDefinitionFilterOptions? filter = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AutomationDefinitions.AsQueryable();

        if (filter != null)
        {
            if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
            {
                var term = filter.SearchTerm.ToLower();
                query = query.Where(a =>
                    a.Name.ToLower().Contains(term) ||
                    (a.Description != null && a.Description.ToLower().Contains(term)));
            }

            if (filter.Status.HasValue)
                query = query.Where(a => a.Status == filter.Status.Value);

            if (filter.TriggerType.HasValue)
                query = query.Where(a => a.Trigger.Type == filter.TriggerType.Value);

            query = filter.SortBy?.ToLower() switch
            {
                "name" => filter.SortDescending ? query.OrderByDescending(a => a.Name) : query.OrderBy(a => a.Name),
                "status" => filter.SortDescending ? query.OrderByDescending(a => a.Status) : query.OrderBy(a => a.Status),
                _ => filter.SortDescending ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt)
            };
        }
        else
        {
            query = query.OrderByDescending(a => a.CreatedAt);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<AutomationDefinition>> GetActiveAsync(CancellationToken cancellationToken = default)
        => await _context.AutomationDefinitions
            .Where(a => a.Status == AutomationStatus.Active)
            .OrderBy(a => a.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(AutomationDefinition definition, CancellationToken cancellationToken = default)
    {
        await _context.AutomationDefinitions.AddAsync(definition, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(AutomationDefinition definition, CancellationToken cancellationToken = default)
    {
        _context.AutomationDefinitions.Update(definition);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
