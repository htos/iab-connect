# Epic 3 Code Review — Round 3 — 2026-05-13

**Scope:** Boundary re-review of all 5 stories (E3.S1 – E3.S5) after the Round-2 fix pass.

**Predecessor:** [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md) — Round 2 surfaced 3 Critical + 23 High + 36 Medium; Round-2 fix-pass cleared 3 Critical + 22 High + 36 Medium + 5 Decisions (1 High deferred).

**Diff under review:** 146 files / +44,078 / -772 lines (146 working-tree files). Of those, 10 files (~41k lines) are auto-generated EF Designer / ModelSnapshot / `package-lock.json` / `messages/{de,en}.json` — reviewed at metadata level only. Review-meaningful surface: **136 files, +13,302 / -1,380 lines**.

**Review layers (3 parallel agents):**
- **Blind Hunter** — adversarial, diff-only, no project access. Returned 22 findings.
- **Edge Case Hunter** — diff + project read access; walked every branching path and concurrency interleaving. Returned 30 findings (5 self-withdrawn / accepted).
- **Acceptance Auditor** — diff + 5 story specs + project context for cross-checks. Returned 22 findings.

**Headline:** Epic NOT approved on round 3. **4 Critical**, **23 High**, **21 Medium**, **3 Low**, **6 Decisions**, **6 Defer**, **12 Dismiss** after dedup/triage. Round-2 fixes successfully closed the prior Critical set; **the new Critical findings are independent issues not in the Round-2 surface** — two cross-event IDORs missed by the H-S3-2 patch sweep, one CSV formula-injection, and one calendar-token migration design (irreversible `Down()`).

---

## Executive summary by story

| Story | Critical | High | Medium | Low | Decision | Defer | Dismiss | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **S1 — Roster + CSV** | 1 | 1 | 4 | 2 | 1 | 0 | 1 | back-to-dev |
| **S2 — QR/Manual Check-in** | 0 | 4 | 4 | 0 | 2 | 2 | 4 | back-to-dev |
| **S3 — Volunteer Domain + API** | 2 | 6 | 2 | 0 | 1 | 2 | 3 | back-to-dev |
| **S4 — Volunteer UI + Reminders** | 0 | 3 | 5 | 0 | 0 | 2 | 1 | back-to-dev |
| **S5 — Calendar Feed + ICS** | 1 | 9 | 6 | 1 | 2 | 0 | 3 | back-to-dev |
| **TOTAL** | **4** | **23** | **21** | **3** | **6** | **6** | **12** | — |

---

## Decision-needed items (6) — resolve before patching

### DN-1 — `HashCalendarSubscriptionTokens` migration is one-way; Down() is empty
- **Story:** E3.S5
- **Severity:** Critical
- **Sources:** AA-1
- **Location:** [Migrations/20260513205649_HashCalendarSubscriptionTokens.cs:30-44](backend/src/IabConnect.Infrastructure/Migrations/20260513205649_HashCalendarSubscriptionTokens.cs)
- **Tension:** The round-2 H-S5-1 fix renames `calendar_subscription_token` semantics from cleartext to SHA-256-hex in place. `Up()` runs `encode(digest(..., 'sha256'), 'hex')` for existing rows. `Down()` is empty. A bad-deploy rollback that re-runs `Down()` keeps the hashes (no harm), but rolling back the code to the pre-hash version means the old code-path's `MemberRepository.GetByCalendarTokenAsync` does a cleartext compare against a column that is now SHA-256-hex → every existing subscription instantly 404s with no recovery path.
- **Options:**
  - **(a)** Accept: rollbacks of this specific migration are not supported; require a full re-issue to all members.
  - **(b)** Refactor to additive: add `calendar_subscription_token_hash` as a NEW column, keep `calendar_subscription_token` cleartext during a transition window, write to both, dual-read for N days, then drop the cleartext in a follow-up migration. Reversible at any point in the window.
  - **(c)** Accept the in-place rename for THIS migration, but add a `Down()` that documents "non-reversible — restore from PIT backup".

### DN-2 — Member calendar feed lookup filters `Status == Active` only
- **Story:** E3.S5
- **Severity:** Critical (contract surprise)
- **Sources:** BH-1, AA-1
- **Location:** [MemberRepository.cs:46-53](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs)
- **Tension:** The lookup returns null for any member whose `Status != Active`. The interface XML doc says "null when Inactive or merged-retired", but `MembershipStatus` enum includes **`Pending`** (default at create), **`Suspended`**, etc. A brand-new member who rotates their token before activation (or whose status is paused administratively) silently gets a permanent 404 on every calendar fetch — no error surfaced to the user.
- **Options:**
  - **(a)** Broaden: filter `Status != Inactive && MergedIntoMemberId == null` (Pending and Suspended keep their feeds — matches the intent of "soft-retire is the only exclusion").
  - **(b)** Tighten on rotate: throw on token-rotate when status is not Active, so users see the issue at rotate-time not at fetch-time.
  - **(c)** Keep as-is and surface a clear error response (401/410 not 404) so subscribers see "your access is paused".

