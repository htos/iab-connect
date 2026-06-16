# Story E23.S3: Members Duplicates — Slice Extraction and `components/members` Relocation

Status: done

Depends on: **E23-S1 (net green)** + **E23-S2 (`features/members/api` + `types` shipped)**. Inherits E21-S1 decisions and the E21-S3 pilot recipe. **Highest-risk story (destructive merge/dismiss).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer,
I want the duplicates review page and its modal components moved into the Members slice,
so that the destructive merge/dismiss surface lives in `features/members/` without behaviour change.

## Acceptance Criteria

**Behaviour preserved (all E23-S1 duplicates tests stay green):**

1. Route `/members/duplicates`, access rule (unauth → `/login`; non-`isVorstand`-and-non-`isAdmin` → `/`), and all `members.duplicates.*` i18n texts behave exactly as before.
2. The **Merge** flow (admin-only; `disabled` for non-Admin with `title=members.duplicates.mergeAdminOnly`) and the **Dismiss** flow (Vorstand+) are preserved exactly, including target-must-be-explicitly-chosen (no silent default), the two-member auto-source derivation vs. the N>2 explicit source select, and the two finance/Keycloak impact acknowledgement checkboxes posted in the merge body (`{reason, confirmFinanceImpact, confirmKeycloakImpact}`) — which remain **not** part of `submitDisabled` (backend enforces).
3. **Cascade-dismiss still issues one `dismissDuplicateCandidate` call per canonical `C(N,2)` pair** via `Promise.all` (e.g. 3 members → 3 calls); a successful merge/dismiss confirm still refreshes the list; the tier filter still `setPage(1)` + refetches.
4. Loading/error/empty lifecycle (`duplicates-loading` / `duplicates-error` + retry / `duplicates-empty`) and the page test-ids (`duplicates-list`, `duplicates-tier-filter`, `duplicate-group-${groupKey}`, `merge-confirmation-modal`, `dismiss-confirmation-modal`) are unchanged.

**Improvements:**

5. **RELOCATE** the four `frontend/src/components/members/*` files (`DismissConfirmationModal`, `DuplicateGroupRow`, `DuplicateWarning`, `MergeConfirmationModal`) into `features/members/components/`; update **all importers**; delete the now-empty `frontend/src/components/members/` directory (grep `@/components/members/*` returns zero hits afterwards).
6. The duplicates page is extracted into the slice: `app/members/duplicates/page.tsx` becomes a thin server entry rendering a `duplicates-page-content` (`"use client"`) component; the manual `refreshKey`/`useCallback` fetch dance is replaced by TanStack hooks + mutation-invalidation reusing S2's `api/members-api.ts` (add `duplicateKeys` + duplicate fns/DTOs to the slice `api`/`types`) — the **cascade-dismiss loop moves with the page** (it lives in the page today, not the modal).
7. Destructive-action wiring stays explicit and well-named; **no change to API endpoints or request shapes** (`GET /api/v1/members/duplicate-groups`, `POST /api/v1/members/duplicate-dismissals`, `POST /api/v1/members/{sourceId}/merge-into/{targetId}`).
8. Quality: no new `any`; no new hard-coded strings; no raw API URL in `page.tsx`; no duplicate UI primitive; `page.tsx` not a client page. `tsc` / eslint(changed) / prettier-check(changed) / `vitest run` green; `next build` succeeds; diff LF-clean (A73).

## Tasks / Subtasks

- [x] Task 0: Prereqs + blast-radius confirmation (AC: all)
  - [x] E23-S1 duplicates suite green; E23-S2 slice seam (`api/members-api.ts` + `types/member.types.ts`) verified present; on `refactor/frontend-feature-slice`.
  - [x] Relocation blast radius confirmed: importers were the duplicates page (row + 2 modals) + member-new-content + member-edit-content (`DuplicateWarning`). DEC-1=A: `DuplicateWarning` → slice; both content components repointed to `./duplicate-warning`.
- [x] Task 1: Relocate the four components (AC: 5)
  - [x] Moved `DuplicateGroupRow`/`MergeConfirmationModal`/`DismissConfirmationModal`/`DuplicateWarning` → `features/members/components/{duplicate-group-row,merge-confirmation-modal,dismiss-confirmation-modal,duplicate-warning}.tsx` VERBATIM (kept `@/components/ui/dialog` Radix + `@/lib/api/members` `parseMatchReason`/type imports — both legal from `features`; NOT swapped to alert-dialog).
  - [x] All importers repointed; `src/components/members/` DELETED; `grep "@/components/members" src` → 0 hits.
- [x] Task 2: Duplicate `api`/`types` in the slice (AC: 6, 7)
  - [x] Added to `members-api.ts`: `duplicateKeys.groups(page, minTier)`, `fetchDuplicateGroups`, `postDuplicateDismissal`, `postMemberMerge` (all `useApiClient`-typed; URLs encapsulated), + the pure `buildCanonicalPairs` helper. Duplicate DTO types kept re-exported from `lib/api/members.ts` (imported directly — `features → lib` legal; `lib/api/members.test.ts` still consumes them, so they stay in lib).
