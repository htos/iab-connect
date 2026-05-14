# Sprint Change Proposal — Generic Organization Platform & Module Configuration

Date: 2026-05-14
Project: iab-connect
Author: Correct Course workflow (Developer navigating change management)
Status: Draft — awaiting user approval
Output location: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`

Inputs analyzed:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/epics-and-stories.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- Codebase grounding scan (frontend `src/`, backend `src/`, `frontend/messages/`)

---

## Section 1: Issue Summary

### Problem statement

A stakeholder-driven **strategic pivot** has been requested: IAB Connect must be transformed from a single-organization application hardcoded to the *Indian Association Bern (Indischer Kulturverein Bern)* into a **generic, white-label organization management platform** usable by associations, clubs, communities, startups, and small SMEs.

Two distinct capability gaps drive the change:

1. **Hardcoded organization identity** — product naming, branding, and copy are baked into source code, i18n message files, email templates, and PDF/calendar generators rather than being configurable.
2. **No admin-controlled module visibility** — all functional modules (Members, Events, Documents, Communication, Finance, Partners, Public View) are always-on. An organization cannot choose which modules it uses, and there is no enforcement layer (navigation, routing, or backend) for disabled modules.

### Discovery context

The change was raised outside the normal story cycle. The active sprint (Epics 4–8, all `ready-for-dev`; next planned action `bmad-create-story` for E4.S1) is **not blocked** by this issue — but the issue conflicts with the PRD's core positioning and is not addressed by any existing epic.

### Evidence (codebase grounding scan)

| Area | Finding |
| --- | --- |
| **Existing branding foundation** | `IabConnect.Domain.Common.SystemSettings` is a **singleton entity** (REQ-059) with `ApplicationName`, `LogoText`, `LogoBackgroundColor`, `LogoTextColor` + `UpdateBranding()`. Exposed via `GET/PUT /api/v1/settings`, consumed by frontend `AppSettingsProvider`. → Strong, ready-made extension point. |
| **Admin Settings UI** | `frontend/src/app/admin/settings/page.tsx` already has a tab structure (`general` / `customRoles`). → "Branding" and "Modules" tabs dock cleanly here. |
| **Hardcoded navigation** | `frontend/src/components/navigation/Sidebar.tsx` holds a hardcoded `navItems[]` array, filtered only by `requiredRoles` and `requiresDoubleEntry`. The `requiresDoubleEntry` flag is an existing precedent for conditional navigation — module gating can follow the same pattern. |
| **Single-tenant architecture** | `SystemSettings` is explicitly a singleton ("only one row exists in the database"). The application is **single-organization**. → The stakeholder's proposed `organization_module_settings.organization_id` column is **not needed** and would add unwarranted complexity. |
| **Hardcoded IAB references — frontend** | ~23 occurrences across 13 files. Notable: `app/layout.tsx` (title + description "Indian Cultural Association Bern"), `PublicHeader.tsx` / `PublicFooter.tsx` (logo + name + "© Indischer Kulturverein Bern"), `app/page.tsx`, `app/login/page.tsx`, `app/admin/register/page.tsx` ("Indischer Kulturverein Bern"), `app/public/contact/page.tsx`, email campaign defaults `fromName: "IAB Connect"`. |
| **Hardcoded IAB references — backend** | ~19 occurrences across 11 files. Notable: `EventNotificationService.cs` (4× `<h1>IAB Connect</h1>` in email HTML), `DunningEmailService.cs`, `EventRegistrationPdfExporter.cs` ("IAB Connect – Anmeldeliste"), `SmtpSettings.cs` (`FromName = "IAB Connect"`), `DependencyInjection.cs` (Swagger title + "Indischen Kulturvereins Bern"), `CalendarFeedBuilder.cs` (`ProdId = "-//IAB Connect//Events//EN"`), `DevelopmentDataSeeder.cs`, `appsettings.Development.json` (`DefaultFromName`). |
| **Hardcoded IAB references — i18n** | ~19 occurrences in `frontend/messages/de.json` + `en.json`: `dashboardDescription`, `welcomeGuest` ("Webanwendung des Indischen Kulturvereins Bern"), public-site `description` / `copyright` / `subscribeDescription`, plus Bern-specific placeholder examples (`locationPlaceholder` "Gemeindesaal Bern", address placeholders). |
| **Assembly / namespace naming** | The entire backend uses the `IabConnect.*` namespace and assembly names. This is **internal-only** (not user-visible) and renaming is high-risk, churn-heavy, and delivers no functional value. Recommended **out of scope** for this initiative (see Section 4). |

---

## Section 2: Impact Analysis

### 2.1 Epic Impact Assessment

| Check | Finding |
| --- | --- |
| **Current epic (E4 Event Monetization)** | Can be completed as planned. Not blocked. No modification required. |
| **Required epic-level changes** | **Add two new epics.** No existing epic is modified, removed, or redefined. |
| **Remaining epics E4–E8 — ripple effects** | See table below. All effects are *coordination*, not *conflict*. |
| **Obsolete epics** | None. |
| **New epics needed** | Yes — **E9** (Generic Positioning & White-Label Branding) and **E10** (Module Configuration & Access Enforcement). |
| **Resequencing / priority** | **E10 should land before E8 (External Integration Surface)** so the external API route group is covered by module enforcement from day one. **E9 is independent** and can run in parallel with or after E4. Stakeholder priority for this initiative is assumed high — see open decision OD-3. |

#### Ripple effects on existing epics

| Epic | Status | Interaction with this change |
| --- | --- | --- |
| E1 Security & Identity | done | None. |
| E2 Member Data Quality | done | None. |
| E3 Event Operations | done | `CalendarFeedBuilder.cs` `ProdId` contains "IAB Connect" — E9-S3 makes it config-driven (forward-fix to a *done* epic; non-breaking, config default preserves behavior). |
| E4 Event Monetization | in-progress | **Cross-module dependency surfaced:** paid registration (E4) requires the Finance module. If Events is enabled but Finance is disabled, paid-event flows break. E10-S5 must define dependency handling. |
| E5 Communication Automation | in-progress | `EventNotificationService.cs` / `DunningEmailService.cs` hardcode `<h1>IAB Connect</h1>` in email HTML. E9-S3 generalizes these to `SystemSettings.ApplicationName`. Coordinate so E5 stories building on these services use the config value. |
| E6 Finance Planning | in-progress | None directly; Finance module toggle (E10) gates all `/finance/*` routes including E6 output. |
| E7 Accessibility & Localization | in-progress | E7-S3/S4 touch `de.json`/`en.json`; E9-S4 also edits branding strings in those files. Coordinate to avoid merge churn — recommend E9-S4 before E7 i18n stories, or explicit file-section ownership. |
| E8 External Integration Surface | in-progress | The module-enforcement filter (E10-S3) **must also apply to the external API route group**. Strong reason to sequence **E10 before E8**. |

### 2.2 Artifact Conflict Analysis

#### PRD (`prd.md`) — **CONFLICT, requires revision**

- Executive Summary states *"IAB Connect is a web platform for the Indian Association Bern."* — directly conflicts with the new generic positioning.
- Product Goals, Users & Stakeholders, and Critical User Journeys are framed around a single cultural association.
- No functional requirements exist for module configuration, module enforcement, or extended/white-label branding.
- PRD Product Principle #3 states requirement content is sourced from `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv` — the new requirements are not in that CSV (see open decision **OD-1**).
- **Action:** revise positioning sections; add new requirements **REQ-086** (Generic Positioning & White-Label Branding) and **REQ-087** (Module Configuration & Access Enforcement); update traceability appendix.

#### Architecture (`architecture.md`) — **GAP, requires new sections**

- No coverage of a module configuration system or enforcement layers.
- New decisions required:
  - **ADR-007: Module configuration as a single-tenant settings model** — dedicated `module_settings` table (not a multi-tenant `organization_id` model; the app is single-org). Extensible by inserting a row per module.
  - **ADR-008: Three-layer module enforcement** — backend endpoint filter/policy as the security boundary; Next.js middleware route guard for direct-URL protection; navigation filtering as UX.
  - Extended branding fields on `SystemSettings` (description, contact info, primary color, public-page settings, logo asset).
- Data Architecture: new "Module Configuration & Branding" area; authorization matrix gains a Module Enforcement row.

#### UX Design (`ux-design.md`) — **GAP, requires new sections**

- Admin Settings area: new **Branding** tab and **Modules** tab (toggle list with descriptions, save/confirm, dependency warnings).
- Navigation behavior: sidebar reflects enabled modules only.
- New **403 / "module unavailable"** state and safe-redirect behavior.
- Public-site behavior when **Public View** is disabled.

#### Secondary artifacts

| Artifact | Impact |
| --- | --- |
| `sprint-status.yaml` | Add `epic-9` and `epic-10` entries (status `backlog`) + their stories. |
| `epics-and-stories.md` | Append E9 and E10 with stories, ACs, traceability rows. |
| `project-context.md` | Uses "IAB Connect" as example values; PRD-CSV rule (#... "Requirements content comes from `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`") should be revisited. Update after implementation. |
| `docs/` folder | Multiple docs reference "Indischer Kulturverein"; the requirements CSV filename itself is org-specific. Documentation refresh is a follow-up (E9 documentation story or post-epic `bmad-document-project`). |
| `frontend/messages/de.json` / `en.json` | Branding strings + Bern-specific placeholders generalized (E9-S4). |
| OpenAPI/Swagger | Title + description generalized (E9-S3). |
| `DevelopmentDataSeeder.cs` | Seed data references "IAB"; generalize seed identity (E9-S3). |
| Tests | New backend tests for module-enforcement filter (403, audit); frontend tests for nav filtering + middleware redirect; integration tests for module settings persistence. |

### 2.3 Technical Impact

- **Database:** one new table `module_settings`; new nullable columns on `system_settings` for extended branding; two EF Core migrations.
- **Backend:** new `IModuleSettingsService` (cached), endpoint filter `RequireModule(moduleKey)`, module-settings MediatR queries/commands + endpoint group, audit events on denied access, extended `SystemSettings` branding. Apply the filter across Members/Events/Documents/Communication/Finance/Partners endpoint groups and the future external API group.
- **Frontend:** extend `AppSettings` DTO + `AppSettingsProvider` with `modules` map and extended branding; add `moduleKey` to `Sidebar` nav items + filter; add Next.js `middleware.ts` route guard with redirect/403; new 403 page; gate dashboard widgets sourced from disabled modules; Branding + Modules admin tabs.
- **Cross-cutting:** module-to-route and module-to-endpoint mapping table becomes a shared contract. Background jobs (Hangfire) belonging to disabled modules — define expected behavior (E10-S5).

---

## Section 3: Recommended Approach

### Path forward evaluation

| Option | Viable? | Effort | Risk | Notes |
| --- | --- | --- | --- | --- |
| **Option 1 — Direct Adjustment** (add epics/stories within existing structure) | ✅ Viable | High | Low–Medium | Existing `SystemSettings` + admin tabs + `requiresDoubleEntry` precedent make this a natural extension, not a rewrite. |
| **Option 2 — Rollback** | ❌ Not viable | — | — | Nothing to roll back. Epics 1–3 work does not *conflict*; hardcoded strings in done code are forward-fixed via configuration with behavior-preserving defaults. |
| **Option 3 — PRD MVP Review** | ⚠️ Partial | Medium | Low | The PRD's *positioning* must be revised, but MVP scope is **expanded, not reduced**. This is a PRD revision, not an MVP cut. |

### Selected approach: **Hybrid — Option 1 + PRD revision (Option 3-light)**

Add two new epics (E9, E10) within the existing modular-monolith structure **and** revise the PRD's positioning and requirements via `bmad-edit-prd`. No rollback, no MVP reduction.

**Rationale:**

- The codebase already provides the right seams (`SystemSettings` singleton, `/api/v1/settings`, `AppSettingsProvider`, tabbed admin settings, conditional-nav precedent). This is an extension, not a redesign.
- The modular monolith and Clean Architecture boundaries are preserved (ADR-001 holds).
- Keeping the app single-tenant (no `organization_id`) drastically reduces complexity and risk versus the stakeholder's draft data model.
- Active sprint momentum (E4–E8) is preserved — the new epics are additive and sequenced around E8.

### Change scope classification: **MAJOR**

Fundamental product-positioning change + a new cross-cutting enforcement architecture. Routes to **Product Manager / Architect** for re-planning before implementation (see Section 5).

---

## Section 4: Detailed Change Proposals

### 4.1 PRD changes (`prd.md`) — handoff to `bmad-edit-prd`

```
Section: Executive Summary
OLD:
  IAB Connect is a web platform for the Indian Association Bern. It supports
  association operations across identity and access, member management, ...
NEW:
  IAB Connect is a configurable, white-label organization management platform
  for associations, clubs, communities, startups, and small SMEs. Organization
  identity and branding are admin-configurable, and functional modules can be
  enabled or disabled per deployment. It supports operations across identity
  and access, member management, ...
Rationale: Removes hardcoded single-organization positioning (AC: "no hardcoded
  IAB / Indian association dependency remains").
```

```
Section: Functional Requirements — NEW subsection "Platform Configuration"
ADD:
  REQ-086 Generic Positioning & White-Label Branding
   - Organization name, logo, colors, description, and contact information are
     admin-configurable and persisted.
   - Public page settings (visibility, content) are admin-configurable.
   - No user-visible string hardcodes a specific organization; values come from
     SystemSettings or i18n keys.
  REQ-087 Module Configuration & Access Enforcement
   - Admin can enable/disable modules: Members, Events, Documents, Communication,
     Finance, Partners, Public View.
   - Disabled modules are hidden from navigation, blocked on direct URL, and
     enforced at the backend/API layer (403 or safe redirect).
   - Module settings persist; the system is extensible to new modules.
Rationale: Net-new capability not covered by REQ-001..REQ-085.
```

```
Section: Product Principles / Risks & Open Questions
ADD note on OD-1: requirement-source decision (CSV vs PRD-native) for REQ-086/087.
```

Also update: Product Goals, Users & Stakeholders (generalize "association" framing), Scope, and the Requirement Traceability Appendix.

### 4.2 Architecture changes (`architecture.md`) — handoff to `bmad-create-architecture`

**ADR-007: Module Configuration as a Single-Tenant Settings Model**

- Decision: persist module status in a dedicated `module_settings` table. The application is single-organization (`SystemSettings` singleton) — **no `organization_id` column**.
- Schema:

  ```
  module_settings
  - id                uuid       PK
  - module_key        text       UNIQUE NOT NULL   -- 'members','events','documents',
                                                    --   'communication','finance',
                                                    --   'partners','public_view'
  - enabled           boolean    NOT NULL DEFAULT true
  - updated_at        timestamptz NOT NULL
  - updated_by        text       NULL
  ```

- Seeded with the 7 known modules, all enabled (preserves current behavior). Extensible: a new module = a new seeded row + a new `moduleKey` constant.
- Rejected alternative: JSON column on `system_settings` — chosen against because a table gives per-module audit, indexing, and a clean extension point. (Final call is OD-2.)

**ADR-008: Three-Layer Module Enforcement**

- **Backend (security boundary):** an ASP.NET Core endpoint filter / authorization requirement `RequireModule(moduleKey)` applied to each module's Minimal API route group. Returns **403** when disabled; writes an audit/security event on denial. Backed by a cached `IModuleSettingsService` (cache invalidated on settings update).
- **Frontend route guard (direct-URL protection):** Next.js `middleware.ts` checks module status (from session/app settings) and redirects disabled-module routes to a safe page (dashboard) or renders a 403 page. UI hiding alone is explicitly *not* the control.
- **Navigation (UX):** `Sidebar` nav items gain a `moduleKey`; filtered alongside `requiredRoles` — same pattern as the existing `requiresDoubleEntry` flag.

**Extended branding on `SystemSettings`**

- New nullable columns: `description`, `contactEmail`, `contactPhone`, `contactAddress`, `primaryColor`, `publicSiteEnabled` (+ logo asset reference). New `UpdateBranding` overload / `UpdateOrganizationProfile` method. Behavior-preserving defaults.

**Module → route/endpoint mapping (shared contract)**

| Module | Frontend routes | Backend endpoint groups |
| --- | --- | --- |
| Members | `/members*` | `/api/v1/members*`, segments, duplicates |
| Events | `/events*` | `/api/v1/events*` |
| Documents | `/documents*`, `/board/documents`, `/admin/documents` | `/api/v1/documents*` |
| Communication | `/communication*` | `/api/v1/communication*`, email templates/campaigns |
| Finance | `/finance*` | `/api/v1/finance*` |
| Partners | `/sponsors*`, `/suppliers*` | `/api/v1/sponsors*`, `/api/v1/suppliers*` |
| Public View | `/public/*` | public website + public feed endpoints |

Always-on (never gated): Dashboard, My Profile, Admin.

### 4.3 UX changes (`ux-design.md`) — handoff to `bmad-create-ux-design` (or covered in stories)

- Admin Settings: **Branding** tab (org name, logo upload, colors, description, contact info, public-page settings, live preview — extends the existing logo-preview pattern) and **Modules** tab (toggle list, per-module description, dependency warnings, save + confirmation).
- Sidebar renders only enabled modules.
- New 403 / "module unavailable" page; safe-redirect UX.
- Public-site behavior when Public View is disabled.

### 4.4 New epics (`epics-and-stories.md`) — handoff to `bmad-create-epics-and-stories`

**Epic E9 — Generic Positioning & White-Label Branding** (REQ-086)

| Story | Summary |
| --- | --- |
| E9-S1 | Extend `SystemSettings` + branding admin UI (description, contact info, primary color, public-page settings, logo asset) + migration. |
| E9-S2 | Replace hardcoded IAB references in **frontend** (`layout.tsx` metadata, `PublicHeader`/`PublicFooter`, `login`, `page.tsx`, `admin/register`, `public/contact`, email-campaign `fromName` defaults) with config/i18n. |
| E9-S3 | Replace hardcoded IAB references in **backend** (`EventNotificationService`, `DunningEmailService`, `EventRegistrationPdfExporter`, `SmtpSettings.FromName`, Swagger title/description, `CalendarFeedBuilder.ProdId`, `DevelopmentDataSeeder`, `appsettings`) with `SystemSettings`/config. |
| E9-S4 | Generalize i18n branding strings in `de.json`/`en.json` (welcome/dashboard/copyright/subscribe text, Bern-specific placeholders). |

*Out of scope (documented deferral):* renaming the `IabConnect.*` namespace/assemblies — internal-only, high-churn, no functional value.

**Epic E10 — Module Configuration & Access Enforcement** (REQ-087)

| Story | Summary |
| --- | --- |
| E10-S1 | `module_settings` data model + EF migration + seed (7 modules, all enabled); `IModuleSettingsService` with caching. |
| E10-S2 | Module settings API (MediatR query/command + endpoint group, Admin-only) + **Modules** admin tab UI. |
| E10-S3 | Backend enforcement: `RequireModule` endpoint filter/policy across all module route groups; 403 + audit on denial; tests. |
| E10-S4 | Frontend enforcement: extend `AppSettings` DTO/provider with `modules`; `Sidebar` nav filtering; Next.js `middleware.ts` route guard + 403/redirect; gate dashboard widgets. |
| E10-S5 | Public View toggle + cross-module dependency handling (e.g. Events↔Finance for paid registration) + background-job behavior for disabled modules + end-to-end tests. |

### 4.5 `sprint-status.yaml` changes — applied at approval (checklist 6.4)

```
  epic-9: backlog
  e9-s1-extend-system-settings-and-branding-ui: backlog
  e9-s2-degeneralize-frontend-iab-references: backlog
  e9-s3-degeneralize-backend-iab-references: backlog
  e9-s4-generalize-i18n-branding-strings: backlog
  epic-9-retrospective: optional

  epic-10: backlog
  e10-s1-module-settings-model-and-service: backlog
  e10-s2-module-settings-api-and-admin-ui: backlog
  e10-s3-backend-module-enforcement: backlog
  e10-s4-frontend-module-enforcement: backlog
  e10-s5-public-view-and-cross-module-dependencies: backlog
  epic-10-retrospective: optional
```

---

## Section 5: Implementation Handoff

**Change scope: MAJOR** → fundamental re-planning before implementation.

| Step | Skill | Owner role | Deliverable |
| --- | --- | --- | --- |
| 1 | `bmad-edit-prd` | Product Manager | PRD revised: generic positioning, REQ-086, REQ-087, traceability. Resolve OD-1. |
| 2 | `bmad-create-architecture` | Architect | Architecture: ADR-007, ADR-008, extended branding, module→route/endpoint mapping. Resolve OD-2. |
| 3 | `bmad-create-ux-design` | UX Designer | Branding + Modules tabs, 403 state, public-site-disabled behavior. |
| 4 | `bmad-create-epics-and-stories` | PM / Architect | E9 + E10 appended with stories, ACs, traceability. |
| 5 | `bmad-check-implementation-readiness` | PM / Architect | Readiness report — PRD/Arch/UX/Epics aligned. |
| 6 | `bmad-sprint-planning` | PM | Updated sprint plan; sequence **E10 before E8**; place E9 around E4. |
| 7 | `bmad-create-story` → `bmad-dev-story` | Developer | Per-story implementation cycle. |
| 8 | `bmad-code-review` + `bmad-retrospective` | Developer | At each epic boundary (per the project's hybrid review workflow). |

Run each skill in a **fresh context window**.

### Success criteria (from stakeholder acceptance criteria)

- No hardcoded IAB / Indian-association dependency remains in user-visible surfaces (namespace excepted, documented).
- App usable by associations, clubs, communities, startups, small SMEs.
- Admin can enable/disable all 7 modules; settings persist.
- Disabled modules: hidden from nav, blocked on direct URL, enforced at backend/API (403 or safe redirect).
- Solution extensible to new modules (row + constant).
- Existing functionality unchanged when a module is enabled (behavior-preserving defaults).

---

## Open Decisions (need user/stakeholder input)

| ID | Decision | Recommendation |
| --- | --- | --- |
| **OD-1** | New requirements REQ-086/087: add rows to `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`, or treat as **PRD-native** requirements? | **PRD-native.** The CSV filename and content are themselves org-specific and being deprecated by this very initiative; forcing new generic requirements into it is contradictory. `bmad-edit-prd` should record this. |
| **OD-2** | Module storage: dedicated `module_settings` **table** vs JSON column on `system_settings`. | **Dedicated table** — per-module audit, indexing, clean extension point. |
| **OD-3** | ~~Priority of E9/E10 relative to in-flight E4–E8.~~ **RESOLVED 2026-05-14** | Epics 4–8 reset `in-progress → backlog`; **E9 + E10 preempt E4–E8** and are the active focus. Internal order: E9 (de-branding) → E10 (module config & enforcement); E10 stays before E8 when E4–E8 resume. Applied to `sprint-status.yaml`. |
| **OD-4** | Should `IabConnect.*` namespace/assembly rename be in scope? | **No** — out of scope, documented deferral. Internal-only, high-churn, zero functional value. |
| **OD-5** | When **Public View** is disabled, what should public routes do — redirect to login, or serve a minimal "site not public" page? | UX decision for `bmad-create-ux-design`; recommend a minimal neutral page over a login redirect. |

---

## Checklist Completion Record

| Section | Status |
| --- | --- |
| 1. Understand Trigger & Context | [x] Done — strategic pivot; evidence from codebase scan |
| 2. Epic Impact Assessment | [x] Done — add E9 + E10; E4–E8 coordination effects mapped |
| 3. Artifact Conflict & Impact Analysis | [x] Done — PRD conflict, Architecture/UX gaps, secondary artifacts |
| 4. Path Forward Evaluation | [x] Done — Hybrid (Option 1 + PRD revision); scope MAJOR |
| 5. Sprint Change Proposal Components | [x] Done |
| 6. Final Review & Handoff | [!] Action-needed — awaiting user approval (6.3), then `sprint-status.yaml` update (6.4) |
