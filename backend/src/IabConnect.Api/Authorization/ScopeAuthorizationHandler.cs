using IabConnect.Api.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace IabConnect.Api.Authorization;

/// <summary>
/// REQ-058 (E8-S1): authorization requirement that gates an external route behind a granted API
/// scope (e.g. <c>events:read</c>). Mirrors <see cref="PermissionRequirement"/> /
/// <see cref="ModuleRequirement"/>; resolved via the <c>Scope:</c> policy prefix on
/// <see cref="PermissionPolicyProvider"/>.
/// </summary>
public sealed class ScopeRequirement : IAuthorizationRequirement
{
    public string Scope { get; }

    public ScopeRequirement(string scope)
    {
        Scope = scope;
    }
}

/// <summary>
/// REQ-058 (E8-S1, AC-3): succeeds when the authenticated principal carries the required scope
/// claim (emitted by <see cref="ApiKeyAuthenticationHandler"/>). A credential lacking the scope is
/// never succeeded → 403 Forbidden, mirroring <see cref="PermissionAuthorizationHandler"/> (never
/// calls <c>context.Fail()</c> so other handlers may still pass).
/// </summary>
public sealed class ScopeAuthorizationHandler : AuthorizationHandler<ScopeRequirement>
{
    private readonly ILogger<ScopeAuthorizationHandler> _logger;

    public ScopeAuthorizationHandler(ILogger<ScopeAuthorizationHandler> logger)
    {
        _logger = logger;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ScopeRequirement requirement)
    {
        var hasScope = context.User
            .FindAll(ApiKeyDefaults.ScopeClaimType)
            .Any(c => string.Equals(c.Value, requirement.Scope, StringComparison.Ordinal));

        if (hasScope)
        {
            context.Succeed(requirement);
        }
        else
        {
            _logger.LogWarning("Scope denied: '{Scope}' is not granted to the presented credential.", requirement.Scope);
        }

        return Task.CompletedTask;
    }
}
