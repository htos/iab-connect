namespace IabConnect.Domain.Members;

/// <summary>
/// REQ-018 (E2.S4): persistence boundary for <see cref="DuplicateCandidateDismissal"/>.
/// </summary>
public interface IDuplicateCandidateDismissalRepository
{
    /// <summary>
    /// Returns every dismissal row (no paging) as a tuple list of canonicalised pairs.
    /// Used by the cross-table duplicate-groups scan to pre-filter dismissed pairs;
    /// the row count is expected to stay bounded (admin action-driven).
    /// </summary>
    Task<IReadOnlyList<(Guid Source, Guid Target)>> GetAllPairsAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Looks up an existing dismissal for the (already-canonicalised) pair; returns null when
    /// no row exists.
    /// </summary>
    Task<DuplicateCandidateDismissal?> GetByCanonicalPairAsync(
        Guid sourceMemberId,
        Guid targetMemberId,
        CancellationToken cancellationToken = default);

    /// <summary>Adds a new dismissal row to the DbContext.</summary>
    Task AddAsync(DuplicateCandidateDismissal dismissal, CancellationToken cancellationToken = default);

    /// <summary>
    /// REQ-018 review patch: race-safe upsert variant. Adds the dismissal and immediately persists it.
    /// If the unique-pair constraint fires (concurrent dismissal by another admin), re-fetches and
    /// returns the winning row instead of bubbling the database exception.
    /// </summary>
    /// <returns>(persisted row, created=true if this call wrote it, false if a concurrent insert won).</returns>
    Task<(DuplicateCandidateDismissal Persisted, bool Created)> AddAtomicAsync(
        DuplicateCandidateDismissal dismissal,
        CancellationToken cancellationToken = default);
}
