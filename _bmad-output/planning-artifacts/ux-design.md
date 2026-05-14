# IAB Connect UX Design Specification

Date: 2026-05-11
Last revised: 2026-05-14 — added Flow Specifications for the generic white-label pivot (Platform Branding Configuration, Module Configuration, Module Unavailable / Access Denied, Public View Disabled), plus Navigation Model and Permission rule updates. OD-5 resolved: minimal neutral page over login redirect (Sprint Change Proposal 2026-05-14, handoff step 3).
Project: IAB Connect
Document status: Draft UX artifact for future implementation
Output location: `_bmad-output/planning-artifacts/ux-design.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics-and-stories.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`
- `docs/13_frontend_design_standards.md`
- `docs/component-inventory-frontend.md`
- `docs/architecture-frontend.md`

## Purpose

This UX artifact fills the readiness gap identified in `implementation-readiness-report.md`: the project has frontend standards and shared components, but no dedicated UX planning artifact for the remaining Backlog flows.

The goal is not to redesign IAB Connect. The goal is to define enough route, layout, interaction, state, permission, and accessibility guidance that future `bmad-create-story` and implementation work can proceed consistently.

## UX Principles

1. Use the existing authenticated shell for staff/member workflows.
2. Use public layout only for public visitor flows.
3. Keep pages operational and scannable; this is an association admin system, not a marketing site.
4. Use existing shared UI primitives before creating custom components.
5. All user-visible text uses next-intl translation keys.
6. Backend authorization remains authoritative; hidden UI actions are only convenience.
7. Every list/table page includes search or filtering where the dataset can grow.
8. Critical actions need clear confirmation, error, loading, empty, and permission-denied states.
9. Accessibility is a baseline for every new or touched UI flow.

## Visual Foundation

Follow `docs/13_frontend_design_standards.md`.

Required defaults:

- Page background: `gray-50`.
- Surface/card background: `white`.
- Primary actions and links: `orange-600` / `orange-700`.
- Danger actions: `red-600`.
- Success status: `green-600`.
- Warning status: `yellow-600`.
- Main authenticated layout:

```tsx
<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
  <div className="max-w-7xl mx-auto">
    {/* Page content */}
  </div>
</main>
```

Use smaller `max-w-4xl` for forms and `max-w-5xl` for detail pages where appropriate.

## Component Strategy

Start with existing shared components:

- `components/navigation/MainLayout`
- `components/navigation/Header`
- `components/navigation/Sidebar`
- `components/navigation/LanguageSwitcher`
- `components/ui/alert`
- `components/ui/badge`
- `components/ui/button`
- `components/ui/card`
- `components/ui/checkbox`
- `components/ui/dialog`
- `components/ui/dropdown-menu`
- `components/ui/input`
- `components/ui/label`
- `components/ui/select`
- `components/ui/table`
- `components/ui/tabs`
- `components/ui/textarea`

Use route-local feature components first when a component is only used by one flow. Extract shared components only when the same pattern appears in multiple pages.

Use lucide-react icons where suitable. Icon-only controls need accessible names and visible focus states.

## Navigation Model

Recommended route placement:

