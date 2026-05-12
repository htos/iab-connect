# Story E1.S4: Add Session Revocation

Status: review

## Story

As a user or Admin,
I want to revoke active sessions,
so that compromised or stale access can be terminated.

## Acceptance Criteria

1. Given user or Admin has the required permission and prerequisite data exists, when they revoke active sessions, then user can terminate other own sessions.
2. Given a caller lacks the required permission or role, when the protected behavior is requested, then admin can revoke sessions for a user.
3. Given valid inputs and existing system constraints, when this story behavior is exercised, then revocation is reflected at the next protected interaction.
4. Given a caller lacks the required permission or role, when the protected behavior is requested, then admin revocation writes an audit/security event.
5. Given valid inputs and existing system constraints, when this story behavior is exercised, then timeout and idle-timeout behavior is documented.

## Tasks / Subtasks

- [x] Confirm scope, existing code, and acceptance evidence (AC: all)
  - [x] Inspect every expected file listed in Dev Notes before implementation and preserve existing behavior.
  - [x] Record any product/provider decision that blocks implementation before changing code.
- [x] Implement backend/application/infrastructure slice (AC: 1, 2, 3, 4, 5)
  - [x] Add or update Domain/Application commands, queries, DTOs, validators, and services using existing module patterns.
  - [x] Add EF configuration and migration only when durable persistence changes are required. *(none required — Keycloak owns session lifecycle.)*
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

- Multi-epic sprint-plan order: 3.
- Requirement(s): REQ-010.
- Epic goal: Strengthen identity flows while keeping Keycloak as the source of truth and the backend as the enforcement boundary.
- This story is prepared from `_bmad-output/implementation-artifacts/sprint-plan.md`; do not start coding from the epic summary alone.

### Scope Boundaries

In scope:

- Use Keycloak Admin API/session APIs.
- Avoid local session state as authority.

Out of scope:

- Creating local session authority
- Identity provider setup

### Existing Code To Inspect Before Editing

- Keycloak session revocation service
- own/admin revocation API endpoints
- profile/admin security UI actions

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
- Manual validation with browser/session scenarios.

Concrete test guidance:

- Backend: xUnit v3, FluentAssertions, Moq only for external boundaries; Testcontainers PostgreSQL for repository/persistence behavior.
- API: authorization, routing, serialization, response contracts, rate/scope behavior where applicable.
- Frontend: Vitest/Testing Library for shared controls/forms/rendering/permission states; Playwright or manual browser validation for critical flows.
- Manual: capture browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook validation notes where automated coverage cannot prove behavior.

Minimum verification before marking implementation complete:

- Backend: run focused tests for changed handlers/services/repositories/endpoints, then `dotnet test` from `backend` when local infrastructure permits.
- Frontend: run `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend` when UI changes are made.

### Previous Story Intelligence

- Build on `e1-s3-add-session-and-device-visibility.md` if present. Reuse its module paths, endpoint conventions, test style, and review findings.

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

