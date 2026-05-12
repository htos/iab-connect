# Story E3.S3: Add Volunteer Planning Domain and API

Status: ready-for-dev

## Story

As an Event Manager,
I want to define volunteer roles, shifts, and tasks,
so that event staffing can be planned in the system.

## Acceptance Criteria

1. Given an Event Manager has the required permission and prerequisite data exists, when they define volunteer roles, shifts, and tasks, then event manager can create roles, tasks, shifts, and capacity per event.
2. Given valid inputs and existing system constraints, when this story behavior is exercised, then assignments can be created, updated, and removed.
3. Given valid inputs and existing system constraints, when this story behavior is exercised, then capacity rules prevent overbooking unless explicitly allowed.
4. Given a caller lacks the required permission or role, when the protected behavior is requested, then changes are authorized and audit logged where operationally sensitive.
5. Given the page is loaded in desktop and mobile layouts, when the relevant state is displayed, then eF migration adds required tables/configuration.

## Tasks / Subtasks

- [ ] Confirm scope, existing code, and acceptance evidence (AC: all)
  - [ ] Inspect every expected file listed in Dev Notes before implementation and preserve existing behavior.
  - [ ] Record any product/provider decision that blocks implementation before changing code.
- [ ] Implement backend/application/infrastructure slice (AC: 1, 2, 3, 4, 5)
  - [ ] Add or update Domain/Application commands, queries, DTOs, validators, and services using existing module patterns.
  - [ ] Add EF configuration and migration only when durable persistence changes are required.
  - [ ] Add Minimal API endpoints with explicit authorization policies and audit/security logging where sensitive.
- [ ] Add tests and manual validation evidence (AC: all)
  - [ ] Add focused backend unit/integration/API tests for business rules, authorization, persistence, and sensitive edge cases.
  - [ ] Add frontend tests for forms/rendering/permission states where UI is touched.
  - [ ] Document manual validation for browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook behavior as applicable.
- [ ] Update operational docs or requirement evidence when behavior changes (AC: all)

## Dev Notes

### Sprint Plan Context

- Multi-epic sprint-plan order: 12.
- Requirement(s): REQ-024.
- Epic goal: Complete event-day check-in, volunteer planning, and calendar integration without bypassing event visibility or authorization.
- This story is prepared from `_bmad-output/implementation-artifacts/sprint-plan.md`; do not start coding from the epic summary alone.

### Scope Boundaries

In scope:

- Suggested entities: `EventVolunteerRole`, `EventVolunteerShift`, `EventVolunteerAssignment`.
- Keep in Events module.

Out of scope:

- Reminder scheduling UI
- Calendar integration

### Existing Code To Inspect Before Editing

- EventVolunteerRole/EventVolunteerShift/EventVolunteerAssignment
- EF configurations and migration
- volunteer commands/queries
- Event endpoints

Additional module context:

- backend/src/IabConnect.Domain/Events
- backend/src/IabConnect.Application/Events
- backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRepository.cs
- backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventRegistrationRepository.cs
- backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs
- backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs
- frontend/src/app/(dashboard)/events
- frontend/src/app/public/events
- frontend/src/lib/services/events.ts

### Architecture Guardrails

- Keep the modular monolith and Clean Architecture boundaries: Domain for business rules, Application for commands/queries/validators, Infrastructure for EF/Keycloak/provider implementations, API for Minimal API endpoints.
- Backend authorization policies are mandatory for protected operations. Frontend role checks are UX only and never the security boundary.
- Use MediatR commands/queries and FluentValidation for workflow behavior. Keep endpoints thin and pass CancellationToken through async calls.
- EF Core schema changes require migrations under backend/src/IabConnect.Infrastructure/Migrations; do not make manual database changes.
- Frontend UI must use Next.js App Router patterns, shared UI components, next-intl keys, orange primary actions, and the standard authenticated page layout.
- Sensitive changes must preserve audit, privacy, retention, and finance compliance rules where applicable.

Story-specific risks:

- Event visibility and staff/admin authorization must gate roster, export, scanner, volunteer, and private calendar output.
- QR/manual check-in state changes must be idempotent and auditable.
- Offline exports and calendar feeds can expose personal or private event data; limit fields and visibility.

### Implementation Guidance

- Prefer extending existing module patterns over creating new parallel services, routes, or UI primitives.
- Keep request/response DTOs explicit at API/Application boundaries; never expose EF entities directly to frontend or external API responses.
- Preserve current behavior for existing member, event, finance, communication, identity, and public routes unless an acceptance criterion explicitly changes it.
- Add audit/security logs for create/update/delete, revocation, merge, finance, provider, webhook, and access-denied behavior where this story touches sensitive operations.
- Keep provider-dependent behavior disabled, documented, or behind configuration until credentials, scopes, signing policy, and whitelist decisions are available.

### Testing Requirements

Required planned evidence from source story:

- Domain/Application tests for capacity rules.
- PostgreSQL integration tests for persistence.
- API authorization tests.

Concrete test guidance:

- Backend: xUnit v3, FluentAssertions, Moq only for external boundaries; Testcontainers PostgreSQL for repository/persistence behavior.
- API: authorization, routing, serialization, response contracts, rate/scope behavior where applicable.
- Frontend: Vitest/Testing Library for shared controls/forms/rendering/permission states; Playwright or manual browser validation for critical flows.
- Manual: capture browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook validation notes where automated coverage cannot prove behavior.

Minimum verification before marking implementation complete:

- Backend: run focused tests for changed handlers/services/repositories/endpoints, then `dotnet test` from `backend` when local infrastructure permits.
- Frontend: run `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend` when UI changes are made.

### Previous Story Intelligence

- Build on `e3-s2-add-qr-and-manual-check-in-flow.md` if present. Reuse its module paths, endpoint conventions, test style, and review findings.

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

- Create-story validation completed on 2026-05-12 for `e3-s3-add-volunteer-planning-domain-and-api`.
- Checklist coverage: acceptance criteria, source paths, authorization/audit/privacy/finance impact, migration need, tests, manual validation, i18n/accessibility states where relevant.
- Remaining implementation risk: code-level inspection may split this story further if existing module coupling or provider decisions make the scope too large.

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent._

### Debug Log References

_To be filled during implementation._

### Completion Notes List

_To be filled during implementation._

### File List

_To be filled during implementation._

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
