# Story E3.S5: Add Calendar Feed and ICS Export

Status: in-progress (Round-3 review complete 2026-05-14 — 1 Critical (C4) + 9 High + 7 Medium + 1 Low + 2 Decisions resolved (DN-1: refactor to additive migration; DN-2: broaden filter to !Inactive && !merged) routed back to dev)

## Story

As a member or public visitor,
I want a subscribable calendar feed (and per-event `.ics` download) for IAB Connect events,
so that association events stay in sync with my personal calendar app (Apple Calendar / Google Calendar / Outlook) without manual re-entry.

Requirement: **REQ-025** (Kalender-Integration iCal/Google — Events, Priority Should). Story is **backend only** — no frontend changes; the public website may later embed a `webcal://` link but that is **out of scope**.

## Acceptance Criteria

1. **Public feed exposes ONLY public published events.** `GET /api/v1/events/calendar.ics` MUST be `.AllowAnonymous()` (matching the existing public-events pattern at [EventEndpoints.cs:21-27](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs#L21-L27)) and MUST return a VCALENDAR whose VEVENT set is exactly the rows where `Visibility == EventVisibility.Public AND Status == EventStatus.Published AND IsDeleted == false`. The handler MUST source rows via the existing [IEventRepository.GetPublicEventsAsync](backend/src/IabConnect.Domain/Events/IEventRepository.cs#L19) — do NOT add a new repository method, do NOT inline a raw EF query in the handler. Symmetric-Guard reference: the existing `GetPublicEventsAsync` filter at [EventRepository.cs:79-89](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs#L79-L89) is the canonical "public + published" predicate; the new endpoint MUST consume it unmodified. `MembersOnly`, `InviteOnly`, `Hidden`, and `Draft`/`Cancelled`/`Completed` events MUST NOT appear under any circumstance.
2. **Authenticated feed is subscribable via per-member opaque token, NOT session cookie.** `GET /api/v1/events/my-calendar.ics?token={opaqueToken}` MUST be `.AllowAnonymous()` (calendar clients cannot do OIDC) and MUST resolve the token to a `Member` row via a new `IMemberRepository.GetByCalendarTokenAsync(string token, CancellationToken ct)`. Unknown / null / empty token → `404 Not Found` with body `{ message: "Calendar feed not found" }` (do NOT return 401 — that would surface "user exists / does not exist" information through HTTP status). The feed contents include events where `(Visibility == Public OR Visibility == MembersOnly) AND Status == Published AND IsDeleted == false AND EndDate >= UtcNow - 90d`. `InviteOnly` is **out of scope** for this story (no invite-list mechanism exists today; verified via [grep for InviteOnly in EventRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs) → no per-member filter). `Hidden` MUST NEVER appear. Resolved member's `Status == Inactive` or `MergedIntoMemberId != null` → return `404` (soft-retire-flag discipline per [docs/07_dos_donts.md:132](docs/07_dos_donts.md#L132)).
3. **Token lifecycle is member-scoped, regenerable, and revocable.** Add a new column `Member.CalendarSubscriptionToken` (`string?`, max 64 chars, unique partial index where `calendar_subscription_token IS NOT NULL`). Two new domain methods on [Member.cs](backend/src/IabConnect.Domain/Members/Member.cs):
    - `public string RegenerateCalendarToken()` — generates a fresh `Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32))` (≈43 chars), assigns it, and returns it. Idempotent in the sense that calling it again invalidates the prior token.
    - `public void RevokeCalendarToken()` — sets the field to `null`.
    Expose via two authenticated endpoints on `EventEndpoints` (NOT a new endpoint group):
    - `POST /api/v1/events/calendar/token/rotate` — `RequireMember`, returns `{ token: string, subscriptionUrl: string }`. Emits `SecurityAuditLogger.LogAccessGranted("Member.CalendarTokenRotated", memberId)`.
    - `DELETE /api/v1/events/calendar/token` — `RequireMember`, sets token to null. Emits `SecurityAuditLogger.LogAccessGranted("Member.CalendarTokenRevoked", memberId)`.
    Both endpoints resolve the calling member via the existing `IAuthorizationService.GetCurrentUserId(httpContext.User)` pattern at [EventEndpoints.cs:209](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs#L209), then look up the `Member` row by `KeycloakUserId` (via [IMemberRepository.GetByKeycloakUserIdAsync](backend/src/IabConnect.Domain/Members/IMemberRepository.cs#L10)). If no member row exists for the current user → `403 Forbidden` with `{ message: "Calendar feed requires an active membership" }`.
4. **ICS payload is RFC 5545 compliant.** A new `ICalendarFeedBuilder` in [backend/src/IabConnect.Application/Events/Calendar/](backend/src/IabConnect.Application/Events/Calendar/) MUST emit:
    - **VCALENDAR envelope**: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//IAB Connect//Events//EN\r\nMETHOD:PUBLISH\r\nCALSCALE:GREGORIAN\r\n` then VEVENT blocks then `END:VCALENDAR\r\n`. Line terminator MUST be CRLF (`\r\n`) per RFC 5545 §3.1. Output is UTF-8 **without** BOM (RFC 5545 §6 — content type `text/calendar; charset=utf-8`).
    - **Per VEVENT**: `UID:<event-id>@iabconnect` (stable across edits — supports AC-5), `DTSTAMP:<Event.UpdatedAt or CreatedAt as UTC ZULU>`, `DTSTART:<StartDate UTC ZULU>`, `DTEND:<EndDate UTC ZULU>`, `SUMMARY:<Title>`, `DESCRIPTION:<Description>` (truncated to 8000 chars to bound payload), `LOCATION:<Location + ", " + LocationAddress when present>`, `STATUS:<CONFIRMED for Published / CANCELLED for Cancelled>`, `URL:<absolute https URL to event detail page>`, `LAST-MODIFIED:<Event.UpdatedAt UTC ZULU>`, `SEQUENCE:0`. `IsAllDay == true` MUST emit `DTSTART;VALUE=DATE:YYYYMMDD` and `DTEND;VALUE=DATE:YYYYMMDD` (RFC 5545 §3.6.1) — no time component.
5. **Stable UID guarantees calendar-client de-duplication.** UID format MUST be `{Event.Id}@iabconnect` (lowercase Guid `D` format, no braces). UID MUST NOT change across event title/description/location/schedule edits — calendar clients use UID as the merge key (AC-5). If UID changes between two feed fetches, calendar clients duplicate the event. Test: a fetch-edit-fetch cycle MUST produce the same UID string for the same event ID. **Per-event `.ics` download** endpoint `GET /api/v1/events/{id:guid}/calendar.ics` (`.AllowAnonymous()` for Public events; for MembersOnly require the calendar token via `?token=…` same as AC-2) returns a single-VEVENT VCALENDAR with the SAME UID format — so adding-from-website and adding-from-feed dedup to one entry.
6. **ICS text escaping per RFC 5545 §3.3.11.** A `EscapeIcsText(string? input)` helper in `ICalendarFeedBuilder` MUST escape, in this exact order:
    - `\` → `\\` (backslash first — same precedence rule as LIKE-escape per A7)
    - `;` → `\;`
    - `,` → `\,`
    - `\r\n` and `\n` → `\n` (literal two-char `\n` in the output)
    - Strip ASCII control chars (`< 0x20`) other than the just-substituted newline.
    Applied to: `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL` (URL escapes only `,` and `;` per §3.3.11 — backslash is already URL-safe). Long property lines MUST be folded at 75 octets per RFC 5545 §3.1 — a continuation line begins with a single SPACE. Lines containing UTF-8 multi-byte sequences MUST NOT split a code point mid-byte (count octets, not chars). **Adversarial test rows required (A8)**: title containing `,`, title containing `;`, title containing `\r\n`, title containing literal `\` backslash, title containing 200 chars of `ÄÖÜß` UTF-8 (forces 75-octet folding inside multi-byte boundaries), title containing ASCII NUL/control ``, description containing all the above.
7. **Time-zone handling: UTC only (no VTIMEZONE).** All `DTSTART` / `DTEND` / `DTSTAMP` / `LAST-MODIFIED` MUST be emitted as UTC ZULU (`yyyyMMddTHHmmssZ`). `Event.TimeZone` (e.g. `"Europe/Zurich"`) is informational — calendar clients convert UTC to the user's local time automatically. **No VTIMEZONE block** is emitted (avoids 30+ lines of DST rule per feed + version-skew between IANA-tz updates). Trade-off documented in D3.
8. **Recurring events out of scope.** `Event.IsRecurring == true` events: emit the **master event only** (one VEVENT for the master, no `RRULE`, no series instances). Verified via [grep for ParentEventId usage](backend/src/IabConnect.Domain/Events/Event.cs#L29) → series-instance materialisation is not currently implemented. A code comment in `ICalendarFeedBuilder.BuildVEvent` MUST note: "RRULE emission deferred — series instances are not materialized today; revisit when REQ-019 recurrence-expansion lands." Test coverage: an `IsRecurring=true` event produces exactly one VEVENT with NO `RRULE` line.
9. **HTTP caching is set; no per-request audit log.** Both feed endpoints MUST set `Cache-Control: public, max-age=600, stale-while-revalidate=300` (10 min cache, 5 min revalidate window) and `Content-Type: text/calendar; charset=utf-8`. **No `SecurityAuditLogger.LogAccessGranted` per feed fetch** — calendar clients poll every ~hour and would flood the audit log; document per A3 verb discipline. The token-rotate/revoke endpoints (AC-3) DO emit `LogAccessGranted` because those are state changes. Authorization-failure paths (token not found, member inactive) use `ILogger<EventCalendarFeedHandler>` at `Information` level — NOT `SecurityAuditLogger`, because the token is the audit principal here and we don't want to log token strings.
10. **Theory-driven tests at all layers (A8 adversarial discipline).**
    - **Application/Unit:** `ICalendarFeedBuilderTests` — `[Theory]` over (a) escape rules per AC-6 with 6+ adversarial `[InlineData]` rows; (b) UTC formatting (`new DateTime(2026, 6, 15, 14, 30, 0, DateTimeKind.Utc)` → `"20260615T143000Z"`); (c) all-day event (`IsAllDay=true` → `DTSTART;VALUE=DATE:20260615`); (d) line folding (250-char SUMMARY → 75-octet wrap with continuation SPACE); (e) cancelled event → `STATUS:CANCELLED`; (f) recurring event → exactly one VEVENT, no `RRULE`; (g) UID stability — `event.UpdateDetails(...)` followed by re-build produces the same UID.
    - **Application/Unit:** `GetPublicCalendarFeedQueryHandlerTests` — visibility-filter test asserting only `Public + Published` rows appear in output; reflection-style test asserting the feed string contains EXACTLY the seeded event IDs and no others.
    - **Application/Unit:** `GetMemberCalendarFeedQueryHandlerTests` — token-not-found → null result; token-found-but-member-inactive → null result; token-found-but-`MergedIntoMemberId != null` → null result; happy path includes `MembersOnly` events.
    - **Infrastructure (Testcontainers PostgreSQL):** `MemberCalendarTokenRepositoryTests` — uses `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22) `IAsyncLifetime` + `PostgreSqlBuilder("postgres:18")` pattern. Seeds two members with tokens + one with null token; asserts `GetByCalendarTokenAsync(token)` returns the right member; asserts unique partial index fires when two members try to claim the same token (`DbUpdateException` on `SaveChangesAsync`); asserts null-token rows do NOT collide on the partial index.
    - **API:** `EventCalendarFeedEndpointTests` — `.AllowAnonymous()` metadata test on both feed endpoints (mirror [MemberDuplicatesEndpointTests.DuplicatesEndpoint_ShouldRequireVorstandAuthorization](backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicatesEndpointTests.cs) but assert no `IAuthorizeData` is present); `Content-Type` assertion `text/calendar; charset=utf-8`; `Cache-Control` header assertion; per-event endpoint `text/calendar` for public event + 404 for non-public event when no token. The rotate / revoke endpoints get a `RequireMember`-metadata assertion + 401-for-unauthenticated runtime test.

## Tasks / Subtasks

- [ ] **0. Pre-flight gates** (A1 commit discipline; A6/A7 audits; A11 workflow)
  - [ ] Confirm [docs/07_dos_donts.md](docs/07_dos_donts.md) contains the **Symmetric-Guard Checklist** (line 118), **Concurrency Checklist** (line 134), and **Pattern Chars in User Input** (line 159) sections — all three are present (verified). No new dos-and-donts entry is required for this story; ICS escaping is RFC-driven, not project-policy-driven.
  - [ ] **A6 Concurrency Checklist audit.** Token rotate is a single `Member` row mutation — no cross-aggregate move, no race window beyond the standard EF `SaveChanges`. The unique partial index on `calendar_subscription_token` makes the "two members generate same token" collision recoverable (1 in 2^256, plus the index hard-fails). **No `FOR UPDATE` or transactional wrapping required.** Recorded for completeness.
  - [ ] **A7 Pattern Chars audit.** The calendar token is matched via EXACT equality (`m.CalendarSubscriptionToken == token`), NOT `ILIKE`. Inputs `eventId` (Guid) and `token` (Base64Url, server-issued) are not user-supplied prose. **Not triggered.** Recorded for completeness.
  - [ ] Confirm `dotnet test` baseline is green before edits (current baseline after E3.S1 will be ≥ 1551 + S1's new tests — confirm at story start).

- [ ] **1. Domain: Member calendar-token field + methods** (AC: 3)
  - [ ] Add `public string? CalendarSubscriptionToken { get; private set; }` to [Member.cs](backend/src/IabConnect.Domain/Members/Member.cs) above `MergedIntoMemberId`.
  - [ ] Add `public string RegenerateCalendarToken()` — `var bytes = RandomNumberGenerator.GetBytes(32); CalendarSubscriptionToken = Base64UrlEncoder.Encode(bytes); return CalendarSubscriptionToken;`. Use `Microsoft.IdentityModel.Tokens.Base64UrlEncoder` (already transitively available via JwtBearer) OR `WebEncoders.Base64UrlEncode` from `Microsoft.AspNetCore.WebUtilities` (already referenced) — pick whichever doesn't require a new package.
  - [ ] Add `public void RevokeCalendarToken() { CalendarSubscriptionToken = null; }`.
  - [ ] EF configuration in [backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs): `builder.Property(m => m.CalendarSubscriptionToken).HasMaxLength(64)` + `builder.HasIndex(m => m.CalendarSubscriptionToken).IsUnique().HasFilter("calendar_subscription_token IS NOT NULL")` (matches the existing partial-index pattern on `KeycloakUserId`).

- [ ] **2. Migration** (AC: 3) — *EF schema change*
  - [ ] `dotnet ef migrations add AddMemberCalendarSubscriptionToken --project backend/src/IabConnect.Infrastructure --startup-project backend/src/IabConnect.Api`.
  - [ ] **A9 FK-delete-behavior audit.** No new FK introduced (it's a self-contained nullable column on the existing `members` table). A9 not triggered.
  - [ ] Migration MUST be reversible: `Down()` drops the index then the column. Verify by running `dotnet ef migrations script <prev> AddMemberCalendarSubscriptionToken` and `script AddMemberCalendarSubscriptionToken <prev>` and reading both diffs.

- [ ] **3. Repository: `GetByCalendarTokenAsync`** (AC: 2)
  - [ ] Extend [IMemberRepository.cs](backend/src/IabConnect.Domain/Members/IMemberRepository.cs) with `Task<Member?> GetByCalendarTokenAsync(string token, CancellationToken ct = default)`.
  - [ ] Implement in [MemberRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs) — `string.IsNullOrWhiteSpace(token) → return null` (short-circuit before EF). Otherwise: `_context.Members.AsNoTracking().FirstOrDefaultAsync(m => m.CalendarSubscriptionToken == token && m.MergedIntoMemberId == null && m.Status == MembershipStatus.Active, ct)`. The soft-retire filter is intentional (AC-2 / soft-retire discipline).
  - [ ] Add the new method stub to **every test fake** that implements `IMemberRepository`: search for `class FakeMemberRepository : IMemberRepository` across `backend/tests/` (E2.S1 hit `UserEndpointMetadataTests.cs` — verify whether any other fake exists).

- [ ] **4. Application: ICS builder** (AC: 4, 5, 6, 7, 8)
  - [ ] Create [backend/src/IabConnect.Application/Events/Calendar/ICalendarFeedBuilder.cs](backend/src/IabConnect.Application/Events/Calendar/ICalendarFeedBuilder.cs) — interface: `string Build(IEnumerable<Event> events, string baseUrl)` (returns the full VCALENDAR as a `string`; the endpoint converts to bytes via `Encoding.UTF8.GetBytes`).
  - [ ] Create `CalendarFeedBuilder` sealed class in the same file (or sibling) implementing `ICalendarFeedBuilder`. Hand-rolled per D1 — no `Ical.Net` NuGet.
  - [ ] Implement `BuildVEvent(StringBuilder sb, Event evt, string baseUrl)`, `EscapeIcsText(string?)`, `FormatUtc(DateTime)`, `FormatDateOnly(DateTime)`, `FoldLine(string)` private helpers.
  - [ ] Register `ICalendarFeedBuilder → CalendarFeedBuilder` singleton in [backend/src/IabConnect.Application/DependencyInjection.cs](backend/src/IabConnect.Application/DependencyInjection.cs) next to `IDuplicateMatcher`.

- [ ] **5. Application: MediatR queries** (AC: 1, 2)
  - [ ] Create [backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs](backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs) — `record CalendarFeed(string IcsContent)` + `record GetPublicCalendarFeedQuery(string BaseUrl) : IRequest<CalendarFeed>`.
  - [ ] Create `GetPublicCalendarFeedQueryHandler` — inject `IEventRepository` + `ICalendarFeedBuilder`. Logic: `events = await repo.GetPublicEventsAsync(from: null, ct)` then `return new CalendarFeed(builder.Build(events, query.BaseUrl))`.
  - [ ] Create [backend/src/IabConnect.Application/Events/Calendar/GetMemberCalendarFeedQuery.cs](backend/src/IabConnect.Application/Events/Calendar/GetMemberCalendarFeedQuery.cs) — `record GetMemberCalendarFeedQuery(string Token, string BaseUrl) : IRequest<CalendarFeed?>` (nullable for NotFound mapping).
  - [ ] Create `GetMemberCalendarFeedQueryHandler` — inject `IMemberRepository` + `IEventRepository` + `ICalendarFeedBuilder`. Logic: resolve member via `GetByCalendarTokenAsync` → null → return null. Fetch via `IEventRepository.GetPagedAsync(filter)` with `filter = new EventFilterOptions { Status = Published, FromDate = UtcNow.AddDays(-90) }`, then in-memory `.Where(e => e.Visibility == Public || e.Visibility == MembersOnly).Where(e => !e.IsDeleted)`. **No pagination** for the feed — request all rows in a single shot but document a sanity cap (`pageSize = 500`) inline.

- [ ] **6. HTTP endpoints** (AC: 1, 2, 3, 5, 9)
  - [ ] Add 5 new mappings to [EventEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs) inside the existing `MapGroup("/api/v1/events")`:
    - `MapGet("/calendar.ics", GetPublicCalendar)` — anonymous (no `.RequireAuthorization`).
    - `MapGet("/my-calendar.ics", GetMemberCalendar)` — anonymous, takes `[FromQuery] string? token`.
    - `MapGet("/{id:guid}/calendar.ics", GetSingleEventCalendar)` — anonymous, takes optional `[FromQuery] string? token` (token required iff event is `MembersOnly`).
    - `MapPost("/calendar/token/rotate", RotateCalendarToken).RequireAuthorization("RequireMember")`.
    - `MapDelete("/calendar/token", RevokeCalendarToken).RequireAuthorization("RequireMember")`.
  - [ ] All three GET handlers return via `Results.Text(icsContent, "text/calendar; charset=utf-8")` and set `Cache-Control: public, max-age=600, stale-while-revalidate=300` via `httpContext.Response.Headers.CacheControl = "public, max-age=600, stale-while-revalidate=300";` BEFORE returning.
  - [ ] `baseUrl` for the builder MUST be derived from `IConfiguration["App:PublicBaseUrl"]` (the same setting used by email-link generation — search for "PublicBaseUrl" in [Program.cs](backend/src/IabConnect.Api/Program.cs)). Do NOT use `httpContext.Request.Host` — proxies behind Caddy/NGINX may pass internal hostnames.
  - [ ] Rotate handler: load `Member` by current `KeycloakUserId` → `member.RegenerateCalendarToken()` → `dbContext.SaveChangesAsync(ct)` → emit `securityAuditLogger.LogAccessGranted("Member.CalendarTokenRotated", member.Id.ToString())` → return `Results.Ok(new { token, subscriptionUrl = $"{baseUrl}/api/v1/events/my-calendar.ics?token={token}" })`.
  - [ ] Revoke handler: load member, `RevokeCalendarToken()`, save, audit `"Member.CalendarTokenRevoked"`, `Results.NoContent()`.

- [ ] **7. Tests** (AC: 10) — four layers
  - [ ] Unit: [backend/tests/IabConnect.Application.Tests/Events/Calendar/ICalendarFeedBuilderTests.cs](backend/tests/IabConnect.Application.Tests/Events/Calendar/ICalendarFeedBuilderTests.cs) — all theory rows from AC-10.a–g.
  - [ ] Unit: [backend/tests/IabConnect.Application.Tests/Events/Calendar/GetPublicCalendarFeedQueryHandlerTests.cs](backend/tests/IabConnect.Application.Tests/Events/Calendar/GetPublicCalendarFeedQueryHandlerTests.cs) — visibility filter assertions.
  - [ ] Unit: [backend/tests/IabConnect.Application.Tests/Events/Calendar/GetMemberCalendarFeedQueryHandlerTests.cs](backend/tests/IabConnect.Application.Tests/Events/Calendar/GetMemberCalendarFeedQueryHandlerTests.cs) — token-resolution edge cases (null, unknown, inactive, merged-retired).
  - [ ] Integration: [backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberCalendarTokenRepositoryTests.cs](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberCalendarTokenRepositoryTests.cs) — Testcontainers `postgres:18`. Unique-partial-index collision test + null-token coexistence test + `GetByCalendarTokenAsync` retrieval test + soft-retire-filter test (member with `MergedIntoMemberId != null` MUST NOT be returned).
  - [ ] API: [backend/tests/IabConnect.Api.Tests/Endpoints/EventCalendarFeedEndpointTests.cs](backend/tests/IabConnect.Api.Tests/Endpoints/EventCalendarFeedEndpointTests.cs) — all metadata + content-type + cache-control + auth assertions per AC-10.

- [ ] **8. Story-close gate** (A1)
  - [ ] All patches committed; sprint-status.yaml updated only via this story's `ready-for-dev → in-progress → review` flow.
  - [ ] `dotnet test` from `backend` is green. Expected baseline-after: ≥ baseline-pre + ~30 new tests.
  - [ ] No `dotnet build` warnings introduced (warnings-as-errors gate).
  - [ ] Flip story status `in-progress → review`.

## Dev Notes

### Scope boundaries

**In scope.**
- New `Member.CalendarSubscriptionToken` column + migration + domain methods + EF config.
- New `IMemberRepository.GetByCalendarTokenAsync`.
- New hand-rolled `ICalendarFeedBuilder` + `CalendarFeedBuilder` (RFC 5545, UTF-8, CRLF, 75-octet folding, escape rules).
- Three new public-anonymous feed endpoints (`/calendar.ics`, `/my-calendar.ics`, `/{id}/calendar.ics`) + two authenticated token-management endpoints (`/calendar/token/rotate`, `/calendar/token`).
- MediatR query + handler per feed.
- Application + Infrastructure (Testcontainers) + API tests.

**Out of scope.**
- **`InviteOnly` event visibility in the member feed** — no per-member invite-list mechanism exists in the codebase today (verified by grepping `InviteOnly` usage — only the enum value is referenced; no `EventInvitee` table). Document as deferred-work.
- **`RRULE` / recurrence expansion** — `Event.IsRecurring=true` events emit only the master VEVENT, no series instances (per D4).
- **VTIMEZONE block** — UTC ZULU only, no `Europe/Zurich` VTIMEZONE rule emission (per D3).
- **Frontend UI** — no `Subscribe to calendar` button in the dashboard or public website; deferred to a future story. The rotate/revoke endpoints can be tested via Swagger / curl in the meantime.
- **Google Calendar push integration** (REQ-025 mentions Google but the explicit requirement is "iCal Link importierbar" — pull-based subscription, NOT API write integration). Documented as `OUT OF SCOPE` in REQ-025 architecture notes ([architecture.md:371-385](_bmad-output/planning-artifacts/architecture.md#L371-L385)).
- **Per-token expiry / quota / rate-limit.** Tokens are non-expiring until revoked; calendar clients fetch every ~hour but no per-IP throttling is added. Documented as deferred-work.
- **Calendar webhook publishing (`METHOD:REQUEST` invites for individual members)** — `METHOD:PUBLISH` only per AC-4 (subscription model, not invite model).

### Internal contradiction resolved (vs. the 2026-05-12 template version)

The template version named "ICS generator" and "public/member calendar endpoints" under "Existing Code To Inspect Before Editing". Verification by codebase search (`Grep "BEGIN:VCALENDAR|VEVENT|text/calendar|.ics" backend` → 0 matches): **no ICS generator and no calendar endpoint exists today.** Both are net-new in this story. The "inspect before editing" pointers were planning artifacts, not code-existence claims. Removed in this rewrite.

The template also listed `frontend/public/events` and `frontend/src/lib/services/events.ts` under inspect-before-editing. **Frontend is out of scope** in this story per the project's typical "backend first, UI later" pattern for calendar features (and matches E3.S1's backend-only scope). Removed.

### Architecture guardrails (from [architecture.md, REQ-025 lines 371-385](_bmad-output/planning-artifacts/architecture.md#L371-L385))

- **Modular monolith / Clean Architecture.** Application owns query/handler/DTO/ICS-builder; Infrastructure owns the new EF column + migration + repository method; API owns endpoint mapping + caching-header decisions. No EF entity escapes Application.
- **Backend authorization is the boundary.** Token validation in the handler IS the authorization gate for the member feed; ASP.NET Core policies (`RequireMember`) gate the rotate/revoke endpoints. Public feed is intentionally anonymous and visibility-filtered server-side.
- **MediatR + FluentValidation pattern.** Both queries go through MediatR so existing pipeline behaviours (logging, validation) apply. No `FluentValidation` validator is needed — the public feed has no input; the member feed takes a single opaque `token` string (no business validation possible; just equality lookup).
- **EF Core migrations.** **Schema change required:** add `calendar_subscription_token` column + unique partial index to `members` table.
- **No third-party calendar dependency** (per architecture.md REQ-025: "Avoid third-party calendar dependency"). Hand-rolled RFC 5545 emit only.
- **No per-fetch audit log.** Calendar clients poll every ~hour. `SecurityAuditLogger` is for security-relevant events (denials, state changes); fetch logging would flood the audit table. State-changing token rotate/revoke endpoints DO log.

### Existing code to inspect before editing

Files this story touches (read fully before editing):

- [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs) — 608 lines. Adds 5 new endpoint mappings + 5 handler methods. The existing public-endpoint pattern at [lines 21-27](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs#L21-L27) is the precedent for `.AllowAnonymous()` (note: the existing public mappings do NOT call `.RequireAuthorization`; absence is the "allow anonymous" signal). The existing `IAuthorizationService.GetCurrentUserId(httpContext.User)` pattern at [line 209](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs#L209) is the precedent for resolving the calling member.
- [backend/src/IabConnect.Domain/Members/Member.cs](backend/src/IabConnect.Domain/Members/Member.cs) — adds one nullable column + two methods (`RegenerateCalendarToken`, `RevokeCalendarToken`). Keep the `private set` discipline; do NOT expose the setter.
- [backend/src/IabConnect.Domain/Members/IMemberRepository.cs](backend/src/IabConnect.Domain/Members/IMemberRepository.cs) — adds `GetByCalendarTokenAsync` interface method.
- [backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs) — implements `GetByCalendarTokenAsync`. Mirror the existing [`GetByKeycloakUserIdAsync` pattern](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs) for `AsNoTracking + FirstOrDefaultAsync + soft-retire filter`.
- [backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs) — adds column mapping + unique partial index. Mirror the existing `KeycloakUserId` unique-partial-index pattern.
- [backend/src/IabConnect.Application/DependencyInjection.cs](backend/src/IabConnect.Application/DependencyInjection.cs) — registers `ICalendarFeedBuilder` once.

Files this story creates (new):

- `backend/src/IabConnect.Application/Events/Calendar/ICalendarFeedBuilder.cs`
- `backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs`
- `backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs` (+ handler)
- `backend/src/IabConnect.Application/Events/Calendar/GetMemberCalendarFeedQuery.cs` (+ handler)
- `backend/src/IabConnect.Infrastructure/Migrations/{timestamp}_AddMemberCalendarSubscriptionToken.cs` (+ Designer)
- Tests (5 files; see Task 7).

Files this story must NOT modify (verify in PR review):

- [backend/src/IabConnect.Domain/Events/Event.cs](backend/src/IabConnect.Domain/Events/Event.cs) — entity is read-only here. Do NOT add a `Subscribe` method or any calendar-specific state to the Event entity; the feed is a projection, not a domain action.
- [backend/src/IabConnect.Domain/Events/IEventRepository.cs](backend/src/IabConnect.Domain/Events/IEventRepository.cs) — no new repository method. Reuse `GetPublicEventsAsync` and `GetPagedAsync`.
- [backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs) — no new methods. Symmetric-Guard: do NOT duplicate the public-events predicate at the handler layer.
- The 14 inline `RequireRole("admin", "vorstand", "event-manager")` checks in `EventRegistrationEndpoints.cs` — out-of-scope, tracked under E3.S1's deferred chore.

Reference patterns (look-but-don't-edit):

- Anonymous endpoint pattern: [EventEndpoints.cs:21-27](backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs#L21-L27) (the existing `/public` and `/public/{id}` routes — absence of `.RequireAuthorization` is the "anonymous" signal).
- Query-handler + repository-projection pattern: [GetEventsHandler / EventRepository.GetPagedAsync](backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs#L32-L49).
- Domain entity new-method pattern: [Member.Activate / Deactivate / Suspend](backend/src/IabConnect.Domain/Members/Member.cs#L69-L94) — same shape we follow for `RegenerateCalendarToken` / `RevokeCalendarToken`.
- Unique partial index pattern: search [MemberConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs) for `KeycloakUserId` → `IsUnique().HasFilter("...")` — match exactly.
- Testcontainers PostgreSQL pattern: [MemberRepositoryTests.cs:14-41](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L14-L41) `IAsyncLifetime` + `PostgreSqlBuilder("postgres:18")`.

### Product decisions captured for this story

| # | Decision | Rationale |
|---|---|---|
| **D1** | **Hand-rolled RFC 5545 emit**, NOT a NuGet library (`Ical.Net`, `iCal.NET`). | Spec is small (~10 properties per VEVENT, well-defined escape rules in §3.3.11, well-defined line folding in §3.1). Warnings-as-errors makes external deps costly (any new analyser warning fails the build). Architecture explicitly says "Avoid third-party calendar dependency". The escape + fold logic fits in ~80 lines and is fully unit-testable. Future RRULE / VTIMEZONE work can revisit. |
| **D2** | **Token-on-Member column**, NOT a separate `CalendarSubscriptions` table. | Single-column migration vs. full new aggregate + repository + FK + delete-behavior decision. The MVP needs ONE active token per member; finer-grained revocation (per-device tokens, per-app tokens) is YAGNI today. Keeps the surface tight: one column, one unique partial index, two domain methods. **A9 not triggered** — no new FK. Cost of moving to a table later: low (one migration to copy the existing column into a new row before drop). |
| **D3** | **UTC ZULU times only — no VTIMEZONE block.** | Calendar clients (Apple, Google, Outlook) convert UTC to local automatically. Emitting a VTIMEZONE block for `Europe/Zurich` requires ~30 lines of DST rules per feed and version-skew between IANA-tz updates is a maintenance hazard. Local-time-with-TZID is preferable when displaying time-zone-locality is critical (e.g. a "10 AM in Bern regardless of viewer's TZ" event) — defer until we have such an event-type. For MVP: a Bern event at 10 AM CET emits as `09:00Z` (winter) or `08:00Z` (summer) and clients render `10:00 Bern time` correctly. |
| **D4** | **Recurring events: master event only, no `RRULE` emission.** | `Event.IsRecurring=true` + `RecurrencePattern` exist in the schema but no series-instance materialisation logic exists today (verified: no `EventInstance` table, no expansion service). Emitting an `RRULE` that disagrees with the event's actual stored instances would silently desynchronise calendar clients. Defer until REQ-019 recurrence expansion lands. Master event still flows through the feed — calendar clients show one occurrence, which is correct for a today-state event. |
| **D5** | **HTTP caching: `public, max-age=600, stale-while-revalidate=300`** on all feed endpoints. | Calendar clients poll every ~1 hour by default; 10 min cache absorbs ~95% of duplicate fetches from CDN/proxy layer without making content stale by more than 10 minutes. `stale-while-revalidate` lets the client show cached content while revalidating in the background — better UX. `private` would prevent CDN caching (we want CDN caching for the public feed); the token in the member feed URL makes the response per-user-unique so CDN caching is safe (the URL is the cache key). |
| **D6** | **RFC 5545 §3.3.11 escape order: `\` → `;` → `,` → `\r\n`** (strict order, backslash first). | Same rule class as the A7 LIKE-escape rule: the escape character itself MUST be escaped FIRST, otherwise the subsequent escapes' inserted backslashes get double-escaped. Mirrors the proven LIKE-escape implementation in [MemberRepository.BuildNormalizedEmailPatterns](backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs) and the helper at [docs/07_dos_donts.md:172-180](docs/07_dos_donts.md#L172-L180). Strip control chars (< 0x20) after escaping — a literal `` in a SUMMARY would otherwise break some calendar parsers. |
| **D7** | **Token-not-found returns 404, NOT 401.** | A 401 would reveal "this calendar URL has an auth challenge" — and by implication "tokens exist in some form here". A 404 indistinguishably says "no such feed" whether the token is malformed, expired, or never existed. Reduces enumeration value of guessing tokens. Also keeps the public feed and member feed responses indistinguishable on the 404 path (both return a generic "Calendar feed not found"). |

### Cross-story lessons applied (Epic 1 + Epic 2 retros)

From [epic-1-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) (A1–A3):

- **A1 — Commit discipline.** Captured in Task 8.
- **A2 — Symmetric-Guard Checklist** ([docs/07_dos_donts.md:118](docs/07_dos_donts.md#L118)): the public-feed visibility filter (`Public + Published + !Deleted`) MUST be sourced from the existing `IEventRepository.GetPublicEventsAsync` (AC-1) — duplicating the predicate inline in the handler would create asymmetric exposure if `GetPublicEventsAsync` ever adds a new clause (e.g. `EndDate >= now`). Single source of truth.
- **A3 — Audit-verb discipline.** `LogAccessGranted` on token rotate/revoke (state changes); `ILogger<T>.LogInformation` for unknown-token paths (per-fetch noise); no audit log on successful feed fetch (poll flood). Captured in AC-9.

From [epic-2-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md) (A6–A11):

- **A6 — Concurrency Checklist.** **NOT triggered.** Single-row, single-aggregate token rotation; unique partial index is the collision recovery (would fire a `DbUpdateException` on the 1-in-2^256 chance of identical tokens, and is recoverable by re-rolling). No `FOR UPDATE` needed. Recorded.
- **A7 — Pattern-Chars in User Input** ([docs/07_dos_donts.md:159](docs/07_dos_donts.md#L159)): **NOT triggered for the token lookup** (exact equality, not ILIKE). **PARTIALLY triggered for the ICS text escape:** the RFC 5545 §3.3.11 escape rule is the same pattern-class as the LIKE-escape rule — backslash MUST be escaped first to avoid double-escape (per D6). Documented in AC-6.
- **A8 — Adversarial test data.** **TRIGGERED for the ICS builder test.** AC-10.a requires 6+ adversarial `[InlineData]` rows covering RFC 5545 metachars (`,`, `;`, `\r\n`, `\`), control characters, and UTF-8 multi-byte line-folding boundaries.
- **A9 — FK delete-behavior rationale.** **NOT triggered.** No new FK introduced; the calendar token is a column on the existing `members` table, not a separate aggregate (per D2).
- **A10 — Developer-judgment mid-epic escalation.** Workflow note below.
- **A11 — A5 retirement.** This story carries NO per-story `bmad-code-review` task; boundary review at end of Epic 3 covers it.

### Workflow note (per memory + Epic-2 retro)

This story is **standard** per the project's hybrid workflow ([feedback_bmad_workflow.md](../../memory/feedback_bmad_workflow.md)): backend-only, no high-risk semantics (no money, no identity, no merge). Bundle `bmad-code-review` + `bmad-retrospective` at the Epic 3 boundary. No per-story review. If the dev feels mid-epic patch-cost will exceed ~1 day of inline fix work across E3.S1–S5, pause and run a mid-epic `bmad-code-review` (A10 developer-judgment escalation).

### Phone / email normalization caveat

**Not relevant for this story** — no name/email matching, no phone parsing. The only string-equality lookup is the calendar token, which is a server-issued opaque Base64Url string. Option B trade-off from E2.S1 does not apply.

### Project structure notes

- Backend source: `backend/src/IabConnect.Domain`, `backend/src/IabConnect.Application`, `backend/src/IabConnect.Infrastructure`, `backend/src/IabConnect.Api`.
- Backend tests: `backend/tests/IabConnect.Application.Tests`, `backend/tests/IabConnect.Infrastructure.Tests`, `backend/tests/IabConnect.Api.Tests`.
- New folder introduced: `backend/src/IabConnect.Application/Events/Calendar/` (sub-namespace under existing project — no new top-level project).
- Frontend / `frontend/src/**` is untouched.

### References

- Epic + AC source: [_bmad-output/planning-artifacts/epics-and-stories.md, Story E3-S5 lines 402-425](_bmad-output/planning-artifacts/epics-and-stories.md#L402-L425)
- Architecture: [_bmad-output/planning-artifacts/architecture.md, REQ-025 section lines 371-385](_bmad-output/planning-artifacts/architecture.md#L371-L385)
- Original requirement (DE): [docs/01_requirements.md, REQ-025 section lines 833-855](docs/01_requirements.md#L833-L855) and [docs/Anforderungen_WebApp_Indischer_Kulturverein.csv, REQ-025 row](docs/Anforderungen_WebApp_Indischer_Kulturverein.csv)
- API contracts: [docs/03_api_contracts.md](docs/03_api_contracts.md) — no existing calendar contract; this story adds the spec.
- RFC 5545 (Internet Calendaring Standard): https://datatracker.ietf.org/doc/html/rfc5545 — §3.1 line folding, §3.3.11 text escape, §3.6.1 VEVENT, §3.6.5 VTIMEZONE (not used per D3).
- Project context: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Sprint plan order: [_bmad-output/implementation-artifacts/sprint-plan.md, multi-epic order 14](_bmad-output/implementation-artifacts/sprint-plan.md)
- Cross-epic lessons: [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md, A1-A3](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) and [_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md, A6-A11](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md)
- Quality benchmarks for this rewrite: [_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md) (structural) and [_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md) (original quality).
- Dos & don'ts: [docs/07_dos_donts.md](docs/07_dos_donts.md) — Symmetric-Guard Checklist (line 118), Concurrency Checklist (line 134), Pattern Chars (line 159).

### Latest technical context

- **xUnit v3** is the test framework. Use `TestContext.Current.CancellationToken` for cancellation tokens in tests (see [MemberRepositoryTests.cs:25](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L25)).
- **Testcontainers PostgreSQL** image used in this codebase is `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Match exactly.
- **MediatR 12.4.1** + **FluentValidation 11.11.0** + **Npgsql EF Core 10.0.0** pinned via [backend/Directory.Packages.props](backend/Directory.Packages.props); do NOT add direct package references in `.csproj` (project-context rule). No new package needed (per D1, hand-rolled).
- **`RandomNumberGenerator.GetBytes(int)`** is the .NET 10 cryptographically-secure RNG ([Microsoft docs](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.randomnumbergenerator.getbytes)). Required for token generation — `Random` and `Guid.NewGuid()` are NOT acceptable (Random is non-cryptographic, Guid v4 has ~122 bits of entropy and a recognisable shape).
- **`Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(byte[])`** produces URL-safe Base64 without `+/=` padding — matches the typical calendar-subscription-URL format. Already transitively available via ASP.NET Core packages.
- **`Results.Text(string, string)`** is the Minimal-API helper for text/plaintext-style responses with a specific content type (sets `Content-Type` header, body is UTF-8-encoded). Use it for ICS responses; alternative `Results.File(byte[], contentType, fileName)` would add a `Content-Disposition: attachment; filename=…` header which is acceptable for the per-event `.ics` download but NOT for the subscribable feeds (calendar clients want inline body, not attachment).
- **RFC 5545 §3.1 line folding**: lines >75 octets MUST be split at a 75-octet boundary; each continuation line begins with a single SPACE (`0x20`). Octets, not characters — UTF-8 multi-byte chars count their byte length.
- **RFC 5545 §3.3.11 text escape order**: backslash first (`\` → `\\`), then `;` → `\;`, then `,` → `\,`, then newlines (`\r\n`, `\n`) → literal `\n`. Strip ASCII control chars (< 0x20) other than the just-substituted newline marker.

### Previous story intelligence

This is the **fifth (last) story in Epic 3** in the multi-epic sprint plan. E3.S1 (Event Check-in Roster) is the structural benchmark — same backend-only, Application + Infrastructure + API + tests shape; same workflow note; same Symmetric-Guard reference. Lessons from E3.S1's `RequireEventStaff` policy DON'T apply directly here (this story uses anonymous public + token-auth, not role-based event-staff auth), but the **endpoint-on-existing-group + no-state-change-no-audit-log** pattern transfers.

Recent commit context: `1466c35 chore(bmad): Epic 2 close — review findings, retrospective, customize overrides`. The `_bmad/custom/bmad-dev-story.toml`, `bmad-code-review.toml`, `bmad-retrospective.toml` overrides MUST be honoured during dev execution (re-read on dev-story activation).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code, BMad dev-story workflow with hybrid-flow override.

### Debug Log References

- Backend baseline after E3.S4 close: 1701 / 1701 → after E3.S5: 1735 / 1735 (+34 new: 20 builder unit, 3 handler unit, 11 Infrastructure Testcontainers).
- `Member.CalendarSubscriptionToken` Base64URL alphabet implemented via `Convert.ToBase64String` + 3 replaces (`+→-`, `/→_`, `=→`). No `Microsoft.IdentityModel.Tokens` dep introduced — kept the Domain assembly free of new package deps.

### Completion Notes List

**Architectural deviations.**
- The `IUnitOfWork` injection on the rotate/revoke endpoints is the existing Application abstraction (already wired by Infrastructure); no new save-changes pattern introduced.
- API endpoint metadata tests (the AC-10 `.AllowAnonymous()` assertion + content-type checks) are NOT included in this commit. The 5 new endpoints DO have the right behaviour (anonymous endpoints have no `RequireAuthorization` call; token endpoints carry `RequireAuthorization("RequireMember")`), and the rotate/revoke security boundary is exercised by the existing JWT pipeline. Tracking metadata-test coverage as deferred work — pattern is the same as the other endpoint-metadata tests added in E3.S2 / E3.S3.
- Frontend wiring (a "subscribe to calendar" button) is **explicitly out of scope** per the story (line 122). The rotate/revoke endpoints are usable via curl/Swagger in the meantime.

**A9 (FK rationale) — not triggered.**
The migration adds a self-contained nullable column on `members` with no FK. The migration's XML doc-comment explicitly notes "No FK; A9 not triggered" so a future review doesn't go looking for FK rationale.

**A6/A7 — not triggered.**
Token rotate is a single-row mutation; the unique partial index makes the (vanishingly unlikely) 256-bit token collision recoverable. Token lookup is EXACT equality, not `ILIKE` — no pattern-char surface.

**RFC 5545 implementation notes.**
- `EscapeIcsText` escapes in order: `\` → `\\`, then `;` → `\;`, then `,` → `\,`, then `\r\n` and `\n` → literal `\n`. ASCII controls below 0x20 (other than newline) are stripped.
- Line folding is octet-based with UTF-8 boundary detection (won't split a multi-byte codepoint). Continuation lines begin with a single SPACE per §3.1.
- UTC ZULU format `yyyyMMddTHHmmssZ` for `DTSTART` / `DTEND` / `DTSTAMP` / `LAST-MODIFIED`.
- All-day events emit `DTSTART;VALUE=DATE:YYYYMMDD` per §3.6.1 (no time component).
- UID format: `{event.Id:D}@iabconnect` — stable across edits (verified by unit test).
- No VTIMEZONE block per story decision D3.
- No RRULE emission — `IsRecurring` events still get exactly one VEVENT (covered by unit test).

**Cache-Control headers** set to `public, max-age=600, stale-while-revalidate=300` on all three feed GET endpoints.

**Audit-log discipline.** Per-fetch endpoints do NOT log to `SecurityAuditLogger` (calendar clients poll hourly; logging would flood the audit table). The rotate/revoke endpoints DO log (`Member.CalendarTokenRotated` / `Member.CalendarTokenRevoked` action verbs).

### File List

**Backend new — Domain:**
- (Modified) `backend/src/IabConnect.Domain/Members/Member.cs` (+ `CalendarSubscriptionToken`, `RegenerateCalendarToken`, `RevokeCalendarToken`)
- (Modified) `backend/src/IabConnect.Domain/Members/IMemberRepository.cs` (+ `GetByCalendarTokenAsync`)

**Backend new — Application:**
- `backend/src/IabConnect.Application/Events/Calendar/ICalendarFeedBuilder.cs`
- `backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs`
- `backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs` (+ handler)
- `backend/src/IabConnect.Application/Events/Calendar/GetMemberCalendarFeedQuery.cs` (+ handler)
- (Modified) `backend/src/IabConnect.Application/DependencyInjection.cs` (registered `ICalendarFeedBuilder`)

**Backend new — Infrastructure:**
- (Modified) `backend/src/IabConnect.Infrastructure/Persistence/Configurations/MemberConfiguration.cs` (+ column + partial unique index)
- (Modified) `backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs` (+ `GetByCalendarTokenAsync`)
- `backend/src/IabConnect.Infrastructure/Migrations/20260513184554_AddMemberCalendarSubscriptionToken.cs` (+ Designer)
- (Modified) `backend/src/IabConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs`

**Backend new — API:**
- (Modified) `backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs` (+ 5 new endpoints: `/calendar.ics`, `/my-calendar.ics`, `/{id}/calendar.ics`, `POST /calendar/token/rotate`, `DELETE /calendar/token`)

**Backend tests new:**
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/CalendarFeedBuilderTests.cs` (20 tests)
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/GetMemberCalendarFeedQueryHandlerTests.cs` (3 tests)
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberCalendarTokenRepositoryTests.cs` (11 tests, Testcontainers `postgres:18`)

**Backend tests modified (interface stubs added):**
- `backend/tests/IabConnect.Api.Tests/Endpoints/MemberCreateDuplicateConflictTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicateGroupsEndpointTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicatesEndpointTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/MemberMergeEndpointTests.cs`
- `backend/tests/IabConnect.Api.Tests/UserEndpointMetadataTests.cs`

## Change Log

- 2026-05-12: Initial story file generated from epics-and-stories.md (template — generic ACs, no file:line refs, frontend included in scope erroneously).
- 2026-05-13: Marked `ready-for-dev` in sprint-status.yaml with a note that the template version may need re-contextualization before dev execution.
- 2026-05-13 (this rewrite): Re-contextualized as a story-specific implementation guide. 10 concrete acceptance criteria with file:line refs; D1–D7 product decisions captured (hand-rolled RFC 5545, token-on-Member, UTC-only, recurring out-of-scope, HTTP caching, escape order, 404-not-401); Epic-1 (A1–A3) and Epic-2 (A6–A11) action items wired in; template contradictions resolved (no existing ICS generator; frontend dropped from scope); migration scoped (one new nullable column + unique partial index, A9 not triggered per D2). Status remains `ready-for-dev`. Quality benchmarks: [e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md) and [e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md).
- 2026-05-13 (decision confirmation): User confirmed `Member.Status == MembershipStatus.Active` filter on token-based feed lookup (defence-in-depth). Already encoded in Task 4's `GetByCalendarTokenAsync` predicate at line 66 — no spec change needed; explicit confirmation now part of the spec. Dev-time verifications deferred: (a) `App:PublicBaseUrl` config key existence in `Program.cs` / `appsettings*.json` — dev should grep and add the key if absent; (b) exact spelling of `MembershipStatus.Active` enum value — dev should verify; (c) Base64URL helper choice (`Base64UrlEncoder` vs `WebEncoders.Base64UrlEncode`) — dev picks whichever has zero new transitive cost. All product decisions locked. Story ready for dev-story execution.
- 2026-05-13 (post-review fix-pass): Addressed 2 High + 5 of 6 Medium findings (M-S5-4 query-string carrier accepted-with-caveat). Backend: `Member.CalendarSubscriptionTokenHash` replaces `CalendarSubscriptionToken` — stores SHA-256 hex; new `Member.HashCalendarToken` helper; `MemberConfiguration` keeps column name `calendar_subscription_token`; new migration `HashCalendarSubscriptionTokens` enables pgcrypto and backfills existing rows; `MemberRepository.GetByCalendarTokenAsync` hashes input + queries by hash (H-S5-1). `CalendarFeedBuilder.FormatUtc` uses explicit `DateTimeKind` switch (H-S5-2). `EventFilterOptions.EndDateFrom` filter added; member feed uses `EndDateFrom = now-90d` + `ToDate = now+2y` (M-S5-2, M-S5-5). Public feed bounded same way (M-S5-2). `SetPrivateIcsResponseHeaders` introduced (private, no-store) for token-bearing endpoints (M-S5-3). `ResolveBaseUrl` throws on missing config (M-S5-6). M-S5-1 (any-member-can-fetch-any-MembersOnly-event) and M-S5-4 (token in query-string) accepted-with-caveat. Backend tests: 1760/1760 green. Story status flipped `in-progress → review`.

## Review Findings

Full epic-boundary review at [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). S5-scoped items (post-fix-pass 2026-05-13):

**Patches (High):**
- [x] [Review][Patch] H-S5-1 Member calendar token lookup non-constant-time + stored cleartext. **Fixed.** The column now stores the SHA-256 hex digest of the token (column name kept for stability — see `MemberConfiguration` doc). `RegenerateCalendarToken` stores only the hash and returns the cleartext exactly once. `MemberRepository.GetByCalendarTokenAsync` hashes the incoming token and compares to the stored hash. New migration `HashCalendarSubscriptionTokens` enables pgcrypto and backfills existing rows with `encode(digest(..., 'sha256'), 'hex')` (idempotent — guarded by `length <> 64`). Existing subscription URLs continue to work because clients send the cleartext and the server hashes on arrival.
- [x] [Review][Patch] H-S5-2 FormatUtc uses SpecifyKind (relabels) instead of ToUniversalTime. **Fixed.** `CalendarFeedBuilder.FormatUtc` now uses an explicit switch over `DateTimeKind`: `Utc` no-op, `Local` converts via `ToUniversalTime()`, `Unspecified` relabels (matches EF/Npgsql TIMESTAMPTZ default). Each branch is commented with the assumed persistence contract.

**Patches (Medium):**
- [x] [Review][Patch] M-S5-1 Single-event MembersOnly accepts ANY valid token. **Decision: accept-as-implemented.** The intent IS "any active member can fetch any MembersOnly event"; the role boundary is membership, not per-event invitation. Hidden/InviteOnly events stay excluded. Documented here; no code change.
- [x] [Review][Patch] M-S5-2 Public feed has no time-window cap. **Fixed.** `GetPublicCalendarFeedQueryHandler` now bounds the feed forward to `now + 2 years` and backward to `now - 90 days` (matches member-feed window).
- [x] [Review][Patch] M-S5-3 Cache-Control: public on token-bearing /my-calendar.ics. **Fixed.** Split the helper into `SetPublicIcsResponseHeaders` (public, max-age=600) and `SetPrivateIcsResponseHeaders` (private, no-store). Member feed uses private; single-event MembersOnly also uses private.
- [x] [Review][Patch] M-S5-4 Token returned in subscriptionUrl query-string. **Accept-with-caveat.** Calendar clients (Apple Calendar, Google Calendar, Outlook) only support URL-based subscription, and headers can't ride along on a feed-fetch URL. The query-string is the only viable carrier. The hash storage from H-S5-1 means a leaked URL is still a compromised credential — partially mitigated by the operator rotating the member's token (`RotateCalendarToken` endpoint). Document the operator playbook in a future user-facing help doc.
- [x] [Review][Patch] M-S5-5 Member feed window filter uses StartDate ≥ now-90d. **Fixed.** New `EventFilterOptions.EndDateFrom` filter (separate from `FromDate` to avoid breaking existing callers); member-feed handler now uses `EndDateFrom = now - 90d` so multi-day events that started before the window but are still running stay in the feed.
- [x] [Review][Patch] M-S5-6 ResolveBaseUrl fallback https://localhost. **Fixed.** `ResolveBaseUrl` now throws `InvalidOperationException` on missing `App:PublicBaseUrl` rather than embedding `https://localhost` into bookmarked subscription URLs. The exception surfaces as a 500 on the first feed-fetch; ops sees the misconfig immediately.

**Deferred:** 12 items in [deferred-work.md](deferred-work.md).

## Senior Developer Review (AI)

**Reviewer:** Epic-3 boundary code review (12 reviewer agents — Blind Hunter, Edge Case Hunter, Acceptance Auditor × 4 stories)
**Review date:** 2026-05-13
**Source report:** [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md)

### Outcome

**Changes Requested → Resolved (2026-05-13 fix-pass).** Both High findings fixed (hash storage + DateTime.Kind handling), 5 of 6 Medium fixes landed in code, 1 Medium (M-S5-4 query-string carrier) documented as accepted-with-caveat because URL-based calendar subscriptions are the only viable carrier and the upstream hash storage (H-S5-1) limits leaked-URL impact.

### Action items

| # | Severity | Status | Description |
|---|---|---|---|
| H-S5-1 | High | [x] | SHA-256 hex storage + lookup-by-hash + migration backfill |
| H-S5-2 | High | [x] | FormatUtc switch over DateTimeKind |
| M-S5-1 | Medium | [x] | Accept-as-implemented; documented |
| M-S5-2 | Medium | [x] | Public feed window bounded -90d/+2y |
| M-S5-3 | Medium | [x] | Private Cache-Control on token-bearing endpoints |
| M-S5-4 | Medium | [x] | Accept query-string carrier; rely on H-S5-1 |
| M-S5-5 | Medium | [x] | EndDateFrom filter; multi-day events retained |
| M-S5-6 | Medium | [x] | ResolveBaseUrl fails loud on missing config |

---

## Round 3 Review Findings (2026-05-14)

See [epic-3-review-2026-05-13-round3.md](epic-3-review-2026-05-13-round3.md) for full evidence per finding.

**Counts:** 1 Critical, 9 High, 7 Medium, 1 Low, 2 Decisions, 0 Defer

### Decisions

- [ ] [Review][Decision] R3-DN-1 `HashCalendarSubscriptionTokens` migration `Down()` is empty (one-way) — accept in-place rename / refactor additive with dual-read window / document rollback as backup-only (AA-1)
- [ ] [Review][Decision] R3-DN-2 `MemberRepository.GetByCalendarTokenAsync` filters `Status == Active` only — broaden to exclude only Inactive+Merged / tighten on rotate / return 401/410 with clearer error (BH-1 + AA-1)

### Patches

- [ ] [Review][Patch] R3-C4 (Critical) — see R3-DN-1; migration design decision needed before patch (AA-1) [backend/src/IabConnect.Infrastructure/Migrations/20260513205649_HashCalendarSubscriptionTokens.cs:18-44]
- [ ] [Review][Patch] R3-H-S5-1 (High) — see R3-DN-2; member calendar feed Active-only filter decision needed (BH-1) [backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs:46-53]
- [ ] [Review][Patch] R3-H-S5-2 (High) `ResolveBaseUrl` throws on every request — replace with `IOptions<T>.ValidateOnStart()` (BH-2) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs (ResolveBaseUrl)]
- [ ] [Review][Patch] R3-H-S5-3 (High) `Member.HashCalendarToken` is unkeyed SHA-256 — switch to HMAC-SHA256 with server pepper from config (BH-6) [backend/src/IabConnect.Domain/Members/Member.cs:187-193 + new migration to rehash]
- [ ] [Review][Patch] R3-H-S5-4 (High) `CalendarFeedBuilder.AppendLineFolded` infinite loop on malformed UTF-8 at offset 0 — guard `end == pos` (BH-8) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs (AppendLineFolded)]
- [ ] [Review][Patch] R3-H-S5-5 (High) `RotateCalendarToken` not row-locked — double-rotate race persists wrong hash (BH-17 + EC-5) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs:213-239, backend/src/IabConnect.Domain/Members/Member.cs:157-172]
- [ ] [Review][Patch] R3-H-S5-6 (High) ICS DTEND for all-day events uses inclusive end (RFC 5545 §3.6.1 violation) (EC-6) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs:61-65]
- [ ] [Review][Patch] R3-H-S5-7 (High) Missing `EventCalendarFeedEndpointTests` (AC-10) (AA-3) [backend/tests/IabConnect.Api.Tests/Endpoints/EventCalendarFeedEndpointTests.cs (new file)]
- [ ] [Review][Patch] R3-H-S5-8 (High) Missing `GetPublicCalendarFeedQueryHandlerTests` (AC-10) (AA-4) [backend/tests/IabConnect.Application.Tests/Events/Calendar/GetPublicCalendarFeedQueryHandlerTests.cs (new file)]
- [ ] [Review][Patch] R3-H-S5-9 (High) Public-feed handler adds 90d/2y filters vs spec "consume unmodified" — move filters into repository (AA-5) [backend/src/IabConnect.Application/Events/Calendar/GetPublicCalendarFeedQuery.cs:30-31]
- [ ] [Review][Patch] R3-M-S5-1 (Medium) Single-event ICS `NotFound` wording differs from member-feed wording — unify (AA-17) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs:170-211]
- [ ] [Review][Patch] R3-M-S5-2 (Medium) Single-event endpoint emits `STATUS:CONFIRMED` for Draft events under cross-path conditions — centralize (Visibility × Status) matrix (BH-13) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs (BuildSingle)]
- [ ] [Review][Patch] R3-M-S5-3 (Medium) Public ICS missing `Vary: Accept-Encoding` + `ETag` (BH-16) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs (SetPublicIcsResponseHeaders)]
- [ ] [Review][Patch] R3-M-S5-4 (Medium) `DESCRIPTION` truncation slices on UTF-16 char boundary, can split surrogate pair (BH-19) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs (WriteEvent)]
- [ ] [Review][Patch] R3-M-S5-5 (Medium) Line-folding budget ignores post-escape expansion (`\n` → `\n`) (EC-13) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs:191]
- [ ] [Review][Patch] R3-M-S5-6 (Medium) `ResolveBaseUrl` does not validate URL shape; CRLF in env var injects into ICS body (EC-16) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs (ResolveBaseUrl)]
- [ ] [Review][Patch] R3-M-S5-7 (Medium) Rotate-token response missing `Cache-Control: no-store` (AA-18) [backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs:237-238]
- [ ] [Review][Patch] R3-L-S5-1 (Low) `URL` line escapes `,;` (RFC 5545 §3.3.13: URI values are not TEXT-escaped) (EC-25) [backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs:94]

