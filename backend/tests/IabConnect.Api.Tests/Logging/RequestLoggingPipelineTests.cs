// SPDX-License-Identifier: AGPL-3.0-or-later
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Serilog;
using Serilog.Context;
using Serilog.Sinks.TestCorrelator;
using Xunit;

namespace IabConnect.Api.Tests.Logging;

/// <summary>
/// REQ-088 AC-5 (E17-S2 / ADR-017): pipeline-registration regression coverage for the
/// CorrelationId tracing surface — middleware ordering, log-level configuration, per-request
/// continuity (single request → many lines → one CorrelationId), per-request isolation
/// (concurrent requests → distinct CorrelationIds), exception-handler LogContext preservation,
/// and the A31 doc-vs-code invariant against docs/14 Section 26.
///
/// Tests using TestCorrelator configure a fixture-local Serilog ILogger
/// (LoggerConfiguration().Enrich.FromLogContext().WriteTo.TestCorrelator()) so the global
/// Log.Logger from Program.cs:10 is NOT touched (A49 sidestep).
///
/// AC-5's log-level test uses the A36 InMemoryCollection-empty-binding pattern to defend
/// against env-var leakage on CI runners.
/// </summary>
public sealed class RequestLoggingPipelineTests
{
    private static string ResolveApiProjectDir()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(RequestLoggingPipelineTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "src", "IabConnect.Api"));
    }

    private static string ResolveDependencyInjectionCsPath() =>
        Path.Combine(ResolveApiProjectDir(), "DependencyInjection.cs");

    private static string ResolveCorrelationIdMiddlewareCsPath() =>
        Path.Combine(ResolveApiProjectDir(), "Middleware", "CorrelationIdMiddleware.cs");

    private static string ResolveExceptionHandlingMiddlewareCsPath() =>
        Path.Combine(ResolveApiProjectDir(), "Middleware", "ExceptionHandlingMiddleware.cs");

    private static string ResolveDocs14Path()
    {
        var assemblyDir = Path.GetDirectoryName(typeof(RequestLoggingPipelineTests).Assembly.Location)!;
        return Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "..", "..", "docs", "14_beta_railway_setup.md"));
    }

    [Fact]
    public void Pipeline_CorrelationIdMiddleware_BeforeExceptionAndRequestLogging_AC4()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());

        // Isolate the UseApiPipeline method body.
        var apiPipelineStart = di.IndexOf("public static WebApplication UseApiPipeline", StringComparison.Ordinal);
        apiPipelineStart.Should().BeGreaterThan(0, "UseApiPipeline method must exist");
        var apiPipelineEnd = di.IndexOf("return app;", apiPipelineStart, StringComparison.Ordinal);
        apiPipelineEnd.Should().BeGreaterThan(apiPipelineStart);
        var body = di.Substring(apiPipelineStart, apiPipelineEnd - apiPipelineStart);

        int correlationIdIdx = body.IndexOf("UseMiddleware<CorrelationIdMiddleware>", StringComparison.Ordinal);
        int exceptionHandlingIdx = body.IndexOf("UseMiddleware<ExceptionHandlingMiddleware>", StringComparison.Ordinal);
        int serilogRequestLoggingIdx = body.IndexOf("UseSerilogRequestLogging", StringComparison.Ordinal);

        correlationIdIdx.Should().BeGreaterThan(0, "CorrelationIdMiddleware must be registered in UseApiPipeline");
        exceptionHandlingIdx.Should().BeGreaterThan(0, "ExceptionHandlingMiddleware must be registered in UseApiPipeline");
        serilogRequestLoggingIdx.Should().BeGreaterThan(0, "UseSerilogRequestLogging must be registered in UseApiPipeline");

        correlationIdIdx.Should().BeLessThan(exceptionHandlingIdx,
            "CorrelationIdMiddleware must run BEFORE ExceptionHandlingMiddleware so unhandled-exception logs carry the CorrelationId via LogContext");
        exceptionHandlingIdx.Should().BeLessThan(serilogRequestLoggingIdx,
            "ExceptionHandlingMiddleware must run BEFORE UseSerilogRequestLogging so a 500 emitted by the exception handler is observed by the request-logger");
    }

    [Fact]
    public void Pipeline_UseSerilogRequestLogging_IsRegistered_AC8()
    {
        var di = File.ReadAllText(ResolveDependencyInjectionCsPath());
        Regex.Matches(di, @"app\.UseSerilogRequestLogging\s*\(").Count
            .Should().Be(1, "UseSerilogRequestLogging must be registered exactly once in UseApiPipeline");
    }

    [Fact]
    public void Pipeline_ExceptionHandlingMiddleware_DoesNotStripLogContext_AC9()
    {
        var src = File.ReadAllText(ResolveExceptionHandlingMiddlewareCsPath());

        // Negative assertion: middleware must not call LogContext.Reset() or any other
        // API that clears Serilog's ambient property stack.
        src.Should().NotContain("LogContext.Reset",
            "ExceptionHandlingMiddleware must preserve the ambient LogContext (including CorrelationId) when logging exceptions");

        // Positive assertion: middleware uses ILogger (Microsoft.Extensions.Logging) OR
        // Serilog static Log — both of which pick up LogContext properties via the
        // builder.Host.UseSerilog(...) provider wired in Program.cs.
        var usesILogger = Regex.IsMatch(src, @"_logger\.Log(Information|Warning|Error|Critical|Trace|Debug)");
        var usesSerilogStatic = Regex.IsMatch(src, @"\bLog\.(Information|Warning|Error|Fatal|Debug)\b");

        (usesILogger || usesSerilogStatic).Should().BeTrue(
            "ExceptionHandlingMiddleware must log via ILogger or Serilog static so ambient LogContext properties (CorrelationId) are inherited");
    }

    [Fact]
    public void LogContext_PropagatesCorrelationIdAcrossMultipleLines_AC6()
    {
        const string scopedValue = "scope-A-multi-line-12345";

        using (TestCorrelator.CreateContext())
        {
            var fixtureLogger = new LoggerConfiguration()
                .Enrich.FromLogContext()
                .WriteTo.TestCorrelator()
                .CreateLogger();

            using (LogContext.PushProperty("CorrelationId", scopedValue))
            {
                fixtureLogger.Information("first line");
                fixtureLogger.Information("second line");
            }

            var events = TestCorrelator.GetLogEventsFromCurrentContext().ToList();
            events.Should().HaveCount(2, "both log statements must produce events");
            foreach (var evt in events)
            {
                evt.Properties.Should().ContainKey("CorrelationId");
                evt.Properties["CorrelationId"].ToString().Trim('"').Should().Be(scopedValue,
                    "every log line emitted inside the same LogContext.PushProperty scope must carry the same CorrelationId");
            }
        }
    }

    [Fact]
    public async Task LogContext_IsolatesCorrelationIdAcrossConcurrentTasks_AC7()
    {
        using (TestCorrelator.CreateContext())
        {
            var fixtureLogger = new LoggerConfiguration()
                .Enrich.FromLogContext()
                .WriteTo.TestCorrelator()
                .CreateLogger();

            const string scopeX = "scope-X-isolated-aaaaa";
            const string scopeY = "scope-Y-isolated-bbbbb";

            var cancellationToken = TestContext.Current.CancellationToken;
            var taskX = Task.Run(async () =>
            {
                using (LogContext.PushProperty("CorrelationId", scopeX))
                {
                    await Task.Yield();
                    fixtureLogger.Information("worker X marker");
                }
            }, cancellationToken);
            var taskY = Task.Run(async () =>
            {
                using (LogContext.PushProperty("CorrelationId", scopeY))
                {
                    await Task.Yield();
                    fixtureLogger.Information("worker Y marker");
                }
            }, cancellationToken);

            await Task.WhenAll(taskX, taskY).WaitAsync(cancellationToken);

            var events = TestCorrelator.GetLogEventsFromCurrentContext().ToList();
            events.Should().HaveCount(2, "each worker task emits exactly one log event");

            var xEvent = events.Single(e => e.MessageTemplate.Text.Contains("worker X"));
            var yEvent = events.Single(e => e.MessageTemplate.Text.Contains("worker Y"));

            xEvent.Properties["CorrelationId"].ToString().Trim('"').Should().Be(scopeX,
                "worker X's CorrelationId must reflect its own LogContext.PushProperty (AsyncLocal isolation)");
            yEvent.Properties["CorrelationId"].ToString().Trim('"').Should().Be(scopeY,
                "worker Y's CorrelationId must reflect its own LogContext.PushProperty (AsyncLocal isolation)");
        }
    }

    [Fact]
    public void Configuration_LogLevelOverrides_MatchSpec_AC5()
    {
        // A36 pattern (epic-17 boundary review P5/E2 fix): bind env-var-mapped keys to
        // their expected values AFTER AddEnvironmentVariables so a CI runner with
        // Serilog__MinimumLevel__Default=Trace set in its environment cannot leak into
        // the assertions. AddInMemoryCollection runs LATER in the chain than
        // AddEnvironmentVariables, so the InMemoryCollection wins. Previously the
        // dictionary was empty — Blind Hunter P5 + Edge Case Hunter E2 flagged this as
        // a no-op that gave false A36 confidence. Patched to populate the dictionary
        // with the expected JSON-file values AND prepend AddEnvironmentVariables so
        // the layering actually exercises the defense.
        var appsettingsPath = Path.Combine(ResolveApiProjectDir(), "appsettings.json");

        var leakDefenseBindings = new Dictionary<string, string?>
        {
            ["Serilog:MinimumLevel:Default"] = "Information",
            ["Serilog:MinimumLevel:Override:Microsoft"] = "Warning",
            ["Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore"] = "Warning",
            ["Serilog:MinimumLevel:Override:Microsoft.Hosting.Lifetime"] = "Information",
            // Also defend the parallel Logging:LogLevel tree (Microsoft.Extensions.Logging
            // adapter reads both; Edge Case Hunter E1 flagged the unprotected surface).
            ["Logging:LogLevel:Default"] = "Information",
            ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning",
            ["Logging:LogLevel:Microsoft.EntityFrameworkCore"] = "Warning",
        };

        var config = new ConfigurationBuilder()
            .AddJsonFile(appsettingsPath, optional: false)
            .AddEnvironmentVariables()
            .AddInMemoryCollection(leakDefenseBindings)
            .Build();

        // Serilog:MinimumLevel tree (canonical Serilog surface)
        config["Serilog:MinimumLevel:Default"].Should().Be("Information",
            "base config must specify Default minimum level Information per SCP §5 E17-S2");
        config["Serilog:MinimumLevel:Override:Microsoft"].Should().Be("Warning",
            "base config must override Microsoft.* to Warning per SCP §5 E17-S2");
        config["Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore"].Should().Be("Warning",
            "base config must override Microsoft.EntityFrameworkCore.* to Warning per SCP §5 E17-S2");
        config["Serilog:MinimumLevel:Override:Microsoft.Hosting.Lifetime"].Should().Be("Information",
            "base config preserves the Microsoft.Hosting.Lifetime carve-out so application-startup events stay visible (operator-required)");

        // Logging:LogLevel parallel tree (Microsoft.Extensions.Logging adapter — E17-S2
        // boundary-review E1 widened coverage to lock in the parallel surface).
        config["Logging:LogLevel:Default"].Should().Be("Information",
            "Microsoft.Extensions.Logging adapter Default level must match Serilog's Default per consistency");
        config["Logging:LogLevel:Microsoft.AspNetCore"].Should().Be("Warning",
            "Logging:LogLevel:Microsoft.AspNetCore=Warning suppresses framework noise via the MEL adapter");
        config["Logging:LogLevel:Microsoft.EntityFrameworkCore"].Should().Be("Warning",
            "Logging:LogLevel:Microsoft.EntityFrameworkCore=Warning suppresses per-query SQL parameter logs via the MEL adapter");
    }

    [Fact]
    public void Docs14Section26_MatchesRuntimeSources_AC11()
    {
        var docs = File.ReadAllText(ResolveDocs14Path());
        docs.Should().Contain("## 26. Structured logs with CorrelationId (E17-S2)",
            "docs/14 Section 26 (E17-S2) must be published with the canonical heading so the A31 invariant test can locate it");

        var middlewareSrc = File.ReadAllText(ResolveCorrelationIdMiddlewareCsPath());
        var headerConstantMatch = Regex.Match(middlewareSrc, @"CorrelationIdHeader\s*=\s*""(?<value>[^""]+)""");
        headerConstantMatch.Success.Should().BeTrue("CorrelationIdMiddleware must declare a CorrelationIdHeader const for documentation parity");
        var headerConstant = headerConstantMatch.Groups["value"].Value;
        headerConstant.Should().Be("X-Correlation-Id", "canonical header name must match documented contract");

        // Locate Section 26 body
        var section26Start = docs.IndexOf("## 26. Structured logs with CorrelationId", StringComparison.Ordinal);
        var section26End = docs.IndexOf("\n## ", section26Start + 1, StringComparison.Ordinal);
        if (section26End < 0) section26End = docs.Length;
        var section26 = docs.Substring(section26Start, section26End - section26Start);

        section26.Should().Contain(headerConstant,
            $"Section 26 must reference the canonical header constant '{headerConstant}' from CorrelationIdMiddleware.cs");
        section26.Should().Contain("CorrelationId",
            "Section 26 must reference the log property name 'CorrelationId' (matches LogContext.PushProperty key)");
        section26.Should().Contain("Information",
            "Section 26's log-level reference must cite the Default=Information level from appsettings.json");
        section26.Should().Contain("Warning",
            "Section 26's log-level reference must cite the Microsoft.* and Microsoft.EntityFrameworkCore.* Warning overrides");
    }
}
