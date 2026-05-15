---
workflowType: 'prd'
workflow: 'edit'
classification:
  domain: 'general'
  projectType: 'web_app'
inputDocuments:
  - 'docs/Anforderungen_WebApp_Indischer_Kulturverein.csv'
  - 'docs/10_requirements_status.md'
  - 'docs/project-overview.md'
  - 'docs/index.md'
  - 'docs/09_decisions_log.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md'
  - '_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md'
stepsCompleted: ['step-e-01-discovery', 'step-e-02-review', 'step-e-03-edit']
lastEdited: '2026-05-15'
editHistory:
  - date: '2026-05-14'
    changes: 'Generic positioning revision per Sprint Change Proposal 2026-05-14: repositioned as a configurable white-label organization management platform; added PRD-native REQ-086 (Generic Positioning & White-Label Branding) and REQ-087 (Module Configuration & Access Enforcement) with acceptance criteria; updated Executive Summary, Product Goals, Business Outcomes, Users and Stakeholders, Scope, Product Principles, NFRs, Success Metrics, MVP Definition, Roadmap, Risks, and the Requirement Traceability Appendix; OD-1 recorded (REQ-086/087 PRD-native).'
  - date: '2026-05-14'
    changes: 'Post-validation simple fixes (prd-validation-report-2026-05-14): added classification frontmatter (domain general, projectType web_app); generalized the SystemSettings reference in Product Principle #5 and the REQ-086 acceptance criteria to a technology-neutral "configurable application settings store".'
  - date: '2026-05-14'
    changes: 'Validation-guided edit (prd-validation-report-2026-05-14): added Critical User Journey "Admin Configures the Platform" covering REQ-086 branding and REQ-087 module configuration with three-layer enforcement — closes the report''s sole Warning (REQ-086/087 traceability gap) and raises their Traceable score to 5; quantified the Performance NFRs with measurable targets (list/search endpoint p95 < 1s at up to 50 concurrent users, default/max page size 25/100, page-interaction p95 < 2s, export 10s threshold), closing the carry-over measurability observation.'
  - date: '2026-05-15'
    changes: 'Beta-on-Railway and Open Source Foundation pivot per Sprint Change Proposal 2026-05-15: added PRD-native REQ-088 (Beta Deployment Readiness) and REQ-089 (Open Source License Surface) with acceptance criteria; added Product Principles 10 (Open Source by Default) and 11 (Deployment-Target Portability); added Operations and Deployment FR subsection; added Beta and Open Source Acceptance Criteria section; added Beta Environment Operations NFR subsection; restructured Recommended Roadmap to make Beta-on-Railway (E11–E20) the active sprint wave with Deferred Backlog (E4–E8) demoted; expanded Out of Scope with Beta-specific items; expanded Risks and Open Questions with SCP §9 items and recorded OD-6 (requirements-status doc out of sync with closed epics E1/E2/E3/E9/E10); updated REQ-086/REQ-087 status to Done in traceability appendix per Epic-9/Epic-10 retros; added REQ-088/REQ-089 rows to traceability appendix.'
  - date: '2026-05-15'
    changes: 'Post-validation simple fixes (prd-validation-report-2026-05-15): added two Success Metrics lines for REQ-088 (Beta Deployment Readiness) and REQ-089 (Open Source License Surface) analogous to the existing REQ-086/087 entries — closes the report''s sole Warning and raises the REQ-088/089 SMART Traceable score from 4 to 5; generalized the "Mailtrap Sandbox" reference in the Operations and Deployment FR statement to "a non-delivering sandbox provider" — closes the FR/AC inconsistency informational finding and keeps the PRD provider-agnostic per SCP-2026-05-15 §2 rationale (specific provider name remains in Architecture ADR-018).'
---

# IAB Connect Product Requirements Document

Date: 2026-05-14
Project: IAB Connect
Document status: Revised for generic white-label positioning (Sprint Change Proposal 2026-05-14); previously edited after PRD validation
Output location: `_bmad-output/planning-artifacts/prd.md`
Primary sources:

- `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`
- `docs/10_requirements_status.md`
- `docs/project-overview.md`
- `docs/index.md`
- `docs/09_decisions_log.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`

## Executive Summary

IAB Connect is a configurable, white-label organization management platform for associations, clubs, communities, startups, and small SMEs. Organization identity and branding are admin-configurable, and functional modules can be enabled or disabled per deployment. It supports operations across identity and access, member management, events, communication, sponsors and suppliers, document management, finance and accounting, public website features, reporting, privacy, audit, backups, and operations.

The product is already a substantial Brownfield application rather than an unstarted MVP. The current requirements corpus contains 85 tracked requirements, with 71 marked Done and 14 still in Backlog as of 2026-05-11. Two PRD-native requirements — REQ-086 (Generic Positioning & White-Label Branding) and REQ-087 (Module Configuration & Access Enforcement) — extend that corpus to remove the hardcoded single-organization positioning. The PRD therefore defines the target product and the remaining product gaps while preserving the implemented modular monolith architecture and delivery constraints.

The product goal is to give organization administrators, board or committee members, treasurers, event managers, and members a single secure system for daily organizational work, replacing spreadsheet-driven and manually coordinated workflows with auditable, role-aware, multilingual web workflows. The platform ships as a single-tenant deployment per organization; generic positioning means each deployment is brandable and module-configurable, not multi-tenant.

The platform is released as Open Source under the GNU Affero General Public License version 3.0 or later (AGPL-3.0-or-later), with public container images and a documented reference Beta deployment on Railway. Self-hosters can run the identical reference stack locally via Docker Compose. Source-code disclosure is exposed to running users through a frontend footer link and an unauthenticated `/about` endpoint that reports name, license, version, commit SHA, build date, and source URL (AGPL §13 compliance).

## Product Goals

1. Provide a secure, role-aware operational platform for organization administration that is not bound to any single organization's identity.
2. Centralize member, event, communication, document, finance, and public website workflows.
3. Make organization identity, branding, and module availability admin-configurable per deployment.
4. Support Swiss/EU privacy, audit, retention, and finance compliance needs.
5. Reduce manual coordination work for board or committee members and volunteers.
6. Preserve a maintainable single-tenant modular monolith architecture that can evolve without premature service decomposition.

## Business Outcomes

1. Organization staff and volunteers can run core operations without parallel spreadsheet or email-only tracking for supported workflows.
2. Board or committee members and treasurers have auditable evidence for membership, finance, privacy, document, and event decisions.
3. Members get a self-service experience for profile updates, communication preferences, documents, and event participation.
4. Event managers can plan, publish, fill, communicate, and reconcile event participation from one system.
5. Each organization can present its own name, branding, and selected module set without code changes.
6. The product remains feasible for a volunteer-led or small-team organization by keeping operations self-hosted, modular, and maintainable.

## Users and Stakeholders

Role names below are default labels. They represent the configurable roles an organization assigns and are not specific to any one organization type.

### Primary Users

- Admin: full system administration, users, roles, organization branding, module configuration, audit, operations.
- Board or committee member (default label "Vorstand"): member oversight, events, communication, reporting.
- Treasurer (default label "Kassier"): finance, invoices, payments, receipts, accounting, reporting.
- Event manager: event creation, publication, registrations, waitlists, participants.
- Member: login, profile self-service, event registration, documents and communications.

### Secondary Users

- Public visitor: reads public content, events, sponsors, blog, and contact forms when the Public View module is enabled.
- Sponsor or supplier contact: appears in sponsor/supplier management workflows.
- Auditor or compliance reviewer: consumes exports, logs, finance reports, audit evidence.

