# Story E8.S4: Add Webhook Delivery, Retry, and History

Status: done

## Story

As an Admin/IT user,
I want webhook deliveries to be queued, retried, and recorded with full delivery history,
so that integration failures can be diagnosed and a persistently-failing subscription is automatically paused without overexposing sensitive payload data.

## Acceptance Criteria

1. Webhook deliveries are **queued through Hangfire** (out-of-band; a slow/failing receiver never blocks the originating event/payment write).
2. Each delivery **records attempt count, response status, failures, and next-retry timing** in a `WebhookDelivery` history row.
3. An admin can **view delivery history** (per subscription and/or global), with status, attempts, response code, timestamps, and target.
4. **Repeated failures pause/disable a subscription** per a configurable policy; a subsequent success resets the failure count.
5. **Sensitive payload data is not overexposed** in logs or the history UI (metadata + redacted/omitted body; never the signing secret).

## Tasks / Subtasks

- [x] Task 0: Spike + confirm S3 seam (AC: all) — resolve DEC-1..DEC-4 (see Decision-Needed)
  - [x] Confirm S3 shipped the consumable seam (A62): `WebhookSubscription` (with `Status` + the failure-tracking fields), `IWebhookDispatchService.EmitAsync` (intent persistence/enqueue), the `WebhookSignatureService`, and `GetActiveForEventTypeAsync`. If absent, escalate.
  - [x] Confirm Hangfire shape: registration `Infrastructure/DependencyInjection.cs:218-230`; **7** recurring jobs at `Api/DependencyInjection.cs:364-417`; one-off `BackgroundJob.Enqueue` precedent `EmailCampaignJobService.cs:44` (+ `Schedule`/`Delete`). The A44 uniqueness test `RegisterDailyBackupJobTests.cs:46-67` asserts `HaveCount(7)` — confirm current N=7.
  - [x] Confirm the claim-before-send reference (A66/A67): `AutomationExecutionService.cs:112-142` (build Pending rows → `AddAsync` commits the claim + unique key BEFORE send → catch collision + abandon → send loop marks Sent/Failed → `UpdateAsync`); unique index `AutomationExecutionConfiguration.cs:74`; tests `AutomationExecutionServiceTests.cs:129-170`, Testcontainers `AutomationExecutionRepositoryTests.cs:72-84`.
  - [x] Confirm the persistence chain to clone (`AutomationExecution` entity→config→repo→migration→Testcontainers test) + the admin history UI template `frontend/src/app/admin/audit/page.tsx`.
- [x] Task 1: Domain — `WebhookDelivery` + subscription failure policy (AC: 2, 4)
  - [x] `WebhookDelivery` entity (`Domain/Integration/WebhookDelivery.cs`): `Id`, `SubscriptionId`, `EventType`, `Status` (Pending/Delivered/Failed), `AttemptCount`, `ResponseStatusCode?`, `Error?`, `NextRetryAt?`, `DedupKey` (date-free, e.g. `subscriptionId|eventId` per A67), `CreatedAt`, `LastAttemptAt?`, redacted/stored payload per DEC-4. Factory `Pending(...)`; methods `MarkDelivered(int statusCode)`, `MarkFailed(int? statusCode, string error, DateTimeOffset? nextRetryAt)`.
  - [x] Extend `WebhookSubscription` (S3) with `ConsecutiveFailureCount` + guarded `RecordFailure()` (increments; auto-transitions to `Paused` when count ≥ threshold) and `RecordSuccess()` (resets to 0), mirroring `EmailCampaign`'s guarded status transitions. A paused subscription's deliveries are skipped (eligibility-skip precedent).
