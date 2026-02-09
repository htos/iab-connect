using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Repository implementation for system settings (REQ-059)
/// </summary>
public sealed class SystemSettingsRepository : ISystemSettingsRepository
{
    private readonly ApplicationDbContext _context;

    public SystemSettingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SystemSettings> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await _context.SystemSettings
            .FirstOrDefaultAsync(cancellationToken);

        if (settings is null)
        {
            settings = SystemSettings.CreateDefault();
            await _context.SystemSettings.AddAsync(settings, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        return settings;
    }

    public void Update(SystemSettings settings)
    {
        _context.SystemSettings.Update(settings);
    }
}
