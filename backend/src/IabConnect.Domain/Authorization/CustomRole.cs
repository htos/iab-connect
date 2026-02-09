using IabConnect.Domain.Common;

namespace IabConnect.Domain.Authorization;

/// <summary>
/// Custom role entity that maps to one of the base Keycloak roles (REQ-003, REQ-059)
/// Custom roles are labels/aliases stored in the app DB, linked to base roles (admin, vorstand, member).
/// They inherit all permissions from the linked base role.
/// </summary>
public class CustomRole : Entity
{
    /// <summary>
    /// Display name of the custom role (e.g., "Kassier", "Event-Manager")
    /// </summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Description of what this role does
    /// </summary>
    public string? Description { get; private set; }

    /// <summary>
    /// The base Keycloak role this custom role is linked to
    /// </summary>
    public BaseRole LinkedRole { get; private set; }

    /// <summary>
    /// Whether this custom role is active
    /// </summary>
    public bool IsActive { get; private set; } = true;

    /// <summary>
    /// Display color for badges (hex, e.g., "#7C3AED")
    /// </summary>
    public string Color { get; private set; } = "#6B7280";

    /// <summary>
    /// Display order for sorting
    /// </summary>
    public int SortOrder { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }

    // EF Core constructor
    private CustomRole() { }

    /// <summary>
    /// Create a new custom role
    /// </summary>
    public static CustomRole Create(
        string name,
        BaseRole linkedRole,
        string? description = null,
        string? color = null,
        int sortOrder = 0,
        string? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Role name cannot be empty.", nameof(name));

        return new CustomRole
        {
            Name = name.Trim(),
            LinkedRole = linkedRole,
            Description = description?.Trim(),
            Color = color ?? GetDefaultColorForRole(linkedRole),
            SortOrder = sortOrder,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    /// <summary>
    /// Update the custom role
    /// </summary>
    public void Update(
        string name,
        BaseRole linkedRole,
        string? description,
        string? color,
        int sortOrder,
        bool isActive,
        string? updatedBy = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Role name cannot be empty.", nameof(name));

        Name = name.Trim();
        LinkedRole = linkedRole;
        Description = description?.Trim();
        Color = color ?? GetDefaultColorForRole(linkedRole);
        SortOrder = sortOrder;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// Deactivate this custom role
    /// </summary>
    public void Deactivate(string? updatedBy = null)
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// Activate this custom role
    /// </summary>
    public void Activate(string? updatedBy = null)
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// Get the Keycloak role name that this custom role maps to
    /// </summary>
    public string GetKeycloakRoleName() => LinkedRole switch
    {
        BaseRole.Admin => "admin",
        BaseRole.Vorstand => "vorstand",
        BaseRole.Member => "member",
        _ => "member"
    };

    private static string GetDefaultColorForRole(BaseRole role) => role switch
    {
        BaseRole.Admin => "#DC2626",    // red-600
        BaseRole.Vorstand => "#2563EB", // blue-600
        BaseRole.Member => "#6B7280",   // gray-500
        _ => "#6B7280"
    };
}

/// <summary>
/// Base roles that map to Keycloak realm roles
/// </summary>
public enum BaseRole
{
    Admin,
    Vorstand,
    Member
}
