# Epic 3 Code Review — Round 4 — 2026-05-14

**Scope:** Boundary re-review of all 5 stories (E3.S1 – E3.S5) after the Round-3 fix-pass.

**Predecessor:** [epic-3-review-2026-05-13-round3.md](epic-3-review-2026-05-13-round3.md) — Round 3 surfaced 4 Critical + 23 High + 21 Medium + 3 Low + 6 Decisions; the Round-3 fix-pass (commit `8f70332`) cleared 4 Critical + 17 High + 18 Medium + 6 Decisions, with the rest carried to deferred-work tracks.

**Diff under review:** `git diff 1466c35..HEAD` — 148 files / +56,254 / −11,022. Of those, 10 files (~41k lines) are auto-generated EF Designer / `ApplicationDbContextModelSnapshot.cs` / `package-lock.json` / `messages/{de,en}.json` — reviewed at metadata level only. Review-meaningful surface: **129 files, +12,601 / −799 lines (~14,571 diff lines)**, reviewed in one pass (no chunking).

**Review layers (3 parallel agents, same model capability):**
- **Blind Hunter** — adversarial, diff-only, no project access. Returned 13 findings.
- **Edge Case Hunter** — diff + project read access; walked every branching path and concurrency interleaving. Returned 3 findings.
- **Acceptance Auditor** — diff + 5 story specs + project context. Returned 20 findings (2 were "verified clean", not findings).

**Headline:** Epic **NOT approved** on round 4. After dedup/triage: **0 Critical**, **5 High**, **5 Medium**, **3 Low**, **3 Decisions (all resolved → patches)**, **14 Defer**, **6 Dismiss**. The Round-3 Critical set (CSV formula-injection, cross-event IDORs, calendar-token hashing, irreversible-migration documentation) is **confirmed resolved** in the current diff. The remaining High findings are independent issues the Round-3 patch sweep did not touch — a missed UTC-guard on the new `EventVolunteerShift` aggregate, two list-query handlers that skip event existence/visibility checks, an unhandled 500 on `Pending`/`NoShow` check-in, and required test files that were never authored. No new Critical issues.

**Decision resolutions (2026-05-14, Harry):** R4-DN-S4-1 → option (a) `[DisableConcurrentExecution]`; R4-DN-S5-1 → option (a) `EndDate`-bound in SQL; R4-DN-S5-2 → option (a) page-loop. All three converted to patches (R4-P-S4-4, R4-P-S5-1, R4-P-S5-2). **Total actionable patches: 15.**

---

## Executive summary by story

| Story | Patch | Decision | Defer | Dismiss | Verdict |
|---|---:|---:|---:|---:|---|
| **S1 — Roster + CSV** | 0 | 0 | 1 | 1 | clean (spec drift only) |
| **S2 — QR/Manual Check-in** | 1 | 0 | 2 | 1 | back-to-dev |
| **S3 — Volunteer Domain + API** | 8 | 0 | 3 | 1 | back-to-dev |
| **S4 — Volunteer UI + Reminders** | 4 | 0 (1 resolved) | 3 | 1 | back-to-dev |
| **S5 — Calendar Feed + ICS** | 2 | 0 (2 resolved) | 5 | 2 | back-to-dev |
| **TOTAL** | **15** | **0 open (3 resolved)** | **14** | **6** | — |

Severity of the 15 Patch findings: 5 High, 7 Medium, 3 Low.

---

## Decision-needed items (3) — RESOLVED 2026-05-14

All three were resolved by Harry and converted to patches.

### R4-DN-S4-1 — Concurrent reminder-job runs can duplicate-send → **option (a)**
- **Story:** E3.S4 — **Resolution:** add `[DisableConcurrentExecution]` to `VolunteerShiftReminderJob` so a Hangfire retry overlapping the daily trigger cannot run a second pass concurrently. Optionally also fix the telemetry under-count. → patch **R4-P-S4-4**.

### R4-DN-S5-1 — Public ICS feed materializes the entire public-event table unbounded → **option (a)**
- **Story:** E3.S5 — **Resolution:** add an `EndDate`-bounded overload to `GetPublicEventsAsync` and push the `now-90d … now+2y` window into SQL — resolves both the unauthenticated-DoS surface and the AC-1 "consume unmodified" contract. → patch **R4-P-S5-1**.

### R4-DN-S5-2 — Member calendar feed silently truncates at 500 events → **option (a)**
- **Story:** E3.S5 — **Resolution:** replace the single page-1 fetch in `GetMemberCalendarFeedQuery` with a page-loop until a short page returns; bounded in practice by the `EndDate` window from R4-P-S5-1. → patch **R4-P-S5-2**.

---

## Patch findings (15)

See each story file's `## Round 4 Review Findings (2026-05-14)` section for full evidence and suggested fixes.

