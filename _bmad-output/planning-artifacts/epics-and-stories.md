# IAB Connect Epics and Stories

Date: 2026-05-11
Last revised: 2026-05-14 — appended Epic E9 (Generic Positioning and White-Label Branding, REQ-086) and Epic E10 (Module Configuration and Access Enforcement, REQ-087) for the generic white-label pivot, with Scope, Epic Summary, Dependencies, Release Guidance, Traceability Matrix, and Validation Checklist updates (Sprint Change Proposal 2026-05-14, handoff step 4).
Project: IAB Connect
Document status: Draft epics and stories from validated PRD and architecture
Output location: `_bmad-output/planning-artifacts/epics-and-stories.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/prd-validation-report.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-14.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`
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

## Validation Checklist

- All 14 Backlog requirements plus the two PRD-native requirements (REQ-086, REQ-087) are assigned to epics.
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