### DN-3 — CheckIn audit fires at endpoint, not handler (spec literal: "handler MUST log")
- **Story:** E3.S2
- **Severity:** High
- **Sources:** AA-6
- **Location:** [EventRegistrationEndpoints.cs:778-792](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) (`MapCheckInResult`), [CheckInRegistrationCommandHandler.cs:13-19](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandHandler.cs)
- **Tension:** Spec AC-4 requires `ISecurityAuditLogger.LogAccessGranted` in the handler. Implementation centralises audit in `MapCheckInResult` (endpoint) to keep `IabConnect.Application` free of ASP.NET dependencies. Future internal callers (background job / automation) that invoke the command via MediatR without going through `MapCheckInResult` would silently skip the audit.
- **Options:**
  - **(a)** Keep current placement (endpoint) — accept the asymmetry, document it as an architectural decision, AC text updated to match.
  - **(b)** Move audit to handler — inject `ISecurityAuditLogger` (already abstract in Application). Remove the duplicate in `MapCheckInResult`. Honors spec literal.
  - **(c)** Both — accept duplicate write on the HTTP path, only one on the internal path. Wasteful but defense-in-depth.

### DN-4 — `event-manager` cannot read volunteer shifts (RequireMember policy excludes the role)
- **Story:** E3.S3
- **Severity:** High
- **Sources:** AA-8
- **Location:** [DependencyInjection.cs:140-141](backend/src/IabConnect.Api/DependencyInjection.cs) (`RequireMember` policy), [EventVolunteerEndpoints.cs:40-44, 70-75, 102-107](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs)
- **Tension:** `RequireMember` = `admin | vorstand | member`. Volunteer GET endpoints use `RequireMember` (so members can browse). An `event-manager` who is NOT also `admin`/`vorstand` cannot GET the volunteer shifts they manage via `RequireEventStaff`.
- **Options:**
  - **(a)** Add `event-manager` to `RequireMember` policy roles.
  - **(b)** Create a new `RequireEventStaffOrMember` policy and use it on the GET endpoints.
  - **(c)** Configure Keycloak so every `event-manager` is also a `member` (composite role).

### DN-5 — `CheckedInBy ?? Guid.Empty` on idempotent CheckIn (spec: throw on null)
- **Story:** E3.S2
- **Severity:** High
- **Sources:** AA-10
- **Location:** [EventRegistration.cs:333](backend/src/IabConnect.Domain/Events/EventRegistration.cs)
- **Tension:** Spec AC-3 contract is `CheckedInBy: this.CheckedInBy!.Value` (throws if null). Round-2 M-S2-1 fix introduced `CheckedInBy ?? Guid.Empty` to handle legacy rows. Audit forensics now see `Guid.Empty` instead of a real user ID on idempotent re-check-ins of legacy data.
- **Options:**
  - **(a)** Keep defensive fallback (`Guid.Empty`). Operations: ignore. Forensics: degraded for legacy rows only.
  - **(b)** Revert to fail-fast (`!.Value`). Operations: any legacy row check-in throws → 500. Force a one-time backfill migration to populate `CheckedInBy` for historical rows.
  - **(c)** Use a sentinel `Guid` per environment for "system fallback", clearly distinct from real user IDs, and document it.

### DN-6 — CSV roster i18n mix: English headers + German tick-box column
- **Story:** E3.S1
- **Severity:** Low (UX inconsistency)
- **Sources:** BH-21
- **Location:** [EventCheckInRosterCsvExporter.cs:23-31](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs)
- **Tension:** Headers are English (`Name`, `Status`, `Waitlisted`, `CheckedIn`), `Status` enum values are English (`Confirmed`, `Waitlisted`), but last column is German (`[ ] (Anwesenheit)`). The CSV is a print artifact for venue door staff. Project primary language is German.
- **Options:**
  - **(a)** Full German (translate headers + Status enum display names).
  - **(b)** Full English (translate `[ ] (Anwesenheit)` → `[ ] (Present)`).
  - **(c)** Accept the current mix and document the asymmetry.

---

## Critical findings (4)

### C1 — CSV formula injection: leading `=`, `+`, `-`, `@` in `ParticipantName` / `SpecialRequirements` not sanitized
- **Story:** E3.S1
- **Sources:** EC-1
- **Location:** [EventCheckInRosterCsvExporter.cs:105-128](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs) (`QuoteIfNeeded`)
- **Evidence:** Round-2 fix added `\t` + leading/trailing whitespace quoting. The OWASP-recommended formula-injection prefix set (`=`, `+`, `-`, `@`) is NOT detected. A public registrant submits `{"name":"=cmd|'/c calc'!A1"}` via `POST /api/v1/events/{eventId}/registrations/public`; staff opens the roster CSV in Excel → formula evaluates on staff workstation. SpecialRequirements is free text from anonymous public registrants — attacker fully controls.
- **Fix sketch:** Prefix any cell whose first char is in `{=,+,-,@,\r,\t}` with `'` (Excel-safe escape) AND quote the cell. Apply to ALL string cells, not just suspect ones.

### C2 — Cross-event IDOR: `PUT /api/v1/events/{eventId}/volunteer-roles/{roleId}` ignores `eventId`
- **Story:** E3.S3
- **Sources:** EC-2
- **Location:** [EventVolunteerEndpoints.cs:170-195](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs) (`UpdateRole`), [UpdateEventVolunteerRoleCommand.cs:7-11](backend/src/IabConnect.Application/Events/Volunteers/Commands/UpdateEventVolunteerRoleCommand.cs)
- **Evidence:** Command carries only `RoleId`; handler never compares `role.EventId == request.EventId`. Sister `UpdateEventVolunteerShiftCommand` DOES enforce this (H-S3-2 patch). An `event-manager` for event A can `PUT /api/v1/events/{eventA.Id}/volunteer-roles/{eventB.someRoleId}` → renames/deactivates a role in event B. H-S3-2 patch sweep missed this command.
- **Fix sketch:** Add `EventId` to `UpdateEventVolunteerRoleCommand`, propagate from the endpoint, enforce `role.EventId == request.EventId` in the handler (mirror `UpdateEventVolunteerShiftCommandHandler`).

