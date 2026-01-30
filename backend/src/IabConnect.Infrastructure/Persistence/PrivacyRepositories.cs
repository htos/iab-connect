using IabConnect.Domain.Privacy;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence;

/// <summary>
/// Repository implementation for consent management (REQ-012: DSGVO)
/// </summary>
public class ConsentRepository : IConsentRepository
{
    private readonly ApplicationDbContext _context;

    public ConsentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<Consent>> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.Consents
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.Type)
            .ToListAsync(ct);
    }

    public async Task<Consent?> GetByUserAndTypeAsync(Guid userId, ConsentType type, CancellationToken ct = default)
    {
        return await _context.Consents
            .FirstOrDefaultAsync(c => c.UserId == userId && c.Type == type, ct);
    }

    public async Task AddAsync(Consent consent, CancellationToken ct = default)
    {
        await _context.Consents.AddAsync(consent, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Consent consent, CancellationToken ct = default)
    {
        _context.Consents.Update(consent);
        await _context.SaveChangesAsync(ct);
    }

    public async Task<bool> HasConsentAsync(Guid userId, ConsentType type, CancellationToken ct = default)
    {
        return await _context.Consents
            .AnyAsync(c => c.UserId == userId && c.Type == type && c.IsGranted, ct);
    }

    public async Task<IReadOnlyList<Guid>> GetUsersWithConsentAsync(ConsentType type, CancellationToken ct = default)
    {
        return await _context.Consents
            .Where(c => c.Type == type && c.IsGranted)
            .Select(c => c.UserId)
            .ToListAsync(ct);
    }
}

/// <summary>
/// Repository implementation for deletion requests (REQ-012: DSGVO)
/// </summary>
public class DeletionRequestRepository : IDeletionRequestRepository
{
    private readonly ApplicationDbContext _context;

    public DeletionRequestRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DeletionRequest?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.DeletionRequests.FindAsync([id], ct);
    }

    public async Task<IReadOnlyList<DeletionRequest>> GetByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.DeletionRequests
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RequestedAt)
            .ToListAsync(ct);
    }

    public async Task<DeletionRequest?> GetActiveByUserIdAsync(Guid userId, CancellationToken ct = default)
    {
        return await _context.DeletionRequests
            .Where(r => r.UserId == userId &&
                       (r.Status == DeletionRequestStatus.Pending ||
                        r.Status == DeletionRequestStatus.Confirmed ||
                        r.Status == DeletionRequestStatus.UnderReview))
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<DeletionRequest>> GetByStatusAsync(DeletionRequestStatus status, CancellationToken ct = default)
    {
        return await _context.DeletionRequests
            .Where(r => r.Status == status)
            .OrderBy(r => r.RequestedAt)
            .ToListAsync(ct);
    }

    public async Task<DeletionRequest?> GetByTokenAsync(string token, CancellationToken ct = default)
    {
        return await _context.DeletionRequests
            .FirstOrDefaultAsync(r => r.ConfirmationToken == token, ct);
    }

    public async Task AddAsync(DeletionRequest request, CancellationToken ct = default)
    {
        await _context.DeletionRequests.AddAsync(request, ct);
        await _context.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(DeletionRequest request, CancellationToken ct = default)
    {
        _context.DeletionRequests.Update(request);
        await _context.SaveChangesAsync(ct);
    }
}
