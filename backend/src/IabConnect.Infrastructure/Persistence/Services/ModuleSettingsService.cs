using System.Collections.ObjectModel;
using IabConnect.Application.Common;
using Microsoft.Extensions.Caching.Memory;

namespace IabConnect.Infrastructure.Persistence.Services;

/// <summary>
/// Cached implementation of <see cref="IModuleSettingsService"/> (REQ-087, Epic E10).
///
/// <para>The whole module-key → enabled map is cached under one stable key. This is the
/// first cache in the codebase — kept deliberately simple: a single <see cref="IMemoryCache"/>
/// entry, an absolute-expiry backstop, and explicit <see cref="InvalidateCache"/> on write
/// (called by the E10-S2 update command). Lives in Infrastructure because it depends on
/// <see cref="IMemoryCache"/> and <see cref="IModuleSettingsRepository"/>.</para>
/// </summary>
public sealed class ModuleSettingsService : IModuleSettingsService
{
    private const string CacheKey = "module-settings:all";

    // Absolute backstop only — correctness relies on explicit InvalidateCache() on every
    // write, not on this expiry.
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(5);

    private readonly IModuleSettingsRepository _repository;
    private readonly IMemoryCache _cache;

    public ModuleSettingsService(IModuleSettingsRepository repository, IMemoryCache cache)
    {
        _repository = repository;
        _cache = cache;
    }

    public async Task<bool> IsEnabledAsync(string moduleKey, CancellationToken cancellationToken = default)
    {
        var map = await GetAllAsync(cancellationToken);

        // Unknown key => behaviour-preserving "enabled". The seed migration guarantees a row
        // for every ModuleKeys constant, so this only matters for keys that were never seeded.
        return !map.TryGetValue(moduleKey, out var enabled) || enabled;
    }

    public async Task<IReadOnlyDictionary<string, bool>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        if (_cache.TryGetValue(CacheKey, out IReadOnlyDictionary<string, bool>? cached) && cached is not null)
        {
            return cached;
        }

        var settings = await _repository.GetAllAsync(cancellationToken);
        IReadOnlyDictionary<string, bool> map = new ReadOnlyDictionary<string, bool>(
            settings.ToDictionary(s => s.ModuleKey, s => s.Enabled));

        _cache.Set(CacheKey, map, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = CacheLifetime,
        });

        return map;
    }

    public void InvalidateCache()
    {
        _cache.Remove(CacheKey);
    }
}
