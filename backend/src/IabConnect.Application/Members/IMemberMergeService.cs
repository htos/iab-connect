using IabConnect.Application.Members.Commands;

namespace IabConnect.Application.Members;

/// <summary>
/// REQ-018 (E2.S3): infrastructure-level orchestration for the safe member merge.
///
/// <para>Encapsulates blocker evaluation, transactional reference rewrites, soft-retire of the
/// source, and the append-only audit row write. The MediatR handler is a thin wrapper that
/// validates the command and routes exceptions to HTTP status codes — all SQL/transaction
/// concerns live in the Infrastructure implementation of this interface.</para>
///
/// <para>Throws:
/// <list type="bullet">
///   <item><see cref="KeyNotFoundException"/> if source or target member does not exist (or is already merged).</item>
///   <item><see cref="UnsafeMergeException"/> if any of the AC-3 blocker rules fire (the <c>Reasons</c> list is the 409 body).</item>
/// </list>
/// On success returns the <see cref="MergeMembersResult"/> with per-aggregate move counts and
/// the audit-event row id.</para>
/// </summary>
public interface IMemberMergeService
{
    Task<MergeMembersResult> MergeAsync(
        MergeMembersCommand command,
        CancellationToken cancellationToken = default);
}
