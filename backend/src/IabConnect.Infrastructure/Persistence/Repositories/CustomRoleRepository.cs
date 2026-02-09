using IabConnect.Application.Authorization;
using IabConnect.Domain.Authorization;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository implementation for custom roles (REQ-003, REQ-059)
/// </summary>
public sealed class CustomRoleRepository : ICustomRoleRepository
{
    private readonly ApplicationDbContext _context;

    public CustomRoleRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<CustomRole>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.CustomRoles
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<CustomRole>> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        return await _context.CustomRoles
            .Where(r => r.IsActive)
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<CustomRole?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.CustomRoles
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
    }

    public async Task<CustomRole?> GetByNameAsync(string name, CancellationToken cancellationToken = default)
    {
        return await _context.CustomRoles
            .FirstOrDefaultAsync(r => r.Name.ToLower() == name.ToLower(), cancellationToken);
    }

    public async Task AddAsync(CustomRole customRole, CancellationToken cancellationToken = default)
    {
        await _context.CustomRoles.AddAsync(customRole, cancellationToken);
    }

    public void Update(CustomRole customRole)
    {
        _context.CustomRoles.Update(customRole);
    }

    public void Delete(CustomRole customRole)
    {
        _context.CustomRoles.Remove(customRole);
    }
}
