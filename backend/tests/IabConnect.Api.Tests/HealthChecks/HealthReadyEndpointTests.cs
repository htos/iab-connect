// SPDX-License-Identifier: AGPL-3.0-or-later
using System;
using System.IO;
using System.Text.RegularExpressions;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.HealthChecks;

/// <summary>
/// REQ-088 AC-5 (E17-S4 / ADR-017): asserts the <c>/health/ready</c> endpoint contract
/// that external uptime monitors (UptimeRobot, BetterStack, Uptime Kuma) depend on:
/// (1) it is mapped at the canonical path <c>/health/ready</c>;
/// (2) it is rate-limit-exempt via <c>.DisableRateLimiting()</c> (so a 5-minute polling
///     cadence never trips the anonymous 100/min/IP limiter even when sharing an egress
///     IP with a noisy neighbour);
/// (3) it is unauthenticated (no <c>.RequireAuthorization</c> chain — an external monitor
///     cannot present a Keycloak JWT);
/// (4) its response writer propagates <c>HealthReport.Status</c> so a dependency outage
///     produces a 503 the monitor sees as failure.
///
/// Plus the A31 doc-vs-code invariant assertion that docs/14 Section 27 (E17-S4) uses
/// the same literal path string + rate-limit-exempt claim + unauthenticated claim as the
/// runtime code.
///
/// Direct-artifact-read per A51 / A49 — no WebApplicationFactory instantiation.
/// </summary>
public sealed class HealthReadyEndpointTests
{
    private static string ResolveApiProjectDir()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(HealthReadyEndpointTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api"));
    }

    private static string ResolveDependencyInjectionCsPath() =>
        Path.Combine(ResolveApiProjectDir(), "DependencyInjection.cs");

