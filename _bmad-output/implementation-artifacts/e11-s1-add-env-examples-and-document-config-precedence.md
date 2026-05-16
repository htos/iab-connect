# Story 11.1: Add `.env.example` Files and Document Configuration Precedence

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a new developer or self-hoster of IAB Connect**,
I want **complete `.env.example` files for backend and frontend with a clear documented precedence story**,
so that **I can configure local, Beta, and Production deployments from one source of truth without reading the application code**.

**Requirement:** REQ-088 AC-4 (no secrets in repo/image). Epic E11 (Environment and Configuration Management for Beta), Story 1 of 3 — the **foundation** of E11. E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta` + `appsettings.Beta.json` operational defaults) and E11-S3 (`next.config.ts` env-driven) extend the configuration surface this story establishes. The two `.env.example` files this story commits become the source-of-truth for the Docker build-args wired in E12-S1/E12-S2 and the Railway environment variables provisioned in E13-S2.

## Acceptance Criteria

1. **`backend/.env.example` exists at `backend/.env.example` (new file).** Lists every environment variable consumed by the backend with: variable name, `# Required | Optional | Dev-only` annotation on the line above, and a single-line comment explaining purpose. Required set covers: `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `ConnectionStrings__DefaultConnection`, `Keycloak__Authority`, `Keycloak__ClientId`, `Keycloak__ClientSecret`, `Frontend__BaseUrl`, `Auth__CalendarTokenPepper`. Optional set covers: `DocumentStorage__ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName`/`UseHttps`, `KeycloakAdmin__BaseUrl`/`Realm`/`ClientId`/`ClientSecret`, `Smtp__Host`/`Port`/`EnableSsl`/`Username`/`Password`/`FromEmail`/`FromName`, `Branding__ApiTitle`/`ApiDescription`/`SourceUrl`, `Database__AutoMigrate`, `RetentionEnforcement__Enabled`, `Backup__EncryptionKey`, `Features__EInvoiceExport`, `InvoiceSettings__OrganizationName`/`OrganizationAddress`/`OrganizationEmail`/`PaymentInstructions`/`Currency`/`DefaultPaymentTermDays`. No real secret values; placeholders use `__set_in_environment__` (or `__min_32_chars__`-style annotated placeholders for length-sensitive secrets) — never a token-shaped string that would trip GitHub's secret scanner or TruffleHog.
2. **`frontend/.env.example` is extended (existing file edit).** Current entries at `frontend/.env.example:1-14` are `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`. Add three new build-time entries: `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`. Replace token-shaped placeholders (`your-nextauth-secret-here`, `your-keycloak-client-secret`) with `__set_in_environment__`-style placeholders. Every entry carries a `# Required | Optional | Dev-only` annotation; `NEXT_PUBLIC_*` entries additionally carry `# build-time-constant — rebuild required after change` because Next.js bakes `NEXT_PUBLIC_*` into the static bundle at `next build` time.
3. **`.gitignore` coverage verified and tightened.** Current `.gitignore:55-58` already covers `.env`, `.env.*` with a `!.env.example` whitelist (these patterns are unanchored, so they match `frontend/.env`, `backend/.env`, `.env.local`, `.env.beta.local`, etc.). AC-3 adds: an explicit `backend/**/appsettings.*.Local.json` rule (established .NET local-override convention — currently uncovered), placed in a new `# .NET local-override files (never commit)` section adjacent to the dotenv section. Confirm by running `git check-ignore -v backend/src/IabConnect.Api/appsettings.Production.Local.json` after the edit — must report a match against the new rule.
4. **README "Configuration" subsection rewritten in place at `README.md:257-298`.** The existing "Configuration" subsection under "Getting Started" currently shows OUTDATED examples (Keycloak fields use `ServerUrl`/`Realm`/`Audience`/`AdminClient` while the actual file uses `Authority`/`ClientId`/`ClientSecret`; Email fields use `SmtpHost`/`SmtpPort` while the actual file uses `Smtp.Host`/`Port`; frontend env shows `NEXT_PUBLIC_KEYCLOAK_*` vars that do not exist). Replace the entire subsection (between the `### Configuration` heading at line 257 and the next `### Running the Application` heading at line 300) with a fresh accurate version covering: (a) backend precedence `appsettings.json` < `appsettings.{Env}.json` < environment variables (using `__` for nested keys), (b) frontend precedence `.env` < `.env.local` < runtime environment, (c) explicit Next.js build-time-constant rule for `NEXT_PUBLIC_*`, (d) a worked example showing the `Keycloak__ClientSecret=__set_in_environment__` translation to `appsettings.json`'s `Keycloak:ClientSecret`, (e) a pointer to `backend/.env.example` and `frontend/.env.example` as the canonical lists, (f) reference to ADR-015 in `_bmad-output/planning-artifacts/architecture.md`. Aim for 50–70 lines. Do NOT touch the README license section at `README.md:856-862` — that is E20-S1's scope.
5. **No NEW hardcoded localhost references outside Dev-acceptable locations.** Run `rg -n "localhost|127\.0\.0\.1|5433|9000|rustfsadmin|iabconnect-documents" backend/src/ frontend/src/ frontend/next.config.ts` and triage every hit. Acceptable Dev-only locations: (a) `backend/src/IabConnect.Api/appsettings.Development.json`, (b) the dev-only CORS allowlist in `backend/src/IabConnect.Api/DependencyInjection.cs:96-104` (gated by `IsDevelopment() || envName == "Testing"`), (c) test code under `backend/tests/**` and `frontend/e2e/**` and `frontend/src/**/*.test.*`, (d) inline fallbacks of the form `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"` in frontend client/server code (these are developer-convenience fallbacks that activate ONLY when the env var is missing — when E11-S3 makes `NEXT_PUBLIC_*` build-time-baked, the fallbacks remain harmless guard clauses). Any hit OUTSIDE those locations is either refactored to read from `IConfiguration`/`process.env` in this story OR explicitly documented in the story Completion Notes as accepted with rationale. Do NOT attempt to migrate the 20+ frontend fallback sites in this story — that is a separate scope.
6. **`backend/src/IabConnect.Api/appsettings.json` base-vs-dev cleanup is a documented audit deliverable, not a code change.** Currently `appsettings.json` contains localhost dev defaults (Port=5433, Authority=http://localhost:8080, DocumentStorage hardcoded, Smtp.Host=localhost) that `appsettings.Development.json` duplicates. The "right" long-term shape is non-secret production-safe defaults in base and dev-only overrides in `appsettings.Development.json`. This story DOES NOT migrate those — the migration is intentionally deferred to a follow-up (E11-S2 will be the trigger because Beta-environment inherits base before applying `appsettings.Beta.json`). E11-S1 instead documents the finding in a new top-level section of `_bmad-output/implementation-artifacts/deferred-work.md` named `### E11-S1 follow-up: appsettings.json base cleanup` with the exact keys-to-move list and a one-sentence rationale.
7. **`backend/src/IabConnect.Api/appsettings.Beta.json` skeleton committed (new file).** Minimal contents — only the two operational toggles that differentiate Beta from base/Production at the configuration layer and are non-sensitive:
   ```json
   {
     "Serilog": {
       "Using": ["Serilog.Sinks.Console"],
       "WriteTo": [{ "Name": "Console" }]
     },
     "RetentionEnforcement": {
       "Enabled": false
     }
   }
   ```
   No connection strings, no Keycloak URLs, no secrets — those come from the environment per ADR-015. E11-S2 owns the full Beta-specific behavior wiring (the BETA banner env var, the `IsDevelopment()` audit). This story commits ONLY the skeleton to make the configuration-loading edge visible and to prevent E11-S2 from racing on file creation.
8. **No code changes to `backend/src/**/*.cs` or `frontend/src/**/*.{ts,tsx}`.** E11-S1 is a configuration-surface and documentation story. The only `.cs` artifact touched is the new `appsettings.Beta.json` (which is JSON, not C#). E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta` introduction with BETA banner) and E11-S3 (`next.config.ts` env-driven refactor) own all code changes. If the audit in AC-5 surfaces a hit that MUST be refactored, raise it as a blocker rather than refactoring inline.
9. **Quality gates.** `dotnet build` from `backend/` stays green with zero warnings (warnings-as-errors is configured). `dotnet test` from `backend/` runs the full suite with no new failures (the only test-touching change is the new `appsettings.Beta.json` file, which `dotnet test` should ignore because the test host uses `appsettings.Testing.json`/launch profile). `npm run lint && npm run build` from `frontend/` stays green; `npm test` (Vitest) shows no new failures. No E2E (Playwright) regressions expected because no frontend code changes.
10. **All edits respect `.editorconfig`.** LF line endings on every new/edited file. Final newline on each file. 2-space indent for JSON, YAML, Markdown; the existing `backend/.env.example` does not yet exist so create it with LF endings. Verify on Windows with `git config --get core.autocrlf` set to `input` (or commit with `git add --renormalize .` if line endings drift).
11. **No frontend translation key additions.** This story does not touch any user-visible UI, so `frontend/messages/en.json` and `frontend/messages/de.json` are untouched. The BETA banner (E11-S2) is the place where the first user-visible E11 string will land.

## Tasks / Subtasks

- [x] **Task 1 — Audit current config consumption to derive the canonical key list (AC: 1, 2)** — establish the source of truth for what actually gets read.
  - [x] 1.1 Backend: `rg -n "configuration\[|GetSection\(|GetValue|GetConnectionString" backend/src/ | rg -v "/bin/|/obj/"` and de-duplicate. Cross-check against keys present in `backend/src/IabConnect.Api/appsettings.json:1-78`. Known consumption sites: `DependencyInjection.cs:56,58` (`Branding:ApiTitle`/`ApiDescription`), `DependencyInjection.cs:94` (`Frontend:BaseUrl`), `DependencyInjection.cs:121-123` (`Keycloak:Authority/ClientId/ClientSecret`), `Infrastructure/DependencyInjection.cs:196` (`Smtp:*`), `Infrastructure/DependencyInjection.cs:204` (`CalendarFeedSettings`), `Infrastructure/DependencyInjection.cs:245` (`CalendarTokenOptions`), `Infrastructure/DependencyInjection.cs:258-259` (`DocumentStorage:*`), `Infrastructure/DependencyInjection.cs:278` (`InvoiceSettings:*`), `Endpoints/InvoiceEndpoints.cs:242` (`Features:EInvoiceExport`). **Re-audit surfaced three new keys not in the original story:** `Backup__Directory` and `Backup__DockerContainer` (`PostgresBackupService.cs:32,34`) and `Email__UnsubscribeSecret` (`UnsubscribeTokenService.cs:18-19`, falls back to `Smtp__FromEmail`) — all added to `backend/.env.example`.
  - [x] 1.2 Frontend: `rg -n "process\.env\." frontend/src/` and de-duplicate. Known consumption sites: `lib/api/*.ts` (`NEXT_PUBLIC_API_URL` — many call sites), `app/api/auth/[...nextauth]/route.ts:57,62,63,96,97,98` (`KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`), `middleware.ts:88` (`NEXTAUTH_SECRET`), `lib/auth.ts:135` (`NEXT_PUBLIC_KEYCLOAK_ISSUER` — note: this var is read but NOT currently in `.env.example` — surface as a finding). **Re-audit surfaced three additional NEXT_PUBLIC_KEYCLOAK_* vars at `app/login/page.tsx:154`** (`NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` — all read for the password-reset deep link, all previously undocumented) — all four NEXT_PUBLIC_KEYCLOAK_* vars added to `frontend/.env.example`.
  - [x] 1.3 **Decision-point**: if a key is consumed in code but absent from `appsettings.json`, decide whether it's (a) Dev-only convenience (annotate `Dev-only` in `.env.example`, no `appsettings.json` addition), (b) intentional env-only secret (annotate `Required` with no default), or (c) a missing default (raise as a follow-up; do NOT silently add to `appsettings.json`). Applied; all annotated as Required/Optional in `backend/.env.example`.
  - [x] 1.4 **Cross-check `Auth__CalendarTokenPepper`** — currently the only `Auth:*` key. The `_comment_CalendarTokenPepper` comment at `appsettings.json:42` documents the production requirement. Mirror this guidance verbatim into the `backend/.env.example` comment for `Auth__CalendarTokenPepper`. Done — comment mirrors the production-migration guidance.
- [x] **Task 2 — Author `backend/.env.example` (AC: 1, 10)** — created at repo path `backend/.env.example`, 100 lines, 10 sections in the documented order, every entry carries a `# Required|Optional|Dev-only` annotation line above the `KEY=__placeholder__` line. Each section starts with `# === <Section> ===` divider. LF line endings, final newline.
  - [x] 2.1 `# === Application ===` — `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`.
  - [x] 2.2 `# === Database ===` — `ConnectionStrings__DefaultConnection`, `Database__AutoMigrate`.
  - [x] 2.3 `# === Identity (Keycloak) ===` — `Keycloak__*`, `KeycloakAdmin__*`, `Auth__CalendarTokenPepper`.
  - [x] 2.4 `# === Frontend wiring ===` — `Frontend__BaseUrl`.
  - [x] 2.5 `# === Object storage (RustFS / S3-compatible) ===` — `DocumentStorage__*` keys.
  - [x] 2.6 `# === Mail (Mailtrap sandbox in Beta — see ADR-018) ===` — `Smtp__*` keys plus `Email__UnsubscribeSecret`.
  - [x] 2.7 `# === Branding (white-label) ===` — `Branding__ApiTitle/ApiDescription/SourceUrl`.
  - [x] 2.8 `# === Invoicing ===` — `InvoiceSettings__*` keys.
  - [x] 2.9 `# === Features ===` — `Features__EInvoiceExport`.
  - [x] 2.10 `# === Operations ===` — `RetentionEnforcement__Enabled` (ADR-020), `Backup__Directory`, `Backup__DockerContainer`, `Backup__EncryptionKey` (ADR-019).
  - [x] 2.11 Two-line entry pattern applied throughout.
  - [x] 2.12 LF line endings, final newline.
- [x] **Task 3 — Extend `frontend/.env.example` (AC: 2, 10)** — file rewritten to extend coverage. Existing 6 entries retained by structure with replaced placeholders (`__set_in_environment__` / `__set_in_environment_min_32_chars__`) and added annotations. New `# === Keycloak client-side links` section adds the 4 previously-undocumented `NEXT_PUBLIC_KEYCLOAK_*` vars. New `# === Beta + OSS build-time vars (E11/E20 wiring) ===` section adds `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`. Every `NEXT_PUBLIC_*` entry carries the `# build-time-constant — rebuild required after change` note.
  - [x] 3.1 New entries with placeholder defaults committed.
  - [x] 3.2 LF line endings, final newline.
- [x] **Task 4 — Tighten `.gitignore` (AC: 3)** — appended a new `.NET local-override files (never commit)` section after the dotenv block, containing `**/appsettings.*.Local.json`. Existing `.env`/`.env.*` block left unchanged (already covers all dotenv variants). `git check-ignore -v` smoke tests pass for `backend/src/IabConnect.Api/appsettings.Production.Local.json` (matches new rule), `frontend/.env.local` (matches existing `.env.*`), `backend/.env` (matches existing `.env`).
- [x] **Task 5 — Rewrite README Configuration subsection (AC: 4)** — replaced lines 257-298 of `README.md` with a fresh 67-line subsection containing the overview paragraph, backend precedence diagram, `__` vs `:` worked example with `Keycloak__ClientSecret`, frontend precedence diagram, build-time vs runtime explanation for `NEXT_PUBLIC_*`, and the ADR-015 markdown link. Used targeted Edit with the unique surrounding-text anchors; license badge at line 25 and license section at the bottom were not touched.
  - [x] 5.1 Overview paragraph with canonical-list pointer.
  - [x] 5.2 Backend precedence diagram.
  - [x] 5.3 `__` vs `:` worked example.
  - [x] 5.4 Frontend precedence diagram.
  - [x] 5.5 Build-time vs runtime explanation.
  - [x] 5.6 ADR-015 markdown link.
  - [x] 5.7 Out-of-scope sections left untouched (verified via `git diff README.md`).
- [x] **Task 6 — Audit pass on hardcoded hosts (AC: 5)** — final grep ran clean per the triage matrix; findings documented in Completion Notes below and in `deferred-work.md`.
  - [x] 6.1 `KeycloakHealthCheck.cs:16` typo (`Authentication:Authority`) confirmed; deferred per `deferred-work.md → E11-S1 follow-up: KeycloakHealthCheck.cs configuration-key typo`.
  - [x] 6.2 `frontend/next.config.ts:14-27` hardcoded; E11-S3 owns the refactor.
  - [x] 6.3 ~30 frontend `?? "http://localhost:5000"` fallbacks classified as accepted Dev-only guard pattern.
  - [x] 6.4 `DependencyInjection.cs:96-104` dev-only CORS allowlist accepted per existing convention.
  - [x] 6.5 No new hits outside documented locations. `PostgresBackupService.cs:294-298` connection-string parse defaults (`localhost`/`5432`/`postgres`) are dictionary-lookup fallbacks for malformed connection strings, not hardcoded application config — accepted as defensive.
- [x] **Task 7 — Commit `appsettings.Beta.json` skeleton (AC: 7)** — created `backend/src/IabConnect.Api/appsettings.Beta.json` with the exact two-key body (Serilog Console-only per ADR-017, `RetentionEnforcement.Enabled = false` per ADR-020). `dotnet build` succeeded (proves JSON parses); file picked up by the csproj glob and copied to `backend/src/IabConnect.Api/bin/Debug/net10.0/appsettings.Beta.json`.
- [x] **Task 8 — Document the deferred audit findings (AC: 6)** — appended `## Deferred from: E11-S1 implementation (2026-05-16)` section to `_bmad-output/implementation-artifacts/deferred-work.md` with three entries: `appsettings.json base cleanup`, `KeycloakHealthCheck.cs configuration-key typo`, `Branding__SourceUrl consumed-after-documented` forward-reference note.
- [x] **Task 9 — Quality gates (AC: 9)** — all green:
  - [x] 9.1 `dotnet build` from `backend/`: 0 warnings, 0 errors (11.9s).
  - [x] 9.2 `dotnet test` from `backend/`: **1942/1942 passed, 0 failures, 0 skipped** (Application 1442, Api 111, Infrastructure 389). No regression from prior baseline.
  - [x] 9.3 `npm run lint` from `frontend/`: green for changed files. The 2 pre-existing baseline errors in `frontend/src/app/members/segments/page.tsx` (already documented in `deferred-work.md → E9.S2 Pre-existing lint baseline failure`) and 1 warning are unchanged by E11-S1 — no `.ts/.tsx` files were touched.
  - [x] 9.4 `npm run build` from `frontend/`: green Next.js production build, all routes compiled including `/site-unavailable`, `/module-unavailable`, all `(dashboard)/*`, all `public/*`.
  - [x] 9.5 `npm test` (Vitest) from `frontend/`: **89/89 passed, 15 test files**.
  - [x] 9.6 `git check-ignore -v` smoke tests: all three targets correctly ignored as expected.

## Dev Notes

### Configuration surface map (current state)

Keys consumed across the backend, from the audit grep:

| Section | Keys | Read at |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | Postgres connection string | EF Core auto-binding via `AddDbContext` |
| `Keycloak:Authority`/`ClientId`/`ClientSecret` | OIDC config | `Api/DependencyInjection.cs:121-123` |
| `KeycloakAdmin:BaseUrl`/`Realm`/`ClientId`/`ClientSecret` | Admin SPI client | `Infrastructure/DependencyInjection.cs` |
| `Auth:CalendarTokenPepper` | Calendar-token HMAC pepper | comment at `appsettings.json:42` |
| `Frontend:BaseUrl` | CORS allowlist | `Api/DependencyInjection.cs:94` |
| `DocumentStorage:ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName`/`UseHttps` | RustFS/S3 binding | `Infrastructure/DependencyInjection.cs:258-259` |
| `Smtp:Host`/`Port`/`EnableSsl`/`Username`/`Password`/`FromEmail`/`FromName` | SMTP options | `Infrastructure/DependencyInjection.cs:196` |
| `Branding:ApiTitle`/`ApiDescription` | OpenAPI metadata | `Api/DependencyInjection.cs:56,58` |
| `Branding:SourceUrl` | NOT YET CONSUMED — added by E20-S3 | (forward reference) |
| `Hangfire:DashboardPath` | Hangfire UI path | `Infrastructure/DependencyInjection.cs` |
| `Features:EInvoiceExport` | Feature toggle | `Endpoints/InvoiceEndpoints.cs:242` |
| `InvoiceSettings:*` | Invoice org defaults | `Infrastructure/DependencyInjection.cs:278` |
| `CalendarFeedSettings` | Calendar feed config | `Infrastructure/DependencyInjection.cs:204` |
| `CalendarTokenOptions` | Token signing config | `Infrastructure/DependencyInjection.cs:245` |
| `Authentication:Authority` | (typo) | `Api/HealthChecks/KeycloakHealthCheck.cs:16` — see Task 6.1 |

Frontend-side: the only consumed vars are `NEXT_PUBLIC_API_URL` (~20 call sites; most via `lib/api/*.ts`), `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, plus `NEXT_PUBLIC_KEYCLOAK_ISSUER` read at `lib/auth.ts:135` (not currently in `.env.example` — Task 1.2 finding).

### Current state of base vs. Development appsettings (AC-6 context)

`appsettings.json` and `appsettings.Development.json` today carry overlapping localhost dev defaults — `appsettings.json:34` (`Host=localhost;Port=5433`) is identical to `appsettings.Development.json:26`; same pattern for Keycloak Authority, DocumentStorage, Smtp.Host. This violates the standard layering ("base = production-safe defaults; environment overlay = dev convenience") and it would cause Beta — which loads base then `appsettings.Beta.json` (no dev overrides) — to inherit `localhost:5433` until env vars override. The fix is real but is OUT of this story's scope (a single-file move could introduce a regression if any code path reads `appsettings.json` without `appsettings.Development.json` overlay). E11-S2 is the natural trigger because that story wires `ASPNETCORE_ENVIRONMENT=Beta` and would otherwise hit this issue first. Document it in `deferred-work.md` per Task 8.

### `.gitignore` reality check

Lines 55-58 already handle `.env`, `.env.*`, with `!.env.example` whitelist. The patterns are unanchored (no leading `/`) so they match at any depth — `git check-ignore -v frontend/.env.local` confirms a match. The only AC-3 gap is the .NET local-override file convention `appsettings.*.Local.json` (some devs use this pattern for local secret overrides). The story adds that one rule; it does NOT re-add `.env.local` / `.env.*.local` explicitly because the existing `.env.*` pattern already matches.

### Why `__` (double underscore) and not `:` in environment variables

.NET configuration uses `:` as the nested-key separator inside `appsettings.json` (`Keycloak:ClientSecret`), but POSIX-compatible shells and Windows env vars do not allow `:` in environment-variable names. .NET respects `__` (two underscores) as an alias for `:` when reading environment variables. Always document the env-var form as `Keycloak__ClientSecret` — the README precedence section's worked example must make this explicit. (Source: Microsoft Docs "Configuration providers — environment variables".)

### Placeholder format — why not token-shaped values

`.env.example` files are checked into a public repo (the project becomes public with E20-S1 — already authored, ready-for-dev in Wave 1). Placeholders must NOT pattern-match real credentials or token shapes:

- ❌ `Keycloak__ClientSecret=xxxx-xxxx-xxxx-xxxx` (UUID/GUID shape — TruffleHog will flag)
- ❌ `Auth__CalendarTokenPepper=changeme123` (looks like a real password)
- ❌ `NEXTAUTH_SECRET=your-nextauth-secret-here` (current frontend value — looks token-ish)
- ✅ `Keycloak__ClientSecret=__set_in_environment__`
- ✅ `Auth__CalendarTokenPepper=__set_in_environment_min_32_chars__`
- ✅ `Backup__EncryptionKey=__set_in_environment_base64_32_bytes__`

This matters because GitHub's built-in secret scanning, TruffleHog, and gitleaks all match on regex shapes. Token-shaped placeholders create false positives that erode signal once the repo is public.

### Beta-specific files vs. environment variables

A common confusion: `appsettings.Beta.json` is committed and visible to anyone with repo access; it must therefore contain ONLY non-sensitive defaults. Anything secret (connection strings, client secrets, encryption keys, pepper) must be supplied by the environment at runtime. The two keys committed by AC-7 — `Serilog.WriteTo` array (Console-only per ADR-017) and `RetentionEnforcement.Enabled=false` (per ADR-020) — are non-sensitive operational toggles, safe to commit.

### Where `RetentionEnforcement__Enabled` is consumed

The flag is introduced by SCP-2026-05-15 ADR-020 and consumed at job-registration time in `backend/src/IabConnect.Api/DependencyInjection.cs:286-316` (the `jobManager.AddOrUpdate<RetentionEnforcementJob>(...)` line). The consumption refactor is **E11-S2's** responsibility — this story (E11-S1) only documents the variable in `.env.example` and commits the `appsettings.Beta.json` default of `false`. When E11-S2 lands and reads the flag, the registration is skipped when `false`.

### Where `Database__AutoMigrate` is consumed (forward reference)

The flag is introduced by SCP-2026-05-15 (Section 5 Epic E15 Story E15-S2). It must appear in `backend/.env.example` (Optional, default `true`) so a Production-Hoster can flip it. Code consumption is **E15-S2's** scope; the documentation is this story's scope. Until E15-S2 lands, the env var is documented but has no effect — that's intentional and expected.

### README Configuration subsection — known discrepancies in the current text

The current `README.md:259-298` shows:

- `Keycloak.ServerUrl`/`Realm`/`Audience`/`AdminClient`/`AdminClientSecret` — actual file uses `Keycloak.Authority`/`ClientId`/`ClientSecret` (no `Realm`, no `Audience`, no `AdminClient`).
- `Email.SmtpHost`/`SmtpPort`/`FromEmail`/`FromName` — actual section is `Smtp.Host`/`Port`/`EnableSsl`/`Username`/`Password`/`FromEmail`/`FromName`.
- Frontend env shows `NEXT_PUBLIC_KEYCLOAK_URL`/`NEXT_PUBLIC_KEYCLOAK_REALM`/`NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` — none of these exist in `frontend/.env.example` and only `NEXT_PUBLIC_KEYCLOAK_ISSUER` is read by code (`lib/auth.ts:135`).

The Task 5 rewrite replaces the entire subsection with accurate content. Do NOT try to ALSO fix the README's outdated "Default Credentials" table at `README.md:326-334` or any other section — out of scope. The rewrite is bounded to lines 257-298.

### Architecture and project constraints

- Single-tenant configuration story — no per-tenant overlays. [Source: architecture.md#ADR-007]
- Configuration consumed via `IConfiguration` injection in DI and via `Microsoft.Extensions.Options` patterns where settings are POCOs. New keys should use the existing pattern; do not introduce a parallel configuration mechanism. [Source: project-context.md#Framework-Specific Rules]
- Frontend uses `next-intl` and `process.env.NEXT_PUBLIC_*`. The `NEXT_PUBLIC_` prefix is the Next.js contract for "expose to the browser at build time". Anything sensitive must NOT carry the `NEXT_PUBLIC_` prefix. [Source: project-context.md#Framework-Specific Rules]
- `.editorconfig` enforces LF line endings, UTF-8, trim trailing whitespace, final newline. The new `backend/.env.example` and `appsettings.Beta.json` files must honor this. [Source: project-context.md#Code Quality & Style Rules]
- Backend builds enforce warnings-as-errors. Editing only `.json`, `.env.example`, `.gitignore`, `README.md` keeps the C# compilation graph untouched. [Source: project-context.md#Technology Stack & Versions]
- This story is the implementation foundation for the Beta-on-Railway deployment per SCP-2026-05-15. ADR-015 (Configuration and Environment Strategy) is the architectural anchor. [Source: architecture.md#ADR-015]

### Don't-miss patterns

- **DO NOT add new code paths that read `IConfiguration` in this story.** All consumption logic is owned by downstream stories (E11-S2 for `RetentionEnforcement__Enabled` and BETA banner, E11-S3 for `next.config.ts` env-driven, E15-S2 for `Database__AutoMigrate`, E20-S3 for `Branding__SourceUrl`). E11-S1's deliverable is documentation + defaults + audit. A reviewer should be able to validate this story by reading 4 files (`backend/.env.example`, `frontend/.env.example`, `.gitignore`, `README.md`) plus the new `appsettings.Beta.json` and `deferred-work.md` finding — nothing else.
- **DO NOT fix the `KeycloakHealthCheck.cs:16` typo** (`Authentication:Authority` should be `Keycloak:Authority`). It is a real latent bug but fixing it changes runtime behavior (the health check would start working and might return 503 if the Keycloak URL is wrong) — that is its own story. Surface in `deferred-work.md` only.
- **DO NOT migrate the 20+ frontend `?? "http://localhost:5000"` fallbacks** to a centralized helper. They are guard clauses; the env var IS the source of truth when set. Documentation-only.
- **DO NOT modify the README license badge or license section** (`README.md:25`, `README.md:856-862`). E20-S1 owns those edits and is Wave 1 ready-for-dev; touching them here creates a merge conflict.
- **DO mirror the `_comment_CalendarTokenPepper` guidance** from `appsettings.json:42` verbatim into the `.env.example` annotation. The production migration guidance ("set before HmacPepperCalendarSubscriptionTokens migration runs") is non-obvious and must travel with the env var.
- **DO commit `appsettings.Beta.json` even though no story consumes its values yet.** E11-S2 will read both keys; pre-committing the file removes a dependency edge from E11-S2 and makes E11-S2 a code-only change.
- **DO use `Edit` (not `Write`) on `README.md` and `frontend/.env.example`**. Both files exist; `Write` would overwrite the entire file. Use targeted Edit calls with unique surrounding context.
- **The `Branding__SourceUrl` key** is referenced here ONLY because it's a future env var documented in advance. It is NOT yet consumed by code — E20-S3 introduces the consumption. Putting it in `.env.example` now means deployers configure it before E20-S3 ships, so when E20-S3 lands no env-var coordination is needed.

### Test plan and evidence

- **AC-1, 2 (env example file content):** A reviewer reads `backend/.env.example` and `frontend/.env.example`, confirms every required key is present, every entry has the `# Required|Optional|Dev-only` annotation, and no placeholder is token-shaped. Run `rg "your-|changeme|xxxx|[0-9a-f]{32}" backend/.env.example frontend/.env.example` — must return zero hits.
- **AC-3 (.gitignore):** `git check-ignore -v backend/src/IabConnect.Api/appsettings.Production.Local.json` must report ignored by `**/appsettings.*.Local.json`. `git check-ignore -v frontend/.env.local` must report ignored by `.env.*`.
- **AC-4 (README rewrite):** Render `README.md` in any Markdown viewer (or GitHub PR preview); confirm the new "Configuration" subsection appears between "Installation" and "Running the Application" with the precedence diagrams, the worked example, and the ADR-015 pointer. Confirm the badge at line 25 and the license section at the bottom are unchanged via `git diff README.md`.
- **AC-5 (no new hardcoded hosts):** Run the AC-5 grep, attach the output to Completion Notes, and confirm every hit is either in an acceptable Dev-only location OR documented.
- **AC-6 (deferred-work.md):** `deferred-work.md` contains the new `### E11-S1 follow-up: appsettings.json base cleanup` section with the keys-to-move list.
- **AC-7 (appsettings.Beta.json):** `dotnet build` succeeds (proves JSON parses). `ls backend/src/IabConnect.Api/bin/Debug/net10.0/appsettings.Beta.json` exists after build (proves the file glob picks it up).
- **AC-8 (no code changes):** `git diff --stat backend/src/**/*.cs frontend/src/**/*.ts frontend/src/**/*.tsx` returns no changes.
- **AC-9 (quality gates):** `dotnet build` green, `dotnet test` count matches previous (record in Completion Notes), `npm run lint && npm run build` green, `npm test` green.
- **AC-10 (line endings):** `git diff` shows no `^M` (CRLF) markers; `file backend/.env.example` reports "ASCII text" not "ASCII text, with CRLF line terminators".
- **AC-11 (no translations):** `git diff --stat frontend/messages/` returns no changes.

### Project Structure Notes

- **NEW files:** `backend/.env.example`, `backend/src/IabConnect.Api/appsettings.Beta.json`, possibly `_bmad-output/implementation-artifacts/deferred-work.md` (if not yet present — Task 8 creates it).
- **EDIT files:** `frontend/.env.example`, `.gitignore`, `README.md`.
- **NO changes** to `backend/src/**/*.cs`, `frontend/src/**/*.{ts,tsx}`, `infra/**`, `frontend/messages/*.json`, EF migrations.
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e11-s1-add-env-examples-and-document-config-precedence.md`.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-015: Configuration and Environment Strategy`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-017: Logging and Health for Container Runtimes`] — Serilog Console-only in Beta
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-018: Beta Mail Routing — Mailtrap Sandbox`] — Smtp section context
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-019: Backup Destination — Same RustFS`] — `Backup__EncryptionKey` context
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-020: Beta-Mode Job Suppression`] — `RetentionEnforcement__Enabled` context
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Epic E11: Environment and Configuration Management for Beta`]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S1: Add .env.example files and document configuration precedence`]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S2: Introduce ASPNETCORE_ENVIRONMENT=Beta`] — downstream consumer
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S3: Make next.config.ts environment-driven`] — downstream consumer
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-088 Beta Deployment Readiness`] — AC-4 ("no secrets in repo/image")
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-4`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 4 — ADR-015 Configuration and Environment Strategy`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E11 Stories E11-S1, E11-S2, E11-S3`]
- [Source: `backend/src/IabConnect.Api/appsettings.json:1-78`] — current backend configuration surface
- [Source: `backend/src/IabConnect.Api/appsettings.Development.json:1-58`] — current dev overrides (duplicates base — see AC-6 / Task 8)
- [Source: `backend/src/IabConnect.Api/DependencyInjection.cs:56,58,94,121-123`] — direct `IConfiguration[...]` reads
- [Source: `backend/src/IabConnect.Infrastructure/DependencyInjection.cs:196,204,245,258-259,278`] — `services.Configure<T>(...)` bindings
- [Source: `backend/src/IabConnect.Api/Endpoints/InvoiceEndpoints.cs:242`] — `Features:EInvoiceExport` consumer
- [Source: `backend/src/IabConnect.Api/HealthChecks/KeycloakHealthCheck.cs:16`] — latent typo (Task 6.1, defer)
- [Source: `frontend/.env.example:1-14`] — current frontend env surface (extend in Task 3)
- [Source: `frontend/next.config.ts:14-27`] — hardcoded localhost (E11-S3 refactor target)
- [Source: `.gitignore:55-58`] — existing dotenv coverage (Task 4 extends)
- [Source: `README.md:257-298`] — current Configuration subsection (Task 5 rewrites)
- [Source: `_bmad-output/project-context.md`] — Technology Stack, Framework-Specific Rules, Code Quality

