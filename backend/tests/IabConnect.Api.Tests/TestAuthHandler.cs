using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Api.Tests;

/// <summary>
/// Header-driven test authentication scheme (REQ-087, E10-S3). A request that carries
/// <see cref="UserHeader"/> is authenticated with that subject id and the comma-separated
/// roles in <see cref="RolesHeader"/>; a request without the header gets
/// <see cref="AuthenticateResult.NoResult"/> and stays anonymous — preserving the existing
/// "no header → 401 on protected endpoints" behaviour every other API test relies on.
///
/// <para>Registered by <see cref="TestWebApplicationFactory"/> as the default scheme,
/// standing in for the real Keycloak JWT bearer handler that cannot be exercised without a
/// live identity provider.</para>
/// </summary>
public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string UserHeader = "X-Test-User";
    public const string RolesHeader = "X-Test-Roles";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserHeader, out var userId)
            || string.IsNullOrWhiteSpace(userId))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new List<Claim>
        {
            new("sub", userId.ToString()),
            new("preferred_username", userId.ToString()),
        };

        if (Request.Headers.TryGetValue(RolesHeader, out var roles))
        {
            foreach (var role in roles.ToString()
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }
        }

        // RoleClaimType = ClaimTypes.Role matches the real JWT config and what RequireRole /
        // PermissionAuthorizationHandler read.
        var identity = new ClaimsIdentity(claims, SchemeName, "preferred_username", ClaimTypes.Role);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
