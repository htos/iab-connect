using IabConnect.Domain.Events.Volunteers;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-024 (E3.S3): EF-backed repository for <see cref="EventVolunteerRole"/>.
/// Post-review M-S3-1 / M-S3-7: <see cref="AddAsync"/> + <see cref="UpdateAsync"/> translate
/// Postgres SQLSTATE <c>23505</c> (unique-violation) into <see cref="VolunteerRoleNameConflictException"/>
/// so the Application layer stays free of EF imports while preserving a clean 409 at the HTTP boundary.
/// </summary>
public sealed class EventVolunteerRoleRepository : IEventVolunteerRoleRepository
{
    /// <summary>Postgres SQLSTATE for unique-violation.</summary>
    private const string UniqueViolationSqlState = "23505";

    private readonly ApplicationDbContext _context;

    public EventVolunteerRoleRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EventVolunteerRole role, CancellationToken cancellationToken = default)
    {
        await _context.EventVolunteerRoles.AddAsync(role, cancellationToken);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == UniqueViolationSqlState)
        {
            // M-S3-1: race-loser on the unique(event_id, lower(name)) index.
            _context.Entry(role).State = EntityState.Detached;
            throw new VolunteerRoleNameConflictException(role.Name);
        }
    }

    public async Task UpdateAsync(EventVolunteerRole role, CancellationToken cancellationToken = default)
    {
        _context.EventVolunteerRoles.Update(role);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pgEx && pgEx.SqlState == UniqueViolationSqlState)
        {
            // M-S3-7: rename collision now surfaces as 409 symmetric with create.
            throw new VolunteerRoleNameConflictException(role.Name);
        }
    }

    public Task<EventVolunteerRole?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.EventVolunteerRoles.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public async Task<IReadOnlyList<EventVolunteerRole>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerRoles
            .Where(r => r.EventId == eventId)
            .OrderBy(r => r.Name)
            .ToListAsync(cancellationToken);

    public async Task<EventVolunteerRole?> GetByEventAndNameAsync(Guid eventId, string name, CancellationToken cancellationToken = default)
    {
        var trimmed = name.Trim();
        return await _context.EventVolunteerRoles
            .FirstOrDefaultAsync(r => r.EventId == eventId && r.Name.ToLower() == trimmed.ToLower(), cancellationToken);
    }
}
