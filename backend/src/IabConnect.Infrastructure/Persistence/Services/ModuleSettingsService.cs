using System.Collections.ObjectModel;
using System.Diagnostics.CodeAnalysis;
using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

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

    // The service is registered Scoped, but IMemoryCache is a singleton and CacheKey is a
    // single process-wide entry — so the load gate must be static to actually coordinate
    // concurrent cache-miss requests (cold start / right after InvalidateCache()). Without
    // it every concurrent request runs its own EF query (cache stampede).
    private static readonly SemaphoreSlim LoadGate = new(1, 1);

    private readonly IModuleSettingsRepository _repository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ModuleSettingsService> _logger;

    public ModuleSettingsService(
        IModuleSettingsRepository repository,
        IMemoryCache cache,
        ILogger<ModuleSettingsService> logger)
    {
        _repository = repository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<bool> IsEnabledAsync(string moduleKey, CancellationToken cancellationToken = default)
    {
        var map = await GetAllAsync(cancellationToken);

        if (map.TryGetValue(moduleKey, out var enabled))
        {
            return enabled;
        }

        // Key not in the cached map. Two cases, both fail-open (behaviour-preserving — an
        // unconfigured module is not treated as disabled):
        //  - a known ModuleKeys constant with no seed row => documented, expected, stay quiet.
        //  - an out-of-contract key (e.g. a typo'd "Module:financ" policy string) => still
        //    fail-open, but log a warning: a silently no-op gate is an observability hazard.
        if (!ModuleKeys.All.Contains(moduleKey))
        {
            _logger.LogWarning(
                "IsEnabledAsync called with out-of-contract module key '{ModuleKey}' — it is not one of "
                + "ModuleKeys.All. Likely a typo in a policy string or endpoint filter; the gate is a "
                + "silent no-op (treated as enabled). Fix the caller.",
                moduleKey);
        }

        return true;
    }

    public async Task<IReadOnlyDictionary<string, bool>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        if (TryGetCached(out var cached))
        {
            return cached;
        }

        // Coordinated load: serialize concurrent cache-miss requests through a single gate so
        // exactly one EF query runs; the rest re-check the cache and return the loaded map.
        await LoadGate.WaitAsync(cancellationToken);
        try
        {
            // Double-check — another request may have populated the cache while we waited.
            if (TryGetCached(out cached))
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
        finally
        {
            LoadGate.Release();
        }
    }

    public void InvalidateCache()
    {
        _cache.Remove(CacheKey);
    }

    private bool TryGetCached([NotNullWhen(true)] out IReadOnlyDictionary<string, bool>? map)
    {
        return _cache.TryGetValue(CacheKey, out map) && map is not null;
    }
}
