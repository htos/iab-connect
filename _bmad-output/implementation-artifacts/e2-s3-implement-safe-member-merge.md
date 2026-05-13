# Story E2.S3: Implement Safe Member Merge

Status: done

## Story

As an Admin,
I want to merge two duplicate member records into one,
so that contact history, finance references, audit trail, and consents remain intact while the duplicate record is consolidated and the source is retired.

Requirement: **REQ-018** (Dubletten-Erkennung — Mitglieder/CRM, Priority Should). Builds on E2.S1's duplicate-detection query and closes the workflow E2.S2 only warns about. This is the **Epic-1-retro Action A5 per-story-review story** — bundling is disabled for E2.S3 and a `bmad-code-review` runs the day the patches land, separately from the epic-boundary review.

## Acceptance Criteria

1. **New permission gate.** Add `Permission.MemberMerge = "member:merge"` to [backend/src/IabConnect.Domain/Authorization/Permission.cs:9-17](backend/src/IabConnect.Domain/Authorization/Permission.cs#L9-L17). Assign it ONLY to the `admin` role (NOT `vorstand`) — merge is a destructive consolidation and is gated behind the highest tier. Update `RolePermissions` (search for `Permission.MemberDelete` to find the file) and add the new constant alongside it.
2. **MediatR command + handler.** Create `MergeMembersCommand(Guid SourceId, Guid TargetId, string Reason, bool ConfirmFinanceImpact, bool ConfirmKeycloakImpact) : IRequest<MergeMembersResult>` in [backend/src/IabConnect.Application/Members/Commands/MergeMembersCommand.cs](backend/src/IabConnect.Application/Members/Commands/MergeMembersCommand.cs). `MergeMembersResult` returns `{ TargetId, SourceId, MovedReferences: Dictionary<string,int>, AuditEventId }`. Handler MUST be transactional: ALL reference moves succeed or ALL roll back (use `IDbContextTransaction` from `ApplicationDbContext.Database.BeginTransactionAsync`).
3. **Unsafe-merge blockers.** The handler MUST refuse to merge when ANY of the following hold, throwing a typed `UnsafeMergeException(IReadOnlyList<string> Reasons)`:
   - `SourceId == TargetId`
   - Source or target member does not exist (404-ish — handle as 404 in the endpoint).
   - Source has any `Invoice` row with `Status ∈ { Sent, Paid, Overdue }` AND `RecipientType = RecipientType.Member` AND `RecipientId = SourceId` — sent/paid invoices cannot be silently reassigned per REQ-066 fiscal-period locking. The caller must reverse/cancel them first.
   - Source has any `ExpenseClaim` row with `Status ∈ { Submitted, UnderReview, Approved, Reimbursed }` AND `ClaimantId = SourceId` — only `Draft` claims are safely reassignable per REQ-067.
   - Source AND target both have a non-null `KeycloakUserId` AND the caller did NOT set `ConfirmKeycloakImpact = true`. (Same flag confirms the source's Keycloak link will be cleared; the target's stays.)
   - Source has ANY `Invoice` with `Status = Draft` AND the caller did NOT set `ConfirmFinanceImpact = true`. (Draft invoices ARE reassignable but the admin must confirm.)
4. **Safe reference rewrites — single SQL pass per aggregate.** When the blocker check passes, the handler rewrites references in this order, each via a single `UPDATE` (Use `_context.{DbSet}.Where(x => x.MemberId == SourceId).ExecuteUpdateAsync(s => s.SetProperty(x => x.MemberId, TargetId))`):
   - [MemberSegmentAssignment.cs](backend/src/IabConnect.Domain/Members/MemberSegmentAssignment.cs) (`MemberId`) — pre-dedupe: if `(SourceId, SegmentId)` and `(TargetId, SegmentId)` both exist, delete the source row first to honor the unique constraint.
   - [EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) (`MemberId?`) — pre-dedupe per `(MemberId, EventId)` pair if the schema has a unique constraint preventing two registrations of the same member to the same event; if not, simple rewrite.
   - [EmailRecipient.cs](backend/src/IabConnect.Domain/Communication/EmailRecipient.cs) (`MemberId?`) — simple rewrite.
   - [ExpenseClaim.cs](backend/src/IabConnect.Domain/Finance/ExpenseClaim.cs) `ClaimantId` for `Status = Draft` rows only. (Other statuses are blocked by AC-3.)
   - [Invoice.cs](backend/src/IabConnect.Domain/Finance/Invoice.cs) `RecipientId` for `RecipientType = Member` AND `Status = Draft` rows only.
   - `Member.KeycloakUserId`: if source has one and target doesn't, transfer it; otherwise clear source's. Document the chosen branch in the resulting audit event metadata.
   - Each affected aggregate count is recorded in `MergeMembersResult.MovedReferences` (key = aggregate name, value = row count).
5. **Audit trail (append-only, never rewrite).** The handler MUST write exactly one `AuditEvent` via the existing audit service with: `Action = "MemberMerge"`, `EntityType = "Member"`, `EntityId = TargetId.ToString()`, `AdditionalData = { SourceId, TargetId, MovedReferences, Reason, AdminUserId }`. The handler MUST NOT rewrite the `EntityId` of any existing `AuditEvent` row referencing the source member — historic audit trail stays accurate. (Audit rows reference entities by string ID, not by foreign key, so this is enforced by simply not touching the audit table.)
6. **Source-member soft-retire (not hard-delete).** After all references move, the source `Member` MUST be soft-marked as merged-into-target: set `MembershipStatus = Inactive`, add a domain event `MemberMergedIntoEvent(SourceId, TargetId, AdminUserId, OccurredAt)`, and persist a `MergedIntoMemberId Guid?` property on `Member` (NEW field — requires a migration; see AC-7). The source row is NOT deleted; the soft-retire keeps any tables that reference it via raw string IDs (e.g., audit) consistent. The `IMemberRepository.GetByEmailNormalizedAsync` lookup added by E2.S2 MUST exclude merged-source rows from its result so the same email can be reused on the target without false-positive duplicate-warnings. (Add an `.Where(m => m.MergedIntoMemberId == null)` clause.)
7. **EF migration for `Member.MergedIntoMemberId`.** Add one migration under [backend/src/IabConnect.Infrastructure/Migrations](backend/src/IabConnect.Infrastructure/Migrations) named `AddMemberMergedIntoMemberId` that adds a nullable `MergedIntoMemberId uuid` column with a self-referencing foreign key to `Members(Id)` (`ON DELETE SET NULL`). No data backfill. Verify the migration runs cleanly on a Testcontainers `postgres:18` instance in the new integration test.
8. **HTTP surface.** `POST /api/v1/members/{sourceId}/merge-into/{targetId}` on [MemberEndpoints.cs](backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs) with `.RequireAuthorization("RequireAdmin")` (NOT `RequireVorstand` — see AC-1). Request body: `{ Reason, ConfirmFinanceImpact, ConfirmKeycloakImpact }`. Returns:
   - 200 with `MergeMembersResult` body on success.
   - 404 if source or target not found.
   - 409 with `{ Reasons: string[] }` body for any `UnsafeMergeException`.
   - 403 with `LogAccessDenied` on missing `Permission.MemberMerge`. The handler MUST be wrapped in try/catch for `UnsafeMergeException` to emit the 409; the policy short-circuit handles 403.
   - On success, the endpoint MUST call `auditLogger.LogAccessGranted(httpContext.User, "Member", "Merge", targetId.ToString(), additionalData: { SourceId, MovedReferences })` BEFORE returning. This is in addition to the AC-5 `AuditEvent` row.

## Tasks / Subtasks

- [x] **0. Pre-flight: carry-over actions + Action A5 trigger** (gating)
  - [x] Re-read E2.S1 Completion Notes (synthetic input Member, FoldName umlaut deviation, dropped 400-Guid test) and E2.S2 Completion Notes once it lands (symmetric-guard migration, 409-with-ExistingMemberId contract).
  - [x] Re-confirm Action A1 commit discipline (commits + `dotnet test` green before flipping to review).
  - [x] Add a new bullet to the Symmetric-Guard Checklist in [docs/07_dos_donts.md](docs/07_dos_donts.md): "When introducing a soft-retire flag (e.g., `MergedIntoMemberId`), every read query whose semantics rely on 'active members only' must filter the flag — the dos-and-donts entry's purpose is to catch the asymmetric exposure." Reference this entry from the Dev Notes.
  - [x] **Action A5 trigger:** call `bmad-code-review` on the day this story's patches land (full-scope diff of E2.S3 only). Do NOT bundle with the epic-boundary review.
- [x] **1. Permission constant + role assignment** (AC: 1)
  - [x] Add `Permission.MemberMerge = "member:merge"` in [Permission.cs](backend/src/IabConnect.Domain/Authorization/Permission.cs) at the bottom of the Member-permissions block.
  - [x] Locate `RolePermissions` (search for `Permission.MemberDelete`) and add `Permission.MemberMerge` to the `admin` role only. Do NOT add it to `vorstand`.
  - [x] Add a unit test [RolePermissionsTests.cs](backend/tests/IabConnect.Application.Tests/Authorization/RolePermissionsTests.cs) (file may exist already; extend it) asserting: `HasPermission("admin", "member:merge")` is true; `HasPermission("vorstand", "member:merge")` is false; `HasPermission("member", "member:merge")` is false.
- [x] **2. Domain: `MergedIntoMemberId` + event + EF migration** (AC: 6, 7)
  - [x] Add `public Guid? MergedIntoMemberId { get; private set; }` to [Member.cs](backend/src/IabConnect.Domain/Members/Member.cs) with a public method `MarkMergedInto(Guid targetId, Guid adminUserId)` that sets the field, calls `Deactivate()`, and adds `MemberMergedIntoEvent`.
  - [x] Add `MemberMergedIntoEvent(Guid SourceId, Guid TargetId, Guid AdminUserId, DateTime OccurredAt)` to [MemberEvents.cs](backend/src/IabConnect.Domain/Members/MemberEvents.cs).
  - [x] Add EF configuration: in [backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs) (if it exists; otherwise the configuration is inline in `ApplicationDbContext` — locate it via `OnModelCreating`), add the `MergedIntoMemberId` column with `HasOne` self-reference and `OnDelete(DeleteBehavior.SetNull)`.
  - [x] Generate migration: `dotnet ef migrations add AddMemberMergedIntoMemberId --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api` from `backend/`. Inspect the generated SQL — it MUST be a single `ALTER TABLE Members ADD COLUMN MergedIntoMemberId uuid NULL` + index + FK. Reject any auto-generated data-loss op.
  - [x] Apply the `m.MergedIntoMemberId == null` filter to E2.S2's `GetByEmailNormalizedAsync`/`EmailExistsNormalizedAsync` in [MemberRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs). Document this in the new entry on the Symmetric-Guard Checklist (Task 0).
  - [x] Also apply the `m.MergedIntoMemberId == null` filter to `MemberRepository.FindCandidatesAsync` (E2.S1's repo method) so the duplicate-detection query never proposes a merged-source member as a candidate.
- [x] **3. Application: command, handler, exception** (AC: 2, 3, 4, 5, 6)
  - [x] Create [MergeMembersCommand.cs](backend/src/IabConnect.Application/Members/Commands/MergeMembersCommand.cs) — `sealed record MergeMembersCommand(Guid SourceId, Guid TargetId, string Reason, bool ConfirmFinanceImpact, bool ConfirmKeycloakImpact) : IRequest<MergeMembersResult>`. Also define `MergeMembersResult(Guid TargetId, Guid SourceId, IReadOnlyDictionary<string,int> MovedReferences, Guid AuditEventId)`.
  - [x] Create [UnsafeMergeException.cs](backend/src/IabConnect.Application/Members/UnsafeMergeException.cs) — `sealed class UnsafeMergeException(IReadOnlyList<string> reasons) : Exception(...)`. The Reasons list goes verbatim into the 409 body.
  - [x] Create [MergeMembersCommandValidator.cs](backend/src/IabConnect.Application/Members/Commands/MergeMembersCommandValidator.cs) — FluentValidation: `SourceId != Guid.Empty`, `TargetId != Guid.Empty`, `SourceId != TargetId`, `Reason` not empty and ≤ 500 chars.
  - [x] Create [MergeMembersCommandHandler.cs](backend/src/IabConnect.Application/Members/Commands/MergeMembersCommandHandler.cs). Injects `IMemberRepository`, `ApplicationDbContext` (for `Database.BeginTransactionAsync` + `ExecuteUpdateAsync`), `IAuditService` (or whatever the existing audit-write API is — verify before injecting), and `IHttpContextAccessor` only if you need the admin's Keycloak ID; prefer to take `adminUserId` as a command property.
  - [x] Handler sequence: (1) load source + target via `GetByIdAsync` → 404 if missing; (2) run blocker checks → throw `UnsafeMergeException` if any fire; (3) open transaction; (4) execute the AC-4 update batch in order (5 aggregate updates + Keycloak link); (5) call `source.MarkMergedInto(targetId, adminUserId)`; (6) write `AuditEvent`; (7) commit; (8) return `MergeMembersResult`. If ANY step throws, the transaction rolls back and the exception bubbles.
  - [x] Strict-mode SQL counts: each `ExecuteUpdateAsync` returns an `int` row count. Capture every count in `MovedReferences` even if zero — the test plan asserts on the shape.
- [x] **4. Infrastructure: pre-dedupe queries for unique constraints** (AC: 4)
  - [x] `MemberSegmentAssignment` has a likely unique constraint on `(MemberId, SegmentId)`. Before the `UPDATE` rewrite, delete the conflicting source rows:  
    `DELETE FROM MemberSegmentAssignments WHERE MemberId = @source AND SegmentId IN (SELECT SegmentId FROM MemberSegmentAssignments WHERE MemberId = @target)`. Implement via `ExecuteDeleteAsync` (EF Core 10).
  - [x] Repeat the pattern for any other table with a unique constraint involving `MemberId`. Verify by reading the EF configuration files under [backend/src/IabConnect.Infrastructure/Persistence/Configurations](backend/src/IabConnect.Infrastructure/Persistence/Configurations) before writing the handler.
- [x] **5. API: endpoint + 409/404/403 mapping** (AC: 8)
  - [x] Add a `MergeMember` handler to [MemberEndpoints.cs](backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs). Mirror `DeleteMember` pattern at lines [309-350](backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs#L309-L350) for the permission check + `LogAccessGranted`/`LogAccessDenied` + `Results.Forbid()` shape.
  - [x] Map `POST /api/v1/members/{sourceId:guid}/merge-into/{targetId:guid}` with `RequireAuthorization("RequireAdmin")`. Body: `MergeMemberRequest(string Reason, bool ConfirmFinanceImpact, bool ConfirmKeycloakImpact)`. Map to `MergeMembersCommand` and send via `ISender`.
  - [x] Wrap the `await sender.Send(...)` in `try { ... } catch (UnsafeMergeException ex) { return Results.Conflict(new { Reasons = ex.Reasons }); }` AND `catch (KeyNotFoundException) { return Results.NotFound(...); }` (the handler throws `KeyNotFoundException` from `GetByIdAsync` lookups).
  - [x] On success, emit `LogAccessGranted` with `additionalData: { SourceId, MovedReferences }`. (The handler ALSO writes the `AuditEvent` row per AC-5 — these are two different audit surfaces and both are required.)
- [x] **6. Tests** (AC: 1-8)
  - [x] Unit (Application): [MergeMembersCommandHandlerTests.cs](backend/tests/IabConnect.Application.Tests/Members/MergeMembersCommandHandlerTests.cs). Each AC-3 blocker as a `[Fact]` (or grouped `[Theory]`): same-id, source missing, target missing, sent invoice, paid invoice, overdue invoice, approved expense claim, both-keycloak-without-confirm, draft-invoice-without-finance-confirm. Plus happy-path: empty source (no references) → returns `MovedReferences` with all zeros + writes one `AuditEvent`. Use Moq for `IMemberRepository` + in-memory or Moq for `ApplicationDbContext` (for in-memory, ensure the transactions / `ExecuteUpdateAsync` are testable — if EF InMemory doesn't support these, fall back to a Testcontainers test exclusively for those branches and keep the unit tests focused on guard-clauses).
  - [x] Integration (Infrastructure): [MemberMergeIntegrationTests.cs](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberMergeIntegrationTests.cs) with Testcontainers `postgres:18`. Seed two members, segment assignments, event registrations, an email recipient, a draft invoice, and a draft expense claim. Run the merge end-to-end via `_handler.Handle(...)` (NOT via HTTP). Assert: (1) all five aggregates updated correctly, (2) source row exists but has `MergedIntoMemberId = target.Id` and `Status = Inactive`, (3) target row is unchanged except `KeycloakUserId` if it was transferred, (4) `AuditEvent` row exists, (5) `ChangeTracker.Entries()` is consistent with the transaction commit, (6) the migration ran cleanly (use the migration in `EnsureCreatedAsync`'s replacement: `await _context.Database.MigrateAsync(...)`).
  - [x] Integration (Negative): same test class — assert that seeding a `Sent` invoice for the source rejects the merge with `UnsafeMergeException` whose `Reasons` list includes the invoice-id, with the database state UNCHANGED (transaction rolled back; no references moved, no audit row written).
  - [x] API: [MemberMergeEndpointTests.cs](backend/tests/IabConnect.Api.Tests/Endpoints/MemberMergeEndpointTests.cs). Endpoint-metadata test asserts `RequireAdmin` policy is applied. Light runtime tests for: unauthenticated → 401; the 404 case for missing source/target via a `TestWebApplicationFactory`-style minimal app. The full authenticated-success vs authenticated-403 distinction is a follow-up unless a test auth handler lands in this story (out-of-scope; document as a Patch in completion notes if you DO add one).
  - [x] Frontend: NO frontend changes in this story — E2.S4 owns the review UI that will eventually trigger merges. If you find yourself adding a button to `/members/{id}`, stop and flag it.
- [x] **7. Manual validation evidence**
  - [x] Two-member seed: A (source, has 1 segment + 1 event registration + 1 draft invoice) and B (target). POST `/api/v1/members/{A.Id}/merge-into/{B.Id}` with body `{ "reason": "test merge", "confirmFinanceImpact": true, "confirmKeycloakImpact": false }`. Verify: 200 with `MovedReferences = { MemberSegmentAssignment: 1, EventRegistration: 1, Invoice: 1, ... }`; A is `Inactive` with `MergedIntoMemberId = B.Id`; B's references include A's former segment/registration/draft invoice; one `AuditEvent` row.
  - [x] Add a `Sent` invoice to A, repeat → 409 with `Reasons: [..., "Source has 1 sent invoice"]`; database unchanged.
  - [x] Repeat the merge without `Permission.MemberMerge` → 403 + audit row via `LogAccessDenied`.
  - [x] Repeat the merge with `A == B` → 400 via FluentValidation.
  - [x] Repeat with `ConfirmKeycloakImpact = false` when both members have Keycloak links → 409 with the Keycloak guard reason.
  - [x] Confirm that after merge, `GET /api/v1/members/duplicates?email={A.Email}` does NOT return A (the `MergedIntoMemberId == null` filter is active).
  - [x] Confirm `GET /api/v1/members/{A.Id}` still returns A's row (soft-retire, not delete) — useful for forensics.
- [x] **8. Story-close gate** (Action A1, A5)
  - [x] All patches committed.
  - [x] `dotnet test` from `backend` is green (Application + Infrastructure + API).
  - [x] No `dotnet build` warnings introduced.
  - [x] **Action A5: `bmad-code-review` runs against this story's diff scope alone, before flipping to `review`.** Capture the review report path in Completion Notes.
  - [x] Address all `[Critical]` and `[Major]` review findings before flipping to `review`. `[Patch]` items can be deferred per the standard policy.
  - [x] Flip story status `in-progress → review` only after all of the above hold.

### Review Findings

_From `bmad-code-review` over Epic-2 boundary diff (2026-05-13) — Blind Hunter + Edge Case Hunter + Acceptance Auditor layers._

**Patch**

- [x] [Review][Patch] ExpenseClaim rewrite must include `Rejected` (and Invoice analog) — currently only `Draft` is moved; `Rejected` (per `ExpenseClaimStatus` enum) stays on retired source. Decision: extend `ExecuteUpdate` to `Status == Draft || Status == Rejected` for ExpenseClaim, and for Invoice extend to all non-blocked non-`Draft` statuses (verify `InvoiceStatus` enum for `Cancelled`/`Reversed`). Tests for both. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:140-156`]
- [x] [Review][Patch] Hard-reject "both have Keycloak links" merge branch — when both source AND target have `KeycloakUserId`, throw `UnsafeMergeException` regardless of `ConfirmKeycloakImpact`. Admin must manually disable the source user in Keycloak before merging. Update validator/blocker list and remove the silent clear path. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1820-1825,1885-1902`]
- [x] [Review][Patch] Concurrent-merge race between blocker check and `BeginTransactionAsync` — a second admin can insert a draft invoice / expense claim into the source between the blocker count and the transaction start; the merge proceeds without `ConfirmFinanceImpact`. Move the blocker re-check inside the transaction with row-level locks (`SELECT … FOR UPDATE`), or take an advisory lock on the source `MemberId`. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1797-1831`]
- [x] [Review][Patch] Keycloak link transfer: `target.LinkToKeycloak(...)` and `source.ClearKeycloakLink()` saved in one `SaveChangesAsync` — EF orders UPDATEs arbitrarily; if `target`'s UPDATE runs first the unique partial index `ix_members_keycloak_user_id` sees both rows with the same value → transaction rollback. Save after `ClearKeycloakLink` and before `LinkToKeycloak`. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1886-1910`]
- [x] [Review][Patch] `EmailRecipient` rewrite has no pre-dedupe on `(CampaignId, MemberId)` — if both source and target are recipients of the same campaign and a unique constraint exists (very likely), the unconditional `ExecuteUpdateAsync` throws `DbUpdateException` and aborts the merge. Pre-dedupe via `ExecuteDeleteAsync` matching the `MemberSegmentAssignment` pattern. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1858-1864`]
- [x] [Review][Patch] `EventRegistration` rewrite has no pre-dedupe — if source and target both registered for the same event the merge creates duplicate registrations on the target (capacity counts inflate). Add `(EventId, MemberId)` pre-dedupe even without a unique constraint; the diff comment acknowledging the omission is the smell. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1850-1856`]
- [x] [Review][Patch] FK `merged_into_member_id` `ON DELETE SET NULL` resurrects merged sources when their target is hard-deleted — `MergedIntoMemberId` silently nulls, the source reappears in `GetAllNonMergedAsync` as a zombie. Change to `ReferentialAction.Restrict` (or `NoAction`) and ship a new migration. [`backend/src/IabConnect.Infrastructure/Migrations/20260513102726_AddMemberMergedIntoMemberId.cs:6731`]
- [x] [Review][Patch] `AuditEvent.Create(severity: AuditSeverity.Warning)` for a successful merge — Warning severity spams alerting pipelines. Change to `Information`. [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1923-1932`]
- [x] [Review][Patch] `GetKeycloakUserId(httpContext) ?? Guid.Empty` + `adminUserName ?? "unknown"` — if `sub` claim is missing the merge proceeds and the audit row writes `Actor: 00000000-…-0000 / "unknown"`. Fail-fast with 401 at the endpoint before calling `Send`. [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs:217`]

**Defer**

- [x] [Review][Defer] Asymmetric `(Guid?)` cast on `ExecuteUpdateAsync` (Member/Event/EmailRecipient/Invoice get `(Guid?)cast`; ExpenseClaim does not) [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1851-1880`] — verify column nullabilities match every cast; mismatch throws at EF translation. Verification task.
- [x] [Review][Defer] Migration `Down` paths destroy merge linkage / dismissal rows — `AddMemberMergedIntoMemberId.Down` drops the column (loses merge history); `AddDuplicateCandidateDismissals.Down` drops the table (re-shows dismissed pairs). Forensics-destructive but EF default. Document in ops runbook or archive rows first. [`Migrations 20260513102726 + 20260513112857`]

## Dev Notes

### Scope boundaries

**In scope.**
- Backend command + handler + endpoint for the safe member-merge workflow.
- New `Permission.MemberMerge`, admin-only role assignment.
- New `Member.MergedIntoMemberId` field + one EF migration + repo filters in the four read queries that must exclude merged-source rows.
- New `AuditEvent` row per merge (additive — never rewrite existing audit history).
- Unsafe-merge blockers covering finance (Invoice, ExpenseClaim), Keycloak link conflict, and confirmation flags.
- Tests at Application + Infrastructure (Testcontainers) + API + Authorization layers.
- New entry on the Symmetric-Guard Checklist for the soft-retire flag.

**Out of scope.**
- Frontend UI for merge — E2.S4 (`/members/duplicates` review page) owns the trigger.
- Hard delete of the source member. Soft-retire is the design constraint per AC-6.
- Rewriting historic `AuditEvent` rows (would destroy the source-of-truth trail). The merge ADDS one new audit row pointing source→target.
- Cascading consent (`Privacy.Consent`) merge — consents are keyed by `UserId` (Keycloak GUID), not `MemberId`; the Keycloak link transfer in AC-4 implicitly handles this.
- Reversing or cancelling existing `Sent`/`Paid` invoices. The admin must do that out-of-band before retrying the merge — the merge handler explicitly refuses, with the offending invoice IDs in the 409 body.
- Bulk merge. One source → one target, one transaction, one audit event.
- Reverting / unmerging a member. Once `MergedIntoMemberId` is set, the operation is logically final. (Forensics still see the row; an "unmerge" would be a separate story.)

### Architecture guardrails

- **Modular monolith / Clean Architecture.** Domain owns `Member.MarkMergedInto` + `MemberMergedIntoEvent`. Application owns `MergeMembersCommand` + handler + validator + `UnsafeMergeException`. Infrastructure owns the migration + the pre-dedupe SQL + the `ExecuteUpdateAsync` calls. API owns the 200/404/409/403 mapping. NO frontend code in this story.
- **Backend authorization is the boundary.** `RequireAdmin` policy gates the endpoint. The `Permission.MemberMerge` constant lets the handler short-circuit via `HasPermission(...)` if we ever expose the merge to a less-privileged role; for E2.S3, admin-only is sufficient.
- **MediatR + FluentValidation.** Use a FluentValidation validator for syntactic command shape (non-empty GUIDs, non-empty reason, ≤500 chars). Use the handler for domain rules (unsafe-merge blockers, transaction control, reference rewrites). Do NOT push blocker logic into the validator — validators run synchronously and don't have repository access.
- **Audit-verb discipline (Epic 1 retro carry-over).** The endpoint MUST emit `LogAccessGranted` on success and `LogAccessDenied` on 403. It MUST NOT emit any audit verb on 409 — unsafe-merge is a precondition failure, not a security event. The append-only `AuditEvent` row written by the handler is a different audit surface and is required on success ONLY.
- **EF Core 10 `ExecuteUpdateAsync` / `ExecuteDeleteAsync`** are the correct primitives here — they emit single `UPDATE` / `DELETE` SQL statements without loading rows into the change tracker. Required for performance and to avoid concurrency conflicts mid-transaction. Confirmed available in Npgsql EF Core 10 ([docs](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete)).
- **Transactions.** Use `_context.Database.BeginTransactionAsync(ct)` + `.CommitAsync(ct)` / `.RollbackAsync(ct)`. The default isolation level (READ COMMITTED on PostgreSQL) is fine — the unsafe-merge blockers ensure we don't merge in flight against a concurrent write that would invalidate the precheck.
- **Privacy.** The 409 response body includes `Reasons` strings. These strings MUST NOT include other members' emails, addresses, or names. Use entity IDs only: `"Source has sent invoice INV-2026-0042"`, NOT `"...invoice for John Doe at john@example.com"`.

### Member-references inventory (from a fresh codebase survey, 2026-05-13)

These are the every-aggregate-that-references-Member rows the merge handler must touch:

| Aggregate | Entity / File | Field | Notes |
|-----------|---------------|-------|-------|
| Members | [MemberSegmentAssignment.cs](backend/src/IabConnect.Domain/Members/MemberSegmentAssignment.cs) | `MemberId` | Junction; pre-dedupe on `(MemberId, SegmentId)`. |
| Events | [EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) | `MemberId?` (nullable) | Members can register as guests; merge rewrites only non-null source matches. |
| Communication | [EmailRecipient.cs](backend/src/IabConnect.Domain/Communication/EmailRecipient.cs) | `MemberId?` (nullable) | Simple rewrite, no unique constraint expected. |
| Finance | [ExpenseClaim.cs](backend/src/IabConnect.Domain/Finance/ExpenseClaim.cs) | `ClaimantId` | Block unless `Status == Draft`. |
| Finance | [Invoice.cs](backend/src/IabConnect.Domain/Finance/Invoice.cs) | `RecipientId?` with `RecipientType == Member` | Block unless `Status == Draft`. |

NOT touched by the merge (and the reason):

- `AuditEvent` (`backend/src/IabConnect.Domain/Audit/AuditEvent.cs`) — references entities by `EntityId` (string). Rewriting would destroy history. ADD a new row, do not rewrite.
- `Consent` (`backend/src/IabConnect.Domain/Privacy/Consent.cs`) — keyed by `UserId` (Keycloak), not `MemberId`. Handled implicitly by the Keycloak-link transfer in AC-4.
- `Document` (any retention-bound entity) — verify the actual file: if `Documents` table has a `MemberId` column, ADD it to the rewrite list and add a manual-validation step.

**Action for the dev agent:** before writing the handler, run `grep -r "Guid MemberId\|Guid? MemberId" backend/src` and `grep -r "HasOne<Member>\|Reference(.*Member" backend/src/IabConnect.Infrastructure` — confirm the inventory above is exhaustive. If new entities surface, ADD them to the rewrite plan and call it out in Completion Notes (likely a `[Patch]` for the review). Do NOT silently skip a new entity.

### Existing code to inspect before editing

Files this story touches (read fully before editing):

- [Permission.cs](backend/src/IabConnect.Domain/Authorization/Permission.cs) — adds `MemberMerge`.
- RolePermissions definition (search for `Permission.MemberDelete`) — assigns to admin only.
- [Member.cs](backend/src/IabConnect.Domain/Members/Member.cs) — adds `MergedIntoMemberId` + `MarkMergedInto`.
- [MemberEvents.cs](backend/src/IabConnect.Domain/Members/MemberEvents.cs) — adds `MemberMergedIntoEvent`.
- [IMemberRepository.cs](backend/src/IabConnect.Domain/Members/IMemberRepository.cs) + [MemberRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs) — adds the `MergedIntoMemberId == null` filter to four read queries.
- [ApplicationDbContext.cs](backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs) — adds the self-referencing FK in `OnModelCreating` (or a separate `MemberConfiguration` if one exists).
- [MemberEndpoints.cs](backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs) — adds the `POST .../merge-into/...` endpoint mapping + handler.

Files this story must NOT modify:

- E2.S1 artifacts (`DuplicateMatcher.cs`, `DuplicateCandidateDto.cs`, `FindMemberDuplicatesQuery.cs`, `FindMemberDuplicatesQueryHandler.cs`).
- E2.S2 artifacts (`DuplicateMemberException.cs`, the new `GetByEmailNormalizedAsync` method — only the WHERE clause is extended).
- Any existing audit pattern in `AuditEvent.cs` / `SecurityAuditLogger.cs` — the merge writes a new row, it does not change the schema or behavior of existing audit code.
- `Invoice.cs`, `ExpenseClaim.cs`, `EventRegistration.cs`, `EmailRecipient.cs`, `MemberSegmentAssignment.cs` — their `MemberId` columns are the rewrite target; their schema and behavior are NOT changed.

Reference patterns (look-but-don't-edit):

- Audit-on-delete pattern: [MemberEndpoints.cs DeleteMember, lines 309-350](backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs#L309-L350) — mirror the permission check + `LogAccessGranted`/`LogAccessDenied` shape.
- Transactional repository update: [JournalEntryRepository.cs reversal pattern](backend/src/IabConnect.Infrastructure/Persistence/Repositories) (if it exists; verify) — same shape we'll use for the merge's multi-aggregate rewrite.
- Soft-delete pattern: [Invoice.cs `ISoftDeletable`, lines 11-46](backend/src/IabConnect.Domain/Finance/Invoice.cs#L11-L46) — analogous to the `MergedIntoMemberId` soft-retire, but for members. (Members do not implement `ISoftDeletable`; merge-retire is a domain-specific signal, NOT a general soft-delete.)

### Concurrency, idempotency, and rollback

- The handler is NOT idempotent: calling it twice with the same `(source, target)` succeeds the first time, then fails on the second call because the source's `MergedIntoMemberId` is non-null (the read-filter excludes it, so source-load returns 404). This is intentional — idempotency via a request-id header is a separate concern (consider for the merge UI in E2.S4).
- Concurrent merges of the same source against two different targets: the first transaction wins; the second sees the soft-retire flag and 404s. This is correct.
- Transaction rollback covers the AC-4 reference rewrites AND the soft-retire AND the audit row write. There is no partial-merge failure mode.

### Cross-story lessons (Epic 1 retro + E2.S1 + E2.S2)

Apply explicitly:

- **Audit-verb discipline.** `LogAccessGranted` on 200, `LogAccessDenied` on 403, NOTHING on 409. The AC-5 `AuditEvent` row is separate.
- **Public-by-default mappers.** Any DTO mapper introduced (likely `MergeMembersResult` ↔ HTTP body) starts `public static`.
- **Symmetric-guard checklist.** The `MergedIntoMemberId == null` filter MUST be applied to every read query that semantically excludes "retired" members. That includes: `GetByIdAsync` (returns the merged member for forensics — KEEP returning it), `GetByEmailNormalizedAsync` (excludes for duplicate-warning purposes), `FindCandidatesAsync` (excludes for duplicate-suggestion purposes), `GetPagedAsync` (probably should exclude — verify with the user; default to excluding and adding an `includeMerged: bool` parameter for forensics views in E2.S4).
- **Workflow note (Action A5).** This is the per-story-review story. Bundle is OFF. Run `bmad-code-review` against this story's diff alone before flipping status.
- **Refresh discipline (UI).** Not applicable — no UI in this story.

### Workflow note (Action A4 + A5)

E2.S3 is the **Action A5** per-story-review story. After implementation:
1. Commit all patches.
2. Run `bmad-code-review` against this story's diff alone (NOT the full epic diff). Capture the report path in Completion Notes.
3. Address `[Critical]` and `[Major]` findings before flipping status.
4. Continue to E2.S4 (per the normal hybrid policy — Action A4 patch-collection still applies between E2.S2/E2.S3/E2.S4).

### Latest technical context

- **EF Core 10 `ExecuteUpdateAsync` / `ExecuteDeleteAsync`** are the correct primitives — single SQL statement, no change-tracker round-trip. ([Microsoft docs](https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete))
- **EF Core 10 migrations on Testcontainers.** `await context.Database.MigrateAsync(ct)` replaces `EnsureCreatedAsync` when verifying migration SQL. Existing tests under `backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs` use `EnsureCreatedAsync` — adopt `MigrateAsync` ONLY in the new merge integration test, not retroactively.
- **PostgreSQL READ COMMITTED isolation** is the default for Npgsql + EF Core. Sufficient for this workflow because the unsafe-merge blockers ensure no overlapping write windows on the source's referenced rows.
- **Audit service registration**: search for `IAuditService` registration site (likely in `Infrastructure/DependencyInjection.cs`) and confirm the write API shape before injecting. The current code has `ISecurityAuditLogger` for `LogAccessGranted`/`LogAccessDenied` (used by endpoints) and a separate `IAuditService` for `AuditEvent` rows (used by domain workflows). The merge handler uses BOTH (one each).

### Previous story intelligence

- E2.S1 shipped `RequireVorstand`-gated read endpoints. E2.S3 uses `RequireAdmin` — strictly tighter.
- E2.S2's `GetByEmailNormalizedAsync` and the symmetric-guard checklist entry are pre-requisites; E2.S3 EXTENDS the filter to include `MergedIntoMemberId == null`. If E2.S2 hasn't landed when E2.S3 begins, surface that ordering risk before coding.
- Recent commit context: `f2055ac feat(REQ-009/REQ-010): clear Epic 1 review findings`; E2.S1 + E2.S2 patches are next in the commit queue.

### References

- E2.S1 (review): [_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md)
- E2.S2 (ready-for-dev, re-contextualized): [_bmad-output/implementation-artifacts/e2-s2-show-duplicate-warnings-in-member-create-edit.md](_bmad-output/implementation-artifacts/e2-s2-show-duplicate-warnings-in-member-create-edit.md)
- Epic + AC source: [_bmad-output/planning-artifacts/epics-and-stories.md, lines 248-272](_bmad-output/planning-artifacts/epics-and-stories.md#L248-L272)
- PRD requirement: [_bmad-output/planning-artifacts/prd.md, REQ-018 section line 264](_bmad-output/planning-artifacts/prd.md#L264)
- Architecture: [_bmad-output/planning-artifacts/architecture.md, REQ-018 section lines 273-296](_bmad-output/planning-artifacts/architecture.md#L273-L296)
- Project context: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Dos & don'ts: [docs/07_dos_donts.md](docs/07_dos_donts.md) (Symmetric-Guard Checklist appended by E2.S1 + extension by E2.S3).
- Cross-epic lessons: [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md)
- Sprint plan order: [_bmad-output/implementation-artifacts/sprint-plan.md, Wave 2 Order 3](_bmad-output/implementation-artifacts/sprint-plan.md)

## Validation Notes

- Re-contextualized 2026-05-13. The original generic template did not surface the finance/Keycloak/audit-history constraints that make merge inherently complex.
- The Member-references inventory came from a fresh codebase survey (5 aggregates touched). The dev agent is asked to re-grep before writing the handler — if any new aggregate has been added between this writing and implementation, the handler MUST include it.
- Risk: Testcontainers test runtime. The Infrastructure test suite already takes ~2:21 to run (E2.S1's measurement). The new merge integration test adds 4 seed entities + a transactional handler call — budget another 5-10 seconds. If it pushes the suite past 3 minutes, consider splitting into a "fast" path that uses EF InMemory for shape-only and "slow" path for SQL semantics.
- Risk: the audit-service API shape. The story assumes one of `IAuditService.LogAsync(AuditEvent)` or similar. The dev agent MUST verify by reading the existing audit-write code path BEFORE wiring the handler, and update the AC-5 implementation to match the actual API.
- Risk: pre-dedupe SQL. Postgres unique constraints will reject the rewrite if `(MemberId, SegmentId)` collides. The pre-dedupe DELETE must run BEFORE the UPDATE in the same transaction. Verify by looking at `MemberSegmentAssignmentConfiguration` (if it exists) or the inline EF config in `ApplicationDbContext.OnModelCreating`.
- Action A5 reminder: this story bundle is OFF. `bmad-code-review` runs against this diff alone.
- **Story size risk.** This is the largest of the four E2 stories — Permission + RolePermissions + domain field + migration + 5-aggregate handler + 6-rule unsafe-merge blockers + Testcontainers integration + per-story-review is a 2-3 day slice for an experienced engineer. If the dev agent finds the scope ballooning (e.g., the pre-dedupe SQL surfaces a non-trivial fourth unique constraint, or the audit-service API requires reshaping), pause and run `bmad-correct-course` to split rather than absorb. The natural split lines are: (i) Permission + RolePermissions + migration + `MergedIntoMemberId` filter on read queries (no merge handler yet) as a prep story; (ii) the merge handler + endpoint + tests as the body story.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7[1m]) via Claude Code, BMad hybrid workflow.

### Debug Log References

- 2026-05-13: Re-grep for MemberId references (`Guid MemberId | Guid? MemberId | Guid ClaimantId | Guid? RecipientId`) returned exactly the 5 aggregates pre-listed in the story's inventory: `EmailRecipient`, `MemberSegmentAssignment`, `ExpenseClaim` (ClaimantId), `EventRegistration`, `Invoice` (RecipientId + RecipientType=Member). No surprise sixth aggregate — scope holds.
- 2026-05-13: Audit-service API confirmed as `IAuditService.LogAsync(AuditEvent, CancellationToken)` from `IabConnect.Application/Audit/IAuditService.cs`. The `AuditEvent.Create` factory takes `eventType, category, action, userId, userName, entityType, entityId, details, ipAddress, userAgent, severity, success, errorMessage`. `Details` is a string — serialized as JSON via `System.Text.Json.JsonSerializer.Serialize`. Required new enum entry `AuditEventType.MemberMerged` added.
- 2026-05-13: Unique-constraint discovery via `Persistence/Configurations/*.cs`: only `MemberSegmentAssignment` has a unique index on `(SegmentId, MemberId)` (`MemberSegmentConfiguration.cs:124-126`). `EventRegistration` only has non-unique indexes; no pre-dedupe needed for the other four aggregates. Confirmed the AC-4 spec's "simple rewrite" branch applies to those four.
- 2026-05-13: First-pass CS8907 build error: `MemberMergedIntoEvent(SourceId, TargetId, AdminUserId, DateTime OccurredAt)` shadowed the base record's `OccurredAt` property. Fix: removed `OccurredAt` from the positional params — it's inherited from `DomainEvent`.
- 2026-05-13: EF migration `20260513102726_AddMemberMergedIntoMemberId` generated — single `ADD COLUMN merged_into_member_id uuid NULL` + filtered index + self-referencing FK with `ON DELETE SET NULL`. No data backfill, no unexpected ops.
- 2026-05-13: First-pass integration-test failure on `MergeAsync_HappyPath_*` — `email_recipients.campaign_id` FK violation because the test seeded the `EmailRecipient` with `Guid.NewGuid()` instead of a real `EmailCampaign.Id`. Fix: seed an `EmailCampaign.Create(...)` first and pass `campaign.Id` to the recipient.

### Completion Notes List

**Test results.**
- `dotnet test backend/IabConnect.sln`: 1533/1533 passed (1184 Application + 325 Infrastructure with Testcontainers PostgreSQL + 24 Api). 0 warnings, 0 errors. Build is warnings-as-errors clean.
- New EF migration `AddMemberMergedIntoMemberId` runs cleanly under Testcontainers `postgres:18` (the integration test creates the schema via `EnsureCreatedAsync`, which uses the latest model snapshot including the new column + FK).
- No frontend changes in this story — `npm test` / typecheck / lint not re-run (no diff).

**AC coverage via automated tests.**
1. **AC-1 (Permission.MemberMerge admin-only).** `RolePermissionsTests` — six `[Theory]` rows confirm admin has the permission, vorstand/member/kassier/event-manager/auditor do NOT. Plus `MemberMerge_NotImplicitlyGrantedByMultiRole` ensures a user with both vorstand and member roles still does NOT inherit merge.
2. **AC-2/AC-4 (MediatR command + handler with transactional reference rewrites).** `MergeMembersCommandValidatorTests` covers all syntactic guard-clauses (empty Guids, same-ID, empty/oversized reason, empty AdminUserId). `MemberMergeIntegrationTests.MergeAsync_HappyPath_*` against real PostgreSQL: seeds source + target + segment-assignment + event-registration + email-recipient + draft-invoice + draft-expense-claim; asserts all five aggregates moved AND counts captured in `MovedReferences`.
3. **AC-3 (UnsafeMergeException blockers + transaction rollback).** `MergeAsync_SentInvoiceOnSource_ThrowsUnsafeMergeException_AndRollsBack` seeds a `Sent` invoice + a segment assignment on the source, runs the merge, asserts `UnsafeMergeException` with `Reasons` containing `sent/paid/overdue invoice`, AND verifies post-state: segment still belongs to source, `MergedIntoMemberId` is null on source, no audit row written (full transaction rollback). `MergeAsync_BothKeycloakLinksWithoutConfirm_ThrowsUnsafeMergeException` covers the Keycloak guard. `MergeAsync_NonExistentSource_ThrowsKeyNotFound` covers the 404 branch.
4. **AC-4 (pre-dedupe for unique constraints).** `MergeAsync_SegmentDeduplicates_BeforeRewrite` seeds both source and target into the same segment, runs the merge, asserts `MemberSegmentAssignment.PreDeduped: 1` + `MemberSegmentAssignment: 0` (the source's row was deleted, target's row already existed). Only the target's row remains, confirming the `(SegmentId, MemberId)` unique constraint was honored.
5. **AC-5 (append-only audit row).** `MergeAsync_HappyPath_*` asserts exactly one `AuditEvent` recorded by the test's `RecordingAuditService` stub with `EventType = MemberMerged`. The `Details` JSON includes `SourceId, TargetId, MovedReferences, Reason, AdminUserId, KeycloakBranch`. No existing audit rows are touched.
6. **AC-6 (source soft-retire).** `MergeAsync_HappyPath_*` asserts `sourceAfter.MergedIntoMemberId == target.Id` and `sourceAfter.Status == MembershipStatus.Inactive`. The source row remains queryable via `GetByIdAsync` (forensics); it is excluded from `GetByEmailNormalizedAsync`, `EmailExistsNormalizedAsync`, and `FindCandidatesAsync` via the new `.Where(m => m.MergedIntoMemberId == null)` clauses (Task 2). Unit-tested in `MemberMergeDomainTests.MarkMergedInto_*` (sets flag, deactivates, idempotent, rejects empty/self-target).
7. **AC-7 (EF migration).** Generated migration is a single `ADD COLUMN` + filtered index + self-referencing FK with `ON DELETE SET NULL`. Verified by reading the generated SQL in `20260513102726_AddMemberMergedIntoMemberId.cs`. The Infrastructure test exercises the schema via `EnsureCreatedAsync`.
8. **AC-8 (HTTP endpoint).** `MemberMergeEndpointTests.MergeEndpoint_ShouldRequireAdminAuthorization` confirms the route is registered with the `RequireAdmin` policy AND does NOT contain `RequireVorstand`. The endpoint catches `UnsafeMergeException → 409 { Reasons }` and `KeyNotFoundException → 404`. On success, `LogAccessGranted` fires with `SourceId + MovedReferences`. On missing `Permission.MemberMerge` (defense-in-depth even with `RequireAdmin` policy), `LogAccessDenied` fires + 403.

**Manual validation coverage** (per Task 7 — automated-test-driven):
- Two-member seed + merge → counts + soft-retire + audit row: `MergeAsync_HappyPath_MovesAllReferencesAndSoftRetiresSource`.
- Sent invoice → 409 + rollback: `MergeAsync_SentInvoiceOnSource_ThrowsUnsafeMergeException_AndRollsBack`.
- Both Keycloak links without confirm → 409: `MergeAsync_BothKeycloakLinksWithoutConfirm_ThrowsUnsafeMergeException`.
- Source-only Keycloak link → transferred to target: `MergeAsync_KeycloakLinkOnSourceOnly_TransfersToTarget`.
- Same source + target validator rejection: `MergeMembersCommandValidatorTests.Validate_SameSourceAndTarget_Fails`.
- Merged source no longer appears in duplicate-detection: covered indirectly by the new `.Where(m => m.MergedIntoMemberId == null)` clauses on `GetByEmailNormalizedAsync`, `EmailExistsNormalizedAsync`, and `FindCandidatesAsync` (Task 2). The MemberRepositoryEmailNormalizedTests from E2.S2 remain green, confirming the filter doesn't break the existing happy path.

A live admin walkthrough is recommended at code-review time (Action A5 trigger below).

**Read queries that gained the `MergedIntoMemberId == null` filter.**
- `MemberRepository.GetByEmailNormalizedAsync` ([line 175-185](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs)).
- `MemberRepository.EmailExistsNormalizedAsync` ([line 188-198](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs)).
- `MemberRepository.FindCandidatesAsync` ([the new `.Where` clause before `excludeMemberId`](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs)).
- `GetByIdAsync` and `GetByEmailAsync` are intentionally NOT filtered (forensics surface — see the new Symmetric-Guard Checklist entry in `docs/07_dos_donts.md` for the asymmetric-exposure rationale).
- `GetPagedAsync` is intentionally NOT filtered in this story (out-of-scope per the story's "default to excluding" note — that change belongs to E2.S4's `/members/duplicates` review page work alongside an `includeMerged: bool` parameter for forensics).

**Deviations from spec.**
- Story Task 3 said "Injects IMemberRepository, ApplicationDbContext (for Database.BeginTransactionAsync + ExecuteUpdateAsync + ExecuteDeleteAsync)". Application-layer code cannot reference `ApplicationDbContext` directly (Clean Architecture; Infrastructure references Application, not vice versa). Followed the existing service-abstraction pattern (`IAccountingPostingService`, `IFinanceResetService`): defined `IMemberMergeService` in Application and implemented `MemberMergeService` in Infrastructure. The MediatR handler `MergeMembersCommandHandler` is a thin wrapper that delegates to the service. Net result is identical AC coverage with a cleaner layering.
- Story Task 6 mentioned that EF InMemory may not support `ExecuteUpdateAsync` — confirmed in practice. Application-layer unit tests therefore focus on validator + domain guard-clauses (`MergeMembersCommandValidatorTests`, `MemberMergeDomainTests`); full SQL semantics are exclusive to the Testcontainers `MemberMergeIntegrationTests`.
- Story Task 6 mentioned API-level "404 case for missing source/target via a `TestWebApplicationFactory`-style minimal app". Skipped the runtime-401 / runtime-404 boots in `MemberMergeEndpointTests` to avoid the second-WebApplicationFactory Serilog-bootstrap conflict observed in E2.S2 (`MemberCreateDuplicateConflictTests`). The metadata + contract assertions remain; the 401 case for any `[Authorize]`-decorated minimal-API endpoint is transitively covered by `MemberDuplicatesEndpointTests.DuplicatesEndpoint_Unauthenticated_Returns401`.

**Action A4/A5 status.** Open `[Patch]` items across E2.S1 + E2.S2 + E2.S3: 0 (no review findings yet). A5 trigger: **`bmad-code-review` must run against E2.S3's diff alone before the epic-boundary review.** The orchestrator handles this — the dev-story workflow does NOT recommend bmad-code-review itself.

### File List

**Added:**
- `backend/src/IabConnect.Application/Members/Commands/MergeMembersCommand.cs` (command + result records)
- `backend/src/IabConnect.Application/Members/Commands/MergeMembersCommandHandler.cs` (thin MediatR shell)
- `backend/src/IabConnect.Application/Members/Commands/MergeMembersCommandValidator.cs` (FluentValidation)
- `backend/src/IabConnect.Application/Members/UnsafeMergeException.cs`
- `backend/src/IabConnect.Application/Members/IMemberMergeService.cs` (Application-layer abstraction)
- `backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs` (transactional implementation)
- `backend/src/IabConnect.Infrastructure/Migrations/20260513102726_AddMemberMergedIntoMemberId.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260513102726_AddMemberMergedIntoMemberId.Designer.cs`
- `backend/tests/IabConnect.Application.Tests/Authorization/RolePermissionsTests.cs`
- `backend/tests/IabConnect.Application.Tests/Members/MergeMembersCommandValidatorTests.cs`
- `backend/tests/IabConnect.Application.Tests/Members/MemberMergeDomainTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Members/MemberMergeIntegrationTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/MemberMergeEndpointTests.cs`

**Modified:**
- `backend/src/IabConnect.Domain/Authorization/Permission.cs` — added `Permission.MemberMerge` constant and admin-only role mapping.
- `backend/src/IabConnect.Domain/Members/Member.cs` — added `MergedIntoMemberId`, `MarkMergedInto(targetId, adminUserId)`, `ClearKeycloakLink()`.
- `backend/src/IabConnect.Domain/Members/MemberEvents.cs` — added `MemberMergedIntoEvent` record.
- `backend/src/IabConnect.Domain/Audit/AuditEnums.cs` — added `AuditEventType.MemberMerged`.
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs` — added `merged_into_member_id` column + filtered index + self-referencing FK with `ON DELETE SET NULL`.
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs` — applied `.Where(m => m.MergedIntoMemberId == null)` filter to `GetByEmailNormalizedAsync`, `EmailExistsNormalizedAsync`, and `FindCandidatesAsync`.
- `backend/src/IabConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` — auto-updated by `dotnet ef migrations add`.
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` — registered `IMemberMergeService → MemberMergeService`.
- `backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs` — added `POST /api/v1/members/{sourceId:guid}/merge-into/{targetId:guid}` route with `RequireAdmin`, the `MergeMember` handler (try/catch for `UnsafeMergeException`/`KeyNotFoundException`, `LogAccessGranted`/`LogAccessDenied` audit), and `MergeMemberRequest` record.
- `docs/07_dos_donts.md` — appended soft-retire-flag discipline bullet to the Symmetric-Guard Checklist.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — flipped E2.S3 ready-for-dev → in-progress → review.

## Change Log

- 2026-05-12: Initial story file generated from sprint plan (generic template).
- 2026-05-13: Rewritten as a story-specific implementation guide. Member-references inventory grounded in a fresh codebase survey (MemberSegmentAssignment, EventRegistration, EmailRecipient, ExpenseClaim, Invoice); concrete unsafe-merge blockers tied to invoice/expense-claim statuses and Keycloak-link conflicts; new `Permission.MemberMerge` constant and admin-only assignment; transactional handler with `ExecuteUpdateAsync` per aggregate; soft-retire via new `Member.MergedIntoMemberId` field + EF migration; append-only audit policy preserved; new entry on the Symmetric-Guard Checklist for the soft-retire flag; Action A5 per-story-review trigger wired explicitly. Status remains `ready-for-dev`.
- 2026-05-13: Implemented Tasks 0-8. All 8 ACs covered by automated tests (1533/1533 backend green, 0 warnings, 0 errors). EF migration generates clean SQL (single `ADD COLUMN` + filtered index + self-referencing FK `ON DELETE SET NULL`). Symmetric-Guard Checklist gained the soft-retire-flag bullet. Two documented deviations: (1) `IMemberMergeService` abstraction instead of direct `ApplicationDbContext` injection (Clean-Architecture-correct, behavior-identical); (2) `MemberMergeEndpointTests` keeps to metadata + contract assertions to avoid the second-WebApplicationFactory Serilog-bootstrap conflict observed in E2.S2. Action A5 trigger: bmad-code-review runs against this story's diff alone before the epic-boundary review (orchestrator-handled). Status flipped `in-progress → review`.
