using IabConnect.Domain.Audit;

namespace IabConnect.Application.Audit;

/// <summary>
/// Service interface for audit logging (REQ-011)
/// </summary>
public interface IAuditService
{
    /// <summary>
    /// Log an audit event
    /// </summary>
    Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default);

    /// <summary>
    /// Log a login success
    /// </summary>
    Task LogLoginSuccessAsync(string userId, string userName, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default);

    /// <summary>
    /// Log a login failure
    /// </summary>
    Task LogLoginFailureAsync(string? userName, string reason, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default);

    /// <summary>
    /// Log a member creation
    /// </summary>
    Task LogMemberCreatedAsync(string memberId, string memberName, string userId, string userName, string? details = null, CancellationToken ct = default);

    /// <summary>
    /// Log a member update
    /// </summary>
    Task LogMemberUpdatedAsync(string memberId, string memberName, string userId, string userName, string? changes = null, CancellationToken ct = default);

    /// <summary>
    /// Log a member deletion
    /// </summary>
    Task LogMemberDeletedAsync(string memberId, string memberName, string userId, string userName, CancellationToken ct = default);

    /// <summary>
    /// Log a user management action
    /// </summary>
    Task LogUserActionAsync(AuditEventType eventType, string targetUserId, string targetUserName, string actorId, string actorName, string? details = null, CancellationToken ct = default);

    /// <summary>
    /// Log a data export
    /// </summary>
    Task LogDataExportAsync(string exportType, string userId, string userName, int recordCount, CancellationToken ct = default);

    /// <summary>
    /// Log a generic action
    /// </summary>
    Task LogActionAsync(
        AuditEventType eventType,
        string action,
        bool success = true,
        string? errorMessage = null,
        string? entityType = null,
        string? entityId = null,
        string? details = null,
        CancellationToken ct = default);
}
