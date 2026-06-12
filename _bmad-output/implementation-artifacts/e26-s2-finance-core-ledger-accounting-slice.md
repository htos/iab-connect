# Story E26.S2: Finance Core Ledger/Accounting — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E26-S1 (the S2 ledger/accounting suites must be green at HEAD first)**, plus E21-S3 (list recipe) + E21-S5 (import boundary) + the E22 RHF+Zod form sub-recipe (all closed). Inherits E21-S1 boundary decisions. **This story OWNS the shared `features/finance/` foundation** (`api/finance-api.ts` base + `financeKeys`, `types/finance.types.ts`) that S3..S6 reuse, and sets the `features/finance` slice-structure + thin-route-shell precedent for the rest of the epic. HARD-ordered FIRST among the slice stories; S3..S6 depend on this foundation but are mutually independent once it lands (A101 area-as-one-slice-with-shared-foundation).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer migrating the largest finance surface,
I want the seven core ledger/accounting pages refactored into `src/features/finance/` establishing the shared finance `api`/`types` foundation,
so that user-visible behaviour is unchanged, the `canReadFinance`/`canWriteFinance` guards are preserved exactly, and S3..S6 reuse the foundation without duplication.

## Acceptance Criteria

**Behaviour preserved (all E26-S1 ledger/accounting tests stay green):**

1. The finance read guard is preserved on every page EXACTLY as it is today (E26-S1 pins each shape — do NOT normalise): `finance/page.tsx` keeps the canonical `isAuthenticated`/`authLoading` + `router.push("/")` + spinner→`return null`; `accounts` keeps the lean `canReadFinance`-only + `router.replace("/")` + `return null` (no `isAuthenticated`/`authLoading`); `fiscal-periods` keeps `authLoading` spinner + inline-error (NO redirect, NO `router`); `accounting-reports` keeps `null`-while-`!modeChecked`. The **DoubleEntry mode guard** (GET `/api/v1/finance/profile` → `router.replace("/finance/settings")` unless `accountingMode === "DoubleEntry"`, data gated on `modeChecked`) is preserved verbatim on `ledger-accounts`, `journal-entries`, `accounting-reports`, `posting-mappings`. `canWriteFinance` still gates every mutation (account/ledger-account/posting-mapping create-edit-delete; journal-entry post/reverse/Draft-edit; fiscal-period generate/close/lock/reopen and the `isAdmin`-only unlock), never weakened.
2. All `/api/v1/finance/*` URLs unchanged (dashboard summary/dashboard/invoices-open/transactions; accounts; ledger-accounts; journal-entries incl. `?status=`, `/{id}`, `/post`, `/reverse`; accounting-reports trial-balance/balance-sheet/profit-and-loss with their query params; fiscal-periods `?year=` + generate/close/reopen/lock/unlock; posting-mappings; plus the read-only lookups tax-codes/activity-areas/categories). Routes and `finance.*` / `finance.accounting` / `fiscalPeriods` / `financeErrors` i18n keys unchanged. The journal-entry **balance gate** (`|debit−credit| < 0.005`), the fiscal-period **409 "finance profile" → `noProfileError`** branch, and the per-page **silent `res.error` swallow vs modal-stays-open** behaviours (E26-S1 AC-5) are preserved exactly.

**Improvements:**

