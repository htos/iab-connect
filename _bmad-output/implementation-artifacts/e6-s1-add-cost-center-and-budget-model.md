# Story E6.S1: Add Cost Center and Budget Model

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Kassier,
I want to assign budget values to cost centers per fiscal period,
so that event/project costs can be planned and later compared against actuals.

> **Epic-shaping decision (resolved 2026-06-07, see DEC-1).** This epic does **not** introduce a new `CostCenter` entity. The existing `ActivityArea` entity (REQ-068 — admin-managed activity/project/division tag with `Code`, `Name`, `Color`, `IsActive`) **is** the cost center. Cost-center CRUD (create/edit/deactivate) therefore **already ships** via `ActivityArea` and its `/finance/settings/activity-areas` UI. The genuinely net-new deliverable in this story is the **`Budget`** entity (budget amount per ActivityArea per FiscalPeriod) plus its CRUD slice. Do **not** build a parallel `CostCenter` entity — that was explicitly rejected to avoid two overlapping allocation dimensions on the same finance records.

## Acceptance Criteria

1. **(Cost-center CRUD — verify, do not rebuild)** Kassier (and Admin) can create, edit, and deactivate cost centers. This is satisfied by the existing `ActivityArea` entity + endpoints + `/finance/settings/activity-areas` UI. The story verifies this surface meets the AC (create/edit, `IsActive=false` = deactivate, soft-delete) and does **not** regress it. _(Vorstand is intentionally excluded — see DEC-5.)_
2. **(Budget by fiscal period — net new)** Kassier/Admin can assign a budget amount to a cost center (ActivityArea) for a specific fiscal period, and edit or remove it. A budget row is `(ActivityAreaId, FiscalPeriodId, Amount, Currency)`.
3. **(Validation)** Validation prevents: a budget for a non-existent/inactive ActivityArea or non-existent FiscalPeriod; a duplicate active budget for the same `(ActivityAreaId, FiscalPeriodId)` pair; and a negative `Amount` (zero is allowed). Creating/editing a budget whose FiscalPeriod is **Locked** is rejected with a clear error.
4. **(Authorization + audit)** Budget read uses `RequireFinanceRead`; budget create/update/delete uses `RequireFinanceWrite`; the group is gated by `Module:finance`. Every budget create/update/delete writes an audit entry via `IAuditService.LogActionAsync` (`FinanceCreated`/`FinanceUpdated`/`FinanceDeleted`, `entityType: "Budget"`).
5. **(Persistence)** An EF Core migration adds the `budgets` table (snake_case, `Amount` `decimal(18,2)`, enum-as-string currency, soft-delete query filter, unique filtered index on the active `(activity_area_id, fiscal_period_id)` pair) and the `ApplicationDbContextModelSnapshot.cs` is regenerated. Existing finance records are unaffected; no record is forced to have a budget.

## Tasks / Subtasks

- [ ] **Task 0 — Spike & decision confirmation (AC: all)**
  - [ ] Re-read [ActivityArea.cs](../../backend/src/IabConnect.Domain/Finance/ActivityArea.cs), its EF configuration, repository (`ActivityAreaRepository` in [FinanceRepositories.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs)), endpoints, and the `/finance/settings/activity-areas` page to confirm cost-center CRUD already satisfies AC-1. Record in Debug Log: "AC-1 satisfied by ActivityArea — verify-only".
  - [ ] Confirm DEC-1 (reuse ActivityArea), DEC-2 (entity name), DEC-3 (FiscalPeriod keying), DEC-4 (currency source), DEC-5 (authz) per the Decision-Needed block. If user pre-declared autonomous mode, record the (a)/(b)/(c) Debug Log per project-context A41/A43; otherwise surface via AskUserQuestion.
  - [ ] Read [CreateAccountCommandHandler.cs](../../backend/src/IabConnect.Application/Finance/Accounts/Commands/CreateAccountCommandHandler.cs) + `CreateAccountCommand` + `CreateAccountCommandValidator` + `AccountConfiguration.cs` + `AccountRepository` as the canonical single-aggregate CRUD template to mirror.
