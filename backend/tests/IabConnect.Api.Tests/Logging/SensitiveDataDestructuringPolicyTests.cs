// SPDX-License-Identifier: AGPL-3.0-or-later
using System.IO;
using System.Linq;
using FluentAssertions;
using IabConnect.Api.Logging;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.TestCorrelator;
using Xunit;

namespace IabConnect.Api.Tests.Logging;

/// <summary>
/// REQ-088 AC-4 (E14-S5): asserts the Serilog destructuring policy redacts sensitive
/// property values, and the bearer-presence enricher emits the expected property without
/// exposing the raw token contents. Plus an A31 parity test confirming the destructure
/// field-name list mirrors the E14-S1 audit script's allowlist.
/// </summary>
public sealed class SensitiveDataDestructuringPolicyTests
{
    private static ILogger CreateLogger(out IDisposable contextGuard)
    {
        contextGuard = TestCorrelator.CreateContext();
        return new LoggerConfiguration()
            .Destructure.With<SensitiveDataDestructuringPolicy>()
            .WriteTo.TestCorrelator()
            .CreateLogger();
    }

    [Fact]
    public void RedactsPasswordField_WhenObjectIsDestructured()
    {
        var logger = CreateLogger(out var guard);
        using (guard)
        {
            var cfg = new { Username = "alice", Password = "real-secret-xyz" };
            logger.Information("Config: {@Cfg}", cfg);
            var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
            var rendered = evt.RenderMessage();

            rendered.Should().NotContain("real-secret-xyz", "the password value must be redacted");
            rendered.Should().Contain("***REDACTED***");
            rendered.Should().Contain("alice", "non-sensitive fields must still log");
        }
    }

    [Fact]
    public void RedactsClientSecretField_WhenObjectIsDestructured()
    {
        var logger = CreateLogger(out var guard);
        using (guard)
        {
            var keycloak = new { Authority = "https://kc.example", ClientId = "iab-api", ClientSecret = "real-client-secret-zzz" };
            logger.Information("Keycloak: {@Kc}", keycloak);
            var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
            var rendered = evt.RenderMessage();

            rendered.Should().NotContain("real-client-secret-zzz");
            rendered.Should().Contain("***REDACTED***");
            rendered.Should().Contain("iab-api");
        }
    }

    [Fact]
    public void DoesNotIntervene_WhenObjectHasNoSensitiveProperties()
    {
        // Side-effect guard: objects with no sensitive-named properties pass through
        // unchanged. Validates the policy's "guard then default" shape.
        var logger = CreateLogger(out var guard);
        using (guard)
        {
            var benign = new { Name = "iab-connect", Version = "1.2.3", License = "AGPL-3.0-or-later" };
            logger.Information("App: {@App}", benign);
            var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
            var rendered = evt.RenderMessage();

            rendered.Should().Contain("iab-connect");
            rendered.Should().Contain("1.2.3");
            rendered.Should().Contain("AGPL-3.0-or-later");
            rendered.Should().NotContain("REDACTED");
        }
    }

    [Fact]
    public void BearerPresenceEnricher_LogsPresent_WhenAuthorizationHeaderStartsWithBearer()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Authorization = "Bearer abc.def.ghi";
        var accessor = new HttpContextAccessor { HttpContext = ctx };
        var enricher = new BearerPresenceEnricher(accessor);

        using var guard = TestCorrelator.CreateContext();
        var logger = new LoggerConfiguration()
            .Enrich.With(enricher)
            .WriteTo.TestCorrelator()
            .CreateLogger();
        logger.Information("Test event");

