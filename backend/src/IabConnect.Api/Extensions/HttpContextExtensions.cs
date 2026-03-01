using System.Security.Claims;

namespace IabConnect.Api.Extensions;

/// <summary>
/// Shared extension methods for HttpContext to extract user information from JWT claims.
/// Consolidates the GetUserName logic previously duplicated across 16+ endpoint files.
/// </summary>
public static class HttpContextExtensions
{
    /// <summary>
    /// Extracts the username from the current user's claims.
    /// Fallback chain: preferred_username → name → email → ClaimTypes.Email → "system"
    /// </summary>
    public static string GetUserName(this HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst("name")?.Value
        ?? ctx.User.FindFirst("email")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    /// <summary>
    /// Extracts the user ID (sub claim) from the current user's claims.
    /// </summary>
    public static Guid GetUserId(this HttpContext ctx)
    {
        var sub = ctx.User.FindFirst("sub")?.Value;
        return Guid.TryParse(sub, out var userId) ? userId : Guid.Empty;
    }
}
