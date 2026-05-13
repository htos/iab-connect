# Story E1.S2: Add Admin MFA Support Operations

Status: done

## Story

As an Admin,
I want to reset MFA for a user through a controlled support flow,
so that locked-out users can recover access safely.

## Acceptance Criteria

1. Given an Admin has the required permission and prerequisite data exists, when they reset MFA for a user through a controlled support flow, then authorized Admin can initiate MFA reset for a user.
2. Given a caller lacks the required permission or role, when the protected behavior is requested, then non-admin users cannot reset another user's MFA.
3. Given a caller lacks the required permission or role, when the protected behavior is requested, then reset operation uses Keycloak Admin API.
4. Given the sensitive action succeeds or fails, when audit evidence is reviewed, then reset operation writes an audit/security event.
5. Given the page is loaded in desktop and mobile layouts, when the relevant state is displayed, then UI communicates success/failure without exposing sensitive internal details.

## Tasks / Subtasks

- [x] Confirm scope, existing code, and acceptance evidence (AC: all)
  - [x] Inspect every expected file listed in Dev Notes before implementation and preserve existing behavior.
  - [x] Record any product/provider decision that blocks implementation before changing code.
- [x] Implement backend/application/infrastructure slice (AC: 1, 2, 3, 4, 5)
  - [x] Add or update Domain/Application commands, queries, DTOs, validators, and services using existing module patterns.
  - [x] Add EF configuration and migration only when durable persistence changes are required.
  - [x] Add Minimal API endpoints with explicit authorization policies and audit/security logging where sensitive.
- [x] Add tests and manual validation evidence (AC: all)
  - [x] Add focused backend unit/integration/API tests for business rules, authorization, persistence, and sensitive edge cases.
  - [x] Add frontend tests for forms/rendering/permission states where UI is touched.
  - [x] Document manual validation for browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook behavior as applicable.
- [x] Update operational docs or requirement evidence when behavior changes (AC: all)

### Review Findings