## Critical User Journeys

These journeys apply to any organization deploying the platform and are independent of organization type.

### Admin Configures the Platform

1. Admin opens the platform configuration area covering organization identity and module availability.
2. Admin sets organization branding — name, logo, colors, description, and contact information — and adjusts public-page settings such as visibility and content. Changes persist and apply across authenticated and public surfaces; an unconfigured deployment keeps its current presentation until branding is changed.
3. Admin enables or disables functional modules — Members, Events, Documents, Communication, Finance, Partners, and Public View — with all modules enabled by default.
4. The system hides disabled modules from navigation, blocks direct-URL access with a 403 or a safe redirect, and enforces module availability at the backend/API layer as the security boundary.
5. Denied access to a disabled module is audit logged; cross-module dependencies degrade safely — for example, paid event registration that requires Finance is handled gracefully when Finance is disabled rather than breaking.
6. Branding and module settings remain auditable and can be revised later without code changes or a schema redesign.

### Admin Onboards a New Member

1. Admin creates or invites a user through the user management flow.
2. The system sends invitation or account setup instructions through Keycloak/email.
3. The member completes login, profile fields, and required privacy consents.
4. Admin or board member reviews membership status and assigns the correct membership type.
5. Audit and status history remain available for later review.

### Member Self-Service

1. Member logs in through Keycloak/OIDC.
2. Member reviews profile data, contact preferences, consents, documents, and event registrations.
3. Member updates allowed profile fields and communication preferences.
4. The system validates input, stores changes, and preserves audit/privacy evidence where required.

### Event Lifecycle

1. Event manager creates a draft event with date, location, visibility, capacity, category, and registration settings.
2. Event is published to the appropriate public or member audience.
3. Members or public visitors register, cancel, or join the waitlist.
4. System sends confirmation, waitlist, reminder, and cancellation messages when configured.
5. Event manager manages participants, check-in status, exports, and post-event reporting.

### Treasurer Invoice and Payment Workflow

1. Treasurer configures finance profile, fiscal period, accounts, categories, and tax codes.
2. Treasurer creates invoices, generates PDFs or Swiss QR bills, sends invoices, and records payments.
3. Bank imports, reconciliations, reminders, receipts, and reports update finance state.
4. Posted or sent finance records use cancellation, reversal, soft delete, or locking rules instead of unsafe edits.
5. Reports and exports provide audit-ready evidence.

### Document Governance

1. Authorized user creates folders, uploads documents, and applies metadata, tags, versions, and permissions.
2. Members or staff access only documents they are allowed to see.
3. Version, retention, search, and permission behavior remain auditable.
4. Storage uses the configured S3-compatible RustFS backend through the document abstraction.

### Privacy Export and Deletion

1. Member requests privacy export or deletion.
2. System verifies identity and authorization.
3. Export includes the relevant member data, consents, and audit-visible records.
4. Deletion follows the configured confirmation, review, anonymization, retention, and audit process.

### Communication Campaign

1. Communication user selects recipients by segment, consent, role, or other permitted filters.
2. User selects or edits a template, previews variables, and sends a test message.
3. Campaign is sent, scheduled, cancelled, or completed.
4. Recipient status, bounces, unsubscribes, and delivery statistics are tracked.

## Current Product State

The repository is a multi-part Brownfield application:

- Backend API: `.NET 10`, ASP.NET Core Minimal APIs, EF Core, PostgreSQL, MediatR, FluentValidation, Hangfire, Serilog.
- Frontend web app: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, next-auth, next-intl.
- Infrastructure: Docker Compose with PostgreSQL 17, Keycloak 26.5.2, RustFS, MailHog, Seq.

Implemented capabilities already include Keycloak/OIDC login, role and permission enforcement, user management, member management, member segmentation, events, event registration, waitlists, email campaigns, email templates, newsletter consent/unsubscribe, sponsors, suppliers, documents, finance, accounting extensions, reports, audit, privacy, retention, global search, backups, and health checks.

The remaining known Backlog requirements are:

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| REQ-006 | Identity & Access | Social / Enterprise Logins | Should |
| REQ-009 | Identity & Access | Multi-factor Authentication | Should |
| REQ-010 | Identity & Access | Session and Device Management | Should |
| REQ-018 | Members / CRM | Duplicate Detection | Should |
| REQ-022 | Events | Ticketing / Fees | Should |
| REQ-023 | Events | On-site QR Check-in | Could |
| REQ-024 | Events | Volunteer Planning and Tasks | Should |
| REQ-025 | Events | Calendar Integration | Could |
| REQ-028 | Communication | Automations / Journeys | Should |
| REQ-030 | Communication | Multi-channel Messages | Could |
| REQ-044 | Finance | Budgets and Cost Centers | Could |
| REQ-055 | Operations & Quality | Multilingual DE/EN/HI | Could |
| REQ-056 | Operations & Quality | Basic Accessibility | Should |
| REQ-058 | Operations & Quality | API / Webhooks | Could |

Beyond the 14 CSV-sourced Backlog requirements, four PRD-native requirements are added by successive PRD revisions:

- REQ-086 (Generic Positioning & White-Label Branding) and REQ-087 (Module Configuration & Access Enforcement) — net-new platform-configuration capabilities, tracked through Epics E9 and E10 (now closed per Epic-9 and Epic-10 retros). See the Functional Requirements "Platform Configuration" subsection.
- REQ-088 (Beta Deployment Readiness) and REQ-089 (Open Source License Surface) — net-new operations-and-deployment capabilities introduced by Sprint Change Proposal 2026-05-15, tracked through Epics E11–E20. See the Functional Requirements "Operations and Deployment" subsection.

The status doc `docs/10_requirements_status.md` carries the 71-Done / 14-Backlog snapshot as of 2026-05-11 and has not yet been updated to reflect the closures of Epics E1, E2, E3, E9, and E10; see OD-6 in Risks and Open Questions.

## Scope

### In Scope

- Authenticated admin and member portal workflows.
- Public website pages required for organization communication.
- Member, event, communication, sponsor, supplier, document, finance, privacy, audit, search, backup, and reporting modules.
- Admin-configurable organization identity and white-label branding (name, logo, colors, description, contact information, public-page settings).
- Admin-controlled module configuration with enablement or disablement of functional modules, enforced at navigation, routing, and backend/API layers.
- Backend policy-based authorization as the security boundary, including module-availability enforcement.
- Frontend role-aware navigation and action visibility as a UX aid.
- Local development infrastructure through Docker Compose.
- Swiss/EU-relevant privacy, retention, audit, and finance behavior.

### Out of Scope

- Premature microservice decomposition.
- Native mobile applications.
- Multi-tenant data architecture: the platform stays single-tenant per deployment with no `organization_id` partitioning; "white-label" means brandable and module-configurable, not multi-organization.
- Renaming the internal `IabConnect.*` namespace and assembly names: internal-only, high-churn, no user-visible value (documented deferral; OD-4 in Sprint Change Proposal 2026-05-14).
- Non-Keycloak identity authority as the primary account source.
- Hard deletion of finance and other compliance-sensitive records where retention is required.
- Replacing the modular monolith with a distributed architecture for MVP work.
- Production deployment for the Beta release: Epic E19 prepares Production readiness (custom-domain runbook, restore drill, gate checklist, self-hosted SMTP migration plan) but the Production-Go-Live deployment itself is a separate decision after Beta validation.
- Real outbound mail delivery in the Beta environment: outbound mail is routed to a sandbox SMTP destination so the application does not deliver mail to real recipients.
- Custom domains in the Beta environment: services use the deployment target's default public domains; custom-domain migration is a Production-prep story in Epic E19.
- Off-site backup replication during Beta: backups share an object-storage volume with primary document storage. Off-site replication is a Production-prep story in Epic E19.
- Mass SPDX-header sweep across the existing codebase: SPDX headers apply to new files only during Beta; a sweep across existing files is a follow-up story after Beta.
- Officially supported deployment targets beyond the reference Beta target and local Docker Compose: other deployment targets (VPS, Kubernetes, alternative PaaS) are not precluded by the architecture but are not officially documented for the Beta phase.

