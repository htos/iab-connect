# Story 5.4: Add Multi-channel Messaging Abstraction

Status: review

## Refresh Notes (2026-06-06, Epic-5 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub (placeholder ACs, "As a user, I want Add Multi-channel Messaging Abstraction, so that the product goal is satisfied" filler). Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-5 (Communication Automation)** per user directive *"für das ganze nächste epic sollst du alle stories vorbereiten und nicht nur eins. beachte es ist kein mvp mehr."* (2026-06-06). This is the **first REQ-030 story** — it introduces a channel abstraction so SMS/WhatsApp can be added later without rewriting communication workflows, while **email stays the default and only-enabled channel** in this story.

**A56 existing-implementation spike — what already ships vs what is net-new:**

- **Sending is email-only today; there is NO channel abstraction:** the only sender is `IEmailSender` ([IEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/IEmailSender.cs)) → `SmtpEmailSender` ([SmtpEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs), `System.Net.Mail.SmtpClient`, HTML+plain-text MIME), configured by `SmtpSettings` ([SmtpSettings.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs), section `"Smtp"`, secrets via config). DI registers `IEmailSender → SmtpEmailSender` at [Infrastructure/DependencyInjection.cs L199-201](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L199). The interfaces the architecture suggests (`IMessageChannelSender`/`IMessageProvider`/`IChannelPreferenceService`) **do not exist** — all net-new.
- **`SmtpSettings` is the config-secret precedent (AC-5):** `services.Configure<SmtpSettings>(configuration.GetSection("Smtp"))` — provider credentials live in config (env vars / Railway secrets), never source. SMS/WhatsApp settings follow the same `Configure<TSettings>(GetSection(...))` shape; A50 applies if any setting is interpolated into a policy-shaped string (not expected here). A60 applies: verify a documented provider transport/port against the actual client library before promising it.
- **Existing send call-sites that COULD route through the abstraction:** `EmailCampaignSendJob` (campaigns), `EventNotificationService` (registration/volunteer emails), and — once S2 lands — `AutomationExecutionService`. Per the AC *"email remains the default channel"* + *"without changing communication workflows"*, **DEC-3 recommends the minimal blast radius**: introduce the abstraction with an `EmailChannelSender` default that wraps `IEmailSender`, route **only the automation send path (S2)** through it (so automations become channel-aware), and leave campaigns + event-notifications on `IEmailSender` unchanged (they are email-by-design). The abstraction is additive; nothing existing changes behaviour.
- **Net-new (this story):** `IMessageChannelSender` (per-channel sender, `Channel` + `IsEnabled` + `SendAsync(message)`), `IMessageProvider` (provider-adapter seam), a `MessageChannel` enum (Email/Sms/WhatsApp), an `IMessageDispatcher` that selects a sender by channel + availability (preference + consent gating arrives in S5), `EmailChannelSender` (wraps `IEmailSender`, always enabled = default), **disabled stub** `SmsChannelSender`/`WhatsAppChannelSender` (registered, `IsEnabled=false` until configured, throw/no-op if invoked while disabled), the `SmsSettings`/messaging config POCO(s), DI registration, provider-setup config documentation, and unit tests for channel selection.
- **`IChannelPreferenceService` is named in REQ-030's suggested interfaces but is owned by S5** (user channel preferences). This story may define the **interface** so the dispatcher has a seam, but the preference *storage + UI + eligibility logic* is S5 (DEC-4). Keep the S4 dispatcher's preference check behind that interface with a default "email always eligible" implementation until S5 fills it in.

**A34 note:** authored alongside S1/S2/S3/S5. **Soft dependency on S2** (the automation send call is the integration point — S2 DEC-4 isolated it for a contained swap). Dev-story order S1 → S2 → S3 → **S4** → S5. S4 can land independently of S3 (UI); it pairs with S5 (preferences consume the channel set).

## Story

