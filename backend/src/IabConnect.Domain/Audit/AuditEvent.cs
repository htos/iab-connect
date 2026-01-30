using IabConnect.Domain.Common;

namespace IabConnect.Domain.Audit;

/// <summary>
/// Audit event entity for tracking all security and data changes (REQ-011)
/// </summary>
public class AuditEvent : Entity
{
    /// <summary>
    /// Timestamp when the event occurred (UTC)
    /// </summary>
    public DateTime Timestamp { get; private set; }

    /// <summary>
    /// Type of audit event
    /// </summary>
    public AuditEventType EventType { get; private set; }

    /// <summary>
    /// Category for filtering/grouping
    /// </summary>
    public AuditCategory Category { get; private set; }

    /// <summary>
    /// Severity level
    /// </summary>
    public AuditSeverity Severity { get; private set; }

    /// <summary>
    /// User ID who performed the action (null for system events)
    /// </summary>
    public string? UserId { get; private set; }

    /// <summary>
    /// Username/Email for display (captured at event time)
    /// </summary>
    public string? UserName { get; private set; }

    /// <summary>
    /// IP address of the client (if available)
    /// </summary>
    public string? IpAddress { get; private set; }

    /// <summary>
    /// User agent / browser info (if available)
    /// </summary>
    public string? UserAgent { get; private set; }

    /// <summary>
    /// Type of entity affected (e.g., "Member", "User")
    /// </summary>
    public string? EntityType { get; private set; }

    /// <summary>
    /// ID of the entity affected
    /// </summary>
    public string? EntityId { get; private set; }

    /// <summary>
    /// Human-readable description of the action
    /// </summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>
    /// Additional details as JSON (old/new values, etc.)
    /// </summary>
    public string? Details { get; private set; }

    /// <summary>
    /// Whether the action was successful
    /// </summary>
    public bool Success { get; private set; }

    /// <summary>
    /// Error message if action failed
    /// </summary>
    public string? ErrorMessage { get; private set; }

    // EF Core constructor
    private AuditEvent() { }

    private AuditEvent(
        AuditEventType eventType,
        AuditCategory category,
        AuditSeverity severity,
        string action,
        string? userId,
        string? userName,
        string? entityType,
        string? entityId,
        string? details,
        string? ipAddress,
        string? userAgent,
        bool success,
        string? errorMessage)
    {
        Timestamp = DateTime.UtcNow;
        EventType = eventType;
        Category = category;
        Severity = severity;
        Action = action;
        UserId = userId;
        UserName = userName;
        EntityType = entityType;
        EntityId = entityId;
        Details = details;
        IpAddress = ipAddress;
        UserAgent = userAgent;
        Success = success;
        ErrorMessage = errorMessage;
    }

    /// <summary>
    /// Create a new audit event
    /// </summary>
    public static AuditEvent Create(
        AuditEventType eventType,
        AuditCategory category,
        string action,
        string? userId = null,
        string? userName = null,
        string? entityType = null,
        string? entityId = null,
        string? details = null,
        string? ipAddress = null,
        string? userAgent = null,
        AuditSeverity severity = AuditSeverity.Info,
        bool success = true,
        string? errorMessage = null)
    {
        return new AuditEvent(
            eventType,
            category,
            severity,
            action,
            userId,
            userName,
            entityType,
            entityId,
            details,
            ipAddress,
            userAgent,
            success,
            errorMessage);
    }

    /// <summary>
    /// Create a login success event
    /// </summary>
    public static AuditEvent LoginSuccess(string userId, string userName, string? ipAddress = null, string? userAgent = null)
    {
        return Create(
            AuditEventType.LoginSuccess,
            AuditCategory.Authentication,
            $"User {userName} logged in successfully",
            userId,
            userName,
            ipAddress: ipAddress,
            userAgent: userAgent);
    }

    /// <summary>
    /// Create a login failure event
    /// </summary>
    public static AuditEvent LoginFailure(string? userName, string reason, string? ipAddress = null, string? userAgent = null)
    {
        return Create(
            AuditEventType.LoginFailure,
            AuditCategory.Authentication,
            $"Login failed for {userName ?? "unknown user"}: {reason}",
            userName: userName,
            ipAddress: ipAddress,
            userAgent: userAgent,
            severity: AuditSeverity.Warning,
            success: false,
            errorMessage: reason);
    }

    /// <summary>
    /// Create a member created event
    /// </summary>
    public static AuditEvent MemberCreated(string memberId, string memberName, string userId, string userName, string? details = null)
    {
        return Create(
            AuditEventType.MemberCreated,
            AuditCategory.MemberManagement,
            $"Member '{memberName}' was created",
            userId,
            userName,
            "Member",
            memberId,
            details);
    }

    /// <summary>
    /// Create a member updated event
    /// </summary>
    public static AuditEvent MemberUpdated(string memberId, string memberName, string userId, string userName, string? changes = null)
    {
        return Create(
            AuditEventType.MemberUpdated,
            AuditCategory.MemberManagement,
            $"Member '{memberName}' was updated",
            userId,
            userName,
            "Member",
            memberId,
            changes);
    }

    /// <summary>
    /// Create a data export event
    /// </summary>
    public static AuditEvent DataExported(string exportType, string userId, string userName, int recordCount)
    {
        return Create(
            AuditEventType.DataExported,
            AuditCategory.DataAccess,
            $"Exported {recordCount} {exportType} records",
            userId,
            userName,
            exportType,
            details: $"{{\"recordCount\": {recordCount}}}");
    }

    /// <summary>
    /// Anonymize user data in this audit event (for GDPR deletion)
    /// Keeps the event for compliance but removes personal identifiers
    /// </summary>
    public void AnonymizeUser(string anonymizedValue = "anonymized")
    {
        UserId = anonymizedValue;
        UserName = anonymizedValue;
        IpAddress = null;
        UserAgent = null;
    }
}
