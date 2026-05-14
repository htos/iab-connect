using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using Microsoft.AspNetCore.Authorization;

namespace IabConnect.Api.Authorization;

/// <summary>
/// REQ-087 (E10-S3): authorization requirement that gates a route group behind an
/// admin-configurable module. Holds the module key — one of the <c>ModuleKeys</c>
/// constants. Mirrors <see cref="PermissionRequirement"/>.
/// </summary>
public sealed class ModuleRequirement : IAuthorizationRequirement
{
    public string ModuleKey { get; }

    public ModuleRequirement(string moduleKey)
    {
        ModuleKey = moduleKey;
    }
}

/// <summary>
/// REQ-087 (E10-S3): backend module enforcement — ADR-008 layer 1, the only real
/// security control (the route guard and hidden navigation are UX convenience only).
/// Resolves the cached <see cref="IModuleSettingsService"/>; when the requirement's
/// module is disabled the handler does not succeed (→ 403 Forbidden) and writes a
/// <see cref="AuditEventType.ModuleAccessDenied"/> security audit event (ADR-003).
/// </summary>
/// <remarks>
/// Unlike <see cref="PermissionAuthorizationHandler"/> — a Singleton that resolves nothing
/// scoped — this handler depends on the scoped <see cref="IModuleSettingsService"/> and
/// <see cref="IAuditService"/>, so it is registered Scoped and its
/// <see cref="HandleRequirementAsync"/> is genuinely async.
/// </remarks>
public sealed class ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>
{
    private readonly IModuleSettingsService _moduleSettings;
    private readonly IAuditService _auditService;
    private readonly ILogger<ModuleAuthorizationHandler> _logger;

    public ModuleAuthorizationHandler(
        IModuleSettingsService moduleSettings,
        IAuditService auditService,
        ILogger<ModuleAuthorizationHandler> logger)
    {
        _moduleSettings = moduleSettings;
        _auditService = auditService;
        _logger = logger;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ModuleRequirement requirement)
    {
        // Under endpoint routing the authorization pipeline supplies HttpContext as the
        // resource; use its RequestAborted token so a cancelled request stops the cache read.
        var cancellationToken = context.Resource is HttpContext httpContext
            ? httpContext.RequestAborted
            : CancellationToken.None;

        if (await _moduleSettings.IsEnabledAsync(requirement.ModuleKey, cancellationToken))
        {
            context.Succeed(requirement);
            return;
        }

        // Disabled → do NOT succeed (and never call context.Fail(), mirroring
        // PermissionAuthorizationHandler — that lets other handlers still pass). A
        // requirement that is never succeeded yields 403 Forbidden by default.
        _logger.LogWarning(
            "Module access denied: module '{ModuleKey}' is disabled", requirement.ModuleKey);

        await _auditService.LogActionAsync(
            AuditEventType.ModuleAccessDenied,
            $"Access denied: module '{requirement.ModuleKey}' is disabled",
            success: false,
            errorMessage: $"Module '{requirement.ModuleKey}' is disabled",
            entityType: "Module",
            entityId: requirement.ModuleKey,
            ct: cancellationToken);
    }
}
