# Story 5.5: Add User Channel Preferences

Status: review

## Refresh Notes (2026-06-06, Epic-5 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub. Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-5 (Communication Automation)** per user directive *"für das ganze nächste epic sollst du alle stories vorbereiten und nicht nur eins. beachte es ist kein mvp mehr."* (2026-06-06). This is the **second REQ-030 story** and the epic closer: it lets a user choose a preferred communication channel and makes the send path honour **consent + preference + provider-availability** before using a channel — completing the multi-channel slice S4 began.

**A56 existing-implementation spike — what already ships vs what is net-new:**

- **The user-facing preferences surface already exists and is the exact home for this:** [frontend/src/app/profile/page.tsx](../../frontend/src/app/profile/page.tsx) has a **"Datenschutz & Einwilligungen" (Consent Preferences) card** (~L527-562) where a member toggles `Newsletter` + `EventNotifications` consents. The toggle calls `grantConsent`/`revokeConsent` from [frontend/src/lib/api/privacy.ts](../../frontend/src/lib/api/privacy.ts) (`GET/POST/DELETE /api/v1/privacy/consents/{type}`), then re-fetches and shows a saved/error message (`profile.consentSaved`/`consentError`). **Channel preferences extend this card / add a sibling section** (DEC-3) — same page, same save-then-refresh + message pattern, same shared `checkbox`/`card`/`label` components.
- **Consent is modeled + enforced and must be reused, not duplicated:** `Consent` entity + `ConsentType` (Newsletter/Marketing/EventNotifications/…) + `IConsentRepository.HasConsentAsync(userId, type)` ([Consent.cs](../../backend/src/IabConnect.Domain/Privacy/Consent.cs), [IPrivacyRepositories.cs](../../backend/src/IabConnect.Domain/Privacy/IPrivacyRepositories.cs)). The eligibility check *"consent before send"* reuses `HasConsentAsync` — it does NOT re-implement consent. Consent (may I contact you about X) and channel preference (by which medium) are **orthogonal** — both must pass.
- **The channel abstraction is S4's:** `IMessageChannelSender`/`IMessageDispatcher`/`MessageChannel` + the `IChannelPreferenceService` **seam** (S4 DEC-4 defines the interface with a default "email always eligible"). **This story implements `IChannelPreferenceService` for real** — storage of the user's preferred channel + the eligibility logic the dispatcher calls.
- **No channel-preference storage exists today** — `UserChannelPreference` (or equivalent) is net-new. The natural key is the **Keycloak user id** (same key `Consent.UserId` uses), not the member id, so non-member users with accounts are handled uniformly.
- **Net-new (this story):** a `UserChannelPreference` entity (UserId + Channel + IsEnabled/preferred-flag) + EF config + migration + repository; the **real `IChannelPreferenceService`** (eligibility = consent AND preference AND provider/channel available, with graceful email fallback/block per DEC-2); a self-service preferences API (`GET`/`PUT` under the privacy/profile surface); the wiring so the S4 dispatcher / S2 automation send consults it; a frontend Channel Preferences section on `/profile`; backend eligibility tests + frontend preference-UI tests; de/en i18n keys.

**A34 note:** authored alongside S1/S2/S3/S4. **Depends on S4** (`MessageChannel` + `IChannelPreferenceService` seam + the dispatcher consulting it). Dev-story order S1 → S2 → S3 → S4 → **S5** (epic closer). The eligibility check this story implements is what makes the S4 dispatcher actually preference-aware.

## Story

As **a member who would rather get reminders by my preferred channel** (post-MVP, REQ-030: e.g. SMS for event reminders if/when the Verein enables it), and as the **system that must never message someone on a channel they didn't consent to, didn't choose, or that isn't actually configured**,
I want **a place in my profile to view and set my channel preference, and a send-time eligibility check that confirms consent, my preference, and provider availability — falling back or blocking gracefully when any of the three is missing — before any channel is used**,
so that **reminders use my preferred channel where supported, a revoked consent or an unconfigured SMS provider can never cause a wrong-channel or failed send, and my preference is validated and durably saved**.

