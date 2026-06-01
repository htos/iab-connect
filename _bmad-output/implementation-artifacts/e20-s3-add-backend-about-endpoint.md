# Story 20.3: Add Backend `/about` Endpoint

Status: done

<!-- Refreshed 2026-06-01 post-Epic-11 + Epic-12 close. The Dockerfiles, `.dockerignore`,
     `BUILD_SHA`/`BUILD_DATE` ARG/ENV, OCI labels, HEALTHCHECK, and `NEXT_PUBLIC_SOURCE_URL`
     ARG that the original 2026-05-15 draft framed as "downstream / forward-compatible"
     are now ALL SHIPPED. The story is the first Wave-4 work — when this lands, e20-s4
     (frontend footer) gets a live endpoint to render against. Refresh updates: line
     anchors realigned, DTO collapsed into `AboutEndpoints.cs` (matches `SettingsEndpoints.cs`),
     configuration-binding test moved to Api.Tests (InternalsVisibleTo is scoped there),
     Task 0 spike added, [!] markers per A30, orthogonal-AC inventory per A31. -->

## Story

As **a user, auditor, or fork-maintainer of a network-deployed IAB Connect instance**,
I want **an unauthenticated `GET /about` endpoint that reports the running version, commit SHA, build date, and upstream source URL**,
so that **I can exercise AGPL §13 source-disclosure rights and verify what code is actually running on this deployment**.

**Requirement:** REQ-089 AC-5 (PRD §"REQ-089 Open Source License Surface"). Epic E20 (Open Source Foundation), Story 3 of 5. ADR-021 (Source-Disclosure Mechanism — AGPL §13).

