using IabConnect.Domain.Common;

namespace IabConnect.Application.Common;

/// <summary>
/// Repository interface for per-module enablement state (REQ-087, Epic E10).
/// Mirrors <see cref="ISystemSettingsRepository"/>: <see cref="Update"/> stages a change but
/// does not persist — the caller owns <see cref="IUnitOfWork.SaveChangesAsync"/>.
/// </summary>
public interface IModuleSettingsRepository
{
    /// <summary>
    /// Get every module setting row.
    /// </summary>
    Task<IReadOnlyList<ModuleSetting>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a single module setting by its key, or <c>null</c> if no row exists for that key.
    /// </summary>
    Task<ModuleSetting?> GetByKeyAsync(string moduleKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stage an updated module setting. Does not call SaveChanges — the caller owns the
    /// unit of work.
    /// </summary>
    void Update(ModuleSetting setting);
}
