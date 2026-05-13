using MediatR;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S3): Merge the <paramref name="SourceId"/> member into <paramref name="TargetId"/>.
///
/// <para>
/// The source member is soft-retired (not hard-deleted), every aggregate referencing the source
/// is rewritten to the target inside a single transaction, and one append-only <c>AuditEvent</c>
/// row is written.
/// </para>
/// <para>
/// <c>ConfirmFinanceImpact</c> is required when the source has any <c>Draft</c> invoice
/// (draft invoices are reassignable but the admin must confirm). <c>ConfirmKeycloakImpact</c>
/// is required when both source AND target have a Keycloak link (the source's link will be cleared).
/// </para>
/// <para>
/// <c>AdminUserId</c> is the GUID of the calling admin (Keycloak sub claim). The endpoint resolves
/// it from <c>HttpContext.User</c> and passes it into the command so the handler stays free of
/// HTTP concerns.
/// </para>
/// </summary>
public sealed record MergeMembersCommand(
    Guid SourceId,
    Guid TargetId,
    string Reason,
    bool ConfirmFinanceImpact,
    bool ConfirmKeycloakImpact,
    Guid AdminUserId,
    string AdminUserName) : IRequest<MergeMembersResult>;

/// <summary>
/// REQ-018 (E2.S3): outcome of a successful merge operation.
/// <c>MovedReferences</c> is keyed by aggregate name (e.g. <c>MemberSegmentAssignment</c>) and
/// contains the row count that was rewritten from source to target. Always includes every aggregate
/// the handler touched (zero is recorded as zero — never omitted).
/// </summary>
public sealed record MergeMembersResult(
    Guid TargetId,
    Guid SourceId,
    IReadOnlyDictionary<string, int> MovedReferences,
    Guid AuditEventId);