As **the system / platform maintainer preparing the Verein to reach members on more than email** (post-MVP, REQ-030: some members prefer SMS reminders; WhatsApp may come later), where the production provider is **undecided** and must not block the abstraction,
I want **message sending to go through a small channel abstraction (`IMessageChannelSender` per channel, selected by an `IMessageDispatcher`) with email as the always-enabled default and SMS/WhatsApp as disabled stub adapters that can be wired in later purely through Infrastructure + config secrets**,
so that **adding a real SMS or WhatsApp provider is a new adapter + config change with zero edits to communication workflows, email behaviour is completely unchanged today, provider credentials never live in source, and a provider/channel that isn't configured simply isn't used (no crash, no silent misfire)**.

**Requirement:** REQ-030 (Multi-channel Messages). Epic E5 (Communication Automation), Story 4 of 5.

- **Source-of-truth:** [epics-and-stories.md §Story E5-S4 (L624-646)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchors:** [REQ-030 Multi-channel Messages (L668-685)](../planning-artifacts/architecture.md) (*channel abstraction behind Application/Infrastructure interfaces; email baseline; SMS/WhatsApp are adapters; `IMessageChannelSender`/`IMessageProvider`/`IChannelPreferenceService`; credentials are config secrets; preference + consent checked before send*), [ADR-001 Modular Monolith](../planning-artifacts/architecture.md), [ADR-005 Hangfire (provider-send retries)](../planning-artifacts/architecture.md).
- **Reuse source:** `IEmailSender`/`SmtpEmailSender`/`SmtpSettings` (the email channel + the config-secret pattern).

**Upstream (dependencies):**

- **Communication module done** — `IEmailSender`/`SmtpEmailSender`/`SmtpSettings`, DI conventions. ✅
- **E5-S2 (soft)** — the automation send call to route through the dispatcher (S2 isolated it per its DEC-4). ✅ when S2 lands.

**Downstream:**

- **E5-S5** consumes the channel set + the `IChannelPreferenceService` seam: it stores user channel preferences and implements the eligibility check (consent + preference + provider-availability) that the dispatcher calls before choosing a channel.

**Wave context:** Epic-5 REQ-030 opener. **Net-new artifacts:** `IMessageChannelSender` + `IMessageProvider` + `MessageChannel` enum + `IMessageDispatcher` (Application/Domain interfaces); `EmailChannelSender` + disabled `Sms`/`WhatsApp` stub senders + `MessageDispatcher` (Infrastructure); `SmsSettings`/messaging config POCO; DI registration; the automation send-path refactor (DEC-3); provider-setup config docs; unit tests. Backend-only, no migration (no new persistence — preferences are S5). Est. +300-500 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E5-S4 — application defines channel sender interfaces]: New abstraction in the Application/Domain layer: `IMessageChannelSender` (a `MessageChannel Channel { get; }` + `bool IsEnabled { get; }` + `Task<…> SendAsync(MessageRequest, CancellationToken)`), an `IMessageProvider` seam for provider-specific adapters, a `MessageChannel` enum (`Email`, `Sms`, `WhatsApp`), and an `IMessageDispatcher` that picks the right enabled sender for a requested channel (DEC-1 fixes the exact shape). A neutral `MessageRequest`/`MessageContent` carries recipient + subject + html/text body so a channel sender is content-shape-agnostic.

**AC-2** [epics §E5-S4 — email remains the default channel]: `EmailChannelSender` implements `IMessageChannelSender` for `MessageChannel.Email`, **`IsEnabled => true`**, and delegates to the existing `IEmailSender.SendAsync` (no re-implementation of SMTP). It is the dispatcher's default + fallback channel. Existing email behaviour (campaigns, event-notifications) is byte-for-byte unchanged (DEC-3 keeps them on `IEmailSender` directly).

**AC-3** [epics §E5-S4 — SMS/WhatsApp adapters can be added through Infrastructure]: `SmsChannelSender` + `WhatsAppChannelSender` ship as **disabled stubs** in Infrastructure (`IsEnabled` driven by config — false by default since no provider is chosen). Each is registered so the dispatcher knows the channel exists; invoking a disabled channel does not send (it returns a clear "channel disabled" result / throws a typed exception the dispatcher handles — DEC-2). Adding a real provider = implement the adapter against a provider SDK behind `IMessageProvider` + flip the config flag — **no change to `IMessageDispatcher`, `IMessageChannelSender`, or any caller**.