## Product Principles

1. Backend authorization is mandatory for every protected operation; frontend role checks are only visibility controls.
2. Module availability is enforced at the backend as a security boundary; navigation filtering and route guards are UX and direct-URL protection, not the control.
3. Sensitive workflows must preserve audit, privacy, retention, and finance compliance behavior.
4. Requirement content for REQ-001 through REQ-085 is sourced from `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`; implementation status is sourced from `docs/10_requirements_status.md`. REQ-086 and REQ-087 are PRD-native: they are defined in this PRD and not added to the organization-specific CSV, because the CSV's filename and content are themselves organization-specific and are being superseded by the generic-positioning initiative (OD-1, Sprint Change Proposal 2026-05-14).
5. No user-visible string hardcodes a specific organization; values come from a configurable application settings store or translation keys.
6. Executable files and code win over older prose when exact stack versions or behavior disagree.
7. MVP and follow-on delivery should extend the single-tenant modular monolith rather than introduce separate deployables.
8. User-facing frontend text must use next-intl translation keys.
9. Authenticated UI must follow the existing page layout, shared components, orange primary actions, and searchable/filterable list patterns.
10. Open Source by Default. All product surfaces — UI, API, deployment configuration, container images — are released under AGPL-3.0-or-later. Third-party dependencies must be license-compatible with AGPL-3.0-or-later. New source files carry SPDX identifiers. Contributions are accepted under DCO sign-off.
11. Deployment-Target Portability. The platform must run identically on a developer workstation (Docker Compose) and on the reference Beta target (Railway). Configuration is environment-variable-driven; environment-specific code branches are limited to existing `IsDevelopment()` checks, which remain Development-only and do not extend to Beta or Production.

## Functional Requirements

### Identity and Access

- Support admin and member login through Keycloak/OIDC. Existing: REQ-001, REQ-005.
- Support user management through Keycloak Admin API, including create, edit, disable, role assignment, and password reset. Existing: REQ-002, REQ-003, REQ-008.
- Enforce fine-grained backend permissions for CRUD actions and resource ownership. Existing: REQ-004.
- Support registration, invitation, and profile onboarding. Existing: REQ-007.
- Maintain audit logging and privacy compliance for security and data changes. Existing: REQ-011, REQ-012.
- Add optional social or enterprise login providers such as Google and Microsoft. Backlog: REQ-006.
- Add multi-factor authentication. Backlog: REQ-009.
- Add session and device management. Backlog: REQ-010.

### Members and CRM

- Maintain member profiles, statuses, membership types, onboarding, list/detail/edit views, and member self-service. Existing: REQ-013 through REQ-016.
- Support static and dynamic member segmentation with preview, assignment, and export workflows. Existing: REQ-017.
- Add duplicate detection for member records. Backlog: REQ-018.

### Events

- Support event CRUD, status workflows, publication, categories, visibility, public and protected event views. Existing: REQ-019.
- Support member and public registration, cancellation, waitlists, promotions, notifications, and participant management. Existing: REQ-020, REQ-021.
- Add optional ticketing and event fees. Backlog: REQ-022.
- Improve or complete on-site QR check-in behavior if current implementation does not satisfy the intended event-day flow. Backlog: REQ-023.
- Add volunteer planning and task assignment for events. Backlog: REQ-024.
- Add iCal and Google calendar integration. Backlog: REQ-025.

### Communication

- Support email campaign management with recipients, schedule/send/test/cancel actions, statistics, and recipient previews. Existing: REQ-026.
- Support email templates with variables, categories, rendering, preview, and activation workflows. Existing: REQ-027.
- Support newsletter consent filtering and public unsubscribe links. Existing: REQ-029.
- Add automation journeys for event/member communication. Backlog: REQ-028.
- Add optional multi-channel messaging beyond email. Backlog: REQ-030.

### Sponsors and Suppliers

- Support sponsor records, packages, contract links, status workflows, and sponsor CRUD UI. Existing: REQ-031.
- Support supplier/vendor records and related administration. Existing: REQ-032, REQ-033.

### Documents

- Support document folders, upload, versioning, permissions, tags, S3-compatible storage through RustFS, and document access controls. Existing: REQ-034 through REQ-037.

### Finance and Accounting

- Support accounts, categories, transactions, invoices, payments, reminders/dunning, receipts, fiscal periods, tax codes, exports, Swiss QR bill generation, and finance reports. Existing: REQ-038 through REQ-043, REQ-045, REQ-060 through REQ-085.
- Preserve soft-delete, reversal, cancellation, audit, and retention rules for finance records.
- Add budgets and cost centers if the organization needs planning and cost allocation beyond the current accounting reports. Backlog: REQ-044.

### Public Website

- Support public organization content, public events, sponsors, blog/news, and contact flows. Existing: REQ-046 through REQ-049.

### Reporting and Data

- Support dashboard, exports, reporting, global search, and data visibility appropriate to roles and permissions. Existing: REQ-050 through REQ-052.

### Operations and Quality

- Support backups, restore, health checks, logging, audit, retention, and operational monitoring. Existing: REQ-053, REQ-054, REQ-057, REQ-059.
- Add or complete multilingual coverage for DE/EN/HI as product scope requires. Backlog: REQ-055.
- Add a basic accessibility baseline. Backlog: REQ-056.
- Add optional public or partner APIs/webhooks. Backlog: REQ-058.

### Platform Configuration

These requirements are PRD-native (not sourced from the requirements CSV) and remove the hardcoded single-organization positioning. They are tracked through Epics E9 and E10.

- Provide admin-configurable organization identity and white-label branding so no user-visible string hardcodes a specific organization. PRD-native: REQ-086.
- Provide admin-controlled module configuration so functional modules can be enabled or disabled per deployment, with enforcement at navigation, routing, and backend/API layers. PRD-native: REQ-087.

### Operations and Deployment

These requirements are PRD-native (not sourced from the requirements CSV) and define the Beta release and Open Source foundation. They are tracked through Epics E11–E20.

- Provide a Beta deployment on Railway built from versioned public container images, with environment-variable-driven configuration, two managed PostgreSQL instances, self-hosted RustFS, daily encrypted PostgreSQL backups, health probes, a tester-visible BETA banner, retention enforcement disabled, and outbound mail routed to a non-delivering sandbox provider so the application does not deliver mail to real recipients during Beta. PRD-native: REQ-088.
- Provide an Open Source license surface comprising AGPL-3.0-or-later licensing of the application source, dependency NOTICE, contributor guide with DCO sign-off enforcement, an unauthenticated `/about` endpoint reporting `{ name, license, version, commitSha, buildDate, sourceUrl }`, a frontend footer linking to source, SPDX headers on new files, and OCI provenance labels on published images. PRD-native: REQ-089.

## Backlog Acceptance Criteria

These criteria refine the 14 remaining Backlog requirements from the source CSV. They are intended to make the Backlog implementation-ready for future epics and stories.

