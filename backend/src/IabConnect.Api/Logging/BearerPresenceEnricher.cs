// SPDX-License-Identifier: AGPL-3.0-or-later
using Microsoft.AspNetCore.Http;
using Serilog.Core;
using Serilog.Events;

namespace IabConnect.Api.Logging;

/// <summary>
/// REQ-088 AC-4 (E14-S5): Serilog enricher that adds a <c>BearerPresence</c> property
/// to every log event, with value <c>"bearer-present"</c> when the current request
/// carries an <c>Authorization: Bearer ...</c> header, or <c>"bearer-absent"</c>
/// otherwise. NEVER emits the token contents.
///
/// Registered as a singleton <see cref="ILogEventEnricher"/> in the API DI
/// container; Serilog discovers it via <c>.ReadFrom.Services(services)</c> in
/// <see cref="Program"/>. Outside an HTTP request context (e.g., background-job
/// log events) the enricher emits <c>"no-http-context"</c> so the property is
/// always present for log-query consistency.
/// </summary>
public sealed class BearerPresenceEnricher : ILogEventEnricher
{
    private const string PropertyName = "BearerPresence";
    private const string AuthorizationHeader = "Authorization";
    private const string BearerPrefix = "Bearer ";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public BearerPresenceEnricher(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var ctx = _httpContextAccessor.HttpContext;
        string presence;
        if (ctx is null)
        {
            presence = "no-http-context";
        }
        else if (ctx.Request.Headers.TryGetValue(AuthorizationHeader, out var values))
        {
            // Edge-7: the Authorization header may carry multiple values (RFC 7230 §3.2.2;
            // some clients + pen-test tools duplicate). StringValues.ToString() comma-joins,
            // which would hide a "Bearer ..." value behind a leading "Negotiate ..." entry.
            // Loop per-value so we detect Bearer presence regardless of ordering.
            presence = "bearer-absent";
            foreach (var value in values)
            {
                if (value is not null && value.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    presence = "bearer-present";
                    break;
                }
            }
        }
        else
        {
            presence = "bearer-absent";
        }

        logEvent.AddPropertyIfAbsent(propertyFactory.CreateProperty(PropertyName, presence));
    }
}
