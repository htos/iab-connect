# Story E23.S1: Members — Characterization Tests for All Nine Pages (Regression Net)

Status: done

Depends on: E21-S3 + E21-S5 (closed), E22 form sub-recipe (closed). Inherits E21-S1 boundary decisions (DEC-1 client contract, DEC-2 status colours) and the E21-S3/E22 pilot recipe. **Blocks E23-S2/S3/S4** (each requires this net green).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer,
I want a pinned characterization-test net over all nine Members pages,
so that the subsequent slice extractions (E23-S2/S3/S4) can prove behaviour was preserved.

## Acceptance Criteria

**Behaviour preserved (test-only story — no production code changes; all E23-S1 tests stay green at HEAD):**

1. Tests cover all **9** pages: `members/page.tsx` (list), `members/[id]/page.tsx` (detail), `members/[id]/edit/page.tsx`, `members/new/page.tsx`, `members/duplicates/page.tsx`, `members/segments/page.tsx`, `members/segments/new/page.tsx`, `members/segments/[id]/page.tsx`, `members/segments/[id]/edit/page.tsx`.
2. **Auth guards pinned per page** (identical on all 9): unauthenticated → `router.push("/login")` and **no data fetch fires**; authenticated-but-not-`isVorstand`-and-not-`isAdmin` → `router.push("/")` and no fetch; authorized (Vorstand or Admin) renders.
3. **Admin-only affordances** asserted present for Admin and **absent** for a Vorstand-only user (A76 destructive-affordance gating):
   - List: CSV export button (`{isAdmin && …}`) and per-row Delete button (`{isAdmin && …}`).
   - Detail: Delete button (`{isAdmin && …}`).
   - Duplicates: the **Merge** button is `disabled` for non-Admin (it is rendered but disabled with `title=members.duplicates.mergeAdminOnly`); **Dismiss** is available to any Vorstand+.
   - Segments list + detail: the Delete control (`{isAdmin && …}`).