**AC-4** [epics §E5-S4 — provider failures + delivery statuses can be logged where available]: The dispatcher + each channel sender log send attempts, failures (typed), and any provider delivery status the adapter surfaces (Serilog structured). A provider failure is isolated (returned as a failed-send result the caller records — e.g. S2's `AutomationRecipient.Failed`), never an unhandled crash. Provider-send retries reuse Hangfire (ADR-005) where the caller is a job (S2 already retries).

**AC-5** [epics §E5-S4 / REQ-030 security — credentials are config secrets, not source]: SMS/WhatsApp provider settings are bound via `services.Configure<TSettings>(configuration.GetSection(...))` (the `SmtpSettings` precedent) — host/account/token/sender-id are config values (env vars / Railway secrets), never literals in source. `appsettings.json` carries only **non-secret** defaults + an empty/disabled stanza; `.env.example` documents the keys (no real values). A60: if the provider-setup doc names a transport/port/option, verify it against the would-be client library before promising it.

**AC-6** [epics §E5-S4 — configuration documentation for provider setup]: A short provider-setup doc (location per DEC-5 — recommended: a section in the existing communication/ops docs or a new `docs/` page) explains how to enable a channel: the config keys, the `IsEnabled` flag, where to put secrets, and the "implement the adapter" extension point. It states clearly that channels ship disabled and email is the baseline. (Doc deliverable → A42 reread-as-a-stranger pass.)

**AC-7** [tests — channel selection]: New unit tests green at `cd backend && dotnet test`:
- **Channel selection:** the dispatcher returns the `EmailChannelSender` for `Email`; returns/falls back to email (or a clear disabled result per DEC-2) when `Sms`/`WhatsApp` is requested-but-disabled; never dispatches to a disabled sender.
- **EmailChannelSender** delegates to `IEmailSender` (Moq) with the mapped content.
- **Disabled stub** does not send when invoked (returns disabled-result / throws-typed, per DEC-2) and `IsEnabled=false` by default.
- **Config-secret:** SMS settings bind from configuration (A36/A53 InMemoryCollection + AddEnvironmentVariables shape if the test reads env-mapped config).
- If S2 is landed: the automation send path now goes through `IMessageDispatcher` and still sends one email per recipient (regression — S2's idempotency/tests stay green).

**AC-8** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29; A42 reread-as-a-stranger for the provider-setup doc.

## Tasks / Subtasks

**Task 0 — Spike (A28/A56; resolve DEC-1..DEC-5 per A32, or A41 auto-resolve + A43 Debug Log)**

- [x] **0.1** Read `IEmailSender.cs` + `SmtpEmailSender.cs` + `SmtpSettings.cs` + the DI at [Infrastructure/DependencyInjection.cs L199-201](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L199) (the channel + config-secret pattern).
- [x] **0.2** Read the send call-sites — `EmailCampaignSendJob`, `EventNotificationService`, and (if landed) `AutomationExecutionService`'s isolated send call (S2 DEC-4) — to fix the DEC-3 blast radius.
- [x] **0.3** Confirm `IChannelPreferenceService` ownership split with S5 (define the interface seam here with a default "email always eligible"; storage + eligibility = S5; DEC-4).
- [x] **0.4** **Resolve DEC-1..DEC-5** via `AskUserQuestion` (or A41 + A43). Spike output ~6-8 lines.

**Task 1 — Abstraction interfaces (AC-1)**

- [x] **1.1** `MessageChannel` enum + `MessageRequest`/`MessageContent` + `IMessageChannelSender` + `IMessageProvider` + `IMessageDispatcher` (Application/Domain). Define `IChannelPreferenceService` seam (DEC-4) with a default eligible-email impl.

**Task 2 — Email default + disabled stubs (AC-2, AC-3)**

- [x] **2.1** `EmailChannelSender` (`IsEnabled=>true`, delegates to `IEmailSender`).
- [x] **2.2** `SmsChannelSender` + `WhatsAppChannelSender` disabled stubs (`IsEnabled` from config, default false; no-send when disabled per DEC-2).
- [x] **2.3** `MessageDispatcher` (select enabled sender by channel; fallback/clear-result for disabled per DEC-2; log per AC-4).

**Task 3 — Config + secrets + docs (AC-5, AC-6)**

- [x] **3.1** `SmsSettings`/messaging config POCO(s) bound via `Configure<TSettings>(GetSection(...))`; non-secret disabled defaults in `appsettings.json`; `.env.example` keys documented (no values).
- [x] **3.2** Provider-setup doc (DEC-5) + A42 reread.

**Task 4 — Wire automation send path (DEC-3) (AC-2, AC-4)**

- [x] **4.1** Refactor S2's isolated send call to go through `IMessageDispatcher` (email default). Campaigns + event-notifications stay on `IEmailSender` (unchanged). Regression-guard S2's tests.

**Task 5 — Tests (AC-7)**

- [x] **5.1** Channel-selection + email-delegation + disabled-stub + config-secret-binding tests; S2 send-path regression (if landed). `cd backend && dotnet test` green.

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-8)**

- [x] **6.1** QGT table (A29). **6.2** A43 (a)/(b)/(c) for DEC-1..DEC-5. **6.3** Status flip ready-for-dev → in-progress → review.

## Dev Notes

### A28/A56 Spike Output Anchors

- **Email channel + config-secret pattern:** `IEmailSender.cs` / `SmtpEmailSender.cs` / `SmtpSettings.cs` (`"Smtp"` section); DI `services.Configure<SmtpSettings>(...)` + `AddScoped<IEmailSender, SmtpEmailSender>()` at [Infrastructure/DependencyInjection.cs L199-201](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L199).
- **Send call-sites (DEC-3 blast radius):** `EmailCampaignSendJob`, `EventNotificationService` (stay on `IEmailSender`); `AutomationExecutionService` isolated send (route through dispatcher).
- **No abstraction today:** `IMessageChannelSender`/`IMessageProvider`/`IChannelPreferenceService` are all net-new (architecture L676-680).
- **S5 seam:** `IChannelPreferenceService` defined here (default email-eligible); storage + eligibility = S5 (DEC-4).
- **Config-secret rules:** A50 (normalize if interpolated into policy strings — not expected), A60 (verify provider transport/port vs client library before documenting), A36/A53 (env-mapped config test shape).

### Decision-Needed Block

**DEC-1 — abstraction shape.**
- **A (RECOMMENDED):** `IMessageChannelSender` per channel (`Channel` + `IsEnabled` + `SendAsync(MessageRequest)`) + an `IMessageDispatcher` that resolves the enabled sender for a requested channel; `IMessageProvider` as the provider-adapter seam inside a channel sender. Mirrors the architecture's suggested interfaces exactly + keeps callers channel-agnostic.
- **B:** A single `IMessageService.Send(channel, message)` with an internal switch. Simpler but pushes channel knowledge into one growing method + weakens the "add an adapter without touching workflows" goal.
- *Recommendation A.*

**DEC-2 — behaviour when a requested channel is disabled.**
- **A (RECOMMENDED):** The dispatcher returns a clear failed/skipped result ("channel disabled") and (where a fallback is sensible, e.g. preference unmet) falls back to email; a disabled sender invoked directly throws a typed `ChannelDisabledException` the dispatcher catches. No silent drop, no crash.
- **B:** Throw uncaught. Rejected — a disabled SMS provider must degrade gracefully, not 500 a job.
- *Recommendation A (the caller — S2 — records the skip/fail per recipient).*

**DEC-3 — refactor blast radius.**
- **A (RECOMMENDED):** Route only the **automation** send path (S2) through the dispatcher; leave campaigns + event-notifications on `IEmailSender` unchanged. Honours "email remains default" + "without changing communication workflows" with the smallest surface; campaigns are email-by-design.
- **B:** Route every send site through the dispatcher. More uniform but a large regression surface for zero behaviour change today (all default to email anyway) — defer wholesale migration.
- *Recommendation A.*

**DEC-4 — `IChannelPreferenceService` ownership (this story vs S5).**
- **A (RECOMMENDED):** Define the interface seam here with a default "email always eligible" implementation; S5 supplies the real storage + eligibility (consent + preference + provider-availability). Keeps S4 shippable without S5 and gives S5 a clean injection point.
- **B:** Build preferences here too. Rejected — S5 owns the entity + UI + the consent/preference/availability eligibility logic.
- *Recommendation A.*

**DEC-5 — provider-setup doc location.**
- **A (RECOMMENDED):** A section in the existing communication/ops documentation (or a focused new `docs/` page) describing config keys + enabling a channel + the adapter extension point. Cross-link `.env.example`.
- **B:** Only `.env.example` comments. Thinner; a short doc section is better for an operator enabling SMS later.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **Email unchanged** — campaigns + event-notifications stay on `IEmailSender`; only the automation send call moves (DEC-3); existing email tests stay green.
2. **Adapter-add is closed-for-modification** — adding SMS/WhatsApp touches only a new adapter + config; `IMessageDispatcher`/`IMessageChannelSender`/callers are untouched (the AC-3 test asserts the seam).
3. **Secrets in config only** — `Configure<TSettings>(GetSection(...))`; `.env.example` documents keys, no values (A5x secret hygiene).
4. **S2 send-call seam** — S4 consumes the single isolated send call S2 left (S2 DEC-4); the swap is contained + regression-guarded.
5. **S5 seam** — `IChannelPreferenceService` default here; eligibility logic in S5.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared (A41 + A43), auto-pick DEC-1=A, DEC-2=A, DEC-3=A, DEC-4=A, DEC-5=A and record the Debug Log. Otherwise surface DEC-1..DEC-5 via `AskUserQuestion` at Task 0.

### Project Structure Notes

- NEW Application/Domain: `Communication/Messaging/{MessageChannel.cs, MessageRequest.cs, IMessageChannelSender.cs, IMessageProvider.cs, IMessageDispatcher.cs, IChannelPreferenceService.cs}`.
- NEW Infrastructure: `Email/EmailChannelSender.cs`, `Messaging/{SmsChannelSender.cs, WhatsAppChannelSender.cs, MessageDispatcher.cs, SmsSettings.cs}`, DI registration.
- NEW docs: provider-setup section (DEC-5) + `.env.example` keys.
- MODIFIED: `AutomationExecutionService` (route the isolated send through `IMessageDispatcher`, DEC-3); `appsettings.json` (disabled messaging stanza, non-secret).
- UNCHANGED (regression-guarded): `IEmailSender`/`SmtpEmailSender`/`SmtpSettings`; `EmailCampaignSendJob`; `EventNotificationService`; their tests. **No migration** (no new persistence — preferences are S5).

### References

- [Source: epics-and-stories.md §Story E5-S4 (L624-646)] — authoritative AC.
- [Source: architecture.md REQ-030 (L668-685) + ADR-001 + ADR-005].
- [Source: IEmailSender.cs / SmtpEmailSender.cs / SmtpSettings.cs + Infrastructure/DependencyInjection.cs L199-201] — email channel + config-secret pattern.
- [Source: EmailCampaignSendJob.cs + EventNotificationService.cs] — send call-sites (stay on IEmailSender, DEC-3).
- [Source: E5-S2 isolated send call (DEC-4) + E5-S5 IChannelPreferenceService].
- [Source: project-context A5x secret hygiene, A50, A60, A36/A53 config-test shape, A42 doc reread, A29].

## Quality-Gates Closing Check (A29 / AC-8)

_To be filled by dev agent — one row per AC sub-item._

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | Channel interfaces (`IMessageChannelSender`/provider/dispatcher/enum) | ✅ covered | `Application/Communication/Messaging/`: `MessageChannel`, `MessageRequest`/`MessageContent`/`MessageSendResult`, `IMessageChannelSender`, `IMessageProvider`, `IMessageDispatcher` |
| AC-2 | `EmailChannelSender` default (delegates to `IEmailSender`) | ✅ covered | `EmailChannelSender` (`IsEnabled=>true`, delegates to `IEmailSender`); `EmailChannelSender_DelegatesToEmailSender` test; campaigns + event-notifications untouched (DEC-3) |
| AC-3 | SMS/WhatsApp disabled stubs; adapter-add closed-for-modification | ✅ covered | `SmsChannelSender`/`WhatsAppChannelSender` (`IsEnabled` from config, false default; `ChannelDisabledException` when invoked disabled); `SmsChannelSender_IsDisabledByDefault` + `DisabledStub_Throws_WhenInvokedDirectly`; dispatcher selects by `IEnumerable<IMessageChannelSender>` — adding a channel = add an adapter to DI |
| AC-4 | Failure/delivery-status logging; isolated failures | ✅ covered | `MessageDispatcher` try/catch → `MessageSendResult.Failed` (Serilog logged, never crashes); fallback-to-email on disabled (`Dispatcher_FallsBackToEmail_WhenSmsDisabled`); S2 records the per-recipient result |
| AC-5 | Provider secrets in config only (`.env.example` keys) | ✅ covered | `SmsSettings`/`WhatsAppSettings` via `Configure<T>(GetSection(...))`; `appsettings.json` disabled non-secret stanza; `backend/.env.example` keys (no values); `SmsSettings_BindFromConfiguration_WithEnvVarSourceEngaged` (A53 shape) |
| AC-6 | Provider-setup doc (A42 reread) | ✅ covered | `docs/15_multichannel_messaging.md` (how-it-works, config keys, enable-a-channel extension point); A42/A60 reread — the SMTP transport claim states STARTTLS (matches `System.Net.Mail.SmtpClient`+`EnableSsl`), no invented port/option |
| AC-7 | Channel-selection + delegation + disabled + config tests | ✅ covered | 8 messaging tests + 4 S2-execution-service regression (now route through the dispatcher, still 1 email/recipient) green |
| AC-8 | This table populated | ✅ covered | this table |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] — autonomous dev-story run (continued from S3).