**Requirement:** REQ-030 (Multi-channel Messages). Epic E5 (Communication Automation), Story 5 of 5.

- **Source-of-truth:** [epics-and-stories.md §Story E5-S5 (L648-670)](../planning-artifacts/epics-and-stories.md).
- **Architecture anchors:** [REQ-030 (L668-685)](../planning-artifacts/architecture.md) (*channel preference + consent must be checked before send; `IChannelPreferenceService`*), [architecture.md §Multi-channel preferences: profile and communication settings (L456)](../planning-artifacts/architecture.md), [ADR-003 Backend Authorization Mandatory](../planning-artifacts/architecture.md), [ADR-004 PostgreSQL + EF Core](../planning-artifacts/architecture.md).
- **Reuse source:** the `Consent`/`ConsentType`/`IConsentRepository` model + the `/profile` consent-card UI + `privacy.ts` API helper + S4's channel abstraction.

**Upstream (dependencies):**

- **E5-S4 done** — `MessageChannel` enum, `IMessageDispatcher`, the `IChannelPreferenceService` seam (this story replaces the default impl). ✅ when S4 lands.
- **Privacy/consent + profile done** — `Consent`/`IConsentRepository`, `/profile` page + consent card + `privacy.ts`. ✅

**Downstream:** none — epic closer. The eligibility check feeds back into S2's automation send (a recipient on a disabled/unpreferred channel is skipped/falls-back gracefully).

**Wave context:** Epic-5 closer (REQ-030 completion). **Net-new artifacts:** `UserChannelPreference` entity + EF config + migration + repository; real `ChannelPreferenceService` (eligibility); self-service preferences API (`GET`/`PUT`); the dispatcher/automation wiring; a `/profile` Channel Preferences section; de/en i18n keys; backend eligibility + frontend UI tests. Est. +350-550 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E5-S5 — user can view and update channel preferences]: A signed-in user can view and update their channel preference(s) through a self-service API (`GET`/`PUT` under the privacy/profile surface — DEC-4 fixes the route) gated to the **current user only** (a user edits their own preferences; reuse the `/api/v1/members/me`-style self scoping). Persisted as `UserChannelPreference` keyed by the Keycloak `UserId` (the same key `Consent` uses), with a sensible default (email enabled) when no row exists.

**AC-2** [epics §E5-S5 — eligibility: consent AND preference AND provider availability before send (LOAD-BEARING)]: The real `IChannelPreferenceService` (replacing S4's default seam) decides, for a (user, message-intent) pair, which channel to use by checking **all three**: (a) **consent** via `IConsentRepository.HasConsentAsync(userId, consentType)`; (b) **preference** (the user's chosen channel); (c) **provider/channel availability** (`IMessageChannelSender.IsEnabled` for that channel, from S4). The S4 dispatcher / S2 automation send consults it before choosing a channel.

**AC-3** [epics §E5-S5 — missing consent/preference/provider blocks the send gracefully]: When any of the three fails, the send degrades **gracefully** (DEC-2 — recommended): no consent → the recipient is **skipped** (recorded as Skipped with reason, never sent); preferred channel unavailable (provider disabled) → **fall back to email** if email is consented+available, else skip; no explicit preference → **default to email**. No crash, no wrong-channel send, no silent loss — the caller (S2) records the disposition (`AutomationRecipient` Skipped/Sent with channel + reason).

