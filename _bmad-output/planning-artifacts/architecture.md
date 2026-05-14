# IAB Connect Architecture

Date: 2026-05-11
Last revised: 2026-05-14 — added ADR-007, ADR-008, REQ-086/REQ-087 data architecture, and the Module Enforcement authorization-matrix row for the generic white-label pivot (Sprint Change Proposal 2026-05-14, handoff step 2).
Project: IAB Connect
Document status: Draft solution architecture from validated PRD
Output location: `_bmad-output/planning-artifacts/architecture.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/prd-validation-report.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-14.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`
- `docs/architecture-backend.md`
- `docs/architecture-frontend.md`
- `docs/architecture-infra.md`
- `docs/integration-architecture.md`
- `_bmad-output/project-context.md`

## Executive Summary

IAB Connect remains a modular monolith with a Next.js frontend, ASP.NET Core backend, PostgreSQL persistence, Keycloak identity, RustFS document storage, Hangfire background jobs, and Docker Compose local infrastructure.

This architecture document does not replace the generated backend, frontend, infrastructure, or integration architecture docs. It defines solution decisions for the validated PRD, especially the 14 remaining Backlog requirements. The central architectural choice is to extend existing modules and integration points rather than introduce new deployables, microservices, or alternate identity/storage stacks.

## Architecture Goals

1. Preserve the existing modular monolith and Clean Architecture-style boundaries.
2. Keep Keycloak as the identity authority and backend policies as the security boundary.
3. Implement remaining Backlog scope through existing modules, endpoint patterns, MediatR/Application services, EF Core migrations, and typed frontend API wrappers.
4. Maintain audit, retention, finance, privacy, and authorization behavior for all sensitive workflows.
5. Make future epic/story implementation consistent enough for multiple agents to work without inventing new patterns.

## System Context

### Components

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, next-auth, next-intl, TanStack Query.
- Backend: ASP.NET Core 10 Minimal APIs, MediatR, FluentValidation, EF Core 10, PostgreSQL, Hangfire, Serilog.
- Identity: Keycloak/OIDC and Keycloak Admin REST API.
- Persistence: PostgreSQL for application data and Hangfire storage.
- Object storage: RustFS through S3-compatible APIs for documents and finance artifacts.
- Email and jobs: SMTP/MailHog in development, Hangfire for scheduled/background work.
- Observability: Serilog console/file/Seq sinks, correlation IDs, health endpoints.

### Runtime Data Flow

1. Frontend authenticates users through NextAuth and Keycloak.
2. Frontend calls backend `/api/v1/...` endpoints with bearer tokens.
3. Backend validates JWTs, maps roles, applies endpoint policies and permission checks.
4. Endpoints delegate workflow behavior to MediatR handlers, repositories, or application services.
5. EF Core persists state in PostgreSQL; migrations live in Infrastructure.
6. RustFS stores binary document/receipt artifacts through an abstraction.
7. Hangfire runs scheduled and asynchronous work such as email, dunning, retention, and future automation jobs.

## Architectural Decisions

### ADR-001: Keep Modular Monolith

Decision: Remaining Backlog scope is implemented inside the existing modular monolith.

Rationale:

- The current repository already has clear API, Application, Domain, and Infrastructure boundaries.
- The remaining Backlog items are feature extensions, not independent products.
- Extra services would add deployment, security, observability, and data consistency burden without clear value.

Implications:

- New backend code belongs under the existing projects.
- Modules remain code boundaries, not deployable service boundaries.
- Cross-module workflows use Application services, MediatR, domain services, repositories, and database transactions where appropriate.

### ADR-002: Keycloak Remains Identity Authority

Decision: Social login, MFA, and session/device management extend Keycloak configuration and integration rather than creating a local identity model.

Rationale:

- User management already uses Keycloak Admin API.
- OIDC roles and claims already flow into frontend and backend.
- MFA and identity provider federation are native Keycloak responsibilities.

Implications:

- No local password or identity credential storage.
- Backend can add admin endpoints only for controlled Keycloak operations.
- Frontend can expose account/security screens, but Keycloak remains source of truth.

