using IabConnect.Domain.Members;

namespace IabConnect.Application.Members.Duplicates;

/// <summary>
/// REQ-018: Admin-review surface for a duplicate-candidate member.
/// </summary>
/// <remarks>
/// Privacy-respecting projection: Address, Phone and KeycloakUserId are deliberately
/// omitted even though they may have contributed to the match decision.
/// See <see cref="MatchReason"/> for which signals fired.
/// </remarks>
public sealed record DuplicateCandidateDto
{
    public required Guid Id { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public required string Email { get; init; }
    public required MembershipStatus MembershipStatus { get; init; }
    public required DateOnly MemberSince { get; init; }
    public required MatchTier MatchTier { get; init; }
    public required MatchReason MatchReason { get; init; }
}

/// <summary>
/// Confidence tier for a duplicate-candidate match.
/// </summary>
public enum MatchTier
{
    /// <summary>Exact match on a normalized identifier (currently: email).</summary>
    Exact = 0,

    /// <summary>Probable match based on normalized name plus at least one contact signal.</summary>
    Likely = 1
}

/// <summary>
/// Bit-flags indicating which signals contributed to a duplicate-candidate match.
/// </summary>
/// <remarks>
/// <see cref="NameOnly"/> is a diagnostic flag indicating the normalized first+last
/// name agreed; on its own it is NEVER enough to fire a match (AC-3).
/// </remarks>
[Flags]
public enum MatchReason
{
    None = 0,
    Email = 1,
    NormalizedPhone = 2,
    PostalAndStreet = 4,
    EmailLocalPart = 8,
    NameOnly = 16
}
