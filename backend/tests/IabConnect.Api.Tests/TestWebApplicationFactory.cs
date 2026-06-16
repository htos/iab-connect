using IabConnect.Application.Common;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace IabConnect.Api.Tests;

/// <summary>
/// Shared WebApplicationFactory for all API integration tests.
///
/// One instance per test run (via <see cref="ApiTestCollection"/>) — instantiating a second
/// <c>WebApplicationFactory&lt;Program&gt;</c> in the same process re-runs <c>Program.Main</c>,
/// which calls <c>Serilog.AddSerilog</c> a second time and trips "The logger is already
/// frozen" on the static <see cref="Serilog.Log.Logger"/> set up by the first factory.
///
/// Replaces external dependencies (PostgreSQL, Hangfire) with in-memory equivalents so tests
/// can run without Docker. Database name is shared across all consumers — tests that need
/// data-isolation should use their own scoped DbContext, not the application's.
/// </summary>
public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    static TestWebApplicationFactory()
    {
        // REQ-088 (E12-S1 AC-7): base appsettings.json no longer carries dev RustFS
        // credentials. The IAmazonS3 singleton factory at Infrastructure
        // DependencyInjection.cs:259-270 reads storageSettings EAGERLY at DI registration
        // time (Program.cs:32, before builder.Build() applies WebApplicationFactory's
        // ConfigureAppConfiguration callbacks). The factory's closure then crashes
        // AmazonS3Client construction when AccessKey/SecretKey are empty — failing the
        // GetLogo endpoint test at parameter-binding time. Environment variables are part
        // of the default configuration chain set up by WebApplication.CreateBuilder
        // BEFORE that eager read, so they reliably propagate. Tests never touch real S3.
        Environment.SetEnvironmentVariable("DocumentStorage__ServiceUrl", "http://localhost:9000");
        Environment.SetEnvironmentVariable("DocumentStorage__AccessKey", "test-access-key");
        Environment.SetEnvironmentVariable("DocumentStorage__SecretKey", "test-secret-key");
        Environment.SetEnvironmentVariable("DocumentStorage__BucketName", "iabconnect-documents");
        Environment.SetEnvironmentVariable("DocumentStorage__UseHttps", "false");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        // Provide dummy configuration so AddInfrastructureServices doesn't throw
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["Keycloak:Authority"] = "http://localhost:8080/realms/test",
                ["Keycloak:ClientId"] = "test-client",
                // REQ-025 (E3.S5): calendar-feed handlers call ResolveBaseUrl which throws when
                // App:PublicBaseUrl is unset — provide a value so feed endpoints return 200/404
                // rather than a 500 in runtime endpoint tests.
                ["App:PublicBaseUrl"] = "https://test.iab-connect.example",
                // REQ-089 AC-5 (E20-S3) + E20-boundary review P4: AboutEndpoint reads BUILD_SHA
                // and BUILD_DATE from IConfiguration, which by default includes the host env
                // vars. CI runners (or any shell that exported BUILD_SHA) would leak the host
                // value into the test, flaking About_UnknownWhenEnvVarsMissing. InMemory
                // sources added in ConfigureAppConfiguration have higher precedence than the
                // env-var provider, so binding empty strings forces the projection helper's
                // `IsNullOrWhiteSpace(...)` guard to return "unknown" deterministically.
                ["BUILD_SHA"] = string.Empty,
                ["BUILD_DATE"] = string.Empty,
                // REQ-058 (E8-S2): a low external-API per-credential limit so the over-limit (429)
                // test is deterministic. Partitioned on the ApiClient id, so only a test that bursts
                // >5 requests with one credential trips it; single-call external tests are unaffected.
                ["RateLimiting:ExternalApiPermitLimit"] = "5",
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove ALL EF Core / Npgsql registrations to avoid dual-provider conflict
            var efDescriptors = services
                .Where(d => d.ServiceType.FullName?.Contains("EntityFrameworkCore") == true
                          || d.ServiceType.FullName?.Contains("Npgsql") == true
                          || d.ImplementationType?.FullName?.Contains("Npgsql") == true
                          || d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>)
                          || d.ServiceType == typeof(DbContextOptions))
                .ToList();
            foreach (var d in efDescriptors) services.Remove(d);

            // Remove Hangfire hosted services (they try to connect to PostgreSQL)
            var hostedServiceDescriptors = services
                .Where(d => d.ServiceType == typeof(IHostedService)
                         && d.ImplementationType?.FullName?.Contains("Hangfire") == true)
                .ToList();
            foreach (var d in hostedServiceDescriptors) services.Remove(d);

            // Add an in-memory database instead
            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseInMemoryDatabase("ApiTestDb");
            });

            // REQ-087 (E10-S3): header-driven test auth scheme so integration tests can issue
            // *authenticated* requests (the real Keycloak JWT bearer needs a live IdP). This
            // becomes the default scheme; a request without the test header still resolves to
            // anonymous, so existing "no header → 401" tests are unaffected.
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName, _ => { });

            // REQ-087 (E10-S3): mutable module-settings double (defaults all-enabled) so module
            // enforcement can be exercised without mutating the shared in-memory DB / cache.
            services.RemoveAll<IModuleSettingsService>();
            services.AddSingleton<TestModuleSettingsService>();
            services.AddSingleton<IModuleSettingsService>(
                sp => sp.GetRequiredService<TestModuleSettingsService>());

            // REQ-058 (E8-S3): recording webhook-dispatch double so trigger tests can assert the
            // write path emitted the expected event + payload, without performing delivery.
            services.RemoveAll<IabConnect.Application.Integration.IWebhookDispatchService>();
            services.AddSingleton<TestWebhookDispatchService>();
            services.AddSingleton<IabConnect.Application.Integration.IWebhookDispatchService>(
                sp => sp.GetRequiredService<TestWebhookDispatchService>());
        });
    }
}