- [ ] **Task 1 — Domain: `Budget` entity (AC: 2, 3, 5)**
  - [ ] Add `backend/src/IabConnect.Domain/Finance/Budget.cs`: `Entity, ISoftDeletable`. Properties (all `private set`): `ActivityAreaId` (Guid), `FiscalPeriodId` (Guid), `Amount` (decimal), `Currency` (`FinanceCurrency` enum), `Notes` (string?), `CreatedAt`/`UpdatedAt` (DateTimeOffset), `CreatedBy`/`UpdatedBy` (string?), plus `IsDeleted`/`DeletedAt`/`DeletedBy`. Private ctor + `static Create(...)` factory + `Update(...)` + `SoftDelete(string?)`/`Restore()` mirroring [ActivityArea.cs](../../backend/src/IabConnect.Domain/Finance/ActivityArea.cs):26-70.
  - [ ] Factory invariants: throw on `Amount < 0`; normalize/trim `Notes`. Keep cross-entity existence checks (ActivityArea/FiscalPeriod exist, uniqueness, locked-period) out of the entity — they belong in the handler/validator (existence) and handler (locked-period), matching the Invoice precedent.
- [ ] **Task 2 — Infrastructure: EF config + migration + repository (AC: 4, 5)**
  - [ ] Add `backend/src/IabConnect.Infrastructure/Persistence/Configurations/BudgetConfiguration.cs` (`IEntityTypeConfiguration<Budget>`): `ToTable("budgets")`; `Id` `ValueGeneratedNever`; `Amount` `.HasPrecision(18, 2)`; `Currency` `.HasConversion<string>().HasMaxLength(10)`; FK relationships to `ActivityArea` and `FiscalPeriod` (`OnDelete(DeleteBehavior.Restrict)` — never cascade-delete budgets when a period/area is removed); `builder.HasQueryFilter(b => !b.IsDeleted)`; **unique filtered index** `ix_budgets_activity_area_fiscal_period_unique` on `(activity_area_id, fiscal_period_id)` `HasFilter("is_deleted = false")`; `builder.Ignore(b => b.DomainEvents)`. Snake_case all columns. Mirror [AccountConfiguration.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Configurations/AccountConfiguration.cs) + [FinanceProfileConfiguration.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Configurations/FinanceProfileConfiguration.cs):117-124 (filtered unique index pattern).
  - [ ] Add `public DbSet<Budget> Budgets => Set<Budget>();` to [ApplicationDbContext.cs](../../backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs) in the Finance section (after line ~83). `ApplyConfigurationsFromAssembly` auto-discovers the config.
  - [ ] Add `IBudgetRepository` to the Application finance repository interfaces file (alongside `IActivityAreaRepository`) and implement `BudgetRepository` in [FinanceRepositories.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs) mirroring `AccountRepository`: `GetAllAsync(ct)` / `GetByIdAsync` / `GetByActivityAreaAndPeriodAsync(Guid areaId, Guid periodId, ct)` (for the uniqueness pre-check) / `GetByFiscalPeriodAsync(Guid periodId, ct)` / `AddAsync` / `UpdateAsync` / `DeleteAsync` (soft-delete). All `async` + `CancellationToken`, `.AsNoTracking()` on reads.
  - [ ] Register `services.AddScoped<IBudgetRepository, BudgetRepository>();` in [Infrastructure/DependencyInjection.cs](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs) in the finance repos block (~line 133-151).
  - [ ] Generate the migration: `dotnet ef migrations add AddBudgetModel --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api` (run from `backend/`). Verify it only adds the `budgets` table + index and touches the snapshot; no edits to existing finance tables.
- [ ] **Task 3 — Application: MediatR commands/queries + validators (AC: 2, 3, 4)**
  - [ ] `backend/src/IabConnect.Application/Finance/Budgets/` with: `Commands/CreateBudgetCommand(+Handler+Validator)`, `Commands/UpdateBudgetCommand(+Handler+Validator)`, `Commands/DeleteBudgetCommand(+Handler)`, `Queries/GetBudgetsQuery(+Handler)` (filter by optional `ActivityAreaId`/`FiscalPeriodId`/`Year`), `Queries/BudgetDto`.
  - [ ] Handlers mirror [CreateAccountCommandHandler.cs](../../backend/src/IabConnect.Application/Finance/Accounts/Commands/CreateAccountCommandHandler.cs): inject `IBudgetRepository` + `IUnitOfWork` + `IAuditService` (+ `IActivityAreaRepository`, `IFiscalPeriodRepository` for existence checks). Sequence: validate existence → **locked-period guard** (`IFiscalPeriodService.EnsurePeriodNotLockedAsync(period.StartDate, ct)` or load the period and check `IsMutationAllowed`) → uniqueness pre-check via `GetByActivityAreaAndPeriodAsync` → `repo.AddAsync` → `unitOfWork.SaveChangesAsync` → `auditService.LogActionAsync(FinanceCreated, ..., entityType: "Budget", entityId: budget.Id.ToString(), ct: ct)`.
  - [ ] Validators mirror `CreateAccountCommandValidator`: `Amount` `>= 0`; `ActivityAreaId`/`FiscalPeriodId` `NotEmpty`; `Currency` `.Must(Enum.TryParse<FinanceCurrency>)`; `UserName` `NotEmpty`. (Existence + uniqueness + locked-period are handler-level rules, not validator rules, matching the Invoice precedent.)
