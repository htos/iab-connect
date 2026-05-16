// SPDX-License-Identifier: AGPL-3.0-or-later
using System.IO;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 (E11-S2): verifies the base + Beta configuration layering does NOT silently
/// inherit Dev-only localhost defaults or committed dev credentials. Closes the E11-S1
/// deferred-work entry "appsettings.json base cleanup" — before E11-S2 the base file
/// duplicated <c>localhost</c> hosts and the literal <c>rustfsadmin</c> credentials
/// alongside <c>appsettings.Development.json</c>; this test prevents regression.
/// </summary>
public sealed class AppSettingsLayeringTests
{
    /// <summary>
    /// Walk up from the test bin to the repo root and resolve the api source directory
    /// so we can load the COMMITTED <c>appsettings*.json</c> files directly (not the
    /// build-output copies, which may be stale).
    /// </summary>
    private static string ApiSourceDirectory()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "src", "IabConnect.Api", "appsettings.json")))
        {
            dir = dir.Parent;
        }
        if (dir is null)
        {
            throw new InvalidOperationException(
                "Could not locate backend/src/IabConnect.Api by walking up from AppContext.BaseDirectory.");
        }
        return Path.Combine(dir.FullName, "src", "IabConnect.Api");
    }

    private static IConfiguration BuildBetaLayeredConfiguration()
    {
        var apiDir = ApiSourceDirectory();
        return new ConfigurationBuilder()
            .SetBasePath(apiDir)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Beta.json", optional: false)
            .Build();
    }

    private static IConfiguration BuildBaseOnlyConfiguration()
    {
        var apiDir = ApiSourceDirectory();
        return new ConfigurationBuilder()
            .SetBasePath(apiDir)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();
    }

    // ConnectionStrings:DefaultConnection is INTENTIONALLY excluded from the cleanup theory:
    // Hangfire.UsePostgreSqlStorage eagerly opens the connection at DI registration time,
    // BEFORE TestWebApplicationFactory's InMemoryCollection can override the empty base.
    // Crashes ~57 existing API tests. Deferred until init is made lazy.
    //
    // DocumentStorage:* was previously deferred for the same reason — Infrastructure/
    // DependencyInjection.cs:259 calls .Get<DocumentStorageSettings>() at DI registration
    // time and bakes the value into a Singleton IAmazonS3 factory closure, and
    // AmazonS3Client throws on empty AccessKey/SecretKey at first IDocumentStorage
    // resolution. E12-S1 AC-7 resolves this by stripping the rustfsadmin literals from
    // both appsettings.json AND DocumentStorageSettings.cs class initializers, and the
    // test-infrastructure half of the fix lives in TestWebApplicationFactory.cs (provides
    // DocumentStorage:* via InMemoryCollection so DI resolution succeeds in tests).
    [Theory]
    [InlineData("Keycloak:Authority")]
    [InlineData("Smtp:Host")]
    [InlineData("DocumentStorage:ServiceUrl")]
    [InlineData("DocumentStorage:AccessKey")]
    [InlineData("DocumentStorage:SecretKey")]
    public void BaseConfig_DevDefaultsAreEmptied(string key)
    {
        // E11-S2 AC-2 + E12-S1 AC-7: base appsettings.json must NOT carry localhost hosts
        // or dev credentials. ConnectionStrings is exempted (see class comment above).
        var config = BuildBaseOnlyConfiguration();
        config[key].Should().BeNullOrEmpty(
            $"base appsettings.json must not contain a Dev default for '{key}' — the value belongs in appsettings.Development.json");
    }

    [Theory]
    [InlineData("Keycloak:Authority")]
    [InlineData("Smtp:Host")]
    [InlineData("DocumentStorage:ServiceUrl")]
    [InlineData("DocumentStorage:AccessKey")]
    [InlineData("DocumentStorage:SecretKey")]
    public void BetaLayered_DoesNotInheritDevDefaults(string key)
    {
        // E11-S2 AC-2 + E12-S1 AC-7: when ASPNETCORE_ENVIRONMENT=Beta, the active config
        // is appsettings.json + appsettings.Beta.json (NOT Development). No Dev hostname
        // or RustFS credential must surface in that layered view.
        var config = BuildBetaLayeredConfiguration();
        config[key].Should().BeNullOrEmpty(
            $"Beta-layered configuration must not inherit '{key}' from base — supply it via the deployment environment");
    }

    [Fact]
    public void BetaLayered_LoggingLogLevelDefaultIsInformation()
    {
        // E11-S2 AC-1: Beta overrides Logging.LogLevel.Default to Information (epic spec).
        var config = BuildBetaLayeredConfiguration();
        config["Logging:LogLevel:Default"].Should().Be("Information");
    }

    [Fact]
    public void BetaLayered_RetentionEnforcementIsDisabled()
    {
        // E11-S2 AC-1 / ADR-020: Beta must set RetentionEnforcement:Enabled = false.
        var config = BuildBetaLayeredConfiguration();
        config.GetValue<bool>("RetentionEnforcement:Enabled").Should().BeFalse();
    }

    [Fact]
    public void BetaLayered_SerilogWriteToIsConsoleOnly()
    {
        // E11-S2 AC-3: closes the E11-S1 Beta Serilog array-merge defer. After moving
        // the File sink to appsettings.Development.json, the Beta layer (base + Beta)
        // exposes exactly ONE sink — Console.
        var config = BuildBetaLayeredConfiguration();
        var writeToSection = config.GetSection("Serilog:WriteTo");
        var sinkNames = writeToSection
            .GetChildren()
            .Select(c => c["Name"])
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList();
        sinkNames.Should().ContainSingle().Which.Should().Be("Console");
    }

    [Fact]
    public void DevelopmentOverlay_ReintroducesFileSink()
    {
        // E11-S2 AC-3 inverse: the moved File sink must still apply in Development so
        // dev workflow continues unchanged (logs/iabconnect-<date>.log).
        var apiDir = ApiSourceDirectory();
        var config = new ConfigurationBuilder()
            .SetBasePath(apiDir)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: false)
            .Build();
        var writeToSection = config.GetSection("Serilog:WriteTo");
        var sinkNames = writeToSection
            .GetChildren()
            .Select(c => c["Name"])
            .Where(name => !string.IsNullOrEmpty(name))
            .ToList();
        sinkNames.Should().Contain("Console").And.Contain("File");
    }
}
