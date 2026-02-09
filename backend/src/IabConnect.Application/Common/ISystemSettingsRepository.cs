using IabConnect.Domain.Common;

namespace IabConnect.Application.Common;

/// <summary>
/// Repository interface for system settings (REQ-059)
/// </summary>
public interface ISystemSettingsRepository
{
    /// <summary>
    /// Get the singleton system settings (creates default if not exists)
    /// </summary>
    Task<SystemSettings> GetSettingsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Update system settings
    /// </summary>
    void Update(SystemSettings settings);
}
