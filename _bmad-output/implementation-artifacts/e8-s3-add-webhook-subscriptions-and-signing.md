# Story E8.S3: Add Webhook Subscriptions and Signing

Status: done

## Story

As an Admin/IT user,
I want to configure webhook subscriptions for a whitelisted set of events, with signed payloads and safely-stored secret material,
so that approved external systems can reliably receive and verify notifications for selected events without exposing arbitrary internal events.

## Acceptance Criteria

1. An admin can **create, edit, disable, and delete** webhook subscriptions (target URL, subscribed event types from a whitelist, active/disabled state).
2. Supported events come from an **explicit whitelist** (not arbitrary internal events); v1 includes at minimum **`event.created`** and **`payment.received`**.
3. Outbound payloads are **signed/verifiable**: each delivery carries an HMAC-SHA256 signature header computed over the raw body with the subscription's secret, so receivers can verify authenticity.
4. **Secret material is generated securely and stored safely** (secure random; one-way/token-safe at rest, shown once at create/rotate — or encrypted-at-rest if re-display is required per DEC).
5. **Subscription changes are auditable** (create/edit/disable/delete written via `IAuditService`).

## Tasks / Subtasks

- [x] Task 0: Spike + resolve scope (AC: all) — resolve DEC-1..DEC-4 (see Decision-Needed); confirm the S1 reuse seam (A62)
  - [x] **Verify the event-dispatch reality (load-bearing):** confirm domain events are collected but never dispatched — `Entity.cs:10-31` (`AddDomainEvent`/`DomainEvents`), `ApplicationDbContext.cs:124` (`Ignore<DomainEvent>()`), no MediatR publish anywhere; `ClearDomainEvents()` never called. Consequence: there is NO event bus → webhooks MUST be triggered from the actual write path, not a domain-event subscription.
  - [x] Confirm the two concrete v1 trigger sites: `event.created` = `EventEndpoints.cs:435` `CreateEvent` (inline handler → `Event.Create` → `SaveChangesAsync`); `payment.received` = the finance CQRS path converging on `Invoice.MarkAsPaid` (`Invoice.cs:193`) via `MarkPaymentAsPaidCommandHandler.cs:55` / `CreatePaymentCommandHandler.cs:57`. **Note the asymmetry:** events use inline endpoint handlers, finance uses MediatR handlers — the dispatch service must be callable from both.
  - [x] Confirm reuse: HMAC + constant-time precedent (`UnsubscribeTokenService.cs:55,61-65`); secret show-once precedent (`Member.cs:160-173` + hash `:198-207`); reversible-at-rest precedent if needed (`BackupEncryption.cs:41,85`). Confirm S1 shipped the admin auth + `IApiKeyHashingService` it can reuse (A62).
  - [x] Confirm outbound-HTTP precedent for S4 handoff: typed client `Infrastructure/DependencyInjection.cs:216` (`AddHttpClient<IKeycloakAdminService,...>`).
- [x] Task 1: Domain — `WebhookSubscription` + event whitelist (AC: 1, 2, 4)
  - [x] `WebhookSubscription` aggregate (`Domain/Integration/WebhookSubscription.cs`): `Id`, `Name`, `TargetUrl`, subscribed event types (set), `Status` (Active/Disabled/Paused), `SecretHash` (or encrypted secret per DEC-2), `CreatedAt`, failure-tracking fields owned by S4. Private ctor; factory `Create(...)`; methods `UpdateConfiguration(...)`, `Disable()`, `Enable()`, `Delete`/soft-delete per convention.
  - [x] `WebhookEventTypes` constant whitelist (`Domain/Integration/WebhookEventTypes.cs`, mirroring `ModuleKeys.cs`): `EventCreated="event.created"`, `PaymentReceived="payment.received"`, `All`. Reject subscriptions to unknown event types at the write boundary. Designed extensible (each new event = a new const + a new write-path hook).
