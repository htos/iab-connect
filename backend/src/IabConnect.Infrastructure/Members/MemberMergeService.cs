using System.Text.Json;
using IabConnect.Application.Audit;
using IabConnect.Application.Members;
using IabConnect.Application.Members.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Members;

/// <summary>
/// REQ-018 (E2.S3): infrastructure-level orchestration for the safe member merge.
/// All transactional SQL, blocker evaluation, ExecuteUpdate/ExecuteDelete rewrites, and the
/// append-only audit-row write live here so the Application-layer handler stays thin.
/// </summary>
public sealed class MemberMergeService : IMemberMergeService
{
    private readonly ApplicationDbContext _context;
    private readonly IMemberRepository _memberRepository;
    private readonly IAuditService _auditService;

    private static readonly InvoiceStatus[] BlockingInvoiceStatuses =
    {
        InvoiceStatus.Sent,
        InvoiceStatus.Paid,
        InvoiceStatus.Overdue,
    };

    private static readonly ExpenseClaimStatus[] BlockingExpenseClaimStatuses =
    {
        ExpenseClaimStatus.Submitted,
        ExpenseClaimStatus.UnderReview,
        ExpenseClaimStatus.Approved,
        ExpenseClaimStatus.Reimbursed,
    };

    public MemberMergeService(
        ApplicationDbContext context,
        IMemberRepository memberRepository,
        IAuditService auditService)
    {
        _context = context;
        _memberRepository = memberRepository;
        _auditService = auditService;
    }

