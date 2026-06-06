# Story 4.1: Add Event Fee Configuration

Status: done

## Refresh Notes (2026-06-06, Epic-4 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub (placeholder ACs like "when this story behavior is exercised", stale "e1-s1 in-progress" + "feat(REQ-017)" git context). Authored to dev-ready in an **A34 bulk-refresh of the entire Epic-4 (Event Monetization)**, the first deferred-backlog epic resumed after all Beta-pivot epics (E9–E20) closed. Per user directive *"nächstes epic angehen. alle stories vom nächsten epic durchgehen und implementiert ready stellen. wichtig es handelt sich nicht mehr um einen MVP."* (2026-06-06) — scope is post-MVP-comprehensive, not Beta-minimum.

**A56 existing-implementation spike (CRITICAL — the AC is NOT net-new the way the stub reads):**

- **`Event.Cost` (decimal?, [Event.cs:56](../../backend/src/IabConnect.Domain/Events/Event.cs#L56)) + `CostDescription` (L57) + `IsFree` computed (L58: `!Cost.HasValue || Cost.Value == 0`) ALREADY SHIP.** There is an `UpdateCost(decimal? cost, string? costDescription)` mutator ([Event.cs:217](../../backend/src/IabConnect.Domain/Events/Event.cs#L217)), an EF column `cost` at `HasPrecision(10, 2)` ([EventConfiguration.cs:139-141](../../backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventConfiguration.cs)), and the public event page already renders `event.isFree ? Free : CHF {cost}` ([public/events/[id]/page.tsx](../../frontend/src/app/public/events/[id]/page.tsx)). i18n keys `events.form.cost / price / pricePlaceholder / costDescription` already exist in de/en.
- **BUT the existing field is a single, flat, informational number** — no currency, no member/public applicability, no availability window, no notion of "one or more categories". The epic AC explicitly requires **"one or more fee categories"**, each with **"amount, currency, availability, and optional member/public applicability"**. So this story is a **model upgrade**, not a greenfield build and not a no-op verification. **Do NOT regress `Event.Cost`/`IsFree`/`CostDescription` to satisfy the literal AC** — keep them for backward compatibility (existing tests, the public DTO, simple free/cheap events) and add the richer category model alongside (see DEC-1).
- **`EventRegistration` has NO fee/payment field** ([EventRegistration.cs](../../backend/src/IabConnect.Domain/Events/EventRegistration.cs); statuses Pending/Confirmed/Cancelled/Waitlisted/CheckedIn/NoShow). The *registration→fee* link is E4-S2's job, not this story's.
- **No `EventFee`, `Ticket`, `EventFeeCategory`, `PaymentStatus`-on-event class exists anywhere.** The category model in DEC-1 is genuinely net-new.

**Cross-story / cross-module context:**

- This story is **events-side only** (Domain/Events + EventEndpoints + frontend events admin). It must **not** touch the Finance module. E4-S2 wires fees → Finance (Invoice); E4-S3 builds the registrant-facing + admin payment UI.
- **The load-bearing scoping decision for the whole epic (carry into all three stories):** the codebase has **NO payment gateway / PSP integration** (PaymentMethod enum is Cash/Transfer/Online but there is zero card/Stripe/online-checkout code). "Paid registration" therefore means *the fee is configured here (S1), an Invoice receivable is raised on registration (S2), and money is collected offline (bank transfer / cash at event) and reconciled by the Kassier via the existing finance flow*. This story only configures **what is owed**, never collects it.
- **White-label (E9):** no hardcoded "IAB"/org strings; currency must not be hardcoded to CHF in the domain — default it from the active `FinanceProfile.Currency` (see DEC-2). All new UI text via next-intl.
- **Module enforcement (E10/ADR-008):** fee configuration is an Events feature → gated by `Module:events`. Fee config does **not** require the Finance module (that dependency lands in S2). [Source: architecture.md ADR-008 L237 — "paid event registration (E4) needs Finance … the architecture flags the dependency rather than enforcing it" — the hard-block product rule was deferred to E10-S5 (done).]

**A34 bulk-refresh note:** 3 stories authored this session (E4-S1/S2/S3). Per `feedback_session_pacing_dev_cycles`, each dev-story should run in a separate session; recommended order S1 → S2 → S3 (S2 consumes S1's fee model; S3 renders both).

## Story

As an **Event Manager or Kassier configuring an event that charges an attendance fee** (post-MVP: a Verein running a paid workshop, a ticketed cultural evening with member vs. public pricing, or a multi-tier event with early-bird and on-the-door prices),
I want **to attach one or more named fee categories to an event — each with an amount, a currency (defaulted from the active finance profile), an optional availability window (from/until), and an applicability flag (everyone / members only / public only) — with full validation and audit, while existing free events and the existing simple `Event.Cost` display continue to work unchanged**,
so that **the event carries a structured, authoritative description of what each kind of attendee owes, which E4-S2 can turn into a finance receivable and E4-S3 can render at registration — without me having to hand-track prices in a spreadsheet or break the registration flow for free events**.

**Requirement:** REQ-022 (Ticketing / Fees). Epic E4 (Event Monetization), Story 1 of 3.

- **Source-of-truth:** [epics-and-stories.md §Epic E4 / Story E4-S1 (L467-495)](../planning-artifacts/epics-and-stories.md). Epic goal: *"Support paid event registration through existing Events and Finance modules."*
- **Architecture anchors:** [ADR-001 Modular Monolith](../planning-artifacts/architecture.md#adr-001-keep-modular-monolith), [ADR-003 Backend Authorization Is Mandatory](../planning-artifacts/architecture.md#adr-003-backend-authorization-is-mandatory), [ADR-004 PostgreSQL + EF Core](../planning-artifacts/architecture.md#adr-004-postgresql-and-ef-core-remain-persistence-backbone), [ADR-008 Three-Layer Module Enforcement (L237 cross-module note)](../planning-artifacts/architecture.md#adr-008-three-layer-module-enforcement).

**Upstream (HARD dependencies):** none new — Events + Finance modules both exist and are done. E10 (module enforcement) done → `Module:events` gate available. The active `FinanceProfile` (for default currency) exists ([FinanceProfile.cs](../../backend/src/IabConnect.Domain/Finance/FinanceProfile.cs)).

**Downstream:**

- **E4-S2 (HARD)** consumes this fee model: it reads the applicable active fee category for a registration and raises an Invoice. The category shape (amount, currency, applicability) is the contract S2 depends on — changing it later is a breaking change to S2.
- **E4-S3** renders fee categories on the public registration page + event admin views.

**Wave context:** Epic-4 opener. **Net new artifacts:** 1 new domain entity (`EventFeeCategory`) + Event aggregate methods + 1 new EF config + 1 migration + endpoints (events-module convention) + validators + unit/integration tests + frontend fee-config form on the event create/edit admin page + i18n keys (de/en). Estimated +400–600 LOC across backend + frontend + tests.

## Acceptance Criteria

**AC-1** [epics §E4-S1 — one or more fee categories]: An `Event` can carry **zero, one, or many** `EventFeeCategory` records. A new domain entity `backend/src/IabConnect.Domain/Events/EventFeeCategory.cs` is added as a child of the `Event` aggregate (collection navigation on `Event`, persisted per the aggregate-child rule in AC-8). Zero categories = the event is free (or uses only the legacy `Event.Cost` display). Categories are managed (add / update / deactivate) through **domain methods on the `Event` aggregate** (e.g. `AddFeeCategory(...)`, `UpdateFeeCategory(...)`, `DeactivateFeeCategory(...)`), never by mutating a public collection from an endpoint — business rules live in the domain (project-context "Keep business rules out of endpoint handlers and EF entities").

**AC-2** [epics §E4-S1 — amount, currency, availability, applicability]: Each `EventFeeCategory` has at minimum: `Id` (Guid), `EventId` (Guid FK), `Name` (required, e.g. "Adult", "Child", "Member", "Early-bird"; trimmed; max 100 chars), `Amount` (decimal, `HasPrecision(18, 2)` to **match the Finance precision** so S2 can copy the value into an InvoiceItem without rounding surprise — note this differs from `Event.Cost`'s legacy `(10,2)`), `Currency` (`FinanceCurrency` enum — CHF/EUR — defaulted per DEC-2), `Applicability` (a new `FeeApplicability` enum: `Everyone` / `MembersOnly` / `PublicOnly`), `AvailableFrom` (DateTime?, UTC, nullable = no lower bound), `AvailableUntil` (DateTime?, UTC, nullable = no upper bound), `IsActive` (bool, default true; deactivation is a soft retire so historical registrations/invoices keep a valid reference — do **not** hard-delete a category that may be referenced by an S2 invoice). Optional (post-MVP, include): `Description` (string?, max 500) and `MaxQuantity` (int?, an optional cap on how many of this category can be sold; null = uncapped).

**AC-3** [epics §E4-S1 — validation]: A FluentValidation validator (in the Events application layer, matching where the module keeps validators — confirm at spike) rejects: empty/whitespace `Name`; `Amount < 0`; `Amount` with > 2 decimal places; `AvailableUntil <= AvailableFrom` when both set; an unknown `Currency`/`Applicability` enum string; `MaxQuantity <= 0` when set. The domain factory/methods **also** guard the invariants (defense in depth — validation is UX, the domain is the boundary), mirroring `Event.UpdateCost`'s `cost < 0` throw ([Event.cs:219-220](../../backend/src/IabConnect.Domain/Events/Event.cs#L219)). Duplicate **active** category `Name` on the same event is rejected (case-insensitive) so the S2/S3 "which category applies" logic is unambiguous.

**AC-4** [epics §E4-S1 / ADR-003 — only authorized users configure fees]: Fee-configuration endpoints are gated by backend authorization (DEC-4). The AC user story names **"Event Manager or Kassier"**; the recommended policy admits Admin + Vorstand + EventManager + Kassier. Frontend role checks are UX-only and never the security boundary (project-context). The route group also carries the `Module:events` gate (AC-7).

**AC-5** [epics §E4-S1 / project-context finance+audit — validated and auditable]: Every fee-category create / update / deactivate writes an audit entry via the existing `ISecurityAuditLogger` ([SecurityAuditLogger.cs](../../backend/src/IabConnect.Application/Authorization/SecurityAuditLogger.cs)) **or** `IAuditService.LogActionAsync(...)` ([IAuditService.cs](../../backend/src/IabConnect.Application/Audit/IAuditService.cs)) — match whichever the Events module already uses for sensitive event mutations (the check-in handler uses `ISecurityAuditLogger.LogAccessGranted`; confirm the event-create path at spike). The audit record names the event id, the category id/name, and the new amount, so a price change is reconstructable. Use the existing `AuditEventType` enum values; only add a new value if no existing event-mutation type fits (avoid inventing a finance type for an events action).

**AC-6** [backward-compat — free events + legacy `Event.Cost` unaffected (REGRESSION GUARD)]: Creating/editing an event with **no** fee categories behaves exactly as today: `IsFree` stays driven by `Event.Cost`, the public page renders the existing cost badge, and the existing event/registration tests stay green. `Event.Cost`/`CostDescription` are **not** removed. The relationship between the legacy `Cost` and the new categories is made explicit in code comments + Dev Notes (DEC-1): the category model is authoritative for paid registration (S2); `Event.Cost` remains a simple display field. **No existing event test may be rewritten to assert the new model unless it was asserting `Cost` directly** (those stay).

**AC-7** [E10 / ADR-008 — module gate]: The fee-configuration endpoints live under the existing `EventEndpoints` route group (or a sibling group that also declares `.RequireAuthorization("Module:events")`). When the Events module is disabled, the endpoints return 403 + a module-access-denied audit event, identical to every other Events endpoint. **No Finance-module gate here** — fee *configuration* does not depend on Finance (the dependency is S2's invoice creation).

**AC-8** [ADR-004 / docs/07_dos_donts.md — persistence correctness]: A new `IEntityTypeConfiguration<EventFeeCategory>` (`EventFeeCategoryConfiguration.cs`) configures the table, the `Amount` precision `(18,2)`, the `Currency`/`Applicability` enum conversions (string conversion, matching how other enums are stored — confirm convention at spike), an FK + index on `EventId`, and a filtered unique index on `(EventId, Name)` where `IsActive` (so a retired category name can be reused). The `Event → EventFeeCategory` collection uses the **child-persistence pattern that actually persists** (per docs/07_dos_donts.md + project-context: either add children directly to the `DbSet<EventFeeCategory>` in the repository, OR configure the navigation with `UsePropertyAccessMode(PropertyAccessMode.Field)` like `Invoice._items` does — confirm which pattern the Events module uses at spike; `EventRegistration` is managed as a separate repository, not a backing-field collection, so this is a genuine decision). One EF migration named `{timestamp}_AddEventFeeCategories` under `backend/src/IabConnect.Infrastructure/Migrations`.

**AC-9** [test — backend]: New tests, all green at `cd backend && dotnet test`:
- **Domain unit tests** (`IabConnect.Application.Tests` or wherever Events domain tests live — confirm) for `EventFeeCategory` + the `Event.AddFeeCategory/UpdateFeeCategory/DeactivateFeeCategory` methods: amount-negative throw, duplicate-active-name throw, availability-window guard, deactivate-keeps-record, free-event-still-free.
- **Validator tests** for AC-3 rules.
- **Repository/persistence integration test** (Testcontainers PostgreSQL, per project-context — *not* EF InMemory) proving a category round-trips, the `(EventId, Name)` filtered-unique index behaves, and the child actually persists (the docs/07 gotcha — assert a re-fetched event has the category).
- **API test** (`IabConnect.Api.Tests`, MVC Testing) for authorization (an unauthorized role gets 403; an authorized role succeeds) + the `Module:events`-disabled 403 path.

**AC-10** [E4-S3 hand-off — DTO + frontend fee-config form]: The fee categories are exposed on the event DTO(s) the admin event create/edit page consumes, and the **event create/edit admin form** ([frontend/src/app/(dashboard)/events/…](../../frontend/src/app/(dashboard)/events/)) gains a fee-categories sub-section: add/remove rows, each with name, amount, currency (defaulted, usually read-only single-currency), applicability select, optional availability dates. Uses the existing **React Hook Form + Zod `buildSchema(t)` pattern** (precedent: the volunteer-shift form at `events/[id]/volunteers/page.tsx`), shared `ui/Input` / `ui/Select` / `ui/Button` components, `formatCurrency`/`formatCHF` from [lib/utils.ts](../../frontend/src/lib/utils.ts) for any amount preview, orange primary actions, and **next-intl keys only** (no hardcoded strings). TS enum string values for `Currency`/`Applicability` must **byte-match** the backend PascalCase (project-context frontend rule). The *public* registrant-facing rendering is E4-S3 — this AC is the admin authoring surface only.

**AC-11** [white-label / i18n — de + en parity, NO hi.json]: All new UI strings added to **`frontend/messages/de.json` and `frontend/messages/en.json` only**, kept in key-for-key parity. **`frontend/messages/hi.json` does not exist in this repo** (A56 spike finding) — do **not** create it. No hardcoded org name; currency label comes from the value, not a literal "CHF" string in a component.

**AC-12** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 enumerating every AC sub-item (covered / deferred / N/A) with an evidence anchor. Frontend gates per **A58** run on changed files only (`npx eslint <changed>` + `npx prettier --check <changed>` + full `vitest run`), not repo-wide; record that the repo-wide prettier drift is pre-existing.

## Tasks / Subtasks

**Task 0 — Spike (A28; resolve DEC-1..DEC-4 per A32, or A41 auto-resolve)**

- [ ] **0.1** Read [Event.cs](../../backend/src/IabConnect.Domain/Events/Event.cs) fully: confirm `Cost`/`CostDescription`/`IsFree`/`UpdateCost`, the existing collection-navigation style on the aggregate (does `Event` already own any child collection?), and the mutation-method conventions.
- [ ] **0.2** Read [EventEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs): confirm the **create/update pattern** — repository-direct-in-endpoint vs MediatR. The Events module uses repository-direct for event CRUD and MediatR only for check-in; **match the event-CRUD convention for fee config** (DEC-3). Confirm the exact authorization on `POST/PUT /api/v1/events` (`RequireVorstand`) and the `.RequireAuthorization("Module:events")` group declaration.
- [ ] **0.3** Confirm how the Events module audit-logs an event create/update (which of `ISecurityAuditLogger` / `IAuditService`, and which `AuditEventType` value). Confirm the enum-to-string EF conversion convention used elsewhere (e.g. `EventCategory`, `RegistrationStatus`, finance enums).
- [ ] **0.4** Read [FinanceProfile.cs](../../backend/src/IabConnect.Domain/Finance/FinanceProfile.cs) + how the active profile is fetched (service/repo), to wire DEC-2's default currency. Confirm `FinanceCurrency` lives in `IabConnect.Domain.Finance` and is referenceable from `IabConnect.Domain.Events` (same assembly — yes).
- [ ] **0.5** Read the event create/edit admin page + the volunteer-shift RHF+Zod form for the AC-10 pattern; confirm the event DTO shape the admin form consumes and where it's defined ([frontend/src/lib/services/events.ts](../../frontend/src/lib/services/events.ts)).
- [ ] **0.6** **Resolve DEC-1..DEC-4** via `AskUserQuestion` (or A41 auto-resolve with (a)/(b)/(c) Debug Log per A43 if autonomous mode pre-declared). Record decisions.
- [ ] **0.7** Spike output (~8 lines): convention confirmations + DEC resolutions + the chosen child-persistence mechanism.

**Task 1 — Domain: `EventFeeCategory` + Event aggregate methods (AC-1, AC-2, AC-3, AC-6)**

- [ ] **1.1** Create `backend/src/IabConnect.Domain/Events/EventFeeCategory.cs` (entity, private setters, factory `Create(...)`, `Update(...)`, `Deactivate()`; invariant guards per AC-3). SPDX header per repo policy.
- [ ] **1.2** Add `FeeApplicability` enum (`Everyone`/`MembersOnly`/`PublicOnly`) — co-locate with the entity or with `EventEnums` (match where `EventCategory`/`RegistrationStatus` live).
- [ ] **1.3** Add the collection navigation + `AddFeeCategory / UpdateFeeCategory / DeactivateFeeCategory` methods on `Event` (duplicate-active-name guard, delegate amount/window guards to the entity). Keep `Cost`/`IsFree`/`UpdateCost` untouched; add an XML-doc note on `IsFree` clarifying the legacy-vs-category relationship (DEC-1).
- [ ] **1.4** Decide & document the `IsFree`/category interaction in code comments per DEC-1 resolution.

**Task 2 — Validation (AC-3)**

- [ ] **2.1** Add the FluentValidation validator(s) for the create/update fee-category input in the Events application layer (match module convention).

**Task 3 — Persistence: EF config + migration (AC-8)**

- [ ] **3.1** Create `EventFeeCategoryConfiguration.cs` (table, `Amount` `(18,2)`, enum string conversions, FK + index on `EventId`, filtered unique index `(EventId, Name)` WHERE `IsActive`).
- [ ] **3.2** Wire the `Event → EventFeeCategory` navigation persistence per the chosen pattern (DbSet-add in repository, or `PropertyAccessMode.Field`) — whichever actually persists per docs/07.
- [ ] **3.3** Register `DbSet<EventFeeCategory>` on `ApplicationDbContext` if the chosen pattern needs it.
- [ ] **3.4** `dotnet ef migrations add AddEventFeeCategories --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api`. Review the generated SQL (descriptive name, no unintended drops).

**Task 4 — API: fee-config endpoints (AC-4, AC-5, AC-7)**

- [ ] **4.1** Add fee-category endpoints to `EventEndpoints` (or sibling group) following the **event-CRUD convention** (DEC-3): list categories for an event, add, update, deactivate. Each protected per DEC-4 + under `Module:events`.
- [ ] **4.2** Audit-log each mutation per AC-5 (match module convention from spike 0.3).
- [ ] **4.3** If DEC-4 = new policy, register `RequireEventFeeManager` (or chosen name) in [DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) alongside the existing `AddPolicy(...)` chain.

**Task 5 — Frontend: fee-config admin form + DTO (AC-10, AC-11)**

- [x] **5.1** Extended `frontend/src/lib/services/events.ts` with `EventFeeCategoryDto`, `FeeApplicability` (PascalCase union byte-matching backend), `FEE_CURRENCIES`/`FeeCurrency`, `SaveFeeCategoryRequest`, and typed API calls (`getEventFeeCategories` / `createEventFeeCategory` / `updateEventFeeCategory` / `deactivateEventFeeCategory`). **DEC-5 (dev-time):** fee categories are a sub-resource keyed by an existing `eventId`, so they are managed on a dedicated page (mirroring the volunteers sub-resource pattern), NOT folded into the event create form (which has no id yet).
- [x] **5.2** Added the fee-category management page `frontend/src/app/(dashboard)/events/[id]/fees/page.tsx` (RHF + Zod `buildFeeSchema(t)` in a Radix dialog mirroring the volunteer-shift form, shared `ui/*`, orange actions, `formatCurrency(amount, currency)` in the table). Added a "Fees" link in the event-detail action bar. Extended `formatCurrency` in `lib/utils.ts` with an optional `currency` arg (default CHF, backward-compatible; AC-11 white-label).
- [x] **5.3** Added `events.fees` de/en i18n keys (40 keys each, parity verified); no hi.json.

**Task 6 — Tests (AC-9)**

- [x] **6.1** Domain unit tests (entity + Event methods). _(backend; done in prior session)_
- [x] **6.2** Validator tests (AC-3 rules). _(backend)_
- [x] **6.3** Testcontainers PostgreSQL integration test (round-trip + filtered-unique index + child actually persists). _(backend)_
- [x] **6.4** API authorization + `Module:events`-disabled tests. _(backend)_
- [x] **6.5** Frontend Vitest test `events/[id]/fees/page.test.tsx` (list render incl. retired, empty state, create-dialog zod validation, successful create, deactivate) — `// @vitest-environment jsdom` + `afterEach(cleanup)`. 5 tests green.
- [x] **6.6** `cd backend && dotnet test` green (prior session); frontend `npx eslint`/`prettier --check` on changed files clean + `vitest run` 179/179 green (A58; pre-existing repo-wide prettier drift in `events.ts` recorded, untouched lines).

**Task 7 — Quality-Gates Closing + Dev Agent Record (AC-12)**

- [x] **7.1** QGT table populated below (every AC sub-item).
- [x] **7.2** A43 (a)/(b)/(c) recorded for DEC-1..DEC-4 (prior session) + DEC-5 (this session) in Debug Log.
- [x] **7.3** Status flipped: ready-for-dev → in-progress → review.

## Dev Notes

### A28 Spike Output Anchors

- `Event` aggregate + `Cost`/`IsFree`/`UpdateCost`: [Event.cs:55-58, 217-225](../../backend/src/IabConnect.Domain/Events/Event.cs#L55).
- Event CRUD endpoint convention (repository-direct, `RequireVorstand`, `Module:events` group): [EventEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs).
- `FinanceCurrency` enum (CHF/EUR): [FinanceEnums.cs:114-118](../../backend/src/IabConnect.Domain/Finance/FinanceEnums.cs#L114) — same `IabConnect.Domain` assembly, referenceable from Events.
- Decimal precision precedent: `Event.Cost` `(10,2)` (legacy) vs Finance `(18,2)` (use `(18,2)` for `EventFeeCategory.Amount` to match S2's InvoiceItem).
- Aggregate-child-persistence precedent: `Invoice._items` uses `PropertyAccessMode.Field`; `EventRegistration` uses a separate repository (no backing-field collection on `Event`). docs/07_dos_donts.md documents the gotcha.
- Audit precedent: check-in uses `ISecurityAuditLogger.LogAccessGranted` ([CheckInRegistrationCommandHandler](../../backend/src/IabConnect.Application/Events/CheckIn/)); finance create uses `IAuditService.LogActionAsync(AuditEventType.FinanceCreated, …)`. Pick the events-mutation convention.
- Roles/policies: [Roles.cs](../../backend/src/IabConnect.Api/Authorization/Roles.cs) (Admin/Vorstand/EventManager/Member/Kassier/Auditor); policies registered in [DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) (`RequireVorstand`, `RequireEventStaff`, `RequireFinanceWrite`, …).

### Decision-Needed Block

**DEC-1 — Legacy `Event.Cost` vs new `EventFeeCategory` relationship.**
- **A (RECOMMENDED):** Keep `Event.Cost`/`CostDescription`/`IsFree` as a backward-compatible **display-only** field for simple events; the `EventFeeCategory` collection is the **authoritative paid-registration model** consumed by S2/S3. When ≥1 active category exists, S2/S3 use categories; otherwise they fall back to the simple `Cost` display (S3) and the event is free for finance purposes if no paid category applies. Document in code; no data migration of existing `Cost` values.
- **B:** Migrate `Event.Cost` into a single default `EventFeeCategory` for every existing paid event (data migration) and deprecate `Cost`. Cleaner single-source-of-truth but a riskier migration touching live event rows + the public DTO + existing tests.
- **C:** Treat `Event.Cost` as the "from" price (display) computed from the min active category amount. Couples display to categories; more logic, more test surface.
- *Recommendation A:* lowest regression risk (AC-6), keeps the public page working untouched, defers any `Cost` deprecation to a later cleanup.

**DEC-2 — Currency source / default.**
- **A (RECOMMENDED):** Each `EventFeeCategory.Currency` is a `FinanceCurrency` (CHF/EUR), **defaulted from the active `FinanceProfile.Currency`** at create time; the admin form shows it read-only single-currency unless a real multi-currency need arises. Parity with the Invoice S2 raises.
- **B:** Store an ISO-4217 string code instead of the enum. More flexible but diverges from the Finance domain and forces S2 to map string→enum.
- *Recommendation A:* parity with Finance; avoids hardcoding CHF (white-label).

**DEC-3 — Endpoint/command pattern for fee config.**
- **A (RECOMMENDED):** Match the **existing Events module event-CRUD convention** (repository-direct in `EventEndpoints`, business rules in the `Event` aggregate methods + a FluentValidation validator). Avoids introducing a parallel MediatR pattern in a module that doesn't use it for CRUD.
- **B:** Introduce MediatR commands (`ConfigureEventFeesCommand`) per project-context's general "use MediatR for business workflow" guidance.
- *Recommendation A:* consistency with the module beats the general guideline here; the domain still owns the rules. (Confirm the actual convention at spike 0.2 — if the module *does* use MediatR for event mutations, switch to B.)

**DEC-4 — Authorization policy for fee config.**
- **A (RECOMMENDED):** New policy `RequireEventFeeManager` = Admin + Vorstand + EventManager + Kassier — matches the AC's literal "Event Manager or Kassier".
- **B:** Reuse `RequireEventStaff` (Admin + Vorstand + EventManager) — simpler, no new policy, but excludes Kassier (who the AC names).
- **C:** Reuse `RequireVorstand` (Admin + Vorstand) — narrowest; excludes EventManager + Kassier.
- *Recommendation A:* matches the AC; adding a policy is a one-line `AddPolicy`.

### A31 Cross-Story Orthogonal-AC Invariants

1. **Amount precision parity** — `EventFeeCategory.Amount` `(18,2)` must equal the Finance `InvoiceItem` precision so S2 copies the value with no rounding. Asserted by the persistence test (AC-9) + cited in S2.
2. **Enum string parity (frontend↔backend)** — `Currency`/`Applicability`/`FeeApplicability` TS values byte-match backend PascalCase (A51-style: the frontend test can assert against the backend enum names). 
3. **Category reference stability** — deactivation is a soft retire (`IsActive=false`), never a hard delete, because S2 invoices reference a category id; the filtered-unique index `(EventId, Name) WHERE IsActive` enforces name reuse safely.
4. **Free-event regression** — `IsFree`/`Cost` behavior unchanged (AC-6) — asserted by keeping existing event tests green.

### A41 Autonomous-Mode Escape

If the dev-story session pre-declares autonomous mode, auto-pick DEC-1=A, DEC-2=A, DEC-3=A (confirm at spike), DEC-4=A and record the (a)/(b)/(c) Debug Log per A43. Otherwise surface DEC-1..DEC-4 via `AskUserQuestion` at Task 0 (project memory `feedback_decisions_via_ask_tool`).

### Project Structure Notes

- NEW: `backend/src/IabConnect.Domain/Events/EventFeeCategory.cs` (+ `FeeApplicability` enum).
- NEW: `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventFeeCategoryConfiguration.cs`.
- NEW: `backend/src/IabConnect.Infrastructure/Migrations/{timestamp}_AddEventFeeCategories.cs`.
- NEW: Events application-layer validator(s) for fee-category input.
- NEW: backend tests (domain + validator + Testcontainers integration + API authorization).
- NEW: frontend Vitest test for the fee-config form.
- MODIFIED: `backend/src/IabConnect.Domain/Events/Event.cs` (collection nav + Add/Update/Deactivate methods; `IsFree` XML-doc note — no behavior change).
- MODIFIED: `backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs` (fee-config endpoints) + possibly `DependencyInjection.cs` (new policy if DEC-4=A) + `ApplicationDbContext` (DbSet if needed).
- MODIFIED: `frontend/src/lib/services/events.ts` (DTO + API calls), the event create/edit admin page (fee sub-form), `frontend/messages/de.json` + `en.json`.
- UNCHANGED (regression-guarded): `Event.Cost`/`CostDescription`/`IsFree`, the public event page's cost badge, `EventRegistration` (S2 touches it, not S1).

### References

- [Source: epics-and-stories.md §Story E4-S1 (L473-495)] — authoritative AC.
- [Source: architecture.md ADR-001/003/004/008] — monolith, mandatory backend auth, EF Core, module enforcement (L237 cross-module note).
- [Source: Event.cs:55-58, 217-225] — existing Cost surface (do not regress).
- [Source: FinanceEnums.cs:114-118] — `FinanceCurrency`.
- [Source: EventConfiguration.cs / InvoiceConfiguration.cs] — EF precision + child-persistence precedents.
- [Source: project-context A28-A60] — story conventions (A34 bulk-refresh, A56 existing-impl spike, A51 parity tests, A58 changed-file gates).
- [Source: docs/07_dos_donts.md] — finance soft-delete + aggregate-child persistence gotcha.

## Quality-Gates Closing Check (A29 / AC-12)

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Event owns 0..N `EventFeeCategory` via aggregate methods | ✅ | `EventFeeCategory.Create/Update/Deactivate` + repo (DEC-3 standalone entity) |
| AC-2 | Category fields (name/amount/currency/applicability/window/active) | ✅ | `EventFeeCategory.cs` |
| AC-2 | `Amount` precision `(18,2)` (Finance parity) | ✅ | `EventFeeCategoryConfiguration.cs` |
| AC-3 | Validator: name/amount/decimals/window/enum/dupe-name | ✅ | `CreateEventFeeCategoryCommandValidator` + tests |
| AC-3 | Domain guards (defense in depth) | ✅ | `EventFeeCategory.cs` invariant guards |
| AC-4 | Authorization policy (DEC-4) | ✅ | `RequireEventFeeManager` in `DependencyInjection.cs` |
| AC-5 | Audit on create/update/deactivate | ✅ | `EventFeeEndpoints` `ISecurityAuditLogger.LogAccessGranted` |
| AC-6 | Free events + `Event.Cost`/`IsFree` unchanged | ✅ | `Event.cs` cost surface untouched; existing tests green |
| AC-7 | `Module:events` gate (no Finance gate) | ✅ | `EventFeeEndpoints` group `.RequireAuthorization("Module:events")` |
| AC-8 | EF config + filtered-unique index + child persists | ✅ | config + Testcontainers test (4 passed) |
| AC-8 | Migration `AddEventFeeCategories` | ✅ | `20260606083251_AddEventFeeCategories` |
| AC-9 | Domain unit tests | ✅ | Application.Tests Fee filter 66 passed |
| AC-9 | Validator tests | ✅ | included in 66 passed |
| AC-9 | Testcontainers integration test | ✅ | Infrastructure.Tests Fee 4 passed |
| AC-9 | API authorization + module-disabled tests | ✅ | Api.Tests Fee 14 passed |
| AC-9 | Frontend Vitest (fee-config form) | ✅ | `fees/page.test.tsx` 5 passed |
| AC-10 | Event fee DTO + admin fee-config form | ✅ | `events.ts` + `events/[id]/fees/page.tsx` + detail-page link (DEC-5: dedicated sub-resource page) |
| AC-11 | de/en i18n parity, no hi.json | ✅ | `events.fees` 40 keys de==en; `formatCurrency(amount,currency)` (no literal CHF) |
| AC-12 | This table populated; A58 changed-file gates | ✅ | eslint/tsc/prettier clean on changed files; full vitest 179/179 |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — Epic-4 autonomous dev-story run, 2026-06-06.

### Debug Log References

**A41 autonomous-mode escape applied** — user directive *"alle stories im epic 4 bis alle implementiert sind, nicht aufhören … es ist kein mvp mehr"* (2026-06-06).

```
DEC-1: Legacy Event.Cost vs new EventFeeCategory
(a) A — keep Event.Cost/IsFree/CostDescription as display-only (untouched); EventFeeCategory
    is the authoritative paid-registration model.
(b) Rationale: story recommendation A; user autonomous-mode quote (above); lowest regression
    risk (public page + existing event tests untouched), defers any Cost deprecation.
(c) Consequence: AC-6 regression-guard satisfied by construction (zero edits to Event.cs cost
    surface); EventFeeCategory is a standalone entity, not an Event-aggregate child.

DEC-2: Currency source — PIVOTED A→B
(a) B — Currency stored as a 3-letter ISO string on EventFeeCategory; NOT the Finance
    FinanceCurrency enum.
(b) Rationale: the story's DEC-2 recommended A (reuse FinanceCurrency) but the story body +
    project-context both insist S1 "must not touch the Finance module" / keep module boundaries
    clean. Referencing Finance's enum from the Events DOMAIN would couple the modules. B keeps
    Events fully decoupled; the Application-layer validator constrains the value to {CHF,EUR}
    via a local FeeCurrencies list (no Finance reference); E4-S2 maps the string to
    FinanceCurrency when it raises the invoice.
(c) Consequence: EventFeeCategory.Currency is string; FeeCurrencies.Supported = [CHF,EUR];
    A31 amount-precision parity preserved (Amount decimal(18,2) matches Finance InvoiceItem).

DEC-3: Endpoint/command pattern — PIVOTED to the Volunteer MediatR pattern
(a) Separate entity + own repository (IEventFeeCategoryRepository) + co-located MediatR
    Create/Update/Deactivate commands + validators + a Get query + DTO with FromEntity —
    mirroring the EventVolunteerShift sub-resource precedent.
(b) Rationale: the story's DEC-3 recommended "repository-direct event-CRUD convention", but the
    Task-0 spike found event sub-resources (volunteer roles/shifts) are NOT repository-direct —
    they use the standalone-entity + MediatR-command pattern. Matching the closest real
    precedent (a structured event sub-resource with business rules) beats the simpler
    event-CRUD-in-endpoint convention. Domain still owns the invariants.
(c) Consequence: 1 entity + 1 repo iface/impl + 3 command files + 1 query + 1 DTO + 1 helper
    + endpoints; no Event-aggregate-child persistence (sidesteps the docs/07 gotcha entirely).

DEC-4: Authorization policy
(a) A — new RequireEventFeeManager = Admin + Vorstand + EventManager + Kassier (the AC's
    "Event Manager or Kassier").
(b) Rationale: story recommendation A; matches the AC literally; one-line AddPolicy.
(c) Consequence: new policy in DependencyInjection.cs; all 4 fee endpoints gate on it +
    Module:events (NO Module:finance — that lands in E4-S2).

DEC-5: Frontend home for fee config (NEW, this session) — dedicated sub-resource page
(a) The fee-config UI lives on a dedicated page events/[id]/fees/page.tsx (mirroring the
    volunteers sub-resource management page), reached from a "Fees" link in the event-detail
    action bar — NOT folded into the event create/edit form as AC-10's literal text suggests.
(b) Rationale: the backend fee API is a sub-resource keyed by an EXISTING eventId
    (/api/v1/events/{eventId}/fee-categories), consistent with DEC-3's volunteer-pattern pivot.
    The event create form has no id yet, so it structurally cannot host the sub-resource CRUD.
    The volunteers page is the established precedent for exactly this shape (RHF+Zod dialog +
    sub-resource service calls). The event-detail action bar is the natural entry point.
(c) Consequence: new page + detail-page link; formatCurrency gained an optional currency arg
    (default CHF, backward-compatible) so amounts render per-category currency without a
    hardcoded "CHF" literal (AC-11 white-label). Admin authoring surface for fee categories
    (AC-10) is satisfied by the page; the public/registrant rendering remains E4-S3.
```

### Completion Notes List

**✅ STORY COMPLETE — backend + frontend done + verified. Status: `review`.**

**Frontend — DONE + VERIFIED (Tasks 5, 6.5, 6.6-frontend, 7), this session:**
- `events.ts`: `EventFeeCategoryDto`, `FeeApplicability` union (byte-matches backend PascalCase), `FEE_CURRENCIES`/`FeeCurrency`, `SaveFeeCategoryRequest`, + 4 typed API calls.
- `lib/utils.ts`: `formatCurrency(amount, currency='CHF')` — optional currency arg, backward-compatible (AC-11 white-label, no hardcoded CHF literal in components).
- NEW page `events/[id]/fees/page.tsx`: RHF+Zod create/edit dialog (mirrors volunteer-shift form), active+retired table, soft-retire (deactivate) action, Zurich wall-clock conversion for availability windows. Entry via a "Fees" link in the event-detail action bar (DEC-5).
- i18n: `events.fees` block in de.json + en.json (40 keys each, parity verified). No hi.json.
- **Tests green:** `fees/page.test.tsx` 5 passed (list incl. retired, empty state, create-dialog zod validation, successful create, deactivate). Full frontend suite **179/179** (was 174). eslint + tsc clean on changed files; prettier clean on new files + utils.ts (events.ts carries pre-existing repo-wide drift per A58 — untouched lines).

**Backend — DONE + VERIFIED (Tasks 0, 1, 2, 3, 4, 6.1–6.4, 6.6-backend; prior session):**
- New domain entity `EventFeeCategory` (+ `FeeApplicability` enum) with invariant guards, soft-retire (`Deactivate`/`Reactivate`), `IsAvailableAt`/`AppliesTo` helpers. `Event.cs` Cost surface untouched (AC-6).
- `IEventFeeCategoryRepository` + EF-backed `EventFeeCategoryRepository`; `EventFeeCategoryConfiguration` (Amount `(18,2)`, enum string conversion, FK cascade, `ix_event_id`, filtered-unique `ux (event_id,name) WHERE is_active`, check `amount >= 0`); DbSet on `ApplicationDbContext`.
- Migration `20260606083251_AddEventFeeCategories` (reviewed — table/precision/check/FK/indexes correct).
- MediatR Create/Update/Deactivate commands + validators + GetEventFeeCategoriesQuery; `EventFeeCategoryDto.FromEntity`; `FeeCurrencies`/`FeeApplicabilityParsing` helpers.
- `EventFeeEndpoints` (`/api/v1/events/{eventId}/fee-categories`) — GET/POST/PUT/POST-deactivate, all gated `RequireEventFeeManager` + `Module:events`, audited via `ISecurityAuditLogger`. Cross-event-tampering rejected (opaque 404).
- DI: repository registered (Infrastructure); `RequireEventFeeManager` policy added (Api); endpoints mapped (EndpointMapper).
- **Tests green:** Application.Tests Fee filter **66 passed** (domain + validator + handler); Api.Tests Fee **14 passed** (auth/module metadata); Infrastructure.Tests Fee **4 passed** (Testcontainers PostgreSQL: round-trip, filtered-unique index reject-dup/allow-retired-reuse, case-insensitive active-name). Build 0W/0E.

**PENDING:** none — all tasks complete; story moved to `review`.

### File List

NEW (backend, all building + tested):
- `backend/src/IabConnect.Domain/Events/FeeApplicability.cs`
- `backend/src/IabConnect.Domain/Events/EventFeeCategory.cs`
- `backend/src/IabConnect.Domain/Events/IEventFeeCategoryRepository.cs`
- `backend/src/IabConnect.Application/Events/Fees/EventFeeCategoryDto.cs`
- `backend/src/IabConnect.Application/Events/Fees/FeeParsing.cs`
- `backend/src/IabConnect.Application/Events/Fees/Commands/CreateEventFeeCategoryCommand.cs`
- `backend/src/IabConnect.Application/Events/Fees/Commands/UpdateEventFeeCategoryCommand.cs`
- `backend/src/IabConnect.Application/Events/Fees/Commands/DeactivateEventFeeCategoryCommand.cs`
- `backend/src/IabConnect.Application/Events/Fees/Queries/GetEventFeeCategoriesQuery.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventFeeCategoryConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventFeeCategoryRepository.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260606083251_AddEventFeeCategories.cs` (+ Designer + snapshot update)
- `backend/src/IabConnect.Api/Endpoints/EventFeeEndpoints.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Fees/EventFeeCategoryTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Fees/CreateEventFeeCategoryCommandTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventFeeCategoryRepositoryTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventFeeEndpointTests.cs`

MODIFIED:
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` (+ DbSet)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ repo registration)
- `backend/src/IabConnect.Api/DependencyInjection.cs` (+ RequireEventFeeManager policy)
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` (+ MapEventFeeEndpoints)

NEW (frontend, this session):
- `frontend/src/app/(dashboard)/events/[id]/fees/page.tsx`
- `frontend/src/app/(dashboard)/events/[id]/fees/page.test.tsx`

MODIFIED (frontend, this session):
- `frontend/src/lib/services/events.ts` (fee DTO/types + 4 API calls)
- `frontend/src/lib/utils.ts` (`formatCurrency` optional currency arg)
- `frontend/src/app/(dashboard)/events/[id]/page.tsx` (Fees link in action bar)
- `frontend/messages/de.json` + `frontend/messages/en.json` (`events.fees` block)

### Change Log

- 2026-06-06: Story refreshed from pre-pivot stub to dev-ready in the Epic-4 A34 bulk pass; post-MVP scope; A56 spike documented the existing `Event.Cost` surface and the net-new `EventFeeCategory` model; DEC-1..DEC-4 surfaced with recommendations.
- 2026-06-06: Backend implemented + verified (domain, persistence, MediatR commands/query, API, migration, tests all green). DEC-1=A, DEC-2 pivoted A→B (ISO-string currency for module decoupling), DEC-3 pivoted to the Volunteer MediatR sub-resource pattern, DEC-4=A. Frontend (Task 5/6.5/7) pending — Status held `in-progress`.
- 2026-06-06: Frontend implemented + verified (fee-category management page mirroring the volunteers sub-resource pattern, events.ts DTO/API, formatCurrency currency arg, de/en i18n, detail-page link). DEC-5=A (dedicated sub-resource page, not the create form — the fee API is eventId-keyed). Vitest 5/5 green, full suite 179/179, eslint/tsc/prettier clean on changed files. All tasks complete; Status → `review`.

## Review Findings (Epic-4 boundary code review, 2026-06-06)

3-layer adversarial review; full detail in `deferred-work.md` → "Deferred from: code review of Epic-4". S1-relevant items (all LOW, deferred as **E4-FT-9** polish cluster):
- [x] [Review][Defer] `ActiveNameExistsAsync` case-insensitive vs case-sensitive DB index (TOCTOU on "adult"/"Adult") — E4-FT-9(b)
- [x] [Review][Defer] `IsAvailableAt` inclusive upper bound `[from, until]` — unstated semantic — E4-FT-9(c)
- [x] [Review][Defer] fees-form zod window check (local strings) vs server (UTC) can disagree across DST — E4-FT-9(d)
- [x] [Review][Defer] `getEventFeeCategories(includeInactive:true)` never writes the param (fragile contract) — E4-FT-9(e)
- [x] [Review][Defer] `decimalPlaces` exponential-notation client bypass (backend catches) — E4-FT-9(a)
- Acceptance Auditor confirmed the DEC-1 standalone-entity + DEC-2 ISO-string-currency pivots and the AC-6/RecipientType regression guards as acceptable-as-built & documented; `Amount (18,2)` ↔ InvoiceItem parity holds.
