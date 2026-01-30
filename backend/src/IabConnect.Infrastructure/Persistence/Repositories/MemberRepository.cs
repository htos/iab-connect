using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Member repository implementation
/// </summary>
public sealed class MemberRepository : IMemberRepository
{
    private readonly ApplicationDbContext _context;

    public MemberRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .FirstOrDefaultAsync(m => m.Email == email, cancellationToken);
    }

    public async Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .FirstOrDefaultAsync(m => m.KeycloakUserId == keycloakUserId, cancellationToken);
    }

    public async Task<IReadOnlyList<Member>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .ToListAsync(cancellationToken);
    }

    public async Task<(IReadOnlyList<Member> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? searchTerm = null,
        MembershipStatus? status = null,
        MembershipType? type = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Members.AsQueryable();

        // Search filter
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var term = searchTerm.ToLower();
            query = query.Where(m =>
                m.FirstName.ToLower().Contains(term) ||
                m.LastName.ToLower().Contains(term) ||
                m.Email.ToLower().Contains(term));
        }

        // Status filter
        if (status.HasValue)
        {
            query = query.Where(m => m.Status == status.Value);
        }

        // Type filter
        if (type.HasValue)
        {
            query = query.Where(m => m.MembershipType == type.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task AddAsync(Member member, CancellationToken cancellationToken = default)
    {
        await _context.Members.AddAsync(member, cancellationToken);
    }

    public void Update(Member member)
    {
        _context.Members.Update(member);
    }

    public void Remove(Member member)
    {
        _context.Members.Remove(member);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Members.AnyAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _context.Members.AnyAsync(m => m.Email == email, cancellationToken);
    }
}