## Review Findings (2026-05-16)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) over the 6 in-scope files (~462 lines diff). 18 raw findings → 0 decision-needed, 4 patch, 2 defer, 12 dismissed.

### Patches (applied 2026-05-16)

- [x] [Review][Patch] Fix `__` ↔ `:` direction wording in env-example header [backend/.env.example:11-12] — applied; header now reads ".NET reads `__` from environment variables and maps it internally to `:`".
- [x] [Review][Patch] Add `Hangfire__DashboardPath` to `backend/.env.example` — applied; new `# === Background jobs (Hangfire) ===` section added with the Optional default `/hangfire` entry.
- [x] [Review][Patch] Revert `frontend/next-env.d.ts` — applied via `git checkout HEAD -- frontend/next-env.d.ts`; file no longer dirty in `git status`.
- [x] [Review][Patch] Add sync-warning comment for `KEYCLOAK_ISSUER` ↔ `NEXT_PUBLIC_KEYCLOAK_ISSUER` [frontend/.env.example] — applied; 3-line warning above the `KEYCLOAK_ISSUER` entry naming both vars and the consequence of drift.

### Deferred (pre-existing or out-of-scope, recorded in `deferred-work.md`)

- [x] [Review][Defer] `KeycloakHealthCheck.cs:16` reads non-existent `Authentication:Authority` section [backend/src/IabConnect.Api/HealthChecks/KeycloakHealthCheck.cs:16] — already on the deferred-work.md follow-up list from this story; Edge Case Hunter confirmed the health check is effectively a no-op until fixed.
- [x] [Review][Defer] Beta `Serilog.WriteTo` array-merge surfaces base's File sink [backend/src/IabConnect.Api/appsettings.Beta.json] — .NET configuration merges JSON arrays by INDEX, not wholesale. Beta's `WriteTo: [{Console}]` overrides base's `WriteTo[0]` (Console), but base's `WriteTo[1]` (File sink — `appsettings.json:21-30`) survives → Beta would still write File logs, contradicting ADR-017. Fix is structural and tied to the existing `appsettings.json base cleanup` deferred entry: when E11-S2 moves the File sink from base to `appsettings.Development.json`, Beta will inherit Console-only correctly. Updating deferred-work.md to include this constraint in the cleanup checklist.

