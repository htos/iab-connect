# Epic 3 Code Review — 2026-05-13

**Scope:** Boundary review of all 5 stories (E3.S1 – E3.S5) per the project's hybrid workflow.

**Review layers (12 agents):** Blind Hunter (adversarial, diff-only), Edge Case Hunter (diff + project read), Acceptance Auditor (diff + spec) — one set per story.

**Per-story diff sizes:**
- E3.S1 — 1764 lines
- E3.S2 — 1966 lines
- E3.S3 — 3494 lines
- E3.S4 — 1484 lines
- E3.S5 — 1241 lines

**Headline:** Epic NOT approved. **3 Critical**, **23 High**, **36 Medium** findings across the five stories. Two Critical findings cluster in S3 (volunteer-assignment authorization bypass) and S4 (silent reminder permanent-skip + UTC-time-labeled-as-local).

---

## Executive summary by story

| Story | Critical | High | Medium | Decision-needed | Defer | Dismiss | Verdict |
|---|---|---|---|---|---|---|---|
| **S1 — Roster + CSV** | 0 | 4 | 4 | 2 | 12 | 6 | back-to-dev |
| **S2 — QR/Manual Check-in** | 0 | 5 | 7 | 1 | 8 | 4 | back-to-dev |
| **S3 — Volunteer Domain + API** | 1 | 6 | 11 | 1 | 12 | 8 | back-to-dev |
| **S4 — Volunteer UI + Reminders** | 2 | 6 | 8 | 1 | 8 | 2 | back-to-dev |
| **S5 — Calendar Feed + ICS** | 0 | 2 | 6 | 0 | 6 | 4 | back-to-dev |
| **TOTAL** | **3** | **23** | **36** | **5** | **46** | **24** | — |

---

## Decision-needed items (5) — resolve before patching

These cannot be patched without your input.

### D-S1-1 — QR token in roster DTO and CSV export
- **Severity:** High
- **Sources:** S1/Blind-F7
- **Location:** [EventCheckInRosterDto.cs:24](backend/src/IabConnect.Application/Events/CheckIn/EventCheckInRosterDto.cs), [EventCheckInRosterCsvExporter.cs:18](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs)
- **Tension:** Spec AC-3 + D4 explicitly include `QrCodeToken` in the privacy-bounded DTO and require column 9 in the CSV. But the QR token IS the credential that triggers a state-changing check-in (via the QR endpoint). Anyone with the printed CSV can check in any attendee (or out). Privacy story claims roster avoids leak vectors.
- **Options:** (a) keep as spec'd (accept print-roster-as-credential), (b) redact token in CSV but keep in roster (UI staff sees, paper doesn't), (c) remove from both (forces QR-only via scanner).

### D-S1-2 — `TotalRegistrations` post-filter is misleading
- **Severity:** Medium
- **Sources:** S1/Blind-F6 + Edge-E12
- **Location:** [GetEventCheckInRosterQueryHandler.cs:54-57](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs)
- **Tension:** Spec AC-3 names the field `TotalRegistrations`. Implementation computes it from the post-filter list, so when `includeWaitlisted=false`, total drops Pending+Cancelled+Waitlisted. Reviewer reads "23 / 100 checked in" as overall, but it's actually "23 of 47 confirmed".
- **Options:** (a) rename to `RosterRowCount` (breaking DTO change), (b) compute pre-filter from the unfiltered list (semantic change), (c) accept the post-filter semantics + document.

### D-S2-1 — Cross-event QR check-in scope
- **Severity:** High
- **Sources:** S2/Blind-F5 + Edge-E3 + Edge-E18
- **Location:** [EventRegistrationCheckInService.cs:540-570](backend/src/IabConnect.Infrastructure/Events/EventRegistrationCheckInService.cs), command at [CheckInRegistrationCommand.cs:21-25](backend/src/IabConnect.Application/Events/CheckIn/CheckInRegistrationCommand.cs)
- **Tension:** QR endpoint route `/registrations/check-in/{token}` carries no eventId. Service discards `request.EventId` on QR path ("token uniquely identifies"). Staff at Event B scanning a QR for Event A succeeds silently — audit row lands under Event A. Is `RequireEventStaff` meant to be global or per-event?
- **Options:** (a) keep global (token IS authority — accept and document), (b) add per-event scope check (handler rejects if `registration.EventId != caller's currentEventId`), (c) move event check into URL path.

