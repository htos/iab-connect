# Story E8.S1: Add API Credentials and Scopes

Status: done

## Story

As an Admin/IT user,
I want to create and revoke scoped API credentials with a token-safe secret shown only once,
so that external integrations can authenticate to the new external API and access only the resources their scopes permit.

## Acceptance Criteria

1. An admin can **create** a named API credential (an `ApiClient`) and select the scopes it is granted, and can **revoke** an existing credential so it can no longer authenticate.
2. The credential **secret is returned exactly once** at creation time (and on rotation) and is **never stored in cleartext** — only a one-way/token-safe hash is persisted; the raw secret is unreadable thereafter.
3. **Scopes limit accessible resources/actions**: the external API can authorize a request against a required scope, and a credential lacking that scope is denied (403). At least the v1 read scope(s) consumed by E8-S2 are defined (e.g. `events:read`, `blog:read`).
4. **Credential use is audit-logged**: creation, revocation, and (at minimum) authentication failures are written via the existing `IAuditService`.
5. **External API routes enforce scopes AND rate limits**: a request to an external route presenting a valid credential authenticates via a dedicated API-key authentication scheme, is checked against the route's required scope, and is subject to a rate-limit policy. (This story delivers the enforcement primitives — the auth scheme, the `Scope:` policy, the module gate, and the rate-limit attach point; E8-S2 attaches them to concrete read endpoints.)

## Tasks / Subtasks

- [x] Task 0: Spike + resolve scope (AC: all) — resolve DEC-1..DEC-4 (see Decision-Needed) before writing code
  - [x] Confirm greenfield: no `ApiClient`/`ApiScope`/API-key auth exists (`backend/src` grep). Confirm the JWT registration site `DependencyInjection.cs:177-207` and the custom-handler precedent `tests/IabConnect.Api.Tests/TestAuthHandler.cs:20` + its second-scheme registration `TestWebApplicationFactory.cs:103-105`.
  - [x] Confirm the token-hash precedent `Member.cs:160-207` (`RegenerateCalendarToken` → `RandomNumberGenerator.GetBytes(32)` → return once, store only `CalendarSubscriptionTokenHash` = `HMAC-SHA256(pepper, SHA256(token))`) + `CryptographicOperations.FixedTimeEquals` (`UnsubscribeTokenService.cs:55`) + the pepper-from-config pattern (`CalendarTokenOptions.cs` / `CalendarTokenService.cs:25-31`).
  - [x] Confirm the single policy provider `PermissionPolicyProvider` (`PermissionAuthorizationHandler.cs:68-112`) handles `Permission:`/`Module:` prefixes; a `Scope:` branch + handler is additive.
  - [x] Confirm `ModuleKeys.cs:17-41` has no api/integrations key and the seed shape `20260514181057_AddModuleSettings.cs:62-74`; confirm the self-lockout rule (`ModuleSettingsEndpoints.cs:8-15` — admin/module-settings groups are never `Module:`-gated).
- [x] Task 1: Domain — `ApiClient` + `ApiScope` (AC: 1, 2, 3)
  - [x] Add `ApiClient` aggregate (`backend/src/IabConnect.Domain/Integration/ApiClient.cs`): `Id`, `Name`, `SecretHash` (string, never the raw secret), granted scopes, `IsRevoked`/`RevokedAt`, `CreatedAt`, `LastUsedAt?`. Private ctor for EF; static factory `Create(name, scopes, secretHash)`; methods `Revoke()`, `RecordUse(DateTimeOffset)`. No raw secret field anywhere on the entity.
  - [x] Model scopes per DEC-2. Recommended: a granted-scope **string set** validated against a closed `ApiScopes` constant set (`backend/src/IabConnect.Domain/Integration/ApiScopes.cs`, mirroring `ModuleKeys.cs` — `All` + per-scope const). Reject unknown scope strings at the write boundary (`ArgumentException` → 400).
  - [x] The raw secret is generated and hashed in a service (Task 2), NOT in the entity — the entity stores only the hash.
