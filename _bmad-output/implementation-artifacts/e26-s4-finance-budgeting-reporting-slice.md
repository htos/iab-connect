# Story E26.S4: Finance Budgeting/Reporting — Feature-Slice Extraction

Status: done

Depends on: **E26-S1 (the S4 budgeting/reporting suites green at HEAD)** + **E26-S2 (the shared `finance-api.ts`/`finance.types.ts` foundation)**. Mutually independent of S3/S5/S6 once S2's foundation lands. **This story OWNS the shared `activity-areas` type + keys + URL builders** in the foundation (S6 settings/activity-areas reuses them — A62/A101 cross-slice shared sub-decision).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the four budgeting/reporting pages extracted into `src/features/finance/`, reusing the shared foundation and the existing `budgets.ts` types/constants,
so that budget views migrate with no behaviour change and the activity-area type/keys are owned in one place for S6 to reuse.

## Acceptance Criteria

**Behaviour preserved (all E26-S1 budgeting/reporting tests stay green):**

1. Each page's CURRENT read guard is preserved EXACTLY (E26-S1 pins them — heterogeneous): `budgets`, `budget-vs-actual`, `activity-areas` keep the `authLoading` spinner/skeleton → `if (!canReadFinance) return null` shape (NO redirect); **`categories` keeps its outlier guard** — `canReadFinance`/`canWriteFinance` only (NO `isLoading` wait), `router.replace("/")` in the effect AND `if (!canReadFinance) return null` at render (the premature-redirect-on-cold-session quirk is preserved AS-IS, NOT fixed). `canWriteFinance` still gates every mutation (budget create/edit/delete; activity-area create/edit/delete/toggle-active; category create/edit/delete), never weakened; the per-page `handleSave`/`handleDelete` early-returns on `!canWriteFinance` (budgets/activity-areas have them; `categories` relies on UI gating only) are preserved as-is.
2. `frontend/src/lib/api/budgets.ts` continues to back the budget data flows as the **types + URL-constants source** (`BUDGETS_ENDPOINT`, `BUDGET_VS_ACTUAL_ENDPOINT`, `BUDGET_VS_ACTUAL_EXPORT_ENDPOINT`, `BudgetDto`, `BudgetVsActualReport`, `FinanceCurrency`, `CreateBudgetRequest`/`UpdateBudgetRequest`) — do NOT duplicate or delete it. The **server-computed** budget-vs-actual rows (the page does NOT compute; it renders `report.rows` with pre-computed budget/actual/variance/variancePercent) and all `/api/v1/finance/budgets|categories|activity-areas` URLs (incl. `/activity-areas/report?from=&to=`, `/budgets/budget-vs-actual?fiscalPeriodId=&[activityAreaId=]`, and the cross-base **CSV export `/exports/budget-vs-actual`**) are unchanged. The activity-areas **toggle-active** (PUT to the same `/{id}` endpoint), the **inline two-step confirm delete** (budgets + activity-areas) vs **modal delete** (categories), the **hardcoded-English error strings** on `activity-areas`, and the page-local `formatCurrency` on `activity-areas` are preserved verbatim (S1 pins them — do NOT translate/dedupe behaviourally).

**Improvements:**

