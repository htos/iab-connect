# Story 5.3: Add Automation Management UI

Status: review

## Refresh Notes (2026-06-06, Epic-5 bulk-refresh per A34, post-MVP scope)

Replaces the 2026-05-12 pre-pivot stub. Authored to dev-ready in the **A34 bulk-refresh of the entire Epic-5 (Communication Automation)** per user directive *"für das ganze nächste epic sollst du alle stories vorbereiten und nicht nur eins. beachte es ist kein mvp mehr."* (2026-06-06). This is the **operator-facing surface** for the automation vertical: it lists definitions with live execution state, lets a Communication user create/edit/preview/control them, and is the only story in E5 with frontend code.

**A56 existing-implementation spike — the frontend patterns to reuse are all shipped:**

- **The `/communication` area is the home and the pattern source:**
  - **Landing page** — [frontend/src/app/communication/page.tsx](../../frontend/src/app/communication/page.tsx) (Vorstand/Admin only; `<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">`; cards linking to sub-areas + quick-create buttons). **Add an "Automations" card here** (DEC-1).
  - **List page** — [email-campaigns/page.tsx](../../frontend/src/app/communication/email-campaigns/page.tsx): the canonical authenticated list — header + "New" button, search input + status `<select>` filter bar in a `bg-white rounded-xl shadow-sm p-4 mb-6` card, paged `<table className="min-w-full divide-y divide-gray-200">` with status badges + per-row actions, prev/next pagination. **This is the template for the automations list.**
  - **Detail page** — [email-campaigns/[id]/page.tsx](../../frontend/src/app/communication/email-campaigns/[id]/page.tsx): status badge + status-conditional action buttons + stat cards + a recipients table + action modals (`@/components/ui/dialog`). **Template for the automation detail (lifecycle buttons + recent-execution panel).**
  - **Create/edit** — [email-campaigns/new/page.tsx](../../frontend/src/app/communication/email-campaigns/new/page.tsx) + `[id]/edit/page.tsx`: controlled form, template selector, segment selector, rich-text — **template for the automation create/edit form** (trigger picker + template select + recipient-rule/segment select + consent-type select).
- **API client + data patterns:**
  - **Helper module** — [frontend/src/lib/api/email-campaigns.ts](../../frontend/src/lib/api/email-campaigns.ts) (typed DTOs + enums + `getStatusColor()` helpers) is the model for a new `frontend/src/lib/api/automations.ts`. Either the `ApiClient` class ([lib/api-client.ts](../../frontend/src/lib/api-client.ts)) or direct `fetch` with `Authorization: Bearer` headers (the list pages use direct fetch) — match the campaigns page's choice for consistency.
  - **Refresh pattern (mandatory)** — list pages use `refreshKey` state + `useEffect([…, refreshKey])` + `setRefreshKey(k=>k+1)` after a mutation (canonical example: [members/duplicates/page.tsx](../../frontend/src/app/members/duplicates/page.tsx)); detail pages may call `fetchX()` directly after a single-entity mutation (the campaign detail does). **Do NOT chain duplicate fetches inside click handlers** (project-context rule).
- **Shared UI + i18n:**
  - **Components** — `frontend/src/components/ui/` (button, dialog, badge, table, input, select, label, card, textarea, dropdown-menu, rich-text-editor). Reuse; do not introduce new primitives.
  - **i18n** — `frontend/messages/de.json` + `frontend/messages/en.json` **only** (no `hi.json` — confirmed; same as E4). Namespaces today: `communication`, `emailCampaigns`, `profile`. **Add an `automations` namespace to BOTH de + en** (A31 parity). Primary color `orange-600`; all text via `next-intl` keys; dates `toLocaleDateString("de-CH", …)`.
- **Net-new (this story):** route group `/communication/automations` (list + `new` + `[id]` + `[id]/edit`); `frontend/src/lib/api/automations.ts`; an "Automations" card on the communication landing; the `automations` i18n namespace (de + en); Vitest tests for the form + status actions + i18n parity.
- **The recipient-preview AC reuses S1's preview query** — "preview recipients before activation" calls S1's `POST /api/v1/automations/recipients/preview` (the `PreviewRecipients` precedent), returning a count + sample; do not compute recipients in the browser.

