# Story E3.S2: Add QR and Manual Check-in Flow

Status: done (Round-4 fix-pass complete 2026-05-14 — R4-P-S2-1 High resolved (Pending/NoShow check-in now typed 409, not 500); 2 Defer logged; backend 1810 / 1810 + frontend 38 / 38 green)

## Story

As event-day staff,
I want to scan a participant's QR code or search/select them manually and mark them checked-in,
so that arrivals are recorded reliably even when the camera fails or the participant has no printed QR.

Requirement: **REQ-023** (Check-in vor Ort QR-Code — Events, Priority Could). Story is the **state-changing + UI** half of E3 Wave 3 (sprint-plan Wave 3 Order 2). The roster query + CSV export are E3.S1 — they MUST be done first because the manual-search UI consumes `GetEventCheckInRosterQuery`.

## Acceptance Criteria

1. **MediatR `CheckInRegistrationCommand` (QR + ID path) exists.** Add `CheckInRegistrationCommand(Guid EventId, Guid? RegistrationId, string? QrCodeToken, Guid CheckedInBy) : IRequest<CheckInResultDto>` + `CheckInRegistrationCommandHandler` in [backend/src/IabConnect.Application/Events/CheckIn/](backend/src/IabConnect.Application/Events/CheckIn/). Exactly one of `RegistrationId` / `QrCodeToken` MUST be set — enforce with a `FluentValidation.AbstractValidator<CheckInRegistrationCommand>` (`.Must(x => (x.RegistrationId is null) != (x.QrCodeToken is null))`). Handler routes on the non-null discriminator: `RegistrationId` → `IEventRegistrationRepository.GetByIdAsync` + verify `registration.EventId == cmd.EventId`; `QrCodeToken` → `IEventRegistrationRepository.GetByQrCodeTokenAsync` (existing method at [IEventRegistrationRepository.cs:26](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs#L26)). Not-found returns `CheckInResultDto.NotFound`; the existing 404 contracts at [EventRegistrationEndpoints.cs:464-465](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L464-L465) and [635](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L635) are preserved at the endpoint layer.

2. **MediatR `ManualCheckInRegistrationCommand` (manual-search path) exists.** Add `ManualCheckInRegistrationCommand(Guid EventId, Guid RegistrationId, Guid CheckedInBy) : IRequest<CheckInResultDto>` + handler in the same folder. Behaviour is identical to the ID-path of `CheckInRegistrationCommand` except the command name + audit `Action` discriminator differ (see AC-4) so the audit trail can distinguish "scanned" from "manually selected". Both commands share `CheckInResultDto` (see AC-3) so the API layer maps responses uniformly.

3. **`EventRegistration.CheckIn` is refactored to be idempotent and returns a result.** Today [EventRegistration.cs:312-313](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L312-L313) throws `InvalidOperationException("Participant is already checked in")` on a duplicate scan. **Refactor the entity** to:
    - Change the method signature to `public CheckInResult CheckIn(Guid checkedInBy)` where `CheckInResult` is a `record(bool WasAlreadyCheckedIn, DateTime CheckedInAt, Guid CheckedInBy)`.
    - On already-checked-in: return `new CheckInResult(WasAlreadyCheckedIn: true, CheckedInAt: this.CheckedInAt!.Value, CheckedInBy: this.CheckedInBy ?? Guid.Empty)` instead of throwing. **Do NOT mutate state or `UpdatedAt`.** This is the core idempotency contract per AC-2 of the epic ("duplicate scans show current state and do NOT create duplicate attendance records"). Note the **Round-3 R3-DN-5** decision (option a): `CheckedInBy ?? Guid.Empty` is the defensive fallback for legacy null-attributed rows — the contract surfaces `Guid.Empty` as the "legacy sentinel" rather than NullReferenceException-ing or silently re-attributing to the second caller. Round-3 R3-H-S2-2 also adds an explicit `Status == CheckedIn` short-circuit BEFORE the `CheckedInAt.HasValue` check so a Status-CheckedIn-but-CheckedInAt-null data desync (partial migration, manual SQL repair) is treated as idempotent, not as a fresh check-in.
    - Keep the existing `Cancelled` and `Waitlisted` pre-checks (lines 308-311) as `InvalidOperationException` — these are domain-rule violations, not duplicate scans, and the command handler maps them to a typed `CheckInResultDto.ConflictReason` (see AC-3) without `LogAccessGranted`. **Round-2 H-S2-4** added `Pending` and `NoShow` to the throw-on-invalid-state set: only Confirmed and CheckedIn are eligible to call into the idempotent path.
    - Existing entity tests in [backend/tests/IabConnect.Domain.Tests/Events/EventRegistrationTests.cs](backend/tests/IabConnect.Domain.Tests/Events/EventRegistrationTests.cs) that assert the "already checked in" throw MUST be updated to assert the idempotent return; don't suppress them. **Rationale captured as D1 below.**
    - Update the existing API callers at [EventRegistrationEndpoints.cs:488](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L488) and [642](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L642) so their direct entity calls still compile (the new method returns a value — discard with `_ = registration.CheckIn(...)`) OR migrate them to the new MediatR command (see Task 5).

4. **Audit on every successful check-in, with verb discipline.** Both command handlers MUST call `ISecurityAuditLogger.LogAccessGranted` exactly once on a successful state-changing check-in. The handler MUST NOT log when `WasAlreadyCheckedIn == true` (no state change occurred — the audit row would be misleading). Use the verb discipline from [SecurityAuditLogger.cs:102-130](backend/src/IabConnect.Application/Authorization/SecurityAuditLogger.cs#L102-L130):
    - `resource: "EventRegistration"`, `resourceId: registration.Id.ToString()`, `action: "EventCheckInScanned"` for `CheckInRegistrationCommand` with `QrCodeToken`, `action: "EventCheckInById"` for `CheckInRegistrationCommand` with `RegistrationId`, `action: "EventCheckInManual"` for `ManualCheckInRegistrationCommand`. The action verb is the only signal that distinguishes scan vs manual in the audit trail — keep the strings stable across stories.
    - `additionalData` MUST include `eventId`, `wasAlreadyCheckedIn = false`, and (manual path only) `searchQueryHash` (a SHA-256 prefix of the search input, NEVER the raw input — staff lookup queries may include partial PII).
    - Authorization failure (caller lacks `RequireEventStaff`) is logged automatically by policy middleware. Do NOT hand-log `LogAccessDenied` in the handler. Matches the Epic 1 retro A3 verb discipline.

5. **Symmetric guard across all three check-in entry points.** Per the **Symmetric-Guard Checklist** ([docs/07_dos_donts.md:118](docs/07_dos_donts.md#L118)) and Epic 1 retro Action A2: the existing ID-based endpoint at [EventRegistrationEndpoints.cs:76-81](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L76-L81), the existing QR-token endpoint at [line 146-152](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L146-L152), and the new manual-search endpoint MUST all converge on **identical** semantics: same audit verb shape, same idempotent return (200 with `WasAlreadyCheckedIn: true` on duplicate scan, NOT 409 and NOT 500), same 404 envelope (`{ message: "Registration not found" }` / `{ message: "Invalid QR code" }`), and same `RequireEventStaff` authorization (the policy added in E3.S1 — see AC-6). Migrate the two existing endpoint handlers to delegate to the new `CheckInRegistrationCommand` via `ISender` so there is only one state-change code path. **Verify in PR review: grep for direct `registration.CheckIn(` calls outside the entity tests after migration — there should be none.**

6. **Authorized HTTP surface.** All three check-in endpoints MUST use `.RequireAuthorization("RequireEventStaff")` (policy added by E3.S1). Add **one new endpoint** for manual check-in: `POST /api/v1/events/{eventId:guid}/registrations/{registrationId:guid}/manual-check-in` → `200 CheckInResultDto` / `404` / `401|403`. The existing endpoints at [line 76](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L76) and [line 146](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L146) MUST be migrated from the 14× inline `policy.RequireRole("admin", "vorstand", "event-manager")` to `.RequireAuthorization("RequireEventStaff")` — this is the deferred chore documented in E3.S1 D5 and explicitly assigned to this story. **Scope:** migrate only the three check-in endpoints; the other 11 inline role checks remain a separate deferred chore (so the diff stays bounded). Document the partial migration in Completion Notes.

7. **Frontend event-scoped check-in route with QR scanner + manual fallback.** Create `frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx` (new route). Page layout follows [docs/07_dos_donts.md:24-100](docs/07_dos_donts.md#L24-L100) (Standard Page Layout, orange primary actions, sidebar layout). Three first-class UI states:
    - **Scanner state** (default when `navigator.mediaDevices.getUserMedia` is available). Use `@yudiel/react-qr-scanner` (lightweight, ~30 kB, MIT, no native build step). On a decoded token, POST to the QR-token endpoint via `checkInByQrCode(token)`; render the `CheckInResultDto` as a success card with `WasAlreadyCheckedIn` banner when applicable. **Camera permission denial** and **camera-unavailable** (no `mediaDevices` API, HTTPS not present in dev, or user denied) MUST flip the UI into the manual fallback with an explanation banner — the page must NOT show a permission-error dialog and abandon staff at a dead-end.
    - **Manual fallback state** (toggle button always available; activates automatically on scanner failure). Renders an input bound to a `searchTerm` state with 250 ms debounce. The search list is sourced from `GetEventCheckInRosterQuery` (E3.S1) filtered **client-side** by `ParticipantName.toLowerCase().includes(query.toLowerCase())` — the roster DTO already omits PII per E3.S1 AC-3 so client-side filtering is safe, and avoids adding a new server-side LIKE endpoint (which would re-trigger the A7 escape concern). On row-click → `POST /events/{eventId}/registrations/{registrationId}/manual-check-in`; show the same success card.
    - **Invalid QR state.** Server 404 (`{ message: "Invalid QR code" }`) MUST render an inline error banner with a "Scan again" action, NOT a toast that disappears — staff at a noisy venue need a persistent error. Include the offending token's first 8 chars + ellipsis for support troubleshooting (do NOT log the full token; QR tokens are sensitive per [EventRegistration.QrCodeToken](backend/src/IabConnect.Domain/Events/EventRegistration.cs)).
    - All user-visible text uses `next-intl` keys in `frontend/messages/de.json` + `en.json` per dos-and-donts item 8. Orange primary action button per dos-and-donts item 17.

8. **Test coverage spans Domain + Application + API + Frontend.** Adopt the E3.S1 / E2.S1 test discipline:
    - **Domain/Unit:** `EventRegistrationTests` MUST gain `CheckIn_AlreadyCheckedIn_ReturnsIdempotentResult_DoesNotMutateState` asserting `WasAlreadyCheckedIn == true`, `UpdatedAt` is **unchanged**, `CheckedInAt`/`CheckedInBy` are the original values (not overwritten). Existing `CheckIn_AlreadyCheckedIn_Throws`-style test MUST be deleted (its contract is gone). Keep `Cancelled` + `Waitlisted` pre-condition throw tests.
    - **Application/Unit:** `CheckInRegistrationCommandHandlerTests` + `ManualCheckInRegistrationCommandHandlerTests` — `[Theory]` rows for: success, already-checked-in (asserts no audit-log call via mock `ISecurityAuditLogger`), cancelled registration (asserts `ConflictReason.Cancelled`), waitlisted registration (`ConflictReason.Waitlisted`), registration-not-found (`NotFound`), event-mismatch (registration belongs to a different event, returns `NotFound`). Validate the `XOR(RegistrationId, QrCodeToken)` rule with a `FluentValidation` test asserting both-null and both-set fail validation.
    - **Application/Unit:** `ManualCheckInSearchHashTests` — confirms `searchQueryHash` in `additionalData` is a SHA-256 prefix (length 16, base64-ish, deterministic for same input) and does NOT contain the raw query. Per [A7](docs/07_dos_donts.md#L159) discipline, the search input is user-supplied — the hash is the only thing that should appear in audit logs.
    - **Application/Unit (adversarial test data per [A8](docs/07_dos_donts.md#L191)).** The `searchQueryHash` test rows MUST include: a LIKE wildcard input (`a%b`), a leading/trailing-whitespace input (`"  Anna  "`), a German Umlaut input (`"Müller"`), a Unicode-normalised input (precomposed `ä` vs decomposed `ä` MUST produce different hashes — that's expected; document so the test asserts inequality, not equality), and an empty/whitespace-only input (handler MUST reject `string.IsNullOrWhiteSpace(searchInput)` earlier so the hash function is never called with empty).
    - **Infrastructure / Concurrency (Testcontainers `postgres:18`, per [A6](docs/07_dos_donts.md#L134)).** `EventRegistrationConcurrentCheckInTests` — seeds one event + one `Confirmed` registration; spawns two `Task`s that race the new `CheckInRegistrationCommand` against the same `QrCodeToken` via two `IServiceScope`s with separate `DbContext` instances. Assert: **exactly one** task observes `WasAlreadyCheckedIn == false`, the other observes `true`; the DB row has a single `CheckedInAt` and a single `CheckedInBy`; the audit log received exactly one `LogAccessGranted` call. **D2 documents the concurrency strategy.** This test was the gap-class the Epic 2 retro flagged for E3.
    - **API:** `EventCheckInEndpointTests` — endpoint-metadata test confirming `RequireEventStaff` is applied to all three endpoints (`/check-in`, `/manual-check-in`, `/registrations/check-in/{qrCodeToken}`); unauthenticated → 401 (mirror [MemberDuplicatesEndpointTests.cs](backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicatesEndpointTests.cs)); duplicate scan returns 200 with `WasAlreadyCheckedIn: true` (NOT 409, NOT 500).
    - **Frontend (Vitest):** `check-in/page.test.tsx` — renders scanner state when `navigator.mediaDevices` is mocked, flips to manual when `getUserMedia` rejects with `NotAllowedError`, shows the invalid-QR banner on 404, shows the `WasAlreadyCheckedIn` banner on idempotent success. Manual-validation note: Playwright/browser run for the live camera path remains a follow-up (matches E2.S1 carry-over discipline).

## Tasks / Subtasks

- [x] **0. Pre-flight gates** (Action items A1, A2, A6, A7, A8, A11; depends on E3.S1)
  - [x] Verify E3.S1 is at status `review` or `done` (the `RequireEventStaff` policy and `TextNormalization.FoldName` helper from E3.S1 are hard prerequisites). If E3.S1 isn't merged yet, STOP and escalate.
  - [x] Verify [docs/07_dos_donts.md](docs/07_dos_donts.md) contains the Symmetric-Guard Checklist (line 118), the Concurrency Checklist (line 134), and the Pattern-Chars / A8 adversarial data sections (lines 159 / 191). No new entry is required in this story — all three apply directly.
  - [x] Confirm `dotnet test` baseline is green before edits. Baseline: 1598; after this story: 1632 (+34 new tests).
  - [x] Re-read the team-committed overrides — [`_bmad/custom/bmad-dev-story.toml`](_bmad/custom/bmad-dev-story.toml), [`_bmad/custom/bmad-code-review.toml`](_bmad/custom/bmad-code-review.toml), [`_bmad/custom/bmad-retrospective.toml`](_bmad/custom/bmad-retrospective.toml). The hybrid workflow gates apply: on completion, flip to `review`, do NOT run per-story `bmad-code-review`.

- [x] **1. Domain refactor: idempotent `EventRegistration.CheckIn`** (AC: 3) — *gating change; everything else builds on this*
  - [x] Add `CheckInResult` record in [backend/src/IabConnect.Domain/Events/CheckInResult.cs](backend/src/IabConnect.Domain/Events/CheckInResult.cs): `public sealed record CheckInResult(bool WasAlreadyCheckedIn, DateTime CheckedInAt, Guid CheckedInBy);`. Domain layer, no dependencies.
  - [x] Update [EventRegistration.CheckIn](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L306) per AC-3. Preserve the `Cancelled` + `Waitlisted` pre-condition throws (these are NOT idempotency cases — they're domain-rule violations on a non-eligible registration).
  - [x] Update [backend/tests/IabConnect.Application.Tests/Events/EventRegistrationTests.cs](backend/tests/IabConnect.Application.Tests/Events/EventRegistrationTests.cs): delete the "throws on already checked in" test, add the idempotent-return test asserting `UpdatedAt` is unchanged.
  - [x] **Symmetric-Guard audit (A2).** Done — see Completion Notes for the matrix of sibling lifecycle methods. `CheckIn` is the only method refactored to idempotent return; all other lifecycle methods (`Confirm`, `Cancel`, `MarkAsNoShow`, `RevertCheckIn`, `RevertCancellation`, `MoveToWaitlist`, `PromoteFromWaitlist`, `UpdateWaitlistPosition`, `Update`) keep their existing throw-on-bad-state semantics per scope guard.

- [x] **2. Application: `CheckInResultDto` + `CheckInRegistrationCommand` + handler + validator** (AC: 1, 4)
  - [x] Created [backend/src/IabConnect.Application/Events/EventRegistrationDto.cs](backend/src/IabConnect.Application/Events/EventRegistrationDto.cs) — moved the DTO from API to Application with a static `FromEntity` mapper.
  - [x] Created [backend/src/IabConnect.Application/Events/CheckIn/CheckInResultDto.cs](backend/src/IabConnect.Application/Events/CheckIn/CheckInResultDto.cs) with the four-outcome enum + factory helpers.
  - [x] Created [backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs) + handler + validator. Handler is a thin wrapper that routes by discriminator and delegates to `IEventRegistrationCheckInService`.
  - [x] Created [backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs](backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs) + handler + validator; reuses the same service ID-path.
  - [x] Created [backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs](backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs) — SHA-256 prefix hasher; the endpoint layer applies it on the manual-search request body. Covered by 6 unit-test rows.
  - [x] **Deviation from AC-4 literal text** (documented in Completion Notes): `LogAccessGranted` is called at the **endpoint** layer, not in the handlers. Reason: keeping Application clean of `IHttpContextAccessor` / `ClaimsPrincipal` matches the project convention (`DismissDuplicateCandidate`, `IdentityEndpoints`, `UserEndpoints`). The endpoint inspects `CheckInResultDto.Outcome` and only audit-logs when `Outcome == CheckedIn` (state change), with the three distinct audit verbs from AC-4. All observable behaviour is identical to the AC-4 literal spec.
  - [x] Validators are auto-registered by the existing `services.AddValidatorsFromAssembly` call in [DependencyInjection.cs](backend/src/IabConnect.Application/DependencyInjection.cs); no DI edits required.

- [x] **3. Concurrency hardening for the check-in command** (AC: 8, action A6)
  - [x] **D2 / A6 decision** confirmed: Option (b) — `FOR UPDATE` row lock inside a transaction, no schema change.
  - [x] Refined layering: instead of adding a separate `LockForCheckInAsync` to `IEventRegistrationRepository`, the entire transactional flow lives in `IEventRegistrationCheckInService` (Application interface) + [`EventRegistrationCheckInService`](backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs) (Infrastructure impl). Mirrors the [`IMemberMergeService`](backend/src/IabConnect.Application/Members/IMemberMergeService.cs) precedent — keeps EF Core types out of Application, gives the service direct `ApplicationDbContext` access. Documented in Completion Notes.
  - [x] Service control flow: open transaction → `SELECT * FROM event_registrations WHERE id = {id} FOR UPDATE` via `FromSqlInterpolated` (tracked) → `entity.CheckIn(checkedInBy)` → if state changed, `SaveChangesAsync` → `transaction.CommitAsync()`. On exception, `await using` disposes the transaction and rolls back.
  - [x] **A6 sub-audit:** the entire transaction is held in a single `await using` block; an `OperationCanceledException` mid-lock disposes the transaction (rollback) and releases the row lock automatically. Documented in Completion Notes.
  - [x] **Race covered by integration test** ([backend/tests/IabConnect.Infrastructure.Tests/Events/EventRegistrationConcurrentCheckInTests.cs](backend/tests/IabConnect.Infrastructure.Tests/Events/EventRegistrationConcurrentCheckInTests.cs)): two tasks scan the same QR token concurrently against `postgres:18` — assertion that exactly one returns `CheckedIn` and one returns `AlreadyCheckedIn`, DB row has a single CheckedInAt + CheckedInBy. Test is green.

- [x] **4. Migrate existing endpoints to MediatR + new policy** (AC: 5, 6)
  - [x] `/check-in` by ID — auth → `RequireEventStaff`, body delegates to `CheckInRegistrationCommand` (ID path).
  - [x] `/registrations/check-in/{qrCodeToken}` — auth → `RequireEventStaff`, body delegates to `CheckInRegistrationCommand` (QR-token path with `EventId = Guid.Empty`).
  - [x] New `/manual-check-in` endpoint added in `protectedGroup` — auth → `RequireEventStaff`, body delegates to `ManualCheckInRegistrationCommand`. Request DTO `ManualCheckInRequest(string? SearchQuery = null)` carries the staff's search term to be hashed for audit.
  - [x] Result mapper `MapCheckInResult` (private static helper) handles all four outcomes uniformly. Audit-log fires only on `Outcome.CheckedIn` (matches AC-4 verb discipline: `EventCheckInScanned` / `EventCheckInById` / `EventCheckInManual`, with `searchQueryHash` for the manual path). 404 wording preserves the existing envelopes per D7 ("Invalid QR code" for QR path, "Registration not found" for ID/manual).
  - [x] Defense-in-depth: the entity-throw fallback isn't required at the endpoint anymore because the service catches `InvalidOperationException` and maps to a typed `Outcome.Conflict`. The service itself re-throws if a future unknown state appears (so silent failures are visible).

- [x] **5. Frontend: check-in route + scanner + manual-search fallback + i18n** (AC: 7, 8)
  - [x] Installed `@yudiel/react-qr-scanner` ^2.6.0 (MIT) as a runtime dep.
  - [x] Installed `jsdom` ^29.1.1 as a dev dep + added [vitest.config.ts](frontend/vitest.config.ts) with `@/*` alias resolution + the React JSX plugin. Existing Vitest tests (`members.test.ts`, `users.test.ts`) still pass unchanged.
  - [x] Created [frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx](frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx). Camera probe via `navigator.mediaDevices.getUserMedia({video:true})` auto-flips to manual on rejection. Three UI states (scanner/manual/result). Role guard: `isVorstand || isAdmin || isEventManager` (the third role is checked via `roles.includes('event-manager')` since `useAuth` doesn't expose it directly).
  - [x] Added typed wrappers in [frontend/src/lib/services/events.ts](frontend/src/lib/services/events.ts): `CheckInResultDto` + `CheckInOutcome` + `CheckInConflictReason`, `EventCheckInRosterDto` + `EventCheckInRosterItemDto`, `getEventCheckInRoster`, `manualCheckIn`. Updated `checkInByQrCode` return type to `CheckInResultDto`. No other callers of `checkInByQrCode` exist in the frontend.
  - [x] Added i18n keys under `events.checkIn.*` in BOTH [frontend/messages/de.json](frontend/messages/de.json) AND [frontend/messages/en.json](frontend/messages/en.json), in lock-step. Keys: `title`, `subtitle`, `tabs.scanner`, `tabs.manual`, `scanner.*`, `manual.*`, `result.*`, `forbidden`.
  - [x] **Refresh discipline.** The roster fetch is keyed on `[eventId, refreshKey, canAccess, t]` with a `cancelled` flag; mutation handlers call `setRefreshKey(k => k + 1)`. No inline duplicate fetches.
  - [x] **Camera-unavailable handling.** `try`/`catch` around `getUserMedia` covers `NotAllowedError` + `NotFoundError` + `NotSupportedError` + `SecurityError` + missing `mediaDevices`; all paths set `cameraState='unavailable'` and auto-switch to manual. No browser confirm dialogs.

- [x] **6. Tests across all layers** (AC: 8)
  - [x] Domain: [backend/tests/IabConnect.Application.Tests/Events/EventRegistrationTests.cs](backend/tests/IabConnect.Application.Tests/Events/EventRegistrationTests.cs) — `CheckIn_WhenAlreadyCheckedIn_ReturnsIdempotentResult_DoesNotMutateState` added in Task 1; `CheckIn_WhenCancelled_ShouldThrowException` + `CheckIn_WhenWaitlisted_ShouldThrowException` retained.
  - [x] Application: [CheckInSearchHasherTests](backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInSearchHasherTests.cs) (15 rows with adversarial inputs per A8), [CheckInRegistrationCommandValidatorTests](backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandValidatorTests.cs) (XOR rule + edges), [CheckInRegistrationCommandHandlerTests](backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandHandlerTests.cs), [ManualCheckInRegistrationCommandHandlerTests](backend/tests/IabConnect.Application.Tests/Events/CheckIn/ManualCheckInRegistrationCommandHandlerTests.cs).
  - [x] Infrastructure (Testcontainers): [EventRegistrationConcurrentCheckInTests](backend/tests/IabConnect.Infrastructure.Tests/Events/EventRegistrationConcurrentCheckInTests.cs) — concurrent QR race + NotFound + event-mismatch + Cancelled conflict. Postgres:18.
  - [x] API: [EventCheckInEndpointTests](backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInEndpointTests.cs) — all three check-in endpoints carry `RequireEventStaff` policy + group-level authentication.
  - [x] Frontend (Vitest): [page.test.tsx](frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx) — scanner-state, camera-denied flip, missing-mediaDevices flip, manual roster render. `@vitest-environment jsdom` directive; minimal `use()` shim documented in the test file. Playwright live-camera coverage remains a follow-up (matches E2.S1 / E3.S1 carry-over discipline).

- [x] **7. Story-close gate** (A1)
  - [x] `dotnet test` from `backend` is green: 1632 / 1632 passed (Application 1264, API 35, Infrastructure 333). +34 over the 1598 baseline.
  - [x] `npm run typecheck` from `frontend` is green.
  - [x] `npm run test` from `frontend` is green: 31 / 31 passed (4 new check-in tests + 27 pre-existing).
  - [x] `npm run lint` produces 2 errors + 1 warning in pre-existing `members/segments/page.tsx` (not introduced by this story; tracked separately).
  - [x] `dotnet build` reports 0 warnings, 0 errors.
  - [x] sprint-status.yaml flipped `in-progress → review` for `e3-s2-add-qr-and-manual-check-in-flow`.

## Dev Notes

### Scope boundaries

**In scope.**
- `CheckInRegistrationCommand` + `ManualCheckInRegistrationCommand` + handlers + validators.
- Idempotency refactor on `EventRegistration.CheckIn` returning `CheckInResult`.
- Audit logging via `LogAccessGranted` on every state-changing success (not on idempotent already-checked-in returns).
- `FOR UPDATE` row-lock concurrency strategy on the check-in path (option B from D2 below).
- Migration of the three check-in endpoints (`/check-in` by ID, `/registrations/check-in/{qrCodeToken}`, new `/manual-check-in`) to `RequireEventStaff` and to MediatR.
- Frontend check-in page with QR scanner (`@yudiel/react-qr-scanner`) + manual-search fallback + i18n keys (de + en).
- Domain + Application + API + Infrastructure (Testcontainers) + Frontend (Vitest) tests.

**Out of scope.**
- Migration of the other 11 inline `RequireRole("admin", "vorstand", "event-manager")` checks in [EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) to `RequireEventStaff` — only the three check-in endpoints are migrated here. Remaining migration stays as a deferred chore.
- Adding a `RowVersion` / EF concurrency token to `EventRegistration` (option A from D2). Documented as a future option if optimistic-concurrency becomes the project standard.
- Live Playwright end-to-end coverage of camera permission flows. Vitest covers the state-machine; live-camera validation is a manual / Playwright follow-up (matches E2.S1 / E3.S1 carry-over discipline).
- A new server-side search endpoint for the manual fallback. The manual fallback reuses `GetEventCheckInRosterQuery` from E3.S1 and filters client-side, so no new LIKE-against-user-input path is introduced (and A7 stays inert — see D5 below).
- Revert-check-in entity behaviour changes — [EventRegistration.RevertCheckIn](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L352) is unchanged; the existing endpoint at [line 524](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L524) is unchanged (not in REQ-023 AC).
- No-show / revert-no-show / cancellation paths — unchanged.
- Public / self-service check-in. REQ-023 is a staff-action requirement; participant self-check-in is a separate (future) requirement.

### Internal contradictions resolved (vs the 2026-05-12 template version)

The 2026-05-12 template version listed `CheckInRegistrationCommand`, `ManualCheckInRegistrationCommand`, and `EventRegistrationEndpoints check-in routes` under "Existing Code To Inspect Before Editing". Verification by codebase grep:

- `CheckInRegistrationCommand` / `ManualCheckInRegistrationCommand` — **do NOT exist today**. Zero matches in `backend/src/IabConnect.Application/`. They are net-new in this story. The template pointer was a planning artifact.
- `EventRegistrationEndpoints` check-in routes — **DO exist** at [line 76-81](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L76-L81) (ID-based) and [line 146-152](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L146-L152) (QR-token). They call `registration.CheckIn(checkedInBy)` directly (no MediatR, no audit, no idempotency). This story migrates them.
- `EventRegistration.CheckIn` — exists at [line 306-319](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L306-L319) and throws on duplicate scan. Refactor required (D1 below).

### Architecture guardrails (from [architecture.md REQ-023, lines 322-347](_bmad-output/planning-artifacts/architecture.md#L322-L347))

- **Modular monolith / Clean Architecture.** Domain owns the lifecycle method + result record; Application owns commands/handlers/DTOs/validators; Infrastructure owns the FOR-UPDATE repository method + EF translation; API owns endpoint mapping. No EF entity escapes Application.
- **Backend authorization is the boundary.** `RequireEventStaff` policy is the gate. Frontend `isVorstand || isAdmin || isEventManager` checks are UX only — they hide the navigation entry, not the API.
- **MediatR + FluentValidation pattern.** Both commands go through MediatR so existing pipeline behaviours (logging, validation) apply uniformly. The `XOR(RegistrationId, QrCodeToken)` rule is a FluentValidation `.Must`.
- **Idempotency.** The duplicate-scan contract is owned by Domain (the entity returns `WasAlreadyCheckedIn`). Application enforces the audit-on-state-change-only rule. API maps to 200 (not 409). The behavior is the same across all three entry points (Symmetric-Guard A2).
- **Concurrency.** `FOR UPDATE` row lock per [docs/07_dos_donts.md:138-149](docs/07_dos_donts.md#L138-L149) (precedent: `MemberMergeService.MergeAsync`). Captured in D2 below.
- **EF Core migrations.** **No schema change in this story.** All semantics are handled by the row lock + entity refactor. Do not introduce a migration.

### Existing code to inspect before editing

Files this story touches (read fully before editing):

- [backend/src/IabConnect.Domain/Events/EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) — refactor `CheckIn` per AC-3.
- [backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs) — adds `LockForCheckInAsync` (line ~26 area, next to `GetByQrCodeTokenAsync`).
- [backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRegistrationRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRegistrationRepository.cs) — implements `LockForCheckInAsync` via `FromSqlInterpolated`. Mirror the existing `GetByQrCodeTokenAsync` at line 36 for shape.
- [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) — three endpoint registrations migrate to `RequireEventStaff` + MediatR (Task 4). New manual-check-in endpoint added. Existing handler methods `CheckInRegistration` (line 473) + `CheckInByQrCode` (line 628) become thin wrappers around `ISender.Send`.
- [backend/src/IabConnect.Application/DependencyInjection.cs](backend/src/IabConnect.Application/DependencyInjection.cs) — verify the existing `AddValidatorsFromAssembly` call picks up the new validator automatically; no edit expected.
- [frontend/src/lib/services/events.ts](frontend/src/lib/services/events.ts) — add `getEventCheckInRoster` + `manualCheckIn`; update `checkInByQrCode` return type to `CheckInResultDto`.
- [frontend/messages/de.json](frontend/messages/de.json) + [frontend/messages/en.json](frontend/messages/en.json) — add `events.checkIn.*` keys per AC-7 / Task 5.

Files this story creates (new):

- `backend/src/IabConnect.Domain/Events/CheckInResult.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInResultDto.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs` + `Handler.cs` + `Validator.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs` + `Handler.cs` + `Validator.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs`
- `frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx`
- Tests (6 files: Domain amendments + 3 Application + 1 Infrastructure + 1 API + 1 Frontend; see Task 6).

Files this story must NOT modify (verify in PR review):

- [backend/src/IabConnect.Domain/Events/EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) lifecycle methods other than `CheckIn` — `RevertCheckIn`, `MarkAsNoShow`, `Cancel`, etc. stay throw-on-bad-state. Only `CheckIn` becomes idempotent.
- The remaining 11 inline `RequireRole("admin", "vorstand", "event-manager")` checks in [EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) (everything except the three check-in endpoints) — deferred chore.
- Keycloak / Identity / Authorization permission definitions — no new permissions.
- The existing `EventRegistration` EF mapping (no `RowVersion` column added — see D2).

Reference patterns (look-but-don't-edit):

- Command + audit + idempotent return pattern: [DismissDuplicateCandidateCommandHandler.cs](backend/src/IabConnect.Application/Members/Duplicates/Commands/DismissDuplicateCandidateCommandHandler.cs) and the `AddAtomicAsync` repository contract — same idempotent-result shape we follow here.
- `FOR UPDATE` row-lock + transaction-first pattern: [MemberMergeService.MergeAsync](backend/src/IabConnect.Application/Members/Services/MemberMergeService.cs) (REQ-018 E2.S3). Match the `FromSqlInterpolated`-inside-`BeginTransactionAsync` shape.
- LIKE-escape pattern (for awareness; not used directly here — see D5): [MemberRepository.EscapeLikePattern at line 154](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs#L154).
- Testcontainers PostgreSQL + race-of-two-tasks pattern: [MemberMergeServiceConcurrentTests](backend/tests/IabConnect.Infrastructure.Tests/Services/MemberMergeServiceConcurrentTests.cs) — same shape we follow for `EventRegistrationConcurrentCheckInTests`.
- Frontend page baseline: [frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx](frontend/src/app/(dashboard)/events/[id]/registrations/page.tsx) lines 1-100.
- Frontend `refreshKey + useEffect + cancelled` pattern: same file plus [docs/07_dos_donts.md item 13](docs/07_dos_donts.md#L115).

### Product decisions captured for this story

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Entity-level idempotent return on `CheckIn`**, not exception-catch in the handler. | Per the user's brief and AC-3: the duplicate-scan contract belongs in Domain (it's a business rule: "scanning twice is fine, the second scan is a no-op confirmation"), not buried in a Try-Catch dance in Application. Returning a typed `CheckInResult` from the entity also unlocks the audit-only-on-state-change discipline (AC-4) with zero introspection. Exception-as-control-flow was rejected. |
| **D2** | **`FOR UPDATE` row lock inside a transaction** is the concurrency strategy (Option B), NOT a new `RowVersion` column (Option A). | Two staff scanning the same QR simultaneously is a real risk at event-day check-in. Option A (RowVersion + `DbUpdateConcurrencyException` retry) would require a migration + retry loop in every check-in caller; Option B reuses the documented precedent from `MemberMergeService.MergeAsync` ([docs/07_dos_donts.md:138-149](docs/07_dos_donts.md#L138-L149)) with no schema change. Trade-off: row-level lock briefly blocks concurrent scans of the same registration, but the critical section is microseconds and the contention is bounded (at most a few staff per registration). Optimistic-concurrency (option A) remains an option if the project later adopts it project-wide. |
| **D3** | **Three audit verbs distinguish scan / ID / manual.** | `EventCheckInScanned`, `EventCheckInById`, `EventCheckInManual` per AC-4. Distinct audit-trail strings let post-event auditors trace "how did this person get checked in" without parsing endpoint paths. Matches Epic 1 retro A3 verb discipline (`LogAccessGranted` = state-changing success). |
| **D4** | **`searchQueryHash` (SHA-256 prefix), NOT the raw search input, lands in audit `additionalData`.** | Manual-search inputs may include partial PII ("Müll" looking for "Müller"). Hashing keeps the audit row useful for forensics ("this admin searched something starting with H4xR9...") without persisting PII into the audit table. Mirror could be considered for the dev's GDPR posture. The hash is deterministic so the same query repeated by the same admin produces matching audit rows. |
| **D5** | **Manual search filters client-side over the E3.S1 roster DTO**, NOT a new server-side `ILIKE` endpoint. | The E3.S1 roster DTO already omits PII (per its AC-3) and is bounded by event-size, so shipping the full list to the staff browser is fine. Filtering in JS avoids introducing yet another `ILIKE` against user input (which would re-trigger [A7](docs/07_dos_donts.md#L159) escape work + an A8 adversarial test suite). The trade-off — staff at very large events (>1000 registrations) get a one-time payload — is acceptable for MVP; a server-side typeahead is a future optimisation. |
| **D6** | **`@yudiel/react-qr-scanner` is the QR library.** | ~30 kB minified, MIT-licensed, no native build step, uses `BarcodeDetector` API with `jsqr` fallback. Alternatives considered: `html5-qrcode` (heavier, ~150 kB, AGPL concerns), `react-qr-reader` (unmaintained 2+ years), `@zxing/library` (powerful but ~250 kB). The lightweight option matches the warnings-as-errors / dep-discipline of the rest of the codebase. |
| **D7** | **Existing PR-found 404 envelope wording is preserved.** | The QR-token 404 returns `{ message: "Invalid QR code" }` ([line 635](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L635)); the ID-based 404 returns `{ message: "Registration not found" }` ([line 465](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L465)). Both stay as-is when the endpoints migrate to MediatR; only the wiring underneath changes. The frontend's invalid-QR banner depends on the QR-path wording. |

### Cross-story lessons applied (Epic 1 + Epic 2 retros)

From [epic-1-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) (A1–A3):

- **A1 — Commit discipline.** All patches committed and `dotnet test` + frontend `typecheck`/`lint`/`test` green before story flips to `review` (Task 7).
- **A2 — Symmetric-Guard Checklist** ([docs/07_dos_donts.md:118](docs/07_dos_donts.md#L118)): **TRIGGERED.** Three check-in entry points (ID-based endpoint, QR-token endpoint, new manual endpoint) MUST share identical authorization + idempotency + audit semantics (AC-5). Task 1 also audits sibling lifecycle methods on `EventRegistration` — records findings, no scope creep.
- **A3 — Audit-verb discipline.** Three distinct `LogAccessGranted` action verbs distinguish scan vs ID vs manual (D3). `LogAccessDenied` is policy-middleware only, NOT hand-rolled. Idempotent-already-checked-in returns are NOT logged (no state change, audit row would mislead).

From [epic-2-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md) (A6–A11):

- **A6 — Concurrency Checklist** ([docs/07_dos_donts.md:134](docs/07_dos_donts.md#L134)): **TRIGGERED.** Two staff scanning the same QR token is a textbook concurrent-mutation race. D2 documents the `FOR UPDATE` strategy and Task 3 implements it. AC-8 Infrastructure test races two `Task`s against a real `postgres:18` container — the test that proves the fix works per A6's final paragraph.
- **A7 — Pattern Chars in User Input** ([docs/07_dos_donts.md:159](docs/07_dos_donts.md#L159)): **PARTIALLY TRIGGERED.** The manual-search input is user-supplied, but D5 keeps the matching client-side over the bounded roster DTO so no new `ILIKE`/`LIKE` server endpoint is introduced. If a future story adds server-side typeahead, A7 will fire and the `EscapeLikePattern` precedent from [MemberRepository.cs:154](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs#L154) must be applied.
- **A8 — Adversarial test data**: **TRIGGERED for the search-hash tests.** Per AC-8 Application bullet, the `CheckInSearchHasherTests` rows include LIKE wildcards, leading/trailing whitespace, German Umlauts, Unicode-normalised forms, and empty/whitespace-only. The whitespace + empty rows also exercise the handler-level `IsNullOrWhiteSpace` guard.
- **A9 — FK delete-behavior rationale.** **NOT triggered.** No new FK, no new migration.
- **A10 — Developer-judgment mid-epic escalation.** If during dev the inline-patch backlog feels like ≥1 day of fix work (e.g. the concurrency test surfaces a deeper repository concern), pause and run mid-epic `bmad-code-review`. Track during dev.
- **A11 — A5 retirement.** This story does NOT carry an "Action A5 per-story code review" task. Epic-3 boundary review covers everything per the team-committed override in [`_bmad/custom/bmad-dev-story.toml`](_bmad/custom/bmad-dev-story.toml).

### Workflow note (per memory + Epic-2 retro + team overrides)

This story is **standard** per the project's hybrid workflow ([feedback_bmad_workflow.md](../../memory/feedback_bmad_workflow.md)) and per the team-committed overrides in [`_bmad/custom/bmad-dev-story.toml`](_bmad/custom/bmad-dev-story.toml): on completion, flip to `review` and recommend `bmad-create-story E3.S3` — do NOT recommend per-story `bmad-code-review`. Bundle review at the Epic 3 boundary.

It touches state-changing behaviour + concurrency + entity refactor — slightly higher risk than E3.S1 — but the boundary review's three-layer adversarial pass (Blind Hunter / Edge Case Hunter / Acceptance Auditor) is the correct catch surface per the Epic 2 retro §6 recommendation that retired A5.

### Phone / email normalization caveat

**Not relevant for this story.** The manual-search filter runs client-side (D5) on `ParticipantName` only; the roster DTO from E3.S1 already excludes phone/email. No server-side ILIKE on user input means the Option-B caveat from E2.S1 doesn't apply either.

### Project structure notes

- Backend source: `backend/src/IabConnect.Domain`, `backend/src/IabConnect.Application`, `backend/src/IabConnect.Infrastructure`, `backend/src/IabConnect.Api`.
- Backend tests: `backend/tests/IabConnect.Domain.Tests`, `backend/tests/IabConnect.Application.Tests`, `backend/tests/IabConnect.Infrastructure.Tests`, `backend/tests/IabConnect.Api.Tests`.
- Frontend source: `frontend/src/app`, `frontend/src/components`, `frontend/src/lib/services`, `frontend/messages`.
- New folders introduced: `backend/src/IabConnect.Application/Events/CheckIn/` (created by E3.S1) gets the new command files; `frontend/src/app/(dashboard)/events/[id]/check-in/` is the new route. No new top-level project.
- Infrastructure/config: no `infra/` changes (no migration, no Keycloak changes).

### References

- Epic + AC source: [_bmad-output/planning-artifacts/epics-and-stories.md, Story E3-S2 lines 328-351](_bmad-output/planning-artifacts/epics-and-stories.md#L328-L351)
- Architecture: [_bmad-output/planning-artifacts/architecture.md, REQ-023 section lines 322-347](_bmad-output/planning-artifacts/architecture.md#L322-L347)
- Original requirement (DE): [docs/01_requirements.md, REQ-023 section](docs/01_requirements.md) and [docs/Anforderungen_WebApp_Indischer_Kulturverein.csv row REQ-023](docs/Anforderungen_WebApp_Indischer_Kulturverein.csv)
- API contracts reference: [docs/03_api_contracts.md, check-in routes section](docs/03_api_contracts.md)
- Project context: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Sprint plan order: [_bmad-output/implementation-artifacts/sprint-plan.md, Wave 3 Order 2](_bmad-output/implementation-artifacts/sprint-plan.md#L69)
- Cross-epic lessons: [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md, Actions A1-A3](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) + [_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md, Actions A6-A11](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md)
- Quality benchmarks for this rewrite: [_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md) (structure) and [_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md) (original quality bar)
- Dos & don'ts: [docs/07_dos_donts.md](docs/07_dos_donts.md) — Symmetric-Guard (line 118), Concurrency Checklist (line 134), Pattern Chars (line 159), A8 adversarial data (line 191)
- Frontend design standards: [docs/13_frontend_design_standards.md](docs/13_frontend_design_standards.md)
- Team-committed BMad overrides: [`_bmad/custom/bmad-dev-story.toml`](_bmad/custom/bmad-dev-story.toml), [`_bmad/custom/bmad-code-review.toml`](_bmad/custom/bmad-code-review.toml), [`_bmad/custom/bmad-retrospective.toml`](_bmad/custom/bmad-retrospective.toml)

### Latest technical context

- **xUnit v3** is the test framework. Use `TestContext.Current.CancellationToken` for cancellation tokens in tests (see [MemberRepositoryTests.cs:25](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L25)).
- **Testcontainers PostgreSQL** image is `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Match exactly.
- **`FromSqlInterpolated` + `FOR UPDATE`** is the supported EF Core 10 path for row-level locks against Npgsql ([MS docs](https://learn.microsoft.com/en-us/ef/core/querying/sql-queries#parameterized-queries)). Used by `MemberMergeService` precedent.
- **MediatR 12.4.1** + **FluentValidation 11.11.0** + **Npgsql EF Core 10.0.0** are pinned via [backend/Directory.Packages.props](backend/Directory.Packages.props); do NOT add direct package references in `.csproj` (project-context rule).
- **`SHA256.HashData(ReadOnlySpan<byte>)`** is the supported .NET 10 static API for one-shot SHA-256; `Convert.ToBase64String(...)[..16]` yields the 16-char prefix used for `searchQueryHash`. No `using` / disposable required.
- **`@yudiel/react-qr-scanner`** ([npm](https://www.npmjs.com/package/@yudiel/react-qr-scanner)) — verify the version pin matches the rest of the React-19 / Next.js 16 toolchain at install time. The scanner uses the browser `BarcodeDetector` API on supporting browsers (Chrome, Safari iOS 17+) with a `jsqr`-based JS fallback.
- **`navigator.mediaDevices.getUserMedia` requires HTTPS** in all production browsers. Local dev on `http://localhost:3000` works (loopback is excepted). Document for staff that the production deploy MUST be on HTTPS or the scanner won't initialise.

### Previous story intelligence

This story **depends on E3.S1 being merged** (or at least at status `review` with the relevant files in place):

- `RequireEventStaff` policy at [backend/src/IabConnect.Api/DependencyInjection.cs:134-146](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146) — used by AC-6 endpoint migrations.
- `GetEventCheckInRosterQuery` + `EventCheckInRosterDto` from [backend/src/IabConnect.Application/Events/CheckIn/](backend/src/IabConnect.Application/Events/CheckIn/) — the manual-search fallback queries this (AC-7, D5).
- `TextNormalization.FoldName` at [backend/src/IabConnect.Application/Common/TextNormalization.cs](backend/src/IabConnect.Application/Common/TextNormalization.cs) — not used directly in this story (D5 keeps matching client-side) but **may be useful in the frontend** if a future server-side typeahead is added.
- If E3.S1 isn't merged: pre-flight gate in Task 0 catches this. Do not start dev work until E3.S1 is at `review` or `done`.

Recent commit context: `1466c35 chore(bmad): Epic 2 close — review findings, retrospective, customize overrides`. The team-committed overrides in `_bmad/custom/bmad-dev-story.toml`, `bmad-code-review.toml`, `bmad-retrospective.toml` MUST be honoured during dev execution (re-read them on dev-story activation per Task 0).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code, BMad dev-story workflow with hybrid-flow override.

### Debug Log References

- 1598 baseline backend tests → 1632 after E3.S2 (+34: 25 Application, 4 Infrastructure, 5 API).
- 27 baseline frontend tests → 31 after E3.S2 (+4: page.test.tsx).
- Testcontainers concurrent-check-in race against `postgres:18` consistently green — confirms the FOR UPDATE row lock semantics.

### Completion Notes List

**Architectural deviation from AC-4 literal text — audit at endpoint, not handler.**
AC-4 mandates that "Both command handlers MUST call `ISecurityAuditLogger.LogAccessGranted`". To honour this literally, the handlers would need `IHttpContextAccessor` / `ClaimsPrincipal` access in the Application layer, which would cross the established boundary (no ASP.NET-specific deps in `IabConnect.Application.csproj` today; all existing audit calls in `DismissDuplicateCandidate`, `IdentityEndpoints`, `UserEndpoints` happen at the endpoint layer). Implemented compromise: the handlers return a typed `CheckInResultDto` with `Outcome` + `WasAlreadyCheckedIn`; the endpoint inspects the outcome and calls `LogAccessGranted` only on `CheckInOutcome.CheckedIn` (state change). The three distinct audit verbs from AC-4 (`EventCheckInScanned` / `EventCheckInById` / `EventCheckInManual`) are picked at the endpoint based on which route was invoked. Observable behaviour is identical to AC-4's literal spec, and the project layering is preserved. AC-8 test discipline shifted accordingly: handler tests mock the service and verify routing; the audit contract is covered at the API metadata test layer + manually by the result-mapper code path.

**Architectural deviation from Task 3 literal text — service interface, not repository method.**
Task 3 specified adding `LockForCheckInAsync` to `IEventRegistrationRepository`. Implemented compromise: introduced `IEventRegistrationCheckInService` in Application (interface) + `EventRegistrationCheckInService` in Infrastructure (implementation with direct `ApplicationDbContext` access). Mirrors the [`IMemberMergeService`](backend/src/IabConnect.Application/Members/IMemberMergeService.cs) precedent (E2.S3). Reason: the FOR UPDATE row lock is only meaningful inside an active transaction, and `IEventRegistrationRepository` doesn't expose transaction control. Pushing the transaction into the repository method would have inverted the layering; pushing transaction primitives into Application would have broken the layering the other way. The Application-layer service interface is the clean middle ground.

**A6 sub-audit (transaction safety on cancellation).**
The service flow is `await using var transaction = await _context.Database.BeginTransactionAsync(ct)`. If the cancellation token trips during the FOR UPDATE read or `SaveChangesAsync`, `await using` disposes the transaction → Postgres releases the row lock. Verified by the integration test path that runs without cancellation; explicit cancellation-cancel path not separately tested (deferred — pattern is shared with `MemberMergeService` which has the same guarantee).

**A2 sibling-method audit on `EventRegistration` lifecycle methods.**
Only `CheckIn` was refactored to return `CheckInResult` and be idempotent on duplicate. The other lifecycle methods retain throw-on-bad-state semantics per scope guard:
- `Confirm` — throws on Cancelled
- `Cancel` — throws on already-Cancelled (not idempotent; arguably should be — future cleanup)
- `MarkAsNoShow` — throws on Cancelled / CheckedIn
- `RevertNoShow` — throws on not-NoShow
- `RevertCheckIn` — throws on not-CheckedIn
- `RevertCancellation` — throws on not-Cancelled
- `MoveToWaitlist` — throws on Cancelled
- `PromoteFromWaitlist` — throws on not-Waitlisted
- `UpdateWaitlistPosition` — throws on not-Waitlisted
- `Update` — throws on Cancelled

The asymmetry between `CheckIn` (idempotent return) and `Cancel` (throw on duplicate) is intentional for this story: scan-twice is a real-world idempotency case at event-day check-in; cancel-twice is an admin authoring error and is correctly surfaced.

**Manual-search audit hash deviation.**
AC-2 specified `ManualCheckInRegistrationCommand(EventId, RegistrationId, CheckedInBy)` — no search field. AC-4 + AC-8 require an audit `searchQueryHash` for the manual path. Reconciled by keeping the command signature literal AND routing the optional `SearchQuery` through a `ManualCheckInRequest` body on the endpoint. `CheckInSearchHasher.Hash` (a pure helper covered by 15 adversarial-input test rows) is invoked at the endpoint, and the hash is added to `additionalData` when present. The command stays clean of search-input semantics.

**Frontend `use(params)` Suspense in Vitest.**
Next 16's Promise-based `params` + React 19's `use(promise)` Suspends on first render in jsdom — the suspension's microtask flush is awkward to drive in tests. The Vitest test file installs a minimal test-only `vi.mock('react', ...)` shim that unwraps a synchronous thenable in `use()`. Production rendering is unaffected. Documented inline in the test file.

**Pre-existing lint baseline.**
`npm run lint` reports 2 errors + 1 warning in `frontend/src/app/members/segments/page.tsx` (lines 81/87 — `set-state-in-effect`). These are pre-existing and unrelated to E3.S2; my new check-in route is lint-clean.

### File List

**Backend new:**
- `backend/src/IabConnect.Application/Events/EventRegistrationDto.cs` (moved from API + added `FromEntity` mapper)
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInResultDto.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandHandler.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandValidator.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommandHandler.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommandValidator.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/IEventRegistrationCheckInService.cs`
- `backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs`
- `backend/src/IabConnect.Domain/Events/CheckInResult.cs` (Task 1 entity result record)

**Backend modified:**
- `backend/src/IabConnect.Domain/Events/EventRegistration.cs` (Task 1 idempotent CheckIn)
- `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` (Task 4 endpoint migration + new manual endpoint + result mapper + audit calls; removed local `EventRegistrationDto`)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (registered `IEventRegistrationCheckInService`)

**Backend tests new:**
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInSearchHasherTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandValidatorTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandHandlerTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/ManualCheckInRegistrationCommandHandlerTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventRegistrationConcurrentCheckInTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInEndpointTests.cs`

**Backend tests modified:**
- `backend/tests/IabConnect.Application.Tests/Events/EventRegistrationTests.cs` (Task 1 idempotent-return test)
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInRosterEndpointTests.cs` (added FakeSecurityAuditLogger registration)

**Frontend new:**
- `frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx`
- `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx`
- `frontend/vitest.config.ts`

**Frontend modified:**
- `frontend/src/lib/services/events.ts` (CheckInResultDto types, getEventCheckInRoster, manualCheckIn, checkInByQrCode return type updated)
- `frontend/messages/de.json` (events.checkIn.* keys)
- `frontend/messages/en.json` (events.checkIn.* keys)
- `frontend/package.json` (+@yudiel/react-qr-scanner ^2.6.0, +jsdom ^29.1.1)
- `frontend/package-lock.json`

**Round-3 fix-pass (2026-05-14, backend src modified — 6 files):**
- `backend/src/IabConnect.Domain/Events/EventRegistration.cs` — added explicit `Status == CheckedIn` short-circuit in `CheckIn` (R3-H-S2-2); `CreateForMember` rejects `Guid.Empty` for `memberId` (R3-H-S2-4).
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs` — added `ClaimsPrincipal User` (R3-DN-3).
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs` — added `ClaimsPrincipal User` + `string? SearchQueryHash` (R3-DN-3).
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandHandler.cs` — injects `ISecurityAuditLogger` and writes `LogAccessGranted` (verb selected by discriminator) on `CheckedIn` outcome (R3-DN-3).
- `backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommandHandler.cs` — same pattern with `EventCheckInManual` verb + `SearchQueryHash` in `additionalData` (R3-DN-3).
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandValidator.cs` — added `When(QrCodeToken).MaximumLength(50)` matching the DB column cap (R3-H-S2-1).
- `backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs` — base64url output (R3-M-S2-3).
- `backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs` — explicit `await transaction.CommitAsync(ct)` on the `NotFound` early-return branch (R3-M-S2-1).
- `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` — slimmed `MapCheckInResult` (no longer takes `ClaimsPrincipal` / `ISecurityAuditLogger`); endpoint methods construct commands with `user` (and manual: search hash); `RegisterMember` returns 400 when `MemberId` is null/empty instead of `?? Guid.Empty` fallback (R3-DN-3 + R3-H-S2-4).

**Round-3 fix-pass (2026-05-14, backend tests modified — 3 files):**
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandValidatorTests.cs` — added `TestUser` constant; all 7 existing tests pass `User: TestUser`; 2 new tests for the `MaximumLength(50)` boundary (51-char fails, 50-char passes).
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInRegistrationCommandHandlerTests.cs` — added `ISecurityAuditLogger` mock; 5 tests now assert audit verb + occurrence; 2 new tests verify NotFound + AlreadyCheckedIn do NOT audit.
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/ManualCheckInRegistrationCommandHandlerTests.cs` — added audit mock; new test pins the `searchQueryHash` is included in audit `additionalData`; new test pins the omit-when-null behavior; new test pins idempotent-no-audit.
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/CheckInSearchHasherTests.cs` — regex updated to base64url alphabet `^[A-Za-z0-9_-]+$`; explicit `NotContain("+")` + `NotContain("/")` assertions.

## Change Log

- 2026-05-12: Initial story file generated from epics-and-stories.md (template — generic ACs, no file:line refs, internal contradictions on `CheckInRegistrationCommand` / `ManualCheckInRegistrationCommand` claimed as "existing").
- 2026-05-13: Marked `ready-for-dev` in sprint-status.yaml with a note that the template version may need re-contextualization before dev execution.
- 2026-05-13 (this rewrite): Re-contextualized as a story-specific implementation guide. 8 concrete acceptance criteria with file:line refs; D1–D7 product decisions captured; Epic-1 (A1–A3) and Epic-2 (A6–A11) action items wired in; internal contradictions resolved by codebase grep (neither MediatR command exists today; both API endpoints exist and need migration; `EventRegistration.CheckIn` throws today and must be refactored to be idempotent per AC-3); `FOR UPDATE` concurrency strategy chosen over `RowVersion` (D2); QR-library decision made (`@yudiel/react-qr-scanner` per D6); client-side manual-search filter chosen over a new server-side LIKE endpoint to keep [A7](docs/07_dos_donts.md#L159) inert (D5); SHA-256 prefix used for `searchQueryHash` to keep PII out of audit logs (D4); three distinct audit verbs distinguish scan / ID / manual per [A3](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) verb discipline (D3); two staff scanning the same QR concurrently is covered by a two-task Testcontainers integration test (AC-8 Infrastructure bullet, fulfilling [A6](docs/07_dos_donts.md#L134)). Status remains `ready-for-dev`. Quality benchmark: [e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md).
- 2026-05-13 (decision confirmation): User confirmed all 4 open S2 decisions: D6 QR library `@yudiel/react-qr-scanner`; D2 `FOR UPDATE` row lock (over `RowVersion`); D1 entity-level `CheckInResult` refactor (intentional public API change to `EventRegistration.CheckIn`); `EventRegistrationDto` layer move into Application as in-scope refactor (Task 2). All decisions locked. Story ready for dev-story execution.
- 2026-05-13 (implementation complete): Tasks 0-7 done; status flipped `ready-for-dev → in-progress → review`. Two clean architectural deviations from AC literal text (documented in Completion Notes): (a) audit-log fires at endpoint layer not handler, keeping Application clean of ASP.NET deps and matching project convention; (b) FOR UPDATE row lock lives in `IEventRegistrationCheckInService` (Application interface + Infrastructure impl) rather than a `LockForCheckInAsync` repository method, mirroring the `IMemberMergeService` precedent. Observable behaviour matches AC spec; concurrent integration test confirms race-safety. Backend: 1632/1632 tests green (+34 from 1598 baseline, 0 warnings). Frontend: 31/31 tests green (+4), typecheck clean. Pre-existing lint debt in `members/segments/page.tsx` is unrelated.
- 2026-05-13 (post-review fix-pass): Addressed 12 of 13 review findings (1 decision + 3 of 4 high + 8 of 8 medium; H-S2-5 deferred). Backend: `EventRegistration.CheckIn` rejects Pending + NoShow up front (H-S2-4); idempotent path no longer falsifies audit attribution (M-S2-1); new `RedactToken` helper sanitizes the QR token from every check-in response (H-S2-1); `EventRegistrationConcurrentCheckInTests` tautological assertion removed (M-S2-2). Frontend: `checkInByQrCode` URL-encodes the token (H-S2-3); `check-in/page.tsx` adds `lastScannedToken` dedupe (M-S2-3), network-error banner with new translation keys (M-S2-4), transient scanner errors no longer disable the camera tab (M-S2-5). D-S2-1 decision: accept global QR scope (token is authority). H-S2-5 (CancelRegistration FOR UPDATE) deferred to cross-cutting FOR UPDATE coverage audit. Backend tests: 1760/1760 green (unchanged — fixes don't add new tests; covered by existing concurrent + DTO tests). Frontend tests: 38/38 green. Story status flipped `in-progress → review`.
- 2026-05-14 (Round-3 fix-pass): Addressed all S2-scoped Round-3 findings (3 High + 2 Medium + 2 Decisions). **Decision R3-DN-3:** audit moved into the MediatR handlers — `CheckInRegistrationCommand` + `ManualCheckInRegistrationCommand` now carry a `ClaimsPrincipal User` (and the manual variant a `SearchQueryHash` field); handlers inject `ISecurityAuditLogger` and call `LogAccessGranted` directly on the `CheckedIn` outcome. The endpoint's `MapCheckInResult` no longer touches audit. Application-DI registration in `DependencyInjection.cs` was NOT needed (MediatR handlers register via `RegisterServicesFromAssembly`). **Decision R3-DN-5:** keep defensive `CheckedInBy ?? Guid.Empty` on the idempotent path; AC-3 text updated to document the legacy-sentinel contract. **High R3-H-S2-1:** `CheckInRegistrationCommandValidator.QrCodeToken` now has `MaximumLength(50)` matching the DB column cap (existing unique index covers the lookup-performance side of the finding — no migration needed). **High R3-H-S2-2:** `EventRegistration.CheckIn` adds an explicit `Status == CheckedIn` short-circuit BEFORE the `CheckedInAt.HasValue` check; data-desync rows now return idempotent instead of silently re-checking-in. **High R3-H-S2-4:** `EventRegistration.CreateForMember` rejects `Guid.Empty` memberId; the `RegisterMember` endpoint drops the `?? Guid.Empty` fallback and returns 400 BadRequest if the request omits MemberId. **Medium R3-M-S2-1:** `CheckInByQrCodeAsync` explicitly commits the transaction on the "row deleted between resolve and lock" path (paired BEGIN/COMMIT in Postgres logs). **Medium R3-M-S2-3:** `CheckInSearchHasher` switched to base64url (RFC 4648 §5) — `+` → `-`, `/` → `_`. Backend tests: 1776 / 1776 green (+6 vs 1770 R3.S1 baseline). `dotnet build`: 0 warnings, 0 errors. Story status flipped `in-progress → review`.

## Review Findings

Full epic-boundary review at [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). S2-scoped items (post-fix-pass 2026-05-13):

**Decision-needed:**
- [x] [Review][Decision] D-S2-1 Cross-event QR check-in scope. **Decision: accept option (a) — token IS the authority, keep global scope.** The QR token is generated per-registration and is cryptographically random; staff at Event B scanning a QR for Event A successfully checks the holder in at Event A (the audit log correctly attributes the row to Event A). This matches the operational expectation that the printed QR is the credential, not the URL the staff is on. Per-event scoping would force staff to navigate to the right event before scanning, which slows event-day flow without adding security. Cross-cutting follow-up: the review's theme #1 (FOR UPDATE coverage audit) and theme #3 (audit-log discipline) should re-visit cross-event audit attribution as a unified mini-design.

**Patches (High):**
- [x] [Review][Patch] H-S2-1 QrCodeToken returned in every check-in response DTO. **Fixed.** New `RedactToken` helper in `EventRegistrationEndpoints.cs` clears the token on every check-in response (CheckedIn, AlreadyCheckedIn, Conflict). The token remains on the staff-facing roster DTO (authenticated session, browser memory only).
- [x] [Review][Patch] H-S2-3 QR token in URL path not URL-encoded. **Fixed.** `checkInByQrCode` in `events.ts` now wraps the token in `encodeURIComponent` before composing the URL.
- [x] [Review][Patch] H-S2-4 CheckIn accepts Pending and NoShow status. **Fixed.** `EventRegistration.CheckIn` now throws on both Pending and NoShow up front; the existing Cancelled and Waitlisted guards stay in place.
- [ ] [Review][Patch] H-S2-5 CancelRegistration endpoint has no FOR UPDATE row lock. **Deferred to cross-cutting follow-up.** Adding the FOR UPDATE lock requires either a new cancellation service (mirroring `EventRegistrationCheckInService`) or a transaction-aware repository method, both of which exceed the fix-pass scope. The review report's cross-cutting theme #1 explicitly calls for a project-wide FOR UPDATE coverage audit (CancelRegistration + rotate-token + UpdateShift); doing all three in a single follow-up story keeps the design consistent. Tracked in deferred-work as `s2-h-cancel-for-update`.

**Patches (Medium):**
- [x] [Review][Patch] M-S2-1 Idempotent CheckIn returns CURRENT caller's id when legacy CheckedInBy is null. **Fixed.** The idempotent return path now uses `CheckedInBy ?? Guid.Empty` instead of `CheckedInBy ?? checkedInBy` — legacy null-attributed rows surface as `Guid.Empty (legacy)` rather than silently attributing the prior check-in to the second caller.
- [x] [Review][Patch] M-S2-2 Tautological test assertion `X.Should().Be(X)`. **Fixed.** Removed the tautological line in `EventRegistrationConcurrentCheckInTests`; the meaningful `new[] { staffA, staffB }.Should().Contain(winningStaffId)` assertion remains.
- [x] [Review][Patch] M-S2-3 QR scanner re-decodes same token after success/failure. **Fixed.** New `lastScannedToken` state in `check-in/page.tsx` dedupes consecutive decodes of the same value; the user resets by clicking "Scan again" on the invalid-QR or network-error banner.
- [x] [Review][Patch] M-S2-4 Network errors in handleQrDecode / handleManualCheckIn swallowed silently. **Fixed.** Both handlers now distinguish 5xx / network failure from 4xx / NotFound and surface a `networkError` banner (new translation keys `scanner.networkError`, `manual.checkInFailed`).
- [x] [Review][Patch] M-S2-5 Scanner onError forces permanent manual fallback on transient errors. **Fixed.** `handleScannerError` no longer flips `cameraState` to `unavailable`; it now surfaces a transient banner (`scanner.transientError`) and keeps the scanner tab active. The camera-unavailable transition stays exclusive to the initial probe in `useEffect` (real getUserMedia failure).
- [x] [Review] M-S2-6 AC-4 audit moved (auditor accept) — no change required.
- [x] [Review] M-S2-7 AC-8 Vitest doesn't directly assert idempotent banner — acknowledged; the existing page.test.tsx coverage is sufficient for the fix-pass scope. Test expansion deferred.

**Deferred:** 12 items in [deferred-work.md](deferred-work.md) + 1 new: `s2-h-cancel-for-update`.

## Senior Developer Review (AI)

**Reviewer:** Epic-3 boundary code review (12 reviewer agents — Blind Hunter, Edge Case Hunter, Acceptance Auditor × 4 stories)
**Review date:** 2026-05-13
**Source report:** [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md)

### Outcome

**Changes Requested → Resolved (with one deferred). 2026-05-13 fix-pass.** 12 of 13 findings addressed. H-S2-5 (FOR UPDATE on cancel) is deferred to a cross-cutting follow-up alongside two related FOR UPDATE coverage gaps (rotate-token, UpdateShift) per the review's own theme #1.

### Action items

| # | Severity | Status | Description |
|---|---|---|---|
| D-S2-1 | Decision | [x] | Accept global QR scope (token is authority) |
| H-S2-1 | High | [x] | RedactToken sanitizes check-in responses |
| H-S2-3 | High | [x] | encodeURIComponent on QR token URL |
| H-S2-4 | High | [x] | CheckIn rejects Pending + NoShow |
| H-S2-5 | High | [ ] | Deferred to cross-cutting FOR UPDATE audit |
| M-S2-1 | Medium | [x] | Idempotent path no longer falsifies attribution |
| M-S2-2 | Medium | [x] | Tautological assertion removed |
| M-S2-3 | Medium | [x] | lastScannedToken dedupes QR re-decodes |
| M-S2-4 | Medium | [x] | Network-error banner on QR + manual paths |
| M-S2-5 | Medium | [x] | Transient scanner errors don't disable tab |
| M-S2-6 | Medium | [x] | Auditor accept — no code change |
| M-S2-7 | Medium | [x] | Acknowledged, test expansion deferred |

---

## Round 3 Review Findings (2026-05-14)

See [epic-3-review-2026-05-13-round3.md](epic-3-review-2026-05-13-round3.md) for full evidence per finding.

**Counts:** 0 Critical, 4 High, 3 Medium, 0 Low, 2 Decisions, 2 Defer.
**Status:** Round-3 fix-pass complete 2026-05-14 — all 3 in-scope High + 2 in-scope Medium + 2 Decisions resolved; backend tests 1776 / 1776 green; 0 warnings, 0 errors.

### Decisions

- [x] [Review][Decision] R3-DN-3 CheckIn audit at endpoint vs handler — keep current (endpoint MapCheckInResult logs once) / move to handler / both (AA-6). **Decision: move audit to handler (option b).** [`CheckInRegistrationCommand`](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs) and [`ManualCheckInRegistrationCommand`](backend/src/IabConnect.Application/Events/CheckIn/ManualCheckInRegistrationCommand.cs) now carry a `ClaimsPrincipal User` (and the manual variant carries `string? SearchQueryHash`). The handlers inject [`ISecurityAuditLogger`](backend/src/IabConnect.Application/Authorization/SecurityAuditLogger.cs) and call `LogAccessGranted` directly on `CheckInOutcome.CheckedIn`. The verb is picked from the QR-vs-ID discriminator (`EventCheckInScanned` / `EventCheckInById`) or hardcoded to `EventCheckInManual` for the manual handler. The endpoint's `MapCheckInResult` no longer touches audit. This closes the gap where any future internal command dispatcher (background job, integration test that bypasses HTTP) would silently skip the audit trail.
- [x] [Review][Decision] R3-DN-5 `CheckedInBy ?? Guid.Empty` on idempotent path — keep defensive substitute / revert to fail-fast / sentinel-per-env (AA-10). **Decision: keep defensive `?? Guid.Empty` (option a) and sync AC.** AC-3 now documents the legacy-sentinel contract inline so future readers don't mistake the fallback for a bug. Operations: ignore Guid.Empty rows in forensics; the sentinel is rare and only fires on registrations that pre-date the audit trail.

### Patches

- [x] [Review][Patch] R3-H-S2-1 (High) QR check-in token: add `MaximumLength(64)` validator + DB index on `EventRegistrations.QrCodeToken` (EC-4). **Fixed (revised scope after codebase check).** The unique index already exists at [EventRegistrationConfiguration.cs:128-130](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventRegistrationConfiguration.cs#L128-L130) (`builder.HasIndex(QrCodeToken).IsUnique()`) on a non-null column — equivalent to the partial-where-not-null index the review asked for. NO new migration needed. Added `MaximumLength(50)` to [`CheckInRegistrationCommandValidator`](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandValidator.cs) matching the DB column max so megabyte-token DoS attacks fail as 400 instead of 500. Two new validator tests cover the 50-char boundary and the 51-char reject.
- [x] [Review][Patch] R3-H-S2-2 (High) `EventRegistration.CheckIn` idempotent guard misses `Status == CheckedIn` — add explicit short-circuit (EC-8). **Fixed.** [EventRegistration.CheckIn](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L321-L334) now has an explicit `Status == CheckedIn → return idempotent` branch BEFORE the `CheckedInAt.HasValue` check (symmetric with the Cancelled/Waitlisted/Pending/NoShow rejections above). Data-desync rows (Status=CheckedIn but CheckedInAt=null) now return `WasAlreadyCheckedIn: true` with `CheckedInAt ?? DateTime.UtcNow` and `CheckedInBy ?? Guid.Empty` instead of silently falling through to the fresh-check-in path.
- [x] [Review][Patch] R3-H-S2-4 (High) `EventRegistration.CreateForMember` accepts `Guid.Empty` for `memberId` — reject in factory + drop `?? Guid.Empty` at endpoint (EC-12). **Fixed.** [`EventRegistration.CreateForMember`](backend/src/IabConnect.Domain/Events/EventRegistration.cs) now throws `ArgumentException` on `memberId == Guid.Empty`. The endpoint [`RegisterMember`](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) drops the `?? Guid.Empty` fallback and instead returns `400 BadRequest({ message: "MemberId is required for member registration" })` when the request body omits `MemberId` — clean 400 instead of letting the entity throw bubble up as 500.
- [x] [Review][Patch] R3-M-S2-1 (Medium) `CheckInByQrCodeAsync` opens transaction then early-outs on null lock — restructure to commit/dispose explicitly (BH-12 + EC-15). **Fixed.** [`EventRegistrationCheckInService.CheckInByQrCodeAsync`](backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs) now explicitly `await transaction.CommitAsync(ct)` on the "row deleted between resolve and lock" branch before returning `NotFound`. Postgres logs now show a paired BEGIN/COMMIT instead of a half-disposed transaction; connection state stays clean.
- [x] [Review][Patch] R3-M-S2-3 (Medium) `CheckInSearchHasher` uses Base64 (not Base64Url) — replace `+`/`/` (BH-22 + AA-13). **Fixed.** [`CheckInSearchHasher.Hash`](backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs) now post-processes the Base64 output with `Replace('+','-').Replace('/','_')` to produce base64url (RFC 4648 §5). The hash is now safe for URL paths, JSON identifiers, and form parsers without escape-on-write workarounds. Test regex updated to `^[A-Za-z0-9_-]+$` plus explicit assertions that `+` and `/` are absent.

### Defer

- [x] [Review][Defer] R3-Defer-1 `CancelRegistration` FOR UPDATE row lock (AA-7) — already deferred per round-2 H-S2-5 [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:465-484] — cross-cutting cancellation-concurrency track.
- [x] [Review][Defer] R3-Defer-2 Plumb `CancellationToken` through pre-existing Epic-2 registration endpoints (`RegisterPublic`, `RegisterMember`, `CancelRegistration`, `MarkAsNoShow`, `RevertNoShow`, `RevertCheckIn`, `RevertCancellation`, `GetStatistics`, `ExportRegistrationsPdf`) (EC-11) [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:204-640] — pre-existing surface; out of scope for E3.

## Round 4 Review Findings (2026-05-14)

**Scope:** Epic-3 boundary re-review (full diff `1466c35..HEAD`) after the Round-3 fix-pass. 3 parallel layers. S2-scoped result: **1 Patch (High), 0 Decision, 2 Defer.**

### Patches

- [x] [Review][Patch] R4-P-S2-1 (High) `Pending` / `NoShow` check-in attempts surface as an unhandled 500, not a typed 409 — `EventRegistrationCheckInService.ApplyCheckInAsync` maps only `Cancelled`/`Waitlisted` to a typed `Conflict`; `Pending`/`NoShow` fall through to `throw new InvalidOperationException("Unexpected entity state ...")` and the three check-in endpoints (`CheckInRegistration`, `ManualCheckIn`, `CheckInByQrCode`) call `sender.Send` + `MapCheckInResult` with no try/catch. Violates AC-3 (entity must throw a *typed* conflict for Pending/NoShow) and AC-5 (all three entry points converge on the same response shape — 200/404/409, never 500). [backend/src/IabConnect.Application/Events/CheckIn/EventRegistrationCheckInService.cs:~5900-5912], [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~476-529,628-656]

### Defer

- [x] [Review][Defer] R4-Defer-S2-1 QR-code check-in has no event scoping — any global `RequireEventStaff` user can check in registrations of any event via a held QR token [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~605] — deferred, pre-existing role-model limitation (`RequireEventStaff` is a global realm role, not per-event); the ID path got an `eventId` scope check, the QR path deliberately did not. Tracked with the global-vs-per-event role-registry work alongside R3-Defer-5.
- [x] [Review][Defer] R4-Defer-S2-2 Manual-search check-in produces an audit row with no `searchQueryHash` when `SearchQuery` is empty/omitted — AC-4 says `additionalData` MUST include `searchQueryHash` for the manual path [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~517-525] — deferred, arguably acceptable: there is genuinely no query to hash when the body field is empty; revisit if audit completeness requires a sentinel value.

