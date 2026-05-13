using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Members.Queries;

/// <summary>
/// REQ-018: Resolves duplicate-candidate members for an Admin search input.
/// </summary>
public sealed class FindMemberDuplicatesQueryHandler
    : IRequestHandler<FindMemberDuplicatesQuery, IReadOnlyList<DuplicateCandidateDto>>
{
    private const int MaxResults = 20;
    private const int RepositoryOverFetchFactor = 4;

    private readonly IMemberRepository _repository;
    private readonly IDuplicateMatcher _matcher;

    public FindMemberDuplicatesQueryHandler(IMemberRepository repository, IDuplicateMatcher matcher)
    {
        _repository = repository;
        _matcher = matcher;
    }

    public async Task<IReadOnlyList<DuplicateCandidateDto>> Handle(
        FindMemberDuplicatesQuery request,
        CancellationToken cancellationToken)
    {
        var emailNormalized = _matcher.NormalizeEmail(request.Email);
        var phoneDigits = _matcher.NormalizePhoneDigits(request.Phone);
        var firstNameFolded = _matcher.FoldName(request.FirstName);
        var lastNameFolded = _matcher.FoldName(request.LastName);
        var postalCode = request.PostalCode?.Trim() ?? string.Empty;

        var hasAnySignal = emailNormalized.Length > 0
            || phoneDigits.Length > 0
            || (firstNameFolded.Length > 0 && lastNameFolded.Length > 0)
            || postalCode.Length > 0;

        if (!hasAnySignal)
            return Array.Empty<DuplicateCandidateDto>();

        var candidates = await _repository.FindCandidatesAsync(
            emailNormalized.Length > 0 ? emailNormalized : null,
            phoneDigits.Length > 0 ? phoneDigits : null,
            firstNameFolded.Length > 0 ? firstNameFolded : null,
            lastNameFolded.Length > 0 ? lastNameFolded : null,
            postalCode.Length > 0 ? postalCode : null,
            request.ExcludeMemberId,
            MaxResults * RepositoryOverFetchFactor,
            cancellationToken);

        // Build a synthetic input Member so we can reuse the matcher's rules.
        // The placeholder street value is intentionally chosen so the matcher's
        // PostalAndStreet rule cannot fire from the input side alone.
        var inputAddress = Address.Create(
            street: "__none__",
            city: "__none__",
            postalCode: postalCode.Length > 0 ? postalCode : "0000",
            country: "Schweiz");

        var inputMember = Member.Create(
            firstName: request.FirstName ?? string.Empty,
            lastName: request.LastName ?? string.Empty,
            email: request.Email ?? string.Empty,
            address: inputAddress,
            membershipType: IabConnect.Domain.Members.MembershipType.Regular,
            phone: request.Phone);

        var matches = new List<DuplicateCandidateDto>(candidates.Count);
        foreach (var candidate in candidates)
        {
            var (tier, reason) = _matcher.EvaluateCandidate(inputMember, candidate);
            if (tier is null)
                continue;

            matches.Add(MapToDto(candidate, tier.Value, reason));
        }

        return matches
            .OrderBy(m => m.MatchTier)            // Exact (0) before Likely (1)
            .ThenBy(m => m.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(m => m.FirstName, StringComparer.OrdinalIgnoreCase)
            .Take(MaxResults)
            .ToList();
    }

    /// <summary>
    /// Public static so tests can import the mapping directly. AC-6 privacy surface:
    /// Phone, Address, KeycloakUserId are intentionally excluded.
    /// </summary>
    public static DuplicateCandidateDto MapToDto(Member member, MatchTier tier, MatchReason reason) => new()
    {
        Id = member.Id,
        FirstName = member.FirstName,
        LastName = member.LastName,
        Email = member.Email,
        MembershipStatus = member.Status,
        MemberSince = member.MemberSince,
        MatchTier = tier,
        MatchReason = reason
    };
}
