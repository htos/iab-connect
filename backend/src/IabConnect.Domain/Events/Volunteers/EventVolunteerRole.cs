using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Named volunteer role within an event (e.g. "Cash desk", "Greeter").
/// Roles are reusable across multiple <see cref="EventVolunteerShift"/>s within the same event.
/// Roles can be deactivated rather than deleted; deletion is blocked by the
/// <c>event_volunteer_shifts.role_id → event_volunteer_roles.id</c> RESTRICT FK
/// when the role has active shifts (see migration A9 rationale).
/// </summary>
public sealed class EventVolunteerRole : Entity
{
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 500;

    public Guid EventId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private EventVolunteerRole() { }

    public static EventVolunteerRole Create(Guid eventId, string name, string? description, Guid createdBy)
    {
        if (eventId == Guid.Empty)
            throw new ArgumentException("EventId is required", nameof(eventId));
        if (createdBy == Guid.Empty)
            throw new ArgumentException("CreatedBy is required", nameof(createdBy));
        var trimmedName = (name ?? throw new ArgumentNullException(nameof(name))).Trim();
        if (string.IsNullOrEmpty(trimmedName))
            throw new ArgumentException("Name is required", nameof(name));
        if (trimmedName.Length > NameMaxLength)
            throw new ArgumentException($"Name cannot exceed {NameMaxLength} characters", nameof(name));
        var trimmedDescription = description?.Trim();
        if (trimmedDescription is { Length: > DescriptionMaxLength })
            throw new ArgumentException($"Description cannot exceed {DescriptionMaxLength} characters", nameof(description));

        return new EventVolunteerRole
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Name = trimmedName,
            Description = string.IsNullOrEmpty(trimmedDescription) ? null : trimmedDescription,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void Rename(string name)
    {
        var trimmed = (name ?? throw new ArgumentNullException(nameof(name))).Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new ArgumentException("Name is required", nameof(name));
        if (trimmed.Length > NameMaxLength)
            throw new ArgumentException($"Name cannot exceed {NameMaxLength} characters", nameof(name));
        Name = trimmed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDescription(string? description)
    {
        var trimmed = description?.Trim();
        if (trimmed is { Length: > DescriptionMaxLength })
            throw new ArgumentException($"Description cannot exceed {DescriptionMaxLength} characters", nameof(description));
        Description = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        if (IsActive) return;
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (!IsActive) return;
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
