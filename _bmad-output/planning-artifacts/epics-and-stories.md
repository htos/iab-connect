# IAB Connect Epics and Stories

Date: 2026-05-11
Last revised: 2026-06-07 — appended Epic E22 (Frontend Feature-Slice Migration — Sponsors), the first domain epic of the Frontend Refactoring Program materialised from `frontend-refactoring-roadmap.md` §E22 + the E21-S3 pilot recipe, with three grounded stories (E22-S1 characterization tests / E22-S2 list slice + Tier badge + `hi.json` parity / E22-S3 form sub-recipe); updated Traceability Matrix and Validation Checklist. Previously revised 2026-05-15 — appended Epics E11–E20 (Beta-on-Railway and Open Source Foundation) covering REQ-088 (E11–E18) and REQ-089 (E20), plus Production Readiness preparation (E19), with Scope, Epic Summary, Dependencies, Release Guidance, Traceability Matrix, and Validation Checklist updates (Sprint Change Proposal 2026-05-15, handoff step 3). Previously revised 2026-05-14 (appended Epic E9 Generic Positioning and White-Label Branding REQ-086 and Epic E10 Module Configuration and Access Enforcement REQ-087) for the generic white-label pivot (Sprint Change Proposal 2026-05-14, handoff step 4).
Project: IAB Connect
Document status: Draft epics and stories from validated PRD and architecture
Output location: `_bmad-output/planning-artifacts/epics-and-stories.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/prd-validation-report.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-14.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-15.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`
- `_bmad-output/project-context.md`

## Scope

This artifact covers the 14 remaining Backlog requirements:

- REQ-006 Social / Enterprise Logins
- REQ-009 Multi-factor Authentication
- REQ-010 Session and Device Management
- REQ-018 Duplicate Detection
- REQ-022 Ticketing / Fees
- REQ-023 On-site QR Check-in
- REQ-024 Volunteer Planning and Tasks
- REQ-025 Calendar Integration
- REQ-028 Automations / Journeys
- REQ-030 Multi-channel Messages
- REQ-044 Budgets and Cost Centers
- REQ-055 Multilingual DE/EN/HI
- REQ-056 Basic Accessibility
- REQ-058 API / Webhooks

The 2026-05-14 generic white-label pivot (Sprint Change Proposal 2026-05-14) adds two PRD-native requirements, covered by Epics E9 and E10:

- REQ-086 Generic Positioning and White-Label Branding
- REQ-087 Module Configuration and Access Enforcement

The 2026-05-15 Beta-on-Railway and Open Source Foundation pivot (Sprint Change Proposal 2026-05-15) adds two more PRD-native requirements, covered by Epics E11–E20:

- REQ-088 Beta Deployment Readiness (E11 Environment and Configuration, E12 Dockerization, E13 Railway Deployment, E14 Security and Secrets, E15 Database and Persistence, E16 Frontend/Backend Integration on Railway, E17 Monitoring/Logging/Health, E18 Beta Test Preparation and Operations Documentation)
- REQ-089 Open Source License Surface (E20 Open Source Foundation)

Epic E19 (Production Readiness Preparation) is a separate Beta-pivot epic that prepares for a future Production deployment without committing to it; it is not on the Beta-Go-Live critical path but removes blockers from the Production-Go-Live decision.

## Delivery Principles

- Preserve the modular monolith.
- Keep Keycloak as identity authority.
- Treat backend authorization as the security boundary.
- Use EF Core migrations for new persistent state.
- Use MediatR/Application services for workflow behavior.
- Use Hangfire for scheduled, retryable, or provider-facing background work.
- Use typed frontend API wrappers, next-intl, shared UI components, and orange primary styling.
- Record requirement IDs, tests run, and manual validation evidence for each completed story.

## Epic Summary

| Epic | Name | Requirements | Goal |
| --- | --- | --- | --- |
| E1 | Security and Identity Foundation | REQ-009, REQ-010, REQ-006 | Harden login, MFA, sessions, and federated identity. |
| E2 | Member Data Quality | REQ-018 | Detect and safely merge duplicate members. |
| E3 | Event Operations | REQ-023, REQ-024, REQ-025 | Improve event-day operations, volunteer planning, and calendar sharing. |
| E4 | Event Monetization | REQ-022 | Add paid event registration using the finance module. |
| E5 | Communication Automation | REQ-028, REQ-030 | Add automation journeys and optional channel abstraction. |
| E6 | Finance Planning | REQ-044 | Add budgets and cost center reporting. |
| E7 | Accessibility and Localization | REQ-056, REQ-055 | Establish accessibility baseline and multilingual expansion path. |
| E8 | External Integration Surface | REQ-058 | Add secured APIs and outbound webhooks. |
| E9 | Generic Positioning and White-Label Branding | REQ-086 | Make organization identity and branding admin-configurable; remove hardcoded organization references. |
| E10 | Module Configuration and Access Enforcement | REQ-087 | Let an Admin enable or disable functional modules, enforced at navigation, routing, and backend layers. |
| E11 | Environment and Configuration Management for Beta | REQ-088 | Establish `.env.example` files, `ASPNETCORE_ENVIRONMENT=Beta`, and environment-driven `next.config.ts`. |
| E12 | Dockerization | REQ-088 | Build reproducible backend, frontend, and custom Keycloak (SPI-baked) container images, plus an optional full-stack compose for local Beta-like testing. |
| E13 | Railway Beta Deployment | REQ-088 | Provision Railway project and services, configure environment variables, enforce public/private networking, wire health probes and first end-to-end deploy. |
| E14 | Security and Secrets Management | REQ-088 | Secrets audit, security headers and HTTPS review, Hangfire-dashboard verification, rate-limiting baseline, and log audit. |
| E15 | Database, Persistence, and Migrations | REQ-088 | Verify two-Postgres separation, add `Database__AutoMigrate` toggle, add daily PostgreSQL backup to RustFS, document Beta seeding strategy. |
| E16 | Frontend ↔ Backend Integration on Railway | REQ-088 | Verify frontend public URLs, validate end-to-end OIDC in Beta, validate document upload against RustFS. |
| E17 | Monitoring, Logging, and Health Checks | REQ-088 | Serilog Console-only in containers, structured logs with CorrelationId, frontend `/api/health` endpoint, external uptime monitoring. |
| E18 | Beta Test Preparation and Operations Documentation | REQ-088 | Author RUNBOOK-beta, Beta tester onboarding guide, BETA banner in UI, feedback channel. |
| E19 | Production Readiness Preparation | REQ-088 | Custom-domain runbook entry, backup-restore drill, production gate checklist, self-host SMTP migration plan (Postal on Hetzner). |
| E20 | Open Source Foundation | REQ-089 | Add LICENSE/NOTICE/CONTRIBUTING with DCO enforcement, SPDX header policy, backend `/about` endpoint, frontend license footer, GHCR image publishing pipeline. |

## Dependencies

