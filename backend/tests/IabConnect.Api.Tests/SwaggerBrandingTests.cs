using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Swashbuckle.AspNetCore.SwaggerGen;
using Xunit;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-086 (E9-S3) AC-2/AC-4: the Swagger document title/description are config-driven
/// (<c>Branding:ApiTitle</c> / <c>Branding:ApiDescription</c>) with literal defaults that
/// exactly preserve the previous values. The shared test host carries no <c>Branding</c>
/// section, so this asserts the behaviour-preserving fallback path.
/// </summary>
[Collection("Api")]
public sealed class SwaggerBrandingTests
{
    private readonly TestWebApplicationFactory _factory;

    public SwaggerBrandingTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public void SwaggerDoc_FallsBackToTheLiteralBrandingDefaults()
    {
        var options = _factory.Services
            .GetRequiredService<IOptions<SwaggerGenOptions>>().Value;

        var v1 = options.SwaggerGeneratorOptions.SwaggerDocs["v1"];

        v1.Title.Should().Be("IAB Connect API");
        v1.Description.Should().Be(
            "API für die Webanwendung des Indischen Kulturvereins Bern");
    }
}