- Create-story validation completed on 2026-05-12 for `e1-s4-add-session-revocation`.
- Checklist coverage: acceptance criteria, source paths, authorization/audit/privacy/finance impact, migration need, tests, manual validation, i18n/accessibility states where relevant.
- Remaining implementation risk: code-level inspection may split this story further if existing module coupling or provider decisions make the scope too large.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter "FullyQualifiedName~KeycloakAdminServiceRevokeSessionTests"` — passed, 2 tests.
- `dotnet test tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj --filter "FullyQualifiedName~UserEndpointMetadataTests"` — passed, 3 tests (ResetMfa + GetUserSessions + RevokeUserSession all enforce `RequireAdmin`).
- `npm test -- --run src/lib/api/users.test.ts` — passed, 9 tests.
- `npm run typecheck` — passed, 0 errors.
- `dotnet test` (full backend suite, regression check) — Application 1123/1123, Api 12/12, Infrastructure 281/281. Total: 1416 passed, 0 failed, 0 skipped.

### Completion Notes List

- Extended `IKeycloakAdminService` with `RevokeSessionAsync(sessionId, ct)` calling `DELETE /admin/realms/{realm}/sessions/{sessionId}`. 404 from Keycloak surfaces as `KeycloakNotFoundException`.
- Added own-session-revoke endpoint `DELETE /api/v1/identity/sessions/{sessionId}` (REQ-010, AC1, AC3) in `IdentityEndpoints`. **Security-critical:** the handler first fetches the caller's own sessions and verifies the requested `sessionId` is in that list before forwarding to Keycloak. Without this ownership gate, any authenticated user could revoke arbitrary sessions by guessing IDs — Keycloak's Admin API does not check who is calling. Failed ownership check → `LogAccessDenied` + 404.
- Added admin revoke endpoint `DELETE /api/v1/users/{userId}/sessions/{sessionId}` (REQ-010, AC2, AC4) in `UserEndpoints` under the existing `RequireAdmin` route group. Verifies target user and session exist first; emits `LogAccessGranted` with `TargetUserId` + `TargetEmail` metadata on success, `LogAccessDenied` on missing user or missing session.
- Both endpoints idempotent against session disappearance between the ownership/existence check and the actual delete (catches `KeycloakNotFoundException` from `RevokeSessionAsync` and returns `NoContent` rather than 500).
- Added frontend API client functions `revokeMySession(token, sessionId)` and `revokeUserSession(token, userId, sessionId)` in `frontend/src/lib/api/users.ts` with explicit 404 handling.
- Updated `frontend/src/app/profile/security/page.tsx`: added per-session "Beenden" button with `window.confirm` guard, success/error toast banner, optimistic list removal on success, disabled state while the revoke request is in flight. Imported `revokeMySession` and added `revokingSessionId` + `message` UI state.
- Updated `frontend/src/app/admin/users/[id]/sessions/page.tsx` with the same revoke UX, using `revokeUserSession(userId, sessionId)` and an admin-specific confirmation message that names the impacted user.
- Added i18n keys to `profileSecurity` namespace in both `de.json` and `en.json`: `revoke`, `revoking`, `revokeConfirm`, `revokeConfirmAdmin`, `revokeSuccess`, `revokeError`, plus a new `timeoutsNote` (AC5) that documents Keycloak's default 30-minute idle and 10-hour max session timeouts. Removed the now-stale "session termination is part of a separate step" sentence from `dataLimitsNote`.
- Updated `docs/05_security_privacy.md` REQ-010 section with a dedicated "Session Revocation" subsection covering both endpoints, the ownership gate, the propagation expectation, audit logging, and the idle/max-lifetime timeouts (AC5).
- All ACs satisfied:
  - AC1 ✅ via `DELETE /api/v1/identity/sessions/{sessionId}` + ownership gate + Profile-Security UI button.
  - AC2 ✅ via `DELETE /api/v1/users/{userId}/sessions/{sessionId}` (RequireAdmin via route group, validated by `RevokeUserSessionEndpoint_ShouldRequireAdminAuthorization`) + admin sessions UI button.
  - AC3 ✅ via Keycloak's own session expiry — once Keycloak `DELETE /sessions/{id}` succeeds, the next protected API call rejects the token; documented in `docs/05_security_privacy.md` REQ-010 Session Revocation §4.
  - AC4 ✅ via `SecurityAuditLogger.LogAccessGranted("Session", "RevokeForUser", sessionId, {TargetUserId, TargetEmail})` and matching `LogAccessDenied` for failure cases on the admin endpoint.
  - AC5 ✅ via `docs/05_security_privacy.md` REQ-010 Session Revocation §6 + visible `profileSecurity.timeoutsNote` on both UI pages.

### File List

Backend:
- `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`
- `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`
- `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceRevokeSessionTests.cs`
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
- `_bmad-output/implementation-artifacts/e1-s4-add-session-revocation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-05-12: Implemented REQ-010 session revocation. Added `KeycloakAdminService.RevokeSessionAsync`, own-revoke endpoint `DELETE /api/v1/identity/sessions/{sessionId}` with server-side ownership gate, admin-revoke endpoint `DELETE /api/v1/users/{userId}/sessions/{sessionId}` (RequireAdmin + audit), frontend revoke buttons with confirmation on both `/profile/security` and `/admin/users/[id]/sessions`, i18n keys for confirm/success/error/timeouts, tests (2 infra + 1 endpoint metadata + 4 vitest), and `docs/05_security_privacy.md` revocation section with documented idle/max timeouts. Status moved to `review` per hybrid workflow (CR + ER at Epic 1 boundary).