- [x] Task 3: Hooks + page-content (AC: 1-4, 6)
  - [x] `use-duplicate-groups` (useQuery keyed `duplicateKeys.groups`, Vorstand∪Admin `enabled`), `use-merge-members` + `use-dismiss-duplicates` (useMutation + invalidate `duplicateKeys.all`, replacing `refreshKey`). The `C(N,2)` cascade lives in `use-dismiss-duplicates` via `buildCanonicalPairs` + `Promise.all` (idempotency-tolerant) — one POST per pair preserved.
  - [x] `duplicates-page-content` (only `"use client"`): auth redirect, tier filter `setPage(1)`, Merge/Dismiss modal wiring (mutateAsync so the modal catch surfaces errors), 3 lifecycle states + retry via `refetch()`, all test-ids. Thin `app/members/duplicates/page.tsx`.
- [x] Task 4: Keep behaviour green + quality gate (AC: 1-4, 8)
  - [x] E23-S1 duplicates suite transport repointed to `useApiClient` (licensed A79) — **14 green**, cascade=3 POSTs preserved. Added `members-api.test.ts` (buildCanonicalPairs, 5 green). Members+slice suite **141 green**.
  - [x] `tsc` clean; eslint(changed) clean (segments' 2 pre-existing errors untouched — S4); prettier-check clean; `next build` succeeds; LF.

## Dev Notes

This is the highest-risk story in E23: a **destructive** merge (irreversibly folds one member into another, with finance/Keycloak impact) and a cascade-dismiss. Favour the lower-risk incremental move — relocate + repoint + swap the fetch transport for TanStack — and document residual debt rather than restructuring the modals. The four components are presentational and already compose the shared `ui/dialog` Radix primitive; keep them as-is structurally.

### Scope Boundaries

- In scope: relocate `components/members/*` → `features/members/components/`; repoint all 5 import sites incl. new/edit's `DuplicateWarning`; extract `app/members/duplicates/page.tsx` into the slice; add duplicate `api`/`types`/hooks; delete the empty directory.
- Out of scope: changing API endpoints/request shapes; restructuring the modals; the segments pages (S4); backend; route moves. Do NOT "fix" the merge/dismiss confirm buttons to a destructive-red variant — see the A76 note below.

### Architecture Guardrails (and the A76 residual-debt note)

- **A76 — the destructive affordances are ORANGE, not red, today.** `DuplicateGroupRow`'s Merge button is `bg-orange-600` and both modals' Submit buttons are `bg-orange-600` (the only red is validation-error text). This is a behaviour-preserving refactor, so **preserve the orange** — do NOT convert to `buttonVariants({ variant: "destructive" })`. Record as residual debt: "merge/dismiss confirms use orange primary, not the destructive variant; harmonising is a deliberate future styling story, out of scope per the conflict-priority rule (preserve functionality/styling over improving it)." Note this diverges from the S2 delete dialog (which DOES use destructive) — intentional, because S2 replaces a `confirm()` (no existing colour) whereas here an explicit orange affordance already ships.
- Both modals compose `@/components/ui/dialog.tsx` (Radix) — keep it; `alert-dialog.tsx` is unused here and should stay unused for this surface.
- The cascade-dismiss loop is in `page.tsx`, NOT the modal — it MUST move with the page extraction (the modal only emits a reason string). Preserve `C(N,2)` + `Promise.all` + idempotency tolerance exactly.
- Merge safety design to preserve: explicit target radio (no silent default-to-members[0]); two-member groups auto-derive source; N>2 needs an explicit source select; reason required; the two impact checkboxes are posted but NOT gating `submitDisabled`.
- DoD per A58/A72/A73.

### Decision-Needed

- **DEC-1 (`DuplicateWarning` home).** It is imported by the duplicates page's siblings (new/edit forms), not the duplicates review page itself.
  - **Option A (recommended):** place it at `features/members/components/duplicate-warning.tsx` (it's a member create/edit-form concern) and repoint member-new-content + member-edit-content (shipped by S2). Single slice home for all member duplicate UI.
  - Option B: leave a re-export shim at `@/components/members/DuplicateWarning` — rejected (the explicit goal is to delete the directory; a shim defeats AC-5's grep-clean).
  - Resolve per A41/A32 + A43.

### Testing Requirements

- E23-S1 duplicates suite green post-refactor; the duplicates spec's transport mock updates from `@/lib/api/members` standalone-fn mocks to the `useApiClient` mock (licensed A79 mechanism update). The 3-member cascade-dismiss call-count assertion (=3) must stay green. Add a unit test for the `C(N,2)` pair-builder.

### Project Structure Notes

- Target tree adds: `features/members/components/{duplicates-page-content,duplicate-group-row,merge-confirmation-modal,dismiss-confirmation-modal,duplicate-warning}.tsx`; `features/members/api/members-api.ts` (+ `duplicateKeys` + duplicate fns); `features/members/types/member.types.ts` (+ duplicate DTOs). Deletes: `frontend/src/components/members/` (all 4 files). Thin `app/members/duplicates/page.tsx`.

### References

- Current page: `frontend/src/app/members/duplicates/page.tsx` (auth :52-61; fetch/refreshKey :66-91; merge confirm :132-151; **cascade-dismiss loop :110-125**; tier filter :172-184; testids/lifecycle :192-253).
- Components: `frontend/src/components/members/{DuplicateGroupRow,MergeConfirmationModal,DismissConfirmationModal,DuplicateWarning}.tsx` (all compose `@/components/ui/dialog`; orange confirms; DuplicateWarning is inline-banner only).
- `frontend/src/lib/api/members.ts` (`getDuplicateGroups` :329, `dismissDuplicateCandidate` :358, `mergeMembers` :382, `parseMatchReason` :235; DTOs `DuplicateGroupDto` :285, `DuplicateCandidateDto` :207, `MatchTier` :193).
- Importers (A62): `app/members/duplicates/page.tsx:27-29`, `app/members/[id]/edit/page.tsx:18`, `app/members/new/page.tsx:18` (post-S2: the latter two are `features/members/components/member-{edit,new}-content.tsx`).
- E23-S2 slice (`api/members-api.ts`, `types/member.types.ts`); suppliers/sponsors hooks for the TanStack mutation-invalidation pattern.
- project-context.md A56/A58/A62/A72/A73/A74/A76/A79; conflict-priority block in epics-and-stories.md E23.

## Validation Notes

- Created 2026-06-07. Status ready-for-dev. Depends on E23-S1 + E23-S2. Highest-risk story; the relocation blast radius (DuplicateWarning's two external consumers) and the page-resident cascade-dismiss loop are the load-bearing A56 findings. DEC-1 (DuplicateWarning home) carries a recommended option for A41/A32 + A43.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story; delegated to a general-purpose subagent with full context, orchestrator-verified centrally).

### Debug Log References

- DEC-1 → Option A (DuplicateWarning → slice, repoint new/edit content). Autonomous mode.
- A76 residual debt CONFIRMED preserved: merge action + merge-submit + dismiss-submit stay `bg-orange-600` (NOT `destructive`); modals keep Radix `@/components/ui/dialog`. Harmonising orange→destructive is a deliberate future styling story (conflict-priority: preserve over improve). Intentionally differs from S2's delete dialog (which replaced a `confirm()` with no prior colour).
- Central verification: `grep @/components/members src` → 0 hits; `src/components/members/` deleted; `tsc --noEmit` clean; members+slice suite 141 green; duplicates spec 14 green incl. cascade=3.

### Completion Notes List

Behaviour-preserving relocation + transport swap for the highest-risk (destructive merge/cascade-dismiss) surface. The 4 `components/members/*` files moved verbatim into the slice (kebab-case); the duplicates page extracted into `duplicates-page-content` backed by 3 TanStack hooks + 4 new `members-api.ts` fns (`fetchDuplicateGroups`/`postDuplicateDismissal`/`postMemberMerge` + pure `buildCanonicalPairs`). The page-resident `C(N,2)` cascade moved into `use-dismiss-duplicates` (`Promise.all` over `buildCanonicalPairs`, idempotency-tolerant) — the load-bearing "3 members → 3 POSTs" assertion stays green. `refreshKey` replaced by mutation `invalidateQueries(duplicateKeys.all)`. Endpoints/request shapes unchanged. `lib/api/members.ts` left intact (still the canonical home of the duplicate types/fns + `parseMatchReason`, consumed by its own test).

### File List

Moved (→ `features/members/components/`, kebab-case):
- `duplicate-group-row.tsx`, `merge-confirmation-modal.tsx`, `dismiss-confirmation-modal.tsx`, `duplicate-warning.tsx` (originals under `src/components/members/` deleted; directory removed)

New:
- `frontend/src/features/members/hooks/use-duplicate-groups.ts`
- `frontend/src/features/members/hooks/use-merge-members.ts`
- `frontend/src/features/members/hooks/use-dismiss-duplicates.ts`
- `frontend/src/features/members/components/duplicates-page-content.tsx`
- `frontend/src/features/members/api/members-api.test.ts` (buildCanonicalPairs)

Modified:
- `frontend/src/features/members/api/members-api.ts` (+duplicate keys/fns/helper)
- `frontend/src/app/members/duplicates/page.tsx` (→ thin entry) + `page.test.tsx` (transport repoint)
- `frontend/src/features/members/components/member-new-content.tsx`, `member-edit-content.tsx` (DuplicateWarning import → `./duplicate-warning`)

## Change Log

- 2026-06-07: Story created (duplicates slice extraction + `components/members` relocation; DEC-1 DuplicateWarning home; A76 orange-confirm residual-debt note). Status ready-for-dev.
- 2026-06-07: Implemented — 4 components relocated into the slice, duplicates page extracted to TanStack hooks (cascade `C(N,2)` preserved), `components/members/` deleted. 141 members/slice tests green; tsc/eslint/prettier/build clean; A76 orange preserved as residual debt. Status → review.