### Debug Log References

**A41 autonomous-mode escape engaged** (same user directive quoted in S1; all 5 DECs → option A).

**DEC-1 — abstraction shape.** (a) Option A: `IMessageChannelSender` per channel + `IMessageDispatcher` + `IMessageProvider` seam + `MessageChannel` enum + neutral `MessageRequest`/`MessageContent`. (b) Story rec A + autonomous quote + mirrors the architecture's suggested interfaces. (c) Callers stay channel-agnostic; adding a channel touches only a new adapter + DI.

**DEC-2 — disabled-channel behaviour.** (a) Option A: dispatcher returns a clear Skipped result + falls back to email where sensible; a disabled sender invoked directly throws `ChannelDisabledException` (caught by the dispatcher). (b) Story rec A + autonomous quote + "no silent drop, no crash". (c) `Dispatcher_FallsBackToEmail_WhenSmsDisabled` + `Dispatcher_SkipsCleanly_WhenChannelDisabledAndNoEmailFallback`.

**DEC-3 — refactor blast radius.** (a) Option A: route only the automation send path (S2) through the dispatcher; campaigns + event-notifications stay on `IEmailSender`. (b) Story rec A + autonomous quote + smallest surface for zero behaviour change. (c) `AutomationExecutionService.SendMessageAsync` swapped `IEmailSender`→`IMessageDispatcher` (the S2 DEC-4 seam); S2 tests rebuilt over a real `MessageDispatcher`+`EmailChannelSender` and stay green (still 1 email/recipient).

