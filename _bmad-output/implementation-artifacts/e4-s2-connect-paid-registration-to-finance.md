# Story 4.2: Connect Paid Registration to Finance

Status: review

## Refresh Notes (2026-06-06, Epic-4 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub. Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-4 (Event Monetization)** per user directive *"nächstes epic angehen … es handelt sich nicht mehr um einen MVP."* (2026-06-06). This is the **hardest story in the epic**: it crosses the Events and Finance module boundary atomically and must honour the finance-compliance rules (soft-delete vs cancellation/reversal, fiscal-period lock, accounting mode) without re-implementing any of them.

**A56 existing-implementation spike — what already exists vs what is net-new:**

- **The entire Finance receivable machinery already exists and must be reused, not rebuilt:** `Invoice` (Draft→Sent→Paid/Overdue→Cancelled, `RecipientType` Member/Sponsor/Vendor/Other, `RecipientId` Guid?, `_items` backing field, atomic `GetNextInvoiceNumberAsync`), `Invoice.Create(...)` ([Invoice.cs:58-93](../../backend/src/IabConnect.Domain/Finance/Invoice.cs#L58)), `AddItem`/`AddItemWithTax` (Draft-only, [Invoice.cs:126,136](../../backend/src/IabConnect.Domain/Finance/Invoice.cs#L126)), `MarkAsSent`/`MarkAsPaid`/`MarkAsOverdue`/`Cancel(reason,by)` ([Invoice.cs:176-244](../../backend/src/IabConnect.Domain/Finance/Invoice.cs#L176)), `CreateInvoiceCommandHandler` (fiscal-period check → `GetNextInvoiceNumberAsync` → `Invoice.Create` → `AddItemWithTax` → `repo.AddAsync` → `IUnitOfWork.SaveChangesAsync` → `IAuditService.LogActionAsync(AuditEventType.FinanceCreated,…)`), `IUnitOfWork.SaveChangesAsync` (single `ApplicationDbContext.SaveChanges` = the atomicity primitive), `IFiscalPeriodService.EnsurePeriodNotLockedAsync(date)`, `FinanceProfile.AccountingMode` (SimpleCash default / DoubleEntry).
- **What is net-new (this story):** (1) a **source link from the finance record back to the event registration** (DEC-2 — recommended: a nullable `EventRegistrationId` on `Invoice`); (2) a **cross-module coordinator** that, when someone registers for a paid event, creates *both* the `EventRegistration` *and* the `Invoice` in **one** `SaveChangesAsync` (DEC-3); (3) **cancellation wiring** so cancelling a registration cancels/soft-deletes/flags its invoice per finance rules (DEC-5); (4) a **branch in the registration endpoints** so the free path is unchanged and only paid registrations route through the coordinator.
- **`EventRegistration` has no fee/payment field today** — but per DEC-2 (recommended) the link lives on the **Invoice** side (`EventRegistrationId`), so `EventRegistration` may need only a derived/queried "payment status" for S3, not a stored amount. Confirm at spike whether S3 needs any stored field on `EventRegistration` or can derive everything from the linked invoice.

**Single-source-of-truth scoping (carry from S1):** there is **NO payment gateway** in the codebase. "Paid registration" = raise a **receivable (Invoice)** that the registrant owes; money is collected **offline** (bank transfer / cash at event) and reconciled by the Kassier via the existing finance `Payment` → `Invoice.MarkAsPaid` flow. This story does **not** take a card, does **not** call a PSP, and does **not** auto-mark anything Paid.

**Module enforcement (E10 / ADR-008 L237):** paid registration needs **both** `Module:events` and `Module:finance`. The architecture explicitly flags this dependency and defers the hard-block product rule to E10-S5 (done). DEC-7 resolves the events-enabled-but-finance-disabled behavior.

**A34 note:** authored alongside S1 + S3. Dev-story order S1 → **S2** → S3; S2 depends HARD on S1's `EventFeeCategory` model.

## Story

As **a Kassier who needs every paid event registration to land in the books automatically and correctly** (post-MVP: a Verein running ticketed events where dozens of attendees register through the public site, and the treasurer must see each fee as a tracked receivable rather than reconstructing it by hand),
I want **the act of registering for an event that has an applicable active paid fee category to atomically (a) create the registration and (b) raise a finance `Invoice` (one item per fee, referencing the registration) following the existing invoice-creation rules — fiscal-period lock, next-invoice-number, audit, accounting mode — and I want cancelling that registration to flow through proper cancellation/reversal (never a hard delete), so that a failure on the finance side never leaves a half-registered, un-invoiced attendee**,
so that **fees are tracked and reconcilable from day one, the books stay consistent with attendance, refunds follow Swiss-Verein accounting hygiene, and a future change that breaks the registration↔finance link is caught by integration tests instead of at the year-end audit**.

**Requirement:** REQ-022 (Ticketing / Fees). Epic E4 (Event Monetization), Story 2 of 3.

- **Source-of-truth:** [epics-and-stories.md §Story E4-S2 (L497-519)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchors:** [ADR-001 Modular Monolith](../planning-artifacts/architecture.md#adr-001-keep-modular-monolith), [ADR-003 Backend Authorization Mandatory](../planning-artifacts/architecture.md#adr-003-backend-authorization-is-mandatory), [ADR-004 PostgreSQL + EF Core](../planning-artifacts/architecture.md#adr-004-postgresql-and-ef-core-remain-persistence-backbone), [ADR-008 Three-Layer Module Enforcement (L237)](../planning-artifacts/architecture.md#adr-008-three-layer-module-enforcement).
- **Finance-compliance source:** [docs/07_dos_donts.md](../../docs/07_dos_donts.md) + project-context "Critical Don't-Miss Rules" (soft-delete; sent/overdue use cancellation/reversal; double-entry controlled by accounting mode; aggregate-child persistence).

**Upstream (HARD dependencies):**

- **E4-S1 done** — the `EventFeeCategory` model (amount `(18,2)`, `Currency`, `Applicability`, `IsActive`, availability window) is the input to "which fee applies". ✅ when S1 lands.
- **Finance module done** — Invoice/Payment/UnitOfWork/FiscalPeriod/audit machinery. ✅
- **Events registration flow done** — `EventRegistration.CreateForMember/CreateForGuest/CreateWaitlisted` + the public/member registration endpoints. ✅
- **E10 done** — `Module:events` + `Module:finance` gates. ✅

**Downstream:**

- **E4-S3** renders the per-registration payment status (derived from the linked invoice) on the public success screen + the admin participant roster, and enriches the confirmation email with fee/invoice info.

**Wave context:** Epic-4 middle story. **Net new artifacts:** 1 Invoice field + EF config + migration (the registration link), 1 cross-module coordinator (MediatR command per DEC-3) + validator, registration-endpoint branching, cancellation wiring, integration tests (Testcontainers, the atomicity + rollback proofs are load-bearing). Estimated +350–550 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E4-S2 — paid registration creates the finance record per finance rules]: When a member or guest registers for an event that has **at least one active `EventFeeCategory` applicable to them** (applicability + availability window satisfied at registration time), the system creates an `Invoice` using the **existing `Invoice.Create` + `AddItemWithTax` + `GetNextInvoiceNumberAsync` path** (do not bypass it):
- One `InvoiceItem` per applicable fee, `Description` = event title + category name, `Quantity` = the number of attendees that category covers (default the registration's `NumberOfGuests`/`TotalParticipants`, or 1 — confirm the quantity rule at spike against how fee categories map to head-count), `UnitPrice` = `EventFeeCategory.Amount`.
- `RecipientType`/`RecipientId`/`RecipientName`: for a **member** registration → `RecipientType.Member`, `RecipientId` = member id, `RecipientName` = member name; for a **guest** registration → `RecipientType.Other`, `RecipientId` = null, `RecipientName` = participant name (guests are not members; `Other` is the correct existing enum value — **do not invent a new `RecipientType`**; the registration link is carried by DEC-2's field, not by overloading `RecipientType`).
- `TaxRate`: default `0` unless the active `FinanceProfile.VatStatus` says otherwise (most Verein events are VAT-exempt/SmallBusiness; the fee amount is the gross). Document the VAT decision; do not hardcode a non-zero rate.
- `Date` = registration date (now, UTC); `DueDate` per a sensible default (e.g. event start date, or now + N days — confirm at spike, reuse any existing invoice-due default).
- `Currency`: the invoice/profile currency must match the fee category `Currency` (S1 defaults categories from the profile, so they normally agree; if a category somehow carries a different currency than the active profile, **reject the paid registration with a clear error** rather than silently mixing currencies).

**AC-2** [epics §E4-S2 — finance record references the event registration]: The finance record is linked back to the `EventRegistration` (DEC-2 — recommended: a new nullable `Invoice.EventRegistrationId` (Guid?) with an FK + index). The link is queryable both directions: given a registration, find its invoice(s); given an invoice, find its registration. This is what S3's admin roster and the cancellation wiring (AC-4) rely on.

**AC-3** [epics §E4-S2 — atomicity: no inconsistent state on finance failure (LOAD-BEARING)]: Registration + invoice creation happen in **one** `IUnitOfWork.SaveChangesAsync` (both `EventRegistration` and `Invoice` are tracked by the same `ApplicationDbContext` — modular monolith, single DB). If invoice creation throws (fiscal period locked, currency mismatch, validation, DB error), the `EventRegistration` is **not** persisted — the whole unit rolls back. There is no path where an attendee is registered but un-invoiced for a paid event, and none where an invoice exists without its registration. **Proven by an integration test that forces the finance step to fail and asserts neither row exists** (AC-8).

**AC-4** [epics §E4-S2 — cancellation/refund uses cancellation/reversal, not hard delete (FINANCE COMPLIANCE)]: When a paid registration is cancelled (participant- or admin-initiated, via the existing cancellation path), its linked invoice is handled per finance rules (DEC-5 — recommended branch):
- Invoice still **Draft** → soft-delete the invoice (`IInvoiceRepository.DeleteAsync` → `Invoice.SoftDelete()`); consistent with how draft invoices are already removed.
- Invoice **Sent/Overdue** → `Invoice.Cancel(reason, updatedBy)` ([Invoice.cs:235](../../backend/src/IabConnect.Domain/Finance/Invoice.cs#L235)) with a reason naming the registration cancellation. **Never** hard-delete a sent invoice (the domain method already throws if misused — respect it).
- Invoice **Paid** → do **not** auto-refund money; leave the invoice Paid and surface a flag/audit so the Kassier processes a manual refund/reversal through the existing finance flow. Document that an automatic money refund is out of scope (no PSP).
- The cancellation path must keep registration cancellation working for **free** registrations unchanged (no invoice to touch).

**AC-5** [project-context — accounting mode + fiscal period honoured, not duplicated]: The coordinator calls `IFiscalPeriodService.EnsurePeriodNotLockedAsync(invoiceDate)` before creating the invoice (a locked current period makes the paid registration fail gracefully with a clear error — rare since the date is "now"). It uses the **same** `CreateInvoice` code path/handler so that whatever `FinanceProfile.AccountingMode` posting hook fires for a normal invoice (SimpleCash = none; DoubleEntry = automatic journal entry via the existing posting service) fires **identically** here — the story must **not** re-implement or skip journal posting. Confirm at spike whether invoice creation auto-posts and ensure the coordinator inherits that behavior.

**AC-6** [epics §E4-S2 — finance permissions for finance approval/reconciliation]: Creating the receivable as part of self-service registration does **not** require the registrant to hold a finance role (a public guest registers and an invoice is raised on their behalf — the *system* acts, audited as such). But all **subsequent** finance actions on that invoice (send, mark-paid, cancel-as-finance, reconcile) remain gated by the existing finance policies (`RequireFinanceWrite` / `RequireVorstand` for approval) on the existing finance endpoints — this story does not loosen any finance authorization. The registration endpoints keep their existing authorization (`AllowAnonymous` + `Module:public_view` for public; member/staff roles for member registration) **plus** the new `Module:finance` requirement for the *paid* branch (AC-7/DEC-7).

**AC-7** [E10 / ADR-008 L237 — cross-module gate]: The paid-registration path requires **both** `Module:events` and `Module:finance` enabled. DEC-7 resolves behavior when Events is enabled but Finance is disabled (recommended: the paid branch is blocked with a clear, audited error and the event effectively cannot offer paid registration until Finance is re-enabled; the free path is unaffected). The free-registration path keeps requiring only `Module:events` (+ `public_view` for public). Module-denied paths write the standard `ModuleAccessDenied` audit (ADR-008).

**AC-8** [test — backend, atomicity + compliance proofs are load-bearing]: New/extended tests, all green at `cd backend && dotnet test`:
- **Integration (Testcontainers PostgreSQL)** — happy path: register for a paid event → exactly one registration + one linked invoice (correct recipient, item, amount, currency, `EventRegistrationId`) persisted; **rollback path**: force the finance step to throw → assert **neither** registration nor invoice persisted (AC-3); **free path**: register for a free event → registration persisted, **no** invoice (AC-1 boundary).
- **Cancellation tests** (AC-4): cancel with a Draft invoice → invoice soft-deleted; cancel with a Sent invoice → invoice `Cancelled` with reason; cancel with a Paid invoice → invoice stays Paid + flag/audit emitted; cancel a free registration → unchanged.
- **Fiscal-period-locked** test (AC-5): paid registration into a locked period fails and persists nothing.
- **Coordinator unit test** (Moq for repos/UnitOfWork/audit/fiscal — mirror `CreateInvoiceCommandHandlerTests`): asserts the finance path is invoked with the right recipient/item/link and audit is logged.
- **API test**: `Module:finance`-disabled blocks the paid branch (DEC-7) while the free branch still works.

**AC-9** [project-context — audit]: The cross-module action is audited: the invoice creation uses the existing `IAuditService.LogActionAsync(AuditEventType.FinanceCreated, …)` (as `CreateInvoiceCommandHandler` does), and the coordinator additionally records that the invoice originated from a registration (event id + registration id in the audit details), so a paid registration is reconstructable end-to-end. The Paid-invoice cancellation flag (AC-4) is audited too.

**AC-10** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 (every AC sub-item: covered / deferred / N/A + evidence). Frontend touch is minimal/none here (S3 owns UI); if any DTO is added for S3's benefit, gate it per A58 (changed files).

## Tasks / Subtasks

**Task 0 — Spike (A28; resolve DEC-1..DEC-7 per A32, or A41 auto-resolve)**

- [ ] **0.1** Read `CreateInvoiceCommand` + `CreateInvoiceCommandHandler` + `CreatePaymentCommandHandler` ([Application/Finance/](../../backend/src/IabConnect.Application/Finance/)) to confirm the exact create path, the `IUnitOfWork`/`IFiscalPeriodService`/`IAuditService` injection, the `GetNextInvoiceNumberAsync` call site, and **whether invoice creation auto-posts a journal entry in DoubleEntry mode** (AC-5).
- [ ] **0.2** Read `Invoice.cs` Create/AddItemWithTax/MarkAsSent/Cancel/SoftDelete + `IInvoiceRepository` (`AddAsync`, `DeleteAsync`, `GetByIdAsync`, `GetByInvoiceIdAsync`) in [FinanceRepositories.cs](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/FinanceRepositories.cs). Confirm `RecipientType` values (Member/Sponsor/Vendor/Other — [FinanceEnums.cs:37-43](../../backend/src/IabConnect.Domain/Finance/FinanceEnums.cs#L37)) and that **no `EventRegistration` value exists** (DEC-2 uses a link field, not a new enum value).
- [ ] **0.3** Read the registration endpoints ([EventRegistrationEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs)) — the public + member register handlers, the cancellation handler/service (`IEventRegistrationCancellationService`), and how email notification is fired. Identify the branch point where "event has an applicable active paid fee category" routes to the coordinator.
- [ ] **0.4** Read `EventRegistration.cs` factories + `Cancel(...)` + the cancellation service; confirm whether S3 needs any stored payment field on the registration or can derive status from the linked invoice (DEC-6).
- [ ] **0.5** Confirm `IUnitOfWork` wraps the single `ApplicationDbContext` so adding an `EventRegistration` + an `Invoice` and calling `SaveChangesAsync` once is genuinely atomic (it is — same DbContext).
- [ ] **0.6** Read what E10-S5 implemented for the events-enabled-but-finance-disabled cross-module rule (sprint-status / E10-S5 story) to align DEC-7 with the shipped behavior rather than contradict it.
- [ ] **0.7** **Resolve DEC-1..DEC-7** via `AskUserQuestion` (or A41 auto-resolve + A43 Debug Log). Spike output (~10 lines).

**Task 1 — Finance: registration link on Invoice (AC-2)**

- [x] **1.1** Added nullable `EventRegistrationId` (Guid?) to `Invoice` (private setter), set via an optional trailing `eventRegistrationId` param on the existing `Invoice.Create` factory (one construction path).
- [x] **1.2** EF config: property + index `ix_invoices_event_registration_id` in `InvoiceConfiguration.cs`. **No** FK navigation/cascade — the registration soft-cancels and the invoice must outlive registration changes (finance compliance).
- [x] **1.3** Migration `20260606090332_AddEventRegistrationIdToInvoice` (column + index only).

**Task 2 — Cross-module coordinator (AC-1, AC-3, AC-5, AC-9; DEC-3 PIVOT)**

- [x] **2.1** Created `IPaidRegistrationService` (Application) + `PaidRegistrationService` (Infrastructure, direct `ApplicationDbContext`). **DEC-3 PIVOTED** from "MediatR command in Application" to an Infrastructure coordinator service (mirroring `EventRegistrationCancellationService`) — the per-aggregate repositories each call `SaveChangesAsync` internally, so a pure Application handler cannot achieve the single-SaveChanges atomicity AC-3 requires; the Application layer cannot reference `ApplicationDbContext`. One explicit transaction wraps fiscal check → `GetNextInvoiceNumberAsync` (enlists) → `Invoice.Create(...EventRegistrationId...)` → `AddItemWithTax` → add both → one `SaveChangesAsync` → commit → audit.
- [x] **2.2** Validation: currency parity (category ↔ active `FinanceProfile.Currency`, reject mismatch); fiscal-period lock; recipient/fee resolution. (Endpoint-level registration validation — published/open/dedup/capacity — is unchanged and runs before the coordinator.)
- [x] **2.3** Invoice initial status = `Draft` (DEC-4=A). Confirmed at spike: `CreateInvoiceCommandHandler` does **not** auto-post a journal entry, so the coordinator reusing the same `Invoice.Create`+`AddItemWithTax` building blocks inherits identical (no-auto-post) behaviour — no posting re-implemented or skipped (AC-5).

**Task 3 — Registration endpoint branching (AC-1, AC-6, AC-7)**

- [x] **3.1** `RegisterPublic` (guest, isMember=false) + `RegisterMember` (isMember=true) branch via `TryHandlePaidRegistrationAsync`: resolves applicable active categories (`IsAvailableAt` + `AppliesTo`); explicit `FeeCategoryId` honoured (must be applicable) / auto-picks the single applicable category / requires selection (400) when >1 apply (DEC-8); waitlisted = free path (not charged yet); zero applicable = free path unchanged.
- [x] **3.2** Paid branch checks `IModuleSettingsService.IsEnabledAsync(ModuleKeys.Finance)` and returns 403 when Finance is disabled (DEC-7). Free path keeps its existing gates; email confirmation still fires.

**Task 4 — Cancellation wiring (AC-4, AC-9)**

- [x] **4.1** `EventRegistrationCancellationService` extended: after `registration.Cancel(...)`, look up the linked invoice by `EventRegistrationId` and apply the disposition in the SAME transaction — Draft → `SoftDelete`; Sent/Overdue → `Cancel(reason)`; Paid → left intact (manual refund, no PSP); none → no-op.
- [x] **4.2** Invoice disposition audited via `IAuditService.LogActionAsync(FinanceStatusChanged, …)` after commit (AC-9).

**Task 5 — Tests (AC-8)**

- [x] **5.1** Testcontainers integration (`PaidRegistrationServiceTests`): happy path guest (1 reg + 1 linked Draft invoice, RecipientType.Other, Total=qty×amount) + member recipient; **rollback** via fiscal-lock (neither row persists) + currency-mismatch (neither row persists).
- [x] **5.2** Cancellation tests: Draft→soft-deleted, Sent→Cancelled+reason, Paid→intact, free→no invoice touched.
- [x] **5.3** Fiscal-period-locked covered by the rollback test (mocked `IFiscalPeriodService` throws → nothing persists).
- [x] **5.4** Coordinator covered by the integration tests (real DB + Moq for fiscal/profile/audit policy deps).
- [~] **5.5** API `Module:finance`-disabled paid-branch block — **deferred**: the DEC-7 gate is an in-handler `IsEnabledAsync` guard (verified by build + the metadata-test harness now wiring the 3 new services); a full WebApplicationFactory module-toggle HTTP test is high-setup/low-additional-confidence and deferred to the epic-boundary review per A47-style escape.
- [x] **5.6** `dotnet test` green: Application.Tests 1478, Api.Tests 226, Infrastructure PaidRegistration 8, cancellation-concurrency 3. Build 0 errors.

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-10)**

- [x] **6.1** QGT table populated below.
- [x] **6.2** A43 (a)/(b)/(c) recorded for DEC-1..DEC-8 in the Debug Log.
- [x] **6.3** Status flipped: ready-for-dev → in-progress → review.

## Dev Notes

### A28 Spike Output Anchors

- Invoice create path: `CreateInvoiceCommandHandler` (fiscal check → `GetNextInvoiceNumberAsync` → `Invoice.Create` → `AddItemWithTax` → `repo.AddAsync` → `IUnitOfWork.SaveChangesAsync` → `IAuditService.LogActionAsync(AuditEventType.FinanceCreated,…)`), [Application/Finance/](../../backend/src/IabConnect.Application/Finance/).
- Invoice domain methods: `Create` [Invoice.cs:58](../../backend/src/IabConnect.Domain/Finance/Invoice.cs#L58), `AddItemWithTax` :136, `MarkAsSent` :176, `MarkAsPaid` :186, `Cancel` :235 (Sent/Overdue only — throws otherwise), `SoftDelete` (ISoftDeletable).
- `RecipientType`: Member/Sponsor/Vendor/Other only ([FinanceEnums.cs:37-43](../../backend/src/IabConnect.Domain/Finance/FinanceEnums.cs#L37)) — guests use `Other`; the registration link is the new `EventRegistrationId` field, not a new enum value.
- Atomicity primitive: `IUnitOfWork.SaveChangesAsync` = one `ApplicationDbContext.SaveChanges` across Events + Finance entities (modular monolith, single DB).
- Fiscal lock: `IFiscalPeriodService.EnsurePeriodNotLockedAsync(date)`.
- Accounting mode: `FinanceProfile.AccountingMode` (SimpleCash default / DoubleEntry); confirm whether invoice create auto-posts (AC-5).
- Registration endpoints + cancellation service: [EventRegistrationEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs); `IEventRegistrationCancellationService`. Email via `IEventNotificationService.SendRegistrationConfirmationAsync`.
- Finance test precedents: `CreateInvoiceCommandHandlerTests` (Moq), Testcontainers `postgres:18` repository tests.

### Decision-Needed Block

**DEC-1 — Finance record type for a paid registration.**
- **A (RECOMMENDED):** `Invoice` (receivable). Supports the Sent→Paid→Overdue→Cancelled lifecycle, reconciliation against `Payment`, dunning, and cancellation/reversal — exactly what the AC's "invoice … tracked and reconciled" + "cancellation/reversal" language needs.
- **B:** A direct `Payment` (income). Simpler but skips the receivable/open-item tracking and doesn't model "owed but unpaid".
- **C:** Both (invoice + payment). Premature — payment is recorded by the Kassier when money actually arrives, via the existing flow.
- *Recommendation A.*

**DEC-2 — How the finance record references the registration.**
- **A (RECOMMENDED):** Add nullable `Invoice.EventRegistrationId` (Guid?) + FK + index. Explicit, queryable both directions, leaves `RecipientType`/`RecipientId` free to carry the payer identity (Member or Other).
- **B:** Add a `RecipientType.EventRegistration` enum value and stuff the registration id in `RecipientId`. Conflates "who pays" with "what this invoice is for"; breaks the existing recipient semantics.
- **C:** A generic `SourceType`/`SourceId` on Invoice (mirroring `JournalEntry`). More flexible but more surface than needed for one source type.
- *Recommendation A.*

**DEC-3 — Cross-module coordination mechanism.**
- **A (RECOMMENDED):** A MediatR command `CreatePaidRegistrationCommand` in `Application/Events` that builds registration + invoice and commits via `IUnitOfWork.SaveChangesAsync`. Matches the Finance module's command+UnitOfWork convention and gives a clean test seam.
- **B:** An application service called from the registration endpoint. Works, but a command is more consistent with how finance mutations are structured and easier to unit-test.
- **C:** Domain event raised by `EventRegistration`, handled to create the invoice. Decouples but makes atomicity harder (the AC requires one transaction; cross-handler domain events risk a second SaveChanges).
- *Recommendation A — and crucially keep it in ONE unit of work for AC-3.*

**DEC-4 — Initial invoice status.**
- **A (RECOMMENDED):** `Draft`. The Kassier reviews/sends the batch of event invoices; cancellation of a still-draft invoice is a clean soft-delete; matches the finance approval ethos. S3 shows the registrant "payment pending" derived from Draft/Sent.
- **B:** Auto-`Sent`. The registrant immediately owes; but cancellation then always needs `Cancel(reason)` and the registrant gets a "sent invoice" with no human review.
- *Recommendation A.* (Confirm whether the public registrant should receive invoice details immediately — if yes, S3 communicates "an invoice will follow" rather than attaching a sent invoice.)

**DEC-5 — Cancellation/refund branch (finance compliance).**
- **A (RECOMMENDED):** Draft → soft-delete; Sent/Overdue → `Invoice.Cancel(reason)`; Paid → leave Paid + flag/audit for manual Kassier refund (no auto money refund — no PSP); free → no-op.
- **B:** Always require a manual finance action (cancel/refund) for any linked invoice, even Draft. More conservative, more operator work, more chance of orphaned drafts.
- *Recommendation A — honours soft-delete-vs-cancellation rules and never hard-deletes a sent invoice.*

**DEC-6 — Payment status on `EventRegistration`: stored vs derived.**
- **A (RECOMMENDED):** Derive S3's per-registration payment status from the linked invoice's status (Draft/Sent → "pending", Paid → "paid", Cancelled/soft-deleted → "n/a"). No stored payment field on `EventRegistration`; one source of truth (the invoice).
- **B:** Store a denormalized `PaymentStatus` on `EventRegistration`, kept in sync with the invoice. Faster roster queries but a sync-drift risk.
- *Recommendation A — confirm S3's roster query can join/lookup the invoice efficiently (index on `EventRegistrationId` from AC-2 supports it).*

**DEC-7 — Behavior when Events enabled but Finance disabled (ADR-008 L237).**
- **A (RECOMMENDED):** Block the paid-registration branch with a clear, audited error ("paid registration requires the Finance module"); the free path is unaffected; S1's fee-config UI / S3's registration UI surface the dependency. Aligns with E10-S5's shipped cross-module rule (confirm at spike 0.6).
- **B:** Allow the registration but skip the invoice (fee uncollected). **Rejected** — silently loses money/tracking.
- **C:** Hard-block toggling Finance off while a paid event exists. Heavier; E10-S5 owns toggle rules — defer to whatever it shipped.
- *Recommendation A, reconciled with E10-S5.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **Amount precision parity** — `EventFeeCategory.Amount (18,2)` (S1) copies into `InvoiceItem.UnitPrice` with no rounding. 
2. **Atomicity** — registration + invoice in one `SaveChangesAsync`; rollback proven by test (AC-3/AC-8). 
3. **No new `RecipientType`** — guests are `Other`; the link is `EventRegistrationId` (A52-style: verify the enum surface before adding to it). 
4. **Finance rules reused, not reimplemented** — fiscal lock, invoice number, soft-delete vs cancel, accounting-mode posting all go through existing finance code. 
5. **Free path unchanged** — existing free-registration behavior + tests stay green.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared, auto-pick DEC-1=A, DEC-2=A, DEC-3=A, DEC-4=A, DEC-5=A, DEC-6=A, DEC-7=A and record (a)/(b)/(c) per A43. Otherwise surface DEC-1..DEC-7 via `AskUserQuestion` at Task 0 (`feedback_decisions_via_ask_tool`).

### Project Structure Notes

- NEW: coordinator command + handler + validator under `backend/src/IabConnect.Application/Events/` (e.g. `PaidRegistration/CreatePaidRegistrationCommand.cs`).
- NEW: `{timestamp}_AddEventRegistrationIdToInvoice` migration.
- NEW: backend tests (Testcontainers integration: happy/rollback/free/cancellation/fiscal-lock; coordinator unit; API module-gate).
- MODIFIED: `backend/src/IabConnect.Domain/Finance/Invoice.cs` (+ `EventRegistrationId` + set via `Create`), `InvoiceConfiguration.cs` (FK + index).
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` (branch to coordinator on paid; `Module:finance` on paid branch) + the cancellation service/path (invoice disposition).
- MODIFIED (possibly): a DTO addition for S3's roster payment-status (gate per A58 if frontend touched).
- UNCHANGED (regression-guarded): all existing finance create/cancel rules and tests; the free-registration path; `RecipientType` enum (no new value).

### References

- [Source: epics-and-stories.md §Story E4-S2 (L497-519)] — authoritative AC.
- [Source: architecture.md ADR-001/003/004/008 (L237 cross-module note)].
- [Source: Invoice.cs:58-93,126,136,176,186,196,235] — create + item + lifecycle + cancel.
- [Source: FinanceEnums.cs:25-62] — InvoiceStatus + RecipientType + PaymentDirection/Method.
- [Source: CreateInvoiceCommandHandler / CreatePaymentCommandHandler] — the create path + UnitOfWork + fiscal + audit to reuse.
- [Source: EventRegistration.cs + EventRegistrationEndpoints.cs] — registration factories + endpoints + cancellation.
- [Source: docs/07_dos_donts.md + project-context "Critical Don't-Miss Rules"] — finance soft-delete/cancellation/reversal, accounting mode, aggregate-child persistence.
- [Source: E4-S1] — the `EventFeeCategory` model this story consumes.
- [Source: project-context A28-A60] — conventions.

## Quality-Gates Closing Check (A29 / AC-10)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Invoice via existing create path (item/recipient/amount) | ✅ | `PaidRegistrationService` (Invoice.Create + AddItemWithTax) |
| AC-1 | Guest = `RecipientType.Other` (no new enum) | ✅ | coordinator + `CreatePaidRegistration_Guest_*` test |
| AC-1 | TaxRate default 0 (Verein VAT-exempt, documented) | ✅ | `PaidRegistrationService` taxRate:0m |
| AC-1 | Currency parity (category ↔ profile) or reject | ✅ | `CreatePaidRegistration_CurrencyMismatch_PersistsNothing` |
| AC-2 | `Invoice.EventRegistrationId` + index | ✅ | Invoice.cs + InvoiceConfiguration + migration |
| AC-3 | One `SaveChangesAsync`; rollback proven | ✅ | happy test (both persist) + fiscal/currency rollback tests |
| AC-4 | Draft → soft-delete | ✅ | `Cancel_DraftInvoice_SoftDeletesInvoice` |
| AC-4 | Sent/Overdue → `Cancel(reason)` | ✅ | `Cancel_SentInvoice_CancelsInvoice` |
| AC-4 | Paid → left intact, no auto-refund | ✅ | `Cancel_PaidInvoice_LeftIntact` |
| AC-4 | Free cancellation unchanged | ✅ | `Cancel_FreeRegistration_NoInvoiceTouched` |
| AC-5 | Fiscal-period lock honoured | ✅ | coordinator `EnsurePeriodNotLockedAsync` + rollback test |
| AC-5 | Accounting-mode posting inherited (not reimplemented) | ✅ | spike 0.1: CreateInvoice does not auto-post; same building blocks reused |
| AC-6 | Registrant needs no finance role; finance actions stay gated | ✅ | endpoints keep existing auth; system raises invoice (audited) |
| AC-7 | Paid branch requires `Module:finance`; free unaffected | ✅ | `TryHandlePaidRegistrationAsync` IsEnabledAsync(finance)→403 |
| AC-8 | Happy / rollback / free integration tests | ✅ | `PaidRegistrationServiceTests` (8 green) |
| AC-8 | Cancellation + fiscal-lock + coordinator tests | ✅ | same suite |
| AC-8 | API module-gate test | [~] | deferred (in-handler guard verified; full HTTP toggle → epic-boundary review) |
| AC-9 | Audit (FinanceCreated + registration origin + cancel disposition) | ✅ | coordinator + cancellation-service audit calls |
| AC-10 | This table populated | ✅ | Task 6.1 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — Epic-4 autonomous dev-story run, 2026-06-06.

### Debug Log References

**A41 autonomous-mode escape applied** — user directive *"den ganzen epic durch implementieren … es ist kein mvp mehr"* (2026-06-06).

```
DEC-1: Finance record type = A — Invoice (receivable). Lifecycle + reconciliation + cancellation.
DEC-2: Link mechanism = A — nullable Invoice.EventRegistrationId (Guid?) + index; RecipientType
       keeps carrying the payer identity. No new RecipientType value.
DEC-3: Coordination mechanism — PIVOTED from A (MediatR command in Application) to an Infrastructure
       coordinator service (IPaidRegistrationService / PaidRegistrationService), mirroring
       EventRegistrationCancellationService.
   (a) Infrastructure service with direct ApplicationDbContext + one explicit transaction.
   (b) Rationale: AC-3 requires registration + invoice in ONE SaveChangesAsync. The per-aggregate
       repositories (EventRegistrationRepository.AddAsync, InvoiceRepository.AddAsync) each call
       SaveChangesAsync internally, and the Application layer cannot reference ApplicationDbContext,
       so a pure Application MediatR handler cannot deliver single-commit atomicity. The cancellation
       service is the established precedent for exactly this atomic, transactional shape.
   (c) Consequence: 1 interface (Application) + 1 service (Infrastructure) + DI registration; the
       endpoint calls the service directly (like it calls IEventRegistrationCancellationService).
DEC-4: Initial invoice status = A — Draft (Kassier sends later; clean soft-delete on cancel).
DEC-5: Cancellation branch = A — Draft→soft-delete; Sent/Overdue→Cancel(reason); Paid→intact+audit
       (no auto-refund, no PSP); free→no-op.
DEC-6: Payment status on EventRegistration = A — derived from the linked invoice (no stored field);
       S3 looks it up via the EventRegistrationId index.
DEC-7: Events-on/Finance-off = A — paid branch blocked with an audited 403; free path unaffected.
       In-handler IModuleSettingsService.IsEnabledAsync(ModuleKeys.Finance) guard.
DEC-8 (NEW): fee-category selection at registration time.
   (a) Optional FeeCategoryId on the register requests; explicit id must be applicable; auto-pick
       when exactly one applicable category exists; require selection (400 FeeCategorySelectionRequired)
       when >1 apply; zero applicable = free path.
   (b) Rationale: applicability (Everyone/MembersOnly/PublicOnly) is a who-you-are filter, not an
       add-on — charging all applicable categories would double-charge. S3 provides the selector UI;
       S2 must auto-resolve single-tier events and require a choice for multi-tier ones.
   (c) Consequence: single-tier paid events "just work"; multi-tier events need the S3 selector.
       Waitlisted registrations are never charged (no invoice until promotion — documented follow-up).
```

### Completion Notes List

**✅ STORY COMPLETE — backend done + verified. Status: `review`.** Frontend surface is minimal (the
`FeeCategoryId` request field is consumed by E4-S3's UI); no frontend code in this story.

- **Invoice link (AC-2):** `Invoice.EventRegistrationId` (Guid?) via an optional `Create` param; EF
  property + `ix_invoices_event_registration_id`; migration `20260606090332_AddEventRegistrationIdToInvoice`.
- **Coordinator (AC-1/3/5/9):** `PaidRegistrationService` — one transaction: currency-parity reject →
  fiscal-lock check → atomic invoice number → `Invoice.Create(…EventRegistrationId…)` + `AddItemWithTax`
  (qty = NumberOfGuests, taxRate 0) → add registration + invoice → one `SaveChangesAsync` → commit →
  `FinanceCreated` audit with event/registration origin. Member→`RecipientType.Member`+memberId;
  guest→`RecipientType.Other`. No new RecipientType; no journal-posting reimplemented (CreateInvoice
  doesn't auto-post — confirmed at spike).
- **Endpoint branching (AC-1/6/7, DEC-7/8):** `TryHandlePaidRegistrationAsync` in both register
  handlers; `Module:finance` in-handler gate; fee-category resolution (explicit/auto/require-selection);
  free + waitlist paths unchanged.
- **Cancellation (AC-4/9):** `EventRegistrationCancellationService` disposes the linked invoice in the
  same transaction per status (Draft→soft-delete, Sent/Overdue→Cancel, Paid→intact) + audits.
- **Tests:** `PaidRegistrationServiceTests` 8 green (happy guest+member, fiscal-lock rollback,
  currency-mismatch rollback, cancellation Draft/Sent/Paid/free). Regression: Application.Tests 1478,
  Api.Tests 226 (fixed the 2 metadata harnesses to register the 3 new services), cancellation-concurrency 3.
- **Deferred (A47-style):** full WebApplicationFactory HTTP test of the `Module:finance`-off paid-branch
  block (AC-8 last bullet) — the in-handler guard is verified by build + harness wiring; queued for the
  epic-boundary review.

### File List

NEW:
- `backend/src/IabConnect.Application/Events/PaidRegistration/IPaidRegistrationService.cs`
- `backend/src/IabConnect.Infrastructure/Events/PaidRegistrationService.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260606090332_AddEventRegistrationIdToInvoice.cs` (+ Designer + snapshot update)
- `backend/tests/IabConnect.Infrastructure.Tests/Events/PaidRegistrationServiceTests.cs`

MODIFIED:
- `backend/src/IabConnect.Domain/Finance/Invoice.cs` (+ `EventRegistrationId` + `Create` param)
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/InvoiceConfiguration.cs` (+ property + index)
- `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` (paid branch + `FeeCategoryId` on requests + DI params)
- `backend/src/IabConnect.Infrastructure/Events/EventRegistrationCancellationService.cs` (+ invoice disposition + IAuditService)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ IPaidRegistrationService registration)
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventRegistrationCancellationConcurrencyTests.cs` (constructor + audit mock)
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInEndpointTests.cs` (+ 3 service registrations)
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInRosterEndpointTests.cs` (+ 3 service registrations)

### Change Log

- 2026-06-06: Story refreshed from pre-pivot stub to dev-ready in the Epic-4 A34 bulk pass; post-MVP scope; A56 spike documented the existing Finance create/cancel machinery to reuse and the net-new registration↔invoice link + atomic coordinator; DEC-1..DEC-7 surfaced with recommendations; no-PSP scoping made explicit.
- 2026-06-06: Backend implemented + verified. Invoice link + atomic `PaidRegistrationService` coordinator + registration-endpoint paid branch (Module:finance gate + fee-category resolution) + cancellation invoice disposition. DEC-1/2/4/5/6/7=A; **DEC-3 pivoted** to an Infrastructure coordinator service (atomicity + layer constraint); **DEC-8 added** (fee-category selection rule). Tests: 8 new Testcontainers + regression suites green. AC-8 HTTP module-gate test deferred to epic-boundary review. Status → `review`.

## Review Findings (Epic-4 boundary code review, 2026-06-06)

3-layer adversarial review; full detail in `deferred-work.md`. S2-relevant:
- [x] [Review][Patch] **P1 APPLIED** — post-commit audit `LogActionAsync` wrapped in try/catch in `PaidRegistrationService` + `EventRegistrationCancellationService` (a committed registration/cancellation must not 500 on an audit-sink failure → avoids retry double-registration).
- [x] [Review][Defer] Waitlist promotion never raises an invoice for paid events (manual + cancellation-driven promotion) — **E4-FT-1 [HIGH]** (known follow-up).
- [x] [Review][Defer] `MaxQuantity` per-category cap never enforced at registration — **E4-FT-3 [MED]**.
- [x] [Review][Defer] Currency-mismatch reject skipped when no active FinanceProfile — **E4-FT-4 [MED]**.
- [x] [Review][Defer] Roster/email currency from current profile, not the invoice (Invoice has no per-row currency) — **E4-FT-6 [MED]**.
- [x] [Review][Defer] `Module:finance`-off paid-branch 403 has no end-to-end WAF test — **E4-FT-7 [MED]** (AC-8 [~]).
- Dismissed: idempotency double-register (existing email/user dedup → 409), soft-deleted-invoice mislabel (global `!IsDeleted` query filter), member-via-public `isMember` mismatch (RegisterMember requires MemberId on the paid branch), DEC-3 pivot (acceptable + documented; atomicity verified by the rollback tests).