### C3 — Cross-event IDOR: `GET /volunteer-shifts/{shiftId}/assignments` ignores `eventId`
- **Story:** E3.S3
- **Sources:** EC-3
- **Location:** [EventVolunteerEndpoints.cs:280-285](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs) (`GetAssignments`), [GetVolunteerShiftAssignmentsQuery.cs:7](backend/src/IabConnect.Application/Events/Volunteers/Queries/GetVolunteerShiftAssignmentsQuery.cs)
- **Evidence:** Endpoint accepts `eventId` route parameter, handler discards it; query by `shiftId` only. Any `RequireMember` caller can enumerate volunteer rosters across all events given a shift GUID. Personal data exposure (member names, statuses, waitlist positions) on the volunteer surface — privacy-sensitive.
- **Fix sketch:** Add `EventId` to `GetVolunteerShiftAssignmentsQuery`, validate `shift.EventId == request.EventId` in the handler; return NotFound on mismatch (do not distinguish from "shift does not exist" — opaque error).

### C4 — `HashCalendarSubscriptionTokens` migration is one-way (also DN-1)
- **Story:** E3.S5
- **Sources:** AA-1 (decision-needed surface)
- **Location:** [Migrations/20260513205649_HashCalendarSubscriptionTokens.cs:18-44](backend/src/IabConnect.Infrastructure/Migrations/20260513205649_HashCalendarSubscriptionTokens.cs)
- See **DN-1** for decision tree.

---

## High findings (23)

### H-S1-1 — `ExportEventCheckInRosterQueryHandler` re-enters MediatR; pipeline behaviors run twice
- **Story:** E3.S1
- **Sources:** BH-3
- **Location:** [ExportEventCheckInRosterQueryHandler.cs](backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs)
- **Evidence:** Handler injects `IMediator` and calls `_mediator.Send(new GetEventCheckInRosterQuery(...))`. Every `IPipelineBehavior` (validators, logging, transactions, audit) runs twice per CSV download — double-audit rows, double validation throws, double telemetry.
- **Fix sketch:** Inject `GetEventCheckInRosterQueryHandler` directly OR extract a shared `IEventCheckInRosterService` that both handlers call.

### H-S2-1 — QR check-in token has no length cap; `QrCodeToken` column has no DB index
- **Story:** E3.S2
- **Sources:** EC-4
- **Location:** [EventRegistrationEndpoints.cs:182-191](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs), [CheckInRegistrationCommandValidator.cs:19](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommandValidator.cs), [EventRegistrationCheckInService.cs:60-64](backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs)
- **Evidence:** Route `POST /registrations/check-in/{qrCodeToken}` accepts arbitrary length. Validator only checks `!IsNullOrWhiteSpace`. `Where(r => r.QrCodeToken == qrCodeToken)` runs as a seq-scan (no index in any migration). 1 MB token × N requests = DB DoS surface.
- **Fix sketch:** Add `MaximumLength(64)` (or actual format constraint) to the validator. Create a migration adding a unique index on `EventRegistrations.QrCodeToken WHERE QrCodeToken IS NOT NULL`.

### H-S2-2 — `EventRegistration.CheckIn` idempotent guard checks `CheckedInAt.HasValue` but not `Status`
- **Story:** E3.S2
- **Sources:** EC-8
- **Location:** [EventRegistration.cs:308-344](backend/src/IabConnect.Domain/Events/EventRegistration.cs)
- **Evidence:** Status rejections (Cancelled/Waitlisted/Pending/NoShow) do not include `Status == CheckedIn`. Idempotent return relies on `CheckedInAt.HasValue`. A `Status=CheckedIn` row with `CheckedInAt=null` (data desync, partial migration) gets a fresh check-in row with no audit signal that this is a double event.
- **Fix sketch:** Add explicit `Status == CheckedIn → return idempotent` short-circuit BEFORE the `HasValue` check. Symmetric with the other status rejections.

### H-S2-3 — `CancellationToken` not plumbed through pre-existing Epic-2 registration endpoints (defer-eligible)
- **Story:** E3.S2 (cross-cutting; pre-existing surface)
- **Sources:** EC-11
- **Location:** [EventRegistrationEndpoints.cs:204-282, 283-376, 442-495, 554-640](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) — `RegisterPublic`, `RegisterMember`, `CancelRegistration`, `MarkAsNoShow`, `RevertNoShow`, `RevertCheckIn`, `RevertCancellation`, `GetStatistics`, `ExportRegistrationsPdf`
- **Evidence:** New Epic-3 endpoints correctly plumb `ct`; the pre-existing endpoints these new ones share files with do not. Client abort = server continues to completion. Per `project-context.md` rule: "Repository, MediatR handler, endpoint, EF Core APIs should accept and pass through `CancellationToken`."
- **Recommendation:** Defer to cross-cutting retrofit ticket — out of scope for E3 specifically, but flagged because the new endpoints sit next to them.

### H-S2-4 — `EventRegistration.CreateForMember` accepts `memberId == Guid.Empty`
- **Story:** E3.S2
- **Sources:** EC-12
- **Location:** [EventRegistration.cs:131-160](backend/src/IabConnect.Domain/Events/EventRegistration.cs), [EventRegistrationEndpoints.cs:350-358](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs)
- **Evidence:** Endpoint: `registration = EventRegistration.CreateForMember(eventId, userId, request.MemberId ?? Guid.Empty, ...)`. `ValidateBasicParameters` does not reject Guid.Empty for memberId. Insert succeeds (no FK constraint to Members), silently breaking the "member registrations link to a member" invariant. Querying member's registrations by Guid.Empty would return all such rows across all members.
- **Fix sketch:** Reject `Guid.Empty` for `memberId` in `EventRegistration.CreateForMember` AND drop the `?? Guid.Empty` fallback at the endpoint — make the request field non-nullable + validated by FluentValidation.

