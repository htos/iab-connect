// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-089 AC-5 (E20-S3): API-tier tests for the AGPL §13 source-disclosure endpoint
/// at the application root. Asserts: route mapping, response shape, hard-coded
/// upstream identifier + license string, env-var fallback to <c>"unknown"</c>,
/// <c>Branding:SourceUrl</c> binding, and anonymous access.
///
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection.
/// </summary>
[Collection("Api")]
public sealed class AboutEndpointTests
{
    private readonly HttpClient _client;

    public AboutEndpointTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task About_ReturnsOk()
    {
        var response = await _client.GetAsync("/about", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");
    }

    [Fact]
    public async Task About_ReturnsExpectedShape()
    {
        var response = await _client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        // AC-2: camelCase JSON keys, all six fields present and string-typed.
        foreach (var name in new[] { "name", "license", "version", "commitSha", "buildDate", "sourceUrl" })
        {
            root.TryGetProperty(name, out var element).Should().BeTrue(
                $"the /about response must expose the camelCase key '{name}'");
            element.ValueKind.Should().Be(JsonValueKind.String,
                $"the '{name}' field must be a string (got {element.ValueKind})");
        }
    }

    [Fact]
    public async Task About_LicenseIsAGPL3OrLater()
    {
        var about = await GetAboutAsync();

        // AC-2 / AC-11 orthogonal-AC parity: byte-identical to E20-S1 LICENSE/COPYRIGHT
        // and to backend/Dockerfile:46 OCI label `org.opencontainers.image.licenses`.
        about.License.Should().Be("AGPL-3.0-or-later");
    }

    [Fact]
    public async Task About_NameIsIabConnect()
    {
        var about = await GetAboutAsync();

        // AC-2: hard-coded upstream identifier — NOT influenced by SystemSettings.ApplicationName
        // (admin-editable per REQ-086) or by any Branding:* override.
        about.Name.Should().Be("IAB Connect");
    }

    [Fact]
    public async Task About_UnknownWhenEnvVarsMissing()
    {
        // In the test process, no BUILD_SHA / BUILD_DATE env vars are injected by the
        // TestWebApplicationFactory's configuration. The endpoint must degrade to the
        // literal string "unknown" (NOT empty, NOT null) per AC-2.
        var about = await GetAboutAsync();

        about.CommitSha.Should().Be("unknown");
        about.BuildDate.Should().Be("unknown");
    }

    [Fact]
    public async Task About_SourceUrlReadsBrandingConfig()
    {
        // AC-2 / AC-6: sourceUrl flows from Branding:SourceUrl in appsettings.json.
        // The test factory loads the base appsettings, which carries the default
        // `https://github.com/htos/iab-connect`. Override-paths are covered by
        // AboutResponseBuilderTests at the unit level.
        var about = await GetAboutAsync();

        about.SourceUrl.Should().Be("https://github.com/htos/iab-connect");
    }

    [Fact]
    public async Task About_IsAnonymous()
    {
        // AC-3: no Authorization header on the request — endpoint must return 200,
        // NOT 401, NOT redirect to OIDC. Source disclosure must be reachable without
        // credentials.
        using var request = new HttpRequestMessage(HttpMethod.Get, "/about");
        // Explicitly do not set request.Headers.Authorization.

        var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<AboutEndpoints.AboutResponse> GetAboutAsync()
    {
        var response = await _client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var about = await response.Content.ReadFromJsonAsync<AboutEndpoints.AboutResponse>(
            JsonSerializerOptions.Web,
            TestContext.Current.CancellationToken);
        about.Should().NotBeNull("the /about response body must deserialize into AboutResponse");
        return about!;
    }
}
