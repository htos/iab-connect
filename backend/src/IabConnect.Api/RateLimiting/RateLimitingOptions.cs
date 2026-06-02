// SPDX-License-Identifier: AGPL-3.0-or-later

namespace IabConnect.Api.RateLimiting;

/// <summary>
/// REQ-088 AC-4 (E14-S4): Rate-limiting baseline configuration. Bound from
/// <c>IConfiguration.GetSection("RateLimiting")</c> in <see cref="DependencyInjection"/>.
/// Defaults match SCP-2026-05-15 §5 baseline: 100 req/min/IP anonymous,
/// 600 req/min/user authenticated, 10 req/min on the strict-identity policy
/// (DEC-1=A target: session-revocation + admin MFA reset). Healthcheck endpoints
/// (<c>/health</c>, <c>/health/ready</c>, <c>/health/detail</c>) are exempted via
/// <c>.DisableRateLimiting()</c> chains on each endpoint mapping so Railway's
/// probe never trips the limiter.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    /// <summary>Anonymous requests per minute per IP. Default 100.</summary>
    public int AnonymousPermitLimit { get; set; } = 100;

    /// <summary>Authenticated requests per minute per user identity. Default 600.</summary>
    public int AuthenticatedPermitLimit { get; set; } = 600;

    /// <summary>
    /// Strict-policy requests per minute (applied to session-revocation + admin MFA reset
    /// per DEC-1=A). Default 10.
    /// </summary>
    public int StrictPermitLimit { get; set; } = 10;

    /// <summary>Sliding-window duration in seconds. Default 60 (one minute).</summary>
    public int WindowSeconds { get; set; } = 60;

    /// <summary>Named policy key for the strict-identity policy.</summary>
    public const string StrictPolicyName = "strict-identity";
}
