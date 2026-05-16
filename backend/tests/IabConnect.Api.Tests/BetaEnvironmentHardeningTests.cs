// SPDX-License-Identifier: AGPL-3.0-or-later
using FluentAssertions;
using IabConnect.Api;
using IabConnect.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-088 (E11-S2 / ADR-015): asserts that key Production-side hardenings activate when
/// the environment name is <c>Beta</c>. The full HTTP pipeline cannot be exercised by
/// <see cref="Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory{TEntryPoint}"/>
/// under <c>ASPNETCORE_ENVIRONMENT=Beta</c> because <c>Program.cs:88</c> calls
/// <c>db.Database.MigrateAsync()</c> on the production-side branch, which is a
/// relational-only method and throws on the in-memory EF provider used in tests. A
/// proper fix needs the <c>Database__AutoMigrate</c> flag wiring scheduled for E15-S2.
///
/// Until then, this test exercises the Production-side hardening via direct DI
/// introspection: build a service collection with <c>AddApiServices</c> + a fake
/// <see cref="IWebHostEnvironment"/> reporting <c>Beta</c>, and assert the JWT bearer
/// options came out hardened. The other AC-9 hardenings (Swagger off, Hangfire off,
/// HSTS, HTTPS redirect, strict CORS) are pipeline middleware — verified by code audit
/// (Task 5, recorded in Completion Notes) and manual smoke test (Task 11).
/// </summary>
public sealed class BetaEnvironmentHardeningTests
{
    private static ServiceProvider BuildServicesForEnvironment(string environmentName)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=hardening-test;Username=test;Password=test",
                ["Keycloak:Authority"] = "https://test.example/realms/test",
                ["Keycloak:ClientId"] = "test-client",
                ["Frontend:BaseUrl"] = "https://frontend.test.example",
            })
            .Build();

        var environment = new FakeWebHostEnvironment(environmentName);

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddSingleton<IWebHostEnvironment>(environment);
        services.AddApiServices(configuration, environment);
        return services.BuildServiceProvider();
    }

    [Fact]
    public void JwtBearer_RequiresHttpsMetadata_InBeta()
    {
        // DependencyInjection.cs:134 sets RequireHttpsMetadata = !(IsDev || Testing).
        // Beta → true (Production-side hardening: discovery doc must come over HTTPS).
        using var provider = BuildServicesForEnvironment("Beta");
        var monitor = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>();
        var options = monitor.Get(JwtBearerDefaults.AuthenticationScheme);
        options.RequireHttpsMetadata.Should().BeTrue(
            "Beta must require HTTPS for OIDC metadata — only Development/Testing relax it");
    }

    [Fact]
    public void JwtBearer_AllowsHttpMetadata_InDevelopment()
    {
        // Inverse-check: confirms the gate is real (not a hard-coded true). Development
        // must keep RequireHttpsMetadata = false so the local http://localhost:8080
        // Keycloak works without TLS.
        using var provider = BuildServicesForEnvironment("Development");
        var monitor = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>();
        var options = monitor.Get(JwtBearerDefaults.AuthenticationScheme);
        options.RequireHttpsMetadata.Should().BeFalse(
            "Development must allow HTTP metadata so local Keycloak (http://localhost:8080) works");
    }

    [Fact]
    public void JwtBearer_RequiresHttpsMetadata_InProduction()
    {
        // Sibling-check: confirms Production behaves identically to Beta.
        using var provider = BuildServicesForEnvironment("Production");
        var monitor = provider.GetRequiredService<IOptionsMonitor<JwtBearerOptions>>();
        var options = monitor.Get(JwtBearerDefaults.AuthenticationScheme);
        options.RequireHttpsMetadata.Should().BeTrue();
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public FakeWebHostEnvironment(string environmentName)
        {
            EnvironmentName = environmentName;
            ApplicationName = "IabConnect.Api";
            ContentRootPath = AppContext.BaseDirectory;
            ContentRootFileProvider = new NullFileProvider();
            WebRootPath = AppContext.BaseDirectory;
            WebRootFileProvider = new NullFileProvider();
        }

        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; }
        public string WebRootPath { get; set; }
        public IFileProvider WebRootFileProvider { get; set; }
        public string ContentRootPath { get; set; }
        public IFileProvider ContentRootFileProvider { get; set; }
    }
}
