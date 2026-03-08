namespace IabConnect.Domain.Members;

/// <summary>
/// Repository interface for MemberSegment aggregate
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public interface IMemberSegmentRepository
{
    Task<MemberSegment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MemberSegment?> GetByIdWithAssignmentsAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<MemberSegment> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? searchTerm = null,
        bool? isActive = null,
        SegmentType? segmentType = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MemberSegment>> GetAllActiveAsync(CancellationToken cancellationToken = default);

    Task AddAsync(MemberSegment segment, CancellationToken cancellationToken = default);
    void Update(MemberSegment segment);
    void Remove(MemberSegment segment);

    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default);
}