- [x] Task 2: Infrastructure — persistence + secret + signing + dispatch seam (AC: 1, 3, 4)
  - [x] EF config `WebhookSubscriptionConfiguration.cs` (`webhook_subscriptions`, event-type set storage, `Ignore(DomainEvents)`, `Status` `HasConversion<string>()`); ONE migration after the S1 migration. Repository `IWebhookSubscriptionRepository`/impl (`AddAsync`, `UpdateAsync`, `GetByIdAsync`, `GetActiveForEventTypeAsync(eventType)` for dispatch fan-out, `GetAllAsync`).
  - [x] Secret (DEC-2): generate `RandomNumberGenerator.GetBytes(32)` base64url; store per DEC-2 (recommended: one-way hash + show-once like S1, OR AES-256-GCM reversible if "re-show secret" is a product requirement — note the tension: the **receiver** needs the raw secret to verify).
  - [x] Signing (DEC-3): a `IWebhookSignatureService` producing `sha256=<lowercase-hex(HMAC-SHA256(secret, rawBody))>` (reuse `HMACSHA256.HashData` + `Convert.ToHexString(...).ToLowerInvariant()` per `Member.cs:198-207`). Header `X-Webhook-Signature`. Documented for receivers + a server-side verify helper using `FixedTimeEquals`.
  - [x] **`IWebhookDispatchService` seam (the S4 contract):** `EmitAsync(string eventType, object payload, CancellationToken)` that resolves active subscriptions for the event type and **persists/enqueues a delivery intent** — it does NOT perform the HTTP POST (S4 owns delivery). For v1 (DEC-1) this is a direct post-commit best-effort call from the write path (no domain-event bus), mirroring the post-commit audit call in `PaidRegistrationService.cs:117-130`. Delivery must be out-of-band so a slow/failing receiver never blocks or rolls back the originating event/payment write.
- [x] Task 3: Trigger wiring (AC: 2)
  - [x] Call `IWebhookDispatchService.EmitAsync("event.created", <safe payload>)` immediately after the committing `SaveChangesAsync` in `CreateEvent` (`EventEndpoints.cs:435`).
  - [x] Call `EmitAsync("payment.received", <safe payload>)` after the invoice transitions to paid in the finance handler(s) (`MarkPaymentAsPaidCommandHandler` / `CreatePaymentCommandHandler` — choose the convergent `Invoice.MarkAsPaid` seam). Payloads are minimal + integration-safe (ids + non-sensitive fields; no PII), consistent with the E8-S2 DTO discipline.
- [x] Task 4: Application + API — admin CRUD + audit (AC: 1, 5)
  - [x] Use cases for create/update/disable/enable/delete (FluentValidation: non-empty name, valid absolute https URL, event-type set ⊆ `WebhookEventTypes.All`).
  - [x] `MapWebhookEndpoints` (`Endpoints/WebhookEndpoints.cs`) templated on `CustomRoleEndpoints.cs` (CRUD + direct `IAuditService.LogActionAsync`) + the lifecycle sub-routes from `AutomationEndpoints.cs:18-38` (`/disable`,`/enable`). Admin group `RequireRole("admin")`. Create response surfaces the signing secret ONCE (per DEC-2). Add `WebhookSubscriptionChanged` to `AuditEnums.cs` (or reuse `SettingsChanged` interim). A63: register new injected services in endpoint-metadata harnesses.
- [x] Task 5: Frontend — webhook subscriptions admin UI (AC: 1, 4)
  - [x] Clone the `frontend/src/app/communication/automations/` scaffold (list / new / `[id]` / edit / form + tests) into `frontend/src/app/admin/webhooks/`. Standard layout, orange primary, lucide icons, typed wrapper.
  - [x] Create form: name, target URL, event-type checkboxes (from the whitelist), active toggle; on create show the signing secret once (copy-once panel, "shown only once"). List shows name/url/events/status + edit/disable/delete actions (permission-gated). i18n keys in `de.json` + `en.json` + `hi.json` (all three exist; `messages.parity.test.ts` enforces parity).
- [x] Task 6: Tests (AC: all)
  - [x] Domain: `WebhookSubscription` create/update/disable/enable + event-type whitelist rejection. Signature service: known-vector HMAC + verify true/false (`FixedTimeEquals` path).
  - [x] Infrastructure: Testcontainers repository round-trip + `GetActiveForEventTypeAsync` filter (Active only). Secret store: hash round-trip / encrypt-decrypt per DEC-2.
  - [x] API/integration: create returns secret once + audit row; update/disable/delete audited; **trigger tests** — creating an Event emits `event.created` to the dispatch seam (assert the seam was invoked with a safe payload, no PII); marking an invoice paid emits `payment.received`. Use a fake `IWebhookDispatchService` to assert the call without performing delivery.
  - [x] Frontend: form renders + event checkboxes + secret-shown-once; stable `useTranslations` mock (A64), `afterEach(cleanup)` + jsdom (A35/A46).
