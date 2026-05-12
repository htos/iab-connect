# IAB Connect Epics and Stories

Date: 2026-05-11
Project: IAB Connect
Document status: Draft epics and stories from validated PRD and architecture
Output location: `_bmad-output/planning-artifacts/epics-and-stories.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/prd-validation-report.md`
- `_bmad-output/planning-artifacts/architecture.md`
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

## Dependencies

1. E1 should happen before external APIs, provider integrations, or other sensitive admin surfaces.
2. E2 should happen before broad member-targeted automations to reduce duplicate communication risk.
3. E3 should happen before E4 if paid event registration depends on event operational maturity.
4. E4 depends on existing finance cancellation, reversal, invoice, receipt, and audit behavior.
5. E5 depends on existing email templates, campaigns, consent filtering, and Hangfire.
6. E8 should happen after authorization, audit, rate limiting, and provider secret practices are clear.

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

## Release and Sprint Guidance

Suggested implementation waves:

1. Security: E1.
2. Data quality: E2.
3. Event operations: E3.
4. Event monetization: E4.
5. Communication automation: E5.
6. Finance planning: E6.
7. Quality baseline: E7.
8. External APIs/webhooks: E8.

Each wave can be split into one or more sprints based on team capacity. Stories should not be marked implementation-ready until code owners inspect the relevant backend/frontend modules and confirm file-level touch points.

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

## Validation Checklist

- All 14 Backlog requirements are assigned to epics.
- Every epic maps to the validated PRD and architecture.
- Stories preserve the modular monolith architecture.
- Stories identify security, audit, and testing expectations.
- Cross-module finance/event/communication stories call out integration risks.
- External provider stories avoid committing secrets or adding premature services.
- The artifact is ready for `bmad-check-implementation-readiness` after architecture/PRD alignment review.

## Residual Risks

- Installed BMAD create-epics workflow files are missing, so this artifact follows the available BMAD manifest/menu and local planning artifacts.
- Some stories may need to be split further after code-level inspection.
- Provider-dependent stories need environment-specific configuration decisions before implementation.
- REQ-023 remains Backlog in the status source, even though related QR primitives may already exist.