    private static string ResolveDocs14Path()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(HealthReadyEndpointTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "..", "docs", "14_beta_railway_setup.md"));
    }

    [Fact]
    public void HealthReady_IsRegistered_AndIsRateLimitExempt_AC1_AC2()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());

        // Locate the MapHealthChecks("/health/ready", ...) registration; assert the chain
        // contains both Predicate filter for "ready" tag AND .DisableRateLimiting().
        var pattern = new Regex(
            @"app\.MapHealthChecks\(\s*""/health/ready""\s*,[\s\S]*?Predicate\s*=\s*check\s*=>\s*check\.Tags\.Contains\(\s*""ready""\s*\)[\s\S]*?\}\s*\)\s*\.DisableRateLimiting\s*\(\s*\)",
            RegexOptions.Compiled);
        pattern.IsMatch(di).Should().BeTrue(
            "MapHealthChecks(\"/health/ready\") must filter to ready-tagged checks AND chain .DisableRateLimiting() so a 5-min polling monitor never trips the rate-limiter");
    }

    [Fact]
    public void HealthReady_HasNoAuthorizationRequirement_AC1()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());

        // Locate the /health/ready chain. Epic-17 boundary review E3 flagged the prior
        // IndexOf(");", ...) walker as fragile against routine refactors to the
        // response-writer lambda (a multi-statement lambda body would emit semicolons
        // mid-object-initializer, causing the chain extraction to miss .DisableRateLimiting
        // or a future .RequireAuthorization tail). Patched to walk the parenthesis balance
        // from the open paren of MapHealthChecks(...) until balance returns to zero, then
        // continue to the next statement-terminating ';' at the same outer scope.
        var healthReadyStart = di.IndexOf("app.MapHealthChecks(\"/health/ready\"", StringComparison.Ordinal);
        healthReadyStart.Should().BeGreaterThan(0,
            "MapHealthChecks(\"/health/ready\") registration must exist");

        // Find the opening paren after "MapHealthChecks"
        var openParenIdx = di.IndexOf('(', healthReadyStart);
        openParenIdx.Should().BeGreaterThan(healthReadyStart);

        // Walk paren balance to find the matching close paren of MapHealthChecks(...).
        int balance = 1;
        int idx = openParenIdx + 1;
        while (idx < di.Length && balance > 0)
        {
            if (di[idx] == '(') balance++;
            else if (di[idx] == ')') balance--;
            idx++;
        }
        balance.Should().Be(0, "MapHealthChecks(...) parens must balance");

        // idx now sits just after the matching ')'. The chain may now have any number of
        // .Method() calls; walk to the next top-level ';' to capture the entire chain.
        var statementEnd = di.IndexOf(';', idx);
        statementEnd.Should().BeGreaterThan(healthReadyStart);

        var chain = di.Substring(healthReadyStart, statementEnd - healthReadyStart);
        chain.Should().NotContain("RequireAuthorization",
            "/health/ready must remain unauthenticated — external monitors cannot present a Keycloak JWT");
        // Anti-regression: the chain must contain .DisableRateLimiting() (overlaps with AC-2
        // but ensures the brace-walking extraction actually reaches the rate-limit-exemption
        // call, defending against a future regression that drops .DisableRateLimiting()).
        chain.Should().Contain(".DisableRateLimiting()",
            "/health/ready chain must include .DisableRateLimiting() so the polling monitor is exempt from the limiter");
    }

    [Fact]
    public void HealthReady_ResponseWriter_PropagatesHealthReportStatus_AC3()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());

        // Locate WriteHealthCheckResponse (REQ-054 ResponseWriter for /health/ready).
        var writerStart = di.IndexOf("private static async Task WriteHealthCheckResponse", StringComparison.Ordinal);
        writerStart.Should().BeGreaterThan(0, "WriteHealthCheckResponse helper must exist for the /health/ready ResponseWriter");

        // Find the body — closing brace of the method. Track brace balance.
        var openBrace = di.IndexOf('{', writerStart);
        var balance = 1;
        var idx = openBrace + 1;
        while (idx < di.Length && balance > 0)
        {
            if (di[idx] == '{') balance++;
            else if (di[idx] == '}') balance--;
            idx++;
        }
        var body = di.Substring(openBrace, idx - openBrace);

        body.Should().Contain("application/json",
            "WriteHealthCheckResponse must set Content-Type to application/json so monitor parsers see a JSON response");
        body.Should().Contain("report.Status",
            "WriteHealthCheckResponse must serialize report.Status so external monitors see Healthy vs Unhealthy as the JSON payload signal (HTTP status itself remains 200 vs 503 per the framework)");
    }

    [Fact]
    public void HealthReady_PathReferencesParity_AC10()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());
        var docs = File.ReadAllText(ResolveDocs14Path());

        // Code references: count canonical literal path occurrences in DI.cs
        var codeMatches = Regex.Matches(di, @"""/health/ready""").Count;
        codeMatches.Should().BeGreaterThanOrEqualTo(1,
            "code must reference the canonical '/health/ready' path string (DependencyInjection.cs)");

        // Docs: Section 27 must be published with the canonical heading
        docs.Should().Contain("## 27. External uptime monitoring (E17-S4)",
            "docs/14 Section 27 (E17-S4) must be published with the canonical heading");

        // A31 doc-vs-code parity: Sections 9 (E13-S4), 23 (E14-S4), 27 (E17-S4) all reference '/health/ready'.
        // For each section, locate the heading then assert the literal path string appears between
        // it and the next '## ' heading.
        AssertSectionReferencesPath(docs, "## 9. Health probes", "/health/ready");
        AssertSectionReferencesPath(docs, "## 23. Rate-limiting baseline", "/health/ready");
        AssertSectionReferencesPath(docs, "## 27. External uptime monitoring", "/health/ready");
    }

    [Fact]
    public void Docs14Section27_DocumentsRateLimitExemption_AndUnauthenticated_AC10b()
    {
        var docs = File.ReadAllText(ResolveDocs14Path());

        var section27 = ExtractSection(docs, "## 27. External uptime monitoring");
        section27.Should().NotBeNullOrEmpty("docs/14 Section 27 must be published by Task 2 of this story");

        // Documented rate-limit-exemption claim
        var lower = section27!.ToLowerInvariant();
        (lower.Contains("disable") || lower.Contains("exempt") || lower.Contains("exemption"))
            .Should().BeTrue("Section 27 must document the rate-limit-exemption contract for /health/ready");

        // Documented unauthenticated claim
        (lower.Contains("unauthenticated") || lower.Contains("no auth") || lower.Contains("no authorization"))
            .Should().BeTrue("Section 27 must document that /health/ready is unauthenticated");
    }

    // --- helpers ---

    private static void AssertSectionReferencesPath(string docs, string sectionHeading, string canonicalPath)
    {
        var sectionBody = ExtractSection(docs, sectionHeading);
        sectionBody.Should().NotBeNullOrEmpty($"section '{sectionHeading}' must exist in docs/14");
        sectionBody.Should().Contain(canonicalPath,
            $"section '{sectionHeading}' must reference the canonical path string '{canonicalPath}' (A31 doc-vs-code parity)");
    }

    private static string? ExtractSection(string docs, string sectionHeading)
    {
        var start = docs.IndexOf(sectionHeading, StringComparison.Ordinal);
        if (start < 0) return null;
        var next = docs.IndexOf("\n## ", start + 1, StringComparison.Ordinal);
        if (next < 0) next = docs.Length;
        return docs.Substring(start, next - start);
    }
}
