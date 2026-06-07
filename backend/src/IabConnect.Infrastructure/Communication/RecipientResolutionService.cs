using System.Text.Json;
using IabConnect.Application.Communication.Automations;
using IabConnect.Application.Members.Segments;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Communication;

/// <summary>
/// REQ-028 (E5-S1, DEC-3): the single recipient-resolution implementation consumed by the
/// automation recipient-preview (S1) and the automation dispatch engine (S2). Resolves a recipient
/// set from a <see cref="RecipientSegmentType"/> + optional segment id + optional
/// <see cref="ConsentType"/> filter, honouring the active-member filter, the <c>MemberSegment</c>
/// criteria/assignments (REQ-017, via the relocated <see cref="MemberSegmentCriteria"/>), and
/// consent (<see cref="IConsentRepository.GetUsersWithConsentAsync"/>) — identically to how the
/// campaign Newsletter segment already filters.
///
/// <para>Automations target users with accounts/consent (consent + channel preference are keyed by
/// Keycloak user id), so this resolves <b>members</b> only — external newsletter subscribers (no
/// account, no consent record) are intentionally out of scope here, unlike the campaign path which
/// also blasts external subscribers.</para>
/// </summary>
public sealed class RecipientResolutionService : IRecipientResolutionService
{
    private static readonly JsonSerializerOptions CriteriaJsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly ApplicationDbContext _dbContext;
    private readonly IMemberSegmentRepository _segments;
    private readonly IConsentRepository _consents;

    public RecipientResolutionService(
        ApplicationDbContext dbContext,
        IMemberSegmentRepository segments,
        IConsentRepository consents)
    {
        _dbContext = dbContext;
        _segments = segments;
        _consents = consents;
    }

    public async Task<IReadOnlyList<ResolvedRecipient>> ResolveAsync(
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter,
        CancellationToken cancellationToken = default)
    {
        var members = await ResolveMembersAsync(segmentType, segmentFilter, cancellationToken);

        // The NewsletterSubscribers segment implies the Newsletter consent gate (mirrors campaigns).
        if (segmentType == RecipientSegmentType.NewsletterSubscribers)
            members = await ApplyConsentFilterAsync(members, ConsentType.Newsletter, cancellationToken);

        // An explicit consent filter on the definition is applied on top.
        if (consentFilter.HasValue)
            members = await ApplyConsentFilterAsync(members, consentFilter.Value, cancellationToken);

        return members
            .Select(m => new ResolvedRecipient(m.KeycloakUserId, m.Id, m.Email, m.FirstName, m.LastName))
            .ToList();
    }

    public async Task<RecipientPreviewResult> PreviewAsync(
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter,
        int sampleSize = 10,
        CancellationToken cancellationToken = default)
    {
        var all = await ResolveAsync(segmentType, segmentFilter, consentFilter, cancellationToken);
        var sample = all.Take(Math.Max(0, sampleSize)).ToList();
        return new RecipientPreviewResult(all.Count, sample);
    }

    private async Task<List<Member>> ResolveMembersAsync(
        RecipientSegmentType segmentType, string? segmentFilter, CancellationToken ct)
    {
        if (segmentType == RecipientSegmentType.MemberSegment && Guid.TryParse(segmentFilter, out var segmentId))
        {
            var segment = await _segments.GetByIdWithAssignmentsAsync(segmentId, ct);
            if (segment is null)
                return [];

            IQueryable<Member> membersQuery;
            if (segment.SegmentType == SegmentType.Dynamic && !string.IsNullOrWhiteSpace(segment.CriteriaJson))
            {
                var criteria = JsonSerializer.Deserialize<SegmentCriteria>(segment.CriteriaJson, CriteriaJsonOptions);
                membersQuery = _dbContext.Members.AsQueryable();
                if (criteria != null)
                    membersQuery = MemberSegmentCriteria.Apply(membersQuery, criteria);
            }
            else
            {
                var memberIds = segment.Assignments.Select(a => a.MemberId).ToList();
                membersQuery = _dbContext.Members.Where(m => memberIds.Contains(m.Id));
            }

            return await membersQuery
                .Where(m => m.Email != null && m.Email != "")
                .ToListAsync(ct);
        }

        // AllActiveMembers / NewsletterSubscribers / Custom / Manual / EventParticipants → all active
        // members with an email (consent gates are applied by the caller on top).
        return await _dbContext.Members
            .Where(m => m.Status == MembershipStatus.Active && m.Email != null && m.Email != "")
            .ToListAsync(ct);
    }

    private async Task<List<Member>> ApplyConsentFilterAsync(
        List<Member> members, ConsentType consentType, CancellationToken ct)
    {
        var consentedUserIds = await _consents.GetUsersWithConsentAsync(consentType, ct);
        var consentedSet = consentedUserIds.ToHashSet();
        return members
            .Where(m => m.KeycloakUserId.HasValue && consentedSet.Contains(m.KeycloakUserId.Value))
            .ToList();
    }
}
