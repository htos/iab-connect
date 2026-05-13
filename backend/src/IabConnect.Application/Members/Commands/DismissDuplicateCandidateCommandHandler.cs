using IabConnect.Application.Common;
using IabConnect.Domain.Members;
using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S4): handler for <see cref="DismissDuplicateCandidateCommand"/>.
///
/// <para>Order of operations:</para>
/// <list type="number">
///   <item>Validate via the FluentValidation pipeline (registered globally).</item>
///   <item>Load both members; throw <see cref="KeyNotFoundException"/> if either is missing or
///         already merged (the duplicates page should never propose retired rows).</item>
///   <item>Canonicalise the pair (smaller GUID first) so the unique index can enforce
///         "one row per unordered pair."</item>
///   <item>Look up an existing dismissal — if present, return it (idempotent).</item>
///   <item>Insert a new dismissal row, commit, return.</item>
/// </list>
///
/// <para>The endpoint layer writes the <c>LogAccessGranted</c> audit row with
/// <c>Action = "DuplicateDismiss"</c> — keeping the audit-logger out of this handler matches the
/// existing pattern in <c>CreateMember</c> / <c>MergeMember</c>.</para>
/// </summary>
public sealed class DismissDuplicateCandidateCommandHandler
    : IRequestHandler<DismissDuplicateCandidateCommand, DismissDuplicateCandidateResult>
{
    private readonly IMemberRepository _memberRepository;
    private readonly IDuplicateCandidateDismissalRepository _dismissalRepository;

    public DismissDuplicateCandidateCommandHandler(
        IMemberRepository memberRepository,
        IDuplicateCandidateDismissalRepository dismissalRepository)
    {
        _memberRepository = memberRepository;
        _dismissalRepository = dismissalRepository;
    }

    public async Task<DismissDuplicateCandidateResult> Handle(
        DismissDuplicateCandidateCommand request,
        CancellationToken cancellationToken)
    {
        var memberA = await _memberRepository.GetByIdAsync(request.MemberA, cancellationToken)
            ?? throw new KeyNotFoundException($"Member {request.MemberA} not found.");
        var memberB = await _memberRepository.GetByIdAsync(request.MemberB, cancellationToken)
            ?? throw new KeyNotFoundException($"Member {request.MemberB} not found.");

        if (memberA.MergedIntoMemberId.HasValue)
            throw new KeyNotFoundException(
                $"Member {request.MemberA} is merged into {memberA.MergedIntoMemberId.Value}; cannot dismiss.");
        if (memberB.MergedIntoMemberId.HasValue)
            throw new KeyNotFoundException(
                $"Member {request.MemberB} is merged into {memberB.MergedIntoMemberId.Value}; cannot dismiss.");

        var (canonicalSource, canonicalTarget) = DuplicateCandidateDismissal.Canonicalise(
            request.MemberA, request.MemberB);

        var existing = await _dismissalRepository.GetByCanonicalPairAsync(
            canonicalSource, canonicalTarget, cancellationToken);
        if (existing is not null)
        {
            return new DismissDuplicateCandidateResult(
                DismissalId: existing.Id,
                SourceMemberId: existing.SourceMemberId,
                TargetMemberId: existing.TargetMemberId,
                Created: false);
        }

        var dismissal = DuplicateCandidateDismissal.Create(
            sourceMemberId: canonicalSource,
            targetMemberId: canonicalTarget,
            dismissedByUserId: request.DismissedByUserId,
            reason: request.Reason);

        // REQ-018 review patch: AddAtomicAsync handles the concurrent-dismissal race window
        // internally (Infrastructure catches DbUpdateException on the unique-pair violation and
        // returns the winning row). The Application layer stays free of EF Core types.
        var (persisted, created) = await _dismissalRepository.AddAtomicAsync(dismissal, cancellationToken);

        return new DismissDuplicateCandidateResult(
            DismissalId: persisted.Id,
            SourceMemberId: persisted.SourceMemberId,
            TargetMemberId: persisted.TargetMemberId,
            Created: created);
    }
}