**AC-4** [epics §E5-S5 — preference updates validated and persisted]: `PUT` validates the payload (channel is a known `MessageChannel`; you cannot *prefer* a channel that has no consent path / can't be enabled per the product rule — DEC-5) and persists via the repository + migration. Invalid updates → `400` with field errors. The change is durable (Testcontainers round-trip).

**AC-5** [epics §E5-S5 — UI uses next-intl + existing profile/settings patterns]: A **Channel Preferences** section on `/profile` (extending or sibling to the Consent Preferences card — DEC-3) lets the user see + set their preference using the shared `card`/`label`/`select`-or-`checkbox` components, the same save-then-refresh + success/error-message pattern as the consent card, `orange-600` primary, and **`next-intl` keys in both `de.json` + en.json** (parity — A51). It surfaces which channels are actually available (e.g. SMS shown disabled/"coming soon" when the provider is off) so the user isn't offered an impossible choice.

**AC-6** [project-context — auth, audit, privacy]: The preferences API enforces self-scoping server-side (ADR-003 — UI is not the boundary); a preference change is auditable where consent changes are (reuse the privacy-audit pattern). Preferences are personal data — treated under the same privacy/retention rules as consent (no leakage across users; covered by the self-scoped query filter).

**AC-7** [tests — eligibility + persistence + UI]: New tests green:
- **Backend eligibility (Application/Infrastructure):** the three-way check — consent+preference+available → uses preferred; consent-missing → skip; preferred-unavailable → email fallback; no-preference → email default. Each branch asserted (mirror the AC-3 matrix).
- **Persistence (Testcontainers PostgreSQL):** `UserChannelPreference` round-trip; self-scoped query returns only the caller's row.
- **API:** `GET`/`PUT` self-scoped (a user can't read/write another user's preference); `PUT` validation (unknown channel → 400).
- **Frontend (Vitest):** the Channel Preferences section renders current preference, a change calls the right helper → refresh → success message; disabled-channel shown as unavailable. A35/A46 (cleanup for render tests), A64 (stable `useTranslations`), A51 i18n parity (pure-Node), A58 changed-files gate.
- If S2 landed: a recipient with no consent is Skipped by the automation send (integration regression).

**AC-8** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 (every AC sub-item: covered / deferred / N/A + evidence).

## Tasks / Subtasks

**Task 0 — Spike (A28/A56; resolve DEC-1..DEC-5 per A32, or A41 auto-resolve + A43 Debug Log)**

- [x] **0.1** Read `Consent.cs` + `IConsentRepository` (`HasConsentAsync`) + the privacy endpoints (`/api/v1/privacy/consents`) — the consent model + self-scoped API to mirror.
- [x] **0.2** Read `/profile/page.tsx` consent card (~L527-562) + `lib/api/privacy.ts` (`getConsents`/`grantConsent`/`revokeConsent`) — the UI + helper pattern (DEC-3).
- [x] **0.3** Read S4's `MessageChannel` + `IMessageDispatcher` + `IChannelPreferenceService` seam (the interface this story implements + where the dispatcher calls it).
- [x] **0.4** Read a self-scoped "me" endpoint (`/api/v1/members/me`) for the self-scoping auth pattern.
- [x] **0.5** **Resolve DEC-1..DEC-5** via `AskUserQuestion` (or A41 + A43). Spike output ~6-8 lines.

**Task 1 — Domain/persistence: `UserChannelPreference` (AC-1, AC-4)**

- [x] **1.1** `UserChannelPreference` entity (UserId Keycloak guid, Channel/preferred-flag, timestamps) + repository (self-scoped get/upsert).
- [x] **1.2** EF config (`user_channel_preferences`, unique on UserId(+Channel per DEC-1)) + migration + DbSet + DI.

**Task 2 — Application/Infrastructure: real `IChannelPreferenceService` (AC-2, AC-3)**

- [x] **2.1** Implement `IChannelPreferenceService` (replacing S4's default): three-way eligibility (consent via `HasConsentAsync` + preference + `IMessageChannelSender.IsEnabled`) → resolved channel or skip, with email fallback/default per DEC-2.
- [x] **2.2** Wire the S4 dispatcher / S2 automation send to consult it (the caller records Skipped/Sent + channel + reason).

**Task 3 — API: self-service preferences (AC-1, AC-4, AC-6)**

- [x] **3.1** `GET`/`PUT` preferences (self-scoped, route per DEC-4) + validation (DEC-5) + audit on change.

**Task 4 — Frontend: profile Channel Preferences (AC-5)**

- [x] **4.1** Channel Preferences section on `/profile` (DEC-3) + `privacy.ts` (or a new helper) calls + de/en i18n keys + available-channel surfacing.

**Task 5 — Tests (AC-7)**

- [x] **5.1** Eligibility-matrix + Testcontainers persistence + self-scoped API + Vitest UI (A35/A46/A64/A51/A58). `dotnet test` + `vitest run` green; S2 skip-on-no-consent regression if landed.

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-8)**

- [x] **6.1** QGT table (A29). **6.2** A43 (a)/(b)/(c) for DEC-1..DEC-5. **6.3** Status flip ready-for-dev → in-progress → review.

## Dev Notes

### A28/A56 Spike Output Anchors

- **Consent model + enforcement (reuse):** `Consent`/`ConsentType` ([Consent.cs](../../backend/src/IabConnect.Domain/Privacy/Consent.cs)); `IConsentRepository.HasConsentAsync` ([IPrivacyRepositories.cs](../../backend/src/IabConnect.Domain/Privacy/IPrivacyRepositories.cs)); privacy endpoints `/api/v1/privacy/consents`.
- **Profile UI pattern (DEC-3):** `/profile/page.tsx` consent card ~L527-562 + `lib/api/privacy.ts` (`getConsents`/`grantConsent`/`revokeConsent`, save-then-refresh + message).
- **Channel abstraction (S4):** `MessageChannel`, `IMessageDispatcher`, `IChannelPreferenceService` seam + `IMessageChannelSender.IsEnabled`.
- **Self-scoping:** `/api/v1/members/me` pattern (current-user only).
- **Key:** preferences keyed by Keycloak `UserId` (as `Consent` is), not member id.
- **Privacy/audit:** preference = personal data; reuse the privacy-audit pattern; self-scoped query filter prevents cross-user leakage.

### Decision-Needed Block

**DEC-1 — preference storage shape.**
- **A (RECOMMENDED):** A `UserChannelPreference` row per (UserId, Channel) with an enabled/preferred flag (or a single "preferred channel" per user — see DEC-1b), keyed by Keycloak UserId. A dedicated entity keeps channel preference orthogonal to `Consent` (consent = "may I contact you about X"; preference = "by which medium").
- **B:** Extend `Consent`/add a column on Member. Conflates two orthogonal concepts (consent vs channel) + member-only key excludes non-member accounts. Rejected.
- *Recommendation A — model it as its own entity; pick per-channel-flag vs single-preferred at DEC-1b in spike based on the product rule.*

**DEC-2 — graceful-degradation policy when an eligibility check fails.**
- **A (RECOMMENDED):** No consent → **skip** (record Skipped+reason). Preferred channel disabled → **fall back to email** if email is consented+available, else skip. No explicit preference → **default to email**. Never crash, never wrong-channel.
- **B:** Hard-fail the send on any miss. Rejected — a disabled SMS provider would block reminders entirely.
- *Recommendation A — the caller (S2) records the disposition per recipient.*

**DEC-3 — UI placement.**
- **A (RECOMMENDED):** A Channel Preferences section on `/profile`, sibling to the existing Consent Preferences card, reusing its save-then-refresh + message pattern + shared components. Architecture L456 says "profile and communication settings".
- **B:** A separate `/settings/communication` page. Heavier; the profile card is the established self-service preferences home.
- *Recommendation A.*

**DEC-4 — preferences API route.**
- **A (RECOMMENDED):** Under the privacy surface (`/api/v1/privacy/channel-preferences`) next to consents — self-scoped, same auth shape. Keeps "what may I send / how may I send" together.
- **B:** Under members (`/api/v1/members/me/channel-preferences`). Also fine; pick whichever matches the consent endpoints' host (spike 0.1).
- *Recommendation A (co-locate with consent).*

**DEC-5 — preference validation rule (can you prefer a channel with no consent / no provider?).**
- **A (RECOMMENDED):** Allow *storing* a preference for any known `MessageChannel` (the user may pre-set SMS before the Verein enables it), but the **eligibility check (AC-2/AC-3) gates the actual send** — preference is intent, eligibility is the gate. `PUT` rejects only unknown channels. This decouples "what I want" from "what's possible right now".
- **B:** Reject preferring a disabled channel at `PUT` time. Simpler validation but forces re-setting preferences whenever a provider is toggled; worse UX.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **Consent reused, not duplicated** — eligibility calls `IConsentRepository.HasConsentAsync`; consent and channel-preference stay orthogonal.
2. **Three-way gate** — consent AND preference AND availability, all checked before a channel is used (AC-2); the matrix is fully tested.
3. **Graceful degradation** — skip / email-fallback / email-default; never crash or wrong-channel (AC-3).
4. **Self-scoping is the boundary** — server enforces current-user-only (ADR-003); UI is not the gate.
5. **i18n + UI parity** — Channel Preferences keys in de + en; reuse the consent-card pattern + shared components.
6. **S4 seam filled** — this story's `ChannelPreferenceService` replaces S4's default; the dispatcher consults it.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared (A41 + A43), auto-pick DEC-1=A, DEC-2=A, DEC-3=A, DEC-4=A, DEC-5=A and record the Debug Log. Otherwise surface DEC-1..DEC-5 via `AskUserQuestion` at Task 0.

### Project Structure Notes

- NEW Domain: `Privacy/UserChannelPreference.cs` (or `Communication/Messaging/`) + repository interface.
- NEW Application: `ChannelPreferenceService` impl of S4's `IChannelPreferenceService` + DTOs + validator.
- NEW Infrastructure: repository impl, `Persistence/Configurations/UserChannelPreferenceConfiguration.cs`, `Migrations/{timestamp}_AddUserChannelPreferences.cs`, DI.
- NEW API: preferences `GET`/`PUT` endpoints (DEC-4) on the privacy/members surface.
- NEW Frontend: Channel Preferences section in `frontend/src/app/profile/page.tsx` + helper in `lib/api/privacy.ts` (or new) + de/en i18n keys + Vitest tests.
- MODIFIED: S4's `IMessageDispatcher`/automation send now consults the real `IChannelPreferenceService` (replace the default registration); `ApplicationDbContext.cs` (+ DbSet); DI.
- UNCHANGED (regression-guarded): `Consent` model + consent endpoints + the existing profile consent card; S4's channel senders.

### References

- [Source: epics-and-stories.md §Story E5-S5 (L648-670)] — authoritative AC.
- [Source: architecture.md REQ-030 (L668-685) + §profile/communication settings (L456) + ADR-003/004].
- [Source: Consent.cs / IPrivacyRepositories.cs + /api/v1/privacy/consents] — consent model + self-scoped API.
- [Source: frontend/src/app/profile/page.tsx (consent card ~L527-562) + lib/api/privacy.ts] — UI + helper pattern (DEC-3).
- [Source: E5-S4 — MessageChannel + IMessageDispatcher + IChannelPreferenceService seam].
- [Source: project-context A56, A51 (parity), A35/A46/A64 (frontend), A58 (changed-files gate), A29, ADR-003 self-scoping].

## Quality-Gates Closing Check (A29 / AC-8)

_To be filled by dev agent — one row per AC sub-item._

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | View/update preferences, self-scoped, default email | ✅ covered | `ChannelPreferenceEndpoints` GET/PUT `/api/v1/privacy/channel-preferences` (RequireMember, self-scoped via `sub`); `UserChannelPreference` keyed by Keycloak UserId; default "Email" when no row; `Get_ReturnsDefaultEmail_AndAvailableChannels` |
| AC-2 | Eligibility = consent AND preference AND availability | ✅ covered | `ChannelPreferenceService.ResolveChannelAsync` (consent via `HasConsentAsync` + preference via `UserChannelPreference` + availability via `IMessageChannelSender.IsEnabled`); `ConsentAndPreferenceAndAvailable_UsesPreferred`; automation send consults it before dispatch |
| AC-3 | Graceful: skip / email-fallback / email-default | ✅ covered | `ConsentMissing_ReturnsNull_Skip` / `PreferredChannelDisabled_FallsBackToEmail` / `NoExplicitPreference_DefaultsToEmail` / `PreferredAndEmailBothUnavailable_ReturnsNull_Skip`; `IneligibleRecipient_IsSkipped_NotSent` (automation records Skipped, never sends) |
| AC-4 | `PUT` validation + durable persistence | ✅ covered | PUT rejects unknown channel → 400 (`Put_UnknownChannel_Returns400`); known channel persisted (`Put_PersistsPreference_AndGetReflectsIt`); Testcontainers `Upsert_InsertsThenUpdates_OneRowPerUser` + migration `AddUserChannelPreferences` |
| AC-5 | `/profile` Channel Preferences section + i18n (de+en) | ✅ covered | `ChannelPreferencesCard` on `/profile` (radio per channel, save-then-refresh + message, orange-600, disabled-channel "coming soon"); `profile.channelPreferences.*` keys in de+en; `privacy.ts` helpers |
| AC-6 | Self-scoping enforced server-side + audit | ✅ covered | endpoints derive user from `sub` claim only (no user-supplied id; `Get_WithoutAuth_Returns401`); repo query is `WHERE UserId == caller` (`GetByUserId_IsSelfScoped`); PUT writes `LogActionAsync(SettingsChanged, entityType:"UserChannelPreference")` |
| AC-7 | Eligibility-matrix + persistence + API + Vitest tests | ✅ covered | 6 eligibility + 2 Testcontainers persistence + 4 API + 3 Vitest (card) + 1 automation skip-on-ineligible regression — all green; A35/A46/A64/A51/A58 honoured |
| AC-8 | This table populated | ✅ covered | this table |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] — autonomous dev-story run (epic closer, continued from S4).

