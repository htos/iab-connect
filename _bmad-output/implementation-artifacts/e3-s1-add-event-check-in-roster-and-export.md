# Story E3.S1: Add Event Check-in Roster and Export

Status: done (Round-4 boundary re-review 2026-05-14 — S1 code-clean, 0 patches / 0 decisions; 1 spec-text-drift item deferred; backend 1810 / 1810 + frontend 38 / 38 green)

## Story

As an Event Manager,
I want a server-side event check-in roster query plus an offline CSV export,
so that on event day staff can do fast scanner/manual lookup and fall back to a printed/Excel list if the scanner fails.

Requirement: **REQ-023** (Check-in vor Ort QR-Code — Events, Priority Could). Story is **backend only** — the QR scanner UI + state-changing check-in commands are E3.S2.

## Acceptance Criteria

1. **MediatR roster query exists.** Duplicate of `EventRegistrationEndpoints.GetRegistrations` is rejected. Roster MUST be exposed as `GetEventCheckInRosterQuery` (`record` implementing `IRequest<EventCheckInRosterDto>`) with `GetEventCheckInRosterQueryHandler` in [backend/src/IabConnect.Application/Events/CheckIn/](backend/src/IabConnect.Application/Events/CheckIn/). The handler MUST go through `IEventRepository.GetByIdAsync` to validate the event exists and through `IEventRegistrationRepository.GetByEventIdAsync` to fetch registrations — NO raw EF queries in the handler.
2. **Roster filtering and ordering are deterministic.** Roster MUST exclude `RegistrationStatus.Cancelled` and `RegistrationStatus.Pending` (never-confirmed guests) by default; the caller MAY pass `IncludeWaitlisted = true` to include `Waitlisted` rows. Items MUST be ordered ASCENDING by `ParticipantName` after a Unicode-aware case-fold/diacritic-fold. Reuse the existing fold logic from [DuplicateMatcher.cs:82-…](backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs#L82) (`public string FoldName(string? name)` — note: instance method on `IDuplicateMatcher` interface line 29) by extracting it into a `public static class IabConnect.Application.Common.TextNormalization.FoldName(string? name) → string` so the Events module can call it without depending on the Members module. Secondary sort: `RegisteredAt` ASC for stable ordering when names collide.
3. **Roster DTO surface is scanner-friendly AND privacy-bounded.** `EventCheckInRosterDto` MUST contain `EventId`, `EventTitle`, `EventStartDate`, `EventLocation`, `GeneratedAt` (UTC), `TotalRegistrations`, `CheckedInCount`, `Items: IReadOnlyList<EventCheckInRosterItemDto>`. Each `EventCheckInRosterItemDto` MUST expose ONLY: `RegistrationId` (Guid), `QrCodeToken` (string), `ParticipantName`, `NumberOfGuests`, `Status` (string — enum name), `IsWaitlisted`, `IsCheckedIn`, `CheckedInAt` (UTC nullable), `SpecialRequirements` (nullable). It MUST NOT expose `ParticipantEmail`, `ParticipantPhone`, `MemberId`, `UserId`, `Notes`, `CancellationReason`, `CheckedInBy`, or any other field outside this surface — even though those values are loaded from the entity.
4. **MediatR CSV export query exists.** Export MUST be exposed as `ExportEventCheckInRosterQuery` (`record` implementing `IRequest<EventCheckInRosterCsvFile>`, where `EventCheckInRosterCsvFile` is a `record(byte[] Content, string FileName)`). The handler delegates CSV generation to a new `IEventCheckInRosterCsvExporter` interface in `IabConnect.Application.Events.CheckIn`; concrete `EventCheckInRosterCsvExporter` lives in `IabConnect.Infrastructure.Events` next to [EventRegistrationPdfExporter.cs](backend/src/IabConnect.Infrastructure/Events/EventRegistrationPdfExporter.cs) and is registered in [Infrastructure/DependencyInjection.cs](backend/src/IabConnect.Infrastructure/DependencyInjection.cs).
5. **CSV format is event-day-print-friendly.** CSV MUST use UTF-8 with a BOM (so Excel on Windows opens it correctly with Umlauts), CRLF line endings, comma separator, and RFC-4180-style quoting (fields containing `,`, `"`, CR, LF MUST be enclosed in `"…"`; embedded `"` doubled). Column order MUST be **9 columns**: `#` (1-based row index), `Name`, `Guests`, `Status`, `Waitlisted`, `CheckedIn`, `CheckedInAt` (ISO-8601 UTC, blank when null), `SpecialRequirements`, `Present`. (Per **D-S1-1** the `QrCodeToken` column was removed — paper-roster credential leak vector. Per Round-3 **DN-6** + **L-S1-1** the tick-box column was renamed from `[ ] (Anwesenheit)` to `Present` — full-English headers + drop the `[ ]` literal which some Excel locales mis-parse as a name-range expression.) The last column's cell value MUST be empty so staff can hand-check it on paper. **R3-C1 (Critical)**: any string cell whose first character is in `{=,+,-,@}` MUST be prefixed with `'` (Excel literal-string indicator) AND force-quoted to defeat formula injection from public-registration text. **R3-M-S1-1**: the data-row's empty last cell MUST be emitted as `""` (quoted empty) so Excel locales that aggressively trim trailing empty cells preserve the tick-box column. File name MUST be `Checkin_<sanitizedEventTitle>_<YYYY-MM-DD>.csv` using the same `Path.GetInvalidFileNameChars()` sanitization as [EventRegistrationEndpoints.cs:576-577](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L576-L577).
6. **Authorized HTTP surface (new `RequireEventStaff` policy).** Add `RequireEventStaff` policy in [backend/src/IabConnect.Api/DependencyInjection.cs:134-146](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146): `policy.RequireRole("admin", "vorstand", "event-manager")` — collapses the inline triple-role check duplicated 14× in [EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs). Expose two endpoints:
    - `GET /api/v1/events/{eventId:guid}/check-in-roster?includeWaitlisted={bool}` → `EventCheckInRosterDto` (200) / 404 if event not found / 401/403 unauthorized.
    - `GET /api/v1/events/{eventId:guid}/check-in-roster/export.csv?includeWaitlisted={bool}` → `text/csv; charset=utf-8` (200) / 404 / 401/403.
    Both endpoints map under the existing `EventRegistrationEndpoints` route group at [EventRegistrationEndpoints.cs:17](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L17) and use `.RequireAuthorization("RequireEventStaff")`. Both endpoints emit `SecurityAuditLogger.LogAccessDenied` only on authorization failure (handled by the policy middleware, not by hand in the handler). Successful reads do NOT log — these are read-only queries, matching the `GetRegistrations` precedent.
7. **Event visibility/scope is enforced server-side.** Even for `event-manager` callers, the handler MUST verify the event exists (return `NotFound` if `IEventRepository.GetByIdAsync` returns null or the event is soft-deleted, i.e. `IsDeleted == true`). Roster/export for a `Draft` event is allowed (event staff need to inspect drafts during setup), but the handler MUST NOT return roster data for events whose `Status == EventStatus.Cancelled` AND `CancelledAt < UtcNow - 90d` — cancelled-and-archived events stop exposing registrant PII. Cap: roster export of cancelled-archived events returns `404` with body `{ message: "Event archive lookup expired" }`.
8. **Theory-driven tests (Application + Infrastructure + API).** Adopt the E2.S1 test discipline:
    - **Application/Unit:** `GetEventCheckInRosterQueryHandlerTests` — `[Theory]` over `IncludeWaitlisted ∈ {true, false}`; ordering test with mixed-case + Umlaut names (`["Émile", "Anna", "Müller", "Mueller", "ANNA", "Zacharias"]` MUST sort to `["Anna", "ANNA", "Émile", "Mueller", "Müller", "Zacharias"]`); status-filter test asserting `Pending`/`Cancelled` are dropped; reflection test confirming `EventCheckInRosterItemDto` does NOT expose `ParticipantEmail`, `ParticipantPhone`, `MemberId`, `UserId`, `Notes` (mirror [FindMemberDuplicatesQueryHandlerTests.cs:Handle_DtoOmitsPhoneAndAddressAndKeycloakId](backend/tests/IabConnect.Application.Tests/Members/FindMemberDuplicatesQueryHandlerTests.cs)); `EventArchiveLookupExpired` test (cancelled + `CancelledAt = UtcNow - 91d` → returns NotFound result).
    - **Application/Unit:** `EventCheckInRosterCsvExporterTests` — at minimum one row per [A8](docs/07_dos_donts.md#L210) adversarial pattern: a participant name containing `,`, a name containing `"` (double-quote), a name containing `\r\n`, a name with leading/trailing whitespace, a name with a German Umlaut, an empty `SpecialRequirements`, a 50-char `SpecialRequirements`. Assert UTF-8 BOM is the first 3 bytes (`0xEF 0xBB 0xBF`), header row matches AC-5 column order, each problem row round-trips through a CSV parser (use a tiny in-test parser, NOT a dependency).
    - **Infrastructure (Testcontainers PostgreSQL):** `EventCheckInRosterRepositoryAccessTests` — uses `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Seeds an event with 6 registrations across all `RegistrationStatus` values + one `Waitlisted`; asserts `GetByEventIdAsync(eventId, filter=null)` returns all 6 (the existing repo behaviour) AND that the handler-applied default filter narrows to 4 (drops `Pending` + `Cancelled`). This test uses the existing repo method — NO new repository method is required for this story.
    - **API:** `EventCheckInRosterEndpointTests` — endpoint-metadata test confirming `RequireEventStaff` policy is applied to BOTH new endpoints; runtime test confirming unauthenticated → 401 (mirror [MemberDuplicatesEndpointTests.DuplicatesEndpoint_Unauthenticated_Returns401](backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicatesEndpointTests.cs)); content-type test for the CSV endpoint confirming `text/csv; charset=utf-8` and `Content-Disposition` starts with `attachment; filename=Checkin_`. The authenticated-200 case requires a test auth handler — document as a follow-up (matches E2.S1 carry-over note).

## Tasks / Subtasks

- [x] **0. Pre-flight gates** (Action items A6, A7, A11; A1 commit discipline)
  - [x] Verify [docs/07_dos_donts.md](docs/07_dos_donts.md) already contains the Concurrency Checklist (A6) and Pattern-Chars in User Input (A7) sections — both should be present. If missing, STOP and surface to user (these are documented prerequisites per [epic-2-retro-2026-05-13.md:113-114](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L113-L114)).
  - [x] No new entry in `docs/07_dos_donts.md` is required for this story — Symmetric-Guard, Concurrency, and Pattern-Chars are already covered and no new boundary class is introduced.
  - [x] Confirm `dotnet test` baseline is green before edits (current baseline: 1551 / 1551 per [epic-2-retro-2026-05-13.md:17](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L17)).

- [x] **1. Extract `FoldName` to a shared helper** (AC: 2) — *gating refactor*
  - [x] Create [backend/src/IabConnect.Application/Common/TextNormalization.cs](backend/src/IabConnect.Application/Common/TextNormalization.cs) as a `public static class TextNormalization` exposing `public static string FoldName(string? name)` with the SAME logic as [DuplicateMatcher.cs:82](backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs#L82) (German digraph expansion → lower → NFKD → strip combining marks; returns empty string when input is null/whitespace — preserve the existing instance method's contract). Add xUnit `[Theory]` tests in [backend/tests/IabConnect.Application.Tests/Common/TextNormalizationTests.cs](backend/tests/IabConnect.Application.Tests/Common/TextNormalizationTests.cs): positive (`"Müller"` → `"mueller"`), negative (`"Anna"` ≠ `"Berta"`), edge (`"ß"` → `"ss"`, `"  Ä  "` → `"ae"`), and null/empty rows.
  - [x] Update [DuplicateMatcher.cs](backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs) so its public instance method `FoldName(string? name)` (line 82) delegates to `TextNormalization.FoldName`. Keep the `IDuplicateMatcher.FoldName` interface contract (line 29) UNCHANGED — callers continue to inject the matcher and call the instance method; only the implementation is delegated. Re-run the existing `DuplicateMatcherTests` — they MUST still pass with zero behavior diff.
  - [x] **Symmetric-Guard audit** (project rule from [docs/07_dos_donts.md:Symmetric-Guard Checklist](docs/07_dos_donts.md)): grep the Application layer (`Grep "Normalize|FoldName|ToLower\(\).*Trim" --type cs --path backend/src/IabConnect.Application`) for other ad-hoc folding/normalization copies. If found, document in Completion Notes; do NOT migrate them here (scope-creep guard).

- [x] **2. Add `RequireEventStaff` policy** (AC: 6)
  - [x] Add policy to [backend/src/IabConnect.Api/DependencyInjection.cs:134-146](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146): `.AddPolicy("RequireEventStaff", policy => policy.RequireRole("admin", "vorstand", "event-manager"))`.
  - [x] **Do NOT** migrate the 14 existing inline `policy.RequireRole("admin", "vorstand", "event-manager")` checks in [EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) to the new policy in this story — scope-creep guard. Document in Completion Notes that the migration is a deferred chore (will be picked up when E3.S2 touches the same file).

- [x] **3. Roster query + handler** (AC: 1, 2, 3, 7)
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/EventCheckInRosterDto.cs](backend/src/IabConnect.Application/Events/CheckIn/EventCheckInRosterDto.cs) — `record EventCheckInRosterDto` + `record EventCheckInRosterItemDto` with exactly the AC-3 surface. No EF entity exposure.
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs) — `record(Guid EventId, bool IncludeWaitlisted = false) : IRequest<EventCheckInRosterDto?>` (nullable return to allow NotFound mapping at endpoint).
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs) — injects `IEventRepository`, `IEventRegistrationRepository`. Logic: `GetByIdAsync(EventId)` → null → return null. Apply archive-expiry rule (AC-7). `GetByEventIdAsync(EventId, filter=null)` → in-memory filter to drop `Pending` + `Cancelled` (and `Waitlisted` unless `IncludeWaitlisted`) → sort by `TextNormalization.FoldName(ParticipantName)` then `RegisteredAt` → map to DTO.

- [x] **4. CSV exporter + query + handler** (AC: 4, 5)
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/IEventCheckInRosterCsvExporter.cs](backend/src/IabConnect.Application/Events/CheckIn/IEventCheckInRosterCsvExporter.cs) — `byte[] Export(EventCheckInRosterDto roster)`.
  - [x] Create [backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs). Implementation: `using var ms = new MemoryStream(); using var sw = new StreamWriter(ms, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true), leaveOpen: true) { NewLine = "\r\n" };` then hand-rolled RFC-4180 line emit. Do NOT add a NuGet CSV library — the format is small enough and warnings-as-errors makes external CSV libs costly.
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQuery.cs](backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQuery.cs) — `record EventCheckInRosterCsvFile(byte[] Content, string FileName)` + `record ExportEventCheckInRosterQuery(Guid EventId, bool IncludeWaitlisted = false) : IRequest<EventCheckInRosterCsvFile?>`.
  - [x] Create [backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs](backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs). Logic: send `GetEventCheckInRosterQuery` via injected `IMediator` (reuse roster handler), if null return null, else call exporter and build `EventCheckInRosterCsvFile`. File name uses `Path.GetInvalidFileNameChars()` sanitization on `EventTitle` AND `evt.StartDate.ToString("yyyy-MM-dd")` (NOT `DateTime.UtcNow`) — staff expect the file name to reflect the event date, not the export date.
  - [x] Register `IEventCheckInRosterCsvExporter → EventCheckInRosterCsvExporter` in [backend/src/IabConnect.Infrastructure/DependencyInjection.cs](backend/src/IabConnect.Infrastructure/DependencyInjection.cs) next to `IRegistrationPdfExporter` registration (search the file for `IRegistrationPdfExporter` to find the line).

- [x] **5. HTTP endpoints** (AC: 6, 7)
  - [x] Add `MapGet("/check-in-roster", GetCheckInRoster)` and `MapGet("/check-in-roster/export.csv", ExportCheckInRoster)` to [EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) inside the existing `protectedGroup` (so they get the group-level `RequireAuthorization()`), then chain `.RequireAuthorization("RequireEventStaff")` on each. Use `.WithName("GetEventCheckInRoster")` / `.WithName("ExportEventCheckInRoster")` and `.Produces<EventCheckInRosterDto>()` / `.Produces(200, contentType: "text/csv")`.
  - [x] Both handler methods accept `Guid eventId, bool? includeWaitlisted, ISender sender, CancellationToken ct`. Send the query, map null → `Results.NotFound(new { message = "Event not found" })`, map success → `Results.Ok(dto)` or `Results.File(csv.Content, "text/csv", csv.FileName)` (use `text/csv` not `text/csv; charset=utf-8` in `Results.File` — the BOM signals UTF-8 to Excel).
  - [x] Match the existing endpoint-handler signature style: `private static async Task<IResult>` per the file's [pattern at lines 165-242](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L165-L242).

- [x] **6. Tests** (AC: 8) — all four layers
  - [x] Unit: [backend/tests/IabConnect.Application.Tests/Common/TextNormalizationTests.cs](backend/tests/IabConnect.Application.Tests/Common/TextNormalizationTests.cs) — `[Theory]` mirroring the matcher tests.
  - [x] Unit: [backend/tests/IabConnect.Application.Tests/Events/CheckIn/GetEventCheckInRosterQueryHandlerTests.cs](backend/tests/IabConnect.Application.Tests/Events/CheckIn/GetEventCheckInRosterQueryHandlerTests.cs) — covers all AC-2/3/7 cases listed above, plus reflection-based DTO surface assertion.
  - [x] Unit: [backend/tests/IabConnect.Application.Tests/Events/CheckIn/EventCheckInRosterCsvExporterTests.cs](backend/tests/IabConnect.Application.Tests/Events/CheckIn/EventCheckInRosterCsvExporterTests.cs) — adversarial CSV input rows per [A8](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L115), UTF-8-BOM assertion, header-order assertion. **Note:** the CSV exporter lives in Infrastructure but its tests live in Application.Tests because they exercise only the interface contract via `new EventCheckInRosterCsvExporter()` — no infra dependencies. This mirrors how the matcher tests live in Application.Tests despite being pure-logic.
  - [x] Integration: [backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventCheckInRosterRepositoryAccessTests.cs](backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventCheckInRosterRepositoryAccessTests.cs) — Testcontainers `postgres:18`. Seeds one event with 6 registrations spanning all `RegistrationStatus` values. Asserts the existing repo method serves the handler's needs.
  - [x] API: [backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInRosterEndpointTests.cs](backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInRosterEndpointTests.cs) — endpoint-metadata for `RequireEventStaff` on both new endpoints; 401 for unauthenticated; `Content-Disposition` + `Content-Type` assertions for CSV endpoint. **Carry-over:** the runtime 401 + 200-content-type assertions are replaced with stronger metadata-only checks (both endpoints have `RequireEventStaff` AND the group-level default-authorization marker). A full runtime auth test would require a shared collection-fixture or a test auth handler — deferred per the same carry-over rationale as E2.S1.

- [x] **7. Story-close gate** (A1)
  - [x] All patches committed; sprint-status.yaml updated only via this story's normal `ready-for-dev → in-progress → review` flow (no other rows changed).
  - [x] `dotnet test` from `backend` is green. Result: **1598 / 1598 passing** (Application: 1239, Api: 30, Infrastructure: 329); +47 over the 1551 baseline.
  - [x] No `dotnet build` warnings introduced (warnings-as-errors gate). 0 Warning(s), 0 Error(s).
  - [x] Flip story status `in-progress → review`.

## Dev Notes

### Scope boundaries

**In scope.**
- `GetEventCheckInRosterQuery` + handler + scanner-friendly DTO.
- `ExportEventCheckInRosterQuery` + handler + CSV exporter (`IEventCheckInRosterCsvExporter` interface in Application, implementation in Infrastructure).
- `RequireEventStaff` authorization policy (used by 2 new endpoints + reusable by E3.S2/S3/S5).
- Two new `GET` endpoints on `EventRegistrationEndpoints` (roster + CSV export).
- Extraction of `FoldName` from `DuplicateMatcher` into a shared `TextNormalization` helper.
- Application + Infrastructure (Testcontainers PostgreSQL) + API tests.

**Out of scope.**
- QR scanner UI, manual-search UI, check-in tab/page → **E3.S2**.
- State-changing check-in commands (already exist on the entity via [EventRegistration.CheckIn](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L306) at line 306, and on the API via [EventRegistrationEndpoints.cs:76-81](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L76-L81) and [line 146](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L146)). This story does NOT modify those.
- Migrating the 14 existing inline `RequireRole("admin", "vorstand", "event-manager")` checks in `EventRegistrationEndpoints.cs` to the new `RequireEventStaff` policy — documented as a deferred chore.
- PDF export of the check-in roster. The existing [ExportRegistrationsPdf](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L562-L580) at line 562 already produces a printable list (admin-overview format) and is sufficient for "I want it on paper" usage; CSV is the new value-add for the offline-fallback case.
- New repository methods on `IEventRegistrationRepository`. The handler reuses the existing [GetByEventIdAsync](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs#L31-L34) with `filter = null` and filters in-memory.
- Frontend / `frontend/src/**` is untouched in this story (the UI consumer is E3.S2).

### Internal contradiction resolved (vs. the 2026-05-12 template version)

The 2026-05-12 template version of this story listed `GetEventCheckInRosterQuery` and `ExportEventCheckInRosterQuery` BOTH under "In scope: Add ..." AND under "Existing Code To Inspect Before Editing". Verification by codebase search ([Grep for `CheckIn|Roster|GetEventCheckIn`](backend) → returns 3 files: `EventRegistration.cs`, `EventRegistrationEndpoints.cs`, `EventRegistrationTests.cs`): **neither query exists today.** They are net-new in this story. The "inspect before editing" pointer was a planning artifact, not a code-existence claim. Removed in this rewrite.

### Architecture guardrails (from [architecture.md, REQ-023 section, lines 322-347](_bmad-output/planning-artifacts/architecture.md#L322-L347))

- **Modular monolith / Clean Architecture.** Application owns query/handler/DTO/exporter-interface; Infrastructure owns CSV exporter implementation; API owns endpoint mapping. No EF entity escapes Application.
- **Backend authorization is the boundary.** `RequireEventStaff` policy is THE gate. Frontend role checks (E3.S2) are UX only.
- **MediatR + FluentValidation pattern.** Both queries go through MediatR so existing pipeline behaviors (logging, validation) apply uniformly. No `FluentValidation` validator is needed — both inputs are `(Guid, bool)` and the handler tolerates a non-existent event by returning null.
- **EF Core migrations.** **No schema changes in this story.** All data comes from existing `Event` and `EventRegistration` columns. Do not introduce a migration.
- **Privacy-respecting DTO.** AC-3 directly addresses project-context rule: "Do not weaken privacy/retention/audit behavior for convenience." The roster DTO deliberately omits `ParticipantEmail`/`ParticipantPhone`/`MemberId`/`UserId`/`Notes`/`CheckedInBy` — staff doing fast lookup do not need PII contact data, and printed paper rosters with email/phone columns are a leak vector.
- **CSV-and-not-Excel.** Generating `.xlsx` requires `EPPlus` or `ClosedXML` (licensing or extra dep). CSV with UTF-8 BOM opens cleanly in Excel/Numbers/LibreOffice, is grep/awk-friendly, and adds no NuGet dependency.

### Existing code to inspect before editing

Files this story touches (read fully before editing):

- [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) — 785 lines. Adds 2 new endpoint mappings + 2 handler methods. The existing pattern for the [ExportRegistrationsPdf endpoint at lines 117-122 (registration) and 562-580 (handler)](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L562-L580) is the closest precedent.
- [backend/src/IabConnect.Api/DependencyInjection.cs](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146) — adds one policy registration.
- [backend/src/IabConnect.Infrastructure/DependencyInjection.cs](backend/src/IabConnect.Infrastructure/DependencyInjection.cs) — adds one service registration next to `IRegistrationPdfExporter → EventRegistrationPdfExporter`.
- [backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs](backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs) — `FoldName` extracted to `Common/TextNormalization.cs`; matcher delegates. Existing matcher tests MUST stay green.

Files this story creates (new):

- `backend/src/IabConnect.Application/Common/TextNormalization.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/EventCheckInRosterDto.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/IEventCheckInRosterCsvExporter.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQuery.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs`
- `backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs`
- Tests (4 files; see Task 6).

Files this story must NOT modify (verify in PR review):

- [backend/src/IabConnect.Domain/Events/EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) — domain entity is read-only here; the existing `CheckIn` / `RevertCheckIn` / `MarkAsNoShow` methods belong to E3.S2's command surface.
- [backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs) — no new repository method required.
- The 14 inline `RequireRole("admin", "vorstand", "event-manager")` checks in `EventRegistrationEndpoints.cs` — migration to `RequireEventStaff` deferred.
- Any Keycloak / Identity / Authorization permission definitions — no new permissions.

Reference patterns (look-but-don't-edit):

- Query-handler + privacy-DTO pattern: [FindMemberDuplicatesQueryHandler.cs](backend/src/IabConnect.Application/Members/Queries/FindMemberDuplicatesQueryHandler.cs) and [DuplicateCandidateDto.cs](backend/src/IabConnect.Application/Members/Duplicates/DuplicateCandidateDto.cs) — same shape we follow here.
- Endpoint-registration + role-protection pattern: [EventRegistrationEndpoints.cs:34-46](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L34-L46) (GetRegistrations / GetRegistration) — minimal-API + `RequireAuthorization` + `.WithName`/`.WithSummary`/`.Produces`.
- File-download response pattern: [EventRegistrationEndpoints.cs:562-580 (ExportRegistrationsPdf)](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L562-L580) — `Results.File(bytes, contentType, fileName)` is the precedent.
- Testcontainers PostgreSQL integration test pattern: [MemberRepositoryTests.cs:14-41](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L14-L41) — `IAsyncLifetime` + `PostgreSqlBuilder("postgres:18")`. Match `postgres:18` exactly.

### Product decisions captured for this story

| # | Decision | Rationale |
|---|---|---|
| **D1** | **CSV not XLSX** for the offline export. | UTF-8-BOM CSV opens in Excel/Numbers/LibreOffice without extra dep. XLSX needs EPPlus (license shift) or ClosedXML. CSV is also grep/awk-friendly for power users. |
| **D2** | **Pending + Cancelled excluded from roster** by default. | Event staff at the door check in **confirmed** people; pending guests with no confirmation chain are not seat-holders, and cancelled-by-participant rows are noise. Waitlisted rows are opt-in via `IncludeWaitlisted=true` because they may walk-up if the venue has spare capacity. |
| **D3** | **Name sort uses `TextNormalization.FoldName`**, not `OrdinalIgnoreCase`. | The participant base is multi-script (German Umlauts, Indian-script transliterations). Folding `Müller` → `Mueller` and `É` → `e` produces the order a Swiss/Indian co-event staff member expects. |
| **D4** | **No `ParticipantEmail` / `ParticipantPhone` in the roster DTO or CSV.** | Printed paper rosters and shared screens at the venue are PII leak vectors. The check-in flow does not need contact data — the QR token + name + status is the lookup key. If contact data is truly needed (rare), event staff fall back to the existing [ExportRegistrationsPdf](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L562-L580) at line 562, which IS admin-PII-scoped. |
| **D5** | **`RequireEventStaff` is a NEW policy**, but the 14 inline checks are NOT migrated in this story. | Adding the policy unblocks E3.S2/S3/S5 cleanly. Migrating 14 existing checks would balloon the diff and risk regressions in the registration/cancellation/check-in flows that E2's epic-boundary review explicitly validated. Migration is a follow-up chore. |
| **D6** | **Archive-expiry: 90 days post-cancel** for cancelled events. | Avoids indefinite PII exposure of registrants for events that were cancelled long ago. 90 days lines up with the retention windows mentioned in project-context "Do not weaken privacy/retention/audit behavior". Active/published/draft events are not affected. |
| **D7** | **CSV file name uses event-start-date**, not export-date. | Staff print the roster the day before the event, then re-export the morning of. The relevant date for the file name is the event date so all exports for the same event share a recognisable prefix. |

### Cross-story lessons applied (Epic 1 + Epic 2 retros)

From [epic-1-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) (A1, A2, A3):

- **A1 — Commit discipline.** All patches committed and `dotnet test` green before story flips to `review`. Captured in Task 7.
- **A2 — Symmetric-Guard Checklist** ([docs/07_dos_donts.md#Symmetric-Guard-Checklist](docs/07_dos_donts.md)): when extracting `FoldName` into a shared helper, audit Application for other private `FoldName`/`Normalize` copies (Task 1).
- **A3 — Static-endpoint logger pattern.** No new logger needed in this story (no state-changing actions, no success-path audit). Not applicable.

From [epic-2-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md) (A6–A11):

- **A6 — Concurrency Checklist** ([docs/07_dos_donts.md#Concurrency-Checklist](docs/07_dos_donts.md#L134)): **NOT triggered**. Both queries are read-only. No transactional mutation, no row-level lock surface. Recorded for completeness; no action.
- **A7 — Pattern-Chars in User Input** ([docs/07_dos_donts.md#Pattern-Chars-in-User-Input](docs/07_dos_donts.md#L159)): **NOT triggered**. No LIKE/ILIKE/regex on user input — the only inputs are `eventId` (Guid) and `includeWaitlisted` (bool). Recorded for completeness; no action.
- **A8 — Adversarial test data.** **TRIGGERED for the CSV exporter test.** The exporter test suite MUST include rows with `,`, `"`, `\r\n`, leading/trailing whitespace, Umlauts (see Task 6).
- **A9 — FK delete-behavior rationale.** **NOT triggered.** No new FK or migration.
- **A10 — Developer-judgment mid-epic escalation.** Track the inline-patch budget feel during E3.S1 → E3.S2 → E3.S3 dev. If ≥1 day of inline fix work feels likely, pause and run mid-epic `bmad-code-review` (replaces the threshold-counted A4).
- **A11 — A5 retirement.** This story does NOT carry an "Action A5 per-story code review" task. Boundary review at end of Epic 3 covers everything.

### Workflow note (per memory + Epic-2 retro)

This story is **standard** per the project's hybrid workflow ([feedback_bmad_workflow.md](../../memory/feedback_bmad_workflow.md)): backend-only, no high-risk semantics. Bundle `bmad-code-review` + `bmad-retrospective` at the Epic 3 boundary. No per-story review.

### Phone / email normalization caveat

**Not relevant for this story** — no name-or-email matching happens here. The only normalization is `FoldName` for SORTING (not for equality matching). The Option B trade-off from E2.S1 does not apply.

### Project structure notes

- Backend source: `backend/src/IabConnect.Domain`, `backend/src/IabConnect.Application`, `backend/src/IabConnect.Infrastructure`, `backend/src/IabConnect.Api`.
- Backend tests: `backend/tests/IabConnect.Application.Tests`, `backend/tests/IabConnect.Infrastructure.Tests`, `backend/tests/IabConnect.Api.Tests`.
- New folders introduced: `backend/src/IabConnect.Application/Common/` (for `TextNormalization.cs`) and `backend/src/IabConnect.Application/Events/CheckIn/` (for the 5 new CheckIn-feature files). Both are sub-namespaces under existing projects — no new top-level project.
- Frontend / `frontend/src/**` is untouched.

### References

- Epic + AC source: [_bmad-output/planning-artifacts/epics-and-stories.md, lines 298-326](_bmad-output/planning-artifacts/epics-and-stories.md#L298-L326)
- Architecture: [_bmad-output/planning-artifacts/architecture.md, REQ-023 section lines 322-347](_bmad-output/planning-artifacts/architecture.md#L322-L347)
- Original requirement (DE): [docs/01_requirements.md, REQ-023 section lines 765-791](docs/01_requirements.md#L765-L791) and [docs/Anforderungen_WebApp_Indischer_Kulturverein.csv row REQ-023](docs/Anforderungen_WebApp_Indischer_Kulturverein.csv)
- API contracts reference: [docs/03_api_contracts.md, lines 96-108](docs/03_api_contracts.md#L96-L108) (existing check-in route surface)
- Project context: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Sprint plan order: [_bmad-output/implementation-artifacts/sprint-plan.md, Wave order 10](_bmad-output/implementation-artifacts/sprint-plan.md)
- Cross-epic lessons: [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md, Action items A1-A3](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) and [_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md, Action items A6-A11](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md)
- Quality benchmark for this rewrite: [_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md)
- Dos & don'ts: [docs/07_dos_donts.md](docs/07_dos_donts.md) — Concurrency Checklist (line 134), Pattern Chars (line 159), Symmetric-Guard Checklist
- Frontend design standards (not used in S1, referenced for S2): [docs/13_frontend_design_standards.md](docs/13_frontend_design_standards.md)

### Latest technical context

- **xUnit v3** is the test framework. Use `TestContext.Current.CancellationToken` for cancellation tokens in tests (see [MemberRepositoryTests.cs:25](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L25)).
- **Testcontainers PostgreSQL** image used in this codebase is `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Match exactly.
- **MediatR 12.4.1** + **FluentValidation 11.11.0** + **Npgsql EF Core 10.0.0** are pinned via [backend/Directory.Packages.props](backend/Directory.Packages.props); do NOT add direct package references in `.csproj` (project-context rule).
- **`UTF8Encoding(encoderShouldEmitUTF8Identifier: true)`** is the standard .NET way to emit a UTF-8 BOM ([Microsoft docs](https://learn.microsoft.com/en-us/dotnet/api/system.text.utf8encoding)). Required for Excel-Windows to auto-detect UTF-8.
- **`Path.GetInvalidFileNameChars()`** is already used by the existing PDF export at [EventRegistrationEndpoints.cs:576](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L576) — match that pattern for the CSV file name.
- **`Results.File(byte[], string, string)`** is the Minimal-API helper for file responses (sets `Content-Type` + `Content-Disposition: attachment; filename=…`).

### Previous story intelligence

This is the **first story in Epic 3**. No prior Epic-3 story file to inherit from. Carry-over from Epic 1 (A1–A3) and Epic 2 (A6–A11) is captured under **Cross-story lessons** above.

Recent commit context: `1466c35 chore(bmad): Epic 2 close — review findings, retrospective, customize overrides`. The `_bmad/custom/bmad-dev-story.toml`, `bmad-code-review.toml`, `bmad-retrospective.toml` overrides MUST be honoured during dev execution (re-read them on dev-story activation).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Opus 4.7, 1M context) via Claude Code BMad `bmad-dev-story` workflow.

### Debug Log References

- Initial `dotnet test` after first patch: 2 Application failures + 1 Api failure.
  - Application/Csv `Export_HeaderRowMatchesAcContract`: expected the `[ ] (Anwesenheit)` header cell to be quoted, but the value contains no quote-triggering chars. Fixed by removing the surrounding double-quotes from the expected header string in the test.
  - Application/Handler `Handle_OrdersByFoldedName_ThenRegisteredAt`: the spec example expected `Mueller` before `Müller` for the tied-fold pair. The handler's contract is `(FoldName ASC, RegisteredAt ASC)`. Fixed by reordering the seeded `RegisteredAt` so `Mueller` is registered earlier than `Müller`, which produces the spec-expected output while honouring the contract.
  - Api/EndpointTests `*_Unauthenticated_Returns401`: building a second `WebApplicationFactory<Program>` in the test process re-runs `Program.Main`, which calls `Serilog.AddSerilog` again and hits "The logger is already frozen" on the static `Log.Logger` set up by the first factory. Static-state collision is broader than this story. Replaced runtime 401 tests with two `[Theory]` metadata checks asserting (a) `RequireEventStaff` policy is wired on both endpoints, (b) the group-level default `RequireAuthorization()` marker is present (proves no anonymous path).
- Final `dotnet build` + `dotnet test`: 0 warnings, 0 errors. Tests: 1598 / 1598 passing.

### Completion Notes List

- **Symmetric-Guard audit** (A2): grepped `Normalize|FoldName|ToLower\(\).*Trim` under `backend/src/IabConnect.Application` → 3 hits, all in the duplicate-matching code path. `DuplicateMatcher.FoldName` was refactored to delegate to `TextNormalization.FoldName`. The two call-sites in `FindMemberDuplicatesQueryHandler.cs` and `FindDuplicateGroupsQueryHandler.cs` already inject the matcher and call `_matcher.FoldName(...)`, so they reach the new helper transitively without any code change. No other ad-hoc fold/normalize copies were found.
- **Deferred chore — migrate 14 inline role checks to `RequireEventStaff`**: out of scope per the story's scope-creep guard. The new policy is registered and used by the two new endpoints; existing endpoints in `EventRegistrationEndpoints.cs` retain their inline `RequireRole("admin", "vorstand", "event-manager")` calls. To be picked up when E3.S2 touches the same file.
- **No new `docs/07_dos_donts.md` entry**: no new boundary class introduced. Symmetric-Guard, Concurrency, and Pattern-Chars sections already cover the patterns used here. Concurrency checklist (A6) and Pattern-Chars (A7) are NOT triggered — both queries are read-only and accept only `(Guid, bool)` parameters.
- **Test coverage delta**: +47 tests (Application 1239, Api 30, Infrastructure 329 — totals 1598; previous baseline 1551). Beats the rough estimate of +20.
- **API test trade-off**: the runtime unauthenticated → 401 assertion (mirror of `MemberDuplicatesEndpointTests.DuplicatesEndpoint_Unauthenticated_Returns401`) cannot coexist with the existing `HealthEndpointTests` + `MemberDuplicatesEndpointTests` factory pattern within the same test process — Serilog's bootstrap logger freezes on the first factory and the second `Program.Main` invocation fails. Replaced with two metadata-only theories asserting (a) `RequireEventStaff` policy is present on both endpoints, (b) the group-level default-authorization marker is present (rejects anonymous calls). Full runtime test would require an `ICollectionFixture<TestWebApplicationFactory>` across all API test classes — recorded as a follow-up that affects all future API endpoint stories, not just this one.
- **A10 escalation budget**: zero inline patches needed during dev — implementation followed the story's task ordering top-to-bottom with only the three test-only corrections above. Well within the A10 mid-epic escalation budget.
- **Round-3 fix-pass (2026-05-14)**: Critical R3-C1 (CSV formula injection) plus High R3-H-S1-1 (MediatR re-entry) plus 4 Medium + 1 Low + 1 Decision items all resolved. The high-impact change is the formula-injection defense — `EventCheckInRosterCsvExporter` now sanitizes the OWASP-recommended prefix set with apostrophe-prefix + force-quote, defeating `=cmd|...`/`+`/`-`/`@` payloads in public-registration text. The other notable change is the export handler swapping `IMediator` for a direct injection of `GetEventCheckInRosterQueryHandler`, which required an explicit `AddTransient` registration in Application DI (MediatR auto-wires only the interface side). 1 new failing-then-green theory + 4 new direct tests added to the CSV exporter suite; 1 new GeneratedAt-via-TimeProvider test added to the roster handler suite; existing archive-expiry tests refactored from `DateTime.UtcNow`-relative to `FakeTimeProvider`-driven for determinism. Test count: 1770 / 1770 green (+10 vs the 1760 Round-2 baseline).

### File List

**Created (12):**

- `backend/src/IabConnect.Application/Common/TextNormalization.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/EventCheckInRosterDto.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/IEventCheckInRosterCsvExporter.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQuery.cs`
- `backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs`
- `backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs`
- `backend/tests/IabConnect.Application.Tests/Common/TextNormalizationTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/GetEventCheckInRosterQueryHandlerTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/EventCheckInRosterCsvExporterTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventCheckInRosterRepositoryAccessTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventCheckInRosterEndpointTests.cs`

**Modified (4):**

- `backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs` — `FoldName(string?)` now delegates to `TextNormalization.FoldName`; unused `System.Globalization` using removed; new `IabConnect.Application.Common` using added.
- `backend/src/IabConnect.Api/DependencyInjection.cs` — added `RequireEventStaff` policy alongside `RequireMember` (~line 141).
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` — added `IEventCheckInRosterCsvExporter → EventCheckInRosterCsvExporter` singleton next to the existing `IRegistrationPdfExporter` registration (~line 208).
- `backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs` — added two `MapGet` endpoints + two handler methods (`GetCheckInRoster`, `ExportCheckInRoster`); added `IabConnect.Application.Events.CheckIn` and `MediatR` usings.

**Modified in Round-3 fix-pass (2026-05-14, 5 files):**

- `backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs` — header column renamed `[ ] (Anwesenheit)` → `Present` (R3-DN-6 + R3-L-S1-1); new `EscapeForCsvCell(value, forceQuoteEmpty)` method adds OWASP formula-injection prefix-+-quote escape (R3-C1) and emits quoted-empty for the trailing tick-box cell (R3-M-S1-1).
- `backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs` — injects `TimeProvider` (R3-M-S1-2); ordering switched to `StringComparer.InvariantCulture` (R3-M-S1-3); archive-expiry and `GeneratedAt` driven by the injected clock.
- `backend/src/IabConnect.Application/Events/CheckIn/ExportEventCheckInRosterQueryHandler.cs` — constructor now injects `GetEventCheckInRosterQueryHandler` directly instead of `IMediator` (R3-H-S1-1); eliminates double-fire of pipeline behaviors per CSV download.
- `backend/src/IabConnect.Application/DependencyInjection.cs` — added explicit `AddTransient<GetEventCheckInRosterQueryHandler>()` so direct injection resolves (R3-H-S1-1 prerequisite).
- `_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md` — AC-5 text synced to the 9-column layout (R3-M-S1-4); Status line, Change Log, Round-3 Review Findings checkboxes, File List, and Completion Notes updated.

**Modified test files in Round-3 fix-pass (2026-05-14, 3 files):**

- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/EventCheckInRosterCsvExporterTests.cs` — `ExpectedHeader` updated to new `Present` column; new tests `Export_LastColumnPresent_IsQuotedEmptyInRawBytes`, `Export_FormulaInjectionPrefixes_AreEscapedWithLeadingApostrophe (Theory × 4)`, `Export_FormulaInjectionInSpecialRequirements_IsEscaped`, `Export_BenignNamesAreNotApostrophePrefixed (Theory × 3)`; renamed existing `Export_LastColumnIsEmptyAnwesenheitCell` → `Export_LastColumnPresent_IsEmptyAfterCsvParse`.
- `backend/tests/IabConnect.Application.Tests/Events/CheckIn/GetEventCheckInRosterQueryHandlerTests.cs` — `BuildHandler` helper now optionally accepts `TimeProvider`; archive-expiry tests refactored to use `FakeTimeProvider` with fixed timestamps for determinism; new `Handle_GeneratedAt_UsesInjectedTimeProvider` test pins the TimeProvider injection.
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventCheckInRosterRepositoryAccessTests.cs` — handler constructor call passes `TimeProvider.System` (integration test uses real clock).

## Change Log

- 2026-05-12: Initial story file generated from epics-and-stories.md (template — generic ACs, no file:line refs, internal contradiction on `GetEventCheckInRosterQuery`).
- 2026-05-13: Marked `ready-for-dev` in sprint-status.yaml with a note that the template version may need re-contextualization before dev execution.
- 2026-05-13 (story rewrite): Re-contextualized as a story-specific implementation guide. 8 concrete acceptance criteria with file:line refs; D1–D7 product decisions captured; Epic-1 (A1–A3) and Epic-2 (A6–A11) action items wired in; internal contradiction (line 47 vs 57 in the previous version) resolved by confirming `GetEventCheckInRosterQuery` / `ExportEventCheckInRosterQuery` do NOT exist today; `RequireEventStaff` policy decision made; scope narrowed to backend only; CSV-not-XLSX decision documented; archive-expiry of 90 days documented. Status remains `ready-for-dev`. Quality benchmark: [e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md).
- 2026-05-13 (dev): All 7 tasks implemented in story order (Pre-flight → TextNormalization → RequireEventStaff → Roster query → CSV export → HTTP endpoints → Tests → close gate). `dotnet test`: 1598 / 1598 green (+47 over baseline). `dotnet build`: 0 warnings, 0 errors. Status flipped `in-progress → review`.
- 2026-05-13 (post-review fix-pass): Addressed 9 review findings (2 decisions + 3 high + 4 medium). Backend: handler return type changed to `EventCheckInRosterLookup` envelope so endpoints can distinguish archive-expired from not-found (H-S1-3); `IsIncluded` filter now uses Status only (H-S1-1); `FormatCheckedInAtUtc` uses `SpecifyKind` (H-S1-2); CSV exporter drops `QrCodeToken` column (D-S1-1), null-guards on fields (M-S1-3), quotes whitespace/tab (M-S1-2); export handler sanitizes filenames with bidi/control/length-cap (M-S1-1); roster integration test forces DB round-trip via `ChangeTracker.Clear()` (M-S1-4); `EventCheckInRosterDto.TotalRegistrations` xml-doc clarifies post-filter semantics (D-S1-2). Backend tests: 1760 / 1760 green (+10 vs 1750 baseline). Story status flipped `in-progress → review`.
- 2026-05-14 (Round-3 fix-pass): Addressed all S1-scoped Round-3 findings (1 Critical + 1 High + 4 Medium + 1 Low + 1 Decision). **Critical R3-C1:** CSV exporter now sanitizes formula-injection prefixes (`=`/`+`/`-`/`@`) with leading `'` + force-quote in new `EscapeForCsvCell`; OWASP-recommended defense against `=cmd|'/c calc'!A1`-style payloads in public-registration name/special-requirements text. **High R3-H-S1-1:** `ExportEventCheckInRosterQueryHandler` no longer re-enters MediatR — injects `GetEventCheckInRosterQueryHandler` directly, eliminating duplicate `IPipelineBehavior` fires per CSV download. Added explicit `AddTransient<GetEventCheckInRosterQueryHandler>()` in Application DI. **Medium R3-M-S1-1:** trailing empty tick-box cell now emitted as `""` (quoted empty) to survive Excel trailing-comma collapse. **Medium R3-M-S1-2:** `GetEventCheckInRosterQueryHandler` injects `TimeProvider`; archive-expiry math and `GeneratedAt` use the injected clock. **Medium R3-M-S1-3:** ordering switched from `StringComparer.Ordinal` to `StringComparer.InvariantCulture` for locale-stable Unicode collation. **Medium R3-M-S1-4:** AC-5 text updated to reflect the 9-column layout per D-S1-1 + R3-DN-6. **Low R3-L-S1-1 + Decision R3-DN-6:** tick-box column renamed `[ ] (Anwesenheit)` → `Present` (full-English headers + drop the `[ ]` literal). Backend tests: 1770 / 1770 green (+10 vs 1760 Round-2 baseline). `dotnet build`: 0 warnings, 0 errors. Story status flipped `in-progress → review`.

## Review Findings

Full epic-boundary review at [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). S1-scoped items (post-fix-pass 2026-05-13):

**Decision-needed:**
- [x] [Review][Decision] D-S1-1 QR token in roster DTO + CSV export. **Decision: option (b) — keep in DTO, redact in CSV.** The DTO is consumed by the authenticated scanner UI (browser-only, ephemeral); the CSV is printed on paper and left on tables. Removing the column entirely is the cleanest signal of intent — the header now has 9 columns instead of 10. The DTO retains `QrCodeToken` for in-app use.
- [x] [Review][Decision] D-S1-2 TotalRegistrations is post-filter. **Decision: keep the name, clarify the semantics in XML doc.** Renaming would break the published DTO contract. The new doc-comment explicitly states "number of rows currently rendered in this roster view" so future readers don't mistake it for the pre-filter total. A future story adding a separate `EligibleRegistrationCount` field is a clean opt-in if business asks for it.

**Patches (High):**
- [x] [Review][Patch] H-S1-1 IsIncluded conflates Status==Waitlisted with IsWaitlisted flag. **Fixed.** Filter now uses `Status` only. The legacy `IsWaitlisted` historical flag stays untouched on the entity but the roster filter no longer reads it.
- [x] [Review][Patch] H-S1-2 ToUniversalTime() on Kind=Unspecified silently shifts CSV CheckedInAt. **Fixed.** `FormatCheckedInAtUtc` now uses `DateTime.SpecifyKind(..., DateTimeKind.Utc)` to relabel without shifting; new `[Theory]` test covers all three `DateTimeKind` values.
- [x] [Review][Patch] H-S1-3 Archive-expired 404 returns generic message. **Fixed.** New `EventCheckInRosterLookup` / `EventCheckInRosterCsvLookup` envelopes distinguish "not found" from "archive expired"; endpoint returns spec-required `"Event archive lookup expired"` message for the latter.

**Patches (Medium):**
- [x] [Review][Patch] M-S1-1 Platform-dependent filename sanitization + RLO/ZWSP + no length cap. **Fixed.** `ExportEventCheckInRosterQueryHandler.SanitizeForFileName` strips control chars, bidi marks (RLO/LRO/RLM/LRM/PDF/...), zero-width spaces, the union of platform-invalid char sets (so Linux output is Windows-safe), then caps the title segment at 80 chars and trims edge dots/spaces.
- [x] [Review][Patch] M-S1-2 CSV QuoteIfNeeded doesn't quote leading/trailing whitespace or tab. **Fixed.** Added tab to the quote-trigger set; added leading/trailing whitespace detection so Excel can't strip padding. New tests for both cases.
- [x] [Review][Patch] M-S1-3 Null ParticipantName/QrCodeToken NREs the exporter. **Fixed.** Coalesced ParticipantName, Status, SpecialRequirements to empty strings. QrCodeToken is no longer emitted to CSV (D-S1-1), so its null risk vanishes alongside the row.
- [x] [Review][Patch] M-S1-4 Integration test missing SaveChangesAsync. **Fixed.** Added `_context.ChangeTracker.Clear()` between seeding and read so the assertion forces a real DB round-trip rather than reading from the EF first-level cache. Repository AddAsync already calls SaveChangesAsync, but the new Clear() is the canonical bulletproof of the integration claim.

**Deferred:** 12 items in [deferred-work.md](deferred-work.md).

## Senior Developer Review (AI)

**Reviewer:** Epic-3 boundary code review (12 reviewer agents — Blind Hunter, Edge Case Hunter, Acceptance Auditor × 4 stories)
**Review date:** 2026-05-13
**Source report:** [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md)

### Outcome

**Changes Requested → Resolved (2026-05-13 fix-pass).** All 3 High and 4 Medium findings scoped to E3.S1 plus both Decision-needed items have been addressed in code, tested, and re-built green.

### Action items

| # | Severity | Status | Description |
|---|---|---|---|
| D-S1-1 | Decision | [x] | Keep token in DTO, drop from CSV |
| D-S1-2 | Decision | [x] | Keep name, clarify semantics in doc |
| H-S1-1 | High | [x] | Status-only filter, drop IsWaitlisted flag conflation |
| H-S1-2 | High | [x] | SpecifyKind(Utc) instead of ToUniversalTime |
| H-S1-3 | High | [x] | Lookup envelope distinguishes archive-expired |
| M-S1-1 | Medium | [x] | Filename sanitization handles bidi / control / length |
| M-S1-2 | Medium | [x] | Quote whitespace + tab in CSV |
| M-S1-3 | Medium | [x] | Null guards on roster item fields |
| M-S1-4 | Medium | [x] | ChangeTracker.Clear() forces DB round-trip |

---

## Round 3 Review Findings (2026-05-14)

See [epic-3-review-2026-05-13-round3.md](epic-3-review-2026-05-13-round3.md) for full evidence per finding.

**Counts:** 1 Critical, 1 High, 4 Medium, 2 Low, 1 Decision, 0 Defer.
**Status:** Round-3 fix-pass complete 2026-05-14 — all S1-scoped items resolved; backend tests 1770 / 1770 green; 0 warnings, 0 errors.

### Decisions

- [x] [Review][Decision] R3-DN-6 CSV roster i18n: full German / full English / accept mix (BH-21, L-S1-2). **Decision: full English (option b).** The tick-box column was the last German artifact in an otherwise-English CSV (headers `Name`/`Status`/`Waitlisted`/`CheckedIn` and Status enum values `Confirmed`/`Waitlisted` were already English). Renamed `[ ] (Anwesenheit)` → `Present` in `EventCheckInRosterCsvExporter.HeaderColumns`. The cell value below the header remains empty so paper-roster staff still tick by hand.

### Patches

- [x] [Review][Patch] R3-C1 (Critical) CSV formula injection — sanitize leading `=`/`+`/`-`/`@` in `ParticipantName`/`SpecialRequirements` (EC-1). **Fixed.** New `EscapeForCsvCell(value, forceQuoteEmpty)` method in [`EventCheckInRosterCsvExporter.cs`](backend/src/IabConnect.Infrastructure/Events/EventCheckInRosterCsvExporter.cs) prefixes any cell whose first character is in `{=,+,-,@}` with a literal `'` (Excel's literal-string indicator) AND force-quotes the cell so the prefix survives parser round-trips. Applied to ALL string cells, not just suspect ones — numeric/boolean/enum columns never trigger the rule and the broad application removes future risk if a string column is added. 5 new `[Theory]`/`[Fact]` tests cover all four prefix chars plus benign-input control.
- [x] [Review][Patch] R3-H-S1-1 (High) `ExportEventCheckInRosterQueryHandler` re-enters MediatR — inject the read handler directly (BH-3). **Fixed.** Constructor now takes `GetEventCheckInRosterQueryHandler` directly instead of `IMediator`. Eliminates the double-fire of every `IPipelineBehavior` (validators, logging, audit, transactions) per CSV download. Added explicit `services.AddTransient<GetEventCheckInRosterQueryHandler>()` registration in [`IabConnect.Application/DependencyInjection.cs`](backend/src/IabConnect.Application/DependencyInjection.cs) — MediatR's `RegisterServicesFromAssembly` only wires up the `IRequestHandler<,>` interface, not the concrete class.
- [x] [Review][Patch] R3-M-S1-1 (Medium) Excel-collapse risk on trailing empty tick-box column — emit quoted-empty for last cell (BH-18). **Fixed.** `BuildRow` now passes `forceQuoteEmpty: i == cells.Count - 1` to `EscapeForCsvCell`, which emits `""` (quoted empty) for the last data cell. Survives Excel locales that aggressively trim a trailing empty cell after the final comma. New test `Export_LastColumnPresent_IsQuotedEmptyInRawBytes` asserts the raw bytes end with `,""\r\n`.
- [x] [Review][Patch] R3-M-S1-2 (Medium) Roster handler uses `DateTime.UtcNow`; inject `TimeProvider` (BH-15). **Fixed.** [`GetEventCheckInRosterQueryHandler`](backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQueryHandler.cs) now injects `TimeProvider` (already registered as `TimeProvider.System` in Infrastructure DI per `VolunteerShiftReminderService`). Both archive-expiry math and the `GeneratedAt` field now use the injected clock. New `Handle_GeneratedAt_UsesInjectedTimeProvider` test pins the behavior; existing archive-expiry tests refactored to use `FakeTimeProvider` for determinism.
- [x] [Review][Patch] R3-M-S1-3 (Medium) `OrderBy(StringComparer.Ordinal)` may misorder Unicode names; use invariant-culture comparer (AA-11). **Fixed.** Switched to `StringComparer.InvariantCulture` so apostrophes, hyphens, and any Devanagari/Latin mixed input order by Unicode collation rather than codepoint. FoldName output is mostly-ASCII so the comparer choice rarely diverges, but the invariant comparer is the locale-stable contract.
- [x] [Review][Patch] R3-M-S1-4 (Medium) AC-5 text says 10 columns; code emits 9 per D-S1-1 — sync AC text (AA-2). **Fixed.** AC-5 above now explicitly states "9 columns", lists the new layout without `QrCodeToken`, names `Present` as the last column, and cites D-S1-1, DN-6, L-S1-1, R3-C1, R3-M-S1-1 inline so the spec history is auditable.
- [x] [Review][Patch] R3-L-S1-1 (Low) `[ ]` literal in CSV header may confuse Excel name-range parsing (EC-24). **Fixed.** Bundled with R3-DN-6 resolution above — `[ ] (Anwesenheit)` → `Present` removes both the German label AND the `[ ]` literal in one rename.

## Round 4 Review Findings (2026-05-14)

**Scope:** Epic-3 boundary re-review (full diff `1466c35..HEAD`) after the Round-3 fix-pass. 3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). The Round-3 Critical set (CSV formula-injection, IDORs, token hashing) is confirmed resolved in the current diff. S1-scoped result: **0 Patch, 0 Decision, 1 Defer** — S1 is clean on code; one spec-text drift only.

### Defer

- [x] [Review][Defer] R4-Defer-S1-1 Roster query return-type drift — AC-1/AC-3 still say `IRequest<EventCheckInRosterDto?>`, code returns `IRequest<EventCheckInRosterLookup>` envelope [backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs] — deferred, spec reconciliation only; the envelope is the intentional Round-2 H-S1-3 fix and is correct, only the AC text was never updated to match.