- [x] Task 2: Infrastructure — persistence + delivery job + outbound HTTP (AC: 1, 2, 5)
  - [x] Clone the `AutomationExecution` persistence chain for `WebhookDelivery`: `WebhookDeliveryConfiguration.cs` (`webhook_deliveries`, snake_case, `Status`/`EventType` `HasConversion<string>()`, `Ignore(DomainEvents)`, **unique index on `DedupKey`**), repository (`AddAsync`, `UpdateAsync`, `GetRecentForSubscriptionAsync(... OrderByDescending(CreatedAt).Take(limit))`, a global paged history query), ONE migration after the S3 migration.
  - [x] Implement S3's `IWebhookDispatchService.EmitAsync`: persist a `WebhookDelivery` row as **Pending** (claim-before-send, A66) with the date-free `DedupKey` → `SaveChangesAsync` (commits the claim + unique key) → catch `DbUpdateException` collision and abandon (idempotent re-emit) → `BackgroundJob.Enqueue<WebhookDeliveryJob>(j => j.ExecuteAsync(deliveryId, CancellationToken.None))` (DEC-1, one-off per `EmailCampaignJobService.cs:44`).
  - [x] `WebhookDeliveryJob` (thin wrapper templated on `AutomationDispatchJob.cs:33-56`): `[AutomaticRetry(Attempts = 5)]` + `[JobDisplayName(...)]` (NO `[DisableConcurrentExecution]` — per-delivery jobs must run in parallel; DEC-2). Delegates to an injectable `IWebhookDeliveryService` that: loads the Pending row, skips if the subscription is Paused/Disabled, signs the body (S3 signature service), POSTs via a named `HttpClient` with a short timeout, then `MarkDelivered`/`MarkFailed` + `RecordSuccess`/`RecordFailure` on the subscription, `SaveChangesAsync`. Rethrow on failure so Hangfire `[AutomaticRetry]` owns the backoff (persist `AttemptCount`/`ResponseStatusCode`/`LastAttemptAt`/`NextRetryAt` for the history view).
  - [x] Outbound HTTP: register `services.AddHttpClient("webhooks", c => { c.Timeout = <short>; })` (named — target URLs are dynamic per subscription) per the `IKeycloakAdminService` typed-client precedent; inject `IHttpClientFactory`. **SSRF guard (net-new, no precedent):** reject/skip target URLs resolving to private/loopback/link-local ranges before POSTing.
- [x] Task 3: Application + API — delivery history endpoints (AC: 3)
  - [x] Query/DTO for delivery history (per subscription + global paged), templated on `GetAutomationExecutionsQuery.cs:7-40` + `PagedResult<T>` + `PaginationHelper`. History DTO carries metadata only (status/code/attempts/timestamps/target/eventType) — NOT the raw body or secret (AC-5).
  - [x] Endpoints under the admin webhooks group (`GET /api/v1/admin/webhooks/{id}/deliveries`, and/or a global `GET /api/v1/admin/webhook-deliveries`), `RequireRole("admin")`. A63: register new injected services in endpoint-metadata harnesses.
- [x] Task 4: Frontend — delivery history UI (AC: 3, 5)
  - [x] Delivery-history view (a tab/subpage under `frontend/src/app/admin/webhooks/[id]` and/or a global page) templated on `frontend/src/app/admin/audit/page.tsx` (filter panel, status pills, paginated table, prev/next). Columns: status, response code, attempt count, created/last-attempt timestamps, target, event type. **Redact/omit the raw payload and never render the secret** (AC-5). i18n keys in `de.json` + `en.json` + `hi.json` (parity test).
- [x] Task 5: Tests (AC: all)
  - [x] Domain: `WebhookDelivery` MarkDelivered/MarkFailed transitions; subscription `RecordFailure`→Paused at threshold + `RecordSuccess` reset.
  - [x] Infrastructure: Testcontainers repository round-trip + recent-for-subscription ordering + **unique-DedupKey rejects duplicate** (clone `AutomationExecutionRepositoryTests.cs:72-84`). Claim-before-send tests (A66): a delivery row is persisted Pending BEFORE the POST; a duplicate emit collides + abandons without a second enqueue.
  - [x] Delivery job/service: success → Delivered + RecordSuccess; failure → Failed + AttemptCount/NextRetryAt persisted + rethrow (Hangfire retry); paused subscription → skipped; SSRF target → skipped/rejected. Mock the `HttpClient` (no real outbound).
  - [x] A44: confirm NO recurring job added (one-off Enqueue) → `RegisterDailyBackupJobTests` HaveCount stays 7 (do not touch). If DEC-2 elects a recurring sweeper, bump 7→8 + add a `*JobRegistrationTests` stable-contract test.
  - [x] Frontend: history table renders rows + status pills; payload not rendered (AC-5); stable `useTranslations` mock (A64), `afterEach(cleanup)` + jsdom (A35/A46).