3. Slice is `src/features/finance/` (ONE feature dir with a shared foundation — NOT five independent dirs; finance is one feature per the epic spec). Composition roots are the only `"use client"`; each route file becomes a thin entry importing the slice. **No per-feature ESLint entry needed** — the generic `src/features/**` `no-restricted-imports` zone already covers it (A101); verify the boundary lints clean.
4. **Establish the shared foundation (this story owns it; S3..S6 import, never edit it — keeps them parallel-safe per A91/A101):**
   - `api/finance-api.ts` — the `FINANCE_BASE = "/api/v1/finance"` const + a `financeKeys` root query-key factory (`all`, plus a stable namespacing helper) + the ledger/accounting URL builders (dashboard, accounts, ledger-accounts, journal-entries incl. `{id}`/`post`/`reverse`/`?status=`, accounting-reports, fiscal-periods incl. the action sub-paths, posting-mappings, and the shared read-lookups tax-codes/activity-areas/categories/profile). URL builders + keys only — **no fetching here**; hooks own the `useApiClient` calls (so the E26-S1 `useApiClient` mock keeps intercepting, A88/A94 BUILD case → zero transport-mock edits).
   - `types/finance.types.ts` — **re-exports** shared finance DTOs/unions from `@/types/finance` where they exist (A83 — `features→lib` legal; do NOT relocate `@/types/finance`, it is consumed across the app), and adds the new ledger/accounting types (Account, LedgerAccount, JournalEntry/Line, FiscalPeriod, PostingMapping, the accounting-report shapes, the `profile`/`accountingMode` shape). **Also place the shared read-lookup types here — `ActivityArea` (the full `{id,name,code,description,color,isActive,sortOrder}` shape, consolidating the 3 independent god-page declarations), `TaxCode`, `Category`** — and their GET-list URL builders/keys in `finance-api.ts`, because S2's journal-entries + posting-mappings consume them as read-lookups. S4 (activity-areas/categories CRUD+report) and S6 (settings) then REUSE these types from the foundation rather than re-declaring (A62/A101); S4/S6 add only the write builders.