- [x] Task 2: Infrastructure — persistence + hashing + auth scheme + scope policy + module key (AC: 2, 3, 5)
  - [x] EF config `ApiClientConfiguration.cs` (snake_case `api_clients`; scope set stored per DEC-2, e.g. a joined `varchar` or a child table; `Ignore(DomainEvents)`); ONE additive migration after `20260607101749_AddContentLanguageMetadata` (verify the latest at Task 0). Repository `IApiClientRepository`/`ApiClientRepository` (`AddAsync`, `UpdateAsync`, `GetByIdAsync`, `GetByPrefixAsync` for auth lookup, `GetAllAsync` for admin list).
  - [x] `IApiKeyHashingService`/`ApiKeyHashingService`: `Generate()` → `RandomNumberGenerator.GetBytes(32)` base64url, returns `(rawSecret, hash)`; `Hash(raw)` = `HMAC-SHA256(pepper, SHA256(raw))` hex (reuse the `Member.HashCalendarToken` formula); `Verify(raw, hash)` via `CryptographicOperations.FixedTimeEquals`. New `Auth:ApiKeyPepper` option modeled on `CalendarTokenOptions`. Secret format SHOULD carry a non-secret lookup prefix/id so auth can find the row without scanning (e.g. `iabc_<clientId>_<secret>`).
  - [x] **API-key authentication scheme** (DEC-1=A recommended): `ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationSchemeOptions>` modeled structurally on `TestAuthHandler.cs:20` — read the key header (e.g. `X-Api-Key` or `Authorization: ApiKey ...`), look up the `ApiClient` by prefix, `FixedTimeEquals`-verify the hash, reject revoked clients, emit a `ClaimsPrincipal` with `NameIdentifier`=clientId + one claim per granted scope; return `AuthenticateResult.NoResult()` when the header is absent (so existing JWT 401 behavior is preserved). Register as a **second named scheme** `"ApiKey"` alongside JWT at `DependencyInjection.cs:177`; do NOT change the default scheme. `RecordUse` updates `LastUsedAt`.
  - [x] **`Scope:` authorization** (DEC-2=A recommended): add a `ScopePolicyPrefix` branch to `PermissionPolicyProvider.GetPolicyAsync` + a `ScopeRequirement` + `ScopeAuthorizationHandler` (mirroring `PermissionRequirement`/`PermissionAuthorizationHandler`) that succeeds when the principal carries the required scope claim. Register the handler scoped at `DependencyInjection.cs` near `:249`.
  - [x] **Module key** (DEC-3=A recommended): add a new `api` (or `integrations`) const to `ModuleKeys.cs` (both the const and `All`) + a new seed row in a migration (next fixed Guid `a1000000-...-000000000008`, `enabled=true` for behavior preservation). The external route group (E8-S2/S3) gates with `.RequireAuthorization("Module:api")`. **Do NOT gate the admin credential-management endpoints with `Module:` (self-lockout rule).**
- [x] Task 3: Application — create/revoke/list use cases (AC: 1, 4)
  - [x] MediatR commands/queries (or the repository-direct admin pattern per the chosen analog) for `CreateApiClient` (returns the raw secret ONCE in the response DTO), `RevokeApiClient`, `ListApiClients` (never returns the secret/hash). FluentValidation: non-empty name, scope set ⊆ `ApiScopes.All`.
  - [x] DTOs explicit at the boundary; the list/detail DTO exposes scopes + status + `lastUsedAt` but never the hash; only the create/rotate response carries the one-time `secret`.
- [x] Task 4: API — admin endpoint group + audit + DI registration (AC: 1, 4, 5)
  - [x] `MapApiClientEndpoints` (`backend/src/IabConnect.Api/Endpoints/ApiClientEndpoints.cs`) templated on `CustomRoleEndpoints.cs:17-32`: admin group `RequireAuthorization(policy => policy.RequireRole("admin"))` (or the `RequireAdmin` policy). `POST /api/v1/admin/api-clients` (create → secret once), `GET` (list), `POST /{id}/revoke` (or `DELETE /{id}`). Each sensitive action calls `auditService.LogActionAsync(...)` directly (per `CustomRoleEndpoints.cs:115-121`) with `entityType:"ApiClient"`.
  - [x] Add audit event types `ApiClientCreated`, `ApiClientRevoked`, `ApiClientAuthenticationFailed` to `AuditEnums.cs` (DEC supports reusing `SettingsChanged` as a zero-risk interim; recommended = dedicated types).
  - [x] Wire `MapApiClientEndpoints` into `EndpointMapper.cs`. **A63:** register every new injected service (`IApiClientRepository`, `IApiKeyHashingService`, scope handler) in ALL endpoint-metadata/auth test harnesses that build a `WebApplication` mapping affected groups, or `minimal-API` throws `Failure to infer parameters` in unrelated sibling tests.
