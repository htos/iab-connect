# Story E2.S1: Add Duplicate Candidate Detection

Status: ready-for-dev

## Story

As an Admin,
I want duplicate candidates to be detected,
so that I can avoid creating duplicate member records.

## Acceptance Criteria

1. Given an Admin has the required permission and prerequisite data exists, when duplicate candidates to be detected, then system detects exact email matches.
2. Given valid inputs and existing system constraints, when this story behavior is exercised, then system detects likely matches using normalized name and contact signals.
3. Given valid inputs and existing system constraints, when this story behavior is exercised, then duplicate detection is available through an Application query.
4. Given valid inputs and existing system constraints, when this story behavior is exercised, then matching rules are deterministic and unit tested.
5. Given a caller lacks the required permission or role, when the protected behavior is requested, then results include enough information for Admin review without exposing unrelated sensitive data.

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

- Multi-epic sprint-plan order: 6.
- Requirement(s): REQ-018.
- Epic goal: Prevent duplicate member records and provide a controlled merge workflow with audit evidence.
- This story is prepared from `_bmad-output/implementation-artifacts/sprint-plan.md`; do not start coding from the epic summary alone.

### Scope Boundaries

In scope:

- Start deterministic before introducing fuzzy matching.
- Keep rules in Application/Domain service.

Out of scope:

- Fuzzy/ML matching without deterministic test coverage
- Merge behavior

### Existing Code To Inspect Before Editing

- FindMemberDuplicatesQuery
- duplicate matching service/DTOs
- MemberRepository.cs

Additional module context:

- backend/src/IabConnect.Domain/Members
- backend/src/IabConnect.Application/Members
- backend/src/IabConnect.Infrastructure/Persistence/Repositories/MemberRepository.cs
- backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs
- frontend/src/app/members
- frontend/src/lib/api/members.ts

### Architecture Guardrails

- Keep the modular monolith and Clean Architecture boundaries: Domain for business rules, Application for commands/queries/validators, Infrastructure for EF/Keycloak/provider implementations, API for Minimal API endpoints.
- Backend authorization policies are mandatory for protected operations. Frontend role checks are UX only and never the security boundary.
- Use MediatR commands/queries and FluentValidation for workflow behavior. Keep endpoints thin and pass CancellationToken through async calls.
- EF Core schema changes require migrations under backend/src/IabConnect.Infrastructure/Migrations; do not make manual database changes.
- Frontend UI must use Next.js App Router patterns, shared UI components, next-intl keys, orange primary actions, and the standard authenticated page layout.
- Sensitive changes must preserve audit, privacy, retention, and finance compliance rules where applicable.

Story-specific risks:

- Duplicate matching must start deterministic before fuzzy matching.
- Merge must preserve consents, documents, event registrations, finance references, audit records, and retention expectations.
- Candidate summaries must not expose unrelated sensitive member data.

### Implementation Guidance

- Prefer extending existing module patterns over creating new parallel services, routes, or UI primitives.
- Keep request/response DTOs explicit at API/Application boundaries; never expose EF entities directly to frontend or external API responses.
- Preserve current behavior for existing member, event, finance, communication, identity, and public routes unless an acceptance criterion explicitly changes it.
- Add audit/security logs for create/update/delete, revocation, merge, finance, provider, webhook, and access-denied behavior where this story touches sensitive operations.
- Keep provider-dependent behavior disabled, documented, or behind configuration until credentials, scopes, signing policy, and whitelist decisions are available.

### Testing Requirements

Required planned evidence from source story:

- Unit tests for matching rules.
- Repository/integration tests if query uses PostgreSQL-specific behavior.

Concrete test guidance:

- Backend: xUnit v3, FluentAssertions, Moq only for external boundaries; Testcontainers PostgreSQL for repository/persistence behavior.
- API: authorization, routing, serialization, response contracts, rate/scope behavior where applicable.
- Frontend: Vitest/Testing Library for shared controls/forms/rendering/permission states; Playwright or manual browser validation for critical flows.
- Manual: capture browser, Keycloak, provider, event-day, MailHog, finance, accessibility, or webhook validation notes where automated coverage cannot prove behavior.

Minimum verification before marking implementation complete:

- Backend: run focused tests for changed handlers/services/repositories/endpoints, then `dotnet test` from `backend` when local infrastructure permits.
- Frontend: run `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend` when UI changes are made.

### Previous Story Intelligence

- No previous story in this epic. Use project-context and existing code as the baseline.

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

- Create-story validation completed on 2026-05-12 for `e2-s1-add-duplicate-candidate-detection`.
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
