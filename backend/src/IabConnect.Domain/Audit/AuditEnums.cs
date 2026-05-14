namespace IabConnect.Domain.Audit;

/// <summary>
/// Type of audit event (REQ-011)
/// </summary>
public enum AuditEventType
{
    // Authentication events
    LoginSuccess,
    LoginFailure,
    Logout,
    PasswordReset,
    PasswordChanged,
    AccountLocked,
    AccountUnlocked,

    // User management events
    UserCreated,
    UserUpdated,
    UserDeleted,
    UserEnabled,
    UserDisabled,
    RoleAssigned,
    RoleRemoved,

    // Member events
    MemberCreated,
    MemberUpdated,
    MemberDeleted,
    MemberStatusChanged,
    MemberTypeChanged,
    MemberMerged,

    // Finance events
    FinanceCreated,
    FinanceUpdated,
    FinanceDeleted,
    FinanceExported,
    FinanceStatusChanged,
    FinanceArchived,
    FinanceRestored,
    FinancePurged,

    // Data access events
    DataExported,
    DataViewed,

    // System events
    SettingsChanged,
    SystemError,

    // REQ-087 (E10-S3): a request was denied because its module is disabled. Maps to
    // AuditCategory.System via the `_ => System` default in AuditService.LogActionAsync.
    ModuleAccessDenied
}

/// <summary>
/// Severity level of audit event
/// </summary>
public enum AuditSeverity
{
    Info,
    Warning,
    Critical
}

/// <summary>
/// Category for grouping audit events
/// </summary>
public enum AuditCategory
{
    Authentication,
    UserManagement,
    MemberManagement,
    Finance,
    DataAccess,
    System
}
