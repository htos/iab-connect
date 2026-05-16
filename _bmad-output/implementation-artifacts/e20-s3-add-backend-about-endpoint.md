# Story 20.3: Add Backend `/about` Endpoint

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a user of a network-deployed instance of IAB Connect**,
I want **an unauthenticated endpoint that reports the running version, commit, and source repository**,
so that **I can exercise the AGPL §13 source-disclosure right and verify what code is actually running**.

**Requirement:** REQ-089 AC-5. Epic E20 (Open Source Foundation), Story 3 of 5. Depends on E20-S1 (the `license` string `AGPL-3.0-or-later` returned by this endpoint must match the SPDX identifier established there). Consumes the build-args `BUILD_SHA` and `BUILD_DATE` produced by E12-S1 (backend Dockerfile) — at story implementation time those args are not yet available, so the endpoint must degrade gracefully to `unknown` for local non-Docker runs. Output of this endpoint is consumed by E20-S4 (frontend footer's "Source" link points here).

## Acceptance Criteria

1. **Route `GET /about` (root path, NOT under `/api/v1`).** Returns HTTP 200 with `Content-Type: application/json`. The route is registered at the application root, parallel to `/health` and `/health/ready`, NOT under the `/api/v1` group. This matches the SCP-2026-05-15 `/about` wording and ADR-021. Rationale: source disclosure must remain reachable even if the API versioning scheme changes; sitting next to `/health` makes both operational endpoints discoverable at well-known paths.
2. **Response shape (camelCase JSON, fixed field order).**
   ```json
   {
     "name": "IAB Connect",
     "license": "AGPL-3.0-or-later",
     "version": "<assembly-or-config-version>",
     "commitSha": "<7-or-40-char-git-sha-or-unknown>",
     "buildDate": "<ISO-8601-UTC-or-unknown>",
     "sourceUrl": "<Branding:SourceUrl-with-default>"
   }
   ```
   - `name` is the **literal string `IAB Connect`** — NOT read from `Branding:ApplicationName` (which is admin-editable and could be rebranded by a deployer). The AGPL §13 disclosure must identify the upstream project, not the deployer's white-label.
   - `license` is the **literal string `AGPL-3.0-or-later`** — matches the SPDX identifier from E20-S1 exactly.
   - `version` is sourced from the executing assembly version (`Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0.0"`).
   - `commitSha` is read from `IConfiguration["BUILD_SHA"]` (which receives the Dockerfile build-arg from E12-S1). If null or empty, return the literal string `unknown`. Do NOT throw or return 500.
   - `buildDate` is read from `IConfiguration["BUILD_DATE"]` (same mechanism). If null or empty, return `unknown`. The expected format is ISO-8601 UTC (`2026-05-15T14:30:00Z`) — set by the Dockerfile build at E12-S1.
   - `sourceUrl` is read from `IOptions<BrandingOptions>.Value.SourceUrl`, bound to `Branding:SourceUrl` in `appsettings.json` with default `https://github.com/htos/iab-connect`. White-label forks override via `Branding__SourceUrl` env var.
3. **Unauthenticated.** `.AllowAnonymous()` is applied. No `RequireAuthorization()`. No CORS issues for browser fetches — the endpoint sits inside the existing CORS allowlist applied at the app root.
4. **OpenAPI / Swagger metadata.** The endpoint has `.WithName("GetAbout")`, `.WithTags("About")`, `.WithSummary("Source-disclosure (AGPL §13)")`, `.WithDescription("REQ-089 AC-5: Returns name, license, version, commit, build date, and source URL.")`, `.Produces<AboutResponse>(200)`. Swagger is on only in Development per the existing convention; in Beta/Production the endpoint still works without Swagger metadata exposure.
5. **No audit log, no rate limit, no caching.** This endpoint is a source-disclosure obligation and is called rarely (typically once on app load via the frontend footer). Do NOT register an audit log entry. Do NOT add this route to the rate-limit policy (E14-S4). Do NOT cache server-side (no `Response.Headers.Add("Cache-Control", ...)` — let the client cache via standard ETag if added later). Browser-default caching is acceptable.
6. **`BrandingOptions` configuration class.** New file `backend/src/IabConnect.Infrastructure/Options/BrandingOptions.cs` with a single property `string SourceUrl = "https://github.com/htos/iab-connect"`. Bound in `DependencyInjection.cs` via `services.Configure<BrandingOptions>(configuration.GetSection("Branding"))`. The class lives in `IabConnect.Infrastructure.Options` namespace (sibling to other options classes if any; if none exist yet, this story creates the folder).
7. **`appsettings.json` Branding section.** Add a top-level `"Branding"` section to `backend/src/IabConnect.Api/appsettings.json`:
   ```json
   "Branding": {
     "SourceUrl": "https://github.com/htos/iab-connect"
   }
   ```
   Place this section between `"Frontend"` and `"DocumentStorage"` for readability. Do NOT introduce other Branding keys yet; `ApiTitle`/`ApiDescription` are read directly via `IConfiguration["Branding:..."]` in existing code and do not need to migrate to the options class in this story (avoid scope creep).
8. **API test: response shape.** New file `backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs` follows the `HealthEndpointTests.cs` pattern (`[Collection("Api")]`, `TestWebApplicationFactory` injection). Tests:
   - `About_ReturnsOk` — GET `/about` returns 200.
   - `About_ReturnsExpectedShape` — response JSON contains all six fields with correct types (`name`, `license`, `version`, `commitSha`, `buildDate`, `sourceUrl` all strings).
   - `About_LicenseIsAGPL3OrLater` — `license` value equals `AGPL-3.0-or-later` exactly.
   - `About_NameIsIabConnect` — `name` value equals `IAB Connect` exactly (not influenced by branding admin settings).
   - `About_UnknownWhenEnvVarsMissing` — in the test environment where no `BUILD_SHA`/`BUILD_DATE` is set, both fields equal `unknown` (NOT empty string, NOT null).
   - `About_SourceUrlReadsBrandingConfig` — `sourceUrl` equals the configured `Branding:SourceUrl` (defaults to `https://github.com/htos/iab-connect` when nothing overrides).
   - `About_IsAnonymous` — request with no `Authorization` header still returns 200 (no 401).
9. **Infrastructure test: build-arg injection.** New test in `backend/tests/IabConnect.Infrastructure.Tests/` (file `AboutBuildArgsConfigurationTests.cs`) constructs a `ConfigurationBuilder` with in-memory key/values for `BUILD_SHA=abc1234` and `BUILD_DATE=2026-05-15T10:00:00Z`, resolves the `/about` handler's logic (factor out a pure function that takes `IConfiguration` + `IOptions<BrandingOptions>` and returns the response DTO), asserts the fields are propagated unchanged. This test substitutes for verifying the Dockerfile-to-runtime path without requiring Docker in CI.
10. **No EF migration, no DB changes.** This story does NOT touch `SystemSettings` aggregate, EF Core configurations, or migrations. `sourceUrl` is configuration-bound, not persisted (architecture rationale: deployers white-label via env var; not an admin-editable field — admin-editing source URL would let a deployer mis-direct AGPL §13 disclosure to a wrong fork).
11. **Forward compatibility with E12-S1.** This story produces a working `/about` endpoint on a local non-Docker `dotnet run` (with `commitSha`/`buildDate` = `unknown`). E12-S1 (backend Dockerfile) later sets `BUILD_SHA=${{github.sha}}` and `BUILD_DATE=$(date -u +%FT%TZ)` as `ENV` from `ARG` in the Dockerfile. No story changes are needed in E20-S3 when E12-S1 lands — the IConfiguration lookup picks the env vars up automatically. Document this contract in `AboutEndpoints.cs` XML doc comment.

## Tasks / Subtasks

- [ ] **Task 1 — Create `BrandingOptions` class (AC: 6)**
  - [ ] 1.1 Create folder `backend/src/IabConnect.Infrastructure/Options/` if not present.
  - [ ] 1.2 Add file `BrandingOptions.cs` in namespace `IabConnect.Infrastructure.Options`.
  - [ ] 1.3 Single property `public string SourceUrl { get; init; } = "https://github.com/htos/iab-connect";`. Use `init` per project C# style (project-context: prefer `required`/`init`).
  - [ ] 1.4 Add SPDX header per E20-S2 policy: `// SPDX-License-Identifier: AGPL-3.0-or-later` on line 1.
- [ ] **Task 2 — Bind `BrandingOptions` in DI (AC: 6)**
  - [ ] 2.1 Open `backend/src/IabConnect.Api/DependencyInjection.cs`. Locate `AddApiServices` (the method that calls `services.Configure<...>`).
  - [ ] 2.2 Add `services.Configure<BrandingOptions>(configuration.GetSection("Branding"));` next to other configuration bindings.
  - [ ] 2.3 Add `using IabConnect.Infrastructure.Options;` import.
- [ ] **Task 3 — Add `Branding` section to appsettings.json (AC: 7)**
  - [ ] 3.1 Edit `backend/src/IabConnect.Api/appsettings.json`. Insert the `"Branding": { "SourceUrl": "https://github.com/htos/iab-connect" }` block between the `"Frontend"` block (lines 45–47) and the `"DocumentStorage"` block (line 48).
  - [ ] 3.2 Verify JSON validity (trailing comma rules). Run `dotnet build` after editing — the JSON is loaded by tests at startup, so syntax errors surface immediately.
- [ ] **Task 4 — Create `AboutResponse` DTO (AC: 2)**
  - [ ] 4.1 Add file `backend/src/IabConnect.Api/Endpoints/About/AboutResponse.cs` (subfolder `About/` mirrors how other endpoint families nest DTOs if pattern exists; otherwise place at `backend/src/IabConnect.Api/Endpoints/AboutResponse.cs` — choose the pattern that matches the majority of existing endpoint families and document in Completion Notes).
  - [ ] 4.2 Define as `public sealed record AboutResponse(string Name, string License, string Version, string CommitSha, string BuildDate, string SourceUrl);`. Use record per project C# style (project-context: prefer records for request/response DTOs).
  - [ ] 4.3 SPDX header on line 1.
- [ ] **Task 5 — Create `AboutEndpoints.cs` (AC: 1, 2, 3, 4, 5)**
  - [ ] 5.1 Add file `backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs`. SPDX header on line 1.
  - [ ] 5.2 Class signature: `public static class AboutEndpoints { public static void MapAboutEndpoints(this IEndpointRouteBuilder routes) { ... } }`. Mirror the pattern from `SettingsEndpoints.cs` (lines 33–71) — use `IEndpointRouteBuilder` (not `RouteGroupBuilder`) so the route registers at the root, not under `/api/v1`.
  - [ ] 5.3 Inside `MapAboutEndpoints`, register: `routes.MapGet("/about", GetAbout).WithName("GetAbout").WithTags("About").WithSummary("Source-disclosure (AGPL §13)").WithDescription("REQ-089 AC-5: Returns name, license, version, commit, build date, and source URL.").Produces<AboutResponse>(200).AllowAnonymous();`.
  - [ ] 5.4 Handler signature: `private static IResult GetAbout(IConfiguration configuration, IOptions<BrandingOptions> brandingOptions)`. No async needed — purely synchronous. No `CancellationToken` needed (no I/O).
  - [ ] 5.5 Handler body — build `AboutResponse` per AC-2. Use a private helper `static string ReadOrUnknown(string? value) => string.IsNullOrWhiteSpace(value) ? "unknown" : value;` to keep the fallback rule centralized and testable.
  - [ ] 5.6 Read version: `Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0.0"`.
  - [ ] 5.7 Read `commitSha` from `configuration["BUILD_SHA"]`; pass through `ReadOrUnknown`.
  - [ ] 5.8 Read `buildDate` from `configuration["BUILD_DATE"]`; pass through `ReadOrUnknown`.
  - [ ] 5.9 Read `sourceUrl` from `brandingOptions.Value.SourceUrl` (no `ReadOrUnknown` — the options binding guarantees a non-null string via the property default).
  - [ ] 5.10 Hard-code `name = "IAB Connect"` and `license = "AGPL-3.0-or-later"`.
  - [ ] 5.11 Return `Results.Ok(response)`.
  - [ ] 5.12 Add XML doc comment on `MapAboutEndpoints` referencing REQ-089 AC-5, ADR-021, and the Dockerfile-build-arg dependency on E12-S1.
- [ ] **Task 6 — Register in `EndpointMapper.cs` (AC: 1)**
  - [ ] 6.1 Open `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs`.
  - [ ] 6.2 At the top of the "Public Endpoints (no auth required)" block (line 14), add: `app.MapAboutEndpoints(); // REQ-089 AC-5 (E20-S3): AGPL §13 source-disclosure`.
  - [ ] 6.3 The position matters less than the comment marker — the registration must call on `app` (root), not `api` (which prefixes `/api/v1`).
- [ ] **Task 7 — API tests (AC: 8)**
  - [ ] 7.1 Create folder `backend/tests/IabConnect.Api.Tests/Endpoints/` if absent.
  - [ ] 7.2 Add file `AboutEndpointTests.cs` mirroring `HealthEndpointTests.cs` structure exactly: `[Collection("Api")]`, ctor takes `TestWebApplicationFactory`, instance `_client`.
  - [ ] 7.3 Implement the seven test methods listed in AC-8.
  - [ ] 7.4 Use `System.Net.Http.Json` and `JsonSerializer` (configured with `JsonSerializerOptions.Web` for camelCase) to deserialize into `AboutResponse`. Reference how `HealthEndpointTests.cs:36` reads the body — adopt the same pattern.
  - [ ] 7.5 SPDX header on line 1.
- [ ] **Task 8 — Infrastructure test for build-arg flow (AC: 9)**
  - [ ] 8.1 Refactor the handler so the response-construction logic is a pure static method: `internal static AboutResponse BuildResponse(IConfiguration configuration, BrandingOptions options)`. The endpoint handler becomes a one-liner: `Results.Ok(BuildResponse(configuration, brandingOptions.Value))`. The factored-out method is `internal` so the Infrastructure test project can reach it via `InternalsVisibleTo` (already configured in the project, or add it in `.csproj` if absent — Completion Notes if added).
  - [ ] 8.2 Add file `backend/tests/IabConnect.Infrastructure.Tests/AboutBuildArgsConfigurationTests.cs`. Use `ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["BUILD_SHA"] = "abc1234", ["BUILD_DATE"] = "2026-05-15T10:00:00Z", ["Branding:SourceUrl"] = "https://github.com/example/fork" }).Build()`.
  - [ ] 8.3 Assert each field of the returned `AboutResponse` matches the configured values, plus the hard-coded `name`/`license`.
  - [ ] 8.4 Add a second test with empty IConfiguration → assert `commitSha = "unknown"`, `buildDate = "unknown"`, `sourceUrl = "https://github.com/htos/iab-connect"` (the default).
- [ ] **Task 9 — Manual validation**
  - [ ] 9.1 Run `dotnet run --project backend/src/IabConnect.Api`. Hit `http://localhost:5000/about` (or whatever local port — see `Frontend:BaseUrl` `:3000` for the frontend; backend default Kestrel port may be 5000/5001).
  - [ ] 9.2 Expected JSON: `{ "name": "IAB Connect", "license": "AGPL-3.0-or-later", "version": "X.Y.Z.0", "commitSha": "unknown", "buildDate": "unknown", "sourceUrl": "https://github.com/htos/iab-connect" }`.
  - [ ] 9.3 Hit `/about` from an incognito browser tab (no auth cookies, no `Authorization` header) — confirm 200.
- [ ] **Task 10 — Build and test**
  - [ ] 10.1 `dotnet test` from `backend/` — expect previous count plus 7 (API) + 2 (Infra) = 9 new passing tests. Warnings-as-errors must stay green.
  - [ ] 10.2 If `dotnet build` fails on JSON syntax in `appsettings.json`, revisit Task 3.

## Dev Notes

### Files to create

- `backend/src/IabConnect.Infrastructure/Options/BrandingOptions.cs` — `IOptions<>` binding class.
- `backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs` — minimal API endpoint registration and handler.
- `backend/src/IabConnect.Api/Endpoints/AboutResponse.cs` (or `Endpoints/About/AboutResponse.cs` — match pattern of nesting; see Task 4.1).
- `backend/tests/IabConnect.Api.Tests/Endpoints/AboutEndpointTests.cs` — 7 API tests.
- `backend/tests/IabConnect.Infrastructure.Tests/AboutBuildArgsConfigurationTests.cs` — 2 configuration-binding tests.

### Files to edit

- `backend/src/IabConnect.Api/appsettings.json` — add `Branding` section (Task 3).
- `backend/src/IabConnect.Api/DependencyInjection.cs` — `services.Configure<BrandingOptions>(...)` registration (Task 2).
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` — register `app.MapAboutEndpoints()` in the public-endpoints block (Task 6).

### Why root path (`/about`), not `/api/v1/about`

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]
[Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E20-S3: Add backend /about endpoint` — AC says `GET /about`]