- [x] Task 5: Frontend — admin credentials UI (AC: 1, 2, 3)
  - [x] New admin page `frontend/src/app/admin/api-clients/` (list + create dialog + revoke), styled on an existing admin CRUD page (`admin/settings` modules/custom-roles tab pattern), standard layout, orange primary, lucide icons, typed API wrapper.
  - [x] **Show-once secret UX (AC-2):** the create response surfaces the raw secret in a copy-once panel with an explicit "this is shown only once — copy it now" warning; it is never re-fetchable. Scope selection via checkboxes from `ApiScopes.All`. List shows name/scopes/status/lastUsed + revoke action (hidden when already revoked / lacking permission).
  - [x] i18n keys in `frontend/messages/de.json` + `en.json` + `hi.json` (all three exist post-E7-S3; `messages.parity.test.ts` fails otherwise).
- [x] Task 6: Tests (AC: all)
  - [x] Domain: `ApiClient` create/revoke/RecordUse; `ApiScopes`/scope-set validation (reject unknown).
  - [x] Infrastructure: `ApiKeyHashingService` round-trip (generate → verify true; tampered → false; `FixedTimeEquals` path); Testcontainers PostgreSQL repository round-trip + revoke + prefix lookup.
  - [x] API: `ApiKeyAuthenticationHandler` — valid key authenticates + scope claims present; absent header → falls through to JWT (no regression); revoked client → 401; `Scope:` policy → 403 when scope missing, 200 when present; rate-limit attach verified. Admin endpoints: create returns secret once + audit row; revoke + audit row; list never leaks hash. Auth tests confirm existing JWT routes unaffected.
  - [x] Frontend: create-dialog renders + shows secret once; scope checkboxes; revoke hidden by permission. Stable `useTranslations` mock (A64), `afterEach(cleanup)` + jsdom for `render()` tests (A35/A46).
- [x] Task 7: Quality gates (AC: all)
  - [x] A29 per-AC table + A65 per-surface (backend-enforcement vs admin-UI) honesty.
  - [x] Backend: solution builds 0/0; `dotnet test` (Application + Api + Infrastructure incl. Testcontainers). Frontend: `tsc` clean; `eslint`/`prettier --check` on changed files (A58/A72 — no `prettier --write` on pre-drifted files), `vitest run`.
  - [x] Security self-check: grep the diff to prove no raw secret is persisted or logged; confirm `FixedTimeEquals` on the verify path; confirm the new scheme does not become the default.

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 pre-pivot stub (placeholder ACs, stale e1-s1/MFA "Latest Technical Context"). **This is a genuine greenfield build** — `ApiClient`/`ApiScope`/API-key auth do not exist anywhere in `backend/src`. The spike found strong reuse precedents so the dev agent extends existing patterns rather than inventing:

