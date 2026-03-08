using FluentAssertions;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Net;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// Custom WebApplicationFactory that replaces external dependencies
/// (PostgreSQL, Hangfire, S3, etc.) so tests can run without Docker.
/// </summary>
public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
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
                options.UseInMemoryDatabase("HealthTestDb");
            });
        });
    }
}

/// <summary>
/// Integration tests for health endpoint
/// </summary>
public class HealthEndpointTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthEndpoint_ReturnsHealthy()
    {
        // Act
        var response = await _client.GetAsync("/health", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthReady_ReturnsJsonWithStatus()
    {
        // Act
        var response = await _client.GetAsync("/health/ready", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        content.Should().Contain("status");
    }

    [Fact]
    public async Task HealthDetail_RequiresAuthentication()
    {
        // Act — no bearer token provided
        var response = await _client.GetAsync("/health/detail", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CorrelationId_IsReturnedInResponseHeaders()
    {
        // Act
        var response = await _client.GetAsync("/health", TestContext.Current.CancellationToken);

        // Assert
        response.Headers.Contains("X-Correlation-Id").Should().BeTrue();
        var correlationId = response.Headers.GetValues("X-Correlation-Id").First();
        correlationId.Should().NotBeNullOrEmpty();
    }
}
