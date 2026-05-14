using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-086 (E9-S1) AC-4/AC-5/AC-6: runtime API-tier tests for the extended settings
/// surface. Asserts the authorization posture (public read vs admin write + logo upload)
/// and the AC-5 privacy contract — the anonymous <c>/public</c> endpoint exposes the
/// non-sensitive branding subset and never the organization's contact details.
///
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection; the
/// in-memory DB is empty so <c>GetSettingsAsync</c> lazily materializes the default row.
/// </summary>
[Collection("Api")]
public sealed class SettingsEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public SettingsEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetPublicSettings_Anonymous_Returns200()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/settings/public", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetPublicSettings_ExposesBrandingSubset_AndOmitsContactFields()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/settings/public", TestContext.Current.CancellationToken);
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // AC-5: non-sensitive branding subset IS present.
        root.TryGetProperty("description", out _).Should().BeTrue();
        root.TryGetProperty("primaryColor", out _).Should().BeTrue();
        root.TryGetProperty("publicSiteEnabled", out _).Should().BeTrue();
        root.TryGetProperty("logoUrl", out _).Should().BeTrue();

        // AC-5: contact details are admin-only — never exposed anonymously.
        root.TryGetProperty("contactEmail", out _).Should().BeFalse();
        root.TryGetProperty("contactPhone", out _).Should().BeFalse();
        root.TryGetProperty("contactAddress", out _).Should().BeFalse();
    }

    [Fact]
    public async Task GetSettings_Anonymous_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/settings/", TestContext.Current.CancellationToken);

        // AC-4: full settings read is admin-only.
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UpdateSettings_Anonymous_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PutAsJsonAsync(
            "/api/v1/settings/",
            new
            {
                applicationName = "X",
                logoText = "X",
                logoBackgroundColor = "#000000",
                logoTextColor = "#FFFFFF",
            },
            TestContext.Current.CancellationToken);

        // AC-4: writes stay under RequireRole("admin").
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UploadLogo_Anonymous_Returns401()
    {
        var client = _factory.CreateClient();

        using var content = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent([1, 2, 3]);
        fileContent.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
        content.Add(fileContent, "file", "logo.png");

        var response = await client.PostAsync(
            "/api/v1/settings/logo", content, TestContext.Current.CancellationToken);

        // AC-6: logo upload stays under RequireRole("admin").
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetLogo_NoLogoConfigured_Returns404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/settings/logo", TestContext.Current.CancellationToken);

        // AC-6: the public passthrough 404s when no logo asset key is set.
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