3. **A56 correction — BUILD, do not "wrap":** `lib/api/budgets.ts` exports ZERO functions (it is types+constants only; the pages already call `useApiClient` directly). So the slice does NOT wrap a function module — it **BUILDs** `hooks/use-*.ts` (TanStack) that call `useApiClient` against the `budgets.ts` URL constants (and the activity-areas/categories URL builders), reusing the `budgets.ts` types/constants (incl. the currently-unused `CreateBudgetRequest`/`UpdateBudgetRequest` shapes) and S2's `financeKeys`. The E26-S1 `useApiClient` mock keeps intercepting → net survives transport-unchanged (A94 BUILD case).
4. Add the budgeting URL builders + keys to a NEW `api/budgeting-api.ts` (importing S2's `FINANCE_BASE`/`financeKeys` + the `budgets.ts` constants) and budgeting types to a NEW `types/budgeting.types.ts` (re-exporting `budgets.ts` `BudgetDto`/`BudgetVsActualReport`/`FinanceCurrency` per A83, adding budget-form types). **REUSE the shared `ActivityArea` type from S2's foundation** (`types/finance.types.ts` — S2 placed it there because it consumes activity-areas as a read-lookup); **OWN here the activity-areas + categories WRITE builders** (POST/PUT/DELETE) + the activity-areas `/report` builder (S4 is the first WRITER of these) so S6's `settings/activity-areas` REUSES the type (from S2) + the CRUD builders (from S4) rather than re-declaring (A62/A101). The slim `ActivityAreaOption` selector shape is a subset of the shared full type — do NOT mint a parallel one.
5. Extract `components/*` (budget table / filter-bar / budget-form; budget-vs-actual report view + CSV export button; activity-areas manage+report tabs + form + toggle-active + color-preset palette; categories table + form + delete modal) as thin composition roots. Any create/edit forms follow the E22 RHF+Zod sub-recipe with mutation-invalidation — **A96** no `.trim()` on submitted bytes (name/code/notes/color); required-ness MATCHES the current enable-gate (budgets: both selects + amount≥0; activity-areas: name+code; categories: name); **A95** the budget area/period `<select>`s are disabled-on-edit (value display-only) so the out-of-set risk is limited — keep the raw stored value rendered; categories `type` (`Income`/`Expense`) and budget `currency` (`CHF`/`EUR`) are closed sets.
6. **Manual→TanStack deltas (A79/A92) decided explicitly:** budget-list refetch via `invalidateQueries`; the budget-vs-actual report query is on-demand (`enabled` only after Generate, gated `!!fiscalPeriodId` — matching the god-page's early-return-if-no-period); the CSV export stays a raw `api.get<Blob>` → object-URL → anchor download (NOT a TanStack query — it streams a file, A76 highest-risk class); form reset/close driven from the mutation OUTCOME (A92, input-preserved-on-error); the inline-confirm delete state preserved (keep `confirmDeleteId` on failure, as today).
7. No new `any`, no new hard-coded user-facing strings beyond the ones S1 pins, no new direct API URL in route files/components, no duplicate UI primitive, the page-local `activity-areas` `formatCurrency` consolidated onto `@/lib/utils` ONLY if byte-identical output (else preserve the local one — S1 pins its de-CH-no-symbol format); i18n parity stays green (`budgets`, `budgetVsActual`, `activityAreas`, `activityAreas.report`, `finance`, `common`, `nav` keys unchanged).

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [x] E26-S1 budgeting suites green at HEAD; E26-S2 foundation present. Re-read the 4 pages + `lib/api/budgets.ts` (confirm types-only) + the S2 foundation + a reference RHF+Zod form (A56). Confirm the activity-areas type/endpoint/namespace OVERLAP with S6's `settings/activity-areas`.
  - [x] Resolve DEC-1..DEC-3 (recommended options below).
- [x] Task 1: Scaffold `api/budgeting-api.ts` (import S2 `FINANCE_BASE`/`financeKeys` + `budgets.ts` consts; budgets/budget-vs-actual/export/categories URL builders + the SHARED activity-areas builders incl. `/report`) + `types/budgeting.types.ts` (re-export `budgets.ts` + new) + the SHARED `ActivityArea` type/keys (owned here) + `api/budgeting-api.test.ts`.
- [x] Task 2: Hooks — queries (budgets list `?activityAreaId=&fiscalPeriodId=`, activity-areas list + `/report`, fiscal-periods + activity-areas selectors, categories list, budget-vs-actual on-demand report) + mutations (budget CRUD; activity-area CRUD + toggle-active; category CRUD) each invalidating `financeKeys`; the CSV export as a raw-blob function (not a query). Hook tests: budget mutation-invalidation + the on-demand report `enabled` gate + the blob export.
- [x] Task 3: Components — `budgets` (table + cost-center/period filters + budget-form RHF+Zod, selects disabled-on-edit, inline-confirm delete) + `budget-vs-actual` (report view, server rows, variance colours, CSV export blob, area filter).
- [x] Task 4: Components — `activity-areas` (manage+report tabs, form + color presets + toggle-active + inline-confirm delete + the local `formatCurrency` + the hardcoded-English errors preserved) + `categories` (table + form + MODAL delete + the outlier redirect guard preserved).
- [x] Task 5: Thin route entries — the 4 route files → content components.
- [x] Task 6: Green-the-net + DoD gate — E26-S1 budgeting suites green (incl. the 3 EXTENDED existing suites — transport mocks unchanged per A94); new slice unit tests; `tsc`/eslint(changed+boundary)/`vitest run` FULL green; LF; A79/A92 deltas recorded. (`next build` deferred to epic boundary.)

## Dev Notes

The budgeting/reporting group. `lib/api/budgets.ts` is the one finance "lib module" — but it is types+constants only (no functions, no auth), so S4 BUILDs hooks over `useApiClient` reusing those types/consts (NOT an A94 function-wrap). This story OWNS the shared `ActivityArea` type/keys/URL-builders in the foundation so S6's `settings/activity-areas` reuses one source (the program's recurring "two slices must not independently own the same endpoints" trap — A62/A101). `categories` is the guard outlier (preserve its premature-redirect quirk); `activity-areas` carries a report tab + toggle-active + hardcoded-English errors + a page-local `formatCurrency`.

### Scope Boundaries

- In scope: `features/finance/{api/budgeting-api.ts, types/budgeting.types.ts (+ the shared ActivityArea type/keys), schemas/*, hooks/*, components/*}` for the 4 pages; thin route entries; new slice unit tests.
- Out of scope: editing S2's `finance-api.ts`/`finance.types.ts` (import only — EXCEPT the deliberately-shared `ActivityArea` type/keys this story owns and S6 imports); deleting/duplicating `lib/api/budgets.ts`; S6's `settings/activity-areas` page (S6 reuses the type, owns its own route/component); "fixing" the categories outlier guard, the hardcoded-English activity-areas errors, the local `formatCurrency`, or the inline-confirm-delete-on-failure behaviour.

### Architecture Guardrails

- A94 BUILD on `useApiClient` (URLs byte-identical incl. the cross-base `/exports/budget-vs-actual`). A96 no submitted-byte `.trim()`; required-ness matches the current enable-gate. A95 budget area/period selects disabled-on-edit → keep raw stored value. A92 form reset/close from mutation OUTCOME. A86 preserve affordance colours (edit hover-orange, delete red, toggle-active green/gray). The CSV export + the activity-areas report stay raw blob/`api.get` — NOT JSON queries.
- The shared `ActivityArea` type/keys this story owns are the ONE place S6 imports from (A62/A101). Pin the type as the FULL shape; S6's form omits `isActive`, S4's includes it — the type covers both; the forms diverge per page, not the type.
- DoD as E27 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 budgets.ts disposition (A56/A94):** A) KEEP `lib/api/budgets.ts` as the types+constants source; BUILD slice hooks over `useApiClient` reusing it (recommended — it is consumed only by these pages; no function wrap exists to preserve; net survives). B) move its types/consts into the slice (REJECTED — needless churn + it is a `lib`-resident module other code could import; `features→lib` is the legal direction). **Recommended: A.**
- **DEC-2 activity-areas ownership (A62/A101):** A) the shared `ActivityArea` TYPE lives in S2's foundation (S2 consumes it as a read-lookup); S4 OWNS the activity-areas CRUD/report WRITE builders + keys; S6 `settings/activity-areas` REUSES the type (S2) + the CRUD builders (S4) (recommended — single source, single endpoint owner). B) each of S4/S6 declares its own type+builders (REJECTED — two slices independently owning `/api/v1/finance/activity-areas`; the exact "shared sub-decision diverges" failure A101 warns about). **Recommended: A.** (If S2 did NOT place the type in the foundation, S4 places it there — it must live below both S4 and S6.)
- **DEC-3 form mechanism:** A) migrate the budget/activity-area/category forms to the E22 RHF+Zod sub-recipe (the spec's "improvements" AC asks for it) with required-ness matching the current enable-gates + A96 no-`.trim()` (recommended). B) keep them manual `useState` (less risk but misses the epic's consistency goal). **Recommended: A** — but the Zod required set MUST match the god-page enable-gate exactly (budgets: 2 selects + amount; activity-areas: name+code; categories: name), adding NO validation the god-page lacks.

