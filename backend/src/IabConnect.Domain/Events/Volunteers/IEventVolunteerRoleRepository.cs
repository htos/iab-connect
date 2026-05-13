namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): Repository for <see cref="EventVolunteerRole"/>.
/// </summary>
public interface IEventVolunteerRoleRepository
{
    /// <summary>
    /// Inserts a new role. Post-review M-S3-1: when the DB-level <c>ix_event_volunteer_roles_event_name_lower</c>
    /// unique index fires (concurrent create losing the race), implementations MUST translate the
    /// EF/Npgsql unique-violation into <see cref="VolunteerRoleNameConflictException"/> so the
    /// Application layer stays free of EF imports while still surfacing a 409 to the API.
    /// </summary>
    Task AddAsync(EventVolunteerRole role, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a role. Post-review M-S3-7: same 23505 → <see cref="VolunteerRoleNameConflictException"/>
    /// translation as <see cref="AddAsync"/>, so rename collisions surface as 409 not 500.
    /// </summary>
    Task UpdateAsync(EventVolunteerRole role, CancellationToken cancellationToken = default);

    Task<EventVolunteerRole?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<EventVolunteerRole>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Case-folded name lookup used by the unique-per-event constraint at the application layer.
    /// Mirrors the database-level <c>unique(event_id, lower(name))</c> index.
    /// </summary>
    Task<EventVolunteerRole?> GetByEventAndNameAsync(Guid eventId, string name, CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-024 (E3.S3, post-review M-S3-1 / M-S3-7): Thrown by
/// <see cref="IEventVolunteerRoleRepository.AddAsync"/> / <see cref="IEventVolunteerRoleRepository.UpdateAsync"/>
/// when the database-level <c>ix_event_volunteer_roles_event_name_lower</c> unique index fires.
/// Carrying the offending name keeps the Application + API layers free of EF/Npgsql imports
/// while preserving a clean 409 message at the HTTP boundary.
/// </summary>
public sealed class VolunteerRoleNameConflictException : Exception
{
    public string AttemptedName { get; }

    public VolunteerRoleNameConflictException(string attemptedName)
        : base($"A role named '{attemptedName}' already exists for this event.")
    {
        AttemptedName = attemptedName;
    }
}
