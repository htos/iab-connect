# Story E6.S3: Add Budget vs Actual Reports

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Kassier (or Admin/Auditor with finance read),
I want a budget-vs-actual (Soll/Ist) report by cost center and fiscal period,
so that I can track project/event financial performance against plan.

> **Built on the resolved epic model (DEC-1).** Cost center = `ActivityArea`; the budget (Soll) comes from the `Budget` entity built in [E6-S1](e6-s1-add-cost-center-and-budget-model.md); the actual (Ist) is summed from finance records' amounts grouped by `ActivityAreaId` within the fiscal period's date range. This is a read-only reporting story — no edits to budgets or assignments.

## Acceptance Criteria

1. **(Report content)** For a chosen fiscal period (and optionally a single cost center), the report shows, per cost center (ActivityArea): the **budget (Soll)**, the **actual (Ist)**, the **variance** (budget − actual), the **variance %**, plus the fiscal period and cost-center identity. Cost centers with a budget but zero actuals (and vice-versa) still appear.
2. **(Authorization)** The report endpoint and page use `RequireFinanceRead` (Admin/Kassier/Auditor), gated by `Module:finance`. _(Vorstand excluded per the epic authz decision — see DEC-3.)_
3. **(Filterable)** The report is filterable by fiscal period (required) and by cost center (optional — all cost centers when unset). Filtering by fiscal **year** (rolling up its periods) is supported if DEC-2 keys budgets by year.
4. **(Export)** The report is exportable via the existing finance export pattern (CSV through the `ExportFileResult` + `Results.File` mechanism), audited as `FinanceExported`.
5. **(UI)** The page reuses the existing finance reporting layout and translations — mirror [accounting-reports/page.tsx](../../frontend/src/app/finance/accounting-reports/page.tsx) (filter bar + generate + export + styled table), uses `formatCurrency` for money, orange-600 actions, next-intl keys, and the standard authenticated layout. Loading / empty / error / permission-denied states are handled.

## Tasks / Subtasks