- **Auth pipeline = Keycloak/OIDC JWT bearer only**, registered at `DependencyInjection.cs:177-207` (`AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(...)`, `MapInboundClaims=false`, realm-roles mapped in `OnTokenValidated`). An external API authenticates by a presented key, not a Keycloak JWT → a **new second authentication scheme** is required. The exact structural template is `tests/IabConnect.Api.Tests/TestAuthHandler.cs:20` (a real `AuthenticationHandler<AuthenticationSchemeOptions>`) registered as a second/named scheme in `TestWebApplicationFactory.cs:103-105`. Apply the new scheme per-route-group via `AuthenticationSchemes="ApiKey"`; never change the default scheme (every existing endpoint relies on it).
- **Token-safe secret (show-once) precedent already shipped:** `Member.RegenerateCalendarToken` (`Member.cs:160-173`) generates with `RandomNumberGenerator.GetBytes(32)`, base64url, returns cleartext **once**, persists only `CalendarSubscriptionTokenHash` (`Member.cs:37`); `HashCalendarToken` (`Member.cs:198-207`) = `HMAC-SHA256(pepper, SHA256(token))` hex. Constant-time compare precedent: `UnsubscribeTokenService.cs:55` (`CryptographicOperations.FixedTimeEquals`). Pepper-from-config: `CalendarTokenOptions.cs` + `CalendarTokenService.cs:25-31`. Reuse all of this — do NOT invent a KDF; API secrets are high-entropy random tokens so a slow password-KDF buys nothing on the hot auth path (DEC-4).
- **Single authorization policy provider:** `PermissionPolicyProvider` (`PermissionAuthorizationHandler.cs:68`, `GetPolicyAsync:79`) already parses `Permission:` (`:81`) and `Module:` (`:102`) prefixes else delegates to default. A `Scope:` prefix branch + `ScopeRequirement` + `ScopeAuthorizationHandler` is directly analogous to the `Module:` handler (`ModuleAuthorizationHandler.cs:13,36`, registered `DependencyInjection.cs:249`). Only ONE `IAuthorizationPolicyProvider` may exist — extend the existing one, do not add a second.
- **Rate limiting is already done (E14-S4):** global limiter (100/min anon, 600/min auth) applies to ALL endpoints automatically (`RateLimiterRegistration.cs:45-75`, wired `DependencyInjection.cs:262`); named policy `"strict-identity"` (`RateLimitingOptions.cs:35`) attaches via `.RequireRateLimiting(RateLimitingOptions.StrictPolicyName)` (`IdentityEndpoints.cs:91`). External routes inherit the global limiter for free; a dedicated `"external-api"` policy is optional (DEC in E8-S2).
- **Module enforcement (E10):** `ModuleKeys.cs:17-41` keys = `members,events,documents,communication,finance,partners,public_view`; **no api/integrations key**. Seed shape: `20260514181057_AddModuleSettings.cs:62-74` (fixed Guids, all `enabled=true`, single-tenant ADR-007). Gate pattern: `.RequireAuthorization("Module:x")` (`AutomationEndpoints.cs:22-23`). **Self-lockout caveat:** the module-settings admin group is never `Module:`-gated (`ModuleSettingsEndpoints.cs:8-15`) — likewise the admin credential-management endpoints must not be gated by the new key (only the external consumer routes are).
- **Admin CRUD + audit template:** `CustomRoleEndpoints.cs` — admin group `RequireRole("admin")` (`:30-32`), create/delete each call `IAuditService.LogActionAsync(AuditEventType.SettingsChanged, ...)` directly (`:115-121,:187-192`). Audit signature `IAuditService.cs:53-61`. Audit enum `AuditEnums.cs:6-55` (`SettingsChanged:49`; unknown categories default to `System`). Lifecycle sub-routes (activate/pause/disable) template = `AutomationEndpoints.cs:18-38`.

### Files to change

- Domain (new): `IabConnect.Domain/Integration/ApiClient.cs`, `ApiScopes.cs`.
- Infrastructure (new): `Persistence/Configurations/ApiClientConfiguration.cs`; `Persistence/Repositories/ApiClientRepository.cs` (+ `IApiClientRepository` in Application/Domain); `Integration/ApiKeyHashingService.cs` + `ApiKeyOptions.cs`; one EF migration under `Migrations`.
- API (new): `Authentication/ApiKeyAuthenticationHandler.cs` (+ scheme options); `Authorization/ScopeRequirement.cs` + `ScopeAuthorizationHandler.cs`; `Endpoints/ApiClientEndpoints.cs`.
- API (modified): `DependencyInjection.cs` (register second auth scheme, scope handler, hashing service, repository; wire endpoints), `Authorization/PermissionAuthorizationHandler.cs` (`Scope:` prefix branch), `Endpoints/EndpointMapper.cs` (map group), `Domain/Audit/AuditEnums.cs` (new event types), `Domain/Common/ModuleKeys.cs` (+ seed migration).
- Frontend (new): `frontend/src/app/admin/api-clients/` page(s) + typed API wrapper under `frontend/src/lib/services`.
- Frontend (modified): `frontend/messages/{de,en,hi}.json`.
- Tests: domain, hashing, Testcontainers repository, API auth/scope/admin, frontend.

### Scope Boundaries

In scope:

- `ApiClient` + scope model (domain → EF → migration → admin CRUD).
- API-key authentication scheme, `Scope:` authorization, new module key + seed, secret show-once + token-safe hashing.
- The enforcement **primitives** external routes use (scheme + scope policy + module gate + rate-limit attach point).

Out of scope:

- The concrete external read endpoints (E8-S2 consumes these primitives).
- Webhooks (E8-S3/S4).
- OAuth2 client-credentials/token-exchange flows, per-client rate-limit quotas, SSRF concerns (webhook-only).
- Any change to the existing JWT/Keycloak auth for first-party users.

