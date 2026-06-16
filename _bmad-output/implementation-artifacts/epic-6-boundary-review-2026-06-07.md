# Epic-6 Boundary Code Review — Finance Planning (REQ-044)

**Date:** 2026-06-07
**Scope:** Full Epic-6 diff (e6-s1..s3), uncommitted working tree on branch `beta`.
**Method:** 3-layer adversarial (Blind Hunter — diff only · Edge Case Hunter — diff + repo read · Acceptance Auditor — diff + specs), per the hybrid CR+ER policy (`feedback_bmad_workflow`).
**Pre-review state:** all 3 stories in `review`; backend 2254 (App 1536 / Api 249 / Infra 469) + frontend 207 tests green.

## Outcome

**Approved — 0 patches applied.** Epic-6 is a low-risk feature epic: one net-new aggregate (`Budget`) built on the canonical single-aggregate CRUD template, a read-model report with server-side aggregation, and one frontend selector gap-fill. The implementation follows every established finance convention (audit, soft-delete, locked-period guard, `Module:finance` + finance-read/write authz, `ExportFileResult`/`EscapeCsv` export, EF migration discipline) and is covered by 41 new tests including Testcontainers proofs of the unique index, the soft-delete re-insert, the actuals SQL `GroupBy`, and the full-outer merge + variance math. No correctness defect rose to patch level. Three deferred follow-ups (E6-FT-1..3) and the dismissed findings are recorded below.

## Layer findings

### Blind Hunter (diff only)
- No incorrect logic surfaced. Variance (`Budget − Actual`), net-cost actuals (`Σ Expense − Σ Income`), the divide-by-zero guard (budget 0 → 0%), and the full-outer merge are each directly asserted by `BudgetVsActualReportTests`. The `Type == Expense ? Amount : -Amount` conditional sum **translates to SQL** (the Testcontainers test computes EVT = 600 − 100 = 500 against real PostgreSQL, proving the CASE translation).

### Edge Case Hunter (diff + repo)
- **Concurrent duplicate budget → 500 not 409** (Med → **deferred E6-FT-2**). `CreateBudgetCommandHandler` does an uniqueness pre-check (`GetByActivityAreaAndPeriodAsync`) then `AddAsync`; two concurrent creates for the same `(area, period)` both pass the pre-check, and the second trips the DB filtered-unique-index → `DbUpdateException` → mapped to **500**, not the clean **409** the pre-check returns. The pre-check covers the normal (sequential) path; the index is the integrity backstop. Not patched in-handler because catching `DbUpdateException` there would pull an EF-Core dependency into the Application layer (architecture boundary). Low-concurrency finance-settings surface → deferred.
- **Budget-currency vs profile-currency mismatch in the report** (Low → **deferred E6-FT-3**). The report labels each row with the *budget's* stored currency, while actuals (from `Transaction`) are implicitly in the active `FinanceProfile` currency. The finance module is effectively single-currency (budgets default to the profile currency), so this is latent; a budget explicitly created in a non-profile currency could mislabel its actual. Deferred.
- Period bounds, soft-delete exclusion, and `ActivityAreaId = null` exclusion are all asserted (the report test seeds a Feb transaction, a soft-deleted transaction, and a null-area transaction — all correctly excluded).

### Acceptance Auditor (diff + specs)
- **DoubleEntry actuals not summed** (the disclosed DEC-1 v1 boundary → **deferred E6-FT-1**). S3-DEC-1 chose `Transaction` as the actuals source; in DoubleEntry mode (where spend is booked via `JournalEntryLine`, not `Transaction`) the report would show actuals = 0. **For the Beta this is correct**: the default + Beta accounting mode is `SimpleCash` (`FinanceProfile.AccountingMode` default), where `Transaction` is the actuals source. The S3 QGT states the concrete v1 behavior per A68 ("Ist = Transactions tagged with the cost center in the period"), so it degrades to *covering-less* (SimpleCash only), not *doing-wrong*, for the shipped configuration. Mode-aware actuals (DEC-1 option c) are the deferred enhancement.
- AC-1..AC-5 across all three stories are covered with per-AC evidence (see each story's Completion Notes). S2's honesty discipline (A56/A65) is upheld — it correctly shipped only the one genuine gap (journal-line selector) and verified the rest.
- **Edit round-trip verified:** `JournalEntryLineDto` exposes `ActivityAreaId` (AccountingDtos.cs:52 + `MapToDto`:120), so the new journal-line selector preserves an existing line's cost center on edit (no A62-style silent data loss).

## Dismissed (with evidence)
- **Budget double-save** (`BudgetRepository.AddAsync` saves internally + handler `IUnitOfWork.SaveChangesAsync`) — mirrors the canonical `AccountRepository` pattern exactly; the second save is a no-op. Non-issue (consistency with shipped finance repos).
- **Budget FK `OnDelete.Restrict` could block area/period deletion** — `ActivityArea` soft-deletes (never hard-deletes) and `FiscalPeriod` is not hard-deleted, so the Restrict FK is never violated in practice. Correct choice (prevents orphaning a budget).
- **N+1 area lookup in the report handler** (`GetByIdAsync` per area) — bounded by the number of cost centers in one period (single digits for a Verein); acceptable, not worth a join.
- **Locked vs Closed period** — the budget guard uses `FiscalPeriod.IsMutationAllowed` (`Status != Locked`), identical to the Transaction/Invoice precedent; `Closed` periods remain mutable by design. Consistent.
- **Route ordering `/budget-vs-actual` before `/{id:guid}`** — explicit ordering is belt-and-suspenders; the `:guid` constraint would reject the literal anyway. Correct.

## Quality gates (post-review, unchanged — no patches)
- Backend: `dotnet build` 0 warnings / 0 errors; full suite **2254 green**.
- Frontend: `tsc --noEmit` clean; full Vitest **207 green**; scoped eslint + prettier clean on all changed files (A58 — `journal-entries/page.tsx` pre-existing prettier drift confirmed via `git stash`, not introduced).
- EF migration `AddBudgetModel` applies clean; only adds the `budgets` table + indexes; snapshot regenerated.
