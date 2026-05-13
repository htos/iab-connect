namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Repository for <see cref="EventVolunteerShift"/>.
/// </summary>
public interface IEventVolunteerShiftRepository
{
    Task AddAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default);
    Task UpdateAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default);
    Task<EventVolunteerShift?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventVolunteerShift>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventVolunteerShift>> GetByRoleIdAsync(Guid roleId, CancellationToken cancellationToken = default);
}
