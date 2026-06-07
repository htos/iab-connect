# Story E22.S1: Sponsors — Characterization Tests for All Four Pages (Regression Net)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer about to refactor four un-tested Sponsors pages,
I want a characterization test suite that pins their current observable behaviour first,
so that the E22-S2 (list) and E22-S3 (detail/new/edit) feature-slice extractions are provably behaviour-preserving.

## Acceptance Criteria

**All suites pass against the CURRENT (un-refactored) implementation on branch HEAD — they are the green baseline S2/S3 must keep green. Test-only; no production code changed.**

1. **List** — `frontend/src/app/sponsors/page.tsx` characterization suite covers:
   - Access: unauthenticated → `router.push("/login")` (no fetch); authenticated but **not** (`isVorstand || isAdmin`) → `router.push("/")` (no fetch); `isVorstand || isAdmin` → renders.
   - Load: `GET /api/v1/sponsors` renders one row per sponsor; server-side status filter re-fetches with `?status=<Status>`.
   - Search: client-side, in-memory over `companyName`/`contactPerson`/`email` (NO new GET).
   - States: loading spinner, error banner, empty state.
   - Table: company link → `/sponsors/{id}`, edit link → `/sponsors/{id}/edit`, **status badge AND tier badge** both render, `packageCount` shown.
   - Delete: the delete button renders **only when `isAdmin`** (a Vorstand-but-not-Admin user does not see it); delete dialog open → confirm → `DELETE /api/v1/sponsors/{id}` → list refresh.
   - **A76 delete-failure**: when the DELETE returns an error, the error is surfaced AND the list is not cleared (the two regression classes the green E21-S2 suite missed: destructive affordance + failure branch).
2. **Detail** — `frontend/src/app/sponsors/[id]/page.tsx` characterization suite covers:
   - Access guard (same `isVorstand || isAdmin` rule).
   - `GET /api/v1/sponsors/{id}`: loading state, error/not-found state (`sponsors.notFound`), success renders contact info, sponsor info, tier, status, agreement dates, notes, the packages list, and the contract-links list.
   - Status change: select → `PUT /api/v1/sponsors/{id}/status` (in-flight disabled state).
   - Delete: dialog → `DELETE /api/v1/sponsors/{id}` → redirect to `/sponsors`.
   - Packages: add → `POST /api/v1/sponsors/{id}/packages`; remove → `DELETE /api/v1/sponsors/{id}/packages/{packageId}`; empty state `sponsors.noPackages`.
   - Contract links: add → `POST /api/v1/sponsors/{id}/links`; remove → `DELETE /api/v1/sponsors/{id}/links/{linkId}`; empty state `sponsors.noLinks`.
3. **New** — `frontend/src/app/sponsors/new/page.tsx` characterization suite covers: access guard; form renders the 9 fields (companyName, contactPerson, tier, email, phone, website, agreementStart, agreementEnd, notes); required-field behaviour (companyName + tier); submit → `POST /api/v1/sponsors` → success `router.push("/sponsors")`; submit error → error banner shown and stays on page; saving (disabled) state.
4. **Edit** — `frontend/src/app/sponsors/[id]/edit/page.tsx` characterization suite covers: access guard; `GET /api/v1/sponsors/{id}` prefills the form; submit → `PUT /api/v1/sponsors/{id}` → success `router.push("/sponsors")`; submit error → error banner; load + saving states.
5. Harness conventions met for every suite that calls `render()`: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), **stable** mocks for `useTranslations` (A64), `useApiClient`, `useRouter`, `useAuth`, and `useParams` (A78 — stable references; mutate props per-test, never return a fresh object per render). `next/link` mocked to a real anchor preserving `href`.
6. Quality gate: `tsc --noEmit` clean; `npx eslint <new test files>` clean; `npx prettier --check <new test files>` clean (run `--write` first on the NEW files only, A72); full `vitest run` green with the new suites added; no regression to existing suites. Pre-existing repo lint drift (`members/segments/page.tsx`, A58) untouched.

## Tasks / Subtasks

- [x] Task 0: Spike — read all four pages end-to-end and enumerate observable behaviours (AC: 1-4)
  - [x] Read `app/sponsors/page.tsx`, `app/sponsors/[id]/page.tsx`, `app/sponsors/new/page.tsx`, `app/sponsors/[id]/edit/page.tsx`; list every observable behaviour + every API call (method + exact URL) as a test case.
  - [x] Reference harness: `frontend/src/app/suppliers/page.test.tsx` (E21-S2 output — the canonical pattern for stable mocks + the QueryClientProvider seam) and `frontend/src/features/suppliers/components/supplier-status-badge.test.tsx`.
- [x] Task 1: List suite (AC: 1, 5)
  - [x] Mock `useAuth` with a mutable `authState` to cover unauth / Vorstand-not-Admin / Admin; assert the delete button is absent for Vorstand-not-Admin and present for Admin.
  - [x] Stable `useApiClient` returning `{ data, error, status }`; assert status filter fires a new `get` with `?status=`; search filters client-side with NO new `get`.
  - [x] Delete: open dialog → confirm → assert `DELETE /api/v1/sponsors/{id}` then a refetch GET. Add the **A76 delete-fails** case: DELETE returns `{ error }` → error surfaced, rows still present. (Also added an A76 destructive-affordance assertion on the row delete button.)
