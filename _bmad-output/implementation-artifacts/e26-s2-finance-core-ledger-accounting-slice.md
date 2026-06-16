# Story E26.S2: Finance Core Ledger/Accounting — Feature-Slice Extraction

Status: done

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

- [x] Task 0: Verify prerequisites + resolve the DECs — A43 (a)/(b)/(c) in Debug Log. E26-S1 S2-group suites green at HEAD; `features/finance/` confirmed absent at start; DEC-1/2/3 = A/A/A.
- [x] Task 1: Scaffolded the shared foundation — `api/finance-api.ts` (`FINANCE_BASE` + `financeKeys` root + `scope` helper + `financeUrls` ledger/accounting builders + the shared activity-areas FULL CRUD / tax-codes GET / categories GET) + `types/finance.types.ts` (re-export `@/types/finance` per A83 + new dashboard/operating-account/profile/Category types) + `api/finance-api.test.ts`.
- [x] Task 2: Hooks — list queries (accounts/ledger-accounts/journal-entries(`?status=`)/fiscal-periods(`?year=`)/posting-mappings/accounting-report/dashboard composite + shared lookups), `retry:false` journal detail/edit-load (A99); mutations each invalidating `financeKeys`. `finance-hooks.test.tsx` covers the no-retry + a mutation-invalidation + the dashboard composite.
- [x] Task 3: Components — read-only — `finance-dashboard-content`, `accounting-reports-content` (3 tabs + date filters + client-side PDF print preserved; Generate-driven, no auto-load).
- [x] Task 4: Components — CRUD — `accounts`, `ledger-accounts`, `posting-mappings`, `journal-entries` content + manual modal forms (DEC-3=A). Post=green/Reverse=red/Delete=red preserved (A86); journal balance gate `<0.005` + min-2-lines preserved; the silent-swallow-vs-modal-open asymmetry reproduced via mutation design.
- [x] Task 5: Components — `fiscal-periods` content (year select, generate/close/lock/reopen/unlock confirm modals, 409 `noProfileError` amber banner + `/finance/settings` link via `FiscalActionError{status}`, 4s auto-dismiss, `isAdmin`-only unlock, inline-error guard no-redirect preserved).
- [x] Task 6: Thin route entries — the 7 route files → server shells. DoubleEntry mode guard preserved as `use-double-entry-guard.ts` imperative effect, redirect `/finance/settings`; list `enabled` gated `modeChecked && canReadFinance` (A97).
- [x] Task 7: Green-the-net + DoD gate — E26-S1 S2-group suites GREEN (67/67) with ZERO transport-mock edits (BUILD-on-`useApiClient` held; no licensed A79 change needed); new slice unit tests; `tsc` exit 0 / eslint(slice+changed incl. generic `features/**` boundary) clean / FULL `vitest run` **183 files / 1755 tests** green, zero regressions; LF (A73); pre-drifted files untouched (A72). `next build` deferred to epic boundary (A58).

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

claude-opus-4-8[1m] orchestrator + 1 focused general-purpose subagent (foundation-critical; orchestrator reviewed the foundation files before fan-out). Autonomous mode (A41/A47) — DECs auto-resolved to recommended options.

### Debug Log References