- [x] Task 7: Quality gates (AC: all)
  - [x] A29 per-AC table. Backend builds 0/0; `dotnet test` (Application + Api + Testcontainers). Frontend: `tsc`/`eslint`/`prettier --check` on changed files (A58/A72) + `vitest run`.
  - [x] Security self-check: signing covers the exact bytes sent; secret never logged; trigger payloads carry no PII; the dispatch call is post-commit + best-effort (never rolls back the originating write).

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub. Greenfield. The load-bearing finding is the event-trigger mechanism:

- **Domain events are collected but NEVER dispatched (VERIFIED).** `Entity.cs:10-31` holds `_domainEvents` + `AddDomainEvent`/`ClearDomainEvents`; `ApplicationDbContext.cs:124` does `Ignore<DomainEvent>()` and every per-entity config also ignores `DomainEvents`; there is no MediatR `IPublisher`/publish of domain events anywhere, and `ClearDomainEvents()` is never called. `SaveChangesAsync` only normalizes dates. **There is no event bus.** This is the same constraint E5-S2 hit for automations (which chose polling for that reason). → A webhook for "event created"/"payment received" CANNOT subscribe to a domain-event stream; it must be triggered by a **direct post-commit call from the write path** to `IWebhookDispatchService` (mirroring the proven post-commit best-effort audit call in `PaidRegistrationService.cs:117-130`). Do NOT build a domain-event bus for v1 (capture an outbox as future hardening — DEC-1).
- **Two concrete v1 trigger sites, with an asymmetry:** `event.created` = `EventEndpoints.cs:435` `CreateEvent` (Events use **inline endpoint handlers**, not CQRS). `payment.received` = the finance **MediatR** path: both `MarkPaymentAsPaidCommandHandler.cs:55` and `CreatePaymentCommandHandler.cs:57` converge on `Invoice.MarkAsPaid` (`Invoice.cs:193`); also `MatchBankImportItemCommandHandler.cs:47`. The dispatch service must therefore be injectable into both an endpoint handler and MediatR handlers.
- **HMAC signing precedent:** `UnsubscribeTokenService.cs:61-65` (`HMACSHA256` + `ComputeHash`) + `:55` (`CryptographicOperations.FixedTimeEquals`); pepper-keyed HMAC-over-digest in `Member.cs:198-207` (`HMACSHA256.HashData` + `Convert.ToHexString(...).ToLowerInvariant()`). Sign as `X-Webhook-Signature: sha256=<hex(HMAC-SHA256(secret, rawBody))>`.
- **Secret storage tension (DEC-2):** a webhook signing secret is NOT an API key — the **receiver** needs the raw secret to recompute the HMAC. One-way hash + show-once (reuse `Member.RegenerateCalendarToken`) means losing the displayed secret forces a rotate (cannot re-show) — lowest blast radius. If the product needs "re-display the secret", use `BackupEncryption` AES-256-GCM at rest (`:41,85`).
- **Admin CRUD + audit:** `CustomRoleEndpoints.cs` (CRUD + direct `IAuditService.LogActionAsync`, `:115-121,:187-192`) for create/edit/delete; `AutomationEndpoints.cs:18-38` for the disable/enable lifecycle sub-routes. Audit enum `AuditEnums.cs:6-55` (no webhook type; add `WebhookSubscriptionChanged` or reuse `SettingsChanged`). Auth `RequireRole("admin")`.
- **i18n + admin UI scaffold:** `frontend/messages/{de,en,hi}.json` ALL exist post-E7-S3 + `messages.parity.test.ts` enforces parity. Closest admin CRUD UI to clone = `frontend/src/app/communication/automations/` (list/new/`[id]`/edit/form + tests).
- **Outbound HTTP (S4 handoff):** typed-client precedent `Infrastructure/DependencyInjection.cs:216` (`AddHttpClient<IKeycloakAdminService,...>`). S3 only defines the dispatch seam; S4 owns the typed/named `HttpClient` delivery. **SSRF guarding (block internal IPs in the target URL)** has no precedent — flag it as a new concern for S4 and validate the URL is an absolute external https URL at subscription-create time here.

### Files to change

