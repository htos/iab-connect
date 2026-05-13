using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-018 (E2.S4): EF-backed repository for <see cref="DuplicateCandidateDismissal"/>.
/// </summary>
public sealed class DuplicateCandidateDismissalRepository : IDuplicateCandidateDismissalRepository
{
    private readonly ApplicationDbContext _context;

    public DuplicateCandidateDismissalRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<(Guid Source, Guid Target)>> GetAllPairsAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _context.DuplicateCandidateDismissals
            .AsNoTracking()
            .Select(d => new { d.SourceMemberId, d.TargetMemberId })
            .ToListAsync(cancellationToken);
        return rows
            .Select(r => (r.SourceMemberId, r.TargetMemberId))
            .ToList();
    }

    public async Task<DuplicateCandidateDismissal?> GetByCanonicalPairAsync(
        Guid sourceMemberId,
        Guid targetMemberId,
        CancellationToken cancellationToken = default)
    {
        return await _context.DuplicateCandidateDismissals
            .FirstOrDefaultAsync(
                d => d.SourceMemberId == sourceMemberId && d.TargetMemberId == targetMemberId,
                cancellationToken);
    }

    public async Task AddAsync(DuplicateCandidateDismissal dismissal, CancellationToken cancellationToken = default)
    {
        await _context.DuplicateCandidateDismissals.AddAsync(dismissal, cancellationToken);
    }

    public async Task<(DuplicateCandidateDismissal Persisted, bool Created)> AddAtomicAsync(
        DuplicateCandidateDismissal dismissal,
        CancellationToken cancellationToken = default)
    {
        await _context.DuplicateCandidateDismissals.AddAsync(dismissal, cancellationToken);
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            return (dismissal, true);
        }
        catch (DbUpdateException)
        {
            // REQ-018 review patch: concurrent dismissal race. Discard the just-Added entry so it
            // doesn't get re-flushed on the next SaveChanges, then re-fetch the canonical-pair row
            // (the unique index ix_duplicate_candidate_dismissals_pair guarantees there's exactly
            // one row for this pair).
            _context.Entry(dismissal).State = EntityState.Detached;
            var winner = await GetByCanonicalPairAsync(
                dismissal.SourceMemberId,
                dismissal.TargetMemberId,
                cancellationToken);
            if (winner is null)
                throw;
            return (winner, false);
        }
    }
}