### REQ-006 Social / Enterprise Logins

- Admin can configure Google and Microsoft Entra ID providers through the Keycloak-backed identity setup without replacing Keycloak as the authority.
- Member can sign in with a configured external provider and is linked to an existing member account by a controlled account-linking flow.
- Member can connect and disconnect an external provider where policy allows.
- Provider scopes are limited to the minimum required identity claims and are documented for privacy review.
- Failed provider login, duplicate-link attempts, and denied account-link actions are handled without exposing sensitive account existence details.

### REQ-009 Multi-factor Authentication

- Admin can require MFA for selected roles, at minimum Admin and Kassier.
- A user in an MFA-required role cannot complete login until a valid second factor is enrolled and verified.
- TOTP through an authenticator app is supported; backup or recovery codes are available for account recovery.
- Admin can reset MFA for a user through an authorized support flow.
- MFA enrollment, reset, failure, and bypass-sensitive events are audit logged.

### REQ-010 Session and Device Management

- User can view active sessions or devices where Keycloak/session data allows it.
- User can terminate all other sessions from a self-service account or profile area.
- Admin can revoke sessions for a user through an authorized administrative flow.
- Configured session timeout and idle timeout behavior is documented and testable.
- Session termination and admin revocation are reflected at the next protected frontend/backend interaction.

### REQ-018 Duplicate Detection

- When creating or editing a member, the system warns on matching email and likely duplicate identity signals.
- Admin can review candidate duplicate records before confirming a merge.
- Merge process preserves important member history, relationships, documents, event registrations, finance references, consents, and audit records.
- Merge action requires appropriate authorization and creates an audit event with source and target member IDs.
- System blocks unsafe merges when references cannot be reconciled without data loss.

### REQ-022 Ticketing / Fees

- Event manager or Kassier can configure event fee categories for a paid event.
- Registration for a paid event creates the required invoice, payment request, receipt, or finance record according to the finance module rules.
- Confirmation email includes ticket or payment confirmation information after the correct event state is reached.
- Cancellation and refunds follow finance cancellation/reversal rules rather than deleting posted records.
- Role-based authorization separates event management actions from finance approval or reconciliation actions.

### REQ-023 On-site QR Check-in

- Product decision: this Backlog item covers the complete event-day on-site workflow. Existing QR token/check-in primitives from REQ-020 may be reused, but REQ-023 remains Backlog until the event-day scanner, operations, and fallback behavior are complete.
- Event manager can open a check-in view scoped to one event.
- Authorized staff can scan a registration QR code and update check-in status in near real time.
- Duplicate scans show the existing check-in state and do not create duplicate attendance records.
- Staff can manually search and check in an attendee when QR scanning fails.
- Offline fallback export is available before the event and includes enough data for manual check-in.
- Check-in changes are auditable and exportable after the event.

### REQ-024 Volunteer Planning and Tasks

- Event manager can define volunteer roles, tasks, shifts, and capacity per event.
- Member or volunteer can sign up for an available shift where policy allows.
- Event manager can assign, remove, and adjust volunteer assignments.
- Volunteers receive reminders or notifications when communication settings allow it.
- Event manager can export the shift plan and see unfilled roles before the event.

### REQ-025 Calendar Integration

- Public and member-visible events can expose an iCal feed or per-event `.ics` export according to visibility rules.
- Calendar export includes title, date/time, location, description summary, and stable event identity.
- Updates to an event are reflected in the feed or export with a stable UID.
- Private/member-only events are not exposed through unauthenticated public feeds unless explicitly intended.
- Public website can embed or link calendar output without bypassing event visibility rules.

### REQ-028 Automations / Journeys

- Authorized communication user can configure automation triggers for welcome mail, event reminders, contribution/payment reminders, and similar standard flows.
- Each automation uses an approved email template and resolves recipients through consent-aware filters.
- Automation sends only to recipients who match trigger conditions and permission/consent rules.
- Failed sends are logged and visible without blocking unrelated user workflows.
- Automation execution can be paused, resumed, or disabled by an authorized user.

### REQ-030 Multi-channel Messages

- User can store channel preferences where a provider is configured and consent allows it.
- Communication user can choose an enabled channel such as SMS or WhatsApp for supported reminder scenarios.
- Provider failures, costs, and delivery statuses are logged where available.
- Messages are not sent through a channel when consent, preference, or provider configuration is missing.
- External provider credentials are stored as environment/configuration secrets, never in source control.

### REQ-044 Budgets and Cost Centers

- Kassier or Vorstand can create cost centers for events, projects, or association activities.
- Budget values can be assigned to a cost center and fiscal period.
- Finance transactions, invoices, or journal mappings can be associated with a cost center where applicable.
- Soll/Ist comparison is visible per cost center and period.
- Cost center reporting respects finance authorization and export rules.

### REQ-055 Multilingual DE/EN/HI

- User can select an available UI language where translations exist.
- Existing DE/EN behavior continues to work with a safe fallback when a translation key is missing.
- Hindi can be introduced incrementally without hardcoded UI strings in components.
- Public content, events, or posts can identify content language where the feature supports multilingual content.
- Language preference persists per user or browser context as appropriate.

### REQ-056 Basic Accessibility

- Critical authenticated and public flows can be completed with keyboard navigation.
- Forms have programmatic labels, visible validation messages, and usable focus states.
- Interactive icon-only controls have accessible names.
- Color contrast for text, primary actions, status badges, and alerts meets a basic WCAG AA target where feasible.
- Accessibility checks are included for touched high-traffic pages or documented as manual validation evidence.

### REQ-058 API / Webhooks

- Admin can create and revoke API credentials or webhook configurations with scoped permissions.
- Read API endpoints expose only authorized resources and are rate limited.
- Webhooks can be emitted for selected events such as event created and payment received.
- Webhook deliveries are signed or otherwise verifiable by receivers.
- Delivery attempts, failures, retries, and disabling behavior are visible to Admin/IT users.

## Platform Configuration Acceptance Criteria

These criteria refine the two PRD-native platform-configuration requirements. They make REQ-086 and REQ-087 implementation-ready for Epics E9 and E10.

### REQ-086 Generic Positioning & White-Label Branding

- Organization name, logo, colors, description, and contact information are admin-configurable and persisted.
- Public page settings such as visibility and content are admin-configurable.
- No user-visible string hardcodes a specific organization; values come from a configurable application settings store or translation keys.
- Behavior-preserving defaults: an existing deployment keeps its current presentation until an admin changes branding.
- The platform is usable by associations, clubs, communities, startups, and small SMEs without code changes.

### REQ-087 Module Configuration & Access Enforcement

- Admin can enable or disable the modules Members, Events, Documents, Communication, Finance, Partners, and Public View.
- Disabled modules are hidden from navigation, blocked on direct URL access, and enforced at the backend/API layer with a 403 or a safe redirect.
- Denied access to a disabled module is audit logged.
- Module settings persist and the system is extensible to new modules without a schema redesign.
- Cross-module dependencies are handled: when a dependent module is disabled, dependent workflows such as paid event registration requiring Finance degrade safely rather than break.
- Existing functionality is unchanged when a module is enabled; all modules are enabled by default.

## Beta and Open Source Acceptance Criteria

These criteria refine the two PRD-native operations-and-deployment requirements. They make REQ-088 and REQ-089 implementation-ready for Epics E11–E20.

### REQ-088 Beta Deployment Readiness

