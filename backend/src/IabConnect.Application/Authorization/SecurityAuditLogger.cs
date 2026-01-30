using System.Security.Claims;
using System.Text.Json;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using Microsoft.Extensions.Logging;

namespace IabConnect.Application.Authorization;

/// <summary>
/// REQ-004 & REQ-011: Security audit logging for access control events.
/// Logs all authorization decisions, especially denials.
/// </summary>
public interface ISecurityAuditLogger
{
    /// <summary>
    /// Logs an access denied event.
    /// </summary>
    void LogAccessDenied(
        ClaimsPrincipal user,
        string resource,
        string action,
        string reason,
        string? resourceId = null,
        IDictionary<string, object>? additionalData = null);

    /// <summary>
    /// Logs an access granted event (for sensitive operations).
    /// </summary>
    void LogAccessGranted(
        ClaimsPrincipal user,
        string resource,
        string action,
        string? resourceId = null,
        IDictionary<string, object>? additionalData = null);

    /// <summary>
    /// Logs an authentication failure.
    /// </summary>
    void LogAuthenticationFailure(
        string? username,
        string reason,
        string? ipAddress = null);

    /// <summary>
    /// Logs a suspicious activity.
    /// </summary>
    void LogSuspiciousActivity(
        ClaimsPrincipal? user,
        string activity,
        string details,
        string? ipAddress = null);
}

/// <summary>
/// Implementation using Serilog structured logging and database persistence.
/// </summary>
public sealed class SecurityAuditLogger : ISecurityAuditLogger
{
    private readonly ILogger<SecurityAuditLogger> _logger;
    private readonly IAuditService _auditService;

    public SecurityAuditLogger(ILogger<SecurityAuditLogger> logger, IAuditService auditService)
    {
        _logger = logger;
        _auditService = auditService;
    }

    public void LogAccessDenied(
        ClaimsPrincipal user,
        string resource,
        string action,
        string reason,
        string? resourceId = null,
        IDictionary<string, object>? additionalData = null)
    {
        var userId = GetUserId(user);
        var username = GetUsername(user);
        var roles = GetRoles(user);

        _logger.LogWarning(
            "SECURITY_AUDIT: Access Denied | User: {UserId} ({Username}) | Roles: {Roles} | Resource: {Resource} | ResourceId: {ResourceId} | Action: {Action} | Reason: {Reason} | AdditionalData: {@AdditionalData}",
            userId,
            username,
            roles,
            resource,
            resourceId ?? "N/A",
            action,
            reason,
            additionalData);

        // Persist to database
        _ = _auditService.LogActionAsync(
            AuditEventType.DataViewed,
            $"Access Denied: {action} on {resource}",
            success: false,
            errorMessage: reason,
            entityType: resource,
            entityId: resourceId,
            details: additionalData != null ? JsonSerializer.Serialize(additionalData) : null);
    }

    public void LogAccessGranted(
        ClaimsPrincipal user,
        string resource,
        string action,
        string? resourceId = null,
        IDictionary<string, object>? additionalData = null)
    {
        var userId = GetUserId(user);
        var username = GetUsername(user);

        _logger.LogInformation(
            "SECURITY_AUDIT: Access Granted | User: {UserId} ({Username}) | Resource: {Resource} | ResourceId: {ResourceId} | Action: {Action} | AdditionalData: {@AdditionalData}",
            userId,
            username,
            resource,
            resourceId ?? "N/A",
            action,
            additionalData);

        // Persist sensitive operations to database
        var eventType = MapActionToEventType(action, resource);
        _ = _auditService.LogActionAsync(
            eventType,
            $"{action} on {resource}",
            success: true,
            entityType: resource,
            entityId: resourceId,
            details: additionalData != null ? JsonSerializer.Serialize(additionalData) : null);
    }

    public void LogAuthenticationFailure(
        string? username,
        string reason,
        string? ipAddress = null)
    {
        _logger.LogWarning(
            "SECURITY_AUDIT: Authentication Failure | Username: {Username} | Reason: {Reason} | IP: {IpAddress}",
            username ?? "Unknown",
            reason,
            ipAddress ?? "Unknown");

        // Persist to database
        _ = _auditService.LogLoginFailureAsync(username ?? "Unknown", reason);
    }

    public void LogSuspiciousActivity(
        ClaimsPrincipal? user,
        string activity,
        string details,
        string? ipAddress = null)
    {
        var userId = user != null ? GetUserId(user) : "Anonymous";
        var username = user != null ? GetUsername(user) : "Anonymous";

        _logger.LogWarning(
            "SECURITY_AUDIT: Suspicious Activity | User: {UserId} ({Username}) | Activity: {Activity} | Details: {Details} | IP: {IpAddress}",
            userId,
            username,
            activity,
            details,
            ipAddress ?? "Unknown");

        // Persist suspicious activity to database
        _ = _auditService.LogActionAsync(
            AuditEventType.SystemError,
            $"Suspicious Activity: {activity}",
            success: false,
            errorMessage: details);
    }

    private static string GetUserId(ClaimsPrincipal user)
    {
        return user.FindFirst("sub")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? "Unknown";
    }

    private static string GetUsername(ClaimsPrincipal user)
    {
        return user.FindFirst("preferred_username")?.Value
            ?? user.FindFirst(ClaimTypes.Name)?.Value
            ?? user.FindFirst("email")?.Value
            ?? "Unknown";
    }

    private static string GetRoles(ClaimsPrincipal user)
    {
        var roles = user.FindAll(ClaimTypes.Role).Select(c => c.Value);
        return string.Join(", ", roles);
    }

    private static AuditEventType MapActionToEventType(string action, string resource)
    {
        return (action.ToLowerInvariant(), resource.ToLowerInvariant()) switch
        {
            ("create", "member") => AuditEventType.MemberCreated,
            ("update", "member") => AuditEventType.MemberUpdated,
            ("delete", "member") => AuditEventType.MemberDeleted,
            ("create", "user") => AuditEventType.UserCreated,
            ("update", "user") => AuditEventType.UserUpdated,
            ("delete", "user") => AuditEventType.UserDeleted,
            ("read" or "view", _) => AuditEventType.DataViewed,
            ("export", _) => AuditEventType.DataExported,
            _ => AuditEventType.SettingsChanged
        };
    }
}
