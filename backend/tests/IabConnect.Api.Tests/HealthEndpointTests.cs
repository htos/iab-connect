using FluentAssertions;
using System.Net;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// Integration tests for health endpoint. Shares <see cref="TestWebApplicationFactory"/>
/// via the <c>Api</c> collection (see <see cref="ApiTestCollection"/>).
/// </summary>
[Collection("Api")]
public class HealthEndpointTests
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
