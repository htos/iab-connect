using IabConnect.Domain.Events.Volunteers;

namespace IabConnect.Application.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): API-facing projection of <see cref="EventVolunteerRole"/>.
/// </summary>
public sealed record EventVolunteerRoleDto(
    Guid Id,
    Guid EventId,
    string Name,
    string? Description,
    bool IsActive,
    DateTime CreatedAt)
{
    public static EventVolunteerRoleDto FromEntity(EventVolunteerRole role) =>
        new(role.Id, role.EventId, role.Name, role.Description, role.IsActive, role.CreatedAt);
}
