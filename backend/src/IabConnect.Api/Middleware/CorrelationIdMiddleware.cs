using Serilog.Context;

namespace IabConnect.Api.Middleware;

/// <summary>
/// REQ-054: Adds a correlation ID to every request for distributed tracing.
/// Reads X-Correlation-Id header or generates a new GUID.
/// Pushes CorrelationId into Serilog LogContext and response headers.
/// </summary>
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string CorrelationIdHeader = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N");

        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers[CorrelationIdHeader] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await next(context);
        }
    }
}