**DEC-4 — `IChannelPreferenceService` ownership.** (a) Option A: define the seam here with `DefaultChannelPreferenceService` (email-always-eligible); S5 supplies the real eligibility. (b) Story rec A + autonomous quote + keeps S4 shippable without S5. (c) Registered default; S5 replaces the registration + wires the automation send to consult it.

**DEC-5 — provider-setup doc location.** (a) Option A: a focused new `docs/15_multichannel_messaging.md` + `.env.example` keys. (b) Story rec A + autonomous quote + better for an operator enabling SMS later than env-comments alone. (c) Doc authored + A42/A60 reread (SMTP STARTTLS claim verified against `System.Net.Mail.SmtpClient`; no invented port/option).

### Completion Notes List

- Built the Application-layer messaging abstraction (`MessageChannel`/`MessageRequest`/`MessageContent`/`MessageSendResult`/`IMessageChannelSender`/`IMessageProvider`/`IMessageDispatcher`/`IChannelPreferenceService`+default), the Infrastructure senders (`EmailChannelSender` default + disabled `Sms`/`WhatsApp` stubs), `MessageDispatcher` (select-enabled + email-fallback + isolate-failures), `SmsSettings`/`WhatsAppSettings`, DI registration, the `appsettings.json` disabled stanza + `.env.example` keys, and `docs/15_multichannel_messaging.md`.
- **DEC-3 swap done + regression-guarded:** the automation send path now dispatches via `IMessageDispatcher` (email default); the S2 idempotency/failure-isolation tests were updated to construct the service over a real dispatcher and still pass (email channel still sends exactly one message per recipient).
- **No migration** (no new persistence — preferences are S5). Backend builds 0/0; Api.Tests 233 green (host boots with the new messaging DI); 8 messaging + 4 execution-service tests green.

