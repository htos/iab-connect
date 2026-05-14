# Story 9.3: Replace Hardcoded Organization References in Backend

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **no hardcoded organization name in backend-generated output**,
so that **emails, PDFs, calendar feeds, and API docs reflect my organization instead of "IAB Connect"**.

**Requirement:** REQ-086. Epic E9, Story 3 of 4.
**Depends on E9-S1** — runtime-resolvable references render from the `SystemSettings` singleton (`ApplicationName`), read via `ISystemSettingsRepository.GetSettingsAsync()`. Startup-time / config-object references go through `appsettings` configuration instead (they cannot reach the DB). The split is per-file in Dev Notes.

## Acceptance Criteria

1. **Runtime backend output is config-driven.** Email HTML (`EventNotificationService`, `DunningEmailService`) and the registration PDF (`EventRegistrationPdfExporter`) render the organization name from `SystemSettings.ApplicationName`, not the hardcoded `"IAB Connect"`.
2. **Startup-time references are config-driven.** The Swagger title/description (`Api/DependencyInjection.cs`) and the iCal `PRODID` (`CalendarFeedBuilder`) come from `appsettings` configuration with a literal default that **exactly preserves** today's values (`"IAB Connect API"`, `"-//IAB Connect//Events//EN"`).
3. **Config-object defaults de-branded.** `SmtpSettings.FromName` and `InvoiceSettings.OrganizationName`/`OrganizationEmail` code-level defaults are replaced with neutral placeholders; `appsettings.json`/`appsettings.Development.json` carry the deployment values.
4. **Behavior-preserving.** Every config default and `SystemSettings` default preserves current output. A deployment that has not changed its branding produces byte-identical emails/PDFs/feeds/Swagger as before. **The `CalendarFeedBuilder` change is a forward-fix into the done Epic 3 — it must be non-breaking; the iCal `UID` domain suffix `@iabconnect` is NOT changed (changing it breaks already-issued calendar UIDs).**
5. **Audit/regression intact.** Finance, calendar, and email are sensitive/audited workflows — existing regression tests stay green and new tests cover the configured-name path.
6. **Quality gate.** `dotnet test` from `backend/` stays green (currently 1837/1837, 0 warnings) with new tests added. No new analyzer warnings.

## Tasks / Subtasks

- [x] **Task 1 — Email services: inject `ISystemSettingsRepository` (AC: 1, 4)**
  - [x] `EventNotificationService.cs`: injects `ISystemSettingsRepository`; `await GetSettingsAsync(ct)` in each of the 4 `SendXxxAsync`; the 4 `BuildXxxHtml` helpers take an `appName` param and emit `{WebUtility.HtmlEncode(appName)}` in the `<h1>`.
  - [x] `DunningEmailService.cs`: injects the repo, fetches in `SendDunningEmailAsync`, threads `appName` into `BuildHtmlContent` (HtmlEncoded).
