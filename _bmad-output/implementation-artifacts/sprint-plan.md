# IAB Connect Multi-Epic Implementation Plan

Date: 2026-05-12
Status: Planned
Planning source:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design.md`
- `_bmad-output/planning-artifacts/epics-and-stories.md`
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-12.md`

## Planning Goal

Plan implementation iteratively across all remaining Backlog scope. This replaces the previous E1-only sprint plan.

The current planning scope is:

- 8 epics
- 33 stories
- 14 open Backlog requirements
- 8 optional epic retrospectives

Each story must go through `bmad-create-story` and story validation before development. The epics-and-stories artifact is planning input, not direct coding input.

## Readiness Summary

Implementation readiness status: READY WITH CONDITIONS.

Conditions:

- Convert story acceptance criteria into concrete testable scenarios during story creation.
- Scope large stories tightly before development.
- Keep provider-dependent stories later unless credentials, provider policy, signing policy, or event whitelist decisions are available.
- Include all UI states, permissions, i18n, accessibility checks, and manual validation evidence for UI-heavy stories.

## Iterative Delivery Waves

### Wave 1: Security Foundation

Goal: establish identity/session safety before sensitive admin, provider, and integration work.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E1-S1 | REQ-009 | Configure Role-Based MFA Policy | Keycloak config/evidence story; start here. |
| 2 | E1-S3 | REQ-010 | Add Session and Device Visibility | Inspect Keycloak session data limits. |
| 3 | E1-S4 | REQ-010 | Add Session Revocation | Should follow visibility. |
| 4 | E1-S2 | REQ-009 | Add Admin MFA Support Operations | Pull forward if console-only support is insufficient. |
| 5 | E1-S5 | REQ-006 | Add Social and Enterprise Identity Providers | Defer until provider credentials/scopes/account-linking decisions exist. |

### Wave 2: Member Data Quality

Goal: reduce duplicate member risk before broad communications and automations.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E2-S1 | REQ-018 | Add Duplicate Candidate Detection | Backend/Application rules first. |
| 2 | E2-S2 | REQ-018 | Show Duplicate Warnings in Member Create/Edit | UI warnings after detection query exists. |
| 3 | E2-S4 | REQ-018 | Add Duplicate Review UI | Can follow candidate grouping. |
| 4 | E2-S3 | REQ-018 | Implement Safe Member Merge | High-risk; scope carefully and add integration tests. |

### Wave 3: Event Operations

Goal: complete event-day operational capability before paid-event workflows.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E3-S1 | REQ-023 | Add Event Check-in Roster and Export | Enables offline fallback. |
| 2 | E3-S2 | REQ-023 | Add QR and Manual Check-in Flow | Must be idempotent and auditable. |
| 3 | E3-S3 | REQ-024 | Add Volunteer Planning Domain and API | Backend/domain slice. |
| 4 | E3-S4 | REQ-024 | Add Volunteer Planning UI and Reminders | UI plus optional reminder scheduling. |
| 5 | E3-S5 | REQ-025 | Add Calendar Feed and ICS Export | Can run after event visibility rules are confirmed. |

### Wave 4: Event Monetization

Goal: add paid registration using existing finance compliance patterns.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E4-S1 | REQ-022 | Add Event Fee Configuration | Event-side fee setup. |
| 2 | E4-S2 | REQ-022 | Connect Paid Registration to Finance | Highest risk in this wave; requires transaction/cancellation rules. |
| 3 | E4-S3 | REQ-022 | Add Paid Registration UI | Should follow API and finance link. |

### Wave 5: Communication Automation

Goal: add consent-aware automation, then optional channel expansion.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E5-S1 | REQ-028 | Add Automation Definition Model and API | Definitions and validation first. |
| 2 | E5-S2 | REQ-028 | Add Automation Execution Engine | Large story; define minimum trigger scope. |
| 3 | E5-S3 | REQ-028 | Add Automation Management UI | Uses prior backend execution/status state. |
| 4 | E5-S4 | REQ-030 | Add Multi-channel Messaging Abstraction | Defer provider specifics or use disabled/stub adapter. |
| 5 | E5-S5 | REQ-030 | Add User Channel Preferences | Requires channel availability and consent rules. |

### Wave 6: Finance Planning

Goal: add cost center and budget planning without weakening existing finance rules.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E6-S1 | REQ-044 | Add Cost Center and Budget Model | Finance domain/persistence first. |
| 2 | E6-S2 | REQ-044 | Associate Finance Records with Cost Centers | Must preserve locked-period and posted-entry rules. |
| 3 | E6-S3 | REQ-044 | Add Budget vs Actual Reports | Read model/reporting slice. |

### Wave 7: Quality Baseline

Goal: establish accessibility and localization foundations, then apply them to touched flows.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E7-S1 | REQ-056 | Define Accessibility Baseline and Audit Critical Pages | Should happen early enough to influence UI stories. |
| 2 | E7-S2 | REQ-056 | Improve Shared Component Accessibility | Shared UI leverage. |
| 3 | E7-S3 | REQ-055 | Add Hindi Translation Expansion Path | Message structure and fallback. |
| 4 | E7-S4 | REQ-055 | Add Content Language Metadata Where Needed | Only where product-approved content models need it. |

### Wave 8: External Integration Surface

Goal: add external API and webhook surfaces after authorization and signing decisions are clear.

| Order | Story | Requirement | Title | Notes |
| --- | --- | --- | --- | --- |
| 1 | E8-S1 | REQ-058 | Add API Credentials and Scopes | Token-safe storage and scopes first. |
| 2 | E8-S2 | REQ-058 | Add Read API Endpoints | Integration-safe DTOs and rate limits. |
| 3 | E8-S3 | REQ-058 | Add Webhook Subscriptions and Signing | Requires event whitelist/signing policy. |
| 4 | E8-S4 | REQ-058 | Add Webhook Delivery, Retry, and History | Large story; consider delivery engine before admin UI if needed. |

## Cross-Wave Rules

1. Do not start development directly from this plan. Create and validate each story first.
2. Each story output must include file-level code context, authorization, audit/privacy/finance impact, migration need, tests, and manual validation.
3. UI-heavy stories must include loading, empty, error, permission-denied, validation, success, i18n, and accessibility states.
4. Sensitive workflows require backend authorization tests or explicit manual validation evidence.
5. Provider-dependent stories remain backlog until the external configuration decisions are available.

## Next Action

Run `bmad-create-story` for `E1-S1 Configure Role-Based MFA Policy`, then validate it before development.