### Dismissed (12 — listed for transparency)

Counts below cite the raw finding ID for traceability; full reasoning lives in the review transcript:

- **F1**: re-promoted to defer (D2 above) after re-verifying .NET array-merge semantics.
- **F2**: SMTP `EnableSsl=true` on port 587 is correct in modern .NET `SmtpClient` (STARTTLS negotiated automatically).
- **F3**: `**/appsettings.*.Local.json` matches the established .NET `appsettings.{Env}.Local.json` convention; plain `appsettings.Local.json` is not a standard .NET pattern.
- **F5**: `NEXT_PUBLIC_DOCUMENT_HOST` "Optional" annotation reflects CURRENT consumption (the var is unused until E11-S3 refactors `next.config.ts`); the inline comment names the future required-status.
- **F6**: `E18-S3` cross-reference exists in sprint-status.yaml as `e18-s3-add-beta-banner-in-ui`; not invented.
- **F7**: `Frontend__BaseUrl` "Required" annotation grammar inconsistency vs other "Required (production)" entries — below threshold for action.
- **F8**: `appsettings.Beta.json` missing `AllowedHosts` hardening — out of scope (E14 security audit owns it).
- **F10, F12**: line-number rot on cross-references is a cross-cutting documentation concern, not specific to E11-S1.
- **F11**: README anchor `#adr-015-configuration-and-environment-strategy` matches GitHub's slug algorithm for the architecture.md heading.
- **F13**: committed dev credentials in base `appsettings.json` (`rustfsadmin` literals) — intentional deferral to E11-S2 base cleanup (already in deferred-work.md).
- **F14**: `htos` personal-account default for `Branding__SourceUrl` / `NEXT_PUBLIC_SOURCE_URL` is the canonical repo per SCP-2026-05-15; forks override.
- **F15**: trailing-newline concern — no evidence of missing newlines (Write tool emitted them; `git diff` shows no `\ No newline at end of file` markers).

