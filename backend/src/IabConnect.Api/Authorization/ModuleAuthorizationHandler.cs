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

        // Round-2 [Review][Patch] (DN-3): IsEnabledAsync can throw on a transient cache/DB
        // failure. Without this guard the exception propagates → ASP.NET 500, inconsistent
        // with the public ModuleEnabledEndpointFilter (round-1 patch made it fail-open).
        // Resolution: fail-GRACEFUL 403 — log the infra failure as Error, audit with a
        // distinguishing errorMessage so ops can tell "module disabled" vs "module check
        // crashed", and leave the requirement not-succeeded so the caller gets a clean 403
        // instead of a 500. Asymmetric to the public filter (which fails-open) is intentional:
        // for authenticated callers, fail-CLOSED is the safer default — they will retry with
        // a clear 403 once infra recovers.
        bool enabled;
        try
        {
            enabled = await _moduleSettings.IsEnabledAsync(requirement.ModuleKey, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Module check failed for '{ModuleKey}' — failing closed (request will be denied with a clean 403). "
                + "Cause is likely a transient cache/DB infrastructure failure.",
                requirement.ModuleKey);

            try
            {
                await _auditService.LogActionAsync(
                    AuditEventType.ModuleAccessDenied,
                    $"Access denied: module check failed for '{requirement.ModuleKey}' (infrastructure failure)",
                    success: false,
                    errorMessage: $"Module check for '{requirement.ModuleKey}' threw {ex.GetType().Name}: {ex.Message}",
                    entityType: "Module",
                    entityId: requirement.ModuleKey,
                    ct: cancellationToken);
            }
            catch (Exception auditEx)
            {
                _logger.LogError(
                    auditEx,
                    "Failed to write the infra-failure ModuleAccessDenied audit event for module '{ModuleKey}'.",
                    requirement.ModuleKey);
            }
            return;
        }

        if (enabled)
        {
            context.Succeed(requirement);
            return;
        }

        // Disabled → do NOT succeed (and never call context.Fail(), mirroring
        // PermissionAuthorizationHandler — that lets other handlers still pass). A
        // requirement that is never succeeded yields 403 Forbidden by default.
        _logger.LogWarning(
            "Module access denied: module '{ModuleKey}' is disabled", requirement.ModuleKey);

        // REQ-087 (E10-S3 review patch): the audit write must never mask the authorization
        // outcome. If LogActionAsync throws, the unguarded call would surface as a 500 —
        // replacing the clean 403 and losing the denial entirely. Guard it: a logging failure
        // is itself logged and swallowed; the not-succeeded requirement (→ 403) still stands.
        try
        {
            await _auditService.LogActionAsync(
                AuditEventType.ModuleAccessDenied,
                $"Access denied: module '{requirement.ModuleKey}' is disabled",
                success: false,
                errorMessage: $"Module '{requirement.ModuleKey}' is disabled",
                entityType: "Module",
                entityId: requirement.ModuleKey,
                ct: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to write the ModuleAccessDenied audit event for module '{ModuleKey}'. "
                + "The 403 denial still stands; only the audit record was lost.",
                requirement.ModuleKey);
        }
    }
}