### Debug Log References

**A41 autonomous-mode escape engaged** (same user directive quoted in S1; all 5 DECs → option A).

**DEC-1 — preference storage shape.** (a) Option A: a `UserChannelPreference` entity keyed by Keycloak UserId, **one row per user with a single preferred channel** (DEC-1b: single-preferred, simpler than per-channel flags). (b) Story rec A + autonomous quote + keeps channel preference orthogonal to consent + non-member-uniform key. (c) Unique index on UserId; channel stored as its string name (Domain must not reference the Application-layer `MessageChannel` enum — the service/API map between them).

**DEC-2 — graceful degradation.** (a) Option A: no consent→skip; preferred-disabled→email fallback; no-preference→email default; never crash/wrong-channel. (b) Story rec A + autonomous quote + "a disabled SMS provider must not block reminders". (c) `ChannelPreferenceService.ResolveChannelAsync` implements exactly this matrix (6 tests); the automation send records the disposition per recipient.

**DEC-3 — UI placement.** (a) Option A: a Channel Preferences section on `/profile`, sibling to the Consent Preferences card, reusing its save-then-refresh + message pattern. (b) Story rec A + autonomous quote + architecture L456 "profile and communication settings". (c) `ChannelPreferencesCard` mounted after the consent card.

**DEC-4 — preferences API route.** (a) Option A: `/api/v1/privacy/channel-preferences` (co-located with consents, same self-scoped auth shape). (b) Story rec A + autonomous quote + "keeps what-may-I-send / how-may-I-send together". (c) GET/PUT on the privacy surface, RequireMember, self-scoped via `sub`.

