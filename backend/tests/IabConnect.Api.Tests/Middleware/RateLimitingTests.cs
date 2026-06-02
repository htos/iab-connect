// SPDX-License-Identifier: AGPL-3.0-or-later
using System.IO;
using System.Net;
using FluentAssertions;
using IabConnect.Api.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Api.Tests.Middleware;

/// <summary>
/// REQ-088 AC-4 (E14-S4): rate-limiter baseline regression tests. Mix of DI introspection
/// (options binding + named policy registration), runtime exercise (healthcheck exemption),
/// and code-audit (regex on DependencyInjection.cs to verify <c>.DisableRateLimiting()</c>
/// chains on health endpoints + middleware ordering + strict-policy attachment).
///
/// Per project-context E14-S4 DEC-2: deterministic time-based 429 transition test
/// (FakeTimeProvider injection) was NOT implemented in this story. The runtime exercise
/// of the limiter's actual 429 behaviour requires firing 100+ requests within the window
/// or mocking TimeProvider — both add LOC + flakiness without commensurate regression-
/// detection value. The shape-based tests below cover the load-bearing risks: misconfigured
/// options, missing policy, healthcheck-not-exempt, wrong middleware order.
/// </summary>
[Collection("Api")]
public sealed class RateLimitingTests
{
    private readonly TestWebApplicationFactory _factory;

