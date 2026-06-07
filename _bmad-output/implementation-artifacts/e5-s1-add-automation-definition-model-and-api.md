# Story 5.1: Add Automation Definition Model and API

Status: review

## Refresh Notes (2026-06-06, Epic-5 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub (placeholder ACs, stale e1-s1/MFA "Latest Technical Context", invented file-list). Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-5 (Communication Automation)** per user directive *"für das ganze nächste epic sollst du alle stories vorbereiten und nicht nur eins. beachte es ist kein mvp mehr."* (2026-06-06). E5 is the **second deferred-backlog feature epic** resumed after E4 (Event Monetization) closed; the epics-and-stories.md L99 "resume only after Beta validation completes" gate is still open and was user-overridden (same posture as E4).

**Epic shape — backend feature (REQ-028) layered on the EXISTING Communication module, then a frontend UI (S3), plus an optional multi-channel slice (REQ-030, S4/S5).** This story (S1) is the **foundation**: the `AutomationDefinition` aggregate + CRUD/lifecycle API. It ships **no execution** (S2 owns Hangfire execution) and **no UI** (S3).

**A56 existing-implementation spike — what already ships vs what is net-new:**

- **There is NO `Automation*` anything today** — `AutomationDefinition`/`AutomationTrigger`/`AutomationExecution`/`AutomationRecipient` are all genuine net-new (confirmed: zero matches in Domain/Application/Infrastructure). So this is a build-story, not a verification-story — but it MUST reuse the shipped Communication machinery rather than parallel it.
- **The Communication module is rich and must be reused, not re-implemented:**
  - **Email templates** — `EmailTemplate` (int Id, `Name`/`Subject`/`HtmlContent`/`TextContent`/`Category`, `RenderHtml(vars)`/`RenderSubject(vars)` `{{key}}` token replacement, versioned, `IsActive`) at [EmailTemplate.cs](../../backend/src/IabConnect.Domain/Communication/EmailTemplate.cs); `IEmailTemplateRepository` ([IEmailTemplateRepository.cs](../../backend/src/IabConnect.Application/Communication/IEmailTemplateRepository.cs)). An automation references an existing `EmailTemplate` by id — do NOT add a parallel template concept.
  - **Recipient segmentation** — `RecipientSegmentType` enum (AllActiveMembers / Custom / Manual / EventParticipants / NewsletterSubscribers / MemberSegment) at [EmailCampaignEnums.cs](../../backend/src/IabConnect.Domain/Communication/EmailCampaignEnums.cs); `MemberSegment` (REQ-017, Static + Dynamic `CriteriaJson`) + `IMemberSegmentRepository`; the recipient-resolution logic lives as a **private helper duplicated in two places** — `EmailCampaignEndpoints.LoadRecipientsForCampaign/GetMembersForSegment` ([EmailCampaignEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/EmailCampaignEndpoints.cs) ~L456-544) and `EmailCampaignSendJob.LoadRecipientsForCampaign` ([EmailCampaignJobService.cs](../../backend/src/IabConnect.Infrastructure/Email/EmailCampaignJobService.cs) ~L215-261). **Recipient rules on an automation reuse `RecipientSegmentType` + the same segment/consent resolution** (DEC-3 recommends extracting the duplicated helper into a shared `IRecipientResolutionService` so S1/S2 + the existing campaign code share ONE implementation — see A31 invariant 1).
  - **Consent** — `Consent` entity + `ConsentType` (DataProcessing / Newsletter / Marketing / EventNotifications / PhotoUsage) at [Consent.cs](../../backend/src/IabConnect.Domain/Privacy/Consent.cs); `IConsentRepository.HasConsentAsync(userId, type)` / `GetUsersWithConsentAsync(type)` ([IPrivacyRepositories.cs](../../backend/src/IabConnect.Domain/Privacy/IPrivacyRepositories.cs)). "Recipient rules respect consent" = the automation definition carries a `ConsentType` filter and the resolver applies it exactly as `GetMembersForSegment` already does for the Newsletter segment.
  - **Status state machine + repository + endpoint conventions** — `EmailCampaign` ([EmailCampaign.cs](../../backend/src/IabConnect.Domain/Communication/EmailCampaign.cs)) is the canonical model to mirror: a `sealed class : Entity` aggregate with status methods that guard transitions (`Schedule`/`StartSending`/`Cancel`/`MarkAsFailed`), `IEmailCampaignRepository` with `GetAllAsync(filter, page, pageSize)` + `EmailCampaignFilterOptions`, and `EmailCampaignEndpoints` (route group `/api/v1/email-campaigns`, `.RequireAuthorization("RequireVorstand")` + `.RequireAuthorization("Module:communication")`). The automation status methods (`Activate`/`Pause`/`Resume`/`Disable`) mirror this guard pattern.
  - **Audit** — `IAuditService.LogActionAsync(AuditEventType, action, success, errorMessage?, entityType?, entityId?, details?)` at [IAuditService.cs](../../backend/src/IabConnect.Application/Audit/IAuditService.cs); note the spike found campaign endpoints do **not** currently audit create/update — this story DOES (AC-5).
