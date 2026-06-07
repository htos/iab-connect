# Story E6.S2: Associate Finance Records with Cost Centers

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Kassier,
I want finance records to carry a cost-center reference,
so that actual spend can be compared to budget per cost center (Soll/Ist).

> **Scope reality (from the E6 spike + DEC-1 resolved 2026-06-07).** Because the epic reuses the existing `ActivityArea` entity as the cost center, the cost-center reference on finance records **already largely exists**: `Transaction`, `InvoiceItem`, and `JournalEntryLine` already carry a nullable `ActivityAreaId`, and the Transaction entry form already exposes an ActivityArea selector. This story is therefore primarily **verification + targeted gap-fill**, not a new FK rollout. Be honest in the QGT about what already shipped vs. what this story adds (project-context A56, A65).

## Acceptance Criteria

1. **(Association exists on actuals-bearing records)** The finance records that contribute to actuals — `Transaction` (SimpleCash), `JournalEntryLine` (DoubleEntry), and `InvoiceItem` (invoice-based) — can each reference a cost center (ActivityArea) via nullable `ActivityAreaId`. Where the backend FK exists but the **frontend entry surface lacks a selector**, this story adds it. _(Invoice header and Payment intentionally do **not** get an ActivityAreaId — see DEC-1.)_
2. **(Backward compatible)** Existing finance records continue to work with `ActivityAreaId = null`; nothing is forced to have a cost center. No data migration backfills cost centers.
3. **(Locked-period & posted-entry rules respected)** Setting or changing a record's cost center on a record whose fiscal period is **Locked** is rejected via the existing `IFiscalPeriodService.EnsurePeriodNotLockedAsync` guard. Posted/sent/reversed records follow their existing mutation rules (no new edit path that bypasses them).
4. **(Auditable)** Where a finance write already audits (create/update of Transaction, JournalEntry, Invoice), the cost-center value is part of that audited change. No silent cost-center mutation path is introduced.
5. **(Import/export coverage)** CSV import/export that handles these records includes the cost-center (ActivityArea) field. The journal export already emits `ActivityAreaId`/`ActivityAreaCode`; verify and extend the other relevant exports/imports where applicable.

## Tasks / Subtasks

- [ ] **Task 0 — Coverage spike (AC: 1, 3, 5) — do this first; it sizes the whole story**
  - [ ] Backend FK audit: confirm `ActivityAreaId` present on `Transaction`, `InvoiceItem`, `JournalEntryLine` (verified during create-story); confirm it is **absent** on `Invoice` header and `Payment` (verified — keep absent per DEC-1). Record findings in Debug Log.
  - [ ] Frontend selector audit: for each actuals-bearing entry surface, confirm whether the form exposes an ActivityArea selector. **Known state:** [transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx):983-988 already has one. Check [invoices/new/page.tsx](../../frontend/src/app/finance/invoices/new/page.tsx) (per-item rows) and [journal-entries/page.tsx](../../frontend/src/app/finance/journal-entries/page.tsx) (per-line). Each missing selector = a gap-fill subtask below.
  - [ ] Locked-period audit: confirm `EnsurePeriodNotLockedAsync` is called in the create/update handlers for Transaction / JournalEntry / Invoice. Where a cost-center change can occur on an existing record without hitting that guard, that is the AC-3 gap to close.
  - [ ] Export/import audit: enumerate finance CSV exports/imports ([Application/Finance/Exports/Queries/](../../backend/src/IabConnect.Application/Finance/Exports/Queries/), bank-import) and note which emit/accept the ActivityArea field. Journal export already does ([ExportJournalQueryHandler](../../backend/src/IabConnect.Application/Finance/Exports/Queries/)).
  - [ ] Produce a one-screen **coverage matrix** (entity × backend-FK × frontend-selector × locked-period-guard × export) in the Debug Log. This matrix IS the scope. If a cell is already green, the corresponding AC sub-item is **verify-only**.
