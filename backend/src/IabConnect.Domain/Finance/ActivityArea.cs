using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-068: Admin-manageable activity area / project / division tag.
/// Used for internal and tax reporting on transactions and invoice items.
/// </summary>
public class ActivityArea : Entity, ISoftDeletable
{
    public string Name { get; private set; } = string.Empty;
    public string Code { get; private set; } = string.Empty;  // Short code, e.g., "EVT", "MBR", "ADM"
    public string? Description { get; private set; }
    public string? Color { get; private set; }  // Hex color for UI display
    public bool IsActive { get; private set; } = true;
    public int SortOrder { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private ActivityArea() { }

    public static ActivityArea Create(string name, string code, string? description, string? color, int sortOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code is required.", nameof(code));

        var now = DateTimeOffset.UtcNow;
        return new ActivityArea
        {
            Name = name.Trim(),
            Code = code.Trim().ToUpperInvariant(),
            Description = description?.Trim(),
            Color = color?.Trim(),
            SortOrder = sortOrder,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Update(string name, string code, string? description, string? color, int sortOrder, bool isActive)
    {
        Name = name.Trim();
        Code = code.Trim().ToUpperInvariant();
        Description = description?.Trim();
        Color = color?.Trim();
        SortOrder = sortOrder;
        IsActive = isActive;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SoftDelete(string? deletedBy = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
