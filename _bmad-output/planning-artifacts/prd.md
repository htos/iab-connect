# IAB Connect Product Requirements Document

Date: 2026-05-11
Project: IAB Connect
Document status: Edited after PRD validation
Output location: `_bmad-output/planning-artifacts/prd.md`
Primary sources:

- `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`
- `docs/10_requirements_status.md`
- `docs/project-overview.md`
- `docs/index.md`
- `docs/09_decisions_log.md`
- `_bmad-output/project-context.md`

## Executive Summary

IAB Connect is a web platform for the Indian Association Bern. It supports association operations across identity and access, member management, events, communication, sponsors and suppliers, document management, finance and accounting, public website features, reporting, privacy, audit, backups, and operations.

The product is already a substantial Brownfield application rather than an unstarted MVP. The current requirements corpus contains 85 tracked requirements, with 71 marked Done and 14 still in Backlog as of 2026-05-11. The PRD therefore defines the target product and the remaining product gaps while preserving the implemented architecture and delivery constraints.

The product goal is to give association administrators, board members, treasurers, event managers, and members a single secure system for daily association work, replacing spreadsheet-driven and manually coordinated workflows with auditable, role-aware, multilingual web workflows.

## Product Goals

1. Provide a secure, role-aware operational platform for association administration.
2. Centralize member, event, communication, document, finance, and public website workflows.
3. Support Swiss/EU privacy, audit, retention, and finance compliance needs.
4. Reduce manual coordination work for board members and volunteers.
5. Preserve a maintainable modular monolith architecture that can evolve without premature service decomposition.

## Business Outcomes

1. Association staff and volunteers can run core operations without parallel spreadsheet or email-only tracking for supported workflows.
2. Board members and treasurers have auditable evidence for membership, finance, privacy, document, and event decisions.
3. Members get a self-service experience for profile updates, communication preferences, documents, and event participation.
4. Event managers can plan, publish, fill, communicate, and reconcile event participation from one system.
5. The product remains feasible for a volunteer-led organization by keeping operations self-hosted, modular, and maintainable.

## Users and Stakeholders

### Primary Users

- Admin: full system administration, users, roles, audit, operations.
- Vorstand / board member: member oversight, events, communication, reporting.
- Kassier / treasurer: finance, invoices, payments, receipts, accounting, reporting.
- Event manager: event creation, publication, registrations, waitlists, participants.
- Member: login, profile self-service, event registration, documents and communications.

### Secondary Users

- Public visitor: reads public content, events, sponsors, blog, and contact forms.
- Sponsor or supplier contact: appears in sponsor/supplier management workflows.
- Auditor or compliance reviewer: consumes exports, logs, finance reports, audit evidence.

## Critical User Journeys

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

## Scope

### In Scope

- Authenticated admin and member portal workflows.
- Public website pages required for association communication.
- Member, event, communication, sponsor, supplier, document, finance, privacy, audit, search, backup, and reporting modules.
- Backend policy-based authorization as the security boundary.
- Frontend role-aware navigation and action visibility as a UX aid.
- Local development infrastructure through Docker Compose.
- Swiss/EU-relevant privacy, retention, audit, and finance behavior.

### Out of Scope

- Premature microservice decomposition.
- Native mobile applications.
- Non-Keycloak identity authority as the primary account source.
- Hard deletion of finance and other compliance-sensitive records where retention is required.
- Replacing the existing requirements CSV as the source of requirement content.
- Replacing the modular monolith with a distributed architecture for MVP work.

## Product Principles

1. Backend authorization is mandatory for every protected operation; frontend role checks are only visibility controls.
2. Sensitive workflows must preserve audit, privacy, retention, and finance compliance behavior.
3. Requirements content is sourced from `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`; implementation status is sourced from `docs/10_requirements_status.md`.
4. Executable files and code win over older prose when exact stack versions or behavior disagree.
5. MVP and follow-on delivery should extend the modular monolith rather than introduce separate deployables.
6. User-facing frontend text must use next-intl translation keys.
7. Authenticated UI must follow the existing page layout, shared components, orange primary actions, and searchable/filterable list patterns.

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
- Add budgets and cost centers if the association needs planning and cost allocation beyond the current accounting reports. Backlog: REQ-044.

### Public Website

- Support public association content, public events, sponsors, blog/news, and contact flows. Existing: REQ-046 through REQ-049.

### Reporting and Data

- Support dashboard, exports, reporting, global search, and data visibility appropriate to roles and permissions. Existing: REQ-050 through REQ-052.

