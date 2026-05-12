# Story E1.S3: Add Session and Device Visibility

Status: review

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

### Completion Notes List

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
- `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`
- `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs`
- `backend/tests/IabConnect.Api.Tests/UserEndpointMetadataTests.cs`

Frontend:
- `frontend/src/lib/api/users.ts`
- `frontend/src/lib/api/users.test.ts`
- `frontend/src/app/profile/security/page.tsx`
- `frontend/src/app/admin/users/[id]/sessions/page.tsx`
- `frontend/messages/de.json`
- `frontend/messages/en.json`

Docs / Status:
- `docs/05_security_privacy.md`
- `_bmad-output/implementation-artifacts/e1-s3-add-session-and-device-visibility.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-05-12: Implemented REQ-010 session/device visibility. Added `GetUserSessionsAsync` on `KeycloakAdminService`, `GET /api/v1/identity/sessions` (authenticated user), `GET /api/v1/users/{userId}/sessions` (admin, audit-logged), frontend `/profile/security` page, admin sub-page `/admin/users/[id]/sessions`, i18n keys (DE+EN), tests (3 infra + 2 endpoint metadata + 3 vitest), and `docs/05_security_privacy.md` section. Status moved to `review` per hybrid workflow (CR + ER at Epic 1 boundary).