### ADR-003: Backend Authorization Is Mandatory

Decision: Every protected capability must enforce backend authorization through policies, permissions, or resource checks.

Rationale:

- Frontend role checks are UX only.
- Remaining scope touches sensitive identity, member, event, communication, finance, and integration surfaces.

Implications:

- Endpoint groups must declare authorization requirements.
- Application services must perform resource-level checks when ownership or object permissions matter.
- Sensitive failures and denied access paths must be auditable where relevant.

### ADR-004: PostgreSQL and EF Core Remain Persistence Backbone

Decision: New persistent state uses EF Core migrations and PostgreSQL.

Rationale:

- Existing domain data and Hangfire storage use PostgreSQL.
- Test strategy already supports PostgreSQL integration through Testcontainers.
- Existing compliance behavior depends on relational state, query filters, transactions, and audit metadata.

Implications:

- Add migrations under `backend/src/IabConnect.Infrastructure/Migrations`.
- Avoid EF InMemory for relational behavior validation.
- Prefer explicit aggregates/entities for durable Backlog concepts.

### ADR-005: Hangfire for Scheduled and Asynchronous Work

Decision: Automation journeys, reminders, webhook delivery retries, and provider-send retries use existing Hangfire infrastructure.

Rationale:

- Hangfire is already configured and persisted in PostgreSQL.
- The project already schedules invoice/dunning/retention jobs.

Implications:

- Keep background processing in Infrastructure/Application.
- Jobs must be idempotent where retries are possible.
- Failures must be logged and visible to authorized users for operational follow-up.

### ADR-006: Frontend Uses Existing App Router and Shared UI Patterns

Decision: New UI surfaces use the current route tree, authenticated shell, public layout split, shared UI primitives, typed API wrappers, next-intl messages, and orange primary actions.

Rationale:

- The frontend has a broad route surface and established design standards.
- Inconsistent direct fetch and styling patterns already exist; new work should converge rather than diversify.

Implications:

- Use `frontend/src/lib/api` or `frontend/src/lib/services` for feature API calls.
- Use next-intl for all user-visible strings.
- Use lucide-react icons where suitable.
- Add search/filter controls on list/table pages.

### ADR-007: Module Configuration as a Single-Tenant Settings Model

Decision: Module enablement state is persisted in a dedicated `module_settings` table — one row per module. The application remains single-organization (`SystemSettings` is a singleton), so there is no `organization_id` column and no multi-tenant data model. This resolves OD-2 from Sprint Change Proposal 2026-05-14 in favour of a dedicated table over a JSON column on `system_settings`.

Rationale:

- The codebase is single-tenant by construction. `SystemSettings` (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) is a singleton entity with a `CreateDefault()` factory and a single persisted row. A per-organization model would add complexity with no consumer.
- A dedicated table — over a JSON column on `system_settings` — gives per-module audit columns (`updated_at`, `updated_by`), a natural unique key for lookup and indexing, and a clean extension point: a new module is a new seeded row plus a new module-key constant, with no schema change.
- It follows the EF conventions already used in `backend/src/IabConnect.Infrastructure/Persistence/Configurations/` (explicit `ToTable`, explicit snake_case `HasColumnName`), so it is consistent with every other entity.

Schema (`module_settings`):

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `module_key` | text | UNIQUE, NOT NULL — one of the known module keys |
| `enabled` | boolean | NOT NULL, DEFAULT true |
| `updated_at` | timestamptz | NOT NULL |
| `updated_by` | text | NULL |

Module keys, seeded on the creating migration with all 7 enabled to preserve current behaviour: `members`, `events`, `documents`, `communication`, `finance`, `partners`, `public_view`.

Implications:

- New `ModuleSetting` entity in `IabConnect.Domain` with a private EF constructor and an invariant-friendly factory, following the `SystemSettings` pattern (private setters, explicit update method such as `SetEnabled(bool, string? updatedBy)`).
- EF configuration `ModuleSettingConfiguration : IEntityTypeConfiguration<ModuleSetting>` in `Persistence/Configurations/`, with `ToTable("module_settings")`, explicit snake_case columns, and a unique index on `module_key`.
- One EF Core migration under `backend/src/IabConnect.Infrastructure/Migrations/` that creates the table and seeds the 7 rows in the same migration, so existing deployments behave identically after upgrade.
- Read access goes through a cached `IModuleSettingsService` (Application-layer interface, Infrastructure implementation — see ADR-008), backed by an `IModuleSettingsRepository` following the `ISystemSettingsRepository` pattern. The cache is invalidated on write.
- The module-key list is a shared contract: a `ModuleKeys` constants class in a layer both `IabConnect.Api` and `IabConnect.Application` can reference. See the Module → Route/Endpoint Mapping table in ADR-008.

### ADR-008: Three-Layer Module Enforcement

Decision: A disabled module is enforced at three layers, with the backend as the single security boundary:

1. Backend (security boundary): a module-aware authorization requirement gates each module's endpoint group; a disabled module returns 403 and writes a security audit event on denial.
2. Frontend route guard (direct-URL protection): a Next.js `middleware.ts` redirects or blocks direct navigation to disabled-module routes.
3. Navigation (UX only): the `Sidebar` hides nav items for disabled modules.

Layers 2 and 3 are convenience and UX; only layer 1 is a security control, consistent with ADR-003 ("Frontend role checks are UX only").

Rationale and mechanism (code-grounded):

- There is no `IEndpointFilter` infrastructure in the codebase today. There is a proven authorization-extensibility pattern: `PermissionRequirement : IAuthorizationRequirement`, `PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>`, and `PermissionPolicyProvider : IAuthorizationPolicyProvider` (dynamic policies via a `Permission:` name prefix), all in `backend/src/IabConnect.Api/Authorization/`. Module enforcement models this existing pattern rather than introducing a parallel endpoint-filter mechanism:
  - `ModuleRequirement(string moduleKey) : IAuthorizationRequirement`.
  - `ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>` — resolves `IModuleSettingsService`, succeeds when the module is enabled, otherwise fails and logs via `ISecurityAuditLogger.LogAccessDenied(...)`.
  - The `PermissionPolicyProvider` is extended (or a sibling provider added) to recognise a `Module:` policy-name prefix, so route groups declare `.RequireAuthorization("Module:finance")` — the same ergonomic as the existing `"Permission:..."` and named policies.
  - This keeps one authorization model, one registration site (`DependencyInjection.cs`, alongside `PermissionAuthorizationHandler`), and reuses the access-denied audit path.
- A failing authorization requirement yields `403 Forbidden` by default, which is the desired "module disabled" response.

Layer 1 — Backend, applied per module route group:

| Module | Backend endpoint groups | Enforcement policy |
| --- | --- | --- |
| Members | `MemberEndpoints` | `Module:members` |
| Events | `EventEndpoints` | `Module:events` |
| Documents | `DocumentEndpoints` | `Module:documents` |
| Communication | `EmailCampaignEndpoints`, `EmailTemplateEndpoints` | `Module:communication` |
| Finance | `Invoice`, `Payment`, `Dunning`, `Receipt`, `ExpenseClaim`, `FiscalPeriod`, `JournalEntry`, `AccountingReport`, `FinanceProfile` endpoints | `Module:finance` |
| Partners | `SponsorEndpoints`, `SupplierEndpoints` | `Module:partners` |
| Public View | public/anonymous endpoints across modules — no dedicated group | special-cased (see below) |

Always-on, never gated: Dashboard, My Profile, Admin — including the module-settings endpoints themselves, so an admin can always re-enable a module.

Public View is special: it has no dedicated backend endpoint group; its surface is the set of `AllowAnonymous` public endpoints (public event/blog feeds and similar). When `public_view` is disabled, those public endpoints are gated and the public site is unavailable — but `GET /api/v1/settings/public` itself must remain reachable, because the frontend shell needs branding and the module map even to render a "site not public" page.

Layer 2 — Frontend route guard:

- No `frontend/src/middleware.ts` exists today; it is created new.
- The middleware reads the module map and, for a request whose path maps to a disabled module, redirects authenticated users to a safe page (dashboard) or renders a 403 / "module unavailable" page.
- The module map is exposed to the frontend by extending the anonymous `GET /api/v1/settings/public` response (`PublicSettingsResponse`) with a `modules` map — `AppSettingsProvider` already consumes this endpoint, and middleware needs an unauthenticated-readable source.

Layer 3 — Navigation:

- `NavItem` in `frontend/src/components/navigation/Sidebar.tsx` gains an optional `requiresModule?: string`, filtered exactly like the existing `requiresDoubleEntry` flag (submenu filter and top-level filter).
- The enabled-module set comes from `AppSettingsProvider` (extended `AppSettings` type with a `modules` map), consumed via the existing `useAppSettings()` hook.

Implications:

- New `AuditEventType` enum value (such as `ModuleAccessDenied`) in `backend/src/IabConnect.Domain/Audit/AuditEnums.cs`; denial logged via `ISecurityAuditLogger.LogAccessDenied(...)`.
- `IModuleSettingsService` is cached; the cache is invalidated whenever the module-settings write endpoint runs, so a toggle takes effect without redeploy.
- The module → route (frontend) and module → endpoint-group (backend) mapping is a shared contract. The frontend mapping lives where both `middleware.ts` and `Sidebar` can reference it; the backend `ModuleKeys` constants live in a layer both `IabConnect.Api` and `IabConnect.Application` reference.
- Cross-module dependency: paid event registration (E4) needs Finance. If Events is enabled but Finance is disabled, paid-registration flows must degrade safely. Whether to hard-block such a toggle is a product rule deferred to E10-S5; the architecture flags the dependency rather than enforcing it.
- Background jobs (Hangfire) belonging to a disabled module: behaviour defined in E10-S5. The three enforcement layers above govern HTTP and UI surfaces only.

## Backend Architecture

### Project Boundaries

- `IabConnect.Api`: route groups, endpoint mapping, auth policies, request/response mapping, health, middleware.
- `IabConnect.Application`: commands, queries, handlers, validators, application services, interfaces.
- `IabConnect.Domain`: aggregates, value objects, enums, domain events, domain rules.
- `IabConnect.Infrastructure`: EF Core configurations, migrations, repositories, Keycloak, email, jobs, storage, provider integrations.

### Endpoint Pattern

New endpoint groups should follow the existing Minimal API extension pattern:

- `MapXEndpoints(this RouteGroupBuilder group)`
- Tags, endpoint names, descriptions, and explicit auth policies.
- Request DTOs and response DTOs at API/Application boundaries.
- No EF entity leakage into responses.

### Application Pattern

Use MediatR plus FluentValidation when a feature contains workflow, validation, side effects, audit, or cross-module orchestration.

Use direct repository/application service reads only for simple list/detail queries that match existing local patterns.

All async flows must accept and propagate `CancellationToken`.

### Persistence Pattern

New entities should define:

- Required fields and invariant-friendly constructors/factory methods.
- EF Core configuration in Infrastructure.
- Indexes for tenant-like partitioning dimensions where applicable, such as event ID, member ID, status, date, and external provider identifiers.
- Soft-delete or audit behavior where required by domain sensitivity.

## Frontend Architecture

### Route Placement

Use authenticated routes for staff/member workflows and `/public/*` only for public website flows.

Suggested route areas:

- Identity/account: `/profile/security`, `/admin/users/[id]/security`, or existing admin/user routes.
- Duplicate detection: `/members/duplicates` or embedded warnings in member create/edit.
- Event ticketing/check-in/volunteers/calendar: under `/events/[id]/*` or event detail tabs.
- Automations: under `/communication/automations`.
- Multi-channel preferences: profile and communication settings.
- Budget/cost centers: under `/finance/settings` or `/finance/cost-centers`.
- Accessibility does not need a route; it is a quality baseline.
- APIs/webhooks: `/admin/integrations` or `/admin/webhooks`.

### Data Access

New frontend code should:

- Use typed DTOs aligned with backend contracts.
- Prefer typed API wrappers under `src/lib/api` or `src/lib/services`.
- Avoid hardcoded enum strings that differ from backend PascalCase values.
- Use refresh-trigger state plus effects/cancellation guards after mutations.

### UI and Accessibility

New UI should:

- Use authenticated page layout standards.
- Use orange-600/orange-700 for primary actions.
- Use shared components from `components/ui`.
- Use lucide-react icons instead of manual SVGs where available.
- Include keyboard-visible focus states, labels, accessible names, and validation messaging.

## Data Architecture by Backlog Area

### REQ-006 Social / Enterprise Logins

Primary architecture:

- Configure Google/Microsoft as Keycloak identity providers.
- Add optional backend admin/config visibility endpoints only if needed.
- Store any local provider-link metadata only when Keycloak data is insufficient for product needs.

Key data:

- Keycloak federated identity link.
- Audit events for account linking/unlinking or support actions.

Security:

- Scopes must be minimal.
- Account-linking flows must avoid account enumeration.

### REQ-009 Multi-factor Authentication

Primary architecture:

- Use Keycloak required actions, OTP policies, and role/group-based enforcement.
- Backend may expose admin support endpoints for MFA reset only through Keycloak Admin API.

Key data:

- Keycloak MFA enrollment state.
- Audit events for reset, failure-sensitive actions, and admin support operations.

Security:

- Admin and Kassier roles are minimum MFA candidates.
- Recovery/bypass flows require strict authorization.

### REQ-010 Session and Device Management

Primary architecture:

- Use Keycloak session APIs for active sessions and revocation.
- Frontend surfaces session state in profile/admin screens where feasible.

Key data:

- Keycloak session records.
- Optional local audit events for revocations.

Limitations:

- Device detail quality depends on Keycloak and client metadata.

### REQ-018 Duplicate Detection

Primary architecture:

- Add member duplicate detection in Application layer.
- Warn during create/edit based on deterministic rules first: email, normalized name/date/contact signals.
- Add merge workflow only with explicit safeguards and audit.

Suggested backend elements:

- `DuplicateCandidate` DTO/query model.
- `FindMemberDuplicatesQuery`.
- `MergeMembersCommand`.
- Merge audit service or audit event category.

Persistence:

- Prefer using existing Member data for detection.
- Add a `MemberMergeHistory` entity if durable merge evidence is not already covered by audit.

Testing:

- Unit tests for matching rules.
- Integration tests for merge reference preservation.

### REQ-022 Ticketing / Fees

Primary architecture:

- Extend Events with fee configuration.
- Integrate with Finance for invoices/receipts/payment records.
- Do not build a separate payment service unless a provider integration is explicitly approved.

Suggested backend elements:

- Event fee category/value objects.
- Registration payment status.
- Application service to create finance records from paid registration.

Finance rules:

- Cancellation/refund uses existing finance cancellation/reversal behavior.
- Sent/posted records must not be hard deleted.

Testing:

- Cross-module tests for paid registration to finance record.
- Regression tests for cancellation/refund behavior.

### REQ-023 On-site QR Check-in

Primary architecture:

- Reuse existing event registration QR token primitives.
- Add event-day check-in UI and backend operations around those primitives.
- Treat scanner/manual lookup/export/audit as the missing product scope.

Suggested backend elements:

- `CheckInRegistrationCommand`.
- `ManualCheckInRegistrationCommand`.
- `GetEventCheckInRosterQuery`.
- `ExportEventCheckInRosterQuery`.

Security:

- Only authorized event staff/admin roles can check in participants.
- Duplicate scans are idempotent and auditable.

Frontend:

- Event-scoped check-in route or tab.
- QR scanner where browser capabilities allow it.
- Manual attendee search fallback.
- Offline export before event.

### REQ-024 Volunteer Planning and Tasks

Primary architecture:

- Add event volunteer planning as part of Events module.
- Model roles/tasks/shifts and assignments under event aggregate or adjacent event-planning aggregate.

Suggested entities:

- `EventVolunteerRole`
- `EventVolunteerShift`
- `EventVolunteerAssignment`

Communication:

- Use existing email/notification infrastructure for reminders.

Security:

- Event manager/admin manages shifts.
- Member self-signup depends on event policy.

### REQ-025 Calendar Integration

Primary architecture:

- Generate `.ics` content from Event read models.
- Provide public and protected feeds based on event visibility.

Implementation:

- Backend endpoint for public iCal feed where only public events are included.
- Authenticated endpoint for member-visible feed if token/session model supports it safely.
- Per-event `.ics` export can be generated on demand.

Security:

- Never expose member-only/private event details through unauthenticated feeds unless explicitly approved.

### REQ-028 Automations / Journeys

Primary architecture:

- Use existing email templates, email sender, consent filtering, member/event/finance triggers, and Hangfire.
- Store automation definitions and execution records in PostgreSQL.

Suggested entities:

- `AutomationDefinition`
- `AutomationTrigger`
- `AutomationExecution`
- `AutomationRecipient`

Execution:

- Triggered by domain/application events where available, or scheduled polling jobs where safer.
- Idempotency keys prevent duplicate sends.
- Failures are logged and visible in UI.

### REQ-030 Multi-channel Messages

Primary architecture:

- Add channel abstraction behind communication Application/Infrastructure interfaces.
- Email remains the baseline channel.
- SMS/WhatsApp providers are adapters, not core domain dependencies.

Suggested interfaces:

- `IMessageChannelSender`
- `IMessageProvider`
- `IChannelPreferenceService`

Security/compliance:

- Provider credentials are configuration secrets.
- Channel preference and consent must be checked before send.

### REQ-044 Budgets and Cost Centers

Primary architecture:

- Extend Finance module with cost centers and budget periods.
- Associate cost center references with eligible finance records.

Suggested entities:

- `CostCenter`
- `CostCenterBudget`
- Optional mapping entities for transactions/invoices/journal lines if direct nullable foreign keys are unsuitable.

Reports:

- Soll/Ist comparison by fiscal period and cost center.
- Export respects finance read permissions.

### REQ-055 Multilingual DE/EN/HI

Primary architecture:

- Continue next-intl for frontend UI.
- Preserve existing DE/EN behavior and add Hindi incrementally through message files.
- Public content language metadata belongs in content/event/blog models where multilingual content is required.

Rules:

- No hardcoded UI strings in components.
- Backend enum values remain contract-stable and not translated.

### REQ-056 Basic Accessibility

Primary architecture:

- Accessibility is a cross-cutting quality requirement, not a standalone module.
- Add checks to component/page implementation and test practice.

Implementation targets:

- Keyboard navigation.
- Programmatic labels.
- Accessible names for icon controls.
- Visible focus.
- Contrast review.
- Validation messages.

Testing:

- Add focused component tests where practical.
- Use Playwright/manual validation for critical flows.

### REQ-058 API / Webhooks

Primary architecture:

- Add admin-managed API credentials and webhook subscriptions inside backend.
- Webhook delivery uses Hangfire with retry, signing, and delivery history.

Suggested entities:

- `ApiClient`
- `ApiScope`
- `WebhookSubscription`
- `WebhookDelivery`

Security:

- API credentials are hashed or stored using a one-way/token-safe design.
- Rate limiting applies to external API routes.
- Webhook payloads are signed.
- Admin can revoke credentials and disable failing webhooks.

### REQ-086 Generic Positioning / White-Label Branding

Primary architecture:

- Extend the existing `SystemSettings` singleton (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) with additional nullable branding/profile fields rather than introducing a new entity.
- New nullable columns on `system_settings`: `description`, `contact_email`, `contact_phone`, `contact_address`, `primary_color`, `public_site_enabled`, plus a logo asset reference. All nullable with behaviour-preserving defaults so existing rows stay valid after migration.
- Add an update method on the entity (such as `UpdateOrganizationProfile(...)` alongside the existing `UpdateBranding(...)`), keeping the private-setter plus explicit-method invariant pattern.
- Expose the extended fields through the existing settings endpoints: admin `GET/PUT /api/v1/settings` (`RequireRole("admin")`) for editing, anonymous `GET /api/v1/settings/public` for the public and shell read path.

