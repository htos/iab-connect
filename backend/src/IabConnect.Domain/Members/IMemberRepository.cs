namespace IabConnect.Domain.Members;

/// <summary>
/// Repository interface for Member aggregate
/// </summary>
public interface IMemberRepository
{
    Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-024 (E3.S3 Round-3 R3-H-S3-6): batch-load members keyed by id. Used by hot
    /// member-facing read paths (volunteer assignment roster, future N-by-N lookups) so a list
    /// of <c>memberIds</c> produces a single SQL round-trip rather than N per-id queries.
    /// Returns a dictionary so callers can do `dict.TryGetValue(id, out var member)`; ids with
    /// no matching member row are simply absent from the dictionary. <c>AsNoTracking</c> is the
    /// default since callers expect read-only DTOs.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Member>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);

    Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-025 (E3.S5): Resolves the calling calendar client's opaque token to its Member.
    /// Soft-retire-aware: returns null when the matching row is Inactive or merged-retired,
    /// so revoked memberships stop emitting feeds without the caller needing extra branching.
    /// </summary>
    Task<Member?> GetByCalendarTokenAsync(string token, CancellationToken cancellationToken = default);
    
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
    /// REQ-018 / E2.S2: Case-insensitive, <c>+tag</c>-aware email lookup. The implementation
    /// applies <c>IDuplicateMatcher.NormalizeEmail</c> to the input (lower-case + trim +
    /// strip <c>+tag</c> local-part suffix) and uses <c>EF.Functions.ILike</c> against the
    /// normalized pattern in SQL so casing differences in stored emails do not slip past
    /// the guard. Returned entity is <c>AsNoTracking</c>; callers that need a tracked
    /// instance should re-load via <see cref="GetByIdAsync"/>.
    /// </summary>
    Task<Member?> GetByEmailNormalizedAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-018 / E2.S2: Boolean form of <see cref="GetByEmailNormalizedAsync"/> -- use when the
    /// caller only needs to know whether any member exists for the normalized email.
    /// </summary>
    Task<bool> EmailExistsNormalizedAsync(string email, CancellationToken cancellationToken = default);

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

    /// <summary>
    /// REQ-018 (E2.S4): Returns all non-merged members for the cross-table duplicate-groups scan.
    /// Single AsNoTracking query; applies the <c>MergedIntoMemberId == null</c> filter so retired
    /// members from past merges do not surface as group members on the duplicates page.
    /// </summary>
    /// <remarks>
    /// Designed for the duplicates-groups scan, not for general listing. The result set is
    /// expected to stay bounded for a small-to-mid-size association (a few thousand members);
    /// the handler then groups in C# so diacritic folding (Müller ↔ Mueller) is consistent
    /// with the per-input <see cref="FindCandidatesAsync"/> path.
    /// </remarks>
    Task<IReadOnlyList<Member>> GetAllNonMergedAsync(CancellationToken cancellationToken = default);
}