- [x] **Task 2 — Registration PDF exporter (AC: 1, 4)** — `EventRegistrationPdfExporter.cs`: re-registered **Scoped** (Q1 recommendation), injects `ISystemSettingsRepository`, `GenerateRegistrationListPdfAsync` is now genuinely async, `ComposeHeader` takes an `appName` param — the title bar renders `$"{appName} – Anmeldeliste"`.
- [x] **Task 3 — Swagger (AC: 2, 4)** — `Api/DependencyInjection.cs`: title/description read `configuration["Branding:ApiTitle"]` / `["Branding:ApiDescription"]` with literal defaults exactly preserving the previous values; the `UseSwaggerUI` endpoint label reads `Branding:ApiTitle` + " v1". No `SystemSettings` access at startup.
- [x] **Task 4 — Calendar feed PRODID (AC: 2, 4)** — new `CalendarFeedSettings` POCO (`ProdId` default = the previous literal); `CalendarFeedBuilder` takes the bound POCO via constructor injection (the Application project has no `Microsoft.Extensions.Options` dependency, so Infrastructure DI binds + exposes the POCO). `WriteEnvelopeStart` is now an instance method. The `UID:...@iabconnect` suffix is untouched.
- [x] **Task 5 — Config-object defaults (AC: 3, 4)** — `SmtpSettings.FromName` → neutral `"Organization"`; `InvoiceSettings.OrganizationName`/`OrganizationEmail` → neutral placeholders. `appsettings.json` `InvoiceSettings` de-branded to neutral. `appsettings.Development.json` `Smtp` block: keys `DefaultFromName`/`DefaultFromEmail` → `FromName`/`FromEmail` (the binding mismatch is fixed) with de-branded values.
- [x] **Task 6 — Seed data (AC: 3 — see Q2)** — `DevelopmentDataSeeder.cs`: the display-only `LastName = "IAB"` de-branded to `"Demo"`. The seed **emails** are intentionally NOT changed — see Completion Notes (coupled to the out-of-scope Keycloak realm seed; Q2 escalation).
- [x] **Task 7 — Tests (AC: 5, 6)**
  - [x] `EventNotificationServiceTests` — new case asserts the configured `ApplicationName` renders in the email HTML. `BackendBrandingTests` (`IabConnect.Infrastructure.Tests`) — dunning email HTML renders the configured name; the PDF exporter generates a valid PDF through the refactored Scoped/async path.
  - [x] `CalendarFeedSettingsTests` — `PRODID` equals the literal default when unset, equals the configured value when set, and the iCal `UID` `@iabconnect` suffix is unchanged.
  - [x] `SwaggerBrandingTests` (`IabConnect.Api.Tests`) — the Swagger doc title/description fall back to the literal `Branding:*` defaults (the shared test host carries no `Branding` section).
  - [x] `dotnet test` from `backend/` — **1872 passed, 0 failed, 0 warnings**.

## Dev Notes

### A. Confirmed references — and the resolution mechanism per file

| File:line | Current | Mechanism | Difficulty |
|-----------|---------|-----------|------------|
| `Infrastructure/Events/EventNotificationService.cs` 288,364,445,513 | `<h1>IAB Connect</h1>` ×4 | inject `ISystemSettingsRepository` (Scoped→Scoped) | **easy** |
| `Infrastructure/Email/DunningEmailService.cs` 104 | `<h1>IAB Connect</h1>` | inject `ISystemSettingsRepository` | **easy** |
| `Infrastructure/Events/EventRegistrationPdfExporter.cs` 51 | `"IAB Connect – Anmeldeliste"` | re-register Scoped + inject repo (Q1) | **medium** — singleton today |
| `Api/DependencyInjection.cs` 53,55,246 | Swagger title/description/UI label | `IConfiguration` section, literal defaults | **medium** — startup, pre-DB |
| `Application/Events/Calendar/CalendarFeedBuilder.cs` 16 | `ProdId` const | `IOptions<CalendarFeedSettings>`, default = current literal | **medium** — singleton, done-Epic-3 forward-fix |
| `Infrastructure/Email/SmtpSettings.cs` 15 | `FromName = "IAB Connect"` | neutral code default + `appsettings` (fix key-name mismatch) | **easy** |
| `Infrastructure/Finance/InvoiceSettings.cs` 10,12 | `OrganizationName`/`OrganizationEmail` brand defaults | neutral code defaults + `appsettings` | **easy** |
| `Api/appsettings.Development.json` 46 | `Smtp.DefaultFromName: "IAB Connect"` | de-brand / reconcile key name | **easy** |
| `Api/appsettings.json` 63,64 | `InvoiceSettings.OrganizationName/Email` | de-brand to neutral deployment defaults | **easy** |
| `Persistence/DevelopmentDataSeeder.cs` 22,24,30,38 | seed emails + `LastName="IAB"` | de-brand demo values (Q2) | **easy** |

### B. Out of scope (do NOT touch)

- **`IabConnect.*` namespace / assembly names** — OD-4, explicitly out of scope (internal-only, high-churn, zero functional value).
- **Infra identifiers:** `iabconnect` DB name, Keycloak realms (`iabconnect`/`iabconnect-api`/`iabconnect-admin`), S3 bucket `iabconnect-documents`, log path `iabconnect-.log`, the unsubscribe-key default, `CalendarFeedBuilder.cs:58` `@iabconnect` UID suffix — all machine identifiers, not user-visible. Changing the UID suffix would break already-issued calendar subscriptions.
- **`RealisticDataSeeder.cs`** — commented-out dead code (not invoked from `Program.cs`).
- **`Program.cs:15`** `Log.Information("Starting IAB Connect API")` — log line, not user output. Trivial to fix if desired but not required.
- **`SystemSettings.cs` entity defaults** (`ApplicationName = "IAB Connect"`, `LogoText = "IAB"`) — E9-S1 deliberately left these; whether to neutralize the *defaults* is a Q3 for E9-S1's PM question, not this story. Don't change them here.

