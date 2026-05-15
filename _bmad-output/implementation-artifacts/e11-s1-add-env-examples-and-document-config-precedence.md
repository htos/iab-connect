# Story 11.1: Add `.env.example` Files and Document Configuration Precedence

Status: ready

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a new developer or self-hoster of IAB Connect**,
I want **complete `.env.example` files for backend and frontend with a clear precedence story**,
so that **I can configure local, Beta, and Production deployments from one source of truth without reading the application code**.

**Requirement:** REQ-088 AC-4 (no secrets in repo/image). Epic E11 (Environment and Configuration Management for Beta), Story 1 of 3 — the **foundation** of E11. E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta`) and E11-S3 (`next.config.ts` env-driven) extend the configuration surface this story establishes.

## Acceptance Criteria

1. **`backend/.env.example`.** A new file at `backend/.env.example` lists every environment variable consumed by the backend with: variable name, a `# Required | Optional | Dev-only` annotation, and a one-line comment explaining purpose. The required-set covers `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `ConnectionStrings__DefaultConnection`, `Keycloak__Authority`, `Keycloak__ClientId`, `Keycloak__ClientSecret`, `Frontend__BaseUrl`, `Auth__CalendarTokenPepper`. The optional-set covers `DocumentStorage__ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName`/`UseHttps`, `Smtp__Host`/`Port`/`EnableSsl`/`Username`/`Password`/`FromEmail`/`FromName`, `Branding__ApiTitle`/`ApiDescription`/`SourceUrl`, `Database__AutoMigrate`, `RetentionEnforcement__Enabled`, `Backup__EncryptionKey`. No real secret values; placeholders use `__set_in_environment__` (or `__min_32_chars__`-style) — never a token-shaped string.
2. **`frontend/.env.example` updated.** The existing `frontend/.env.example` is extended to include `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL` alongside the already-present `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`. Every entry carries a `# Required | Optional | Dev-only` annotation. `NEXT_PUBLIC_*` entries carry an extra `# build-time-constant` note where applicable.
3. **`.gitignore` verified.** The repo root `.gitignore` already excludes `node_modules/` and `logs/`. AC-3 requires it to also explicitly cover `**/.env`, `**/.env.local`, `**/.env.*.local`, and `backend/**/appsettings.*.Local.json`. If any of those are missing, this story adds them.
4. **README "Configuration precedence" section.** `README.md` contains a new top-level section titled "Configuration precedence" that documents: backend reads `appsettings.json` < `appsettings.{Env}.json` < environment variables (the `__` double-underscore syntax for nested keys); frontend reads `.env` < `.env.local` < runtime environment. The section also explicitly states that `NEXT_PUBLIC_*` variables are baked into the build at `next build` time and cannot be changed at runtime — any URL change requires a frontend rebuild.
5. **No hardcoded localhost outside Dev settings.** A `grep` / `rg` audit covering `backend/src/`, `frontend/src/`, `frontend/next.config.ts` for the patterns `localhost`, `127\.0\.0\.1`, `5433`, `9000`, `rustfsadmin`, `iabconnect-documents` reports **zero hits** outside `appsettings.Development.json`, dev docker-compose, the existing Dev-CORS-allowlist in `DependencyInjection.cs:99–103`, and test code (`backend/tests/**`, `frontend/e2e/**`, `frontend/src/**/*.test.*`). Any hit found is either (a) refactored to consume a config variable, or (b) explicitly documented in the story Dev-Notes as accepted Dev-only with rationale.
6. **`appsettings.Beta.json` skeleton (informational only).** A placeholder `backend/src/IabConnect.Api/appsettings.Beta.json` is committed with the minimum keys needed to differentiate Beta from Production behavior: `Serilog:WriteTo` array containing only the Console sink, `RetentionEnforcement:Enabled = false`. **No** Beta-specific connection strings, Keycloak URLs, or secrets — those come exclusively from environment variables. Story E11-S2 owns the full Beta-specific shaping; this story only commits the file to make the dependency edge visible.
7. **Quality gate.** `dotnet build` from `backend/` stays green; `npm run lint` and `npm run build` from `frontend/` stay green. No new test failures.

## Tasks / Subtasks

