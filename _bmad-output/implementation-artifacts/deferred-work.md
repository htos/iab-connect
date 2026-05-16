# Deferred Work

Items deferred during code reviews — not caused by the reviewed change, but worth addressing in a dedicated pass.

---

## Epic-3-retro §9 Cleanup Sprint — Triage & Resolutions (2026-05-14)

The Epic-3 retrospective (`epic-3-retro-2026-05-14.md` §9) scheduled a dedicated cleanup sprint before Epic 4. This section records its outcome; the per-review sections below are left as the historical record.

### ✅ Resolved this sprint

| Item | Resolution | Commit |
|---|---|---|
| Shared `ICollectionFixture<TestWebApplicationFactory>` (A15) | Fixture already existed; the 3 deferred test classes (`EventCheckInRosterEndpointTests`, `MemberCreateDuplicateConflictTests`, `MemberDuplicateGroupsEndpointTests`) were migrated onto it — real runtime `→401` tests re-enabled in place of metadata-only stand-ins. | `1200958` |
| `DateTime.Kind` enforcement at domain construction (A13) | `Event` / `EventVolunteerShift` were already guarded (Round-4 fix-pass); `EventVolunteerAssignment.MarkReminderSent` now normalises via `DateTimeUtcGuard.EnsureUtc`. Checklist added to `docs/07_dos_donts.md`. | `1200958` |
| `calendar-feed-api-tests` — zero-coverage AC-1 privacy filter (R3-H-S5-7/8, R4-Defer-S5-5) | `GetPublicCalendarFeedQueryHandlerTests` (Application, +4) + `EventCalendarFeedEndpointTests` (API, +7) authored. The public-feed visibility guarantee now has automated coverage. | `38a2d83` |
| FOR UPDATE row-lock coverage audit | **calendar-token rotate/revoke** (R3-H-S5-5, `member-rotate-row-lock`): new `ICalendarTokenService` — rotate+revoke run under a FOR UPDATE lock on the member row. **CancelRegistration** (H-S2-5): new `IEventRegistrationCancellationService` — cancel + waitlist promotion run under FOR UPDATE locks on the event + registration rows. **UpdateShift TOCTOU**: audited — already closed in Round 3 (`UpdateShiftAsync` wraps capacity + field updates in one FOR UPDATE transaction). Both new services ship two-task Testcontainers race tests. | `22803c0` |
| Role-registry single source of truth (R3-Defer-5) | New `Roles` constants class (`IabConnect.Api.Authorization`); `DependencyInjection` policies, `EventVolunteerEndpoints.IsStaffCaller`, and the Event-family endpoint role checks all read from it. The `StaffRoles` hand-mirror is gone. | `421c616` |
| `calendar-token-hmac-rehash` (R3-H-S5-3) | `Member.HashCalendarToken` now takes an optional pepper — when configured, the stored value is `HMAC-SHA256(pepper, SHA256(token))`; when absent it stays plain SHA-256 (backwards-compatible). New `CalendarTokenOptions` (`Auth:CalendarTokenPepper`); `MemberRepository` + `CalendarTokenService` apply it. New `HmacPepperCalendarSubscriptionTokens` migration re-hashes existing digests forward via pgcrypto `hmac()` — **pepper-gated** (no-op when the `Auth__CalendarTokenPepper` env var is absent, so dev/CI/Testcontainers are unaffected). A parity test pins that the pgcrypto SQL equals the .NET hasher byte-for-byte. **Rollout: set `Auth__CalendarTokenPepper` in staging/prod before deploying this migration** (see `CalendarTokenOptions` XML doc + `appsettings.json` comment for the adopt-later caveat). | _this sprint_ |

### 📝 Spec-text-drift reconciled (Round-4 AC-drift items)

The Round-4 review flagged a batch of items where the shipped code intentionally diverged from the original AC text and the AC was never updated. **Disposition: the code is canonical.** Each item's full reconciliation rationale is already recorded in the relevant story file's `## Round 4 Review Findings` section (the `R4-Defer-*` entries). They are no longer tracked as open drift:

- **R4-Defer-S1-1** — roster query returns the `EventCheckInRosterLookup` envelope (Round-2 H-S1-3 fix), not `EventCheckInRosterDto?`.
- **R4-Defer-S3-1** — read endpoints use `RequireEventStaffOrMember` (Round-3 R3-DN-4 decision), not `RequireMember`.
- **R4-Defer-S3-2** — `IncreaseCapacity` → `UpdateCapacity(newCapacity, currentConfirmedCount)` (Round-3 H-S3-4 bidirectional-capacity fix).
- **R4-Defer-S3-3** — assignment constraint/FK cases live in `EventVolunteerAssignmentConcurrencyTests.cs`, not a separate `EventVolunteerAssignmentRepositoryTests.cs`.
- **R4-Defer-S4-1** — reminder window is 36h (Round-2 H-S4-4 fix; a 24h window misses next-evening shifts at the 09:00 cadence), not 24h.
- **R4-Defer-S4-2** — `SendVolunteerShiftReminderAsync` carries a `Member` parameter (avoids a duplicate fetch; documented in XML doc) not in the original AC-5 signature.
- **R4-Defer-S5-3** — `URL` ICS property emitted unescaped (Round-3 R3-L-S5-1 fix, RFC 5545 §3.3.13).
- **R4-Defer-S5-4** — `Member.CalendarSubscriptionToken` → `...Hash`, stores the SHA-256 digest (Round-2 H-S5-1 hardening).

