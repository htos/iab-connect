// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using FluentAssertions;
using IabConnect.Api.Middleware;
using Microsoft.AspNetCore.Http;
using Serilog;
using Serilog.Context;
using Serilog.Sinks.TestCorrelator;
using Xunit;

namespace IabConnect.Api.Tests.Middleware;

/// <summary>
/// REQ-088 AC-5 (E17-S2 / ADR-017): asserts the CorrelationIdMiddleware contract end-to-end:
/// (1) reads X-Correlation-Id from request OR generates a fresh 32-char hex GUID;
/// (2) echoes the value to the response header;
/// (3) stashes it in HttpContext.Items;
/// (4) pushes it into Serilog.Context.LogContext so any downstream Log statement carries it.
///
/// Tests use a stub RequestDelegate that captures LogContext.PushProperty material via a
/// callback — sidesteps A49's "Log.Logger frozen" constraint because no
/// WebApplicationFactory&lt;Program&gt; is instantiated.
/// </summary>
public sealed class CorrelationIdMiddlewareTests
{
    private static DefaultHttpContext CreateHttpContext(string? incomingHeader = null)
    {
        var ctx = new DefaultHttpContext();
        if (incomingHeader != null)
        {
            ctx.Request.Headers["X-Correlation-Id"] = incomingHeader;
        }
        return ctx;
    }

    [Fact]
    public async Task Middleware_PushesCorrelationIdIntoLogContext_AC1()
    {
        // Capture the LogContext property value that is in scope during the downstream
        // delegate execution. PushProperty stores in an AsyncLocal stack; the test reads
        // the stack via Serilog's GetEnricher mechanism (here approximated by emitting
        // through a sink-less ILogger and reading the enriched LogEvent).
        string? observedFromContext = null;
        Task NextDelegate(HttpContext _)
        {
            // Stash the current ambient CorrelationId — when LogContext.PushProperty is
            // active, an inner LogContext.PushProperty for a probe key reflects the
            // outer push via Serilog's ILogEventEnricher chain. We instead read it from
            // the HttpContext.Items stash that the middleware also writes (AC-1 is
            // specifically about LogContext push, so we ALSO confirm the LogContext push
            // by performing a downstream Log emission in AC-2 below — here we cross-check
            // against HttpContext.Items as a behavior proxy).
            observedFromContext = (string?)_.Items["CorrelationId"];
            return Task.CompletedTask;
        }

        var middleware = new CorrelationIdMiddleware(NextDelegate);
        var ctx = CreateHttpContext();

        await middleware.InvokeAsync(ctx);

        observedFromContext.Should().NotBeNull("middleware must populate HttpContext.Items[CorrelationId] during the downstream delegate scope");
        observedFromContext.Should().MatchRegex("^[0-9a-f]{32}$", "server-generated value follows Guid.NewGuid().ToString(\"N\") shape");
    }

    [Fact]
    public async Task Middleware_EchoesIncomingHeader_AC2()
    {
        const string incoming = "probe-value-abc-123";
        string? itemsCapture = null;

        Task NextDelegate(HttpContext c)
        {
            itemsCapture = (string?)c.Items["CorrelationId"];
            return Task.CompletedTask;
        }

        var middleware = new CorrelationIdMiddleware(NextDelegate);
        var ctx = CreateHttpContext(incoming);

        await middleware.InvokeAsync(ctx);

        ctx.Response.Headers["X-Correlation-Id"].ToString()
            .Should().Be(incoming, "response header echoes the caller-provided X-Correlation-Id verbatim");
        itemsCapture.Should().Be(incoming, "HttpContext.Items[CorrelationId] mirrors the same value within the downstream delegate scope");
    }

    [Fact]
    public async Task Middleware_GeneratesGuidWhenHeaderMissing_AC3()
    {
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);
        var ctx = CreateHttpContext();

        await middleware.InvokeAsync(ctx);

        var responseValue = ctx.Response.Headers["X-Correlation-Id"].ToString();
        responseValue.Should().MatchRegex("^[0-9a-f]{32}$",
            "server-generated value must be Guid.NewGuid().ToString(\"N\") — 32 lowercase hex chars no dashes");
    }

    [Fact]
    public async Task Middleware_GeneratesDistinctGuidsAcrossInvocations_AC3b()
    {
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);

        var ctxA = CreateHttpContext();
        var ctxB = CreateHttpContext();

        await middleware.InvokeAsync(ctxA);
        await middleware.InvokeAsync(ctxB);

        var valueA = ctxA.Response.Headers["X-Correlation-Id"].ToString();
        var valueB = ctxB.Response.Headers["X-Correlation-Id"].ToString();

        valueA.Should().NotBe(valueB, "successive Guid.NewGuid() invocations must produce distinct identifiers");
    }

    [Fact]
    public async Task Middleware_LogContextPropertyMatchesHttpContextItems_AC1b()
    {
        // Defense-in-depth probe: while the middleware is executing the downstream delegate,
        // LogContext.PushProperty("CorrelationId", ...) is in scope. We confirm by opening
        // an inner LogContext.PushProperty("Probe", ...) and inspecting Serilog's enrich
        // stack via a dummy LogEvent.
        const string incoming = "probe-multi-level";
        string? logContextCorrelationProperty = null;

        Task NextDelegate(HttpContext c)
        {
            // Open a sub-scope and read the ambient CorrelationId via a logger-event probe.
            // We use a fixture-local TestCorrelator setup to enrich + capture.
            using (TestCorrelator.CreateContext())
            {
                var fixtureLogger = new LoggerConfiguration()
                    .Enrich.FromLogContext()
                    .WriteTo.TestCorrelator()
                    .CreateLogger();
                fixtureLogger.Information("probe");
                var evt = System.Linq.Enumerable.Single(TestCorrelator.GetLogEventsFromCurrentContext());
                if (evt.Properties.TryGetValue("CorrelationId", out var prop))
                {
                    logContextCorrelationProperty = prop.ToString().Trim('"');
                }
            }
            return Task.CompletedTask;
        }

        var middleware = new CorrelationIdMiddleware(NextDelegate);
        var ctx = CreateHttpContext(incoming);

        await middleware.InvokeAsync(ctx);

        logContextCorrelationProperty.Should().Be(incoming,
            "the CorrelationId pushed via LogContext.PushProperty must be visible to any downstream Log emission within the request scope");
    }
}