### H-S3-1 — `CancelShift` endpoint: cross-event mismatch returns 404 with no audit row
- **Story:** E3.S3
- **Sources:** BH-4
- **Location:** [EventVolunteerEndpoints.cs (CancelShift)](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs), [EventVolunteerAssignmentService.cs (CancelAllAssignmentsForShiftAsync)](backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs)
- **Evidence:** Service returns `ShiftFound=false` on cross-event mismatch; endpoint maps to 404 with no `LogAccessDenied`. An attacker probing shiftIds via cross-event guessing leaves no audit trail until they hit a valid in-event match. Sister `CancelAssignment` correctly logs `LogAccessDenied` on `NotAuthorized`.
- **Fix sketch:** Distinguish "shift not found" from "shift in wrong event" in the service result (add `WrongEvent` outcome). Endpoint emits `LogAccessDenied` on `WrongEvent`.

### H-S3-2 — `EventVolunteerRoleRepository.GetByEventAndNameAsync` Turkish-locale `ToLower()` mismatch
- **Story:** E3.S3
- **Sources:** BH-5
- **Location:** [EventVolunteerRoleRepository.cs (GetByEventAndNameAsync)](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerRoleRepository.cs)
- **Evidence:** `r.Name.ToLower() == trimmed.ToLower()`. CLR `.ToLower()` on input is culture-sensitive (Turkish `İ → i̇`); EF translates `r.Name.ToLower()` to Postgres `lower()` (DB collation `en_US.UTF-8`). Sides disagree on dotted/dotless-i. Pre-check misses a legitimate match → falls to `AddAsync` → hits the partial unique `lower(name)` index → 409.
- **Fix sketch:** Use `EF.Functions.ILike(r.Name, EscapeLikePattern(trimmed))` OR `r.Name.ToLower() == trimmed.ToLowerInvariant()`.

### H-S3-3 — `AddAtomicAsync` null re-fetch rethrows `DbUpdateException` as raw 500
- **Story:** E3.S3
- **Sources:** BH-7
- **Location:** [EventVolunteerAssignmentRepository.cs (AddAtomicAsync)](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs)
- **Evidence:** On `UniqueViolation` → rollback to savepoint → re-fetch via `GetActiveForMemberAsync`. If a concurrent caller cancelled the row in the same millisecond, re-fetch returns null and `throw` rethrows the original `DbUpdateException` — caller's `catch (DbUpdateException)` only handles `ForeignKeyViolation`, so this bubbles to 500.
- **Fix sketch:** On null re-fetch, return `(null, false)` with a distinct sentinel; service maps to a typed `Cancelled` / `Transient` outcome instead of raising.

### H-S3-4 — Cancel-by-merged-member path always returns NotAuthorized
- **Story:** E3.S3
- **Sources:** BH-10
- **Location:** [CancelVolunteerAssignmentCommand.cs](backend/src/IabConnect.Application/Events/Volunteers/Commands/CancelVolunteerAssignmentCommand.cs)
- **Evidence:** Self-cancel resolves caller via `GetByKeycloakUserIdAsync` (filtered to non-merged). A member who signed up for a shift, then got soft-merged into another Member, cannot cancel their assignment (`callerMemberId` = null → returns NotAuthorized). The surviving merged-target should own the inherited assignment.
- **Fix sketch:** Follow `MergedIntoMemberId` once to find the surviving member, then compare the surviving member to `assignment.MemberId`.

### H-S3-5 — N+1: `GetEventVolunteerShifts` runs 2N+2 queries per event
- **Story:** E3.S3
- **Sources:** EC-9
- **Location:** [GetEventVolunteerShiftsQuery.cs:33-41](backend/src/IabConnect.Application/Events/Volunteers/Queries/GetEventVolunteerShiftsQuery.cs)
- **Evidence:** 1 shift query + 1 roles query + N×2 count queries (Confirmed + Waitlisted per shift). 50 shifts = 102 round-trips.
- **Fix sketch:** Single `GROUP BY (shift_id, status) COUNT(*)` query, then project to DTOs.

### H-S3-6 — N+1: `GetVolunteerShiftAssignmentsQueryHandler` loads members one-by-one
- **Story:** E3.S3
- **Sources:** EC-10
- **Location:** [GetVolunteerShiftAssignmentsQuery.cs:34-40](backend/src/IabConnect.Application/Events/Volunteers/Queries/GetVolunteerShiftAssignmentsQuery.cs)
- **Evidence:** `foreach (var id in memberIds) await _members.GetByIdAsync(id, ct)` — one DB hit per member. 500-volunteer shift = 500 queries.
- **Fix sketch:** Add `IMemberRepository.GetByIdsAsync(IReadOnlyCollection<Guid>, CancellationToken)` returning a dictionary, populate in one round-trip.

### H-S4-1 — `VolunteerShiftReminderService` captures `nowUtc` once per batch
- **Story:** E3.S4
- **Sources:** BH-9
- **Location:** [VolunteerShiftReminderService.cs](backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs) (top of `ExecuteAsync`)
- **Evidence:** `var nowUtc = _timeProvider.GetUtcNow().UtcDateTime` captured once; passed as `sentAtUtc` for every row in the batch. A run sending 200 reminders over 10 minutes marks every row as "sent at 09:00". Audit fidelity degrades.
- **Fix sketch:** Capture `_timeProvider.GetUtcNow().UtcDateTime` per-row, immediately before `MarkReminderSentAsync`.