- The application is deployable to the Beta target via published, versioned container images for the `api`, `web`, and `keycloak` services, each tagged with a moving `:beta` tag and an immutable per-commit tag.
- Build artifacts are produced by a continuous-integration pipeline on push to the `beta` branch and published to a public container registry under the project's organization namespace.
- The Beta deployment uses two managed PostgreSQL instances — one for the application and one for the identity provider — and a self-hosted S3-compatible object storage instance with a persistent volume for document storage.
- All secrets are supplied at runtime through deployment-target environment variables; the repository contains no production secrets and the built container images contain no embedded secrets.
- The Beta environment exposes health endpoints consumed by the deployment target's healthchecks (`/health/ready` on the API and `/api/health` on the web service).
- A daily PostgreSQL backup job runs against the application database and writes encrypted dumps to a dedicated `backups` bucket on the object storage instance with 30-day retention.
- The tester-facing UI shows a persistent dismissable "BETA" banner driven by a public environment-label variable.
- The retention-enforcement recurring job is disabled in Beta to prevent retention-driven deletion of tester data while retention defaults are not yet final per deployment.
- Outbound mail in Beta is routed to a non-delivering sandbox provider; the application does not deliver mail to real recipients in this environment.
- A documented Beta runbook covers deployment, rollback via redeploy of a previous immutable image tag, database restore, common incidents, and tester-onboarding steps.

### REQ-089 Open Source License Surface

- The repository root contains a `LICENSE` file with the full AGPL-3.0-or-later text and a `NOTICE.md` listing direct production dependencies with their declared licenses.
- The repository root contains a `CONTRIBUTING.md` explaining the DCO sign-off requirement and the contribution workflow.
- The protected branches require DCO sign-off via a continuous-integration check; pull requests without a `Signed-off-by:` trailer fail status.
- The frontend renders a persistent footer on every page with the project name, license name, and a link to the `/about` endpoint.
- The backend exposes an unauthenticated `GET /about` endpoint returning JSON `{ name, license, version, commitSha, buildDate, sourceUrl }`; `commitSha` and `buildDate` are injected at container build time.
- New source files committed after this requirement is implemented include an SPDX header (`SPDX-License-Identifier: AGPL-3.0-or-later`). A mass sweep of existing files is out of scope for the Beta release and may be pursued in a follow-up story.
- Published container images carry OCI labels for source URL, license (`AGPL-3.0-or-later`), revision, and build timestamp.

## Non-Functional Requirements

### Security

- All protected backend endpoints must enforce authorization policies or permissions.
- Module availability must be enforced at the backend/API layer as a security boundary; disabled-module access returns a 403 or a safe redirect and is audit logged. Navigation filtering and route guards are UX and direct-URL protection only.
- Access denied and sensitive actions must be audit logged where relevant.
- Authentication must remain standards-based through Keycloak/OIDC.
- Secrets must not be committed to the repository.

### Privacy and Compliance

- Consent, data export, deletion/anonymization, retention, and audit behavior must remain intact.
- Member, finance, document, backup, search, and export flows must treat data as sensitive by default.
- Finance deletion must preserve compliance behavior through soft delete, cancellation, or reversal patterns where required.

### Reliability and Operations

- Local development must be reproducible through Docker Compose.
- Backend and frontend must be runnable independently during development.
- Background jobs must not break user-facing workflows if non-critical email or notification delivery fails.
- Backup and restore behavior must be testable and documented.

### Performance

- List and search endpoints respond in under 1 second for the 95th percentile under normal load (up to 50 concurrent authenticated users per single-tenant deployment), measured by server-side request logging.
- List pages return paginated results with a default page size of 25 items and a maximum of 100 items per request; pagination, search, and filtering are available on list/table pages.
- Authenticated page interactions (navigation, list load, filter apply) complete in under 2 seconds for the 95th percentile under normal load.
- Document and report exports either complete within 10 seconds or run as a background job so they do not block the requesting user's session.
- Backend queries use EF Core patterns suitable for PostgreSQL and avoid loading excessive object graphs.
- Frontend mutation flows refresh data through established refresh-trigger patterns rather than duplicate inline fetch chains.

### Maintainability

- Backend must keep Application, Domain, Infrastructure, and API boundaries clear.
- Business workflows should use MediatR commands/queries and FluentValidation where behavior goes beyond simple reads.
- Frontend should reuse shared layout, UI components, API helpers, and i18n messages.
- New package versions must follow the repository's central package/version conventions.

### Accessibility and Localization

- User-visible frontend text must use translation keys.
- Existing DE/EN behavior should be preserved.
- Basic accessibility should become an explicit acceptance baseline for new UI and when touching existing high-traffic workflows.

### Beta Environment Operations

- Availability target for Beta is best-effort with no service-level agreement. External uptime monitoring polls `/health/ready` every 5 minutes and alerts on three consecutive failures.
- Recovery point objective for Beta is 24 hours, sized by the daily PostgreSQL backup cadence.
- Recovery time objective for Beta is 1 hour, sized by manual `pg_restore` plus container redeploy.
- Tester data is classified as personal data under DSGVO; a data-processing agreement with the deployment-target provider (Article 28) must be in place before tester onboarding.
- Beta and Production share the same hardening profile (HSTS, HTTPS redirect, strict CORS, Swagger and Hangfire Dashboard off); Beta differs from Production only in the tester-visible banner, auto-migration on startup, and the sandboxed SMTP destination.

## Success Metrics

The product is successful for release planning when the following can be demonstrated:

- 100% of Must requirements are Done or have an explicit stakeholder-approved deferral.
- 100% of protected backend endpoint groups have policy/permission coverage documented or verified by tests/review.
- 100% of security, privacy, finance, document, backup, search, and export changes include audit/authorization review evidence.
- Backend `dotnet test` passes from `backend`.
- Frontend `npm run typecheck` and `npm run lint` pass from `frontend`.
- Critical journeys in this PRD have either automated tests or documented manual validation evidence.
- Local setup documentation is current enough for infrastructure, backend, and frontend startup from a clean checkout.
- All remaining Backlog requirements are implemented, explicitly deferred, or dropped with documented rationale before being removed from roadmap scope.
- Basic accessibility checks are completed for touched public pages, forms, navigation, and high-traffic authenticated workflows.
- No user-visible surface hardcodes a specific organization; organization identity and branding render from configurable settings or translation keys (REQ-086).
- All seven functional modules can be enabled or disabled by an admin, settings persist, and disabled-module access is blocked at navigation, routing, and backend/API layers (REQ-087).
- The application is deployable to the reference Beta target via versioned public container images for the api, web, and keycloak services; configuration is environment-variable-driven; the application database is backed up daily with encrypted dumps retained for 30 days; health probes are wired to the deployment target's healthchecks; the tester-facing UI shows a persistent BETA banner; outbound mail is routed to a non-delivering sandbox provider (REQ-088).
- The repository carries a `LICENSE` (AGPL-3.0-or-later), `NOTICE.md` (direct production dependency licenses), and `CONTRIBUTING.md` (DCO sign-off requirement); protected branches enforce DCO sign-off via a CI check; the running application exposes source-disclosure through an unauthenticated `/about` endpoint and a frontend footer; published container images carry OCI provenance labels (REQ-089).

## MVP Definition

The historical MVP decision defines Must-have requirements from the CSV as the delivery baseline. As of 2026-05-11, all remaining CSV-sourced Backlog requirements are Should or Could priority. Therefore the current product appears to have reached the Must-have MVP baseline, subject to validation of the implementation against acceptance criteria and tests.

The generic-positioning initiative (REQ-086, REQ-087) expands the MVP scope rather than reducing it: it introduces net-new platform-configuration capability and is a PRD revision, not an MVP cut. REQ-086 and REQ-087 are treated as required for the repositioned product baseline.