- Domain (new): `Domain/Integration/WebhookSubscription.cs`, `WebhookEventTypes.cs`.
- Infrastructure (new): `Persistence/Configurations/WebhookSubscriptionConfiguration.cs`; `Persistence/Repositories/WebhookSubscriptionRepository.cs` (+ interface); `Integration/WebhookSignatureService.cs`; `Integration/WebhookDispatchService.cs` (+ `IWebhookDispatchService` interface in Application); migration.
- Application (new): webhook use cases + validators + DTOs; `IWebhookDispatchService` interface.
- API (new): `Endpoints/WebhookEndpoints.cs`.
- API/Domain (modified): `Endpoints/EventEndpoints.cs` (emit `event.created`), finance handler(s) (emit `payment.received`), `Endpoints/EndpointMapper.cs`, `DependencyInjection.cs` (register services), `Domain/Audit/AuditEnums.cs`.
- Frontend (new): `frontend/src/app/admin/webhooks/` + typed wrapper.
- Frontend (modified): `frontend/messages/{de,en,hi}.json`.
- Tests: domain/signature, Testcontainers repo, API/trigger, frontend.

### Scope Boundaries

In scope:

- `WebhookSubscription` CRUD + lifecycle, event-type whitelist, HMAC signing, secret generation/storage, audit, admin UI, the two v1 triggers, and the `IWebhookDispatchService` seam (intent persistence/enqueue only).

Out of scope:

- Actual outbound HTTP delivery, retry, delivery history, disable-on-failure policy (all E8-S4 — this story defines the seam S4 fills).
- A domain-event bus / outbox (v1 uses direct write-path calls; outbox is future hardening).
- Event types beyond the v1 whitelist (extensible, but only `event.created` + `payment.received` are wired now).

### Architecture Guardrails

- No event bus (verified) → triggers are direct, post-commit, best-effort calls from the write path; a webhook failure must NEVER roll back or block the originating event/payment write (delivery is out-of-band via the S4 seam).
- Clean Architecture: `WebhookSubscription` invariants in Domain; use cases/validators in Application; EF/signing/dispatch in Infrastructure; thin endpoints. The `IWebhookDispatchService` interface lives in Application; impl in Infrastructure.
- Sign the exact raw bytes sent. Never log the secret or full payload (architecture "Background Job Rules": avoid exposing sensitive payloads). Verify signatures with `FixedTimeEquals`.
- Trigger payloads are integration-safe (ids + non-sensitive fields only), consistent with E8-S2's whitelist DTO discipline — no PII in webhook bodies.
- Target URL validated as absolute external https at create time; full SSRF guarding deferred to S4 delivery (flagged).
- Frontend: shared components, standard layout, orange primary, next-intl de/en/hi parity, no hardcoded strings.

### Testing Requirements

- Backend: xUnit v3 + FluentAssertions; Moq for the `IWebhookDispatchService` boundary in trigger tests. Domain unit tests + signature known-vector; Testcontainers PostgreSQL repository round-trip + active-for-event-type filter (NOT EF InMemory). API: create-once-secret + audit; trigger emits with safe payload (fake dispatch service asserts the call, no delivery).
- Frontend: Vitest + Testing Library; stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom (A35/A46).
- Gates: `dotnet test`; `npx eslint`/`prettier --check` on changed files (A58/A72) + `vitest run`.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — Trigger mechanism.**
  - (A, recommended) **Direct post-commit write-path call** to `IWebhookDispatchService.EmitAsync(...)`. Rationale: no event bus exists (verified §spike); the post-commit best-effort side-effect pattern is already proven in `PaidRegistrationService.cs:117-130`. Outbox/at-least-once is future hardening (tech-debt note), overkill for v1.
  - (B) Outbox table + drain job. Deferred: stronger delivery guarantee but new infra for a Could-priority epic.
  - (C) Polling. Rejected: no natural "due" signal for create/payment events; wasteful.
- **DEC-2 — Secret storage.**
  - (A, recommended) **One-way hash + show-once-at-create + rotate-to-replace** (reuse `Member.RegenerateCalendarToken`). Rationale: lowest blast radius; no new key-management surface; receiver stores its own copy at setup.
  - (B) AES-256-GCM encrypted-at-rest, re-displayable (`BackupEncryption`). Choose only if "re-show the secret to the operator" is a hard product requirement.
- **DEC-3 — Signature scheme.**
  - (A, recommended) **`X-Webhook-Signature: sha256=<hex(HMAC-SHA256(secret, rawBody))>`**, reusing the `HMACSHA256.HashData` + lowercase-hex idiom. Rationale: industry-standard, matches the shipped HMAC precedents, easy for receivers to verify; include a timestamp header to mitigate replay (optional v1.1).
  - (B) asymmetric/JWS signing. Rejected: no key-pair infra; overkill for v1.