### File List

**NEW (Application):**
- `backend/src/IabConnect.Application/Communication/Messaging/MessageChannel.cs`
- `backend/src/IabConnect.Application/Communication/Messaging/MessageRequest.cs`
- `backend/src/IabConnect.Application/Communication/Messaging/IMessageChannelSender.cs`
- `backend/src/IabConnect.Application/Communication/Messaging/IChannelPreferenceService.cs`

**NEW (Infrastructure):**
- `backend/src/IabConnect.Infrastructure/Messaging/MessagingSettings.cs`
- `backend/src/IabConnect.Infrastructure/Messaging/EmailChannelSender.cs`
- `backend/src/IabConnect.Infrastructure/Messaging/DisabledChannelSenders.cs`
- `backend/src/IabConnect.Infrastructure/Messaging/MessageDispatcher.cs`

**NEW (Docs):**
- `docs/15_multichannel_messaging.md`

**NEW (Tests):**
- `backend/tests/IabConnect.Infrastructure.Tests/Messaging/MessagingTests.cs`

**MODIFIED:**
- `backend/src/IabConnect.Infrastructure/Communication/AutomationExecutionService.cs` (send path → `IMessageDispatcher`, DEC-3)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ messaging settings/senders/dispatcher/preference-default)
- `backend/src/IabConnect.Api/appsettings.json` (+ disabled `Sms`/`WhatsApp` stanzas)
- `backend/.env.example` (+ `Sms__*`/`WhatsApp__*` keys, no values)
- `backend/tests/IabConnect.Infrastructure.Tests/Communication/AutomationExecutionServiceTests.cs` (construct over real dispatcher)