5. Add `hooks/use-*.ts` (TanStack Query) per page-resource, each calling `useApiClient` internally and keying on `financeKeys`: list queries (`use-accounts`, `use-ledger-accounts`, `use-journal-entries` (server `?status=`), `use-fiscal-periods` (`?year=`), `use-posting-mappings`, `use-accounting-report`, the dashboard composite, and the shared read-lookups), plus mutations invalidating the relevant `financeKeys` (account/ledger/mapping CRUD; journal create/update(Draft)/post/reverse; fiscal generate/close/reopen/lock/unlock). The journal-entry detail/edit-load query is `retry:false` per A99 (the god-page silently returns on `res.error`, no status sentinel). Thin `components/*.tsx` page-content composition roots (table/filter-bar/badges/modal-forms/report-tabs). App-router `page.tsx` files become thin shells importing the slice.
6. **Manual→TanStack deltas (A79/A100) decided explicitly:** refetch-after-mutation via `invalidateQueries`; mutation errors surfaced exactly as today (the silent-swallow handlers on `accounts`/`posting-mappings` stay silent — E26-S1 pins it; do NOT "fix" to surface errors); the journal/fiscal modal-stays-open-on-error behaviour preserved; the `modeChecked`-gated fetch preserved (query `enabled` gated on `modeChecked && canReadFinance`, matching the god-page's fetch precondition per A97). The DoubleEntry-mode redirect stays an imperative effect (it is auth/mode routing, not data).
7. No new `any`, no new hard-coded user-facing strings (the existing hardcoded-English strings, if any in this group, are pinned by S1 — preserve, do not translate), no new direct API URL in route files/components (all URLs centralised in `finance-api.ts`), no duplicate UI primitive, `formatCHF`/`formatCurrency` reused from `@/lib/utils` (not duplicated); i18n parity stays green.

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E26-S1 ledger/accounting suites green at HEAD. Confirm `features/finance/` does NOT exist. Re-read the 7 pages + `@/types/finance.ts` + `lib/api/budgets.ts` (types/consts pattern) + a reference BUILD-on-`useApiClient` slice (`features/admin-settings` / `features/admin-integrations`) + the members form/two-step patterns (A56).
  - [ ] Resolve DEC-1..DEC-3 (recommended options below).
- [ ] Task 1: Scaffold the shared foundation — `api/finance-api.ts` (`FINANCE_BASE` + `financeKeys` root + ledger/accounting URL builders) + `types/finance.types.ts` (re-export `@/types/finance` + new ledger/accounting types) + `api/finance-api.test.ts` (URL/key shape, incl. the action sub-paths + `?status=`/`?year=` query builders).
- [ ] Task 2: Hooks — list queries (accounts/ledger-accounts/journal-entries(`?status=`)/fiscal-periods(`?year=`)/posting-mappings/accounting-report/dashboard composite + shared lookups), `retry:false` journal detail/edit-load (A99); mutations (account/ledger/mapping CRUD, journal create/update/post/reverse, fiscal generate/close/reopen/lock/unlock) each invalidating `financeKeys`. Hook tests for one query + one mutation-invalidation + the journal no-retry.
- [ ] Task 3: Components — read-only pages — `finance-dashboard-content` (KPI cards/open-items/recent-tx), `accounting-reports-content` (3 tabs + filter dates + client-side PDF print preserved). Preserve the dashboard's `apiRef` empty-dep load pattern via the hook equivalent.
- [ ] Task 4: Components — CRUD pages — `accounts`, `ledger-accounts`, `posting-mappings`, `journal-entries` content + their modal forms (manual-form parity OR E22 RHF+Zod per DEC-3; if RHF+Zod, apply A95 to the `isActive`-filtered `<select>`s + A96 no-`.trim()`). Badges via the page-local helpers preserved (classBadge/typeBadge/statusBadge — A77 literal-class exception, the S1 net pins exact classes). Post=green / Reverse=red / Delete=red colours preserved (A86). The journal **balance gate** + min-2-lines + line add/remove preserved.
- [ ] Task 5: Components — `fiscal-periods` content (year select, generate/close/lock/reopen/unlock confirm modals, the 409 `noProfileError` amber banner + `/finance/settings` link, the 4s success auto-dismiss, the `isAdmin`-only unlock). Preserve the inline-error guard (no redirect).
- [ ] Task 6: Thin route entries — the 7 route files → content components. Preserve the DoubleEntry mode guard placement (in the slice content/hook, redirect target `/finance/settings`).
- [ ] Task 7: Green-the-net + DoD gate — E26-S1 ledger/accounting suites green (transport mocks unchanged — BUILD-on-`useApiClient` per A94; adapt only the licensed A79 surface if any); new slice unit tests; `tsc` exit 0 / eslint(slice+changed, incl. the generic `features/**` boundary) clean / `vitest run` FULL green, no regressions; LF. A79/A99 deltas recorded. (`next build` deferred to epic boundary per A58.)

## Dev Notes

First `features/finance/` slice — OWNS the shared `api`/`types` foundation S3..S6 reuse, and sets the slice-structure + thin-route precedent. All seven pages already call `useApiClient` directly, so the slice api layer is URL-builders + `financeKeys` (no fetching) and the hooks own the `useApiClient` calls — the E26-S1 `useApiClient` mock keeps intercepting, so the net survives with zero transport edits (A94 BUILD case). Update the `docs/architecture-frontend.md` recipe note with the finance one-slice-shared-foundation convention (contrast with admin's five independent sub-slices).

### Scope Boundaries

- In scope: `features/finance/{api,types,hooks,components}` for the 7 ledger/accounting pages + the shared `finance-api.ts`/`finance.types.ts` foundation; thin route entries; new slice unit tests.
- Out of scope: S3..S6 pages; modifying `@/types/finance` breaking-ly (re-export only); the read-only lookups' OWN pages (tax-codes/activity-areas/categories pages belong to S4/S6 — here only their GET lookups are consumed); any route-group move; converting the imperative DoubleEntry-mode redirect to data; "fixing" the silent `res.error` swallow or the heterogeneous guards (pin/preserve only).

### Architecture Guardrails

- Mirror `features/members/` + `features/admin-settings/` (api → `financeKeys` + URL builders; hooks → query/mutation + invalidation calling `useApiClient`; thin `"use client"` root; relative intra-slice imports only — E21-S5; a feature must NOT import another `@/features/*`, but `features/finance` is ONE feature so intra-slice imports are all relative/same-feature).
- A94: BUILD on `useApiClient`; URLs/params/bodies byte-identical. A99: `retry:false` on the journal detail/edit-load query. A97: query `enabled` matches the god-page fetch precondition (`modeChecked && canReadFinance`), NOT a render role-gate. A86: preserve existing action colours (post=green, reverse=red, delete=red, fiscal close=yellow). A77: if any badge moves to a Badge token, verify against the named colour; otherwise keep the page-local literal-class helpers (the S1 net pins exact classes — literal-class is the sanctioned exception).
- DoD as E27 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 foundation shape (A91):** A) one `financeKeys` root + `FINANCE_BASE` in `finance-api.ts`, with each later story adding its own `<sub>-api.ts`/`<sub>.types.ts` importing the root (recommended — parallel-safe for S3..S6; nobody edits the foundation file after S2). B) one monolithic `finance-api.ts` every story edits (rejected — serialises S3..S6 + merge conflicts). **Recommended: A.**
- **DEC-2 type home (A83):** A) re-export shared DTOs/unions from `@/types/finance` via `types/finance.types.ts` + add new ledger/accounting types there (recommended; `features→lib` legal). B) relocate `@/types/finance` into the slice (rejected — consumed across the app incl. non-finance pages). **Recommended: A.**
- **DEC-3 CRUD-form mechanism:** A) keep the four CRUD modal forms as manual `useState` (recommended for THIS story — they are not the epic's RHF+Zod showcase; the spec scopes the form sub-recipe to S3 invoices + S6 settings; preserving manual forms keeps the net green with least risk, and the `isActive`-filtered-select A95 concern is then a pin-only, no schema). B) migrate them to RHF+Zod now (more consistent but adds A95/A96 surface + net-adaptation risk to the foundation story). **Recommended: A** (record B as residual debt — a later consistency pass may migrate them).

### Testing Requirements

- The E26-S1 ledger/accounting suites are the regression oracle — keep green; only the data-mechanism (TanStack query/mutation) is the licensed A79 update surface. Guards (each page's exact shape + redirect target), DoubleEntry mode guard, fetch URLs, post/reverse/balance gates, the 409 `noProfileError` branch, badges-via-label must stay green verbatim.
- Add focused slice unit tests: `finance-api` URL/key shape (the action sub-paths + query builders); the journal no-retry; one mutation-invalidation; the dashboard composite query.

### Project Structure Notes

- Target tree: `features/finance/{api/finance-api.ts(+test), types/finance.types.ts, hooks/use-*.ts, components/*.tsx}`; thin entries at `app/finance/{page,accounts,ledger-accounts,journal-entries,accounting-reports,fiscal-periods,posting-mappings}/page.tsx`.

### References

- Slice templates: `frontend/src/features/admin-settings/` + `features/admin-integrations/` (BUILD-on-`useApiClient` + keys factory), `features/members/` (forms + detail mutations).
- Pages: `frontend/src/app/finance/{page,accounts,ledger-accounts,journal-entries,accounting-reports,fiscal-periods,posting-mappings}/page.tsx`.
- Transport seam: `frontend/src/lib/auth.ts` (`useAuth`/`useApiClient`); shared types `frontend/src/types/finance.ts`; budgets types/consts `frontend/src/lib/api/budgets.ts`; helpers `frontend/src/lib/utils.ts`; `frontend/eslint.config.mjs` (generic `features/**` boundary — no per-feature entry).
- E26-S1; project-context.md A34/A56/A58/A72/A73/A77/A78/A79/A86/A90/A91/A94/A97/A99/A100/A101; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. HARD-ordered after E26-S1; FOUNDATION for S3..S6.
- **A56 findings:** all 7 pages call `useApiClient` directly (BUILD, A94) → net survives with zero transport edits. `lib/api/budgets.ts` is types+consts only (reuse pattern). Heterogeneous guards across the group (canonical dashboard; lean accounts; inline-error fiscal-periods; `null`-while-`!modeChecked` accounting-reports) — preserve each AS-IS. DoubleEntry mode guard on 4 pages (redirect `/finance/settings`). Silent `res.error` swallow on accounts/posting-mappings save+delete; ledger-accounts save checks but delete swallows; journal/fiscal keep-modal-open-on-error — pin/preserve, do not fix. Journal balance gate 0.005 tolerance, min-2-lines. `isActive`-filtered ledger/tax `<select>`s are the A95 surface IF DEC-3=B. `@/types/finance` exists (re-export, A83).

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (7 core ledger/accounting pages → `features/finance/` slice establishing the shared `finance-api.ts`/`finance.types.ts` foundation; BUILD-on-`useApiClient` so the S1 net survives transport-unchanged; preserve heterogeneous guards + DoubleEntry mode guard + journal post/reverse/balance + fiscal 409 branch; manual CRUD forms kept (DEC-3=A recommended)). Status ready-for-dev.
