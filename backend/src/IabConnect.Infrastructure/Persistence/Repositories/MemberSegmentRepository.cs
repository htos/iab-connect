using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// MemberSegment repository implementation
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public sealed class MemberSegmentRepository : IMemberSegmentRepository
{
    private readonly ApplicationDbContext _context;

    public MemberSegmentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<MemberSegment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.MemberSegments
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<MemberSegment?> GetByIdWithAssignmentsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.MemberSegments
            .Include(s => s.Assignments)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<(IReadOnlyList<MemberSegment> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? searchTerm = null,
        bool? isActive = null,
        SegmentType? segmentType = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.MemberSegments.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(term) ||
                (s.Description != null && s.Description.ToLower().Contains(term)));
        }

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (segmentType.HasValue)
        {
            query = query.Where(s => s.SegmentType == segmentType.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<MemberSegment>> GetAllActiveAsync(CancellationToken cancellationToken = default)
    {
        return await _context.MemberSegments
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(MemberSegment segment, CancellationToken cancellationToken = default)
    {
        await _context.MemberSegments.AddAsync(segment, cancellationToken);
    }

    public void Update(MemberSegment segment)
    {
        _context.MemberSegments.Update(segment);
    }

    public void Remove(MemberSegment segment)
    {
        _context.MemberSegments.Remove(segment);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.MemberSegments.AnyAsync(s => s.Id == id, cancellationToken);
    }

    public async Task<bool> NameExistsAsync(string name, Guid? excludeId = null, CancellationToken cancellationToken = default)
    {
        var query = _context.MemberSegments.Where(s => s.Name == name);
        if (excludeId.HasValue)
            query = query.Where(s => s.Id != excludeId.Value);
        return await query.AnyAsync(cancellationToken);
    }
}