## Change Log

| Date | Change | Notes |
|---|---|---|
| 2026-05-16 | Initial implementation — configuration-surface foundation (E11 Wave-2 start). | 9 tasks complete. No `.cs` / `.tsx` changes. Three new findings surfaced and documented in `deferred-work.md`. Status → review. |
| 2026-05-16 | Code review + patches applied. | Adversarial review (Blind/Edge/Auditor) over 6 files / 462 lines. 18 raw → 0 decision, 4 patch (all applied), 2 defer (logged), 12 dismiss. New defer: Beta Serilog WriteTo array-merge surfaces base File sink — tied to E11-S2 base cleanup. Build + typecheck re-verified green. Status → done. |

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Amelia / bmad-dev-story)

### Debug Log References

- **Backend:** `dotnet build` (from `backend/`) — 0 warnings, 0 errors, 11.9s.
- **Backend:** `dotnet test` (from `backend/`) — 1942/1942 passed (Application 1442, Api 111, Infrastructure 389), 0 failures, 0 skipped. Infrastructure suite duration 3m 21s (Testcontainers PostgreSQL spin-up).
- **Frontend:** `npm run typecheck` (from `frontend/`) — exit 0, no `tsc --noEmit` output.
- **Frontend:** `npm run lint` (from `frontend/`) — exit 0. Pre-existing baseline errors in `frontend/src/app/members/segments/page.tsx` (already documented in `deferred-work.md → E9.S2 Pre-existing lint baseline failure`) remain unchanged. No new lint errors introduced.
- **Frontend:** `npm run build` (from `frontend/`) — green Next.js production build, all dynamic + static routes compiled.
- **Frontend:** `npm test -- --run` (Vitest) — 89/89 passed across 15 files, 2.71s.
- **Gitignore:** `git check-ignore -v backend/src/IabConnect.Api/appsettings.Production.Local.json` → matched by `.gitignore:63 **/appsettings.*.Local.json` (new rule); `git check-ignore -v frontend/.env.local` → matched by `.gitignore:57 .env.*`; `git check-ignore -v backend/.env` → matched by `.gitignore:56 .env`.
- **Placeholder scan:** `rg "your-|changeme|xxxx|[0-9a-f]{32}" backend/.env.example frontend/.env.example` → zero matches.
- **Beta file pickup:** `backend/src/IabConnect.Api/bin/Debug/net10.0/appsettings.Beta.json` exists after build → csproj glob picked it up.