1. E1 should happen before external APIs, provider integrations, or other sensitive admin surfaces.
2. E2 should happen before broad member-targeted automations to reduce duplicate communication risk.
3. E3 should happen before E4 if paid event registration depends on event operational maturity.
4. E4 depends on existing finance cancellation, reversal, invoice, receipt, and audit behavior.
5. E5 depends on existing email templates, campaigns, consent filtering, and Hangfire.
6. E8 should happen after authorization, audit, rate limiting, and provider secret practices are clear.
7. E9 and E10 are the active focus and preempt E4–E8 (OD-3, resolved 2026-05-14); E4–E8 were reset to backlog.
8. E10 should land before E8 when E4–E8 resume, so the external API route group is covered by module enforcement.
9. Within E10: E10-S3 (backend enforcement) depends on E10-S1 (module settings model and service); E10-S4 (frontend enforcement) depends on E10-S2 (the `modules` map on the public settings endpoint).
10. E9-S4 should precede the E7 i18n stories (E7-S3, E7-S4), or use explicit file-section ownership, to avoid merge churn in `de.json` and `en.json`.
11. The Beta-on-Railway and Open Source Foundation initiative (E11–E20) preempts the remaining Deferred Backlog (E4–E8) per Sprint Change Proposal 2026-05-15. E4–E8 resume only after the Beta validation completes.
12. Within E11–E20 the implementation waves (per SCP-2026-05-15 §6) are: Wave 1 OSS Foundation (E20-S1, E20-S2) → Wave 2 Configuration hygiene (E11-S1..S3) → Wave 3 Containerization (E12-S1..S3) → Wave 4 Source-disclosure (E20-S3, E20-S4) → Wave 5 CI publish (E20-S5) → Wave 6 Railway provisioning (E13-S1..S4) → Wave 7 Persistence and storage (E15-S1..S4, E16-S3) → Wave 8 Security and observability (E14-S1..S5, E17-S1..S4) → Wave 9 Beta operations (E18-S1..S4) → Wave 10 Production prep (E19-S1..S4, not Beta blocker).
13. E20-S5 (GHCR pipeline) depends on E12-S1..S3 (Dockerfiles must exist before CI can build images). E13-S1..S4 (Railway provisioning) depend on E20-S5 (Railway pulls images from GHCR rather than building from source).
14. E20-S3 (backend `/about`) depends on E12-S1's `BUILD_SHA` and `BUILD_DATE` build-args; E20-S4 (frontend footer) depends on E20-S3 (footer links to `/about`).
15. E18-S3 (BETA banner) depends on E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta` + `NEXT_PUBLIC_ENV_LABEL=beta`).
16. E14-S4 (rate-limiting baseline) should land before E8 (External Integration Surface) when E8 resumes, so external API routes inherit the rate-limit policy from day one.
17. Per the hybrid BMAD workflow (memory `feedback_bmad_workflow.md`): bundle `bmad-code-review` + `bmad-retrospective` at each epic boundary, not per story. This applies equally to E11–E20.

## Epic E1: Security and Identity Foundation

Requirements: REQ-009, REQ-010, REQ-006

Goal: Strengthen identity flows while keeping Keycloak as the source of truth and the backend as the enforcement boundary.

### Story E1-S1: Configure Role-Based MFA Policy

As an Admin, I want MFA to be enforceable for high-risk roles so that admin and finance accounts have stronger protection.

Requirements: REQ-009

Acceptance criteria:

- Keycloak configuration supports MFA enforcement for Admin and Kassier roles.
- Users in an MFA-required role cannot complete login without enrollment and verification.
- TOTP enrollment is supported.
- Recovery or backup-code behavior is documented.
- MFA failures and enrollment-sensitive actions are auditable where the application can observe them.

Architecture notes:

- Prefer Keycloak required actions and OTP policies.
- Do not store credentials or MFA secrets locally.

Tests/evidence:

- Manual Keycloak login validation for Admin and Kassier.
- Backend/API tests only if application endpoints are added.

### Story E1-S2: Add Admin MFA Support Operations

As an Admin, I want to reset MFA for a user through a controlled support flow so that locked-out users can recover access safely.

Requirements: REQ-009

Acceptance criteria:

- Authorized Admin can initiate MFA reset for a user.
- Non-admin users cannot reset another user's MFA.
- Reset operation uses Keycloak Admin API.
- Reset operation writes an audit/security event.
- UI communicates success/failure without exposing sensitive internal details.

Architecture notes:

- Add endpoints only if Keycloak console alone is not sufficient for product operations.
- Keep endpoint thin and delegate to Application/Infrastructure service.

Tests/evidence:

- API authorization tests.
- Unit tests around service error handling.
- Manual Keycloak integration validation.

### Story E1-S3: Add Session and Device Visibility

As a user, I want to see my active sessions or devices where available so that I understand where my account is active.

Requirements: REQ-010

Acceptance criteria:

- User can view active sessions or devices where Keycloak data supports it.
- Admin can view user sessions where authorized.
- Device/session details degrade gracefully if Keycloak metadata is limited.
- UI is translated through next-intl.
- Protected backend calls enforce user/admin authorization.

Architecture notes:

- Use Keycloak session APIs.
- Keep device data quality limitations visible in implementation notes.

Tests/evidence:

- API authorization tests.
- Frontend rendering tests for empty and populated states.
- Manual validation with multiple sessions.

### Story E1-S4: Add Session Revocation

As a user or Admin, I want to revoke active sessions so that compromised or stale access can be terminated.

Requirements: REQ-010

Acceptance criteria:

- User can terminate other own sessions.
- Admin can revoke sessions for a user.
- Revocation is reflected at the next protected interaction.
- Admin revocation writes an audit/security event.
- Timeout and idle-timeout behavior is documented.

Architecture notes:

- Use Keycloak Admin API/session APIs.
- Avoid local session state as authority.

Tests/evidence:

- API authorization tests.
- Manual validation with browser/session scenarios.

### Story E1-S5: Add Social and Enterprise Identity Providers

As a member, I want to sign in with Google or Microsoft so that I can use an external identity provider linked to my association account.

Requirements: REQ-006

Acceptance criteria:

- Google provider can be configured through Keycloak.
- Microsoft Entra ID provider can be configured through Keycloak.
- Provider scopes are minimal and documented.
- Account linking avoids account enumeration.
- Member can connect or disconnect a provider where policy allows.

Architecture notes:

- Use Keycloak identity provider federation.
- Add local metadata only if Keycloak data is insufficient.

Tests/evidence:

- Manual provider login validation in a non-production realm.
- Privacy/scope review note.

## Epic E2: Member Data Quality

Requirements: REQ-018

Goal: Prevent duplicate member records and provide a controlled merge workflow with audit evidence.

### Story E2-S1: Add Duplicate Candidate Detection

As an Admin, I want duplicate candidates to be detected so that I can avoid creating duplicate member records.

Requirements: REQ-018

Acceptance criteria:

- System detects exact email matches.
- System detects likely matches using normalized name and contact signals.
- Duplicate detection is available through an Application query.
- Matching rules are deterministic and unit tested.
- Results include enough information for Admin review without exposing unrelated sensitive data.

Architecture notes:

- Start deterministic before introducing fuzzy matching.
- Keep rules in Application/Domain service.

Tests/evidence:

- Unit tests for matching rules.
- Repository/integration tests if query uses PostgreSQL-specific behavior.

### Story E2-S2: Show Duplicate Warnings in Member Create/Edit

As an Admin, I want warnings during member create/edit so that I can stop before saving a duplicate.

Requirements: REQ-018

Acceptance criteria:

- Create and edit flows check for duplicate candidates.
- UI shows candidate summaries and links where authorized.
- Admin can continue only through an explicit confirmation when policy allows it.
- UI text uses next-intl.
- Existing member validation remains intact.

Architecture notes:

- Use typed member API wrapper.
- Avoid duplicate fetch chains after save.

Tests/evidence:

- Frontend form tests for warning states.
- Manual validation on create/edit.

### Story E2-S3: Implement Safe Member Merge

As an Admin, I want to merge duplicate members so that history and references remain intact.

Requirements: REQ-018

Acceptance criteria:

- Admin selects source and target member records.
- Merge preserves important references, including consents, documents, event registrations, finance references, and audit records where applicable.
- Unsafe merges are blocked with actionable reasons.
- Merge writes audit evidence with source and target IDs.
- Merge cannot be performed without member write/merge permission.

Architecture notes:

- Use `MergeMembersCommand`.
- Add `MemberMergeHistory` only if audit alone is insufficient.
- Integration tests should validate relational reference behavior.

Tests/evidence:

- Application tests for merge decisions.
- PostgreSQL integration tests for reference preservation.
- API authorization tests.

### Story E2-S4: Add Duplicate Review UI

As an Admin, I want a review page for duplicate candidates so that I can resolve data quality issues in batches.

Requirements: REQ-018

Acceptance criteria:

- Admin can view duplicate candidate groups.
- Admin can inspect source/target records before merge.
- Admin can trigger merge or dismiss a candidate where supported.
- List supports search/filter and pagination.
- UI uses shared components and translated text.

Architecture notes:

- Suggested route: `/members/duplicates`.
- Use table/list patterns from existing member pages.

Tests/evidence:

- Frontend rendering tests.
- Manual validation with seeded duplicate candidates.

## Epic E3: Event Operations

Requirements: REQ-023, REQ-024, REQ-025

Goal: Complete event-day check-in, volunteer planning, and calendar integration without bypassing event visibility or authorization.

### Story E3-S1: Add Event Check-in Roster and Export

As an Event Manager, I want an event check-in roster and offline export so that check-in can continue even if scanning fails.

Requirements: REQ-023

Acceptance criteria:

- Event-scoped roster shows registered attendees and status.
- Export includes enough data for manual check-in.
- Only authorized event staff/admin users can access roster/export.
- Export respects privacy and event visibility rules.
- Roster data is suitable for scanner/manual lookup UI.

Architecture notes:

- Add `GetEventCheckInRosterQuery` and `ExportEventCheckInRosterQuery`.
- Reuse existing registration data.

Tests/evidence:

- API authorization tests.
- Application tests for roster filtering.

### Story E3-S2: Add QR and Manual Check-in Flow

As event staff, I want to scan QR codes or manually search attendees so that I can mark attendance quickly.

Requirements: REQ-023

Acceptance criteria:

- Staff can scan a registration QR code and update check-in status.
- Duplicate scans show current state and do not create duplicate attendance records.
- Staff can manually search and check in an attendee.
- Check-in changes are auditable.
- UI handles camera unavailable and invalid QR states.

Architecture notes:

- Add `CheckInRegistrationCommand` and `ManualCheckInRegistrationCommand`.
- QR scan should call backend for final authorization/state change.

Tests/evidence:

- Application tests for idempotent check-in.
- API authorization tests.
- Playwright/manual browser validation for scanner fallback.

### Story E3-S3: Add Volunteer Planning Domain and API

As an Event Manager, I want to define volunteer roles, shifts, and tasks so that event staffing can be planned in the system.

Requirements: REQ-024

Acceptance criteria:

- Event manager can create roles, tasks, shifts, and capacity per event.
- Assignments can be created, updated, and removed.
- Capacity rules prevent overbooking unless explicitly allowed.
- Changes are authorized and audit logged where operationally sensitive.
- EF migration adds required tables/configuration.

Architecture notes:

- Suggested entities: `EventVolunteerRole`, `EventVolunteerShift`, `EventVolunteerAssignment`.
- Keep in Events module.

Tests/evidence:

- Domain/Application tests for capacity rules.
- PostgreSQL integration tests for persistence.
- API authorization tests.

### Story E3-S4: Add Volunteer Planning UI and Reminders

As an Event Manager, I want to manage volunteer assignments and reminders from the event UI.

Requirements: REQ-024

Acceptance criteria:

- Event detail provides volunteer planning UI.
- Members/volunteers can sign up where event policy allows it.
- Event manager can assign and adjust volunteers.
- Shift plan is exportable.
- Reminder messages use existing email/notification infrastructure and consent/preference checks.

Architecture notes:

- Add UI under `/events/[id]`.
- Reminder send can use Hangfire if scheduled.

Tests/evidence:

- Frontend tests for role-based actions.
- Manual validation for export and reminder send.

### Story E3-S5: Add Calendar Feed and ICS Export

As a member or public visitor, I want calendar feeds or event exports so that I can subscribe to association events.

Requirements: REQ-025

Acceptance criteria:

- Public iCal feed includes only public events.
- Per-event `.ics` export includes stable UID, title, date/time, location, and summary.
- Member-only/private events are not exposed through unauthenticated public feeds.
- Event updates preserve stable calendar identity.
- Public website can link or embed calendar output safely.

Architecture notes:

- Generate ICS locally from event read models.
- Avoid third-party calendar dependency.

Tests/evidence:

- Unit tests for ICS generation.
- API tests for visibility filtering.

## Epic E4: Event Monetization

Requirements: REQ-022

Goal: Support paid event registration through existing Events and Finance modules.

### Story E4-S1: Add Event Fee Configuration

As an Event Manager or Kassier, I want to configure fees for an event so that paid registration can be offered.

Requirements: REQ-022

Acceptance criteria:

- Event can have one or more fee categories.
- Fee categories include amount, currency, availability, and optional member/public applicability.
- Only authorized users can configure fees.
- Event fee changes are validated and auditable.
- Existing free-event registration remains unaffected.

Architecture notes:

- Extend Event module with fee configuration.
- Use EF migration for durable fee state.

Tests/evidence:

- Domain/Application tests for fee validation.
- API authorization tests.

### Story E4-S2: Connect Paid Registration to Finance

As a Kassier, I want paid event registration to create finance records so that fees can be tracked and reconciled.

Requirements: REQ-022

Acceptance criteria:

- Paid registration creates the required invoice, payment request, receipt, or finance record according to finance rules.
- Finance record references the event registration.
- Cancellation/refund uses cancellation/reversal behavior, not hard delete.
- Finance permissions are required for finance approval/reconciliation actions.
- Failure to create finance records does not leave inconsistent registration state.

Architecture notes:

- Use Application service to coordinate Events and Finance.
- Use database transaction where cross-module state must be atomic.

Tests/evidence:

- Integration tests for registration to finance record.
- Regression tests for cancellation/reversal.

### Story E4-S3: Add Paid Registration UI

As a member or public visitor, I want to understand event fees during registration so that I can confirm a paid event registration.

Requirements: REQ-022

Acceptance criteria:

- Registration page shows fee category and amount.
- Confirmation email includes ticket or payment information.
- UI handles free, paid, waitlisted, cancelled, and payment-pending states.
- Admin/event manager participant view shows fee/payment state.
- UI text uses translations and existing event components.

Architecture notes:

- Use typed event/finance DTOs.
- Avoid hardcoded money formatting assumptions.

Tests/evidence:

- Frontend tests for state rendering.
- Manual validation of paid registration journey.

## Epic E5: Communication Automation

Requirements: REQ-028, REQ-030

Goal: Add automation journeys and optional multi-channel messaging through provider abstractions and existing consent-aware communication infrastructure.

### Story E5-S1: Add Automation Definition Model and API

As a Communication user, I want to define automation journeys so that standard messages can be triggered automatically.

Requirements: REQ-028

Acceptance criteria:

- Authorized user can create, edit, pause, resume, and disable automation definitions.
- Automation definitions include trigger, template, recipient rules, and status.
- Recipient rules respect consent and role/member filters.
- Invalid automation definitions are rejected by validators.
- Changes are auditable.

Architecture notes:

- Suggested entities: `AutomationDefinition`, `AutomationTrigger`.
- Use MediatR commands/queries and FluentValidation.

Tests/evidence:

- Application tests for validation.
- API authorization tests.
- PostgreSQL integration tests for persistence.

### Story E5-S2: Add Automation Execution Engine

As the system, I want to execute automation journeys reliably so that messages send once to the correct recipients.

Requirements: REQ-028

Acceptance criteria:

- Hangfire executes automation jobs.
- Execution records track status, recipients, failures, and timestamps.
- Idempotency prevents duplicate sends for the same trigger/recipient.
- Failed sends are logged and visible.
- Execution does not block unrelated user workflows.

Architecture notes:

- Suggested entities: `AutomationExecution`, `AutomationRecipient`.
- Trigger from application events where reliable, otherwise scheduled polling.

Tests/evidence:

- Application tests for idempotency.
- Infrastructure tests for execution persistence.

### Story E5-S3: Add Automation Management UI

As a Communication user, I want a management UI for automations so that I can configure, preview, and monitor journeys.

Requirements: REQ-028

Acceptance criteria:

- UI lists automations with status, trigger, template, and recent execution state.
- User can create/edit automation definitions.
- User can preview recipients before activation.
- User can pause/resume/disable automations.
- UI uses shared components, filters/search, and translated text.

Architecture notes:

- Suggested route: `/communication/automations`.
- Reuse template and campaign patterns.

Tests/evidence:

- Frontend tests for form validation and status actions.
- Manual validation with MailHog.

### Story E5-S4: Add Multi-channel Messaging Abstraction

As the system, I want message sending behind a channel abstraction so that SMS or WhatsApp providers can be added without changing communication workflows.

Requirements: REQ-030

Acceptance criteria:

- Application defines channel sender interfaces.
- Email remains the default channel.
- SMS/WhatsApp provider adapters can be added through Infrastructure.
- Provider failures and delivery statuses can be logged where available.
- External credentials are config secrets, not source files.

Architecture notes:

- Suggested interfaces: `IMessageChannelSender`, `IMessageProvider`, `IChannelPreferenceService`.
- Provider-specific implementation can start with a disabled/stub adapter if production provider is undecided.

Tests/evidence:

- Unit tests for channel selection.
- Configuration documentation for provider setup.

### Story E5-S5: Add User Channel Preferences

As a user, I want to choose communication channels where supported so that reminders use my preferred channel.

Requirements: REQ-030

Acceptance criteria:

- User can view and update channel preferences.
- Sending checks consent, preference, and provider availability before using a channel.
- Missing consent/preference/provider blocks the send gracefully.
- Preference updates are validated and persisted.
- UI uses next-intl and existing profile/settings patterns.

Architecture notes:

- Reuse privacy/consent concepts where possible.
- Avoid sending through unconfigured providers.

Tests/evidence:

- Application tests for channel eligibility.
- Frontend tests for preference UI.

## Epic E6: Finance Planning

Requirements: REQ-044

Goal: Add budgets and cost centers without weakening existing finance compliance behavior.

### Story E6-S1: Add Cost Center and Budget Model

As a Kassier, I want to create cost centers and budgets so that event/project costs can be planned and tracked.

Requirements: REQ-044

Acceptance criteria:

- Kassier/Vorstand can create, edit, and deactivate cost centers.
- Budget values can be assigned by fiscal period.
- Validation prevents invalid periods, duplicate active names where inappropriate, and negative budget values unless explicitly allowed.
- Changes respect finance permissions.
- EF migration adds required tables/configuration.

Architecture notes:

- Suggested entities: `CostCenter`, `CostCenterBudget`.
- Keep in Finance module.

Tests/evidence:

- Domain/Application tests for validation.
- PostgreSQL integration tests.
- API authorization tests.

### Story E6-S2: Associate Finance Records with Cost Centers

As a Kassier, I want finance records to be associated with cost centers so that actuals can be compared to budget.

Requirements: REQ-044

Acceptance criteria:

- Eligible transactions, invoices, or journal mappings can reference a cost center.
- Existing finance records continue to work without a cost center.
- Cost center assignment respects locked periods and posted-entry rules.
- Updates are auditable where finance changes require it.
- Import/export behavior handles cost center fields where applicable.

Architecture notes:

- Use nullable FKs or mapping entities depending on existing finance model fit.
- Preserve cancellation/reversal/soft-delete behavior.

Tests/evidence:

- Integration tests for locked-period behavior.
- Regression tests for existing finance flows.

### Story E6-S3: Add Budget vs Actual Reports

As a Vorstand or Kassier, I want budget vs actual reports by cost center so that I can track project/event financial performance.

Requirements: REQ-044

Acceptance criteria:

- Report shows budget, actual, variance, fiscal period, and cost center.
- Report respects finance read permissions.
- Report is filterable by period and cost center.
- Export is available where existing finance export patterns support it.
- UI uses existing finance reporting layout and translations.

Architecture notes:

- Use query/read model suited to PostgreSQL.
- Avoid loading unnecessary object graphs.

Tests/evidence:

- Application/query tests for calculations.
- Frontend/manual validation of filters and export.

## Epic E7: Accessibility and Localization

Requirements: REQ-056, REQ-055

Goal: Establish quality baselines for accessibility and multilingual operation across touched flows.

### Story E7-S1: Define Accessibility Baseline and Audit Critical Pages

As a product team, I want an explicit accessibility baseline so that new and touched pages meet basic usability expectations.

Requirements: REQ-056

Acceptance criteria:

- Accessibility checklist covers keyboard navigation, labels, focus, icon names, contrast, and validation messages.
- Critical pages from PRD journeys are audited.
- Findings are tracked by page/flow and severity.
- High-impact issues on touched pages are fixed or explicitly deferred.
- Manual or automated evidence is recorded.

Architecture notes:

- Add docs/checklist under planning or project docs if needed.
- Use existing components before one-off fixes.

Tests/evidence:

- Manual keyboard checks.
- Component tests where practical.
- Playwright checks for critical flows where useful.

### Story E7-S2: Improve Shared Component Accessibility

As a user, I want shared controls to be keyboard and screen-reader friendly so that accessibility improves across the application.

Requirements: REQ-056

Acceptance criteria:

- Icon-only buttons have accessible names.
- Form controls have programmatic labels and validation messages.
- Focus states are visible.
- Status badges/alerts meet basic contrast expectations.
- Changes do not break existing visual design standards.

Architecture notes:

- Prioritize `components/ui` and navigation/shared components.
- Use lucide-react icons with labels/tooltips where appropriate.

Tests/evidence:

- Vitest/Testing Library tests for shared controls.
- Manual visual/keyboard validation.

### Story E7-S3: Add Hindi Translation Expansion Path

As an Admin or user, I want the app to support language expansion so that Hindi can be introduced incrementally without hardcoded strings.

Requirements: REQ-055

Acceptance criteria:

- Existing DE/EN translation behavior remains stable.
- Hindi message file structure can be introduced.
- Missing keys fall back safely.
- New/touched UI has no hardcoded user-facing text.
- Language preference persists where existing localization infrastructure supports it.

Architecture notes:

- Continue next-intl.
- Backend enum values remain untranslated contract values.

Tests/evidence:

- Frontend type/check build validation for messages.
- Manual language switch validation.

### Story E7-S4: Add Content Language Metadata Where Needed

As a content manager, I want public content to identify its language so that multilingual content can be managed cleanly.

Requirements: REQ-055

Acceptance criteria:

- Public content/event/blog records can identify content language where applicable.
- Existing content continues to display with a default language.
- Public pages can filter or display language metadata without breaking current routes.
- Content language changes are authorized through existing content management permissions.
- Migration preserves existing data.

Architecture notes:

- Only add metadata to content models where multilingual content is product-approved.
- Avoid translating backend enum contract values.

Tests/evidence:

- Migration/integration tests.
- Frontend rendering tests for language metadata.

## Epic E8: External Integration Surface

Requirements: REQ-058

Goal: Add secure read APIs and webhooks for future integrations with scoped access, rate limiting, signing, and delivery history.

### Story E8-S1: Add API Credentials and Scopes

As an Admin/IT user, I want to create scoped API credentials so that integrations can access only approved resources.

Requirements: REQ-058

Acceptance criteria:

- Admin can create and revoke API credentials.
- Credentials are shown only once and stored using a token-safe design.
- Scopes limit accessible resources/actions.
- Credential use is logged.
- External API routes enforce scopes and rate limits.

Architecture notes:

- Suggested entities: `ApiClient`, `ApiScope`.
- Do not store raw API tokens.

Tests/evidence:

- API auth/scope tests.
- Security review of token storage.

### Story E8-S2: Add Read API Endpoints

As an integration, I want scoped read APIs so that approved systems can consume IAB Connect data.

Requirements: REQ-058

Acceptance criteria:

- Initial read APIs expose only approved low-risk resources.
- Responses avoid leaking sensitive fields by default.
- Pagination, filtering, and rate limits are applied.
- API contracts are documented.
- Access denied and rate-limit behavior are testable.

Architecture notes:

- Prefer separate external API route group if contract differs from internal frontend API.
- Reuse Application queries but map to integration-safe DTOs.

Tests/evidence:

- API tests for scopes, pagination, and sensitive field exclusion.
- Contract documentation.

### Story E8-S3: Add Webhook Subscriptions and Signing

As an Admin/IT user, I want to configure webhooks so that external systems can receive selected events.

Requirements: REQ-058

Acceptance criteria:

- Admin can create, edit, disable, and delete webhook subscriptions.
- Supported events include event created and payment received at minimum if product-approved.
- Payloads are signed or otherwise verifiable.
- Secret material is generated/stored safely.
- Subscription changes are auditable.

Architecture notes:

- Suggested entity: `WebhookSubscription`.
- Use event whitelist, not arbitrary internal event exposure.

Tests/evidence:

- Unit tests for signing.
- API authorization tests.

### Story E8-S4: Add Webhook Delivery, Retry, and History

As an Admin/IT user, I want webhook delivery history so that integration failures can be diagnosed.

Requirements: REQ-058

Acceptance criteria:

- Webhook deliveries are queued through Hangfire.
- Delivery attempts, response status, failures, retry count, and next retry are recorded.
- Admin can view delivery history.
- Repeated failures can disable or pause a subscription according to policy.
- Sensitive payload data is not overexposed in logs/UI.

Architecture notes:

- Suggested entity: `WebhookDelivery`.
- Jobs must be idempotent enough for retry behavior.

Tests/evidence:

- Infrastructure tests for delivery persistence.
- Unit tests for retry policy.
- Manual validation against a local test receiver.

## Epic E9: Generic Positioning and White-Label Branding

Requirements: REQ-086

Goal: Make organization identity and branding admin-configurable and remove hardcoded organization references from user-visible surfaces, so the platform can be deployed white-label for any organization. The single-tenant architecture is preserved.

### Story E9-S1: Extend SystemSettings and Add Branding Admin UI

As an Admin, I want to configure organization identity, branding, and contact information so that the platform reflects my organization without code changes.

Requirements: REQ-086

Acceptance criteria:

- `SystemSettings` is extended with nullable fields: description, contact email, contact phone, contact address, primary color, public-site-enabled, and a logo asset reference.
- All new fields are nullable with behavior-preserving defaults; the existing single `system_settings` row remains valid after migration.
- An `UpdateOrganizationProfile` method (or equivalent) on the entity sets the extended fields, keeping the private-setter plus explicit-method pattern.
- A new "Branding" tab in `/admin/settings` lets an Admin edit all branding and profile fields with a live preview.
- Extended fields are exposed through `GET/PUT /api/v1/settings` (admin) and the non-sensitive subset through `GET /api/v1/settings/public` (anonymous).
- Logo asset upload is supported; no shared file-upload component exists today.
- Branding changes write an audit event through the existing `AuditEventType.SettingsChanged` path.

Architecture notes:

- Extend the existing `SystemSettings` singleton (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) — do not introduce a new entity (architecture REQ-086).
- One EF Core migration adds the nullable columns, with explicit snake_case `HasColumnName` per the `SystemSettingsConfiguration` pattern.
- Frontend: extend the `AppSettings` type and `AppSettingsProvider`; the Branding tab docks onto the existing `general`/`customRoles` tab structure (UX: Platform Branding Configuration).

Tests/evidence:

- Domain/Application tests for `UpdateOrganizationProfile` validation.
- API authorization tests for admin versus public field exposure.
- Migration/integration test that an existing row stays valid.
- Frontend tests for the Branding tab form and preview.

### Story E9-S2: Replace Hardcoded Organization References in Frontend

As an Admin, I want no hardcoded organization name or branding in the frontend so that the deployed app shows my organization everywhere.

Requirements: REQ-086

Acceptance criteria:

- Hardcoded organization references are removed from frontend source: `app/layout.tsx` metadata, `PublicHeader`/`PublicFooter`, `login`, `app/page.tsx`, `admin/register`, `public/contact`, and email-campaign `fromName` defaults.
- Removed references render from `SystemSettings` (via `useAppSettings()`) or next-intl keys.
- No user-visible frontend string hardcodes a specific organization.
- Existing behavior is preserved when settings carry the previous values.

Architecture notes:

- Roughly 23 occurrences across 13 files per the Sprint Change Proposal codebase scan.
- Use the typed `AppSettings` provider; do not fetch settings ad hoc per component.

Tests/evidence:

- Frontend tests for components now rendering from settings.
- Manual validation that changing `applicationName` updates all surfaces.

### Story E9-S3: Replace Hardcoded Organization References in Backend

As an Admin, I want no hardcoded organization name in backend-generated output so that emails, PDFs, calendar feeds, and API docs reflect my organization.

Requirements: REQ-086

Acceptance criteria:

- Hardcoded references are removed from backend source: `EventNotificationService` (the `<h1>IAB Connect</h1>` email HTML), `DunningEmailService`, `EventRegistrationPdfExporter`, `SmtpSettings.FromName`, the Swagger title/description, `CalendarFeedBuilder.ProdId`, `DevelopmentDataSeeder`, and `appsettings`.
- Removed references render from `SystemSettings` or configuration.
- Email HTML, PDF exports, and the iCal `ProdId` use the configured organization name.
- Behavior-preserving defaults: existing configuration values keep current output.

Architecture notes:

- Roughly 19 occurrences across 11 files per the Sprint Change Proposal scan.
- The `CalendarFeedBuilder.ProdId` change is a forward-fix to the done E3 epic; non-breaking, with the config default preserving behavior.
- The `IabConnect.*` namespace and assembly rename is explicitly out of scope (OD-4).

Tests/evidence:

- Backend tests for email, PDF, and calendar output using a configured name.
- Regression tests for the calendar feed (done E3 functionality).

### Story E9-S4: Generalize i18n Branding Strings

As an Admin, I want translation files free of organization-specific text so that language files are reusable across deployments.

Requirements: REQ-086

Acceptance criteria:

- Organization-specific strings in `frontend/messages/de.json` and `en.json` are generalized: `dashboardDescription`, `welcomeGuest`, the public-site `description`/`copyright`/`subscribeDescription`, and Bern-specific placeholder examples (`locationPlaceholder`, address placeholders).
- Generalized strings either reference the configured organization name through interpolation or use neutral wording.
- DE/EN behavior remains stable; no keys still used by components are removed.

Architecture notes:

- Roughly 19 occurrences in `de.json` and `en.json` per the Sprint Change Proposal scan.
- Coordinate with E7-S3/E7-S4, which also edit these files — recommend E9-S4 before the E7 i18n stories, or explicit file-section ownership, to avoid merge churn.

Tests/evidence:

- Frontend typecheck/build validation for messages.
- Manual validation of public site and dashboard text.

## Epic E10: Module Configuration and Access Enforcement

Requirements: REQ-087

Goal: Let an Admin enable or disable functional modules per deployment, enforced at navigation, routing, and backend layers, with the backend as the security boundary. The solution is extensible to new modules.

### Story E10-S1: Add Module Settings Data Model and Service

As the system, I want module enablement state persisted and cached so that module configuration can drive enforcement.

Requirements: REQ-087

Acceptance criteria:

- A `module_settings` table is created with `id`, `module_key` (unique), `enabled`, `updated_at`, and `updated_by`.
- The creating migration seeds the 7 modules (`members`, `events`, `documents`, `communication`, `finance`, `partners`, `public_view`), all enabled — existing deployments behave identically after upgrade.
- A `ModuleSetting` entity follows the `SystemSettings` pattern: private EF constructor, factory, and an explicit `SetEnabled` method.
- An `IModuleSettingsService` provides cached reads; the cache is invalidated on write.
- A `ModuleKeys` constants class is the shared module-key contract, referenceable by both `IabConnect.Api` and `IabConnect.Application`.

Architecture notes:

- Architecture ADR-007: dedicated table, no `organization_id` (single-tenant); resolves OD-2.
- `ModuleSettingConfiguration : IEntityTypeConfiguration<ModuleSetting>` with `ToTable("module_settings")`, explicit snake_case columns, and a unique index on `module_key`.
- `IModuleSettingsRepository` follows the `ISystemSettingsRepository` pattern.

Tests/evidence:

- PostgreSQL integration test for table creation, seed, and the unique constraint.
- Application tests for `IModuleSettingsService` cache behavior and invalidation.

### Story E10-S2: Add Module Settings API and Modules Admin Tab

As an Admin, I want to enable or disable modules through the admin UI so that I control which functionality my deployment uses.

Requirements: REQ-087

Acceptance criteria:

- An admin-only endpoint group exposes module-settings read and update through MediatR query/command.
- The `modules` map is added to the anonymous `GET /api/v1/settings/public` response so the frontend shell and middleware can read it.
- A new "Modules" tab in `/admin/settings` shows a toggle list with a per-module description and last-changed metadata.
- Disabling a module shows a confirmation dialog; cross-module dependency warnings are shown where relevant.
- Module-settings changes write an audit event.
- The module-settings endpoints and the Admin module are never gated (self-lockout guard).

Architecture notes:

- Architecture ADR-008 and UX: Module Configuration flow.
- Reuse the existing tab structure in `frontend/src/app/admin/settings/page.tsx`.

Tests/evidence:

- API authorization tests: admin-only, and the module-settings endpoints are not gated.
- Frontend tests for the Modules tab toggle, confirmation, and dependency warnings.

### Story E10-S3: Add Backend Module Enforcement

As a security stakeholder, I want disabled-module endpoints to return 403 so that the backend is the real enforcement boundary.

Requirements: REQ-087

Acceptance criteria:

- A `ModuleRequirement` plus `ModuleAuthorizationHandler` gate each module's endpoint group; a disabled module yields 403.
- The policy provider recognizes a `Module:` policy-name prefix so route groups declare `.RequireAuthorization("Module:<key>")`.
- Denial writes a security audit event (`ModuleAccessDenied`) via `ISecurityAuditLogger.LogAccessDenied`.
- Enforcement is applied across the Members, Events, Documents, Communication, Finance, and Partners route groups.
- The Admin module and the module-settings endpoints are never gated.

Architecture notes:

- Architecture ADR-008: model on the existing `PermissionRequirement` / `PermissionAuthorizationHandler` / `PermissionPolicyProvider` pattern in `backend/src/IabConnect.Api/Authorization/` — there is no `IEndpointFilter` infrastructure.
- New `AuditEventType.ModuleAccessDenied` in `AuditEnums.cs`.
- Register the handler in `DependencyInjection.cs` alongside `PermissionAuthorizationHandler`.

Tests/evidence:

- API tests: a disabled module returns 403 and an audit event is written; an enabled module passes.
- Application tests for the authorization handler.

### Story E10-S4: Add Frontend Module Enforcement

As a user, I want disabled modules hidden from navigation and blocked on direct URL so that the UI reflects my deployment's configuration.

Requirements: REQ-087

Acceptance criteria:

- The `AppSettings` type and `AppSettingsProvider` are extended with a `modules` map.
- `NavItem` gains a `requiresModule` flag; the `Sidebar` filters disabled modules with the same mechanism as the existing `requiresDoubleEntry` flag.
- A new `frontend/src/middleware.ts` rewrites direct navigation to disabled-module routes to `/module-unavailable`.
- A new `/module-unavailable` page renders inside the authenticated shell with a back-to-dashboard action.
- Dashboard widgets sourced from disabled modules are hidden.
- UI hiding and route rewriting are UX only; the backend 403 from E10-S3 is the control.

Architecture notes:

- Architecture ADR-008 layers 2 and 3; UX: Module Unavailable and Access Denied flow.
- No `middleware.ts` exists today — it is created new.
- The module-to-route mapping is a shared frontend contract referenced by both `middleware.ts` and `Sidebar`.

Tests/evidence:

- Frontend tests for Sidebar filtering by module.
- Tests for `middleware.ts` redirect and rewrite behavior.
- Manual validation: disable a module, confirm the nav entry is hidden and the direct URL is rewritten.

### Story E10-S5: Add Public View Toggle and Cross-Module Dependency Handling

As an Admin, I want the Public View module and cross-module dependencies handled safely so that disabling a module does not break dependent functionality or expose data.

Requirements: REQ-087

Acceptance criteria:

- When Public View is disabled, `/public/*` and the public landing `/` are rewritten by `middleware.ts` to a minimal neutral "site not public" page (OD-5 resolved).
- The minimal page renders organization branding from the still-reachable `GET /api/v1/settings/public` and offers a discreet member-login link; it falls back to an unbranded message if settings fail.
- Public and anonymous backend endpoints are gated when Public View is disabled, except `GET /api/v1/settings/public`.
- Cross-module dependency handling is defined for Events and Finance (paid registration requires Finance): the behavior when Events is enabled but Finance is disabled is decided and implemented — block the toggle, warn, or degrade.
- Background-job (Hangfire) behavior for disabled modules is defined and implemented.
- End-to-end tests cover enabling and disabling each module.

Architecture notes:

- Architecture ADR-008: Public View special-casing and the cross-module dependency note; UX: Public View Disabled flow.
- OD-5: a minimal neutral page over a login redirect.

Tests/evidence:

- End-to-end tests for each module enable/disable.
- Tests for the Public View disabled page and the settings-fetch fallback.
- Tests for the cross-module dependency behavior between Events and Finance.

## Epic E11: Environment and Configuration Management for Beta

Requirements: REQ-088

Goal: Establish a Beta environment identity (`ASPNETCORE_ENVIRONMENT=Beta`), provide complete `.env.example` files for backend and frontend, and remove hardcoded host references from `next.config.ts` so the application is deployable to a non-local target without source changes.

### Story E11-S1: Add `.env.example` files and document configuration precedence

As a new developer or self-hoster, I want a complete `.env.example` for backend and frontend so that I can configure local, Beta, and Production deployments without reading the source.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `backend/.env.example` exists and covers `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `ConnectionStrings__DefaultConnection`, `Keycloak__Authority`, `Keycloak__ClientId`, `Keycloak__ClientSecret`, `Auth__CalendarTokenPepper`, `Frontend__BaseUrl`, `DocumentStorage__*`, `Smtp__*`, `Branding__*`, `RetentionEnforcement__Enabled`, `Backup__EncryptionKey`.
- `frontend/.env.example` is updated to include `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`, `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`.
- Every entry carries a `# Required | Optional | Dev-only` annotation; no entry contains a real secret value (placeholders use `__set_in_environment__` or similar non-token-looking strings).
- `.gitignore` is verified to exclude `**/.env`, `**/.env.local`, `**/.env.*.local`.
- README contains a new "Configuration precedence" section documenting `appsettings.json` < `appsettings.{Env}.json` < environment variables (backend) and `.env` < `.env.local` < runtime environment (frontend).

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Ripgrep for `localhost`, `5433`, `9000`, `rustfsadmin`, `iabconnect-documents` outside of `appsettings.Development.json`, dev-compose, and test code yields zero hits.

### Story E11-S2: Introduce `ASPNETCORE_ENVIRONMENT=Beta`

As the maintainer, I want a distinct Beta environment label so that Production-grade hardenings apply while a tester-visible label can differentiate Beta from Production.

Requirements: REQ-088 AC-7

Acceptance criteria:

- `backend/src/IabConnect.Api/appsettings.Beta.json` exists with non-sensitive Beta defaults: Serilog Console-only (`WriteTo` array excludes File sink), `Logging.LogLevel.Default = Information`, `RetentionEnforcement:Enabled = false`.
- Code audit confirms no `IsDevelopment()` check has been relaxed to `IsDevelopment() || envName == "Beta"` — Beta inherits Production hardenings (no Swagger, no Hangfire dashboard, strict CORS, HSTS, HTTPS redirect).
- Frontend renders a persistent orange BETA banner when `NEXT_PUBLIC_ENV_LABEL=beta`; banner is dismissable per session.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Manual `dotnet run` with `ASPNETCORE_ENVIRONMENT=Beta` shows: Swagger 404, no Hangfire dashboard, strict CORS error from a non-allowed origin, retention job not registered (verify via `IRecurringJobManager` listing).

### Story E11-S3: Make `next.config.ts` environment-driven

As the maintainer, I want frontend image and API hosts to be environment-driven so that the build is not hardcoded to localhost.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `frontend/next.config.ts`: `images.remotePatterns` is computed from `process.env.NEXT_PUBLIC_DOCUMENT_HOST` at build time, with a localhost fallback for dev.
- `output: 'standalone'` is enabled.
- `NEXT_PUBLIC_API_URL` continues to be exposed but is documented as build-time-constant (any URL change requires a rebuild).

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.app --build-arg NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app .` then `grep -r "api.example.app" .next/static/` returns matches.

## Epic E12: Dockerization

Requirements: REQ-088

Goal: Produce reproducible container images for the three application services — backend, frontend, and Keycloak with the custom SPI baked in — plus an optional full-stack compose for local Beta-like testing.

### Story E12-S1: Backend Dockerfile (multi-stage)

As the CI pipeline, I want a reproducible backend image so that Railway pulls identical artifacts on every deploy.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `backend/Dockerfile` exists with two stages: build (`mcr.microsoft.com/dotnet/sdk:9.0`, `dotnet restore` + `dotnet publish -c Release`) and runtime (`mcr.microsoft.com/dotnet/aspnet:9.0`).
- Runtime stage installs `tzdata` and sets `TZ=Europe/Zurich` so that `ResolveReminderJobTimeZone` (`DependencyInjection.cs:361`) does not fall back to UTC.
- Container runs as non-root `USER 1000`.
- Container exposes 8080 and `ASPNETCORE_URLS=http://+:8080`.
- `backend/.dockerignore` excludes `bin/`, `obj/`, `logs/`, `tests/`, `*.user`, `.env*`, `.vs/`.
- Image contains no `appsettings.*.json` carrying secrets — only Dev/Beta non-sensitive defaults.
- Build-args `BUILD_SHA` and `BUILD_DATE` are accepted and surfaced via the `/about` endpoint (consumed by Story E20-S3).

Architecture notes:

- ADR-012 (Service Topology on Railway).

Tests/evidence:

- `docker build -t iabc-api backend/` succeeds; `docker run --rm iabc-api` shows the application logging "missing connection string" and exiting without crash-looping.

### Story E12-S2: Frontend Dockerfile (Next standalone)

