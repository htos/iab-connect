namespace IabConnect.Application.Common;

/// <summary>
/// Fast, cached read access to per-module enablement state (REQ-087, Epic E10).
///
/// <para>Backend module enforcement (E10-S3) and other callers query this service on
/// potentially hot paths, so reads are served from an in-memory cache. The cache is
/// explicitly invalidated by the module-settings update command (E10-S2) via
/// <see cref="InvalidateCache"/>.</para>
/// </summary>
public interface IModuleSettingsService
{
    /// <summary>
    /// Whether the module identified by <paramref name="moduleKey"/> is enabled. An
    /// unknown key resolves to <c>true</c> (behaviour-preserving — an unconfigured module
    /// is not treated as disabled).
    /// </summary>
    Task<bool> IsEnabledAsync(string moduleKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// The full module-key → enabled map.
    /// </summary>
    Task<IReadOnlyDictionary<string, bool>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Drop the cached module map so the next read reloads from the repository. Called by
    /// the module-settings update command after a write.
    /// </summary>
    void InvalidateCache();
}