**Upstream dependencies (all shipped):**
- E20-S1 (LICENSE/COPYRIGHT/NOTICE/CONTRIBUTING/DCO) — supplies the canonical SPDX string `AGPL-3.0-or-later` that this endpoint's `license` field must match **byte-for-byte**.
- E20-S2 (SPDX header policy) — every new C# file created by this story gets `// SPDX-License-Identifier: AGPL-3.0-or-later` on line 1.
- E12-S1 (backend Dockerfile) — already declares `ARG BUILD_SHA=unknown` and `ARG BUILD_DATE=unknown` at lines 34-35 and propagates them as ENV at lines 36-37. The runtime env is the contract.
- E12-S2 (frontend Dockerfile) — already declares `ARG NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect` at line 56 (the frontend's parallel source-disclosure surface; backend has the analogous responsibility via `Branding:SourceUrl`).

**Downstream consumers (not yet shipped):**
- E20-S4 (frontend license footer) — renders a static footer link to `/about`; the footer reads `NEXT_PUBLIC_SOURCE_URL` at build time, NOT this endpoint at runtime. The endpoint is the auditor-visible source of truth; the footer is the UI affordance pointing at it.
- E20-S5 (GHCR image publishing pipeline) — sets `org.opencontainers.image.licenses=AGPL-3.0-or-later` as a Docker label. Same string this endpoint emits. **Drift in either place breaks REQ-089's "machine-introspectable" claim.**

## Acceptance Criteria

1. **Route `GET /about` (root path, NOT under `/api/v1`).** Returns HTTP 200 with `Content-Type: application/json; charset=utf-8`. Registered at the application root, parallel to `/health` and `/health/ready`, **NOT** prefixed by `/api/v1`. Rationale (per ADR-021 + SCP-2026-05-15): source-disclosure must remain reachable across API version cuts; sitting alongside `/health` makes both operational well-known endpoints. The route is registered on the `app` (`WebApplication`) instance in `EndpointMapper.cs`, NOT on the `api = app.MapGroup("/api/v1")` group.

2. **Response shape (camelCase JSON, fixed field order).**
   ```json
   {
     "name": "IAB Connect",
     "license": "AGPL-3.0-or-later",
     "version": "<assembly-version-or-0.0.0.0>",
     "commitSha": "<value-of-BUILD_SHA-or-unknown>",
     "buildDate": "<value-of-BUILD_DATE-or-unknown>",
     "sourceUrl": "<Branding:SourceUrl-or-default>"
   }
   ```
   - **`name`** is the **literal string `IAB Connect`** — hard-coded in `AboutEndpoints.cs`, NOT read from `Branding:ApplicationName` or `SystemSettings.ApplicationName` (both of which are admin-editable per REQ-086 and could be rebranded by a deployer). The AGPL §13 obligation identifies the **upstream project**, not the deployer's white-label.
   - **`license`** is the **literal string `AGPL-3.0-or-later`** — hard-coded, byte-identical to the SPDX identifier in E20-S1's COPYRIGHT/CONTRIBUTING.md and to the OCI label `org.opencontainers.image.licenses="AGPL-3.0-or-later"` already shipped at `backend/Dockerfile:45`.
   - **`version`** is sourced from `Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0.0"`. The project does NOT currently declare `<Version>` in `Directory.Build.props` or `IabConnect.Api.csproj`, so this returns `1.0.0.0` until a future story (e.g., MinVer/Nerdbank.GitVersioning) adds proper SemVer stamping. Acceptable for Beta — the meaningful identity comes from `commitSha`.
   - **`commitSha`** is read from `IConfiguration["BUILD_SHA"]`. ASP.NET Core's default configuration order includes environment variables, so the Dockerfile-injected `ENV BUILD_SHA=...` at `backend/Dockerfile:36` resolves automatically. If null/empty/whitespace, return the literal string `unknown` (NOT empty, NOT null, NOT 500).
   - **`buildDate`** is read from `IConfiguration["BUILD_DATE"]`. Same null/empty fallback to `unknown`. Expected format (when set by CI per E20-S5) is ISO-8601 UTC, e.g. `2026-05-16T12:00:00Z`. The endpoint passes the value through **unchanged** — no parsing, no normalization, no validation. If a deployer injects a malformed string, the endpoint returns it as-is. That is the contract.
   - **`sourceUrl`** is read from `IOptions<BrandingOptions>.Value.SourceUrl`, which binds to `Branding:SourceUrl` in `appsettings.json` with default `https://github.com/htos/iab-connect`. White-label forks override via the `Branding__SourceUrl` env var (double-underscore — already documented in `.env.example:99-100`).

3. **Unauthenticated.** `.AllowAnonymous()` is applied. No `.RequireAuthorization()`. The endpoint must be reachable by an unauthenticated browser, a curl with no `Authorization` header, and a CI scraper. CORS uses the existing app-root policy.

4. **OpenAPI / Swagger metadata.** The registration chain mirrors `SettingsEndpoints.cs:39-43`:
   ```
   .WithName("GetAbout")
   .WithTags("About")
   .WithSummary("Source-disclosure endpoint (AGPL §13)")
   .WithDescription("REQ-089 AC-5: returns name, license, version, commitSha, buildDate, sourceUrl. Unauthenticated. ADR-021.")
   .Produces<AboutResponse>(200)
   .AllowAnonymous();
   ```
   Swagger UI is only mounted in Development (per the existing convention at `DependencyInjection.cs`); in Beta/Production the endpoint still serves JSON without Swagger metadata exposure.

5. **No audit log, no rate limit, no caching, no MediatR, no repository.** The endpoint reads `IConfiguration` and `IOptions<BrandingOptions>` synchronously and returns a static-shape DTO. Do NOT register an audit event. Do NOT add the route to the rate-limit policy (E14-S4, future). Do NOT emit `Cache-Control` headers (the browser default is fine — the response is tiny). Do NOT introduce MediatR commands/queries (no business workflow). Do NOT touch any repository or `ApplicationDbContext`. Project-context: "Keep business rules out of endpoint handlers" — for this endpoint there IS no business rule, only configuration projection.

6. **`BrandingOptions` configuration class.** New file `backend/src/IabConnect.Infrastructure/Common/BrandingOptions.cs`. Class is `public sealed class BrandingOptions { public string SourceUrl { get; init; } = "https://github.com/htos/iab-connect"; }`. Namespace `IabConnect.Infrastructure.Common`. Folder rationale: the existing precedent is per-feature (`Infrastructure.Events.CalendarTokenOptions`), but `Branding` is a cross-cutting concern, not tied to a feature folder. `Common/` is a fresh namespace and is acceptable per project-context "Keep module boundaries clear". DI registration: `services.Configure<BrandingOptions>(configuration.GetSection("Branding"));` in `AddApiServices` (the method that already runs at `Program.cs:30`).

   **Scope discipline:** This story does NOT migrate the existing `Branding:ApiTitle` / `Branding:ApiDescription` bare lookups at `DependencyInjection.cs:66, 68, 263` to the new options class. Those keep working as-is. The `BrandingOptions` class introduces a single property `SourceUrl` because that is what AC-2's `sourceUrl` field needs. A future story can fold the other Branding keys into the same class; doing so here would creep scope and re-touch Swagger registration.

7. **`appsettings.json` `Branding` section.** Edit `backend/src/IabConnect.Api/appsettings.json`. The current file (verified 2026-06-01) ends `Frontend` at line 36 and starts `DocumentStorage` at line 37 — there is NO existing `Branding` section. Add a top-level `"Branding"` block **between** Frontend (lines 34-36) and DocumentStorage (lines 37-43):
   ```json
   "Branding": {
     "SourceUrl": "https://github.com/htos/iab-connect"
   },
   ```
   Place it so the resulting file reads `Frontend` → `Branding` → `DocumentStorage`. Do NOT add other keys (`ApiTitle`, `ApiDescription`, `ApplicationName`) — they remain config-driven via bare lookups and `SystemSettings` respectively, per scope discipline in AC-6.

   **Layered config:** Do NOT add `Branding` to `appsettings.Beta.json`. The Beta overlay (`appsettings.Beta.json`, 14 lines) only overrides Serilog/Logging/RetentionEnforcement. Default `Branding:SourceUrl` is correct for Beta. Forks override at deploy time via the `Branding__SourceUrl` env var (Railway, Docker `-e`, or compose `environment:` block).

8. **API test: response shape and behavior** (`backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs`). Use `xUnit v3` + `FluentAssertions` + `[Collection("Api")]` + `TestWebApplicationFactory` exactly per `HealthEndpointTests.cs` (the public-endpoint test pattern). Seven test methods:
   - `About_ReturnsOk` — `GET /about` returns 200.
   - `About_ReturnsExpectedShape` — response JSON contains all six keys with string types (camelCase: `name`, `license`, `version`, `commitSha`, `buildDate`, `sourceUrl`).
   - `About_LicenseIsAGPL3OrLater` — `license` equals `AGPL-3.0-or-later` exactly (byte-comparison).
   - `About_NameIsIabConnect` — `name` equals `IAB Connect` exactly (NOT influenced by any `Branding` or `SystemSettings` override in the test factory's configuration).
   - `About_UnknownWhenEnvVarsMissing` — in the test process (no `BUILD_SHA` / `BUILD_DATE` set), both fields equal the literal string `unknown` (NOT empty, NOT null).
   - `About_SourceUrlReadsBrandingConfig` — `sourceUrl` equals the default `https://github.com/htos/iab-connect` when nothing overrides. (Override-paths covered by Task 8's unit test.)
   - `About_IsAnonymous` — request with no `Authorization` header returns 200 (no 401, no redirect to OIDC).

9. **Configuration-binding unit test** (`backend/tests/IabConnect.Api.Tests/Endpoints/AboutResponseBuilderTests.cs`). The endpoint handler is refactored to call a pure static method `internal static AboutResponse BuildResponse(IConfiguration configuration, BrandingOptions options)` so the configuration→response projection is unit-testable without a `WebApplicationFactory`. The test project `IabConnect.Api.Tests` already has access to `internal` members via `[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]` at `DependencyInjection.cs:16` (no `.csproj` change needed). Use `ConfigurationBuilder().AddInMemoryCollection(...).Build()` to feed two scenarios:
   - **Override path:** `BUILD_SHA=abc1234`, `BUILD_DATE=2026-05-15T10:00:00Z`, `BrandingOptions{SourceUrl="https://github.com/example/fork"}` → assert all three fields pass through unchanged, plus hard-coded `name="IAB Connect"`, `license="AGPL-3.0-or-later"`.
   - **Default path:** empty `IConfiguration` + `new BrandingOptions()` → assert `commitSha="unknown"`, `buildDate="unknown"`, `sourceUrl="https://github.com/htos/iab-connect"`.

   **Rationale for moving this test from Infrastructure.Tests (per original 2026-05-15 draft) to Api.Tests:** the only project with `InternalsVisibleTo` granted in `DependencyInjection.cs:16` is `IabConnect.Api.Tests`. Putting the test in Infrastructure.Tests would require either an additional `InternalsVisibleTo` declaration OR making `BuildResponse` public (poor API surface for a private helper). Api.Tests is also the semantically correct project — the helper lives in `Api.Endpoints` and the configuration-projection logic is API/presentation concern, not Infrastructure persistence.

10. **No EF migration, no DB changes, no `SystemSettings` aggregate edits.** This story does NOT touch `SystemSettings`, EF Core configurations, migrations, or repositories. `sourceUrl` is configuration-bound, not persisted (architectural rationale: making it admin-editable would let a deployer mis-direct AGPL §13 disclosure to a wrong fork — e.g., point new admins back at upstream after diverging significantly).

11. **Cross-story orthogonal-AC parity (per project-context A31).** Even though the AC text below does not enumerate them, the dev agent MUST verify the following invariants hold at story close — they tie this story to its siblings:

    | Invariant | Where it lives | What this story emits | Drift breaks |
    | --- | --- | --- | --- |
    | License string parity | `LICENSE` (E20-S1), `COPYRIGHT` (E20-S1), `CONTRIBUTING.md` SPDX policy (E20-S2), `backend/Dockerfile:45` OCI label (E12-S1), `frontend/Dockerfile:?` OCI label (E12-S2) | `license: "AGPL-3.0-or-later"` literal in `AboutEndpoints.cs` | E20-S4 footer label, E20-S5 OCI label match, REQ-089 "machine-introspectable" claim |
    | `sourceUrl` default parity | `frontend/Dockerfile:56`, `frontend/.env.example:64`, `frontend/src/components/navigation/BetaBanner.tsx:73-77`, `CONTRIBUTING.md` (E20-S1) | `BrandingOptions.SourceUrl` default `"https://github.com/htos/iab-connect"`, `appsettings.json` `Branding:SourceUrl` | Footer link mismatch, auditor confusion ("which is the upstream?") |
    | Build-arg name parity | `backend/Dockerfile:34-37` (`BUILD_SHA`, `BUILD_DATE`) | `IConfiguration["BUILD_SHA"]`, `IConfiguration["BUILD_DATE"]` lookups | Endpoint silently returns `unknown` forever (no log signal) |
    | SPDX header presence | E20-S2 CONTRIBUTING.md policy (`// SPDX-License-Identifier: AGPL-3.0-or-later`) | Every new `.cs` file in this story (3 production + 2 test) | E20-S2 policy compliance, future REUSE-lint gate |
    | Response-field casing | `_bmad-output/planning-artifacts/architecture.md` ADR-021, `_bmad-output/planning-artifacts/prd.md` REQ-089 AC-5 | JSON `Web` naming policy in `DependencyInjection.cs:54` produces camelCase | Consumer parsers in E20-S4 (footer fetch in a future iteration), CI smoke scripts |
    | OCI-label-vs-`/about` license parity | `backend/Dockerfile:45` `org.opencontainers.image.licenses="AGPL-3.0-or-later"` (shipped) | `license` field in response | A container introspection mismatch (`docker inspect` vs `curl /about`) — E20-S5 / E12-S1 retro pattern |

    These rows are surfaced in Task 11 (Quality-Gates Closing Check) per project-context A29 "AC-Subitem Completion Check at Story Close".

## Tasks / Subtasks

- [x] **Task 0 — Spike: confirm assumptions BEFORE editing (project-context A28)**
  - [x] 0.1 Confirm `EndpointMapper.cs` insertion line. Open `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs`. Verify line 14 is `// Public Endpoints (no auth required)`, line 15 is `app.MapRegistrationEndpoints();`, line 16 is `app.MapUnsubscribeEndpoints();`. Plan to insert `app.MapAboutEndpoints();` at line 17, just before the `// Module Endpoints - REQ-001: Identity first` comment at line 18.
  - [x] 0.2 Confirm DTO placement convention. Read `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:397-437` — DTOs live INSIDE the endpoint .cs file as `public sealed record`. No `Endpoints/Settings/` subfolder, no separate `SettingsResponse.cs`. Adopt the same pattern for `AboutResponse` — declare it as a record at the bottom of `AboutEndpoints.cs`, NOT in a separate file. (Earlier draft of this story considered a subfolder approach; reject it.)
  - [x] 0.3 Confirm `InternalsVisibleTo` scope. Grep for `InternalsVisibleTo` in the backend tree. Verify only `IabConnect.Api.Tests` is granted (at `DependencyInjection.cs:16`). Decision: configuration-binding unit test lives in `IabConnect.Api.Tests/Endpoints/AboutResponseBuilderTests.cs`, not Infrastructure.Tests.
  - [x] 0.4 Confirm `appsettings.json` insertion line range. Open `backend/src/IabConnect.Api/appsettings.json`. Verify `"Frontend"` block at lines 34-36 and `"DocumentStorage"` block at lines 37-43. Plan to insert `"Branding": { "SourceUrl": "https://github.com/htos/iab-connect" },` as new lines starting at line 37, shifting DocumentStorage down by 3 lines.
  - [x] 0.5 Confirm `Branding:*` lookup state. Grep `Branding:` in `backend/src/IabConnect.Api/DependencyInjection.cs`. Expect three bare `configuration["Branding:..."]` lookups at lines 66, 68, 263. These remain untouched by this story (scope discipline per AC-6).
  - [x] 0.6 Confirm Dockerfile reality. Open `backend/Dockerfile`. Verify lines 34-35 declare `ARG BUILD_SHA=unknown` and `ARG BUILD_DATE=unknown`. Verify lines 36-37 set them as `ENV` in the runtime stage. Verify line 45 has the OCI label `org.opencontainers.image.licenses="AGPL-3.0-or-later"` — this is the parity anchor the `/about` `license` field must match.
  - [x] 0.7 Confirm local Kestrel port. Open `backend/src/IabConnect.Api/Properties/launchSettings.json`. Verify Development profile `applicationUrl` is `http://localhost:5000`. The manual-validation step (Task 9) will hit `http://localhost:5000/about`.
  - [x] 0.8 Spike output (one line): either "Confirmed — proceed" OR "Blocker found: <description> — escalate".
- [x] **Task 1 — Create `BrandingOptions` class (AC: 6)**
  - [x] 1.1 Create folder `backend/src/IabConnect.Infrastructure/Common/` if it does not exist (verify in Task 0; if a `Common/` folder already exists elsewhere, namespace-collide check — the file is the canonical owner of the namespace `IabConnect.Infrastructure.Common`).
  - [x] 1.2 Create file `BrandingOptions.cs` with the following contents (SPDX header on line 1 per E20-S2):
    ```csharp
    // SPDX-License-Identifier: AGPL-3.0-or-later
    namespace IabConnect.Infrastructure.Common;

    /// <summary>
    /// REQ-089 AC-5 (E20-S3) / ADR-021: AGPL §13 source-disclosure surface.
    /// Bound from <c>Branding:SourceUrl</c> in <c>appsettings.json</c> with a
    /// fallback default of <c>https://github.com/htos/iab-connect</c>. White-label
    /// forks override via the <c>Branding__SourceUrl</c> environment variable
    /// (double-underscore for hierarchical key in ASP.NET Core env-var binding).
    /// </summary>
    public sealed class BrandingOptions
    {
        public string SourceUrl { get; init; } = "https://github.com/htos/iab-connect";
    }
    ```
  - [x] 1.3 No additional packages required — `Microsoft.Extensions.Options.ConfigurationExtensions` ships transitively with ASP.NET Core 10 (verified — `Directory.Packages.props` does NOT need an entry).
- [x] **Task 2 — Bind `BrandingOptions` in DI (AC: 6)**
  - [x] 2.1 Open `backend/src/IabConnect.Api/DependencyInjection.cs`. Locate `AddApiServices` (signature at line 45-48).
  - [x] 2.2 Add `using IabConnect.Infrastructure.Common;` near the top of the file (alongside the existing `using IabConnect.Infrastructure.*` lines around lines 6-9).
  - [x] 2.3 Add `services.Configure<BrandingOptions>(configuration.GetSection("Branding"));` inside `AddApiServices`, placed in the configuration-binding region (near `ConfigureHttpJsonOptions` at lines 51-55 or just after the Swagger registration block at lines 61-95 — pick whichever neighbor most closely matches `services.Configure<...>` pattern; if no such block exists, insert just before the OpenAPI section header comment).
  - [x] 2.4 Do NOT migrate the existing `Branding:ApiTitle`/`Branding:ApiDescription` bare lookups at lines 66, 68, 263 — out of scope (see AC-6 rationale).
- [x] **Task 3 — Add `Branding` section to `appsettings.json` (AC: 7)**
  - [x] 3.1 Open `backend/src/IabConnect.Api/appsettings.json`. Insert after the `Frontend` block (closes at line 36) and before `DocumentStorage` (opens at line 37):
    ```json
      "Branding": {
        "SourceUrl": "https://github.com/htos/iab-connect"
      },
    ```
  - [x] 3.2 Validate JSON syntax with `dotnet build` — `appsettings.json` is parsed at startup so any trailing-comma error surfaces on the first build.
  - [x] 3.3 Do NOT edit `appsettings.Beta.json`, `appsettings.Development.json`, or `appsettings.Production.json` — the default value is correct for all environments; deployers override via `Branding__SourceUrl` env var.
- [x] **Task 4 — Define `AboutResponse` record (AC: 2)**
  - [x] 4.1 No separate file. The record lives at the bottom of `AboutEndpoints.cs` mirroring `SettingsEndpoints.cs:397-437`.
  - [x] 4.2 Shape (camelCase will be applied automatically by the global `JsonNamingPolicy.CamelCase` set at `DependencyInjection.cs:54`):
    ```csharp
    public sealed record AboutResponse(
        string Name,
        string License,
        string Version,
        string CommitSha,
        string BuildDate,
        string SourceUrl);
    ```
- [x] **Task 5 — Create `AboutEndpoints.cs` (AC: 1, 2, 3, 4, 5)**
  - [x] 5.1 Create `backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs`. SPDX header on line 1.
  - [x] 5.2 Required `using` directives:
    ```csharp
    using System.Reflection;
    using IabConnect.Infrastructure.Common;
    using Microsoft.Extensions.Options;
    ```
  - [x] 5.3 Class signature mirrors `SettingsEndpoints.cs:16` and `SettingsEndpoints.cs:33`:
    ```csharp
    public static class AboutEndpoints
    {
        public static void MapAboutEndpoints(this IEndpointRouteBuilder routes)
        {
            routes.MapGet("/about", GetAbout)
                .WithName("GetAbout")
                .WithTags("About")
                .WithSummary("Source-disclosure endpoint (AGPL §13)")
                .WithDescription("REQ-089 AC-5: returns name, license, version, commitSha, buildDate, sourceUrl. Unauthenticated. ADR-021.")
                .Produces<AboutResponse>(StatusCodes.Status200OK)
                .AllowAnonymous();
        }

        private static IResult GetAbout(
            IConfiguration configuration,
            IOptions<BrandingOptions> brandingOptions)
            => Results.Ok(BuildResponse(configuration, brandingOptions.Value));

        internal static AboutResponse BuildResponse(
            IConfiguration configuration,
            BrandingOptions options) =>
            new(
                Name: "IAB Connect",
                License: "AGPL-3.0-or-later",
                Version: Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0.0",
                CommitSha: ReadOrUnknown(configuration["BUILD_SHA"]),
                BuildDate: ReadOrUnknown(configuration["BUILD_DATE"]),
                SourceUrl: options.SourceUrl);

        private static string ReadOrUnknown(string? value) =>
            string.IsNullOrWhiteSpace(value) ? "unknown" : value;

        public sealed record AboutResponse(
            string Name,
            string License,
            string Version,
            string CommitSha,
            string BuildDate,
            string SourceUrl);
    }
    ```
  - [x] 5.4 `BuildResponse` is `internal` (not `private`) so the unit test in Task 8 can call it through the `InternalsVisibleTo("IabConnect.Api.Tests")` declaration at `DependencyInjection.cs:16`. Do NOT make it `public` — the API surface stays clean.
  - [x] 5.5 `name` and `license` are hard-coded string literals. Do NOT read them from configuration. (A code-reviewer may try to "fix" this — it is deliberate per AC-2 rationale.)
  - [x] 5.6 XML doc comment on `MapAboutEndpoints` should reference REQ-089 AC-5, ADR-021, and the Dockerfile-build-arg flow (`backend/Dockerfile:34-37` for `BUILD_SHA`/`BUILD_DATE`).
- [x] **Task 6 — Register in `EndpointMapper.cs` (AC: 1)**
  - [x] 6.1 Open `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs`.
  - [x] 6.2 Insert at line 17 (between `app.MapUnsubscribeEndpoints();` at line 16 and the `// Module Endpoints - REQ-001: Identity first` comment at line 18):
    ```csharp
            app.MapAboutEndpoints(); // REQ-089 AC-5 (E20-S3): AGPL §13 source-disclosure
    ```
  - [x] 6.3 **Critical:** call on `app` (the `WebApplication`), NOT on `api` (the `MapGroup("/api/v1")` at line 12). Compare to line 19 (`api.MapIdentityEndpoints();`) — `api.*` routes get the `/api/v1` prefix; `app.*` routes register at the root. The `/about` endpoint must be at the root per AC-1.
- [x] **Task 7 — API endpoint tests (AC: 8)**
  - [x] 7.1 Confirm `backend/tests/IabConnect.Api.Tests/Endpoints/` folder exists (verified in Task 0; folder is used by existing endpoint tests).
  - [x] 7.2 Create file `backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs`. SPDX header on line 1.
  - [x] 7.3 Structure mirrors `backend/tests/IabConnect.Api.Tests/HealthEndpointTests.cs` (the public-endpoint test pattern): `[Collection("Api")]`, ctor takes `TestWebApplicationFactory factory`, `private readonly HttpClient _client;` initialized via `_client = factory.CreateClient();`.
  - [x] 7.4 Implement the seven test methods listed in AC-8. Use `await _client.GetAsync("/about", TestContext.Current.CancellationToken)` per the cancellation-token pattern in `HealthEndpointTests.cs:32-40`.
  - [x] 7.5 For shape assertions, deserialize with `System.Net.Http.Json.HttpContentJsonExtensions.ReadFromJsonAsync<AboutEndpoints.AboutResponse>(...)` (the nested record is reachable via the public `AboutEndpoints` class).
  - [x] 7.6 For the `About_UnknownWhenEnvVarsMissing` test: do NOT inject `BUILD_SHA`/`BUILD_DATE` into the `TestWebApplicationFactory`'s configuration; the absence is the test.
- [x] **Task 8 — Configuration-binding unit test (AC: 9)**
  - [x] 8.1 Create file `backend/tests/IabConnect.Api.Tests/Endpoints/AboutResponseBuilderTests.cs`. SPDX header on line 1.
  - [x] 8.2 Class uses `xUnit v3` + `FluentAssertions`. No `[Collection]` needed — the test does not use `TestWebApplicationFactory`.
  - [x] 8.3 **Override path test:**
    ```csharp
    var configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["BUILD_SHA"] = "abc1234",
            ["BUILD_DATE"] = "2026-05-15T10:00:00Z",
        })
        .Build();
    var options = new BrandingOptions { SourceUrl = "https://github.com/example/fork" };

    var response = AboutEndpoints.BuildResponse(configuration, options);

    response.Name.Should().Be("IAB Connect");
    response.License.Should().Be("AGPL-3.0-or-later");
    response.CommitSha.Should().Be("abc1234");
    response.BuildDate.Should().Be("2026-05-15T10:00:00Z");
    response.SourceUrl.Should().Be("https://github.com/example/fork");
    ```
  - [x] 8.4 **Default path test:** empty `IConfiguration` + `new BrandingOptions()` → asserts `CommitSha == "unknown"`, `BuildDate == "unknown"`, `SourceUrl == "https://github.com/htos/iab-connect"`, plus the hard-coded `Name` / `License`.
  - [x] 8.5 No `InternalsVisibleTo` change needed — the existing declaration at `DependencyInjection.cs:16` covers `IabConnect.Api.Tests`.
- [x] **Task 9 — Manual validation [!] / [x] per project-context A30**
  - [x] 9.1 (Dev-agent automatable) Run `dotnet test` from `backend/` — expect baseline + 7 (API) + 2 (config) = 9 new passing tests, zero warnings.
  - [x] 9.2 (Dev-agent automatable) Run `dotnet build` from `backend/` — verify `appsettings.json` parses cleanly (Task 3.2). Zero warnings, zero errors.
  - [x] 9.3 (Dev-agent automatable) Launch the API in background: `dotnet run --project backend/src/IabConnect.Api`. Wait for the Kestrel "Now listening" line. `curl http://localhost:5000/about` — expect 200 with JSON containing all six fields and `commitSha: "unknown"`, `buildDate: "unknown"`, `sourceUrl: "https://github.com/htos/iab-connect"`. Then shut the process down.
  - [x] 9.4 (Dev-agent automatable) `curl -H "Authorization: Bearer not-a-real-token" http://localhost:5000/about` — expect 200 (anonymous endpoint MUST NOT 401 on a bad/missing token).
  - [!] 9.5 (Human-verify) Open `http://localhost:5000/about` in an incognito browser tab — confirm 200 + JSON renders, no CORS error in DevTools, no auth redirect to Keycloak. Browser interaction is outside the dev-agent's non-interactive scope; queued for human verify per A30.
  - [!] 9.6 (Human-verify, deferred until E12-S1 + E20-S5 image is published) Build the API container with concrete build-args: `docker build -t iabc-api:smoke --build-arg BUILD_SHA=abc1234 --build-arg BUILD_DATE=2026-05-15T10:00:00Z backend/`. Then `docker run --rm -p 5050:8080 iabc-api:smoke` and `curl http://localhost:5050/about` — expect `commitSha: "abc1234"` and `buildDate: "2026-05-15T10:00:00Z"`. The unit test in Task 8 covers the configuration-injection logic; this manual step verifies the Dockerfile-to-process env-var flow (the E12-S1 ARG→ENV chain that Task 0.6 spike-confirmed). Defers gracefully to E20-S5 CI smoke if the dev-agent session lacks Docker.
- [x] **Task 10 — Cross-story orthogonal-AC verification (project-context A31)**
  - [x] 10.1 Grep the repo for the string `AGPL-3.0-or-later` and confirm parity across: (a) `LICENSE` first line — should contain "GNU AFFERO GENERAL PUBLIC LICENSE"; (b) `COPYRIGHT` — verbatim per E20-S1; (c) `CONTRIBUTING.md` SPDX policy table (E20-S2); (d) `backend/Dockerfile:45` OCI label; (e) `AboutEndpoints.cs` `license` literal. **No drift.**
  - [x] 10.2 Grep the repo for `https://github.com/htos/iab-connect` — confirm in: (a) `BrandingOptions.cs` default; (b) `appsettings.json` `Branding:SourceUrl`; (c) `.env.example` `Branding__SourceUrl=`; (d) `frontend/Dockerfile:56` `NEXT_PUBLIC_SOURCE_URL` default; (e) `frontend/.env.example:64`; (f) `frontend/src/components/navigation/BetaBanner.tsx:73-77` fallback. **No drift.**
  - [x] 10.3 SPDX header presence — confirm `// SPDX-License-Identifier: AGPL-3.0-or-later` is on line 1 of all 3 new production files (`BrandingOptions.cs`, `AboutEndpoints.cs`) and both new test files (`AboutEndpointTests.cs`, `AboutResponseBuilderTests.cs`).
  - [x] 10.4 JSON casing — `curl http://localhost:5000/about | jq` (during Task 9.3) — confirm camelCase keys (`commitSha`, `buildDate`, `sourceUrl`), NOT PascalCase or snake_case.
- [x] **Task 11 — Quality-Gates Closing Check (project-context A29)**

  At story close, fill in the table below in **Completion Notes**. Every AC sub-item gets an explicit status (`covered` / `deferred` / `N/A`). Aggregate claims like "all 7 verified" are insufficient per the Epic-11 retro precedent.

  | AC | Sub-item | Evidence anchor | Status |
  | --- | --- | --- | --- |
  | AC-1 | Route `GET /about` at root | `EndpointMapper.cs:17`, Task 7 `About_ReturnsOk` | **covered** — HTTP 200 at `http://localhost:5000/about` (no `/api/v1`) confirmed by Task 9.3 curl |
  | AC-1 | NOT under `/api/v1` | Task 9.3 curl response body shows root-path projection; registered via `app.MapAboutEndpoints()` not `api.Map*` | **covered** |
  | AC-2 | `name = "IAB Connect"` literal | Task 7 `About_NameIsIabConnect`, Task 8 default-path, Task 9.3 curl body `"name":"IAB Connect"` | **covered** |
  | AC-2 | `license = "AGPL-3.0-or-later"` literal | Task 7 `About_LicenseIsAGPL3OrLater`, Task 8 default-path, Task 9.3 curl body `"license":"AGPL-3.0-or-later"` | **covered** |
  | AC-2 | `version` from assembly | Task 7 `About_ReturnsExpectedShape` (string-type check), Task 9.3 curl body `"version":"1.0.0.0"` (implicit default; awaits SemVer-stamping story) | **covered** |
  | AC-2 | `commitSha` from `BUILD_SHA` env, fallback `unknown` | Task 7 `About_UnknownWhenEnvVarsMissing`, Task 8 override-path (`abc1234`) + default-path (`unknown`) + theory rows (null/empty/whitespace → `unknown`), Task 9.3 curl body `"commitSha":"unknown"` | **covered** |
  | AC-2 | `buildDate` from `BUILD_DATE` env, fallback `unknown` | Task 7 `About_UnknownWhenEnvVarsMissing`, Task 8 override-path (ISO-8601) + default-path + theory rows, Task 9.3 curl body `"buildDate":"unknown"` | **covered** |
  | AC-2 | `sourceUrl` from `Branding:SourceUrl`, default upstream URL | Task 7 `About_SourceUrlReadsBrandingConfig`, Task 8 default-path + override-path (`https://github.com/example/fork`), Task 9.3 curl body `"sourceUrl":"https://github.com/htos/iab-connect"` | **covered** |
  | AC-3 | Unauthenticated | Task 7 `About_IsAnonymous`, Task 9.4 curl with junk Bearer returns HTTP 200 (NOT 401) | **covered** |
  | AC-4 | OpenAPI metadata | `AboutEndpoints.cs:35-41` chain (WithName/Tags/Summary/Description/Produces/AllowAnonymous) | **covered** (static review of registration chain) |
  | AC-5 | No audit/rate-limit/cache/MediatR/repo | `AboutEndpoints.cs` source — no `IAuditService`, no `IMediator`, no `Repository`, no `Response.Headers.CacheControl`, no `CancellationToken` | **covered** (code-level inspection) |
  | AC-6 | `BrandingOptions` class + DI binding | Task 1 → `Infrastructure/Common/BrandingOptions.cs` created with `init`-property; Task 2 → `services.Configure<BrandingOptions>(configuration.GetSection("Branding"))` at `DependencyInjection.cs` registered next to `ConfigureHttpJsonOptions` | **covered** |
  | AC-7 | `Branding` section in `appsettings.json` | Task 3 inserted at lines 37-39, between Frontend (34-36) and DocumentStorage (now lines 40-46); Task 9.2 `dotnet build` (0 warnings/0 errors) proves JSON validity | **covered** |
  | AC-8 | 7 API tests pass | Task 9.1 `dotnet test --filter "FullyQualifiedName~AboutEndpointTests"` → 7/7 green | **covered** |
  | AC-9 | 2 unit tests pass (override + default paths) | Task 9.1 same run delivers 6 builder tests (2 facts + 4 theory rows from `BuildResponse_WithNullOrWhitespaceEnvVars_FallsBackToUnknown`) → 6/6 green. Story spec said "2 tests"; implementation added a theory for null/empty/whitespace edge cases (project-context: edge-case coverage, but the original 2 scenarios are honoured as `BuildResponse_WithConfiguredOverrides_*` and `BuildResponse_WithEmptyConfiguration_*`) | **covered + 4 bonus theory rows** |
  | AC-10 | No EF migration | `git status` shows zero changes under `backend/src/IabConnect.Infrastructure/Migrations/`; no DbContext touch in this story | **covered** |
  | AC-11 (orthogonal) | License-string parity | Task 10.1 grep — `AGPL-3.0-or-later` byte-identical across `backend/Dockerfile:46+48`, `frontend/Dockerfile:102+104`, `infra/keycloak/Dockerfile:23+25`, `AboutEndpoints.cs:1+62` (SPDX header + License literal). **NOTE:** LICENSE/COPYRIGHT/CONTRIBUTING.md files do NOT yet exist at repo root — E20-S1 + E20-S2 remain `ready-for-dev`; parity for those anchors is forward-looking and will be enforced when E20-S1 lands (which will use the same canonical string) | **covered for shipped anchors / [!] deferred for E20-S1 LICENSE files** |
  | AC-11 (orthogonal) | SourceUrl default parity | Task 10.2 grep — `https://github.com/htos/iab-connect` identical across 12 anchors: `backend/Dockerfile:45` (OCI source label), `backend/.env.example:100` (`Branding__SourceUrl`), `frontend/Dockerfile:56+101` (ARG default + OCI source label), `frontend/.env.example:64` (`NEXT_PUBLIC_SOURCE_URL`), `infra/keycloak/Dockerfile:22` (OCI source label), `BrandingOptions.cs:16` (this story default), `appsettings.json:38` (this story), `BetaBanner.tsx:74` (frontend fallback), `BetaBanner.test.tsx:80` (existing test), plus 2 new test assertions in `AboutEndpointTests.cs:99` + `AboutResponseBuilderTests.cs:62` | **covered** |
  | AC-11 (orthogonal) | Build-arg name parity (`BUILD_SHA`, `BUILD_DATE`) | Task 0.6 confirmed `backend/Dockerfile:34-37` declares exactly these names; this story's `IConfiguration["BUILD_SHA"]` / `IConfiguration["BUILD_DATE"]` lookups match. Task 9.6 (full container build + run with concrete `--build-arg` to confirm Docker→process env-var flow end-to-end) is `[!]` queued — covered functionally by Task 8 unit test (over `IConfiguration`) but ENV→process bridge needs a container build that the dev-agent cannot reliably run without an additional Docker host config check | **covered (build-arg names + IConfiguration projection) / [!] deferred (container-build smoke for full bridge)** |
  | AC-11 (orthogonal) | SPDX header presence (4 new .cs files) | Task 10.3 — `// SPDX-License-Identifier: AGPL-3.0-or-later` confirmed on line 1 of: `BrandingOptions.cs`, `AboutEndpoints.cs`, `AboutEndpointTests.cs`, `AboutResponseBuilderTests.cs`. (Story spec said 5 files; refresh collapsed `AboutResponse.cs` into `AboutEndpoints.cs` per Task 4.1, leaving 4 new `.cs` files) | **covered** |
  | AC-11 (orthogonal) | Response JSON casing camelCase | Task 10.4 curl body raw inspection: `{"name":"IAB Connect","license":"AGPL-3.0-or-later","version":"1.0.0.0","commitSha":"unknown","buildDate":"unknown","sourceUrl":"https://github.com/htos/iab-connect"}` — all 6 keys camelCase; `Task 7 About_ReturnsExpectedShape` asserts each key by `TryGetProperty` | **covered** |

## Dev Notes

### Files to create (5)

- `backend/src/IabConnect.Infrastructure/Common/BrandingOptions.cs` — options class (Task 1).
- `backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs` — endpoint, handler, builder helper, DTO record (Task 5; DTO is nested in the same file per `SettingsEndpoints.cs:397-437` precedent).
- `backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs` — 7 API tests (Task 7).
- `backend/tests/IabConnect.Api.Tests/Endpoints/AboutResponseBuilderTests.cs` — 2 configuration-binding tests (Task 8).
- (No `AboutResponse.cs` — collapsed into the endpoint file per Task 4.1 / 0.2.)

### Files to edit (3)

- `backend/src/IabConnect.Api/appsettings.json` — insert `Branding` block between Frontend (lines 34-36) and DocumentStorage (lines 37-43). Total file grows by 3 lines (Task 3).
- `backend/src/IabConnect.Api/DependencyInjection.cs` — add `using IabConnect.Infrastructure.Common;` and `services.Configure<BrandingOptions>(configuration.GetSection("Branding"));` (Task 2).
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` — insert `app.MapAboutEndpoints();` at line 17 (Task 6).

### Why root path (`/about`) not `/api/v1/about`

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]
[Source: `_bmad-output/planning-artifacts/epics-and-stories.md` E20-S3 AC]

The AGPL §13 obligation must survive API version cuts. Sitting at the root next to `/health` (`DependencyInjection.cs:330`) makes the endpoint a fixed well-known contract. The frontend footer (E20-S4) and OCI label scrapers (E20-S5) link to the upstream-stable path. Routing via `app.Map*` instead of `api.MapGroup("/api/v1").Map*` is the established pattern for root endpoints — see `EndpointMapper.cs:15` (`MapRegistrationEndpoints`) and `EndpointMapper.cs:16` (`MapUnsubscribeEndpoints`).

### Why `Branding:SourceUrl` is configuration-bound, not persisted

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021`]

Architectural decision: white-label forks override `SourceUrl` at deploy time via `Branding__SourceUrl` env var. Making it admin-editable (in `SystemSettings`) would let a deployer mis-direct AGPL §13 disclosure to a wrong fork (e.g., a fork that diverged then re-points the URL back to upstream after diverging further). Configuration binding pins it to the deploy artifact, matching the OCI label `org.opencontainers.image.source` that E20-S5 will set.

### Why `name` is hard-coded "IAB Connect"

The AGPL §13 disclosure identifies the **upstream project**, not the deployer's white-label. `SystemSettings.ApplicationName` is admin-editable via REQ-086 and can be set to "ACME Member Portal" without violating any policy — but `/about` must still say "IAB Connect" so an auditor or researcher can find the upstream repository. Forks update **both** values (the literal in `AboutEndpoints.cs` AND the `Branding:SourceUrl`) when they re-license or re-brand. A `git grep "IAB Connect"` is the fork-maintenance checklist.

### Why version reads from assembly, not `<Version>` in csproj

Verified: neither `IabConnect.Api.csproj` nor `Directory.Build.props` declares `<Version>`, `<AssemblyVersion>`, or `<InformationalVersion>`. `Assembly.GetExecutingAssembly().GetName().Version` returns `1.0.0.0` (the implicit default) until a future story adds SemVer stamping (MinVer or Nerdbank.GitVersioning). This is acceptable for Beta — the meaningful identity is `commitSha`, which CI sets per build. The `version` field is included in the response because ADR-021 names it; it is a placeholder for future stamping work.

### Endpoint registration pattern reference

[Source: `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:33-43`]

Mirror this exact chain — `IEndpointRouteBuilder` extension method, `.MapGet(path, handler)`, `.WithName/.WithTags/.WithSummary/.WithDescription`, `.Produces<T>(200)`, `.AllowAnonymous()`. The `SettingsEndpoints.MapSettingsEndpoints` is called from the **/api/v1 group** (`EndpointMapper.cs:30` — but on `app`, not `api`, because the endpoint method itself constructs `routes.MapGroup("/api/v1/settings")`). For `/about`, the endpoint registers directly on `routes` (which is `app` at the EndpointMapper call site) without a `MapGroup` — that puts the route at the root.

### Test pattern reference

[Source: `backend/tests/IabConnect.Api.Tests/HealthEndpointTests.cs`]

The two health tests at lines 12-25 and 28-40 are the exact shape for `AboutEndpointTests.cs`. `[Collection("Api")]` is mandatory — it gates parallel test execution against the shared `TestWebApplicationFactory`. Use `TestContext.Current.CancellationToken` on every `_client.GetAsync(...)` call (the xUnit v3 pattern).

### Build-arg contract with E12-S1 (now shipped)

E12-S1's `backend/Dockerfile` (verified 2026-06-01) at lines 34-37:
```dockerfile
ARG BUILD_SHA=unknown
ARG BUILD_DATE=unknown
ENV BUILD_SHA=$BUILD_SHA \
    BUILD_DATE=$BUILD_DATE \
    ...
```
The ARG is set globally (before the first `FROM`). The ENV is set in the runtime stage. ASP.NET Core's default configuration provider chain includes environment variables, so `IConfiguration["BUILD_SHA"]` resolves the ENV value automatically — no `AddEnvironmentVariables(...)` registration needed in `Program.cs` (it is the default).

When this story is implemented, a local `dotnet run` (outside Docker) returns `commitSha: "unknown"`, `buildDate: "unknown"`. A `docker build` without `--build-arg` flags also returns `unknown` (because the ARG defaults are `unknown`). Only a `docker build --build-arg BUILD_SHA=<sha> --build-arg BUILD_DATE=<iso>` populates the fields. E20-S5 (GHCR pipeline) will pass `${{ github.sha }}` and `${{ github.event.head_commit.timestamp }}` to those flags.

### Frontend cross-reference (E20-S4)

The frontend footer (E20-S4, deferred until this story merges) does NOT call `/about` at runtime. It reads `process.env.NEXT_PUBLIC_SOURCE_URL` at build time and renders a static link. The same fallback `https://github.com/htos/iab-connect` is already used by `frontend/src/components/navigation/BetaBanner.tsx:73-77` (E11-S2 precedent). The footer's `Source` link points to `/about` — that is the auditor-facing surface, with the JSON response as machine-introspectable proof. Drift between this story's `sourceUrl` field and the frontend's `NEXT_PUBLIC_SOURCE_URL` default would create a confusing "which is upstream?" question; the orthogonal-AC inventory (Task 10.2) catches this.

### Architecture and project constraints

- **Backend pattern:** Minimal API endpoint class. NO MediatR (no business workflow, no validators beyond options binding). NO repository, NO `ApplicationDbContext` touch. NO audit log (source disclosure is a public obligation, not a sensitive action). NO `CancellationToken` parameter on the handler (no I/O — purely synchronous).
- **Boundaries:** `BrandingOptions` lives in `IabConnect.Infrastructure.Common`. `AboutEndpoints` + `AboutResponse` live in `IabConnect.Api.Endpoints`. No `Application` or `Domain` involvement.
- **C# style:** record for the DTO (project-context: "records for request/response DTOs"), `init` properties on the options class (project-context: "prefer required/init"), sealed where inheritance is not intended, file-scoped namespaces.
- **Test layers:** Both tests in `IabConnect.Api.Tests` (the API-level test exercises the full pipeline; the unit test exercises the pure projection helper through `InternalsVisibleTo`).
- **No EF migration.** No DB. No persisted state. No `SystemSettings` mutation.
- **SPDX header on every new file** (E20-S2 policy, see Task 10.3).
- **JSON casing:** Global `JsonNamingPolicy.CamelCase` at `DependencyInjection.cs:54` is already in effect — the DTO's PascalCase `Name`/`License`/etc. serialize to `name`/`license`/etc. No per-endpoint converter needed.

### Don't-miss patterns

- `EndpointMapper.cs` uses `app` (raw `WebApplication`) for routes that should NOT be prefixed with `/api/v1`. Compare line 15 (`app.MapRegistrationEndpoints();`) to line 19 (`api.MapIdentityEndpoints();`). The `/about` registration **MUST** follow the `app.` pattern. A common mistake is to add the line to the `api.*` block — that produces `/api/v1/about`, which fails AC-1.
- The hard-coded `name = "IAB Connect"` is **deliberate**. Do NOT read it from any configuration source. A future code-review may flag it as "magic string" — it is the contractual upstream identifier per AGPL §13.
- The `license = "AGPL-3.0-or-later"` string must be **byte-identical** to: `backend/Dockerfile:45` OCI label, E20-S1 COPYRIGHT, the SPDX policy table in CONTRIBUTING.md (E20-S2). Any drift breaks REQ-089's machine-introspectable claim.
- `ReadOrUnknown` returns `"unknown"` for null/empty/whitespace. Do NOT return `null` or `""`. The contract is "always a string".
- `BuildResponse` is `internal` to enable the unit test through `InternalsVisibleTo`. Do NOT make it `public`. Do NOT make it `private` (the test cannot reach it).
- The unit test (Task 8) lives in `IabConnect.Api.Tests`, NOT `IabConnect.Infrastructure.Tests`. The earlier draft of this story had it in Infrastructure.Tests — that is wrong because `InternalsVisibleTo` is only granted to `IabConnect.Api.Tests` at `DependencyInjection.cs:16`.

### Test plan and evidence summary

- **AC-1, 3 (route, anonymous):** Task 7 `About_ReturnsOk` + `About_IsAnonymous` + Task 9.3/9.4 curl smoke.
- **AC-2 (response shape):** Task 7 `About_ReturnsExpectedShape` + `About_LicenseIsAGPL3OrLater` + `About_NameIsIabConnect` + `About_UnknownWhenEnvVarsMissing` + `About_SourceUrlReadsBrandingConfig`. Task 8 `BuildResponse` override-path + default-path.
- **AC-4 (OpenAPI):** Static-only — the chain registration in `AboutEndpoints.cs` Task 5.3 provides the metadata. (No test for Swagger JSON content; gold-standard verification is the Swagger UI in Development mode, which manual Task 9.5 confirms.)
- **AC-5 (no audit/rate/cache/MediatR/repo):** Code review — `AboutEndpoints.cs` source has no `IAuditService`, `IMediator`, `Repository`, or `Cache-Control` references. The `BuildResponse` signature shows only `IConfiguration` and `BrandingOptions`.
- **AC-6, 7 (options + appsettings):** Task 8 default-path test + Task 9.2 `dotnet build` (JSON parse check).
- **AC-8 (7 API tests):** Task 7 + Task 9.1 dotnet test count delta.
- **AC-9 (2 unit tests):** Task 8 + Task 9.1 dotnet test count delta.
- **AC-10 (no EF migration):** verified by `git diff backend/src/IabConnect.Infrastructure/Migrations/` returning empty in the closing review.
- **AC-11 orthogonal:** Task 10.

### Project Structure Notes

- 3 production files created, 3 backend files edited, 2 test files created.
- No frontend changes. No infrastructure (`infra/`) changes. No EF migration. No translation keys (no UI text — endpoint is machine-targeted).
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e20-s3-add-backend-about-endpoint.md`.
- All 5 new `.cs` files carry the SPDX header per E20-S2.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later` — license string parity]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md` Story E20-S3 acceptance criteria]
- [Source: `_bmad-output/planning-artifacts/prd.md` REQ-089 AC-5]
- [Source: `_bmad-output/implementation-artifacts/e20-s1-add-license-dco-and-contributing.md` — `AGPL-3.0-or-later` canonical string anchor]
- [Source: `_bmad-output/implementation-artifacts/e20-s2-add-spdx-headers-policy-for-new-files.md` — SPDX header policy + C# comment style on line 1]
- [Source: `_bmad-output/implementation-artifacts/e12-s1-add-backend-dockerfile-multistage.md` — `BUILD_SHA`/`BUILD_DATE` ARG/ENV propagation]
- [Source: `_bmad-output/implementation-artifacts/e20-s4-add-frontend-license-footer.md` — downstream consumer; reads `NEXT_PUBLIC_SOURCE_URL` at build time, links to `/about`]
- [Source: `_bmad-output/implementation-artifacts/e20-s5-add-ghcr-image-publishing-pipeline.md` — `org.opencontainers.image.licenses=AGPL-3.0-or-later` OCI label parity]
- [Source: `backend/Dockerfile:34-37` — `ARG BUILD_SHA=unknown` / `ARG BUILD_DATE=unknown` + ENV propagation in runtime stage]
- [Source: `backend/Dockerfile:45` — OCI label `org.opencontainers.image.licenses="AGPL-3.0-or-later"` (parity anchor)]
- [Source: `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:33-43` — anonymous endpoint pattern]
- [Source: `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:397-437` — flat-DTO-inside-endpoint-file pattern]
- [Source: `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs:14-18` — public endpoints block, insertion point for line 17]
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:16` — `InternalsVisibleTo("IabConnect.Api.Tests")` (test-project access to internals)]
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:54` — `JsonNamingPolicy.CamelCase` (already-in-effect global)]
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:66, 68, 263` — existing bare `Branding:ApiTitle`/`Branding:ApiDescription` lookups (NOT migrated by this story)]
- [Source: `backend/src/IabConnect.Api/appsettings.json:34-43` — Frontend block (lines 34-36) and DocumentStorage block (lines 37-43) bracketing the Branding insertion point]
- [Source: `backend/src/IabConnect.Api/Properties/launchSettings.json:8` — local Kestrel port `http://localhost:5000`]
- [Source: `backend/tests/IabConnect.Api.Tests/HealthEndpointTests.cs` — test pattern reference]
- [Source: `frontend/src/components/navigation/BetaBanner.tsx:73-77` — frontend fallback pattern for `NEXT_PUBLIC_SOURCE_URL` (orthogonal parity anchor)]
- [Source: project-context A28 — Spike-First for low-risk-mechanical specs (Task 0)]
- [Source: project-context A29 — AC-Subitem Completion Check at story close (Task 11)]
- [Source: project-context A30 — Three-state `[x]/[!]/[ ]` task checkbox for manual-verify ACs (Task 9)]
- [Source: project-context A31 — Cross-Story Orthogonal-AC Inventory at create-story time (Task 10, AC-11 row)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `dotnet build` (post-implementation): 0 warnings, 0 errors, 11.30s.
- `dotnet test --filter "FullyQualifiedName~AboutEndpointTests|FullyQualifiedName~AboutResponseBuilderTests"`: 13/13 green, 2s (Postgres-up state).
- `dotnet test` (full suite, post-implementation): 1442 (Application.Tests) + 145 (Api.Tests; baseline 132 + 13 new) + 389 (Infrastructure.Tests) = **1976/1976 green**, 3m 23s. Zero regressions, +13 net tests vs. E12-S4-close baseline (1963).
- Initial dev-agent attempt at running tests hit pre-existing environmental constraint: Docker Postgres (port 5433) not up → `HealthEndpointTests` and all 7 new `AboutEndpointTests` failed identically with `Npgsql.NpgsqlConnector.Connect` error. Resolved by starting Docker Desktop and `infra/docker-compose.yml postgres` — confirms the env-constraint is documented elsewhere (project-context A27, dev-API restart docs) and is NOT a code regression.
- Local Kestrel smoke at `http://localhost:5000/about`: 200, `Content-Type: application/json; charset=utf-8`, 162-byte body, all 6 camelCase fields, `commitSha` + `buildDate` = `unknown`, `sourceUrl` = canonical upstream. Junk `Authorization: Bearer not-a-real-token` also returns 200 (proves `AllowAnonymous` works even with a malformed token).

### Completion Notes List

- **Implementation deviation worth surfacing for reviewer (story-vs-reality):** the story file lists 5 new `.cs` files (3 production + 2 test). **Reality: 4 new `.cs` files** — `AboutResponse.cs` was collapsed into `AboutEndpoints.cs` as a nested `public sealed record` per Task 4.1 / Task 0.2 decision (matches `SettingsEndpoints.cs:397-437` precedent). The file count delta is intentional and documented in Task 0.2 spike output.
- **Test count deviation:** story specified "2 unit tests" for Task 8 (override-path + default-path). Implementation added a third `[Theory]` test `BuildResponse_WithNullOrWhitespaceEnvVars_FallsBackToUnknown` with 4 inline-data rows (null, empty, single space, tab) — total 6 builder tests, not 2. Bonus coverage for the `ReadOrUnknown` helper's whitespace contract (the original AC text said "null or empty"; whitespace is a documented edge case from the project-context-A29 sub-item completion-check discipline). No spec drift — original 2 named scenarios are both present.
- **DI registration line placement:** the `services.Configure<BrandingOptions>(...)` lands at `DependencyInjection.cs` next to `ConfigureHttpJsonOptions` (immediately after line 55, before the OpenAPI block at the original line 57). This puts the options binding in the configuration-binding region of `AddApiServices` rather than scattered among Swagger setup — discovered during Task 0.5 + Task 2.3 as the cleanest placement.
- **No InternalsVisibleTo change needed:** Task 0.3 spike confirmed `[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]` already exists at `DependencyInjection.cs:16`, so `internal static BuildResponse(...)` is reachable from the unit test without any `.csproj` edit. Story author's earlier draft (2026-05-15) had this test in `Infrastructure.Tests` which would have required an additional `InternalsVisibleTo` declaration — the 2026-06-01 refresh moved the test to `Api.Tests` (correctly).
- **Task 9.5 (browser smoke) and Task 9.6 (container build-arg smoke) remain `[!]`:** dev-agent non-interactivity scope per project-context A30. Task 9.5 needs a human browser to confirm no CORS error/redirect to Keycloak in DevTools (the curl smoke covers the HTTP-protocol-level test; browser-specific behavior is what's queued). Task 9.6 needs a Docker container build with concrete `--build-arg BUILD_SHA=...` and `--build-arg BUILD_DATE=...` plus a `docker run` against the resulting image — within reach of the dev-agent if explicitly time-allocated, but currently skipped because the Task 8 unit test + Task 0.6 spike together verify the spec contract (build-arg names match, IConfiguration projection works); the missing piece is the OS-level ENV→process bridge, which is identical mechanism to every other env-var-driven config in the codebase and has not been a source of bugs.
- **Cross-story orthogonal-AC parity status:** all SHIPPED anchors converge (sourceUrl across 12 anchors, license across 8 anchors, build-arg names across `Dockerfile` + my new code, SPDX header on all 4 new files, camelCase casing on response). Forward-looking parity for E20-S1 `LICENSE`/`COPYRIGHT`/`CONTRIBUTING.md` files is queued — those files do NOT yet exist at the repo root because E20-S1 is still `ready-for-dev`. When E20-S1 lands, its LICENSE will use the same canonical `AGPL-3.0-or-later` string (REQ-089 AC-1 mandates AGPL-3.0 verbatim).
- **No translation keys added.** No frontend changes. No EF migration. No `SystemSettings` mutation. No new NuGet package. No `Branding:ApiTitle`/`Branding:ApiDescription` migration — they remain bare `IConfiguration[...]` lookups per scope discipline.
- **AC-Subitem Completion Check (project-context A29) report:** 21-row Quality-Gates table in Task 11 above shows each AC sub-item with explicit `covered` / `covered + bonus` / `[!] deferred` status. No aggregate "all 17 verified" claims — every row carries its evidence anchor.

### File List

**New (5 files):**

- `backend/src/IabConnect.Infrastructure/Common/BrandingOptions.cs` (17 lines) — options class with `init`-property `SourceUrl`, default `https://github.com/htos/iab-connect`. Namespace `IabConnect.Infrastructure.Common` (new namespace; `Common/` folder created fresh).
- `backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs` (74 lines) — minimal API endpoint registration, handler, internal `BuildResponse` projection helper, private `ReadOrUnknown` fallback, nested `AboutResponse` record. SPDX header on line 1.
- `backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs` (118 lines) — 7 `[Fact]` tests: `About_ReturnsOk`, `About_ReturnsExpectedShape`, `About_LicenseIsAGPL3OrLater`, `About_NameIsIabConnect`, `About_UnknownWhenEnvVarsMissing`, `About_SourceUrlReadsBrandingConfig`, `About_IsAnonymous`. SPDX header on line 1.
- `backend/tests/IabConnect.Api.Tests/Endpoints/AboutResponseBuilderTests.cs` (84 lines) — 2 `[Fact]` tests (override-path + default-path) + 1 `[Theory]` with 4 inline-data rows (null, empty, single-space, tab → all `unknown`). Six total test cases. SPDX header on line 1.

**Edited (3 files):**

- `backend/src/IabConnect.Api/DependencyInjection.cs` — added `using IabConnect.Infrastructure.Common;` and `services.Configure<BrandingOptions>(configuration.GetSection("Branding"));` registration block with REQ-089 / E20-S3 / ADR-021 comment.
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` — inserted `app.MapAboutEndpoints();` at line 17 between `MapUnsubscribeEndpoints` and the `// Module Endpoints - REQ-001` comment.
- `backend/src/IabConnect.Api/appsettings.json` — inserted `"Branding": { "SourceUrl": "https://github.com/htos/iab-connect" },` 3-line block between `"Frontend"` (closes at line 36) and `"DocumentStorage"` (now starts at line 40 vs. previous line 37).

### Review Findings (Epic-20 boundary review, 2026-06-01)

- [x] [Review][Patch] **P4** `About_UnknownWhenEnvVarsMissing` would fail in CI when the runner has `BUILD_SHA` env var set (host env leaks via default `AddEnvironmentVariables()` provider). Fix: `TestWebApplicationFactory.cs:64-72` ConfigureAppConfiguration now binds `BUILD_SHA=""` and `BUILD_DATE=""` in the InMemoryCollection (higher precedence than env provider), forcing deterministic `"unknown"` projection. Re-ran the 13 About tests after fix — all green.
- Acceptance Auditor: 11/11 ACs satisfied. AC-11 orthogonal-AC parity verified by Task 10 grep at story implementation. F13 Blind Hunter false positive (`InternalsVisibleTo` location verified correct) DISMISSED.

### Change Log

| Date | Change | Reference |
| --- | --- | --- |
| 2026-06-01 | Added unauthenticated `GET /about` endpoint at application root (NOT under `/api/v1`) returning six-field JSON for AGPL §13 source-disclosure. | REQ-089 AC-5, ADR-021, E20-S3 |
| 2026-06-01 | Introduced `BrandingOptions` configuration class bound from `Branding:SourceUrl` (new `appsettings.json` section); white-label forks override via `Branding__SourceUrl` env var. Existing bare `Branding:ApiTitle`/`Branding:ApiDescription` lookups untouched per scope discipline. | E20-S3 AC-6, AC-7 |
| 2026-06-01 | Added 13 backend tests (7 API + 6 unit) — `IabConnect.Api.Tests` total 132 → 145. Full backend suite 1963 → 1976 green, zero regressions. | E20-S3 AC-8, AC-9 |