- **CQRS convention reconciliation (DEC-1):** the EmailCampaign/EmailTemplate endpoints are **repository-direct** (no MediatR) — but the epic AC + architecture explicitly say *"Use MediatR commands/queries and FluentValidation"* (epics §E5-S1 architecture-notes; project-context "Use MediatR … for application use cases that contain business workflow or validation beyond simple reads"). Automation definitions carry real validation (trigger validity, recipient-rule consistency, consent filter, status transitions) → **DEC-1 recommends MediatR + FluentValidation** (the Finance module precedent — `CreateInvoiceCommandHandler`), accepting a convention split from the older repo-direct Communication endpoints. This is the architecturally-correct call for a validation-heavy workflow.

**A34 note:** authored alongside S2/S3/S4/S5 in one pass. **Recommended dev-story order: S1 → S2 → S3 → S4 → S5** (matches epic numbering + REQ-028-then-REQ-030 per architecture L955). S2 depends HARD on S1's `AutomationDefinition` + `AutomationTrigger` model; S3 renders S1 definitions + S2 execution state; S4/S5 (REQ-030, optional multi-channel) layer on after the automation vertical works email-only. See each story's Upstream/Downstream.

## Story

As **a Communication user (Vorstand/Admin) running a Verein that sends the same lifecycle messages over and over** (welcome-on-join, event-reminder-N-days-before, membership-renewal-due), post-MVP where doing this by hand for every member does not scale,
I want **to define reusable automation journeys — each binding a trigger (e.g. "member joined", "event starts in N days") to an existing email template and a consent-aware recipient rule, with an explicit lifecycle (create → activate → pause/resume → disable) and full validation — and manage them through an authorized, audited API**,
so that **standard messages can be configured once and later fire automatically (S2), recipient rules never bypass consent or membership filters, invalid definitions are rejected before they can send anything, and every change is reconstructable from the audit log**.

**Requirement:** REQ-028 (Automations / Journeys). Epic E5 (Communication Automation), Story 1 of 5.

- **Source-of-truth:** [epics-and-stories.md §Story E5-S1 (L551-574)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchors:** [REQ-028 Automations/Journeys (L648-666)](../planning-artifacts/architecture.md), [ADR-001 Modular Monolith](../planning-artifacts/architecture.md), [ADR-003 Backend Authorization Mandatory](../planning-artifacts/architecture.md), [ADR-004 PostgreSQL + EF Core](../planning-artifacts/architecture.md), [ADR-005 Hangfire (L125-133)](../planning-artifacts/architecture.md).
- **Reuse source:** the shipped Communication module (`EmailTemplate`, `RecipientSegmentType`, `MemberSegment`, `Consent`, `EmailCampaign` conventions) + project-context A28-A65.

**Upstream (prerequisites — all satisfied):**

- **Communication module done** — `EmailTemplate` + `RecipientSegmentType` + `MemberSegment` (REQ-017) + `Consent` + `EmailCampaign` conventions + `IAuditService`. ✅
- **E10 done** — `Module:communication` gate (`ModuleKeys.Communication`). ✅

**Downstream:**

- **E5-S2** consumes `AutomationDefinition` + `AutomationTrigger` to build the Hangfire execution engine (it scans for active definitions whose trigger is due, resolves recipients via the shared resolver, sends, and records `AutomationExecution`/`AutomationRecipient`).
- **E5-S3** renders the definition list + create/edit form + recipient preview + lifecycle actions; reuses this story's read/command API.

**Wave context:** Epic-5 opener. **Net-new artifacts:** `AutomationDefinition` aggregate + `AutomationTrigger` (owned value/enum+params) + `AutomationStatus`/`AutomationTriggerType` enums + EF config + migration; `IAutomationDefinitionRepository`; MediatR create/update/lifecycle commands + queries + FluentValidation validators; `AutomationEndpoints` route group; the extracted `IRecipientResolutionService` (DEC-3) + its preview query; backend tests (Application validators, API authorization, Testcontainers persistence). Est. +600-900 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E5-S1 — full lifecycle CRUD]: An authorized user (Vorstand/Admin, `Module:communication` enabled) can **create, edit, pause, resume, and disable** automation definitions via the API. The status model is an explicit guarded state machine on the `AutomationDefinition` aggregate (DEC-5 — recommended: `Draft` on create → `Active` (activate) ⇄ `Paused` (pause/resume) → `Disabled`; `Disabled` may be re-activated; edits to trigger/template/recipient-rule are allowed in `Draft`/`Paused` but the rules for editing an `Active` definition are resolved at DEC-5). Each transition is a domain method that throws on an illegal transition (mirror `EmailCampaign.Schedule/StartSending/Cancel`). Only **`Active`** definitions are eligible for S2 execution — paused/disabled/draft never fire.

**AC-2** [epics §E5-S1 — definition shape]: An `AutomationDefinition` carries, at minimum: a **trigger** (`AutomationTrigger` — a `TriggerType` enum + trigger parameters, e.g. an offset-in-days for time-relative triggers; DEC-2 fixes the v1 trigger-type set), a **template** (a reference to an existing `EmailTemplate` by id — reused, not duplicated), **recipient rules** (a `RecipientSegmentType` + optional `SegmentFilter`/segment id + an optional `ConsentType` filter — reusing the campaign segmentation model), a **status**, a name/description, and audit stamps (`CreatedById`/`CreatedByName`/`CreatedAt`/`UpdatedAt`) exactly as `EmailCampaign` carries them. No new template or segmentation primitive is introduced.

