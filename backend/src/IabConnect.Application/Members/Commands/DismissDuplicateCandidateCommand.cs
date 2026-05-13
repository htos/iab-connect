using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S4): Record a Vorstand-issued "this pair is NOT a duplicate" decision.
///
/// <para>The handler normalises the pair to canonical order (smaller GUID first), looks up an
/// existing dismissal row, and either returns the existing row (idempotent) or inserts a new
/// one. A <c>LogAccessGranted</c> audit entry is written with <c>Action = "DuplicateDismiss"</c>.</para>
/// </summary>
public sealed record DismissDuplicateCandidateCommand(
    Guid MemberA,
    Guid MemberB,
    string Reason,
    Guid DismissedByUserId) : IRequest<DismissDuplicateCandidateResult>;

/// <summary>
/// REQ-018 (E2.S4): outcome of a dismissal. <c>Created</c> is <c>true</c> for fresh inserts and
/// <c>false</c> for the idempotent-no-op path (a dismissal already existed for the pair).
/// </summary>
public sealed record DismissDuplicateCandidateResult(
    Guid DismissalId,
    Guid SourceMemberId,
    Guid TargetMemberId,
    bool Created);