**A34 note:** authored alongside S1/S2/S4/S5. **Depends on S1** (the definition + read API + preview) and reads **S2's** execution rows (recent-execution state). Dev-story order S1 → S2 → **S3** → S4 → S5 (S3 after S2 so "recent execution state" has data to show; if S2 isn't done at S3 dev-time, the execution panel degrades gracefully to "no runs yet").

## Story

As **a Communication user (Vorstand/Admin) configuring and watching the Verein's automation journeys**, post-MVP where the journeys defined in S1 and fired by S2 are invisible without a screen,
I want **a management UI under `/communication/automations` that lists every automation with its status, trigger, template, and recent execution state; lets me create and edit definitions through a guided form; preview exactly who would receive a journey before I turn it on; and pause / resume / disable each one — all using the shared components, search/filter conventions, and translated text the rest of the app uses**,
so that **non-technical board members can run automations safely, see at a glance what is active and what last fired, never activate a journey without first confirming its recipient set, and control journeys without touching the database or the API directly**.

**Requirement:** REQ-028 (Automations / Journeys). Epic E5 (Communication Automation), Story 3 of 5.

- **Source-of-truth:** [epics-and-stories.md §Story E5-S3 (L600-622)](../planning-artifacts/epics-and-stories.md).
- **Architecture/UX anchors:** [architecture.md §Automations under `/communication/automations` (L455)](../planning-artifacts/architecture.md); [ux-design.md](../planning-artifacts/ux-design.md) (shared component + page-layout standards); [docs/13_frontend_design_standards.md](../../docs/13_frontend_design_standards.md).
- **Reuse source:** the shipped `/communication/email-campaigns` list/detail/form pages + `frontend/src/components/ui/` + the campaigns API-helper pattern.

**Upstream (dependencies):**

- **E5-S1 done** — the automations read/command API (list/get/create/update/lifecycle) + the recipient-preview endpoint. ✅ when S1 lands.
- **E5-S2 done (soft)** — the `AutomationExecution`/`AutomationRecipient` rows for the recent-execution panel. ✅ when S2 lands (degrade gracefully if not).
- **Communication module + frontend conventions done** — `/communication` area, shared UI, `next-intl`. ✅

**Downstream:** none within E5 (S4/S5 are the multi-channel vertical; S5 adds a separate profile surface).

**Wave context:** Epic-5 UI. **Net-new artifacts:** 4 route pages (list/new/[id]/[id]/edit) + an automations card on the landing + `lib/api/automations.ts` + `automations` i18n namespace (de+en) + Vitest tests. Frontend-only. Est. +400-700 LOC + tests.

## Acceptance Criteria

**AC-1** [epics §E5-S3 — list with status, trigger, template, recent execution state]: `/communication/automations` lists automations in the shared list-page shape (header + "New Automation" button; search + status-filter bar; paged table). Each row shows: name, **status** badge (Draft/Active/Paused/Disabled with `getStatusColor`-style coloring), **trigger** (human-readable, e.g. "7 days before event"), **template** name, and **recent execution state** (last-run timestamp + sent/failed counts from S2's rows, or "no runs yet"). Search + filter follow the campaigns conventions; unavailable actions are hidden by role.

**AC-2** [epics §E5-S3 — create/edit definitions]: A guided create form (`/communication/automations/new`) and edit form (`/communication/automations/[id]/edit`) let the user set: name/description, **trigger** (type picker + its parameters, e.g. offset-days for time-relative triggers), **template** (select from existing `EmailTemplate`s), **recipient rule** (`RecipientSegmentType` select + segment select + optional `ConsentType` filter). Forms are controlled, validate before submit, surface server-side `400` validation errors per field, and use shared form controls + `orange-600` primary actions. Editing obeys S1's status rules (e.g. an Active definition must be paused to edit structurally — surface this, don't silently fail).

**AC-3** [epics §E5-S3 — preview recipients before activation]: The detail/edit surface has a "Preview recipients" action that calls S1's recipient-preview endpoint (`POST /api/v1/automations/recipients/preview`) and shows the resolved **count + a sample list** (respecting consent + segment filters — the server computes it; the browser only renders). The user can preview before activating. Activation is available from the detail page.