- [x] Task 6: Quality gates (AC: all)
  - [x] A29 per-AC table. Backend builds 0/0; `dotnet test` (Application + Api + Infrastructure incl. Testcontainers). Frontend: `tsc`/`eslint`/`prettier --check` on changed files (A58/A72) + `vitest run`.
  - [x] Security/A68 self-check: history + logs carry metadata only (no body/secret); the disable policy degrades to **less** delivery (pause), never wrong; claim-before-send proven crash-safe by test (A66 — run-twice alone is insufficient).

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub. Greenfield; the project's E5 Communication-Automation engine is the reference implementation to clone. Spike findings:

- **Hangfire one-off enqueue exists and is the right tool.** Registration `Infrastructure/DependencyInjection.cs:218-230`; **7** recurring jobs at `Api/DependencyInjection.cs:364-417`; the one-off precedent is `EmailCampaignJobService.cs:44` (`BackgroundJob.Enqueue<EmailCampaignSendJob>(...)`, plus `Schedule`/`Delete`). Webhook delivery is event-driven one-off — use `BackgroundJob.Enqueue`, NOT a recurring cron. The A44 test `RegisterDailyBackupJobTests.cs:46-67` asserts `HaveCount(7)`; one-off enqueue adds **no** recurring job so this test stays untouched (N=7). (Only if a recurring sweeper is chosen, DEC-2=B, does it need a bump.)
- **Job template = `AutomationDispatchJob.cs:33-56`:** `[DisableConcurrentExecution(...)]` + `[AutomaticRetry(Attempts=3)]` + `[JobDisplayName]`, thin wrapper delegating to an injectable service + rethrow so Hangfire retries. For webhooks: `[AutomaticRetry(Attempts=5)]` (more retries than email), **omit `[DisableConcurrentExecution]`** (it would serialize independent per-delivery jobs — concurrency is controlled by the delivery row's claim, not the job). Per-row send/mark/continue loop reference: `AutomationExecutionService.cs:144-194`; simpler in-job variant `EmailCampaignSendJob.ExecuteAsync:146-186`.
- **Claim-before-send (A66/A67) reference:** `AutomationExecutionService.cs:112-142` builds Pending rows, `AddAsync` commits the claim + unique key BEFORE any send (`:132`), catches `DbUpdateException` collision and abandons before sending (`:134-142`); unique index `AutomationExecutionConfiguration.cs:74`; entity factory `AutomationRecipient.Pending(...)`. Tests: `ClaimIsPersistedBeforeSending` (`:149-170`), `ClaimCollision_AbandonsRun` (`:129-147`), Testcontainers `UniqueIndex_RejectsDuplicate` (`AutomationExecutionRepositoryTests.cs:72-84`). Mirror exactly: persist `WebhookDelivery` Pending (date-free `DedupKey` per A67) → `SaveChangesAsync` → POST → Mark. This is the load-bearing reuse.
- **Persistence chain to clone:** entity `AutomationExecution.cs`/`AutomationRecipient.cs` → config `AutomationExecutionConfiguration.cs:13-76` (snake_case `ToTable`, `HasConversion<string>()`, unique idempotency index, cascade) → repo `AutomationExecutionRepository.cs` (`AddAsync:34`, `UpdateAsync:40`, `GetRecentForDefinitionAsync:46-52`) → migration `20260606181150_AddAutomationExecutions.cs` → Testcontainers `AutomationExecutionRepositoryTests.cs:16-99` (`new PostgreSqlBuilder("postgres:18")`, `MigrateAsync`/round-trip).
- **Admin history UI template = `frontend/src/app/admin/audit/page.tsx`:** admin-gate redirect, filter panel (date-range/category/status), paginated `fetchEvents`, status-pill table, prev/next. Backend list-query shape `GetAutomationExecutionsQuery.cs:7-40`.
- **Disable-on-failure is net-new (no circuit-breaker precedent).** Closest = `EmailCampaign.cs` guarded status transitions (`StartSending:161`/`Cancel:199`/`MarkAsFailed:211`, each validating current status) + the eligibility `MarkSkipped` skip. Add `ConsecutiveFailureCount` + `Status(Active/Paused/Disabled)` to `WebhookSubscription` with guarded `RecordFailure()`/`RecordSuccess()`; pause (reversible) over hard-disable; threshold config-bound (DEC-3).
- **Outbound HttpClient:** typed-client precedent `Infrastructure/DependencyInjection.cs:216` (`AddHttpClient<IKeycloakAdminService,...>`); `IHttpClientFactory` also in `Api/HealthChecks/KeycloakHealthCheck.cs:8`. Use a **named** client (`"webhooks"`) since targets are dynamic, with an explicit short timeout so a slow receiver doesn't tie up a Hangfire worker. No Polly in the project — Hangfire `[AutomaticRetry]` is the retry mechanism. **SSRF guarding is net-new** — flag + implement a private-IP block.
- **Sensitive payloads:** architecture `:857-865` "Background Job Rules" — avoid exposing sensitive payloads in logs; idempotency/dup-prevention; respect cancellation. History UI + logs show metadata only; redact/omit the raw body; never the secret (AC-5).

### Files to change

- Domain (new): `Domain/Integration/WebhookDelivery.cs`. (modified) `Domain/Integration/WebhookSubscription.cs` (failure policy + `RecordFailure`/`RecordSuccess`).
- Infrastructure (new): `Persistence/Configurations/WebhookDeliveryConfiguration.cs`; `Persistence/Repositories/WebhookDeliveryRepository.cs` (+ interface); `Integration/WebhookDeliveryJob.cs` + `WebhookDeliveryService.cs` (+ `IWebhookDeliveryService`); the `IWebhookDispatchService` impl from S3 gains the claim+enqueue body; migration; `DependencyInjection.cs` (`AddHttpClient("webhooks")`, register job/service/repo).
- Application (new): delivery-history query + DTOs.
- API (modified): `Endpoints/WebhookEndpoints.cs` (history endpoints) + A63 harness registrations.
- Frontend (new): delivery-history view under `frontend/src/app/admin/webhooks` + typed wrapper. (modified) `frontend/messages/{de,en,hi}.json`.
- Tests: domain, Testcontainers repo + claim/collision, delivery job/service, A44 confirmation, frontend.

### Scope Boundaries

In scope:

- `WebhookDelivery` persistence + history, Hangfire one-off delivery job with retry, claim-before-send idempotency, signed POST via named HttpClient + SSRF guard, subscription auto-pause-on-failure policy, admin history UI, payload redaction.

Out of scope:

- Subscription CRUD + signing + the dispatch seam definition (E8-S3 — this story fills the seam).
- The external read API (E8-S2), credentials/auth (E8-S1).
- An outbox/at-least-once delivery guarantee (Hangfire at-least-once + claim-before-send is the v1 model); per-subscription rate shaping.

### Architecture Guardrails

- Delivery is out-of-band (Hangfire) so a failing receiver never blocks/rolls back the originating write (AC-1).
- **Claim-before-send (A66):** persist the Pending delivery row + commit the unique `DedupKey` BEFORE the POST; a crash mid-flight must not cause a duplicate on retry. A run-twice test alone does NOT prove crash-safety — include a claim-persisted-before-send test + a collision-abandons test.
- **Date-free dedup key (A67):** never embed the run date in the key — webhook delivery is fire-once-per-event, not per-day.
- Idempotent job: `[AutomaticRetry]` may re-run `ExecuteAsync`; loading by `deliveryId` + skipping already-Delivered rows keeps retries safe. No `[DisableConcurrentExecution]` on the per-delivery job.
- **A68/A71 — disable policy degrades to LESS, not wrong:** auto-**pause** (reversible) after a configurable consecutive-failure threshold; a paused subscription visibly shows paused state in the admin UI (not a silent stop). Reset on first success.
- **AC-5:** logs + history carry metadata only; redact/omit the raw body; never log/render the signing secret.
- SSRF: validate the target resolves to a public address before POSTing.
- Frontend: shared components, standard layout, orange primary, next-intl de/en/hi parity.

### Testing Requirements

- Backend: xUnit v3 + FluentAssertions; Moq for the `HttpClient`/`IHttpClientFactory` boundary (no real outbound). Domain transition tests; Testcontainers PostgreSQL repository + unique-DedupKey rejection + claim-before-send + collision-abandon (NOT EF InMemory). Delivery-service tests: success/failure/paused-skip/SSRF-skip/retry-rethrow. A44: assert recurring-job count unchanged (7) for the one-off approach.
- Frontend: Vitest + Testing Library; history render + payload-not-rendered; stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom (A35/A46).
- Gates: `dotnet test`; `npx eslint`/`prettier --check` on changed files (A58/A72) + `vitest run`.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — Delivery trigger: one-off `BackgroundJob.Enqueue` vs recurring sweeper.**
  - (A, recommended) **One-off `Enqueue`** per delivery (`EmailCampaignJobService.cs:44`). Rationale: event-driven; Hangfire `[AutomaticRetry]` handles retry timing natively; adds no recurring job so the A44 `HaveCount(7)` test is untouched.
  - (B) recurring "delivery dispatcher"/"retry sweeper" cron. Rejected for v1: needs a job-id constant + a `HaveCount(7→8)` bump + a registration test, for no benefit over native retry.
- **DEC-2 — Retry mechanism: Hangfire `[AutomaticRetry]` vs custom next-retry column + sweeper.**
  - (A, recommended) **`[AutomaticRetry(Attempts=5)]`**, persisting `AttemptCount`/`ResponseStatusCode`/`LastAttemptAt`/`NextRetryAt` to the row for history. Rationale: reuses the E5/email job attribute pattern; no custom scheduler; Hangfire owns the backoff.
  - (B) custom `NextRetryAt` + recurring sweeper. Rejected: re-implements Hangfire's retry; couples to DEC-1=B.
- **DEC-3 — Disable policy: threshold + pause vs hard-disable.**
  - (A, recommended) **Auto-pause after a configurable threshold (default ~15 consecutive failures), reset on first success.** Rationale: no precedent (net-new); pause is reversible (admin re-activates) and matches the reversible `EmailCampaign` status style; threshold config-bound, not hard-coded.
  - (B) hard-disable. Rejected: irreversible without an explicit re-enable; harsher than needed for transient receiver outages.
- **DEC-4 — Payload storage in history: full body vs redacted/metadata-only.**
  - (A, recommended) **Metadata + redacted/truncated payload, never the secret.** Rationale: architecture `:863` mandates "avoid exposing sensitive payloads in logs"; the admin history surfaces status/code/attempt/target/event-type; raw-body access gated or omitted.
  - (B) full body stored + shown. Rejected: overexposure risk (AC-5), larger rows.

### Project Structure Notes

- Backend: `IabConnect.Domain/Integration`, `IabConnect.Application/Integration`, `IabConnect.Infrastructure/{Integration,Persistence/Configurations,Persistence/Repositories,Migrations}`, `IabConnect.Api/Endpoints`.
- Backend tests: `IabConnect.Application.Tests` (domain/transitions/delivery-service), `IabConnect.Infrastructure.Tests` (Testcontainers repo + claim/collision), `IabConnect.Api.Tests` (history endpoints + A44 + A63 harness).
- Frontend: `frontend/src/app/admin/webhooks`, `frontend/src/lib/services`, `frontend/messages/{de,en,hi}.json`.

### References

- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs:218-230` (Hangfire), `backend/src/IabConnect.Api/DependencyInjection.cs:364-417` (7 recurring jobs), `Infrastructure/Communication/EmailCampaignJobService.cs:44` (one-off Enqueue), `tests/IabConnect.Api.Tests/RegisterDailyBackupJobTests.cs:46-67` (A44, N=7)
- `backend/src/IabConnect.Infrastructure/Communication/Jobs/AutomationDispatchJob.cs:33-56` (job template), `Communication/AutomationExecutionService.cs:112-142,144-194` (claim-before-send + send loop), `EmailCampaignSendJob.cs:146-186`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/AutomationExecutionConfiguration.cs:13-76` (config + unique index), `Repositories/AutomationExecutionRepository.cs:34-52`, `Migrations/20260606181150_AddAutomationExecutions.cs`, `tests/IabConnect.Infrastructure.Tests/Repositories/AutomationExecutionRepositoryTests.cs:16-99`
- `backend/src/IabConnect.Domain/Finance/EmailCampaign.cs:161-215` (guarded status transitions), `Application/Communication/Queries/GetAutomationExecutionsQuery.cs:7-40`
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs:216` (typed HttpClient), `Api/HealthChecks/KeycloakHealthCheck.cs:8` (IHttpClientFactory)
- `frontend/src/app/admin/audit/page.tsx` (history UI template); `frontend/messages/{de,en,hi}.json` + `messages.parity.test.ts`
- E8-S3 seam (this story consumes): `WebhookSubscription`, `IWebhookDispatchService`, `WebhookSignatureService`, `GetActiveForEventTypeAsync`
- `_bmad-output/planning-artifacts/architecture.md:739-758` (REQ-058), `:857-865` (background-job rules); `prd.md:428-435`; `epics-and-stories.md:932-955` (E8-S4 source)
- `_bmad-output/project-context.md` (A56 spike, A44 job-id uniqueness, A62 sibling-DEC, A63 harness DI, A66 claim-before-send, A67 date-free key, A68/A71 degrade-to-less)

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-8 dev-ready prep (A34). The E5 automation-engine clone (claim-before-send + persistence chain + one-off Enqueue keeping A44 at N=7) is the load-bearing reuse; the disable policy + SSRF guard are the genuinely net-new surfaces.
- Checklist coverage: ACs concrete + testable; reuse over reinvention (Hangfire one-off + AutomationExecution chain + audit history UI); A66 crash-safety made explicitly testable (not run-twice); A67 date-free key; A68/A71 pause-degrades-to-less; AC-5 payload redaction; depends-on-S3 seam flagged (A62).
- Remaining risk: SSRF guarding has no in-repo precedent — review must confirm the private-IP block is real, not a TODO. Confirm the latest migration timestamp (it advances across S1→S3) at Task 0. If DEC-2=B (recurring sweeper) is ever chosen, the A44 count bump + registration test become mandatory.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — autonomous full-epic dev-story run (E8 S1→S4).

### Debug Log References

Task 0 — S3 seam verified (A62). DEC resolutions (A41, all option A):
- **DEC-1 = A** one-off `BackgroundJob.Enqueue` per delivery (via `IWebhookDeliveryEnqueuer`); no recurring job → A44 `HaveCount(7)` untouched (verified green).
- **DEC-2 = A** `[AutomaticRetry(Attempts=5)]` owns backoff; attempt/code/timestamps persisted. No `[DisableConcurrentExecution]` (per-delivery parallelism; claim bounds concurrency).
- **DEC-3 = A** auto-pause after configurable `Webhooks:PauseThreshold` (default 15), reset on success; reversible (A68/A71).
- **DEC-4 = A** history DTO metadata-only; full body stored on the row for delivery/signing but omitted from the projection + logs; secret never exposed.

### Completion Notes List

- ✅ AC-1 deliveries enqueued out-of-band via Hangfire one-off job; dispatch is post-commit best-effort.
- ✅ AC-2 `WebhookDelivery` records attempt count / response code / error / next-retry / timestamps + status.
- ✅ AC-3 admin history endpoints (per-subscription + global paged) + frontend history page.
- ✅ AC-4 `RecordFailure(threshold)` auto-pauses at threshold; `RecordSuccess`/`Enable` reset the streak.
- ✅ AC-5 history projection + logs metadata-only; raw body + secret never returned/logged (endpoint test asserts payload sentinel absent).
- ✅ Claim-before-send (A66/A67): Pending row + unique date-free `DedupKey` committed BEFORE enqueue; collision abandons w/o second enqueue (unit + Testcontainers unique-index tests). SSRF guard blocks loopback/private/link-local/ULA/CGNAT before any POST (net-new, tested). Named `"webhooks"` HttpClient, short timeout.
- **Quality gates:** backend `dotnet test` **2375 passed / 0 failed** (1584 Application + 288 Api + 503 Infrastructure incl. Testcontainers); A44 recurring-job count unchanged at **7**. Migration `AddWebhookDeliveries` applies clean (unique `dedup_key` + `consecutive_failure_count`). Frontend: `tsc`/`eslint`/`prettier --check` clean on changed files; `vitest` history page + de/en/hi parity green. A68: pause degrades to less (reversible); claim-before-send proven crash-safe by test.

### File List

Domain (new): `Integration/{WebhookDelivery,IWebhookDeliveryRepository}.cs`. (modified): `Integration/WebhookSubscription.cs` (failure policy).
Application (new): `Integration/IWebhookDeliveryService.cs` (+`IWebhookDeliveryEnqueuer`) + `Queries/GetWebhookDeliveriesQuery.cs` (+`WebhookDeliveryDto`).
Infrastructure (new): `Integration/{WebhookDeliveryOptions,SsrfGuard,WebhookDeliveryService,WebhookDeliveryJob}.cs` + `Persistence/Configurations/WebhookDeliveryConfiguration.cs` + `Persistence/Repositories/WebhookDeliveryRepository.cs` + `Migrations/*_AddWebhookDeliveries.cs`. (modified): `Integration/WebhookDispatchService.cs` (claim+enqueue), `Persistence/Configurations/WebhookSubscriptionConfiguration.cs`, `DependencyInjection.cs`, `Persistence/ApplicationDbContext.cs`.
API (modified): `Endpoints/WebhookEndpoints.cs` (history endpoints).
Tests (new): `Application.Tests/Integration/WebhookDeliveryTests.cs`; `Infrastructure.Tests/Integration/WebhookDeliveryServiceTests.cs`, `Repositories/WebhookDeliveryRepositoryTests.cs`; `Api.Tests/Endpoints/WebhookDeliveryHistoryEndpointTests.cs`. (modified): `Infrastructure.Tests/Integration/WebhookSignatureAndSecretTests.cs`.
Frontend (new): `app/admin/webhooks/deliveries/page.tsx`(+`page.test.tsx`). (modified): `app/admin/webhooks/page.tsx`, `lib/api/webhooks.ts`, `messages/{de,en,hi}.json`.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Implemented (autonomous E8 run). All DECs → option A. Claim-before-send + SSRF guard + auto-pause delivered. Backend 2375 tests green (A44 stays 7); frontend green. Status → review.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (clone the E5 AutomationExecution engine: one-off BackgroundJob.Enqueue keeping A44 N=7, claim-before-send A66/A67, persistence chain, admin/audit history UI; net-new disable policy + SSRF guard), DEC-1..4, fills the IWebhookDispatchService seam from S3.