- [x] Task 2: Detail suite (AC: 2, 5)
  - [x] Mock `useParams` (stable) for `{ id }`. Cover GET load (success/loading/not-found), the status-change PUT, the delete→redirect, package add/remove, link add/remove, and the two empty states. (`window.alert` stubbed — the current page surfaces mutation errors via `alert`.)
- [x] Task 3: New + Edit suites (AC: 3, 4, 5)
  - [x] New: fill required fields, submit, assert `POST /api/v1/sponsors` + redirect; assert error path keeps the user on the page with a banner; saving (disabled) state.
  - [x] Edit: assert GET prefill, submit `PUT /api/v1/sponsors/{id}` + redirect, error path, load state.
- [x] Task 4: Verify green against HEAD + quality gate (AC: 6)
  - [x] `vitest run` the four new suites → all green against the un-refactored pages (43/43); then full `vitest run` (290/290); `tsc`/eslint/prettier-check clean on the new files; confirmed LF endings (A73).

## Dev Notes

This is the ATDD safety net for the E22 Sponsors migration — the same role E21-S2 played for the Suppliers pilot. Purely additive; **blocks E22-S2 and E22-S3**. The Sponsors pages currently have zero tests.

### Scope Boundaries

- In scope: co-located `*.test.tsx` suites for the four Sponsors pages; test-only mocks.
- Out of scope: any production-code change; the `features/sponsors` slice (does not exist yet — created in S2/S3); shared infra; other features.

### Architecture Guardrails

- Test OBSERVABLE behaviour (DOM the user sees + which client calls fire), NOT implementation details the refactor will legitimately change (do not assert on `useState`/`startTransition`/manual-vs-TanStack internals).
- **Pin the current quirks deliberately so the refactor must preserve them:**
  - List access is `isVorstand || isAdmin` (NOT admin-only like Suppliers); delete is `isAdmin`-only. These two distinct gates are load-bearing — encode both. [Source: `app/sponsors/page.tsx:15,28-31,214`]
  - Status filter is server-side (`?status=`), search is client-side — same split as Suppliers. [Source: `app/sponsors/page.tsx:36-44,93-101`]
  - The list currently renders BOTH a status badge and a tier badge (Suppliers had only status). [Source: `app/sponsors/page.tsx:65-91,201-205`]
- **A76 (the E21 lesson):** a manual→TanStack/Radix refactor silently changes the destructive-button affordance and the error/empty/loading lifecycle incl. the failure branch. The green E21-S2 suite missed exactly P2 (delete-confirm button regressed destructive→primary) and P3 (delete-error display). Your list suite MUST assert: (a) the delete affordance is visibly destructive/distinct, and (b) a delete FAILURE surfaces an error without wiping the list. These are the cases that make S2 provably safe.
- **A79 awareness:** wrap renders that will become TanStack consumers (list after S2; possibly detail after S3) in a `QueryClientProvider` with `retry: false`. Record in the Debug Log that `retry: false` masks the provider's `retry: 1` + sticky-mutation-error + no-spinner-on-refetch deltas — S2/S3 own deciding those.

### Testing Requirements

- Vitest + Testing Library; `// @vitest-environment jsdom`; `afterEach(cleanup)` on every render-calling suite (A35/A46).
- Mock the network at the `useApiClient` boundary returning `{ data, error, status }` (matches `lib/auth.ts`). [Source: `frontend/src/lib/auth.ts:169-295`]
- **A78 mock fidelity:** `useApiClient`/`useRouter`/`useParams` are memoized/stable in production and feed effect-dependency / future query-key chains; the mocks MUST return a single stable reference and mutate props per test (a fresh object per render causes a refetch/effect loop). [Source: E21-S2 Debug Log in `e21-s2-...md`; `frontend/src/app/suppliers/page.test.tsx`]
- `useTranslations` returns one captured identity translator (A64).

### Project Structure Notes

- Co-locate each suite with its page: `app/sponsors/page.test.tsx`, `app/sponsors/[id]/page.test.tsx`, `app/sponsors/new/page.test.tsx`, `app/sponsors/[id]/edit/page.test.tsx`. Keep discoverable when S3 may move logic into `features/sponsors` (the suite can stay at the route or move next to the feature — keep it green either way, mirroring E21-S2→S3).

### References

- `frontend/src/app/sponsors/page.tsx:1-262` (list god-page; access `isVorstand||isAdmin`, delete `isAdmin`, status+tier badges, hand-rolled overlay :233-259)
- `frontend/src/app/sponsors/[id]/page.tsx` (detail: GET :65, status PUT :101-104, delete :119, package POST :132 / DELETE :156, link POST :171 / DELETE :193; empty states `noPackages`/`noLinks`)
- `frontend/src/app/sponsors/new/page.tsx` (POST :44 → redirect :49; 9 manual-useState fields; HTML5-required only)
- `frontend/src/app/sponsors/[id]/edit/page.tsx` (GET prefill :45, PUT :77 → redirect :82; startTransition :66)
- `frontend/src/app/suppliers/page.test.tsx` (E21-S2 harness reference — stable mocks, QueryClientProvider seam)
- `frontend/src/lib/auth.ts:51-86` (`useAuth` flags incl. `isVorstand`/`isAdmin`), `:169-295` (`useApiClient` shape)
- project-context.md A35/A46/A64/A76/A78/A79; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)"