### D-S3-1 — Reminder data model bled into S3 (D6 violated + possible migration drift)
- **Severity:** Medium (high if migration drift is real)
- **Sources:** S3/Auditor D6 VIOLATED, Blind-F11
- **Location:** [EventVolunteerAssignment.cs](backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerAssignment.cs) (`ReminderSentAt` property + `MarkReminderSent` method), [IEventVolunteerAssignmentRepository.cs](backend/src/IabConnect.Domain/Events/Volunteers/IEventVolunteerAssignmentRepository.cs) (`MarkReminderSentAsync`, `GetRemindersDueAsync`, `VolunteerReminderDueRow`), [EventVolunteerAssignmentConfiguration.cs:2242](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerAssignmentConfiguration.cs)
- **Tension:** Spec D6 says "Reminders deferred to E3.S4." But the data-model fields + methods landed in S3. The S3 migration `20260513182110_AddEventVolunteerPlanning` does NOT include `reminder_sent_at`; the S4 migration `20260513182419_AddReminderSentAtToEventVolunteerAssignments` does. Auditor flagged that the EF configuration maps the column even though the S3 migration doesn't create it — likely fine (S4 migration adds it later), but worth verifying that the S3 ModelSnapshot doesn't already declare the column out-of-order.
- **Options:** (a) accept the bleed-through (model+method on entity, but S4 owns the migration); (b) revert the property/method on entity until S4 lands (more disruptive at this point); (c) verify ModelSnapshot ordering and proceed if clean.

### D-S4-1 — AC-2 spec drift on shift form (react-hook-form + zod + Radix Dialog)
- **Severity:** Medium (large spec drift)
- **Sources:** S4/Auditor AC-2 PARTIAL
- **Location:** [frontend/src/app/(dashboard)/events/[id]/volunteers/page.tsx:1147-1252](frontend/src/app/(dashboard)/events/[id]/volunteers/page.tsx)
- **Tension:** Spec mandates "MUST use `react-hook-form` + `zod`" + "Radix `Dialog`-based `ShiftFormDialog`". Implementation uses plain `useState` + inline form + `confirm()`. Description max-length 1000 chars not spec'd 500. No inline server-validation surfacing.
- **Options:** (a) refactor to react-hook-form + zod + Radix Dialog now (significant work); (b) accept the simpler form, update spec to match implementation; (c) defer the refactor to a follow-up story.

---

## Critical findings (3) — must fix before close

### C1 — Volunteer assignment cancel has no caller-ownership check (S3)
- **Severity:** Critical (authorization bypass)
- **Sources:** S3/Blind-F14, Edge-E23, Auditor AC-7 PARTIAL — three independent reviewers found this
- **Location:** [EventVolunteerEndpoints.cs:312-329](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs)
- **Issue:** `POST /api/v1/events/{e}/volunteer-shifts/{s}/assignments/{a}/cancel` is gated by `RequireMember` only. The handler does NOT verify that the caller's `MemberId` matches `assignment.MemberId` (or that the caller has staff role). Any authenticated member can cancel ANY other member's volunteer assignment by GUID-guessing.
- **Fix:** In `CancelVolunteerAssignmentCommandHandler`, resolve caller's Member via `IAuthorizationService.GetCurrentUserId` → `IMemberRepository.GetByKeycloakUserIdAsync` → assert `caller.Id == assignment.MemberId` OR `caller.IsInRole("admin","vorstand","event-manager")`. Emit `SecurityAuditLogger.LogAccessDenied` on mismatch + return 403.

### C2 — Reminder SMTP errors silently swallowed, then marked sent (S4)
- **Severity:** Critical (silent feature failure)
- **Sources:** S4/Edge-E1 + Blind-F3 (related)
- **Location:** [EventNotificationService.cs:195-199](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs), [VolunteerShiftReminderService.cs:118-122](backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs)
- **Issue:** `_emailSender.SendAsync` throws → caught by `SendEmailAsync` → logged → swallowed → returns success. Then `MarkReminderSentAsync` sets `ReminderSentAt` → next run skips this row forever. SMTP outage = zero reminders ever, no operator signal beyond log line.
- **Fix:** Propagate SMTP exception from `SendVolunteerShiftReminderAsync` (or return a result type). Only mark `ReminderSentAt` if send succeeded. Combine with E7 fix (skip null-email rows with WarnLog, also without marking).