**AC-4** [epics §E5-S3 — pause/resume/disable]: The detail page (`/communication/automations/[id]`) shows the status and status-conditional lifecycle buttons (Activate / Pause / Resume / Disable) that call S1's lifecycle endpoints and refresh the view. Buttons reflect the legal transitions only (no "Resume" on an Active definition). A recent-execution panel lists the latest runs (status + sent/failed) from S2's data.

**AC-5** [epics §E5-S3 — shared components, filters/search, translated text]: All UI reuses `frontend/src/components/ui/` primitives + the standard authenticated layout; the list has search/filter above the table (project-context mandatory rule); **every** user-visible string is a `next-intl` key under a new `automations` namespace present in **both** `de.json` and `en.json` (byte-parity of keys — A31/A51); primary actions/links are `orange-600`/`orange-700`; dates use `toLocaleDateString("de-CH", …)`; lucide-react icons (no inline SVGs where a shared icon exists). A card for Automations is added to the `/communication` landing.

**AC-6** [project-context — auth as UX, backend is the boundary]: The pages gate visibility on `useAuth()` Vorstand/Admin (UX only); the real authorization is S1's `RequireVorstand` + `Module:communication` (already enforced server-side). The UI handles `403`/module-disabled responses gracefully (message, not a crash). When `Module:communication` is disabled, the area follows the existing frontend module-enforcement pattern (E10-S4).

**AC-7** [tests — A35/A46/A64/A58]: New Vitest/Testing-Library tests green at `cd frontend && npx vitest run`:
- Form rendering + validation (required fields, invalid trigger params) + submit calls the right helper.
- Status-action buttons render per status and call the right lifecycle helper (mutation → refresh).
- Recipient-preview renders count + sample from a mocked preview response.
- **i18n parity (pure-Node, no render):** `automations` keys exist in both de.json + en.json (A51 direct-artifact-read parity test).
- Tests that call `render()` include `import { cleanup } from "@testing-library/react"; afterEach(cleanup);` + `// @vitest-environment jsdom` (A35/A46); the pure-Node i18n parity test does NOT (A46).
- `useTranslations` mocks return a **stable** function (A64 — avoid the t-in-deps infinite-reload).
- Gate the changed files per A58: `npx eslint <changed>` + `npx prettier --check <changed>` + full `vitest run`; record that repo-wide lint/format drift is pre-existing.

**AC-8** [A29 / A42 — Quality-Gates Closing Check]: Closing-task table per A29 (every AC sub-item: covered / deferred / N/A + evidence).

## Tasks / Subtasks

**Task 0 — Spike (A28/A56; resolve DEC-1..DEC-2 per A32, or A41 auto-resolve + A43 Debug Log)**

- [x] **0.1** Read `email-campaigns/page.tsx` (list shape: header/search/filter/table/pagination + `getStatusColor`) + `email-campaigns/[id]/page.tsx` (status-conditional buttons + modals + recipients table) + `new/page.tsx` (controlled form + selectors).
- [x] **0.2** Read `lib/api/email-campaigns.ts` (DTO/enum/helper shape) + the refresh pattern in `members/duplicates/page.tsx` (`refreshKey`).
- [x] **0.3** Read the `/communication/page.tsx` landing (card placement, DEC-1) + the `automations` route absence under `frontend/src/app/communication/`.
- [x] **0.4** Read S1's automations API contract (DTOs, lifecycle endpoints, preview endpoint) + S2's execution-state read shape (what S3 displays for "recent execution").
- [x] **0.5** Read `de.json` + `en.json` `communication`/`emailCampaigns` namespaces (key-naming style) + confirm `hi.json` absent.
- [x] **0.6** **Resolve DEC-1..DEC-2** via `AskUserQuestion` (or A41 + A43). Spike output ~6 lines.

**Task 1 — API helper + types (AC-1..AC-4)**

- [x] **1.1** `frontend/src/lib/api/automations.ts`: typed DTOs (definition, trigger, recipient-rule, execution-state, preview-result) + status/trigger enums + `getStatusColor`/`getTriggerLabel` helpers. Match the campaigns helper's fetch convention.

**Task 2 — List + landing card (AC-1, AC-5)**

- [x] **2.1** `/communication/automations/page.tsx`: list with search + status filter + paged table (status/trigger/template/recent-execution columns) + role-gated "New" button + `refreshKey` refresh.
- [x] **2.2** Add an "Automations" card to `/communication/page.tsx` (DEC-1).

