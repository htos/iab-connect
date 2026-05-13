namespace IabConnect.Application.Members;

/// <summary>
/// REQ-018 (E2.S3): thrown by <c>MergeMembersCommandHandler</c> when one or more precondition
/// blockers fire (e.g. source has a Sent invoice, source has an Approved expense claim, both members
/// have Keycloak links without confirmation). The <see cref="Reasons"/> list goes verbatim into
/// the 409 HTTP body — strings MUST NOT include other members' PII; use entity IDs only.
/// </summary>
public sealed class UnsafeMergeException : Exception
{
    public IReadOnlyList<string> Reasons { get; }

    public UnsafeMergeException(IReadOnlyList<string> reasons)
        : base($"Merge refused: {reasons.Count} blocker(s) -- {string.Join("; ", reasons)}")
    {
        Reasons = reasons;
    }
}