| ID | Sev | Story | Title |
|---|---|---|---|
| R4-P-S2-1 | High | S2 | `Pending`/`NoShow` check-in surfaces as unhandled 500, not typed 409 (violates AC-3/AC-5) |
| R4-P-S3-1 | High | S3 | `EventVolunteerShift.Create`/`UpdateDetails` bypass `DateTimeUtcGuard.EnsureUtc` — reminder wall-clock times shift |
| R4-P-S3-2 | High | S3 | `GetEventVolunteerRolesQuery`/`GetEventVolunteerShiftsQuery` skip event existence/visibility — enumerate Hidden/InviteOnly events |
| R4-P-S3-3 | High | S3 | Missing 3 AC-10 command-handler test files (incl. the 8-row capacity/waitlist theory) |
| R4-P-S3-4 | Med | S3 | Missing `CreateEventVolunteerShiftCommandHandlerTests` (AC-10) |
| R4-P-S3-5 | Med | S3 | `CancelAssignmentAsync` C1 ownership guard fails open when `callerMemberId` is null and caller not staff |
| R4-P-S3-6 | Low | S3 | `CancelAssignmentAsync` auth checks run pre-lock, not re-verified on the locked entity (TOCTOU) |
| R4-P-S3-7 | Low | S3 | Bulk shift-cancel `ExecuteUpdate` leaves stale `Position` on cancelled rows |
| R4-P-S3-8 | Low | S3 | FK-violation (23503) escapes `AddAtomicAsync` without savepoint rollback |
| R4-P-S4-1 | High | S4 | Shift form uses plain `useState`, not `react-hook-form` + `zod` (violates AC-2) |
| R4-P-S4-2 | Med | S4 | Shift form is an inline `<section>`, not a `@radix-ui/react-dialog` (violates AC-2/AC-8) |
| R4-P-S4-3 | Med | S4 | Missing `VolunteerAssignmentReminderQueryTests` + `VolunteerShiftReminderJobRegistrationTests` (AC-9) |
| R4-P-S4-4 | Med | S4 | Concurrent reminder-job duplicate-send → `[DisableConcurrentExecution]` (from R4-DN-S4-1) |
| R4-P-S5-1 | Med | S5 | Public ICS feed unbounded load → `EndDate`-bound in SQL (from R4-DN-S5-1) |
| R4-P-S5-2 | Med | S5 | Member feed 500-event truncation → page-loop (from R4-DN-S5-2) |

---

## Deferred (14)

All 14 logged to [deferred-work.md](deferred-work.md) under "Deferred from: code review of Epic-3 boundary Round 4". Breakdown: **9 spec-text reconciliation** items (code is intentionally correct per a documented Round-2/3 decision, only the AC text was never updated — R4-Defer-S1-1, S3-1, S3-2, S3-3, S4-1, S4-2, S5-3, S5-4, plus the test-naming drift), **2 already-deferred test-coverage items re-surfaced** (R4-Defer-S4-3 `frontend-test-coverage-volunteers-page`; R4-Defer-S5-5 `calendar-feed-api-tests`), and **3 pre-existing/low-risk items** (QR check-in event scoping, manual-check-in `searchQueryHash` on empty query, `ResolveBaseUrl` per-request 500, `HashCalendarSubscriptionTokens` 64-char guard).

> **Note on R4-Defer-S5-5:** the public-feed visibility filter (AC-1, the core privacy guarantee) currently has **zero automated coverage**. Recommend raising the priority of the `calendar-feed-api-tests` follow-up.

---

## Dismissed (6) — not carried forward

- **All-day `DTEND` can precede `DTSTART`** (BH) — the `Event` aggregate enforces `EndDate >= StartDate` at write-time; the feed consumes an already-valid invariant.
- **`HashCalendarSubscriptionTokens` empty `Down()`** (BH) — already a documented Round-3 R3-DN-1 decision (option c, backup-only rollback).
- **All-day `DTEND` emits `EndDate + 1`** (AA) — RFC 5545 §3.6.1 exclusive-end is correct; documented Round-3 R3-H-S5-6. False positive vs AC-4 literal.
- **`Domain.Tests` location for `EventRegistrationTests`** (AA) — spec is self-contradictory; code follows a valid path the spec also lists.
- **Member-feed token resolution admits `Pending`** (AA) — the documented Round-3 R3-DN-2 decision (option a, broaden to Active OR Pending).
- **`DELETE /volunteer-roles` in AC-7 absent** (AA) — AC-7 is internally contradicted by AC-5 and AC-1; code correctly follows AC-5 (deactivate, never delete). Already R3-Defer-6.

---

## Verdict

**Epic 3 Round-4 review NOT approved at review time** (0 Critical, but 5 High + 5 Medium + 3 Low patches + 3 decisions). **Fix-pass applied same-day (2026-05-14):** all 3 decisions resolved (each → option (a)) and all 15 resulting patches implemented in one pass.

### Round-4 fix-pass outcome (2026-05-14)

- **All 15 patches applied** — S2 (1), S3 (8), S4 (4), S5 (2). Backend: solution builds with 0 warnings / 0 errors; **1810 / 1810** tests green (1392 Application + 51 Api + 367 Infrastructure, incl. the 6 new test files: 4 volunteer command-handler tests, `VolunteerAssignmentReminderQueryTests`, `VolunteerShiftReminderJobRegistrationTests`). Frontend: `typecheck` clean, **38 / 38** Vitest tests green, `lint` clean for changed files (2 pre-existing lint errors remain in untouched `members/segments` + `admin/backups` pages — out of scope).
- **All 5 stories flipped `review → done`** in sprint-status.yaml; each story file's Status line updated and R4 patch items checked off.
- **14 Defer items** logged to [deferred-work.md](deferred-work.md) — untouched, carried to follow-up tracks.
- Notable scope: S4's shift form refactored to `react-hook-form` + `zod` inside a Radix dialog; S5 added an `EndDate`-bounded `GetPublicEventsAsync(from, to)` repository overload; S2 added `Pending`/`NoShow` to the typed `ConflictReason` surface; S3 normalised `EventVolunteerShift` times through `DateTimeUtcGuard` and closed two list-query enumeration gaps.

**Recommended next step:** `bmad-retrospective` for Epic 3, then epic close (flip `epic-3 → done`).