## Validation Notes

- Created 2026-06-07. Pure test-addition; zero behavioural risk; required before E22-S2 and E22-S3.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous epic-wide dev-story run, E22 S1→S2→S3).

### Debug Log References

- Reference-harness alignment: all four suites mirror `frontend/src/app/suppliers/page.test.tsx` (E21-S2/S3) — identity `useTranslations` translator (A64), stable `useApiClient`/`useRouter`/`useParams` references (A78), `next/link` mocked to a real anchor, render wrapped in a `QueryClientProvider` with `retry:false`.
- **A79 note (recorded per story instruction):** `retry: false` in the test harness masks three manual→TanStack deltas that E22-S2/S3 own deciding — the provider's production `retry: 1`, sticky mutation-error semantics, and `isLoading === false` on a same-key refetch (no spinner during refetch-after-mutation). These are invisible to this green suite by design; S2/S3 enumerate and preserve them.
- **A76 (the E21 P2/P3 lesson) — encoded as explicit assertions:** (a) list row delete button asserted visibly destructive (`/red|destructive/` class) so a destructive→primary regression fails; (b) a delete-FAILURE case asserts the error is surfaced AND the rows are not wiped. Both classes were the blind spots the green E21-S2 suite missed.
- Detail-page `alert()`: the current detail page surfaces status/delete/package/link mutation errors via `window.alert`; stubbed with `vi.stubGlobal("alert", vi.fn())` + `vi.unstubAllGlobals()` in `afterEach` so jsdom doesn't throw "not implemented".
- New/Edit required-field validation timing is a deliberate A79 delta (HTML5 `required` → Zod `required`, E22-S3 DEC-1) — the suites pin the happy + error submit paths (the stable observable contract), not the native-validity mechanism, so they stay green across the form refactor.

### Completion Notes List

- Added four co-located characterization suites pinning the CURRENT (un-refactored) observable behaviour of all four Sponsors pages, as the ATDD safety net for E22-S2/S3. Test-only; zero production code changed.
- **AC-1 (List):** ✅ access (unauth→/login no-fetch; auth-non-authorized→/ no-fetch; Vorstand-not-Admin renders; Admin renders), load + server-side `?status=` filter, client-side search (no extra GET), loading/error/empty states, company+edit links, **status badge AND tier badge**, package count, **Admin-only delete** (absent for Vorstand-not-Admin, present for Admin), delete dialog→confirm→`DELETE`→refresh, **A76 destructive affordance + A76 delete-failure (error surfaced, list intact)**.
- **AC-2 (Detail):** ✅ access guard, GET load (success / loading / 404 `sponsors.notFound` / error), status change `PUT /status`, delete→`DELETE`→redirect `/sponsors`, package add `POST /packages` + remove `DELETE /packages/{id}` + empty `noPackages`, link add `POST /links` + remove `DELETE /links/{id}` + empty `noLinks`, Admin-only delete affordance.
- **AC-3 (New):** ✅ access guard, companyName+tier fields render, submit `POST /api/v1/sponsors` → redirect, submit-error banner stays on page, saving (disabled) state.
- **AC-4 (Edit):** ✅ access guard, GET prefill, submit `PUT /api/v1/sponsors/{id}` → redirect, submit-error banner, loading state.
- **AC-5 (Harness):** ✅ `// @vitest-environment jsdom` + `afterEach(cleanup)` on every suite; stable mocks (A64/A78); `next/link` → real anchor preserving `href`.
- **AC-6 (Quality gate):** ✅ `tsc --noEmit` clean; `eslint` clean on the 4 new files; `prettier --check` clean (after `--write` on the NEW files only, A72); full `vitest run` green **290/290** (+43 new); no regression (pre-existing 247 still green); LF-clean (A73). Pre-existing repo lint drift untouched (A58).
- Verified each suite is green against HEAD (un-refactored pages): List 17, Detail 15, New 6, Edit 5 = 43.

### File List

- `frontend/src/app/sponsors/page.test.tsx` (new — list characterization suite, 17 tests)
- `frontend/src/app/sponsors/[id]/page.test.tsx` (new — detail characterization suite, 15 tests)
- `frontend/src/app/sponsors/new/page.test.tsx` (new — new-sponsor characterization suite, 6 tests)
- `frontend/src/app/sponsors/[id]/edit/page.test.tsx` (new — edit-sponsor characterization suite, 5 tests)

## Change Log

- 2026-06-07: Story created (ATDD regression net for the Sponsors migration; mirrors E21-S2 across all four Sponsors pages). Status ready-for-dev.
- 2026-06-07: Implemented all four characterization suites (43 tests) green against HEAD; full suite 290/290; tsc/eslint/prettier-check/LF clean. Status → review.
