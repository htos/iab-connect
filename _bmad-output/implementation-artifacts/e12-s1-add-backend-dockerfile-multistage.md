# Story 12.1: Add Backend Dockerfile (Multi-Stage)

Status: ready

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the CI pipeline (GitHub Actions) and self-hosters**,
I want **a reproducible, multi-stage Docker image for the .NET backend**,
so that **Railway and any forker can pull or build identical artifacts that boot reliably with the correct timezone, security posture, and `/about`-compatible build metadata**.

**Requirement:** REQ-088 AC-1 (deployable via published, versioned Docker images). Epic E12 (Dockerization), Story 1 of 4 — the **first deployable** of E12. E12-S2 (frontend Dockerfile), E12-S3 (Keycloak custom image), E12-S4 (full-stack local compose) build on the patterns established here. E20-S3 (`/about` endpoint) and E20-S5 (GHCR publishing) consume the `BUILD_SHA` / `BUILD_DATE` build-args this story introduces.

## Acceptance Criteria

1. **`backend/Dockerfile` exists** with two clearly named stages: `build` (based on `mcr.microsoft.com/dotnet/sdk:9.0`) and `runtime` (based on `mcr.microsoft.com/dotnet/aspnet:9.0`). The build stage runs `dotnet restore` against `src/IabConnect.Api/IabConnect.Api.csproj` and its referenced projects, then `dotnet publish -c Release -o /app/publish /p:UseAppHost=false`.
2. **Runtime stage TZ + ICU.** The runtime stage installs `tzdata` and sets `ENV TZ=Europe/Zurich`. This is mandatory: `backend/src/IabConnect.Api/DependencyInjection.cs:361` (`ResolveReminderJobTimeZone`) explicitly logs an error and falls back to UTC if `Europe/Zurich` is unresolvable, which corrupts the daily 09:00 volunteer-shift-reminder schedule (REQ-024). ICU comes pre-installed in the official `aspnet:9.0` Debian-based image; the story verifies but does not need to install.
3. **Non-root user.** The runtime stage switches to `USER 1000` before `ENTRYPOINT`. The published files are owned by uid 1000 or are world-readable so they're loadable by the runtime user.
4. **Port and ASPNETCORE_URLS.** The runtime stage `EXPOSE 8080` and `ENV ASPNETCORE_URLS=http://+:8080`. The image must NOT default to port 80 or to HTTPS — Railway terminates TLS at the edge and forwards HTTP internally.
5. **`backend/.dockerignore`.** A new `.dockerignore` excludes at minimum: `bin/`, `obj/`, `logs/`, `tests/`, `**/*.user`, `**/.env`, `**/.env.local`, `**/.vs/`, `**/.idea/`, `**/IabConnect.Api.csproj.lscache`. This keeps the build context small and prevents tester-machine artifacts from leaking into images.
6. **No secrets in the image.** The runtime stage contains `appsettings.json`, `appsettings.Development.json`, `appsettings.Beta.json` (the last two carry Dev/Beta non-sensitive defaults only). No `appsettings.Production.json` is copied (it does not exist by design — Production reads everything from environment). No `.env` files are copied.
7. **Build-args `BUILD_SHA` and `BUILD_DATE`.** The Dockerfile declares `ARG BUILD_SHA=unknown` and `ARG BUILD_DATE=unknown` in the runtime stage, then `ENV BUILD_SHA=$BUILD_SHA` and `ENV BUILD_DATE=$BUILD_DATE` so the values are available at runtime for the `/about` endpoint (Story E20-S3). Both are optional (default `unknown` so a local `docker build` without args still produces a runnable image).
8. **`ENTRYPOINT`.** The runtime stage ends with `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]`. No `CMD` is needed.
9. **Build success.** `docker build -t iabc-api:test backend/` from the repo root completes successfully. The resulting image size is ≤ 350 MB (the aspnet:9.0 base is ~210 MB; the published .NET app is ~30 MB; with tzdata and the runtime cache, ≤ 350 MB is the realistic target).
10. **Runtime smoke.** `docker run --rm iabc-api:test` (with no connection string supplied) logs the bootstrap Serilog "Starting IAB Connect API" line, attempts to apply migrations, and exits with an error message that mentions the missing connection string — but does NOT crash with a generic stack trace and does NOT enter a restart loop. (The exit is acceptable; the goal is to verify the image boots far enough to read configuration.)

## Tasks / Subtasks