        var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
        evt.Properties.Should().ContainKey("BearerPresence");
        evt.Properties["BearerPresence"].ToString().Should().Contain("bearer-present");
        // Never leak the raw token
        evt.Properties["BearerPresence"].ToString().Should().NotContain("abc.def.ghi");
    }

    [Fact]
    public void BearerPresenceEnricher_LogsAbsent_WhenAuthorizationHeaderMissing()
    {
        var ctx = new DefaultHttpContext();
        var accessor = new HttpContextAccessor { HttpContext = ctx };
        var enricher = new BearerPresenceEnricher(accessor);

        using var guard = TestCorrelator.CreateContext();
        var logger = new LoggerConfiguration()
            .Enrich.With(enricher)
            .WriteTo.TestCorrelator()
            .CreateLogger();
        logger.Information("Test event");

        var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
        evt.Properties["BearerPresence"].ToString().Should().Contain("bearer-absent");
    }

    [Fact]
    public void BearerPresenceEnricher_LogsNoHttpContext_WhenAccessorIsEmpty()
    {
        var accessor = new HttpContextAccessor { HttpContext = null };
        var enricher = new BearerPresenceEnricher(accessor);

        using var guard = TestCorrelator.CreateContext();
        var logger = new LoggerConfiguration()
            .Enrich.With(enricher)
            .WriteTo.TestCorrelator()
            .CreateLogger();
        logger.Information("Test event");

        var evt = TestCorrelator.GetLogEventsFromCurrentContext().Single();
        evt.Properties["BearerPresence"].ToString().Should().Contain("no-http-context");
    }

    [Fact]
    public void BearerPresenceEnricher_IsRegisteredInApiDi_CodeAudit()
    {
        // Code-audit: confirms Program.cs registers BearerPresenceEnricher as a singleton
        // ILogEventEnricher AND that .ReadFrom.Services() is configured so the enricher
        // gets picked up by Serilog. A regression on either line would silently drop the
        // bearer-presence enrichment from production logs.
        var assemblyDir = Path.GetDirectoryName(typeof(SensitiveDataDestructuringPolicyTests).Assembly.Location)!;
        var programCs = File.ReadAllText(Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "Program.cs")));

        programCs.Should().Contain("AddSingleton<ILogEventEnricher, BearerPresenceEnricher>",
            "Program.cs must register BearerPresenceEnricher as a singleton ILogEventEnricher service");
        programCs.Should().Contain(".ReadFrom.Services(services)",
            "Program.cs must keep .ReadFrom.Services(services) so Serilog auto-discovers the registered enricher");
        programCs.Should().Contain(".Destructure.With<SensitiveDataDestructuringPolicy>()",
            "Program.cs must register the destructuring policy");
    }

    [Fact]
    public void RequestBodyLogging_IsNotEnabledInPipeline_CodeAudit()
    {
        // E14-S5 AC-2: request-body logging must remain OFF. The pipeline calls
        // app.UseSerilogRequestLogging() with NO enrichment callback that adds body
        // content. This code-audit confirms the pipeline does not configure body
        // logging. A future change wiring an EnrichDiagnosticContext callback that
        // reads Request.Body would fail this guard.
        var assemblyDir = Path.GetDirectoryName(typeof(SensitiveDataDestructuringPolicyTests).Assembly.Location)!;
        var diSource = File.ReadAllText(Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api", "DependencyInjection.cs")));

        diSource.Should().Contain("app.UseSerilogRequestLogging()",
            "UseSerilogRequestLogging() must be present in the pipeline");
        diSource.Should().NotMatchRegex(
            @"UseSerilogRequestLogging\(\s*options\s*=>\s*\{[\s\S]*?Request\.Body",
            "request-body logging callback would breach E14-S5 AC-2");
        diSource.Should().NotContain("EnrichDiagnosticContext",
            "any EnrichDiagnosticContext callback would need an audit; AC-2 requires no body logging");
    }

    [Fact]
    public void AllowlistParity_DestructureFieldsCoverAuditScriptAllowlist()
    {
        // A31 invariant: the Serilog destructure-block field-name list must AT LEAST
        // cover the field-name vocabulary the E14-S1 audit script greps for. Reading
        // the script and asserting the destructure HashSet contains the core canonical
        // names is the lightweight parity check.
        var assemblyDir = Path.GetDirectoryName(typeof(SensitiveDataDestructuringPolicyTests).Assembly.Location)!;
        var auditScript = Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "..", "scripts", "audit-secrets.ps1"));

        File.Exists(auditScript).Should().BeTrue("E14-S1 audit script must exist for A31 parity check");
        var scriptText = File.ReadAllText(auditScript);

        // The audit script's $Patterns array enumerates the grep patterns. We confirm
        // the destructure policy covers each pattern's canonical property-name form.
        scriptText.Should().Contain("'password'");
        scriptText.Should().Contain("'secret'");
        scriptText.Should().Contain("'client_secret'");
        scriptText.Should().Contain("'api_key'");
        scriptText.Should().Contain("'access_key'");
        scriptText.Should().Contain("'ConnectionStrings'");
        scriptText.Should().Contain("'NEXTAUTH_SECRET'");
        scriptText.Should().Contain("'EncryptionKey'");

        var names = SensitiveDataDestructuringPolicy.SensitivePropertyNames;
        names.Should().Contain("password", "audit script greps for 'password'");
        names.Should().Contain("secret", "audit script greps for 'secret'");
        names.Should().Contain("client_secret", "audit script greps for 'client_secret'");
        names.Should().Contain("api_key", "audit script greps for 'api_key'");
        names.Should().Contain("access_key", "audit script greps for 'access_key'");
        names.Should().Contain("connectionstring", "audit script greps for 'ConnectionStrings' (case-insensitive HashSet)");
        names.Should().Contain("NEXTAUTH_SECRET", "audit script greps for 'NEXTAUTH_SECRET'");
        names.Should().Contain("EncryptionKey", "audit script greps for 'EncryptionKey'");
    }
}