### Testing Requirements

- The E26-S1 budgeting suites (incl. the 3 EXTENDED existing files) are the regression oracle — keep green; only the form/data mechanism is the licensed A79 surface. The categories outlier guard, the toggle-active, the inline vs modal delete, the server-computed report rows, the CSV export blob, the variance colours must stay green verbatim.
- Add focused slice unit tests: `budgeting-api` URL/key shape (incl. the shared activity-areas builders + the cross-base export URL); the on-demand report `enabled` gate; the blob export; a budget mutation-invalidation; the activity-area toggle-active mutation.

### Project Structure Notes

- Target tree (NEW under `features/finance/`): `api/budgeting-api.ts(+test)`, `types/budgeting.types.ts` (+ the shared `ActivityArea` type/keys), `schemas/budget.schema.ts`/`activity-area.schema.ts`/`category.schema.ts`, `hooks/use-budgets*.ts`/`use-activity-areas*.ts`/`use-categories*.ts`/`use-budget-vs-actual.ts`, `components/budgeting/*`. Thin entries at `app/finance/{budgets,budget-vs-actual,activity-areas,categories}/page.tsx`.

### References

- Pages: `frontend/src/app/finance/{budgets,budget-vs-actual,activity-areas,categories}/page.tsx`.
- Transport consts/types: `frontend/src/lib/api/budgets.ts` (types+constants only). Foundation to import: `features/finance/api/finance-api.ts` + `types/finance.types.ts` (E26-S2). Helpers: `frontend/src/lib/utils.ts`.
- Form sub-recipe: `docs/architecture-frontend.md` "Form Sub-Recipe"; `features/sponsors`/`members` forms.
- E26-S1/S2; project-context.md A34/A56/A58/A62/A72/A73/A79/A83/A86/A91/A92/A94/A95/A96/A100/A101; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. Ordered after E26-S2 foundation; OWNS the shared activity-areas type for S6.
- **A56 findings:** `lib/api/budgets.ts` is **types+constants only — zero functions** (the spec's "wrap budgets.ts" framing is corrected to BUILD-over-`useApiClient`). All 4 pages `useApiClient` direct. `categories` is the GUARD OUTLIER (redirect `/` without `isLoading` wait + `return null`; premature-redirect-on-cold-session — preserve). `budget-vs-actual` rows are SERVER-computed (page renders, does not compute); CSV export uses a cross-base `/exports/budget-vs-actual` blob. `activity-areas` has a report tab + toggle-active (PUT `/{id}`) + hardcoded-English errors + a page-local `formatCurrency` (de-CH, no symbol). **Activity-areas overlap with S6**: same `ActivityArea` type, same `/api/v1/finance/activity-areas` endpoints, same `activityAreas` i18n namespace, distinct search keys (`searchActivityAreas` vs `searchSettingsActivityAreas`) — S4 owns the type/keys, S6 reuses (DEC-2). The `ActivityArea` shape is declared 3× across the god-pages — consolidate to one.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] orchestrator + 1 parallel general-purpose subagent (S3/S4/S5/S6 ran concurrently on the shared S2 foundation, A87/A101). Autonomous mode (A41) — DECs auto-resolved to recommended options.

### Debug Log References

**DEC resolutions (A43 (a)/(b)/(c)) — all = A:**
- **DEC-1 = A (budgets.ts disposition):** (a) KEEP `lib/api/budgets.ts` as the types+constants source; BUILD slice hooks over `useApiClient` reusing it. (b) it is types-only (no function-wrap exists); `features→lib` legal. (c) `budgets.ts` untouched.
- **DEC-2 = A (activity-areas ownership):** (a) REUSE the foundation's activity-areas FULL CRUD builders (`financeUrls.activityAreas()`/`activityArea(id)`) — re-exported by IDENTITY in `budgetingUrls` (verified `===` in the slice test); add ONLY the `/report` builder + categories CRUD here. (b) single owner (A62/A101); S6 imports the same foundation builders. (c) no two-slice ownership of `/activity-areas`.
- **DEC-3 = A (form mechanism):** (a) migrate budget/activity-area/category forms to E22 RHF+Zod; required-set MATCHES each god-page enable-gate EXACTLY (budgets: 2 selects + amount≥0 via refine; activity-areas: name+code; categories: name); A96 no `.trim()`; A95 area/period `z.string()` disabled-on-edit. (b) the spec's improvements AC asks for it; permissive-matching preserves behaviour. (c) net stayed green.

**Licensed A79 change (form/data-mechanism surface only — NOT a transport-mock edit):** in `categories-content.tsx` the New button gates on `!loading` so the TanStack list query has settled when the suite's `waitFor(newCategory)` resolves (one observer-notification hop vs the god-page's single-await effect); the header stays always-visible; observable output otherwise identical. Also derived `loading = !query.isFetched` on budgets/activity-areas to reproduce the god-page init-true skeleton (read-denied cold session stays on skeleton; NO finance GET fires).