**DEC-5 — preference validation rule.** (a) Option A: allow storing a preference for any KNOWN `MessageChannel` (the user may pre-set SMS before it's enabled); eligibility gates the actual send; `PUT` rejects only unknown channels. (b) Story rec A + autonomous quote + "preference is intent, eligibility is the gate". (c) `Put_UnknownChannel_Returns400`; a known-but-disabled channel is storable + falls back at send.

### Completion Notes List

- Built `UserChannelPreference` (keyed by Keycloak UserId, channel-as-string to respect layering) + repository (self-scoped upsert), EF config (unique UserId) + migration `AddUserChannelPreferences`, the **real** `ChannelPreferenceService` (three-way eligibility, replaces S4's default), self-service GET/PUT endpoints under `/api/v1/privacy/channel-preferences` (self-scoped + audited), the `/profile` Channel Preferences card + `privacy.ts` helpers + de/en i18n, and wired the automation send to consult `IChannelPreferenceService` before dispatch (a recipient who fails eligibility is recorded Skipped).
- **S2 wiring + regression:** `AutomationExecutionService.SendMessageAsync` now resolves the channel via eligibility (passing the definition's `ConsentFilter`); the existing S2 tests use the email-eligible default and stay green; a new `IneligibleRecipient_IsSkipped_NotSent` proves the skip path.
- Backend builds 0/0; whole backend suite green (Application 1517 / Api 237 / Infrastructure 457); whole frontend suite green (201). No migration conflicts (3 Epic-5 migrations apply cleanly via Testcontainers `EnsureCreated`).

### File List

**NEW (Domain):**
- `backend/src/IabConnect.Domain/Communication/UserChannelPreference.cs` (entity + `IUserChannelPreferenceRepository`)

**NEW (Infrastructure):**
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/UserChannelPreferenceRepository.cs`
- `backend/src/IabConnect.Infrastructure/Messaging/ChannelPreferenceService.cs` (real eligibility, replaces S4 default)
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/UserChannelPreferenceConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/{ts}_AddUserChannelPreferences.cs` (+ `.Designer.cs` + ModelSnapshot delta)

**NEW (API):**
- `backend/src/IabConnect.Api/Endpoints/ChannelPreferenceEndpoints.cs`

**NEW (Frontend):**
- `frontend/src/app/profile/ChannelPreferencesCard.tsx`
- `frontend/src/app/profile/ChannelPreferencesCard.test.tsx`

**NEW (Tests):**
- `backend/tests/IabConnect.Infrastructure.Tests/Messaging/ChannelPreferenceServiceTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/UserChannelPreferenceRepositoryTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/ChannelPreferenceEndpointTests.cs`

**MODIFIED:**
- `backend/src/IabConnect.Infrastructure/Communication/AutomationExecutionService.cs` (consult `IChannelPreferenceService` before dispatch)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (+ pref repo; replace default `IChannelPreferenceService` with `ChannelPreferenceService`)
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` (+ `DbSet<UserChannelPreference>`)
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` (+ `MapChannelPreferenceEndpoints`)
- `frontend/src/lib/api/privacy.ts` (+ channel-preference helpers)
- `frontend/src/app/profile/page.tsx` (+ mount `ChannelPreferencesCard`)
- `frontend/messages/de.json` + `en.json` (+ `profile.channelPreferences.*`)
- `backend/tests/IabConnect.Infrastructure.Tests/Communication/AutomationExecutionServiceTests.cs` (+ preference-service ctor arg + skip-on-ineligible test)

## Change Log

- 2026-06-06: Story refreshed from the 2026-05-12 pre-pivot stub to dev-ready in the Epic-5 A34 bulk pass; post-MVP scope; A56 spike documented the shipped `/profile` consent-card + `privacy.ts` + `Consent`/`IConsentRepository` to reuse, the S4 `IChannelPreferenceService` seam this story fills, and the net-new `UserChannelPreference` entity + real eligibility service + self-service API + profile UI; DEC-1..DEC-5 surfaced (storage shape / graceful-degradation / UI placement / route / validation); consent-vs-preference orthogonality + three-way eligibility gate emphasised.
- 2026-06-06: **Implemented (autonomous dev-story, epic closer).** Built `UserChannelPreference` (keyed by Keycloak UserId, channel-as-string) + repo + migration, the real `ChannelPreferenceService` (consent AND preference AND availability; skip/email-fallback/email-default) replacing S4's default seam, self-service GET/PUT `/api/v1/privacy/channel-preferences` (self-scoped + audited + unknown-channel 400), the `/profile` Channel Preferences card + `privacy.ts` helpers + de/en i18n, and wired the automation send to consult eligibility (ineligible → Skipped). DEC-1..DEC-5 auto-resolved to option A (A41/A43). 6 eligibility + 2 persistence + 4 API + 3 Vitest + 1 automation-skip tests green; whole backend (2211) + frontend (201) suites green, no regressions. Status → review.