MVP is considered releasable when:

1. All Must-have requirements are Done or explicitly accepted as deferred.
2. Backend test suite passes with `dotnet test`.
3. Frontend typecheck, lint, and relevant tests pass.
4. Key user workflows have manual or automated validation evidence.
5. Deployment, backup/restore, identity, and seed/setup instructions are current.
6. Known security, privacy, audit, and finance compliance regressions are resolved.

## Recommended Roadmap

### Recently Shipped

The following epics have closed retros and are reflected in `_bmad-output/implementation-artifacts/sprint-status.yaml`:

- Epic E1 — Security Foundation (MFA, session and device management, social/enterprise identity provider — provider story deferred).
- Epic E2 — Member Data Quality (duplicate detection, review, and safe merge).
- Epic E3 — Event Operations (check-in roster and export, QR and manual check-in, volunteer planning, calendar feed).
- Epic E9 — Generic Positioning & White-Label Branding (REQ-086).
- Epic E10 — Module Configuration & Access Enforcement (REQ-087).

The corresponding REQ status entries in `docs/10_requirements_status.md` for REQ-009, REQ-010, REQ-018, REQ-023, REQ-024, REQ-025 are out of sync with these closures (OD-6); the status doc remains the source of truth and must be updated as a separate task before the per-REQ traceability appendix can reflect Done state.

### Beta Release on Railway (Highest Priority)

Per Sprint Change Proposal 2026-05-15, the Beta-on-Railway and Open Source Foundation initiative is the active sprint focus and preempts the Deferred Backlog below. It is driven by the two PRD-native requirements REQ-088 and REQ-089 across Epics E11–E20.

- Epic E11 — Environment and Configuration Management for Beta.
- Epic E12 — Dockerization (backend, frontend, custom Keycloak image with SPI baked in).
- Epic E13 — Railway Beta deployment (project + services, environment variables, networking, health probes, first deploy).
- Epic E14 — Security and Secrets Management (secrets audit, security headers, Hangfire-dashboard verification, rate limiting, log audit).
- Epic E15 — Database, Persistence, and Migrations (two-Postgres separation, `Database__AutoMigrate` toggle, daily PostgreSQL backup, Beta seeding).
- Epic E16 — Frontend ↔ Backend Integration on Railway (public URLs, end-to-end OIDC, document upload/download against RustFS).
- Epic E17 — Monitoring, Logging, and Health Checks (Serilog Console-only, structured logs with CorrelationId, frontend health endpoint, external uptime monitoring).
- Epic E18 — Beta Test Preparation and Operations Documentation (runbook, tester onboarding guide, BETA banner, feedback channel).
- Epic E19 — Production Readiness Preparation (custom-domain runbook, backup-restore drill, production gate checklist, self-host SMTP migration plan).
- Epic E20 — Open Source Foundation (LICENSE/NOTICE/CONTRIBUTING, DCO enforcement, SPDX policy, backend `/about` endpoint, frontend license footer, GHCR image publishing pipeline).

Suggested implementation waves are documented in Sprint Change Proposal 2026-05-15 §6.

### Deferred Backlog

These epics are deliberately held until the Beta-on-Railway sprint completes. Story files for many of them are pre-authored on disk but remain at backlog and are not auto-upgraded to ready-for-dev.

- Epic E4 — Event Monetization (REQ-022 Event Ticketing / Fees).
- Epic E5 — Communication Automation (REQ-028 Automations / Journeys; REQ-030 Multi-channel Messages).
- Epic E6 — Finance Planning (REQ-044 Budgets and Cost Centers).
- Epic E7 — Quality Baseline (REQ-055 Multilingual DE/EN/HI; REQ-056 Basic Accessibility).
- Epic E8 — External Integration Surface (REQ-058 API / Webhooks).
- Pending identity-provider decisions: REQ-006 Social / Enterprise Logins (E1-S5 deferred pending provider credentials, scopes, and account-linking decisions).

When E4–E8 resume, the E10 module enforcement already in place ensures that the external API route group introduced by E8 is covered by module-availability checks from day one.

### Release Readiness

- Validate Done requirements against code and tests.
- Confirm whether any Done notes contain known limitations that affect release, especially audit login tracking and event QR check-in.
- Run backend and frontend quality gates.
- Validate local infrastructure startup and documented login/setup flows.

## Risks and Open Questions

- Some generated documentation may lag behind executable code; code and project files must be verified before implementation planning.
- `docs/01_requirements.md` may contain stale embedded status text for some requirements; `docs/10_requirements_status.md` is the status source of truth.
- Audit login tracking is noted as not fully reliable in REQ-011 and should be triaged before release if login audit evidence is required.
- QR check-in appears in implemented event registration notes, while REQ-023 remains Backlog; this PRD treats REQ-023 as the complete event-day check-in workflow until product owners change the requirement status.
- The project uses German source requirements and English BMAD planning artifacts; wording should be reviewed by a stakeholder before final approval.
- OD-1 (resolved): REQ-086 and REQ-087 are PRD-native rather than added to `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`. The organization-specific CSV remains the source for REQ-001 through REQ-085 only; future generic requirements are defined in the PRD.
- OD-2 (open, architecture decision): module status storage — dedicated `module_settings` table versus a JSON column on `system_settings`. Recommendation is a dedicated table; the final call belongs to `bmad-create-architecture`.
- OD-4 (resolved): the internal `IabConnect.*` namespace and assembly rename is out of scope — internal-only, high-churn, no user-visible value.
- OD-5 (open, UX decision): behavior of public routes when the Public View module is disabled — redirect to login versus a minimal "site not public" page. Belongs to `bmad-create-ux-design`; recommendation is a minimal neutral page.
- The requirements CSV filename (`Anforderungen_WebApp_Indischer_Kulturverein.csv`) and parts of `docs/` still carry the original organization name; a documentation refresh is a follow-up to the generic-positioning epics.
- OD-6 (open, documentation-sync): `docs/10_requirements_status.md` is out of sync with the closed epics E1, E2, E3, E9, and E10. The status doc still lists REQ-009, REQ-010, REQ-018, REQ-023, REQ-024, REQ-025 as Backlog even though their owning epics have shipped per `sprint-status.yaml` and the Epic-1/2/3/9/10 retros. The PRD treats the status doc as the source of truth (Product Principle 4) and therefore does not unilaterally flip these statuses to Done. A separate documentation-sync task must update the status doc; the PRD's Requirement Traceability Appendix can be updated to match after that sync.
- The Open Source contribution model uses DCO sign-off; DCO grants the rights AGPL-3.0-or-later requires but does not by itself authorize commercial dual-licensing. Any future commercial dual-license decision requires explicit per-contributor consent.
- The Beta object-storage backend is pinned to RustFS at the upstream `:latest` tag; the project should pin a specific tag once a stable release exists and document the pinning rationale.
- The frontend `NEXT_PUBLIC_API_URL` is build-time-constant; any future API-URL change (such as a custom-domain swap) requires a frontend image rebuild and redeploy. Documented in the Beta runbook.
- The Beta SMTP destination (sandbox provider) has free-tier limits typically around 100 mails per day; a Beta with many testers may hit the cap and need a plan upgrade or earlier transition to a self-hosted SMTP path (Epic E19-S4).
- Deployment-target pricing and free-tier limits are outside the project's control; if the deployment target becomes non-viable, the same architecture transplants to a Hetzner Cloud + Docker Compose self-host path that is documented in the runbook.
- The Beta backup destination shares an object-storage volume with primary document storage; a catastrophic volume loss would take down both. This single-failure-domain risk is accepted for the Beta phase and addressed in E19 (off-site backup replication for Production).
- The retention-enforcement Hangfire job is disabled in Beta to protect tester data while retention defaults are not yet finalized per deployment; retention behavior must be explicitly re-validated and re-enabled as part of Production-readiness.

