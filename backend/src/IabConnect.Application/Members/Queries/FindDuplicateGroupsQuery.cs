using IabConnect.Application.Common;
using IabConnect.Application.Members.Duplicates;
using MediatR;

namespace IabConnect.Application.Members.Queries;

/// <summary>
/// REQ-018 (E2.S4): Cross-table scan for duplicate-candidate groups across the entire
/// member table. Returns a page of <see cref="DuplicateGroupDto"/>; dismissed pairs
/// (see <c>DuplicateCandidateDismissal</c>) are filtered out before paging.
/// </summary>
/// <param name="Page">1-based page number. Values &lt; 1 are coerced to 1.</param>
/// <param name="PageSize">Page size. Values &lt; 1 are coerced to 1; values &gt; 100 are coerced to 100.</param>
/// <param name="MinTier">Minimum confidence tier to return. <c>null</c> = both Exact and Likely; <c>Exact</c> = only exact-email groups; <c>Likely</c> = both (since Likely is the higher number, the filter behaves as "tier &lt;= MinTier").</param>
public sealed record FindDuplicateGroupsQuery(
    int Page = 1,
    int PageSize = 20,
    MatchTier? MinTier = null) : IRequest<PagedResult<DuplicateGroupDto>>;

/// <summary>
/// REQ-018 (E2.S4): a group of members that the cross-table scan flagged as duplicates of each other.
/// </summary>
/// <param name="GroupKey">Stable identifier (normalized email for Exact tier; "folded-first|folded-last|postal" for Likely tier). Useful for client-side keying / refresh discipline.</param>
/// <param name="Tier">Confidence tier of the group. All pairs within the group share the tier.</param>
/// <param name="Members">All members in the group. Sorted by last name then first name.</param>
public sealed record DuplicateGroupDto(
    string GroupKey,
    MatchTier Tier,
    IReadOnlyList<DuplicateCandidateDto> Members);