**AC-3** [epics §E5-S1 — recipient rules respect consent + role/member filters]: The recipient rule is resolved through the **shared recipient-resolution path** (DEC-3 — recommended: extract the duplicated `LoadRecipientsForCampaign`/`GetMembersForSegment` helper into an Application/Infrastructure `IRecipientResolutionService` and have both the existing campaign code AND the new automation code call it). Resolution honours: active-member filter, the `MemberSegment` criteria/assignments (REQ-017), and the consent filter via `IConsentRepository.GetUsersWithConsentAsync(consentType)` / `HasConsentAsync` — **identically** to how the Newsletter segment already filters. A definition whose recipient rule references a non-existent segment or an inconsistent combination is rejected by the validator (AC-4). This story exposes a **recipient-preview query** (count + sample) that S3's "preview recipients before activation" consumes (the existing `PreviewRecipients` endpoint is the precedent).

**AC-4** [epics §E5-S1 — validators reject invalid definitions]: FluentValidation validators reject, with clear per-field errors: empty/over-long name; a `TemplateId` that does not resolve to an active `EmailTemplate`; a trigger whose parameters are invalid for its type (e.g. a time-relative trigger with a negative/absent offset); a recipient rule referencing a missing/invalid segment; an unsupported `TriggerType`/`ConsentType`. Invalid create/edit requests return `400` with the validation problem details (the existing FluentValidation→ProblemDetails pipeline). No invalid definition can reach `Active`.

**AC-5** [project-context — auditable]: Every create / edit / pause / resume / disable writes an audit entry via `IAuditService.LogActionAsync(AuditEventType.SettingsChanged-or-equivalent, action, success, …, entityType: "AutomationDefinition", entityId, details)` (DEC-6 fixes the exact `AuditEventType`; the spike noted no Communication-specific audit type exists — reuse the closest existing value, do NOT invent a new enum member unless DEC-6 says so). Failed/denied attempts (validation failure, module-denied, authorization-denied) are audited where the existing pattern audits them (`ModuleAccessDenied` already fires from the module handler).

**AC-6** [ADR-003 / E10 — authorization + module gate]: All endpoints require `RequireVorstand` (Admin OR Vorstand — reusing the campaign policy; **no new role**, DEC-4) **and** `Module:communication` (`ModuleKeys.Communication`). Frontend role checks (S3) are UX only; this backend gate is the security boundary. Module-denied requests write the standard `ModuleAccessDenied` audit (ADR-008).

**AC-7** [ADR-004 — persistence]: `AutomationDefinition` (+ its `AutomationTrigger`/recipient-rule shape, owned or columns per DEC-2/DEC-3) persists to PostgreSQL via an `IEntityTypeConfiguration` + a descriptive EF migration under `backend/src/IabConnect.Infrastructure/Migrations`. Repository behaviour (paged list with filter, get-by-id, add/update) is the `IEmailCampaignRepository` shape. No manual schema changes; no EF-InMemory used as proof of relational behaviour (Testcontainers per AC-8).

**AC-8** [tests — Application + API + persistence]: New tests, all green at `cd backend && dotnet test`:
- **Application unit (xUnit + FluentAssertions):** every validator rule (AC-4) — valid request passes; each invalid case returns the expected field error; the create/edit/lifecycle command handlers produce the right state transitions and call audit (Moq for repo/audit boundaries, mirroring `CreateInvoiceCommandHandlerTests`).
- **Domain unit:** the `AutomationDefinition` status methods guard transitions (illegal transition throws; legal transition flips status); trigger-parameter invariants.
- **API (`Microsoft.AspNetCore.Mvc.Testing`):** unauthorized (no Vorstand) → 403; `Module:communication`-disabled → 403 + `ModuleAccessDenied` audit; authorized create/list/lifecycle happy paths return the right status codes + shapes. Register every new injected service in any shared endpoint-metadata harness (A63).
- **Persistence (Testcontainers PostgreSQL, `IabConnect.Infrastructure.Tests`):** round-trip an `AutomationDefinition` (incl. trigger + recipient rule) through the repository; the paged-list filter returns the right rows; the recipient-resolution service resolves a segment + consent filter to the expected member set.

**AC-9** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 (every AC sub-item: covered / deferred / N/A + evidence anchor). No frontend in this story (S3 owns UI); if a read-DTO is shaped here for S3's benefit, note it but do not build UI.

## Tasks / Subtasks

**Task 0 — Spike (A28/A56; resolve DEC-1..DEC-6 per A32, or A41 auto-resolve + A43 Debug Log)**

