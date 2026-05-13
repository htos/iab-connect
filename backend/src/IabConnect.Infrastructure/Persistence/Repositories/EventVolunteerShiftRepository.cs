using IabConnect.Domain.Events.Volunteers;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-024 (E3.S3): EF-backed repository for <see cref="EventVolunteerShift"/>.
/// </summary>
public sealed class EventVolunteerShiftRepository : IEventVolunteerShiftRepository
{
    private readonly ApplicationDbContext _context;

    public EventVolunteerShiftRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default)
    {
        await _context.EventVolunteerShifts.AddAsync(shift, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default)
    {
        _context.EventVolunteerShifts.Update(shift);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public Task<EventVolunteerShift?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.EventVolunteerShifts.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public async Task<IReadOnlyList<EventVolunteerShift>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerShifts
            .Where(s => s.EventId == eventId)
            .OrderBy(s => s.StartsAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<EventVolunteerShift>> GetByRoleIdAsync(Guid roleId, CancellationToken cancellationToken = default)
        => await _context.EventVolunteerShifts
            .Where(s => s.RoleId == roleId)
            .OrderBy(s => s.StartsAt)
            .ToListAsync(cancellationToken);
}