### H-S4-2 — Reminder window (36h) + non-atomic mark-sent can double-send under transient SMTP outage
- **Story:** E3.S4
- **Sources:** EC-7, AA-16
- **Location:** [VolunteerShiftReminderService.cs:43-54](backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs), [EventVolunteerAssignmentRepository.cs:130-154](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs)
- **Evidence:** SMTP send and `MarkReminderSentAsync` are sequential. SMTP succeeds → mark-sent UPDATE fails (DB blip) → Hangfire retry re-enters loop → row still unmarked → resends. Daily re-run finds the same row (within `now+36h`) and re-sends again. AC text says 24h; code uses 36h with a comment explaining the cron alignment — not in AC.
- **Fix sketch:** Wrap send + mark in a single transaction (mark first, then send; if send throws, transaction rolls back the mark, retry). OR use an idempotency-key column in the email send. AC text should be updated to reflect 36h.

### H-S4-3 — Vitest page test for `volunteers/page.tsx` is missing
- **Story:** E3.S4
- **Sources:** AA-9
- **Location:** `frontend/src/app/(dashboard)/events/[id]/volunteers/__tests__/page.test.tsx` (does not exist)
- **Evidence:** Spec AC-9 mandates this test (render-with-shifts, role-gated buttons hidden for member, 409 surfaces error pill + refresh). Only `frontend/src/lib/services/volunteers.test.ts` exists (pure helper). The 409-race UX banner — core to AC-4 — has zero regression coverage.
- **Fix sketch:** Author the missing `page.test.tsx` per the AC's three scenarios.

### H-S5-1 — `MemberRepository.GetByCalendarTokenAsync` rejects non-Active members (also DN-2)
- **Story:** E3.S5
- **Sources:** BH-1, AA-1
- **Location:** [MemberRepository.cs:46-53](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs)
- See **DN-2** for decision tree.

### H-S5-2 — `ResolveBaseUrl` throws on every request when `App:PublicBaseUrl` is unset
- **Story:** E3.S5
- **Sources:** BH-2
- **Location:** [EventEndpoints.cs (ResolveBaseUrl)](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs)
- **Evidence:** `string.IsNullOrWhiteSpace(configured) → throw InvalidOperationException` fires per-request. Misconfigured deploy = all `/calendar.ics` returns 500 instead of failing-to-start with a clear error.
- **Fix sketch:** `services.AddOptions<AppSettings>().BindConfiguration("App").ValidateDataAnnotations().ValidateOnStart()`. Host crashes at boot if `PublicBaseUrl` is empty; production never sees per-request 500s.

### H-S5-3 — `Member.HashCalendarToken` is unkeyed SHA-256 (no HMAC pepper)
- **Story:** E3.S5
- **Sources:** BH-6
- **Location:** [Member.cs (HashCalendarToken)](backend/src/IabConnect.Domain/Members/Member.cs)
- **Evidence:** `SHA256.HashData(UTF8.GetBytes(token))`. A DB-read attacker who acquires a known cleartext token (email forward, calendar-app sync log) can immediately confirm the matching row. Use HMAC-SHA256 with a server-side pepper so the DB hash is useless without the secret.
- **Fix sketch:** `HMACSHA256.HashData(serverPepperBytes, tokenBytes)`. Add `Auth:CalendarTokenPepper` to config; reject startup if unset. Migration to rehash existing rows.

