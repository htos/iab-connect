namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-022 (E4-S1): Repository for <see cref="EventFeeCategory"/>.
/// </summary>
public interface IEventFeeCategoryRepository
{
    Task AddAsync(EventFeeCategory category, CancellationToken cancellationToken = default);
    Task UpdateAsync(EventFeeCategory category, CancellationToken cancellationToken = default);
    Task<EventFeeCategory?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>All categories for an event, newest-first by creation. Includes inactive when
    /// <paramref name="includeInactive"/> is true (admin view); active-only otherwise.</summary>
    Task<IReadOnlyList<EventFeeCategory>> GetByEventIdAsync(
        Guid eventId, bool includeInactive = false, CancellationToken cancellationToken = default);

    /// <summary>True when an ACTIVE category with the given name (case-insensitive) already exists
    /// on the event, optionally excluding one category id (for the update-rename check).</summary>
    Task<bool> ActiveNameExistsAsync(
        Guid eventId, string name, Guid? excludingId = null, CancellationToken cancellationToken = default);
}