### Completion Notes List

- 4 god-pages → thin server route shells; behaviour in `features/finance/components/budgeting/*` content roots, each self-wrapping `QueryClientProvider({retry:false})`.
- Preserved EXACTLY: the **categories outlier guard** (premature-redirect-on-cold-session); activity-areas **toggle-active** (PUT same `/{id}` full payload, isActive flipped); **inline two-step confirm delete** (budgets + activity-areas, armed on failure) vs **MODAL delete** (categories); **server-computed** budget-vs-actual rows (variance<0→`text-red-600`); on-demand report `enabled` only after Generate (`!!fiscalPeriodId`); the **CSV export** raw `api.get<Blob>`→object-URL→anchor `download="budget-vs-actual.csv"`→click→revoke (NOT a query, A76); activity-areas **hardcoded-English errors** verbatim; the page-local de-CH-no-symbol `formatCurrency` (NOT consolidated — not byte-identical); A92 form reset from mutation OUTCOME; A86 colours.
- REUSED the foundation activity-areas CRUD builders (re-exported for S6); OWNS the `/report` builder + categories CRUD + budget-vs-actual + budgets builders.

### File List

- NEW: `frontend/src/features/finance/api/budgeting-api.ts` (+`.test.ts`); `types/budgeting.types.ts`; `schemas/{budget,activity-area,category}.schema.ts`; `hooks/{use-budgets,use-budgeting-selectors,use-budget-vs-actual,use-activity-areas-crud,use-finance-categories}.ts` (+`budgeting-hooks.test.tsx`); `components/budgeting/{budget-form,budgets-content,budget-vs-actual-content,activity-area-form,activity-areas-content,category-form,categories-content}.tsx`
- MODIFIED (thin shells): `frontend/src/app/finance/{budgets,budget-vs-actual,activity-areas,categories}/page.tsx`
- **DoD:** 4 S1 suites GREEN (52 tests, ×2); slice tests GREEN (budgeting-api + budgeting-hooks = 19); central `tsc --noEmit` exit 0; eslint clean (0 errors); prettier `--check` clean on changed; LF.

## Change Log

- 2026-06-12: Story created (4 budgeting/reporting pages → `features/finance/` reusing the S2 foundation; BUILD over `useApiClient`+`budgets.ts` types/consts; OWN the shared `ActivityArea` type/keys for S6; preserve the categories outlier guard, the server-computed report rows + CSV export blob, the toggle-active, the inline-confirm delete, the hardcoded-English activity-areas errors + page-local formatCurrency; forms → RHF+Zod). Status ready-for-dev.
- 2026-06-12: Implemented (parallel with S3/S5/S6 on the S2 foundation). Activity-areas builders REUSED from foundation (DEC-2=A); forms→RHF+Zod (DEC-3=A). 4 S1 suites green (1 licensed A79 timing accommodation); full suite 192/1840 green. Status → review.