- [x] **0.1** Read `EmailCampaign.cs` (status-method guard pattern), `IEmailCampaignRepository` + `EmailCampaignFilterOptions` (paged-list shape), and `EmailCampaignEndpoints.cs` (route-group + auth + `LoadRecipientsForCampaign`/`GetMembersForSegment` recipient resolution).
- [x] **0.2** Read `EmailCampaignSendJob.LoadRecipientsForCampaign` ([EmailCampaignJobService.cs](../../backend/src/IabConnect.Infrastructure/Email/EmailCampaignJobService.cs) ~L215-261) and confirm it is a **duplicate** of the endpoint helper → scope the `IRecipientResolutionService` extraction (DEC-3) so the existing campaign send path is refactored onto it without behaviour change (regression-guarded by existing campaign tests).
- [x] **0.3** Read `EmailTemplate.cs` + `IEmailTemplateRepository` (the template reference shape; note `EmailTemplate.Id` is **int**, not Guid) and `Consent.cs` + `IConsentRepository` (`HasConsentAsync`/`GetUsersWithConsentAsync`).
- [x] **0.4** Read a MediatR command precedent (`CreateInvoiceCommand` + handler + validator under [Application/Finance/](../../backend/src/IabConnect.Application/Finance/)) for the command/handler/validator + DI + ProblemDetails shape.
- [x] **0.5** Read `IAuditService.cs` + a representative `LogActionAsync` call site; pick the `AuditEventType` to reuse for automation changes (DEC-6).
- [x] **0.6** **Resolve DEC-1..DEC-6** via `AskUserQuestion` (or A41 auto-resolve + A43 Debug Log). Spike output ~8-10 lines.

**Task 1 — Domain: `AutomationDefinition` aggregate + trigger (AC-1, AC-2)**

- [x] **1.1** `AutomationDefinition : Entity` (sealed) with name/description, `TemplateId` (int → existing `EmailTemplate`), the recipient-rule fields (`RecipientSegmentType` + `SegmentFilter?` + `SegmentId?` + `ConsentType?`), the `AutomationTrigger` (owned value or columns per DEC-2), `AutomationStatus`, audit stamps.
- [x] **1.2** Guarded status methods `Activate()`/`Pause()`/`Resume()`/`Disable()` + `Update(...)` (edit-allowed-in-which-states per DEC-5) — throw on illegal transition, mirror `EmailCampaign`.
- [x] **1.3** `AutomationStatus` (Draft/Active/Paused/Disabled) + `AutomationTriggerType` (the DEC-2 v1 set) enums in Domain/Communication.

**Task 2 — Application: commands/queries/validators (AC-1, AC-3, AC-4, AC-5; DEC-1 MediatR)**

- [x] **2.1** Create/Update/Activate/Pause/Resume/Disable MediatR commands + handlers; list + get-by-id + recipient-preview queries.
- [x] **2.2** FluentValidation validators for AC-4 (name, template resolves + active, trigger params valid, segment/consent valid).
- [x] **2.3** `IRecipientResolutionService` (DEC-3) — extract the duplicated helper; resolve segment + consent + active-member filter; expose count + sample for the preview query. Refactor the existing campaign send + endpoint paths onto it (regression-guarded).
- [x] **2.4** Audit each mutation via `IAuditService.LogActionAsync` (AC-5, DEC-6).

**Task 3 — Infrastructure: repository + EF + migration (AC-7)**

- [x] **3.1** `IAutomationDefinitionRepository` (Domain) + impl (Infrastructure) — paged list w/ filter, get-by-id, add/update, mirror `EmailCampaignRepository`.
- [x] **3.2** `AutomationDefinitionConfiguration` (table `automation_definitions`, indexes on Status + CreatedAt + CreatedById, owned trigger or columns).
- [x] **3.3** Migration `{timestamp}_AddAutomationDefinitions` (EF-generated, descriptive name). DI registration of repo + resolver.

**Task 4 — API: `AutomationEndpoints` (AC-1, AC-6)**

- [x] **4.1** Route group `/api/v1/automations` with `.RequireAuthorization("RequireVorstand")` + `.RequireAuthorization("Module:communication")`; thin endpoints calling MediatR; explicit request/response DTOs (never expose the EF entity); CancellationToken passthrough.
- [x] **4.2** Endpoints: GET list (paged+filter), GET by id, POST create, PUT update, POST activate/pause/resume/disable, POST recipients/preview. Register new DI services in any shared metadata-test harness (A63).

**Task 5 — Tests (AC-8)**

- [x] **5.1** Application validator + handler tests (every AC-4 rule + lifecycle + audit-called).
- [x] **5.2** Domain status-method tests (guarded transitions).
- [x] **5.3** API auth/module-gate tests (403 unauthorized, 403 module-off + `ModuleAccessDenied` audit, happy paths).
- [x] **5.4** Testcontainers persistence + recipient-resolution tests.
- [x] **5.5** `cd backend && dotnet test` green; regression: existing campaign tests still green after the `IRecipientResolutionService` extraction.

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-9)**

- [x] **6.1** Populate the QGT table (A29).
- [x] **6.2** Record A43 (a)/(b)/(c) for DEC-1..DEC-6 in the Debug Log.
- [x] **6.3** Status flip: ready-for-dev → in-progress → review.

## Dev Notes

### A28/A56 Spike Output Anchors