## Requirement Traceability Appendix

Status source: `docs/10_requirements_status.md` for REQ-001 through REQ-085 (see OD-6 for the documentation-sync gap with recently closed epics). For PRD-native requirements (REQ-086, REQ-087, REQ-088, REQ-089) the PRD itself is the source of truth for status.
Requirement content source: `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv` for REQ-001 through REQ-085. REQ-086 and REQ-087 are PRD-native — defined in this PRD and not in the CSV (see Product Principles and OD-1). REQ-088 and REQ-089 are PRD-native — defined in this PRD and added by Sprint Change Proposal 2026-05-15. REQ-086 and REQ-087 are marked Done in this table per the Epic-9 and Epic-10 retros even while OD-6 keeps the CSV-sourced REQ statuses unchanged.

| ID | Area | Requirement | Priority | Status | PRD Section | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | Identity & Zugriff | Login & Zugriff (Admin und Mitglieder) | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-002 | Identity & Zugriff | Benutzerverwaltung | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-003 | Identity & Zugriff | Rollenverwaltung | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-004 | Identity & Zugriff | Feingranulare Zugriffskontrolle | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-005 | Identity & Zugriff | SSO Anbindung (Keycloak / OIDC / SAML) | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-006 | Identity & Zugriff | Social / Enterprise Logins (Google, Microsoft) | Should | Backlog | Identity and Access | Expanded in Backlog Acceptance Criteria |
| REQ-007 | Identity & Zugriff | Registrierung & Onboarding | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-008 | Identity & Zugriff | Passwort Reset & Account Recovery | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-009 | Identity & Zugriff | Mehrfaktor-Authentifizierung (MFA) | Should | Backlog | Identity and Access | Expanded in Backlog Acceptance Criteria |
| REQ-010 | Identity & Zugriff | Session- und Geraeteverwaltung | Should | Backlog | Identity and Access | Expanded in Backlog Acceptance Criteria |
| REQ-011 | Identity & Zugriff | Audit Log (Sicherheits- & Datenaenderungen) | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-012 | Identity & Zugriff | Datenschutz & Einwilligungen (DSGVO) | Must | Done | Identity and Access | Inherited from source requirement/status evidence |
| REQ-013 | Mitglieder/CRM | Mitgliederstammdaten (CRM mini) | Must | Done | Members and CRM | Inherited from source requirement/status evidence |
| REQ-014 | Mitglieder/CRM | Mitgliedschaftsarten & Status | Must | Done | Members and CRM | Inherited from source requirement/status evidence |
| REQ-015 | Mitglieder/CRM | Beitraege & Beitragsverwaltung | Must | Done | Members and CRM | Inherited from source requirement/status evidence |
| REQ-016 | Mitglieder/CRM | Mitglieder Self-Service Portal | Must | Done | Members and CRM | Inherited from source requirement/status evidence |
| REQ-017 | Mitglieder/CRM | Segmentierung & Verteiler | Should | Done | Members and CRM | Inherited from source requirement/status evidence |
| REQ-018 | Mitglieder/CRM | Dubletten-Erkennung | Should | Backlog | Members and CRM | Expanded in Backlog Acceptance Criteria |
| REQ-019 | Events | Eventverwaltung (Kalender, Details) | Must | Done | Events | Inherited from source requirement/status evidence |
| REQ-020 | Events | Event-Anmeldung / RSVP | Must | Done | Events | Inherited from source requirement/status evidence |
| REQ-021 | Events | Warteliste & Nachruecken | Should | Done | Events | Inherited from source requirement/status evidence |
| REQ-022 | Events | Ticketing / Gebuehren (optional) | Should | Backlog | Events | Expanded in Backlog Acceptance Criteria |
| REQ-023 | Events | Check-in vor Ort (QR-Code) | Could | Backlog | Events | Expanded in Backlog Acceptance Criteria |
| REQ-024 | Events | Helferplanung & Aufgaben | Should | Backlog | Events | Expanded in Backlog Acceptance Criteria |
| REQ-025 | Events | Kalender-Integration (iCal/Google) | Could | Backlog | Events | Expanded in Backlog Acceptance Criteria |
| REQ-026 | Kommunikation | E-Mail Verwaltung (Automatisiertes Mailing) | Must | Done | Communication | Inherited from source requirement/status evidence |
| REQ-027 | Kommunikation | Template-Editor & Vorlagenpflege | Must | Done | Communication | Inherited from source requirement/status evidence |
| REQ-028 | Kommunikation | Automations/Journeys | Should | Backlog | Communication | Expanded in Backlog Acceptance Criteria |
| REQ-029 | Kommunikation | Newsletter Opt-in/Opt-out & Bounces | Must | Done | Communication | Inherited from source requirement/status evidence |
| REQ-030 | Kommunikation | Mehrkanal-Nachrichten (optional) | Could | Backlog | Communication | Expanded in Backlog Acceptance Criteria |
| REQ-031 | Sponsoren & Lieferanten | Sponsorenverwaltung | Must | Done | Sponsors and Suppliers | Inherited from source requirement/status evidence |
| REQ-032 | Sponsoren & Lieferanten | Lieferantenverwaltung | Must | Done | Sponsors and Suppliers | Inherited from source requirement/status evidence |
| REQ-033 | Sponsoren & Lieferanten | Vertrags- & Dokumentenverknuepfung | Should | Done | Sponsors and Suppliers | Inherited from source requirement/status evidence |
| REQ-034 | Dokumente | Dokumentenverwaltung | Must | Done | Documents | Inherited from source requirement/status evidence |
| REQ-035 | Dokumente | Dokumentrechte & Freigabe | Should | Done | Documents | Inherited from source requirement/status evidence |
| REQ-036 | Dokumente | Versionierung | Should | Done | Documents | Inherited from source requirement/status evidence |
| REQ-037 | Dokumente | Volltextsuche & Tags | Could | Done | Documents | Inherited from source requirement/status evidence |
| REQ-038 | Finanzen | Mini-Buchhaltung (Grundfunktionen) | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-039 | Finanzen | Rechnungsstellung | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-040 | Finanzen | Zahlungsverwaltung & Abgleich | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-041 | Finanzen | Bankimport (CSV) | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-042 | Finanzen | Mahnwesen | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-043 | Finanzen | Belegmanagement | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-044 | Finanzen | Budget & Kostenstellen | Could | Backlog | Finance and Accounting | Expanded in Backlog Acceptance Criteria |
| REQ-045 | Finanzen | Export fuer Steuer/Buchhaltung | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-046 | oeffentlicher Bereich | oeffentliche Eventseite | Must | Done | Public Website | Inherited from source requirement/status evidence |
| REQ-047 | oeffentlicher Bereich | News/Blog (optional) | Could | Done | Public Website | Inherited from source requirement/status evidence |
| REQ-048 | oeffentlicher Bereich | Sponsorenseite | Should | Done | Public Website | Inherited from source requirement/status evidence |
| REQ-049 | oeffentlicher Bereich | Kontaktformular + Spam-Schutz | Must | Done | Public Website | Inherited from source requirement/status evidence |
| REQ-050 | Reporting & Daten | Dashboards & KPIs | Must | Done | Reporting and Data | Inherited from source requirement/status evidence |
| REQ-051 | Reporting & Daten | Exports (CSV/Excel) | Must | Done | Reporting and Data | Inherited from source requirement/status evidence |
| REQ-052 | Reporting & Daten | Such- & Filterfunktionen | Must | Done | Reporting and Data | Inherited from source requirement/status evidence |
| REQ-053 | Betrieb & Qualitaet | Backup & Restore Konzept | Must | Done | Operations and Quality | Inherited from source requirement/status evidence |
| REQ-054 | Betrieb & Qualitaet | Logging & Monitoring | Should | Done | Operations and Quality | Inherited from source requirement/status evidence |
| REQ-055 | Betrieb & Qualitaet | Mehrsprachigkeit (DE/EN/HI optional) | Could | Backlog | Operations and Quality | Expanded in Backlog Acceptance Criteria |
| REQ-056 | Betrieb & Qualitaet | Barrierefreiheit (Basis) | Should | Backlog | Operations and Quality | Expanded in Backlog Acceptance Criteria |
| REQ-057 | Betrieb & Qualitaet | Datenaufbewahrung & Archivierung | Must | Done | Operations and Quality | Inherited from source requirement/status evidence |
| REQ-058 | Betrieb & Qualitaet | API/Webhooks (optional) | Could | Backlog | Operations and Quality | Expanded in Backlog Acceptance Criteria |
| REQ-059 | Betrieb & Qualitaet | Konfiguration & Systemeinstellungen | Must | Done | Operations and Quality | Inherited from source requirement/status evidence |
| REQ-060 | Finanzen | Finanz-Setup: Land/Profil, Waehrung, Geschaeftsjahr | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-061 | Finanzen | Beleg- und Finanzdokumente: Storage, Integritaet, Aufbewahrung | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-062 | Finanzen | VAT/MWST: Steuercodes, Netto/Brutto, Auswertung und Export | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-063 | Finanzen | Rechnungs-PDF mit Schweizer QR-Zahlteil | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-064 | Finanzen | EU-Rechnungs-Compliance: Pflichtfelder und Templates je Profil | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-065 | Finanzen | eInvoicing-Readiness (EN 16931/Peppol) als Erweiterungspunkt | Could | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-066 | Finanzen | Periodenabschluss & Locking (Jahresabschluss light) | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-067 | Finanzen | Freigabe-Workflow fuer Zahlungen/Spesen (Vier-Augen-Prinzip) | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-068 | Finanzen | Sparte/Projekt-Zuordnung fuer steuerliche und interne Auswertungen | Could | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-069 | Finanzen | Banking-Import Upgrade: ISO 20022 (camt) und SEPA-Referenzen | Could | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-070 | Finanzen | Revisionssicheres Archiv und Retention Enforcement | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-071 | Finanzen | Rechnungsnummern-Serien und unveraenderbare Nummernvergabe | Must | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-072 | Finanzen | eInvoicing Validierung und CIUS-Unterstuetzung je Profil | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-073 | Finanzen | ISO 20022 Zahlungsdatei Export (pain.001) fuer Auszahlungen | Could | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-074 | Finanzen | Accounting Mode im Finance Setup | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-075 | Finanzen | Kontenplan fuer Hauptbuch (Chart of Accounts) | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-076 | Finanzen | Journal Entry mit Soll und Haben Zeilen | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-077 | Finanzen | Posting Service fuer automatische Journal Entries | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-078 | Finanzen | Storno statt Edit fuer gepostete Journal Entries | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-079 | Finanzen | Periodensperre gilt auch fuer Hauptbuch | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-080 | Finanzen | Probe-Bilanz Bericht (Trial Balance) | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-081 | Finanzen | Bilanz und Erfolgsrechnung aus Hauptbuch | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-082 | Finanzen | Mapping UI fuer Kategorien und Konten und Steuercodes | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-083 | Finanzen | Verknuepfung Subledger zu Hauptbuch | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-084 | Finanzen | Backfill fuer bestehende Daten bei DoubleEntry-Aktivierung | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-085 | Finanzen | Tests fuer Posting und Balance Regeln | Should | Done | Finance and Accounting | Inherited from source requirement/status evidence |
| REQ-086 | Platform Configuration | Generic Positioning & White-Label Branding | Must | Done | Platform Configuration | Expanded in Platform Configuration Acceptance Criteria |
| REQ-087 | Platform Configuration | Module Configuration & Access Enforcement | Must | Done | Platform Configuration | Expanded in Platform Configuration Acceptance Criteria |
| REQ-088 | Operations and Deployment | Beta Deployment Readiness | Must | Backlog | Operations and Deployment | Expanded in Beta and Open Source Acceptance Criteria |
| REQ-089 | Operations and Deployment | Open Source License Surface | Must | Backlog | Operations and Deployment | Expanded in Beta and Open Source Acceptance Criteria |