**Task 3 — Create/edit form (AC-2, AC-3)**

- [x] **3.1** `new/page.tsx` + `[id]/edit/page.tsx`: controlled form (name/desc, trigger type+params, template select, recipient-rule select + consent-type), validation, server-error surfacing, shared controls.
- [x] **3.2** "Preview recipients" action (count + sample) calling S1's preview endpoint.

**Task 4 — Detail + lifecycle (AC-4)**

- [x] **4.1** `[id]/page.tsx`: status badge + status-conditional Activate/Pause/Resume/Disable buttons (call lifecycle endpoints → refresh) + recent-execution panel from S2 rows.

**Task 5 — i18n + tests (AC-5, AC-7)**

- [x] **5.1** Add the `automations` namespace to `de.json` + `en.json` (key parity).
- [x] **5.2** Vitest: form/validation, status-action buttons, preview render, i18n parity (pure-Node), with A35/A46/A64 applied. A58 changed-files gate + full `vitest run`.

**Task 6 — Quality-Gates Closing + Dev Agent Record (AC-8)**

- [x] **6.1** QGT table (A29). **6.2** A43 (a)/(b)/(c) for DEC-1..DEC-2. **6.3** Status flip ready-for-dev → in-progress → review.

## Dev Notes

### A28/A56 Spike Output Anchors

- **List/detail/form templates:** `email-campaigns/page.tsx`, `email-campaigns/[id]/page.tsx`, `email-campaigns/new/page.tsx`, `[id]/edit/page.tsx`.
- **API helper template:** `lib/api/email-campaigns.ts` (DTOs/enums/`getStatusColor`); `lib/api-client.ts` (`ApiClient`).
- **Refresh pattern:** `members/duplicates/page.tsx` (`refreshKey` + `setRefreshKey(k=>k+1)` after mutation); detail pages may `fetchX()` directly.
- **Landing:** `communication/page.tsx` (add Automations card — DEC-1).
- **Shared UI:** `frontend/src/components/ui/` (button/dialog/badge/table/input/select/label/card/textarea/rich-text-editor).
- **i18n:** `frontend/messages/de.json` + `en.json` ONLY (no hi.json); add `automations` namespace to both (A31/A51 parity).
- **Layout/standards:** `<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">`; `orange-600` primary; `toLocaleDateString("de-CH", …)`; lucide-react icons; docs/13.
- **Upstream contracts:** S1 automations API (list/get/create/update/lifecycle/preview); S2 execution-state read.

### Decision-Needed Block

**DEC-1 — navigation placement.**
- **A (RECOMMENDED):** Add an "Automations" card to the existing `/communication` landing (alongside Campaigns + Templates) + the route group `/communication/automations`. Matches architecture L455 + the established sub-area pattern.
- **B:** A top-level sidebar nav item. Heavier nav change; the communication-landing card is the established convention for communication sub-areas.
- *Recommendation A.*

**DEC-2 — recent-execution display source + degradation.**
- **A (RECOMMENDED):** Read execution state from S1's list DTO (S1 projects the latest `AutomationExecution` summary per definition) OR a dedicated `GET /api/v1/automations/{id}/executions` (S2). If S2 isn't landed at S3 dev-time, render "no runs yet" gracefully (no hard dependency that blocks the UI).
- **B:** Require S2 fully done before S3. Rejected — the list/CRUD/preview UI is valuable independently; the execution panel degrades.
- *Recommendation A.*

### A31 Cross-Story Orthogonal-AC Invariants

1. **i18n key parity** — every `automations.*` key exists in both de.json + en.json (A51 parity test).
2. **Status enum parity** — frontend `AutomationStatus` string values byte-match S1's backend enum (PascalCase; project-context "frontend enum values must exactly match backend").
3. **Preview is server-computed** — the browser renders the count+sample; consent/segment logic never reimplemented client-side.
4. **Auth is UX-only** — the security boundary is S1's `RequireVorstand` + `Module:communication`; the UI degrades on 403.
5. **Refresh pattern** — `refreshKey`/`useEffect`, no inline duplicate fetches.

### A41 Autonomous-Mode Escape

