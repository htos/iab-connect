using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;

namespace IabConnect.Application.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S1, DEC-3): a single resolved recipient — the member/user identity needed to send
/// and to record per-recipient execution state (S2). <see cref="UserId"/> is the Keycloak user id
/// (null for members without a linked account); <see cref="MemberId"/> is the domain member id.
/// </summary>
public sealed record ResolvedRecipient(
    Guid? UserId,
    Guid? MemberId,
    string Email,
    string? FirstName,
    string? LastName)
{
    public string FullName => string.Join(" ", new[] { FirstName, LastName }
        .Where(s => !string.IsNullOrWhiteSpace(s))).Trim();
}

/// <summary>
/// REQ-028 (E5-S1, DEC-3): the single recipient-resolution implementation consumed by the
/// automation recipient-preview (S1) and the automation dispatch engine (S2). Resolves a
/// recipient set from a <see cref="RecipientSegmentType"/> + optional segment id + optional
/// <see cref="ConsentType"/> filter, honouring the active-member filter, the <c>MemberSegment</c>
/// criteria/assignments (REQ-017), and consent (<see cref="IConsentRepository"/>) — identically to
/// how the campaign Newsletter segment already filters.
///
/// <para>Note (DEC-3): the existing campaign send paths (<c>EmailCampaignSendJob</c> /
/// <c>EmailCampaignEndpoints</c>) are NOT refactored onto this service in S1 — the spike found
/// their dynamic-segment resolution reaches into the Api layer (<c>MemberSegmentEndpoints</c>), so
/// consolidating them is a larger, separately-tracked change that must not regress campaigns. The
/// shared, single-source piece is the criteria evaluator (<c>MemberSegmentCriteria</c>, relocated
/// to Application), which both this service and the campaign endpoint now use.</para>
/// </summary>
public interface IRecipientResolutionService
{
    /// <summary>Resolve the full recipient set for a recipient rule (consent honoured at call time).</summary>
    Task<IReadOnlyList<ResolvedRecipient>> ResolveAsync(
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter,
        CancellationToken cancellationToken = default);

    /// <summary>Resolve a count + a bounded sample for the "preview recipients before activation" UI.</summary>
    Task<RecipientPreviewResult> PreviewAsync(
        RecipientSegmentType segmentType,
        string? segmentFilter,
        ConsentType? consentFilter,
        int sampleSize = 10,
        CancellationToken cancellationToken = default);
}

/// <summary>Count + bounded sample returned by <see cref="IRecipientResolutionService.PreviewAsync"/>.</summary>
public sealed record RecipientPreviewResult(int TotalCount, IReadOnlyList<ResolvedRecipient> Sample);
