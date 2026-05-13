using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// REQ-018 (E2.S4): a Vorstand-recorded "this pair is NOT a duplicate" decision.
/// </summary>
/// <remarks>
/// The pair is persisted in canonical order (<c>SourceMemberId &lt; TargetMemberId</c> by GUID
/// comparison) so the unique index can enforce one row per unordered pair without callers
/// having to know the orientation. The application-layer command handler is responsible for
/// canonicalisation before insert.
///
/// <para>Dismissal is one-way for E2.S4 — there is no Undo UI in this story; a future story
/// may add a re-evaluation path. The row carries the dismissing user and free-text Reason
/// for audit forensics; the dismissal itself also writes a <c>LogAccessGranted</c> audit row.</para>
/// </remarks>
public sealed class DuplicateCandidateDismissal : Entity
{
    public Guid SourceMemberId { get; private set; }
    public Guid TargetMemberId { get; private set; }
    public Guid DismissedByUserId { get; private set; }
    public DateTime DismissedAt { get; private set; }
    public string Reason { get; private set; } = null!;

    private DuplicateCandidateDismissal() : base() { }

    /// <summary>
    /// Creates a dismissal row with the pair already canonicalised
    /// (<paramref name="sourceMemberId"/> &lt; <paramref name="targetMemberId"/> by Guid comparison).
    /// </summary>
    public static DuplicateCandidateDismissal Create(
        Guid sourceMemberId,
        Guid targetMemberId,
        Guid dismissedByUserId,
        string reason)
    {
        if (sourceMemberId == Guid.Empty)
            throw new ArgumentException("Source member id must not be empty.", nameof(sourceMemberId));
        if (targetMemberId == Guid.Empty)
            throw new ArgumentException("Target member id must not be empty.", nameof(targetMemberId));
        if (sourceMemberId == targetMemberId)
            throw new ArgumentException("A member cannot be dismissed against itself.", nameof(targetMemberId));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Reason is required.", nameof(reason));

        var (canonicalSource, canonicalTarget) = Canonicalise(sourceMemberId, targetMemberId);

        return new DuplicateCandidateDismissal
        {
            SourceMemberId = canonicalSource,
            TargetMemberId = canonicalTarget,
            DismissedByUserId = dismissedByUserId,
            DismissedAt = DateTime.UtcNow,
            Reason = reason.Trim(),
        };
    }

    /// <summary>
    /// Returns the pair in canonical order so callers can compute the unique key without
    /// instantiating an entity. <c>Item1</c> is the smaller GUID, <c>Item2</c> the larger.
    /// </summary>
    public static (Guid Source, Guid Target) Canonicalise(Guid a, Guid b)
        => a.CompareTo(b) < 0 ? (a, b) : (b, a);
}