### Completion Notes List

- **Implementation discipline:** Zero `.cs` / `.tsx` files changed in this story. The audit in AC-5 / Task 6 surfaced one real bug (`KeycloakHealthCheck.cs:16` typo) but per scope it was documented in `deferred-work.md` rather than fixed inline. E11-S2, E11-S3, E15-S2, and E20-S3 will own the actual consumption of the new env vars added here.
- **Audit findings beyond original story scope** (all incorporated into the `.env.example` files): backend gained `Backup__Directory`, `Backup__DockerContainer` (`PostgresBackupService.cs:32,34`), `Email__UnsubscribeSecret` (`UnsubscribeTokenService.cs:18`); frontend gained `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, `NEXT_PUBLIC_KEYCLOAK_ISSUER` (`login/page.tsx:154`, `lib/auth.ts:135`). All were read by code but undocumented in `.env.example` before this story.
- **`PostgresBackupService.cs:294-298` review:** the `localhost` / `5432` / `postgres` literals there are dictionary-lookup fallbacks (`parts.GetValueOrDefault("Host", "localhost")`, etc.) applied when parsing a malformed connection string — they are NOT hardcoded application config and remain acceptable as defensive defaults.
- **`appsettings.json` base-vs-Development duplication:** confirmed — both files carry identical `Host=localhost;Port=5433`, `Authority=http://localhost:8080`, `DocumentStorage` config including the literal `rustfsadmin` access key/secret. This is a real Beta-deployment risk and the cleanup is documented in `deferred-work.md → E11-S1 follow-up: appsettings.json base cleanup` with E11-S2 as the recommended trigger story (Beta-environment-load is the natural surface where the duplication first matters).
- **README license badge + license section untouched** per AC-4 / Task 5.7 — E20-S1 (Wave 1 ready-for-dev) owns those edits to prevent merge conflicts.
- **`Branding__SourceUrl` is documented before consumption** (forward reference): the variable is in `backend/.env.example` so deployers can configure it ahead of E20-S3 shipping the `/about` endpoint that reads it. No code currently reads `Branding:SourceUrl`. Same forward-reference pattern applies to `NEXT_PUBLIC_ENV_LABEL` (E11-S2 BETA banner) and `NEXT_PUBLIC_DOCUMENT_HOST` (E11-S3 `next.config.ts` refactor).
- **Lint baseline carry-over:** the 2 pre-existing ESLint errors in `members/segments/page.tsx` were not addressed by this story (no `.tsx` change scope). They remain on the `deferred-work.md → E9.S2 Pre-existing lint baseline failure` ledger.

