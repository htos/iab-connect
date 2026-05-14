using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Persistence.Services;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// REQ-087 (E10-S1): unit coverage for <see cref="ModuleSettingsService"/> — the cached
/// read path. Verifies the module map is loaded from the repository once and then served
/// from <see cref="IMemoryCache"/>, that <see cref="IModuleSettingsService.InvalidateCache"/>
/// forces a reload, and that <see cref="IModuleSettingsService.IsEnabledAsync"/> resolves
/// the cached value (with a behaviour-preserving default for unknown keys).
/// </summary>
public sealed class ModuleSettingsServiceTests
{
    private static (ModuleSettingsService service, Mock<IModuleSettingsRepository> repo) CreateService(
        params (string key, bool enabled)[] rows)
    {
        var settings = rows
            .Select(r => ModuleSetting.Create(r.key, r.enabled, updatedBy: null))
            .ToList();

        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(settings);

        var cache = new MemoryCache(new MemoryCacheOptions());
        return (new ModuleSettingsService(repo.Object, cache), repo);
    }

    [Fact]
    public async Task GetAllAsync_CachesAfterFirstRead()
    {
        var (service, repo) = CreateService((ModuleKeys.Members, true), (ModuleKeys.Finance, false));

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
        var (service, repo) = CreateService((ModuleKeys.Members, true), (ModuleKeys.Finance, false));

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
        var (service, repo) = CreateService((ModuleKeys.Members, true));

        await service.GetAllAsync(TestContext.Current.CancellationToken);
        service.InvalidateCache();
        await service.GetAllAsync(TestContext.Current.CancellationToken);

        // Once before invalidation, once after — the cache was genuinely dropped.
        repo.Verify(r => r.GetAllAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task IsEnabledAsync_UnknownKey_ReturnsTrue()
    {
        var (service, _) = CreateService((ModuleKeys.Members, true));

        var result = await service.IsEnabledAsync("not-a-real-module", TestContext.Current.CancellationToken);

        // Behaviour-preserving: an unconfigured module is not treated as disabled.
        result.Should().BeTrue();
    }
}