### Operations and Quality

- Support backups, restore, health checks, logging, audit, retention, and operational monitoring. Existing: REQ-053, REQ-054, REQ-057, REQ-059.
- Add or complete multilingual coverage for DE/EN/HI as product scope requires. Backlog: REQ-055.
- Add a basic accessibility baseline. Backlog: REQ-056.
- Add optional public or partner APIs/webhooks. Backlog: REQ-058.

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

## Non-Functional Requirements

### Security

- All protected backend endpoints must enforce authorization policies or permissions.
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

- List pages should support pagination, search, and filtering.
- Backend queries should use EF Core patterns suitable for PostgreSQL and avoid loading excessive object graphs.
- Frontend mutation flows should refresh data through established refresh-trigger patterns rather than duplicate inline fetch chains.

### Maintainability

- Backend must keep Application, Domain, Infrastructure, and API boundaries clear.
- Business workflows should use MediatR commands/queries and FluentValidation where behavior goes beyond simple reads.
- Frontend should reuse shared layout, UI components, API helpers, and i18n messages.
- New package versions must follow the repository's central package/version conventions.

### Accessibility and Localization

- User-visible frontend text must use translation keys.
- Existing DE/EN behavior should be preserved.
- Basic accessibility should become an explicit acceptance baseline for new UI and when touching existing high-traffic workflows.

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

## MVP Definition

The historical MVP decision defines Must-have requirements from the CSV as the delivery baseline. As of 2026-05-11, all remaining Backlog requirements are Should or Could priority. Therefore the current product appears to have reached the Must-have MVP baseline, subject to validation of the implementation against acceptance criteria and tests.

MVP is considered releasable when:

1. All Must-have requirements are Done or explicitly accepted as deferred.
2. Backend test suite passes with `dotnet test`.
3. Frontend typecheck, lint, and relevant tests pass.
4. Key user workflows have manual or automated validation evidence.
5. Deployment, backup/restore, identity, and seed/setup instructions are current.
6. Known security, privacy, audit, and finance compliance regressions are resolved.

## Recommended Roadmap

### Release Readiness

- Validate the 71 Done requirements against code and tests.
- Confirm whether any Done notes contain known limitations that affect release, especially audit login tracking and event QR check-in.
- Run backend and frontend quality gates.
- Validate local infrastructure startup and documented login/setup flows.

### Should-Have Completion

- REQ-006 Social / Enterprise Logins.
- REQ-009 Multi-factor Authentication.
- REQ-010 Session and Device Management.
- REQ-018 Duplicate Detection.
- REQ-022 Event Ticketing / Fees.
- REQ-024 Volunteer Planning and Tasks.
- REQ-028 Automations / Journeys.
- REQ-056 Basic Accessibility.

### Could-Have Enhancements

- REQ-023 On-site QR Check-in improvements if not already production-ready.
- REQ-025 Calendar Integration.
- REQ-030 Multi-channel Messages.
- REQ-044 Budgets and Cost Centers.
- REQ-055 DE/EN/HI multilingual expansion.
- REQ-058 APIs and Webhooks.

## Risks and Open Questions

- Some generated documentation may lag behind executable code; code and project files must be verified before implementation planning.
- `docs/01_requirements.md` may contain stale embedded status text for some requirements; `docs/10_requirements_status.md` is the status source of truth.
- Audit login tracking is noted as not fully reliable in REQ-011 and should be triaged before release if login audit evidence is required.
- QR check-in appears in implemented event registration notes, while REQ-023 remains Backlog; this PRD treats REQ-023 as the complete event-day check-in workflow until product owners change the requirement status.
- The project uses German source requirements and English BMAD planning artifacts; wording should be reviewed by a stakeholder before final approval.

## Requirement Traceability Appendix

Status source: `docs/10_requirements_status.md`.
Requirement content source: `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`.

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

## Acceptance Criteria for This PRD

- The PRD reflects the existing Brownfield project rather than inventing a greenfield scope.
- Requirement status is derived from `docs/10_requirements_status.md`.
- Remaining Backlog requirements are explicitly identified.
- Brownfield architecture constraints from the decision log and project context are preserved.
- Validation findings from `prd-validation-report.md` have been addressed with user journeys, measurable success criteria, backlog acceptance criteria, REQ-023 scope clarification, and full requirement traceability.
- The document is ready for `bmad-validate-prd` and follow-on architecture or epic/story planning.