- **DEC-4 — Event whitelist scope.**
  - (A, recommended) **`event.created` + `payment.received` only** (PRD minimum). Rationale: each trigger is a hand-wired write-path call (no bus to make broadening cheap); keep v1 to the two PRD events; design the whitelist as an extensible constant set.
  - (B) broader (registrations, member changes, invoice lifecycle). Rejected for v1: every added event is another hand-wired hook + payload-safety review.

### Project Structure Notes

- Backend: `IabConnect.Domain/Integration`, `IabConnect.Application/Integration`, `IabConnect.Infrastructure/{Integration,Persistence/Configurations,Persistence/Repositories,Migrations}`, `IabConnect.Api/Endpoints`.
- Backend tests: `IabConnect.Application.Tests` (domain/signature), `IabConnect.Infrastructure.Tests` (Testcontainers repo), `IabConnect.Api.Tests` (CRUD/trigger + A63 harness).
- Frontend: `frontend/src/app/admin/webhooks`, `frontend/src/lib/services`, `frontend/messages/{de,en,hi}.json`.

### References

- `backend/src/IabConnect.Domain/Common/Entity.cs:10-31`, `DomainEvent.cs:6-10`, `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs:124` (events collected, never dispatched)
- `backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs:435` (`event.created` trigger site), `backend/src/IabConnect.Domain/Finance/Invoice.cs:193` + `Application/Finance/.../MarkPaymentAsPaidCommandHandler.cs:55` + `CreatePaymentCommandHandler.cs:57` (`payment.received` trigger sites)
- `backend/src/IabConnect.Infrastructure/Events/PaidRegistrationService.cs:117-130` (post-commit best-effort side-effect pattern)
- `backend/src/IabConnect.Infrastructure/Email/UnsubscribeTokenService.cs:55,61-65` (HMAC + FixedTimeEquals), `Domain/Members/Member.cs:160-207` (show-once + hash), `Infrastructure/Backup/BackupEncryption.cs:41,85` (reversible-at-rest)
- `backend/src/IabConnect.Api/Endpoints/CustomRoleEndpoints.cs:115-121,187-192` (CRUD+audit), `AutomationEndpoints.cs:18-38` (lifecycle), `Domain/Audit/AuditEnums.cs:6-55`
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs:216` (typed HttpClient precedent, S4 handoff)
- `frontend/src/app/communication/automations/` (admin CRUD scaffold), `frontend/messages/{de,en,hi}.json` + `messages.parity.test.ts`
- `_bmad-output/planning-artifacts/architecture.md:739-758` (REQ-058), `:848-864` (integration boundaries + background-job rules); `prd.md:428-435`; `epics-and-stories.md:908-930` (E8-S3 source)
- `_bmad-output/project-context.md` (A56 spike, A62 sibling-DEC, A63 harness DI, A66 claim-before-send context for S4, A69 enum-home)

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-8 dev-ready prep (A34). The verified no-event-bus finding + the inline-vs-MediatR trigger asymmetry are the load-bearing facts; the secret-storage tension is explicitly surfaced as DEC-2.
- Checklist coverage: ACs concrete + testable; trigger mechanism grounded in verified code (no reinvented event bus); signing/secret reuse named; the `IWebhookDispatchService` seam explicitly handed to S4; depends-on-S1 admin/hashing reuse flagged (A62); i18n parity (hi.json) enforced.
- Remaining risk: the trigger payloads must stay PII-free (reuse the E8-S2 safe-DTO discipline) — review must check payload contents. The exact finance handler chosen for `payment.received` should be the convergent `Invoice.MarkAsPaid` seam; confirm at Task 0. This story defines but does not deliver delivery — S4 fills the seam.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — autonomous full-epic dev-story run (E8 S1→S4).

### Debug Log References

Task 0 — VERIFIED no event bus (DomainEvents collected; `Ignore<DomainEvent>`; no MediatR publish) → triggers are direct post-commit write-path calls. DEC resolutions (A41):
- **DEC-1 = A** direct post-commit write-path call to `IWebhookDispatchService.EmitAsync` (mirrors `PaidRegistrationService`); best-effort, never rolls back the write.
- **DEC-2 = B (correctness override of recommended A):** AES-256-GCM reversible-at-rest, NOT a one-way hash. Rationale: the server must READ the secret to compute the outbound HMAC on every delivery (E8-S4) — a one-way hash makes signing impossible. Show-once at create still honored. (a) chose B / (b) signing needs the cleartext server-side / (c) AES-GCM round-trip test green.
- **DEC-3 = A** `X-Webhook-Signature: sha256=<hex(HMAC-SHA256(secret, rawBody))>`; verify via `FixedTimeEquals`.
- **DEC-4 = A** whitelist = `event.created` + `payment.received` only.

### Completion Notes List

- ✅ AC-1 admin CRUD + lifecycle (`/api/v1/admin/webhooks`) via MediatR + FluentValidation (absolute-https URL, whitelist event types).
- ✅ AC-2 closed `WebhookEventTypes` whitelist; unknown rejected at write boundary; `/event-types` drives the UI.
- ✅ AC-3 `WebhookSignatureService` sha256-hex HMAC; constant-time verify (known-vector + tamper tests).
- ✅ AC-4 secret = `RandomNumberGenerator.GetBytes(32)` base64url; AES-256-GCM encrypted at rest (DEC-2=B); returned once.
- ✅ AC-5 lifecycle audited `WebhookSubscriptionChanged` via `IAuditService`.
- ✅ Triggers (post-commit, best-effort, PII-free): `event.created` from `EventEndpoints.CreateEvent`; `payment.received` from `MarkPaymentAsPaidCommandHandler`. (A68: payment.received wires the explicit mark-as-paid path in v1; other paid transitions are documented future hooks.) `IWebhookDispatchService` seam defined for S4 (resolve+sign now; persist+deliver in S4).
- **Quality gates:** backend `dotnet test` **2356 passed / 0 failed** (1576 Application + 285 Api + 495 Infrastructure incl. Testcontainers); migration `AddWebhookSubscriptions` applies clean. Frontend: `tsc`/`eslint`/`prettier --check` clean on changed files; `vitest` page + de/en/hi parity green. Security: secret never logged; payloads PII-free; dispatch post-commit best-effort.

### File List

Domain (new): `Integration/{WebhookSubscription,WebhookEventTypes,IWebhookSubscriptionRepository}.cs`. (modified): `Audit/AuditEnums.cs`.
Application (new): `Integration/{IWebhookSignatureService,IWebhookSecretService,IWebhookDispatchService,WebhookDtos}.cs` + `Commands/{CreateWebhookSubscriptionCommand,UpdateWebhookSubscriptionCommand,WebhookLifecycleCommands}.cs` + `Queries/ListWebhookSubscriptionsQuery.cs`. (modified): `Finance/Payments/Commands/MarkPaymentAsPaidCommandHandler.cs`.
Infrastructure (new): `Integration/{WebhookOptions,WebhookSecretService,WebhookSignatureService,WebhookDispatchService}.cs` + `Persistence/Configurations/WebhookSubscriptionConfiguration.cs` + `Persistence/Repositories/WebhookSubscriptionRepository.cs` + `Migrations/*_AddWebhookSubscriptions.cs`. (modified): `DependencyInjection.cs`, `Persistence/ApplicationDbContext.cs`.
API (new): `Endpoints/WebhookEndpoints.cs`. (modified): `Endpoints/EndpointMapper.cs`, `Endpoints/EventEndpoints.cs`.
Tests (new): `Application.Tests/Integration/WebhookSubscriptionTests.cs`; `Infrastructure.Tests/Integration/WebhookSignatureAndSecretTests.cs`, `Repositories/WebhookSubscriptionRepositoryTests.cs`; `Api.Tests/Endpoints/WebhookEndpointTests.cs`, `Api.Tests/TestWebhookDispatchService.cs`. (modified): `Api.Tests/TestWebApplicationFactory.cs`, `Application.Tests/Finance/PaymentApprovalHandlerTests.cs`.
Frontend (new): `app/admin/webhooks/page.tsx`(+`page.test.tsx`), `lib/api/webhooks.ts`. (modified): `messages/{de,en,hi}.json`.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Implemented (autonomous E8 run). DEC-2=B (AES-GCM reversible at rest — correctness override so S4 can sign); others option A. Backend 2356 tests green; frontend green. Status → review.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (VERIFIED no event bus → write-path triggers at EventEndpoints.cs:435 + Invoice.MarkAsPaid; HMAC signing + show-once secret reuse; communication/automations admin scaffold), DEC-1..4, defines the IWebhookDispatchService seam consumed by S4.
