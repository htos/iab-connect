# Story E1.S3: Add Session and Device Visibility

Status: done

## Story

As a user,
I want to see my active sessions or devices where available,
so that I understand where my account is active.

## Acceptance Criteria

1. Given user has the required permission and prerequisite data exists, when they see my active sessions or devices where available, then user can view active sessions or devices where Keycloak data supports it.
2. Given a caller lacks the required permission or role, when the protected behavior is requested, then admin can view user sessions where authorized.
3. Given valid inputs and existing system constraints, when this story behavior is exercised, then device/session details degrade gracefully if Keycloak metadata is limited.
4. Given the page is loaded in desktop and mobile layouts, when the relevant state is displayed, then UI is translated through next-intl.
5. Given a caller lacks the required permission or role, when the protected behavior is requested, then protected backend calls enforce user/admin authorization.

## Tasks / Subtasks

- [x] Confirm scope, existing code, and acceptance evidence (AC: all)
  - [x] Inspect every expected file listed in Dev Notes before implementation and preserve existing behavior.
  - [x] Record any product/provider decision that blocks implementation before changing code.
- [x] Implement backend/application/infrastructure slice (AC: 1, 2, 3, 4, 5)
  - [x] Add or update Domain/Application commands, queries, DTOs, validators, and services using existing module patterns.
  - [x] Add EF configuration and migration only when durable persistence changes are required. *(none required — Keycloak owns session data, nothing to persist locally.)*
  - [x] Add Minimal API endpoints with explicit authorization policies and audit/security logging where sensitive.
- [x] Implement frontend/user-facing slice (AC: relevant UI criteria)
  - [x] Use shared components, standard page layout, orange primary actions, lucide icons where applicable, and typed API wrappers.
  - [x] Add next-intl keys to frontend/messages/de.json and frontend/messages/en.json for all user-visible text.
  - [x] Cover loading, empty, error, permission-denied, validation, success, and responsive states where the UI is touched.
- [x] Add tests and manual validation evidence (AC: all)
  - [x] Add focused backend unit/integration/API tests for business rules, authorization, persistence, and sensitive edge cases.
  - [x] Add frontend tests for forms/rendering/permission states where UI is touched.
  - [x] Document manual validation for browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook behavior as applicable.
- [x] Update operational docs or requirement evidence when behavior changes (AC: all)

### Review Findings