As the CI pipeline, I want a reproducible frontend image with the correct build-time public variables baked in.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `frontend/Dockerfile` exists with three stages: deps (`npm ci`), build (`next build` with build-args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`), runtime (`node:22-alpine` + `.next/standalone`).
- Container runs as non-root `USER node`.
- Container exposes 3000 and starts via `node server.js`.
- `frontend/.dockerignore` excludes `node_modules`, `.next`, `coverage`, `e2e`.

Architecture notes:

- ADR-012 (Service Topology on Railway).

Tests/evidence:

- `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.app -t iabc-web frontend/` succeeds; output image size ≤ 250 MB; the resulting `.next/static/` chunks contain `https://api.example.app`.

### Story E12-S3: Custom Keycloak image with SPI baked-in

As the deployment, I want Keycloak's `disable-new-users` SPI to travel inside the container image so that Railway does not need volume mounts for it.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `infra/keycloak/Dockerfile` exists with a builder stage that compiles the SPI (`mvn -f infra/keycloak/providers/disable-new-users/pom.xml package`) and a final stage based on `quay.io/keycloak/keycloak:26.5.2`.
- Final stage copies the SPI JAR into `/opt/keycloak/providers/` and runs `RUN /opt/keycloak/bin/kc.sh build` to pre-build Keycloak with the provider.
- Realm import JSON is copied to `/opt/keycloak/data/import` and contains all seven roles (Admin, Vorstand, Kassier, Auditor, Member, EventManager, EventStaff) and the two confidential clients (`iabconnect-api`, `iabconnect-frontend`), with no committed dev client secrets.
- `ENTRYPOINT` uses `start` (not `start-dev`).

Architecture notes:

- ADR-016 (Custom Keycloak Image with SPI Baked In).

Tests/evidence:

- `docker build -t iabc-keycloak infra/keycloak/` succeeds; `docker run -e KC_DB=dev-file -e KC_HOSTNAME=localhost -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin iabc-keycloak start --optimized` boots in under 30 seconds.

### Story E12-S4: Optional `docker-compose.full.yml` for local Beta-like testing

As a developer, I want to test the full container stack locally so that I can verify a Railway-equivalent setup before pushing to `beta`.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `infra/docker-compose.full.yml` exists and references the three application images (built locally or pulled from GHCR).
- `docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up` starts the entire stack, with the application services networked to the existing Postgres, RustFS, and Keycloak.
- README documents the command and the expected health-check URLs.

Architecture notes:

- ADR-011 (Beta Deployment Target — Railway), ADR-012 (Service Topology on Railway).

Tests/evidence:

- Manual run on a developer workstation: all five application containers reach a healthy state; the web UI loads at `http://localhost:3000` and a login round-trip succeeds.

## Epic E13: Railway Beta Deployment

Requirements: REQ-088

Goal: Provision the Railway project and its five services, configure environment variables, enforce public-vs-private networking, wire health probes, and reach a successful first end-to-end deploy.

### Story E13-S1: Create Railway project and services

As the maintainer, I want a Railway project `iab-connect-beta` provisioned with five services so that GitHub-driven deploys can target it.

Requirements: REQ-088 AC-3

Acceptance criteria:

- Railway project `iab-connect-beta` exists in region Europe-West.
- Five services exist: `api`, `web`, `keycloak`, `rustfs`, plus two managed Postgres instances `postgres-app` and `postgres-kc`.
- `api`, `web`, `keycloak` are configured to pull their images from GHCR (`ghcr.io/htos/iabc-{api,web,keycloak}:beta`).
- `rustfs` runs from `rustfs/rustfs:latest` (upstream image; the project does not need to rebuild it) and mounts a Railway volume at `/data`.
- All services have GitHub auto-deploy enabled for the `beta` branch.

Architecture notes:

- ADR-011 (Beta Deployment Target — Railway), ADR-012 (Service Topology on Railway), ADR-013 (Object Storage — RustFS on Railway with Volume).

Tests/evidence:

- An empty trigger-push to `beta` redeploys all services without manual intervention.

### Story E13-S2: Configure Railway environment variables

As the deployed application, I want all configuration supplied through Railway variables so that no secrets live in the image.

Requirements: REQ-088 AC-4

Acceptance criteria:

- Each service's variables match the list documented in the Beta runbook section "Railway Variables per Service".
- Postgres connection strings reference `${{postgres-app.PGHOST}}` style placeholders to use Railway private networking.
- `Keycloak__Authority` references `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect`.
- `Frontend__BaseUrl` references `https://${{web.RAILWAY_PUBLIC_DOMAIN}}`.
- Sensitive variables are marked Sealed where Railway supports it.
- The `api` service has `RetentionEnforcement__Enabled=false` (ADR-020).
- The `web` service has `NEXT_PUBLIC_ENV_LABEL=beta` and `NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect`.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Manual deployment shows the API logs the expected Beta defaults; `/about` returns the correct `sourceUrl`; the frontend banner displays `BETA`.

### Story E13-S3: Public networking and private networking enforced

As a security operator, I want only the three application services public and the datastore services private so that the database is not internet-reachable.

Requirements: REQ-088 AC-3

Acceptance criteria:

- `web`, `api`, `keycloak`: public Railway domain enabled.
- `postgres-app`, `postgres-kc`, `rustfs`: no TCP Proxy, no Public Domain.
- Connection from outside Railway to `postgres-app.railway.internal:5432` fails (curl/psql test from a non-Railway host).

Architecture notes:

- ADR-012 (Service Topology on Railway).

Tests/evidence:

- External network reachability check from a developer workstation: `psql -h postgres-app.railway.internal` times out; `curl https://api.<beta-domain>/health/ready` returns 200.

### Story E13-S4: Health probes and first end-to-end deploy

As Railway, I want healthcheck endpoints to determine readiness so that failed deploys are auto-restarted.

Requirements: REQ-088 AC-5

Acceptance criteria:

- `api` service `healthcheckPath = /health/ready`, timeout 60s (to absorb first-startup migrations).
- `web` service `healthcheckPath = /api/health`, timeout 30s.
- `keycloak` service `healthcheckPath = /health/ready`, timeout 30s.
- After the first end-to-end deploy: a browser request to `web` shows the landing page; the login flow succeeds (Keycloak round-trip); `/health/detail` (admin-only) shows `db: Healthy` and `keycloak: Healthy`.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- Browser walkthrough of login and dashboard load on the Beta domain; manual GET of `/health/ready` returns 200 from each public service.

## Epic E14: Security and Secrets Management

Requirements: REQ-088

Goal: Audit and lock down the Beta deployment's security surface — repository secrets, security headers, dev-only tooling exposure, rate-limiting baseline, and log hygiene.

### Story E14-S1: Secrets audit and repository cleanup

As a security operator, I want the repository free of operational secrets so that the Beta deployment is the only place those secrets live.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `git log -p -S "password"` and `git log -p -S "secret"` reveal no historic real secrets. If found: rotate the affected secret (does not require history rewrite unless the secret is still operational).
- `appsettings.Development.json` contains only well-known development values (`postgres/postgres`, `rustfsadmin/rustfsadmin`) — documented as Dev-only.
- The Keycloak realm import JSON contains no committed client secrets.

Architecture notes:

- ADR-009 (License), ADR-016 (Custom Keycloak Image).

Tests/evidence:

- A scripted scan over the working tree and git history confirms no detected secret tokens or passwords beyond the documented dev defaults.

### Story E14-S2: Security headers and HTTPS enforcement review

As a security operator, I want the Beta deployment to respond with the same security headers as a Production deployment so that there is no security delta between Beta and Production.

Requirements: REQ-088 AC-4

Acceptance criteria:

- Backend pipeline confirms `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`, HSTS active in Beta.
- Frontend `next.config.ts` headers match.
- A Content-Security-Policy is defined for the frontend with `connect-src` whitelisting api and keycloak public origins.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- `curl -I https://web.<beta-domain>/` returns the expected security headers; `curl -I https://api.<beta-domain>/` likewise.

### Story E14-S3: Verify Hangfire dashboard is dev-only in Beta

As a security operator, I want the Hangfire dashboard hidden in Beta so that the job scheduler is not externally exposed.

Requirements: REQ-088 AC-4

Acceptance criteria:

- Code audit confirms Hangfire dashboard registration remains gated by `IsDevelopment()`.
- Manual GET `/hangfire` on the Beta API returns 404.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- The `/hangfire` 404 is captured in the Beta runbook security-verification section.

### Story E14-S4: Rate-limiting baseline

As a security operator, I want a conservative rate-limit baseline on the Beta API so that anonymous probing and authentication brute-force attempts are slowed.

Requirements: REQ-088 AC-4

Acceptance criteria:

- ASP.NET Core Rate-Limiting middleware is registered with conservative defaults (e.g., 100 req/min/IP anonymous, 600 req/min/IP authenticated, 10 req/min/IP on `/api/v1/auth/*`).
- Healthcheck endpoints are exempt.
- A 429 response is returned with a `Retry-After` header.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Load-test (e.g. `hey -z 30s -c 50` against a public endpoint) shows 429 responses after the threshold; healthcheck endpoint remains 200 throughout.

### Story E14-S5: Log audit

As a security operator, I want the log pipeline to never emit secrets so that Railway log retention does not become a credential exposure path.

Requirements: REQ-088 AC-4

Acceptance criteria:

- Serilog configuration destructure-blocks password and token-shaped fields.
- Request-body logging is verified off.
- JWT presence is logged as `bearer-present`/`bearer-absent`, never the token contents.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- A spot-check of a Beta request flow in Railway logs shows no Authorization header values and no password-like substrings.

## Epic E15: Database, Persistence, and Migrations

Requirements: REQ-088

Goal: Confirm the two-Postgres separation runs cleanly in Beta, add a `Database__AutoMigrate` toggle for the Production path, ship a daily encrypted PostgreSQL backup to RustFS, and document the Beta seeding strategy.

### Story E15-S1: Verify two-Postgres separation in Beta

As a security operator, I want the API and Keycloak to use distinct Postgres instances so that migration mishaps in one cannot corrupt the other.

Requirements: REQ-088 AC-3

Acceptance criteria:

- `postgres-app` and `postgres-kc` are distinct Railway services with distinct credentials.
- `api`'s connection string uses `postgres-app.railway.internal`; `keycloak`'s uses `postgres-kc.railway.internal`.

Architecture notes:

- ADR-012 (Service Topology on Railway).

Tests/evidence:

- Manual verification via Railway dashboard plus a connection-string spot-check on each service.

### Story E15-S2: Add `Database__AutoMigrate` toggle

As the maintainer, I want a toggle for the API's start-time `MigrateAsync()` call so that Production deployments can switch to a manual migration path.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `Program.cs` reads `Database:AutoMigrate` (default `true`) and skips `MigrateAsync` when `false`.
- Beta value: `true` (documented). Production-Go-Live target: `false` (Story E19-S2).

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Backend test (or manual run) with `Database__AutoMigrate=false` confirms the migrate call is skipped and the API still starts.

### Story E15-S3: Daily PostgreSQL backup to RustFS

As an operator, I want daily encrypted dumps of the application database so that a Beta data loss is recoverable.

Requirements: REQ-088 AC-6

Acceptance criteria:

- A new Hangfire recurring job `daily-pg-backup` runs at 03:00 UTC, runs `pg_dump` via Npgsql streaming or a subprocess, gzips and symmetrically encrypts with `Backup__EncryptionKey`, and uploads to `s3://rustfs/backups/yyyy/MM/dd-HHmmss.sql.gz.enc`.
- A second Hangfire job `prune-old-backups` runs daily at 04:00 UTC and removes objects older than 30 days.
- A manual restore is documented and tested once.

Architecture notes:

- ADR-019 (Backup Destination — Same RustFS).

Tests/evidence:

- Application test plus an Infrastructure integration test (Testcontainers Postgres + a mock S3 endpoint) for the encrypted-write path; the manual restore is captured in RUNBOOK-beta.md.

### Story E15-S4: Beta seeding strategy

As the maintainer, I want a documented and verified path to bootstrap the first Beta admin so that testers can be granted access without leaking secrets.

Requirements: REQ-088 AC-10

Acceptance criteria:

- The `DevelopmentDataSeeder` does not fire in Beta (it is gated on `IsDevelopment()` — verified).
- The Keycloak realm bootstrap has all seven roles created.
- The first Beta-Admin is created manually via the Keycloak admin console; the steps are documented in RUNBOOK-beta.md.

Architecture notes:

- ADR-016 (Custom Keycloak Image with SPI Baked In).

Tests/evidence:

- A Beta deployment walkthrough confirms the seeder is absent and that the documented manual admin-creation steps succeed end-to-end.

## Epic E16: Frontend ↔ Backend Integration on Railway

Requirements: REQ-088

Goal: Verify the frontend image carries the correct Beta public URLs, the OIDC round-trip succeeds against the deployed Keycloak, and the document upload/download path works against RustFS on a Railway volume.

### Story E16-S1: Verify frontend public URLs

As a frontend deployer, I want the built frontend image to point at the correct Beta `api` Railway domain so that the application is not accidentally trying to call `localhost`.

Requirements: REQ-088 AC-7

Acceptance criteria:

- The deployed `web` image's `.next/static/` chunks contain the correct Beta `api` Railway domain (no `localhost`).
- Keycloak client redirect URIs in the realm config include the `web` Railway domain.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- `grep -r "api.<beta-domain>" .next/static/` from inside the published image returns matches; a manual login round-trip on the Beta web app redirects correctly.

### Story E16-S2: End-to-end OIDC test in Beta

As a tester, I want a complete OIDC round-trip on the Beta deployment so that authentication is known to work end-to-end before tester onboarding.

Requirements: REQ-088 AC-5

Acceptance criteria:

- A test admin logs in via the Beta web app and is redirected back successfully.
- The JWT's `iss` claim matches `Keycloak__Authority`.
- The backend `/api/v1/me` endpoint returns 200 with the admin's claims.
- Logout terminates the session on both client and Keycloak side.

Architecture notes:

- ADR-012 (Service Topology on Railway), ADR-016 (Custom Keycloak Image with SPI Baked In).

Tests/evidence:

- Manual browser walkthrough plus a captured request/response trace showing the `iss` claim.

### Story E16-S3: Document upload/download against RustFS

As a tester, I want document upload and download to work against the Beta RustFS instance so that the document module can be exercised on Beta.

Requirements: REQ-088 AC-3

Acceptance criteria:

- An authenticated admin uploads a document; the file appears in the RustFS `iabconnect-documents` bucket.
- The download flow returns the same bytes.
- The Next.js `Image` component renders document thumbnails (no `next/image` host-not-allowed errors).

Architecture notes:

- ADR-013 (Object Storage — RustFS on Railway with Volume).

Tests/evidence:

- Manual upload/download cycle plus a RustFS bucket listing verifying the file is present and its content-length matches.

## Epic E17: Monitoring, Logging, and Health Checks

Requirements: REQ-088

Goal: Adapt logging for container runtimes, ensure CorrelationId enrichment is visible in Railway logs, add the frontend `/api/health` endpoint Railway needs, and wire external uptime monitoring.

### Story E17-S1: Serilog Console-only for container envs

As a container operator, I want the API to emit logs only to Console so that Railway's log aggregator captures them and no writes go to ephemeral disk.

Requirements: REQ-088 AC-5

Acceptance criteria:

- `appsettings.Beta.json` overrides `Serilog:WriteTo` to contain only the Console sink.
- File-sink configuration remains in `appsettings.Development.json` for developer ergonomics.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- Beta deployment log inspection: no file-write errors, CorrelationId visible per request.

### Story E17-S2: Structured logs with CorrelationId

As an operator, I want every Beta request log to carry a CorrelationId so that I can trace a tester report back to backend events.

Requirements: REQ-088 AC-5

Acceptance criteria:

- Sample request logs in Railway show CorrelationId enrichment.
- Log levels: Information for application code, Warning for `Microsoft.*`, Warning for `Microsoft.EntityFrameworkCore.*`.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- A spot-check of a recent Beta log entry shows the CorrelationId field populated and consistent across a single request's emitted lines.

### Story E17-S3: Frontend `/api/health` endpoint

As Railway's healthcheck, I want a lightweight endpoint on the `web` service so that I can determine readiness without bouncing through the backend.

Requirements: REQ-088 AC-5

Acceptance criteria:

- A new Next.js route handler at `frontend/src/app/api/health/route.ts` returns 200 with JSON `{status:"ok",version:<from env>}`.
- Railway's `web` service healthcheckPath uses this endpoint.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- Manual GET to `https://web.<beta-domain>/api/health` returns the expected JSON.

### Story E17-S4: External uptime monitoring

As an operator, I want a polite external monitor on `/health/ready` so that a Beta outage triggers an email alert without depending on Railway's own monitoring.

Requirements: REQ-088 AC-5

Acceptance criteria:

- An UptimeRobot (or BetterStack) monitor polls `/health/ready` every 5 minutes.
- A simulated 2-minute outage triggers an email alert.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes).

Tests/evidence:

- Once configured, a deliberate `api` service restart on Railway triggers the monitor's alert email; the alert is captured in the Beta runbook.

## Epic E18: Beta Test Preparation and Operations Documentation

Requirements: REQ-088

Goal: Author the Beta runbook and tester onboarding guide, ship the BETA banner in the UI, and provide a tester-feedback channel.

### Story E18-S1: Author RUNBOOK-beta.md

As an on-call operator, I want a complete Beta runbook so that a deploy, rollback, restore, or incident response can be executed without reading source.

Requirements: REQ-088 AC-10

Acceptance criteria:

- `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` covers: deployment, rollback (redeploy `:sha-` tag), database restore, log access, common incidents (at least 5).
- Each incident has a Symptoms / Diagnose / Fix / Verify structure.

Architecture notes:

- ADR-014 (Container Image Distribution — GHCR), ADR-019 (Backup Destination — Same RustFS).

Tests/evidence:

- A peer read-through of the runbook by someone unfamiliar with the current operational details confirms each procedure is executable as written.

### Story E18-S2: Beta tester onboarding guide

As a Beta tester, I want a short German-language guide so that I understand the scope, the Mailtrap inbox, the feedback channel, and the known limitations.

Requirements: REQ-088 AC-9

Acceptance criteria:

- `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md` (German, ≤ 2 pages) explains: signup process, scope of beta, how to access Mailtrap inbox to see mails, how to file feedback, known limitations.

Architecture notes:

- ADR-018 (Beta Mail Routing — Mailtrap Sandbox).

Tests/evidence:

- A pilot tester reads the guide and successfully completes signup plus one finance and one event task on Beta.

### Story E18-S3: Beta banner in UI

As a Beta tester, I want a persistent BETA banner so that I know which environment I am working in.

Requirements: REQ-088 AC-7

Acceptance criteria:

- `frontend/src/components/BetaBanner.tsx` exists; renders when `NEXT_PUBLIC_ENV_LABEL=beta`; orange background; text "Beta — Daten können jederzeit zurückgesetzt werden"; dismissable per session.
- Banner integrated into the root layout.

Architecture notes:

- ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- Frontend Vitest test for the banner's conditional render plus a manual visual check on the Beta deployment.

### Story E18-S4: Feedback channel

As a Beta tester, I want a clear feedback link so that I can report issues without leaving the app for long.

Requirements: REQ-088 AC-10

Acceptance criteria:

- The banner contains a clickable feedback link pointing to a GitHub issue template or a `mailto:` address.
- `.github/ISSUE_TEMPLATE/beta-feedback.md` exists (if GitHub-Issue path chosen).

Architecture notes:

- ADR-021 (Source-Disclosure Mechanism — AGPL §13) for the `/about` Source link.

Tests/evidence:

- A tester clicks the feedback link, lands on the issue template, and successfully submits a feedback issue.

## Epic E19: Production Readiness Preparation

Requirements: REQ-088

Goal: Prepare items during Beta to remove blockers from a future Production-Go-Live decision. Not on the Beta-Go-Live critical path.

### Story E19-S1: Custom-domain runbook entry

As a maintainer, I want a runbook entry describing the Railway-default-domain to custom-domain migration so that the Production switch is rehearsed in advance.

Requirements: REQ-088 AC-10

Acceptance criteria:

- RUNBOOK-beta.md gains a section "Migrating from Railway-default domain to a custom domain" covering DNS, Keycloak hostname change, redirect URI update, `Frontend__BaseUrl` update.

Architecture notes:

- ADR-012 (Service Topology on Railway), ADR-015 (Configuration and Environment Strategy).

Tests/evidence:

- A peer review of the runbook entry confirms each step is reversible and that the DNS/IDP coordination is explicit.

### Story E19-S2: Backup restore drill

As an operator, I want a real backup-restore drill rehearsed during Beta so that the Production-Go-Live decision has evidence that the backup works.

Requirements: REQ-088 AC-6

Acceptance criteria:

- A backup from the previous day is restored into a throwaway Postgres instance; the API is pointed at it; smoke tests pass.

Architecture notes:

- ADR-019 (Backup Destination — Same RustFS).

Tests/evidence:

- A captured drill log: backup file timestamp, restore duration, smoke-test outcome — added to RUNBOOK-beta.md.

### Story E19-S3: Production gate checklist

As a maintainer, I want a Production gate checklist so that a Production-Go-Live decision has a documented set of NFR thresholds to pass.

Requirements: REQ-088 AC-10

Acceptance criteria:

- A checklist of NFR thresholds (response-time targets, error-rate, backup-success-rate, uptime percentage) is authored and added to RUNBOOK-beta.md.

Architecture notes:

- ADR-017 (Logging and Health for Container Runtimes), ADR-019 (Backup Destination — Same RustFS).

Tests/evidence:

- A peer review confirms the thresholds are measurable from existing Beta telemetry.

### Story E19-S4: Self-host SMTP migration plan (Postal on Hetzner)

As a maintainer, I want a documented migration path from Mailtrap Sandbox to a self-hosted SMTP so that Production mail can be delivered without a third-party transactional provider lock-in.

Requirements: REQ-088 AC-9

Acceptance criteria:

- A document `_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md` describes the path from Mailtrap Sandbox to self-hosted Postal on a separate VPS, including IP-warmup expectations.

Architecture notes:

- ADR-018 (Beta Mail Routing — Mailtrap Sandbox).

Tests/evidence:

- A peer review confirms the migration plan's order-of-operations is realistic and that the rollback steps are explicit.

## Epic E20: Open Source Foundation

Requirements: REQ-089

Goal: Establish the Open Source surface — license, dependency notice, contributor guide with DCO enforcement, SPDX policy, backend `/about` endpoint, frontend license footer, and the GHCR image publishing pipeline.

### Story E20-S1: Add LICENSE, NOTICE, CONTRIBUTING and DCO enforcement

As a contributor, I want clear license and contribution terms so that I understand my obligations before submitting a PR.

Requirements: REQ-089 AC-1, REQ-089 AC-2, REQ-089 AC-3

Acceptance criteria:

- `LICENSE` (repo root) contains the full AGPL-3.0 text exactly as published by the FSF (`https://www.gnu.org/licenses/agpl-3.0.txt`).
- `NOTICE.md` lists the direct production dependencies of `backend/` and `frontend/` with their declared licenses (collected automatically from `dotnet list package --include-transitive` and `npm ls --omit=dev`).
- `CONTRIBUTING.md` explains the project's contribution flow and explicitly states the DCO sign-off requirement with an example `Signed-off-by:` trailer.
- `README.md` carries an AGPL-3.0-or-later badge near the top.
- `.github/workflows/dco.yml` enforces DCO sign-off on pull requests targeting `main` and `beta`.
- Branch protection on `main` and `beta` requires the DCO check to pass.

Architecture notes:

- ADR-009 (License — AGPL-3.0-or-later), ADR-010 (Contributor Identity — DCO).

Tests/evidence:

- A test PR without `Signed-off-by:` fails the DCO check; the same PR with the trailer passes; the NOTICE.md is generated from the documented commands and committed.

### Story E20-S2: Add SPDX headers to new files going forward

As a maintainer, I want SPDX identifiers on new source files so that license provenance is machine-introspectable per REUSE-Compliance minimal scope.

Requirements: REQ-089 AC-6

Acceptance criteria:

- A short policy is added to `CONTRIBUTING.md`: "New source files must begin with `// SPDX-License-Identifier: AGPL-3.0-or-later`".
- An optional linter or editor configuration is documented (out of scope to enforce automatically).

Architecture notes:

- ADR-009 (License — AGPL-3.0-or-later).

Tests/evidence:

- A peer review of the policy text confirms it is unambiguous and that the comment-style table covers C#/TypeScript/JavaScript/JSON/YAML/Dockerfile.

### Story E20-S3: Add backend `/about` endpoint

As a user of a network-deployed instance, I want to find the source code corresponding to the running version so that I can exercise AGPL §13 rights.

Requirements: REQ-089 AC-5

Acceptance criteria:

- `GET /about` returns JSON `{ name: "IAB Connect", license: "AGPL-3.0-or-later", version, commitSha, buildDate, sourceUrl }`.
- The endpoint is unauthenticated.
- `commitSha` and `buildDate` are populated from environment variables `BUILD_SHA` and `BUILD_DATE` injected by the Dockerfile build-args (Story E12-S1).
- `sourceUrl` is populated from `Branding:SourceUrl` (default `https://github.com/htos/iab-connect`).

Architecture notes:

- ADR-021 (Source-Disclosure Mechanism — AGPL §13).

Tests/evidence:

- API test asserting the endpoint shape; Infrastructure test asserting the build-arg flow from Dockerfile to runtime.

### Story E20-S4: Add frontend license footer

As a user of a deployed instance, I want a discoverable source-disclosure link so that AGPL §13 is satisfied without me knowing the architecture.

Requirements: REQ-089 AC-4

Acceptance criteria:

- A `<Footer />` component renders on every page with: project name, license (linked to `/license` static page or external AGPL text), "Source" link to `/about`.
- The component reads `NEXT_PUBLIC_SOURCE_URL` for the GitHub repo link.

Architecture notes:

- ADR-021 (Source-Disclosure Mechanism — AGPL §13).

Tests/evidence:

- Frontend Vitest test for the footer's render and link targets; manual visual check across multiple routes including the public site.

### Story E20-S5: GHCR image publishing pipeline

