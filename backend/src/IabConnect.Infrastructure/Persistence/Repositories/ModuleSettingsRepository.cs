using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository implementation for per-module enablement state (REQ-087, Epic E10).
/// Mirrors <see cref="SystemSettingsRepository"/>.
/// </summary>
public sealed class ModuleSettingsRepository : IModuleSettingsRepository
{
    private readonly ApplicationDbContext _context;

    public ModuleSettingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ModuleSetting>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.ModuleSettings
            .OrderBy(m => m.ModuleKey)
            .ToListAsync(cancellationToken);
    }

    public async Task<ModuleSetting?> GetByKeyAsync(string moduleKey, CancellationToken cancellationToken = default)
    {
        return await _context.ModuleSettings
            .FirstOrDefaultAsync(m => m.ModuleKey == moduleKey, cancellationToken);
    }

    public void Update(ModuleSetting setting)
    {
        _context.ModuleSettings.Update(setting);
    }
}