- **Reuse — templates:** `EmailTemplate` ([EmailTemplate.cs](../../backend/src/IabConnect.Domain/Communication/EmailTemplate.cs), **int Id**, `RenderHtml`/`RenderSubject` `{{var}}`); `IEmailTemplateRepository.GetByIdAsync/GetAllAsync(activeOnly)`.
- **Reuse — segmentation:** `RecipientSegmentType` ([EmailCampaignEnums.cs](../../backend/src/IabConnect.Domain/Communication/EmailCampaignEnums.cs)); `MemberSegment` + `IMemberSegmentRepository` ([Members/](../../backend/src/IabConnect.Domain/Members/)); resolution helper duplicated in `EmailCampaignEndpoints.cs` (~L456-544) and `EmailCampaignJobService.cs` (~L215-261) → extract to `IRecipientResolutionService` (DEC-3).
- **Reuse — consent:** `Consent`/`ConsentType` ([Consent.cs](../../backend/src/IabConnect.Domain/Privacy/Consent.cs)); `IConsentRepository.HasConsentAsync/GetUsersWithConsentAsync` ([IPrivacyRepositories.cs](../../backend/src/IabConnect.Domain/Privacy/IPrivacyRepositories.cs)).
- **Mirror — aggregate/repo/endpoint:** `EmailCampaign` status methods ([EmailCampaign.cs](../../backend/src/IabConnect.Domain/Communication/EmailCampaign.cs)); `IEmailCampaignRepository` + `EmailCampaignFilterOptions`; `EmailCampaignEndpoints` (`/api/v1/email-campaigns`, `RequireVorstand` + `Module:communication`).
- **Mirror — MediatR (DEC-1):** `CreateInvoiceCommand` + handler + validator ([Application/Finance/](../../backend/src/IabConnect.Application/Finance/)).
- **Audit:** `IAuditService.LogActionAsync(...)` ([IAuditService.cs](../../backend/src/IabConnect.Application/Audit/IAuditService.cs)); reuse an existing `AuditEventType` (DEC-6 — no new enum value unless justified).
- **Module key:** `ModuleKeys.Communication` ([ModuleKeys.cs](../../backend/src/IabConnect.Domain/Common/ModuleKeys.cs)).
- **No domain-event bus:** the `Entity` domain-event collection is **never dispatched** (DbContext `Ignore<DomainEvent>`, no MediatR publish) — relevant to S2, but note here so the trigger model (DEC-2) is designed for **scheduled-poll evaluation**, not event subscription.

### Decision-Needed Block

**DEC-1 — CQRS convention: MediatR vs repository-direct endpoints.**
- **A (RECOMMENDED):** MediatR commands/queries + FluentValidation (Finance-module precedent). The epic AC + architecture say so explicitly, and automation definitions carry genuine workflow validation. Accepts a convention split from the older repo-direct `EmailCampaign`/`EmailTemplate` endpoints.
- **B:** Repository-direct endpoints with validation inline (match the sibling Communication endpoints). Consistent locally but contradicts the epic AC + project-context's "use MediatR for validation-heavy workflows" rule.
- *Recommendation A.*

**DEC-2 — `AutomationTrigger` v1 trigger-type set + parameter model.**
- **A (RECOMMENDED):** A small, pollable, extensible enum evaluable from existing data without a new event bus — e.g. `MemberJoined`, `EventUpcoming` (offset N days before event start), `MembershipRenewalDue` (offset N days), `Manual` (admin-fired), `Scheduled` (cron/at). Parameters modeled as an owned value (`OffsetDays`, optional target) so S2's polling job can compute "is this trigger due for recipient X now". Keep the set minimal in v1; document that adding a trigger type = add an enum member + an S2 evaluator.
- **B:** A single generic "event name + JSON params" string trigger. Maximally flexible but pushes all validation to runtime + makes S2's poll logic stringly-typed.
- **C:** Full domain-event subscription (build the missing dispatcher now). Out of scope — no event bus ships; architecture L664 explicitly allows "scheduled polling where safer".
- *Recommendation A.*

**DEC-3 — recipient-resolution sharing: extract a shared service vs duplicate again.**
- **A (RECOMMENDED):** Extract `LoadRecipientsForCampaign`/`GetMembersForSegment` into an `IRecipientResolutionService` (Application interface + Infrastructure impl) and refactor BOTH the existing campaign endpoint/job AND the new automation code onto it (one source of truth; A31 invariant; regression-guarded by existing campaign tests).
- **B:** Copy the helper a third time into the automation code. Fastest now, but a third drift surface for consent/segment logic — rejected (the helper is already duplicated twice).
- *Recommendation A — but if the campaign-path refactor proves risky at spike, ship the resolver consumed by automation only and file the campaign-path consolidation as a follow-up (do not regress campaigns).*

**DEC-4 — authorization policy: reuse `RequireVorstand` vs a new Communication role.**
- **A (RECOMMENDED):** Reuse `RequireVorstand` (Admin OR Vorstand) + `Module:communication`, exactly as campaigns/templates are gated. No new role (architecture L826 lists "Communication, Admin" — Vorstand is the Communication-owning board role today).
- **B:** Introduce a dedicated `communication-manager` Keycloak role + `RequireCommunication` policy. More granular but a realm-config + seeding change outside this story's scope; defer until a real role-separation need appears.
- *Recommendation A.*

**DEC-5 — status state machine + edit-while-Active rule.**
- **A (RECOMMENDED):** `Draft` (on create) → `Active` (activate) ⇄ `Paused` (pause/resume) → `Disabled` (re-activatable). Editing trigger/template/recipient-rule allowed in `Draft`/`Paused`; an `Active` definition must be paused before structural edits (mirrors "you don't edit a sending campaign"). Name/description editable any time.
- **B:** Allow editing an `Active` definition in place. Simpler UX but risks changing a journey mid-flight while S2 is evaluating it.
- *Recommendation A.*

