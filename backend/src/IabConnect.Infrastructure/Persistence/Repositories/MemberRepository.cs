using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// Member repository implementation
/// </summary>
public sealed class MemberRepository : IMemberRepository
{
    private readonly ApplicationDbContext _context;
    private readonly IDuplicateMatcher _matcher;
    private readonly byte[]? _calendarTokenPepper;

    public MemberRepository(
        ApplicationDbContext context,
        IDuplicateMatcher matcher,
        IOptions<CalendarTokenOptions>? calendarTokenOptions = null)
    {
        _context = context;
        _matcher = matcher;
        // Optional so the many repository tests that don't touch calendar tokens need no extra
        // wiring; the DI container always supplies the registered options in production.
        _calendarTokenPepper = calendarTokenOptions?.Value.PepperBytes;
    }

    public async Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyDictionary<Guid, Member>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default)
    {
        if (ids.Count == 0)
            return new Dictionary<Guid, Member>();

        // R3-H-S3-6: single SQL `WHERE id IN (...)` translates to `id = ANY(@ids)` under Npgsql,
        // which is index-friendly. AsNoTracking is the default since callers consume DTOs.
        var members = await _context.Members
            .AsNoTracking()
            .Where(m => ids.Contains(m.Id))
            .ToListAsync(cancellationToken);
        return members.ToDictionary(m => m.Id);
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

    public async Task<Member?> GetByCalendarTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
            return null;
        // REQ-025 (E3.S5 post-review H-S5-1): hash the incoming token and look up by hash so a
        // DB-read attacker cannot replay anyone's feed and so the SQL string-equality compare
        // is over a uniformly-distributed digest (defeats timing-prefix enumeration).
        // Epic-3-retro §9 (R3-H-S5-3): the hash is HMAC-keyed with the configured pepper when
        // one is set; null pepper keeps the backwards-compatible plain SHA-256.
        var hash = Member.HashCalendarToken(token, _calendarTokenPepper);
        return await _context.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(
                // REQ-025 (E3.S5 Round-3 R3-DN-2 / R3-H-S5-1): broaden the filter to include
                // both Active AND Pending members. The previous `Status == Active` excluded
                // brand-new Pending members who rotated their token before activation, silently
                // 404-ing every calendar fetch with no actionable signal. Decision-DN-2 picked
                // option (a) — "soft-retire is the only exclusion": Inactive (administrative
                // off) and merged-retired (Member.MergedIntoMemberId set) stop emitting feeds;
                // Suspended also stops (admin enforcement); Pending keeps the feed open until
                // explicit deactivation.
                m => m.CalendarSubscriptionTokenHash == hash
                  && m.MergedIntoMemberId == null
                  && (m.Status == MembershipStatus.Active || m.Status == MembershipStatus.Pending),
                cancellationToken);
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

    public async Task<Member?> GetByEmailNormalizedAsync(string email, CancellationToken cancellationToken = default)
    {
        var (exactPattern, tagPattern) = BuildNormalizedEmailPatterns(email);
        if (exactPattern is null)
            return null;

        // REQ-018 (E2.S3): exclude merged-source rows so the email can be re-used on the target
        // without triggering a false-positive duplicate warning.
        return await _context.Members
            .AsNoTracking()
            .Where(m => m.MergedIntoMemberId == null)
            .FirstOrDefaultAsync(
                m => EF.Functions.ILike(m.Email, exactPattern, LikeEscapeChar)
                  || EF.Functions.ILike(m.Email, tagPattern!, LikeEscapeChar),
                cancellationToken);
    }

    public async Task<bool> EmailExistsNormalizedAsync(string email, CancellationToken cancellationToken = default)
    {
        var (exactPattern, tagPattern) = BuildNormalizedEmailPatterns(email);
        if (exactPattern is null)
            return false;

        // REQ-018 (E2.S3): exclude merged-source rows (see GetByEmailNormalizedAsync).
        return await _context.Members
            .AsNoTracking()
            .Where(m => m.MergedIntoMemberId == null)
            .AnyAsync(
                m => EF.Functions.ILike(m.Email, exactPattern, LikeEscapeChar)
                  || EF.Functions.ILike(m.Email, tagPattern!, LikeEscapeChar),
                cancellationToken);
    }

    // REQ-018 review patch: LIKE escape char so user-supplied email local-part chars
    // `_` / `%` / `\` are matched literally (not as ILike wildcards). Pairs with
    // EscapeLikePattern applied to the normalized input before formatting.
    private const string LikeEscapeChar = "\\";

    private static string EscapeLikePattern(string value)
    {
        // Order matters: escape the escape char first, then the wildcards.
        return value
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
    }

    private (string? Exact, string? Tag) BuildNormalizedEmailPatterns(string email)
    {
        var normalized = _matcher.NormalizeEmail(email);
        if (string.IsNullOrEmpty(normalized))
            return (null, null);

        var atIdx = normalized.IndexOf('@');
        if (atIdx <= 0 || atIdx == normalized.Length - 1)
            return (null, null);

        var local = EscapeLikePattern(normalized[..atIdx]);
        var domain = EscapeLikePattern(normalized[(atIdx + 1)..]);
        var exactPattern = $"{local}@{domain}";
        var tagPattern = $"{local}+%@{domain}";
        return (exactPattern, tagPattern);
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

        // REQ-018 (E2.S3): exclude merged-source rows so the duplicate-detection query never
        // proposes a retired record as a candidate. GetByIdAsync remains unfiltered (forensics).
        var query = _context.Members
            .AsNoTracking()
            .Where(m => m.MergedIntoMemberId == null)
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

    /// <summary>
    /// REQ-018 (E2.S4): single-query AsNoTracking projection of the non-merged member set,
    /// used by the cross-table duplicate-groups scan. Symmetric-Guard checklist: applies
    /// <c>MergedIntoMemberId == null</c> so merged source rows never reappear in the groups UI.
    /// </summary>
    public async Task<IReadOnlyList<Member>> GetAllNonMergedAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Members
            .AsNoTracking()
            .Where(m => m.MergedIntoMemberId == null)
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .ToListAsync(cancellationToken);
    }
}