**DEC resolutions (A41 autonomous; A43 (a)/(b)/(c)):**
- **DEC-1 = A** — (a) one `financeKeys` root + `FINANCE_BASE` in `finance-api.ts`; (b) story-recommended A + A91 parallel-safety (S3..S6 add their own `<sub>-api.ts` importing the root, never editing the foundation) + user autonomous directive; (c) S3..S6 are pure consumers → fan out in ONE parallel phase.
- **DEC-2 = A** — (a) re-export `@/types/finance` via `types/finance.types.ts`; (b) A83 (`features→lib` legal; `@/types/finance` consumed app-wide); (c) `@/types/finance` untouched; slice imports all types from one place.
- **DEC-3 = A** — (a) keep the 4 CRUD modal forms manual `useState` (NOT RHF+Zod); (b) story-recommended A; minimises net-break risk; the form sub-recipe is scoped to S3/S6; (c) the `isActive`-filtered-select A95 concern stays pin-only here; manual-form→RHF migration recorded as residual debt (a later consistency pass may migrate).
- **Foundation-ownership DEC (orchestrator, A101):** (a) the foundation `finance-api.ts` OWNS the activity-areas FULL CRUD + tax-codes/categories GET (not just S2's lookups); (b) makes S4 & S6 (both touch `/activity-areas`) pure consumers → fully parallel-safe (honours the A62/A101 "shared surface lives below both" intent); (c) S4 adds only `/report`; S6 imports activity-areas CRUD as-is.

### Completion Notes List

- **Shared foundation (S3..S6 import, never edit):** `finance-api.ts` exports `FINANCE_BASE`, `financeKeys` (root + `scope(...)` helper + per-resource keys), `financeUrls` (all ledger/accounting builders + activity-areas FULL CRUD `activityAreas()`/`activityArea(id)` + tax-codes/categories GET). `finance.types.ts` re-exports the canonical `@/types/finance` DTOs (A83) + adds dashboard composite / operating-account / `FinanceProfile` (minimal, accountingMode-only, for the mode guard) / `Category` types + the shared `ActivityArea`/`TaxCode` re-exports.
- **BUILD-on-`useApiClient` (A94):** api layer is URL builders + keys only (no fetching); hooks own the `useApiClient` calls. The E26-S1 S2-group suites stayed **67/67 green with ZERO transport-mock edits** (no test file opened). No licensed A79 change needed.
- **Preserved behaviours (S1-pinned):** heterogeneous guards + redirect targets; DoubleEntry mode guard (`use-double-entry-guard.ts` imperative effect, `enabled` gated `modeChecked && canReadFinance` per A97); journal balance gate `<0.005` + min-2-lines; fiscal 409 `noProfileError` via `FiscalActionError{status}` + 4s auto-dismiss + inline-error-no-redirect; `isAdmin`-only fiscal unlock; the **silent `res.error` swallow vs modal-stays-open asymmetry** reproduced via mutation design (swallow pages don't throw + close-modal-in-onSuccess; inspect pages throw + keep-modal-open); post=green/reverse=red/delete=red/fiscal-close=yellow colours (A86). All `/api/v1/finance/*` URLs + i18n keys byte-identical.
- **Each content composition root self-embeds its own `QueryClientProvider`** (`new QueryClient({ defaultOptions:{ queries:{ retry:false } } })`, admin-settings precedent) → the S1 net renders `<Page/>` directly and survives unchanged. Journal detail/edit-load query `retry:false` (A99).
- **DoD:** full `vitest run` **183 files / 1755 tests** green (was 181/1737 → +2 files/+18 tests, the new slice unit tests; zero regressions). `tsc --noEmit` exit 0; eslint(slice+changed, incl. generic `features/**` boundary) clean; prettier `--check` clean on changed files (75 repo-wide pre-drifted files NOT touched — A72/A58); LF (A73). `docs/architecture-frontend.md` updated with the finance one-slice-shared-foundation convention.

### File List

- NEW (20): `frontend/src/features/finance/api/finance-api.ts` (+`.test.ts`), `types/finance.types.ts`, `hooks/{use-finance-dashboard,use-accounts,use-ledger-accounts,use-journal-entries,use-posting-mappings,use-fiscal-periods,use-accounting-reports,use-finance-lookups,use-double-entry-guard}.ts` (+`finance-hooks.test.tsx`), `components/{finance-dashboard-content,accounts-content,ledger-accounts-content,posting-mappings-content,journal-entries-content,accounting-reports-content,fiscal-periods-content}.tsx`
- MODIFIED (8): the 7 `frontend/src/app/finance/{page,accounts,ledger-accounts,journal-entries,accounting-reports,fiscal-periods,posting-mappings}/page.tsx` → thin server shells; `docs/architecture-frontend.md`

## Change Log

- 2026-06-12: Story created (7 core ledger/accounting pages → `features/finance/` slice + shared foundation; manual CRUD forms DEC-3=A). Status ready-for-dev.
- 2026-06-12: Implemented (foundation + 7 pages). BUILD-on-`useApiClient`; S1 net green with zero transport edits; full suite 181/1737 → 183/1755. DECs A/A/A + foundation-ownership DEC. Status → review.
