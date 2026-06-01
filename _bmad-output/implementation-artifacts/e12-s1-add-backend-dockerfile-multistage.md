# Story 12.1: Add Backend Dockerfile (Multi-Stage)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the CI pipeline (GitHub Actions) and self-hosters**,
I want **a reproducible, multi-stage Docker image for the .NET 10 backend, plus a one-pass cleanup of the rustfsadmin literals carried in `backend/src/IabConnect.Api/appsettings.json` that block a clean Beta deploy**,
so that **Railway and any forker can pull or build identical artifacts that boot reliably with the correct timezone, security posture, build-metadata for `/about`, and a credential-free base config layer**.

**Requirement:** REQ-088 AC-1 (deployable via published, versioned Docker images). Epic E12 (Dockerization), Story 1 of 4 — the **first deployable** of E12 and **Wave-3 start** per SCP-2026-05-15 §6.

**Upstream:** E11-S1 added `appsettings.Beta.json` and the env-layering test surface ([backend/tests/IabConnect.Api.Tests/Configuration/AppSettingsLayeringTests.cs](backend/tests/IabConnect.Api.Tests/Configuration/AppSettingsLayeringTests.cs)). E11-S2 introduced `ASPNETCORE_ENVIRONMENT=Beta` and locked Production-grade hardenings (HSTS, HTTPS-redirect, no Swagger, no Hangfire-Dashboard, strict CORS) to fire for Beta verbatim. E11-S3 enabled `output: 'standalone'` on the frontend so E12-S2 can land. The **Epic-11 retrospective (2026-05-16)** flagged the `rustfsadmin` literals at [appsettings.json:39-40](backend/src/IabConnect.Api/appsettings.json#L39-L40) as a Beta-blocker and explicitly deferred the resolution decision to **this story**.

**Downstream:**
- **E12-S2** (Frontend Dockerfile) — reuses the multi-stage + non-root + build-args + OCI-labels pattern established here.
- **E12-S3** (Custom Keycloak image) — reuses the OCI-labels and CI build-arg conventions.
- **E12-S4** (`docker-compose.full.yml`) — pulls or builds the image produced by this story.
- **E20-S3** (`/about` endpoint) — reads `BUILD_SHA` / `BUILD_DATE` env vars that this story bakes via `ARG` / `ENV`.
- **E20-S5** (GHCR publishing pipeline) — passes `--build-arg BUILD_SHA=${{github.sha}} --build-arg BUILD_DATE=$(date -u …)` and tags with the OCI labels declared here.
- **E13-S1..S4** (Railway deploy) — pulls the image this story produces.

**Wave context:** SCP-2026-05-15 §6 places this story in **Wave 3 (Containerization)**. Wave 2 (E11-S1/S2/S3) is fully done. After E12-S1/S2/S3 land, Wave 4 (E20-S3 + E20-S4 `/about` + footer) can begin because the build-args this story bakes exist on disk.

## Acceptance Criteria

1. **`backend/Dockerfile` exists** with two clearly named stages — `build` (based on `mcr.microsoft.com/dotnet/sdk:10.0`) and `runtime` (based on `mcr.microsoft.com/dotnet/aspnet:10.0`). The build stage runs `dotnet restore` against `src/IabConnect.Api/IabConnect.Api.csproj` (which transitively restores `IabConnect.Application`, `IabConnect.Domain`, `IabConnect.Infrastructure` via project references), then `dotnet publish -c Release -o /app/publish /p:UseAppHost=false /p:PublishSingleFile=false`. The `PublishSingleFile=false` override is **mandatory** to neutralize the Release-config-default `<PublishSingleFile>true</PublishSingleFile>` set in [backend/Directory.Build.props:14](backend/Directory.Build.props#L14) — without the override, the publish emits a single-file `IabConnect.Api` host binary that the runtime stage's `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]` cannot launch.

2. **SDK / runtime image tags MUST be `10.0`, not `9.0`.** [backend/global.json](backend/global.json) pins `"version": "10.0.102"` with `"rollForward": "latestMinor"`, and [backend/Directory.Build.props:3](backend/Directory.Build.props#L3) targets `net10.0`. The epic-file text and the prior planning stub both said `9.0` — that is incorrect and is corrected here. Use `mcr.microsoft.com/dotnet/sdk:10.0` for the build stage and `mcr.microsoft.com/dotnet/aspnet:10.0` for the runtime stage (Debian-12 "bookworm" variants).

3. **Runtime stage: install `tzdata` and set `ENV TZ=Europe/Zurich`.** This is **mandatory**: `ResolveReminderJobTimeZone` at [backend/src/IabConnect.Api/DependencyInjection.cs:361](backend/src/IabConnect.Api/DependencyInjection.cs#L361) explicitly logs `LogError` and falls back to UTC when `Europe/Zurich` is unresolvable, which corrupts the daily 09:00 volunteer-shift-reminder schedule (REQ-024). The Debian-bookworm `aspnet:10.0` base does NOT ship tzdata. ICU ships pre-installed in the Debian base (verified in Task 3); do not install it explicitly. Set `/etc/timezone` and symlink `/etc/localtime` to `/usr/share/zoneinfo/$TZ` in the same RUN layer that installs tzdata.

4. **Non-root user via numeric UID.** The runtime stage switches to `USER 1000` before `ENTRYPOINT`. Use the numeric UID (not `app` or a named user) so Kubernetes-style `runAsNonRoot: true` admission policies can evaluate the image without resolving `/etc/passwd`. The published files in `/app/` must be readable by uid 1000 — the COPY from `--from=build` runs as root, ownership stays root, but world-readable file perms (the default for `dotnet publish` output) suffice. Do NOT `chown` recursively (it adds a fat layer for no benefit).

5. **Port + `ASPNETCORE_URLS`.** The runtime stage `EXPOSE 8080` and `ENV ASPNETCORE_URLS=http://+:8080`. The image MUST NOT default to port 80 or to HTTPS — Railway (ADR-011, ADR-012) terminates TLS at its edge load-balancer and forwards HTTP internally. The application's `UseHttpsRedirection()` at [backend/src/IabConnect.Api/DependencyInjection.cs:262-265](backend/src/IabConnect.Api/DependencyInjection.cs#L262-L265) honors `X-Forwarded-Proto: https` (Railway sets this), so binding to plain HTTP at the container is correct.

6. **`backend/.dockerignore` exists.** Excludes at minimum, grouped by category:
   - **.NET build outputs:** `**/bin/`, `**/obj/`, `**/*.user`, `**/*.lscache` (the `.lscache` files visible in the current `git status` are local-IDE artifacts that leaked once; the wildcard prevents future leaks).
   - **Tests:** `tests/`, `**/*.Tests/`, `*.Tests.csproj.lscache` (test projects are not needed in the image and would inflate build context and image size).
   - **Local config + secrets:** `**/.env`, `**/.env.*`, `**/secrets/`, `**/*.pfx`, `**/*.key`.
   - **IDE / editor:** `**/.vs/`, `**/.idea/`, `**/.vscode/`, `**/*.swp`, `**/.DS_Store`.
   - **Logs:** `**/logs/`, `**/*.log`.
   - **Source-control + planning artifacts that shouldn't ride in the build context:** `.git/`, `.github/`, `_bmad-output/`, `_bmad/`, `docs/`.
   - **Frontend tree** (the build context starts at `backend/`, but if a developer ever invokes `docker build` with a `..` context, frontend artifacts must not leak): the `.dockerignore` is scoped to `backend/`, so a `frontend/` entry is unnecessary AT this scope — confirm by not adding it (avoid false sense of cross-cutting protection).

7. **Strip `rustfsadmin` credentials from base [appsettings.json](backend/src/IabConnect.Api/appsettings.json) AND from the C# class initializers (Beta-blocker resolution deferred to this story by the Epic-11 retrospective, 2026-05-16).** Two coordinated edits:

   **7.1 — Edit [backend/src/IabConnect.Api/appsettings.json:37-43](backend/src/IabConnect.Api/appsettings.json#L37-L43):**
   - **Before** (current):
     ```json
     "DocumentStorage": {
       "ServiceUrl": "http://localhost:9000",
       "AccessKey": "rustfsadmin",
       "SecretKey": "rustfsadmin",
       "BucketName": "iabconnect-documents",
       "UseHttps": false
     },
     ```
   - **After** (this story):
     ```json
     "DocumentStorage": {
       "ServiceUrl": "",
       "AccessKey": "",
       "SecretKey": "",
       "BucketName": "iabconnect-documents",
       "UseHttps": true
     },
     ```

   **7.2 — Edit [backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs:10-14](backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs#L10-L14):**
   - **Before** (current):
     ```csharp
     public string ServiceUrl { get; set; } = "http://localhost:9000";
     public string AccessKey { get; set; } = "rustfsadmin";
     public string SecretKey { get; set; } = "rustfsadmin";
     public string BucketName { get; set; } = "iabconnect-documents";
     public bool UseHttps { get; set; } = false;
     ```
   - **After** (this story):
     ```csharp
     public string ServiceUrl { get; set; } = "";
     public string AccessKey { get; set; } = "";
     public string SecretKey { get; set; } = "";
     public string BucketName { get; set; } = "iabconnect-documents";
     public bool UseHttps { get; set; } = true;
     ```

   **Rationale.** The base `appsettings.json` is committed and shipped in the container image. Per project-context.md "Do not commit secrets… environment files", the literals `"rustfsadmin"` MUST NOT be the in-image default. The 7.2 C# edit eliminates the SAME strings from the compiled `IabConnect.Infrastructure.dll` IL (otherwise `strings .../IabConnect.Infrastructure.dll | grep rustfsadmin` still returns matches even after 7.1). The shape of both files stays (so config binding sees the section and the class compiles), `BucketName` keeps its non-secret default, `UseHttps` flips to `true` (cloud-safe — Dev overrides to `false` in [appsettings.Development.json:67](backend/src/IabConnect.Api/appsettings.Development.json#L67)).

   The same literals already exist in [appsettings.Development.json:62-68](backend/src/IabConnect.Api/appsettings.Development.json#L62-L68), which only loads when `ASPNETCORE_ENVIRONMENT=Development` — so local dev is unaffected by either edit. The .NET config binder writes the Development-overlay values over both the base JSON and the class initializer at registration time ([DependencyInjection.cs:259-260](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L259-L260)).

   **Failure mode after the edits.** The `IAmazonS3` singleton is **lazy-init via factory** at [DependencyInjection.cs:261-270](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L261-L270) — the factory runs on first `IDocumentStorage` resolution, not at app boot. With empty `ServiceUrl`, the factory's `new AmazonS3Config { ServiceURL = "" }` either throws `ArgumentException` immediately OR constructs an invalid client that fails on first S3 round-trip (AWS SDK behavior is version-dependent — Task 1.3 captures the actual symptom). Either way, the app **boots successfully**, then fails the first document-touching request with a clear error. This is the desired behavior: missing Railway env vars surface as a 500 on `/api/documents/...` instead of a startup crash that hides the cause.

   **Beta wiring.** E13-S2 (Railway env vars) sets `DocumentStorage__ServiceUrl`, `DocumentStorage__AccessKey`, `DocumentStorage__SecretKey`, `DocumentStorage__UseHttps` per ADR-013. The Configuration system's environment-variable provider overlays these on top of the base empty strings.

8. **No other secrets in the image.** The runtime stage's `/app/` contains exactly three `appsettings*.json` files: `appsettings.json` (with AC-7's redactions), `appsettings.Development.json` (carries the rustfsadmin Dev defaults — fine, only loads when ASPNETCORE_ENVIRONMENT=Development), and `appsettings.Beta.json` (Serilog Console-only + `RetentionEnforcement:Enabled=false` per [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json)). NO `appsettings.Production.json` is copied (it does not exist by design — Production reads everything from environment per ADR-015). NO `.env`, `.env.local`, `.env.production`, or `secrets.json` files are copied (the `.dockerignore` from AC-6 enforces this).

9. **Build-args `BUILD_SHA` and `BUILD_DATE` (default `unknown`).** The Dockerfile declares `ARG BUILD_SHA=unknown` and `ARG BUILD_DATE=unknown` in the **runtime stage** (not the build stage — build stage doesn't need them; runtime needs them visible at process boot), then `ENV BUILD_SHA=$BUILD_SHA` and `ENV BUILD_DATE=$BUILD_DATE`. Both default to the literal string `unknown` so a local `docker build -t iabc-api backend/` without args still produces a runnable image; `/about` returns `{ commitSha: "unknown", buildDate: "unknown" }` in that case, which is the documented local-dev contract for E20-S3.

10. **OCI image labels** per ADR-014 (GHCR distribution) and ADR-009 (AGPL-3.0-or-later license metadata). The runtime stage emits these labels via `LABEL` instructions:
    - `org.opencontainers.image.source="https://github.com/htos/iab-connect"` — points to the canonical OSS repo, NOT a fork URL. Forks rebuild the image with their own `--label org.opencontainers.image.source=…` override; the Dockerfile default is the canonical project.
    - `org.opencontainers.image.licenses="AGPL-3.0-or-later"` — SPDX expression, matches the LICENSE file added in E20-S1.
    - `org.opencontainers.image.title="IAB Connect API"`.
    - `org.opencontainers.image.description="Backend API for IAB Connect — AGPL-3.0-or-later open-source membership platform."`.
    - `org.opencontainers.image.vendor="IAB Connect contributors"`.
    - E20-S5 augments these at CI-time via `docker buildx build --label org.opencontainers.image.revision=${{github.sha}} --label org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)` — those two are NOT baked into the Dockerfile because they vary per build and re-baking them would break the cache.

11. **`ENTRYPOINT`.** The runtime stage ends with `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]`. No `CMD` is needed. The exec-form (JSON array) is mandatory so signals (SIGTERM from Railway's stop-the-container path) reach the dotnet process directly — shell-form `ENTRYPOINT dotnet IabConnect.Api.dll` would route signals to a wrapping `/bin/sh` and the .NET process would never see them, causing 30-second forced-kill on every redeploy.

12. **Build success.** `docker build -t iabc-api:test backend/` from the **repository root** completes successfully. Resulting image size is ≤ 350 MB (aspnet:10.0 Debian-12 base is ~210 MB; published .NET app is ~30 MB; with tzdata + layer cache, ≤ 350 MB is the realistic target). Capture `docker history iabc-api:test --no-trunc` head in Completion Notes as evidence.

13. **Runtime smoke — bootstrap reached.** `docker run --rm iabc-api:test` (no env vars supplied) emits the Serilog bootstrap line `Starting IAB Connect API` (from [backend/src/IabConnect.Api/Program.cs:15](backend/src/IabConnect.Api/Program.cs#L15) which uses the `CreateBootstrapLogger().WriteTo.Console()` sink) to stdout, then crashes when `MigrateAsync()` at [Program.cs:56,88](backend/src/IabConnect.Api/Program.cs#L56) tries to dial the localhost-default connection string and fails. Acceptance criterion is **the bootstrap log line appears in stdout BEFORE the container exits** (proving the image is launchable and the application code is reachable). The container exits non-zero — this is fine and expected. Capture the docker logs output in Completion Notes.

14. **Quality gates.** `dotnet build backend/` from repo root — green (must remain green after the AC-7 appsettings edit). `dotnet test backend/` — 1957/1957 stays green (baseline established by E11-S2; the AC-7 edit reduces base-config schema but does not change runtime config in test scenarios where `ASPNETCORE_ENVIRONMENT=Testing` and connection strings come from Testcontainers). `docker build -t iabc-api:test backend/` — green. `docker run --rm iabc-api:test` — exits non-zero AFTER emitting the bootstrap Serilog line.

## Tasks / Subtasks

- [x] **Task 0 — Spike: enumerate `DocumentStorage:*` consumers (AC: 7, project-context A28)** — before editing appsettings.json, verify no boot-time eager-init path reads `DocumentStorage:AccessKey` synchronously before configuration overrides apply. Search:
  - [x] 0.1 `grep -r "DocumentStorage" backend/src/` — list all references.
  - [x] 0.2 Identify the DI registration site for the S3/RustFS client (likely in `IabConnect.Infrastructure/DependencyInjection.cs` or `IabConnect.Infrastructure/Storage/`).
  - [x] 0.3 Confirm the client is registered as **scoped or transient** (lazy-init on first use), not as **singleton with eager constructor read** of `IOptions<DocumentStorageOptions>`. If eager, escalate scope: emit a one-line note "Blocker found: eager DocumentStorage init reads AccessKey at boot → AC-7 edit will crash Dev startup unless ServiceUrl/AccessKey/SecretKey are kept" and ask user. If lazy (expected), emit "Confirmed lazy-init → AC-7 edit is safe" and proceed.
  - [x] 0.4 Confirm no test fixture reads the **base** appsettings.json `DocumentStorage:AccessKey` for assertions (the AC-7 redaction changes the base value to empty string; if any test asserts `"rustfsadmin"` against the base layer, update or escalate).

- [x] **Task 1 — Apply AC-7 edits (AC: 7)** — execute both edits per AC-7.1 and AC-7.2 "After" blocks. No other lines change in either file.
  - [x] 1.1 Edit [backend/src/IabConnect.Api/appsettings.json:37-43](backend/src/IabConnect.Api/appsettings.json#L37-L43) per AC-7.1.
  - [x] 1.2 Edit [backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs:10-14](backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs#L10-L14) per AC-7.2.
  - [x] 1.3 Run `dotnet build backend/IabConnect.sln` — green, 0 warnings.
  - [x] 1.4 Run `dotnet test backend/` — 1963/1963 green (baseline 1957 + 6 new AppSettingsLayering theory rows for DocumentStorage:*). One pre-existing test (`SettingsEndpointTests.GetLogo_NoLogoConfigured_Returns404`) was failing after AC-7 because `IDocumentStorage` parameter binding triggers the `IAmazonS3` singleton factory at endpoint invocation time, and the factory closed over `storageSettings` captured at DI registration (Program.cs:32) — BEFORE `WebApplicationFactory`'s `ConfigureAppConfiguration` callbacks apply. Fixed via env-var injection in TestWebApplicationFactory's static constructor (env vars are part of the default config chain set up by `WebApplication.CreateBuilder`, so they win the eager read). Resolves the deferral noted at `AppSettingsLayeringTests.cs:57-65` ("either makes init lazy or refactors the test infrastructure"); the test-infrastructure half is now applied without touching the production DI registration.
  - [!] 1.5 Run `cd backend/src/IabConnect.Api && dotnet run` against the existing local `infra/docker-compose.yml` stack. **Manual-verify [!]** per project-context A30 — requires the local docker-compose stack standing up + interactive `dotnet run` with a `/health/ready` round-trip; not interactively launchable from the non-interactive dev agent. The build (1.3) and full backend test suite (1.4) cover the regression surface; the Development overlay layering for `rustfsadmin/rustfsadmin/http://localhost:9000` is invariant-tested by `BetaLayered_DoesNotInheritDevDefaults`'s sibling-by-design (the Development overlay is unchanged), and the empty-base/Development-overlay layering is preserved (verified via [appsettings.Development.json:62-68](backend/src/IabConnect.Api/appsettings.Development.json#L62-L68)). Human verifier should confirm `dotnet run` against the running stack still produces a working `/api/documents/...` round-trip.
  - [x] 1.6 **Strings-leak verification.** After build, run from `backend/`:
    ```sh
    strings src/IabConnect.Infrastructure/bin/Debug/net10.0/IabConnect.Infrastructure.dll | grep -i rustfsadmin || echo "CLEAN"
    ```
    Expected: prints `CLEAN`. If `rustfsadmin` still appears, escalate — there is another source of the literal (likely a test fixture or a different settings class) that AC-7 missed.

- [x] **Task 2 — Author `backend/.dockerignore` (AC: 6)** — create file at `backend/.dockerignore` with the exclusion list per AC-6. Order entries by category with leading comments:
  ```
  # .NET build outputs
  **/bin/
  **/obj/
  **/*.user
  **/*.lscache

  # Tests
  tests/
  **/*.Tests/
  *.Tests.csproj.lscache

  # Local config + secrets
  **/.env
  **/.env.*
  **/secrets/
  **/*.pfx
  **/*.key

  # IDE / editor
  **/.vs/
  **/.idea/
  **/.vscode/
  **/*.swp
  **/.DS_Store

  # Logs
  **/logs/
  **/*.log

  # Source-control + planning artifacts (paths relative to repo root if `..` context is ever used)
  .git/
  .github/
  _bmad-output/
  _bmad/
  docs/
  ```

- [x] **Task 3 — Author `backend/Dockerfile` (AC: 1, 2, 3, 4, 5, 8, 9, 10, 11)** — file at `backend/Dockerfile`. Reference structure:
  ```dockerfile
  # syntax=docker/dockerfile:1.7

  ARG DOTNET_SDK_TAG=10.0
  ARG DOTNET_RUNTIME_TAG=10.0

  # ---- build stage ------------------------------------------------------------
  FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build
  WORKDIR /src

  # Copy solution-level files first for layer caching on dep restore.
  COPY ["Directory.Build.props", "Directory.Packages.props", "global.json", "./"]

  # Copy .csproj files only (not source) so dotnet restore caches across source edits.
  COPY ["src/IabConnect.Api/IabConnect.Api.csproj",                        "src/IabConnect.Api/"]
  COPY ["src/IabConnect.Application/IabConnect.Application.csproj",       "src/IabConnect.Application/"]
  COPY ["src/IabConnect.Domain/IabConnect.Domain.csproj",                 "src/IabConnect.Domain/"]
  COPY ["src/IabConnect.Infrastructure/IabConnect.Infrastructure.csproj", "src/IabConnect.Infrastructure/"]
  RUN dotnet restore "src/IabConnect.Api/IabConnect.Api.csproj"

  # Copy full source and publish.
  COPY src/ src/
  RUN dotnet publish "src/IabConnect.Api/IabConnect.Api.csproj" \
        -c Release \
        -o /app/publish \
        /p:UseAppHost=false \
        /p:PublishSingleFile=false

  # ---- runtime stage ----------------------------------------------------------
  FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime

  ARG BUILD_SHA=unknown
  ARG BUILD_DATE=unknown
  ENV BUILD_SHA=$BUILD_SHA \
      BUILD_DATE=$BUILD_DATE \
      ASPNETCORE_URLS=http://+:8080 \
      TZ=Europe/Zurich \
      DOTNET_RUNNING_IN_CONTAINER=true \
      DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

  # OCI labels for GHCR provenance (ADR-014, ADR-009). Per-build labels (revision, created)
  # are injected at `docker buildx build --label …` time by E20-S5 CI.
  LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
        org.opencontainers.image.licenses="AGPL-3.0-or-later" \
        org.opencontainers.image.title="IAB Connect API" \
        org.opencontainers.image.description="Backend API for IAB Connect — AGPL-3.0-or-later open-source membership platform." \
        org.opencontainers.image.vendor="IAB Connect contributors"

  # Install tzdata so Europe/Zurich resolves; aspnet:10.0 Debian base does not include it.
  # All in one RUN to minimize layers; cleanup apt lists.
  RUN apt-get update \
      && apt-get install -y --no-install-recommends tzdata \
      && rm -rf /var/lib/apt/lists/* \
      && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
      && echo $TZ > /etc/timezone

  WORKDIR /app
  COPY --from=build /app/publish ./

  # Run as non-root (numeric UID for Kubernetes-style runAsNonRoot admission).
  USER 1000

  EXPOSE 8080

  ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]
  ```
  - **Note on `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false`**: this is the explicit-default for the Debian-based runtime (the env var is *true* on Alpine bases). Setting it explicitly to `false` is forward-compatibility insurance — if a future Dockerfile bump switches to Alpine, ICU breakage surfaces immediately as a "Globalization invariant mode is enabled" log line instead of silently corrupting Hangfire cron parsing.

- [x] **Task 4 — Verify ICU presence in the runtime base (AC: 3)** — confirm before build that ICU stays included by default:
  ```sh
  docker run --rm --entrypoint /bin/sh mcr.microsoft.com/dotnet/aspnet:10.0 -c "dpkg -l | grep -i icu"
  ```
  Expected: one or more rows showing `libicu72` (or similar `libicu*`). If absent, escalate — do not silently add `icu-libs` install (that would mask a base-image regression worth knowing about).

- [x] **Task 5 — Verify timezone resolution (AC: 3)** — build the image (Task 6), then:
  ```sh
  docker run --rm --entrypoint /bin/sh iabc-api:test -c 'date && cat /etc/timezone && ls -l /etc/localtime'
  ```
  Expected: `Europe/Zurich` in `/etc/timezone`; `/etc/localtime` symlinked to `/usr/share/zoneinfo/Europe/Zurich`; `date` outputs a CET or CEST timestamp (NOT UTC). Use `--entrypoint /bin/sh` because the default `ENTRYPOINT` runs `dotnet`.

- [x] **Task 6 — Build the image (AC: 12)** — from the repository root:
  ```sh
  docker build -t iabc-api:test backend/
  ```
  Expected: success in < 5 minutes on a warm Docker daemon (cold pull of sdk:10.0 + aspnet:10.0 layers takes longer). Capture in Completion Notes: total build time, `docker images iabc-api:test --format '{{.Size}}'` (≤ 350 MB), `docker history iabc-api:test --no-trunc | head -20` (layer breakdown).

- [x] **Task 7 — Runtime smoke (AC: 13)** — boot the container with no env vars:
  ```sh
  docker run --rm iabc-api:test 2>&1 | head -30
  ```
  Expected stdout (Serilog Console sink format from [Program.cs:8-11](backend/src/IabConnect.Api/Program.cs#L8-L11)):
  ```
  [HH:mm:ss INF] Starting IAB Connect API
  …
  [HH:mm:ss FTL] Application terminated unexpectedly
  System.InvalidOperationException: … (or Npgsql connection failure)
  ```
  Acceptance: the line `Starting IAB Connect API` appears BEFORE the crash. Capture the full first 30 lines verbatim in Completion Notes.

- [x] **Task 8 — Add README "Build" section note (AC: 12, documentation hygiene)** — in `README.md`, add or update a single line in the existing "Build" / "Running locally" section:
  ```
  # Backend container image (Beta-shape): docker build -t iabc-api backend/
  ```
  Keep it minimal — the full GHCR-publish flow (with BUILD_SHA / BUILD_DATE injection) is documented by E20-S5. Do not add a multi-paragraph Docker section here.

- [x] **Task 9 — Quality gates (AC: 14)** — run from repo root:
  - [x] 9.1 `dotnet build backend/IabConnect.sln` — green, 0 warnings.
  - [x] 9.2 `dotnet test backend/` — 1963/1963 green (baseline 1957 + 6 new theory rows).
  - [x] 9.3 `docker build -t iabc-api:test backend/` — green.
  - [x] 9.4 `docker run --rm iabc-api:test` — exits non-zero AFTER the bootstrap Serilog line. Confirmed in Task 7.
  - [x] 9.5 **AC-Subitem Completion Check** (project-context A29): list per-AC status in Completion Notes — AC-1..AC-14 each marked `covered / N/A / deferred` with one-line evidence pointer.

- [x] **Task 10 — Beta-shape build-arg injection (AC: 9)** — dev-agent verified (`docker build --build-arg` + `docker inspect` is non-interactive and within scope; A30 `[!]` would apply only if the verification needed real Beta Railway or browser interaction). Result:
  ```sh
  docker build --build-arg BUILD_SHA=test123abc --build-arg BUILD_DATE=2026-05-16T12:00:00Z -t iabc-api:buildargs backend/
  docker inspect iabc-api:buildargs --format '{{range .Config.Env}}{{println .}}{{end}}' | grep BUILD_
  # → BUILD_SHA=test123abc
  # → BUILD_DATE=2026-05-16T12:00:00Z
  ```

## Dev Notes

### Stack version pinning (AC: 2)

[Source: [backend/global.json](backend/global.json), [backend/Directory.Build.props](backend/Directory.Build.props), [backend/Directory.Packages.props](backend/Directory.Packages.props)]

- Backend targets **.NET 10** ([Directory.Build.props:3](backend/Directory.Build.props#L3) → `<TargetFramework>net10.0</TargetFramework>`).
- SDK is pinned to `10.0.102` with `rollForward: latestMinor` ([global.json:3-5](backend/global.json#L3-L5)) — so `sdk:10.0` (which floats latest 10.x) is fine; SDK ≥10.0.102 inside the image will satisfy `global.json`.
- All NuGet versions are centralized in [Directory.Packages.props](backend/Directory.Packages.props) (`<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>`) — the Dockerfile relies on this so `dotnet restore "src/IabConnect.Api/IabConnect.Api.csproj"` transitively restores all referenced projects in one pass.
- ASP.NET Core packages are version `10.0.2` (e.g., `Microsoft.AspNetCore.Authentication.JwtBearer 10.0.2`), Serilog.AspNetCore `10.0.0`, EF Core `10.0.2`, Npgsql.EntityFrameworkCore.PostgreSQL `10.0.0` — all aligned to the .NET-10 wave.

### Why `PublishSingleFile=false` is mandatory (AC: 1)

[Source: [backend/Directory.Build.props:12-16](backend/Directory.Build.props#L12-L16)]

The Release configuration in `Directory.Build.props` sets:
```xml
<PropertyGroup Condition="'$(Configuration)' == 'Release'">
  <PublishTrimmed>false</PublishTrimmed>
  <PublishSingleFile>true</PublishSingleFile>
  <SelfContained>false</SelfContained>
</PropertyGroup>
```
This is intentional for the "publish a portable single-file release binary" desktop / dev-shipping workflow. But in a Docker image with a framework-dependent runtime (`mcr.microsoft.com/dotnet/aspnet:10.0` already carries the framework), single-file publish:
1. Produces a single executable `IabConnect.Api` (no `.dll`), incompatible with `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]`.
2. Or, if combined with `/p:UseAppHost=false`, MSBuild emits warning `NETSDK1153` and the publish output shape is undefined.

Solution: explicitly override `PublishSingleFile=false` in the publish command line. This wins over the property-group default. `/p:UseAppHost=false` then cleanly produces `IabConnect.Api.dll` + its dependencies, runnable by the framework `dotnet` host.

### Why two stages (not one)

Single-stage Docker builds with the SDK image ship the entire .NET SDK (~750 MB), the build cache, and possibly source code. Multi-stage with `aspnet:10.0` runtime cuts the published image to ~260 MB and excludes the SDK + source. Standard .NET-on-Docker practice and matches [Microsoft's "Containerize an app" docs](https://learn.microsoft.com/aspnet/core/host-and-deploy/docker).

### Why `Europe/Zurich` and tzdata install (AC: 3)

[Source: [backend/src/IabConnect.Api/DependencyInjection.cs:361-382](backend/src/IabConnect.Api/DependencyInjection.cs#L361-L382)]

`ResolveReminderJobTimeZone` tries `Europe/Zurich` (IANA, Linux), then `W. Europe Standard Time` (Windows), then falls back to UTC. The fall-through behavior emits `LogError` (intentionally elevated from Warning per REQ-024 Round-3 review) because UTC is 1–2 hours off the intended local-time semantic, and Hangfire schedules the daily 09:00 volunteer-shift-reminder against the resolved zone. Installing tzdata on Debian-bookworm `aspnet:10.0` is mandatory because the base image (slim variant by default) does not ship tzdata.

### Why `USER 1000` (numeric, not named)

[Source: existing project conventions; OWASP container hardening; Kubernetes `runAsNonRoot` PSP/PSA evaluation]

Running as a non-root UID prevents most container-escape escalations. UID 1000 is the Linux convention for the first regular user. Using the **numeric** UID (not a named user like `app`) lets Kubernetes admission policies that require `runAsNonRoot: true` evaluate the image without resolving `/etc/passwd`. The published files are world-readable by default; `chown -R 1000:1000 /app` would add a fat layer for no benefit, so it is deliberately omitted.

### Why HTTP-only on port 8080 (AC: 5)

[Source: ADR-011, ADR-012; [backend/src/IabConnect.Api/DependencyInjection.cs:262-265](backend/src/IabConnect.Api/DependencyInjection.cs#L262-L265)]

Railway terminates TLS at its edge load-balancer; internal traffic between Railway services is HTTP. The application's own `UseHttpsRedirection()` only fires when the runtime detects HTTP **and** the env is not Development — Railway's `X-Forwarded-Proto: https` is honored by ASP.NET ForwardedHeaders middleware, so `UseHttpsRedirection()` is a no-op when reached via Railway's edge. Setting `ASPNETCORE_URLS=http://+:8080` binds explicitly to the Railway-routed port. The same wiring works for `docker-compose.full.yml` (E12-S4) where TLS terminates at Caddy / Traefik.

### Build-args propagation to `/about` (AC: 9)

[Source: ADR-021; E20-S3 spec at [epics-and-stories.md#L396-L407](_bmad-output/planning-artifacts/architecture.md#L396-L407)]

The `BUILD_SHA` and `BUILD_DATE` build-args become `ENV` in the runtime stage. Story E20-S3's `/about` endpoint reads them via `Environment.GetEnvironmentVariable("BUILD_SHA")` / `BUILD_DATE` and returns them in the JSON response per AGPL §13. CI (Story E20-S5) passes them as:
```sh
docker buildx build \
  --build-arg BUILD_SHA=${{github.sha}} \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --label org.opencontainers.image.revision=${{github.sha}} \
  --label org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -t ghcr.io/htos/iabc-api:beta \
  -t ghcr.io/htos/iabc-api:sha-${{github.sha}} \
  backend/
```
Local `docker build` without args produces an image that still runs — `/about` returns `commitSha: "unknown", buildDate: "unknown"`, which is the correct local-dev contract.

### Why ICU stays in (do not switch to Alpine)

[Source: [backend/src/IabConnect.Api/DependencyInjection.cs:367-368](backend/src/IabConnect.Api/DependencyInjection.cs#L367-L368)]

Alpine-based .NET images (`dotnet:10.0-alpine`, `aspnet:10.0-alpine`) do not ship ICU by default — .NET runs in "globalization-invariant" mode (`DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true`). The application's timezone-resolution code, AND Hangfire's string parsing for cron expressions, are locale-sensitive. The Debian-based runtime is the safer default. A future Alpine port is possible but is an optimization story, not a Beta-blocker. The Dockerfile sets `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false` explicitly (Task 3) so that a future Alpine bump fails loudly via the `System.Globalization.CultureNotFoundException` log line instead of silently misparsing cron schedules.

### `appsettings.Beta.json` carriage in the image

[Source: [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) (3 lines + structure), E11-S2 Task 7]

The Beta appsettings file is committed by E11-S2 and `dotnet publish` automatically picks it up (it's an `appsettings.*.json` in the API project root). The Dockerfile does NOT need to handle Beta-specific layering — the runtime selects based on `ASPNETCORE_ENVIRONMENT`. Contents:
```json
{
  "Serilog": { "Using": ["Serilog.Sinks.Console"], "WriteTo": [{ "Name": "Console" }] },
  "Logging": { "LogLevel": { "Default": "Information" } },
  "RetentionEnforcement": { "Enabled": false }
}
```
This locks Beta to Console-only logging (ADR-017) and suppresses retention enforcement (ADR-020).

### `rustfsadmin` disposition decision (AC: 7) — Beta-blocker resolution

[Source: Epic-11 retrospective at `_bmad-output/implementation-artifacts/epic-11-retro-2026-05-16.md`; sprint-status.yaml `last_updated` field 2026-05-16; [appsettings.json:39-40](backend/src/IabConnect.Api/appsettings.json#L39-L40)]

**Background.** Epic 11's code review surfaced that the committed [appsettings.json:39-40](backend/src/IabConnect.Api/appsettings.json#L39-L40) carries `"AccessKey": "rustfsadmin"` and `"SecretKey": "rustfsadmin"` — the local-dev RustFS credentials. While these are not real production secrets (they are the well-known RustFS default), they are credentials of a kind and they would travel inside the production image. The E11 retro deferred the resolution to E12-S1.

**Two paths were considered:**
1. **`IOptions<DocumentStorageOptions>` refactor** — formalize the configuration binding and rely on env-var overrides at deploy time. Pros: idiomatic .NET. Cons: app-code change, risk of regressing the Storage DI registration, out of scope for "first Dockerfile" story.
2. **Image-side stripping via `.dockerignore`** — exclude `appsettings.json` from the build context, ship only `appsettings.{Development,Beta}.json`. Pros: zero code change. Cons: ASP.NET requires `appsettings.json` as the base config layer; missing-file behavior at runtime is "section not found", which would break ALL configuration consumers, not just `DocumentStorage`. **Rejected.**

**Chosen path: paired JSON + class-initializer edit (a third option not initially considered).** Strip the credentials from BOTH the base `appsettings.json` (AC-7.1) AND the C# class initializers in [DocumentStorageSettings.cs:10-14](backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs#L10-L14) (AC-7.2). Replacing only the JSON values would leave the `"rustfsadmin"` strings in the compiled `IabConnect.Infrastructure.dll` IL — a `strings | grep rustfsadmin` against the published assembly would still hit. The paired edit takes the strings out at both source layers. Local-dev continues to work because [appsettings.Development.json:62-68](backend/src/IabConnect.Api/appsettings.Development.json#L62-L68) already carries the same `rustfsadmin/rustfsadmin/http://localhost:9000/iabconnect-documents/UseHttps:false` block, which the .NET binder overlays over both the (now-empty) base JSON and the (now-empty) class initializer at registration time ([DependencyInjection.cs:259-260](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L259-L260)).

**Failure mode after the edits.** The `IAmazonS3` registration at [DependencyInjection.cs:261-270](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L261-L270) is a singleton with a **lazy factory** that runs on first resolution. So missing Railway env vars do NOT crash the container at boot — the app starts, accepts traffic on `/health/live` and any non-S3-touching endpoint, and only the first document-touching request fails. This is the desired behavior: it surfaces misconfiguration as a 500 on `/api/documents/...` with a clear stack trace, rather than a boot loop that hides the cause behind generic restart-loop log noise.

**Why this is in scope for E12-S1 (not deferred to E13-S2 or post-Beta).** The story's title is "Backend Dockerfile" — and the rustfsadmin literals would ship inside that Dockerfile's published `/app/appsettings.json` AND in the published `IabConnect.Infrastructure.dll` IL. If we ship the image with the secret-shaped strings inside, E12-S1 is technically complete but materially fails AC-8 ("No other secrets in the image"). The paired edit is therefore part of the Dockerfile-completeness story, not a separate refactor. The fact that the source is AGPL-public anyway is acknowledged — but `strings *.dll | grep` is a routine container-supply-chain check that should come up empty.

**Test surface.** The existing `AppSettingsLayeringTests` (E11-S1) covers the layering invariants; if any test asserts `"AccessKey":"rustfsadmin"` against the base layer specifically, update or escalate per Task 1.4. Task 1.6 adds a `strings`-based assertion as a defense-in-depth check that catches any other source of the literal (test fixtures, alternate settings classes, doc comments embedded as resources).

### What this story does NOT do

- Does NOT publish to GHCR — that's E20-S5.
- Does NOT add the frontend Dockerfile — that's E12-S2.
- Does NOT build the custom Keycloak image — that's E12-S3.
- Does NOT add a `docker-compose.full.yml` — that's E12-S4.
- Does NOT refactor `DocumentStorageOptions` into an `IOptions<>`-bound class — that's a deliberate non-scope decision (see "rustfsadmin disposition decision" above).
- Does NOT add the `/about` endpoint — that's E20-S3. This story bakes the env vars `/about` will read.
- Does NOT set up CI build/publish — that's E20-S5.

### Project Structure Notes

**NEW files** (2):
- `backend/Dockerfile`
- `backend/.dockerignore`

**EDIT files** (3):
- `backend/src/IabConnect.Api/appsettings.json` — 5-line redaction per AC-7.1.
- `backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs` — 5-line class-initializer redaction per AC-7.2 (the only C# edit in this story).
- `README.md` — one-line build-command note per Task 8.

**Source-code change scope.** The single C# file edit ([DocumentStorageSettings.cs](backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs)) is purely a property-initializer cleanup — no behavior change (the binder always overwrote the initializers from config). No new files, no DI registration changes, no API contract changes. The change is verified via the `strings`-leak check in Task 1.6.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-1]
- [Source: _bmad-output/planning-artifacts/architecture.md#L262-L271 — ADR-011 Beta Deployment Target — Railway]
- [Source: _bmad-output/planning-artifacts/architecture.md#L272-L304 — ADR-012 Service Topology on Railway]
- [Source: _bmad-output/planning-artifacts/architecture.md#L317-L328 — ADR-014 Container Image Distribution — GHCR]
- [Source: _bmad-output/planning-artifacts/architecture.md#L329-L342 — ADR-015 Configuration and Environment Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#L353-L365 — ADR-017 Logging and Health for Container Runtimes]
- [Source: _bmad-output/planning-artifacts/architecture.md#L396-L407 — ADR-021 Source-Disclosure Mechanism (AGPL §13)]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1269-L1292 — Epic E12 Story E12-S1 spec]
- [Source: backend/global.json — SDK 10.0.102 pin]
- [Source: backend/Directory.Build.props:3 — TargetFramework net10.0]
- [Source: backend/Directory.Build.props:12-16 — Release config sets PublishSingleFile=true]
- [Source: backend/src/IabConnect.Api/Program.cs:15 — bootstrap Serilog "Starting IAB Connect API" log line]
- [Source: backend/src/IabConnect.Api/Program.cs:46-90 — MigrateAsync behavior on missing connection string (crash after bootstrap log)]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:361-382 — ResolveReminderJobTimeZone Europe/Zurich requirement]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:262-265 — UseHttpsRedirection behind ForwardedHeaders]
- [Source: backend/src/IabConnect.Api/appsettings.json:37-43 — current DocumentStorage block to be edited per AC-7]
- [Source: backend/src/IabConnect.Api/appsettings.Development.json:62-68 — Development overlay of DocumentStorage]
- [Source: backend/src/IabConnect.Api/appsettings.Beta.json — Beta overlay (Console-only Serilog + RetentionEnforcement=false)]
- [Source: project-context.md A28-A30 — Spike-First / AC-Subitem Check / Three-State Task Checkbox]
- [Source: https://learn.microsoft.com/aspnet/core/host-and-deploy/docker — Microsoft .NET on Docker official guidance]
- [Source: https://learn.microsoft.com/dotnet/core/deploying/single-file/overview — PublishSingleFile semantics]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7[1m]) via Claude Code (VS Code extension), session of 2026-05-16.

### Debug Log References

- **Spike (Task 0):** `IAmazonS3` registered as Singleton with factory lambda at [Infrastructure/DependencyInjection.cs:261-270](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L261-L270). Factory body lazy on first resolution. **However:** factory closes over `storageSettings` captured EAGERLY at registration time ([line 259-260](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L259-L260)) — this is the timing seam that breaks `WebApplicationFactory`'s `ConfigureAppConfiguration` overrides (those run during `builder.Build()` at Program.cs:34, AFTER `AddInfrastructureServices` reads `builder.Configuration` at Program.cs:32). Refined the spike outcome from the story's expected "lazy-init → safe" to "lazy at runtime, eager at test-config-override time → needs env-var injection in tests."
- **Strings-leak check (Task 1.6):** `strings src/IabConnect.Infrastructure/bin/Debug/net10.0/IabConnect.Infrastructure.dll | grep -i rustfsadmin || echo CLEAN` → `CLEAN`. Cross-checked `IabConnect.Api.dll` → CLEAN. Only `appsettings.Development.json` retains `rustfsadmin` (loads only when `ASPNETCORE_ENVIRONMENT=Development`, per AC-8).
- **Test failure investigation:** After AC-7 edits, `SettingsEndpointTests.GetLogo_NoLogoConfigured_Returns404` failed with 500 instead of 404. Root cause: minimal-API endpoint parameter binding resolves `IDocumentStorage` BEFORE the handler body runs, which triggers `IAmazonS3` factory closure → `new AmazonS3Client("", "", config)` throws. Fix: env-var injection in `TestWebApplicationFactory` static constructor (env vars are part of the default config chain that `WebApplication.CreateBuilder` sets up at line 17, so they propagate to the eager read at line 259 of `DependencyInjection.cs`). The previously-deferred cleanup noted at `AppSettingsLayeringTests.cs:57-65` is now resolved without modifying the production DI registration.
- **ICU verification (Task 4):** `docker run --rm --entrypoint /bin/sh mcr.microsoft.com/dotnet/aspnet:10.0 -c "dpkg -l | grep -i icu"` → `ii libicu74:amd64 74.2-1ubuntu3.1`. **Note:** base image is **Ubuntu 24.04**, not Debian-bookworm as the story spec wrote. Functional outcome is the same (libicu present, tzdata pre-installed). The Dockerfile's `apt-get install tzdata` is now effectively a no-op (the base layer already shipped `tzdata + tzdata-legacy`) but kept for defense-in-depth against future Microsoft base changes — added layer cost is ~14 B.
- **Timezone verification (Task 5):**
  ```
  Sat May 16 15:19:38 CEST 2026
  Europe/Zurich
  lrwxrwxrwx 1 root root 33 May 16 15:17 /etc/localtime -> /usr/share/zoneinfo/Europe/Zurich
  ```
- **Runtime smoke (Task 7):** First 10 lines of `docker run --rm iabc-api:test`:
  ```
  [15:19:54 INF] Starting IAB Connect API
  [15:19:54 INF] Environment: Production
  [15:19:54 INF] Using migrations for production
  [15:19:55 WRN] Entity 'LedgerAccount' has a global query filter ...
  [15:19:55 ERR] An error occurred using the connection to database 'iabconnect' on server 'tcp://localhost:5433'.
  [15:19:55 ERR] Failed to apply database migrations
  Npgsql.NpgsqlException ... Failed to connect to 127.0.0.1:5433
   ---> System.Net.Sockets.SocketException (111): Connection refused
  ...
  [15:19:55 FTL] Application terminated unexpectedly
  ```
  Bootstrap log appears BEFORE the crash. Environment is `Production` (the image's no-env default; Railway/E13-S2 will set `ASPNETCORE_ENVIRONMENT=Beta`).
- **Image size (Task 6):** 384 MB. Exceeds the story-spec ≤ 350 MB target by ~34 MB. Root cause: the story-spec estimated `published .NET app is ~30 MB` but the actual untrimmed framework-dependent publish (Directory.Build.props sets `<PublishTrimmed>false</PublishTrimmed>` for Release) produces 154 MB due to the substantial package profile (EF Core 10, Hangfire, Serilog, QuestPDF, MediatR, AWS S3 SDK, etc.). Trimming/AOT is out of scope (`PublishSingleFile=false` is mandated by AC-1); image size is acceptable for Beta-shape MVP and meaningful reduction would be a separate optimization story.
- **Build-arg injection (Task 10):** verified via `docker build --build-arg BUILD_SHA=test123abc --build-arg BUILD_DATE=2026-05-16T12:00:00Z` + `docker inspect ... --format '{{range .Config.Env}}{{println .}}{{end}}' | grep BUILD_` → both env vars present in image. AC-9 satisfied for the local-build path; CI-time injection (E20-S5) reuses the same args.

### Completion Notes List

**AC-Subitem Completion Check (project-context A29):**

| AC | Status | Evidence |
| -- | ------ | -------- |
| AC-1 (Dockerfile two stages, PublishSingleFile=false) | covered | [backend/Dockerfile](backend/Dockerfile) — `FROM ... AS build` + `FROM ... AS runtime`; `/p:PublishSingleFile=false` on the publish RUN. |
| AC-2 (SDK/runtime tags = 10.0) | covered | [backend/Dockerfile](backend/Dockerfile) — `ARG DOTNET_SDK_TAG=10.0`, `ARG DOTNET_RUNTIME_TAG=10.0`. Build pulled `aspnet:10.0` successfully (Task 6). |
| AC-3 (tzdata install, TZ=Europe/Zurich) | covered | Task 5 verification confirms `date → CEST`, `/etc/timezone = Europe/Zurich`, symlink correct. Spec-doc deviation: base ships tzdata already, so the apt-get layer is a defense-in-depth no-op (14 B). |
| AC-4 (non-root USER 1000) | covered | [backend/Dockerfile](backend/Dockerfile) — `USER 1000` before ENTRYPOINT. |
| AC-5 (EXPOSE 8080, ASPNETCORE_URLS http only) | covered | [backend/Dockerfile](backend/Dockerfile) — `EXPOSE 8080`, `ENV ASPNETCORE_URLS=http://+:8080`. |
| AC-6 (.dockerignore) | covered | [backend/.dockerignore](backend/.dockerignore) — all 6 category groups present. |
| AC-7.1 (appsettings.json redaction) | covered | [appsettings.json:37-43](backend/src/IabConnect.Api/appsettings.json#L37-L43) edits applied; empty `ServiceUrl/AccessKey/SecretKey`, `BucketName=iabconnect-documents`, `UseHttps=true`. |
| AC-7.2 (DocumentStorageSettings.cs class-initializer redaction) | covered | [DocumentStorageSettings.cs:10-14](backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs#L10-L14) edits applied; same shape as AC-7.1. Strings-leak check on `Infrastructure.dll` → `CLEAN`. |
| AC-8 (no other secrets in image) | covered | `appsettings.json` redacted, `appsettings.Beta.json` is Console-only + retention-disabled (no secrets), `appsettings.Development.json` retains rustfsadmin but loads only on `ASPNETCORE_ENVIRONMENT=Development` — fine per AC-8 explicit allowance. No `appsettings.Production.json` exists by design. `.dockerignore` excludes `.env*`/`secrets/`/`.pfx`/`.key`. |
| AC-9 (BUILD_SHA / BUILD_DATE build-args, default `unknown`) | covered | [backend/Dockerfile](backend/Dockerfile) — `ARG BUILD_SHA=unknown` / `ARG BUILD_DATE=unknown` in runtime stage; `ENV` mirrors. Task 10 verifies injection round-trip end-to-end. |
| AC-10 (OCI labels for GHCR) | covered | [backend/Dockerfile](backend/Dockerfile) — 5 LABEL fields: source, licenses (AGPL-3.0-or-later), title, description, vendor. Per-build labels (revision, created) deferred to E20-S5 CI. |
| AC-11 (ENTRYPOINT exec-form) | covered | [backend/Dockerfile](backend/Dockerfile) — `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]`. |
| AC-12 (build success, size target) | partially covered | Build succeeded in 65s (well under 5min). Image size 384 MB — exceeds story-spec ≤ 350 MB target by ~34 MB due to untrimmed-publish reality (154 MB published app vs 30 MB story estimate). Functionally acceptable for Beta-shape; flag for reviewer. |
| AC-13 (runtime smoke — bootstrap log before crash) | covered | Task 7 captured the bootstrap log AND the expected Npgsql connection-refused crash. |
| AC-14 (quality gates) | covered | `dotnet build` 0 warnings · `dotnet test` 1963/1963 green (1957 baseline + 6 new theory rows) · `docker build` green · `docker run` exits non-zero after bootstrap log. |

**Key deviations from the story spec (for reviewer attention):**

1. **Base image is Ubuntu 24.04, not Debian-bookworm.** Microsoft moved `mcr.microsoft.com/dotnet/aspnet:10.0` to Ubuntu Noble. ICU and tzdata are now bundled in the base. Dockerfile's apt-get install is retained for defense-in-depth.
2. **Image size 384 MB > 350 MB target.** The story estimate of ~30 MB for the published app was off — actual is 154 MB because `Directory.Build.props` Release config sets `PublishTrimmed=false` and the app has a wide package surface. Trimming/AOT optimization is out of scope.
3. **Test-infrastructure fix in addition to the AC-7 source edits.** The story expected `dotnet test` to stay green with only the source edits, but `SettingsEndpointTests.GetLogo` failed because of the eager-closure timing seam at `DependencyInjection.cs:259`. Fixed via env-var injection in `TestWebApplicationFactory` static ctor + 6 new theory rows in `AppSettingsLayeringTests` to guard the AC-7 invariant going forward. The previously-deferred cleanup note at `AppSettingsLayeringTests.cs:57-65` is now resolved (test-infrastructure half).
4. **Task 10 is `[x]`, not `[!]`.** The story marked Task 10 as manual-verify on the grounds that it needs "a Beta Railway deploy or a manual env-injected docker run that the dev agent cannot interactively launch" — but the actual verification is a local `docker build --build-arg ... && docker inspect`, which IS non-interactive and within dev-agent scope per A30 (`[!]` is reserved for browser/IDE/infrastructure-stand-up steps). Verified directly.
5. **Task 1.5 is `[!]`, as expected.** Running `dotnet run` against the local `infra/docker-compose.yml` stack requires interactive stack stand-up + dev-API process — outside dev-agent non-interactive scope. The build + test suite cover the regression surface; human verifier should round-trip `/api/documents/...` against the Dev overlay before merge.

### File List

**NEW files (2):**
- `backend/Dockerfile`
- `backend/.dockerignore`

**EDIT files (5):**
- `backend/src/IabConnect.Api/appsettings.json` — AC-7.1 redaction.
- `backend/src/IabConnect.Infrastructure/Storage/DocumentStorageSettings.cs` — AC-7.2 class-initializer redaction.
- `README.md` — Option 3 (Backend container image) block under "Running the Application".
- `backend/tests/IabConnect.Api.Tests/TestWebApplicationFactory.cs` — static constructor sets `DocumentStorage__*` env vars for DI-resolution-time configuration availability.
- `backend/tests/IabConnect.Api.Tests/AppSettingsLayeringTests.cs` — class-level comment refreshed (DocumentStorage cleanup no longer deferred) + 3 new theory rows on each of two existing theories (DocumentStorage:ServiceUrl/AccessKey/SecretKey).

### Change Log

- 2026-05-16 — E12-S1 implementation complete. Backend Dockerfile (multi-stage, .NET 10, Europe/Zurich tzdata, non-root UID 1000, AGPL-3.0 OCI labels, BUILD_SHA/BUILD_DATE build-args) + `.dockerignore` created. `rustfsadmin` Beta-blocker resolved via paired edit on base `appsettings.json` and `DocumentStorageSettings.cs` class initializers — `strings` check against `Infrastructure.dll` returns CLEAN. Test-infrastructure timing seam at `DependencyInjection.cs:259` resolved by env-var injection in `TestWebApplicationFactory` static ctor (no production DI change). `AppSettingsLayeringTests` extended with 6 new theory rows asserting `DocumentStorage:ServiceUrl/AccessKey/SecretKey` are empty in base AND Beta-layered configurations. Quality gates: `dotnet build` 0 warnings, `dotnet test` 1963/1963 green (baseline 1957 + 6 new), `docker build` green (65s, 384 MB), `docker run` boots and emits bootstrap log before the expected Npgsql connection-refused crash, `docker build --build-arg` round-trips `BUILD_SHA` / `BUILD_DATE` into the runtime image env.

## Questions / Clarifications

These surfaced during context engineering and are saved here for the dev agent (and human reviewer) to either resolve in-flight or escalate before commit:

1. **Beta-shape S3 env-var verification (Task 0.2-0.3).** The DI registration site for the S3/RustFS client was not directly inspected during context engineering (would require reading `IabConnect.Infrastructure/Storage/*` and `IabConnect.Infrastructure/DependencyInjection.cs`). Task 0 covers this — if the spike turns up an eager-init pattern, the dev agent should escalate to the user with a one-liner like "Blocker found: …" rather than proceeding with the AC-7 edit blind.

2. **README "Build" section location.** The README's exact section layout was not loaded during context engineering. Task 8 says "in the existing 'Build' / 'Running locally' section" — if no such section exists, the dev agent should append a minimal `### Docker (Beta-shape)` section under the closest existing "Local development" heading, keeping it ≤ 4 lines.

3. **Image OCI source URL fork-friendliness.** The `org.opencontainers.image.source="https://github.com/htos/iab-connect"` literal is the canonical OSS repo. If at PR-review time the user prefers fork-friendly substitution (e.g., `ARG IMAGE_SOURCE=https://github.com/htos/iab-connect` + `LABEL org.opencontainers.image.source=$IMAGE_SOURCE`), it is a 3-line patch — surface this question in the PR description rather than guessing at build time.

## Review Findings (Epic-12 boundary review — 2026-05-16)

Adversarial review over the full Epic-12 diff (Blind Hunter + Edge Case Hunter + Acceptance Auditor). E12-S1-scoped slice below; cross-cutting findings shared with E12-S4 are listed there.

### Decision-Needed

- [ ] [Review][Decision] **D1 — `ASPNETCORE_ENVIRONMENT=Development` workaround root-cause lives here** [Infrastructure/DependencyInjection.cs:134] — The hardcoded `RequireHttpsMetadata = !(IsDevelopment || Testing)` forces E12-S4's overlay to use `Development` instead of `Beta`, which (a) skips `appsettings.Beta.json` (Console-only Serilog contract broken), (b) re-mounts `/swagger`, (c) loosens CORS, (d) skips HSTS. Hangfire dashboard is also re-mounted but is mitigated by Hangfire's default `LocalRequestsOnlyAuthorizationFilter` (host-bridge IP gets 403). Decision lives at E12-S4 D1; fix venue is here. Options: (a) accept + add E14-S2 follow-up to surface `Keycloak__RequireHttpsMetadata` as a config key; (b) flip the gate to `IsDevelopment || Testing || (config.GetValue<bool>("Keycloak:RequireHttpsMetadata") == false)` in this PR; (c) defer fully to E14-S2.

### Patches (pending dev-story re-entry)

- [x] [Review][Patch] **P1 (applied 2026-05-16) — Backend Dockerfile uses raw `USER 1000` instead of the base image's pre-created `app` user** [backend/Dockerfile:60-63] — `mcr.microsoft.com/dotnet/aspnet:10.0` ships with `USER $APP_UID` (defaulted to 1654) and a `chown`-ed `/app`. The current `USER 1000` runs as a UID with no `/home`, no entry in `/etc/passwd`, and `/app` is owned by `root:root` (COPY without `--chown`). ASP.NET DataProtection then falls back to ephemeral in-memory keys (cookies/antiforgery invalidate on restart), and anything that writes under `/app` (logging, temp files, QuestPDF cache) gets `EACCES`. Fix: `COPY --from=build --chown=app:app /app/publish ./` + `USER app` (or `USER $APP_UID`).

- [x] [Review][Patch] **P2 (applied 2026-05-16) — `appsettings.Development.json` ships into the published OCI image with `dev-secret-change-me`, `admin-service-secret-2026`, `rustfsadmin/rustfsadmin`, `Password=postgres` literals** [backend/.dockerignore — entry to add] — `COPY src/ src/` in the build stage copies `appsettings.Development.json` to `/app/publish/`, which lands at `/app/appsettings.Development.json` in the runtime image. At runtime (`ASPNETCORE_ENVIRONMENT=Beta`) the file is not loaded, but the literals are readable by anyone who pulls the GHCR image (public per AGPL §13). The strings-grep invariant from AC-7 only covered base `appsettings.json` + compiled IL; it missed the on-disk env-overlay file. AC-14 of E12-S3 set a "no committed secrets in image" precedent. Fix: add `**/appsettings.Development.json` to `backend/.dockerignore`. Local-dev workflow uses `dotnet run` (not the Docker image), so no developer ergonomic impact.

### Deferred (logged to deferred-work.md)

- [x] [Review][Defer] **D1' — `PublishSingleFile=false` override in Dockerfile is fragile against `Directory.Build.props` drift** [backend/Dockerfile:25-29] — works today; refactor would move the property gate to a `<DockerBuild>` MSBuild condition or to `IabConnect.Api.csproj` only.
- [x] [Review][Defer] **D2' — DocumentStorage empty defaults silently surface as runtime 500 on first document call (no boot-time fail-fast)** [Infrastructure/DependencyInjection.cs:259-270] — intended fail-mode per E12-S1 AC-8 (Railway env vars are expected). Boot guard via `IValidateOptions<DocumentStorageSettings>.ValidateOnStart()` is the obvious fix; pairs with the existing E11-S2 eager-init refactor entry in deferred-work.md.
- [x] [Review][Defer] **D3' — Dockerfile bakes no default for `ASPNETCORE_ENVIRONMENT`; missing var defaults to `Production` → HSTS + HttpsRedirection break Railway TLS-termination unless `UseForwardedHeaders` is wired** [backend/Dockerfile ENV block, line 36-41] — E13-S2 will set the env var explicitly; ForwardedHeaders is E14-S2 territory.
- [x] [Review][Defer] **D4' — `TestWebApplicationFactory` static-ctor `Environment.SetEnvironmentVariable` is process-global** [TestWebApplicationFactory.cs:27-43] — works today within the xUnit AppDomain model; a future `IAsyncLifetime`-scoped fixture (`SetVar`/`UnsetVar` in dispose) would be cleaner. Cross-test leak risk if another test class reads these keys via raw `Environment.GetEnvironmentVariable`.
- [x] [Review][Defer] **D5' — `dotnet restore` lacks BuildKit cache mount (`--mount=type=cache,target=/root/.nuget/packages`)** [backend/Dockerfile:18] — CI-speed concern; `# syntax=docker/dockerfile:1.7` is already declared so the change is one-line.
- [x] [Review][Defer] **D6' — New `DocumentStorage:*` theory rows in `AppSettingsLayeringTests` are change-detector tests, not behavioral invariants** [AppSettingsLayeringTests.cs:73-98] — they pass tautologically because the literals were just stripped. A complementary behavioral test ("loading base+Beta into a real DI container fails fast if `DocumentStorage:AccessKey` is empty") would close the invariant — gated on the `IValidateOptions` refactor above.
- [x] [Review][Defer] **D7' — Image size 384 MB vs AC-12 target ≤ 350 MB** [story AC-12, build evidence in Completion Notes] — justified deviation (`PublishTrimmed=false` is project-wide; wide package profile). Reviewer explicit accept-or-fix needed; recommend accept-with-followup to evaluate trimming/AOT in a dedicated story.
- [x] [Review][Defer] **D8' — AC-2 spec says Debian-bookworm base; Microsoft moved `aspnet:10.0` to Ubuntu Noble** [story AC-2, backend/Dockerfile:7,32] — outside dev-agent control; AC-3 timezone-resolution outcome is preserved. Spec text fix in retrospective.
