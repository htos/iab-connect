// SPDX-License-Identifier: AGPL-3.0-or-later
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 AC-4 (E15-S2 / ADR-015): unit tests for the <c>Database:AutoMigrate</c>
/// startup gate exposed as <see cref="Program.ShouldAutoMigrate"/>. The helper is
/// <c>internal static</c> on <c>Program</c> and is reachable here via the
/// <c>[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]</c> declaration at
/// <c>backend/src/IabConnect.Api/DependencyInjection.cs:17</c>.
///
/// <para>The gate's contract is "skip versioned migrations on api boot". Beta and Dev
/// keep the default <c>true</c>; Production may flip to <c>false</c> via the
/// <c>Database__AutoMigrate=false</c> env var per the E19-S2 manual-migration runbook
/// so a rolling api restart cannot race the schema migration.</para>
///
/// <para>Test shape mirrors <see cref="RetentionEnforcementJobRegistrationTests"/>
/// (in-memory <see cref="IConfiguration"/>; no WebApplicationFactory, no Testcontainers,
/// no full host).</para>
/// </summary>
public sealed class ShouldAutoMigrateTests
{
    [Fact]
    public void ShouldAutoMigrate_DefaultsToTrue_WhenKeyMissing()
    {
        // ADR-015: default value is true so an absent flag preserves Dev/Beta behaviour
        // (auto-migrate on boot). An absent flag must NOT silently skip migrations —
        // that would break first-deploy schema initialisation in any env that forgot
        // to set the key.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        Program.ShouldAutoMigrate(configuration).Should().BeTrue();
    }

    [Fact]
    public void ShouldAutoMigrate_ReturnsTrue_WhenKeyExplicitlyTrue()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:AutoMigrate"] = "true",
            })
            .Build();

        Program.ShouldAutoMigrate(configuration).Should().BeTrue();
    }

    [Fact]
    public void ShouldAutoMigrate_ReturnsFalse_WhenKeyExplicitlyFalse()
    {
        // E15-S2 contract: the only flag-controlled path that suppresses
        // db.Database.MigrateAsync() on api boot is Database:AutoMigrate=false.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:AutoMigrate"] = "false",
            })
            .Build();

        Program.ShouldAutoMigrate(configuration).Should().BeFalse();
    }

    [Fact]
    public void ShouldAutoMigrate_EnvVarOverridesAppSettings_LastSourceWins()
    {
        // Mirrors the runtime layering: appsettings.json sets true; an env-var-shaped
        // override (Database__AutoMigrate=false → Database:AutoMigrate=false in
        // IConfiguration) added later wins. ASP.NET Core's default
        // WebApplication.CreateBuilder configures appsettings.json -> env-vars in that
        // order so env vars override appsettings.json values. AddInMemoryCollection
        // layered twice here simulates that precedence deterministically.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:AutoMigrate"] = "true",
            })
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Database:AutoMigrate"] = "false",
            })
            .Build();

        Program.ShouldAutoMigrate(configuration).Should().BeFalse();
    }
}