    public RateLimitingTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string ResolveBackendDiPath()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(RateLimitingTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "DependencyInjection.cs"));
    }

    [Fact]
    public void RateLimitingOptions_BindsFromConfiguration_WithDocumentedDefaults()
    {
        // Confirms the appsettings.json "RateLimiting" section binds to RateLimitingOptions
        // with the documented SCP §5 defaults (100/600/10/60).
        using var scope = _factory.Services.CreateScope();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<RateLimitingOptions>>().Value;

        options.AnonymousPermitLimit.Should().Be(100, "SCP §5 baseline: anonymous 100 req/min/IP");
        options.AuthenticatedPermitLimit.Should().Be(600, "SCP §5 baseline: authenticated 600 req/min/user");
        options.StrictPermitLimit.Should().Be(10, "SCP §5 baseline: strict-identity 10 req/min");
        options.WindowSeconds.Should().Be(60, "SCP §5 baseline: 1-minute fixed window");
    }

    [Fact]
    public void StrictPolicyName_MatchesNamedPolicyConstant()
    {
        // Ensures the named-policy string is the same constant referenced by endpoint
        // chains (IdentityEndpoints + UserEndpoints). A typo in either would create a
        // dangling reference (the policy would silently never apply).
        RateLimitingOptions.StrictPolicyName.Should().Be("strict-identity");
    }

    [Fact]
    public async Task HealthcheckEndpoint_RemainsResponsive_AcrossManyRequests()
    {
        // Fires 150 sequential requests against /health (above the anonymous 100/min
        // threshold). Healthcheck endpoints chain .DisableRateLimiting() so the limiter
        // never trips — all 150 must return non-429 status. We accept any non-429 because
        // /health may return 503 if the InMemoryDatabase health-check transient state is
        // unhealthy; the load-bearing assertion is "never 429".
        var client = _factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        for (var i = 0; i < 150; i++)
        {
            var response = await client.GetAsync("/health", cancellationToken);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
                $"healthcheck endpoint must be rate-limit-exempt (iteration {i})");
        }
    }

    [Fact]
    public void HealthEndpoints_ChainDisableRateLimiting_CodeAudit()
    {
        // Code-audit: confirms each of the 3 health endpoints chains .DisableRateLimiting().
        // A future refactor that drops the chain would silently re-expose the endpoint to
        // the limiter and Railway's healthcheck probe would start tripping 429.
        var diSource = File.ReadAllText(ResolveBackendDiPath());

        diSource.Should().MatchRegex(
            @"app\.MapHealthChecks\(""/health""\)\.DisableRateLimiting\(\)",
            "/health must chain .DisableRateLimiting()");
        diSource.Should().MatchRegex(
            @"app\.MapHealthChecks\(""/health/ready""[\s\S]*?\)\.DisableRateLimiting\(\)",
            "/health/ready must chain .DisableRateLimiting()");
        diSource.Should().Contain(".RequireAuthorization(\"RequireAdmin\").DisableRateLimiting()",
            "/health/detail must chain .DisableRateLimiting()");
    }

    [Fact]
    public void UseRateLimiter_RegisteredAfterAuth_CodeAudit()
    {
        // Middleware ordering: UseRateLimiter() must appear AFTER UseAuthentication() +
        // UseAuthorization() so the global partition function can inspect httpContext.User.
        // The simplest static check: the order of substring appearances in the source.
        var diSource = File.ReadAllText(ResolveBackendDiPath());

        var authIndex = diSource.IndexOf("app.UseAuthorization()", StringComparison.Ordinal);
        var rateIndex = diSource.IndexOf("app.UseRateLimiter()", StringComparison.Ordinal);

        authIndex.Should().BeGreaterThan(0, "UseAuthorization() must be present");
        rateIndex.Should().BeGreaterThan(0, "UseRateLimiter() must be present");
        rateIndex.Should().BeGreaterThan(authIndex,
            "UseRateLimiter() must run AFTER UseAuthorization() so the partition function sees httpContext.User");
    }

    [Fact]
    public void StrictPolicyChained_OnAllThreeTargetEndpoints_CodeAudit()
    {
        // Code-audit: confirms .RequireRateLimiting(StrictPolicyName) is chained on the
        // three DEC-1=A target endpoints. A future refactor dropping any one chain would
        // silently un-rate-limit a brute-forceable identity-mutation endpoint with zero
        // test failure otherwise.
        var assemblyDir = Path.GetDirectoryName(typeof(RateLimitingTests).Assembly.Location)!;
        var identityEndpoints = File.ReadAllText(Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "Endpoints", "IdentityEndpoints.cs")));
        var userEndpoints = File.ReadAllText(Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "Endpoints", "UserEndpoints.cs")));

        identityEndpoints.Should().MatchRegex(
            @"MapDelete\(""/sessions/\{sessionId\}"",\s*RevokeCurrentUserSession\)[\s\S]*?\.RequireRateLimiting\(RateLimitingOptions\.StrictPolicyName\)",
            "the own-session DELETE endpoint must chain RequireRateLimiting with the strict policy");

        userEndpoints.Should().MatchRegex(
            @"MapDelete\(""/\{userId\}/sessions/\{sessionId\}"",\s*RevokeUserSession\)[\s\S]*?\.RequireRateLimiting\(RateLimitingOptions\.StrictPolicyName\)",
            "the admin DELETE session-revocation endpoint must chain RequireRateLimiting with the strict policy");

        userEndpoints.Should().MatchRegex(
            @"MapPost\(""/\{userId\}/reset-mfa"",\s*ResetUserMfa\)[\s\S]*?\.RequireRateLimiting\(RateLimitingOptions\.StrictPolicyName\)",
            "the POST admin reset-mfa endpoint must chain RequireRateLimiting with the strict policy");
    }

    [Fact]
    public void UseForwardedHeaders_RegisteredFirst_CodeAudit()
    {
        // Forwarded headers must run before the rate-limiter so RemoteIpAddress reflects
        // the real client IP (not Railway's edge proxy IP). Otherwise the anonymous bucket
        // becomes a single-tenant shared bucket across all clients.
        var diSource = File.ReadAllText(ResolveBackendDiPath());

        var forwardedIndex = diSource.IndexOf("app.UseForwardedHeaders()", StringComparison.Ordinal);
        var rateIndex = diSource.IndexOf("app.UseRateLimiter()", StringComparison.Ordinal);

        forwardedIndex.Should().BeGreaterThan(0, "UseForwardedHeaders() must be present");
        forwardedIndex.Should().BeLessThan(rateIndex,
            "UseForwardedHeaders() must run BEFORE UseRateLimiter() so partition keys reflect the real client IP");
    }
}