### 🚀 Rollout note — `calendar-token-hmac-rehash` (shipped, pepper-gated)

The HMAC-pepper hardening shipped this sprint (see the Resolved table above) in a deliberately **non-breaking, pepper-gated** form — the original "needs a deployment decision" concern was resolved by making both the hasher and the migration fall back cleanly when no pepper is configured:

- **Dev / CI / Testcontainers** — no `Auth__CalendarTokenPepper` set → hasher uses plain SHA-256, migration is a no-op. Nothing changes, nothing breaks.
- **Staging / Production** — set `Auth__CalendarTokenPepper` (a strong random secret) **before** deploying the `HmacPepperCalendarSubscriptionTokens` migration. The migration then re-hashes existing stored digests forward; the app's hasher computes the matching HMAC at request time.
- **Adopt-later caveat** — the migration is one-shot (EF history). An environment that ran it without a pepper and later wants the hardening must have members re-rotate their calendar tokens (documented in `CalendarTokenOptions` and the `appsettings.json` comment).

### Remainder triage

The pre-Epic-3 items (Epic-1 / Epic-2 boundary sections) and the bulk of the Epic-3 Round-2/3/4 items below remain **open and unchanged** — they are genuinely low-severity / pre-existing / cosmetic and were correctly deferred. Notable still-open cross-cutting threads for future planning: the **server-side i18n / comms track** (Epic-3 planning + R3-Defer-S4 items — explicitly coordinated with Epic 5, not pulled forward), per-route **rate limiting** (Epic-1/Epic-2 — API-gateway concern), and the **`.gitattributes` CRLF/LF** chore. Inline role-string literals in the non-Event endpoint files (Audit / Document / Settings / CustomRole / Identity) were left as-is by the P3 role-registry refactor — converting them is mechanical and can fold into those files' next change; the `Roles` constants class is in place for it.

---

## Deferred from: Epic Boundary Review E1.S1–S4 (2026-05-13)

- **[E1.S2] Concurrent MFA resets send two re-enrollment emails** — admin-only action; race window is small and consequence is cosmetic (duplicate emails to target user)
- **[E1.S2] No rate limiting on `POST /users/{userId}/reset-mfa`** — broader API gateway concern; an admin could spam a user's inbox; address with a per-user-per-window throttle at API level
- **[E1.S2] Keycloak 200 with empty body for `/credentials` causes `JsonException`** — pre-existing; Keycloak spec guarantees a JSON array for this endpoint; add null-coalescing on deserialisation if Keycloak version ever changes
- **[E1.S3] Session ID case sensitivity** — Keycloak session IDs are lowercase UUIDs; `Guid.TryParse` accepts both cases; ownership string comparison could fail if Keycloak ever returns mixed-case IDs
- **[E1.S3/E1.S4] `window.confirm()` for revoke confirmation is not WCAG-compliant or stylable** — replace with a modal component in a UX polish sprint
- **[E1.S3/E1.S4] `initialFetchDone` ref prevents session list refetch after silent token renewal** — Refresh button provides manual workaround; revisit when next-auth silent refresh is implemented
- **[E1.S3] `SessionMapper.ToDto` maps null Id to `""` after P6 filters** — code smell; `SessionDto.Id` can be an empty string if the filter is ever removed; consider making Id nullable or using a sentinel value
- **[E1.S4] TOCTOU race on session ownership check** — Keycloak session UUIDs not guessable; race window negligible; document as known limitation
- **[E1.S4] Race: user deleted between `GetUserByIdAsync` and `GetUserSessionsAsync`** — acceptable race; audit records correct reason for each branch
- **[E1.S4] Double Keycloak API calls per revoke** — user-existence pre-check is redundant given subsequent session-ownership check; refactor in a Keycloak service cleanup sprint
- **[E1.S4] Non-UUID `sub` claim in token causes `ArgumentException` → 500** — requires compromised token passing signature verification; document as known non-GDPR risk
- **[E1.S4] Admin `RevokeUserSession` 404 for both user-not-found and session-not-found** — common REST pattern; frontend error message mismatch is cosmetic

## Deferred from: code review of Epic-2 boundary (e2-s1, e2-s2, e2-s3, e2-s4) (2026-05-13)

