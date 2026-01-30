namespace IabConnect.Domain.Audit;

/// <summary>
/// Repository interface for audit events (REQ-011)
/// </summary>
public interface IAuditEventRepository
{
    /// <summary>
    /// Add a new audit event
    /// </summary>
    Task AddAsync(AuditEvent auditEvent, CancellationToken ct = default);

    /// <summary>
    /// Get audit events with filtering and pagination
    /// </summary>
    Task<(IReadOnlyList<AuditEvent> Items, int TotalCount)> GetAsync(
        AuditEventFilter filter,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default);

    /// <summary>
    /// Get audit events for a specific entity
    /// </summary>
    Task<IReadOnlyList<AuditEvent>> GetByEntityAsync(
        string entityType,
        string entityId,
        CancellationToken ct = default);

    /// <summary>
    /// Get audit events for a specific user
    /// </summary>
    Task<IReadOnlyList<AuditEvent>> GetByUserAsync(
        string userId,
        int limit = 100,
        CancellationToken ct = default);
}

/// <summary>
/// Filter criteria for audit events
/// </summary>
public class AuditEventFilter
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public AuditEventType? EventType { get; set; }
    public AuditCategory? Category { get; set; }
    public AuditSeverity? Severity { get; set; }
    public string? UserId { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public bool? Success { get; set; }
    public string? SearchTerm { get; set; }
}