### Architecture Guardrails

- Clean Architecture: `ApiClient` invariants in Domain (private setters + explicit methods); use cases in Application; EF/hashing/auth-handler in Infrastructure/API; thin endpoints; `CancellationToken` through.
- Backend is the only security boundary. UI hiding is not security — every external route is authorized by scheme + scope server-side.
- EF schema change via a migration under `Migrations` (additive; verify the latest timestamp at Task 0). Never manual schema changes.
- **Never store or log the raw secret.** Persist only the hash; the one-time secret leaves the system exactly once in the create/rotate response. Verify with `FixedTimeEquals` (no `==`/`SequenceEqual` on secrets).
- The new auth scheme must be additive: absent key header → `NoResult()` so existing JWT routes return their normal 401, not a new failure mode.
- Frontend: shared components, standard layout, orange primary, next-intl (de/en/hi parity), no hardcoded strings.

### Testing Requirements

- Backend: xUnit v3 + FluentAssertions; Moq only for external boundaries. Domain unit tests; hashing round-trip + tamper-reject; Testcontainers PostgreSQL for the repository + migration apply (NOT EF InMemory). API tests via `Mvc.Testing`: scheme authenticates, scope 403/200, revoked 401, header-absent JWT no-regress, rate-limit attach, admin create-once + audit, list-no-leak.
- Frontend: Vitest + Testing Library; stable `useTranslations` mock (A64); `afterEach(cleanup)` + jsdom for `render()` tests (A35/A46).
- Gates: `dotnet test`; `npx eslint`/`prettier --check` on changed files (A58/A72) + `vitest run`.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — API-key auth: second `AuthenticationHandler` vs middleware.**
  - (A, recommended) **Second named `AuthenticationScheme` (`"ApiKey"`) + custom `AuthenticationHandler`**, applied per-route-group via `AuthenticationSchemes="ApiKey"`. Rationale: exact precedent `TestAuthHandler.cs`; integrates with the existing `[Authorize]`/policy/rate-limiter pipeline that reads `httpContext.User`; avoids bespoke middleware-ordering risk.
  - (B) Custom middleware that validates the key and sets `User`. Rejected: re-implements what `AuthenticationHandler` gives for free and risks ordering bugs vs `UseAuthentication`/`UseAuthorization`/`UseRateLimiter`.
- **DEC-2 — Scope model: string set vs enum.**
  - (A, recommended) **String scopes** (e.g. `events:read`) validated against a closed `ApiScopes.All` set, enforced by a `Scope:` policy prefix on the existing provider. Rationale: mirrors the string-keyed `Permission:`/`Module:` providers + `ModuleKeys.All` validation; OAuth-style space-delimited grants; no enum-home (A69) churn as scopes grow.
  - (B) A `Scope` enum in Domain. Rejected: heavier, diverges from the shipped string-keyed policy pattern; enum-migration churn per new scope.
- **DEC-3 — Module gating: new `api` key vs reuse an existing key.**
  - (A, recommended) **New `api` (or `integrations`) module key** + seed row (`enabled=true`). Rationale: the epic mandates day-one module coverage; no existing key fits an external integration surface; additive default-enabled seed is behavior-preserving. Gate only consumer routes, never admin CRUD (self-lockout).
  - (B) Reuse e.g. `members`/`public_view`. Rejected: conflates unrelated surfaces; disabling that module would wrongly also disable the external API (or vice-versa).
- **DEC-4 — Secret hashing: reuse `HMAC-SHA256(pepper, SHA256(secret))` vs password-style KDF (PBKDF2/Argon2).**
  - (A, recommended) **Reuse the `Member.HashCalendarToken` HMAC-pepper formula** with a new `Auth:ApiKeyPepper` option; verify with `FixedTimeEquals`. Rationale: API secrets are 256-bit random tokens (high entropy), so a slow KDF adds per-request latency on the hot auth path for no security gain; the token-hash precedent is the right proven primitive.
  - (B) PBKDF2/Argon2. Rejected: designed for low-entropy passwords; needless latency on every authenticated external request.

### Project Structure Notes

