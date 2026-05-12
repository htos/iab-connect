# IAB Connect Sprint Plan

Date: 2026-05-12
Sprint: Sprint 1
Status: Planned
Planning source:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design.md`
- `_bmad-output/planning-artifacts/epics-and-stories.md`
- `_bmad-output/planning-artifacts/implementation-readiness-report.md`

## Sprint Goal

Establish the security and identity foundation for future implementation by preparing and delivering the first Keycloak-backed account security slice: MFA enforcement policy, session/device visibility, and session revocation.

This sprint deliberately avoids social/enterprise login provider federation because Google/Microsoft provider setup needs environment-specific decisions and credentials.

## Planning Refresh

Refreshed on 2026-05-12. The selected scope remains valid after checking the readiness report, UX artifact, and Epic E1 story definitions. No scope changes are required.

## Selected Scope

| Order | Story | Requirement | Title | Sprint Status | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | E1-S1 | REQ-009 | Configure Role-Based MFA Policy | Next | First story to create and validate. |
| 2 | E1-S3 | REQ-010 | Add Session and Device Visibility | Planned | Depends on Keycloak session API inspection. |
| 3 | E1-S4 | REQ-010 | Add Session Revocation | Planned | Should follow session visibility. |

## Stretch / Follow-Up Candidates

| Story | Requirement | Title | Decision |
| --- | --- | --- | --- |
| E1-S2 | REQ-009 | Add Admin MFA Support Operations | Conditional stretch if Keycloak console-only support is not enough. |
| E1-S5 | REQ-006 | Add Social and Enterprise Identity Providers | Defer until provider credentials, scopes, and account-linking policy are decided. |

## Out of Scope for Sprint 1

- Social/enterprise login provider setup.
- Duplicate member detection and merge.
- Event check-in, volunteer planning, calendar, or ticketing work.
- Automations, multi-channel messaging, budgets/cost centers, webhooks/API clients.
- Broad accessibility audit beyond pages touched by Sprint 1 stories.

## Story Preparation Rules

Before each selected story enters development:

1. Run `bmad-create-story` for the next story.
2. Inspect existing code locations.
3. Confirm backend authorization and audit expectations.
4. Confirm Keycloak Admin API or realm configuration touch points.
5. Confirm frontend route/component/API wrapper touch points.
6. Define backend and frontend tests.
7. Define manual Keycloak validation steps.

## Expected Code Areas

These are planning hypotheses only; `bmad-create-story` must verify exact files.

Backend:

- `backend/src/IabConnect.Api/Endpoints`
- `backend/src/IabConnect.Application`
- `backend/src/IabConnect.Infrastructure`
- Existing Keycloak admin integration/service code
- Existing audit/security logging services

Frontend:

- `frontend/src/app/profile`
- `frontend/src/app/admin/users`
- `frontend/src/lib/api` or `frontend/src/lib/services`
- `frontend/src/components/ui`
- `frontend/messages`

Infrastructure / configuration:

- `infra/keycloak/realms`
- Development Keycloak realm/client settings
- Environment configuration for Keycloak admin service, if needed

## Validation Gates

Sprint-level validation should include:

- Backend build/tests relevant to touched modules.
- API authorization tests for any new backend endpoints.
- Manual Keycloak validation for MFA/session scenarios.
- Frontend typecheck and lint for touched frontend stories.
- UI manual validation for loading, empty, error, permission-denied, success, and confirmation states.
- Audit/security event verification where application-level operations are added.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Keycloak role-based MFA may be mostly realm configuration rather than application code. | Story E1-S1 may produce config/docs rather than code. | Treat story output as configuration plus verification evidence if no app code is needed. |
| Keycloak session/device metadata may be limited. | UI may not show rich device information. | Degrade gracefully and document limitations. |
| Session revocation behavior depends on token/session cache timing. | Revocation may not appear instant in every UI state. | Validate at next protected request and document expected timing. |
| Admin MFA reset may be needed sooner than planned. | Support operations may be blocked. | Pull E1-S2 into sprint only after E1-S1 confirms operational gap. |

## Next Action

Run `bmad-create-story` for `E1-S1 Configure Role-Based MFA Policy`.