- **[E2.S1] Phone normalization for national-format / trunk-prefix variants** [`backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs:853-864`] — Story Decision Log explicitly fixed Option B (digits-only) for MVP; revisit when localised matching becomes a requirement.
- **[E2.S1] Street prefix `StartsWith` over-matches short tokens** [`backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs:940-948`] — matcher-tuning task; add min-length 4–5 or Levenshtein distance.
- **[E2.S2] `DuplicateMemberConflictResponse.ExistingMemberId` leaked to caller** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs:84,101`] — Vorstand-gated, intended UX for deep-link to existing record; revisit if endpoint authZ is loosened.
- **[E2.S2] 409 UI fallback renders empty-name placeholder candidate** [`frontend/src/app/members/new/page.tsx:15229-15247`] — backend Exact guard is the source of truth; fallback display is cosmetic.
- **[E2.S2] Vorstand-claimed POST integration test deferred** — handler-level `CreateMemberCommandHandlerDuplicateTests` proves backend rejection; Serilog test-host conflict blocks WebApplicationFactory path.
- **[E2.S2] PUT email update self-match normalization edge** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs:97-104`] — current `request.Email != member.Email` pre-check handles the common path.
- **[E2.S3] Asymmetric `(Guid?)` cast on `ExecuteUpdateAsync`** [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1851-1880`] — verify column nullabilities match each cast; mismatch throws at EF translation.
- **[E2.S3] Migration `Down` destroys merge linkage / dismissal rows** [`Migrations 20260513102726 + 20260513112857`] — forensics-destructive but EF default; address in ops runbook or archive-first.
- **[E2.S4] `FindDuplicateGroupsQueryHandler` O(n²) bucket validation** [`backend/src/IabConnect.Application/Members/Queries/FindDuplicateGroupsQueryHandler.cs:1108-1226`] — documented scaling limitation; revisit at scale or add a duplicates-cache layer.
- **[E2.S4] No per-route rate limit on duplicates / duplicate-groups / duplicate-dismissals endpoints** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs`] — broader API gateway concern.
- **[E2.S4] CRLF/LF inconsistency across 16+ files** — pre-existing repo policy; address with `.gitattributes text=auto eol=lf` in a chore commit.
- **[E2.S4] `KeyNotFoundException` for merged-into source maps to 404** [`DismissDuplicateCandidateCommandHandler.cs:502-512`] — semantically 410 Gone; cosmetic REST nit.
- **[E2.S4] Exact-bucket dismissal filter produces asymmetric inclusion** [`FindDuplicateGroupsQueryHandler.cs:1239-1271`] — UI edge case showing orphan single-member "group".
- **[E2.S4] Vitest DOM-environment deferral for `DuplicateWarning` + `/members/duplicates/page`** — blocked on `jsdom` devDep; bundled with frontend test-tooling track.

## Deferred from: code review of e1-s2, e1-s3, e1-s4 (2026-05-13)

