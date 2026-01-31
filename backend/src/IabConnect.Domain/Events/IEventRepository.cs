namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-019/REQ-020: Event repository interface
/// </summary>
public interface IEventRepository
{
    // Read operations
    Task<Event?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetAllAsync(CancellationToken ct = default);
    Task<(IReadOnlyList<Event> Items, int TotalCount)> GetPagedAsync(
        EventFilterOptions filter,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetUpcomingAsync(int count = 10, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetByOrganizerAsync(Guid organizerId, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetByDateRangeAsync(DateTime start, DateTime end, CancellationToken ct = default);
    Task<IReadOnlyList<Event>> GetPublicEventsAsync(DateTime? from = null, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task<int> GetCountAsync(EventFilterOptions? filter = null, CancellationToken ct = default);

    // Write operations
    Task AddAsync(Event evt, CancellationToken ct = default);
    void Update(Event evt);
    void Remove(Event evt);
}

/// <summary>
/// Filter options for event queries
/// </summary>
public sealed class EventFilterOptions
{
    public string? SearchTerm { get; init; }
    public EventStatus? Status { get; init; }
    public EventVisibility? Visibility { get; init; }
    public EventCategory? Category { get; init; }
    public Guid? OrganizerId { get; init; }
    public DateTime? FromDate { get; init; }
    public DateTime? ToDate { get; init; }
    public bool? IsFree { get; init; }
    public bool IncludeDeleted { get; init; } = false;
    public bool PublicOnly { get; init; } = false;
}