- [ ] **Task 1 — Audit current config consumption (AC: 1, 2, 5)** — run `rg -n "Configuration\[" backend/src/ | rg -v "/bin/|/obj/"` and `rg -n "process\.env\." frontend/src/` to enumerate every config key actually read. Cross-check against `backend/src/IabConnect.Api/appsettings.json`. Build a single comprehensive list (this becomes the source for AC-1 and AC-2). **Decision-point:** If a key is consumed in code but absent from `appsettings.json`, decide whether it's a dev-only convenience (Dev-only annotation) or a missing default (add to `appsettings.json` with sensible Dev value first).
- [ ] **Task 2 — Author `backend/.env.example` (AC: 1)** — create the file. Order: Application section (`ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`), Database section (`ConnectionStrings__DefaultConnection`, `Database__AutoMigrate`), Identity section (`Keycloak__*`, `Auth__CalendarTokenPepper`), Frontend wiring (`Frontend__BaseUrl`), Storage section (`DocumentStorage__*`), Mail section (`Smtp__*`), Branding section (`Branding__*`), Operations section (`RetentionEnforcement__Enabled`, `Backup__EncryptionKey`). Each entry: `# {Required|Optional|Dev-only}: <one-line purpose>` then `KEY=<placeholder>`.
- [ ] **Task 3 — Extend `frontend/.env.example` (AC: 2)** — open `frontend/.env.example`; preserve existing entries; add the three new `NEXT_PUBLIC_*` entries, each with build-time-constant annotation; add inline annotations to the existing entries to match the same `# Required|Optional|Dev-only` style. Keep comments concise — Next.js' `.env.example` convention is single-line comments above each entry.
- [ ] **Task 4 — Verify `.gitignore` coverage (AC: 3)** — `cat .gitignore | rg "\.env"` should show entries that match `.env`, `.env.local`, `.env.*.local`. If missing, append them under a `# Local env files (never commit)` section. Also add `backend/**/appsettings.*.Local.json` (an established .NET convention for local overrides that some devs may use).
- [ ] **Task 5 — Add `README.md` "Configuration precedence" section (AC: 4)** — locate a sensible insertion point in the existing README (likely after the "Quickstart" / "Getting Started" section, before any deployment-specific section). Author 30–60 lines covering: (a) overview ("Configuration is environment-variable-driven; the `.env.example` files in `backend/` and `frontend/` are the canonical lists"), (b) backend precedence diagram, (c) backend nested-key syntax with the `Keycloak__ClientSecret=…` worked example, (d) frontend precedence diagram, (e) build-time vs. runtime variables in Next.js with the worked example (changing `NEXT_PUBLIC_API_URL` requires a rebuild), (f) link to Sprint Change Proposal 2026-05-15 for the rationale.
- [ ] **Task 6 — Hardcoded-host audit and refactor (AC: 5)** — run the grep patterns from AC-5. **For `frontend/next.config.ts:14–15` and `:20–28`** — Story E11-S3 takes ownership of refactoring `next.config.ts` to be env-driven; this story merely surfaces the dependency and ensures the audit acknowledges it. **For `backend/src/IabConnect.Api/DependencyInjection.cs:99–103`** — the dev-only CORS allowlist already gates on `IsDevelopment() || envName == "Testing"`; this is acceptable Dev-only behavior, document in story Dev-Notes. **For any other hit** — either refactor to consume a config variable in this story or open a follow-up.
- [ ] **Task 7 — Commit `appsettings.Beta.json` skeleton (AC: 6)** — create `backend/src/IabConnect.Api/appsettings.Beta.json` with the two keys per AC-6. Verify it is picked up by `dotnet run --launch-profile=https` when `ASPNETCORE_ENVIRONMENT=Beta` is set (it is — .NET config builder auto-discovers `appsettings.{Env}.json`).
- [ ] **Task 8 — Quality gates (AC: 7)** — `dotnet build` from `backend/`; `npm run lint && npm run build` from `frontend/`. All green.

## Dev Notes

### Configuration surface map

The current backend configuration is read across multiple files. Keys discovered by the audit (Task 1) form the AC-1 source. Where to find them:

- `backend/src/IabConnect.Api/Program.cs` — Serilog bootstrap, host configuration.
- `backend/src/IabConnect.Api/DependencyInjection.cs:90` — `Frontend:BaseUrl` (CORS).
- `backend/src/IabConnect.Api/DependencyInjection.cs:121–124` — `Keycloak:Authority/ClientId`.
- `backend/src/IabConnect.Api/appsettings.json` — full settings catalog; everything here is a candidate for `.env.example` overrides via the `__` double-underscore convention.
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` — Smtp/`Hangfire`/`DocumentStorage` config sections.

The frontend configuration surface is small:

- `frontend/next.config.ts:14–28` — currently hardcoded; refactored by E11-S3.
- `frontend/.env.example` — current entries: `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`.

### Why `__` and not `:` in environment variables

.NET configuration uses `:` as the nested-key separator inside `appsettings.json` (`Keycloak:ClientSecret`), but POSIX-compatible shells do not allow `:` in environment-variable names. .NET respects the `__` double-underscore as an alias for `:` when reading from environment. Always document the env-var form as `Keycloak__ClientSecret` — the README's worked example should make this explicit. Source: Microsoft docs "Configuration providers — environment variables".

### Placeholder format

`.env.example` is checked into a public repo. Placeholders must not pattern-match real credentials or token shapes:

- ❌ `Keycloak__ClientSecret=xxxx-xxxx-xxxx` (looks like a UUID/secret)
- ❌ `Auth__CalendarTokenPepper=changeme123` (looks like a real password)
- ✅ `Keycloak__ClientSecret=__set_in_environment__`
- ✅ `Auth__CalendarTokenPepper=__set_in_environment_min_32_chars__`

This matters because automated secret scanners (GitHub's built-in, TruffleHog) match on patterns — a token-shaped placeholder triggers false positives that erode signal.

### Beta-specific files vs. environment variables

A common confusion: `appsettings.Beta.json` is committed and visible to anyone with repo access; it must therefore contain **only** non-sensitive defaults. Anything secret (connection strings, client secrets, encryption keys) must be supplied by the environment at runtime. The two keys in AC-6 — `Serilog:WriteTo` array (Console-only) and `RetentionEnforcement:Enabled=false` — are non-sensitive operational toggles, safe to commit.

### Where `RetentionEnforcement:Enabled` is consumed

The flag is introduced by SCP-2026-05-15 ADR-020 and consumed in `backend/src/IabConnect.Api/DependencyInjection.cs:298–302` (the existing `jobManager.AddOrUpdate<RetentionEnforcementJob>(...)` line). The consumption refactor is Story E11-S2's responsibility — this story (E11-S1) only documents the variable in `.env.example` and commits the `appsettings.Beta.json` default of `false`.

### `Database__AutoMigrate` similar pattern

The flag is also introduced by SCP-2026-05-15 (Section 5 Epic E15 Story E15-S2). It must appear in `.env.example` (Optional, default `true`) so a Production-Hoster can flip it. Code consumption is E15-S2's scope; the documentation is this story's scope.

### Architecture and project constraints

- Single-tenant configuration story — no per-tenant overlays. [Source: architecture.md ADR-007]
- Configuration consumed via `IConfiguration` injection in DI and via `Microsoft.Extensions.Options` patterns where settings are POCOs. New keys should use the existing pattern; do not introduce a parallel configuration mechanism. [Source: project-context.md]
- Frontend uses `next-intl` and `process.env.NEXT_PUBLIC_*`. The `NEXT_PUBLIC_` prefix is the Next.js contract for "expose to the browser". Anything sensitive must NOT carry the `NEXT_PUBLIC_` prefix. [Source: existing frontend code patterns]

### Project Structure Notes

NEW files: `backend/.env.example`, `backend/src/IabConnect.Api/appsettings.Beta.json`.
EDIT files: `frontend/.env.example`, `.gitignore` (if needed), `README.md`.
No code changes to `backend/src/**/*.cs` or `frontend/src/**/*.tsx` in this story (E11-S2 and E11-S3 own the code touches).

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-4]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-015 Configuration and Environment Strategy]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-020 Beta-Mode Job Suppression]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E11 Stories E11-S1, E11-S2, E11-S3]
- [Source: backend/src/IabConnect.Api/appsettings.json — current backend configuration surface]
- [Source: frontend/.env.example — current frontend configuration surface]
