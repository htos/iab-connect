using FluentAssertions;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-087 (E10-S1) AC-1/AC-2/AC-6: migration + persistence semantics for the
/// <c>module_settings</c> table. Applies the full migration chain (including
/// <c>AddModuleSettings</c>) to a real PostgreSQL container and verifies the
/// behaviour-preserving seed (seven enabled rows), the <c>module_key</c> unique
/// constraint, and that <see cref="ModuleSettingsRepository"/> round-trips an update.
/// </summary>
public sealed class ModuleSettingsMigrationTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _ctx = null!;
    private ModuleSettingsRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _ctx = new ApplicationDbContext(options);
        // AC-1/AC-2: apply the migration chain (not EnsureCreated) so the actual
        // AddModuleSettings migration — table, unique index and seed — is exercised.
        await _ctx.Database.MigrateAsync(TestContext.Current.CancellationToken);
        _repository = new ModuleSettingsRepository(_ctx);
    }

    public async ValueTask DisposeAsync()
    {
        await _ctx.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Migration_Seeds_AllEnabledModules()
    {
        var all = await _repository.GetAllAsync(TestContext.Current.CancellationToken);

        all.Should().HaveCount(8); // REQ-058 (E8-S1): AddApiClients seeds the 8th "api" module row
        all.Select(m => m.ModuleKey).Should().BeEquivalentTo(ModuleKeys.All);
        all.Should().OnlyContain(m => m.Enabled, "the seed is behaviour-preserving — every module starts enabled");
    }

    [Fact]
    public async Task ModuleKey_UniqueConstraint_RejectsDuplicate()
    {
        // "members" is already seeded — a second row with the same key must be rejected.
        var duplicate = ModuleSetting.Create(ModuleKeys.Members, enabled: false, updatedBy: "test");
        _ctx.ModuleSettings.Add(duplicate);

        var act = async () => await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Repository_RoundTripsUpdate()
    {
        var setting = await _repository.GetByKeyAsync(ModuleKeys.Events, TestContext.Current.CancellationToken);
        setting.Should().NotBeNull();

        setting!.SetEnabled(enabled: false, updatedBy: "admin");
        _repository.Update(setting);
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Re-read from a fresh context to prove the change actually persisted.
        await using var verifyCtx = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_postgres.GetConnectionString())
                .Options);
        var reloaded = await verifyCtx.ModuleSettings
            .SingleAsync(m => m.ModuleKey == ModuleKeys.Events, TestContext.Current.CancellationToken);

        reloaded.Enabled.Should().BeFalse();
        reloaded.UpdatedBy.Should().Be("admin");
    }
}