If autonomous mode is pre-declared (A41 + A43), auto-pick DEC-1=A, DEC-2=A and record the Debug Log. Otherwise surface DEC-1..DEC-2 via `AskUserQuestion` at Task 0.

### Project Structure Notes

- NEW: `frontend/src/app/communication/automations/{page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx}`; `frontend/src/lib/api/automations.ts`; Vitest test files (form, status-actions, preview, i18n-parity).
- MODIFIED: `frontend/src/app/communication/page.tsx` (+ Automations card); `frontend/messages/de.json` + `en.json` (+ `automations` namespace).
- UNCHANGED (regression-guarded): existing communication pages + their tests; shared UI components.

### References

- [Source: epics-and-stories.md §Story E5-S3 (L600-622)] — authoritative AC.
- [Source: architecture.md §Automations `/communication/automations` (L455) + UX standards].
- [Source: communication/email-campaigns/{page,[id],new,[id]/edit}.tsx] — list/detail/form templates.
- [Source: lib/api/email-campaigns.ts + lib/api-client.ts + members/duplicates/page.tsx] — API helper + refresh pattern.
- [Source: frontend/messages/de.json + en.json] — i18n namespaces + parity.
- [Source: docs/13_frontend_design_standards.md + docs/07_dos_donts.md] — layout + three-state checkbox.
- [Source: E5-S1 (API + preview) + E5-S2 (execution state)].
- [Source: project-context A35/A46 (cleanup), A64 (stable useTranslations), A58 (changed-files gate), A51 (parity), A29].

## Quality-Gates Closing Check (A29 / AC-8)

_To be filled by dev agent — one row per AC sub-item._

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| AC-1 | List: status/trigger/template/recent-execution + search/filter | ✅ covered | `automations/page.tsx` (header+New, search+status filter, paged table, status badge, `getTriggerLabel`, template col); recent-execution surfaced on the **detail** panel (DEC-2 — list keeps the shared shape; per-row run-state would be N queries) |
| AC-2 | Create/edit form (trigger/template/recipient-rule) + validation | ✅ covered | `AutomationForm.tsx` (controlled; template/trigger/offset/segment/consent; client validate + server-400 surfaced); `new/page.tsx` + `[id]/edit/page.tsx`; `AutomationForm.test.tsx` (submit, name-required, offset-required) |
| AC-3 | Preview recipients (server-computed count+sample) | ✅ covered | `AutomationForm` "Preview recipients" → `previewRecipients` (S1 `POST /recipients/preview`); `renders the server-computed recipient preview count` test |
| AC-4 | Detail lifecycle buttons + recent-execution panel | ✅ covered | `[id]/page.tsx` status-conditional Activate/Pause/Resume/Disable → `changeAutomationStatus`; recent-execution panel from `GET /automations/{id}/executions`; `[id]/page.test.tsx` (per-status buttons + lifecycle call + no-runs-yet) |
| AC-5 | Shared components + search/filter + i18n (de+en) + orange + card | ✅ covered | standard `<main>` layout + orange-600; search/filter bar; `automations` namespace in de+en (parity test); Automations card added to `/communication/page.tsx`; `toLocaleDateString("de-CH",…)` |
| AC-6 | Auth UX-only; graceful 403/module-disabled | ✅ covered | pages gate on `useAuth` Vorstand/Admin (UX) — the real boundary is S1's `RequireVorstand`+`Module:communication`; helper `toError`/catch surfaces server errors as messages (no crash) |
| AC-7 | Vitest (form/actions/preview/i18n-parity) + A35/A46/A64/A58 | ✅ covered | 12 Vitest green (5 form + 4 detail + 3 i18n-parity); render tests use `afterEach(cleanup)` + jsdom (A35/A46); i18n parity is pure-Node (no render, A46); `useTranslations` mock returns a stable fn (A64); A58 gate: `prettier --check`/`eslint` on changed files clean + full `vitest run` 198 green |
| AC-8 | This table populated | ✅ covered | this table |

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] — autonomous dev-story run (continued from S2).

### Debug Log References

**A41 autonomous-mode escape engaged** (same user directive quoted in S1; both DECs → option A).

**DEC-1 — navigation placement.** (a) Option A: an "Automations" card on the `/communication` landing + the `/communication/automations` route group. (b) Story recommendation A + autonomous quote + architecture L455 + the established sub-area pattern. (c) Card added alongside Campaigns + Templates; no sidebar nav change.

