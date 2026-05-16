# Story 11.2: Introduce `ASPNETCORE_ENVIRONMENT=Beta`

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the maintainer**,
I want **a distinct `Beta` environment that inherits Production hardenings AND a tester-visible BETA banner driven by a public env label**,
so that **Beta deployments behave like Production at the security boundary while testers see at a glance that they are NOT in Production**.

**Requirement:** REQ-088 AC-7 (tester-visible BETA banner), REQ-088 AC-4 (no secrets in repo). Epic E11 (Environment and Configuration Management for Beta), Story 2 of 3. Closes the E11-S1 deferred-work entries:
- `appsettings.json base cleanup` — move dev-only defaults out of base so Beta does not inherit `localhost:5433` / `rustfsadmin`.
- `Beta Serilog.WriteTo array-merge fix` — move the File sink out of base so Beta inherits Console-only per ADR-017.

**Upstream:** E11-S1 (configuration-surface foundation — committed `backend/.env.example`, `frontend/.env.example`, `appsettings.Beta.json` skeleton, README precedence, two deferred-work entries this story closes).

**Downstream:** E12-S1 / E12-S3 (Dockerfiles will set `ASPNETCORE_ENVIRONMENT=Beta` in the container `ENV`), E13-S2 (Railway env-var provisioning sets `NEXT_PUBLIC_ENV_LABEL=beta`), E18-S3 (originally scoped as "Beta banner in UI" but this story implements the banner per UX-design — E18-S3 reduces to a polish/feedback-channel integration after E18-S4 ships).

## Acceptance Criteria

