using IabConnect.Domain.Authorization;
using IabConnect.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace IabConnect.Api.Authorization;

/// <summary>
/// REQ-004: Custom authorization requirement for permission-based access control.
/// </summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }
}

/// <summary>
/// Handler for permission-based authorization.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly ILogger<PermissionAuthorizationHandler> _logger;

    public PermissionAuthorizationHandler(ILogger<PermissionAuthorizationHandler> logger)
    {
        _logger = logger;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var roles = context.User.FindAll(System.Security.Claims.ClaimTypes.Role)
            .Select(c => c.Value)
            .ToList();

        if (RolePermissions.HasPermission(roles, requirement.Permission))
        {
            context.Succeed(requirement);
            _logger.LogDebug(
                "Permission granted: {Permission} for user with roles: {Roles}",
                requirement.Permission,
                string.Join(", ", roles));
        }
        else
        {
            _logger.LogWarning(
                "Permission denied: {Permission} for user with roles: {Roles}",
                requirement.Permission,
                string.Join(", ", roles));
        }

        return Task.CompletedTask;
    }
}

/// <summary>
/// Authorization policy provider that creates policies dynamically based on permission names.
/// REQ-087 (E10-S3): also recognizes the <c>Module:</c> prefix so route groups can declare
/// <c>.RequireAuthorization("Module:&lt;key&gt;")</c> exactly like <c>Permission:</c>. There
/// can only be one registered <see cref="IAuthorizationPolicyProvider"/>, so this single
/// provider is extended rather than adding a second one.
/// </summary>
public sealed class PermissionPolicyProvider : IAuthorizationPolicyProvider
{
    private const string PermissionPolicyPrefix = "Permission:";
    private const string ModulePolicyPrefix = "Module:";
    private readonly DefaultAuthorizationPolicyProvider _fallbackPolicyProvider;

    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallbackPolicyProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(PermissionPolicyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var permission = policyName[PermissionPolicyPrefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(permission))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        // REQ-087 (E10-S3): "Module:<key>" → a policy carrying a single ModuleRequirement,
        // resolved at request time by ModuleAuthorizationHandler against the module-settings
        // service.
        //
        // Round-2 [Review][Patch] (DN-2 + P-1): the prefix match is case-insensitive, so we
        // lowercase the suffix before building the requirement — `Module:Finance` and
        // `module:finance` both resolve to the canonical `"finance"` key that
        // IsEnabledAsync stores. We also fail-FAST on unknown suffixes (`Module:financ`,
        // `Module:` with empty suffix, anything not in ModuleKeys.All) — the runtime
        // warn-log in IsEnabledAsync stays as defense-in-depth, but a typo in a
        // `RequireAuthorization("Module:...")` declaration now surfaces immediately on
        // first request to the misconfigured endpoint instead of silently failing-open.
        if (policyName.StartsWith(ModulePolicyPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var rawSuffix = policyName[ModulePolicyPrefix.Length..];
            var moduleKey = rawSuffix.ToLowerInvariant();
            if (!ModuleKeys.All.Contains(moduleKey))
            {
                throw new InvalidOperationException(
                    $"Unknown module key '{rawSuffix}' in authorization policy '{policyName}'. "
                    + $"Module keys are case-insensitive and must be one of: {string.Join(", ", ModuleKeys.All)}. "
                    + "Check the RequireAuthorization(\"Module:...\") declaration on the endpoint group.");
            }
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new ModuleRequirement(moduleKey))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallbackPolicyProvider.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync()
    {
        return _fallbackPolicyProvider.GetDefaultPolicyAsync();
    }

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync()
    {
        return _fallbackPolicyProvider.GetFallbackPolicyAsync();
    }
}