- [ ] **Task 4 — API: endpoints (AC: 4)**
  - [ ] Add `backend/src/IabConnect.Api/Endpoints/BudgetEndpoints.cs` with `MapBudgetEndpoints(this IEndpointRouteBuilder routes)`: group `/api/v1/finance/budgets`, `.WithTags("Finance - Budgets")`, `.RequireAuthorization("Module:finance")`. `GET /` + `GET /{id:guid}` → `RequireFinanceRead`; `POST /`, `PUT /{id:guid}`, `DELETE /{id:guid}` → `RequireFinanceWrite`. Thin handlers `sender.Send(...)`; `WithName`/`WithSummary`/`WithDescription` (cite REQ-044). Mirror [PaymentEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/PaymentEndpoints.cs).
  - [ ] Register the group in [EndpointMapper.cs](../../backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs) where the other finance endpoint groups are mapped.
- [ ] **Task 5 — Frontend: budget management UI (AC: 1 verify, 2, 3)**
  - [ ] Add typed API wrapper `frontend/src/lib/api/budgets.ts` (DTOs + enum-as-PascalCase) following the `useApiClient()` convention in [transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx) and `frontend/src/lib/api/members.ts`.
  - [ ] Add `frontend/src/app/finance/budgets/page.tsx` (or `/finance/settings/budgets`): standard authenticated layout `<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">` + `max-w-7xl`; `useAuth()` gate (`canReadFinance` to view, `canWriteFinance` for create/edit/delete buttons); search/filter (by cost center + period/year) above the table; create/edit `<Dialog>` with `<Select>` for ActivityArea (active only) + `<Select>` for FiscalPeriod + money `<Input>` for Amount; `refreshKey`/`useCallback` fetch + re-fetch after mutation (mirror [transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx):244-291). Orange-600 primary actions, lucide icons, no blue.
  - [ ] Add next-intl keys under the `finance` namespace in **both** `frontend/messages/de.json` and `en.json` (e.g. `finance.budgets.*`). No hardcoded UI strings. Keep de/en parity (A51).
- [ ] **Task 6 — Tests (AC: all)**
  - [ ] Application unit tests (xUnit v3 + FluentAssertions): `Budget.Create` rejects negative amount; validators (amount/currency/required); handler audit call. (`backend/tests/IabConnect.Application.Tests/Finance/Budgets/`)
  - [ ] Infrastructure integration tests (Testcontainers PostgreSQL): `BudgetRepository` round-trip; the unique filtered index rejects a second active budget for the same `(area, period)`; soft-deleted budget is excluded by the query filter and does **not** block re-insert. (`backend/tests/IabConnect.Infrastructure.Tests/`)
  - [ ] API authorization tests: `RequireFinanceRead`/`RequireFinanceWrite`/`Module:finance` on the new routes. **Register `IBudgetRepository` (+ any new injected services) in every endpoint-metadata test harness that maps finance groups** (project-context A63) to avoid "Failure to infer parameters".
  - [ ] Frontend Vitest/Testing Library test for the budgets page (permission gating + form). Mock `useTranslations` to return a **stable** function (A64); add `afterEach(cleanup)` + `// @vitest-environment jsdom` (A35/A46).
  - [ ] Gate frontend changes on `npx eslint <changed>` + `npx prettier --check <changed>` + full `vitest run` (A58 — repo-wide lint/format is pre-drifted).
- [ ] **Task 7 — Quality gates & closing checklist (AC: all)**
  - [ ] `dotnet test` from `backend` green; migration applies clean. `npm run typecheck` + scoped lint/format + vitest green.
  - [ ] AC-Subitem Completion Check (A29): list each AC's status (covered/deferred/N/A) with evidence in Completion Notes.

## Dev Notes

### Sprint Plan Context

- Epic E6 "Finance Planning" (REQ-044). Goal: add budgets and cost centers **without weakening existing finance compliance behavior**.
- Story order: **S1 → S2 → S3** (HARD). S3 (Soll/Ist report) consumes the `Budget` entity built here. S2 verifies/fills the actuals-side association. Do not start S2/S3 before S1's `Budget` + migration land.
- This is a **post-MVP comprehensive** epic (the project pivoted away from MVP — see project memory). Build the full vertical slice, not a stub.

### Critical Decision: Cost Center == ActivityArea (load-bearing)