### C. Current state of files being modified

- **`SystemSettings`** (`Domain/Common/SystemSettings.cs`): singleton entity, `ApplicationName` etc. Read via **`ISystemSettingsRepository.GetSettingsAsync(ct)`** (interface in `Application/Common/`, impl in `Infrastructure/Persistence/Repositories/`). The repo is registered **Scoped** (`Infrastructure/DependencyInjection.cs:95-97`) and depends on `ApplicationDbContext`. **There is no sync or cached accessor** — `GetSettingsAsync` is async and hits the DB. Any service reading it must be Scoped (or create a scope).
- **`EventNotificationService`** / **`DunningEmailService`**: both `: IXxx`, registered Scoped (`Infrastructure/DependencyInjection.cs:215`/`:212`), ctors inject `IEmailSender`/`IOptions<SmtpSettings>`/`ILogger` (Dunning also member/sponsor/supplier repos). `BuildXxxHtml`/`BuildHtmlContent` are `private static` — must lose `static` or take an `appName` param. Send methods already `await` and have a `ct`.
- **`EventRegistrationPdfExporter`**: `: IRegistrationPdfExporter`, **parameterless ctor**, registered **Singleton** (`Infrastructure/DependencyInjection.cs:218`). `GenerateRegistrationListPdfAsync` is `return Task.FromResult(...)` (fake-async); `ComposeHeader` is `private static`. QuestPDF-based.
- **Swagger**: `Api/DependencyInjection.cs` — `AddSwaggerGen` in `AddApiServices` (53–56), `UseSwaggerUI` in `UseApiPipeline` (244–248). Both `static` methods at startup; only `IConfiguration`/`IWebHostEnvironment`/`WebApplication` available. Migrations run later in `Program.cs` — DB is not a reliable source here.
- **`CalendarFeedBuilder`**: `: ICalendarFeedBuilder`, documented "Stateless and thread-safe; registered as a singleton" (`Application/DependencyInjection.cs:49`). `ProdId` is `private const`, used in `static WriteEnvelopeStart`. Callers are scoped query handlers / `EventEndpoints.cs:228`.
- **`SmtpSettings`** / **`InvoiceSettings`**: POCO options classes (`SectionName` = `"Smtp"` / `"InvoiceSettings"`), bound via `services.Configure<>` at startup. Cannot read `SystemSettings`.

### D. Architecture & project constraints