- [ ] **Task 1 — Author `backend/.dockerignore` (AC: 5)** — file at `backend/.dockerignore` with the exclusion list per AC-5. Group entries by category with a leading `# .NET build outputs` / `# IDE` / `# Local config` / `# Tests` comment.
- [ ] **Task 2 — Author `backend/Dockerfile` (AC: 1, 2, 3, 4, 6, 7, 8)** — file at `backend/Dockerfile`. Structure:
  ```dockerfile
  # syntax=docker/dockerfile:1.7

  ARG DOTNET_SDK_TAG=9.0
  ARG DOTNET_RUNTIME_TAG=9.0

  FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_SDK_TAG} AS build
  WORKDIR /src

  # Copy solution-level files for layer caching on dep restore
  COPY ["Directory.Build.props", "Directory.Packages.props", "global.json", "./"]
  COPY ["src/IabConnect.Api/IabConnect.Api.csproj",          "src/IabConnect.Api/"]
  COPY ["src/IabConnect.Application/IabConnect.Application.csproj", "src/IabConnect.Application/"]
  COPY ["src/IabConnect.Domain/IabConnect.Domain.csproj",    "src/IabConnect.Domain/"]
  COPY ["src/IabConnect.Infrastructure/IabConnect.Infrastructure.csproj", "src/IabConnect.Infrastructure/"]
  RUN dotnet restore "src/IabConnect.Api/IabConnect.Api.csproj"

  # Copy source and publish
  COPY src/ src/
  RUN dotnet publish "src/IabConnect.Api/IabConnect.Api.csproj" \
        -c Release \
        -o /app/publish \
        /p:UseAppHost=false

  FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_RUNTIME_TAG} AS runtime

  ARG BUILD_SHA=unknown
  ARG BUILD_DATE=unknown
  ENV BUILD_SHA=$BUILD_SHA \
      BUILD_DATE=$BUILD_DATE \
      ASPNETCORE_URLS=http://+:8080 \
      TZ=Europe/Zurich

  # OCI image labels (Story E20-S5 GHCR publishing also overrides these via --label)
  LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
        org.opencontainers.image.licenses="AGPL-3.0-or-later" \
        org.opencontainers.image.title="IAB Connect API" \
        org.opencontainers.image.description="Backend API for IAB Connect, AGPL-3.0-or-later."

  # Install tzdata so Europe/Zurich resolves; aspnet:9.0 Debian base does not include it by default.
  RUN apt-get update \
      && apt-get install -y --no-install-recommends tzdata \
      && rm -rf /var/lib/apt/lists/* \
      && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
      && echo $TZ > /etc/timezone

  WORKDIR /app
  COPY --from=build /app/publish ./

  # Run as non-root
  USER 1000

  EXPOSE 8080

  ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]
  ```