4. **List behaviours pinned:** search submit (`handleSearch` → `preventDefault` + `setPage(1)`) resets page to 1; status filter change and type filter change each `setPage(1)` and refetch; statistics cards render only when the statistics payload is present; pagination Prev disabled at `page===1`, Next disabled at `page===totalPages`; delete uses `confirm()` then `alert()` on failure, and a successful delete triggers a members refetch + a statistics refetch (A76 destructive lifecycle — pin the CURRENT mechanism so S2's migration to a dialog is a visible, intended delta).
5. **Detail behaviours pinned:** 404 → not-found view; status-quick-change `PUT …/status` and type-quick-change `PUT …/type` replace state from the response (no refetch); delete → `confirm()` → `router.push("/members")` and `alert()` on failure; error renders a full-page error view (distinct from the list's inline banner).
6. **New/Edit behaviours pinned (duplicate-detection is load-bearing, REQ-018):** new runs a single pre-flight duplicate check inside submit (fail-open); edit runs a 350 ms-debounced `AbortController` recheck with `excludeMemberId`; both **hard-block** an Exact match (no POST/PUT), gate a Likely-only match behind a "save anyway" confirm (`confirmedProceed`), and handle a `409 + existingMemberId` by surfacing a synthesized Exact candidate; success → `router.push("/members")`; new has a `membershipType` select, edit does not.
7. **Duplicates behaviours pinned:** tier filter change `setMinTier` + `setPage(1)`; Merge opens `MergeConfirmationModal`; Dismiss opens `DismissConfirmationModal`; a successful confirm bumps `refreshKey` and refetches; **cascade-dismiss issues one `dismissDuplicateCandidate` call per canonical pair** (`C(N,2)` pairs via `Promise.all`); merge confirm posts `{reason, confirmFinanceImpact, confirmKeycloakImpact}`.
8. **Segments behaviours pinned:** list search (Enter) + `typeFilter`/`activeFilter` changes reset page + refetch; inline two-step delete (`deletingId` → confirm/cancel, NOT `confirm()`/`alert()`), Admin-only; new/edit submit + success redirect (new → `/members/segments`, edit → `/members/segments/{id}`); detail member-typeahead (debounced) + add/remove member + `refreshKey` refetch; edit shows segment type read-only.
9. **Error/empty/loading lifecycle pinned per page including failure paths** (A76): a fetch rejection renders the page's error surface (inline banner for list/segments-list, full-page for detail/segment-detail, retry control where one exists); an empty result renders the empty state.

**Improvements:**

10. Harness follows A35/A46 (`// @vitest-environment jsdom` + `afterEach(cleanup)`), A64/A78 stable mocks for `useTranslations` (identity translator), `useRouter`/`useParams` (stable objects), `useAuth` (mutated-in-place stable state object), and wraps every `render` in a fresh `QueryClientProvider` (`{ queries: { retry: false }, mutations: { retry: false } }`) so the S2/S3/S4 TanStack adopters need **no harness rework**.
11. Tests assert via i18n keys (identity translator returns the key), ARIA roles, and `data-testid` where they already exist (`duplicates-list`, `duplicates-error`, `duplicates-empty`, `duplicates-tier-filter`, `duplicate-group-${groupKey}`, `merge-confirmation-modal`, `dismiss-confirmation-modal`, `duplicate-warning`), **not** brittle display copy, so they survive the refactor.

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + harness spike (AC: all)
  - [x] On branch `refactor/frontend-feature-slice`; `src/features/members/` does NOT exist yet; the 9 pages have ZERO tests today (confirmed — this is the E21-S2 starting condition).
  - [x] **Pin the three sub-harnesses (load-bearing — the data layer is NOT uniform across the 9 pages):**
    - Core (list/detail/edit/new) use **raw `fetch` + `Authorization: Bearer ${accessToken}`** (NOT `useApiClient`); base = `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"`. → `vi.stubGlobal("fetch", fetchMock)` returning `{ ok, status, json, blob }`; mock `useAuth` to supply `accessToken` + `isVorstand`/`isAdmin`; `vi.stubGlobal("confirm", …)` + `vi.stubGlobal("alert", …)` for delete.
    - Duplicates uses the `@/lib/api/members` standalone fns (`getDuplicateGroups`, `mergeMembers`, `dismissDuplicateCandidate`, all raw-fetch). → `vi.mock("@/lib/api/members", …)` partial-mocking those 3 fns (keep `parseMatchReason`, the enums, and the DTO types real); render the real `MergeConfirmationModal`/`DismissConfirmationModal` (they compose `@/components/ui/dialog`).
    - Segments use **`useApiClient`** (`api.get/post/put/delete` → `{ data, error }`). → `vi.mock("@/lib/auth", …)` with a stable `apiClient` object.
- [x] Task 1: Core list characterization spec — `app/members/page.test.tsx` (AC: 2, 3, 4, 9) — 22 tests
  - [x] Auth: unauth→`/login` + no fetch; Vorstand-only and Admin both render; CSV-export + row-Delete present for Admin, absent for Vorstand-only.
  - [x] Search submit resets page to 1; status/type filter change resets page + refetches (assert the `?page=1&…&status=&type=` query string on the fetch mock); statistics cards gated on payload; pagination bounds disabled.
  - [x] Delete: `confirm()` true → `DELETE …/members/{id}` → refetch members + statistics; failure → `alert()`. Empty state; inline error banner with retry on fetch reject.
- [x] Task 2: Core detail spec — `app/members/[id]/page.test.tsx` (AC: 2, 3, 5, 9) — 14 tests
  - [x] 404 not-found; status/type quick-change PUT + state-from-response; delete (admin-only) → `/members` + alert-on-failure; full-page error view.
- [x] Task 3: Core new + edit specs — `app/members/new/page.test.tsx` (9 tests), `app/members/[id]/edit/page.test.tsx` (10 tests) (AC: 2, 6, 9)
  - [x] Duplicate-detection: Exact hard-block (no POST/PUT), Likely gated behind `confirmedProceed`, `409+existingMemberId` synthesizes an Exact candidate; new pre-flight fail-open vs edit debounced AbortController recheck; success redirect to `/members`; `membershipType` present on new / absent on edit.
- [x] Task 4: Duplicates spec — `app/members/duplicates/page.test.tsx` (AC: 2, 3, 7, 9) — 14 tests
  - [x] Auth + Merge-disabled-for-non-Admin + Dismiss-for-Vorstand; tier filter resets page; Merge/Dismiss modal open; **cascade-dismiss = one call per `C(N,2)` pair** (assert call count for a 3-member group = 3); merge confirm posts the two impact booleans; `refreshKey` refetch after confirm; `duplicates-loading`/`-error`(retry)/`-empty` states.
- [x] Task 5: Segments specs — `app/members/segments/{page,new/page,[id]/page,[id]/edit/page}.test.tsx` (AC: 2, 3, 8, 9) — 14+6+14+10 = 44 tests
  - [x] List: search/filter reset + refetch, inline two-step delete (Admin-only), empty/error. New/edit: submit + redirect, segment-type read-only on edit. Detail: member typeahead + add/remove + `refreshKey` refetch; not-found state.
- [x] Task 6: Green-at-HEAD + DoD gate (AC: 1, 10, 11)
  - [x] `npx vitest run src/app/members` green for all 9 new specs against HEAD (the unmodified god-pages): **113 tests passing**; `npx tsc --noEmit` clean; `npx eslint <new test files>` clean; `npx prettier --check <new test files>` clean. Final spec count = 113; HEAD quirks recorded in Completion Notes (pinned, not fixed).

## Dev Notes

This is the regression net that gates the entire E23 epic — the equivalent of E21-S2 for Suppliers. Write it against the **current god-pages** (raw-fetch, manual-`useState`, `confirm()`/`alert()`), pin actual behaviour, and keep it green at HEAD before any extraction. Mirror the proven `frontend/src/app/suppliers/page.test.tsx` (list) and `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations) harnesses.

### Scope Boundaries

- In scope: new `*.test.tsx` files colocated with each of the 9 route pages; the shared mock/harness conventions.
- Out of scope: any production-code change (this is test-only); creating `features/members/` (that is S2); i18n changes; touching the suppliers/sponsors slices.

### Architecture Guardrails

- **The harness is NOT uniform** (the single biggest gotcha): core + duplicates pages do raw `fetch`/standalone-fns; segments pages use `useApiClient`. The S1 epic AC text says "stable mocks for `useApiClient`" by analogy to suppliers, but the core members pages do **not** use it — stub global `fetch` for those (Task 0). Do not assume the suppliers mock block ports verbatim.
- Wrap every render in `QueryClientProvider` even though the god-pages don't use TanStack yet — this is the forward-compat seam (AC-10) so S2/S3/S4 reuse the same specs without harness churn.
- A64/A78: mocked hooks MUST return stable references (define once, mutate fields per-test) — the core list keeps `searchTerm`/filters in effect deps, and a fresh translator/router/client per render would re-fire effects and loop.
- Assert via keys/roles/`data-testid` (AC-11), never display copy.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run`. NEVER `npm run format` (prettier-tailwind re-sorts repo-wide) and never repo-wide lint/format as the gate (A58/A72). New test files may be `prettier --write` (they are new, not pre-drifted). Keep files LF (A73).

### A76/A79 note on the delete lifecycle (cross-story)

S1 pins the **current** `confirm()`/`alert()` delete on the core list/detail and the **inline two-step** delete on segments. S2/S4 will replace these with the slice's `DeleteDialog` (alert-dialog + `buttonVariants({ variant: "destructive" })`) — an intended A79 delta. Write the delete assertions so the **outcome** (DELETE fires after confirmation; list refreshes; failure is surfaced) is what's pinned, and flag in Completion Notes that the *mechanism-level* delete tests are the surface S2/S4 are licensed to update. Everything else in the net must stay green through the migration.

### Testing Requirements

- Vitest + Testing Library; `// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)` (A35/A46) on every render-based spec.
- Detail/edit specs stub `window.alert`/`window.confirm`; reset via `vi.unstubAllGlobals()` in `afterEach`.
- Duplicates 3-member-group cascade test is the load-bearing assertion (call count = 3).

### Project Structure Notes

- Target tree (test-only): `app/members/page.test.tsx`, `app/members/[id]/page.test.tsx`, `app/members/[id]/edit/page.test.tsx`, `app/members/new/page.test.tsx`, `app/members/duplicates/page.test.tsx`, `app/members/segments/page.test.tsx`, `app/members/segments/new/page.test.tsx`, `app/members/segments/[id]/page.test.tsx`, `app/members/segments/[id]/edit/page.test.tsx`.

### References

- Harness templates: `frontend/src/app/suppliers/page.test.tsx` (list, ~305 lines), `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations, ~394 lines, `vi.stubGlobal("alert", …)`), `frontend/src/features/sponsors/sponsor-form.test.tsx` (form unit).
- Pages under test: `frontend/src/app/members/page.tsx:1` (list; auth :115-125; admin gates :223,:439; delete :174-194; pagination :460-482), `…/[id]/page.tsx` (detail; delete :140-160; PUT status/type :91-132), `…/[id]/edit/page.tsx` (debounced dup recheck :111-158; submit :160-210), `…/new/page.tsx` (pre-flight submit :60-131), `…/duplicates/page.tsx` (auth :52-61; cascade-dismiss :110-125; tier filter :172-184; testids :192-253), `…/segments/page.tsx` (delete :312-339), `…/segments/[id]/page.tsx` (refreshKey, typeahead), `…/segments/[id]/edit/page.tsx`.
- `frontend/src/lib/api/members.ts` (duplicate fns: `getDuplicateGroups` :329, `dismissDuplicateCandidate` :358, `mergeMembers` :382; DTOs `DuplicateGroupDto` :285).
- `frontend/src/lib/auth.ts` (`useApiClient` `{data,error,status}` contract) for the segments sub-harness.
- `frontend/messages/messages.parity.test.ts` (pure-Node parity example — no jsdom, A46).
- project-context.md A34/A35/A46/A56/A58/A64/A72/A73/A76/A78/A79; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)".

## Validation Notes

- Created 2026-06-07 as part of the whole-epic E23 preparation. Status ready-for-dev. Test-only; must be green at HEAD before E23-S2 begins. The non-uniform three-sub-harness finding (raw `fetch` core/duplicates vs `useApiClient` segments) is the load-bearing A56 result for this story.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story; 6 parallel general-purpose subagents authored the 9 specs, orchestrator verified the combined suite + gates).

### Debug Log References

- `npx vitest run src/app/members` → 9 files / 113 tests passing at HEAD.
- `npx tsc --noEmit` → initially 4 errors (duplicates spec `pagedResult` helper missing `hasNextPage`/`hasPreviousPage` from `PagedResult<T>`); fixed by adding both fields → clean.
- `npx prettier --check <9 specs>` → clean; `npx eslint <9 specs>` → clean.

### Completion Notes List

Test-only regression net pinning the CURRENT behaviour of all 9 Members pages before the E23-S2/S3/S4 extractions. 113 tests across 9 colocated `*.test.tsx` files, green at HEAD.

**Three non-uniform sub-harnesses (the load-bearing A56 finding) confirmed in code and applied:**
- Core (list/detail/new/edit) → raw `vi.stubGlobal("fetch", …)` (Bearer-token fetch, NOT `useApiClient`).
- Duplicates → partial `vi.mock("@/lib/api/members", …)` over the 3 standalone fns (`getDuplicateGroups`/`mergeMembers`/`dismissDuplicateCandidate`), enums/DTOs/`parseMatchReason` kept real, real `Merge`/`DismissConfirmationModal` rendered.
- Segments (4 pages) → `useApiClient` `{data,error,status}` stable apiClient mock.

All specs: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46), stable mocks (A64/A78), every render wrapped in a fresh `QueryClientProvider {retry:false}` (forward-compat seam AC-10 so S2/S3/S4 TanStack adopters need no harness rework), assertions via i18n keys/roles/`data-testid` not display copy (AC-11), LF (A73).

**Load-bearing assertions pinned:** cascade-dismiss = exactly `C(N,2)` `dismissDuplicateCandidate` calls (3 for a 3-member group) via `Promise.all`; duplicate-detection Exact hard-block / Likely-`confirmedProceed` / `409+existingMemberId` synthesis on both new & edit; new pre-flight fail-open vs edit 350ms-debounced AbortController re-check with `excludeMemberId`.

**A76/A79 cross-story note:** the `confirm()`/`alert()` delete (core list/detail) and inline two-step delete (segments) are pinned at the OUTCOME level (DELETE fires after confirmation, list refreshes, failure surfaced) so S2/S4 are licensed to migrate the *mechanism* to the slice `DeleteDialog` without breaking the net. Everything else must stay green through the migration.

**HEAD quirks discovered (pinned as-is, NOT fixed — candidate follow-ups for S2/S3/S4):**
1. Core list/detail: the auth-redirect effect and the fetch effect are split across separate `useEffect`s with different dep gates; `accessToken` omitted from the redirect effect's deps (latent staleness seam). The "no fetch fired" guarantees rely on the fetch effect's `isAuthenticated && (isVorstand||isAdmin) && accessToken` gate.
2. Duplicate-check error handling is asymmetric: NEW is fail-open (pre-flight error → POST proceeds, logs `console.error`); EDIT's check lives in a debounced effect so a failed check silently leaves stale/empty candidates rather than blocking.
3. NEW clears `duplicateCandidates`+`confirmedProceed` on any field change, so the Likely "save anyway" path only works if no field is edited between confirm and the 2nd submit (pinned accordingly).
4. Segments DETAIL data-load effects guard only on `isAuthenticated && !isLoading`, NOT on role — an authenticated non-Admin/non-Vorstand user is redirected to `/` but the segment/members GETs still fire (unauthenticated users do not fetch). Pinned explicitly.
5. Segments LIST inline-delete is UI-gated (`{isAdmin && …}`) but `handleDelete` has no role check itself (UI-only gating). Pinned the "absent for Vorstand-only" UI behaviour.

### File List

- `frontend/src/app/members/page.test.tsx` (new)
- `frontend/src/app/members/[id]/page.test.tsx` (new)
- `frontend/src/app/members/[id]/edit/page.test.tsx` (new)
- `frontend/src/app/members/new/page.test.tsx` (new)
- `frontend/src/app/members/duplicates/page.test.tsx` (new)
- `frontend/src/app/members/segments/page.test.tsx` (new)
- `frontend/src/app/members/segments/new/page.test.tsx` (new)
- `frontend/src/app/members/segments/[id]/page.test.tsx` (new)
- `frontend/src/app/members/segments/[id]/edit/page.test.tsx` (new)

## Change Log

- 2026-06-07: Story created (characterization net over all 9 Members pages; three non-uniform sub-harnesses pinned). Status ready-for-dev.
- 2026-06-07: Implemented — 113 characterization tests across all 9 pages, green at HEAD; typecheck/eslint/prettier clean. HEAD quirks recorded (pinned, not fixed). Status → review.
