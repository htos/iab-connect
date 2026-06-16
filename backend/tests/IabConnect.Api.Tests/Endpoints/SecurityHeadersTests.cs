// SPDX-License-Identifier: AGPL-3.0-or-later
using System.IO;
using System.Net.Http;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-088 AC-4 (E14-S2): asserts the four unconditional backend security headers are
/// emitted on every response, plus code-audit assertions that HSTS + HTTPS-redirect are
/// gated to non-Dev/non-Testing environments, plus an A31 byte-equality assertion that
/// the three mirror-able headers (X-Frame-Options, X-Content-Type-Options,
/// Referrer-Policy) carry the same directive values on both backend and frontend.
///
/// HSTS + HTTPS-redirect cannot be runtime-tested via TestWebApplicationFactory because
/// instantiating a second WebApplicationFactory&lt;Program&gt; in the same process re-runs
/// Program.Main, which calls Serilog.AddSerilog a second time and trips "The logger is
/// already frozen" — same constraint that drove
/// <see cref="BetaEnvironmentHardeningTests"/> to use code-audit instead. The pattern is
/// reused here.
/// </summary>
[Collection("Api")]
public sealed class SecurityHeadersTests
{
    private readonly TestWebApplicationFactory _factory;

    public SecurityHeadersTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string ResolveBackendDiPath()
    {
        // backend/tests/IabConnect.Api.Tests/bin/Debug/net10.0/ → backend/src/IabConnect.Api/DependencyInjection.cs
        var assemblyDir = Path.GetDirectoryName(typeof(SecurityHeadersTests).Assembly.Location)!;
        var di = Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "DependencyInjection.cs"));
        return di;
    }

    private static string ResolveFrontendNextConfigPath()
    {
        // backend/tests/IabConnect.Api.Tests/bin/Debug/net10.0/ → frontend/next.config.ts
        var assemblyDir = Path.GetDirectoryName(typeof(SecurityHeadersTests).Assembly.Location)!;
        var path = Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "..", "frontend", "next.config.ts"));
        return path;
    }

    [Fact]
    public async Task XContentTypeOptions_NosniffOnEveryResponse()
    {
        // The header middleware at DependencyInjection.cs:269-277 runs unconditionally
        // (no env gate) so the Testing environment emits the headers too.
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.Headers.TryGetValues("X-Content-Type-Options", out var values).Should().BeTrue();
        values!.Should().ContainSingle().Which.Should().Be("nosniff");
    }

    [Fact]
    public async Task XFrameOptions_DenyOnEveryResponse()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.Headers.TryGetValues("X-Frame-Options", out var values).Should().BeTrue();
        values!.Should().ContainSingle().Which.Should().Be("DENY");
    }

    [Fact]
    public async Task ReferrerPolicy_StrictOriginWhenCrossOriginOnEveryResponse()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.Headers.TryGetValues("Referrer-Policy", out var values).Should().BeTrue();
        values!.Should().ContainSingle().Which.Should().Be("strict-origin-when-cross-origin");
    }

    [Fact]
    public async Task XPermittedCrossDomainPolicies_NoneOnEveryResponse()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/about", TestContext.Current.CancellationToken);
        response.Headers.TryGetValues("X-Permitted-Cross-Domain-Policies", out var values).Should().BeTrue();
        values!.Should().ContainSingle().Which.Should().Be("none");
    }

    [Fact]
    public void Hsts_GatedToNonDevNonTesting_CodeAudit()
    {
        // Code-audit: confirms the HSTS middleware activation gate exists with the
        // expected condition. Runtime exercise is blocked by the WebApplicationFactory
        // Serilog single-instance constraint; see BetaEnvironmentHardeningTests for the
        // same precedent applied to other Beta-pipeline assertions.
        var diSource = File.ReadAllText(ResolveBackendDiPath());
        diSource.Should().MatchRegex(
            @"if\s*\(\s*!app\.Environment\.IsDevelopment\(\)\s*&&\s*app\.Environment\.EnvironmentName\s*!=\s*""Testing""\s*\)\s*\{\s*app\.UseHsts\(\)\s*;\s*\}",
            "HSTS must be gated `!IsDevelopment() && != Testing` so Beta + Production get HSTS but Dev + Testing skip it");
    }

    [Fact]
    public void HttpsRedirection_GatedToNonDevNonTesting_CodeAudit()
    {
        // Code-audit: same gate as HSTS, applied to UseHttpsRedirection.
        var diSource = File.ReadAllText(ResolveBackendDiPath());
        diSource.Should().MatchRegex(
            @"if\s*\(\s*!app\.Environment\.IsDevelopment\(\)\s*&&\s*app\.Environment\.EnvironmentName\s*!=\s*""Testing""\s*\)\s*\{\s*app\.UseHttpsRedirection\(\)\s*;\s*\}",
            "HTTPS redirection must be gated `!IsDevelopment() && != Testing` so Beta + Production redirect HTTP → HTTPS");
    }

    [Fact]
    public void BackendFrontendHeaderParity_StaysAligned_A31Invariant()
    {
        // A31 cross-story orthogonal-AC invariant: the 3 mirror-able security headers
        // (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) must carry the same
        // directive value on backend and frontend. The fourth backend header
        // (X-Permitted-Cross-Domain-Policies) is intentionally backend-only (browsers
        // ignore for HTML responses; documented in docs/14_beta_railway_setup.md §21.3).
        var nextConfigSource = File.ReadAllText(ResolveFrontendNextConfigPath());

        nextConfigSource.Should().Contain("\"X-Frame-Options\"")
            .And.Contain("\"DENY\"",
            "frontend X-Frame-Options must match backend DENY value");

        nextConfigSource.Should().Contain("\"X-Content-Type-Options\"")
            .And.Contain("\"nosniff\"",
            "frontend X-Content-Type-Options must match backend nosniff value");

        nextConfigSource.Should().Contain("\"Referrer-Policy\"")
            .And.Contain("\"strict-origin-when-cross-origin\"",
            "frontend Referrer-Policy must match backend strict-origin-when-cross-origin value");
    }
}