### File List

**New files (5):**

- `backend/.env.example` — 100-line canonical backend env-var template, 10 sections, every entry `# Required|Optional|Dev-only` annotated, `__set_in_environment__`-style placeholders.
- `backend/src/IabConnect.Api/appsettings.Beta.json` — 8-line Beta operational-default skeleton (Serilog Console-only per ADR-017, `RetentionEnforcement.Enabled = false` per ADR-020).

**Modified files (4):**

- `frontend/.env.example` — extended from 14 to 46 lines: existing 6 entries re-annotated with placeholders replaced; 4 new `NEXT_PUBLIC_KEYCLOAK_*` entries (closes prior consumed-but-undocumented gap from `login/page.tsx:154` and `lib/auth.ts:135`); 3 new Beta+OSS build-time vars (`NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`).
- `.gitignore` — added `.NET local-override files (never commit)` section with `**/appsettings.*.Local.json` after the existing dotenv block.
- `README.md` — replaced lines 257-298 ("Configuration" subsection) with a 67-line accurate version covering backend + frontend precedence diagrams, `__` vs `:` worked example, build-time vs runtime explanation, ADR-015 markdown link. License badge (line 25) and license section (lines 856-862) untouched.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended `## Deferred from: E11-S1 implementation (2026-05-16)` with three follow-up entries: `appsettings.json base cleanup`, `KeycloakHealthCheck.cs configuration-key typo`, `Branding__SourceUrl consumed-after-documented` forward-reference note.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `e11-s1-add-env-examples-and-document-config-precedence` ready-for-dev → in-progress → review; `last_updated` notes added.

**Story file (this file):**

- `_bmad-output/implementation-artifacts/e11-s1-add-env-examples-and-document-config-precedence.md` — task checkboxes flipped to [x], Dev Agent Record / Change Log / File List / Completion Notes filled, Status `ready-for-dev` → `review`.