1. **`backend/src/IabConnect.Api/appsettings.Beta.json` finalized.** Skeleton committed by E11-S1 already contains `Serilog.Using = ["Serilog.Sinks.Console"]`, `Serilog.WriteTo = [{"Name":"Console"}]`, and `RetentionEnforcement.Enabled = false`. This story ADDS one section to the existing file: `"Logging": { "LogLevel": { "Default": "Information" } }` (matches the epic spec). Result: 3 sections total (Serilog, Logging, RetentionEnforcement). Still no connection strings, no Keycloak URLs, no secrets — Beta-specific connection/identity values come from `Railway Variables` at runtime.
2. **`appsettings.json` base cleanup — move dev-only defaults to `appsettings.Development.json`.** The base `appsettings.json` currently duplicates dev hosts with `appsettings.Development.json`. Move the following six keys OUT of base and INTO `appsettings.Development.json` (base keeps the section structure with empty-string or placeholder values so binding never throws NullRef):
   - `ConnectionStrings.DefaultConnection` (currently `"Host=localhost;Port=5433;Database=iabconnect;Username=postgres;Password=postgres"` at base `appsettings.json:34`).
   - `Keycloak.Authority` (currently `"http://localhost:8080/realms/iabconnect"` at base `appsettings.json:37`).
   - `DocumentStorage.ServiceUrl` (currently `"http://localhost:9000"` at base `appsettings.json:49`).
   - `DocumentStorage.AccessKey` (currently literal `"rustfsadmin"` at base `appsettings.json:50` — **committed dev credential**, top removal priority).
   - `DocumentStorage.SecretKey` (currently literal `"rustfsadmin"` at base `appsettings.json:51` — same).
   - `DocumentStorage.BucketName` (currently `"iabconnect-documents"` at base `appsettings.json:52`).
   - `Smtp.Host` (currently `"localhost"` at base `appsettings.json:62`).

   Base retains: `Logging`, `Serilog` (less the File sink — AC-3), `AllowedHosts`, `Keycloak.ClientId` / `Keycloak.ClientSecret` (ClientId is a non-secret stable identifier; ClientSecret stays as empty `""` so DI binding works), `Auth.CalendarTokenPepper` (already empty), `Frontend.BaseUrl` (already `"http://localhost:3000"` is acceptable — it's a CORS origin, not a secret, and a non-Dev deployment overrides via env), `Hangfire.DashboardPath`, `Features`, `Smtp.Port`/`EnableSsl`/etc. (non-host fields), `InvoiceSettings`. The `Development.json` overlay gains every removed key with its current dev-value so `dotnet run` (Development) continues to work bit-for-bit identically.
3. **Beta `Serilog.WriteTo` array-merge fix — move File sink to `appsettings.Development.json`.** Base `appsettings.json:19-30` currently has `Serilog.WriteTo = [{"Name":"Console"}, {"Name":"File", "Args":{...}}]`. Move the File sink (the second array element) OUT of base and INTO `appsettings.Development.json`'s `Serilog.WriteTo` array (which currently has only Console at `appsettings.Development.json:23`). After this move:
   - **Base** `Serilog.WriteTo` = `[{"Name":"Console"}]` (single element).
   - **Development** `Serilog.WriteTo` = `[{"Name":"Console"}, {"Name":"File", "Args":{...}}]` (two elements, dev-only File sink).
   - **Beta** `Serilog.WriteTo` = `[{"Name":"Console"}]` (Beta's array overrides base index 0, no base index 1 to inherit → genuinely Console-only per ADR-017).

   Smoke-test: with `ASPNETCORE_ENVIRONMENT=Beta dotnet run`, verify that `backend/src/IabConnect.Api/logs/` is NOT created (or stays empty if pre-existing). With `ASPNETCORE_ENVIRONMENT=Development dotnet run`, verify `logs/iabconnect-<date>.log` IS created as before.
4. **`RetentionEnforcement__Enabled` flag wired at the job-registration site.** Currently `backend/src/IabConnect.Api/DependencyInjection.cs:298-302` unconditionally registers `RetentionEnforcementJob` via `jobManager.AddOrUpdate<RetentionEnforcementJob>(...)`. Wrap this single registration call in `if (configuration.GetValue<bool>("RetentionEnforcement:Enabled", defaultValue: true))` so it skips when the flag is `false`. `appsettings.Beta.json` already sets the flag to `false` per AC-1, so Beta deployments will NOT register the job. The other three recurring jobs (`MarkInvoicesOverdueJob`, `DunningScheduleGenerationJob`, `VolunteerShiftReminderJob`) remain unconditional — per ADR-020, only retention enforcement is suppressed in Beta. Add an XML doc comment above the if-block referencing REQ-088 / ADR-020.
5. **Code audit: NO `IsDevelopment()` relaxation to include Beta.** The pipeline already has 7 environment-conditional sites. After this story they MUST all still gate on `IsDevelopment()` (or `IsDevelopment() || envName == "Testing"`) WITHOUT extending to `|| envName == "Beta"`. Beta inherits Production-side behavior at every site:
   - `DependencyInjection.cs:96` — Dev-only permissive CORS allowlist. Beta gets strict CORS (single origin via `Frontend:BaseUrl`).
   - `DependencyInjection.cs:124` — `RequireHttpsMetadata = !(IsDev || Testing)`. Beta → `true`.
   - `DependencyInjection.cs:238` — `if (!IsDev && envName != "Testing") app.UseHsts()`. Beta → HSTS enabled.
   - `DependencyInjection.cs:250-258` — `if (IsDev) app.UseSwagger() / UseSwaggerUI()`. Beta → Swagger off, returns 404 at `/swagger`.
   - `DependencyInjection.cs:262-265` — `if (!IsDev && envName != "Testing") app.UseHttpsRedirection()`. Beta → HTTPS redirect on.
   - `DependencyInjection.cs:276-279` — `if (IsDev) app.UseHangfireDashboard("/hangfire")`. Beta → `/hangfire` returns 404.

   Deliverable: NO code change required at these 7 sites — they already gate correctly. The audit is a verification step (grep + read) whose evidence lives in Completion Notes. If a future commit accidentally adds `|| envName == "Beta"` to any site, the regression test in AC-9 must catch it.
6. **Frontend `BetaBanner` component per ux-design.md "BETA Banner" spec.** New client component at `frontend/src/components/navigation/BetaBanner.tsx`. Behavior:
   - Renders only when `process.env.NEXT_PUBLIC_ENV_LABEL === "beta"` (any other value, or unset, returns `null`).
   - Returns `null` when the user has dismissed it this session (read `sessionStorage.getItem("iabc:beta-banner-dismissed")` — note the namespaced key to avoid collision).
   - On mount, uses `useEffect` to read the dismissed flag; uses `useState` to track local visibility so dismissal is immediate without a page reload.
   - Markup: `<div role="status" aria-label={t("ariaLabel")}>` containing a flex row with: left = message text (`t("bannerMessage")`), right = Feedback link (external `<a>` with `target="_blank" rel="noopener noreferrer"`, href = `process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "https://github.com/htos/iab-connect/issues/new?template=beta-feedback.md"`) followed by a dismiss button (`aria-label={t("dismissAriaLabel")}`, an inline `<X />` lucide icon).
   - Styling: `w-full bg-orange-500 text-white text-sm py-2 px-4 flex flex-wrap items-center justify-between gap-2`. Height naturally lands at ~`2.5–3rem` per UX spec.
   - Dismiss button uses `aria-label` (translation key) NOT just visual `×`. Onclick: `setVisible(false)` + `sessionStorage.setItem("iabc:beta-banner-dismissed", "1")`.
   - SPDX header line 1 per E20-S2 policy (when E20-S2 lands; for now committed without SPDX is acceptable since E20-S2 is a separate ready-for-dev story).
7. **Mount `BetaBanner` at root layout above `<MainLayout>`.** Edit `frontend/src/app/layout.tsx`. Inside `<NextIntlClientProvider>`, render `<BetaBanner />` BEFORE `<MainLayout>{children}</MainLayout>` (the banner sits above the authenticated shell). The banner is a sibling of `MainLayout`, not a child. Result: every route (login, dashboard, public marketing, `/site-unavailable`, `/module-unavailable`) shows the banner when `NEXT_PUBLIC_ENV_LABEL=beta`. **Coordination note:** E20-S4 (Wave 4, ready-for-dev) plans to add a `LicenseFooter` ALSO as a sibling of `MainLayout`. Both stories must land cleanly — BetaBanner above, LicenseFooter below. Order in the JSX should be: `<BetaBanner /> <MainLayout>{children}</MainLayout> <LicenseFooter />` (LicenseFooter added by E20-S4; this story only touches the banner).
8. **Translation keys for `beta` namespace (both `de.json` and `en.json`).** New top-level `beta` namespace in `frontend/messages/de.json` and `frontend/messages/en.json`:
   - DE: `{ "bannerMessage": "Beta — Daten können jederzeit zurückgesetzt werden", "feedbackLink": "Feedback geben", "dismissAriaLabel": "Banner ausblenden", "ariaLabel": "Beta-Hinweis" }`
   - EN: `{ "bannerMessage": "Beta — data may be reset at any time", "feedbackLink": "Give feedback", "dismissAriaLabel": "Dismiss banner", "ariaLabel": "Beta notice" }`
   - Place alphabetically with other top-level namespaces. Verify JSON validity in both files after edit.
9. **Backend tests for the wired-up changes.**
   - **`RetentionEnforcementJobRegistrationTests`** in `backend/tests/IabConnect.Api.Tests/` — two cases: (a) when `RetentionEnforcement:Enabled = true` (default), the job IS registered with `IRecurringJobManager`; (b) when `false`, the job is NOT in the registry. Mirror the pattern from `VolunteerShiftReminderJobRegistrationTests` (the constants `VolunteerReminderJobId` / `VolunteerReminderCron` are already InternalsVisibleTo'd at `DependencyInjection.cs:30-33`). If `RetentionEnforcementJob` doesn't have an analogous constant, add `internal const string RetentionJobId = "enforce-retention-policies"` alongside.
   - **`BetaEnvironmentHardeningTests`** in `backend/tests/IabConnect.Api.Tests/` — uses `WebApplicationFactory<Program>` with `WebHostBuilder.UseEnvironment("Beta")` and asserts:
     - `GET /swagger` → 404 (Swagger off).
     - `GET /hangfire` → 404 (dashboard off).
     - HSTS middleware is registered (peek at `Strict-Transport-Security` header on a 200 response, or assert middleware presence via `IApplicationBuilder` introspection).
     - HTTPS redirect middleware is registered (request via `http://` redirects with 307/308).
     - CORS strict mode (a request from an unallowed origin gets no `Access-Control-Allow-Origin` header).
   - **`AppSettingsLayeringTests`** in `backend/tests/IabConnect.Api.Tests/` — builds `IConfiguration` from `appsettings.json + appsettings.Beta.json` (NOT `Development.json`), asserts that `ConnectionStrings:DefaultConnection`, `Keycloak:Authority`, `DocumentStorage:ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName`, and `Smtp:Host` are all empty/null (NOT `localhost`/`rustfsadmin`). This proves the base cleanup landed.
10. **Frontend tests for `BetaBanner`.** New `frontend/src/components/navigation/BetaBanner.test.tsx`:
    - Renders message when `process.env.NEXT_PUBLIC_ENV_LABEL = "beta"`.
    - Returns null when `NEXT_PUBLIC_ENV_LABEL` is unset.
    - Returns null when `NEXT_PUBLIC_ENV_LABEL = "production"` or any non-beta value.
    - After clicking dismiss, the component returns null and `sessionStorage.getItem("iabc:beta-banner-dismissed")` returns `"1"`.
    - Dismiss button has the expected `aria-label`.
    - Feedback link has `target="_blank"` and `rel="noopener noreferrer"`.
    - Mock `next-intl` per existing convention (`useTranslations: () => (key: string) => key`).
    - Use `beforeEach` to set `process.env.NEXT_PUBLIC_ENV_LABEL` and clear `sessionStorage`.
11. **Manual smoke-test evidence in Completion Notes.** Capture each of the following as one-line entries:
    - `ASPNETCORE_ENVIRONMENT=Beta dotnet run` — startup log shows `Environment: Beta` (from `Program.cs:44`). `GET http://localhost:5000/swagger` returns 404. `GET http://localhost:5000/hangfire` returns 404. `IRecurringJobManager` listing does NOT include `enforce-retention-policies`.
    - `ASPNETCORE_ENVIRONMENT=Beta dotnet run` — `backend/src/IabConnect.Api/logs/` is empty (or stays at pre-run state).
    - `NEXT_PUBLIC_ENV_LABEL=beta npm run dev` — visit `/login` (anonymous) and `/dashboard` (after auth) — orange BETA banner appears at the top of both. Click `×` → banner hides; reload page → still hidden (sessionStorage). Open new tab → banner appears again.
    - `npm run dev` (no `NEXT_PUBLIC_ENV_LABEL`) — banner does NOT appear. Same for `NEXT_PUBLIC_ENV_LABEL=production`.
12. **Quality gates.** `dotnet build` 0 warn / 0 err. `dotnet test` previous count plus the new 3 test classes (≈8-10 new tests) — record the new total in Completion Notes. `npm run typecheck` / `npm run lint` / `npm run build` / `npm test` (Vitest) all green; pre-existing E9.S2 lint baseline errors in `members/segments/page.tsx` remain out of scope. Verify no regression on the `KeycloakHealthCheck.cs:16` typo defer item — it stays deferred to its own follow-up story per `deferred-work.md`.

## Tasks / Subtasks

- [ ] **Task 1 — Finalize `appsettings.Beta.json` (AC: 1)** — open `backend/src/IabConnect.Api/appsettings.Beta.json` (committed by E11-S1 as skeleton). Add the `Logging.LogLevel.Default = "Information"` section. The resulting file structure: `{ "Serilog": {...}, "Logging": { "LogLevel": { "Default": "Information" } }, "RetentionEnforcement": { "Enabled": false } }`. LF line endings, final newline. Verify JSON parses via `dotnet build`.
- [ ] **Task 2 — `appsettings.json` base cleanup (AC: 2)** — move the 6 dev-default keys to `appsettings.Development.json`.
  - [ ] 2.1 Edit `backend/src/IabConnect.Api/appsettings.json`. Replace the values (do NOT remove the sections — keep structural keys with empty strings so DI binding never NullRefs): `ConnectionStrings.DefaultConnection = ""`, `Keycloak.Authority = ""`, `DocumentStorage.ServiceUrl = ""`, `DocumentStorage.AccessKey = ""`, `DocumentStorage.SecretKey = ""`, `DocumentStorage.BucketName = ""`, `Smtp.Host = ""`. Keep `Keycloak.ClientId = "iabconnect-api"` (non-secret stable identifier) and `Keycloak.ClientSecret = ""` (already empty in base).
  - [ ] 2.2 Edit `backend/src/IabConnect.Api/appsettings.Development.json`. The dev overlay ALREADY duplicates these values (lines 26, 29, 51-55), so no additions needed there — the cleanup is base-side only. Verify by diff: after Task 2.1+2.2, `git diff appsettings.Development.json` shows zero changes; `git diff appsettings.json` shows the 7 value replacements.
  - [ ] 2.3 Run `dotnet test` to catch any test that read from base before the dev-overlay applied. If a test broke, it's surfacing a real dependency on a localhost default that should be explicit — fix the test, not by reverting.
- [ ] **Task 3 — Move Serilog File sink to Development overlay (AC: 3)** — closes the E11-S1 Beta array-merge defer.
  - [ ] 3.1 Open `backend/src/IabConnect.Api/appsettings.json`. The current `Serilog.WriteTo` array at lines 19-30 has TWO entries (`Console` and `File` with full Args). REMOVE the second array element (the File sink + its Args block). The result: `"WriteTo": [{ "Name": "Console" }]`.
  - [ ] 3.2 Open `backend/src/IabConnect.Api/appsettings.Development.json`. The current `Serilog.WriteTo` array at line 23 has ONE entry (`Console`). ADD the File sink as a second element with the SAME Args block that was in base. Result matches what base looked like before this move.
  - [ ] 3.3 Verify: `dotnet run --project backend/src/IabConnect.Api` (default env = Development) creates `backend/src/IabConnect.Api/logs/iabconnect-<date>.log` as before. `ASPNETCORE_ENVIRONMENT=Beta dotnet run --project backend/src/IabConnect.Api` does NOT create the logs/ directory.
- [ ] **Task 4 — Wire `RetentionEnforcement__Enabled` flag (AC: 4)** — touch `backend/src/IabConnect.Api/DependencyInjection.cs:298-302`.
  - [ ] 4.1 The current code:
    ```csharp
    jobManager.AddOrUpdate<RetentionEnforcementJob>(
        "enforce-retention-policies",
        job => job.ExecuteAsync(CancellationToken.None),
        Cron.Weekly,
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    ```
  - [ ] 4.2 Wrap in conditional:
    ```csharp
    // REQ-088 (E11-S2): retention enforcement is suppressed in Beta per ADR-020 so tester
    // data is not deleted by default-policy retention rules during the validation window.
    if (app.Configuration.GetValue<bool>("RetentionEnforcement:Enabled", defaultValue: true))
    {
        jobManager.AddOrUpdate<RetentionEnforcementJob>(
            RetentionJobId,
            job => job.ExecuteAsync(CancellationToken.None),
            Cron.Weekly,
            new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });
    }
    ```
  - [ ] 4.3 Add `internal const string RetentionJobId = "enforce-retention-policies";` near the existing `VolunteerReminderJobId` constant at line 30 so the test in AC-9 can assert against it without string drift.
  - [ ] 4.4 Note: `app.Configuration` is accessible here because we are inside the `UseApiPipeline` extension method. The `configuration` parameter is `app.Configuration` already wired by `WebApplication.CreateBuilder`. If the extension method doesn't have `app.Configuration` reachable, use `app.Services.GetRequiredService<IConfiguration>()`.
- [ ] **Task 5 — Code audit verification (AC: 5)** — no code change required.
  - [ ] 5.1 Run `rg -n "IsDevelopment\(\)" backend/src/`. Expected hits: `Program.cs:51`, `DependencyInjection.cs:96, 124, 238, 250, 262, 276`. Verify NONE of them has `|| envName == "Beta"` appended. Document the count in Completion Notes.
  - [ ] 5.2 Run `rg -n "EnvironmentName" backend/src/`. Expected hits: `Program.cs:44, 46`, `DependencyInjection.cs:96, 124, 238, 262, 282`. Verify NONE compares against `"Beta"` to relax hardening.
  - [ ] 5.3 Add a one-line section to the Completion Notes: "Audit verified — 0 IsDevelopment() relaxations to include Beta; Beta inherits Production hardenings at all 7 conditional sites." Cite the file:line list.
- [ ] **Task 6 — Create `BetaBanner` component (AC: 6)** — `frontend/src/components/navigation/BetaBanner.tsx`.
  - [ ] 6.1 New client component (`"use client"` directive on line 1 — wait, AC says SPDX line 1 — order is: SPDX header line 1, blank line 2, `"use client"` line 3, blank line 4, imports). Note: SPDX is per E20-S2 policy which is ready-for-dev but not yet implemented — adding it now is forward-compatible.
  - [ ] 6.2 Imports: `useEffect`, `useState` from `react`; `useTranslations` from `next-intl`; `X` icon from `lucide-react`.
  - [ ] 6.3 Component: read `envLabel = process.env.NEXT_PUBLIC_ENV_LABEL`. If `envLabel !== "beta"`, return `null` BEFORE any hook calls (early return for non-Beta deployments — React allows this only when consistent across renders, which here it is because the env var is build-time constant).
  - [ ] 6.4 Use `const [visible, setVisible] = useState(true)`. Use `useEffect(() => { if (sessionStorage.getItem("iabc:beta-banner-dismissed") === "1") setVisible(false); }, [])` to hide after re-mount if previously dismissed this session.
  - [ ] 6.5 If `!visible` return `null`.
  - [ ] 6.6 Compute `feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL ?? "https://github.com/htos/iab-connect/issues/new?template=beta-feedback.md"`. The `beta-feedback.md` issue template doesn't exist yet — it's a forward reference to E18-S4. The link still works without the template; GitHub falls back to the issue creation form.
  - [ ] 6.7 Render the orange strip per AC-6 markup.
  - [ ] 6.8 Dismiss handler: `setVisible(false); sessionStorage.setItem("iabc:beta-banner-dismissed", "1");`.
- [ ] **Task 7 — Mount `BetaBanner` in root layout (AC: 7)** — edit `frontend/src/app/layout.tsx`.
  - [ ] 7.1 Add import: `import { BetaBanner } from "@/components/navigation/BetaBanner";` (or `import BetaBanner from ...` if default export is preferred — match existing convention; check how `MainLayout` is exported and mirror).
  - [ ] 7.2 Inside `<NextIntlClientProvider messages={messages}>`, add `<BetaBanner />` BEFORE `<MainLayout>{children}</MainLayout>`.
  - [ ] 7.3 Verify the diff: only one new import line, one new JSX element. Nothing else in layout.tsx touched (do NOT modify `generateMetadata`, `<Inter>` font setup, `<Providers>`, or `<html>`/`<body>` markup).
  - [ ] 7.4 The future E20-S4 `LicenseFooter` will land at the same spot, AFTER `<MainLayout>` — leave a one-line comment above the BetaBanner mount: `{/* BetaBanner mounted above MainLayout; LicenseFooter (E20-S4) lands as sibling AFTER MainLayout. */}` so a downstream dev doesn't accidentally put them in the wrong order.
- [ ] **Task 8 — Translation keys (AC: 8)** — extend `frontend/messages/en.json` and `frontend/messages/de.json`.
  - [ ] 8.1 Add the `beta` top-level namespace with 4 keys to BOTH files. Keep alphabetical placement consistent.
  - [ ] 8.2 Verify both files still parse via `JSON.parse` (any text editor with JSON validation or `node -e "JSON.parse(require('fs').readFileSync('frontend/messages/en.json'))"`).
- [ ] **Task 9 — Backend tests (AC: 9)**
  - [ ] 9.1 Create `backend/tests/IabConnect.Api.Tests/Hangfire/RetentionEnforcementJobRegistrationTests.cs`. Pattern: read `VolunteerShiftReminderJobRegistrationTests.cs` (if it exists — locate via Glob) as the template. Two tests as described in AC-9.
  - [ ] 9.2 Create `backend/tests/IabConnect.Api.Tests/Endpoints/BetaEnvironmentHardeningTests.cs`. Use `WebApplicationFactory<Program>.WithWebHostBuilder(b => b.UseEnvironment("Beta"))`. Five assertions per AC-9 (Swagger 404, Hangfire 404, HSTS header, HTTPS redirect, strict CORS).
  - [ ] 9.3 Create `backend/tests/IabConnect.Api.Tests/Configuration/AppSettingsLayeringTests.cs`. Manually build an `IConfigurationBuilder` with the two JSON files (`appsettings.json` + `appsettings.Beta.json`), assert the 7 cleanup-target keys are empty/null.
  - [ ] 9.4 All three new test files: SPDX header on line 1 per E20-S2 policy (forward-compatible).
- [ ] **Task 10 — Frontend tests (AC: 10)** — `frontend/src/components/navigation/BetaBanner.test.tsx`.
  - [ ] 10.1 Pattern: read `frontend/src/components/navigation/LicenseFooter.test.tsx` if E20-S4 has already authored it, OR use `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx` as the structural reference (existing project pattern).
  - [ ] 10.2 Six test cases per AC-10. Use `@vitest-environment jsdom` pragma.
- [ ] **Task 11 — Manual smoke tests (AC: 11)** — run locally and capture evidence in Completion Notes.
  - [ ] 11.1 Backend: `cd backend/src/IabConnect.Api && ASPNETCORE_ENVIRONMENT=Beta dotnet run`. Hit `/swagger`, `/hangfire`, `/health/ready`. Capture HTTP status for each. Tail the startup log for `Environment: Beta`.
  - [ ] 11.2 Backend: check `backend/src/IabConnect.Api/logs/` directory is empty (or unchanged) after a minute of running under Beta env.
  - [ ] 11.3 Frontend: `cd frontend && NEXT_PUBLIC_ENV_LABEL=beta npm run dev`. Visit `/login` (no auth) — banner visible. Visit `/dashboard` (with seeded admin login) — banner visible above the header.
  - [ ] 11.4 Frontend: click `×`, refresh page → banner stays hidden. Open new tab → banner reappears (sessionStorage scope).
  - [ ] 11.5 Frontend: `npm run dev` (no env var) — banner does NOT appear. `NEXT_PUBLIC_ENV_LABEL=production npm run dev` — banner also does NOT appear.
- [ ] **Task 12 — Quality gates (AC: 12)** — same gates as E11-S1.
  - [ ] 12.1 `dotnet build` from `backend/`.
  - [ ] 12.2 `dotnet test` from `backend/` — record the new total (was 1942, expect ≈1950+).
  - [ ] 12.3 `npm run typecheck` / `npm run lint` / `npm run build` from `frontend/`.
  - [ ] 12.4 `npm test` from `frontend/` — record the new Vitest total (was 89, expect ≈92-95 with the new BetaBanner tests).
- [ ] **Task 13 — Update sprint-status `last_updated` note + coordinate with E18-S3 / E20-S4** — when story closes:
  - [ ] 13.1 The `last_updated` note documents that E11-S2 closed both E11-S1 deferred items (base cleanup + Serilog array-merge).
  - [ ] 13.2 Open Question (Surface in story Completion Notes for PM): E18-S3 was originally scoped as "Add Beta banner in UI" — this story implements the banner. E18-S3 should either (a) be reduced to "Polish BETA banner with feedback-channel URL from E18-S4" or (b) closed as covered-by-E11-S2. The story author cannot decide unilaterally; flag for PM.

## Dev Notes

### What this story actually changes (compressed)

**Backend code change:** ONE site (`DependencyInjection.cs:298-302`) gets an `if (configuration.GetValue<bool>("RetentionEnforcement:Enabled"))` wrapper.

**Backend config moves:** Six values from base `appsettings.json` (already present in `Development.json` — confirmed by audit) get blanked in base. One Serilog File sink moves from base to `Development.json`. One key (`Logging.LogLevel.Default`) gets added to `appsettings.Beta.json`.

**Frontend code change:** ONE new component (`BetaBanner.tsx` ≈ 50 lines), ONE root-layout mount, ONE translation namespace in two locale files.

**Tests:** 3 new backend test classes (≈ 8-10 tests), 1 new frontend test file (6 tests).

Total touched files: ≈ 11 (3 backend code, 4 backend tests, 3 frontend code, 2 translation, 1 already-edited story). No EF migrations. No new dependencies.

### Why this story closes the two E11-S1 deferred items

[Source: `_bmad-output/implementation-artifacts/deferred-work.md → E11-S1 follow-up sections`]

The E11-S1 code review (2026-05-16) surfaced two deferred items both anchored to "when `ASPNETCORE_ENVIRONMENT=Beta` is first wired" — that wiring IS this story. Doing the moves elsewhere (a standalone refactor story) would create three problems:
1. Beta would silently inherit localhost defaults until the cleanup lands — a footgun for any deployer who tries Beta before the cleanup.
2. Beta would write to `logs/` (File sink survives array-merge) — contradicting ADR-017 Console-only.
3. The retention job would run unconditionally in Beta — contradicting ADR-020 even though `appsettings.Beta.json` already sets the flag to `false`.

Bundling all three with E11-S2 is the architecturally honest path: the wiring that exposes the problem AND the fix that closes it land together.

### Current state of the 8 `IsDevelopment()` / `EnvironmentName` sites (audit reference)

[Source: `rg -n "IsDevelopment|EnvironmentName" backend/src/IabConnect.Api/`, run 2026-05-16]

| File:Line | Condition | Beta-side behavior |
|---|---|---|
| `Program.cs:44` | `Log.Information("Environment: {Environment}", env.EnvironmentName)` | Beta logs `Environment: Beta` (✅ observability) |
| `Program.cs:46` | `if (env.EnvironmentName == "Testing")` | Beta skips → falls to migration branch |
| `Program.cs:51` | `else if (env.IsDevelopment())` | Beta skips → falls to `else` (production migrations + `MigrateAsync`) ✅ |
| `DependencyInjection.cs:96` | `if (environment.IsDevelopment() \|\| environment.EnvironmentName == "Testing")` | Beta → strict CORS branch ✅ |
| `DependencyInjection.cs:124` | `RequireHttpsMetadata = !(IsDev \|\| Testing)` | Beta → `true` ✅ |
| `DependencyInjection.cs:238` | `if (!IsDev && envName != "Testing") app.UseHsts()` | Beta → HSTS enabled ✅ |
| `DependencyInjection.cs:250` | `if (IsDev) UseSwagger/UseSwaggerUI` | Beta → Swagger off ✅ |
| `DependencyInjection.cs:262` | `if (!IsDev && envName != "Testing") UseHttpsRedirection` | Beta → HTTPS redirect on ✅ |
| `DependencyInjection.cs:276` | `if (IsDev) UseHangfireDashboard("/hangfire")` | Beta → 404 at `/hangfire` ✅ |
| `DependencyInjection.cs:282` | `if (envName != "Testing")` for recurring-job registration | Beta → jobs registered (correct; AC-4 wraps just the retention one) |

**Net:** Beta inherits Production hardenings cleanly at 7 conditional sites with ZERO code changes required. The audit is verification + Completion-Notes evidence only.

### Why the cleanup uses empty strings in base (not section deletion)

If we DELETED `ConnectionStrings.DefaultConnection` from base entirely, the bind at `Infrastructure/DependencyInjection.cs:53` (`configuration.GetConnectionString("DefaultConnection")`) returns `null` instead of an empty string. The downstream chain may NPE depending on the code path. Keeping the key with an empty value preserves the bind contract — null-or-empty checks at consumer sites already exist; absence-of-key paths often don't. Same rationale for `Keycloak.Authority` (read at `Api/DependencyInjection.cs:122`, fallback chain depends on Section existing) and the others.

### Why we don't simultaneously fix the `KeycloakHealthCheck.cs:16` typo

[Source: `_bmad-output/implementation-artifacts/deferred-work.md → E11-S1 follow-up: KeycloakHealthCheck.cs configuration-key typo`]

The typo (reads `Authentication:Authority`, should be `Keycloak:Authority`) is documented but explicitly left for its own follow-up story because the fix changes observable runtime behavior (the health check would start actually validating Keycloak reachability and might return 503 in environments where the Keycloak URL is wrong). That's a behavior change worth its own before/after smoke-test in Dev and Beta. Do NOT fold it into this story.

### Frontend layout coordination with E20-S4

[Source: `_bmad-output/implementation-artifacts/e20-s4-add-frontend-license-footer.md` — Wave 4, ready-for-dev]

E20-S4 plans to add `<LicenseFooter />` as a SIBLING of `<MainLayout>{children}</MainLayout>`, AFTER it. This story adds `<BetaBanner />` as a SIBLING of `<MainLayout>`, BEFORE it. The intended final JSX shape:

```tsx
<NextIntlClientProvider messages={messages}>
  {/* BetaBanner mounted above MainLayout; LicenseFooter (E20-S4) lands as sibling AFTER MainLayout. */}
  <BetaBanner />
  <MainLayout>{children}</MainLayout>
  <LicenseFooter /> {/* added by E20-S4 */}
</NextIntlClientProvider>
```

If E20-S4 ships BEFORE E11-S2, the BetaBanner mount must be added ABOVE the existing `<MainLayout>` line without disturbing the LicenseFooter line. If E11-S2 ships first (likely — E11 is Wave 2), the LicenseFooter mount will be added BELOW the existing `<MainLayout>` line without disturbing the BetaBanner.

### Why feedback URL has a placeholder default

[Source: `_bmad-output/planning-artifacts/ux-design.md → BETA Banner` + epic `E18-S4: Add feedback channel`]

`NEXT_PUBLIC_FEEDBACK_URL` is the proper env-var path for the feedback link. The default `https://github.com/htos/iab-connect/issues/new?template=beta-feedback.md` works without any template existing — GitHub falls back to the standard issue-creation form. When E18-S4 lands and creates the actual `.github/ISSUE_TEMPLATE/beta-feedback.md`, the link automatically picks it up.

The env var should ALSO be added to `frontend/.env.example` — E11-S1 covered `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL` but NOT `NEXT_PUBLIC_FEEDBACK_URL`. This story should append it (one-line entry under the existing "Beta + OSS build-time vars" section).

### Why `Database__AutoMigrate` is NOT addressed here

[Source: epics-and-stories.md → Epic E15-S2]

The flag is introduced by SCP-2026-05-15 and consumed in `Program.cs:42-90` (migration logic). Per E11-S1 documentation and the epic file, **E15-S2 owns the wiring**, not E11-S2. This story leaves `Program.cs:42-90` untouched. The flag is documented in `backend/.env.example` from E11-S1 but has no code effect until E15-S2 lands. Beta deployments will use the default `true` (auto-migrate on startup) which matches ADR-015 ("`Database__AutoMigrate` toggle is added but defaults remain unchanged in Beta — auto-migrate on").

### Risks

- **R1 (medium):** moving the Serilog File sink may break a dev who has a debugger watcher or external tail on `logs/iabconnect-*.log`. Dev experience is unaffected (the file is recreated in Development overlay), but a one-line note in `docs/06_dev_workflow.md` reassuring dev that the file still appears under Development would be kind. **Not required** — the dev workflow doc is not in scope for this story.
- **R2 (low):** the `BetaBanner` reads `process.env.NEXT_PUBLIC_ENV_LABEL` at module-eval time (early return before hooks). If Next.js's build doesn't inline this var (it should — it carries `NEXT_PUBLIC_` prefix), the component always returns `null` in production. Verification: `npm run build` + `grep -r "iabc:beta-banner-dismissed" .next/static/` should match (proving the dismiss-key string baked in, which only happens if the component body was inlined).
- **R3 (low):** removing the literal `rustfsadmin` credentials from base `appsettings.json` exposes that Beta deployments without DocumentStorage env vars will silently get empty strings → first document upload will fail with a clear error from the S3 client. This is BETTER than the current state (silently connecting to a non-existent `localhost:9000`) but a one-line note in the Beta runbook (E18-S1) should call it out.

### Test plan and evidence

- **AC-1, 2, 3 (config moves):** `AppSettingsLayeringTests` (new) verifies Beta config layering produces empty values for the 7 cleanup keys.
- **AC-4 (RetentionEnforcement flag):** `RetentionEnforcementJobRegistrationTests` (new) — 2 tests covering both flag states.
- **AC-5 (audit):** Completion Notes citation + grep evidence.
- **AC-6, 7 (BetaBanner + mount):** Vitest `BetaBanner.test.tsx` covers visibility, dismissal, env-gating. Manual smoke covers visual placement.
- **AC-8 (translations):** Vitest mock returns the key string; assertions pin the structure.
- **AC-9 (Beta hardening):** `BetaEnvironmentHardeningTests` (new) covers 5 production-side behaviors.
- **AC-10 (Vitest):** as 6.
- **AC-11 (manual):** Completion Notes lines per item.
- **AC-12 (gates):** standard.

### Project Structure Notes

- **NEW files (5):** `backend/tests/IabConnect.Api.Tests/Hangfire/RetentionEnforcementJobRegistrationTests.cs`, `backend/tests/IabConnect.Api.Tests/Endpoints/BetaEnvironmentHardeningTests.cs`, `backend/tests/IabConnect.Api.Tests/Configuration/AppSettingsLayeringTests.cs`, `frontend/src/components/navigation/BetaBanner.tsx`, `frontend/src/components/navigation/BetaBanner.test.tsx`.
- **EDIT files (8):** `backend/src/IabConnect.Api/appsettings.json` (base cleanup + File sink removal), `backend/src/IabConnect.Api/appsettings.Development.json` (File sink addition), `backend/src/IabConnect.Api/appsettings.Beta.json` (Logging.LogLevel add), `backend/src/IabConnect.Api/DependencyInjection.cs` (one if-wrap + one constant), `frontend/src/app/layout.tsx` (import + JSX), `frontend/messages/en.json` (beta namespace), `frontend/messages/de.json` (beta namespace), `frontend/.env.example` (add `NEXT_PUBLIC_FEEDBACK_URL`).
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e11-s2-introduce-aspnetcore-environment-beta.md`.

### Don't-miss patterns

- **DO** keep `appsettings.json` keys present with empty-string values — DO NOT delete the keys entirely (binding contracts depend on key presence).
- **DO** wire the RetentionEnforcement flag at the registration site (`DependencyInjection.cs:298`), NOT inside the job's `ExecuteAsync` — gating registration is cleaner and matches how E10-S5 gated module-disabled jobs.
- **DO** read `process.env.NEXT_PUBLIC_ENV_LABEL` at module top of `BetaBanner.tsx` (early return), NOT inside an effect — Next.js bakes `NEXT_PUBLIC_*` at build time, so the component should short-circuit cleanly to `null` in non-Beta builds without rendering anything.
- **DO NOT** add `|| envName == "Beta"` to ANY of the 7 hardening sites. Beta MUST inherit Production hardenings. The whole point of ADR-015 is "A misconfigured environment never accidentally exposes Swagger or relaxes CORS — only `IsDevelopment()` does that."
- **DO NOT** touch the `KeycloakHealthCheck.cs:16` typo. That fix has its own follow-up.
- **DO NOT** address `Database__AutoMigrate` (E15-S2 owns the consumption).
- **DO** namespace the sessionStorage key (`iabc:beta-banner-dismissed`) to avoid collision with future stores. The `iabc:` prefix is project-internal convention from E10-S5 patterns.
- **DO** verify with `npm run build` that `BetaBanner` chunks contain `iabc:beta-banner-dismissed` — confirms Next.js inlined the component body and the env-gate works at build time.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-015: Configuration and Environment Strategy`] — Beta-vs-Production parity rule
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-017: Logging and Health for Container Runtimes`] — Console-only in Beta
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-020: Beta-Mode Job Suppression`] — `RetentionEnforcement__Enabled` rationale
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S2: Introduce ASPNETCORE_ENVIRONMENT=Beta`]
- [Source: `_bmad-output/planning-artifacts/ux-design.md#BETA Banner`] — full UX spec for the orange banner
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-088 Beta Deployment Readiness`] — AC-7 (tester-visible BETA banner)
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E11 Story E11-S2`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md → E11-S1 follow-up: appsettings.json base cleanup`] — closed by this story (Tasks 2)
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md → E11-S1 follow-up: Beta Serilog.WriteTo array-merge`] — closed by this story (Task 3)
- [Source: `_bmad-output/implementation-artifacts/e11-s1-add-env-examples-and-document-config-precedence.md`] — upstream story, env vars documented here are wired here
- [Source: `_bmad-output/implementation-artifacts/e20-s4-add-frontend-license-footer.md`] — coordination on root-layout sibling mounting
- [Source: `backend/src/IabConnect.Api/Program.cs:42-90`] — migration branching (Beta falls to else)
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:30-33`] — `VolunteerReminderJobId` constant pattern (mirror for `RetentionJobId`)
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:96, 124, 238, 250, 262, 276, 282`] — 7 environment-conditional sites (verify NO Beta-relaxation)
- [Source: `backend/src/IabConnect.Api/appsettings.json`] — base config to clean up
- [Source: `backend/src/IabConnect.Api/appsettings.Development.json`] — dev overlay to receive File sink
- [Source: `frontend/src/app/layout.tsx`] — root-layout mount point
- [Source: `frontend/messages/en.json`, `frontend/messages/de.json`] — translation files

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **E18-S3 reduces to redundancy or polish?** The original epic file scoped E18-S3 as "Add Beta banner in UI" (Wave 9). This story implements the banner per UX-design (Wave 2 by way of the E11-S2 AC-3 wording). Recommend E18-S3 becomes "Replace placeholder feedback URL with E18-S4 channel + polish copy/a11y" — needs PM confirmation. If E18-S3 stays scoped as "create the banner", this story should NOT implement the banner and AC-3 of the epic spec should move to E18-S3. **Recommendation: E11-S2 implements the banner now (the dev-environment-label wiring belongs here anyway); E18-S3 becomes the polish-on-feedback-channel story.**
2. **`NEXT_PUBLIC_FEEDBACK_URL` default URL.** Recommend the GitHub-issue-template default (`https://github.com/htos/iab-connect/issues/new?template=beta-feedback.md`). If a different feedback channel is intended (Discord webhook, Mailtrap, Slack), the default should change. **Recommendation: keep the GitHub default; it works without any template existing.**
3. **`Branding__SourceUrl` and other forward-reference env vars** — documented in `backend/.env.example` from E11-S1 but not consumed yet. NO action in this story; flagging for awareness.
4. **`logs/iabconnect-*.log` rotation** — currently every Dev run appends to `logs/iabconnect-<date>.log` (rolling daily, 30-day retention). After Task 3 moves the File sink to Development overlay, this behavior continues unchanged in Dev. Beta and Production will have NO file logs. If a Production migration plan needs file logs (it shouldn't — Railway aggregates Console output per ADR-017), document that separately.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List
