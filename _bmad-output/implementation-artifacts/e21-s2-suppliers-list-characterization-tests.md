# Story E21.S2: Suppliers List Page — Characterization Tests (Regression Net)

Status: ready

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

- [ ] Task 0: Spike the current page behaviour (AC: 1)
  - [ ] Read `frontend/src/app/suppliers/page.tsx` end-to-end; enumerate every observable behaviour as a test case.
  - [ ] Pick a reference harness: `frontend/src/app/admin/settings/page.test.tsx` (jsdom directive, `vi.mock("next-intl")`, `cleanup`).
- [ ] Task 1: Write the characterization tests (AC: 1, 2)
  - [ ] Mock `useAuth` (admin vs non-admin), `useApiClient` (`get`/`delete` returning `{data,error,status}`), `next/navigation` `useRouter`.
  - [ ] Assert redirect for non-admin; assert status-filter triggers a new `get` with the status query; assert search filters client-side without a new `get`; assert delete calls `delete` then re-`get`.
- [ ] Task 2: Verify green against HEAD (AC: 3)
  - [ ] `vitest run` shows the suite passing with the un-refactored page.
- [ ] Task 3: Quality gate (AC: 4)
  - [ ] `tsc --noEmit`, `eslint` on the new test file, full `vitest run` (no regressions).

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-07: Story created (ATDD regression net for the Suppliers pilot); marked ready.