| UX area | Route pattern | Notes |
| --- | --- | --- |
| Account security | `/profile/security` | User session visibility, provider links, own session revocation. |
| Admin user security | `/admin/users/[id]/security` | Admin MFA reset and user session revocation. |
| Member duplicates | `/members/duplicates` | Admin review queue for duplicate candidates. |
| Member duplicate warning | Existing member create/edit routes | Inline warning before save. |
| Event check-in | `/events/[id]/check-in` | Event-scoped roster, scanner, manual lookup, export. |
| Event volunteers | `/events/[id]/volunteers` or event detail tab | Role/task/shift management. |
| Event fee setup | Existing event create/edit routes or `/events/[id]/fees` | Fee category configuration. |
| Paid registration | Existing event registration pages | Fee display and payment/finance state. |
| Automations | `/communication/automations` | List, create/edit, execution monitoring. |
| Channel preferences | `/profile/communication` or profile settings section | User channel choices and consent-adjacent state. |
| Cost centers | `/finance/cost-centers` | Cost center list/detail/edit. |
| Budget reports | `/finance/reports/budget-vs-actual` | Filterable finance report. |
| Integrations | `/admin/integrations` | API clients and webhook subscriptions. |
| Webhook deliveries | `/admin/integrations/webhooks/[id]` | Delivery history and retry status. |
| Platform branding | `/admin/settings` (Branding tab) | Org identity, logo, colors, contact info, public-site settings. New tab on the existing route. |
| Module configuration | `/admin/settings` (Modules tab) | Enable/disable the 7 functional modules. New tab on the existing route. |
| Module unavailable | `/module-unavailable` | Authenticated-shell 403 state; the new `middleware.ts` rewrites disabled-module routes here. |
| Public view disabled | Minimal standalone page | `middleware.ts` rewrites `/public/*` and `/` here when the Public View module is off. |

Sidebar additions should remain role-aware:

- Security/account links belong under profile or admin.
- Event tools belong under Events.
- Automations belong under Communication.
- Cost centers and budget reports belong under Finance.
- API/webhooks belong under Admin.
- Module-gated nav items carry a `requiresModule` flag, filtered with the same mechanism as the existing `requiresDoubleEntry` flag — disabled modules are hidden. Dashboard, My Profile, and Admin are never gated.

## Cross-Flow States

Every new UI flow must define:

- Loading state.
- Empty state.
- Error state.
- Permission-denied state.
- Validation state.
- Dirty/unsaved state for forms.
- Success state after mutation.
- Audit-sensitive confirmation state for destructive or high-impact operations.

Use compact alerts and inline form messages rather than global explanatory text.

## Flow Specifications

### Account Security and MFA

Stories: E1-S1 through E1-S5
Requirements: REQ-006, REQ-009, REQ-010

Primary screens:

- `/profile/security`
- `/admin/users/[id]/security`

User goals:

- User can understand active sessions and connected providers.
- Admin can support MFA reset and session revocation.
- High-risk roles see clear MFA-required state.

Layout:

- Detail page container: `max-w-5xl`.
- Sections: MFA, Sessions, Connected Providers.
- Use card sections, not nested cards.

Key components:

- Security status badges.
- Session table/list.
- Provider connection rows.
- Confirmation dialogs for revocation/reset.

States:

- No active sessions found.
- Provider not configured.
- MFA required but not enrolled.
- MFA reset successful.
- Session revocation pending/success/failure.

Accessibility:

- Session revoke buttons need clear labels.
- Provider connect/disconnect actions need confirmation text.
- Status badges cannot rely on color alone.

### Member Duplicate Review

Stories: E2-S1 through E2-S4
Requirement: REQ-018

Primary screens:

- Inline duplicate warning on member create/edit.
- `/members/duplicates`
- Merge confirmation dialog or review page.

User goals:

- Admin can identify likely duplicate records.
- Admin can compare records before merging.
- Admin can avoid unsafe data loss.

Layout:

- Duplicate list: `max-w-7xl`.
- Merge review: `max-w-5xl`.
- Use side-by-side comparison on desktop and stacked sections on mobile.

Key components:

- Candidate group table.
- Compare panel with source and target records.
- Conflict summary.
- Merge confirmation dialog.
- Unsafe merge blocking alert.

States:

- No duplicate candidates.
- Exact match.
- Likely match.
- Unsafe merge blocked.
- Merge completed.

Accessibility:

- Comparison labels must be explicit: source record and target record.
- Merge action needs keyboard-accessible confirmation.

### Event Check-in

Stories: E3-S1, E3-S2
Requirement: REQ-023

Primary screen:

- `/events/[id]/check-in`

User goals:

- Event staff can scan attendee QR codes.
- Event staff can manually search attendees.
- Event manager can export an offline roster.

Layout:

- Event detail-width or full list layout depending on roster size.
- Top summary band: checked in, registered, waitlisted, no-show if available.
- Main content: scanner/manual search and roster.