Key data:

- Extended `SystemSettings` row (still a singleton).
- Audit event on branding/profile change — the existing `AuditEventType.SettingsChanged` path already covers this.

Frontend:

- Extend the `AppSettings` type and `AppSettingsProvider` (`frontend/src/components/providers/AppSettingsProvider.tsx`) with the new fields; consumed via `useAppSettings()`.
- New "Branding" tab in `frontend/src/app/admin/settings/page.tsx`, which already has a `general` / `customRoles` tab structure to extend.
- No user-visible string hardcodes a specific organization; values render from `SystemSettings` or next-intl keys. The de-branding sweep itself is Epic E9 (stories E9-S2/S3/S4).

Security:

- The edit path is admin-only; the public read path exposes only non-sensitive presentation fields.

### REQ-087 Module Configuration / Access Enforcement

Primary architecture:

- Data model: dedicated `module_settings` table — see ADR-007.
- Enforcement: three-layer (backend / route guard / navigation) — see ADR-008.

Suggested backend elements:

- `ModuleSetting` entity, `ModuleSettingConfiguration`, and a creating-plus-seeding migration.
- `IModuleSettingsService` (cached) and `IModuleSettingsRepository`.
- `ModuleRequirement`, `ModuleAuthorizationHandler`, and `Module:` policy-prefix support in the policy provider.
- Module-settings MediatR query/command plus an admin-only endpoint group (`MapModuleSettingsEndpoints`), and the `modules` map added to `PublicSettingsResponse`.
- `ModuleAccessDenied` audit event type.

Suggested frontend elements:

- Extended `AppSettings` (`modules` map) and `AppSettingsProvider`.
- `requiresModule` on `NavItem` plus Sidebar filtering.
- New `frontend/src/middleware.ts` route guard and a 403 / "module unavailable" page.
- New "Modules" tab in admin settings: toggle list, per-module description, dependency warnings, save and confirm.

Testing:

- Backend: `ModuleAuthorizationHandler` returns 403 plus audit when a module is disabled (API tests); `module_settings` persistence and seed (Testcontainers integration); `IModuleSettingsService` cache invalidation.
- Frontend: Sidebar filtering by module; `middleware.ts` redirect and 403; admin Modules tab behaviour.

Security:

- The backend is the only security boundary (ADR-003, ADR-008). Admin and the module-settings endpoints themselves are never gated.

## Cross-Cutting Architecture

### Authorization Matrix

Minimum authorization expectations:

| Area | Primary roles | Backend requirement |
| --- | --- | --- |
| Identity providers, MFA, sessions | Admin, affected user | Keycloak admin/user authorization plus audit |
| Duplicate detection/merge | Admin, Vorstand | Member write permission and merge audit |
| Event fees/check-in/volunteers/calendar | Event manager, Admin, Kassier where finance applies | Event permissions plus finance permissions for money flows |
| Automations/multi-channel | Communication, Admin, Kassier for finance reminders | Communication permissions, consent checks, audit/send logs |
| Budgets/cost centers | Kassier, Vorstand | Finance read/write permissions |
| Multilingual/accessibility | All | No special backend permission except content management |
| API/webhooks | Admin/IT | Admin-only configuration, scoped external access |
| Module configuration and enforcement | Admin/IT | Admin-only module-settings endpoints; `Module:*` authorization requirement on every gated route group; denial returns 403 and is audit logged. Admin and module-settings endpoints are never gated. |

### Audit and Logging

Audit events are required for:

- MFA reset and security-sensitive identity support.
- Session revocation by admin.
- Member merge.
- Paid event registration finance transitions.
- Check-in changes.
- Volunteer assignment changes if operational accountability is required.
- Automation sends, failures, and disabled definitions.
- Multi-channel sends and provider failures.
- Budget/cost center configuration changes.
- API key creation/revocation and webhook subscription changes.
- Module enablement changes and denied access to a disabled module.

### Integration Boundaries

External provider integrations must be Infrastructure adapters behind Application interfaces:

- Google/Microsoft identity stays in Keycloak.
- SMS/WhatsApp providers hide behind channel sender interfaces.
- Webhook outbound delivery hides behind a delivery service.
- Calendar output can be generated locally without third-party dependency.

### Background Job Rules

Jobs must:

- Be idempotent or have duplicate prevention.
- Log failures with enough context for support.
- Avoid exposing sensitive payloads in logs.
- Respect cancellation where framework supports it.
- Use explicit retry policies for provider interactions.

## Deployment and Infrastructure Impact

Local Docker Compose remains the development baseline.

Expected infrastructure changes by Backlog area:

- Social login and MFA: Keycloak realm/client/provider configuration changes.
- Session management: no new service, Keycloak Admin API usage.
- Automations and webhooks: more Hangfire jobs and PostgreSQL tables.
- Multi-channel messages: provider credentials and outbound network configuration in production.
- Calendar: no new service.
- Cost centers: database migrations only.
- Accessibility/multilingual: frontend assets/message files only unless content language metadata is added.

Production considerations:

- Provider credentials must be per-environment secrets.
- Outbound webhooks and SMS/WhatsApp providers require monitoring and failure handling.
- Rate limiting should be reviewed before external API exposure.
- Backup/restore coverage must include any new tables.

## Testing Architecture

### Backend

Required test types:

- Application unit tests for validators, handlers, duplicate detection rules, automation rules, cost center calculations.
- Infrastructure integration tests with Testcontainers PostgreSQL for repositories, migrations, relational constraints, merge behavior, webhook delivery persistence, and finance interactions.
- API tests for authorization, routing, serialization, and response contracts on sensitive endpoints.

Sensitive areas needing regression coverage:

- MFA/session admin support.
- Member merge.
- Paid event registration to finance records.
- Event check-in idempotency.
- Automation idempotency.
- Webhook signing/retry history.
- Finance budget/cost center reports.

### Frontend

Required test types:

- Vitest/Testing Library for shared controls, forms, permission-based rendering, validation, and API helper behavior.
- Playwright or manual validation for event check-in, paid event registration, member merge, automation setup, admin integration setup, and accessibility-critical flows.

### Acceptance Evidence

Each story should record:

- Requirement IDs covered.
- Backend tests run.
- Frontend checks run.
- Manual validation notes where browser, Keycloak, provider, or event-day behavior is involved.

## Implementation Sequencing Guidance

Recommended architecture-driven order:

1. Security and identity foundation: REQ-009, REQ-010, REQ-006.
2. Member data quality: REQ-018.
3. Event operational enhancements: REQ-023, REQ-024, REQ-025.
4. Event monetization: REQ-022, because it crosses Events and Finance.
5. Communication automation: REQ-028, then REQ-030.
6. Finance planning: REQ-044.
7. Cross-cutting quality: REQ-056, REQ-055.
8. External integration surface: REQ-058 after authorization/rate-limit/signing decisions are implemented.

This order reduces risk by stabilizing identity, member data, and event operations before adding provider integrations and externally callable APIs.

## Architecture Validation Checklist

- The design keeps IAB Connect as a modular monolith.
- Keycloak remains identity authority.
- Backend remains security boundary.
- All persistent state uses EF Core/PostgreSQL migrations.
- Background work uses Hangfire.
- External integrations are Infrastructure adapters behind Application interfaces.
- Finance changes preserve audit, retention, soft-delete, cancellation, and reversal behavior.
- Frontend work uses shared layout, typed API wrappers, next-intl, and existing UI standards.
- Each remaining Backlog requirement has an architecture path and security/testing expectations.

## Residual Risks

- The installed BMAD create-architecture workflow files are missing, so this document follows the available BMAD manifest/menu and local project architecture docs.
- Some source implementation details may differ from generated docs; epic/story planning should inspect relevant code before assigning work.
- Provider-specific details for Google, Microsoft Entra ID, SMS, WhatsApp, and production webhooks require environment-specific configuration decisions.
- REQ-023 remains a product/status ambiguity in the source status file; this architecture treats it as event-day workflow completion until product owners update status.