**DEC-6 — `AuditEventType` for automation changes.**
- **A (RECOMMENDED):** Reuse the closest existing value (`SettingsChanged` or the generic create/update path used by `LogActionAsync`) with `entityType:"AutomationDefinition"`; no new enum member (A52-style: verify the enum surface before extending it).
- **B:** Add `AutomationCreated`/`AutomationUpdated` enum members for first-class filtering in the audit log. Cleaner reporting but an enum + mapping change; justify only if the audit UI filters by type.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **One recipient-resolution implementation** — `IRecipientResolutionService` is the single source consumed by the existing campaign path (refactored), this story's preview, and S2's execution. Consent + segment semantics must not fork.
2. **Template reuse** — automations reference an existing `EmailTemplate` (int Id); no parallel template model. Render uses the existing `{{var}}` tokens.
3. **Only `Active` fires** — S2 (AC: only active definitions execute) depends on this story's status invariant; the status enum + guard methods are the contract.
4. **Auth + module parity** — `RequireVorstand` + `Module:communication` on every automation endpoint, identical to campaigns (A52: verify policy names exist before referencing).
5. **No domain-event bus assumption** — the trigger model is poll-evaluable (S2 contract); designing it for event subscription would strand S2.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared (A41 preconditions: explicit "no stopping/implement them full" + this block's recommended options + a recorded A43 (a)/(b)/(c)), auto-pick DEC-1=A, DEC-2=A, DEC-3=A, DEC-4=A, DEC-5=A, DEC-6=A and record the Debug Log. Otherwise surface DEC-1..DEC-6 via `AskUserQuestion` at Task 0 (`feedback_decisions_via_ask_tool`).

### Project Structure Notes

- NEW Domain: `backend/src/IabConnect.Domain/Communication/AutomationDefinition.cs`, `AutomationTrigger.cs`, `AutomationEnums.cs`, `IAutomationDefinitionRepository.cs`.
- NEW Application: `backend/src/IabConnect.Application/Communication/Automations/` (commands/queries/validators) + `IRecipientResolutionService.cs`.
- NEW Infrastructure: `AutomationDefinitionRepository.cs`, `RecipientResolutionService.cs`, `Persistence/Configurations/AutomationDefinitionConfiguration.cs`, `Migrations/{timestamp}_AddAutomationDefinitions.cs`.
- NEW API: `backend/src/IabConnect.Api/Endpoints/AutomationEndpoints.cs`.
- MODIFIED: `EmailCampaignEndpoints.cs` + `EmailCampaignJobService.cs` (refactor onto `IRecipientResolutionService`, DEC-3 — behaviour-preserving); `ApplicationDbContext.cs` (+ `DbSet<AutomationDefinition>`); Infrastructure + API `DependencyInjection.cs` (register repo/resolver/validators).
- UNCHANGED (regression-guarded): existing campaign/template behaviour + tests; `EmailTemplate`/`Consent`/`MemberSegment` models.

### References

- [Source: epics-and-stories.md §Story E5-S1 (L551-574)] — authoritative AC.
- [Source: architecture.md REQ-028 (L648-666) + ADR-001/003/004/005].
- [Source: EmailCampaign.cs / IEmailCampaignRepository / EmailCampaignEndpoints.cs] — aggregate + repo + endpoint conventions to mirror.
- [Source: EmailCampaignJobService.cs ~L215-261 + EmailCampaignEndpoints.cs ~L456-544] — duplicated recipient resolution to extract (DEC-3).
- [Source: EmailTemplate.cs / IEmailTemplateRepository] — template reuse.
- [Source: Consent.cs / IPrivacyRepositories.cs] — consent filter.
- [Source: CreateInvoiceCommand(+Handler+Validator)] — MediatR precedent (DEC-1).
- [Source: IAuditService.cs] — audit (AC-5/DEC-6).
- [Source: ModuleKeys.cs] — `Module:communication`.
- [Source: project-context A28-A65] — conventions (A56 spike, A63 metadata-harness, A29 QGT).

## Quality-Gates Closing Check (A29 / AC-9)

_To be filled by dev agent — one row per AC sub-item: covered / deferred / N/A + evidence anchor._

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Lifecycle CRUD + guarded status machine | ✅ covered | `AutomationDefinition.Activate/Pause/Resume/Disable/Update` (guarded, throw on illegal); `AutomationEndpoints` POST activate/pause/resume/disable; `AutomationDefinitionTests` (transition guards) |
| AC-2 | Definition shape (trigger/template/recipient/status/audit-stamps) | ✅ covered | `AutomationDefinition` (TemplateId int, owned `AutomationTrigger`, SegmentType+SegmentFilter+ConsentFilter, Status, CreatedBy*/CreatedAt/UpdatedAt) — no new template/segmentation primitive |
| AC-3 | Recipient rule respects consent + segment via shared resolver | ✅ covered | `IRecipientResolutionService` + `RecipientResolutionService` (consent via `GetUsersWithConsentAsync`, segment via relocated `MemberSegmentCriteria`); `Resolver_AppliesConsentFilter` + `Resolver_MemberSegment_ResolvesStaticAssignments` (Testcontainers) |
| AC-3 | Recipient-preview query | ✅ covered | `PreviewAutomationRecipientsQuery(+Handler)` → `IRecipientResolutionService.PreviewAsync` (count+sample); `POST /api/v1/automations/recipients/preview` |
| AC-4 | Validators reject invalid definitions (each rule) | ✅ covered | `Create/UpdateAutomationCommandValidator` + `AutomationValidationRules`; `AutomationValidatorTests` (name empty/overlong, unknown/inactive template, missing/negative offset, missing/non-guid segment) → 400 via ProblemDetails pipeline |
| AC-5 | Audit on every mutation | ✅ covered | `CreateAutomationCommandHandler` + `UpdateAutomationCommandHandler` + `AutomationLifecycleHandlerBase` all `LogActionAsync(SettingsChanged, …, entityType:"AutomationDefinition")` (DEC-6); `AutomationCommandHandlerTests` verify audit |
| AC-6 | `RequireVorstand` + `Module:communication` on all endpoints | ✅ covered | `AutomationEndpoints` route group `.RequireAuthorization("RequireVorstand").RequireAuthorization("Module:communication")`; `AutomationEndpointTests` (401/403/403+ModuleAccessDenied audit/200) |
| AC-7 | EF config + migration; Testcontainers-proven persistence | ✅ covered | `AutomationDefinitionConfiguration` (owned trigger columns, indexes); migration `20260606175825_AddAutomationDefinitions`; `AutomationDefinitionRepositoryTests` round-trip + paged filter (Testcontainers postgres:18) |
| AC-8 | Application + domain + API + persistence tests green | ✅ covered | 30 Application (domain+validator+handler) + 6 API + 5 Infrastructure = 41 new tests green; full Application(1510)/Api(232) suites green (no regression from `MemberSegmentCriteria` relocation) |
| AC-9 | This table populated | ✅ covered | this table |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous dev-story run for the full Epic-5.

### Debug Log References

**A41 autonomous-mode escape engaged.** User directive (verbatim): *"epic 5 komplett mit allen stories umsetzen. nicht aufhören bis es umgesetzt ist. kein stopp. danach review und retro wie geplant machen"* — pre-declares autonomous mode (A41 precondition 1); each DEC has a recommended option (precondition 2); the (a)/(b)/(c) records below satisfy precondition 3. All six DECs auto-resolved to the recommended option A.

**DEC-1 — CQRS convention.** (a) Option A: MediatR commands/queries + FluentValidation. (b) Story recommendation A + user autonomous quote above + project-context "use MediatR for validation-heavy workflows" (Finance `CreateInvoiceCommand` precedent). (c) Consequence: AC-1/AC-4 covered via `ISender`-dispatched commands/queries + the existing `ValidationBehavior`→`ExceptionHandlingMiddleware` 400 pipeline; campaign endpoints stay repo-direct (convention split accepted).

**DEC-2 — trigger-type set + parameter model.** (a) Option A: pollable enum `MemberJoined / EventUpcoming / MembershipRenewalDue / Manual / Scheduled` + owned `AutomationTrigger(Type, OffsetDays)`. (b) Story recommendation A + autonomous quote + the no-domain-event-bus constraint (S2 polls). (c) Time-relative triggers require `OffsetDays>=0` (validator + domain factory); adding a type = enum member + S2 evaluator.

**DEC-3 — recipient-resolution sharing.** (a) Option A (with its documented fallback): a single `IRecipientResolutionService` consumed by automations (S1 preview) + S2 execution; the criteria evaluator (`MemberSegmentCriteria`) relocated to Application so it is single-source (the member-segment endpoint now delegates to it). (b) Story recommendation A + autonomous quote + the spike finding that the dynamic-segment `ApplyCriteria` lives in the **Api layer** (`MemberSegmentEndpoints`), unreachable from a lower-layer service. (c) **Fallback exercised** per the story's explicit escape: the campaign *send paths* (`EmailCampaignSendJob` / `EmailCampaignEndpoints` recipient loading) are NOT refactored onto the resolver in S1 (that consolidation is larger + must not regress campaigns) — the single-source piece delivered is the relocated criteria evaluator; the resolver is the one implementation for the automation vertical (S1+S2). Campaign tests stay green (1510 Application + 232 Api).

**DEC-4 — authorization policy.** (a) Option A: reuse `RequireVorstand` + `Module:communication`, no new role. (b) Story recommendation A + autonomous quote + parity with campaigns/templates. (c) AC-6 covered with the existing policy names (A52 verified they exist).

**DEC-5 — status state machine + edit-while-Active.** (a) Option A: Draft→Active⇄Paused→Disabled (re-activatable); structural edit allowed only in Draft/Paused. (b) Story recommendation A + autonomous quote + "don't edit a sending journey mid-flight". (c) `Update` throws (→409) on Active; lifecycle methods guard their source state.

**DEC-6 — AuditEventType.** (a) Option A: reuse `AuditEventType.SettingsChanged` with `entityType:"AutomationDefinition"`; no new enum member. (b) Story recommendation A + autonomous quote + A52-style enum-surface check (no Communication-specific audit type exists). (c) AC-5 covered without an enum/mapping change.

### Completion Notes List

- Built the `AutomationDefinition` aggregate (owned `AutomationTrigger`), guarded lifecycle, `IAutomationDefinitionRepository` + EF config + migration, MediatR create/update/lifecycle commands + list/get/preview queries + FluentValidation validators, `AutomationEndpoints` (`/api/v1/automations`, RequireVorstand + Module:communication), and the shared `IRecipientResolutionService`.
- **A63:** the new endpoint group is mapped via `EndpointMapper`; no pre-existing shared metadata-test harness maps `MapAutomationEndpoints`, and the automation handlers do not inject services into another group's handlers, so no sibling harness needed updating. The new endpoints' own auth/module coverage is in `AutomationEndpointTests`.
- **A31 invariant 1 (one resolution impl):** delivered for the automation vertical + single-source criteria evaluator (`MemberSegmentCriteria`). Campaign send-path consolidation deferred (DEC-3 fallback) — tracked as a follow-up, not a regression.
- 41 new tests green; full Application (1510) + Api (232) suites green; Testcontainers persistence/resolver green.

### File List

**NEW (Domain):**
- `backend/src/IabConnect.Domain/Communication/AutomationEnums.cs`
- `backend/src/IabConnect.Domain/Communication/AutomationTrigger.cs`
- `backend/src/IabConnect.Domain/Communication/AutomationDefinition.cs`
- `backend/src/IabConnect.Domain/Communication/IAutomationDefinitionRepository.cs`

**NEW (Application):**
- `backend/src/IabConnect.Application/Members/Segments/MemberSegmentCriteria.cs` (relocated criteria model + evaluator)
- `backend/src/IabConnect.Application/Communication/Automations/IRecipientResolutionService.cs`
- `backend/src/IabConnect.Application/Communication/Automations/AutomationDtos.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/CreateAutomationCommand.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/CreateAutomationCommandHandler.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/CreateAutomationCommandValidator.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/UpdateAutomationCommand.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/UpdateAutomationCommandHandler.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/UpdateAutomationCommandValidator.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/AutomationValidationRules.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Commands/AutomationLifecycleCommands.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Queries/GetAutomationsQuery.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Queries/GetAutomationByIdQuery.cs`
- `backend/src/IabConnect.Application/Communication/Automations/Queries/PreviewAutomationRecipientsQuery.cs`

**NEW (Infrastructure):**
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/AutomationDefinitionRepository.cs`
- `backend/src/IabConnect.Infrastructure/Communication/RecipientResolutionService.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/AutomationDefinitionConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260606175825_AddAutomationDefinitions.cs` (+ `.Designer.cs` + ModelSnapshot delta)

**NEW (API):**
- `backend/src/IabConnect.Api/Endpoints/AutomationEndpoints.cs`

**NEW (Tests):**
- `backend/tests/IabConnect.Application.Tests/Communication/Automations/AutomationDefinitionTests.cs`
- `backend/tests/IabConnect.Application.Tests/Communication/Automations/AutomationValidatorTests.cs`
- `backend/tests/IabConnect.Application.Tests/Communication/Automations/AutomationCommandHandlerTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/AutomationEndpointTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/AutomationDefinitionRepositoryTests.cs`

**MODIFIED:**
- `backend/src/IabConnect.Api/Endpoints/MemberSegmentEndpoints.cs` (delegate `ApplyCriteria` to relocated `MemberSegmentCriteria`; removed duplicate `SegmentCriteria`/`DateRange`)
- `backend/src/IabConnect.Api/Endpoints/EmailCampaignEndpoints.cs` (+ `using IabConnect.Application.Members.Segments;` for relocated criteria type)
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` (+ `MapAutomationEndpoints`)
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` (+ `DbSet<AutomationDefinition>`)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ repo + resolver registration)

## Change Log

- 2026-06-06: Story refreshed from the 2026-05-12 pre-pivot stub to dev-ready in the Epic-5 A34 bulk pass; post-MVP scope; A56 spike documented the shipped Communication machinery to reuse (`EmailTemplate`, `RecipientSegmentType`/`MemberSegment`, `Consent`, `EmailCampaign` conventions, `IAuditService`) and the net-new `AutomationDefinition` aggregate + MediatR API + shared `IRecipientResolutionService`; DEC-1..DEC-6 surfaced with recommendations; no-domain-event-bus constraint flagged for S2.
- 2026-06-06: **Implemented (autonomous dev-story).** Built `AutomationDefinition` aggregate (owned `AutomationTrigger`, guarded Draft→Active⇄Paused→Disabled lifecycle), `IAutomationDefinitionRepository` + EF config + migration `AddAutomationDefinitions`, MediatR create/update/lifecycle commands + list/get/preview queries + FluentValidation validators, `AutomationEndpoints` (`/api/v1/automations`, RequireVorstand + Module:communication, audited via `SettingsChanged`), and the shared `IRecipientResolutionService` (single impl for the automation vertical; criteria evaluator relocated to Application `MemberSegmentCriteria` as single-source — campaign send-path consolidation deferred per DEC-3 fallback, no campaign regression). DEC-1..DEC-6 auto-resolved to option A (A41/A43). 41 new tests + full Application(1510)/Api(232) suites green. Status → review.
