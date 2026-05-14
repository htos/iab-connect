using FluentAssertions;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-086 (E9-S1) AC-2/AC-12: migration + persistence semantics for the extended
/// <c>system_settings</c> schema. Applies the full migration chain (including
/// <c>ExtendSystemSettingsBranding</c>) to a real PostgreSQL container, then verifies the
/// behaviour-preserving contract — the lazily-created default row stays valid/readable
/// with every new column <c>NULL</c> — and that the seven new columns round-trip.
/// </summary>
public sealed class SystemSettingsMigrationTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _ctx = null!;
    private SystemSettingsRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _ctx = new ApplicationDbContext(options);
        // AC-2: apply the migration chain (not EnsureCreated) so the actual
        // ExtendSystemSettingsBranding migration is exercised against PostgreSQL.
        await _ctx.Database.MigrateAsync(TestContext.Current.CancellationToken);
        _repository = new SystemSettingsRepository(_ctx);
    }

    public async ValueTask DisposeAsync()
    {
        await _ctx.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task DefaultRow_AfterMigration_IsValidWithNewColumnsNull()
    {
        var settings = await _repository.GetSettingsAsync(TestContext.Current.CancellationToken);

        settings.Should().NotBeNull();
        settings.ApplicationName.Should().NotBeNullOrEmpty();
        // AC-2: behaviour-preserving — every new column is NULL on the existing row.
        settings.Description.Should().BeNull();
        settings.ContactEmail.Should().BeNull();
        settings.ContactPhone.Should().BeNull();
        settings.ContactAddress.Should().BeNull();
        settings.PrimaryColor.Should().BeNull();
        settings.PublicSiteEnabled.Should().BeNull();
        settings.LogoAssetKey.Should().BeNull();
    }

    [Fact]
    public async Task ExtendedFields_RoundTripThroughPostgres()
    {
        var settings = await _repository.GetSettingsAsync(TestContext.Current.CancellationToken);

        settings.UpdateOrganizationProfile(
            description: "An association",
            contactEmail: "info@acme.example",
            contactPhone: "+41 11 222 33 44",
            contactAddress: "Main Street 1",
            primaryColor: "#EA580C",
            publicSiteEnabled: false,
            updatedBy: "admin");
        settings.SetLogoAssetKey("branding/logo-abc", "admin");
        _repository.Update(settings);
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Re-read from a fresh context to prove the columns actually persisted.
        await using var verifyCtx = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_postgres.GetConnectionString())
                .Options);
        var reloaded = await verifyCtx.SystemSettings.SingleAsync(TestContext.Current.CancellationToken);

        reloaded.Description.Should().Be("An association");
        reloaded.ContactEmail.Should().Be("info@acme.example");
        reloaded.ContactPhone.Should().Be("+41 11 222 33 44");
        reloaded.ContactAddress.Should().Be("Main Street 1");
        reloaded.PrimaryColor.Should().Be("#EA580C");
        reloaded.PublicSiteEnabled.Should().BeFalse();
        reloaded.LogoAssetKey.Should().Be("branding/logo-abc");
    }
}