Key components:

- Scanner panel.
- Manual search input.
- Roster table.
- Status badges.
- Export button.
- Duplicate scan alert.

States:

- Camera unavailable.
- Camera permission denied.
- Invalid QR code.
- Already checked in.
- Manual lookup no result.
- Offline export generated.

Accessibility:

- Scanner must not be the only path; manual lookup is required.
- Live result messages should be announced or clearly focused.
- Check-in buttons need attendee names in accessible labels.

### Volunteer Planning

Stories: E3-S3, E3-S4
Requirement: REQ-024

Primary screen:

- `/events/[id]/volunteers` or event detail Volunteers tab.

User goals:

- Event manager defines shifts and tasks.
- Members/volunteers can sign up where allowed.
- Event manager sees coverage gaps.

Layout:

- Event detail page with tabs or section.
- Use shift table grouped by role/time.
- Show unfilled roles prominently.

Key components:

- Shift list/table.
- Role/task form.
- Assignment controls.
- Export button.
- Reminder action.

States:

- No volunteer plan.
- Shift full.
- Sign-up closed.
- Reminder sent.
- Export ready.

Accessibility:

- Capacity and status cannot rely only on color.
- Time ranges must be readable and localized.

### Calendar Integration

Story: E3-S5
Requirement: REQ-025

Primary screens:

- Event detail action area.
- Public events page.
- Optional settings/info area for feed URLs.

User goals:

- Public visitor/member can download or subscribe to events.
- Event manager can trust private event visibility.

Layout:

- Small action group near event details.
- Feed copy action with success feedback.

Key components:

- Download `.ics` button.
- Copy feed URL button.
- Visibility notice for member-only/private events.

States:

- Public event export available.
- Member-only feed requires login.
- Private event has no public feed.

Accessibility:

- Copy button needs visible confirmation.
- Feed URL should be selectable/copyable.

### Event Fees and Paid Registration

Stories: E4-S1 through E4-S3
Requirement: REQ-022

Primary screens:

- Event fee setup in create/edit or `/events/[id]/fees`.
- Registration page fee selection/state.
- Participant/admin view payment state.

User goals:

- Event manager/Kassier configures fee categories.
- Member/public registrant understands cost before registering.
- Kassier can reconcile registration with finance state.

Layout:

- Fee setup: form container `max-w-4xl`.
- Registration: existing registration layout with fee summary.
- Admin participant list: payment status column/badge.

Key components:

- Fee category rows.
- Amount/currency fields.
- Registration fee summary.
- Payment status badges.
- Cancellation/refund status alerts.

States:

- Free event.
- Paid event.
- Payment pending.
- Paid/confirmed.
- Cancelled/refund pending.
- Finance record creation failed.

Accessibility:

- Money values must be text, not only badges.
- Fee selection requires labels and validation messages.

### Automation Journeys

Stories: E5-S1 through E5-S3
Requirement: REQ-028

Primary screen:

- `/communication/automations`

User goals:

- Communication user creates and monitors standard automation flows.
- User can preview recipients before activation.
- User can pause or disable risky flows.

Layout:

- List page `max-w-7xl`.
- Create/edit form `max-w-4xl`.
- Execution detail panel or page.

Key components:

- Automation table with status, trigger, template, recent execution.
- Trigger select.
- Recipient filter preview.
- Template selector.
- Pause/resume/disable controls.
- Execution history table.

States:

- No automations.
- Draft automation.
- Active automation.
- Paused automation.
- Failed execution.
- Empty recipient preview.

Accessibility:

- Status and trigger text must be explicit.
- Pause/resume actions need confirmation for active journeys.

### Multi-channel Preferences

Stories: E5-S4, E5-S5
Requirement: REQ-030

Primary screens:

- User profile communication settings.
- Admin/communication provider status where configured.

User goals:

- User chooses supported channels.
- Communication user understands whether SMS/WhatsApp is configured.

Layout:

- Profile section with checkboxes/toggles.
- Provider status as admin-only configuration summary.

Key components:

- Channel preference controls.
- Consent-related alerts.
- Provider unavailable notice.

States:

- Provider not configured.
- Consent missing.
- Channel disabled.
- Preference saved.

Accessibility:

- Do not use toggle color alone; include labels and current state text.

### Budgets and Cost Centers

Stories: E6-S1 through E6-S3
Requirement: REQ-044

Primary screens:

- `/finance/cost-centers`
- `/finance/cost-centers/[id]`
- `/finance/reports/budget-vs-actual`

User goals:

- Kassier creates cost centers and budgets.
- Vorstand/Kassier compares budget to actuals.

Layout:

- Cost center list `max-w-7xl`.
- Cost center form `max-w-4xl`.
- Report page with filters and table/chart-ready metrics.

Key components:

- Cost center table.
- Budget period form.
- Report filters.
- Variance badges.
- Export action.

States:

- No cost centers.
- Inactive cost center.
- Locked fiscal period.
- No report data.
- Export generated.

Accessibility:

- Variance must include numeric text and sign, not only red/green color.

### Accessibility Baseline

Stories: E7-S1, E7-S2
Requirement: REQ-056

Primary UX output:

- Checklist applied to touched pages.
- Shared component fixes where issues are found.

Checklist:

- Keyboard navigation works.
- Focus state is visible.
- Form controls have labels.
- Validation errors are associated with fields.
- Icon-only buttons have accessible names.
- Status badges do not rely on color alone.
- Text and controls meet basic contrast targets.
- Loading and error states are not keyboard traps.

Evidence:

- Story notes must include manual or automated accessibility checks.

### Multilingual Expansion

Stories: E7-S3, E7-S4
Requirement: REQ-055

Primary screens:

- Existing language switcher.
- Public content/event/blog management where content language is added.

User goals:

- User can switch available language.
- Hindi can be introduced incrementally.
- Content language is identifiable where needed.

Layout:

- Keep existing language switcher pattern.
- Content language field appears in content forms where product-approved.

States:

- Missing translation fallback.
- Default language content.
- Selected language unavailable.

Accessibility:

- Language names should be readable text.
- Do not rely on flag icons alone.

### API and Webhook Administration

Stories: E8-S1 through E8-S4
Requirement: REQ-058

Primary screens:

- `/admin/integrations`
- `/admin/integrations/api-clients/[id]`
- `/admin/integrations/webhooks/[id]`

User goals:

- Admin/IT creates scoped API credentials.
- Admin/IT configures webhook subscriptions.
- Admin/IT diagnoses delivery failures.

Layout:

- Admin list page `max-w-7xl`.
- Detail/edit pages `max-w-5xl`.
- Delivery history table.

Key components:

- API client table.
- Scope checklist.
- One-time secret display alert.
- Webhook event selector.
- Signing secret display/rotation action.
- Delivery history table.
- Retry/disable actions.

States:

- No integrations.
- Secret shown once.
- Secret copied.
- Webhook disabled.
- Delivery failed.
- Retry scheduled.
- Rate limited.

Accessibility:

- One-time secret warning must be text and not dismiss accidentally.
- Copy buttons need accessible names and success feedback.
- Delivery status must include text and timestamp.

### Platform Branding Configuration

Stories: E9-S1 (branding admin UI), E9-S2 / E9-S3 / E9-S4 (de-branding sweep — frontend, backend, i18n)
Requirement: REQ-086

Primary screen:

- `/admin/settings` — new **Branding** tab alongside the existing `general` and `customRoles` tabs.

User goals:

- Admin configures organization identity: name, logo, colors, description, contact information, and public-page settings.
- Admin sees a live preview before saving.
- No user-visible surface hardcodes a specific organization.

Layout:

- Page stays `max-w-5xl` with the existing tab-bar pattern (`border-b-2` active tab, `orange-600`).
- Branding tab content is a single `rounded-xl bg-white p-6 shadow-sm` card with `space-y-6` sections — the same shell as the current `general` tab.
- The current `general` tab fields (application name, logo text, two color pickers, logo preview) move into or merge with the Branding tab. Extended fields are added below: description, contact email / phone / address, primary color, public-site-enabled toggle, logo asset upload.

Key components:

- Existing: text inputs, `type=color` plus hex-text pairs, the logo preview box (round avatar plus name).
- New: logo asset upload control (no shared file-upload component exists — a styled native file input or a new small component), a description textarea, a contact-info field group, a `publicSiteEnabled` toggle.
- Settings message banner (success / error) — existing pattern.
- Save button (`orange-600`); `refreshAppSettings()` on success — existing pattern.

States:

- Loading (spinner — existing).
- Save success / save error (existing banner).
- Logo upload: uploading, upload failed, invalid file type or size.
- Unsaved changes (dirty form).
- Live preview reflects unsaved form values.

Accessibility:

- Color pickers keep their hex text inputs as the accessible alternative (already present).
- The logo upload control needs a label and accessible name; show the file name after selection.
- The preview is decorative — keep the explicit success banner; do not let the preview be the only confirmation.

i18n:

- All labels, hints, the public-site toggle states, and upload messages use next-intl keys. The Branding tab is itself part of de-branding — its default and example values must not hardcode "IAB".

### Module Configuration

Stories: E10-S2
Requirement: REQ-087

Primary screen:

- `/admin/settings` — new **Modules** tab.

User goals:

- Admin enables or disables the 7 functional modules: Members, Events, Documents, Communication, Finance, Partners, Public View.
- Admin understands what each module covers and what disabling it affects.
- Admin is warned about cross-module dependencies before disabling.

Layout:

- Same `max-w-5xl` page, same tab bar, a single `rounded-xl bg-white p-6 shadow-sm` card.
- Toggle list: one row per module — module name, short description, enable/disable control, last-changed metadata (`updated_at` / `updated_by`).

Key components:

- Module row: label plus description text plus a toggle control (a labelled control, not color-only).
- Dependency warning alert — for example, disabling Finance while Events is enabled and paid registration is in use.
- Save plus confirmation: a confirmation dialog (`dialog` / `alert-dialog`) before applying a change that disables a module.
- Settings message banner (success / error) — existing pattern.

States:

- All modules enabled (default seed state).
- Module disabled.
- Dependency conflict warning shown.
- Confirmation pending.
- Save success / error.
- Self-lockout guard: Admin and the Modules tab itself are never gated — the UI must make clear these cannot be disabled.

Accessibility:

- Toggles need explicit on/off text labels, not color alone.
- Dependency warnings are text, associated with the relevant module row.
- The confirmation dialog is keyboard-accessible.

i18n:

- Module names, descriptions, dependency-warning text, toggle states, and confirmation copy all use next-intl keys.

### Module Unavailable and Access Denied

Stories: E10-S3 (backend 403), E10-S4 (frontend route guard plus page)
Requirement: REQ-087

Context:

- The backend is the security boundary: a disabled module's endpoints return 403 (architecture ADR-008).
- A new Next.js `middleware.ts` (none exists today) guards direct-URL navigation to disabled-module routes.

Primary screen:

- New `/module-unavailable` page, rendered inside the authenticated shell. `middleware.ts` rewrites disabled-module routes to it.

User goals:

- An authenticated user who reaches a disabled-module route understands why and how to proceed, without seeing a broken page or a raw 403.

Layout:

- Authenticated shell (`MainLayout` plus sidebar), `max-w-4xl` centered content card.
- Clear heading ("This module is not available"), short explanatory text, a primary action back to the dashboard.

Key components:

- An informative lucide icon (not alarming).
- Explanatory text.
- "Back to dashboard" button (`orange-600`).
- Optional hint to contact an admin.

States:

- Module disabled (primary state).
- API 403 surfaced mid-page (a module is disabled while the user is active): show an inline alert and route to this page on next navigation; do not hard-crash.

Behavior decision:

- Direct navigation to a disabled-module route → `middleware.ts` rewrites to `/module-unavailable` (keeps the URL meaningful and avoids a confusing silent redirect).
- The sidebar already hides the entry (enforcement layer 3), so this page is reached mainly via bookmarks, deep links, or a module disabled mid-session.

Accessibility:

- The page is not a keyboard trap; the primary action is focusable on load.
- Status is conveyed in text, not by icon or color alone.

i18n:

- Heading, body, button, and the mid-session 403 alert use next-intl keys.

### Public View Disabled

Stories: E10-S5
Requirements: REQ-086, REQ-087

Context:

- When the Public View module is disabled, the public website (`/public/*` and the public landing `/`) is not served. OD-5 is resolved in favour of a minimal neutral page over a login redirect.

Primary screen:

- New minimal "site not public" page. `middleware.ts` rewrites public routes to it when the Public View module is disabled.

User goals:

- An anonymous visitor understands the public site is unavailable — without being pushed into a login flow they may have no account for, and without any organization data being exposed.

Layout:

- A standalone minimal layout — not the authenticated shell, not the full public header/footer.
- Centered: organization logo plus name (from `SystemSettings`, via the still-reachable `GET /api/v1/settings/public`), and one short neutral sentence.
- A discreet link to the login page for members and staff (a link, not a forced redirect).

Key components:

- A branded logo-plus-name block (reuses the logo preview pattern — round avatar plus name).
- Neutral message text.
- A quiet "Member login" link.

States:

- Public View disabled (primary state).
- Settings load failure: if `GET /api/v1/settings/public` itself fails, fall back to a plain unbranded message — the page must never error out.

Behavior decision (OD-5 resolved):

- A minimal neutral page, not a login redirect — a redirect to `/login` would read as a defect to anonymous visitors and would conflate "module off" with "auth required".
- `GET /api/v1/settings/public` must remain reachable even when Public View is disabled (architecture ADR-008), so this page can render branding.

Accessibility:

- A single clear heading, readable body text, and a keyboard-focusable login link.
- No reliance on imagery to convey the message.

i18n:

- The neutral message and the login link use next-intl keys; logo and name come from settings, not hardcoded text.

## Responsive Behavior

Required behavior:

- Forms stack vertically on mobile.
- Tables with many columns need responsive alternatives: horizontal scroll, column reduction, or cards.
- Event check-in scanner/manual lookup must work on mobile first.
- Admin integrations and finance reports can prioritize desktop density but must remain usable on tablet/mobile.
- Dialogs must be scrollable and keyboard accessible on small screens.

## Permission and Visibility Rules

UI must hide unavailable actions but never assume hiding is security.

Required permission states:

- User lacks permission: show a concise permission-denied state or omit section if not relevant.
- Mixed permission page: visible read-only information with disabled/hidden actions.
- Admin-only action: confirmation dialog and backend enforcement.
- Finance-sensitive action: additional caution copy and audit awareness.
- Module disabled: the navigation entry is hidden, direct-URL navigation is rewritten to `/module-unavailable` (or the minimal neutral page for Public View), and the backend returns 403. Hiding and rewriting are UX only; the backend 403 is the control.

## i18n Requirements

All new flows require message keys for:

- Page titles and subtitles.
- Field labels.
- Helper text.
- Empty states.
- Error states.
- Success states.
- Confirmation dialogs.
- Button labels.
- Status labels.

Do not add hardcoded German or English UI text in components.

## Future Story UX Checklist

Each `bmad-create-story` output for UI work should include:

- Route or component location.
- Primary user and permission model.
- Layout width and page pattern.
- Required states: loading, empty, error, permission denied, validation, success.
- Accessibility checks.
- Translation key groups.
- Shared components to reuse.
- Manual validation path.

## Readiness Impact

This artifact upgrades UX readiness from Partial to Present for planning purposes.

Remaining condition:

- Complex UI stories still need story-level UX state details after inspecting the actual route/component code, but they no longer start from a blank UX baseline.