## Acceptance Criteria for This PRD

- The PRD reflects the existing Brownfield project rather than inventing a greenfield scope.
- Requirement status is derived from `docs/10_requirements_status.md`.
- Remaining Backlog requirements are explicitly identified.
- Brownfield architecture constraints from the decision log and project context are preserved.
- Validation findings from `prd-validation-report.md` have been addressed with user journeys, measurable success criteria, backlog acceptance criteria, REQ-023 scope clarification, and full requirement traceability.
- The sole Warning from `prd-validation-report-2026-05-14.md` is closed: REQ-086 and REQ-087 now have a supporting Critical User Journey ("Admin Configures the Platform"); the carry-over Performance NFR measurability observation is closed with quantified targets.
- The PRD is repositioned as a generic, configurable white-label organization management platform, with single-organization positioning removed from the Executive Summary, Product Goals, Business Outcomes, Users and Stakeholders, and Scope.
- PRD-native requirements REQ-086 (Generic Positioning & White-Label Branding) and REQ-087 (Module Configuration & Access Enforcement) are defined, given acceptance criteria, and added to the traceability appendix.
- OD-1 is recorded: REQ-086 and REQ-087 are PRD-native and not added to the organization-specific requirements CSV.
- Sprint Change Proposal 2026-05-15 PRD-delta is merged: PRD-native requirements REQ-088 (Beta Deployment Readiness) and REQ-089 (Open Source License Surface) are defined with acceptance criteria; Product Principles 10 (Open Source by Default) and 11 (Deployment-Target Portability) are added; the Recommended Roadmap places Beta-on-Railway (E11–E20) as the active sprint focus and demotes E4–E8 to Deferred Backlog; the Out of Scope and Risks and Open Questions sections capture Beta-specific scope and risk decisions.
- OD-6 is recorded as open: `docs/10_requirements_status.md` is out of sync with the closed Epics E1, E2, E3, E9, and E10; the status doc remains the source of truth for CSV-sourced REQs and must be updated as a separate task before the per-REQ statuses for REQ-009, REQ-010, REQ-018, REQ-023, REQ-024, and REQ-025 can be flipped to Done in the traceability appendix.
- REQ-088 and REQ-089 trace to Product Principle 10 and Product Principle 11 (and to Business Outcome around portability and OSS transparency) rather than to a Critical User Journey, because Beta deployment and source-disclosure are maintainer-and-deployer operations rather than end-user journeys.
- The document is ready for `bmad-validate-prd` and follow-on architecture (`bmad-create-architecture` for ADR-009 through ADR-021) and epic/story (`bmad-create-epics-and-stories` for E11–E20) planning per Sprint Change Proposal 2026-05-15 §10.
