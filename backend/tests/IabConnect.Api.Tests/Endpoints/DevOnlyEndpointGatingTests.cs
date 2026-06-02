// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Net;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-088 AC-4 (E14-S3): asserts the developer-tooling endpoints (Hangfire dashboard +
/// Swagger UI) are NOT mapped when the host runs under <c>EnvironmentName != "Development"</c>.
/// Both endpoints are gated by <c>app.Environment.IsDevelopment()</c> in
/// <see cref="IabConnect.Api.DependencyInjection.UseApiPipeline"/> at lines 291-300 (Swagger)
/// and 317-320 (Hangfire). Testing env returns false for IsDevelopment() so the same gate
/// that protects Beta + Production also protects the test environment — exercising 404 in
/// Testing transitively proves the Beta + Production behaviour.
///
/// Per project-context A31, the two gates form a single "no developer-tooling surface in
/// non-Dev" invariant. A regression in one would likely affect both; testing both together
/// catches the broader class of mistakes.
///
/// AC-4 (Dev-positive test asserting both endpoints serve 200 in Development) is
/// intentionally not implemented per E14-S3 DEC-1=B: the load-bearing risk is "non-Dev
/// exposes the dashboard"; that risk is covered by the two 404 assertions below. The
/// positive case is implementation-detail and trusted to the framework + the developer's
/// observation of the local dev experience.
/// </summary>
[Collection("Api")]
public sealed class DevOnlyEndpointGatingTests
{
    private readonly TestWebApplicationFactory _factory;

    public DevOnlyEndpointGatingTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task HangfireDashboard_404InNonDevEnvironment()
    {
        // DependencyInjection.cs:317-320 — app.UseHangfireDashboard("/hangfire") is inside
        // an `if (app.Environment.IsDevelopment())` block. Testing env has IsDevelopment()=false
        // so the dashboard middleware is never mapped; default endpoint-not-found → 404.
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/hangfire", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task HangfireDashboardTrailingSlash_404InNonDevEnvironment()
    {
        // Trailing-slash variant: ASP.NET Core's default endpoint routing doesn't strip
        // trailing slashes; both /hangfire AND /hangfire/ must 404 independently.
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/hangfire/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SwaggerUi_404InNonDevEnvironment()
    {
        // DependencyInjection.cs:291-300 — Swagger middleware is mounted only when
        // IsDevelopment() is true. Testing env IsDevelopment()=false → 404.
        // A31 invariant: this gate is in lock-step with the Hangfire gate above; both
        // must regress together if a future refactor breaks the IsDevelopment() check.
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/swagger", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SwaggerJson_404InNonDevEnvironment()
    {
        // The OpenAPI JSON descriptor — same gate.
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/swagger/v1/swagger.json", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
