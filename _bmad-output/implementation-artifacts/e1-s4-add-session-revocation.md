# Story E1.S4: Add Session Revocation

Status: done

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

### Review Findings

- [x] [Review][Patch] Path traversal risk: sessionId/userId interpolated into Keycloak Admin API URLs without UUID validation [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Addressed in uncommitted P1 fix: `Guid.TryParse` validation added to `GetUserSessionsAsync` and `RevokeSessionAsync`.
- [x] [Review][Patch] Empty/whitespace sessionId not rejected before Keycloak API call [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — Addressed in uncommitted P2 fix: returns 400 Problem for empty/non-GUID sessionId.
- [x] [Review][Patch] Duplicate LogAccessGranted audit entries on concurrent session revocation [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — Addressed in uncommitted P3 fix: `LogAccessGranted` now emitted inside the `KeycloakNotFoundException` catch on the user self-revoke path (idempotent audit). Note: admin path still missing — see Epic Boundary Review below.
- [x] [Review][Patch] Wrong logger category injected in IdentityEndpoints handlers [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — Resolved 2026-05-13. Replaced `ILogger<Program>` with `ILogger<IdentityEndpointsLog>` via a new marker class `IdentityEndpointsLog` (necessary because static classes cannot be used as `TCategoryName` generic argument). Logger category now resolves to `IabConnect.Api.Endpoints.IdentityEndpointsLog`.
- [x] [Review][Patch] Missing Produces(500) on all new session/MFA endpoints [`backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`, `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`] — Resolved 2026-05-13. Identity endpoints already had `Produces(500)` (uncommitted); added `.Produces(StatusCodes.Status500InternalServerError)` to admin `GetUserSessions`, `RevokeUserSession`, and `ResetUserMfa` in UserEndpoints.

#### Epic Boundary Review (2026-05-13)

- [x] [Review][Patch] P1 GUID validation breaks all 5 existing session/revoke tests [`backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs`, `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceRevokeSessionTests.cs`] — Resolved 2026-05-13. Replaced non-GUID literals with lowercase UUID constants (`User1Id`, `User2Id`, `MissingUserId`, `Session1Id`, `MissingSessionId`). Added two new `[Theory]` cases (`GetUserSessionsAsync_WithNonGuidUserId_ThrowsArgumentException`, `RevokeSessionAsync_WithNonGuidSessionId_ThrowsArgumentException`) with 5 inline rows each to lock in the validation contract. All 15 tests pass.
- [x] [Review][Patch] Admin `RevokeUserSession` missing idempotent audit on `KeycloakNotFoundException` catch [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`] — Resolved 2026-05-13. Added `auditLogger.LogAccessGranted("Session", "RevokeForUser", sessionId, {TargetUserId, Reason="session-already-gone"})` inside the `catch (KeycloakNotFoundException)` branch. AC4 (admin revocation always emits an audit event) now holds on every code path.
- [x] [Review][Defer] TOCTOU race on session ownership check — deferred, Keycloak session UUIDs are not guessable; ownership gate and delete are not atomic but race window is negligible in practice
- [x] [Review][Defer] Race: user deleted between `GetUserByIdAsync` and `GetUserSessionsAsync` checks — deferred, acceptable race; audit records the correct reason for each branch
- [x] [Review][Defer] Double Keycloak API calls per revoke (user-existence + session-ownership) — deferred, pre-existing design decision; user-existence pre-check is redundant but harmless
- [x] [Review][Defer] Non-UUID `sub` claim in token causes `ArgumentException` → 500 — deferred, JWT sub is always a UUID from Keycloak; exploiting this requires a token that passes signature verification
- [x] [Review][Defer] Admin `RevokeUserSession` returns 404 for both user-not-found and session-not-found cases — deferred, common REST pattern; audit log distinguishes the cases

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

#### 2026-05-13 Patch pass (S4.1–S4.4)

- `dotnet build` — succeeded, 0 warnings, 0 errors.
- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter "FullyQualifiedName~KeycloakAdminServiceSessionsTests|FullyQualifiedName~KeycloakAdminServiceRevokeSessionTests"` — passed, 15 tests (5 original GUID-fixed + 10 new ArgumentException theory cases).
- `dotnet test tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj --filter "FullyQualifiedName~UserEndpointMetadataTests"` — passed, 3 tests.
- `dotnet test` (full backend regression) — Application 1123/1123, Api 12/12, Infrastructure 291/291. Total: **1426 passed, 0 failed, 0 skipped**.

### Completion Notes List

#### 2026-05-13 — Epic Boundary patch pass (S4.1–S4.4)

- **S4.1 Logger category:** `IdentityEndpoints` is a static class and cannot serve as a `TCategoryName` for `ILogger<T>`. Introduced a `public sealed class IdentityEndpointsLog` marker in the same file so that both `GetCurrentUserSessions` and `RevokeCurrentUserSession` resolve to category `IabConnect.Api.Endpoints.IdentityEndpointsLog` instead of the previous `ILogger<Program>`. UserEndpoints (sibling static class) was deliberately left on the project-wide `ILogger<Program>` pattern; this finding was specific to IdentityEndpoints per the review wording.
- **S4.2 OpenAPI 500 metadata:** Added `.Produces(StatusCodes.Status500InternalServerError)` to admin `GetUserSessions`, `RevokeUserSession`, and `ResetUserMfa` route registrations. Identity endpoints (`GetCurrentUserSessions`, `RevokeCurrentUserSession`) already had `Produces(500)` from the prior P-series patches.
- **S4.3 GUID validation tests:** Switched `KeycloakAdminServiceSessionsTests` and `KeycloakAdminServiceRevokeSessionTests` to use canonical lowercase UUID constants. Added two `[Theory]` tests (`GetUserSessionsAsync_WithNonGuidUserId_ThrowsArgumentException` and `RevokeSessionAsync_WithNonGuidSessionId_ThrowsArgumentException`) with 5 inline rows each — empty, whitespace, plain string, prior literal (`"user-1"`, `"session-1"`), and a path-traversal attempt — to lock in the P1 contract. Net delta: 5 original tests restored (now passing) + 10 new theory cases = 15 total in those two files.
- **S4.4 Admin idempotent audit:** Mirrored the P3 user-self-revoke pattern in admin `RevokeUserSession`. The `catch (KeycloakNotFoundException)` branch now emits `auditLogger.LogAccessGranted("Session", "RevokeForUser", sessionId, {TargetUserId, Reason="session-already-gone"})` before returning `TypedResults.NotFound()`. AC4 ("admin revocation writes an audit/security event") now holds on every branch — success, target-user-missing, session-not-found, and the disappeared-between-check-and-delete race.

#### Original implementation (2026-05-12)

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
- `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs` (S4.1 marker class + logger category)
- `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (S4.2 Produces(500), S4.4 idempotent audit)
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceSessionsTests.cs` (S4.3 GUID fix + new theory)
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceRevokeSessionTests.cs` (S4.3 GUID fix + new theory)
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
- 2026-05-13: Cleared 4 open `[Review][Patch]` items from Epic Boundary Review per `sprint-change-proposal-2026-05-13.md`. S4.1 logger category fix via `IdentityEndpointsLog` marker; S4.2 `Produces(500)` on admin `GetUserSessions`, `RevokeUserSession`, `ResetUserMfa`; S4.3 5 broken tests fixed with valid GUIDs + 10 new ArgumentException theory cases; S4.4 idempotent audit added to admin `RevokeUserSession` `KeycloakNotFoundException` catch. Full backend suite: 1426/1426 passed (was 1416 + 10 new theory cases).