## Change Log

- 2026-06-06: Story refreshed from the 2026-05-12 pre-pivot stub (filler "As a user, I want Add Multi-channel Messaging Abstraction") to dev-ready in the Epic-5 A34 bulk pass; post-MVP scope; A56 spike documented the email-only state (`IEmailSender`/`SmtpEmailSender`/`SmtpSettings`) + the config-secret pattern to mirror + the net-new `IMessageChannelSender`/`IMessageProvider`/`IMessageDispatcher` + `EmailChannelSender` default + disabled SMS/WhatsApp stubs; DEC-1..DEC-5 surfaced (shape / disabled-behaviour / blast-radius / S5-seam / doc-location); minimal-blast-radius scoping (only the automation send path moves; email unchanged); no migration.
- 2026-06-06: **Implemented (autonomous dev-story).** Built the channel abstraction (`IMessageChannelSender`/`IMessageProvider`/`IMessageDispatcher`/`MessageChannel`/`MessageRequest`), `EmailChannelSender` default + disabled `Sms`/`WhatsApp` stubs + `MessageDispatcher` (select-enabled + email-fallback + isolated failures), config POCOs + secrets-in-config + `docs/15_multichannel_messaging.md`, and the `IChannelPreferenceService` seam (default email-eligible, S5 fills it). DEC-3 swap: the automation send path now routes through `IMessageDispatcher` (email default); campaigns/event-notifications unchanged; S2 tests regression-guarded green. DEC-1..DEC-5 auto-resolved to option A (A41/A43). 8 messaging + 4 execution-service tests green; Api.Tests 233 green. No migration. Status → review.