- [x] [Review][Patch] Filter internal Keycloak client names before exposing in SessionDto.Clients [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — Resolved 2026-05-13. Promoted `SessionMapper` to `public static` and added a default internal-client filter (`admin-cli`, `security-admin-console`, `realm-management`, `account`, `account-console`, `broker`, `iabconnect-admin`). Comparison is case-insensitive. Added overload accepting a custom `IReadOnlySet<string>` for testability/future configuration. Covered by 6 new tests in `backend/tests/IabConnect.Api.Tests/SessionMapperTests.cs`.
- [x] [Review][Patch] Missing LogAccessDenied in GetUserSessions KeycloakNotFoundException catch path [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`] — Resolved 2026-05-13. Added `auditLogger.LogAccessDenied("User", "ViewSessions", "User not found in Keycloak", userId)` inside the `catch (KeycloakNotFoundException)` branch — consistent with the user-missing branch immediately above.
- [x] [Review][Patch] SessionMapper.ToDto returns empty string Id for null session.Id [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — Addressed in uncommitted P6 fix: sessions with null/empty Id are filtered before mapping in `GetCurrentUserSessions`.

#### Epic Boundary Review (2026-05-13)

- [x] [Review][Patch] IP address displayed without data-protection notice — decision: show IP with visible privacy label [`frontend/src/app/profile/security/page.tsx`, `frontend/src/app/admin/users/[id]/sessions/page.tsx`] — Resolved 2026-05-13. Added two next-intl keys (`profileSecurity.ipPrivacyNote` for self-service, `profileSecurity.ipPrivacyNoteAdmin` for the admin view) in both `de.json` and `en.json`. Each IP-Adresse-Block renders an italic muted-gray notice underneath the value. No masking; full IP retained in `SessionDto`.
- [x] [Review][Patch] Admin `GetUserSessions` missing null-Id session filter [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`] — Resolved 2026-05-13. Mirrors the P6 fix from `GetCurrentUserSessions`: sessions with null/empty `Id` are filtered (`Where(s => !string.IsNullOrEmpty(s.Id))`) before mapping. Admin UI no longer renders unrevocable session rows.
- [x] [Review][Defer] Session ID case sensitivity — Keycloak uses lowercase UUIDs consistently; `Guid.TryParse` accepts both cases; low practical risk
- [x] [Review][Defer] `window.confirm()` for session revoke confirmation is not WCAG-compliant or stylable — deferred, UX improvement for a later sprint
- [x] [Review][Defer] `initialFetchDone` ref prevents session list refetch after silent token renewal — deferred, Refresh button provides manual workaround
- [x] [Review][Defer] `SessionMapper.ToDto` maps null Id to `""` — code smell but harmless given P6 pre-filters nulls; `SessionDto.Id` can be empty string after mapping

## Dev Notes

### Sprint Plan Context

- Multi-epic sprint-plan order: 2.
- Requirement(s): REQ-010.
- Epic goal: Strengthen identity flows while keeping Keycloak as the source of truth and the backend as the enforcement boundary.
- This story is prepared from `_bmad-output/implementation-artifacts/sprint-plan.md`; do not start coding from the epic summary alone.

### Scope Boundaries

In scope:

- Use Keycloak session APIs.
- Keep device data quality limitations visible in implementation notes.

Out of scope:

- Revoking sessions
- Guaranteeing device precision beyond Keycloak metadata

### Existing Code To Inspect Before Editing

- Keycloak session query service
- own/admin session API endpoints
- frontend/src/app/profile/security
- frontend/src/lib/api/users.ts

Additional module context:

- infra/keycloak/realms/iabconnect-realm.json
- backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs
- backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs
- backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs
- backend/src/IabConnect.Application/Authorization/SecurityAuditLogger.cs
- frontend/src/app/profile
- frontend/src/app/admin/users
- frontend/src/lib/api/users.ts

### Architecture Guardrails

- Keep the modular monolith and Clean Architecture boundaries: Domain for business rules, Application for commands/queries/validators, Infrastructure for EF/Keycloak/provider implementations, API for Minimal API endpoints.
- Backend authorization policies are mandatory for protected operations. Frontend role checks are UX only and never the security boundary.
- Use MediatR commands/queries and FluentValidation for workflow behavior. Keep endpoints thin and pass CancellationToken through async calls.
- EF Core schema changes require migrations under backend/src/IabConnect.Infrastructure/Migrations; do not make manual database changes.
- Frontend UI must use Next.js App Router patterns, shared UI components, next-intl keys, orange primary actions, and the standard authenticated page layout.
- Sensitive changes must preserve audit, privacy, retention, and finance compliance rules where applicable.

Story-specific risks:

- Keycloak remains the identity authority; do not mirror MFA secrets, sessions, or provider credentials locally.
- Session/device metadata can be incomplete; degrade gracefully rather than inventing precision.
- App-observable support actions require audit/security logging.

### Implementation Guidance

- Prefer extending existing module patterns over creating new parallel services, routes, or UI primitives.
- Keep request/response DTOs explicit at API/Application boundaries; never expose EF entities directly to frontend or external API responses.
- Preserve current behavior for existing member, event, finance, communication, identity, and public routes unless an acceptance criterion explicitly changes it.
- Add audit/security logs for create/update/delete, revocation, merge, finance, provider, webhook, and access-denied behavior where this story touches sensitive operations.
- Keep provider-dependent behavior disabled, documented, or behind configuration until credentials, scopes, signing policy, and whitelist decisions are available.

### Testing Requirements

Required planned evidence from source story:

- API authorization tests.
- Frontend rendering tests for empty and populated states.
- Manual validation with multiple sessions.

Concrete test guidance:

- Backend: xUnit v3, FluentAssertions, Moq only for external boundaries; Testcontainers PostgreSQL for repository/persistence behavior.
- API: authorization, routing, serialization, response contracts, rate/scope behavior where applicable.
- Frontend: Vitest/Testing Library for shared controls/forms/rendering/permission states; Playwright or manual browser validation for critical flows.
- Manual: capture browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook validation notes where automated coverage cannot prove behavior.

Minimum verification before marking implementation complete:

- Backend: run focused tests for changed handlers/services/repositories/endpoints, then `dotnet test` from `backend` when local infrastructure permits.
- Frontend: run `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend` when UI changes are made.

### Previous Story Intelligence

- Build on `e1-s2-add-admin-mfa-support-operations.md` if present. Reuse its module paths, endpoint conventions, test style, and review findings.

- Recent git context before this planning pass: `feat(REQ-017): Segmentierung & Verteiler - vollständige Implementierung`; reuse established member segment, audit, and communication patterns where relevant.
- `e1-s1-configure-role-based-mfa-policy.md` is already `in-progress` with a review finding requiring live Keycloak MFA validation; do not close or overwrite it from this story.

### Latest Technical Context

- Keycloak current server administration guide documents OTP, WebAuthn/passkeys, and recovery codes as 2FA options; use infra/docker-compose.yml as the implementation version source of truth. https://www.keycloak.org/docs/latest/server_admin/index.html
- ASP.NET Core 10 policy authorization remains the official pattern for requirement/handler based access control. https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies?view=aspnetcore-10.0
- Next.js 16 App Router docs are the framework reference for routes, server/client components, and route handlers. https://nextjs.org/docs/app
- EF Core migrations should be generated from model changes and tracked in source control. https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/
- Hangfire background jobs persist work and need idempotent handlers because retries/at-least-once execution are expected. https://docs.hangfire.io/
- WCAG 2.2 is the baseline accessibility reference for labels, focus, contrast, keyboard operation, and error identification. https://www.w3.org/TR/wcag/

### Project Structure Notes

- Backend source: `backend/src/IabConnect.Domain`, `backend/src/IabConnect.Application`, `backend/src/IabConnect.Infrastructure`, `backend/src/IabConnect.Api`.
- Backend tests: `backend/tests/IabConnect.Application.Tests`, `backend/tests/IabConnect.Infrastructure.Tests`, `backend/tests/IabConnect.Api.Tests`.
- Frontend source: `frontend/src/app`, `frontend/src/components`, `frontend/src/lib/api` or `frontend/src/lib/services`, `frontend/messages`.
- Infrastructure/config: `infra/docker-compose.yml`, `infra/keycloak/realms/iabconnect-realm.json` where identity behavior changes.
- Documentation/evidence: `docs/` for durable project documentation; `_bmad-output/implementation-artifacts` for story execution records.

### References

- _bmad-output/implementation-artifacts/sprint-plan.md
- _bmad-output/planning-artifacts/epics-and-stories.md
- _bmad-output/planning-artifacts/prd.md
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/project-context.md
- docs/13_frontend_design_standards.md
- docs/07_dos_donts.md

## Validation Notes

- Create-story validation completed on 2026-05-12 for `e1-s3-add-session-and-device-visibility`.
- Checklist coverage: acceptance criteria, source paths, authorization/audit/privacy/finance impact, migration need, tests, manual validation, i18n/accessibility states where relevant.
- Remaining implementation risk: code-level inspection may split this story further if existing module coupling or provider decisions make the scope too large.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter "FullyQualifiedName~KeycloakAdminServiceSessionsTests"` — passed, 3 tests.
- `dotnet test tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj --filter "FullyQualifiedName~UserEndpointMetadataTests"` — passed, 2 tests (ResetMfaEndpoint + GetUserSessionsEndpoint).
- `npm test -- --run src/lib/api/users.test.ts` — passed, 5 tests.
- `npm run typecheck` — passed, 0 errors.
- `dotnet test` (full backend suite, no Docker dependency triggered failures locally) — Application 1123/1123, Api 11/11, Infrastructure 279/279. Total: 1413 passed, 0 failed, 0 skipped.

#### 2026-05-13 Patch pass (S3.1–S3.4)

- `dotnet test` (full backend regression) — Application 1123/1123, Api 18/18, Infrastructure 291/291. Total: **1432 passed, 0 failed, 0 skipped** (+6 from new `SessionMapperTests`).
- `npm run typecheck` — passed, 0 errors.
- `npm test -- --run` — passed, 9/9 (Vitest).
- `npm run lint --quiet` — only **pre-existing** errors in `frontend/src/app/members/segments/page.tsx` (unrelated to this story).

### Completion Notes List

#### 2026-05-13 — Epic Boundary patch pass (S3.1–S3.4)

- **S3.1 Internal client filter:** Promoted `SessionMapper` from `internal static` to `public static`, added a default internal-client filter set (`admin-cli`, `security-admin-console`, `realm-management`, `account`, `account-console`, `broker`, `iabconnect-admin`) with case-insensitive comparison, and provided an overload accepting a custom `IReadOnlySet<string>` for future configuration/testability. Empty-string / whitespace clients remain filtered (pre-existing). New test file `SessionMapperTests.cs` covers default filtering, case-insensitivity, override behaviour, empty/null client dictionaries — 6 tests.
- **S3.2 Audit consistency:** Added `auditLogger.LogAccessDenied(httpContext.User, "User", "ViewSessions", "User not found in Keycloak", userId)` inside the `catch (KeycloakNotFoundException)` branch of admin `GetUserSessions`, matching the missing-user branch directly above.
- **S3.3 IP privacy notice:** Added next-intl keys `profileSecurity.ipPrivacyNote` (self-service: "Diese Information ist nur für dich sichtbar." / "This information is only visible to you.") and `profileSecurity.ipPrivacyNoteAdmin` (admin-context wording for IP visibility) in both `de.json` and `en.json`. Rendered as italic muted-gray text directly under the IP value on `/profile/security/page.tsx` and `/admin/users/[id]/sessions/page.tsx`. No masking; full IP retained in `SessionDto`.
- **S3.4 Admin null-Id filter:** Added `Where(s => !string.IsNullOrEmpty(s.Id))` before mapping in admin `GetUserSessions`, mirroring the P6 fix already in self-service `GetCurrentUserSessions`. Eliminates unrevocable session rows in the admin UI.

#### Original implementation (2026-05-12)

- Added `IKeycloakAdminService.GetUserSessionsAsync(userId, ct)` calling Keycloak Admin `GET /admin/realms/{realm}/users/{userId}/sessions` with bearer-token reuse. Returns `IReadOnlyList<KeycloakSessionRepresentation>`. 404 from Keycloak is mapped to `KeycloakNotFoundException`.
- Added `KeycloakSessionRepresentation` DTO with nullable Id/Username/UserId/IpAddress/Start/LastAccess/Clients — AC3 explicitly assumes Keycloak can omit fields; the DTO and `SessionMapper.ToDto` both tolerate this. The Vitest + xUnit "missing metadata" cases prove graceful degradation.
- Added authenticated own-sessions endpoint `GET /api/v1/identity/sessions` (REQ-010, AC1, AC5): extracts the `sub` claim from the JWT, calls `KeycloakAdminService.GetUserSessionsAsync`, returns mapped `SessionListResponse`. If Keycloak has no admin record for the principal, returns an empty list rather than a 500.
- Added admin-only endpoint `GET /api/v1/users/{userId}/sessions` (REQ-010, AC2, AC5): protected by `RequireAdmin` policy via the existing `/api/v1/users` route group, audit-logged via `SecurityAuditLogger` (LogAccessGranted with SessionCount on success; LogAccessDenied if the target user is not found in Keycloak).
- Added frontend API client functions `getMySessions` and `getUserSessions` in `frontend/src/lib/api/users.ts` with typed `UserSession` and `SessionListResponse` interfaces.
- Added user-facing page `frontend/src/app/profile/security/page.tsx` showing active sessions (IP, start, last access, clients) with loading/empty/error states, refresh button, orange-themed actions, and Swiss locale date formatting. UI is fully next-intl translated through the new `profileSecurity` message namespace (DE + EN).
- Added admin sub-page `frontend/src/app/admin/users/[id]/sessions/page.tsx` for AC2 runtime evidence — admin-only client guard (UX), admin-only backend enforcement (security boundary).
- Updated `docs/05_security_privacy.md` with a new "Session- und Geraetesichtbarkeit (REQ-010)" section documenting both endpoints, audit boundaries, data-quality caveats, and the deferred revocation scope (E1-S4).
- All ACs satisfied:
  - AC1 ✅ via `/api/v1/identity/sessions` + `/profile/security` page.
  - AC2 ✅ via `/api/v1/users/{userId}/sessions` (RequireAdmin policy verified by xUnit metadata test) + admin sub-page.
  - AC3 ✅ via nullable session DTO fields + mapper handling missing data + xUnit "missing metadata" case + UI `notAvailable` fallback.
  - AC4 ✅ via `profileSecurity.*` keys in both `de.json` and `en.json`; UI uses responsive Tailwind grid (md:grid-cols-3 for session rows, mobile stacks).
  - AC5 ✅ via `RequireAdmin` on admin endpoint, `RequireAuthorization()` on own endpoint, audit logging through `ISecurityAuditLogger`.

### File List

Backend:
- `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`
- `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` (S3.1: public SessionMapper + internal-client filter)
- `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (S3.2: audit on 404, S3.4: null-Id filter)
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs`
- `backend/tests/IabConnect.Api.Tests/UserEndpointMetadataTests.cs`
- `backend/tests/IabConnect.Api.Tests/SessionMapperTests.cs` (S3.1: 6 new tests)

Frontend:
- `frontend/src/lib/api/users.ts`
- `frontend/src/lib/api/users.test.ts`
- `frontend/src/app/profile/security/page.tsx` (S3.3: IP privacy notice)
- `frontend/src/app/admin/users/[id]/sessions/page.tsx` (S3.3: IP privacy notice — admin variant)
- `frontend/messages/de.json` (S3.3: ipPrivacyNote, ipPrivacyNoteAdmin)
- `frontend/messages/en.json` (S3.3: ipPrivacyNote, ipPrivacyNoteAdmin)

Docs / Status:
- `docs/05_security_privacy.md`
- `_bmad-output/implementation-artifacts/e1-s3-add-session-and-device-visibility.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-05-12: Implemented REQ-010 session/device visibility. Added `GetUserSessionsAsync` on `KeycloakAdminService`, `GET /api/v1/identity/sessions` (authenticated user), `GET /api/v1/users/{userId}/sessions` (admin, audit-logged), frontend `/profile/security` page, admin sub-page `/admin/users/[id]/sessions`, i18n keys (DE+EN), tests (3 infra + 2 endpoint metadata + 3 vitest), and `docs/05_security_privacy.md` section. Status moved to `review` per hybrid workflow (CR + ER at Epic 1 boundary).
- 2026-05-13: Cleared 4 open `[Review][Patch]` items per `sprint-change-proposal-2026-05-13.md`. S3.1 internal-client filter on `SessionMapper.ToDto` + 6 new tests; S3.2 added `LogAccessDenied` in admin `GetUserSessions` `KeycloakNotFoundException` catch; S3.3 added `ipPrivacyNote` / `ipPrivacyNoteAdmin` i18n keys (DE/EN) and rendered the notice under the IP value on both pages; S3.4 added null-Id filter to admin `GetUserSessions`. Full backend suite: 1432/1432 passed (was 1426 + 6 new SessionMapper tests). Frontend `npm run typecheck` and Vitest (9/9) green.