As a self-hoster, I want to pull pre-built application images so that I do not have to build from source.

Requirements: REQ-088 AC-1, REQ-088 AC-2, REQ-089 AC-7

Acceptance criteria:

- `.github/workflows/build-images.yml` triggers on push to `beta` and `main`.
- The workflow uses `docker/build-push-action` to build all three images (`api`, `web`, `keycloak`) and push to GHCR with tags `:beta` (or `:main`) and `:sha-${{github.sha}}`.
- OCI labels are set: `org.opencontainers.image.source=https://github.com/htos/iab-connect`, `org.opencontainers.image.licenses=AGPL-3.0-or-later`, `org.opencontainers.image.revision=${{github.sha}}`, `org.opencontainers.image.created=${{github.run_id}}` (or ISO timestamp).
- GHCR packages are public.

Architecture notes:

- ADR-014 (Container Image Distribution — GHCR).

Tests/evidence:

- A trigger-push to `beta` produces three new GHCR images with the expected tags and OCI labels; an anonymous `docker pull ghcr.io/htos/iabc-api:beta` succeeds from outside CI.

## Epic E21: Frontend Brownfield Refactoring (Feature-Slice Architecture)

Requirements: Technical initiative (no REQ) — grounded in `docs/frontend-refactoring-gate1-analysis.md` (Gate-1 as-is analysis, 2026-06-07). Source: user-authored "Frontend Brownfield Refactoring Prompt".

Goal: Incrementally restructure the frontend into a maintainable, testable, themeable feature-slice architecture (`src/features/<feature>/`) WITHOUT a big-bang rewrite. Establish a durable target-state + boundary rules, prove them on the Suppliers list page as the reference pilot, then repeat the pattern feature-by-feature with review. Preserve all existing functionality, routes, auth behaviour, API contracts, i18n keys, and tests.

Conflict priority (applies to every story): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within the story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints: no backend/route/API-contract changes; no route-group moves (recommend only); no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes; DoD uses `npm run typecheck` + `npm run lint` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide).

### Story E21-S1: Frontend target-state architecture and boundary decisions (Gate 2)

As a frontend architect, I want a durable target-state architecture with explicit boundary rules and the open decisions resolved, so that every subsequent migration follows one agreed pattern instead of improvising.

Requirements: Tech-initiative; resolves Open Questions 1-8 of `docs/frontend-refactoring-gate1-analysis.md`.

Acceptance criteria:

- `docs/architecture-frontend.md` is extended (not replaced) with a "Target-State (Feature-Slice) Architecture" section covering: the `src/features/<feature>/{api,components,hooks,schemas,types}` layout, the target import direction, and the 21 architecture rules from the source prompt adapted to verified project reality.
- A single HTTP-client contract is chosen from the three that exist today (`lib/api-client.ts` class / `useApiClient` hook in `lib/auth.ts` / `lib/services/api.ts` functions); the decision records the standard return shape, token strategy, base-URL handling, and the migration direction (with compatibility shims for the other two until empty).
- TanStack Query is confirmed as the official server-state strategy (provider already mounted in `app/providers.tsx`, zero current usages); a query-key + cache-invalidation convention is documented. Suppliers (E21-S3) is the first adopter.
- The theming decision is recorded: semantic tokens already exist (shadcn vars in `globals.css`, Tailwind v4 `@theme`); rule = adoption in feature pages, NOT a system-wide colour sweep. Status colours (Prospect/Active/Paused/Ended) map to Badge variants or tokens (decide).
- The auth model is documented: security boundary (backend 403 + `RequireModule`) vs UX guard (middleware module-gate, page/layout redirects); `useRequireAuth` is the canonical guard.
- A route-group recommendation is documented (why only `events` sits under `(dashboard)`; whether a shared protected group is warranted) — recommendation ONLY, no route moves.
- No production code behaviour changes in this story (docs/decisions + optional non-behavioural scaffolding only).

Architecture notes:

- Consumes the Gate-1 analysis; this story IS the "Gate 2 / Brownfield Zielbild" of the source prompt. Decisions feed directly into E21-S3.

Tests/evidence:

- Peer review confirms each of the 8 Open Questions has a recorded decision; `tsc`/`lint`/`test` remain green (no behavioural change).

### Story E21-S2: Suppliers list page — characterization tests (regression net)

As a developer about to refactor a page with no tests, I want a characterization test suite that pins the current observable behaviour first, so that the E21-S3 refactor is provably behaviour-preserving.

Requirements: Tech-initiative; addresses Gate-1 Critical Finding CF-5 (no Suppliers test exists).

Acceptance criteria:

- New `*.test.tsx` co-located with the suppliers list covers the current behaviour of `frontend/src/app/suppliers/page.tsx`: admin-only access (redirect for non-admin/unauthenticated), supplier load, server-side status filter, client-side search, loading/error/empty states, table render, detail/edit links, delete-dialog open, delete action, and list refresh after delete.
- Tests follow project harness conventions (`// @vitest-environment jsdom`, `afterEach(cleanup)`, stable `useTranslations` mock, mocked `useApiClient`/`useAuth`).
- Tests pass against the CURRENT (un-refactored) implementation — they are the green baseline E21-S3 must keep green.
- No production code changed in this story (test-only).

Architecture notes:

- Pure additive safety net. Blocks E21-S3. Mirrors the ATDD step recommended in the Gate-1 pilot ordering.

Tests/evidence:

- `vitest run` shows the new suppliers tests passing against `main`/`beta` HEAD before any refactor commit.

### Story E21-S3: Suppliers list page — feature-slice pilot refactor (Gate 3)

As a maintainer, I want the Suppliers list page refactored into the feature-slice pattern, so that it becomes the reference template for migrating every other feature.

Requirements: Tech-initiative; the "Pilot: Suppliers List Page" of the source prompt. Depends on E21-S1 (decisions) and E21-S2 (safety net).

Acceptance criteria (behaviour preserved — all E21-S2 tests stay green):

- Route `/suppliers`, admin/auth access, supplier load, status filter, search, loading/error/empty states, table, detail link, edit link, delete dialog, delete action, list-refresh-after-delete, and i18n texts all work exactly as before.

Acceptance criteria (improvements):

- `src/app/suppliers/page.tsx` is a thin entry (no `"use client"`) rendering a `features/suppliers` content component.
- A `features/suppliers/` slice exists: `api/` (encapsulated URLs, chosen client contract from E21-S1), `components/` (page-content, filter-bar, table, status-badge, delete-dialog composing the EXISTING `components/ui/alert-dialog.tsx`), `hooks/` (`use-suppliers` via TanStack `useQuery`, `use-delete-supplier` via `useMutation` + list invalidation), `types/` (Supplier-specific types; shared `ContractLink*` stay in `types/`).
- Delete has a pending/disabled state; the hand-rolled overlay dialog is replaced by the accessible Radix primitive.
- Status badge is extracted; no new hard-coded brand colours in feature components; `startTransition` around fetching is removed.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in `page.tsx`, no duplicate UI primitive created.

Architecture notes:

- First TanStack Query adopter and first `src/features/` slice. Type relocation must keep `ContractLink*`/Sponsor types in place to avoid a Sponsors ripple. Produces a short architecture note (what was introduced, what stays, rule for new work, next-page recipe).

Tests/evidence:

- All E21-S2 characterization tests green post-refactor; `tsc`/`lint`/`test` green; i18n parity test green (see E21-S4 for the `hi.json` baseline).

### Story E21-S4: i18n parity — add Suppliers keys to `hi.json`

As a Hindi-locale user, I want the Suppliers screens translated, so that the locale is complete and the parity test reflects reality.

Requirements: Tech-initiative; addresses Gate-1 inconsistency (suppliers.* keys present in `en.json`/`de.json`, absent in `hi.json`).

Acceptance criteria:

- The `suppliers.*` key set is added to `frontend/messages/hi.json` at full parity with `en.json`/`de.json`.
- `frontend/messages/messages.parity.test.ts` passes; the prior baseline (pass/fail) is recorded so it is clear whether this fixes a pre-existing red or fills a tolerated gap.
- No key renames/removals in any locale.

Architecture notes:

- Pre-existing debt, independent of the pilot — can run in parallel with E21-S2/S3.

Tests/evidence:

- `vitest run messages.parity.test.ts` green; before/after key counts per locale recorded.

### Story E21-S5: Architecture boundary enforcement

As a maintainer, I want the target import boundaries enforced automatically, so that the feature-slice architecture does not erode after the pilot.

Requirements: Tech-initiative; the "Architecture Enforcement" section of the source prompt.

Acceptance criteria:

- A low-false-positive enforcement is added for the import direction from E21-S1: ESLint `no-restricted-imports` (and/or a small Vitest/Node boundary test) covering at minimum: `components/ui` must not import from `features`; `lib` must not import from `app`/`features`; `features/<a>` must not deep-couple to `features/<b>`.
- The rules do NOT block the existing codebase (either currently clean or scoped to new paths); any pre-existing violation is documented, not silently failed.
- `e2e/module-enforcement.spec.ts` is left intact and is explicitly distinguished from these static import rules.

Architecture notes:

- Added AFTER the pilot proves the `features/` direction (depends on E21-S3). Keep it incremental.

Tests/evidence:

- An intentional bad import fails lint/test; the current `src/` passes; CI/lint stays green on HEAD.

### Migration Program (E22+) — the rest of `frontend/`

E21 deliberately covers ONLY the foundation, the Suppliers pilot, and boundary enforcement. The full frontend (97 `page.tsx` files across ~13 domains) is migrated by a **program of follow-on epics (E22+)** that are authored AFTER the Suppliers pilot (E21-S3) closes, so their stories inherit a proven recipe rather than provisional "follow the pilot" ACs.

The complete domain map, page counts, proposed per-domain epics, sequencing waves, and cross-cutting cleanup (component relocation, app shell, legacy HTTP-client retirement) live in:

`_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md`

When E21-S3 is done, run `bmad-create-epics-and-stories` against that roadmap to materialise E22+ with grounded ACs. (The earlier S6–S9 sponsor/member/event/finance stub stories were superseded by this roadmap and removed.)

**Materialised so far:** E22 (Sponsors) was authored 2026-06-07 from roadmap §E22 + the E21-S3 recipe (see below). The remaining program epics E23-E31 (E23 Members, E24 Events, E25 Communication, E26 Finance, E27 Admin, E28 Public, E29 Smaller, E30 Shell/Auth, E31 Legacy-client retirement) were then BULK-MATERIALISED 2026-06-07 (user directive "add all from frontend-refactoring-roadmap now") as backlog SKELETONS — epic header + story-level BDD ACs (behaviour-preserved + improvements) + Architecture notes + Tests/evidence + grounded source hints, each mirroring the E22 epic shape + the E21-S3 pilot recipe and grounded in an accurate 95-page frontend inventory (see the E23-E31 sections below). This deliberately overrode the original just-in-time, one-epic-per-boundary-review rule. The post-pilot recipe grounding now happens at `bmad-create-story` time: each story's exhaustive dev-ready context (existing-implementation spikes, DEC blocks, A56 findings) is authored per-epic, just-in-time, so it still inherits the latest twice-proven recipe even though the skeletons all exist up front.

## Epic E22: Frontend Feature-Slice Migration — Sponsors

Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E22 after the E21 Suppliers pilot closed (2026-06-07). Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)" recipe.

Goal: Migrate all four Sponsors pages (`/sponsors` list, `/sponsors/[id]` detail, `/sponsors/new`, `/sponsors/[id]/edit`) into the `src/features/sponsors/` feature-slice pattern WITHOUT behaviour change — the recipe-validation epic that proves the E21 pilot recipe generalises to (a) a second list page carrying an extra `Tier` dimension and a Vorstand-or-Admin auth rule, and (b) the first form pages (React Hook Form + Zod), establishing the form sub-recipe that E23+ inherit. Preserve all existing routes, auth behaviour, API contracts, i18n keys, and tests.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 (the slice recipe) and E21-S5 (boundary lint) — both closed. Within E22: E22-S2 (list) and E22-S3 (forms) each depend on E22-S1 (characterization tests) and must keep the S1 suite green; E22-S3 reuses the E22-S2 slice's `api`/`types`.

### Story E22-S1: Sponsors — characterization tests for all four pages (regression net)

As a developer about to refactor four un-tested Sponsors pages, I want a characterization test suite that pins their current observable behaviour first, so that the E22-S2/S3 slice extractions are provably behaviour-preserving.

Requirements: Tech-initiative; mirrors E21-S2; applies A76 (assert what a manual→TanStack/Radix refactor silently changes: destructive button variant + error/empty/loading lifecycle including failure paths).

Acceptance criteria:

- New co-located `*.test.tsx` suites pin the CURRENT behaviour of all four pages against branch HEAD (green before any refactor commit):
  - List (`app/sponsors/page.tsx`): Vorstand-OR-Admin view access (redirect `/login` if unauthenticated; redirect `/` if authenticated but not Vorstand/Admin), sponsor load, server-side `?status=` filter, client-side search (companyName/contactPerson/email), loading/error/empty states, table render, status badge AND tier badge render, detail link, edit link, delete button visible only to Admin, delete-dialog open, delete action, delete-failure path (error surfaced, list not cleared), list refresh after delete.
  - Detail (`app/sponsors/[id]/page.tsx`): auth guard, sponsor load by id, packages + contractLinks render, loading/error/not-found states.
  - New (`app/sponsors/new/page.tsx`): auth guard, form render, required-field validation, submit → create call, success redirect, submit-error surfaced.
  - Edit (`app/sponsors/[id]/edit/page.tsx`): auth guard, prefill from load, submit → update call, success redirect, submit-error surfaced.
- Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useApiClient`/`useRouter` mocks (A64/A78), `QueryClientProvider` wrapper. The suite records (A79) that a `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas, which S2/S3 must decide on explicitly.
- A76 explicit assertions: the delete button's destructive/red affordance AND the delete-failure branch (the two regressions the green E21-S2 suite missed).
- No production code changed (test-only). Suite green against HEAD.

Architecture notes:

- Pure additive safety net; blocks E22-S2 and E22-S3. The four suites are the green baseline S2/S3 must keep green. Mirrors the ATDD step from the E21 pilot ordering.

Tests/evidence:

- `vitest run` shows the new Sponsors suites passing on branch HEAD before any refactor commit; per-page assertion inventory recorded.

### Story E22-S2: Sponsors list — feature-slice extraction, Tier badge, and `hi.json` parity

As a maintainer, I want the Sponsors list page refactored into the feature-slice pattern, so that it matches the proven Suppliers slice and validates the recipe on a second list page that carries an extra Tier dimension and a Vorstand-or-Admin auth rule.

Requirements: Tech-initiative; mirrors E21-S3 for the list; roadmap §E22 ("closest mirror of Suppliers"); folds in the E21-S4-style i18n parity fix. Depends on E22-S1.

Acceptance criteria (behaviour preserved — all E22-S1 list tests stay green):

- Route `/sponsors`, Vorstand-or-Admin access, sponsor load, status filter, search, loading/error/empty states, table, status badge, tier badge, detail link, edit link, Admin-only delete, delete dialog, delete action, delete-failure handling, list-refresh-after-delete, and i18n texts all work exactly as before.

Acceptance criteria (improvements):

- `app/sponsors/page.tsx` becomes a thin entry (no `"use client"`) rendering a `features/sponsors` content component (the only `"use client"` is the composition root).
- A `features/sponsors/` slice exists mirroring `features/suppliers/`: `api/sponsors-api.ts` (encapsulated `/api/v1/sponsors` URLs + a `sponsorsKeys` query-key factory), `hooks/use-sponsors.ts` (`useQuery`) + `hooks/use-delete-sponsor.ts` (`useMutation` + list invalidation), `components/` (`sponsors-page-content`, `sponsors-filter-bar`, `sponsors-table`, `sponsor-status-badge`, `sponsor-tier-badge`, `delete-sponsor-dialog` composing the EXISTING `components/ui/alert-dialog.tsx`), `types/sponsor.types.ts`.
- Type split: Sponsor-specific types (`SponsorStatus`, `SponsorTier`, `SponsorListDto`, `SponsorDetailDto`, `PackageDto`, `Create/UpdateSponsorRequest`) move to `features/sponsors/types/sponsor.types.ts`; shared `ContractLink*` stay in `src/types/` (roadmap "keep shared ContractLink*"). A Task-0 spike confirms every current importer of `@/types/sponsors` (including any suppliers detail/new/edit pages) is repointed without behaviour change.
- Status badge AND tier badge are extracted as components; both map to Badge variants/tokens per DEC-2 — no raw `bg-blue-100`/`bg-amber-100` brand colours in feature components; the mapping is verified against the named token's canonical value, not a comment (A77). The delete button's destructive variant is tested (A76).
- `startTransition` around fetching is removed; the manual→TanStack deltas (A79) are decided explicitly: refetch-after-delete via `invalidateQueries`; mutation error surfaced (not silently sticky); chosen retry semantics documented.
- `frontend/messages/hi.json` gains the full `sponsors.*` key set at parity with `en.json`/`de.json` (53 keys; currently 0 in `hi`); `frontend/messages/messages.parity.test.ts` passes; the prior baseline is recorded; no key renames/removals in any locale.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in `page.tsx`, no duplicate UI primitive.

Architecture notes:

- Second `features/` slice and second TanStack Query adopter. The tier badge is the net-new surface vs the Suppliers pilot. Keep `ContractLink*` shared to avoid a Suppliers ripple. Update the `docs/architecture-frontend.md` recipe note if the tier-badge pattern adds anything reusable.

Tests/evidence:

- All E22-S1 list tests green post-refactor; new `sponsor-status-badge` + `sponsor-tier-badge` component tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E22-S3: Sponsors detail/new/edit — feature-slice extraction and form sub-recipe

As a maintainer, I want the Sponsors detail, new, and edit pages refactored into the feature-slice pattern, so that the first form pages establish the React Hook Form + Zod sub-recipe that every later domain epic (E23+) inherits, with behaviour preserved.

Requirements: Tech-initiative; extends the E21 recipe from list pages to form pages; roadmap §E22 (4 pages). Depends on E22-S1; builds on the E22-S2 slice (`api`/`types`).

Acceptance criteria (behaviour preserved — all E22-S1 detail/new/edit tests stay green):

- `/sponsors/[id]`, `/sponsors/new`, and `/sponsors/[id]/edit` auth guards (Vorstand-or-Admin), data load/prefill, create/update submit, validation, success redirect, and submit-error handling all work exactly as before — plus the detail page's FULL surface: status change (`PUT /status`), delete → redirect, package add/remove, contract-link add/remove, and packages + contractLinks render with their empty states. (Detail is richer than Suppliers detail — 7 endpoints + inline package/link CRUD; do not drop any of it.)

Acceptance criteria (improvements):

