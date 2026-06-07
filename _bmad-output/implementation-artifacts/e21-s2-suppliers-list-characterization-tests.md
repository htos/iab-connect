# Story E21.S2: Suppliers List Page — Characterization Tests (Regression Net)

Status: review

## Story

As a developer about to refactor a page that currently has no tests,
I want a characterization test suite that pins the current observable behaviour first,
so that the E21-S3 refactor is provably behaviour-preserving.

## Acceptance Criteria

1. New `*.test.tsx` co-located with the suppliers list covers the CURRENT behaviour of `frontend/src/app/suppliers/page.tsx`:
   - non-admin / unauthenticated → redirect (admin-only access)
   - supplier load (success path renders rows)
   - server-side status filter (re-fetch with `?status=`)
   - client-side search (in-memory filter over companyName/contactPerson/email/category)
   - loading state, error state, empty state
   - table render with detail link (`/suppliers/{id}`) and edit link (`/suppliers/{id}/edit`)
   - delete-dialog open, delete action, list refresh after delete
2. Tests follow project harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)`, stable `useTranslations` mock, mocked `useApiClient` and `useAuth`.
3. Tests pass against the CURRENT (un-refactored) implementation — they are the green baseline E21-S3 must keep green.
4. No production code changed (test-only). `tsc`/`lint`/`test` green.

## Tasks / Subtasks

- [x] Task 0: Spike the current page behaviour (AC: 1)
  - [x] Read `frontend/src/app/suppliers/page.tsx` end-to-end; enumerated every observable behaviour as a test case (redirect×2, load, detail/edit links, server status filter, client search, empty, error, loading, delete-dialog→delete→refresh).
  - [x] Picked reference harness `frontend/src/app/admin/settings/page.test.tsx` (jsdom directive, `vi.mock("next-intl")`, module-level spy consts, `cleanup`).
- [x] Task 1: Write the characterization tests (AC: 1, 2)
  - [x] Mocked `useAuth` (mutable `authState` for admin vs non-admin vs unauth), `useApiClient` (STABLE `apiClient` with `get`/`delete` returning `{data,error,status}`), `next/navigation` `useRouter` (stable `router` with assertable `push`), `next/link` (real anchor preserving `href`), `next-intl` (stable identity translator per A64).
  - [x] Asserted redirect for unauth (`/login`) + non-admin (`/`) with no fetch; status filter triggers a new `get` with `?status=Active`; search filters client-side with NO new `get`; delete calls `delete` then re-`get` (list refresh).
- [x] Task 2: Verify green against HEAD (AC: 3)
  - [x] `vitest run src/app/suppliers/page.test.tsx` → 10/10 pass against the un-refactored page.
- [x] Task 3: Quality gate (AC: 4)
  - [x] `tsc --noEmit` clean; `eslint src/app/suppliers/page.test.tsx` clean; `prettier --write` applied (new file, A72) then `--check` clean; full `vitest run` → 241/241 (46 files, +10 new), no regressions.

## Dev Notes

This is the ATDD safety net the Gate-1 analysis mandates (CF-5: no Suppliers test exists). It is purely additive and BLOCKS E21-S3.

### Scope Boundaries

In scope: one (or few) co-located test file(s) for the suppliers list page; test-only mocks.
Out of scope: any change to the page, the feature slice (does not exist yet), or shared infra; detail/new/edit pages (list page only).

### Architecture Guardrails

- Test the OBSERVABLE behaviour (what the user/DOM sees + which client calls fire), not implementation details that the refactor will legitimately change (e.g. do not assert on `useState`/`startTransition` internals).
- Pin the current quirks deliberately: status filter is server-side, search is client-side — the refactor must preserve this split, so the tests must encode it.

### Testing Requirements

- Vitest + Testing Library; `// @vitest-environment jsdom`; `afterEach(cleanup)`; stable `useTranslations` mock (return key or a fixed map).
- Mock the network at the `useApiClient` boundary (return `{data,error,status}` shapes matching `lib/auth.ts`).

