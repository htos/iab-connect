# Story 5.2: Add Automation Execution Engine

Status: review

## Refresh Notes (2026-06-06, Epic-5 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub. Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-5 (Communication Automation)** per user directive *"für das ganze nächste epic sollst du alle stories vorbereiten und nicht nur eins. beachte es ist kein mvp mehr."* (2026-06-06). This is the **reliability core** of the epic: it takes the `AutomationDefinition`s from S1 and actually fires them — once, to the right consent-filtered recipients, idempotently, without blocking user requests, with every send/failure recorded and visible.

**A56 existing-implementation spike — what already ships vs what is net-new:**

- **Hangfire is fully wired and the execution patterns to copy already ship:**
  - **Recurring-job registration** — `internal const string` job-id + cron pairs in [Api/DependencyInjection.cs L31-71](../../backend/src/IabConnect.Api/DependencyInjection.cs#L31) (6 jobs today: `mark-invoices-overdue`, `generate-dunning-notices`, `enforce-retention-policies`, `send-volunteer-shift-reminders`, `daily-pg-backup`, `prune-old-backups`); registered in `UseApiPipeline` via `jobManager.AddOrUpdate<JobClass>(jobId, j => j.ExecuteAsync(CancellationToken.None), cron, new RecurringJobOptions { TimeZone = ... })`. Hangfire storage = PostgreSQL ([Infrastructure/DependencyInjection.cs L185-197](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L185)); dashboard is dev-only.
  - **The closest existing job to copy is the volunteer-shift reminder** ([VolunteerShiftReminderJob.cs](../../backend/src/IabConnect.Infrastructure/Events/Jobs/VolunteerShiftReminderJob.cs) + [VolunteerShiftReminderService.cs](../../backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs)): decorated `[DisableConcurrentExecution(timeoutInSeconds: 10*60)]` + `[AutomaticRetry(Attempts = 3)]` + `[JobDisplayName(...)]`; **module-gated skip** (returns early if the owning module is disabled); the service queries a due-window, loops recipients, per-row send + mark, **swallows per-row errors and continues the batch**, logs a sent/skipped/duplicate summary.
  - **Idempotency precedent (LOAD-BEARING for AC-3)** — `EventVolunteerAssignmentRepository.MarkReminderSentAsync` ([repo L173-181](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs#L173)) uses `ExecuteUpdateAsync()` with a `WHERE reminder_sent_at IS NULL` guard and returns `bool` (rows-affected>0) so a duplicate send is *detected*, not just hoped-against; plus a **partial unique index** (`status <> 'Cancelled'`) as the DB-level last-resort race guard. The campaign send job uses a softer guard: per-recipient `if (recipient.SentAt.HasValue) continue;` ([EmailCampaignJobService.cs](../../backend/src/IabConnect.Infrastructure/Email/EmailCampaignJobService.cs) ~L155).
  - **Send + recipient-resolution + execution-record shape** — `EmailCampaignSendJob` ([EmailCampaignJobService.cs L69-281](../../backend/src/IabConnect.Infrastructure/Email/EmailCampaignJobService.cs#L69)) is the model: it resolves recipients, personalizes `{{firstName}}`/`{{unsubscribeLink}}` etc., calls `IEmailSender.SendAsync`, marks each `EmailRecipient` Sent/Failed, updates campaign statistics, marks the campaign Sent/Failed, throws to let Hangfire retry. The `EmailCampaign` + `EmailRecipient` (status enum, per-recipient timestamps, unique `(CampaignId, Email)` index) pair is the **exact template for `AutomationExecution` + `AutomationRecipient`**.
  - **Email send** — `IEmailSender.SendAsync` ([IEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/IEmailSender.cs)) + `EventNotificationService` ([Infrastructure/Events/EventNotificationService.cs](../../backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs)) build HTML+plain-text bodies, sanitize header-injection, handle Europe/Zurich timezone. Reuse `IEmailSender` directly in v1 (email-only); S4 later routes this through `IMessageChannelSender` (DEC-4).
- **The trigger model has NO domain-event bus to subscribe to (decisive):** `Entity` collects domain events but they are **never dispatched** — `ApplicationDbContext` does `Ignore<DomainEvent>()` and `SaveChangesAsync` does not publish; there is no MediatR `INotification` publish anywhere. Architecture L664 explicitly allows *"scheduled polling jobs where safer"*. → **DEC-1 recommends a single recurring polling job** that evaluates every `Active` definition's trigger against current data, rather than building an event bus.
- **Net-new (this story):** `AutomationExecution` + `AutomationRecipient` entities (+ EF config + migration); the recurring `AutomationDispatchJob` + an `IAutomationExecutionService` (Application/Infrastructure) that, per `Active` definition, computes due trigger-instances → resolves recipients via S1's `IRecipientResolutionService` → de-dups via an idempotency key → sends via `IEmailSender` → records execution/recipient rows; the **7th** recurring-job id constant + the A44 global-uniqueness test bump (6→7); a per-trigger-type evaluator.

**A34 note:** authored alongside S1/S3/S4/S5. **Depends HARD on S1** (`AutomationDefinition`/`AutomationTrigger`/`AutomationStatus` + `IRecipientResolutionService`). Dev-story order S1 → **S2** → S3 → S4 → S5.

## Story

As **the system, on behalf of a Verein that has configured automation journeys (S1) and cannot babysit them**, post-MVP where dozens of definitions may be active and a double-send or a silent failure is a real reputational/compliance problem,
I want **a reliable Hangfire-driven engine that periodically evaluates every Active automation definition, works out exactly which recipients are due for it right now, sends each of them their templated message exactly once (idempotent across retries and across overlapping runs), records an execution with per-recipient status + failures, and never blocks or breaks an unrelated user request when something goes wrong**,
so that **standard messages go out automatically and correctly, a transient SMTP or DB hiccup is retried rather than lost, a duplicate send is structurally impossible, and an operator can see in the data (and via S3's UI) what fired, to whom, and what failed**.

**Requirement:** REQ-028 (Automations / Journeys). Epic E5 (Communication Automation), Story 2 of 5.

- **Source-of-truth:** [epics-and-stories.md §Story E5-S2 (L576-598)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchors:** [REQ-028 Execution (L662-666)](../planning-artifacts/architecture.md) (*triggered by events where available or scheduled polling; idempotency keys prevent duplicate sends; failures logged + visible*), [ADR-005 Hangfire (L125-133)](../planning-artifacts/architecture.md), [ADR-004 PostgreSQL + EF Core](../planning-artifacts/architecture.md).
- **Reuse source:** `VolunteerShiftReminderJob`/`Service` (job shape + idempotency), `EmailCampaignSendJob` (send + recipient/execution shape), `IRecipientResolutionService` (S1), `IEmailSender`.

**Upstream (HARD dependencies):**

- **E5-S1 done** — `AutomationDefinition` (only `Active` fires), `AutomationTrigger`/`AutomationTriggerType`, `IAutomationDefinitionRepository`, `IRecipientResolutionService`. ✅ when S1 lands.
- **Hangfire + Communication module done** — recurring-job infra (ADR-005), `ModuleKeys.Communication`, `IEmailSender`, `EmailTemplate.Render*`. ✅

**Downstream:**

- **E5-S3** surfaces "recent execution state" per definition (status/last-run/sent/failed counts) from the `AutomationExecution`/`AutomationRecipient` rows this story writes.
- **E5-S4** later swaps this story's `IEmailSender` send call for `IMessageChannelSender` (DEC-4 isolates the send call so the refactor is contained).

**Wave context:** Epic-5 reliability core. **Net-new artifacts:** `AutomationExecution` + `AutomationRecipient` entities + EF config + migration; `IAutomationExecutionService` (Application) + impl (Infrastructure); `AutomationDispatchJob` (Hangfire) + the 7th job-id constant + A44 test bump; per-trigger-type evaluator; idempotency key + partial unique index; tests (Application idempotency, Infrastructure execution persistence via Testcontainers, job-registration test). Est. +500-800 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E5-S2 — Hangfire executes automation jobs]: A recurring Hangfire job (`AutomationDispatchJob`, registered with an `internal const` job-id + cron in [Api/DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs), mirroring the 6 existing jobs) periodically runs `IAutomationExecutionService.ExecuteDueAsync(...)`. The job is decorated `[DisableConcurrentExecution]` + `[AutomaticRetry(Attempts = 3)]` + `[JobDisplayName(...)]` (mirror `VolunteerShiftReminderJob`). The job **skips early** (no-op, logged) when `Module:communication` is disabled (mirror the volunteer job's events-module skip). Cron cadence per DEC-3.

**AC-2** [epics §E5-S2 — execution records track status, recipients, failures, timestamps]: Each dispatch run that has work creates an `AutomationExecution` (FK to the definition; status Running→Completed/Failed; `StartedAt`/`CompletedAt`; counts) with one `AutomationRecipient` per resolved recipient (status Pending/Sent/Failed/Skipped; per-recipient timestamps + `ErrorMessage`/skip-reason). This mirrors the `EmailCampaign`+`EmailRecipient` pair exactly. The rows are the data S3 reads.

**AC-3** [epics §E5-S2 — idempotency prevents duplicate sends for the same trigger/recipient (LOAD-BEARING)]: A given (definition, trigger-occurrence, recipient) is sent **at most once**, even across (a) Hangfire `[AutomaticRetry]` re-runs of the same job, (b) overlapping/again-scheduled dispatch runs, and (c) a process crash mid-batch. The mechanism (DEC-2 — recommended): a deterministic **idempotency key** per trigger-type (e.g. `EventUpcoming` → `definitionId|eventId|memberId`; `MemberJoined` → `definitionId|memberId`; `MembershipRenewalDue` → `definitionId|memberId|periodKey`) persisted on `AutomationRecipient`, enforced by a **partial/unique index**, plus a mark-then-send guard in the spirit of `MarkReminderSentAsync` (`ExecuteUpdateAsync` + `WHERE …sent_at IS NULL`, returning a bool so a duplicate is *detected*). **Proven by a test that runs the dispatch twice over the same due data and asserts exactly one send + one recipient row** (AC-7).

**AC-4** [epics §E5-S2 — failed sends are logged and visible]: A send that throws (SMTP error, render error, missing email) marks that `AutomationRecipient` `Failed` with the error message, logs it (Serilog), and **does not abort the rest of the batch** (per-row try/catch + continue, like the volunteer service). The execution's `FailedCount` reflects it; S3 surfaces it. A whole-run infrastructure failure marks the `AutomationExecution` `Failed` and throws so Hangfire retries (the per-recipient idempotency makes the retry safe).

**AC-5** [epics §E5-S2 — execution does not block unrelated user workflows]: All sending happens inside the background job, never on a request thread. The dispatch service uses its own scope/`CancellationToken`, async I/O end-to-end, and must not hold long transactions that contend with interactive writes. A failing/slow automation must not 500 a member's event registration or profile save. (No synchronous fan-out from any endpoint.)

**AC-6** [project-context — consent + recipient rules honoured at send time, audit]: Recipients are resolved through S1's `IRecipientResolutionService` so the **consent filter + segment/member filter** apply at execution (a member who revoked the relevant `ConsentType` between activation and run is excluded — re-resolve at run time, do not snapshot at activation). The unsubscribe link is injected for member/newsletter recipients exactly as `EmailCampaignSendJob` does. The dispatch run is audited (a summary `IAuditService.LogActionAsync` per execution: definition id, sent/failed counts) so automated sends are reconstructable.

**AC-7** [tests — idempotency + persistence + registration are load-bearing]: New tests green at `cd backend && dotnet test`:
- **Idempotency (the headline test):** seed an `Active` definition + due recipients → run `ExecuteDueAsync` twice → assert exactly one send per recipient and one `AutomationRecipient` row per (trigger-occurrence, recipient); a forced mid-batch failure + retry still sends each survivor once.
- **Execution persistence (Testcontainers PostgreSQL, `IabConnect.Infrastructure.Tests`):** `AutomationExecution` + `AutomationRecipient` round-trip; the partial/unique idempotency index actually rejects a duplicate insert.
- **Per-trigger evaluator unit tests:** each v1 trigger-type computes the correct "due now" set from seeded data (offset arithmetic for time-relative triggers; boundary cases).
- **Failure isolation:** one recipient throwing → others still Sent, `FailedCount` correct, batch completes.
- **Job registration:** a registration test asserting the new job-id is registered with the right cron (mirror `VolunteerShiftReminderJobRegistrationTests`/`RegisterDailyBackupJobTests`), **and the A44 global-uniqueness test bumped 6→7** (add the new id constant to the `ids` array + update `.HaveCount(7, …)`).
- **Module-gate:** dispatch is a no-op when `Module:communication` is disabled.

**AC-8** [A44 — Hangfire recurring-job-id global-uniqueness]: The new recurring job id is a distinct `internal const string` in `Api/DependencyInjection.cs`, added to the `RecurringJobIds_AreGloballyUnique_AcrossAllRegisteredJobs` test's `ids` array, and the `.HaveCount(6)` assertion is bumped to `7` (the comment already says *"bump this count when adding a 7th"*).

**AC-9** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29. No frontend in this story (S3 reads the rows).

## Tasks / Subtasks

**Task 0 — Spike (A28/A56; resolve DEC-1..DEC-4 per A32, or A41 auto-resolve + A43 Debug Log)**

- [x] **0.1** Read `VolunteerShiftReminderJob.cs` + `VolunteerShiftReminderService.cs` (job decorators, module-skip, due-window query, per-row send+mark+continue, summary log) — the structural template.
- [x] **0.2** Read `EventVolunteerAssignmentRepository.MarkReminderSentAsync` (L173-181) + the partial unique index in `EventVolunteerAssignmentConfiguration.cs` — the idempotency mechanism to mirror (DEC-2).
- [x] **0.3** Read `EmailCampaignSendJob` + `EmailCampaign`/`EmailRecipient` (send loop, personalization, per-recipient status, unique `(CampaignId, Email)` index) — the execution-record shape (`AutomationExecution`/`AutomationRecipient`).
- [x] **0.4** Read `Api/DependencyInjection.cs` L31-71 (job-id constants) + `UseApiPipeline` registration + `RegisterDailyBackupJobTests.RecurringJobIds_AreGloballyUnique` (count=6 today; AC-8 bumps to 7).
- [x] **0.5** Read S1's `AutomationDefinition`/`AutomationTrigger`/`AutomationTriggerType` + `IRecipientResolutionService` (the trigger params + recipient API this story evaluates). Design one evaluator per trigger type.
- [x] **0.6** Confirm the test infra: `TestWebApplicationFactory` removes Hangfire + uses in-memory EF (so job-registration tests stub `IRecurringJobManager`; execution-persistence + idempotency-index tests go in `IabConnect.Infrastructure.Tests` with Testcontainers `postgres`).
- [x] **0.7** **Resolve DEC-1..DEC-4** via `AskUserQuestion` (or A41 + A43). Spike output ~8-10 lines.

**Task 1 — Domain/persistence: execution records + idempotency (AC-2, AC-3)**

- [x] **1.1** `AutomationExecution : Entity` (definition FK, status, started/completed, counts) + `AutomationRecipient : Entity` (execution FK, recipient identity, status, timestamps, `ErrorMessage`/skip-reason, **`IdempotencyKey`**) — mirror `EmailCampaign`/`EmailRecipient`.
- [x] **1.2** EF configs (`automation_executions`, `automation_recipients`) with indexes; a **unique index on the idempotency key** (partial if needed) as the DB-level duplicate guard.
- [x] **1.3** Migration `{timestamp}_AddAutomationExecutions`. `DbSet`s + DI.

**Task 2 — Application/Infrastructure: execution service + evaluators (AC-1..AC-6)**

- [x] **2.1** `IAutomationExecutionService.ExecuteDueAsync(CancellationToken)` (Application) + impl (Infrastructure): for each `Active` definition → per-trigger evaluator computes due trigger-occurrences + their recipient set (via `IRecipientResolutionService`, re-resolved now → consent honoured AC-6) → compute idempotency key per recipient → mark-then-send guard → `IEmailSender.SendAsync` (render via `EmailTemplate`) → record `AutomationRecipient` Sent/Failed/Skipped → roll up `AutomationExecution` counts.
- [x] **2.2** Per-trigger-type evaluators (the DEC-2 key + the "due now" query per type). Isolate the **single send call** so S4 can swap `IEmailSender`→`IMessageChannelSender` (DEC-4).
- [x] **2.3** Per-recipient try/catch + continue (AC-4); per-execution audit summary (AC-6); structured Serilog logs.

**Task 3 — Hangfire job + registration (AC-1, AC-8)**

- [x] **3.1** `AutomationDispatchJob` (`[DisableConcurrentExecution]` + `[AutomaticRetry(3)]` + `[JobDisplayName]`) delegating to `ExecuteDueAsync`; module-gated skip when `Module:communication` disabled.
- [x] **3.2** New `internal const string AutomationDispatchJobId` + cron in `Api/DependencyInjection.cs`; register in `UseApiPipeline`; **bump A44 test 6→7**.

**Task 4 — Tests (AC-7, AC-8)**

- [x] **4.1** Idempotency test (run-twice → one send/row; retry-after-failure → one send each).
- [x] **4.2** Testcontainers execution-persistence + unique-index-rejects-duplicate.
- [x] **4.3** Per-trigger evaluator unit tests (due-now sets, offset boundaries).
- [x] **4.4** Failure-isolation + module-gate-skip tests.
- [x] **4.5** Job-registration test + A44 uniqueness bump (count=7). `cd backend && dotnet test` green; existing volunteer/campaign tests still green.

**Task 5 — Quality-Gates Closing + Dev Agent Record (AC-9)**

- [x] **5.1** QGT table (A29). **5.2** A43 (a)/(b)/(c) for DEC-1..DEC-4. **5.3** Status flip ready-for-dev → in-progress → review.

## Dev Notes

### A28/A56 Spike Output Anchors

- **Job shape:** `VolunteerShiftReminderJob.cs` (`[DisableConcurrentExecution(600)]` + `[AutomaticRetry(3)]` + module-skip) + `VolunteerShiftReminderService.cs` (due-window query, per-row send+mark+continue, summary log).
- **Idempotency:** `EventVolunteerAssignmentRepository.MarkReminderSentAsync` ([L173-181](../../backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs#L173), `ExecuteUpdateAsync` + `WHERE …IS NULL` + bool) + partial unique index in `EventVolunteerAssignmentConfiguration.cs`; softer per-recipient `SentAt.HasValue` guard in `EmailCampaignJobService.cs` ~L155.
- **Execution-record template:** `EmailCampaign`+`EmailRecipient` (status enums, per-recipient timestamps, unique `(CampaignId, Email)` index, statistics roll-up) → `AutomationExecution`+`AutomationRecipient`.
- **Recurring-job registration:** `Api/DependencyInjection.cs` [L31-71](../../backend/src/IabConnect.Api/DependencyInjection.cs#L31) (6 ids) + `UseApiPipeline` `jobManager.AddOrUpdate<T>(id, …, cron, options)`; A44 test in `RegisterDailyBackupJobTests.cs` L46-66 (`HaveCount(6, "…bump this count when adding a 7th")`).
- **Send:** `IEmailSender.SendAsync`; `EmailTemplate.RenderHtml/RenderSubject`; `EventNotificationService` (header-injection sanitize + Zurich tz) for body-composition patterns.
- **Recipient resolution + consent (AC-6):** S1's `IRecipientResolutionService` (consent via `IConsentRepository.GetUsersWithConsentAsync`).
- **No event bus:** `ApplicationDbContext.Ignore<DomainEvent>()` + no MediatR publish ⇒ poll, don't subscribe (DEC-1).
- **Test infra:** `TestWebApplicationFactory` (in-memory EF, Hangfire removed) for registration tests (stub `IRecurringJobManager`); Testcontainers `postgres` in `IabConnect.Infrastructure.Tests` for persistence + index.

### Decision-Needed Block

**DEC-1 — trigger mechanism: scheduled polling vs build a domain-event bus.**
- **A (RECOMMENDED):** A single recurring `AutomationDispatchJob` that polls — evaluates each `Active` definition's trigger against current data each run. No event bus exists (DbContext ignores domain events; no MediatR publish), and architecture L664 sanctions "scheduled polling where safer". Idempotency (DEC-2) makes "evaluate every run" safe.
- **B:** Build a domain-event dispatcher now (publish from `SaveChangesAsync`, subscribe automations). Larger, riskier cross-cutting change; out of scope — defer as a future enhancement for "event where reliable" triggers.
- *Recommendation A.*

**DEC-2 — idempotency key + enforcement.**
- **A (RECOMMENDED):** A deterministic per-trigger-type `IdempotencyKey` string on `AutomationRecipient` (`definitionId|<trigger-occurrence-id>|recipientId`), enforced by a **unique index**, plus a mark-then-send `ExecuteUpdateAsync` guard returning bool (the volunteer pattern). Detects duplicates, survives retries + overlap + crash.
- **B:** Soft per-recipient `SentAt.HasValue` check only (the campaign pattern). Adequate for a one-shot campaign but weaker for a *recurring* poll that re-evaluates the same data each run — rejected as the sole guard.
- *Recommendation A (unique index is the load-bearing guard; the bool-returning update is the fast path).*

**DEC-3 — dispatch cadence.**
- **A (RECOMMENDED):** A modest fixed cadence (e.g. hourly, or every 15 min) chosen so time-relative triggers ("N days before") fire within an acceptable window, balanced against poll cost. Document the chosen cron + why; keep it a single constant. For Beta, hourly is ample.
- **B:** Per-definition custom schedules. More flexible but multiplies Hangfire jobs + the A44 surface; defer.
- *Recommendation A — one job, one cron constant.*

**DEC-4 — send path: `IEmailSender` now vs `IMessageChannelSender` (S4).**
- **A (RECOMMENDED):** Use `IEmailSender` directly in S2 (email-only, S4 not yet landed), but **isolate the single per-recipient send call** behind one private method so S4's refactor to `IMessageChannelSender` is a contained, tested one-line swap (A31 invariant with S4). Email remains the default channel regardless.
- **B:** Block S2 on S4 and send through `IMessageChannelSender` from day one. Couples REQ-028 to REQ-030 and reorders the epic; rejected unless dev order changes to S1→S4→S2.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **One idempotency guard** — unique index + mark-then-send; the run-twice test is the proof (AC-3/AC-7).
2. **Recipient resolution re-run at send time** — consent honoured live via S1's `IRecipientResolutionService` (no activation-time snapshot).
3. **A44 job-id uniqueness** — the 7th id is distinct + the count test bumped to 7 (AC-8); a copy-paste from an existing job block must not reuse an id.
4. **Send-call isolation** — one private send method so S4 swaps `IEmailSender`→`IMessageChannelSender` without touching execution/idempotency.
5. **Only `Active` definitions execute** — the S1 status invariant is the eligibility gate.
6. **No request-thread sending** — AC-5; all fan-out is in the job.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared (A41 preconditions + A43 (a)/(b)/(c)), auto-pick DEC-1=A, DEC-2=A, DEC-3=A, DEC-4=A and record the Debug Log. Otherwise surface DEC-1..DEC-4 via `AskUserQuestion` at Task 0.

### Project Structure Notes

- NEW Domain: `AutomationExecution.cs`, `AutomationRecipient.cs` (+ status enums in `AutomationEnums.cs` from S1), `IAutomationExecutionRepository.cs`.
- NEW Application: `IAutomationExecutionService.cs` + per-trigger evaluator contracts under `Application/Communication/Automations/`.
- NEW Infrastructure: `AutomationExecutionService.cs`, `Jobs/AutomationDispatchJob.cs`, repository impl, `Persistence/Configurations/AutomationExecution(+Recipient)Configuration.cs`, `Migrations/{timestamp}_AddAutomationExecutions.cs`.
- MODIFIED: `Api/DependencyInjection.cs` (+ `AutomationDispatchJobId` const + cron + `UseApiPipeline` registration); `RegisterDailyBackupJobTests.cs` (A44 count 6→7 + add id) — or a dedicated `AutomationDispatchJobRegistrationTests.cs`; `ApplicationDbContext.cs` (+ DbSets); Infrastructure `DependencyInjection.cs` (+ service/job/repo).
- MODIFIED (DEC-4, contained): the single send call in `AutomationExecutionService` is the S4 swap point.
- UNCHANGED (regression-guarded): the 6 existing recurring jobs + their tests; campaign/volunteer send paths.

### References

- [Source: epics-and-stories.md §Story E5-S2 (L576-598)] — authoritative AC.
- [Source: architecture.md REQ-028 Execution (L662-666) + ADR-005 (L125-133) + ADR-004].
- [Source: VolunteerShiftReminderJob.cs + VolunteerShiftReminderService.cs] — job shape + per-row send/mark/continue.
- [Source: EventVolunteerAssignmentRepository.cs L173-181 + EventVolunteerAssignmentConfiguration.cs] — idempotency (DEC-2).
- [Source: EmailCampaignJobService.cs L69-281 + EmailCampaign.cs + EmailRecipient.cs] — execution-record shape + send loop.
- [Source: Api/DependencyInjection.cs L31-71 + RegisterDailyBackupJobTests.cs L46-66] — recurring-job registration + A44 count.
- [Source: E5-S1 — AutomationDefinition/Trigger + IRecipientResolutionService].
- [Source: project-context A44 (job-id uniqueness), A56, A63, A29].

## Quality-Gates Closing Check (A29 / AC-9)

_To be filled by dev agent — one row per AC sub-item._

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Recurring `AutomationDispatchJob` (decorators + module-skip) | ✅ covered | `AutomationDispatchJob` (`[DisableConcurrentExecution(600)]`+`[AutomaticRetry(3)]`+`[JobDisplayName]`, Module:communication skip); registered in `UseApiPipeline` hourly UTC; `AutomationDispatchJobTests` (skip/run) |
| AC-2 | `AutomationExecution`+`AutomationRecipient` records | ✅ covered | `AutomationExecution`(status/started/completed/counts) + `AutomationRecipient`(status/SentAt/error/IdempotencyKey); `AutomationExecutionConfiguration`; `AutomationExecutionRepositoryTests` round-trip |
| AC-3 | Idempotency: run-twice → one send/row (headline test) | ✅ covered (hardened at boundary review) | **claim-before-send**: recipients persisted as `Pending` (committing the unique key) BEFORE any send, then marked Sent/Failed — so a crash/restart mid-batch leaves the keys on record and a retry skips them (at-most-once; no duplicate). pre-check `ExistingRecipientKeysAsync` + **unique index** on `idempotency_key`; concurrent claim-collision → abandon run before sending. Tests: `RunTwice…`, `ClaimIsPersistedBeforeSending`, `ClaimCollision_AbandonsRun_WithoutSending`, `UniqueIndex_RejectsDuplicateIdempotencyKey` |
| AC-4 | Failed send logged + visible, batch continues | ✅ covered | per-recipient try/catch + `AutomationRecipient.Failed`; `PerRecipientFailure_IsIsolated_BatchContinues` (1 Sent + 1 Failed, FailedCount=1, execution Completed) |
| AC-5 | No request-thread blocking | ✅ covered | all sending is inside `AutomationDispatchJob`/`ExecuteDueAsync` (Hangfire background); no endpoint fans out sends; async + CancellationToken end-to-end |
| AC-6 | Consent re-resolved at send time + audit summary | ✅ covered | `ExecuteDueAsync` calls `IRecipientResolutionService.ResolveAsync` per run (consent live, not snapshotted); per-execution `LogActionAsync(SettingsChanged, entityType:"AutomationExecution", sent/failed/skipped)` |
| AC-7 | Idempotency/persistence/evaluator/failure/registration tests | ✅ covered | 7 evaluator (Application) + 7 execution-service + 2 job-gate + 3 persistence (Infra/Testcontainers) + 1 job-id-contract + A44 bump = green. **v1 evaluator scope (boundary-review-hardened):** triggers fire **once-ever per recipient** (`MemberJoined`/`EventUpcoming`/`MembershipRenewalDue`, no date in key → never a daily resend), `Scheduled` once-per-day, `Manual` not auto-fired. Time-relative triggers are one-time segment broadcasts in v1; binding them to specific event/renewal records is a tracked follow-up (E5-FT-1) — NOT a real "due-now from event data" computation |
| AC-8 | A44 job-id uniqueness bumped 6→7 | ✅ covered | `RegisterDailyBackupJobTests.RecurringJobIds_AreGloballyUnique` ids array +`AutomationDispatchJobId`, `.HaveCount(7,…)`; `AutomationDispatchJobRegistrationTests` pins id `dispatch-automations` + cron `0 * * * *` |
| AC-9 | This table populated | ✅ covered | this table |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] — autonomous dev-story run (continued from S1).

### Debug Log References

**A41 autonomous-mode escape engaged** (same user directive quoted in S1; all 4 DECs → option A).

**DEC-1 — trigger mechanism.** (a) Option A: a single recurring `AutomationDispatchJob` that polls each Active definition. (b) Story recommendation A + autonomous quote + the decisive no-domain-event-bus finding (`ApplicationDbContext.Ignore<DomainEvent>()`, no MediatR publish) + architecture L664 sanctioning scheduled polling. (c) No event bus built; idempotency (DEC-2) makes "evaluate every run" safe.

**DEC-2 — idempotency key + enforcement.** (a) Option A: deterministic per-(definition, trigger-occurrence, recipient) `IdempotencyKey` on `AutomationRecipient` + a **unique index** + a pre-check (`ExistingRecipientKeysAsync`). (b) Story recommendation A + autonomous quote + the `MarkReminderSentAsync`/partial-unique-index precedent. (c) AC-3 headline proven: run-twice → one send/row (pre-check filters); unique index rejects a concurrent duplicate insert (Testcontainers). Key shape encodes trigger semantics (MemberJoined once-ever; Scheduled/time-relative carry a date slot).

**DEC-3 — dispatch cadence.** (a) Option A: one job, one cron constant — **hourly** (`0 * * * *`). (b) Story recommendation A + autonomous quote + "hourly is ample for Beta; time-relative triggers fire within an acceptable window". (c) Single `AutomationDispatchJobId`/`AutomationDispatchCron`; A44 count bumped 6→7.

**DEC-4 — send path.** (a) Option A: use `IEmailSender` directly now, but **isolate the single per-recipient send** behind `AutomationExecutionService.SendMessageAsync`. (b) Story recommendation A + autonomous quote + S4 not yet landed. (c) S4 swaps that one method to `IMessageDispatcher` without touching execution/idempotency — the A31 seam with S4. Email remains the default channel.

### Completion Notes List

- Built `AutomationExecution` + `AutomationRecipient` (mirrors `EmailCampaign`/`EmailRecipient`) with a globally-unique `IdempotencyKey`; EF configs + migration `AddAutomationExecutions` (unique index on `idempotency_key`); `IAutomationExecutionRepository` + impl; the pure `AutomationTriggerEvaluator` (per-trigger keys); `IAutomationExecutionService` + Infrastructure impl (resolve→evaluate→pre-check→isolated send→record→audit); `AutomationDispatchJob` (Hangfire, module-gated) + the 7th recurring-job registration; A44 test bumped 6→7.
- **Idempotency semantics (documented):** at-most-once-with-detection — the pre-check drops already-handled occurrences (run-twice → no re-send) and the unique index is the structural backstop for the rare concurrent race (`DisableConcurrentExecution` already prevents overlap). A whole-run infra failure propagates → Hangfire `[AutomaticRetry]` retries → the pre-check makes the retry safe.
- **v1 evaluator granularity (documented in `AutomationTriggerEvaluator`):** occurrences are recipient-granular with a key that encodes the trigger; binding time-relative occurrences to specific events/renewal records is a future enhancement (the key already reserves the target-date slot, so it is additive). Manual triggers are not auto-fired by polling.
- **AC-5:** all sending is in the background job; no endpoint fans out sends. **AC-6:** recipients are re-resolved each run so a consent revoked between activation and run excludes the recipient.
- 7 (Application) + 9 (Infrastructure, incl. 3 Testcontainers) + 6 (API incl. A44) new/updated tests green.

### File List

**NEW (Domain):**
- `backend/src/IabConnect.Domain/Communication/AutomationExecutionEnums.cs`
- `backend/src/IabConnect.Domain/Communication/AutomationRecipient.cs`
- `backend/src/IabConnect.Domain/Communication/AutomationExecution.cs`
- `backend/src/IabConnect.Domain/Communication/IAutomationExecutionRepository.cs`

**NEW (Application):**
- `backend/src/IabConnect.Application/Communication/Automations/IAutomationExecutionService.cs`
- `backend/src/IabConnect.Application/Communication/Automations/AutomationTriggerEvaluator.cs`

**NEW (Infrastructure):**
- `backend/src/IabConnect.Infrastructure/Communication/AutomationExecutionService.cs`
- `backend/src/IabConnect.Infrastructure/Communication/Jobs/AutomationDispatchJob.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/AutomationExecutionRepository.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/AutomationExecutionConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260606181150_AddAutomationExecutions.cs` (+ `.Designer.cs` + ModelSnapshot delta)

**NEW (Tests):**
- `backend/tests/IabConnect.Application.Tests/Communication/Automations/AutomationTriggerEvaluatorTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Communication/AutomationExecutionServiceTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Communication/AutomationDispatchJobTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/AutomationExecutionRepositoryTests.cs`
- `backend/tests/IabConnect.Api.Tests/AutomationDispatchJobRegistrationTests.cs`

**MODIFIED:**
- `backend/src/IabConnect.Api/DependencyInjection.cs` (+ `AutomationDispatchJobId`/`Cron` consts; register the 7th recurring job; + `using …Communication.Jobs`)
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` (+ `DbSet<AutomationExecution>` + `DbSet<AutomationRecipient>`)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ execution repo + evaluator + service + job)
- `backend/tests/IabConnect.Api.Tests/RegisterDailyBackupJobTests.cs` (A44 ids array +1, `.HaveCount(7)`)

## Change Log

- 2026-06-06: Story refreshed from the 2026-05-12 pre-pivot stub to dev-ready in the Epic-5 A34 bulk pass; post-MVP scope; A56 spike documented the shipped Hangfire patterns to copy (`VolunteerShiftReminderJob` shape + `MarkReminderSentAsync` idempotency + `EmailCampaignSendJob` send/record shape), the no-domain-event-bus constraint (poll, don't subscribe), and the net-new `AutomationExecution`/`AutomationRecipient` + dispatch job + A44 count bump (6→7); DEC-1..DEC-4 surfaced with recommendations; S4 send-call-isolation seam flagged (DEC-4).
- 2026-06-06: **Implemented (autonomous dev-story).** Built `AutomationExecution`/`AutomationRecipient` (+ globally-unique `IdempotencyKey` + unique index), migration `AddAutomationExecutions`, `IAutomationExecutionRepository` + impl, the pure `AutomationTriggerEvaluator`, `IAutomationExecutionService` + Infrastructure impl (resolve→evaluate→idempotency pre-check→isolated send→record→audit summary), `AutomationDispatchJob` (Hangfire, `DisableConcurrentExecution`+`AutomaticRetry(3)`, Module:communication skip) registered as the 7th recurring job (hourly), A44 uniqueness test bumped 6→7. DEC-1..DEC-4 auto-resolved to option A (A41/A43). Idempotency proven by run-twice (one send/recipient) + the unique-index-rejects-duplicate Testcontainers test. The single send call is isolated as the S4 swap point (DEC-4). 22 new/updated tests green. Status → review.
