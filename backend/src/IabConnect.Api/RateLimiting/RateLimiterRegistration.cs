// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace IabConnect.Api.RateLimiting;

/// <summary>
/// REQ-088 AC-4 (E14-S4): registers the ASP.NET Core rate-limiter with the three policies
/// from <see cref="RateLimitingOptions"/>. Extracted as a static helper so
/// <see cref="DependencyInjection.AddApiServices"/> stays readable.
///
/// Pipeline ordering (in <c>UseApiPipeline</c>): the limiter must run AFTER
/// <c>UseAuthentication()</c> + <c>UseAuthorization()</c> so the global partition function
/// can inspect <c>httpContext.User</c>; AFTER <c>UseForwardedHeaders()</c> so the
/// anonymous-bucket partition key reflects the real client IP (not Railway's edge); AFTER
/// <c>UseCors()</c> so CORS preflights are not counted.
/// </summary>
public static class RateLimiterRegistration
{
    public static IServiceCollection AddIabConnectRateLimiter(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(configuration.GetSection(RateLimitingOptions.SectionName));

        // Trust Railway's edge X-Forwarded-For so the anonymous-bucket partition key is the
        // real client IP. KnownNetworks + KnownProxies cleared = trust any upstream proxy
        // (Railway's edge model — the platform terminates TLS + sets the header). Spoofing
        // risk documented in docs/14_beta_railway_setup.md §23.4.
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });

        services.AddRateLimiter(rateLimiterOptions =>
        {
            rateLimiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Global limiter: branches by authentication state.
            rateLimiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                var optionsMonitor = httpContext.RequestServices.GetRequiredService<IOptionsMonitor<RateLimitingOptions>>();
                var opts = optionsMonitor.CurrentValue;
                var window = TimeSpan.FromSeconds(opts.WindowSeconds);

                if (httpContext.User.Identity?.IsAuthenticated == true)
                {
                    var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                                 ?? httpContext.User.FindFirstValue("sub")
                                 ?? "unknown-user";
                    return RateLimitPartition.GetFixedWindowLimiter("auth:" + userId,
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = opts.AuthenticatedPermitLimit,
                            Window = window,
                            QueueLimit = 0,
                            AutoReplenishment = true,
                        });
                }

                var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown-ip";
                return RateLimitPartition.GetFixedWindowLimiter("anon:" + ip,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = opts.AnonymousPermitLimit,
                        Window = window,
                        QueueLimit = 0,
                        AutoReplenishment = true,
                    });
            });

            // Named policy: strict-identity (E14-S4 DEC-1=A). Applied to DELETE session-
            // revocation endpoints + POST admin reset-mfa.
            rateLimiterOptions.AddPolicy(RateLimitingOptions.StrictPolicyName,
                httpContext =>
                {
                    var optionsMonitor = httpContext.RequestServices.GetRequiredService<IOptionsMonitor<RateLimitingOptions>>();
                    var opts = optionsMonitor.CurrentValue;
                    var partitionKey = httpContext.User.Identity?.IsAuthenticated == true
                        ? "strict-auth:" + (httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown")
                        : "strict-anon:" + (httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
                    return RateLimitPartition.GetFixedWindowLimiter(partitionKey,
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = opts.StrictPermitLimit,
                            Window = TimeSpan.FromSeconds(opts.WindowSeconds),
                            QueueLimit = 0,
                            AutoReplenishment = true,
                        });
                });

            // REQ-058 (E8-S2): named policy for the external API. Partitions on the ApiClient id
            // (NameIdentifier claim set by the S1 ApiKey handler) so each integration has its own
            // per-credential quota, distinct from the first-party authenticated bucket.
            rateLimiterOptions.AddPolicy(RateLimitingOptions.ExternalApiPolicyName,
                httpContext =>
                {
                    var optionsMonitor = httpContext.RequestServices.GetRequiredService<IOptionsMonitor<RateLimitingOptions>>();
                    var opts = optionsMonitor.CurrentValue;
                    var clientId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown-client";
                    return RateLimitPartition.GetFixedWindowLimiter("external:" + clientId,
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = opts.ExternalApiPermitLimit,
                            Window = TimeSpan.FromSeconds(opts.WindowSeconds),
                            QueueLimit = 0,
                            AutoReplenishment = true,
                        });
                });

            rateLimiterOptions.OnRejected = async (context, ct) =>
            {
                // Edge-1: if another middleware already started writing the response, we
                // cannot mutate StatusCode or Headers — setters throw. Bail out so the
                // partial response is not corrupted.
                if (context.HttpContext.Response.HasStarted)
                {
                    return;
                }

                int? retryAfterSeconds = null;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    retryAfterSeconds = (int)retryAfter.TotalSeconds;
                    context.HttpContext.Response.Headers["Retry-After"] =
                        retryAfterSeconds.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
                }
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                // E14-S4 AC-5: body carries both error code and retryAfter seconds (matches
                // the Retry-After header value); consumers without header access get parity.
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { error = "rate_limit_exceeded", retryAfter = retryAfterSeconds }, ct);
            };
        });

        return services;
    }
}