- **Stale Keycloak admin token not cleared on 401 from Admin API** [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Token is cached until expiry; a 401 response from the Admin API does not invalidate the cache, causing repeated stale-token usage until TTL expires. Pre-existing issue in the `CreateRequestAsync`/`GetAccessTokenAsync` caching logic.
- **Non-404 Keycloak status codes become opaque 500** [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — 401/403/429/503 from Keycloak Admin API all propagate as `HttpRequestException` via `EnsureSuccessStatusCode`, surfacing as generic 500 to callers with no differentiation. Pre-existing pattern throughout the service.
- **MediatR/FluentValidation not used for Keycloak session/MFA endpoint handlers** [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`, `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — New session/MFA endpoints call `IKeycloakAdminService` directly from handlers rather than dispatching MediatR commands. Follows the existing codebase pattern for thin Keycloak-proxying operations; revisit if business logic accretes.

## Deferred from: Epic-3 story planning (2026-05-13)

- **[E3.S3] Per-shift task lists / `Aufgabenlisten`** — REQ-024 functional list item 1 ("Aufgabenlisten") deferred from E3.S3. Story models Roles + Shifts + Assignments only; granular sub-tasks within a shift (a separate `EventVolunteerTask` entity with FK to `EventVolunteerShift`) are out of scope until a concrete user need surfaces. Architecture (lines 349-369) suggested only the three entities; the German requirement was broader. Track for a follow-up story when an event manager actually requests sub-task tracking inside a shift.
- **[E3.S4] Volunteer reminder opt-out / global member email preferences** — No per-member email-preference system exists today. Volunteer shift reminders are sent unconditionally to anyone signed up. A cross-cutting opt-out mechanism (likely matching Epic 5 / REQ-030 channel preferences) should cover ALL existing email types simultaneously (reminders, registration confirmations, waitlist promotions, dunning, etc.) rather than adding a feature-specific flag. Estimated scope: 1 new domain field per Member + a preference-resolution helper in `EventNotificationService` + UI in profile settings. Coordinated with the Epic-5 Communication Automation track.
- **[E3.S4] Server-side i18n rendering pipeline for `EventNotificationService`** — E3.S4 introduces the FIRST bilingual email (DE + EN both in the same message via `const string` literals). The existing 6 German-only notification methods at [EventNotificationService.cs:29-145](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs#L29-L145) are NOT retrofitted in S4. A general server-side next-intl rendering pipeline (or resource files + a member-language resolver) should land as a dedicated cross-cutting communication-track story before email volume grows further. Coordinated with the Epic-5 Communication Automation track and the opt-out work above.

## Deferred from: epic-3 code review (2026-05-13)

Items raised during the Epic-3 boundary review and classified as defer (pre-existing concerns, low severity, or follow-up work outside the patch scope). Full evidence in [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). 46 items total — abbreviated below.

### Cross-cutting (epic-wide)
- **Shared `ICollectionFixture<TestWebApplicationFactory>` for API endpoint runtime tests** — Three Epic-3 stories (S1, S2, S5) deferred runtime endpoint auth tests citing the same Serilog bootstrap-logger collision pattern. A shared collection-fixture across all API test classes would unblock the family. Priority: top of epic-4 prerequisites or a chore commit.
- **DateTime.Kind enforcement at domain construction** — Several findings (H-S1-2, H-S5-2, H-S4 conversion) share a root cause: domain entities (`Event`, `EventRegistration`, `Member`) do not assert `Kind=Utc` on construction. A single guard in the constructors + a Symmetric-Guard-Checklist entry closes the family. Track as a defensive-coding chore.
- **FOR UPDATE row-lock coverage audit** — Project convention "FOR UPDATE on any shared mutable state" is unevenly applied. CancelRegistration, UpdateShift, and token rotate paths lack it. A project-wide audit closing the family is a one-day task.

### S1 (12 items)
- **[E3.S1] CSV writes `IsWaitlisted`/`IsCheckedIn` as English literal "true"/"false"** — German Excel won't auto-recognize as booleans. Cosmetic. (Blind-F16)
- **[E3.S1] DateTime.UtcNow read twice (cutoff + GeneratedAt) without snapshot** — testability gap; not a runtime defect. (Edge-E2)
- **[E3.S1] CSV writer doesn't quote NUL or Next Line (U+0085) control chars** — defense-in-depth. (Edge-E5)
- **[E3.S1] `evt.IsDeleted` check unreachable (EF global filter handles it)** — dead-code cleanup. (Edge-E9)
- **[E3.S1] Empty `ParticipantName` sorts first; printed row has no human lookup key** — UX hazard, not correctness. (Edge-E10)
- **[E3.S1] `CheckedInCount` excludes rows filtered by `includeWaitlisted`** — same family as M-S1-1 if D-S1-2 resolves accordingly. (Edge-E12)
- **[E3.S1] Empty `?includeWaitlisted=` yields a 400 instead of default-false** — frontend serialization edge. (Edge-E13)
- **[E3.S1] 404 body on archive-expired CSV is JSON not text/csv** — Content-Type negotiation nit. (Edge-E15)
- **[E3.S1] `ExportEventCheckInRosterQueryHandler` re-enters MediatR → pipeline behaviors run twice** — double-audit/double-rate-limit if those behaviors become non-idempotent. (Blind-F14)
- **[E3.S1] `OrderBy(StringComparer.Ordinal)` over folded names may misorder names containing apostrophes** — locale-sensitive sort gap. (Blind-F15)
- **[E3.S1] No `LogAccessDenied` on Conflict/NotFound paths of check-in endpoints** — audit-coverage discipline. (Blind-F13)
- **[E3.S1] `!` on `Registration` in `CheckedIn` outcome dereference** — defensive; type-safe in current code path. (Blind-F3 — moved to S2 file scope)

### S2 (8 items)
- **[E3.S2] AC-4 PARTIAL: Audit moved from handler to endpoint** — documented deviation; observable behavior preserved. (Auditor)
- **[E3.S2] AC-8 PARTIAL: Vitest doesn't directly assert idempotent banner / invalid-QR banner state** — test gap. (Auditor)
- **[E3.S2] `CheckInSearchHasher` Base64 (not Base64Url) — `+`/`/` chars in hash** — forward-compat trap for future URL/path use. (Blind-F8)
- **[E3.S2] Idempotent-path tracking-dirty risk (defensive `ChangeTracker.Clear`)** — current code is safe; defense for future. (Blind-F9)
- **[E3.S2] Concurrent-test serialization on shared Npgsql pool** — test-validity concern, not runtime. (Blind-F10)
- **[E3.S2] Manual-check-in cancelled-race UX** — backend correctly Conflicts; frontend banner timing nit. (Edge-E4)
- **[E3.S2] Pending → CheckedIn transition skips Confirmed** — reports keyed on `ConfirmedAt` may break; depends on H-S2-4 resolution. (Edge-E8)
- **[E3.S2] Inner-whitespace hash drift in `CheckInSearchHasher`** — forensic correlation gap, not security. (Edge-E10)
- **[E3.S2] Unknown-status rethrow → 500 without audit** — future-proofing. (Edge-E13)
- **[E3.S2] Frontend roster filter uses culture-less `.toLowerCase()`** — Turkish-i / Eszett mismatch. (Edge-E14)
- **[E3.S2] HTTPS-less origin lacks "HTTPS required" banner** — kiosk UX. (Edge-E16)
- **[E3.S2] Cross-event audit `eventId` uses registration's actual event, not URL event** — forensic correlation, depends on D-S2-1. (Edge-E18)

### S3 (12 items)
- **[E3.S3] Audit `AssignedBy` cannot distinguish self-signup from staff-assign with same caller** — store a `WasSelfSignup` flag. (Edge-E1)
- **[E3.S3] `AssignVolunteer` no try/catch for unhandled `VolunteerAssignmentOutcome.Cancelled`** — defensive; current enum doesn't reach it. (Blind-F2)
- **[E3.S3] Waitlist-position promotion NullReferenceException on legacy null Position** — domain invariant; current data is clean. (Blind-F3)
- **[E3.S3] AC-10 PARTIAL: missing `AssignVolunteerCommandHandlerTests` + `SelfSignUpForVolunteerShiftCommandHandlerTests` theory rows** — covered indirectly by Infrastructure integration tests. (Auditor)
- **[E3.S3] `GetByEventAndNameAsync` uses CLR `ToLower()` — Turkish-locale CLR vs Postgres `lower()` divergence** — culture-sensitivity edge. (Blind-F8)
- **[E3.S3] `UpdateDetails` allows StartsAt in the past + capacity bypass via `IncreaseCapacity`** — domain invariant; depends on M-S3-9. (Blind-F9)
- **[E3.S3] `GetRemindersDueAsync` no member-status filter** — reminder edge; coordinate with S4. (Blind-F11)
- **[E3.S3] `AddAtomicAsync` race-recovery re-fetch may return null on concurrent cancel** — stress-scenario only. (Blind-F13)
- **[E3.S3] `AllowSelfSignup` flag drift via `UpdateDetails`** — design intent unclear; defer. (Blind-F14)
- **[E3.S3] Re-assignment after cancel: old Cancelled row accumulates** — by-design forensic history. (Edge-E12)
- **[E3.S3] No `DELETE` endpoint for `EventVolunteerRole` — FK RESTRICT guard never reached** — feature missing, not bug. (Edge-E17)
- **[E3.S3] No `(shift_id, position) UNIQUE WHERE Status='Waitlisted'` DB constraint** — application-level invariant only. (Edge-E20)
- **[E3.S3] `BeginTransactionAsync` default isolation undocumented (READ COMMITTED)** — documentation gap. (Edge-E21)
- **[E3.S3] Early-return paths inside `AssignAsync` rely on implicit `await using` rollback** — semantically odd but functional. (Edge-E22)
- **[E3.S3] Volunteer overlap detection across shifts of same role** — no domain or validator check; member can be double-booked. (Edge-E25)
- **[E3.S3] `Cancel a Confirmed shift` returns 404 for both wrong-event and not-found** — info-leak via timing. (Edge-E16)

### S4 (8 items)
- **[E3.S4] AC-9 / D7 test coverage deferred against spec mandate** — Completion Notes acknowledged: page-level Vitest, integration repo test, job-registration test, bilingual email render test, adversarial test rows. (Auditor)
- **[E3.S4] `MarkReminderSentAsync` after success can fail → next-day duplicate send (at-least-once)** — acceptable trade-off; combined with C2 fix this is documented. (Edge-E12)
- **[E3.S4] PII (member email) logged at Information level** — GDPR/Swiss DPA caution; pre-existing pattern in adjacent code. (Edge-E11)
- **[E3.S4] Subject not RFC-2047 encoded if title contains non-ASCII** — depends on SMTP library encoding behavior; coordinate with H-S4-2. (Blind-F5 — withdrawn after re-read)
- **[E3.S4] Stale `eventCancelled` prop on self-signup section** — race window small; backend rejects. (Edge-E10)
- **[E3.S4] Admin volunteers page swallows partial-load failure** — UX inconsistency. (Edge-E13)
- **[E3.S4] `editingShiftId` non-null + `roleId` empty corrupts shift on update** — guard inconsistency; current flow is safe. (Blind-F7)
- **[E3.S4] `noShifts` translation reused as "no shifts at all" and "no shifts in this role"** — i18n key duplication. (Blind-F14)

### S2 fix-pass deferred (2026-05-13)
- **[E3.S2] H-S2-5 CancelRegistration FOR UPDATE row lock** — needs a new cancellation service mirroring `EventRegistrationCheckInService`. Combine with cross-cutting FOR UPDATE coverage audit (theme #1: also covers rotate-token, UpdateShift) in a single design pass.

### S5 (6 items)
- **[E3.S5] AC-1 absence-of-`RequireAuthorization` pattern vs spec's explicit `.AllowAnonymous()`** — style nit; spec acknowledges precedent. (Auditor)
- **[E3.S5] AC-10 PARTIAL: missing `GetPublicCalendarFeedQueryHandlerTests` + `EventCalendarFeedEndpointTests`** — explicitly deferred in dev-story Completion Notes. (Auditor)
- **[E3.S5] `RegenerateCalendarToken` no retry on partial-unique-index collision** — collision probability 1 in 2^256; spec asked for it. (Blind-F12)
- **[E3.S5] Cancelled/Draft `BuildSingle` would mislabel `STATUS:CONFIRMED`** — defense-in-depth; endpoint pre-filters. (Edge-E8)
- **[E3.S5] `subscriptionUrl` hard-codes `/api/v1/events/...` route prefix** — stale-URL risk on version bump. (Blind-F13)
- **[E3.S5] `Uri.EscapeDataString` no-op on Base64Url tokens** — defensive but harmless today. (Edge-E11)
- **[E3.S5] Token-not-found 404 enumeration timing fingerprint (3 code paths)** — depends on H-S5-1 hash fix. (Blind-F11)
- **[E3.S5] `RegenerateCalendarToken` allowed on Deactivated/Merged Member** — feed filter handles it; cosmetic invariant. (Edge-E17)
- **[E3.S5] `EscapeIcsText` strips TAB (RFC 5545 allows HTAB as content char)** — minor data-fidelity loss. (Edge-E14)
- **[E3.S5] `URL:` value over-escapes commas/semicolons (RFC 5545 §3.3.13 not §3.3.11)** — defensive over-escaping. (Edge-E13)
- **[E3.S5] `AppendLineFolded` walk-back theoretical infinite loop** — unreachable in practice. (Edge-E16)
- **[E3.S5] `Build_LineFolding_DoesNotSplitUtf8MultiByteSequences` test gap** — doesn't catch "drop codepoint entirely". (Edge-E15)

## Deferred from: code review of Epic-3 boundary Round 3 (e3-s1, e3-s2, e3-s3, e3-s4, e3-s5) (2026-05-14)

- **[E3.S2] CancelRegistration FOR UPDATE row lock** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:465-484`] — already deferred from round-2 H-S2-5; concurrent cancellation can double-promote a waitlist row. Address in a cross-cutting cancellation-concurrency track.
- **[E3.S2] CancellationToken not plumbed through pre-existing Epic-2 endpoints** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:204-640`] — `RegisterPublic`, `RegisterMember`, `CancelRegistration`, `MarkAsNoShow`, `RevertNoShow`, `RevertCheckIn`, `RevertCancellation`, `GetStatistics`, `ExportRegistrationsPdf`. Pre-existing surface; client aborts continue to completion server-side. Out-of-scope for E3.
- **[E3.S3] `IsStaffCaller` hardcoded role list** [`backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs:31`] — duplicates the `RequireEventStaff` policy role set. Latent only when a new staff role is added; needs role-registry single-source-of-truth refactor.
- **[E3.S3] No DELETE endpoint for `EventVolunteerRole`** — design intent: manager flow uses `IsActive=false` deactivation, never hard-delete. RESTRICT FK on `assignment.role_id` protects against accidental delete. Track if managers ever request the wholesale-delete flow.
- **[E3.S4] Hardcoded DE/EN strings in `EventNotificationService` reminder body** [`backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs:183-232`] — D8 carve-out from i18n parity rule (server-side bilingual email is intentional). Address with the 6 pre-existing German-only methods in a cross-cutting communication-i18n track.
- **[E3.S4] `ZurichTimeZone` cached at static initialization** [`backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs:90-101`] — host `tzdata` updates require process restart for reminder times to reflect new DST rules. Standard .NET pattern; operationally rare on managed Linux hosts that restart for security updates anyway.

## Deferred from: code review of Epic-3 boundary Round 4 (e3-s1, e3-s2, e3-s3, e3-s4, e3-s5) (2026-05-14)

- **[E3.S1] Roster query return-type drift** [`backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs`] — AC-1/AC-3 still say `IRequest<EventCheckInRosterDto?>`, code returns the `IRequest<EventCheckInRosterLookup>` envelope (intentional Round-2 H-S1-3 fix). Spec reconciliation only.
- **[E3.S2] QR-code check-in has no event scoping** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~605`] — any global `RequireEventStaff` user can check in registrations of any event via a held QR token. Pre-existing global-role limitation; tracked with the role-registry work alongside R3-Defer-5.
- **[E3.S2] Manual-search check-in omits `searchQueryHash` when `SearchQuery` is empty** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~517-525`] — AC-4 says `additionalData` MUST include it for the manual path; arguably acceptable since there is no query to hash. Revisit if audit completeness needs a sentinel.
- **[E3.S3] Read endpoints use `RequireEventStaffOrMember`, AC-7 says `RequireMember`** — intentional Round-3 R3-DN-4 decision; spec reconciliation only.
- **[E3.S3] `IncreaseCapacity` renamed to `UpdateCapacity(newCapacity, currentConfirmedCount)`** [`backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerShift.cs`] — intentional Round-3 H-S3-4 fix (bidirectional capacity), functional superset of AC-1; spec reconciliation only.
- **[E3.S3] `EventVolunteerAssignmentRepositoryTests` not present under that name** [`backend/tests/IabConnect.Infrastructure.Tests/Events/`] — constraint/FK cases folded into `EventVolunteerAssignmentConcurrencyTests.cs`; verify a `CountConfirmedAsync` excludes-cancelled assertion exists when the S3 test-gap patches are addressed.
- **[E3.S4] Reminder window is 36h, AC-5 says 24h** [`backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs`] — intentional Round-2 H-S4-4 fix; spec reconciliation only.
- **[E3.S4] `SendVolunteerShiftReminderAsync` signature adds a `Member` parameter not in AC-5** [`backend/src/IabConnect.Application/Events/IEventNotificationService.cs`] — avoids a duplicate fetch, documented in XML doc; spec reconciliation only.
- **[E3.S4] Frontend `volunteers/__tests__/page.test.tsx` still missing** [`frontend/src/app/(dashboard)/events/[id]/volunteers/`] — already deferred Round 3 as R3-H-S4-3 (`frontend-test-coverage-volunteers-page`); re-surfaced by the Round-4 auditor, no production impact.
- **[E3.S5] `ResolveBaseUrl` re-validates per request and throws → 500 on misconfig** [`backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs`] — already documented Round 3 R3-H-S5-2 as out-of-scope; proper fix is `IOptions<T>.ValidateOnStart()`.
- **[E3.S5] `HashCalendarSubscriptionTokens` `length<>64` guard would leave a 64-char cleartext token unhashed** [`backend/src/IabConnect.Infrastructure/Migrations/20260513205649_HashCalendarSubscriptionTokens.cs`] — safe today (~43-char tokens), one-shot migration already deployed; hex-shape check or `is_hashed` flag is the correct hardening if token format changes.
- **[E3.S5] `URL` property emitted unescaped, AC-6 lists it among text-escaped properties** [`backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs`] — intentional Round-3 R3-L-S5-1 fix (RFC 5545 §3.3.13); spec reconciliation only.
- **[E3.S5] `Member.CalendarSubscriptionToken` renamed to `...Hash`, stores SHA-256 digest** [`backend/src/IabConnect.Domain/Members/Member.cs`] — intentional Round-2 H-S5-1 security hardening; spec reconciliation only vs AC-3.
- **[E3.S5] `GetPublicCalendarFeedQueryHandlerTests` + `EventCalendarFeedEndpointTests` still missing** [`backend/tests/IabConnect.Application.Tests/Events/Calendar/`, `backend/tests/IabConnect.Api.Tests/`] — already deferred Round 3 as R3-H-S5-7 / R3-H-S5-8 (`calendar-feed-api-tests`); re-surfaced by the Round-4 auditor. The public-feed visibility filter (AC-1 privacy guarantee) has zero automated coverage — raise priority.

---

## Deferred from: code review of Epic 9 (2026-05-14)

- **[E9.S3] Extra DB round-trip per email/PDF send, no `SystemSettings` caching** [`EventNotificationService.cs`, `DunningEmailService.cs`, `EventRegistrationPdfExporter.cs`] — each send independently calls `ISystemSettingsRepository.GetSettingsAsync` to read `ApplicationName`; a campaign to N recipients = N identical queries on a singleton row the frontend already caches for 300s. Not a correctness bug; introduced by E9 but a shared `SystemSettings` cache is a caching-strategy decision beyond this epic.
- **[E9.S3] Email HTML encodes the org name but not adjacent user-controlled fields** [`DunningEmailService.cs`, `EventNotificationService.cs`] — the E9 code wraps the new dynamic `appName` in `WebUtility.HtmlEncode`, but the same templates still interpolate `{invoice.RecipientName}`, `{notice.Notes}`, `{evt.Title}`, `{registration.ParticipantEmail}` etc. raw — a pre-existing HTML-injection hole the new code draws attention to without closing. Worth a dedicated email-template encoding pass.
- **[E9.S2] Pre-existing lint baseline failure in untouched files** [`frontend/src/app/members/segments/page.tsx`, `frontend/src/app/admin/backups/page.tsx`] — all 4 E9 stories self-report this baseline `npm run lint` failure; the files were not touched by E9, so it is not an E9 regression. Flagged for the E9 retrospective / a cleanup pass.

---

## Deferred from: code review of Epic 10 (2026-05-14)

- **[E10.S1] `InvalidateCache()` clears only the local process** [`backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs`] — `IMemoryCache` is per-process; in a multi-instance deployment only the node that served the PUT invalidates, others serve a stale module map until the per-process TTL expires. Pre-existing architectural limitation — the `// TODO: Add caching (Redis)` marker this story replaced acknowledges it; the modular-monolith MVP is single-instance. Distributed cache (Redis) is the planned fix.
- **[E10.S2] `ModuleSettingsEndpointTests` is metadata-only** [`backend/tests/IabConnect.Api.Tests/Endpoints/ModuleSettingsEndpointTests.cs`] — pins the admin-role policy at the endpoint-metadata layer; does not spin up the host to prove a non-admin gets a runtime 403 (AC-7 / Task-5 wording). Test-fidelity gap, not a code defect — runtime "never-gated" coverage for the module-settings group already exists in E10-S3's `ModuleEnforcementEndpointTests`.
- **[E10.S2] `UpdateModuleSettingCommand` returns 404 for a valid-but-unseeded key** [`backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs`] — a key in `ModuleKeys.All` whose seed row is missing passes validation, then `GetByKeyAsync` returns null → `KeyNotFoundException` → 404, with no upsert/self-heal path. Only reachable from a broken DB state (failed/partial migration seed); not caused by this change.
- **[E10.S5] Playwright E2E suite authored but unverified in CI** [`frontend/e2e/module-enforcement.spec.ts`] — the suite `test.skip()`s itself without `E2E_ADMIN_PASSWORD`, so AC-6/AC-7 "the E2E suite passes" is unproven. Needs the full local stack (Docker + Keycloak + seeded admin) to run for real; the backend + Vitest suites are the CI-runnable proof of the same behaviour. Run it when the full stack is available.

---

## Deferred from: code review of Epic 10 boundary re-review (2026-05-15)

Round 2 of the Epic-10 epic-boundary review, run over the full E10 diff (`7a07d7c..d1958da`, 93 files / +9.719/-821 lines) after the 13-patch fix-pass. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor (13/13 prior patches verified). Per-story round-2 defers are recorded inline in the e10-s1..s5 `## Review Findings` sections; the two items below are cross-cutting (don't belong to a single story).

- **[Cross-cutting] Audit actor identity uses username, not stable `sub` claim** — `Member.UpdatedBy`, `SystemSettings.UpdatedBy`, `ModuleSetting.UpdatedBy`, and audit-row actor fields throughout the codebase store `HttpContext.GetUserName()`. A Keycloak user rename breaks forensic traceability of any historical action by that user. Pre-existing project-wide pattern; cross-cutting audit-identity hardening track. (Surfaced again by E10's `UpdateModuleSettingCommand` + `ModuleAuthorizationHandler` audit writes.)
- **[Cross-cutting] `ModuleAuthorizationHandler` writes one audit row per denied request with no rate-limit / coalescing** — a misconfigured polling client (e.g. once-per-second to `/api/v1/finance/transactions` while `Module:finance` is off) produces ~86k audit rows/day in the "System Security" category. Same pattern applies to other audit-write-on-deny endpoints across the codebase. Cross-cutting audit-volume control track.

---

## Deferred from: E11-S1 implementation (2026-05-16)

The configuration-surface foundation story (`e11-s1-add-env-examples-and-document-config-precedence`) intentionally limits its scope to documentation, `.env.example` files, `.gitignore` tightening, README precedence, and the `appsettings.Beta.json` skeleton. The findings below were surfaced by the AC-5 hardcoded-host audit but deferred per story scope so that no code paths change in E11-S1.

### E11-S1 follow-up: `appsettings.json` base cleanup

**Trigger story:** E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta`) — first story where Beta loads base `appsettings.json` then `appsettings.Beta.json` without dev overlays and would inherit `localhost:5433` until env-var overrides resolve.

**Keys to move from `backend/src/IabConnect.Api/appsettings.json` to `backend/src/IabConnect.Api/appsettings.Development.json`:**

- `ConnectionStrings.DefaultConnection` (currently `Host=localhost;Port=5433;…` in both files — base should be empty or a non-host placeholder)
- `Keycloak.Authority` (currently `http://localhost:8080/realms/iabconnect` in both — base should be empty)
- `DocumentStorage.ServiceUrl` (currently `http://localhost:9000` in both — base should be empty)
- `DocumentStorage.AccessKey` / `SecretKey` (currently `rustfsadmin` literal credentials in BOTH files — must NEVER appear in base; dev-only credential)
- `DocumentStorage.BucketName` (currently `iabconnect-documents` in both — base should be empty)
- `Smtp.Host` (currently `localhost` in both — base should be empty)

**Rationale:** The base `appsettings.json` should contain production-safe non-sensitive defaults so Beta/Production cleanly layer overrides without inheriting dev hosts. Today the duplication between base and Development is harmless because the Development overlay re-sets every key — but Beta will not.

**Why deferred:** A single-file move could introduce a regression if any code path reads `appsettings.json` without `appsettings.Development.json` overlay (test hosts, isolated unit tests). E11-S2 is the natural trigger because it adds the Beta-load path and would otherwise hit this issue first.

### E11-S1 follow-up: Beta `Serilog.WriteTo` array-merge silently surfaces base File sink

**File:** `backend/src/IabConnect.Api/appsettings.Beta.json`

**Discovered by:** code-review-2026-05-16 (Blind Hunter F1, re-classified to defer after verifying .NET config array semantics).

**Problem:** .NET Configuration merges JSON arrays **by index**, not wholesale-replace. Beta's `"Serilog": { "WriteTo": [{ "Name": "Console" }] }` overrides base's `WriteTo[0]` (Console — fine) but base's `WriteTo[1]` (File sink at `appsettings.json:21-30`) survives the merge → Beta would still write File logs, contradicting ADR-017's "Console-only in Beta" decision.

**Fix:** Structural, tied to the `appsettings.json base cleanup` entry below. Move the File sink from base `appsettings.json` into `appsettings.Development.json`, leaving base with Console-only. After that move, Beta inherits the Console-only configuration correctly without needing any change to `appsettings.Beta.json`.

**Why deferred:** Same trigger as the base cleanup (E11-S2 wires `ASPNETCORE_ENVIRONMENT=Beta` and is the first place this matters). The Beta skeleton committed by E11-S1 expresses the right INTENT; the execution depends on the base cleanup landing first.

**E11-S2 acceptance criterion to add:** "After moving the File sink to `appsettings.Development.json`, verify with `dotnet run --launch-profile=https` and `ASPNETCORE_ENVIRONMENT=Beta` that `logs/` is empty (only Console sink active)."

### E11-S1 follow-up: `KeycloakHealthCheck.cs` configuration-key typo

**File:** `backend/src/IabConnect.Api/HealthChecks/KeycloakHealthCheck.cs:16`

**Current:** `var authority = configuration["Authentication:Authority"];`

**Should be:** `var authority = configuration["Keycloak:Authority"];`

**Impact:** `Authentication:Authority` is not a defined section anywhere in the codebase, so the read returns `null`. The health-check then either no-ops or follows a default-URL code path. The `Keycloak:Authority` value IS the intended source (matches the OIDC binding at `Api/DependencyInjection.cs:121-122`).

**Why deferred:** Fixing the typo changes runtime behavior — the health check would start actually validating Keycloak reachability and might return 503 in environments where the Keycloak URL is wrong or unreachable. That is a real correctness improvement but a behavior change worth its own story with proper before/after smoke-tests in Dev and Beta.

### E11-S1 follow-up: `Branding__SourceUrl` consumed-after-documented

**Variable:** `Branding__SourceUrl` (added to `backend/.env.example` by E11-S1)

**Consumer:** E20-S3 (`/about` endpoint) — not yet implemented.

**Note:** Listing the variable in `.env.example` ahead of consumption is intentional so deployers can configure it before E20-S3 ships. No code currently reads `Branding:SourceUrl`. This is not a defect; just a forward-reference.

