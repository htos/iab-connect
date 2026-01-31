using IabConnect.Domain.Events;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-020: Repository implementation for EventRegistration
/// </summary>
public sealed class EventRegistrationRepository : IEventRegistrationRepository
{
    private readonly ApplicationDbContext _context;

    public EventRegistrationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(EventRegistration registration, CancellationToken cancellationToken = default)
    {
        await _context.EventRegistrations.AddAsync(registration, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(EventRegistration registration, CancellationToken cancellationToken = default)
    {
        _context.EventRegistrations.Update(registration);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<EventRegistration?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
    }

    public async Task<EventRegistration?> GetByQrCodeTokenAsync(string qrCodeToken, CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .FirstOrDefaultAsync(r => r.QrCodeToken == qrCodeToken, cancellationToken);
    }

    public async Task<IReadOnlyList<EventRegistration>> GetByEventIdAsync(
        Guid eventId,
        EventRegistrationFilterOptions? filter = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EventRegistrations
            .Where(r => r.EventId == eventId);

        query = ApplyFilters(query, filter);
        query = ApplySorting(query, filter);

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EventRegistration>> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RegisteredAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EventRegistration>> GetByMemberIdAsync(
        Guid memberId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.MemberId == memberId)
            .OrderByDescending(r => r.RegisteredAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(
        Guid eventId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .AnyAsync(r => r.EventId == eventId
                        && r.UserId == userId
                        && r.Status != RegistrationStatus.Cancelled,
                cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(
        Guid eventId,
        string email,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        return await _context.EventRegistrations
            .AnyAsync(r => r.EventId == eventId
                        && r.ParticipantEmail == normalizedEmail
                        && r.Status != RegistrationStatus.Cancelled,
                cancellationToken);
    }

    public async Task<int> CountConfirmedAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.EventId == eventId &&
                       (r.Status == RegistrationStatus.Confirmed || r.Status == RegistrationStatus.CheckedIn))
            .CountAsync(cancellationToken);
    }

    public async Task<int> CountTotalParticipantsAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.EventId == eventId &&
                       (r.Status == RegistrationStatus.Confirmed || r.Status == RegistrationStatus.CheckedIn))
            .SumAsync(r => r.NumberOfGuests, cancellationToken);
    }

    public async Task<int> CountWaitlistedAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.EventId == eventId && r.IsWaitlisted && r.Status == RegistrationStatus.Waitlisted)
            .CountAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EventRegistration>> GetWaitlistAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.EventId == eventId && r.IsWaitlisted && r.Status == RegistrationStatus.Waitlisted)
            .OrderBy(r => r.WaitlistPosition)
            .ToListAsync(cancellationToken);
    }

    public async Task<EventRegistration?> GetNextOnWaitlistAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        return await _context.EventRegistrations
            .Where(r => r.EventId == eventId && r.IsWaitlisted && r.Status == RegistrationStatus.Waitlisted)
            .OrderBy(r => r.WaitlistPosition)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<EventRegistrationStatistics> GetStatisticsAsync(
        Guid eventId,
        CancellationToken cancellationToken = default)
    {
        var registrations = await _context.EventRegistrations
            .Where(r => r.EventId == eventId)
            .ToListAsync(cancellationToken);

        var confirmed = registrations.Where(r => r.Status == RegistrationStatus.Confirmed || r.Status == RegistrationStatus.CheckedIn).ToList();

        return new EventRegistrationStatistics
        {
            TotalRegistrations = registrations.Count,
            ConfirmedCount = registrations.Count(r => r.Status == RegistrationStatus.Confirmed),
            PendingCount = registrations.Count(r => r.Status == RegistrationStatus.Pending),
            WaitlistedCount = registrations.Count(r => r.Status == RegistrationStatus.Waitlisted),
            CancelledCount = registrations.Count(r => r.Status == RegistrationStatus.Cancelled),
            CheckedInCount = registrations.Count(r => r.Status == RegistrationStatus.CheckedIn),
            NoShowCount = registrations.Count(r => r.Status == RegistrationStatus.NoShow),
            TotalParticipants = confirmed.Sum(r => r.NumberOfGuests),
            TotalGuests = confirmed.Sum(r => Math.Max(0, r.NumberOfGuests - 1))
        };
    }

    public async Task<(IReadOnlyList<EventRegistration> Items, int TotalCount)> GetPagedAsync(
        Guid eventId,
        EventRegistrationFilterOptions? filter,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = _context.EventRegistrations
            .Where(r => r.EventId == eventId);

        query = ApplyFilters(query, filter);

        var totalCount = await query.CountAsync(cancellationToken);

        query = ApplySorting(query, filter);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    private static IQueryable<EventRegistration> ApplyFilters(
        IQueryable<EventRegistration> query,
        EventRegistrationFilterOptions? filter)
    {
        if (filter == null) return query;

        if (filter.Status.HasValue)
        {
            query = query.Where(r => r.Status == filter.Status.Value);
        }

        if (filter.IsWaitlisted.HasValue)
        {
            query = query.Where(r => r.IsWaitlisted == filter.IsWaitlisted.Value);
        }

        if (filter.IsCheckedIn.HasValue)
        {
            query = filter.IsCheckedIn.Value
                ? query.Where(r => r.CheckedInAt != null)
                : query.Where(r => r.CheckedInAt == null);
        }

        if (filter.IsNoShow.HasValue)
        {
            query = query.Where(r => r.IsNoShow == filter.IsNoShow.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var searchTerm = filter.SearchTerm.ToLower();
            query = query.Where(r =>
                r.ParticipantName.ToLower().Contains(searchTerm) ||
                r.ParticipantEmail.ToLower().Contains(searchTerm));
        }

        return query;
    }

    private static IQueryable<EventRegistration> ApplySorting(
        IQueryable<EventRegistration> query,
        EventRegistrationFilterOptions? filter)
    {
        var sortBy = filter?.SortBy ?? RegistrationSortBy.RegisteredAt;
        var descending = filter?.SortDescending ?? true;

        return sortBy switch
        {
            RegistrationSortBy.ParticipantName => descending
                ? query.OrderByDescending(r => r.ParticipantName)
                : query.OrderBy(r => r.ParticipantName),
            RegistrationSortBy.Status => descending
                ? query.OrderByDescending(r => r.Status)
                : query.OrderBy(r => r.Status),
            RegistrationSortBy.WaitlistPosition => descending
                ? query.OrderByDescending(r => r.WaitlistPosition)
                : query.OrderBy(r => r.WaitlistPosition),
            RegistrationSortBy.CheckedInAt => descending
                ? query.OrderByDescending(r => r.CheckedInAt)
                : query.OrderBy(r => r.CheckedInAt),
            _ => descending
                ? query.OrderByDescending(r => r.RegisteredAt)
                : query.OrderBy(r => r.RegisteredAt)
        };
    }
}