    public async Task<MergeMembersResult> MergeAsync(
        MergeMembersCommand command,
        CancellationToken cancellationToken = default)
    {
        // REQ-018 review patch: open the transaction BEFORE the blocker reads and take a row-level
        // lock (FOR UPDATE) on the source member, so a concurrent admin cannot slip a draft
        // invoice / expense claim in between the blocker count and the rewrite. The lock is held
        // until the transaction commits or rolls back.
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        _ = await _context.Members
            .FromSqlInterpolated($"SELECT * FROM members WHERE id = {command.SourceId} FOR UPDATE")
            .AsTracking()
            .ToListAsync(cancellationToken);

        // Step 1: load source + target. Note GetByIdAsync still returns merged rows for forensics --
        // we explicitly reject already-merged sources via the blocker list.
        var source = await _memberRepository.GetByIdAsync(command.SourceId, cancellationToken)
            ?? throw new KeyNotFoundException($"Source member {command.SourceId} not found.");
        var target = await _memberRepository.GetByIdAsync(command.TargetId, cancellationToken)
            ?? throw new KeyNotFoundException($"Target member {command.TargetId} not found.");

        // Step 2: blocker checks (synchronous list, returned verbatim in the 409 body).
        var blockers = new List<string>();

        if (command.SourceId == command.TargetId)
            blockers.Add("Source and target member must differ.");

        if (source.MergedIntoMemberId.HasValue)
            blockers.Add($"Source member {command.SourceId} is already merged into {source.MergedIntoMemberId.Value}.");
        if (target.MergedIntoMemberId.HasValue)
            blockers.Add($"Target member {command.TargetId} is itself merged into {target.MergedIntoMemberId.Value} -- merge into the final target instead.");

        var sentInvoiceCount = await _context.Set<Invoice>()
            .Where(i => i.RecipientType == RecipientType.Member
                        && i.RecipientId == command.SourceId
                        && BlockingInvoiceStatuses.Contains(i.Status))
            .CountAsync(cancellationToken);
        if (sentInvoiceCount > 0)
            blockers.Add($"Source has {sentInvoiceCount} sent/paid/overdue invoice(s); reverse or cancel before merging.");

        var draftInvoiceCount = await _context.Set<Invoice>()
            .Where(i => i.RecipientType == RecipientType.Member
                        && i.RecipientId == command.SourceId
                        && i.Status == InvoiceStatus.Draft)
            .CountAsync(cancellationToken);
        if (draftInvoiceCount > 0 && !command.ConfirmFinanceImpact)
            blockers.Add($"Source has {draftInvoiceCount} draft invoice(s); set ConfirmFinanceImpact = true to reassign.");

        var blockingClaimCount = await _context.Set<ExpenseClaim>()
            .Where(e => e.ClaimantId == command.SourceId
                        && BlockingExpenseClaimStatuses.Contains(e.Status))
            .CountAsync(cancellationToken);
        if (blockingClaimCount > 0)
            blockers.Add($"Source has {blockingClaimCount} non-draft expense claim(s); only Draft claims are reassignable.");

        // REQ-018 review patch: hard-reject when both members have a Keycloak link. Previously this
        // path allowed `ConfirmKeycloakImpact = true` to silently clear the source's link with no
        // Keycloak-side cleanup — the orphaned Keycloak user could still log in and re-provision a
        // new member via JIT. Admin must now resolve the source identity in Keycloak before merging
        // (disable / delete / re-link). `ConfirmKeycloakImpact` retains meaning for the
        // source-has-link-target-doesn't transfer branch only.
        if (source.KeycloakUserId.HasValue && target.KeycloakUserId.HasValue)
        {
            blockers.Add("Both members have a Keycloak link; disable or delete the source user in Keycloak before merging.");
        }

        if (blockers.Count > 0)
            throw new UnsafeMergeException(blockers);

        // Step 3: reference rewrites + soft-retire + audit row, inside the transaction opened above.
        var moved = new Dictionary<string, int>();

        // 3a) MemberSegmentAssignment with pre-dedupe on (MemberId, SegmentId)
        var dedupedSegments = await _context.Set<MemberSegmentAssignment>()
            .Where(a => a.MemberId == command.SourceId
                        && _context.Set<MemberSegmentAssignment>()
                            .Any(t => t.MemberId == command.TargetId && t.SegmentId == a.SegmentId))
            .ExecuteDeleteAsync(cancellationToken);
        moved["MemberSegmentAssignment.PreDeduped"] = dedupedSegments;

        var movedSegments = await _context.Set<MemberSegmentAssignment>()
            .Where(a => a.MemberId == command.SourceId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(a => a.MemberId, command.TargetId),
                cancellationToken);
        moved["MemberSegmentAssignment"] = movedSegments;

        // 3b) EventRegistration with pre-dedupe on (EventId, MemberId).
        // REQ-018 review patch: even though no unique constraint exists today on the table, a
        // straight rewrite would cause the target to appear registered twice for the same event,
        // inflating capacity counts and confusing the registrations UI. Pre-dedupe matches the
        // MemberSegmentAssignment pattern above.
        var dedupedRegistrations = await _context.Set<Domain.Events.EventRegistration>()
            .Where(r => r.MemberId == command.SourceId
                        && _context.Set<Domain.Events.EventRegistration>()
                            .Any(t => t.MemberId == command.TargetId && t.EventId == r.EventId))
            .ExecuteDeleteAsync(cancellationToken);
        moved["EventRegistration.PreDeduped"] = dedupedRegistrations;

        var movedRegistrations = await _context.Set<Domain.Events.EventRegistration>()
            .Where(r => r.MemberId == command.SourceId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(r => r.MemberId, (Guid?)command.TargetId),
                cancellationToken);
        moved["EventRegistration"] = movedRegistrations;

        // 3c) EmailRecipient with pre-dedupe on (CampaignId, MemberId).
        // REQ-018 review patch: a unique constraint on (CampaignId, MemberId) is the very likely
        // shape (one recipient row per campaign per member). Without the pre-dedupe the merge would
        // throw DbUpdateException and abort the whole transaction.
        var dedupedRecipients = await _context.Set<Domain.Communication.EmailRecipient>()
            .Where(r => r.MemberId == command.SourceId
                        && _context.Set<Domain.Communication.EmailRecipient>()
                            .Any(t => t.MemberId == command.TargetId && t.CampaignId == r.CampaignId))
            .ExecuteDeleteAsync(cancellationToken);
        moved["EmailRecipient.PreDeduped"] = dedupedRecipients;

        var movedRecipients = await _context.Set<Domain.Communication.EmailRecipient>()
            .Where(r => r.MemberId == command.SourceId)
            .ExecuteUpdateAsync(
                s => s.SetProperty(r => r.MemberId, (Guid?)command.TargetId),
                cancellationToken);
        moved["EmailRecipient"] = movedRecipients;

        // 3d) ExpenseClaim — Draft + Rejected. REQ-018 review patch: Rejected is a non-terminal,
        // re-submittable status (Domain `ExpenseClaim.ReopenForResubmission` allows Rejected -> Draft);
        // leaving it on the retired source orphans the claim. Reporting filters Rejected today but the
        // record still belongs to the merged identity.
        var movedClaims = await _context.Set<ExpenseClaim>()
            .Where(e => e.ClaimantId == command.SourceId
                        && (e.Status == ExpenseClaimStatus.Draft || e.Status == ExpenseClaimStatus.Rejected))
            .ExecuteUpdateAsync(
                s => s.SetProperty(e => e.ClaimantId, command.TargetId),
                cancellationToken);
        moved["ExpenseClaim.DraftOrRejected"] = movedClaims;

        // 3e) Invoice — Draft + Cancelled, RecipientType=Member only. REQ-018 review patch:
        // Cancelled invoices are not blocked (Sent/Paid/Overdue are), but leaving them on the
        // retired source produces an orphan. Move them with the merged identity for forensic
        // continuity; Sent/Paid/Overdue are blocked upstream and must be reversed first.
        var movedInvoices = await _context.Set<Invoice>()
            .Where(i => i.RecipientType == RecipientType.Member
                        && i.RecipientId == command.SourceId
                        && (i.Status == InvoiceStatus.Draft || i.Status == InvoiceStatus.Cancelled))
            .ExecuteUpdateAsync(
                s => s.SetProperty(i => i.RecipientId, (Guid?)command.TargetId),
                cancellationToken);
        moved["Invoice.DraftOrCancelled"] = movedInvoices;

        // 3f) Keycloak link transfer. REQ-018 review patch: split the SaveChanges so the unique
        // partial index `ix_members_keycloak_user_id` never sees two rows holding the same value
        // simultaneously. Clear source first, flush, then assign target. The both-have-links case
        // is blocked upstream so this branch is the only transfer path that can run.
        string keycloakBranch;
        if (source.KeycloakUserId.HasValue)
        {
            // Capture before clearing so the value survives the in-place mutation.
            var keycloakUserIdToTransfer = source.KeycloakUserId.Value;
            source.ClearKeycloakLink();
            _memberRepository.Update(source);
            await _context.SaveChangesAsync(cancellationToken);

            target.LinkToKeycloak(keycloakUserIdToTransfer);
            keycloakBranch = "transferred";
        }
        else
        {
            keycloakBranch = "no-source-link";
        }
        moved["Member.KeycloakLink"] = keycloakBranch == "no-source-link" ? 0 : 1;

        // Step 4: soft-retire the source member (sets MergedIntoMemberId + Status=Inactive + domain event).
        source.MarkMergedInto(command.TargetId, command.AdminUserId);
        _memberRepository.Update(source);
        _memberRepository.Update(target);

        // Persist source soft-retire + target Keycloak link (target may also still be unchanged).
        await _context.SaveChangesAsync(cancellationToken);

        // Step 5: append-only audit row -- never rewrite existing audit history.
        var auditDetails = JsonSerializer.Serialize(new
        {
            command.SourceId,
            command.TargetId,
            MovedReferences = moved,
            command.Reason,
            command.AdminUserId,
            KeycloakBranch = keycloakBranch,
        });

        var auditEvent = AuditEvent.Create(
            AuditEventType.MemberMerged,
            AuditCategory.MemberManagement,
            $"Member {command.SourceId} merged into {command.TargetId}",
            command.AdminUserId.ToString(),
            command.AdminUserName,
            "Member",
            command.TargetId.ToString(),
            auditDetails,
            severity: AuditSeverity.Info);

        await _auditService.LogAsync(auditEvent, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new MergeMembersResult(
            command.TargetId,
            command.SourceId,
            moved,
            auditEvent.Id);
    }
}