### C3 — Reminder email shows UTC time labeled as local (S4)
- **Severity:** Critical (data correctness)
- **Sources:** S4/Edge-E3 + Blind-F4
- **Location:** [EventNotificationService.cs:186-187, 223-224](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs)
- **Issue:** `shift.StartsAt.ToString("dd.MM.yyyy HH:mm", de-CH)` formats raw UTC value as if local. `de-CH` culture only affects punctuation, not timezone. Variable is misleadingly named `startsLocal`. Email "Beginn: 08:00" for a 10:00 CET shift. Volunteers arrive 1-2 hours early.
- **Fix:** Convert UTC to Europe/Zurich via `TimeZoneInfo.ConvertTimeFromUtc(shift.StartsAt, ZurichTz)` before formatting. Ensure all 4 occurrences (HTML DE+EN, plain-text DE+EN) use the converted value.

---

## High findings (23) — should fix before close

### S1 (4)
- **H-S1-1** — IsIncluded conflates `Status==Waitlisted` with `IsWaitlisted` flag — checked-in waitlister filtered from check-in roster. *Fix: use Status only.* (Blind-F8, Edge-E11)
- **H-S1-2** — `ToUniversalTime()` on `Kind=Unspecified` value silently shifts CSV `CheckedInAt` by local offset. *Fix: assert Kind=Utc on read OR use SpecifyKind appropriately.* (Edge-E3)
- **H-S1-3** — Archive-expired 404 returns generic "Event not found" instead of spec-required "Event archive lookup expired". *Fix: handler signals expired vs not-found; endpoint emits correct message.* (Auditor AC-7, Edge-E14)
- **H-S1-4** — see [D-S1-1](#d-s1-1--qr-token-in-roster-dto-and-csv-export) decision

### S2 (5)
- **H-S2-1** — `QrCodeToken` returned in every check-in response DTO; credential leak to client/dev-tools/logs. *Fix: remove from `EventRegistrationDto` mapping on check-in path, or use a separate response DTO.* (Blind-F7)
- **H-S2-2** — see [D-S2-1](#d-s2-1--cross-event-qr-check-in-scope) decision (Blind-F5, Edge-E3, Edge-E18)
- **H-S2-3** — QR token in URL path not URL-encoded; tokens containing `/` or `?` corrupt routing. *Fix: `encodeURIComponent(rawValue)` in [events.ts:516](frontend/src/lib/services/events.ts).* (Edge-E1)
- **H-S2-4** — `CheckIn` accepts `Pending` and `NoShow` status, neither visible in roster. *Fix: throw `InvalidOperationException` for both — roster discipline.* (Edge-E2)
- **H-S2-5** — `CancelRegistration` endpoint has no `FOR UPDATE` row lock; concurrent cancel during check-in can overwrite status. *Fix: add `FOR UPDATE` to the cancel path mirroring check-in service.* (Edge-E12)

### S3 (6)
- **H-S3-1** — `AddAtomicAsync` calls `CommitAsync` on aborted Postgres transaction after catching 23505 → second exception. *Fix: don't commit after caught unique-violation; rollback and return existing row.* (Blind-F4)
- **H-S3-2** — Cross-event tampering: `UpdateShift` / `CancelShift` / `CancelAssignment` endpoints don't verify `shift.EventId == route eventId`. Staff for Event A can mutate Event B's shifts. *Fix: assert `shift.EventId == eventId` in handler/service before mutating.* (Blind-F6)
- **H-S3-3** — `AssignAsync` count/idempotency queries run outside the FOR UPDATE lock scope (works today only via Npgsql connection affinity). *Fix: explicit `_context.Database.UseTransaction(tx)` or enlist count queries in the open transaction.* (Edge-E2)
- **H-S3-4** — `IncreaseCapacity(int, int)` allows capacity DECREASE down to current confirmed count, despite the name. *Fix: rename to `UpdateCapacity` OR split into `Increase`/`Decrease` with explicit semantics.* (Edge-E7, Blind-F10)
- **H-S3-5** — `UpdateShift` capacity change has no FOR UPDATE lock; concurrent self-signup can break invariant. *Fix: lock shift row before capacity validation in `UpdateEventVolunteerShiftCommandHandler`.* (Edge-E8)
- **H-S3-6** — `CancelEventVolunteerShiftCommand` cancels existing assignments but doesn't mark the shift as cancelled. New self-signups still succeed. *Fix: add `Status` / `IsCancelled` field on `EventVolunteerShift` or set `Capacity=0`; reject signups in service.* (Edge-E13)

### S4 (6)
- **H-S4-1** — Send/Mark not transactional; Hangfire retry can resend. *Fix: outbox pattern OR only mark on confirmed delivery.* (Blind-F3)
- **H-S4-2** — Subject line `$"Erinnerung / Reminder — {evt.Title}"` is not sanitized → email header injection vector (CR/LF in title). *Fix: strip `\r\n` from `evt.Title` before SendEmailAsync OR enforce at Event creation/update validation.* (Blind-F6)
- **H-S4-3** — `datetime-local` input on edit feeds UTC ISO via `.slice(0,16)` (strips Z) → input renders as if local; save uses `new Date(...).toISOString()` re-interpreting as local → drift per edit. *Fix: convert UTC → Europe/Zurich for display, local → UTC on save.* (Blind-F8)
- **H-S4-4** — Reminder window `[now, now+24h]` combined with cron `0 9 * * *` misses shifts starting after 09:00 the next day. *Fix: extend window to 36h, or run cron at 08:00 + window 24h, or align both to shift's wall-clock day.* (Edge-E2)
- **H-S4-5** — `GetRemindersDueAsync` filters `e.Status != Cancelled` but not the shift's own cancellation. *Fix: add `s.Status != Cancelled` (depends on H-S3-6 — shift needs a cancellation flag).* (Edge-E4)
- **H-S4-6** — `Member.Email` null/empty: SmtpClient throws → swallowed → `MarkReminderSentAsync` sets row to "sent forever". *Fix: skip null-email rows with `LogWarning`, do NOT mark sent.* (Edge-E7)

### S5 (2)
- **H-S5-1** — Member calendar token lookup is non-constant-time DB equality + token stored cleartext → timing-prefix enumeration oracle + DB-read discloses every active feed. *Fix: store SHA-256 hash, look up by hash, optionally constant-time compare; rotate compromises tokens.* (Blind-F1)
- **H-S5-2** — `FormatUtc` uses `DateTime.SpecifyKind(value, DateTimeKind.Utc)` which RELABELS rather than CONVERTS. If `Event.StartDate/EndDate/UpdatedAt` has `Kind=Unspecified`, the ICS emits wrong ZULU time. *Fix: use `.ToUniversalTime()` AND assert `Event` domain enforces `Kind=Utc` at construction.* (Blind-F3, Edge-E7)

---

## Medium findings (36) — fix or defer per cost/benefit

Listed concisely; full evidence in each story's per-reviewer agent output.

### S1 (4)
- **M-S1-1** — Platform-dependent `Path.GetInvalidFileNameChars()` + no length cap + Unicode RLO/ZWSP not stripped → filename spoof + Windows-illegal cross-platform mismatch. (Blind-F1, Edge-E7, Edge-E8)
- **M-S1-2** — CSV `QuoteIfNeeded` doesn't quote leading/trailing whitespace or tab; Excel strips spaces on import. (Edge-E4)
- **M-S1-3** — Null `ParticipantName`/`QrCodeToken` would NRE the CSV exporter (DTO `required` doesn't enforce non-null). (Edge-E6)
- **M-S1-4** — Integration test calls `AddAsync` without `SaveChangesAsync` → doesn't actually prove DB round-trip. (Blind-F12)

### S2 (7)
- **M-S2-1** — Idempotent `CheckIn` returns the CURRENT caller's id as `CheckedInBy` when legacy `CheckedInBy` is null. (Blind-F1, Edge-E9)
- **M-S2-2** — Tautological test assertion in `EventRegistrationConcurrentCheckInTests.cs:1283-1287` — `X.Should().Be(X)`. (Blind-F2)
- **M-S2-3** — QR scanner re-decodes same token after success/failure → repeated network calls / banner overwrite. (Blind-F3, Edge-E5, Edge-E15)
- **M-S2-4** — Network errors in `handleQrDecode` / `handleManualCheckIn` swallowed silently → no banner. (Blind-F4, Edge-E6, Edge-E7)
- **M-S2-5** — Scanner `onError` permanently disables camera tab on transient errors. (Edge-E11)
- **M-S2-6** — AC-4 PARTIAL: audit moved from handler to endpoint (documented deviation, observable behavior preserved — accept). (Auditor)
- **M-S2-7** — AC-8 PARTIAL: Vitest doesn't directly assert idempotent banner / invalid-QR banner state. (Auditor)

### S3 (11)
- **M-S3-1** — `CreateEventVolunteerRoleCommand` race on unique index: pre-check non-atomic with insert → loser bubbles 500. *Fix: catch 23505 + return 409.* (Blind-F7)
- **M-S3-2** — `AssignVolunteer` with non-existent `MemberId` hits FK 23503 → unhandled 500. *Fix: catch FK violation OR pre-validate.* (Blind-F12, Edge-E9)
- **M-S3-3** — Partial-index filter string `'Cancelled'` couples to enum.ToString() — silent break if enum renamed. (Blind-F15)
- **M-S3-4** — `CancelAssignmentAsync` uses `FirstAsync` on race-disappeared row → uncaught exception. *Fix: `FirstOrDefaultAsync` + return AssignmentNotFound.* (Edge-E3)
- **M-S3-5** — `MapAssignmentResult` Location header uses `RoleId` segment where `EventId` belongs → header navigates to 404. (Blind-F1, Edge-E11)
- **M-S3-6** — `GetVolunteerShiftAssignmentsQuery` returns Cancelled rows to member-roster callers → PII leak. *Fix: filter Status≠Cancelled in repo query.* (Edge-E15)
- **M-S3-7** — `UpdateRole` rename collision asymmetric vs Create (500 vs 409). *Fix: catch DbUpdateException in update handler.* (Edge-E18)
- **M-S3-8** — `CreateShift` on a Deactivated role is accepted. *Fix: guard `role.IsActive` in handler.* (Edge-E19)
- **M-S3-9** — `Shift.StartsAt` in the past is accepted; self-signup against past shifts succeeds. *Fix: domain guard or validator.* (Edge-E26)
- **M-S3-10** — Whitespace-only `Name` passes FluentValidation `NotEmpty()`, then domain `ArgumentException` → 500. *Fix: validator `.MaximumLength` + `.Must(name => !string.IsNullOrWhiteSpace(name))`.* (Edge-E28)
- **M-S3-11** — N+1 in `GetEventVolunteerShiftsQueryHandler` (CountConfirmed + CountWaitlisted per shift) + no pagination. *Fix: project counts in a single SQL OR add page params.* (Edge-E14)

### S4 (8)
- **M-S4-1** — `MarkReminderSentAsync == false` silently swallows successful send; possible duplicate-send hint suppressed. *Fix: log warning on false-return.* (Blind-F2)
- **M-S4-2** — `VolunteerSelfSignupSection` swallows non-`data` responses → section disappears silently on 5xx. *Fix: error state.* (Blind-F10)
- **M-S4-3** — AC-3: post-signup card doesn't switch to green "Eingetragen + Austragen" pill. *Fix: per-card state tracking.* (Auditor)
- **M-S4-4** — Migration backfill: existing assignments get `ReminderSentAt = NULL` → retroactive bulk emails on first daily run. *Fix: backfill `now()` for shifts already in window in migration `Up()`.* (Edge-E5)
- **M-S4-5** — `TimeZoneInfo.FindSystemTimeZoneById("Europe/Zurich")` at boot crashes on Windows-without-ICU. *Fix: try/catch fallback to UTC + log.* (Edge-E6)
- **M-S4-6** — Frontend `toLocaleString('de-CH')` uses BROWSER timezone, email uses UTC → time mismatch between UI and email. *Fix: lock `toLocaleString` to `{ timeZone: 'Europe/Zurich' }`.* (Edge-E16)
- **M-S4-7** — `confirm()` on cancel-shift doesn't warn about N volunteer assignments that will be cancelled. *Fix: custom modal showing assignment count.* (Edge-E14)
- **M-S4-8** — `parseInt(... || '1', 10)` allows NaN passthrough on non-numeric input → JSON serialized as null → backend 400. *Fix: `Number.isFinite(parsed) ? parsed : 1`.* (Blind-F9)

### S5 (6)
- **M-S5-1** — Single-event MembersOnly endpoint accepts ANY valid token (no per-event membership check). *Decision-needed if intent is "any member can fetch"; if not, add check.* (Blind-F4)
- **M-S5-2** — Public feed has no upper/lower bound on event date → unbounded ICS body / OOM. *Fix: mirror member-feed window (e.g., −90d → +24mo) + page-size cap.* (Blind-F5)
- **M-S5-3** — `Cache-Control: public, max-age=600` on TOKEN-BEARING `/my-calendar.ics` → CDN/proxy caches per-user ICS. *Fix: `private` for member feed; keep `public` only for `/calendar.ics`.* (Blind-F6, Edge-E18)
- **M-S5-4** — Token returned in `subscriptionUrl` query-string → ends up in browser history / Referer / server logs. *Fix: header-based delivery OR accept query trade-off + add audit-log redaction.* (Blind-F7)
- **M-S5-5** — Member feed window filter uses `StartDate ≥ now-90d` instead of `EndDate ≥ now-90d` — multi-day events that started >90d ago but are still running disappear. *Fix: filter by EndDate.* (Edge-E3)
- **M-S5-6** — `ResolveBaseUrl` fallback hard-codes `https://localhost` → embedded ICS URLs point to localhost in subscribers' calendars on misconfig. *Fix: fail-loud on missing `App:PublicBaseUrl`.* (Edge-E10)

---

## Deferred items (46)

See [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) — new section "Deferred from: epic-3 code review (2026-05-13)" appended with each entry.

---

## Cross-cutting themes

1. **FOR UPDATE row-lock coverage is partial.** Check-in and AssignAsync use it; CancelRegistration, UpdateShift, and rotate-token do not. Project convention should be enforced consistently — a project-wide audit of "shared mutable state mutating endpoints" would close the family.

2. **DateTime.Kind enforcement is missing at domain boundary.** S1 CSV, S5 ICS, and S4 reminder emails all assume `Kind=Utc` on Event/Registration entities, but the domain doesn't enforce it on construction. A single guard in the Event/EventRegistration constructors + Member constructor (and validator) closes 3 separate findings (H-S1-2, H-S5-2, H-S4 conversion).

3. **Audit-log discipline is correct on success, missing on failure.** Multiple endpoints log access-granted on success but no access-denied / suspicious-activity on lookup failures (S2 Conflict/NotFound, S5 unknown-token). Mostly Low-severity but the pattern should be documented.

4. **Out-of-scope code leakage between stories.** S1 diff included S2 check-in commands (`MapCheckInResult`, `CheckInByQrCode`); S3 diff included S4 reminder data model; S5 diff included S4 DI registration. The reviewers correctly identified these but the chunked-review approach absorbed the noise. Future Epic boundary reviews should plan for shared-file overlap upfront.

5. **Test trade-offs:** Three stories (S1, S2, S5) deferred runtime endpoint auth tests citing the same Serilog bootstrap-logger collision pattern. A shared `ICollectionFixture<TestWebApplicationFactory>` would unblock all three. **Recommend:** make this a top-priority follow-up in epic-3-retrospective + epic-4 prerequisites.

---

## Recommended routing per workflow customization

`workflow.on_complete` says: "FINDINGS need fixes → route specific findings back to bmad-dev-story for the affected stories, then return to bmad-code-review."

**Routing:**
- All 5 stories revert from `review` to `in-progress`.
- Each story-specific Critical / High / Medium patch should be addressed via `bmad-dev-story` with the story key.
- Decision-needed items D-S1-1, D-S1-2, D-S2-1, D-S3-1, D-S4-1 require human decisions BEFORE dev-story can patch.
- After patches land, re-run `bmad-code-review` on the working tree to verify.

---

## Appendix: per-reviewer agent output locations

Raw reviewer findings (full evidence + line refs) are in temp transcripts at `C:\Users\Harry\AppData\Local\Temp\claude\b--Projects-IAB-Connect-iab-connect\3eac3920-0fae-4bef-b06f-d59eb1569a4e\tasks\*.output`. Diffs reviewed are at `.claude/review-tmp/e3-s{1..5}.diff` (will be cleaned up at workflow end).
