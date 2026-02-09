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

    // Finance events
    FinanceCreated,
    FinanceUpdated,
    FinanceDeleted,
    FinanceExported,
    FinanceStatusChanged,

    // Data access events
    DataExported,
    DataViewed,

    // System events
    SettingsChanged,
    SystemError
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