- [ ] **Task 3 — Verify ICU presence (AC: 2)** — `docker run --rm --entrypoint /bin/sh mcr.microsoft.com/dotnet/aspnet:9.0 -c "dpkg -l | grep -i icu"` returns at least one `icu-libs` or `libicu*` row. (If a future .NET-Alpine base is adopted, ICU must be explicitly installed — out of scope here.)
- [ ] **Task 4 — Verify timezone resolution at boot (AC: 2)** — build the image; `docker run --rm iabc-api:test sh -c 'date && cat /etc/timezone'` shows Europe/Zurich and a CET/CEST timestamp. (Note: the `sh` line uses the SDK image, not the runtime image which has no shell entrypoint — to test the runtime image's TZ specifically, attach to a running container with the connection string supplied so it stays up: `docker run -e ConnectionStrings__DefaultConnection=… iabc-api:test`, then `docker exec` for shell access.)
- [ ] **Task 5 — Verify image size and contents (AC: 6, 9)** — `docker history iabc-api:test --no-trunc | head -20` shows the layer-wise size; the final image is ≤ 350 MB. `docker run --rm --entrypoint /bin/sh iabc-api:test -c "ls -la /app/appsettings*.json"` does not require shell, so use a debug variant: `docker image inspect iabc-api:test | jq '.[].RootFS.Layers | length'` to confirm layer count is reasonable (≤ 8 typical for this pattern).
- [ ] **Task 6 — Runtime smoke test (AC: 10)** — `docker run --rm iabc-api:test` with no `ConnectionStrings__DefaultConnection` supplied. Expected log lines: `Starting IAB Connect API`, then either a configuration-missing error or an EF Core connection attempt failure. The container exits non-zero. Acceptance is that bootstrap Serilog fires and the configuration system reads at least once — not that the app fully starts (which requires DB).
- [ ] **Task 7 — Add `backend/Dockerfile.dockerignore` note in README (AC: 5)** — a one-line mention in the existing README "Build" section: `# Backend container image: docker build -t iabc-api backend/`. Keep it minimal; the full build flow (with BUILD_SHA injection) is documented by Story E20-S5.
- [ ] **Task 8 — Quality gate (AC: 9, 10)** — `docker build -t iabc-api:test backend/` succeeds locally; `docker run --rm iabc-api:test` exits with the expected non-crash behavior.

## Dev Notes

### Stack version pinning

[Source: `backend/global.json`, `backend/Directory.Build.props`, `_bmad-output/planning-artifacts/architecture.md` System Context section]

- Backend targets .NET 9 (confirmed by `mcr.microsoft.com/dotnet/sdk:9.0` and `aspnet:9.0`). Architecture.md mentions ASP.NET Core 10 — verify the actual target framework before pinning the SDK tag, and update the `ARG DOTNET_SDK_TAG` default if needed.
- `Directory.Packages.props` centralizes NuGet versions (Central Package Management). The Dockerfile relies on this — `dotnet restore` reads it once for all referenced projects.

### Why two stages, not one

Single-stage Docker builds with the SDK image ship the entire .NET SDK (~750 MB), the build cache, and possibly source code. Multi-stage with `aspnet:9.0` runtime cuts the published image to ~260 MB and excludes the SDK + source. This is standard .NET-on-Docker practice and matches Microsoft's "Containerize an app" docs.

### Why `Europe/Zurich` and tzdata install

[Source: `backend/src/IabConnect.Api/DependencyInjection.cs:361–382`]

`ResolveReminderJobTimeZone` tries `Europe/Zurich`, then `W. Europe Standard Time`, then UTC. The fall-through behavior emits `LogError` (intentionally elevated from Warning per REQ-024 Round-3 review) because UTC is a 1–2-hour off the intended local-time semantic. Installing tzdata is mandatory to keep `Europe/Zurich` resolvable on the Debian-based aspnet:9.0 base, which does not pull tzdata by default.

### Why `USER 1000` and not a named user

[Source: existing project conventions; OWASP container hardening guidance]

Running as a non-root UID prevents most container-escape escalations. UID 1000 is a Linux convention for the first regular user. Numeric UID (not username) lets Kubernetes admission policies that require `runAsNonRoot: true` evaluate the image without resolving the passwd file.

### Why HTTP-only on port 8080

[Source: ADR-012 (planned)]

Railway terminates TLS at its edge load-balancer; internal traffic between Railway services is HTTP. The application's own HTTPS-redirect (`backend/src/IabConnect.Api/DependencyInjection.cs:262–265`) only fires when the runtime detects HTTP and the env is not Development — Railway's `X-Forwarded-Proto: https` is honored by ASP.NET, so `UseHttpsRedirection()` is a no-op when reached via Railway's edge. Set `ASPNETCORE_URLS=http://+:8080` to bind explicitly to the Railway-routed port.

### Build-args propagation to `/about`

[Source: ADR-021 (planned), Story E20-S3]

The `BUILD_SHA` and `BUILD_DATE` build-args become `ENV` in the runtime stage. Story E20-S3's `/about` endpoint reads them via `Environment.GetEnvironmentVariable("BUILD_SHA")` / `BUILD_DATE`. CI (Story E20-S5) passes them as `docker buildx build --build-arg BUILD_SHA=${{github.sha}} --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) …`. Local `docker build` without args produces an image that still runs — `/about` will return `commitSha: "unknown"`, which is the correct local-dev behavior.

### Why ICU stays in (do not switch to Alpine)

[Source: `backend/src/IabConnect.Api/DependencyInjection.cs:367–368` reference to .NET ICU]

Alpine-based .NET images use `dotnet:9.0-alpine` and `aspnet:9.0-alpine`. They do not ship ICU by default — `dotnet` runs in "globalization-invariant" mode unless `icu-libs` is installed. The application's timezone-resolution code falls back the wrong way without ICU, AND `Hangfire`'s string parsing for cron expressions is locale-sensitive. The Debian-based runtime is the safer default. A future Alpine port is possible but is an optimization story, not a Beta-blocker.

### `appsettings.Beta.json` carriage

[Source: Story E11-S1 Task 7]

The Beta appsettings file is committed in E11-S1; this story's `dotnet publish` step picks it up automatically (it's inside `src/IabConnect.Api/`). The Dockerfile does NOT need to handle Beta-specific layering — the runtime selects based on `ASPNETCORE_ENVIRONMENT`.

### What this story does NOT do

- Does NOT publish to GHCR — that's E20-S5.
- Does NOT add the frontend Dockerfile — that's E12-S2.
- Does NOT build the custom Keycloak image — that's E12-S3.
- Does NOT add a `docker-compose.full.yml` — that's E12-S4.
- Does NOT modify any application source code — only `backend/Dockerfile` and `backend/.dockerignore` are new artifacts in this story.

### Project Structure Notes

NEW files: `backend/Dockerfile`, `backend/.dockerignore`.
EDIT files: `README.md` (one-line build-command note).
No code changes in `backend/src/`.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-1]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-012 Service Topology]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-021 Source-Disclosure Mechanism]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E12 Story E12-S1]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:361–382 — ResolveReminderJobTimeZone Europe/Zurich requirement]
- [Source: backend/src/IabConnect.Api/Program.cs — bootstrap sequence and migration behavior]
- [Source: https://learn.microsoft.com/aspnet/core/host-and-deploy/docker — Microsoft .NET on Docker official guidance]
