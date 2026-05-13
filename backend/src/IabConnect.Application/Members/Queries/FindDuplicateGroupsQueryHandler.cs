using IabConnect.Application.Common;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Members.Queries;

/// <summary>
/// REQ-018 (E2.S4): Cross-table duplicate-groups scan handler.
///
/// <para>Algorithm (two queries total, no N+1):</para>
/// <list type="number">
///   <item>Load all non-merged members via <see cref="IMemberRepository.GetAllNonMergedAsync"/>
///         (single AsNoTracking query; <c>MergedIntoMemberId IS NULL</c> filter applied in SQL).</item>
///   <item>Load all dismissed pairs via <see cref="IDuplicateCandidateDismissalRepository.GetAllPairsAsync"/>
///         (single AsNoTracking query; admin-action-bounded).</item>
/// </list>
///
/// <para>Then in-memory:</para>
/// <list type="number">
///   <item>Group by <c>NormalizeEmail</c> — buckets with size &gt;= 2 are <see cref="MatchTier.Exact"/> groups.</item>
///   <item>For the remaining members (not already in an Exact group), group by
///         <c>(FoldName(FirstName), FoldName(LastName), trimmed PostalCode)</c>. The <c>FoldName</c>
///         pre-processing handles diacritics (Müller ↔ Mueller) which a pure SQL <c>lower()</c>
///         cannot. Buckets with size &gt;= 2 are <see cref="MatchTier.Likely"/> candidate groups.</item>
///   <item>For each Likely group, validate each pair via <see cref="IDuplicateMatcher.EvaluateCandidate"/>
///         so the existing AC-3 rule "NameOnly alone is not enough" is honoured. A group is kept
///         only if it has at least one validated pair under the Likely tier.</item>
///   <item>Drop any pair (and possibly its member) that appears in the dismissed-pair set. A group
///         becoming a singleton after dismissal removal is dropped entirely.</item>
///   <item>Apply <c>MinTier</c> filter, sort by tier then group key, paginate.</item>
/// </list>
///
/// <para>The SQL <c>GROUP BY</c> path described in the story Dev Notes is documented as a future
/// optimisation; the in-memory variant is the agreed fallback (story Dev Notes: "in-memory scan
/// works up to a few thousand members"). Member count today is expected to stay under that bound.</para>
/// </summary>
public sealed class FindDuplicateGroupsQueryHandler
    : IRequestHandler<FindDuplicateGroupsQuery, PagedResult<DuplicateGroupDto>>
{
    private const int MinPageSize = 1;
    private const int MaxPageSize = 100;

    private readonly IMemberRepository _memberRepository;
    private readonly IDuplicateCandidateDismissalRepository _dismissalRepository;
    private readonly IDuplicateMatcher _matcher;

    public FindDuplicateGroupsQueryHandler(
        IMemberRepository memberRepository,
        IDuplicateCandidateDismissalRepository dismissalRepository,
        IDuplicateMatcher matcher)
    {
        _memberRepository = memberRepository;
        _dismissalRepository = dismissalRepository;
        _matcher = matcher;
    }

    public async Task<PagedResult<DuplicateGroupDto>> Handle(
        FindDuplicateGroupsQuery request,
        CancellationToken cancellationToken)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = Math.Clamp(request.PageSize, MinPageSize, MaxPageSize);

        var members = await _memberRepository.GetAllNonMergedAsync(cancellationToken);
        if (members.Count < 2)
            return PagedResult<DuplicateGroupDto>.Empty(page, pageSize);

        var dismissedPairs = await _dismissalRepository.GetAllPairsAsync(cancellationToken);
        var dismissedSet = new HashSet<(Guid, Guid)>(dismissedPairs);

        var allGroups = new List<DuplicateGroupDto>();

        // === Exact tier: GROUP BY normalized email ===
        var exactBuckets = new Dictionary<string, List<Member>>(StringComparer.Ordinal);
        foreach (var member in members)
        {
            var key = _matcher.NormalizeEmail(member.Email);
            if (key.Length == 0)
                continue;
            if (!exactBuckets.TryGetValue(key, out var bucket))
                exactBuckets[key] = bucket = new List<Member>();
            bucket.Add(member);
        }

        var membersInExactGroup = new HashSet<Guid>();
        foreach (var (key, bucket) in exactBuckets)
        {
            if (bucket.Count < 2)
                continue;

            var survivors = FilterDismissed(bucket, dismissedSet, MatchTier.Exact);
            if (survivors.Count < 2)
                continue;

            foreach (var s in survivors)
                membersInExactGroup.Add(s.Id);

            allGroups.Add(new DuplicateGroupDto(
                GroupKey: $"email::{key}",
                Tier: MatchTier.Exact,
                Members: survivors
                    .OrderBy(m => m.LastName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(m => m.FirstName, StringComparer.OrdinalIgnoreCase)
                    .Select(m => FindMemberDuplicatesQueryHandler.MapToDto(m, MatchTier.Exact, MatchReason.Email))
                    .ToList()));
        }

        // === Likely tier: GROUP BY folded name + postal, then validate each pair ===
        var likelyBuckets = new Dictionary<string, List<Member>>(StringComparer.Ordinal);
        foreach (var member in members)
        {
            if (membersInExactGroup.Contains(member.Id))
                continue;
            var foldedFirst = _matcher.FoldName(member.FirstName);
            var foldedLast = _matcher.FoldName(member.LastName);
            if (foldedFirst.Length == 0 || foldedLast.Length == 0)
                continue;
            var postal = (member.Address?.PostalCode ?? string.Empty).Trim();
            // REQ-018 review patch: skip Likely-bucket when postal is empty — without postal,
            // every postal-less member with matching folded names collapses into one giant bucket,
            // wasting O(n²) work and producing false-positive groups for unrelated people.
            if (postal.Length == 0)
                continue;
            var key = $"{foldedFirst}|{foldedLast}|{postal}";
            if (!likelyBuckets.TryGetValue(key, out var bucket))
                likelyBuckets[key] = bucket = new List<Member>();
            bucket.Add(member);
        }

        foreach (var (key, bucket) in likelyBuckets)
        {
            if (bucket.Count < 2)
                continue;

            // Validate via the matcher: keep only members that have at least one validated
            // Likely-tier pair with another bucket member (NameOnly alone is not enough).
            var validated = new HashSet<Guid>();
            var reasonsByMember = new Dictionary<Guid, MatchReason>();
            for (var i = 0; i < bucket.Count; i++)
            {
                for (var j = i + 1; j < bucket.Count; j++)
                {
                    var a = bucket[i];
                    var b = bucket[j];
                    var pairKey = DuplicateCandidateDismissal.Canonicalise(a.Id, b.Id);
                    if (dismissedSet.Contains(pairKey))
                        continue;
                    var (tier, reason) = _matcher.EvaluateCandidate(a, b);
                    if (tier != MatchTier.Likely)
                        continue;
                    validated.Add(a.Id);
                    validated.Add(b.Id);
                    reasonsByMember[a.Id] = reasonsByMember.GetValueOrDefault(a.Id) | reason;
                    reasonsByMember[b.Id] = reasonsByMember.GetValueOrDefault(b.Id) | reason;
                }
            }

            if (validated.Count < 2)
                continue;

            var survivors = bucket.Where(m => validated.Contains(m.Id)).ToList();
            allGroups.Add(new DuplicateGroupDto(
                GroupKey: $"name::{key}",
                Tier: MatchTier.Likely,
                Members: survivors
                    .OrderBy(m => m.LastName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(m => m.FirstName, StringComparer.OrdinalIgnoreCase)
                    .Select(m => FindMemberDuplicatesQueryHandler.MapToDto(m, MatchTier.Likely, reasonsByMember[m.Id]))
                    .ToList()));
        }

        // === Tier filter ===
        if (request.MinTier.HasValue && request.MinTier.Value == MatchTier.Exact)
        {
            allGroups = allGroups.Where(g => g.Tier == MatchTier.Exact).ToList();
        }
        // MinTier == Likely or null → return both tiers.

        // === Sort: Exact (0) before Likely (1), then by GroupKey for determinism ===
        allGroups = allGroups
            .OrderBy(g => (int)g.Tier)
            .ThenBy(g => g.GroupKey, StringComparer.Ordinal)
            .ToList();

        var totalCount = allGroups.Count;
        var pageItems = allGroups
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PagedResult<DuplicateGroupDto>
        {
            Items = pageItems,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    private static List<Member> FilterDismissed(
        IReadOnlyList<Member> bucket,
        HashSet<(Guid, Guid)> dismissedSet,
        MatchTier tier)
    {
        // For Exact groups: a member stays in the group as long as it has at least one
        // non-dismissed peer within the group. (Same shape as Likely; only the pair-evaluation
        // step is different — for Exact we already know every in-bucket pair matches.)
        _ = tier;
        if (dismissedSet.Count == 0)
            return bucket.ToList();

        var alive = new HashSet<Guid>(bucket.Select(m => m.Id));
        var survivors = new List<Member>();
        foreach (var m in bucket)
        {
            var hasLivePeer = false;
            foreach (var n in bucket)
            {
                if (n.Id == m.Id || !alive.Contains(n.Id))
                    continue;
                var pair = DuplicateCandidateDismissal.Canonicalise(m.Id, n.Id);
                if (!dismissedSet.Contains(pair))
                {
                    hasLivePeer = true;
                    break;
                }
            }
            if (hasLivePeer)
                survivors.Add(m);
        }
        return survivors;
    }
}
