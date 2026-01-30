namespace IabConnect.Domain.Authorization;

/// <summary>
/// REQ-004: Feingranulare Zugriffskontrolle
/// Defines all permissions in the system for CRUD operations on resources.
/// </summary>
public static class Permission
{
    // Member permissions
    public const string MemberRead = "member:read";
    public const string MemberReadOwn = "member:read:own";
    public const string MemberCreate = "member:create";
    public const string MemberUpdate = "member:update";
    public const string MemberUpdateOwn = "member:update:own";
    public const string MemberDelete = "member:delete";
    public const string MemberStatusChange = "member:status:change";

    // User management permissions
    public const string UserRead = "user:read";
    public const string UserCreate = "user:create";
    public const string UserUpdate = "user:update";
    public const string UserDelete = "user:delete";
    public const string UserRoleAssign = "user:role:assign";

    // Event permissions (for future use)
    public const string EventRead = "event:read";
    public const string EventReadOwn = "event:read:own";
    public const string EventCreate = "event:create";
    public const string EventUpdate = "event:update";
    public const string EventUpdateOwn = "event:update:own";
    public const string EventDelete = "event:delete";
    public const string EventDeleteOwn = "event:delete:own";
    public const string EventPublish = "event:publish";

    // Document permissions (for future use)
    public const string DocumentRead = "document:read";
    public const string DocumentReadOwn = "document:read:own";
    public const string DocumentCreate = "document:create";
    public const string DocumentUpdate = "document:update";
    public const string DocumentUpdateOwn = "document:update:own";
    public const string DocumentDelete = "document:delete";
    public const string DocumentDeleteOwn = "document:delete:own";
    public const string DocumentApprove = "document:approve";

    // Finance permissions (for future use)
    public const string FinanceRead = "finance:read";
    public const string FinanceCreate = "finance:create";
    public const string FinanceUpdate = "finance:update";
    public const string FinanceDelete = "finance:delete";
    public const string FinanceExport = "finance:export";

    // Audit log permissions
    public const string AuditRead = "audit:read";
    public const string AuditExport = "audit:export";

    // System/Admin permissions
    public const string SystemSettings = "system:settings";
}

/// <summary>
/// Maps roles to their allowed permissions.
/// REQ-004: Rechte pro CRUD-Aktion
/// </summary>
public static class RolePermissions
{
    private static readonly Dictionary<string, HashSet<string>> _rolePermissions = new()
    {
        ["admin"] = new HashSet<string>
        {
            // Admin has all permissions
            Permission.MemberRead,
            Permission.MemberReadOwn,
            Permission.MemberCreate,
            Permission.MemberUpdate,
            Permission.MemberUpdateOwn,
            Permission.MemberDelete,
            Permission.MemberStatusChange,

            Permission.UserRead,
            Permission.UserCreate,
            Permission.UserUpdate,
            Permission.UserDelete,
            Permission.UserRoleAssign,

            Permission.EventRead,
            Permission.EventReadOwn,
            Permission.EventCreate,
            Permission.EventUpdate,
            Permission.EventUpdateOwn,
            Permission.EventDelete,
            Permission.EventDeleteOwn,
            Permission.EventPublish,

            Permission.DocumentRead,
            Permission.DocumentReadOwn,
            Permission.DocumentCreate,
            Permission.DocumentUpdate,
            Permission.DocumentUpdateOwn,
            Permission.DocumentDelete,
            Permission.DocumentDeleteOwn,
            Permission.DocumentApprove,

            Permission.FinanceRead,
            Permission.FinanceCreate,
            Permission.FinanceUpdate,
            Permission.FinanceDelete,
            Permission.FinanceExport,

            Permission.AuditRead,
            Permission.AuditExport,

            Permission.SystemSettings
        },

        ["vorstand"] = new HashSet<string>
        {
            // Vorstand can manage members and events, read finances
            Permission.MemberRead,
            Permission.MemberReadOwn,
            Permission.MemberCreate,
            Permission.MemberUpdate,
            Permission.MemberUpdateOwn,
            Permission.MemberStatusChange,

            Permission.EventRead,
            Permission.EventReadOwn,
            Permission.EventCreate,
            Permission.EventUpdate,
            Permission.EventUpdateOwn,
            Permission.EventDelete,
            Permission.EventDeleteOwn,
            Permission.EventPublish,

            Permission.DocumentRead,
            Permission.DocumentReadOwn,
            Permission.DocumentCreate,
            Permission.DocumentUpdate,
            Permission.DocumentUpdateOwn,
            Permission.DocumentApprove,

            Permission.FinanceRead,
            Permission.AuditRead
        },

        ["kassier"] = new HashSet<string>
        {
            // Kassier has finance permissions
            Permission.MemberRead,
            Permission.MemberReadOwn,
            Permission.MemberUpdateOwn,

            Permission.FinanceRead,
            Permission.FinanceCreate,
            Permission.FinanceUpdate,
            Permission.FinanceDelete,
            Permission.FinanceExport,

            Permission.DocumentRead,
            Permission.DocumentReadOwn,
            Permission.DocumentCreate,
            Permission.DocumentUpdateOwn,

            Permission.AuditRead
        },

        ["event-manager"] = new HashSet<string>
        {
            // Event manager can manage events
            Permission.MemberRead,
            Permission.MemberReadOwn,
            Permission.MemberUpdateOwn,

            Permission.EventRead,
            Permission.EventReadOwn,
            Permission.EventCreate,
            Permission.EventUpdate,
            Permission.EventUpdateOwn,
            Permission.EventDelete,
            Permission.EventDeleteOwn,

            Permission.DocumentRead,
            Permission.DocumentReadOwn,
            Permission.DocumentCreate,
            Permission.DocumentUpdateOwn
        },

        ["member"] = new HashSet<string>
        {
            // Regular member can only access own data
            Permission.MemberReadOwn,
            Permission.MemberUpdateOwn,

            Permission.EventRead,
            Permission.EventReadOwn,

            Permission.DocumentRead,
            Permission.DocumentReadOwn
        }
    };

    /// <summary>
    /// Gets all permissions for a given role.
    /// </summary>
    public static HashSet<string> GetPermissionsForRole(string role)
    {
        return _rolePermissions.TryGetValue(role.ToLowerInvariant(), out var permissions)
            ? permissions
            : new HashSet<string>();
    }

    /// <summary>
    /// Gets all permissions for multiple roles (union).
    /// </summary>
    public static HashSet<string> GetPermissionsForRoles(IEnumerable<string> roles)
    {
        var allPermissions = new HashSet<string>();
        foreach (var role in roles)
        {
            allPermissions.UnionWith(GetPermissionsForRole(role));
        }
        return allPermissions;
    }

    /// <summary>
    /// Checks if any of the given roles has the specified permission.
    /// </summary>
    public static bool HasPermission(IEnumerable<string> roles, string permission)
    {
        return GetPermissionsForRoles(roles).Contains(permission);
    }
}