- Backend: `IabConnect.Domain/Integration`, `IabConnect.Application/Integration`, `IabConnect.Infrastructure/{Persistence/Configurations,Persistence/Repositories,Integration,Migrations}`, `IabConnect.Api/{Authentication,Authorization,Endpoints}`.
- Backend tests: `IabConnect.Application.Tests` (domain/scopes), `IabConnect.Infrastructure.Tests` (Testcontainers repo/hashing), `IabConnect.Api.Tests` (scheme/scope/admin + the A63 harness registrations).
- Frontend: `frontend/src/app/admin/api-clients`, `frontend/src/lib/services`, `frontend/messages/{de,en,hi}.json`.

### References

- `backend/src/IabConnect.Api/DependencyInjection.cs:177-207` (JWT scheme), `:244,:249,:262` (policy provider / module handler / rate limiter registration), `:452` (`MapApiEndpoints`)
- `backend/tests/IabConnect.Api.Tests/TestAuthHandler.cs:20`, `TestWebApplicationFactory.cs:103-105` (second-scheme template)
- `backend/src/IabConnect.Domain/Members/Member.cs:37,160-207` (show-once token + HMAC-pepper hash), `backend/src/IabConnect.Infrastructure/Email/UnsubscribeTokenService.cs:55,61-65` (FixedTimeEquals), `CalendarTokenOptions.cs` / `Events/CalendarTokenService.cs:25-31` (pepper-from-config)
- `backend/src/IabConnect.Api/Authorization/PermissionAuthorizationHandler.cs:68-112` (policy provider), `ModuleAuthorizationHandler.cs:13,36` (handler template)
- `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs:40,79`, `RateLimitingOptions.cs:35` (`strict-identity`), `Endpoints/IdentityEndpoints.cs:91` (attach)
- `backend/src/IabConnect.Domain/Common/ModuleKeys.cs:17-41`, `Migrations/20260514181057_AddModuleSettings.cs:62-74`, `Endpoints/ModuleSettingsEndpoints.cs:8-15` (self-lockout)
- `backend/src/IabConnect.Api/Endpoints/CustomRoleEndpoints.cs:17-32,115-121,187-192` (admin CRUD + audit), `Application/Audit/IAuditService.cs:53-61`, `Domain/Audit/AuditEnums.cs:6-55`
- `_bmad-output/planning-artifacts/architecture.md:739-758` (REQ-058 API/Webhooks), `:817-830` (authorization matrix), `:832-846` (audit)
- `_bmad-output/planning-artifacts/prd.md:428-435` (REQ-058 ACs); `_bmad-output/planning-artifacts/epics-and-stories.md:860-882` (E8-S1 source)
- `_bmad-output/project-context.md` (A56 spike, A58/A72 gates, A63 harness DI, A65 multi-surface, A69 enum-home)

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-8 dev-ready prep (A34). Stub placeholder ACs + stale MFA tech context replaced with spike-grounded, `file:line`-anchored tasks across the full backend→frontend slice.
- Checklist coverage: ACs concrete + testable; greenfield confirmed with reuse precedents (no wheel-reinvention); auth-scheme/hashing/scope/module/audit anchors named; security guardrails (no raw secret, FixedTimeEquals, additive scheme); A63 harness-DI + A58/A72 gates enforced.
- Remaining risk: this story is the **foundation** of the S1→S2→S3→S4 chain — DEC-1..4 are load-bearing for all downstream stories. Confirm the latest migration timestamp at Task 0 (it advances per epic). The exact Application use-case file names follow the module convention; the spike named the entities, endpoints, auth/policy seams.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — autonomous full-epic dev-story run (E8 S1→S4).

### Debug Log References

DEC resolutions (A41 autonomous-mode, all recommended option A) — (a) decision / (b) rationale / (c) evidence:
- **DEC-1 = A** second named `AuthenticationScheme "ApiKey"` + `AuthenticationHandler`; integrates with the existing policy/rate-limiter pipeline (precedent `TestAuthHandler`); registered additively after `AddJwtBearer`, default scheme unchanged; absent-header → `NoResult` (JWT no-regression test green).
- **DEC-2 = A** string scope set validated vs `ApiScopes.All` + `Scope:` policy prefix; mirrors shipped `Permission:`/`Module:` providers; stored comma-joined; `events:read`/`blog:read` defined for S2.
- **DEC-3 = A** new `api` module key + seed row `a1000000-…-008` (`enabled=true`, behaviour-preserving); gates only consumer routes (S2/S3); admin CRUD `RequireAdmin` only (self-lockout rule).
- **DEC-4 = A** reuse `HMAC-SHA256(pepper, SHA256(secret))` via new `Auth:ApiKeyPepper`, `FixedTimeEquals` verify; 256-bit random tokens need no slow KDF.