- Each route file (`[id]/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`) becomes a thin entry rendering a `features/sponsors/components` content component (the composition root is the only `"use client"`).
- `features/sponsors/` gains: `api/` get-by-id/create/update/delete URLs (extending S2's module — the single source of `/api/v1/sponsors` URLs), `hooks/` (`use-sponsor` get-by-id `useQuery`; `use-create-sponsor`/`use-update-sponsor` mutations invalidating `sponsorsKeys`), `schemas/sponsor.schema.ts` (a Zod schema shared by new + edit), `components/` (`sponsor-detail`, `sponsor-form` reused by new + edit, `sponsor-packages`, `sponsor-contract-links`).
- The form uses React Hook Form + Zod (project standard) behind a stable, tested contract; validation messages via next-intl (no hard-coded strings); detail uses the shared `ContractLink*` from `src/types/`.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive; CRUD round-trips (create→redirect→detail; edit→prefill→update→redirect) unchanged.
- `docs/architecture-frontend.md` gains a short "Form sub-recipe" note (RHF+Zod + a shared new/edit form component + the mutation-invalidation pattern) as the template E23+ forms follow.

Architecture notes:

- First form-page migration. Reuses the E22-S2 `api`/`types`. The `sponsor-form` shared by new + edit is the reuse anchor; the Zod schema is the single validation source. This note becomes the form half of the next-page recipe in `docs/architecture-frontend.md`.

Tests/evidence:

- All E22-S1 detail/new/edit tests green post-refactor; form-validation + create/update mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; `next build` succeeds.

## Epic E23: Frontend Feature-Slice Migration — Members
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E23 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.
Goal: Migrate the 9 Members pages into `src/features/members/` without behaviour change, applying the proven `suppliers`/`sponsors` slice shape (api + query-key factory, TanStack hooks, thin component composition roots, Zod schemas, types). Distinct here: a destructive duplicates/merge-and-dismiss UI sub-surface, a Segments CRUD sub-domain, and relocating the existing `frontend/src/components/members/*` directory into the slice.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E23: S2/S3/S4 each depend on S1 (characterization tests) staying green; S3 reuses S2's `api`/`types`.

### Story E23-S1: Members — characterization tests for all nine pages (regression net)
As a refactoring engineer I want a pinned characterization-test net over all nine Members pages so that the subsequent slice extractions (S2/S3/S4) can prove behaviour was preserved.
Requirements: Technical — regression safety net; test-only, no production code changes.
Acceptance criteria (behaviour preserved — all E23-S1 tests stay green):
- Tests cover all 9 pages: `members/page.tsx` (list), `members/[id]/page.tsx` (detail), `members/[id]/edit/page.tsx`, `members/new/page.tsx`, `members/duplicates/page.tsx`, `members/segments/page.tsx`, `members/segments/new/page.tsx`, `members/segments/[id]/page.tsx`, `members/segments/[id]/edit/page.tsx`.
- Auth guards pinned per page: unauthenticated → `router.push("/login")`; authenticated-but-not-Vorstand-and-not-Admin → `router.push("/")`; admin-only affordances (list CSV export, list delete button, duplicates Merge) asserted present for Admin and absent for non-Admin (A76 destructive-affordance gating).
- List behaviours pinned: search submit resets page to 1; status + type filter changes reset page and refetch; statistics cards render when present; pagination prev/next disabled at bounds; delete uses `confirm()` then `alert()` on failure (A76 destructive lifecycle).
- Duplicates behaviours pinned: tier filter resets page; Merge opens `MergeConfirmationModal`; Dismiss opens `DismissConfirmationModal`; successful confirm bumps refresh and refetches; cascade-dismiss issues one call per canonical pair.
- Error/empty/loading lifecycle pinned per page including failure paths (fetch rejects → error banner + retry control; empty list → empty state) per A76.
Acceptance criteria (improvements):
- Harness follows A35/A46 (jsdom + `afterEach` cleanup), A64/A78 stable mocks for `useTranslations`/`useApiClient`/`useRouter` (and `useAuth`), and wraps render in `QueryClientProvider` so S2/S3/S4 TanStack adopters need no harness rework.
- Tests assert via i18n keys/roles/`data-testid` (e.g. `duplicates-list`, `duplicates-error`), not brittle copy, to survive the refactor.
Architecture notes: Test-only; green against HEAD before any extraction. No slice created here. Establishes the regression net that gates S2/S3/S4. Reuse the suppliers/sponsors characterization-test conventions verbatim.
Tests/evidence: New characterization specs colocated per page; `npm test -- --run` green at HEAD; typecheck + scoped eslint/prettier on changed test files.

### Story E23-S2: Members core — feature-slice extraction (list/detail/new/edit)
As a refactoring engineer I want the four core Members pages extracted into `features/members/` so that the list/detail/new/edit surface follows the standard slice shape without behaviour change.
Requirements: Technical — feature-slice migration of `members/page.tsx` (list), `members/[id]/page.tsx`, `members/[id]/edit/page.tsx`, `members/new/page.tsx`.
Acceptance criteria (behaviour preserved — all E23-S1 tests stay green):
- All E23-S1 list/detail/new/edit tests stay green; routes, auth gates (login + non-Vorstand/non-Admin → "/"), API contracts, and i18n keys unchanged.
- Search/status/type filtering, statistics cards, pagination, CSV export (admin-only), and the destructive delete flow (`confirm()` → refetch → `alert()` on failure) behave identically (A76).
- New/edit forms preserve current validation and submit behaviour and the same success/redirect.
Acceptance criteria (improvements):
- Create `features/members/` slice in the proven shape: `api/members-api.ts` (encapsulated `/api/v1/members*` URLs + a `memberKeys` query-key factory), `hooks/use-*.ts` (TanStack `useQuery`/`useMutation` with list invalidation replacing the `useRef`/`refreshKey` refetch dance and the manual `confirm`/`alert` delete), `components/*.tsx` (thin page-content composition root + table/filter-bar/badges/detail/form), `schemas/members.schema.ts` (Zod, shared new+edit), `types/members.types.ts`.
- Align `frontend/src/lib/api/members.ts` to the standard slice api contract (relocate/encapsulate URL builders + DTOs into `api/members-api.ts`); keep the legacy module re-exporting until S3/S4 also migrate to avoid breaking duplicates/segments imports mid-epic.
- Move colour-in-TS helpers (`getMembershipStatusColor`/`getMembershipTypeColor`) to design tokens / Badge variants (A77 — verify the produced class against the token's canonical value, not a comment).
- Forms use the E22 RHF+Zod sub-recipe (shared new/edit form component, mutation-invalidation).
Architecture notes: First Members slice; sets `api`/`types`/`schemas` that S3 and S4 reuse. No backend/route changes; thin `app/members/*` pages become composition roots delegating to slice components. Document any residual debt where a clean token migration would risk (1)-(3).
Tests/evidence: E23-S1 suite green post-extraction; new slice unit tests for hooks/schema as needed; DoD gates (typecheck + scoped eslint/prettier + `npm test -- --run`) green; i18n parity check on touched keys.

### Story E23-S3: Members duplicates — slice extraction and `components/members` relocation
As a refactoring engineer I want the duplicates review page and its modal components moved into the Members slice so that the destructive merge/dismiss surface lives in `features/members/` without behaviour change.
Requirements: Technical — feature-slice migration of `members/duplicates/page.tsx` + relocation of `frontend/src/components/members/{DismissConfirmationModal,DuplicateGroupRow,DuplicateWarning,MergeConfirmationModal}.tsx`.
Acceptance criteria (behaviour preserved — all E23-S1 tests stay green):
- All E23-S1 duplicates tests stay green; the merge (admin-only) and dismiss (Vorstand+) confirmation flows are preserved exactly, including the destructive confirm gating and finance/Keycloak impact confirmations (A76).
- Cascade-dismiss still issues one `dismissDuplicateCandidate` call per canonical pair; successful confirm still refreshes the list; tier filter still resets page.
- Loading/error/empty lifecycle (`duplicates-loading`/`duplicates-error`/`duplicates-empty`, retry) unchanged.
Acceptance criteria (improvements):
- RELOCATE the four `components/members/*` files into `features/members/components/`; update all importers; delete the now-empty `frontend/src/components/members/` directory.
- Replace the `refreshKey`/`useCallback` fetch dance with the slice's TanStack hooks + mutation-invalidation, reusing S2's `api/members-api.ts` (`memberKeys`) and `types/members.types.ts` (add `duplicateKeys` / duplicate DTOs alongside).
- Keep destructive-action wiring explicit and well-named; no change to API endpoints or request shapes.
Architecture notes: Reuses S2's `api`/`types`; adds duplicate-group query-keys/hooks. Highest-risk story (destructive merge); favour the lower-risk incremental move and document residual debt rather than restructuring the modals. No route/API changes.
Tests/evidence: E23-S1 duplicates suite green; no remaining imports from `@/components/members/*` (grep clean); DoD gates green; i18n parity on touched keys.

### Story E23-S4: Member segments — CRUD feature-slice
As a refactoring engineer I want the four Member Segments pages extracted into the Members slice so that the segments CRUD sub-domain follows the standard slice shape without behaviour change.
Requirements: Technical — feature-slice migration of `members/segments/page.tsx`, `members/segments/new/page.tsx`, `members/segments/[id]/page.tsx`, `members/segments/[id]/edit/page.tsx`, using `frontend/src/lib/api/member-segments.ts`.
Acceptance criteria (behaviour preserved — all E23-S1 tests stay green):
- All E23-S1 segments tests stay green; routes, auth gates, API contracts, and i18n keys unchanged.
- Segments list/detail rendering, create/edit submit + success redirect, and any segment delete flow behave identically (A76 destructive lifecycle where a delete exists).
- Loading/error/empty lifecycle preserved per page including failure paths.
Acceptance criteria (improvements):
- Extract a `segments` sub-area under `features/members/` (e.g. `api/member-segments-api.ts` + `segmentKeys`, `hooks/use-segment*.ts`, `components/segment-*.tsx`, `schemas/segment.schema.ts`, segment types) aligned to the slice shape; align `frontend/src/lib/api/member-segments.ts` to the standard api contract.
- New/edit segment forms use the E22 RHF+Zod sub-recipe (shared new/edit form component, mutation-invalidation, list invalidation on success).
- Reuse S2's `members-api.ts` conventions and `types/members.types.ts` where segment shapes reference members; no duplicate UI primitives.
Architecture notes: Final E23 story; completes the Members slice. Reuses S2's api/types conventions and the E22 form sub-recipe. No backend/route changes; thin `app/members/segments/*` pages become composition roots. Document residual debt where a clean token/form migration would risk (1)-(3).
Tests/evidence: E23-S1 segments suite green post-extraction; new slice unit tests for segment hooks/schema as needed; DoD gates (typecheck + scoped eslint/prettier + `npm test -- --run`) green; i18n parity on touched keys.

## Epic E24: Frontend Feature-Slice Migration — Events
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E24 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.
Goal: Migrate the 8 Events pages (under the `(dashboard)` route group) into `src/features/events/` without behaviour change. Distinct here: the largest existing service module `frontend/src/lib/services/events.ts` (~26KB) folds into the slice, plus four event sub-pages (check-in/fees/registrations/volunteers); the `(dashboard)` route group is NOT moved (E21-S1 recommendation only).

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E24: S2/S3 depend on S1 staying green; S3 reuses S2's `api`/`types`. NOTE the `(dashboard)` route group stays in place — no route move.

### Story E24-S1: Events — characterization tests for all eight pages (regression net)
As a frontend engineer, I want a characterization-test net pinning the current behaviour of all eight Events pages so that the S2/S3 slice extractions can be proven behaviour-preserving against a green baseline.
Requirements: Test-only story; no production code changes. Green against HEAD; blocks S2/S3.
Acceptance criteria (behaviour preserved — establishes the E24 baseline):
- Characterization tests exist and pass at HEAD for all 8 pages: `frontend/src/app/(dashboard)/events/page.tsx`, `.../events/new/page.tsx`, `.../events/[id]/page.tsx`, `.../events/[id]/edit/page.tsx`, `.../events/[id]/check-in/page.tsx`, `.../events/[id]/fees/page.tsx`, `.../events/[id]/registrations/page.tsx`, `.../events/[id]/volunteers/page.tsx`.
- Auth guard pinned: unauthenticated → `router.push('/login')`; `authLoading` renders the spinner/skeleton; on check-in, the role guard (`isVorstand || isAdmin || event-manager`) renders the `forbidden` alert when denied.
- Per A76: destructive/action button variants and the full error/empty/loading lifecycle are exercised **including failure paths** — list `loadFailed` retry, statistics silent-ignore, check-in `networkError`/`invalidQr`/`scanAgain` banners, `AlreadyCheckedIn` idempotent banner, roster `loadRosterFailed`, and the manual/QR `actionInFlight` disabled states.
- Role-gated UI pinned: `canManageEvents` (create-event link, status filter, statistics cards) shown/hidden correctly.
Acceptance criteria (improvements):
- None (test-only). Tests are authored to assert observable behaviour (rendered text, fetch URLs, navigation) — not implementation detail — so they survive the S2/S3 refactor unchanged.
Architecture notes: Harness per A35/A46 (jsdom + cleanup), A64/A78 (stable mocks for `fetch`, `@/lib/auth`, `@/lib/services/events`, `next/navigation`, `next-intl`, and the dynamic `@yudiel/react-qr-scanner` import), wrapped in `QueryClientProvider`. Tests live beside pages or under the existing `frontend/src/app/(dashboard)/events/**/__tests__/` convention; no slice yet exists.
Tests/evidence: New characterization specs for all 8 pages; `npm test -- --run` green at HEAD; gates (`typecheck` + `eslint`/`prettier --check` on changed test files) green; LF endings (A73).

### Story E24-S2: Events core — feature-slice extraction (list/new/detail/edit)
As a frontend engineer, I want the four core Events pages extracted into a `src/features/events/` slice so that the events domain follows the proven suppliers/sponsors slice shape with no behaviour change.
Requirements: Migrate `frontend/src/app/(dashboard)/events/page.tsx`, `.../events/new/page.tsx`, `.../events/[id]/page.tsx`, `.../events/[id]/edit/page.tsx`. Create the slice and fold the relevant logic out of `frontend/src/lib/services/events.ts` into `api`/`hooks` without rewriting contracts.
Acceptance criteria (behaviour preserved — all E24-S1 tests stay green):
- All E24-S1 specs for the four core pages remain green unchanged (URLs, pagination `pageSize=12`, 300ms search debounce, `search`/`status`/`category` params, grid/list view toggle, statistics cards, auth redirect, `loadFailed` retry).
- Page files become thin composition roots delegating to slice components; routes, `/api/v1/events` URLs, auth guard, and i18n keys (`events.*`, `common.*`) unchanged.
- `events.ts` callers used only by the four core pages now route through the slice `api`; any logic still consumed by the S3 sub-pages remains reachable (no premature deletion).
Acceptance criteria (improvements):
- Slice created: `frontend/src/features/events/api/events-api.ts` (encapsulated `/api/v1/events` URLs + `eventsKeys` query-key factory), `hooks/use-*.ts` (TanStack Query: list/statistics/detail queries, new/edit mutations with invalidation), `components/*.tsx` (page-content root + table/grid/filter-bar/status-badge/detail/form), `schemas/event.schema.ts` (Zod, shared new+edit), `types/events.types.ts` (`EventDto`, `EventStatistics`, `PagedResponse<T>`).
- New/edit forms adopt the E22 RHF+Zod sub-recipe (shared form for new+edit, mutation-invalidation on success).
Architecture notes: Mirror suppliers/sponsors slice shape exactly. Migrate `events.ts` event CRUD/list/statistics logic into `events-api.ts`; do NOT change request/response contracts. Keep the inline `formatEventDate`/`statusColors` as slice-local helpers/components. No `(dashboard)` route-group move (E21-S1).
Tests/evidence: E24-S1 core-page specs green post-extraction; new slice-level unit tests for `events-api`/hooks as warranted; gates on changed files green; `npm test -- --run` green; i18n parity (en/de) unchanged; LF (A73).

### Story E24-S3: Event sub-pages — feature-slice extraction (check-in/fees/registrations/volunteers)
As a frontend engineer, I want the four Event sub-pages extracted into the `src/features/events/` slice, reusing S2's `api`/`types`, so that the whole events domain lives in one slice with check-in/roster/volunteer behaviours preserved exactly.
Requirements: Migrate `frontend/src/app/(dashboard)/events/[id]/check-in/page.tsx`, `.../events/[id]/fees/page.tsx`, `.../events/[id]/registrations/page.tsx`, `.../events/[id]/volunteers/page.tsx`. Reuse S2's `api`/`types`; fold the remaining `events.ts` sub-page logic into the slice.
Acceptance criteria (behaviour preserved — all E24-S1 tests stay green):
- All E24-S1 specs for the four sub-pages remain green unchanged.
- Check-in preserved exactly: scanner/manual tabs, camera probe auto-flip to manual on unavailability, 250ms manual-search debounce, client-side roster filter, QR token dedupe (`lastScannedToken`), `refreshKey`-keyed roster reload, `checkInByQrCode`/`manualCheckIn`/`getEventCheckInRoster` calls, and the `CheckedIn`/`AlreadyCheckedIn`/`Conflict`/`NotFound`/`networkError`/`invalidQr` outcome banners with `scanAgain` reset.
- Roster (registrations) and volunteer-planning behaviours preserved exactly; role guard (`isVorstand || isAdmin || event-manager`) and `/login` redirect unchanged.
Acceptance criteria (improvements):
- Sub-pages become thin composition roots over slice components (`components/check-in/*`, `components/registrations/*`, `components/fees/*`, `components/volunteers/*`); check-in/roster/fees/volunteer DTOs (`CheckInResultDto`, `EventCheckInRosterDto`, `EventCheckInRosterItemDto`, etc.) move into `types/events.types.ts`.
- Sub-page service functions migrate into `api/events-api.ts` (reusing S2's `eventsKeys`); the dynamic `@yudiel/react-qr-scanner` import stays SSR-guarded and slice-local; any now-empty `frontend/src/lib/services/events.ts` exports are removed only once no caller remains.
Architecture notes: Reuse S2's `api`/`types`/`eventsKeys`; do NOT duplicate them. Preserve the `'use client'` boundary and the camera-only dynamic import. Backend `RequireEventStaff` remains the security boundary — the slice role guard stays UX-only. No contract changes; no `(dashboard)` route-group move.
Tests/evidence: E24-S1 sub-page specs green post-extraction; slice unit tests for migrated check-in/roster/volunteer api/hooks as warranted; gates on changed files green; `npm test -- --run` green; i18n parity (en/de) unchanged; LF (A73).

## Epic E25: Frontend Feature-Slice Migration — Communication

Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E25 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.

Goal: Migrate the 12 Communication pages — three CRUD sub-modules (Automations, Email-Campaigns, Email-Templates) plus the `communication/page.tsx` index — into `src/features/communication/` (per-sub-module slices) WITHOUT behaviour change. Distinct here vs. earlier domains: three parallel CRUD surfaces sharing one route group, and relocating `frontend/src/components/email-templates/EmailTemplateForm.tsx` into its owning slice.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E25: S2/S3/S4 depend on S1 staying green; each CRUD sub-module is independent of the others so S2/S3/S4 may proceed in parallel after S1.

### Story E25-S1: Communication — characterization tests for all twelve pages (regression net)

As a developer about to refactor twelve un-tested Communication pages across three CRUD sub-modules, I want a characterization test suite that pins their current observable behaviour first, so that the E25-S2/S3/S4 slice extractions are provably behaviour-preserving.

Requirements: Tech-initiative; mirrors E22-S1; applies A76 (assert what a manual→TanStack/Radix refactor silently changes: destructive button variant + error/empty/loading lifecycle including failure paths) and the harness conventions A35/A46/A64/A78 + `QueryClientProvider`.

Acceptance criteria:

- New co-located `*.test.tsx` suites pin the CURRENT behaviour of all twelve pages against branch HEAD (green before any refactor commit):
  - Automations list (`app/communication/automations/page.tsx`): Vorstand-OR-Admin view access (redirect `/login` if unauthenticated; redirect `/` if authenticated but not Vorstand/Admin), automation load via `listAutomations`, server-side `?status=` filter, client-side search (name/templateName), loading/error/empty states, table render, status badge (`getStatusColor`) + trigger label (`getTriggerLabel`) render, detail link, `New` link, pagination.
  - Automations new/detail/edit (`automations/new`, `automations/[id]`, `automations/[id]/edit`): auth guard, form render / load-by-id / prefill, required-field validation, submit → create/update call, success redirect, submit-error surfaced.
  - Email-campaigns list + new/detail/edit (`email-campaigns/page.tsx`, `email-campaigns/new`, `email-campaigns/[id]`, `email-campaigns/[id]/edit`): auth guard, list load, filter/search, loading/error/empty states, table + status badge, detail/edit links, create/update submit, validation, success redirect, submit-error surfaced.
  - Email-templates list + new/detail (`email-templates/page.tsx`, `email-templates/new`, `email-templates/[id]`): auth guard, `emailTemplatesApi.getAllTemplates` load, client-side search (name/description), loading/error/empty states, card-grid render, category + inactive badges, edit link, delete button + `confirm` flow, delete-failure path (error surfaced, list not cleared); new/detail form render via `EmailTemplateForm`, required-field validation, submit → create/update, success redirect, submit-error surfaced.
  - Communication index (`app/communication/page.tsx`): auth guard and the navigation/links it renders to the three sub-modules.
- Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useAuth`/`useApiClient`/`useRouter` mocks (A64/A78), `QueryClientProvider` wrapper. The suite records (A79) that a `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas, which S2/S3/S4 must decide on explicitly.
- A76 explicit assertions: the email-templates delete button's destructive/red affordance AND the delete-failure branch (the two regressions the green E21-S2 suite missed).
- No production code changed (test-only). Suite green against HEAD; blocks E25-S2/S3/S4.

Architecture notes:

- Pure additive safety net; blocks all three extraction stories. The twelve suites are the green baseline S2/S3/S4 must keep green. Mirrors the ATDD step from the E21/E22 ordering. Note that the three sub-modules use different API clients (`@/lib/api/automations`, `@/lib/api/email-campaigns`, `@/lib/email-templates` + `@/types/email-templates`) — pin each against its current client.

Tests/evidence:

- `vitest run` shows the new Communication suites passing on branch HEAD before any refactor commit; per-page assertion inventory recorded.

### Story E25-S2: Automations — CRUD feature-slice extraction

As a maintainer, I want the four Automations pages refactored into the feature-slice pattern, so that they match the proven Suppliers/Sponsors slices and validate the recipe on the first of three parallel Communication CRUD surfaces.

Requirements: Tech-initiative; mirrors E22-S2 (list) + E22-S3 (form sub-recipe); roadmap §E25. Uses the existing `frontend/src/lib/api/automations.ts`. Depends on E25-S1; independent of S3/S4.

Acceptance criteria (behaviour preserved — all E25-S1 tests stay green):

- Routes `/communication/automations`, `/communication/automations/new`, `/communication/automations/[id]`, `/communication/automations/[id]/edit`; Vorstand-or-Admin access (redirect `/login` / `/`); automation load, status filter, client-side search, loading/error/empty states, table, status badge, trigger label, pagination, detail/edit/new navigation, create/update submit, validation, success redirect, and submit-error handling all work exactly as before.

Acceptance criteria (improvements):

- Each route file becomes a thin entry (no `"use client"`) rendering a `features/communication/automations` content component (the only `"use client"` is the composition root).
- A `features/communication/automations/` slice exists mirroring `features/sponsors/`: `api/automations-api.ts` (encapsulated `/api/v1` URLs wrapping the existing `frontend/src/lib/api/automations.ts` calls + an `automationsKeys` query-key factory), `hooks/use-automations.ts` (`useQuery`) + `hooks/use-automation.ts` (get-by-id) + `hooks/use-create-automation.ts`/`use-update-automation.ts` (`useMutation` + `automationsKeys` invalidation), `schemas/automation.schema.ts` (Zod shared by new + edit), `components/` (`automations-page-content`, `automations-filter-bar`, `automations-table`, `automation-status-badge`, `automation-form` reused by new + edit, `automation-detail`), `types/automation.types.ts`.
- The status badge maps to Badge variants/tokens per DEC-2 — no raw `getStatusColor` brand colour strings in feature components; the mapping is verified against the named token's canonical value, not a comment (A77). The form uses React Hook Form + Zod per the E22 form sub-recipe behind a stable, tested contract; validation messages via next-intl (no hard-coded strings).
- The manual→TanStack deltas (A79) are decided explicitly: refetch via `invalidateQueries`; mutation error surfaced (not silently sticky); chosen retry semantics documented.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive; `i18n` parity stays green (no key renames/removals in any locale).

Architecture notes:

- First Communication sub-slice; nests under `features/communication/automations/` to keep the three sub-modules cohesive yet independently migratable. Wraps the existing `lib/api/automations.ts` rather than duplicating fetch logic, so the slice is the single TanStack/query-key surface. Independent of S3/S4 — may run in parallel.

Tests/evidence:

- All E25-S1 Automations tests green post-refactor; new `automation-status-badge` + `automation-form` validation/mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E25-S3: Email campaigns — CRUD feature-slice extraction

As a maintainer, I want the four Email-campaigns pages refactored into the feature-slice pattern, so that the second parallel Communication CRUD surface matches the proven slice recipe with behaviour preserved.

Requirements: Tech-initiative; mirrors E22-S2 (list) + E22-S3 (form sub-recipe); roadmap §E25. Uses the existing `frontend/src/lib/api/email-campaigns.ts`. Depends on E25-S1; independent of S2/S4.

Acceptance criteria (behaviour preserved — all E25-S1 tests stay green):

- Routes `/communication/email-campaigns`, `/communication/email-campaigns/new`, `/communication/email-campaigns/[id]`, `/communication/email-campaigns/[id]/edit`; auth guard, campaign load, status filter, search, loading/error/empty states, table, status badge, detail/edit/new navigation, create/update submit, validation, success redirect, and submit-error handling all work exactly as before.

Acceptance criteria (improvements):

- Each route file becomes a thin entry (no `"use client"`) rendering a `features/communication/email-campaigns` content component (the only `"use client"` is the composition root).
- A `features/communication/email-campaigns/` slice exists mirroring `features/sponsors/`: `api/email-campaigns-api.ts` (encapsulated `/api/v1` URLs wrapping the existing `frontend/src/lib/api/email-campaigns.ts` calls + an `emailCampaignsKeys` query-key factory), `hooks/use-email-campaigns.ts` (`useQuery`) + `hooks/use-email-campaign.ts` (get-by-id) + `hooks/use-create-email-campaign.ts`/`use-update-email-campaign.ts` (`useMutation` + `emailCampaignsKeys` invalidation), `schemas/email-campaign.schema.ts` (Zod shared by new + edit), `components/` (`email-campaigns-page-content`, `email-campaigns-filter-bar`, `email-campaigns-table`, `email-campaign-status-badge`, `email-campaign-form` reused by new + edit, `email-campaign-detail`), `types/email-campaign.types.ts`.
- The status badge maps to Badge variants/tokens per DEC-2 — no raw brand colour strings in feature components; the mapping is verified against the named token's canonical value, not a comment (A77). The form uses React Hook Form + Zod per the E22 form sub-recipe behind a stable, tested contract; validation messages via next-intl (no hard-coded strings).
- The manual→TanStack deltas (A79) are decided explicitly: refetch via `invalidateQueries`; mutation error surfaced (not silently sticky); chosen retry semantics documented.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive; i18n parity stays green (no key renames/removals in any locale).

Architecture notes:

- Second Communication sub-slice; nests under `features/communication/email-campaigns/`. Wraps the existing `lib/api/email-campaigns.ts` rather than duplicating fetch logic. Independent of S2/S4 — may run in parallel.

Tests/evidence:

- All E25-S1 Email-campaigns tests green post-refactor; new `email-campaign-status-badge` + `email-campaign-form` validation/mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E25-S4: Email templates — CRUD feature-slice and `components/email-templates` relocation

As a maintainer, I want the Email-templates pages and the Communication index refactored into the feature-slice pattern, and the orphaned `components/email-templates/EmailTemplateForm.tsx` relocated into its owning slice, so that the third Communication CRUD surface is cohesive and free of cross-tree component imports, with behaviour preserved.

Requirements: Tech-initiative; mirrors E22-S2 (list) + E22-S3 (form sub-recipe); roadmap §E25. Uses `emailTemplatesApi` (`@/lib/email-templates`) + `@/types/email-templates`; RELOCATES `frontend/src/components/email-templates/EmailTemplateForm.tsx`. Depends on E25-S1; independent of S2/S3.

Acceptance criteria (behaviour preserved — all E25-S1 tests stay green):

- Routes `/communication/email-templates`, `/communication/email-templates/new`, `/communication/email-templates/[id]`, plus the `/communication` index; auth guard, template load via `emailTemplatesApi.getAllTemplates`, client-side search (name/description), loading/error/empty states, card-grid render, category + inactive badges, edit link, delete (`confirm` → `deleteTemplate` → list filtered), delete-failure handling, create/update submit via the relocated `EmailTemplateForm`, validation, success redirect, submit-error handling, and the index's sub-module navigation all work exactly as before.

Acceptance criteria (improvements):

- Each route file (incl. `communication/page.tsx`) becomes a thin entry (no `"use client"`) rendering a `features/communication/...` content component (the only `"use client"` is the composition root).
- A `features/communication/email-templates/` slice exists mirroring `features/sponsors/`: `api/email-templates-api.ts` (encapsulated `/api/v1` URLs wrapping the existing `emailTemplatesApi` calls + an `emailTemplatesKeys` query-key factory), `hooks/use-email-templates.ts` (`useQuery`) + `hooks/use-email-template.ts` (get-by-id) + `hooks/use-delete-email-template.ts` + `hooks/use-create-email-template.ts`/`use-update-email-template.ts` (`useMutation` + `emailTemplatesKeys` invalidation), `schemas/email-template.schema.ts` (Zod), `components/` (`email-templates-page-content`, `email-templates-search-bar`, `email-template-card`, `email-template-category-badge`, the RELOCATED `EmailTemplateForm` reused by new + detail/edit, `delete-email-template-dialog` composing the EXISTING `components/ui/alert-dialog.tsx`), `types/email-template.types.ts`.
- `frontend/src/components/email-templates/EmailTemplateForm.tsx` is MOVED into the slice `components/`; every importer is repointed (a Task-0 spike confirms all current importers of the old path and of `@/lib/email-templates`/`@/types/email-templates` are repointed without behaviour change); the now-empty `components/email-templates/` directory is removed if no other files remain.
- The category + inactive badges map to Badge variants/tokens per DEC-2 — no raw `bg-gray-100`/`bg-gray-500` brand strings in feature components; the mapping is verified against the named token's canonical value, not a comment (A77). The delete button's destructive variant is tested (A76); the native `confirm()` flow is preserved as-is (no new dialog primitive introduced unless behaviour is identical). The form uses React Hook Form + Zod per the E22 form sub-recipe; validation messages via next-intl.
- The manual→TanStack deltas (A79) are decided explicitly: refetch-after-delete via `invalidateQueries`; mutation error surfaced (not silently sticky); chosen retry semantics documented.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive; i18n parity stays green (no key renames/removals in any locale).

Architecture notes:

- Third Communication sub-slice + the only relocation in E25. Nests under `features/communication/email-templates/`. The `EmailTemplateForm` move is the net-new surface vs S2/S3 — it eliminates the cross-tree `src/components/email-templates` import and brings the form under the slice's ownership; wrap `emailTemplatesApi` rather than duplicating fetch logic. Owns `communication/page.tsx` (the lightweight index) since it is the natural composition root for the three sub-modules. Independent of S2/S3 — may run in parallel.

Tests/evidence:

- All E25-S1 Email-templates + index tests green post-refactor; new `email-template-category-badge` + relocated-`EmailTemplateForm` validation/mutation tests + delete-dialog/destructive-variant test; importer-repoint spike recorded; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

## Epic E26: Frontend Feature-Slice Migration — Finance
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E26 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.
Goal: Migrate the 26 Finance pages — the largest surface in the program (ledger/accounting, receivables/payables, budgeting/reporting, banking/data, settings) — from `frontend/src/app/finance/` into `src/features/finance/` sub-slices with no behaviour change. SENSITIVE AREA: preserve the `canReadFinance`/`canWriteFinance` permission checks exactly — route every read through the existing `useAuth()` read guard (redirect to `/` + `null` render when `!isAuthenticated || !canReadFinance`) and gate every mutation/create-action behind `canWriteFinance`, never weakening or removing either. All `/api/v1/finance/*` URLs and API contracts stay byte-identical.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E26: S2..S6 depend on S1 staying green; finance sub-slices share a `features/finance/api` foundation so later stories reuse earlier `api`/`types`. Note this epic may be split into two epics at create-story time if capacity demands (roadmap §E26).

### Story E26-S1: Finance — characterization tests for all twenty-six pages (regression net)
As a developer migrating the largest and most permission-sensitive surface in the program, I need a behaviour-pinning test net across every Finance page before any extraction, so that the `canReadFinance`/`canWriteFinance` guards and all finance flows are provably unchanged.

Requirements: Technical initiative — characterization regression net for E26-S2..S6.

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Characterization tests exist for ALL 26 Finance pages under `frontend/src/app/finance/` (see the page lists in S2..S6, plus `finance/page.tsx`). This is the heaviest characterization story in the program — pin each page even where coverage is shallow.
- For EVERY page that reads finance data, a test asserts the read guard: when `!isAuthenticated || !canReadFinance`, the page redirects to `/` (via the mocked `useRouter().push`) and renders `null` (no finance API call fires).
- For EVERY page exposing a mutation/create/action (e.g. invoices new/send/cancel, payments, receipts, budgets, settings forms), a test asserts those write affordances render only when `canWriteFinance` is true and are absent when it is false — `canReadFinance && !canWriteFinance` yields read-only render.
- Tests assert the authenticated+`canReadFinance` happy path renders the page's primary content (table/cards/form) and that the expected `/api/v1/finance/*` URLs are requested.
- Tests are green against HEAD with zero production-code changes.

Acceptance criteria (improvements):
- Apply A76 (characterization-first discipline) and the shared harness helpers A35/A46/A64/A78; wrap rendered pages in `QueryClientProvider` so S2..S6 can introduce TanStack without harness churn.
- Mock `useAuth`/`useApiClient` from `@/lib/auth` at one shared seam reused across all 26 specs.

Architecture notes: Test-only; no `src/features/` code yet. Co-locate specs beside pages or under the existing finance test folder per the suppliers/sponsors precedent. Guards live in `useAuth()` (`canReadFinance`, `canWriteFinance`) consumed in each page's `useEffect` redirect + render-guard + conditional action rendering — pin exactly those seams.

Tests/evidence: New characterization specs for all 26 pages; `npm test -- --run` green; DoD gates on changed files. Blocks S2..S6.

### Story E26-S2: Finance core ledger/accounting — feature-slice extraction
As a developer, I want the core ledger/accounting pages extracted into `src/features/finance/` establishing the shared finance `api`/`types` foundation, so that later sub-slices reuse it without duplication.

Requirements: Technical initiative — feature-slice extraction (ledger/accounting group).

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Pages migrated: `finance/page.tsx` (dashboard), `finance/accounts/page.tsx`, `finance/ledger-accounts/page.tsx`, `finance/journal-entries/page.tsx`, `finance/accounting-reports/page.tsx`, `finance/fiscal-periods/page.tsx`, `finance/posting-mappings/page.tsx`.
- `canReadFinance` still gates read access on every page (redirect to `/` + `null` render when `!isAuthenticated || !canReadFinance`); `canWriteFinance` still gates every mutation/create-action (e.g. journal-entry posting, fiscal-period close, posting-mapping edits). Guards routed through the existing `useAuth()` seam, never weakened.
- All `/api/v1/finance/*` URLs (dashboard, `/transactions/summary`, `/dashboard`, `/invoices/open`, `/transactions`, ledger/journal/fiscal/mapping endpoints) unchanged; routes and i18n keys (`finance.*`) unchanged.

Acceptance criteria (improvements):
- Establish `src/features/finance/api/finance-api.ts` (encapsulated `/api/v1/finance` URLs + `financeKeys` query-key factory) and `src/features/finance/types/finance.types.ts` as the shared foundation reused by S3..S6.
- Add `hooks/use-*.ts` (TanStack Query) per page-resource; thin `components/*.tsx` page-content composition roots (table/filter-bar/badges/detail). App-router `page.tsx` files become thin shells importing the slice.

Architecture notes: First E26 slice — own the `api`/`types` foundation here. Follow the suppliers/sponsors slice shape and the E21-S3 Pilot Result Note. Reuse existing fetch behaviour (`useApiClient`) inside hooks; no API-contract change. Keep `formatCHF`/date helpers shared, not duplicated.

Tests/evidence: E26-S1 net green unchanged; DoD gates (typecheck/eslint/prettier/test) on changed files; i18n parity green.

### Story E26-S3: Finance receivables/payables — feature-slice extraction
As a developer, I want the receivables/payables pages extracted into `src/features/finance/`, reusing the S2 `api`/`types` foundation, so that invoice/payment flows and forms move without behaviour change.

Requirements: Technical initiative — feature-slice extraction (receivables/payables group).

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Pages migrated: `finance/invoices/page.tsx`, `finance/invoices/new/page.tsx`, `finance/invoices/[id]/page.tsx`, `finance/receipts/page.tsx`, `finance/payments/page.tsx`, `finance/dunning/page.tsx`, `finance/expense-claims/page.tsx`.
- `canReadFinance` still gates read access on every page (redirect to `/` + `null` render); `canWriteFinance` still gates every mutation — preserve the invoices-list affordances exactly: "New invoice" link, per-row Send (Draft only) and Cancel (not Cancelled/Paid) actions and their confirmation modals render only when `canWriteFinance`. Send POSTs `/api/v1/finance/invoices/{id}/send`; Cancel DELETEs `/api/v1/finance/invoices/{id}`.
- Client-side search/status/date filters and status badge styling on the invoices list preserved; all `/api/v1/finance/invoices|receipts|payments|dunning|expense-claims` URLs unchanged.

Acceptance criteria (improvements):
- Invoice new/edit forms use the E22 form sub-recipe: RHF + Zod via `schemas/invoice.schema.ts` (shared new+edit), with mutation-invalidation of the relevant `financeKeys` on success.
- Extract `components/*` (invoice table/filter-bar/status-badge/detail/form, confirmation dialogs) and `hooks/use-*.ts` (TanStack) reusing S2's `finance-api.ts`/`finance.types.ts`; add receivables types/keys to the shared foundation rather than a parallel one.

Architecture notes: Depends on S2 foundation. Confirmation modals (Send/Cancel) and `actionLoading` state move into slice components without changing the optimistic local-status update behaviour. Keep `recipientType`/`status` unions in shared types.

Tests/evidence: E26-S1 net green unchanged; DoD gates on changed files; i18n parity green; form validation behaviour pinned.

### Story E26-S4: Finance budgeting/reporting — feature-slice extraction
As a developer, I want the budgeting/reporting pages extracted into `src/features/finance/`, reusing the shared foundation and the existing budgets lib, so that budget views migrate without behaviour change.

Requirements: Technical initiative — feature-slice extraction (budgeting/reporting group).

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Pages migrated: `finance/budgets/page.tsx`, `finance/budget-vs-actual/page.tsx`, `finance/activity-areas/page.tsx`, `finance/categories/page.tsx`.
- `canReadFinance` still gates read access on every page (redirect to `/` + `null` render); `canWriteFinance` still gates every mutation (budget create/edit, activity-area and category create/edit/delete). Guards routed through the existing `useAuth()` seam, never weakened.
- `frontend/src/lib/api/budgets.ts` continues to back the budget data flows; budget-vs-actual computations and all `/api/v1/finance/budgets|categories|activity-areas` URLs unchanged.

Acceptance criteria (improvements):
- Wrap `frontend/src/lib/api/budgets.ts` calls in `hooks/use-*.ts` (TanStack) and reuse the shared `finance-api.ts`/`financeKeys` + `finance.types.ts` from S2; do not duplicate the budgets lib.
- Extract `components/*` (budget table/filter-bar/budget-vs-actual view/category + activity-area lists) as thin composition roots; any create/edit forms follow the E22 RHF+Zod sub-recipe with mutation-invalidation.

Architecture notes: Depends on S2 foundation. `budgets.ts` stays the transport; hooks adapt it to TanStack without altering request shapes. Share category/activity-area types with S6 settings where they overlap (single source in `finance.types.ts`).

Tests/evidence: E26-S1 net green unchanged; DoD gates on changed files; i18n parity green.

### Story E26-S5: Finance banking/data — feature-slice extraction
As a developer, I want the banking/data pages extracted into `src/features/finance/`, so that bank-import, transactions and exports migrate while preserving their upload/download flows exactly.

Requirements: Technical initiative — feature-slice extraction (banking/data group).

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Pages migrated: `finance/bank-import/page.tsx`, `finance/transactions/page.tsx`, `finance/exports/page.tsx`.
- `canReadFinance` still gates read access on every page (redirect to `/` + `null` render); `canWriteFinance` still gates every mutation (bank-import upload/commit, transaction edits, export generation). Guards routed through the existing `useAuth()` seam, never weakened.
- Import/upload flow (file select → upload → preview/commit) and export-download flow (request → file download/blob handling) preserved byte-for-byte; all `/api/v1/finance/bank-import|transactions|exports` URLs unchanged.

Acceptance criteria (improvements):
- Extract `hooks/use-*.ts` (TanStack) and `components/*` (bank-import wizard/dropzone, transactions table/filter-bar, exports panel) reusing S2's shared `finance-api.ts`/`finance.types.ts`.
- Keep file-upload (multipart) and download (blob) handling in dedicated api/hook functions; do not convert these to plain JSON query/mutation patterns where they currently stream files.

Architecture notes: Depends on S2 foundation. Upload/download are the highest-risk behaviours in E26 — pin them in S1 and keep the exact `FormData`/blob handling. No change to `Content-Type` or response handling.

Tests/evidence: E26-S1 net green unchanged; DoD gates on changed files; i18n parity green; upload/download paths exercised.

### Story E26-S6: Finance settings — feature-slice extraction
As a developer, I want the Finance settings pages extracted into `src/features/finance/`, so that settings forms migrate to the shared form sub-recipe without behaviour change.

Requirements: Technical initiative — feature-slice extraction (settings group).

Acceptance criteria (behaviour preserved — all E26-S1 tests stay green):
- Pages migrated: `finance/settings/page.tsx`, `finance/settings/profile/page.tsx`, `finance/settings/invoice-templates/page.tsx`, `finance/settings/activity-areas/page.tsx`, `finance/settings/tax-codes/page.tsx`.
- `canReadFinance` still gates read access on every page (redirect to `/` + `null` render); `canWriteFinance` still gates every settings mutation (profile save, invoice-template create/edit, activity-area and tax-code create/edit/delete) — read-only render when `canReadFinance && !canWriteFinance`. Guards routed through the existing `useAuth()` seam, never weakened.
- All `/api/v1/finance/settings|tax-codes|invoice-templates|activity-areas` URLs, routes and `finance.*` i18n keys unchanged.

Acceptance criteria (improvements):
- Settings forms use the E22 form sub-recipe: RHF + Zod via `schemas/*.schema.ts` (shared new+edit per resource), with mutation-invalidation of the relevant `financeKeys` on save.
- Extract `components/*` (settings nav/sections, profile form, invoice-template form, activity-area + tax-code lists/forms) and `hooks/use-*.ts` (TanStack) reusing S2's shared `finance-api.ts`/`finance.types.ts`; reuse the activity-area type/keys shared with S4 rather than re-declaring.

Architecture notes: Depends on S2 foundation; final E26 slice. Close out the shared `finance.types.ts`/`financeKeys` foundation so the whole Finance domain lives under `src/features/finance/` with thin app-router shells. Note the `settings/activity-areas` overlap with S4's `finance/activity-areas` — keep one shared type, distinct routes/components per the no-route-move constraint.

Tests/evidence: E26-S1 net green unchanged; DoD gates on changed files; i18n parity green; settings-form validation pinned.

## Epic E27: Frontend Feature-Slice Migration — Admin

Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E27 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.

Goal: Migrate the 15 admin pages (users + new/[id]/[id]/sessions, settings + admin dashboard, system: audit/backups/health/retention, integrations: api-clients/webhooks/webhooks-deliveries, documents/register) from `frontend/src/app/admin/` into `src/features/<admin-area>/` slices WITHOUT behaviour change. Every admin page is admin-gated; the admin auth guard (redirect non-admins) is preserved verbatim in each story.

Open decision (resolve at create-story time — E21-S1 carry-over): is `admin` ONE feature or an AREA of sub-features? RECOMMENDED: treat admin as an area split into sub-slices (`features/admin-users`, `features/admin-settings`, `features/admin-system`, `features/admin-integrations`, `features/admin-documents`) rather than one monolith slice — confirm during E27-S2.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E27: S2..S6 depend on S1 staying green; the sub-features are mutually independent so S2..S6 may proceed in parallel after S1.

### Story E27-S1: Admin — characterization tests for all fifteen pages (regression net)

As a developer about to refactor fifteen admin pages across five sub-areas, I want a characterization test suite that pins each page's current observable behaviour — including its admin auth guard — first, so that the E27-S2..S6 slice extractions are provably behaviour-preserving.

Requirements: Tech-initiative; mirrors E21-S2 / E22-S1; applies A76 (assert what a manual→TanStack/Radix refactor silently changes: destructive button variant + error/empty/loading lifecycle including failure paths) plus the harness conventions A35/A46/A64/A78 and a `QueryClientProvider` wrapper.

Acceptance criteria (test-only; green against branch HEAD before any refactor commit):

- New co-located `*.test.tsx` suites pin the CURRENT behaviour of all fifteen admin pages. EVERY suite asserts the admin auth guard explicitly: redirect away (`router.push("/")`) when authenticated-but-not-admin and the unauthenticated path, and that protected content/data fetch is gated on `isAuthenticated && isAdmin && accessToken`.
  - Users area (`admin/users/page.tsx`, `admin/users/new/page.tsx`, `admin/users/[id]/page.tsx`, `admin/users/[id]/sessions/page.tsx`): list load + search + pagination; per-row actions (enable/disable toggle, password-reset `confirm`+`alert`, MFA-reset `confirm`+`alert`, delete `confirm`); role + status badges; new/edit form render + required-field validation + submit→create/update + success redirect + submit-error surfaced; sessions list load + revoke; loading/error/empty states and failure paths (e.g. delete-failure: error surfaced, list not cleared).
  - Settings area (`admin/settings/page.tsx`, `admin/page.tsx`): admin-dashboard tiles/links render; settings load, edit, save→submit, success + save-error states.
  - System area (`admin/audit/page.tsx`, `admin/backups/page.tsx`, `admin/health/page.tsx`, `admin/retention/page.tsx`): audit log load + filters + pagination; backups list + create/trigger + restore/download actions; health status render; retention policy load + edit + save; loading/error/empty per page.
  - Integrations area (`admin/api-clients/page.tsx`, `admin/webhooks/page.tsx`, `admin/webhooks/deliveries/page.tsx`): api-clients list + create (show-once secret panel) + delete; webhooks list + create/edit shared dialog + enable/disable toggle + delete `confirm` + the show-once signing-secret panel (copy/dismiss); deliveries list + filters; loading/error/empty per page.
  - Documents area (`admin/documents/page.tsx`, `admin/register/page.tsx`): documents list + upload/delete; registration register load + filters + per-row approve/reject actions; loading/error/empty per page.
- Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useApiClient`/`useAuth`/`useRouter` mocks (A64/A78), `QueryClientProvider` wrapper. Each suite records (A79) the manual→TanStack deltas a `retry:false` harness masks (provider `retry:1`, sticky-mutation-error, no-spinner-on-refetch) so S2..S6 decide them explicitly.
- A76 explicit assertions per page that has them: the destructive/red affordance of every delete/revoke button AND each delete/revoke-failure branch.
- No production code changed (test-only). Suite green against HEAD; blocks E27-S2..S6.

Architecture notes:

- Pure additive safety net; blocks all five extraction stories. Because admin is an AREA, organise the suites by sub-area so each S2..S6 story owns a clear green baseline. Mirrors the ATDD step from the E21/E22 ordering. Note the show-once secret panels (api-clients, webhooks) and the `confirm`/`alert` browser-dialog patterns as the highest-risk behaviours to pin.

Tests/evidence:

- `vitest run` shows the new admin suites passing on branch HEAD before any refactor commit; per-page assertion inventory recorded, with the admin-guard assertion present in every page's suite.

### Story E27-S2: Admin users — feature-slice extraction

As a maintainer, I want the admin users pages refactored into a feature slice, so that user management matches the proven Suppliers/Sponsors slices while the area-vs-feature decision for admin is confirmed.

Requirements: Tech-initiative; mirrors E21-S3 (list) + E22-S3 (forms); pages `admin/users/page.tsx`, `admin/users/new/page.tsx`, `admin/users/[id]/page.tsx`, `admin/users/[id]/sessions/page.tsx`; uses `frontend/src/lib/api/users.ts`. Depends on E27-S1. CONFIRM the area-vs-feature decision here (recommended: `features/admin-users` sub-slice).

Acceptance criteria (behaviour preserved — all E27-S1 tests stay green):

- The admin auth guard is preserved: non-admins are redirected (`router.push("/")`), data fetch stays gated on `isAuthenticated && isAdmin && accessToken`.
- Route paths, list load + search + pagination, per-row actions (enable/disable, password-reset `confirm`+`alert`, MFA-reset `confirm`+`alert`, delete `confirm` + list refresh), role/status badges, new/edit create+update + redirect, sessions list + revoke, and all i18n texts work exactly as before.

Acceptance criteria (improvements):

- DECISION CONFIRMED: admin is an area; this slice is `features/admin-users/` (composition root is the only `"use client"`; each route file becomes a thin entry).
- Slice shape mirrors the template: `api/admin-users-api.ts` (encapsulated `/api/v1` user URLs wrapping/replacing the direct calls in `frontend/src/lib/api/users.ts` + an `adminUsersKeys` query-key factory), `hooks/` (`use-users` list `useQuery`; `use-user` get-by-id; mutations `use-set-user-enabled`/`use-reset-password`/`use-reset-mfa`/`use-delete-user`/`use-create-user`/`use-update-user`/`use-revoke-session`, each invalidating `adminUsersKeys`), `schemas/admin-user.schema.ts` (Zod shared by new + edit, per the E22 form sub-recipe), `components/` (`admin-users-page-content`, `admin-users-table`, `admin-users-filter-bar`, `user-role-badge`, `user-status-badge`, `delete-user-dialog`, `admin-user-form` shared new+edit, `user-sessions`), `types/admin-user.types.ts`.
- The new/edit form uses RHF+Zod (E22 sub-recipe); validation/messages via next-intl. Role/status badges map to Badge variants/tokens per DEC-2 — no raw brand colours in feature components, mapping verified against the token's canonical value (A77). Delete button destructive variant tested (A76).
- The manual→TanStack deltas (A79) are decided explicitly: refetch-after-mutation via `invalidateQueries`; mutation error surfaced (not silently sticky); retry semantics documented. Browser `confirm`/`alert` flows are preserved as-is (not converted to Radix) to keep S1 green — any dialog upgrade is out of scope and noted as residual debt.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- First `features/admin-*` sub-slice; sets the naming + boundary precedent (and ESLint import-boundary entry per E21-S5) that S3..S6 follow. Largest admin slice (4 pages, 8+ mutations). Keep the `confirm`/`alert` semantics to avoid behaviour drift. Update the `docs/architecture-frontend.md` recipe note with the admin-area sub-slice convention.

Tests/evidence:

- All E27-S1 users-area tests green post-refactor; new badge + form-validation + mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E27-S3: Admin settings — feature-slice extraction

As a maintainer, I want the admin settings page and the admin dashboard refactored into a feature slice, so that they match the proven slice pattern with behaviour preserved.

Requirements: Tech-initiative; mirrors E21-S3; pages `admin/settings/page.tsx` and `admin/page.tsx` (admin dashboard). Depends on E27-S1.

Acceptance criteria (behaviour preserved — all E27-S1 tests stay green):

- The admin auth guard is preserved: non-admins redirected (`router.push("/")`), content/data gated on `isAuthenticated && isAdmin && accessToken`.
- The admin dashboard's tiles/navigation links and the settings load → edit → save (success + save-error) flow, plus all i18n texts, work exactly as before.

Acceptance criteria (improvements):

- `features/admin-settings/` slice exists mirroring the template: `api/admin-settings-api.ts` (encapsulated `/api/v1` settings URLs + `adminSettingsKeys`), `hooks/` (`use-settings` `useQuery` + `use-update-settings` `useMutation` with invalidation), `schemas/admin-settings.schema.ts` (Zod, if settings is a form — RHF+Zod per the E22 sub-recipe), `components/` (`admin-settings-page-content`, `admin-dashboard` for the `admin/page.tsx` tile grid, `admin-settings-form`), `types/admin-settings.types.ts`.
- `admin/page.tsx` and `admin/settings/page.tsx` become thin entries rendering the slice content components (composition root is the only `"use client"`).
- Manual→TanStack deltas (A79) decided explicitly (invalidate-on-save, mutation error surfaced, retry semantics documented). Badges/tokens per DEC-2; A77 token verification where applicable.
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- Smallest area (2 pages); the admin dashboard is mostly static navigation, so the slice may be hooks-light. Follows the `features/admin-*` convention set in E27-S2.

Tests/evidence:

- All E27-S1 settings-area tests green post-refactor; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E27-S4: Admin system — feature-slice extraction (audit/backups/health/retention)

As a maintainer, I want the admin system pages (audit, backups, health, retention) refactored into a feature slice, so that operational admin tooling matches the proven slice pattern with behaviour preserved.

Requirements: Tech-initiative; mirrors E21-S3; pages `admin/audit/page.tsx`, `admin/backups/page.tsx`, `admin/health/page.tsx`, `admin/retention/page.tsx`; uses `frontend/src/lib/api/audit.ts`, `frontend/src/lib/api/backup.ts`, `frontend/src/lib/api/retention.ts`. Depends on E27-S1.

Acceptance criteria (behaviour preserved — all E27-S1 tests stay green):

- The admin auth guard is preserved on all four pages: non-admins redirected (`router.push("/")`), data fetch gated on `isAuthenticated && isAdmin && accessToken`.
- Audit log load + filters + pagination; backups list + create/trigger + restore/download; health status render; retention policy load + edit + save; and all i18n texts work exactly as before.

Acceptance criteria (improvements):

- `features/admin-system/` slice exists mirroring the template: `api/` modules (`audit-api.ts`, `backups-api.ts`, `health-api.ts`, `retention-api.ts` — each encapsulating the `/api/v1` URLs currently in `frontend/src/lib/api/audit.ts`/`backup.ts`/`retention.ts` + per-resource query-key factories), `hooks/` (`use-audit-log`, `use-backups` + `use-create-backup`/`use-restore-backup` mutations, `use-health`, `use-retention` + `use-update-retention` mutation, each invalidating its keys), `schemas/retention.schema.ts` (Zod for the retention form, RHF+Zod per the E22 sub-recipe), `components/` (one page-content + table/filter/status component set per resource: `audit-page-content`/`audit-table`/`audit-filter-bar`, `backups-page-content`/`backups-table`, `health-page-content`/`health-status`, `retention-page-content`/`retention-form`), `types/` per resource.
- Each route file becomes a thin entry rendering its slice content component (composition root is the only `"use client"`).
- Manual→TanStack deltas (A79) decided explicitly (invalidate-on-mutation, mutation error surfaced, retry semantics documented). Status/severity indicators map to Badge variants/tokens per DEC-2 (A77); destructive actions (restore) tested for destructive affordance (A76).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- Four loosely-related operational pages sharing the `admin-system` area; keep them as sibling component sets inside one slice rather than four slices, to match the recommended area split. Backups restore is the highest-risk destructive action — preserve its confirmation/affordance exactly.

Tests/evidence:

- All E27-S1 system-area tests green post-refactor; new status-badge + mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E27-S5: Admin integrations — feature-slice extraction (api-clients/webhooks)

As a maintainer, I want the admin integrations pages (api-clients, webhooks, webhook deliveries) refactored into a feature slice, so that integration management matches the proven slice pattern with behaviour preserved — including the show-once secret panels.

Requirements: Tech-initiative; mirrors E21-S3; pages `admin/api-clients/page.tsx`, `admin/webhooks/page.tsx`, `admin/webhooks/deliveries/page.tsx`; uses `frontend/src/lib/api/apiClients.ts`, `frontend/src/lib/api/webhooks.ts`. Depends on E27-S1.

Acceptance criteria (behaviour preserved — all E27-S1 tests stay green):

- The admin auth guard is preserved on all three pages: non-admins redirected (`router.push("/")`), data fetch gated on `isAuthenticated && isAdmin && accessToken`.
- API clients: list + create (the show-once secret panel — secret shown exactly once, copy/dismiss) + delete. Webhooks: list + create/edit via the SHARED dialog (name/targetUrl/eventTypes checkboxes, save disabled until valid) + enable/disable toggle + delete `confirm` + the show-once signing-secret panel (`secretOnceWarning`, copy → `copied`, dismiss). Deliveries: list + filters. All i18n texts work exactly as before.

Acceptance criteria (improvements):

- `features/admin-integrations/` slice exists mirroring the template: `api/` modules (`api-clients-api.ts`, `webhooks-api.ts` — encapsulating the `/api/v1` URLs and the existing `WEBHOOKS_BASE` from `frontend/src/lib/api/webhooks.ts` + per-resource query-key factories), `hooks/` (`use-api-clients` + `use-create-api-client`/`use-delete-api-client`; `use-webhooks` + `use-create-webhook`/`use-update-webhook`/`use-toggle-webhook`/`use-delete-webhook`; `use-webhook-deliveries`; mutations invalidate their keys), `schemas/webhook.schema.ts` (Zod for the shared create/edit dialog, RHF+Zod per the E22 sub-recipe), `components/` (`api-clients-page-content`/`api-clients-table`/`api-client-secret-panel`; `webhooks-page-content`/`webhooks-table`/`webhook-dialog` shared create+edit/`webhook-secret-panel`/`delete-webhook-dialog`; `webhook-deliveries-page-content`/`deliveries-table`/`deliveries-filter-bar`), `types/` per resource.
- The show-once secret panels are extracted as components but keep IDENTICAL behaviour (secret rendered once, `navigator.clipboard.writeText`, copied/dismiss state) — a tested invariant, since losing the secret is a hard data-loss path. Each route file becomes a thin entry (composition root is the only `"use client"`).
- The webhook create/edit dialog migrates to RHF+Zod behind a stable tested contract (validation parity: save disabled unless name + targetUrl + ≥1 eventType). The `confirm`-based webhook delete is preserved as-is to keep S1 green (Radix upgrade out of scope, noted as residual debt). Manual→TanStack deltas (A79) decided explicitly. DEC-2 badges/tokens (A77); delete destructive variant (A76).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- Highest data-loss risk in the epic: the two show-once secret panels. Treat their extraction as behaviour-locked (test the once-only render + copy + dismiss). The webhook dialog is the form anchor (shared create+edit per the E22 sub-recipe). Keep `WEBHOOKS_BASE`'s URL ownership inside the slice `api/` module.

Tests/evidence:

- All E27-S1 integrations-area tests green post-refactor; secret-panel once-only + copy/dismiss tests; webhook-dialog validation + mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E27-S6: Admin documents and register — feature-slice extraction

As a maintainer, I want the admin documents and registration register pages refactored into a feature slice, so that they match the proven slice pattern with behaviour preserved.

Requirements: Tech-initiative; mirrors E21-S3; pages `admin/documents/page.tsx`, `admin/register/page.tsx`; uses `frontend/src/lib/api/registration.ts`. Depends on E27-S1.

Acceptance criteria (behaviour preserved — all E27-S1 tests stay green):

- The admin auth guard is preserved on both pages: non-admins redirected (`router.push("/")`), data fetch gated on `isAuthenticated && isAdmin && accessToken`.
- Documents: list + upload + delete. Register: registration entries load + filters + per-row approve/reject actions + list refresh. All loading/error/empty states and i18n texts work exactly as before.

Acceptance criteria (improvements):

- `features/admin-documents/` slice exists mirroring the template: `api/` (`documents-api.ts`, `registration-api.ts` — encapsulating the `/api/v1` URLs in `frontend/src/lib/api/registration.ts` + per-resource query-key factories), `hooks/` (`use-documents` + `use-upload-document`/`use-delete-document`; `use-registrations` + `use-approve-registration`/`use-reject-registration`; mutations invalidate their keys), `components/` (`documents-page-content`/`documents-table`/`delete-document-dialog`; `register-page-content`/`register-table`/`register-filter-bar`/registration status badge), `types/` per resource.
- Each route file becomes a thin entry rendering its slice content component (composition root is the only `"use client"`).
- Manual→TanStack deltas (A79) decided explicitly (invalidate-on-mutation, mutation error surfaced, retry semantics documented). Registration status maps to Badge variants/tokens per DEC-2 (A77); delete/reject destructive affordance tested (A76).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- Final admin sub-slice; closes the area. File-upload (documents) is the net-new surface vs prior admin slices — preserve the upload control's behaviour and error path exactly. With S2..S6 merged the whole `admin/` route tree is feature-sliced, enabling the E27 boundary review.

Tests/evidence:

- All E27-S1 documents-area tests green post-refactor; upload + approve/reject mutation tests; registration status-badge test; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

## Epic E28: Frontend Feature-Slice Migration — Public Site
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E28 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.
Goal: Migrate the 9 unauthenticated Public pages (served under the separate `public/layout.tsx` shell) into `src/features/public/` slices without behaviour change. DISTINCT here: these pages are UNAUTHENTICATED (no auth guard) and SEO/SSR-sensitive — the strongest candidates in the whole program for genuine React Server Components (E21-S1 prompt rule 14). Where a page is currently `"use client"` only to fetch read-only data (e.g. `public/blog/page.tsx`), the improvement is to render it as a Server Component fetching at request time; where client interactivity is genuinely required (the contact/newsletter forms, the blog search box), keep a minimal client island.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E28: S2/S3/S4 depend on S1 staying green; independent of each other.

### Story E28-S1: Public site — characterization tests for all nine pages (regression net)
As a frontend engineer, I want a behaviour-pinning characterization suite over all nine Public pages plus the `public/layout.tsx` shell, so that the S2/S3/S4 extractions are provably behaviour-preserving.
Requirements: Technical initiative — regression net; test-only; blocks E28-S2/S3/S4.
Acceptance criteria (behaviour preserved — all E28-S1 tests stay green):
- Characterization tests pin all nine pages against HEAD render output: `public/blog/page.tsx`, `public/blog/[id]/page.tsx`, `public/events/page.tsx`, `public/events/[id]/page.tsx`, `public/contact/page.tsx`, `public/newsletter/page.tsx`, `public/license/page.tsx`, `public/sponsors/page.tsx`, `public/unsubscribe/[token]/page.tsx`, plus the `public/layout.tsx` shell (header/footer/`children` slot).
- Per A76, each data-driven page pins error / empty / loading paths; each form page (`contact`, `newsletter`, `unsubscribe/[token]`) additionally pins the submit-success and submit-failure paths (e.g. contact: honeypot-success short-circuit, `loading→success` swap to the "send another" panel, `error` banner + retry-label swap; blog: search-filter narrowing + `noResults` vs `empty` distinction).
- Detail pages (`blog/[id]`, `events/[id]`) pin the param-driven fetch and the not-found / not-published path.
- `public/sponsors/page.tsx` is pinned independently of the authenticated `src/features/sponsors/` slice (no shared characterization state).
- No auth-redirect assertions: these pages have no auth guard — tests assert render/data/SEO/form behaviour only.
- Suite green against HEAD before any extraction lands.
Acceptance criteria (improvements):
- Tests assert observable behaviour (rendered text, i18n keys resolved, fetch URL + payload, status transitions), not implementation detail, so they survive the Server-Component / client-island reshaping in S2-S4.
- Snapshot SEO-relevant output where present (page `<h1>`/title text, blog/event metadata) to protect the SSR/SEO improvements in S2.
Architecture notes:
- Harness per A35/A46/A64/A78 + wrap in `QueryClientProvider`; mock `fetch` / the `/api/v1/...` endpoints (`/api/v1/blog/public`, the public events/sponsors endpoints, `/api/v1/public/contact`, newsletter + unsubscribe endpoints) and `next-intl` `useTranslations`.
- Tests live under the existing frontend test layout mirroring `frontend/src/app/public/**`; this story adds no `src/features/public/` code — pure regression net.
- Treat `useAppSettings` (contact sidebar) and `next/image` (`unoptimized`) as harness-provided so the net does not couple to provider internals.
Tests/evidence: New characterization specs for all nine pages + the layout shell; `npm test -- --run` green at HEAD; typecheck + `eslint`/`prettier --check` on the new test files; evidence = green run logged in the story file. No source changes.

### Story E28-S2: Public content — Server-Component feature-slice extraction
As a frontend engineer, I want the five read-only Public content pages extracted into a `src/features/public/` slice and rendered as Server Components where behaviour allows, so that SEO/SSR improves while behaviour is preserved.
Requirements: Technical initiative — Server-Components candidate story (E21-S1 prompt rule 14).
Acceptance criteria (behaviour preserved — all E28-S1 tests stay green):
- Pages migrated: `public/blog/page.tsx`, `public/blog/[id]/page.tsx`, `public/events/page.tsx`, `public/events/[id]/page.tsx`, `public/sponsors/page.tsx`.
- Rendered output, i18n keys, fetch URLs/payloads, formatting (e.g. blog `de-CH` date, 200-char excerpt truncation), category/content-language badges, and the not-found/not-published detail paths are unchanged.
- The blog list search-box behaviour (client-side filter, `noResults` vs `empty`) is preserved — extracted as a small client island layered over server-rendered content where the page converts to a Server Component.
- Routes, links (`/public/blog/${id}`, event detail links), and `next/image` `unoptimized` behaviour unchanged.
Acceptance criteria (improvements):
- Where a page is `"use client"` only to fetch read-only data (confirmed for `public/blog/page.tsx`), convert it to a Server Component that fetches at request time; keep the search box as the only client island. Apply the same Server-Component conversion to `events`, `sponsors`, and the two detail pages where no client interactivity is required.
- Slice shape per pilot: `api/public-content-api.ts` (encapsulated `/api/v1/...` public URLs + `publicContentKeys` query-key factory, used by any retained client island); `types/public.types.ts` (DTOs: blog post, event, sponsor — relocated from inline page interfaces); thin `components/*.tsx` composition roots + presentational list/card/detail components shared by list+detail.
- Replace ad-hoc `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'` base-URL duplication with the slice `api/` module.
Architecture notes:
- Server Components must not import client-only hooks; isolate `useState`/`useTranslations`-driven interactivity (search box) behind a `"use client"` island under `components/`. Server-rendered text may use the server `next-intl` API to keep i18n parity.
- No new query-key namespace collisions with `suppliersKeys`/`sponsorsKeys`; `publicContentKeys` is public-site-scoped and distinct from the authenticated `src/features/sponsors/` slice.
- No backend/route/API-contract change; same endpoints, same DTOs.
Tests/evidence: All E28-S1 content-page tests green unchanged; new slice unit tests for `public-content-api` URL/key factory; DoD gates (`typecheck` + `eslint`/`prettier --check` on changed files + `npm test -- --run`); i18n parity green; evidence logged in story file.

### Story E28-S3: Public forms — feature-slice extraction
As a frontend engineer, I want the three Public form/flow pages extracted into the `src/features/public/` slice with RHF+Zod client islands, so that form handling is consistent with the E22 form sub-recipe while behaviour is preserved exactly.
Requirements: Technical initiative — applies the E22 form sub-recipe (RHF+Zod, shared form, mutation-invalidation) to public forms.
Acceptance criteria (behaviour preserved — all E28-S1 tests stay green):
- Pages migrated: `public/contact/page.tsx`, `public/newsletter/page.tsx`, `public/unsubscribe/[token]/page.tsx`.
- Contact: honeypot (`website`) silent-success short-circuit, `idle→loading→success` swap to the "send another" panel, `error` banner + `retry`-label swap, the `subject` select option set, and the `POST /api/v1/public/contact` payload `{ name, email, subject, message, website }` are all unchanged; the contact sidebar (`useAppSettings` application name, email/phone/address, opening hours) is preserved.
- Newsletter: subscribe submit + success/error states unchanged; same endpoint and payload.
- Unsubscribe: the `[token]` param-driven flow (token-confirm request, success/already-unsubscribed/invalid-token states) is preserved exactly — no change to the token handling or endpoint.
Acceptance criteria (improvements):
- Contact + newsletter forms reshaped to RHF + Zod per the E22 sub-recipe: `schemas/public-contact.schema.ts` + `schemas/public-newsletter.schema.ts` (Zod), one shared form component per form under `components/`, mutation via the slice `api/` module with the existing endpoints.
- Forms remain `"use client"` islands (genuine interactivity); the surrounding hero/sidebar may be server-rendered where it does not break the E28-S1 pins.
- Slice `api/public-forms-api.ts` encapsulates the contact/newsletter/unsubscribe `/api/v1/...` URLs; honeypot remains client-side and is not sent through validation in a way that alters the silent-success behaviour.
Architecture notes:
- Preserve the unsubscribe-token flow verbatim — token is a route param, the success panel and invalid-token branch must match HEAD; do not introduce a redirect or auth check.
- Zod schemas validate the same fields the backend already expects; no new required fields, no contract change. RHF default values match current controlled-input initial state (empty strings).
- Keep edited files LF (A73); no `npm run format`.
Tests/evidence: All E28-S1 form-page tests green unchanged (honeypot, status transitions, payload shape, token flow); new schema + form-island unit tests; DoD gates on changed files; i18n parity green; evidence logged in story file.

### Story E28-S4: Public static and layout — feature-slice extraction
As a frontend engineer, I want the static License page and the Public layout shell consolidated into the `src/features/public/` slice, so that the public navigation chrome is defined once and the slice is complete.
Requirements: Technical initiative — static page + shared layout/navigation consolidation.
Acceptance criteria (behaviour preserved — all E28-S1 tests stay green):
- `public/license/page.tsx` renders identical static content (text, i18n keys, headings) after migration into the slice.
- `public/layout.tsx` continues to render the public header, footer, and `children` slot in the same structure for all nine pages; no route-group move, no change to which pages receive the shell.
- `frontend/src/components/navigation/PublicHeader.tsx` and `PublicFooter.tsx` continue to render the same nav links/branding; their usage is referenced (not duplicated) by the consolidated layout.
Acceptance criteria (improvements):
- `public/license/page.tsx` extracted as a Server-Component static page under the slice (`components/`), with no client hooks (static content needs none).
- `public/layout.tsx` consolidated to reference the public navigation primitives once via the slice; `PublicHeader`/`PublicFooter` are reused from `frontend/src/components/navigation/` (no duplicate primitives, per hard constraints) — defer extracting them into the slice until E30 `PageShell` exists, and reference E30 `PageShell` once available rather than introducing a competing shell now.
- Residual debt (deferred `PageShell` adoption) documented in the story file so E30 can pick it up.
Architecture notes:
- No new external UI library, no duplicate header/footer primitives; layout consolidation is reference-only.
- License page is the simplest Server-Component conversion in the slice — use it to confirm the static-page recipe; no `api/` or `schemas/` additions needed for this page.
- Do not pre-empt E30 PageShell: leave a clearly-marked TODO/reference rather than building a parallel shell abstraction.
Tests/evidence: E28-S1 license + layout-shell tests green unchanged; DoD gates on changed files (`typecheck` + `eslint`/`prettier --check` + `npm test -- --run`); i18n parity green; residual `PageShell`-deferral note recorded; evidence logged in story file.

## Epic E29: Frontend Feature-Slice Migration — Smaller Features

Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E29 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.

Goal: Migrate the remaining small authenticated surfaces — Documents (1 page: `/documents`), Board Documents (2 pages: `/board/documents`, `/board/documents/[id]`), and Profile (2 pages: `/profile`, `/profile/security`) — into `src/features/` slices WITHOUT behaviour change. One slice per small feature (`features/documents/`, `features/board-documents/`, `features/profile/`), each following the proven Suppliers/Sponsors shape so the remaining low-volume pages reach parity with the rest of the program.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed) and the E22 form sub-recipe (closed). Within E29: S2/S3/S4 depend on S1 staying green; independent of each other.

### Story E29-S1: Smaller features — characterization tests for documents, board, and profile (regression net)

As a developer about to refactor five un-tested small-feature pages, I want a characterization test suite that pins their current observable behaviour first, so that the E29-S2/S3/S4 slice extractions are provably behaviour-preserving.

Requirements: Tech-initiative; mirrors E22-S1; applies A76 (assert what a manual→TanStack/Radix refactor silently changes: error/empty/loading lifecycle including failure paths, and the consent/security side-effect branches).

Acceptance criteria:

- New co-located `*.test.tsx` suites pin the CURRENT behaviour of all five pages against branch HEAD (green before any refactor commit):
  - Documents (`app/documents/page.tsx`): auth guard (redirect `/login` if unauthenticated), documents + folders + tags load via `lib/services/documents`, server-side search/folder/tag filters, folder navigation (into/up/root/breadcrumb), pagination, loading/error/empty states, table render, authenticated blob download path and download-error surfaced.
  - Board Documents list (`app/board/documents/page.tsx`): auth guard, list load, filter/search/pagination as present, loading/error/empty states, row → detail link.
  - Board Documents detail (`app/board/documents/[id]/page.tsx`): auth guard, load-by-id, content render, loading/error/not-found states, download/action affordances as present.
  - Profile (`app/profile/page.tsx`): auth guard (redirect `/login` if unauthenticated; redirect `/` if authenticated but not member), `GET /members/me` load, 404 → no-member-record branch, view→edit toggle, profile `PUT` submit + submit-error surfaced, consent load + grant/revoke toggle (success + non-critical-failure branches), channel-preferences card render, loading/error states.
  - Profile Security (`app/profile/security/page.tsx`): auth guard, session/device list load, security actions (revoke/change as present), loading/error/empty states, action-error surfaced.
- Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useApiClient`/`useRouter`/`useAuth` mocks (A64/A78), `QueryClientProvider` wrapper. The suite records (A79) that a `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas, which S2/S3/S4 must decide on explicitly.
- A76 explicit assertions: the consent grant/revoke success-vs-failure branches and the documents download-error branch (the silent-side-effect paths a manual→TanStack refactor most easily drops).
- No production code changed (test-only). Suite green against HEAD; blocks E29-S2/S3/S4.

Architecture notes:

- Pure additive safety net; blocks E29-S2/S3/S4. The five suites are the green baseline the extractions must keep green. Mirrors the ATDD step from the E21/E22 ordering. Profile carries the most stateful surface (consent + edit form + channel prefs), so its inventory is the densest.

Tests/evidence:

- `vitest run` shows the new documents/board-documents/profile suites passing on branch HEAD before any refactor commit; per-page assertion inventory recorded.

### Story E29-S2: Documents — feature-slice extraction

As a maintainer, I want the Documents page refactored into the feature-slice pattern, so that the member document-browser matches the proven Suppliers/Sponsors slice with behaviour preserved.

Requirements: Tech-initiative; mirrors E22-S2 for a list-style page; roadmap §E29. Depends on E29-S1; uses `frontend/src/lib/services/documents.ts`.

Acceptance criteria (behaviour preserved — all E29-S1 documents tests stay green):

- Route `/documents`, auth guard, documents + folders + tags load, server-side search/folder/tag filters, folder navigation (into/up/root/breadcrumb), pagination, loading/error/empty states, table render, authenticated blob download, download-error handling, and i18n texts all work exactly as before.

Acceptance criteria (improvements):

- `app/documents/page.tsx` becomes a thin entry (no `"use client"`) rendering a `features/documents` content component (the only `"use client"` is the composition root).
- A `features/documents/` slice exists mirroring `features/sponsors/`: `api/documents-api.ts` (encapsulating the `/api/v1` document URLs, wrapping the EXISTING `lib/services/documents.ts` calls without changing their contract, + a `documentsKeys` query-key factory), `hooks/use-documents.ts` + `hooks/use-document-folders.ts` + `hooks/use-document-tags.ts` (`useQuery`), `components/` (`documents-page-content`, `documents-filter-bar`, `documents-breadcrumb`, `documents-folder-grid`, `documents-table`, `document-download-button`), `types/document.types.ts` (re-exporting/owning `DocumentDto`/`DocumentFolderDto` shapes; `lib/services/documents.ts` stays the transport seam — do not duplicate it).
- The authenticated download (dynamic `next-auth/react` `getSession` → fetch blob → object-URL anchor) is preserved behind `document-download-button`; download-error surfaced (A76).
- `startTransition`/manual `setLoading` plumbing is replaced by TanStack; the manual→TanStack deltas (A79) are decided explicitly: refetch-on-filter via query keys; chosen retry/refetch-spinner semantics documented.
- i18n parity: any new user-facing strings reuse existing `documents.*` keys; if `frontend/messages/hi.json` lacks `documents.*` parity with `en.json`/`de.json`, bring it to parity and keep `frontend/messages/messages.parity.test.ts` green (record the prior baseline; no key renames/removals in any locale).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in `page.tsx`, no duplicate UI primitive.

Architecture notes:

- A list-style slice over an existing service module (`lib/services/documents.ts`) rather than a raw fetch — the new wrinkle vs Sponsors is wrapping a pre-existing transport seam in the `api/` layer without re-implementing it. The folder-navigation + breadcrumb state is the net-new surface; keep it local to `documents-page-content`. Update the `docs/architecture-frontend.md` recipe note if the service-wrapping pattern adds anything reusable.

Tests/evidence:

- All E29-S1 documents tests green post-refactor; new `document-download-button` + filter/breadcrumb component tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E29-S3: Board documents — feature-slice extraction

As a maintainer, I want the Board Documents list and detail pages refactored into the feature-slice pattern, so that the board-only document surface matches the proven slice with behaviour preserved.

Requirements: Tech-initiative; mirrors E22-S2 (list) + the E22-S3 detail half; roadmap §E29 (2 pages). Depends on E29-S1.

Acceptance criteria (behaviour preserved — all E29-S1 board-documents tests stay green):

- `/board/documents` (auth guard, list load, filter/search/pagination as present, loading/error/empty states, row → detail link) and `/board/documents/[id]` (auth guard, load-by-id, content render, loading/error/not-found states, download/action affordances) all work exactly as before — including the board-only access rule and any download path, unchanged.

Acceptance criteria (improvements):

- Each route file (`board/documents/page.tsx`, `board/documents/[id]/page.tsx`) becomes a thin entry rendering a `features/board-documents/components` content component (the composition root is the only `"use client"`).
- A `features/board-documents/` slice exists mirroring `features/sponsors/`: `api/board-documents-api.ts` (encapsulated `/api/v1` board-document URLs + a `boardDocumentsKeys` query-key factory), `hooks/` (`use-board-documents` list `useQuery`; `use-board-document` get-by-id `useQuery`), `components/` (`board-documents-page-content`, `board-documents-table`/filter bar as the list surface needs, `board-document-detail`), `types/board-document.types.ts`.
- The board-only auth guard is preserved exactly (no widening/narrowing of who can view); any document-download affordance is preserved behind a component, with its error path surfaced (A76).
- The manual→TanStack deltas (A79) are decided explicitly: list/detail query keys; chosen retry/refetch-spinner semantics documented.
- i18n parity: reuse existing board-document keys; if `frontend/messages/hi.json` lacks parity with `en.json`/`de.json` for the touched key set, bring it to parity and keep `messages.parity.test.ts` green (record the baseline; no key renames/removals).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- A two-page list+detail slice — the smallest full E22-shaped slice in the program. Keep the board-only access rule as the single behavioural invariant. No forms here, so no RHF/Zod is introduced. Independent of S2/S4 once S1 is green.

Tests/evidence:

- All E29-S1 board-documents tests green post-refactor; new list + detail component tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

### Story E29-S4: Profile — feature-slice extraction

As a maintainer, I want the Profile and Profile Security pages refactored into the feature-slice pattern, so that the member self-service surface matches the proven slice with the consent, channel-preference, and security behaviours preserved exactly.

Requirements: Tech-initiative; mirrors E22-S3 (form half) for the profile edit form; roadmap §E29 (2 pages). Depends on E29-S1; reuses the E22 form sub-recipe (RHF+Zod, shared form, mutation-invalidation).

Acceptance criteria (behaviour preserved — all E29-S1 profile tests stay green):

- `/profile` auth guard (redirect `/login` if unauthenticated; redirect `/` if authenticated but not member), `GET /members/me` load, 404 → no-member-record branch (with the Admin/Vorstand vs member message + security/admin links), view→edit toggle, profile `PUT` submit + submit-error surfaced, consent load + grant/revoke toggle (success message + auto-dismiss + non-critical-failure branch), and the channel-preferences card all work exactly as before.
- `/profile/security` auth guard, session/device list load, security actions (session/device revoke/change as present), loading/error/empty states, and action-error handling all work exactly as before. The consent/channel-preference + security (session/device) behaviours are preserved verbatim — no widening of what is revealed or revocable.

Acceptance criteria (improvements):

- `app/profile/page.tsx` and `app/profile/security/page.tsx` become thin entries (no `"use client"`) each rendering a `features/profile/components` content component (the only `"use client"` is the composition root).
- A `features/profile/` slice exists mirroring `features/sponsors/`: `api/profile-api.ts` (encapsulated `/api/v1/members/me`, consent (`lib/api/privacy`), channel-preference, and security/session URLs + a `profileKeys` query-key factory), `hooks/` (`use-profile` get + `use-update-profile` mutation invalidating `profileKeys`; `use-consents` + `use-toggle-consent` mutation; `use-sessions`/`use-security` query + revoke mutation), `schemas/profile.schema.ts` (Zod for the profile edit form), `components/` (`profile-page-content`, `profile-detail`, `profile-form`, `consent-preferences`, `channel-preferences-card` (relocating the existing `ChannelPreferencesCard`), `profile-security-content`, `session-list`), `types/profile.types.ts`.
- The profile edit form uses React Hook Form + Zod (E22 form sub-recipe) behind a stable, tested contract; validation messages via next-intl (no hard-coded strings); the `PUT /members/me` round-trip (edit→prefill→update→exit-edit) is unchanged.
- Consent toggle and security/session actions become mutations that invalidate their respective queries; the consent non-critical-failure (silent) and explicit-error branches are preserved exactly (A76); the manual→TanStack deltas (A79) decided explicitly (retry/refetch-spinner/sticky-error semantics documented).
- i18n parity: reuse existing `profile.*`/`form.*`/`status.*` keys; if `frontend/messages/hi.json` lacks parity with `en.json`/`de.json` for the touched key set, bring it to parity and keep `messages.parity.test.ts` green (record the baseline; no key renames/removals).
- No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive.

Architecture notes:

- The most stateful E29 slice: a profile edit form (RHF+Zod, reusing the E22 form sub-recipe) plus three side-effecting concerns (consent, channel preferences, session/security). The consent silent-vs-explicit failure branches and the security action set are the behavioural invariants — preserve verbatim. `ChannelPreferencesCard` relocates into the slice without behaviour change. Closes the program's small-surface backlog.

Tests/evidence:

- All E29-S1 profile + security tests green post-refactor; form-validation + update/consent/session mutation tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds.

## Epic E30: Frontend Feature-Slice Migration — Auth and App Shell
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E30 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 boundary decisions and the `docs/architecture-frontend.md` Pilot Result Note.
Goal: Consolidate the app shell, auth, and system pages without behaviour change: introduce the missing shared `components/layout` primitives (PageShell, PageHeader) by composing — not duplicating — the existing `components/navigation/{MainLayout,Header,Sidebar}.tsx`, then thread them through the auth/login, system, and root-shell surface. This is largely infrastructure; preserve the NextAuth session flow, the root `layout.tsx`/`providers.tsx` wiring (TanStack QueryClient + next-intl + NextAuth session + Sidebar/AppSettings providers), and the `api/auth/[...nextauth]` and `api/health` route handlers exactly.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: Blocked by E21-S3 + E21-S5 (closed). Within E30: S1 (layout primitives) lands first so S2/S3 can adopt them; if a minimal PageShell was already introduced during an earlier migration epic, S1 consolidates it. Earlier domain epics (E22-E29) may already reference PageShell — S1 reconciles those usages.

### Story E30-S1: Introduce and consolidate `components/layout` primitives (PageShell, PageHeader)
As a frontend engineer, I want shared `PageShell` and `PageHeader` layout primitives that compose the existing navigation chrome, so every migrated page has one consistent, tested wrapper instead of ad-hoc per-page layout markup.
Requirements: Technical initiative (no REQ). Implements roadmap §E30 "introduce a minimal PageShell EARLY, consolidate here" and the E21-S3 pilot recipe (`docs/architecture-frontend.md` Pilot Result Note).
Acceptance criteria (behaviour preserved):
- `PageShell` and `PageHeader` are pure presentational wrappers; they compose `@/components/navigation/{MainLayout,Header,Sidebar}` (importing the existing primitives) and do NOT duplicate or re-implement their markup, sidebar context wiring, or responsive behaviour.
- The root `layout.tsx` `MainLayout` mount, `BetaBanner`, and `LicenseFooter` ordering are untouched; `PageShell` sits inside the page content area, not in the root layout, so chrome rendering is unchanged.
- Any provisional `PageShell` usages introduced earlier in E22-E29 are reconciled to the consolidated component with identical rendered output (same DOM structure, classes, and slots); no consuming page changes visible behaviour.
- `npm run typecheck` + `npm test -- --run` stay green; no existing test is modified to pass.
Acceptance criteria (improvements):
- New primitives live at `frontend/src/components/layout/PageShell.tsx` and `frontend/src/components/layout/PageHeader.tsx`, with a barrel `frontend/src/components/layout/index.ts` mirroring the navigation barrel convention.
- `PageHeader` exposes title/description/actions slots; `PageShell` exposes a content container + optional header slot — typed props, no `any`.
- Tailwind classes follow the existing token layer (E21 globals.css tokens); no inline hex, no global token sweep.
Architecture notes: Wrapper-extraction only — lift the repeated page-frame markup already present across migrated pages into `PageShell`/`PageHeader`; compose over `components/navigation`. Keep the component boundary identical to the `features/suppliers` + `features/sponsors` template (presentational, prop-driven). No sidebar/header logic moves out of `components/navigation`. ESLint import-boundary rules (E21-S5) apply: `components/layout` is shared, importable by features.
Tests/evidence: Add `frontend/src/components/layout/PageShell.test.tsx` and `PageHeader.test.tsx` (render slots, default + with-header, actions present/absent). Evidence: `npm run typecheck`; `npx eslint frontend/src/components/layout/**`; `npx prettier --check frontend/src/components/layout/**`; `npm test -- --run` (new tests green, suite unchanged otherwise).

### Story E30-S2: Auth, login, and system pages — slice/shell extraction
As a frontend engineer, I want the auth, login, and system/error pages refactored onto the shared layout primitives without changing their behaviour, so the system-page surface matches the feature-slice template while NextAuth redirects and error rendering stay identical.
Requirements: Technical initiative (no REQ). Implements roadmap §E30; consumes E30-S1 primitives.
Acceptance criteria (behaviour preserved):
- `frontend/src/app/login/page.tsx` preserves the NextAuth sign-in flow exactly: same `signIn`/callback wiring, same success/failure redirect targets, same `callbackUrl`/`error` query handling, same i18n keys.
- `frontend/src/app/auth/error/page.tsx` renders the same error states/messages for the same error codes; no copy or routing change.
- `frontend/src/app/module-unavailable/page.tsx` and `frontend/src/app/site-unavailable/page.tsx` render identical content and any existing redirect/guard behaviour.
- Route-level `frontend/src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`, and `loading.tsx` keep their exact Next.js semantics (error boundary reset, 404 rendering, suspense fallback) and rendered output.
- No route, route-group, or API-contract change; `npm run typecheck` + `npm test -- --run` green.
Acceptance criteria (improvements):
- Page chrome adopts `PageShell`/`PageHeader` (E30-S1) where applicable; page-local presentational pieces and any data/schema helpers follow the `features/<domain>` slice shape (`components/`, and `schemas`/`types` only if such logic already exists in-page).
- Duplicated auth/system markup is collapsed into the shared primitives — no new duplicate UI primitive introduced.
- i18n keys unchanged and resolvable in both `en.json` and `hi.json` (i18n parity per E21-S4).
Architecture notes: Behaviour-preserving extraction only. `global-error.tsx` must remain a self-contained root boundary (it renders its own `<html>/<body>` and cannot depend on providers/`PageShell`) — leave it minimal; do not force it onto layout primitives. Login stays a client component with its existing `signIn` import. Keep NextAuth callback/redirect logic byte-for-byte where feasible; if extraction touches it, document residual debt rather than altering flow.
Tests/evidence: Add characterization tests as a regression net for the login flow (renders form, invokes `signIn` with expected args, honours `callbackUrl`/`error` params) and for `auth/error` error-code mapping; smoke-render `module-unavailable`, `site-unavailable`, `not-found`, and `error.tsx` (boundary resets). Evidence: `npm run typecheck`; `npx eslint <changed>`; `npx prettier --check <changed>`; `npm test -- --run`.

### Story E30-S3: App shell — layout, providers, root page, and API routes
As a frontend engineer, I want the root shell files normalized onto the consolidated structure without altering the providers tree, root behaviour, or route handlers, so the app shell is consistent with the feature-slice template while NextAuth, TanStack, next-intl, and the health/auth endpoints behave exactly as before.
Requirements: Technical initiative (no REQ). Implements roadmap §E30; consumes E30-S1 primitives.
Acceptance criteria (behaviour preserved):
- `frontend/src/app/providers.tsx` keeps the exact provider nesting and config: `SessionProvider` → `QueryClientProvider` (QueryClient with `staleTime: 60_000`, `retry: 1`, created via `useState`) → `SidebarProvider` → `AppSettingsProvider`. No provider added, removed, reordered, or reconfigured.
- `frontend/src/app/layout.tsx` preserves `generateMetadata` (de-branded REQ-086 fetch with 3s `AbortSignal.timeout` + 300s revalidate + neutral fallback), the Inter font wiring, `getLocale`/`getMessages`, and the `Providers` → `NextIntlClientProvider` → `BetaBanner`/`MainLayout`/`LicenseFooter` tree exactly.
- `frontend/src/app/page.tsx` (root home) preserves its current redirect/home rendering behaviour exactly.
- `frontend/src/app/api/auth/[...nextauth]/route.ts` and `frontend/src/app/api/health/route.ts` are unchanged in contract: same handlers, exports, status codes, and payloads; `frontend/src/app/api/health/route.test.ts` stays green and is not modified.
- `npm run typecheck` + `npm test -- --run` green; every page still renders.
Acceptance criteria (improvements):
- Only non-behavioural normalization is allowed: import ordering/barrels, comments, and adopting shared types — no logic change to providers, metadata, route handlers, or root page.
- Any root-page chrome that can adopt `PageShell`/`PageHeader` (E30-S1) does so without changing rendered output or redirect behaviour.
- ESLint import-boundary rules (E21-S5) satisfied for any touched shell imports.
Architecture notes: This is the highest-risk infra story — treat `providers.tsx`, `layout.tsx`, and both route handlers as behaviour-frozen; prefer the lower-risk incremental option (Conflict priority 1-3) and document residual debt over any refactor that touches the auth/session/query wiring. The existing `api/health/route.test.ts` is the regression anchor for the health endpoint. Do not move route groups or relocate `api/`.
Tests/evidence: Keep `frontend/src/app/api/health/route.test.ts` green (regression anchor). Add a providers regression test asserting the provider tree mounts (QueryClient available, SessionProvider/Sidebar/AppSettings present) and a root-`page.tsx` characterization test for its redirect/home behaviour; smoke-test `api/auth/[...nextauth]/route.ts` handler exports resolve. Evidence: `npm run typecheck`; `npx eslint <changed>`; `npx prettier --check <changed>`; `npm test -- --run`.

## Epic E31: Frontend Feature-Slice Migration — Legacy HTTP-Client Retirement
Requirements: Technical initiative (no REQ) — Frontend Refactoring Program, materialised from `_bmad-output/planning-artifacts/frontend-refactoring-roadmap.md` §E31 + the E21-S3 pilot recipe and the E22 epic shape. Inherits the E21-S1 standard HTTP contract and the E21-S5 import-boundary lint.
Goal: Retire the legacy HTTP clients now that every domain feature uses the E21-S1 standard `useApiClient`-based contract. Migrate any residual consumers off the class-based `frontend/src/lib/api-client.ts` and the `lib/api/*` + `lib/services/*` modules into the owning feature slice's `api` module, then DELETE the now-unused legacy client(s) and compatibility shims. This is the final consolidation of the program — one HTTP contract, zero legacy paths.

Conflict priority (applies to every story, per E21): (1) preserve existing functionality; (2) never overwrite foreign uncommitted changes; (3) do not break routes, API contracts, auth, i18n, or existing tests; (4) stay within story scope; (5) improve architecture; (6) improve styling/theming. When a clean solution raises risk to (1)-(3), choose the lower-risk incremental option and document the residual debt.

Epic-wide hard constraints (inherited from E21): no backend/route/API-contract changes; no route-group moves; no global token sweep; no new external UI library; no duplicate UI primitives; no test removal; no cosmetic mass changes. DoD = `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only — never `npm run format` (the prettier-tailwind plugin re-sorts classes repo-wide) and never repo-wide lint/format as a per-story gate (A58/A72); keep edited files LF (A73).

Dependencies: BLOCKED BY ALL migration epics E22-E30 — no feature may still import a legacy client before E31-S2 deletes it. Within E31: S2 (deletion) depends on S1 (residual migration) leaving zero legacy importers.

### Story E31-S1: Migrate residual consumers to the standard HTTP contract
As a frontend engineer, I want every remaining importer of the legacy HTTP clients migrated onto the E21-S1 standard contract, so that no production code path depends on `frontend/src/lib/api-client.ts`, `frontend/src/lib/api/*`, or `frontend/src/lib/services/*` and the legacy client becomes safe to delete in E31-S2.
Requirements: Technical initiative — closes the long tail left by E22-E30. Inherits the E21-S1 standard HTTP contract (`useApiClient`, proven in `frontend/src/features/suppliers/api/suppliers-api.ts` and `frontend/src/features/sponsors/api/sponsors-api.ts`) and the E21-S5 import-boundary lint.
Acceptance criteria (behaviour preserved):
- A verification step enumerates EVERY remaining importer of `frontend/src/lib/api-client.ts` (incl. `createApiClient`/`ApiClient`), each module under `frontend/src/lib/api/` (`apiClients.ts`, `audit.ts`, `automations.ts`, `backup.ts`, `budgets.ts`, `email-campaigns.ts`, `health.ts`, `member-segments.ts`, `members.ts`, `privacy.ts`, `registration.ts`, `retention.ts`, `users.ts`, `webhooks.ts`), and each module under `frontend/src/lib/services/` (`api.ts`, `documents.ts`, `events.ts`).
- Each enumerated residual importer is migrated to the owning feature slice's `api/<domain>-api.ts` module using the standard `useApiClient` contract; request/response shapes, endpoints, auth header behaviour, error mapping (`ApiError`/non-OK throw), and 204-empty handling are preserved exactly.
- After migration the importer count of every legacy path reaches ZERO, OR any deliberately-retained shim is explicitly documented (path + reason + follow-up) so E31-S2 knows it must remain.
- The full vitest suite stays green (`npm test -- --run`); no test is removed or skipped; no route, API contract, auth, or i18n behaviour changes.
Acceptance criteria (improvements):
- Migrated calls collapse onto the single standard contract (one client, one error model), removing the per-resource service indirection and the class-based `fetch` wrapper for those call sites.
- Migrated slices follow the E21-S1 recipe (typed `api/<domain>-api.ts`, hook-based client access) and satisfy the E21-S5 import-boundary rule without new allowances.
Architecture notes:
- The legacy class client (`frontend/src/lib/api-client.ts`) is a token-seeded `fetch` wrapper exposing `get/post/put/delete`, throwing a structured `ApiError` on non-OK and returning `{}` for 204; preserve these semantics when porting to `useApiClient` so error and empty-body handling is unchanged.
- Place each migrated method on the slice that OWNS the resource (e.g. members/segments → members slice, budgets → finance slice, webhooks → integrations slice, documents/events → their domain slices) — do not create a catch-all slice; if a resource has no existing owning slice, document it as a retained shim rather than inventing scope.
- No backend/route/API-contract changes; endpoints and payloads are copied verbatim.
Tests/evidence:
- Verification output (grep/import scan) listing every legacy importer before and after, demonstrating the count reaches zero or enumerating each documented retained shim.
- `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` all green; suite count unchanged or higher (no removals).

### Story E31-S2: Delete the legacy client and compatibility shims
As a frontend engineer, I want the now-unused legacy HTTP client and its compatibility shims deleted, so that the codebase has exactly one HTTP contract and the E21-S5 import-boundary lint no longer needs any legacy-path allowance.
Requirements: Technical initiative — final consolidation of the Frontend Refactoring Program. Depends on E31-S1 having left zero legacy importers (or only explicitly-documented retained shims).
Acceptance criteria (behaviour preserved):
- Pre-deletion gate: re-run the E31-S1 verification and confirm zero importers of each target legacy path (excluding any explicitly-documented retained shim); deletion proceeds only for modules with zero importers.
- DELETE the class-based client `frontend/src/lib/api-client.ts` and every now-unused compatibility shim under `frontend/src/lib/api/` (`apiClients.ts`, `audit.ts`, `automations.ts`, `backup.ts`, `budgets.ts`, `email-campaigns.ts`, `health.ts`, `member-segments.ts`, `members.ts`, `privacy.ts`, `registration.ts`, `retention.ts`, `users.ts`, `webhooks.ts`) and `frontend/src/lib/services/` (`api.ts`, `documents.ts`, `events.ts`).
- Still-needed tests are preserved by relocation, not deletion: move `frontend/src/lib/api/members.test.ts`, `frontend/src/lib/api/users.test.ts`, and `frontend/src/lib/services/volunteers.test.ts` into the owning feature slice (retargeted at the slice's `api/<domain>-api.ts`); if a test is obsoleted purely because its legacy module is gone, document the rationale rather than silently dropping coverage.
- No route, API contract, auth, or i18n behaviour changes; no remaining import resolves to a deleted path.
Acceptance criteria (improvements):
- The E21-S5 import-boundary ESLint config has NO remaining legacy-path allowances (any `lib/api-client`, `lib/api/*`, `lib/services/*` exception is removed); lint passes with the stricter config.
- `frontend/src/lib/` no longer hosts an HTTP-client layer parallel to `src/features/*/api`; the program ends on a single `useApiClient` contract.
Architecture notes:
- Deletion order: confirm zero importers (gate) → delete shims under `lib/api/`/`lib/services/` → delete `lib/api-client.ts` → relocate retained tests → tighten the E21-S5 lint allowlist → full build.
- `next build` is added to this story's gate (beyond the standard per-story DoD) because deleting modules can surface previously-tolerated dangling imports only at build/type time.
- Any shim deliberately retained by E31-S1 stays; record it explicitly so this story does not delete a still-referenced module.
Tests/evidence:
- Record of deleted files (full paths) and relocated test files (old → new path), plus the E21-S5 lint-config diff removing legacy-path allowances.
- `npm run typecheck` (`tsc`) + full vitest (`npm test -- --run`) + `next build` all green with the legacy client gone; final import scan shows zero references to any deleted path.

## Release and Sprint Guidance

Per the 2026-05-14 generic white-label pivot (OD-3, resolved), Epics E9 then E10 are the active focus and preempt the waves below. Epics E4–E8 were reset to backlog and resume after E9/E10, with E10 sequenced before E8 so the external API route group is covered by module enforcement. Detailed resequencing is handled by `bmad-sprint-planning`.

Suggested implementation waves (pre-pivot order, for reference):

1. Security: E1.
2. Data quality: E2.
3. Event operations: E3.
4. Event monetization: E4.
5. Communication automation: E5.
6. Finance planning: E6.
7. Quality baseline: E7.
8. External APIs/webhooks: E8.

Each wave can be split into one or more sprints based on team capacity. Stories should not be marked implementation-ready until code owners inspect the relevant backend/frontend modules and confirm file-level touch points.

Per the 2026-05-15 Beta-on-Railway and Open Source Foundation pivot, Epics E11–E20 are the active focus and preempt E4–E8 (which return to Deferred Backlog). Sprint Change Proposal 2026-05-15 §6 prescribes ten implementation waves:

1. OSS Foundation: E20-S1, E20-S2 (license/DCO/CONTRIBUTING). Quick, unblocks public collaboration.
2. Configuration hygiene: E11-S1, E11-S2, E11-S3. No external dependencies.
3. Containerization: E12-S1, E12-S2, E12-S3. Local-only verifiable.
4. Source-disclosure: E20-S3, E20-S4 (depends on Wave 3 build-args).
5. CI publish: E20-S5. Requires Wave 3 to be merged.
6. Railway provisioning: E13-S1, E13-S2, E13-S3, E13-S4. Requires Wave 5 to be pulling.
7. Persistence and storage: E15-S1..S4, E16-S3.
8. Security and observability: E14-S1..S5, E17-S1..S4.
9. Beta operations: E18-S1..S4.
10. Production prep (not Beta blocker): E19-S1..S4.

Per the hybrid BMAD workflow (memory `feedback_bmad_workflow.md`): bundle `bmad-code-review` + `bmad-retrospective` at each epic boundary, not per story. This applies equally to E11–E20.

## Story Readiness Checklist

Before `bmad-create-story`, each story should have:

- Requirement IDs confirmed.
- Existing code locations inspected.
- Backend authorization requirement identified.
- Audit/privacy/finance/retention impact assessed.
- Database migration need decided.
- Frontend route/component/API wrapper locations identified.
- Tests planned.
- Manual validation path documented for Keycloak, provider, browser, or event-day behavior.

## Traceability Matrix

| Requirement | Epic | Stories |
| --- | --- | --- |
| REQ-006 | E1 | E1-S5 |
| REQ-009 | E1 | E1-S1, E1-S2 |
| REQ-010 | E1 | E1-S3, E1-S4 |
| REQ-018 | E2 | E2-S1, E2-S2, E2-S3, E2-S4 |
| REQ-022 | E4 | E4-S1, E4-S2, E4-S3 |
| REQ-023 | E3 | E3-S1, E3-S2 |
| REQ-024 | E3 | E3-S3, E3-S4 |
| REQ-025 | E3 | E3-S5 |
| REQ-028 | E5 | E5-S1, E5-S2, E5-S3 |
| REQ-030 | E5 | E5-S4, E5-S5 |
| REQ-044 | E6 | E6-S1, E6-S2, E6-S3 |
| REQ-055 | E7 | E7-S3, E7-S4 |
| REQ-056 | E7 | E7-S1, E7-S2 |
| REQ-058 | E8 | E8-S1, E8-S2, E8-S3, E8-S4 |
| REQ-086 | E9 | E9-S1, E9-S2, E9-S3, E9-S4 |
| REQ-087 | E10 | E10-S1, E10-S2, E10-S3, E10-S4, E10-S5 |
| REQ-088 | E11, E12, E13, E14, E15, E16, E17, E18, E19 | E11-S1..S3, E12-S1..S4, E13-S1..S4, E14-S1..S5, E15-S1..S4, E16-S1..S3, E17-S1..S4, E18-S1..S4, E19-S1..S4 |
| REQ-089 | E20 | E20-S1, E20-S2, E20-S3, E20-S4, E20-S5 |
| Tech-initiative (Frontend Refactoring) | E21, E22 | E21-S1..S5; E22-S1, E22-S2, E22-S3 |

## Validation Checklist

- All 14 Backlog requirements plus the four PRD-native requirements (REQ-086, REQ-087, REQ-088, REQ-089) are assigned to epics.
- Every epic maps to the validated PRD and architecture.
- Stories preserve the modular monolith architecture.
- Stories identify security, audit, and testing expectations.
- Cross-module finance/event/communication stories call out integration risks.
- External provider stories avoid committing secrets or adding premature services.
- The artifact is ready for `bmad-check-implementation-readiness` after architecture/PRD alignment review.
- Beta-on-Railway and Open Source Foundation stories (E11–E20) cover REQ-088 (Beta Deployment Readiness) and REQ-089 (Open Source License Surface), with each story carrying observable acceptance criteria and an Architecture-notes reference to the relevant ADR-009 through ADR-021.
- E20-S5 (GHCR pipeline) lands before E13-S1..S4 (Railway provisioning) so that Railway pulls existing GHCR images rather than building from source.
- E14-S4 (rate-limiting baseline) lands before E8 (External Integration Surface) when E8 resumes, so external API routes inherit the rate-limit policy.
- E11–E20 stories explicitly reference Architecture ADR-009 through ADR-021 for traceability and to avoid re-deciding agreed-upon items at story execution time.
- The 40 Beta-pivot stories (e11-s1 through e20-s5) have pre-authored implementation-artifact stubs in `_bmad-output/implementation-artifacts/`; sprint planning may need to reconcile any stub drift against the canonical acceptance criteria in this artifact.
- Epic E22 (Sponsors) is the first Frontend Refactoring Program domain epic materialised from `frontend-refactoring-roadmap.md` §E22; its three stories (E22-S1 tests / E22-S2 list slice + Tier badge + `hi.json` parity / E22-S3 form sub-recipe) inherit the E21-S3 pilot recipe with grounded ACs and preserve all routes, auth, API contracts, i18n keys, and existing tests. The remaining program epics (E23–E31) stay planned-only in the roadmap and are materialised one at a time after each preceding domain epic's boundary review.

## Residual Risks

- Installed BMAD create-epics workflow files are missing, so this artifact follows the available BMAD manifest/menu and local planning artifacts.
- Some stories may need to be split further after code-level inspection.
- Provider-dependent stories need environment-specific configuration decisions before implementation.
- REQ-023 remains Backlog in the status source, even though related QR primitives may already exist.

