using System.Collections.Concurrent;
using IabConnect.Application.Common;
using IabConnect.Domain.Common;

namespace IabConnect.Api.Tests;

/// <summary>
/// In-memory, mutable <see cref="IModuleSettingsService"/> stand-in for API integration tests
/// (REQ-087, E10-S3). Registered as a singleton by <see cref="TestWebApplicationFactory"/> so a
/// test can flip a module off, exercise the live authorization pipeline, and restore state —
/// without touching the shared in-memory DB or the real service's memory cache.
///
/// <para>Defaults to every <see cref="ModuleKeys"/> module ENABLED, which matches the seed
/// state, so API tests that don't care about module configuration see exactly the pre-E10-S3
/// behaviour.</para>
/// </summary>
public sealed class TestModuleSettingsService : IModuleSettingsService
{
    private readonly ConcurrentDictionary<string, bool> _state = new();

    public TestModuleSettingsService() => Reset();

    /// <summary>Restore the all-enabled default. Call from a finally block after flipping state.</summary>
    public void Reset()
    {
        _state.Clear();
        foreach (var key in ModuleKeys.All)
        {
            _state[key] = true;
        }
    }

    public void SetEnabled(string moduleKey, bool enabled) => _state[moduleKey] = enabled;

    public Task<bool> IsEnabledAsync(string moduleKey, CancellationToken cancellationToken = default)
        // Unknown key => enabled, mirroring the real ModuleSettingsService contract.
        => Task.FromResult(!_state.TryGetValue(moduleKey, out var enabled) || enabled);

    public Task<IReadOnlyDictionary<string, bool>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyDictionary<string, bool>>(new Dictionary<string, bool>(_state));

    public void InvalidateCache()
    {
        // No cache in the test double — state is mutated directly via SetEnabled/Reset.
    }
}