### Completion Notes List

- ✅ AC-1 create/revoke admin CRUD (`/api/v1/admin/api-clients`) via MediatR + FluentValidation.
- ✅ AC-2 secret returned exactly once (create response only); only `HMAC-SHA256(pepper, SHA256)` hash + non-secret prefix persisted; `FixedTimeEquals` verify. Tests assert the stored row never contains the raw secret + list never leaks the hash.
- ✅ AC-3 `Scope:` policy + `ScopeAuthorizationHandler` → 403 when scope absent; scope claims emitted by the ApiKey handler.
- ✅ AC-4 audit `ApiClientCreated`/`ApiClientRevoked`/`ApiClientAuthenticationFailed` via `IAuditService`.
- ✅ AC-5 enforcement primitives delivered: `ApiKey` scheme + `Scope:` policy + `Module:api` gate + global rate-limit attach point. **A65 honesty:** primitives are unit/handler-tested in S1; the end-to-end HTTP 403/200 scope flow + `Module:api` gate on real external routes is exercised in **E8-S2** (which lands the first external endpoints).
- **Quality gates:** backend solution `dotnet test` **2321 passed / 0 failed** (1567 Application + 267 Api + 487 Infrastructure incl. Testcontainers); migration `20260607112716_AddApiClients` applies clean + seeds the 8th module row (ModuleSettings count tests bumped 7→8). Frontend: `tsc` clean; `eslint`/`prettier --check` clean on changed files; `vitest` page + de/en/hi parity green. Security self-check: no raw secret persisted/logged; `FixedTimeEquals` on verify; new scheme additive.

### File List

Backend (new): `Domain/Integration/{ApiClient,ApiScopes,IApiClientRepository}.cs`; `Application/Integration/{IApiKeyHashingService,ApiClientDtos}.cs` + `Commands/{CreateApiClientCommand,CreateApiClientCommandHandler,CreateApiClientCommandValidator,RevokeApiClientCommand}.cs` + `Queries/ListApiClientsQuery.cs`; `Infrastructure/Integration/{ApiKeyOptions,ApiKeyHashingService}.cs` + `Persistence/Configurations/ApiClientConfiguration.cs` + `Persistence/Repositories/ApiClientRepository.cs` + `Migrations/20260607112716_AddApiClients.cs`(+Designer); `Api/Authentication/ApiKeyAuthenticationHandler.cs` + `Authorization/ScopeAuthorizationHandler.cs` + `Endpoints/ApiClientEndpoints.cs`.
Backend (modified): `Domain/Common/ModuleKeys.cs`, `Domain/Audit/AuditEnums.cs`, `Api/Authorization/PermissionAuthorizationHandler.cs`, `Api/DependencyInjection.cs`, `Api/Endpoints/EndpointMapper.cs`, `Infrastructure/DependencyInjection.cs`, `Infrastructure/Persistence/ApplicationDbContext.cs`.
Backend (tests new): `Application.Tests/Integration/ApiClientTests.cs`; `Infrastructure.Tests/Integration/ApiKeyHashingServiceTests.cs`, `Repositories/ApiClientRepositoryTests.cs`; `Api.Tests/Authorization/ScopeAuthorizationTests.cs`, `Authentication/ApiKeyAuthenticationHandlerTests.cs`, `Endpoints/ApiClientEndpointTests.cs`. (modified 7→8): `Application.Tests/ModuleSettings/ModuleSettingsCommandQueryTests.cs`, `Infrastructure.Tests/Repositories/ModuleSettingsMigrationTests.cs`.
Frontend (new): `app/admin/api-clients/page.tsx`(+`page.test.tsx`), `lib/api/apiClients.ts`. (modified): `messages/{de,en,hi}.json`.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Implemented (autonomous E8 run). All DECs → option A. Backend 2321 tests green; frontend page + i18n parity green. Status → review.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 greenfield spike (no ApiClient/API-key auth; reuse TestAuthHandler scheme + Member calendar-token hash + PermissionPolicyProvider + ModuleKeys + CustomRoleEndpoints audit), DEC-1..4, full backend→frontend slice, foundation for the S1→S2→S3→S4 chain.