The disclosure obligation under AGPL §13 must remain discoverable across API version cuts. Sitting at the root next to `/health` and `/health/ready` makes the endpoint a well-known fixed contract. Registration uses the existing `IEndpointRouteBuilder` extension pattern (see `SettingsEndpoints.cs:33`), passing `app` directly in `EndpointMapper.cs:14` (the "Public Endpoints" block) rather than the `api = app.MapGroup("/api/v1")` group.

### Why `Branding:SourceUrl` is configuration-bound, not persisted

[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021`]

Architecture decision: white-label forks override `SourceUrl` via the `Branding__SourceUrl` env var. Making it admin-editable would let a deployer mis-direct AGPL §13 disclosure to a wrong fork URL (e.g., changing it back to the upstream after the fork modifies the application). Configuration binding pins it at deploy time. Existing `Branding:ApiTitle`/`Branding:ApiDescription` use bare `IConfiguration["..."]` lookups at startup — that pattern is fine and need not be migrated to the new options class in this story.

### Why `name` is the literal "IAB Connect" (not the admin-editable applicationName)

The AGPL §13 source-disclosure identifies the upstream project, not the white-label deployer. `SystemSettings.ApplicationName` (admin-editable via REQ-086) can be rebranded freely by deployers — but `/about` must always say "IAB Connect" so a tester or auditor can find the upstream repository. Forks update both: the constant string in `AboutEndpoints.cs` AND the `SourceUrl` configuration value.

### Version source — assembly attribute, not `<Version>` in csproj

The project does NOT declare `<Version>` in `IabConnect.Api.csproj` or `Directory.Build.props` (verified). `Assembly.GetExecutingAssembly().GetName().Version` returns the default `1.0.0.0` until a future story adds version stamping. This is acceptable for Beta — the meaningful identity comes from `commitSha` (set by Dockerfile in E12-S1). The `version` field is here mainly because ADR-021 names it; a future story may add proper SemVer stamping via `MinVer` or `Nerdbank.GitVersioning`.

### Endpoint pattern reference

[Source: `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:33-71` — anonymous public-group registration pattern]

The exact registration pattern to follow (anonymous, root-level, with full OpenAPI metadata):
```csharp
public static void MapAboutEndpoints(this IEndpointRouteBuilder routes)
{
    routes.MapGet("/about", GetAbout)
        .WithName("GetAbout")
        .WithTags("About")
        .WithSummary("Source-disclosure (AGPL §13)")
        .WithDescription("REQ-089 AC-5: Returns name, license, version, commit, build date, and source URL.")
        .Produces<AboutResponse>(200)
        .AllowAnonymous();
}
```

### Test reference

[Source: `backend/tests/IabConnect.Api.Tests/HealthEndpointTests.cs:12-41` — pattern for simple GET endpoint tests with `[Collection("Api")]` + `TestWebApplicationFactory`]

The new `AboutEndpointTests.cs` follows the same construction shape. Use `await _client.GetAsync("/about", TestContext.Current.CancellationToken)` for the request.

### Build-arg contract with E12-S1 (downstream story)

E12-S1 (backend Dockerfile, Wave 3) adds:
```dockerfile
ARG BUILD_SHA=unknown
ARG BUILD_DATE=unknown
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_DATE=$BUILD_DATE
```

E20-S3 (this story, Wave 4 in the SCP wave order) ships before E12 in the sprint promotion override — see sprint-status update. Local non-Docker runs return `unknown` for both. After E12-S1 merges and the API runs in a Docker container, `commitSha` and `buildDate` populate automatically with no code change here. Document this contract in the XML doc comment on `MapAboutEndpoints`.

### Architecture and project constraints

- Backend Pattern: Minimal API endpoint class. NO MediatR (no business workflow, no validation beyond "read config"). NO repository. NO audit log.
- Backend Boundaries: `BrandingOptions` lives in `Infrastructure.Options`. `AboutEndpoints` and `AboutResponse` live in `Api.Endpoints`. No `Application` or `Domain` involvement — there is no domain logic to express.
- C# style: records for DTOs (project-context: "records for request/response DTOs"), `init` properties, sealed where inheritance is not intended.
- Test layers: API test in `Api.Tests` (response shape + 200 + anonymous). Infrastructure test in `Infrastructure.Tests` (configuration binding via in-memory config).
- No EF migration. No DB. No persisted state.
- All async/CancellationToken patterns NOT applied — this handler is synchronous and has no I/O.
- SPDX header on every new file (E20-S2 policy).

### Don't-miss patterns

- `EndpointMapper.cs` uses `app` (raw `WebApplication`) for routes that should NOT be prefixed with `/api/v1`. Compare line 15 (`app.MapRegistrationEndpoints()`) to line 19 (`api.MapIdentityEndpoints()`). The `/about` registration MUST follow the `app.` pattern.
- The hard-coded `name = "IAB Connect"` is **deliberate**. Do NOT read it from any configuration source. A code-review may try to "fix" this — it isn't a bug.
- The `license = "AGPL-3.0-or-later"` string must be **byte-identical** to the SPDX identifier in E20-S1's COPYRIGHT and CONTRIBUTING.md. Any drift breaks E20-S4's footer expectation and E20-S5's OCI label expectation.
- `ReadOrUnknown` helper returns `unknown` for null/empty/whitespace. Do NOT return `null` or `""` — the contract is "always a string".

### Test plan and evidence

- **AC-1, 3, 4 (route, anonymous, OpenAPI):** API test `About_ReturnsOk` and `About_IsAnonymous`.
- **AC-2 (response shape):** API tests `About_ReturnsExpectedShape`, `About_LicenseIsAGPL3OrLater`, `About_NameIsIabConnect`, `About_UnknownWhenEnvVarsMissing`, `About_SourceUrlReadsBrandingConfig`.
- **AC-6, 7 (options class + appsettings):** Infrastructure test `AboutBuildArgsConfigurationTests` exercises both default-value path and env-var-override path.
- **AC-9 (build-arg flow):** Infrastructure test substitutes for the Dockerfile-injection mechanism. When E12-S1 lands, a manual `docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) ...` and `docker run` smoke test is in E12-S1's scope, not this story.
- **AC-11 (E12 forward-compat):** Confirmed by AC-9 test's "empty config → unknown" branch.

### Project Structure Notes

- NEW backend files: 3 production files (`BrandingOptions.cs`, `AboutEndpoints.cs`, `AboutResponse.cs`) + 2 test files (`AboutEndpointTests.cs`, `AboutBuildArgsConfigurationTests.cs`).
- EDIT backend files: 3 (`appsettings.json`, `DependencyInjection.cs`, `EndpointMapper.cs`) — small, surgical edits.
- No frontend changes. No infra changes. No EF migration. No translation keys.
- SPDX header on every new file (E20-S2 policy).
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e20-s3-add-backend-about-endpoint.md`.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later` — license string parity]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E20-S3: Add backend /about endpoint`]
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-089 Open Source License Surface` — AC-5]
- [Source: `backend/src/IabConnect.Api/Endpoints/SettingsEndpoints.cs:33-71` — anonymous endpoint pattern reference]
- [Source: `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs:14-17` — public-endpoint registration block]
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:189-191, 320-325` — health-check endpoint precedent at root path]
- [Source: `backend/tests/IabConnect.Api.Tests/HealthEndpointTests.cs:12-41` — API test pattern]
- [Source: `backend/src/IabConnect.Api/appsettings.json:1-78` — current configuration layout]
- [Source: E20-S1 `e20-s1-add-license-dco-and-contributing.md` — `LICENSE` AGPL identifier]
- [Source: E12-S1 `e12-s1-add-backend-dockerfile-multistage.md` — downstream Dockerfile that supplies BUILD_SHA, BUILD_DATE env vars]
- [Source: E20-S4 `e20-s4-add-frontend-license-footer.md` — downstream consumer of /about output]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

### Completion Notes List

### File List