The single most important fact for this epic: **`ActivityArea` (REQ-068) is the cost center.** It already exists as an admin-managed activity/project/division tag (`Code`/`Name`/`Color`/`IsActive`/soft-delete) and is **already referenced** by `Transaction`, `InvoiceItem`, and `JournalEntryLine` via nullable `ActivityAreaId`. The REQ-044 CSV example ("Auswertung nach Event/Projekt (Diwali etc.)") is exactly ActivityArea's purpose. Therefore:
- **Do NOT create a `CostCenter` entity.** (DEC-1, resolved.)
- Cost-center CRUD (AC-1) is **already done** — verify, do not rebuild (project-context A56: existing-implementation pattern; do not regress the shipped surface to match an AC literal).
- The net-new deliverable is the **`Budget`** entity only.
- The "actuals" half (associating finance records with cost centers) is **already largely present** via `ActivityAreaId` — that is S2's verification scope.

### Existing Code To Reuse (verified during spike)

| Concern | Reuse | Path |
|---|---|---|
| Cost-center entity | `ActivityArea` | [Domain/Finance/ActivityArea.cs](../../backend/src/IabConnect.Domain/Finance/ActivityArea.cs) |
| Cost-center repo | `ActivityAreaRepository` | [FinanceRepositories.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs):898-951 |
| Single-aggregate CRUD template | `Account*` | [Application/Finance/Accounts/Commands/](../../backend/src/IabConnect.Application/Finance/Accounts/Commands/) |
| EF config template (filtered unique index, soft-delete filter, decimal precision) | `FinanceProfileConfiguration` / `AccountConfiguration` | [Configurations/](../../backend/src/IabConnect.Infrastructure/Persistence/Configurations/) |
| Fiscal period + locked-period guard | `FiscalPeriod` / `FiscalPeriodService` | [Domain/Finance/FiscalPeriod.cs](../../backend/src/IabConnect.Domain/Finance/FiscalPeriod.cs):59-142, [Application/Finance/FiscalPeriods/FiscalPeriodService.cs](../../backend/src/IabConnect.Application/Finance/FiscalPeriods/FiscalPeriodService.cs) |
| Audit | `IAuditService.LogActionAsync` (`FinanceCreated/Updated/Deleted`) | [Application/Audit/IAuditService.cs](../../backend/src/IabConnect.Application/Audit/IAuditService.cs) |
| Money formatting (frontend) | `formatCurrency(amount, currency="CHF")` | [frontend/src/lib/utils.ts](../../frontend/src/lib/utils.ts):42-56 |
| List page + selector + refresh pattern | transactions page | [frontend/src/app/finance/transactions/page.tsx](../../frontend/src/app/finance/transactions/page.tsx) |

### Architecture Guardrails

- Clean Architecture / modular monolith: business invariants in Domain, workflow+validation in Application (MediatR + FluentValidation), EF/repos in Infrastructure, Minimal API in Api. Keep `Budget` in the **Finance** module.
- Backend authorization policies are the security boundary; frontend role checks are UX only.
- EF schema changes via migration under `backend/src/IabConnect.Infrastructure/Migrations` — never manual schema edits. Money is `decimal(18,2)`. Enums stored as strings.
- **Aggregate child-persistence gotcha** ([docs/07_dos_donts.md](../../docs/07_dos_donts.md):114-116): for EF-tracked child collections, add via `dbContext.Set<Child>().Add(child)`, not private-backing-field manipulation. `Budget` is a standalone aggregate (not a child of ActivityArea) so this is low-risk here, but keep the rule in mind.
- Finance compliance: preserve audit, soft-delete, cancellation/reversal, **locked-period** behavior. Budgets must not force any existing record to carry a budget/cost center.

### Decision-Needed (resolve at Task 0; recommended options noted)