- [ ] **Task 1 — Frontend gap-fill: cost-center selector where missing (AC: 1)**
  - [ ] For each entry surface missing a selector (from Task 0), add an ActivityArea `<Select>` (active areas only, with a "no cost center" empty option) mirroring [transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx):981-989 (fetch via `/api/v1/finance/activity-areas`, store `activityAreaId` in the form, send `activityAreaId || null`).
  - [ ] Ensure the command/DTO for that surface already carries `ActivityAreaId` end-to-end; if the create/update command omits it (backend has the column but the command doesn't map it), add the mapping. Keep it nullable/optional.
  - [ ] Add next-intl keys (reuse existing `finance.noActivityArea` / activity-area labels where present) in de.json + en.json with parity (A51).
- [ ] **Task 2 — Locked-period & posted-entry integrity (AC: 3, 4)**
  - [ ] Verify (and add a test asserting) that changing `ActivityAreaId` on a record whose period is Locked is rejected. If a handler path allows it, route it through `EnsurePeriodNotLockedAsync` (mirror [CreateInvoiceCommandHandler](../../backend/src/IabConnect.Application/Finance/Invoices/Commands/CreateInvoiceCommandHandler.cs) which calls it before mutation).
  - [ ] Confirm no new cost-center edit endpoint bypasses existing posted/sent/reversed mutation rules. Do **not** add a standalone "reassign cost center on a posted record" path.
- [ ] **Task 3 — Import/export coverage (AC: 5)**
  - [ ] Confirm journal export emits ActivityArea (it does). For any other export/import that lists these records and omits the cost center, add the column/field consistently (CSV escaping via the existing `EscapeCsv` helper). Audit the export action as today.
- [ ] **Task 4 — Tests (AC: all)**
  - [ ] Infrastructure integration test (Testcontainers): a Transaction (and JournalEntryLine) persists + reads back its `ActivityAreaId`; a record with `ActivityAreaId = null` round-trips fine (backward-compat).
  - [ ] Locked-period regression test: assigning/changing a cost center within a Locked period throws (the load-bearing AC-3 proof).
  - [ ] Regression: existing finance flow tests still green (no behavior change for records without a cost center).
  - [ ] Frontend test(s) for any added selector (permission + renders + sends `activityAreaId`). Stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom for render tests (A35/A46). Scoped eslint/prettier (A58).
- [ ] **Task 5 — Quality gates & closing checklist (AC: all)**
  - [ ] `dotnet test` from `backend` green; `npm run typecheck` + scoped lint/format + `vitest run` green.
  - [ ] AC-Subitem Completion Check (A29): per AC, mark covered / verify-only / N/A with evidence. For any AC fully satisfied by already-shipped code, state that plainly (do not over-claim new work).

## Dev Notes

### Sprint Plan Context

- Epic E6 "Finance Planning" (REQ-044). Story order **S1 → S2 → S3** (HARD): S2 sits between the `Budget` model (S1) and the Soll/Ist report (S3). S3's "actuals" come from the `ActivityAreaId` association this story verifies/completes.
- Post-MVP comprehensive epic. The smaller-than-expected scope here is **by design** (the association mostly pre-exists), not a corner cut — document it honestly.

### Why this story is mostly verification (load-bearing)

Per the resolved epic decision (DEC-1), the cost center **is** `ActivityArea`. The actuals dimension was already built for REQ-068 tax/reporting:
- `Transaction.ActivityAreaId`, `InvoiceItem.ActivityAreaId`, `JournalEntryLine.ActivityAreaId` all exist (nullable).
- The transactions entry form already has the selector ([transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx):983-988).
- The journal export already emits the ActivityArea columns.

So the genuine work is: (1) fill any **frontend selector gaps** on the invoice-item / journal-line entry surfaces, (2) **prove** locked-period + backward-compat invariants hold for the cost-center field, (3) ensure **export/import** parity. Resist the urge to invent new association machinery (project-context A56 — do not rewrite shipped behavior to match an AC literal).

### Decision-Needed (resolve at Task 0)

- **DEC-1 — Which records get a cost center?** **RESOLVED 2026-06-07: actuals-bearing line/transaction records only** (`Transaction`, `InvoiceItem`, `JournalEntryLine` — all already have `ActivityAreaId`). **Do NOT add `ActivityAreaId` to `Invoice` header or `Payment`.** Rationale: actuals for Soll/Ist are summed from line/transaction level; a `Payment` settles an `Invoice` whose items already carry the cost center, so adding a header/payment FK would risk **double-counting** in S3. If a future need arises for invoice-header-level allocation, that is a separate story. _(This bounds AC-1 explicitly — project-context A65: don't let a multi-surface AC over-claim.)_
- **DEC-2 — Actuals source of truth for the report.** Recorded here for S3 continuity (decided in S3-DEC-1): the Soll/Ist report sums actuals by `ActivityAreaId`. The canonical source depends on accounting mode (SimpleCash → `Transaction`; DoubleEntry → `JournalEntryLine`). This story must ensure whichever source S3 uses is fully cost-center-tagged at the entry surface.

### Architecture Guardrails

- No new FK on Invoice/Payment (DEC-1). Keep changes additive and nullable; **no backfill** of historical records (AC-2).
- Locked-period guard is the existing `IFiscalPeriodService.EnsurePeriodNotLockedAsync` — reuse it; do not reimplement period logic. `FiscalPeriod.IsMutationAllowed` = `Status != Locked` ([FiscalPeriod.cs](../../backend/src/IabConnect.Domain/Finance/FiscalPeriod.cs):141).
- Preserve cancellation/reversal/soft-delete behavior on the touched entities. Frontend: orange-600, shared `<Select>`, next-intl keys, standard layout.
- Aggregate child-persistence rule ([docs/07_dos_donts.md](../../docs/07_dos_donts.md):114-116) applies if you touch InvoiceItem/JournalEntryLine persistence: add children via `dbContext.Set<Child>().Add()`.

### Existing Code To Inspect Before Editing

- [Domain/Finance/Transaction.cs](../../backend/src/IabConnect.Domain/Finance/Transaction.cs), [InvoiceItem.cs](../../backend/src/IabConnect.Domain/Finance/InvoiceItem.cs), [JournalEntryLine.cs](../../backend/src/IabConnect.Domain/Finance/JournalEntryLine.cs) (the `ActivityAreaId` carriers)
- [Domain/Finance/ActivityArea.cs](../../backend/src/IabConnect.Domain/Finance/ActivityArea.cs)
- [Application/Finance/FiscalPeriods/FiscalPeriodService.cs](../../backend/src/IabConnect.Application/Finance/FiscalPeriods/FiscalPeriodService.cs) (`EnsurePeriodNotLockedAsync`)
- [Application/Finance/Invoices/Commands/CreateInvoiceCommandHandler.cs](../../backend/src/IabConnect.Application/Finance/Invoices/Commands/CreateInvoiceCommandHandler.cs) (locked-period guard precedent)
- [Application/Finance/Exports/Queries/](../../backend/src/IabConnect.Application/Finance/Exports/Queries/) (journal/VAT/open-items export pattern + `EscapeCsv`)
- Frontend: [transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx), [invoices/new/page.tsx](../../frontend/src/app/finance/invoices/new/page.tsx), [journal-entries/page.tsx](../../frontend/src/app/finance/journal-entries/page.tsx)

### Testing Requirements

- Backend: Testcontainers PostgreSQL for FK round-trip + null backward-compat + locked-period rejection (the AC-3 proof — not EF InMemory). xUnit v3 + FluentAssertions.
- Frontend: Vitest/Testing Library for any added selector; stable `useTranslations` (A64); `afterEach(cleanup)` + jsdom (A35/A46); scoped eslint/prettier (A58).
- Run focused tests for changed handlers/forms, then `dotnet test` + frontend gates before `review`.

### Previous Story Intelligence

- Builds on [e6-s1-add-cost-center-and-budget-model.md](e6-s1-add-cost-center-and-budget-model.md): reuses the same `ActivityArea`-as-cost-center model and finance authz/audit conventions. A62 reminder: do not assume S1 delivered anything S3 needs unless verified — but S2 itself depends on already-shipped REQ-068 surfaces, which the Task 0 coverage matrix verifies directly.

### Latest Technical Context

- EF Core 10 nullable FK + partial behavior; no migration expected unless a command mapping requires a column that isn't there (none expected — columns exist).
- Next.js 16 App Router / next-intl; de+en only.

### Project Structure Notes

- Likely **no new migration** (columns already exist). If Task 0 finds a missing column on a record that genuinely needs one, generate a migration via the standard `dotnet ef migrations add ... --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api` and document why.
- Touch points are mostly frontend forms + Application command mappings + tests.

### References

- [epics-and-stories.md](../planning-artifacts/epics-and-stories.md#L703-L726) (E6-S2)
- [prd.md](../planning-artifacts/prd.md) REQ-044
- [architecture.md](../planning-artifacts/architecture.md) (finance compliance ~970; module enforcement ~186-238)
- [project-context.md](../project-context.md) (A56, A58, A62, A65)
- [docs/07_dos_donts.md](../../docs/07_dos_donts.md)

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent._

### Debug Log References

_To be filled during implementation._

### Completion Notes List

_To be filled during implementation._

### File List

_To be filled during implementation._

## Change Log

- 2026-06-07: Story refreshed from the 2026-05-12 pre-pivot stub. Reframed as verification + targeted gap-fill per resolved DEC-1 (ActivityArea is the cost center; association already largely ships via `ActivityAreaId`; Invoice/Payment headers intentionally excluded). Marked ready-for-dev.
