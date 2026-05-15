# IAB Connect Epics and Stories

Date: 2026-05-11
Last revised: 2026-05-15 — appended Epics E11–E20 (Beta-on-Railway and Open Source Foundation) covering REQ-088 (E11–E18) and REQ-089 (E20), plus Production Readiness preparation (E19), with Scope, Epic Summary, Dependencies, Release Guidance, Traceability Matrix, and Validation Checklist updates (Sprint Change Proposal 2026-05-15, handoff step 3). Previously revised 2026-05-14 (appended Epic E9 Generic Positioning and White-Label Branding REQ-086 and Epic E10 Module Configuration and Access Enforcement REQ-087) for the generic white-label pivot (Sprint Change Proposal 2026-05-14, handoff step 4).
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

## Residual Risks

- Installed BMAD create-epics workflow files are missing, so this artifact follows the available BMAD manifest/menu and local planning artifacts.
- Some stories may need to be split further after code-level inspection.
- Provider-dependent stories need environment-specific configuration decisions before implementation.
- REQ-023 remains Backlog in the status source, even though related QR primitives may already exist.

