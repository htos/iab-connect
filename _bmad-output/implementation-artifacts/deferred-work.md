# Deferred Work

Items deferred during code reviews — not caused by the reviewed change, but worth addressing in a dedicated pass.

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

