namespace IabConnect.Domain.Members;

/// <summary>
/// Repository interface for Member aggregate
/// </summary>
public interface IMemberRepository
{
    Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default);
    
    Task<IReadOnlyList<Member>> GetAllAsync(CancellationToken cancellationToken = default);
    
    Task<(IReadOnlyList<Member> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? searchTerm = null,
        MembershipStatus? status = null,
        MembershipType? type = null,
        CancellationToken cancellationToken = default);
    
    Task AddAsync(Member member, CancellationToken cancellationToken = default);
    void Update(Member member);
    void Remove(Member member);
    
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-018: Find duplicate-candidate members by partial normalized signals.
    /// Implementations MUST run as a SINGLE SQL query (no per-row round-trips) and MUST
    /// use AsNoTracking. Phone matching is deliberately NOT performed in SQL — the handler
    /// applies phone-digit equality in-memory (see story E2.S1 Dev Notes, Option B).
    /// </summary>
    Task<IReadOnlyList<Member>> FindCandidatesAsync(
        string? emailNormalized,
        string? phoneDigits,
        string? firstNameFolded,
        string? lastNameFolded,
        string? postalCode,
        Guid? excludeMemberId,
        int maxResults,
        CancellationToken cancellationToken = default);
}