- [x] [Review][Patch] Partial MFA reset: send reconfiguration email on best-effort basis even when credential deletion was partial [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Addressed in uncommitted P4 fix: best-effort deletion with per-credential warning logs; `execute-actions-email` always attempted regardless of deletion failures.
- [x] [Review][Patch] LogAccessDenied used for infrastructure errors, not just access denials [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`] — Resolved 2026-05-13. The generic `catch (Exception ex)` path in `ResetUserMfa` no longer emits `LogAccessDenied`; the admin caller is already authorised, so the failure is logged via `logger.LogError(ex, ..., {ErrorType})` only. The security audit trail is no longer polluted with infra-error entries that look like permission failures.
- [x] [Review][Defer] Stale Keycloak admin token not cleared on 401 from Admin API [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — deferred, pre-existing issue in token caching logic unrelated to this story's changes
- [x] [Review][Defer] Non-404 Keycloak status codes become opaque 500 [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — deferred, pre-existing pattern throughout the service
- [x] [Review][Defer] MediatR/FluentValidation not used for new Keycloak endpoint handlers — deferred, follows existing codebase pattern of calling Keycloak service directly for thin proxying operations

#### Epic Boundary Review (2026-05-13)

- [x] [Review][Patch] GUID validation missing from `ResetUserMfaAsync` and other service methods that interpolate `userId` [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Resolved 2026-05-13. Added `Guid.TryParse` guard at the top of `ResetUserMfaAsync` and `SendPasswordResetEmailAsync` (matching the existing pattern from `GetUserSessionsAsync` / `RevokeSessionAsync`). Throws `ArgumentException` early on non-GUID input — closes the remaining path-traversal vectors. Covered by 10 new theory cases (5 each for the two methods).
- [x] [Review][Patch] `execute-actions-email` not handling Keycloak 400 when user has no verified email [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Resolved 2026-05-13. Added a new `KeycloakActionEmailUnavailableException` (carries `DeletedCredentialCount` and `TotalCredentialCount`) thrown when Keycloak returns 400 for the `execute-actions-email` call after MFA credentials have already been removed. The API layer (`ResetUserMfa`) now catches this exception, emits a `LogAccessGranted` audit entry with `Outcome=credentials-removed-email-not-sent`, and returns **422 Unprocessable Entity** so the admin caller understands the user is in a no-MFA, no-email-link state and needs out-of-band recovery — instead of the previous opaque 500.
- [x] [Review][Defer] Concurrent MFA resets for the same user send two re-enrollment emails — deferred, admin-only action; race window is small and operational consequence is cosmetic (duplicate emails)
- [x] [Review][Defer] No rate limiting on `POST /users/{userId}/reset-mfa` — deferred, broader API gateway/rate-limiting concern beyond this story
- [x] [Review][Defer] Keycloak 200 with empty body for `/credentials` causes JsonException — deferred, pre-existing; Keycloak spec guarantees a JSON array for this endpoint

## Dev Notes

### Sprint Plan Context

- Multi-epic sprint-plan order: 4.
- Requirement(s): REQ-009.
- Epic goal: Strengthen identity flows while keeping Keycloak as the source of truth and the backend as the enforcement boundary.
- This story is prepared from `_bmad-output/implementation-artifacts/sprint-plan.md`; do not start coding from the epic summary alone.

### Scope Boundaries

In scope:

- Add endpoints only if Keycloak console alone is not sufficient for product operations.
- Keep endpoint thin and delegate to Application/Infrastructure service.

Out of scope:

- Changing MFA realm policy from E1-S1
- Session/device revocation
- Provider federation

### Existing Code To Inspect Before Editing

- backend identity support service
- KeycloakAdminService.cs
- IdentityEndpoints.cs or UserEndpoints.cs
- frontend/src/app/admin/users/[id]/security if UI is needed

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
- Unit tests around service error handling.
- Manual Keycloak integration validation.

Concrete test guidance:

- Backend: xUnit v3, FluentAssertions, Moq only for external boundaries; Testcontainers PostgreSQL for repository/persistence behavior.
- API: authorization, routing, serialization, response contracts, rate/scope behavior where applicable.
- Frontend: Vitest/Testing Library for shared controls/forms/rendering/permission states; Playwright or manual browser validation for critical flows.
- Manual: capture browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook validation notes where automated coverage cannot prove behavior.

Minimum verification before marking implementation complete:

- Backend: run focused tests for changed handlers/services/repositories/endpoints, then `dotnet test` from `backend` when local infrastructure permits.
- Frontend: run `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend` when UI changes are made.

### Previous Story Intelligence

- Build on `e1-s1.md` if present. Reuse its module paths, endpoint conventions, test style, and review findings.

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

- Create-story validation completed on 2026-05-12 for `e1-s2-add-admin-mfa-support-operations`.
- Checklist coverage: acceptance criteria, source paths, authorization/audit/privacy/finance impact, migration need, tests, manual validation, i18n/accessibility states where relevant.
- Remaining implementation risk: code-level inspection may split this story further if existing module coupling or provider decisions make the scope too large.

## Dev Agent Record

### Agent Model Used

GPT-5

### Debug Log References

- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter FullyQualifiedName~KeycloakAdminServiceMfaTests` - passed, 2 tests.
- `dotnet test tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj --filter FullyQualifiedName~UserEndpointMetadataTests` - passed, 1 test.
- `dotnet test tests/IabConnect.Infrastructure.Tests/IabConnect.Infrastructure.Tests.csproj --filter "FullyQualifiedName~KeycloakAdminServiceMfaTests|FullyQualifiedName~KeycloakRealmConfigurationTests"` - passed, 6 tests.
- `dotnet test` from `backend` - passed, 1409 tests.
- `npm test -- --run src/lib/api/users.test.ts` from `frontend` - passed, 2 tests.
- `npm run typecheck` from `frontend` - passed.
- `npm test -- --run` from `frontend` - passed, 2 tests.
- `npm run lint` from `frontend` - failed on pre-existing lint issues in `frontend/src/app/admin/backups/page.tsx` and `frontend/src/app/members/segments/page.tsx`; no E1-S2 files were reported.

#### 2026-05-13 Patch pass (S2.1–S2.3)

- `dotnet test` (full backend regression after the E1.S2 patches) — Application 1123/1123, Api 18/18, Infrastructure 302/302. Total: **1443 passed, 0 failed, 0 skipped** (+11 vs. post-S3 baseline of 1432).
- New tests in `KeycloakAdminServiceMfaTests`:
  - `ResetUserMfaAsync_WhenExecuteActionsEmailReturns400_ThrowsKeycloakActionEmailUnavailableException` (S2.3)
  - `ResetUserMfaAsync_WithNonGuidUserId_ThrowsArgumentException` theory × 5 (S2.2)
  - `SendPasswordResetEmailAsync_WithNonGuidUserId_ThrowsArgumentException` theory × 5 (S2.2)
- Existing tests `ResetUserMfaAsync_RemovesOnlyMfaCredentialsAndSendsConfigureActions` and `ResetUserMfaAsync_WhenCredentialEndpointReturnsNotFound_ThrowsKeycloakNotFoundException` switched to canonical lowercase UUIDs (same pattern as S4.3).

### Completion Notes List

#### 2026-05-13 — Epic Boundary patch pass (S2.1–S2.3)

- **S2.1 Audit log semantics:** Removed `auditLogger.LogAccessDenied(...)` from the generic `catch (Exception ex)` branch in `ResetUserMfa`. The admin caller is already authorised — infrastructure failures (Keycloak unreachable, 5xx, deserialization errors) are now logged via `logger.LogError(ex, ..., {ErrorType})` only. The security audit trail is reserved for actual permission failures.
- **S2.2 GUID validation:** Added `Guid.TryParse` guards at the top of `ResetUserMfaAsync` and `SendPasswordResetEmailAsync`, matching the pre-existing pattern on `GetUserSessionsAsync` / `RevokeSessionAsync`. Throws `ArgumentException` early on non-GUID input. Two new theory tests (5 inline rows each — empty, whitespace, plain string, prior literal, path-traversal attempt) lock the contract in.
- **S2.3 Keycloak 400 handling:** Added a new `KeycloakActionEmailUnavailableException` (carrying `DeletedCredentialCount` / `TotalCredentialCount`) thrown when the post-deletion `execute-actions-email` request returns 400 — typically because the target user has no verified email address. The API layer (`ResetUserMfa`) now catches this distinct exception type, emits a `LogAccessGranted` audit entry with `Outcome=credentials-removed-email-not-sent` (the credential state DID change), and returns **422 Unprocessable Entity** with a clear problem detail. Operator no longer sees an opaque 500 in this scenario.

#### Original implementation (2026-05-12)

- Added a controlled Admin-only MFA reset endpoint at `POST /api/v1/users/{userId}/reset-mfa`.
- Extended the Keycloak Admin service to remove only MFA credentials (`otp`, `recovery-authn-codes`) and send `CONFIGURE_TOTP` plus `CONFIGURE_RECOVERY_AUTHN_CODES` execute-actions email.
- Added SecurityAuditLogger calls for successful reset, missing target user, Keycloak not-found race, and generic reset failure without exposing Keycloak internals to the UI.
- Added the MFA reset action to the admin user list UI with translated confirmation and success messages.
- Documented the operational MFA support flow and audit boundary in `docs/05_security_privacy.md`.

### File List

- `backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs` (S2.2 GUID validation, S2.3 KeycloakActionEmailUnavailableException + 400-handling)
- `backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs` (S2.1 audit-log fix, S2.3 422 mapping)
- `backend/tests/IabConnect.Infrastructure.Tests/Identity/KeycloakAdminServiceMfaTests.cs` (S2.2 GUID theory × 10, S2.3 400-handling test, existing tests switched to GUIDs)
- `backend/tests/IabConnect.Api.Tests/UserEndpointMetadataTests.cs`
- `frontend/src/lib/api/users.ts`
- `frontend/src/lib/api/users.test.ts`
- `frontend/src/app/admin/users/page.tsx`
- `frontend/messages/en.json`
- `frontend/messages/de.json`
- `docs/05_security_privacy.md`
- `_bmad-output/implementation-artifacts/e1-s2-add-admin-mfa-support-operations.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-05-12: Implemented Admin MFA reset support flow, UI action, tests, and operational documentation.
- 2026-05-13: Cleared 3 open `[Review][Patch]` items per `sprint-change-proposal-2026-05-13.md`. S2.1 removed `LogAccessDenied` misuse for infrastructure errors in `ResetUserMfa`; S2.2 added GUID validation to `ResetUserMfaAsync` and `SendPasswordResetEmailAsync` (closes path-traversal symmetry); S2.3 introduced `KeycloakActionEmailUnavailableException` for the 400-from-execute-actions-email case and surfaced it as **422** with a tagged audit entry. Full backend suite: 1443/1443 passed (was 1432 + 11 new tests: 1 for S2.3 400-handling + 10 GUID-validation theory cases).