- [x] **Task 0 — Spike & decisions (AC: 1, 3, 4)**
  - [x] Confirm S1 shipped the `Budget` entity + `IBudgetRepository` + `GetByFiscalPeriodAsync` (project-context A62 — verify the sibling story actually delivered the surface this report consumes; if S1 named it differently, adapt).
  - [x] Resolve DEC-1 (actuals source), DEC-2 (period vs year rollup — must match S1's `Budget` keying), DEC-3 (authz, already resolved), DEC-4 (export format). Record (a)/(b)/(c) Debug Log per A41/A43 if autonomous, else AskUserQuestion.
  - [x] Read [accounting-reports/page.tsx](../../frontend/src/app/finance/accounting-reports/page.tsx) (the layout template) and [Application/Finance/Exports/Queries/ExportJournalQueryHandler](../../backend/src/IabConnect.Application/Finance/Exports/Queries/) (the export template).
- [x] **Task 1 — Application: Soll/Ist read-model query (AC: 1, 3)**
  - [x] Add `backend/src/IabConnect.Application/Finance/Budgets/Queries/GetBudgetVsActualQuery.cs`: `record GetBudgetVsActualQuery(Guid FiscalPeriodId, Guid? ActivityAreaId) : IRequest<BudgetVsActualReportDto>` (add `int? Year` if DEC-2 = year rollup).
  - [x] `BudgetVsActualReportDto` = period identity + `IReadOnlyList<BudgetVsActualRow>`; `BudgetVsActualRow(Guid ActivityAreaId, string ActivityAreaCode, string ActivityAreaName, decimal Budget, decimal Actual, decimal Variance, decimal VariancePercent, string Currency)`.
  - [x] Handler: load the `FiscalPeriod` (for `StartDate`/`EndDate` bounds + name); load `Budget` rows for the period (`IBudgetRepository.GetByFiscalPeriodAsync`); compute **actuals as a server-side SQL `GroupBy` projection** over the chosen actuals source filtered by `ActivityAreaId != null` + `Date` within `[StartDate, EndDate]` (and soft-delete filter applies automatically). **Do not load full entity graphs** (architecture: "use query/read model … avoid loading unnecessary object graphs"). Full-outer-merge budgets and actuals by `ActivityAreaId` so areas with only one side still appear. `VariancePercent` guards divide-by-zero (budget 0 → 0% or null per DEC).
  - [x] No audit needed for the read query itself (reads aren't audited elsewhere); the **export** is audited (Task 3).
- [x] **Task 2 — API: report endpoint (AC: 2, 3)**
  - [x] Add `GET /api/v1/finance/budgets/budget-vs-actual` (query params `fiscalPeriodId`, optional `activityAreaId`/`year`) to `BudgetEndpoints` (from S1) or a `FinanceReportEndpoints` group — `.RequireAuthorization("Module:finance")` + `RequireFinanceRead`, thin `sender.Send(...)`, `WithName/Summary/Description` (REQ-044). Register in [EndpointMapper.cs](../../backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs) if a new group.
- [x] **Task 3 — API/Application: export (AC: 4)**
  - [x] Add `ExportBudgetVsActualQuery : IRequest<ExportFileResult>` + handler building CSV via `StringBuilder` + `EscapeCsv` (header: `CostCenterCode;CostCenterName;FiscalPeriod;Budget;Actual;Variance;VariancePercent;Currency`), `Encoding.UTF8.GetBytes`, return `new ExportFileResult(bytes, "text/csv", "budget-vs-actual_<period>.csv")`. Audit `FinanceExported`. Mirror [ExportJournalQueryHandler](../../backend/src/IabConnect.Application/Finance/Exports/Queries/).
  - [x] Expose `GET /api/v1/finance/exports/budget-vs-actual` in [FinanceExportEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/FinanceExportEndpoints.cs) → `RequireFinanceRead` + `Module:finance`, `Results.File(result.Content, result.ContentType, result.FileName)`.
- [x] **Task 4 — Frontend: report page (AC: 1, 3, 4, 5)**
  - [x] Add `frontend/src/app/finance/budget-vs-actual/page.tsx` (or `/finance/accounting-reports/budget-vs-actual`). **Mirror** [accounting-reports/page.tsx](../../frontend/src/app/finance/accounting-reports/page.tsx): `useAuth().canReadFinance` gate (redirect/return null otherwise); filter bar (fiscal period `<Select>` required + cost center `<Select>` optional); "Generate" + "Export CSV" buttons (orange-600); styled results table (`bg-white rounded-xl shadow-sm` + `min-w-full divide-y divide-gray-200`) with Budget/Actual/Variance/Variance% columns via `formatCurrency`; loading/empty/error states.
  - [x] Variance visual cue (e.g. red text for over-budget / unfavorable variance) using existing color tokens — no new blue.
  - [x] Typed API wrapper in `frontend/src/lib/api/budgets.ts` (extend S1's) for the report + export endpoints.
  - [x] next-intl keys under `finance` (e.g. `finance.budgetVsActual.*`: title, soll, ist, variance, variancePercent, period, costCenter, allCostCenters, exportCsv, noData) in de.json + en.json with parity (A51). Use the German finance terms (Soll/Ist) consistent with the existing `finance.accounting` namespace.
- [x] **Task 5 — Tests (AC: all)**
  - [x] Application/query tests (the load-bearing calculation proof): budget-only area (actual 0, variance = budget, 100% under), actual-only area (budget 0, variance negative, divide-by-zero guarded), both present (variance + % correct), area outside the period excluded, soft-deleted records excluded, records with `ActivityAreaId = null` excluded. Prefer Testcontainers PostgreSQL for the GroupBy-in-SQL behavior; pure unit tests acceptable for the merge/variance math.
  - [x] API authorization test: `RequireFinanceRead` + `Module:finance` on report + export routes; **register new DI services in finance endpoint-metadata harnesses** (A63).
  - [x] Export test: CSV header + a representative row + audit call.
  - [x] Frontend Vitest/Testing Library: permission gate + filter + table render + export trigger. Stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom (A35/A46). Scoped eslint/prettier + full `vitest run` (A58).
- [x] **Task 6 — Quality gates & closing checklist (AC: all)**
  - [x] `dotnet test` from `backend` green; `npm run typecheck` + scoped lint/format + `vitest run` green.
  - [x] AC-Subitem Completion Check (A29) with per-AC evidence in Completion Notes.

## Dev Notes

### Sprint Plan Context

- Epic E6 "Finance Planning" (REQ-044), final story. Depends HARD on S1's `Budget` entity (Soll) and S2's verified `ActivityAreaId` association (Ist). Read-only — no budget/assignment edits here (out of scope per epic).
- Post-MVP comprehensive: build the full report + export + UI vertical slice.

### Soll/Ist computation (load-bearing)

- **Soll (budget)**: `Budget` rows for the period (and cost center). Currency from the budget row (DEC-4 of S1).
- **Ist (actual)**: sum of finance-record amounts grouped by `ActivityAreaId`, filtered to the period's `[StartDate, EndDate]` and the chosen cost center. **Actuals source** is mode-dependent (DEC-1).
- **Merge**: full-outer by `ActivityAreaId` so a cost center appearing in only budgets or only actuals still produces a row (AC-1).
- **Variance** = `Budget − Actual`; **Variance%** = `Budget == 0 ? (Actual == 0 ? 0 : null/∞-guard) : Variance / Budget * 100`. Pick one divide-by-zero convention and test it.
- **Performance**: do the sum with an EF `GroupBy(...).Select(g => new { g.Key, Sum })` that translates to SQL — never `ToList()` then sum in memory (architecture guardrail; contrast the existing in-memory export handlers, which this story deliberately improves on for the aggregate).

### Decision-Needed (resolve at Task 0)

- **DEC-1 — Actuals source.** Options: (a) **`Transaction.Amount`** _(recommended — SimpleCash is the default accounting mode; the journal/VAT exports are Transaction-based; simplest correct v1, no double-count)_; (b) `JournalEntryLine` (correct for DoubleEntry mode but only populated when that mode is active); (c) mode-aware: pick Transaction in SimpleCash, JournalEntryLine in DoubleEntry (most complete, more code). **Recommended: (a) for v1, with a documented note that DoubleEntry installations would use (b)/(c).** Per project-context A68, the QGT row must state the **concrete v1 behavior** ("actuals = Transactions tagged with the cost center in the period"), not the aspirational "all finance records". Do **not** also sum `InvoiceItem` on top of `Transaction` — that double-counts if invoices are also booked as transactions; pick one source.
- **DEC-2 — Period vs year rollup.** Must match S1's `Budget` keying (S1-DEC-3). If budgets key by `FiscalPeriodId` → filter by period (recommended, matches AC-1 "fiscal period"); if by `Year` → roll up the year's periods. Keep consistent across S1 and S3.
- **DEC-3 — Authorization.** **RESOLVED 2026-06-07: `RequireFinanceRead` (Admin/Kassier/Auditor) + `Module:finance`.** Vorstand excluded (epic-wide decision; Vorstand has no finance access today).
- **DEC-4 — Export format.** Options: (a) **CSV** via the existing `ExportFileResult` pattern _(recommended — matches all current finance exports; lowest risk)_; (b) PDF via QuestPDF (heavier; the accounting-reports page offers PDF, but the finance **exports** are CSV). Recommend (a); PDF is a future enhancement.

### Architecture Guardrails

- Read-model query, server-side aggregation, no full-graph loading. Respect `Module:finance` + finance read authz. Reuse `ExportFileResult` + `EscapeCsv` for export; audit `FinanceExported`.
- Frontend: reuse the accounting-reports layout + table standard ([docs/13_frontend_design_standards.md](../../docs/13_frontend_design_standards.md):138-142), `formatCurrency`, orange-600, next-intl, standard page wrapper. de+en only.
- No mutation of finance state (report is read-only); no weakening of finance compliance.

### Existing Code To Inspect Before Editing

- [e6-s1-add-cost-center-and-budget-model.md](e6-s1-add-cost-center-and-budget-model.md) + the shipped `Budget` entity/repo/`GetByFiscalPeriodAsync`
- [Domain/Finance/FiscalPeriod.cs](../../backend/src/IabConnect.Domain/Finance/FiscalPeriod.cs) (`StartDate`/`EndDate`/`Name`)
- [Application/Finance/Exports/Queries/](../../backend/src/IabConnect.Application/Finance/Exports/Queries/) (`ExportFileResult`, `EscapeCsv`, audit-on-export)
- [Api/Endpoints/FinanceExportEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/FinanceExportEndpoints.cs)
- Frontend layout template: [frontend/src/app/finance/accounting-reports/page.tsx](../../frontend/src/app/finance/accounting-reports/page.tsx); money: [frontend/src/lib/utils.ts](../../frontend/src/lib/utils.ts):42-56; i18n: `frontend/messages/{de,en}.json` (`finance.accounting` namespace as the style reference)

### Testing Requirements

- Backend: query/calculation tests are the priority (variance math + outer-merge + period bounds + null/soft-delete exclusion). Testcontainers PostgreSQL for the SQL GroupBy; FluentAssertions. API auth tests + export test. Register new DI services in harnesses (A63).
- Frontend: Vitest/Testing Library; stable `useTranslations` (A64); `afterEach(cleanup)` + jsdom (A35/A46); scoped eslint/prettier (A58).

### Previous Story Intelligence

- Consumes S1 (`Budget`) and S2 (`ActivityAreaId` actuals). A62: verify S1/S2 actually shipped the consumed surfaces at Task 0 — don't assume from the DEC. A68: state the concrete v1 actuals behavior in the QGT, not the aspirational wording. The existing export handlers load-then-project in memory; this story deliberately uses server-side aggregation for the actuals sum (a small, justified divergence — note it).

### Latest Technical Context

- EF Core 10 LINQ `GroupBy` server-side translation (Npgsql) for the actuals sum. No schema change expected (consumes S1's table + existing `ActivityAreaId` columns) → likely **no new migration**.
- Next.js 16 App Router / React 19 / next-intl; de+en only. `Intl.NumberFormat("de-CH", ...)` via `formatCurrency`.

### Project Structure Notes

- Backend: `Application/Finance/Budgets/Queries/GetBudgetVsActualQuery(+Handler+Dto).cs`, export query+handler, endpoint additions.
- Frontend: `app/finance/budget-vs-actual/page.tsx`, `lib/api/budgets.ts` (extend), `messages/{de,en}.json`.
- Tests across Application/Infrastructure/Api + a frontend page test.

### References

- [epics-and-stories.md](../planning-artifacts/epics-and-stories.md#L727-L742) (E6-S3)
- [prd.md](../planning-artifacts/prd.md) REQ-044 (Soll/Ist visible per cost center and period; respects finance authz + export rules)
- [architecture.md](../planning-artifacts/architecture.md) (read-model/no-graph guidance; export/authz)
- [project-context.md](../project-context.md) (A56, A58, A62, A63, A64, A68)
- [docs/13_frontend_design_standards.md](../../docs/13_frontend_design_standards.md)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — autonomous dev-story run (Epic-6 bulk).

### Debug Log References

**Task 0 — sibling-surface verification (A62):** S1 shipped `Budget` + `IBudgetRepository.GetByFiscalPeriodAsync` (confirmed by reading the S1 files). S2 verified the `ActivityAreaId` actuals association. Both consumed surfaces exist — no adaptation needed.

**A41/A43 autonomous-mode Decision resolutions** (user pre-declared autonomous mode — verbatim: _"alle stories von epic 6 umsetzen. nicht stoppen bis alle stories umgesetzt sind. danach review und retro durchführen. beachte es ist kein mvp mehr"_):
- **DEC-1 (actuals source).** (a) Option **(a) `Transaction`** chosen. (b) Rationale: story recommendation (a); user autonomous quote; SimpleCash is the default accounting mode and the existing journal/VAT CSV exports are Transaction-based — simplest correct v1, no double-count. (c) Consequence: **concrete v1 behavior (A68): Ist = net cost = Σ(Expense amounts) − Σ(Income amounts) of Transactions tagged to the cost center within the period.** `InvoiceItem` is NOT also summed (would double-count if invoices are booked as transactions). DoubleEntry installations would use `JournalEntryLine` (documented future enhancement).
- **DEC-2 (period vs year).** (a) Option **(a) key by `FiscalPeriodId`** chosen. (b) Rationale: matches S1's `Budget` keying (S1-DEC-3) + AC-1 "fiscal period"; user autonomous quote. (c) Consequence: report filters by `fiscalPeriodId` (required) + optional `activityAreaId`; no year rollup (S1 doesn't key by year, so AC-3's conditional year filter is out of scope).
- **DEC-3 (authz).** RESOLVED in spec: `RequireFinanceRead` + `Module:finance`; Vorstand excluded.
- **DEC-4 (export).** (a) Option **(a) CSV** via `ExportFileResult` + `Results.File`, audited `FinanceExported`. PDF deferred.

**Variance convention:** `Variance = Budget − Actual` (positive = under budget/favorable; the frontend shows negative variance in red). `VariancePercent = Budget == 0 ? 0 : round(Variance/Budget*100, 2)` — divide-by-zero guard returns 0% (an actual-only cost center with no plan has no meaningful %).

**Architecture compliance:** actuals summed via a **server-side `GroupBy` → SQL `SUM(CASE WHEN type='Expense' THEN amount ELSE -amount END)`** in `TransactionRepository.GetActualsByActivityAreaAsync` (NOT load-then-sum-in-memory — the story's deliberate improvement over the existing in-memory export handlers). The read query is not audited; only the export is (`FinanceExported`).

### Completion Notes List

**AC-Subitem Completion Check (A29):**
- **AC-1 (report content):** ✅ covered. Per cost center: Budget/Actual/Variance/Variance%/currency + period & cost-center identity. **Full-outer merge** (budget-only AND actual-only areas both appear) — proven by the Testcontainers test (EVT both, MBR budget-only, ADM actual-only → 3 rows).
- **AC-2 (authorization):** ✅ covered. Report route + export route both `RequireFinanceRead` + `Module:finance` (6 endpoint-metadata assertions across BudgetEndpointTests + FinanceExportEndpointTests). Vorstand excluded.
- **AC-3 (filterable):** ✅ covered. Required `fiscalPeriodId` + optional `activityAreaId` (scoped-to-one-area path tested). Year rollup N/A (DEC-2 = period keying).
- **AC-4 (export):** ✅ covered. `ExportBudgetVsActualQuery` → CSV via `ExportFileResult`/`Results.File`, header `CostCenterCode;CostCenterName;FiscalPeriod;Budget;Actual;Variance;VariancePercent;Currency`, audited `FinanceExported` (entityType "Budget"). Unknown period → null → 404 (tested).
- **AC-5 (UI):** ✅ covered. `/finance/budget-vs-actual` page mirrors the accounting-reports layout: filter bar (period required + cost-center optional) + Generate + Export CSV (orange-600), styled results table via `formatCurrency`, negative-variance red cue (no new blue), loading/empty/error/permission states; next-intl `budgetVsActual.*` de/en parity.

**Concrete v1 behavior statement (A68):** the QGT marks AC-1 ✅ on the basis that **Ist = net cost of Transactions tagged to the cost center within the period** (Expense positive, Income negative). This is the actual shipped behavior, NOT the aspirational "all finance records" — DoubleEntry `JournalEntryLine` actuals are a documented future enhancement.

**New tests:** `BudgetVsActualReportTests` (3 Testcontainers — the load-bearing calc proof: outer-merge + variance math + period/soft-delete/null-area exclusions + scoped-to-one-area + unknown-period-null), `ExportBudgetVsActualTests` (2 — CSV header+row+audit, null-period no-audit), `BudgetEndpointTests` (+report route to read+module theories), `FinanceExportEndpointTests` (2 — export route policies), `budget-vs-actual/page.test.tsx` (2 — permission gate + generate/render/export). **Quality gates:** backend full suite **2254 green** (App 1536 / Api 249 / Infra 469); `dotnet build` 0/0; frontend full Vitest **207 green**; `tsc --noEmit` clean; scoped eslint + prettier clean on all changed files (A58). **A63:** report/export endpoint handlers inject only `ISender` — metadata harnesses needed no extra registration. No new migration (consumes S1 table + existing `ActivityAreaId` columns).

### File List

**Backend — new:**
- `backend/src/IabConnect.Application/Finance/Budgets/Queries/GetBudgetVsActualQuery.cs`
- `backend/src/IabConnect.Application/Finance/Budgets/Queries/GetBudgetVsActualQueryHandler.cs`
- `backend/src/IabConnect.Application/Finance/Budgets/Queries/ExportBudgetVsActualQuery.cs` (+ handler in same file)
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/BudgetVsActualReportTests.cs`
- `backend/tests/IabConnect.Application.Tests/Finance/Budgets/ExportBudgetVsActualTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/FinanceExportEndpointTests.cs`

**Backend — modified:**
- `backend/src/IabConnect.Application/Finance/IFinanceRepositories.cs` (added `ActivityAreaActual` record + `ITransactionRepository.GetActualsByActivityAreaAsync`)
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs` (implemented `GetActualsByActivityAreaAsync` — server-side GroupBy)
- `backend/src/IabConnect.Api/Endpoints/BudgetEndpoints.cs` (added `GET /budget-vs-actual` report route + handler)
- `backend/src/IabConnect.Api/Endpoints/FinanceExportEndpoints.cs` (added `GET /exports/budget-vs-actual` + handler)
- `backend/tests/IabConnect.Api.Tests/Endpoints/BudgetEndpointTests.cs` (report route added to read + module-gate theories)

**Frontend — new:**
- `frontend/src/app/finance/budget-vs-actual/page.tsx`
- `frontend/src/app/finance/budget-vs-actual/page.test.tsx`

**Frontend — modified:**
- `frontend/src/lib/api/budgets.ts` (added `BudgetVsActualReport`/`Row` types + report/export endpoint constants)
- `frontend/messages/de.json` + `frontend/messages/en.json` (added `budgetVsActual.*` namespace, de/en parity)

## Change Log

- 2026-06-07: Story refreshed from the 2026-05-12 pre-pivot stub to a comprehensive dev-ready spec. Reframed on the resolved epic model (cost center = ActivityArea; Soll from S1 `Budget`, Ist summed by `ActivityAreaId`); read-only report + CSV export + reporting UI. Marked ready-for-dev.
- 2026-06-07: Implemented (autonomous dev-story). Read-model Soll/Ist query (server-side SQL `GroupBy` net-cost actuals + full-outer merge + variance math), CSV export (audited `FinanceExported`), report + export endpoints (RequireFinanceRead + Module:finance), and the `/finance/budget-vs-actual` reporting UI (period+cost-center filters, Generate/Export CSV, red negative-variance cue, de/en). DEC-1/2/4 auto-resolved (a)/(a)/(a) per A41/A43; concrete v1 actuals behavior stated per A68. Backend 2254 tests green; frontend 207 Vitest green. Status → review.
