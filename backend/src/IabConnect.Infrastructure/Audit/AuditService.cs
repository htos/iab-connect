using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Audit;

/// <summary>
/// Implementation of audit service (REQ-011)
/// </summary>
public class AuditService : IAuditService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditService> _logger;

    public AuditService(
        IServiceScopeFactory scopeFactory,
        IHttpContextAccessor httpContextAccessor,
        ILogger<AuditService> logger)
    {
        _scopeFactory = scopeFactory;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default)
    {
        try
        {
            // Audit writes must be independent of the request's DbContext. Several callers
            // (notably SecurityAuditLogger) fire audit persistence as detached background
            // tasks (`_ = LogActionAsync(...)`); reusing the request-scoped DbContext there
            // races with — and can outlive — the request, surfacing as ObjectDisposedException
            // or Npgsql "BindComplete while expecting ReadyForQueryMessage" and corrupting the
            // shared connection. Persisting on a dedicated short-lived scope isolates the write.
            using var scope = _scopeFactory.CreateScope();
            var repository = scope.ServiceProvider.GetRequiredService<IAuditEventRepository>();
            await repository.AddAsync(auditEvent, ct);
        }
        catch (Exception ex)
        {
            // Never fail the main operation because of audit logging
            _logger.LogError(ex, "Failed to log audit event: {EventType} - {Action}",
                auditEvent.EventType, auditEvent.Action);
        }
    }

    public async Task LogLoginSuccessAsync(string userId, string userName, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default)
    {
        var ip = ipAddress ?? GetClientIpAddress();
        var ua = userAgent ?? GetUserAgent();

        var auditEvent = AuditEvent.LoginSuccess(userId, userName, ip, ua);
        await LogAsync(auditEvent, ct);
    }

    public async Task LogLoginFailureAsync(string? userName, string reason, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default)
    {
        var ip = ipAddress ?? GetClientIpAddress();
        var ua = userAgent ?? GetUserAgent();

        var auditEvent = AuditEvent.LoginFailure(userName, reason, ip, ua);
        await LogAsync(auditEvent, ct);
    }

    public async Task LogMemberCreatedAsync(string memberId, string memberName, string userId, string userName, string? details = null, CancellationToken ct = default)
    {
        var auditEvent = AuditEvent.MemberCreated(memberId, memberName, userId, userName, details);
        await LogAsync(auditEvent, ct);
    }

    public async Task LogMemberUpdatedAsync(string memberId, string memberName, string userId, string userName, string? changes = null, CancellationToken ct = default)
    {
        var auditEvent = AuditEvent.MemberUpdated(memberId, memberName, userId, userName, changes);
        await LogAsync(auditEvent, ct);
    }

    public async Task LogMemberDeletedAsync(string memberId, string memberName, string userId, string userName, CancellationToken ct = default)
    {
        var auditEvent = AuditEvent.Create(
            AuditEventType.MemberDeleted,
            AuditCategory.MemberManagement,
            $"Member '{memberName}' was deleted",
            userId,
            userName,
            "Member",
            memberId,
            severity: AuditSeverity.Warning);

        await LogAsync(auditEvent, ct);
    }

    public async Task LogUserActionAsync(AuditEventType eventType, string targetUserId, string targetUserName, string actorId, string actorName, string? details = null, CancellationToken ct = default)
    {
        var action = eventType switch
        {
            AuditEventType.UserCreated => $"User '{targetUserName}' was created by {actorName}",
            AuditEventType.UserUpdated => $"User '{targetUserName}' was updated by {actorName}",
            AuditEventType.UserDeleted => $"User '{targetUserName}' was deleted by {actorName}",
            AuditEventType.UserEnabled => $"User '{targetUserName}' was enabled by {actorName}",
            AuditEventType.UserDisabled => $"User '{targetUserName}' was disabled by {actorName}",
            AuditEventType.RoleAssigned => $"Role assigned to '{targetUserName}' by {actorName}",
            AuditEventType.RoleRemoved => $"Role removed from '{targetUserName}' by {actorName}",
            AuditEventType.PasswordReset => $"Password reset sent for '{targetUserName}' by {actorName}",
            _ => $"Action {eventType} on user '{targetUserName}' by {actorName}"
        };

        var severity = eventType switch
        {
            AuditEventType.UserDeleted => AuditSeverity.Warning,
            AuditEventType.UserDisabled => AuditSeverity.Warning,
            AuditEventType.RoleAssigned when details?.Contains("admin") == true => AuditSeverity.Warning,
            _ => AuditSeverity.Info
        };

        var auditEvent = AuditEvent.Create(
            eventType,
            AuditCategory.UserManagement,
            action,
            actorId,
            actorName,
            "User",
            targetUserId,
            details,
            GetClientIpAddress(),
            GetUserAgent(),
            severity);

        await LogAsync(auditEvent, ct);
    }

    public async Task LogDataExportAsync(string exportType, string userId, string userName, int recordCount, CancellationToken ct = default)
    {
        var auditEvent = AuditEvent.DataExported(exportType, userId, userName, recordCount);
        await LogAsync(auditEvent, ct);
    }

    public async Task LogActionAsync(
        AuditEventType eventType,
        string action,
        bool success = true,
        string? errorMessage = null,
        string? entityType = null,
        string? entityId = null,
        string? details = null,
        CancellationToken ct = default)
    {
        // Determine category from event type
        var category = eventType switch
        {
            AuditEventType.LoginSuccess or AuditEventType.LoginFailure or AuditEventType.Logout or
            AuditEventType.PasswordReset or AuditEventType.PasswordChanged or
            AuditEventType.AccountLocked or AuditEventType.AccountUnlocked
                => AuditCategory.Authentication,

            AuditEventType.UserCreated or AuditEventType.UserUpdated or AuditEventType.UserDeleted or
            AuditEventType.UserEnabled or AuditEventType.UserDisabled or
            AuditEventType.RoleAssigned or AuditEventType.RoleRemoved
                => AuditCategory.UserManagement,

            AuditEventType.MemberCreated or AuditEventType.MemberUpdated or AuditEventType.MemberDeleted or
            AuditEventType.MemberStatusChanged or AuditEventType.MemberTypeChanged
                => AuditCategory.MemberManagement,

            AuditEventType.FinanceCreated or AuditEventType.FinanceUpdated or
            AuditEventType.FinanceDeleted or AuditEventType.FinanceExported or
            AuditEventType.FinanceStatusChanged
                => AuditCategory.Finance,

            AuditEventType.DataExported or AuditEventType.DataViewed
                => AuditCategory.DataAccess,

            _ => AuditCategory.System
        };

        // Determine severity
        var severity = !success ? AuditSeverity.Warning : AuditSeverity.Info;

        // Get current user from HttpContext if available
        var httpContext = _httpContextAccessor.HttpContext;
        var userId = httpContext?.User.FindFirst("sub")?.Value;
        var userName = httpContext?.User.FindFirst("preferred_username")?.Value
            ?? httpContext?.User.Identity?.Name;

        var auditEvent = AuditEvent.Create(
            eventType,
            category,
            action,
            userId,
            userName,
            entityType,
            entityId,
            details,
            GetClientIpAddress(),
            GetUserAgent(),
            severity,
            success,
            errorMessage);

        await LogAsync(auditEvent, ct);
    }

    private string? GetClientIpAddress()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null) return null;

        // Check for forwarded header (behind proxy/load balancer)
        var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            return forwardedFor.Split(',')[0].Trim();
        }

        return httpContext.Connection.RemoteIpAddress?.ToString();
    }

    private string? GetUserAgent()
    {
        return _httpContextAccessor.HttpContext?.Request.Headers["User-Agent"].FirstOrDefault();
    }
}
