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

    /// <summary>
    /// REQ-018: Single-query OR-combined predicate for duplicate-candidate prefetch.
    /// <para>
    /// Phone-digit comparison is intentionally NOT applied here — Postgres cannot
    /// easily strip non-digits from a stored phone column via EF translation
    /// (see story E2.S1 Dev Notes, Option B). The handler applies the in-memory
    /// digit equality test after this method returns; the OR-combined SQL widens
    /// the candidate set by name/postal-code so diacritic-only or +tag-only
    /// duplicates still reach the in-memory matcher.
    /// </para>
    /// </summary>
    public async Task<IReadOnlyList<Member>> FindCandidatesAsync(
        string? emailNormalized,
        string? phoneDigits,
        string? firstNameFolded,
        string? lastNameFolded,
        string? postalCode,
        Guid? excludeMemberId,
        int maxResults,
        CancellationToken cancellationToken = default)
    {
        _ = phoneDigits; // documented over-fetch trade-off — see XML doc above

        if (maxResults <= 0)
            return Array.Empty<Member>();

        var hasAnySignal = !string.IsNullOrEmpty(emailNormalized)
            || (!string.IsNullOrEmpty(firstNameFolded) && !string.IsNullOrEmpty(lastNameFolded))
            || !string.IsNullOrEmpty(postalCode);

        if (!hasAnySignal)
            return Array.Empty<Member>();

        var query = _context.Members
            .AsNoTracking()
            .AsQueryable();

        if (excludeMemberId.HasValue)
            query = query.Where(m => m.Id != excludeMemberId.Value);

        query = query.Where(m =>
            (emailNormalized != null && EF.Functions.ILike(m.Email, emailNormalized))
            || (firstNameFolded != null
                && lastNameFolded != null
                && EF.Functions.ILike(m.FirstName, firstNameFolded)
                && EF.Functions.ILike(m.LastName, lastNameFolded))
            || (postalCode != null && m.Address.PostalCode == postalCode));

        return await query
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .Take(maxResults)
            .ToListAsync(cancellationToken);
    }
}