- **DEC-1 — Cost-center model.** **RESOLVED 2026-06-07: reuse `ActivityArea`** (no new `CostCenter` entity). Confirmed by user. Consequence: AC-1 is verify-only; build only `Budget`; S2 becomes verification/gap-fill.
- **DEC-2 — Budget entity name.** Options: (a) **`Budget`** _(recommended — concise, domain-clear; comment-ref REQ-044/"CostCenterBudget")_; (b) `CostCenterBudget` (literal requirement name but verbose + implies a CostCenter entity that doesn't exist). Rationale for (a): there is no `CostCenter` type, so `CostCenterBudget` would be a misnomer; `Budget` keyed by `ActivityAreaId` reads cleanly.
- **DEC-3 — Budget granularity / keying.** Options: (a) **key by `FiscalPeriodId`** (existing monthly FiscalPeriod) _(recommended — honors AC "by fiscal period", gives exact `StartDate`/`EndDate` bounds for Soll/Ist, and reuses the locked-period mechanism for free)_; (b) key by `int Year` (annual budget — lighter data entry for a Verein, but loses period-level granularity + the locked-period reuse and diverges from the AC wording). If the user finds 12-rows-per-year too heavy, (b) is the fallback; recommend (a) for AC fidelity and clean S3 integration. **Flag to user if not in autonomous mode.**
- **DEC-4 — Budget currency source.** Options: (a) **default from the active `FinanceProfile.Currency`** and store the snapshot on the budget _(recommended — matches how Payment thresholds resolve currency; keeps Soll/Ist currency-consistent with actuals)_; (b) free per-budget currency picker (unnecessary for a single-jurisdiction Verein). Recommend (a).
- **DEC-5 — Authorization.** **RESOLVED 2026-06-07: reuse existing `RequireFinanceRead` (Admin/Kassier/Auditor) + `RequireFinanceWrite` (Admin/Kassier)**, gated by `Module:finance`. Confirmed by user. Note: the AC text + architecture authz matrix mention "Vorstand", but Vorstand currently has **no** finance access at all; adding it is a separate module-wide authz change, explicitly out of scope here.

### Testing Requirements

- Backend: xUnit v3 + FluentAssertions; Moq only for external boundaries. **Testcontainers PostgreSQL** for the unique-index + soft-delete-filter behavior (not EF InMemory). API auth tests via `Microsoft.AspNetCore.Mvc.Testing`.
- Frontend: Vitest + Testing Library; stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom directive for render tests (A35/A46); scoped eslint/prettier (A58).
- Minimum before `review`: `dotnet test` green from `backend`; migration applies; `npm run typecheck` + scoped lint/format + `vitest run` green.

### Previous Story Intelligence

- First story in Epic E6. Baseline = project-context.md + the E4/E5 feature-epic learnings (A61-A69): single-aggregate writes use the `repo.AddAsync` + `IUnitOfWork.SaveChangesAsync` + `IAuditService` handler shape (no multi-aggregate coordinator needed here — A61 N/A); register new DI services in test harnesses (A63); stable `useTranslations` mock (A64); enum-home decisions are deliberate (A69 — `Budget.Currency` uses the Domain-level `FinanceCurrency` enum, which already lives in Domain, so no string-storage workaround needed).

### Latest Technical Context

- .NET 10 / EF Core 10 / Npgsql — migrations generated from model changes, tracked in source control. Filtered unique indexes use `HasFilter("...")` (PostgreSQL partial index).
- Next.js 16 App Router / React 19 / next-intl — all user text via translation keys; de + en only (no hi.json).
- FluentValidation 11 + MediatR 12 — validators auto-registered via `AddValidatorsFromAssembly`; handlers via `RegisterServicesFromAssembly` (no manual registration needed for the command/query types themselves).

### Project Structure Notes

- Backend: `Domain/Finance/Budget.cs`, `Application/Finance/Budgets/**`, `Infrastructure/Persistence/Configurations/BudgetConfiguration.cs`, `Infrastructure/Persistence/Repositories/FinanceRepositories.cs`, `Api/Endpoints/BudgetEndpoints.cs`.
- Frontend: `app/finance/budgets/page.tsx`, `lib/api/budgets.ts`, `messages/{de,en}.json`.
- Tests: `tests/IabConnect.Application.Tests/Finance/Budgets/`, `tests/IabConnect.Infrastructure.Tests/`, `tests/IabConnect.Api.Tests/`.

### References

- [_bmad-output/planning-artifacts/epics-and-stories.md](../planning-artifacts/epics-and-stories.md#L678-L702) (E6-S1)
- [_bmad-output/planning-artifacts/prd.md](../planning-artifacts/prd.md) REQ-044 (lines ~404-410)
- [_bmad-output/planning-artifacts/architecture.md](../planning-artifacts/architecture.md) (REQ-044 entities ~687-703; authz matrix ~827; audit ~843-844; ADR-007/008 module enforcement ~156-238)
- [_bmad-output/project-context.md](../project-context.md) (A56, A58, A61-A64, A69)
- [docs/07_dos_donts.md](../../docs/07_dos_donts.md) (aggregate child persistence; orange buttons)
- [docs/13_frontend_design_standards.md](../../docs/13_frontend_design_standards.md) (page layout, table standard)

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

- 2026-06-07: Story refreshed from the 2026-05-12 pre-pivot stub to a comprehensive dev-ready spec. Reframed per resolved DEC-1 (reuse `ActivityArea` as cost center; build only the `Budget` entity) and DEC-5 (existing finance policies). Marked ready-for-dev.