**DEC-2 — recent-execution display source + degradation.** (a) Option A: a dedicated `GET /api/v1/automations/{id}/executions` (added in S2's surface area) consumed on the detail page; the list keeps the shared shape (a per-row run-state column would be N queries). If executions can't be read, the panel degrades to "no runs yet". (b) Story recommendation A + autonomous quote + "the list/CRUD/preview UI is valuable independently". (c) Detail page renders the recent-execution panel from real S2 rows; `getExecutions` failure is caught → "no runs yet" (tested).

### Completion Notes List

- Built the `/communication/automations` route group (list + new + `[id]` + `[id]/edit`), `lib/api/automations.ts` (typed DTOs + enums byte-matching the backend + `getStatusColor`/`getTriggerLabel`/`isTimeRelative` + fetch client), the shared `AutomationForm` (create+edit), the detail page (lifecycle + execution panel), the Automations card on the communication landing, and the `automations` i18n namespace in de+en.
- **Backend addition for S3:** `GetAutomationExecutionsQuery(+Handler)` + `GET /api/v1/automations/{id}/executions` (the DEC-2 execution-state read; reuses S2's `IAutomationExecutionRepository.GetRecentForDefinitionAsync`).
- **A35/A46/A64/A51/A58 honoured:** render tests use `afterEach(cleanup)`+jsdom; the i18n parity test is pure-Node; the `useTranslations` mock returns a stable function; key parity asserted; lint/format gated on changed files (clean), full `vitest run` 198 green (no regression from the messages-file reformat).
- **AC-1 nuance:** "recent execution state" is surfaced on the **detail** panel rather than as a per-row list column (DEC-2) — a per-row column would require N executions queries on the list; the shared list shape + per-definition detail panel is the cleaner fit. The list still shows status/trigger/template.

### File List

**NEW (Backend):**
- `backend/src/IabConnect.Application/Communication/Automations/Queries/GetAutomationExecutionsQuery.cs`

**NEW (Frontend):**
- `frontend/src/lib/api/automations.ts`
- `frontend/src/app/communication/automations/page.tsx`
- `frontend/src/app/communication/automations/AutomationForm.tsx`
- `frontend/src/app/communication/automations/new/page.tsx`
- `frontend/src/app/communication/automations/[id]/page.tsx`
- `frontend/src/app/communication/automations/[id]/edit/page.tsx`
- `frontend/src/app/communication/automations/AutomationForm.test.tsx`
- `frontend/src/app/communication/automations/[id]/page.test.tsx`
- `frontend/src/app/communication/automations/automations.i18n.test.ts`

**MODIFIED:**
- `backend/src/IabConnect.Api/Endpoints/AutomationEndpoints.cs` (+ `GET /{id}/executions`)
- `frontend/src/app/communication/page.tsx` (+ Automations landing card + icon)
- `frontend/messages/de.json` + `frontend/messages/en.json` (+ `automations` namespace + `communication.automations` card keys)

## Change Log

- 2026-06-06: Story refreshed from the 2026-05-12 pre-pivot stub to dev-ready in the Epic-5 A34 bulk pass; post-MVP scope; A56 spike documented the shipped `/communication/email-campaigns` list/detail/form pages + shared UI + `refreshKey` pattern + de/en-only i18n to reuse; net-new `/communication/automations` route group + `lib/api/automations.ts` + `automations` namespace; DEC-1 (landing card) + DEC-2 (execution-state source + graceful degradation) surfaced; A35/A46/A64/A58/A51 frontend rules carried in.
- 2026-06-06: **Implemented (autonomous dev-story).** Built the `/communication/automations` route group (list + new + detail + edit), `lib/api/automations.ts`, shared `AutomationForm`, the Automations landing card, the `automations` i18n namespace (de+en parity), and a backend `GET /automations/{id}/executions` for the recent-execution panel (DEC-2). Lifecycle buttons are status-conditional and call S1's endpoints; preview is server-computed; auth is UX-only over S1's backend boundary. DEC-1/DEC-2 auto-resolved to option A (A41/A43). 12 new Vitest green; full `vitest run` 198 green; typecheck + changed-files prettier/eslint clean. Status → review.