- Modular monolith / Clean Architecture: entity unchanged here; service edits in Infrastructure; Swagger in Api; `CalendarFeedBuilder` in Application. No business logic moved. [Source: architecture.md#ADR-001]
- C# nullable + warnings-as-errors; `CancellationToken` flows through new async paths; central package versions only — no new packages. [Source: project-context.md]
- Finance, calendar, audit, email are sensitive workflows — regression tests required when changed. [Source: project-context.md]
- `CalendarFeedBuilder` PRODID change is a forward-fix to **done Epic E3** — non-breaking, config default preserves behavior. [Source: epics-and-stories.md#E9-S3, architecture.md#REQ-086]
- Don't commit secrets; `appsettings` values are deployment config, not secrets — keep real per-environment values out of source where they'd be sensitive (org email is not a secret, fine to keep a neutral default). [Source: project-context.md]

### Project Structure Notes

UPDATE-only except two new POCO option classes possible (`CalendarFeedSettings`, and a `BrandingOptions` for Swagger). ~11 files, ~19 occurrences (matches the Sprint Change Proposal scan). New tests in `IabConnect.Infrastructure.Tests` and `IabConnect.Api.Tests`. No EF migration (no schema change). No new NuGet packages.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E9-S3: Replace Hardcoded Organization References in Backend]
- [Source: _bmad-output/planning-artifacts/architecture.md#REQ-086]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md] — backend scan (~19 occurrences / 11 files)
- [Source: backend/src/IabConnect.Domain/Common/SystemSettings.cs] + [Source: backend/src/IabConnect.Application/Common/ISystemSettingsRepository.cs]
- [Source: e9-s1-extend-systemsettings-and-add-branding-admin-ui.md] — dependency

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **`EventRegistrationPdfExporter` registration.** Recommended: change `AddSingleton` → `AddScoped` so it can inject `ISystemSettingsRepository` cleanly. The alternative (keep singleton, use `IServiceScopeFactory`, or thread the name from the caller) is more code. Confirm the Scoped re-registration is acceptable (it's a thin stateless exporter — Scoped is fine).
2. **Seed data.** De-brand `DevelopmentDataSeeder` demo emails/surname to neutral values, or leave as obvious dev fixtures? Recommend de-brand (cheap, consistent).
3. **Swagger config shape.** Recommended new `appsettings` section `Branding:OrganizationName` shared with future config needs, vs a `Swagger:*`-specific section. Recommend `Branding:*` so the org name has one config home.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (bmad-dev-story)

### Debug Log References

- `IabConnect.Application` has no `Microsoft.Extensions.Options` reference — `CalendarFeedBuilder` injects the bound `CalendarFeedSettings` POCO directly (Infrastructure DI binds `IOptions<>` and also exposes `.Value` as a singleton) rather than adding a package.
- `EventRegistrationPdfExporter` PDF test initially failed on the QuestPDF license gate; the test sets `QuestPDF.Settings.License = LicenseType.Community` (the production host already sets this at startup).
- 5 existing tests referenced the changed constructors (`EventNotificationService` +`ISystemSettingsRepository`, `CalendarFeedBuilder` +`CalendarFeedSettings`) and were updated to pass the new args.

### Completion Notes List

- **Runtime output (Task 1–2)** — `EventNotificationService` (4 email HTML headers) and `DunningEmailService` render `SystemSettings.ApplicationName` via the Scoped `ISystemSettingsRepository`, HtmlEncoded. `EventRegistrationPdfExporter` re-registered Scoped + genuinely async, header renders the configured name.
- **Startup output (Task 3–4)** — Swagger title/description are `Branding:*` config-driven with literal defaults preserving today's values. ICS `PRODID` is `CalendarFeedSettings`-driven (default = previous literal); the per-event `UID @iabconnect` suffix is deliberately untouched (machine identifier — changing it breaks issued subscriptions).
- **Config defaults (Task 5)** — `SmtpSettings.FromName` + `InvoiceSettings.OrganizationName`/`OrganizationEmail` code defaults neutralized; `appsettings.json` `InvoiceSettings` de-branded; `appsettings.Development.json` `Smtp` key-name mismatch (`DefaultFromName`/`DefaultFromEmail` → `FromName`/`FromEmail`) fixed so the JSON actually binds.
- **Q1 (PDF exporter registration)** — implemented the recommended Singleton→Scoped re-registration.
- **Q2 (seed data) — DECISION: surname de-branded, emails NOT changed.** The `DevelopmentDataSeeder` emails (`admin@iabconnect.ch` etc.) are coupled to `infra/keycloak/realms/iabconnect-realm.json` (explicitly out of scope per Dev Notes §B) and the login dev-credentials block (retained by E9-S2 §C). Changing the seeder emails in isolation would break dev seeding (the seeder looks up Keycloak users by email). De-branding the emails is a **coordinated infra follow-up** (realm JSON + seeder + login page together) — escalating Q2 for the PM. The display-only `LastName = "IAB"` → `"Demo"` was de-branded (zero coupling).
- **Q3 (Swagger config shape)** — used a shared `Branding:*` section as recommended.
- **Behaviour-preserving (AC-4)** — emails/PDFs/feeds/Swagger are byte-identical for an unconfigured deployment: `SystemSettings` still defaults `ApplicationName = "IAB Connect"` (E9-S1 left it), and all config reads fall back to the previous literals. The one intentional shipped-default change is `InvoiceSettings` in `appsettings.json` → neutral, per Dev Notes §A (a generic platform ships generic invoice org defaults; real deployments override).
- **Validation** — `dotnet build IabConnect.sln` → **0 warnings**; `dotnet test` → **1872 passed, 0 failed** (Application 1420, Api 71, Infrastructure 381), up from the 1865 post-E9-S1 baseline.

### File List

**Backend (new):**
- `backend/src/IabConnect.Application/Events/Calendar/CalendarFeedSettings.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/BackendBrandingTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/CalendarFeedSettingsTests.cs`
- `backend/tests/IabConnect.Api.Tests/SwaggerBrandingTests.cs`

**Backend (modified):**
- `backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs`
- `backend/src/IabConnect.Infrastructure/Email/DunningEmailService.cs`
- `backend/src/IabConnect.Infrastructure/Events/EventRegistrationPdfExporter.cs`
- `backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs`
- `backend/src/IabConnect.Infrastructure/Finance/InvoiceSettings.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/DevelopmentDataSeeder.cs`
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs`
- `backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs`
- `backend/src/IabConnect.Api/DependencyInjection.cs`
- `backend/src/IabConnect.Api/appsettings.json`
- `backend/src/IabConnect.Api/appsettings.Development.json`
- `backend/tests/IabConnect.Application.Tests/Events/EventNotificationServiceTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/CalendarFeedBuilderTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/GetPublicCalendarFeedQueryHandlerTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Calendar/GetMemberCalendarFeedQueryHandlerTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventNotificationServiceVolunteerReminderTests.cs`

### Change Log

- 2026-05-14 — Story 9.3 implemented (REQ-086, E9-S3): hardcoded organization references removed from backend output — email HTML + registration PDF render `SystemSettings.ApplicationName`; Swagger title/description + ICS `PRODID` are config-driven with behaviour-preserving literal defaults; `SmtpSettings`/`InvoiceSettings` code defaults neutralized + the `Smtp` appsettings key-binding mismatch fixed; dev-seeder surname de-branded (emails escalated as Q2). New `CalendarFeedSettings` POCO. 4 new test files + 5 existing tests updated; backend 1872/1872 green, 0 warnings. Status → review.

## Review Findings

_Epic-boundary code review — 2026-05-14 (bmad-code-review). 3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

### Decision Needed (resolved 2026-05-14 → patch)

- [x] [Review][Patch] `SmtpSettings.FromName` default change breaks S3 AC-4 "byte-identical" for production [`SmtpSettings.cs`, `appsettings.json`] — the code default was changed `"IAB Connect"` → `"Organization"`, but production `appsettings.json` has no `Smtp` section, so an existing prod deployment now sends mail with `FromName: "Organization"` — a silent change on an audited email workflow. **Resolution: add Smtp section to production appsettings.json** — keep the neutral `"Organization"` code default but add an explicit `Smtp` block to production `appsettings.json` carrying the deployment's sender name, so existing prod output stays byte-identical.

### Patches

- [x] [Review][Patch] `CalendarFeedSettings.ProdId` is a public mutable setter on a singleton [`CalendarFeedSettings.cs`] — the POCO is registered directly as a singleton and `ProdId { get; set; }` is publicly mutable; any resolver can mutate process-wide config at runtime. `CalendarFeedBuilder` copies it into a readonly field so it is latent, not exploited — change to `init`. (Also low: `WriteEnvelopeStart` appends `_prodId` raw with no RFC-5545 line-folding/CRLF guard, unlike every other line — an operator-misconfigured value yields a malformed feed.)
- [x] [Review][Patch] `SmtpSettings.FromEmail` code default still branded [`SmtpSettings.cs`] — S3 de-branded `FromName` but left `FromEmail = "noreply@iabconnect.local"`. A deployment that sets `Smtp:FromName` but not `Smtp:FromEmail` sends from a branded domain. Replace with a neutral placeholder for consistency with the `FromName` de-brand.

### Deferred

- [x] [Review][Defer] Extra DB round-trip per email/PDF send, no `SystemSettings` caching [`EventNotificationService.cs`, `DunningEmailService.cs`, `EventRegistrationPdfExporter.cs`] — each send independently calls `GetSettingsAsync` to read `ApplicationName`; a campaign to N recipients = N identical queries on a singleton row the frontend caches for 300s. Not a correctness bug. — deferred — introduced by E9, but a shared `SystemSettings` cache is a caching-strategy decision beyond this epic.
- [x] [Review][Defer] Email HTML encodes the org name but not adjacent user fields [`DunningEmailService.cs`, `EventNotificationService.cs`] — the new code wraps `appName` in `WebUtility.HtmlEncode`, but the same templates still interpolate `{invoice.RecipientName}`, `{notice.Notes}`, `{evt.Title}` etc. raw — a pre-existing HTML-injection hole the new code draws attention to without closing. — deferred, pre-existing
