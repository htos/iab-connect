using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Persistence.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// REQ-087 (E10-S1): unit coverage for <see cref="ModuleSettingsService"/> — the cached
/// read path. Verifies the module map is loaded from the repository once and then served
/// from <see cref="IMemoryCache"/>, that <see cref="IModuleSettingsService.InvalidateCache"/>
/// forces a reload, and that <see cref="IModuleSettingsService.IsEnabledAsync"/> resolves
/// the cached value (with a behaviour-preserving default for unknown keys, plus an
/// observability warning for out-of-contract keys).
/// </summary>
public sealed class ModuleSettingsServiceTests
{
    private static (ModuleSettingsService service, Mock<IModuleSettingsRepository> repo, Mock<ILogger<ModuleSettingsService>> logger) CreateService(
        params (string key, bool enabled)[] rows)
    {
        var settings = rows
            .Select(r => ModuleSetting.Create(r.key, r.enabled, updatedBy: null))
            .ToList();

        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(settings);

        var cache = new MemoryCache(new MemoryCacheOptions());
        var logger = new Mock<ILogger<ModuleSettingsService>>();
        return (new ModuleSettingsService(repo.Object, cache, logger.Object), repo, logger);
    }

    [Fact]
    public async Task GetAllAsync_CachesAfterFirstRead()
    {
        var (service, repo, _) = CreateService((ModuleKeys.Members, true), (ModuleKeys.Finance, false));

        var first = await service.GetAllAsync(TestContext.Current.CancellationToken);
        var second = await service.GetAllAsync(TestContext.Current.CancellationToken);

        first.Should().ContainKey(ModuleKeys.Members).WhoseValue.Should().BeTrue();
        first.Should().ContainKey(ModuleKeys.Finance).WhoseValue.Should().BeFalse();
        second.Should().BeEquivalentTo(first);
        // Repository hit exactly once across both reads — the second came from the cache.
        repo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task IsEnabledAsync_AlsoServedFromTheSameCachedMap()
    {
        var (service, repo, _) = CreateService((ModuleKeys.Members, true), (ModuleKeys.Finance, false));

        await service.GetAllAsync(TestContext.Current.CancellationToken);
        var membersEnabled = await service.IsEnabledAsync(ModuleKeys.Members, TestContext.Current.CancellationToken);
        var financeEnabled = await service.IsEnabledAsync(ModuleKeys.Finance, TestContext.Current.CancellationToken);

        membersEnabled.Should().BeTrue();
        financeEnabled.Should().BeFalse();
        repo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task InvalidateCache_ForcesReloadOnNextRead()
    {
        var (service, repo, _) = CreateService((ModuleKeys.Members, true));

        await service.GetAllAsync(TestContext.Current.CancellationToken);
        service.InvalidateCache();
        await service.GetAllAsync(TestContext.Current.CancellationToken);

        // Once before invalidation, once after — the cache was genuinely dropped.
        repo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task IsEnabledAsync_UnknownKey_ReturnsTrue()
    {
        var (service, _, _) = CreateService((ModuleKeys.Members, true));

        var result = await service.IsEnabledAsync("not-a-real-module", TestContext.Current.CancellationToken);

        // Behaviour-preserving: an unconfigured module is not treated as disabled.
        result.Should().BeTrue();
    }

    [Fact]
    public async Task IsEnabledAsync_OutOfContractKey_LogsWarning()
    {
        // E10 review patch: a key that is not in ModuleKeys.All (e.g. a typo'd policy
        // string) must not be a silent no-op gate — it stays fail-open but is logged.
        var (service, _, logger) = CreateService((ModuleKeys.Members, true));

        await service.IsEnabledAsync("Module:financ", TestContext.Current.CancellationToken);

        logger.Verify(
            l => l.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, _) => v.ToString()!.Contains("Module:financ")),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [Fact]
    public async Task IsEnabledAsync_KnownKeyMissingSeedRow_DoesNotLogWarning()
    {
        // A known ModuleKeys constant with no seed row is the documented fail-open case —
        // expected, not an error, so it stays quiet.
        var (service, _, logger) = CreateService((ModuleKeys.Members, true));

        await service.IsEnabledAsync(ModuleKeys.Finance, TestContext.Current.CancellationToken);

        logger.Verify(
            l => l.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Never);
    }

    [Fact]
    public async Task GetAllAsync_ConcurrentColdReads_HitRepositoryOnce()
    {
        // E10 review patch: cache stampede — concurrent cache-miss requests must be
        // coordinated so exactly one EF query runs, not one per request. The repo is given
        // an artificial delay so all 20 reads genuinely overlap on the cold cache.
        var settings = new[] { ModuleSetting.Create(ModuleKeys.Members, true, updatedBy: null) };
        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .Returns(async (CancellationToken ct) =>
            {
                await Task.Delay(50, ct);
                return (IReadOnlyList<ModuleSetting>)settings;
            });
        var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new ModuleSettingsService(repo.Object, cache, Mock.Of<ILogger<ModuleSettingsService>>());

        var reads = Enumerable
            .Range(0, 20)
            .Select(_ => Task.Run(() => service.GetAllAsync(TestContext.Current.CancellationToken)));
        await Task.WhenAll(reads);

        repo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