### Project Structure Notes

- Test file co-located near `frontend/src/app/suppliers/` (or under the feature test folder once it exists in E21-S3 — keep it discoverable either way).

### References

- `frontend/src/app/suppliers/page.tsx:1-241`
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` shape), `frontend/src/lib/auth.ts:51-86` (`useAuth`)
- `frontend/src/app/admin/settings/page.test.tsx` (harness reference)
- `docs/frontend-refactoring-gate1-analysis.md` (CF-5, pilot ordering)

## Validation Notes

- Created 2026-06-07. Pure test-addition; zero behavioural risk; required before E21-S3.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via bmad-dev-story.

### Debug Log References

**Mock-fidelity decision (no DEC-Needed in this story).** The real `useApiClient` and `useRouter` return memoized **stable** objects, and `suppliers/page.tsx` puts `api` in `fetchSuppliers`' dependency array, which is itself in the fetch `useEffect`'s deps. A naive mock returning a fresh object per render (as the `admin/settings` harness does — that page does not depend on `api` identity) would make the fetch effect re-fire every render → infinite refetch loop. Fix: the mock returns a single stable `apiClient`/`router` reference; `authState` is a stable object whose props are mutated per-test. `useTranslations` returns one captured function (A64), though the page does not actually keep `t` in an effect dep so the loop risk is latent there.

**Dialog confirm disambiguation.** Once the hand-rolled delete dialog opens there are two buttons named `common.delete` (the row trigger + the dialog confirm). The dialog is rendered last in JSX, so the test clicks the last match — observable-behaviour assertion, not an implementation detail.

### Completion Notes List

Pure test-addition ATDD regression net (Gate-1 CF-5); zero production code changed. Required before E21-S3.

- ✅ AC-1: `frontend/src/app/suppliers/page.test.tsx` covers all current observable behaviours: unauthenticated→`/login` and non-admin→`/` redirects (no fetch), admin load renders a row per supplier, server-side status filter (`?status=`), client-side search (in-memory over companyName/contactPerson/email/category, no extra GET), loading + error + empty states, detail (`/suppliers/{id}`) + edit (`/suppliers/{id}/edit`) links, delete-dialog open → delete (`DELETE /api/v1/suppliers/{id}`) → list refresh.
- ✅ AC-2: harness conventions met — `// @vitest-environment jsdom`, `afterEach(cleanup)`, stable `useTranslations` mock, mocked `useApiClient`/`useAuth` (+ stable `next/navigation`, `next/link` anchor preserving href).
- ✅ AC-3: 10/10 pass against the CURRENT un-refactored page — the green baseline E21-S3 must keep green.
- ✅ AC-4: no production code changed (test-only). `tsc --noEmit` clean; `eslint` clean on the new file; `prettier --check` clean (after `--write`, new file per A72); full `vitest run` 241/241 (46 files), no regressions. Pre-existing repo lint errors (`members/segments/page.tsx`, A58) are untouched and unrelated.

### File List

- `frontend/src/app/suppliers/page.test.tsx` (new — 10-case characterization suite for the Suppliers list page)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — e21-s2 status → in-progress → review)
- `_bmad-output/implementation-artifacts/e21-s2-suppliers-list-characterization-tests.md` (modified — this story file)

## Change Log

- 2026-06-07: Story created (ATDD regression net for the Suppliers pilot); marked ready.
- 2026-06-07: Implemented the characterization suite `frontend/src/app/suppliers/page.test.tsx` (10 cases) pinning the current observable behaviour of the Suppliers list page. Mocks use stable `useApiClient`/`useRouter` references (avoids the api-identity refetch loop) + mutable `authState`. Verified green against HEAD (10/10) and full suite 241/241, tsc + eslint + prettier clean. Status → review.