### H-S5-4 — `CalendarFeedBuilder.AppendLineFolded` infinite loop on malformed UTF-8 at offset 0
- **Story:** E3.S5
- **Sources:** BH-8
- **Location:** [CalendarFeedBuilder.cs (AppendLineFolded)](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Evidence:** Walk-back loop decrements `end` while `(bytes[end] & 0xC0) == 0x80`. If input begins with a stray continuation byte and `end == pos`, the slice writes zero bytes, `pos = end` doesn't advance, outer loop re-fires forever. A malicious event Description with a stray `0x80` byte triggers this.
- **Fix sketch:** Guard: if `end == pos` after walk-back, force `end = Math.Min(pos + budget, bytes.Length)` (cut anyway and emit a warning), OR pre-validate input with `Encoding.UTF8.GetByteCount` before folding.

### H-S5-5 — `RotateCalendarToken` is not row-locked: rapid double-rotate persists different tokens than the one returned
- **Story:** E3.S5
- **Sources:** BH-17, EC-5
- **Location:** [EventEndpoints.cs:213-239 (RotateCalendarToken)](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs), [Member.cs:157-172 (RegenerateCalendarToken)](backend/src/IabConnect.Domain/Members/Member.cs)
- **Evidence:** Two simultaneous rotate calls from the same user: each loads its own tracked Member, regenerates, saves; last writer wins on the hash; both clients receive different `subscriptionUrl` values; only one matches the persisted hash. The losing client's URL is dead-on-arrival.
- **Fix sketch:** Wrap rotate in a transaction with `FOR UPDATE` on the member row, OR add a row-version (`xmin`) concurrency token to detect conflict and retry.

### H-S5-6 — ICS DTEND for all-day events uses inclusive end (RFC 5545 §3.6.1 violation)
- **Story:** E3.S5
- **Sources:** EC-6
- **Location:** [CalendarFeedBuilder.cs:61-65](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Evidence:** RFC 5545 specifies `DTEND;VALUE=DATE` as the day AFTER the last full day (non-inclusive). Code emits `FormatDateOnly(evt.EndDate)` where `EndDate` is inclusive last-moment per the domain (`HasEnded => UtcNow >= EndDate`). Single-day all-day event with `EndDate = 2026-03-01` emits `DTSTART:20260301;DTEND:20260301` → Google Calendar / Outlook show zero duration or drop the event.
- **Fix sketch:** For all-day events, emit `DTEND = EndDate + 1 day` so the end is exclusive per RFC.

### H-S5-7 — Missing `EventCalendarFeedEndpointTests` (AC-10 API tier)
- **Story:** E3.S5
- **Sources:** AA-3
- **Location:** `backend/tests/IabConnect.Api.Tests/Endpoints/EventCalendarFeedEndpointTests.cs` (does not exist)
- **Evidence:** Spec AC-10 mandates: `.AllowAnonymous()` metadata test on both feed endpoints; `Content-Type: text/calendar; charset=utf-8` assertion; `Cache-Control` header assertion; per-event endpoint `text/calendar` for public + 404 for non-public when no token; rotate/revoke `RequireMember` metadata + 401-for-unauthenticated.
- **Fix sketch:** Author the file with all six scenarios per spec.

### H-S5-8 — Missing `GetPublicCalendarFeedQueryHandlerTests` (AC-10 Application tier)
- **Story:** E3.S5
- **Sources:** AA-4
- **Location:** `backend/tests/IabConnect.Application.Tests/Events/Calendar/GetPublicCalendarFeedQueryHandlerTests.cs` (does not exist)
- **Evidence:** Spec AC-10 mandates a visibility-filter test asserting only `Public + Published` rows appear in output; the public feed is the primary anonymous surface. No targeted regression coverage today.
- **Fix sketch:** Author the file: visibility-filter test + ID-set test using seeded events of all visibility/status combinations.

### H-S5-9 — Public-feed handler adds 90d/2y filters that narrow vs `GetPublicEventsAsync` contract
- **Story:** E3.S5
- **Sources:** AA-5
- **Location:** [GetPublicCalendarFeedQuery.cs:30-31](backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs)
- **Evidence:** Spec AC-1: "consume `GetPublicEventsAsync` unmodified". Handler adds `EndDateFrom = now-90d` and post-filter `EndDate <= now+2y`. A yearly festival page (Published, Public, StartDate 100d ago) is silently dropped from the calendar feed but appears in the public events list.
- **Fix sketch:** Move both filters INTO `IEventRepository.GetPublicEventsAsync` (or a sibling `GetPublicEventsForCalendarAsync`) so feed + list stay symmetric.

---

## Medium findings (21)

### M-S1-1 — CSV `IsWhiteSpace` quirk on trailing whitespace + Excel-collapse of trailing empty column
- **Story:** E3.S1
- **Sources:** BH-18
- **Location:** [EventCheckInRosterCsvExporter.cs (QuoteIfNeeded)](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs)
- **Fix sketch:** Emit `""` (quoted empty) for the last column (the tick-box) so Excel never treats the row's last comma as a trailing trim. Also: `char.IsWhiteSpace` quotes for NBSP / narrow NBSP — acceptable; document the choice.

### M-S1-2 — `GetEventCheckInRosterQueryHandler` uses `DateTime.UtcNow` (not `TimeProvider`)
- **Story:** E3.S1
- **Sources:** BH-15
- **Location:** [GetEventCheckInRosterQueryHandler.cs](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs)
- **Fix sketch:** Inject `TimeProvider`, capture once. Reminder service already uses this pattern.

### M-S1-3 — Roster `OrderBy(..., StringComparer.Ordinal)` may misorder apostrophes / extended Unicode
- **Story:** E3.S1
- **Sources:** AA-11
- **Location:** [GetEventCheckInRosterQueryHandler.cs:67](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs)
- **Fix sketch:** Use `StringComparer.OrdinalIgnoreCase` over the folded string, OR `StringComparer.Create(CultureInfo.InvariantCulture, ignoreCase: true)` for locale-stable ordering.

### M-S1-4 — CSV AC-5 text says 10 columns; code has 9 (D-S1-1 amendment)
- **Story:** E3.S1
- **Sources:** AA-2
- **Location:** Story `_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md` AC-5
- **Fix sketch:** Update AC-5 to match the 9-column layout per D-S1-1 decision; cite the decision ID inline.

### M-S2-1 — `CheckInByQrCodeAsync` transaction opened before lock-load (early-out commits empty tx)
- **Story:** E3.S2
- **Sources:** BH-12, EC-15
- **Location:** [EventRegistrationCheckInService.cs:60-78](backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs)
- **Fix sketch:** Move the lock-and-load into the same statement that opens the transaction, OR explicitly commit/dispose before the early-out.

### M-S2-2 — `SelfSignUpForVolunteerShiftCommandHandler` uses `InvalidOperationException` → 403 (string-message-driven)
- **Story:** E3.S2 (volunteer self-signup lives in S3 but maps a check-in-style flow)
- **Sources:** BH-20
- **Location:** [SelfSignUpForVolunteerShiftCommand.cs](backend/src/IabConnect.Application/Events/Volunteers/Commands/SelfSignUpForVolunteerShiftCommand.cs), [EventVolunteerEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs)
- **Fix sketch:** Add `NoMemberLink` to `VolunteerAssignmentOutcome`; return it from the handler; endpoint maps to 403 `errorCode: "NoMemberLink"`. Future domain throws remain 500.

### M-S2-3 — `CheckInSearchHasher` uses Base64 (not Base64Url)
- **Story:** E3.S2
- **Sources:** BH-22, AA-13
- **Location:** [CheckInSearchHasher.cs](backend/src/IabConnect.Application/Events/CheckIn/CheckInSearchHasher.cs)
- **Fix sketch:** `Convert.ToBase64String(bytes).Replace('+','-').Replace('/','_')[..PrefixLength]` (Base64Url).

### M-S2-4 — Single-event ICS `NotFound` wording differs from member-feed wording
- **Story:** E3.S2 (actually E3.S5 surface)
- **Sources:** AA-17
- **Location:** [EventEndpoints.cs:170-211](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs)
- **Fix sketch:** Use the same opaque wording `"Calendar feed not found"` for both endpoints (or both `"Event not found"`); per spec D7 the goal is indistinguishability.

### M-S3-1 — `UpdateEventVolunteerShiftCommand` updates fields outside the capacity transaction
- **Story:** E3.S3
- **Sources:** EC-17
- **Location:** [UpdateEventVolunteerShiftCommand.cs:84-112](backend/src/IabConnect.Application/Events/Volunteers/Commands/UpdateEventVolunteerShiftCommand.cs)
- **Fix sketch:** Move capacity update INTO the same transaction as the field update; single `FOR UPDATE` bracket.

### M-S3-2 — `CancelAllAssignmentsForShiftAsync` has lost-update window against concurrent `CancelAssignmentAsync`
- **Story:** E3.S3
- **Sources:** EC-23
- **Location:** [EventVolunteerAssignmentService.cs:256-267](backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs)
- **Fix sketch:** Add `xmin` concurrency token to `EventVolunteerAssignment`; on conflict, refetch and skip already-cancelled rows.

### M-S4-1 — Reminder email body has no `<meta charset>` or `<html lang>`
- **Story:** E3.S4
- **Sources:** BH-11
- **Location:** [EventNotificationService.cs (HTML body)](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs)
- **Fix sketch:** Add `<meta http-equiv="Content-Type" content="text/html; charset=utf-8">` and `<html lang="de">` (with `<div lang="en">` wrapper for the EN block).

### M-S4-2 — `ResolveReminderJobTimeZone` silent fallback to UTC (log warning only)
- **Story:** E3.S4
- **Sources:** BH-14
- **Location:** [DependencyInjection.cs (ResolveReminderJobTimeZone)](backend/src/IabConnect.Api/DependencyInjection.cs)
- **Fix sketch:** Promote `LogWarning` → `LogError`. Add a health check that fails-readiness when fallback is active. Optionally fail-boot in `Environment.IsProduction()`.

### M-S4-3 — Cancellation mid-batch loses the `LogInformation` summary line
- **Story:** E3.S4
- **Sources:** EC-19
- **Location:** [VolunteerShiftReminderService.cs:55-119](backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs)
- **Fix sketch:** Wrap summary logging in a `try/finally` so partial progress is recorded on cancellation.

### M-S4-4 — `ZurichTimeZone` cached at static init; stale on `tzdata` update
- **Story:** E3.S4
- **Sources:** EC-20
- **Location:** [EventNotificationService.cs:90-101](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs)
- **Fix sketch:** Resolve per-call (cheap) OR add a `TimeZoneInfo.ClearCachedData()` hook on a host signal. Operationally rare; could defer.

### M-S4-5 — Reminder query has no member-status filter
- **Story:** E3.S4
- **Sources:** AA-15
- **Location:** [VolunteerShiftReminderService.cs:62](backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs) and [EventVolunteerAssignmentRepository.cs (GetRemindersDueAsync)](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs)
- **Fix sketch:** Add `Member.Status == Active && Member.MergedIntoMemberId == null` to the query (or in the in-memory filter post-fetch).

### M-S5-1 — Single-event ICS endpoint emits `STATUS:CONFIRMED` even for Draft events under cross-path conditions
- **Story:** E3.S5
- **Sources:** BH-13
- **Location:** [CalendarFeedBuilder.cs (BuildSingle)](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Fix sketch:** Centralize the (Visibility × Status) → emit-or-NotFound matrix in one method; both endpoints route through it.

### M-S5-2 — Public ICS response lacks `Vary: Accept-Encoding` and `ETag`
- **Story:** E3.S5
- **Sources:** BH-16
- **Location:** [EventEndpoints.cs (SetPublicIcsResponseHeaders)](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs)
- **Fix sketch:** Add `httpContext.Response.Headers.Vary = "Accept-Encoding"`. Compute `ETag` as `"\"" + SHA256(icsContent)[..16] + "\""`; support `If-None-Match` → 304.

### M-S5-3 — `DESCRIPTION` truncation slices on UTF-16 char boundary; can drop low surrogate
- **Story:** E3.S5
- **Sources:** BH-19
- **Location:** [CalendarFeedBuilder.cs (WriteEvent)](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Fix sketch:** Use `string.EnumerateRunes()` to cut on codepoint boundary, OR `StringInfo.SubstringByTextElements`. Surrogate-aware truncate.

### M-S5-4 — Line-folding budget ignores post-escape expansion (`\n` → `\\n`)
- **Story:** E3.S5
- **Sources:** EC-13
- **Location:** [CalendarFeedBuilder.cs:191](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Fix sketch:** Compute byte length AFTER `EscapeIcsText`; fold on the escaped bytes.

### M-S5-5 — `ResolveBaseUrl` does not validate `App:PublicBaseUrl` shape; CRLF in env var injects into ICS body
- **Story:** E3.S5
- **Sources:** EC-16
- **Location:** [EventEndpoints.cs (ResolveBaseUrl)](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs)
- **Fix sketch:** Validate via `Uri.TryCreate(configured, UriKind.Absolute, out var uri)` with scheme whitelist (`https`/`http`); throw at startup (combine with H-S5-2).

### M-S5-6 — Rotate-token endpoint response missing `Cache-Control: no-store`
- **Story:** E3.S5
- **Sources:** AA-18
- **Location:** [EventEndpoints.cs:237-238](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs)
- **Fix sketch:** `httpContext.Response.Headers.CacheControl = "no-store"` before `Results.Json(...)`. Mirror M-S5-3 fix from round 2.

---

## Low findings (3)

### L-S1-1 — `[ ]` in CSV header may confuse Excel name-range parsing (cosmetic)
- **Story:** E3.S1
- **Sources:** EC-24
- **Location:** [EventCheckInRosterCsvExporter.cs:31](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs)
- **Fix sketch:** Rename to `Anwesenheit` (or `Present`), drop the literal `[ ]` from the header.

### L-S5-1 — `URL` line escapes `,;` (RFC 5545 §3.3.13 says URI values are not TEXT-escaped)
- **Story:** E3.S5
- **Sources:** EC-25
- **Location:** [CalendarFeedBuilder.cs:94](backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs)
- **Fix sketch:** Drop comma/semicolon escaping for `URL` property; pass through verbatim.

### L-S1-2 — CSV roster i18n inconsistency (also DN-6)
- See DN-6.

---

## Defer items (6)

| ID | Story | Title | Reason |
|---|---|---|---|
| Defer-1 | E3.S2 | CancelRegistration FOR UPDATE row lock (H-S2-5 from round 2) | Already deferred per round-2 review; cross-cutting cancellation concurrency track |
| Defer-2 | E3.S2 (cross-cutting) | Plumb CancellationToken through Epic-2 registration endpoints | Pre-existing surface from Epic-2; out of scope for E3 |
| Defer-3 | E3.S4 | Hardcoded DE/EN strings in `EventNotificationService` reminder body | D8 carve-out — comms i18n track |
| Defer-4 | E3.S4 | `ZurichTimeZone` static cache (M-S4-4) — only stale on host `tzdata` update | Operationally rare; revisit if frequent tz updates |
| Defer-5 | E3.S3 | `IsStaffCaller` hardcoded role list (EC-26) | Latent only on new-role addition; SST refactor for role registry |
| Defer-6 | E3.S3 | No DELETE endpoint for `EventVolunteerRole` (AA-12) | Design intent: deactivate, never delete; surface a manager-deactivate UI flow if needed |

---

## Dismiss items (12)

- **EC-14** — Calendar-token timing-attack analysis: hash-then-compare is correctly designed (threat model holds).
- **EC-18** — Reminder email body sanitization concerns are informational; not exploitable in modern SMTP.
- **EC-21** — CSV `\r` quoting: reviewer self-withdrawn after re-reading the code (`\r` IS quoted).
- **EC-22** — Cancel-assignment auth-check staleness: neutralized by `MemberId` domain immutability.
- **EC-27** — `Member.HashCalendarToken` throws on null: defensive shape; pre-checked upstream.
- **EC-28** — `GetEventStatistics` uses `DateTime` with `Kind=Unspecified`: current EF/Npgsql behavior is correct; latent only on framework changes.
- **EC-29** — `LockAndLoadByIdAsync` PK uniqueness: defensive shape only.
- **EC-30** — Duplicate of EC-24.
- **AA-14** — Spec satisfied (PUT endpoint exists at the expected path).
- **AA-19** — Hardcoded DE/EN reminder strings: D8 carve-out, intentional.
- **AA-20** — Sprint-status workflow noise.
- **AA-22** — Cache-Control spec text vs code: code is correct (M-S5-3 round-2 fix), spec AC text just needs sync.

---

## Verdict

**Epic NOT approved on round 3.** Round-2 fix-pass successfully closed the prior Critical surface, but round-3 surfaced **4 new Critical findings** and **23 High findings** independent of the round-2 scope:

- **Privacy/security**: 2 cross-event IDORs (C2, C3) on the volunteer-role/assignment surface — same root cause as H-S3-2 (commands carrying `RoleId`/`ShiftId` without paired `EventId` enforcement); the round-2 H-S3-2 sweep missed `UpdateEventVolunteerRoleCommand` and `GetVolunteerShiftAssignmentsQuery`.
- **Data**: CSV formula injection (C1) — purely a hardening miss; OWASP standard prefix sanitization.
- **Operational**: One-way calendar-token migration (C4 / DN-1) — design decision deferred at round-2.

Beyond the Critical set, the High block is dominated by:
- 2 missing test files (H-S5-7, H-S5-8) for the public calendar surface explicitly required by AC-10.
- 1 missing test file (H-S4-3) for `volunteers/page.tsx` explicitly required by AC-9.
- 2 N+1 query patterns (H-S3-5, H-S3-6) on volunteer-list pages — visible UX degradation under load.
- Calendar/ICS correctness: DTEND inclusive (H-S5-6), infinite-loop on malformed UTF-8 (H-S5-4), rotate-token race (H-S5-5).
- Member-feed filter contract surprise (H-S5-1 / DN-2).

**Next steps:** Decisions DN-1..DN-6 must be resolved by Harry before patch work can begin. Then route the 4 Critical + 23 High findings back to `bmad-dev-story` per story, do round-4 review.

---

**Report generated by `bmad-code-review` round 3.** Subagent run IDs preserved in conversation for forensic re-inspection.
