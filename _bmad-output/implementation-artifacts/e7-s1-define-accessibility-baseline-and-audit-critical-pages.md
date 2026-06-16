# Story E7.S1: Define Accessibility Baseline and Audit Critical Pages

Status: done

## Story

As a product team,
I want an explicit, written accessibility baseline plus an audit of the critical pages from the PRD journeys,
so that new and touched pages meet a known WCAG 2.2 AA usability bar and the highest-impact gaps become a tracked work list.

## Acceptance Criteria

1. A written accessibility baseline checklist exists as a durable project doc and covers, at minimum: keyboard navigation, programmatic form labels, visible focus states, icon-only-control accessible names, color contrast (text + primary actions + status badges + alerts), validation-message association, and "status not by color alone". (REQ-056; `ux-design.md:532-541`; `prd.md:420-426`)
2. The critical pages derived from the 8 PRD user journeys (`prd.md:93-156`) are audited against the checklist in both desktop and mobile layouts; the audited page set is enumerated explicitly (not "all 94 pages").
3. Findings are tracked in a table keyed by page/flow and assigned a severity (High / Medium / Low) plus a status (fixed / deferred-to-E7-S2 / accepted).
4. High-impact issues that are cheap, local fixes on a touched/audited page are fixed in this story; systematic shared-component issues are explicitly deferred to E7-S2 with a one-line pointer per finding (E7-S2 consumes this audit as its work list).
5. Manual or automated accessibility evidence is recorded for each audited page (keyboard walk, axe/Lighthouse where run, or a `[!]` manual-verify marker where the check requires a live browser session the dev-agent cannot drive).

## Tasks / Subtasks

- [x] Task 0: Spike — confirm scope and existing artifacts (AC: 1, 2)
  - [x] Confirmed NO accessibility doc exists under `docs/` (only `01_requirements.md` + the CSV match the term, as requirement text). Confirmed next free doc number is `16` (`docs/15_multichannel_messaging.md` is the highest).
  - [x] Read `prd.md:420-426` (REQ-056 ACs) + `ux-design.md:522-546` (Accessibility Baseline checklist, 8 items incl. "loading/error not keyboard traps"). Used as source of truth for AC-1.
  - [x] Resolved Decision-Needed DEC-1 = Option A (see Debug Log).
- [x] Task 1: Author the accessibility baseline checklist doc (AC: 1)
  - [x] Created `docs/16_accessibility_audit_checklist.md` (2-digit prefix, `##` sections, LF, final newline).
  - [x] Section A "Baseline (WCAG 2.2 AA target)" enumerates the 8 `ux-design.md:532-541` items mapped to the REQ-056 ACs (`prd.md:420-426`), each with a "how to verify" note.
  - [x] Documented the three-state checkbox convention in `docs/16` AND added it to `docs/07_dos_donts.md` (was absent — A28/A30).
- [x] Task 2: Enumerate and audit the critical pages (AC: 2, 3, 5)
  - [x] Section B "Critical Pages Audit" enumerates 12 audited pages (route-reconciled: no `/privacy/*` route → audited within `/profile`; no `/public` landing page → `/public/events/[id]` as the public flow; dashboard entry = app root `page.tsx`). Each row: route, file, A3/A4/A5/A6 result, severity, status, evidence.
  - [x] Walked the static-detectable checklist per page with `file:line` anchors. Live-only checks (keyboard, runtime focus, contrast, keyboard-trap) marked `[!] manual-verify` in the Live-walkthrough queue (Q1–Q6) — not a false `[x]` (A47).
- [x] Task 3: Fix cheap local high-impact issues; defer the rest (AC: 4)
  - [x] Applied page-local fixes on audited pages: `aria-label` on members-list search/status/type filters (`members/page.tsx:273,281,295`, reusing existing keys); `aria-label` on events-list search/category/status filters (`events/page.tsx:278,288,309`); `aria-label`+`aria-pressed` on events grid/list view-toggle buttons (`events/page.tsx:324,332`, new `events.gridView`/`events.listView` keys in de+en). No hardcoded strings.
  - [x] Shared-component findings (Input aria/focus, Dialog close i18n, Select/Textarea/Checkbox association, budgets:511 close button) recorded in `docs/16` with status `deferred-to-E7-S2` + `file:line` pointers — the E7-S2 work list.
- [x] Task 4: Add an accessibility section to the design standards (AC: 1)
  - [x] Added "Accessibility" section to `docs/13_frontend_design_standards.md` (icon-only accessible-name pattern, design-system focus token, form label + `aria-describedby`/`aria-invalid`, status-not-by-color, keyboard/focus-trap), cross-linked to `docs/16`; added TOC entry + a11y row to the New-Pages checklist.
- [x] Task 5: Quality gates + reread-as-a-stranger pass (AC: all)
  - [x] A29 AC-Subitem Completion Check below (one row per page/finding, A54).
  - [x] A42 reread-as-a-stranger pass on `docs/16` (route-vs-reality reconciled in-doc; no pre-filled live-status; anchors verified against source; no sprint-tracking leakage; A45/A57 N/A — no shell-command/binary content).
  - [x] Frontend gate (A58, changed files): `tsc --noEmit` clean; `eslint` clean on both changed pages; `vitest run` 207/207 pass (36 files) at S1 close, zero regressions. **Prettier note (post-boundary-review):** the touched pages (`events/page.tsx`, `members/page.tsx`) were already prettier-drifted at HEAD; an initial `prettier --write` was reverted in the Epic-7 boundary review (P1 — it reformatted whole pre-drifted files), and only the logical `aria-label` lines were re-applied, leaving the pre-existing drift intact (A58/A72). See `epic-7-boundary-review-2026-06-07.md`.
  - [x] Updated `docs/10_requirements_status.md` REQ-056 row → `In Bearbeitung`.

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

This story was bulk-refreshed from a 2026-05-12 pre-pivot stub (placeholder ACs, stale MFA/Keycloak/Hangfire "Latest Technical Context") to a comprehensive dev-ready spec. Spike findings that shape scope:

- **No accessibility artifact exists.** No `docs/*accessibility*|*a11y*|*wcag*` file; `docs/07_dos_donts.md` and `docs/13_frontend_design_standards.md` contain **zero** accessibility guidance. The checklist doc is genuinely net-new. Next doc number is **16** (`docs/15_multichannel_messaging.md` is the current highest).
- **Source-of-truth for the checklist already exists in planning artifacts** — `ux-design.md:532-541` (8 checklist items) and `prd.md:420-426` (REQ-056's 6 ACs). AC-1 is a transcription+operationalization job, not an invention job.
- **This is a doc-bundle anchor (A38).** E7-S2's fixes point their evidence back at this doc's audit table; do not have E7-S2 re-audit. Write the audit once here.
- **The audit feeds E7-S2.** The spike already surfaced concrete shared-component gaps (see "Known Findings to Confirm" below) — the audit should confirm/expand these, and they belong to E7-S2, not here.

### Known Findings to Confirm During the Audit (seed list — confirm + expand, then route to E7-S2)

- Icon-only button with **no accessible name**: `frontend/src/app/finance/budgets/page.tsx:511` (close `XIcon` button — no `aria-label`/`sr-only`/`title`). High severity. → E7-S2 / local fix candidate.
- `Input` error text is **not associated** with the field: `frontend/src/components/ui/input.tsx:34` renders `<p>{error}</p>` with no `aria-describedby` + no `aria-invalid` on the `<input>`. Medium-High. → E7-S2 (shared).
- `Input` focus ring is the **outlier**: `input.tsx:27` uses `focus:ring-1 focus:ring-indigo-500` (indigo, thin) vs. the design-system `focus-visible:ring-2 focus-visible:ring-ring` used by `button.tsx:7`, `badge`, `select`, `textarea`, `checkbox`, `tabs`. Indigo is not a brand token (brand is orange). Medium. → E7-S2 (shared).
- Dialog close uses a **hardcoded** `sr-only` "Close": `frontend/src/components/ui/dialog.tsx:~49` — violates the next-intl no-hardcoded-text rule. Low-Medium. → E7-S2 (shared, i18n the accessible name).
- `Select` / `Textarea` / `Checkbox` (`frontend/src/components/ui/*`) have **no label-association wrapper** (unlike `Input`). Medium. → E7-S2 (shared).

### Critical Page Inventory (journey-mapped audit scope — AC-2)

Audit this enumerated set (≈14 pages), grouped by the 8 PRD journeys (`prd.md:93-156`). Do NOT audit all 94 `page.tsx` files.

| # | Page route | PRD journey |
|---|-----------|-------------|
| 1 | `/auth/login` | All (auth entry; keyboard-critical) |
| 2 | `/(dashboard)` | All (entry point) |
| 3 | `/members` (list) | Admin onboards member |
| 4 | `/members/new` + `/members/[id]/edit` (forms) | Admin onboards member |
| 5 | `/events` (list) | Event lifecycle |
| 6 | `/events/new` + `/events/[id]/edit` (forms) | Event lifecycle |
| 7 | `/events/[id]/check-in` (mobile-critical) | Event lifecycle |
| 8 | `/finance/invoices/new` (complex form) | Treasurer invoice workflow |
| 9 | `/admin/settings` (branding + modules) | Admin configures platform |
| 10 | `/communication/email-campaigns/new` | Communication campaign |
| 11 | `/public` (landing) | Public visibility |
| 12 | `/public/events/[id]` (anonymous registration form) | Event lifecycle (public) |
| 13 | `/profile` (self-service) | Member self-service |
| 14 | `/privacy/export` + `/privacy/delete` (confirmation dialogs) | Privacy export/deletion |

### Scope Boundaries

In scope:

- The net-new `docs/16_accessibility_audit_checklist.md` (baseline + audit table + evidence).
- An "Accessibility" section added to `docs/13_frontend_design_standards.md`.
- Three-state-checkbox convention added to `docs/07_dos_donts.md`.
- Cheap, page-local high-impact fixes on audited pages (with i18n keys for any new text).
- `docs/10_requirements_status.md` REQ-056 status update.

Out of scope:

- Systematic shared-component accessibility fixes → **E7-S2** (this story produces that work list).
- Large UI refactors not tied to a tracked audit finding.
- Hindi/localization work → E7-S3/E7-S4.

### Architecture Guardrails

- This story is documentation + a small number of page-local frontend fixes. No backend, Domain, Application, EF, or migration changes.
- Any new user-visible text (accessible names, labels) MUST use next-intl keys in `frontend/messages/de.json` + `frontend/messages/en.json` — never hardcoded German/English strings (project rule; the dialog "Close" finding is exactly this anti-pattern).
- Frontend changes follow `docs/13_frontend_design_standards.md` layout/colour conventions (orange-600 primary; no blue).
- Do not regress shipped behaviour: Radix primitives (Select/Checkbox/Dialog/Tabs/DropdownMenu) already provide native ARIA — confirm, don't replace.

### Testing Requirements

- Manual keyboard walk per audited page (`Tab`/`Shift+Tab`/`Enter`/`Escape`/arrow keys); record pass/fail in the audit evidence cell.
- Automated checks where the dev-agent can run them headlessly (e.g. an axe-core assertion inside a Vitest+jsdom test, or a Playwright + `@axe-core/playwright` scan) — otherwise mark `[!] manual-verify`.
- For any Task-3 code change: `npx eslint <changed-files>` + `npx prettier --check <changed-files>` + `vitest run` (A58 changed-files gate; repo-wide is pre-drifted).
- Frontend Vitest tests that call Testing-Library `render()` must include `import { cleanup } from "@testing-library/react"; afterEach(cleanup);` + `// @vitest-environment jsdom` (A35/A46). Pure-Node tests (reading a doc/JSON + asserting) do NOT need cleanup.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — E7-S1 fix boundary (AC-4).** How much fixing happens in this audit story vs. E7-S2?
  - (A, recommended) **Audit + doc + page-local quick wins only.** Fix only cheap, non-shared, page-local issues on audited pages; route every shared-component finding to E7-S2 with a pointer. Keeps this story a clean baseline+audit deliverable and gives E7-S2 a concrete work list (matches AC-4's "fixed OR explicitly deferred"). Rationale: the spike shows the highest-impact gaps (Input aria-*, focus token, dialog i18n) are shared-component changes that belong together in E7-S2; splitting them across two stories risks visual drift.
  - (B) Fix everything found here. Rejected: collapses E7-S2 into E7-S1 and makes the audit/fix boundary unreviewable.
  - (C) Audit only, defer ALL fixes (including page-local) to E7-S2. Rejected: AC-4 explicitly wants high-impact touched-page issues fixed or deferred — leaving trivial local wins undone is busywork deferral.

### Project Structure Notes

- Docs: `docs/16_accessibility_audit_checklist.md` (new), `docs/13_frontend_design_standards.md` (+Accessibility section), `docs/07_dos_donts.md` (+three-state convention), `docs/10_requirements_status.md` (REQ-056 status).
- Frontend (if Task 3 fixes): `frontend/src/app/**` audited pages; `frontend/messages/{de,en}.json` for any new accessible-name keys.
- Evidence/records: this story file + `docs/16`.

### References

- `_bmad-output/planning-artifacts/prd.md:93-156` (8 critical journeys), `prd.md:420-426` (REQ-056 ACs)
- `_bmad-output/planning-artifacts/ux-design.md:522-546` (Accessibility Baseline checklist)
- `_bmad-output/planning-artifacts/epics-and-stories.md:757-780` (E7-S1 source)
- `_bmad-output/project-context.md` (A28/A30 three-state checkbox, A38 doc-bundle, A42 reread, A47 `[!]` queue, A56 spike, A58 changed-files gate)
- `docs/13_frontend_design_standards.md`, `docs/07_dos_donts.md`
- WCAG 2.2 AA — https://www.w3.org/TR/WCAG22/

## Validation Notes

- Bulk-refreshed 2026-06-07 from the 2026-05-12 stub as part of the full Epic-7 dev-ready preparation (A34). Placeholder ACs + stale "Latest Technical Context" replaced with spike-grounded content.
- Checklist coverage: ACs are concrete + testable; source paths verified against the codebase; no auth/finance/migration impact (docs + page-local fixes only); i18n rule enforced for any new text; manual-evidence + three-state convention applied.
- Remaining risk: the audit may surface more shared-component findings than the seed list — all route to E7-S2; this story stays bounded to baseline + audit + local quick wins.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous Epic-7 dev-story run.

### Debug Log References

**DEC-1 resolution (A41/A43 autonomous-mode escape — (a)/(b)/(c)):**

- (a) **Option chosen:** A — Audit + doc + page-local quick wins only; route shared-component findings to E7-S2.
- (b) **Rationale:** (1) story recommendation is Option A; (2) user pre-declared autonomous mode verbatim: *"das ganze epic 7 umsetzen ohen stop bis alle stories implementiert ist. danach standardmässig review und retro durchführen"*; (3) downstream architecture — the highest-impact gaps (Input `aria-*`, focus token, dialog i18n) are shared-component changes that belong together in E7-S2; splitting them across two stories risks visual drift. All three A41 preconditions hold (autonomous-mode declared, story has a recommended option, this (a)/(b)/(c) record exists).
- (c) **Consequence chain:** AC-4 "cheap local fixes" → covered (members + events list filters/toggles fixed in-story); AC-4 "systematic shared issues deferred" → covered via `docs/16` `deferred-to-E7-S2` rows; the budgets:511 close button stays E7-S2 (not in the 12-page audit inventory). Live-browser checks (AC-1 keyboard, AC-4 contrast, keyboard-traps) flip to `deferred / [!] manual-verify` (Q1–Q6), not `covered`.

**A56 verify-not-trust catch:** the static-audit subagent reported `invoices/new/page.tsx:582` delete button as missing an accessible name; re-reading the source showed `title={t("removeItem")}` at line 587 — it IS accessible. Recorded as compliant (no fix), avoiding a regressive "fix".

**Route reconciliation (A52/A55 at dev time):** the inventory's `/privacy/export`, `/privacy/delete`, `(dashboard)` root, and `/public` landing routes do not exist as named — GDPR self-service lives in `/profile`, dashboard entry is the app root `page.tsx`, and the public surface is sub-pages. Audited the real routes; documented the reconciliation in `docs/16` Section B.

### Completion Notes List

**A29 AC-Subitem Completion Check (per-AC, A54 — one row per page/finding):**

- **AC-1 (written baseline checklist):** ✅ covered — `docs/16` Section A, 8 baseline items mapped to the 6 REQ-056 ACs, each with how-to-verify; three-state convention documented (docs/16 + docs/07); accessibility section added to docs/13.
- **AC-2 (critical pages audited, set enumerated):** ✅ covered — 12 journey-mapped pages enumerated + statically audited; explicitly NOT all ~94 pages. Live keyboard/desktop+mobile walk → `[!]` Q1/Q2.
- **AC-3 (findings table keyed by page/flow with severity + status):** ✅ covered — Section B table (per-page) + shared-component deferred table; severities High/Medium/Low; statuses fixed / accepted / `deferred-to-E7-S2`.
- **AC-4 (cheap local fixes done; shared deferred with pointer):** ✅ covered — members + events list filter/toggle fixes applied; 5 shared findings deferred to E7-S2 with `file:line`.
- **AC-5 (accessibility evidence per page):** ✅ covered for static evidence; live evidence (axe/Lighthouse/keyboard) recorded as `[!] manual-verify` Q1–Q6 (dev-agent cannot drive a browser — A47).

**Manual-verify queue (surfaced for the live walkthrough):** Q1 keyboard nav, Q2 runtime visible focus, Q3 runtime validation-association, Q4 colour contrast (axe/Lighthouse), Q5 keyboard traps in custom modals, Q6 custom-modal focus management. See `docs/16` → Live-walkthrough queue.

**Quality gates:** `tsc --noEmit` clean; `eslint` clean on changed pages; `vitest run` 207/207 pass, 0 regressions. Prettier: modified pages left at pre-existing drift (A58/A72); initial `prettier --write` churn reverted in the boundary review (P1). No backend/auth/migration impact.

### File List

**New:**
- `docs/16_accessibility_audit_checklist.md` — accessibility baseline + critical-pages audit (A38 doc-bundle anchor; E7-S2 work list).

**Modified (docs):**
- `docs/07_dos_donts.md` — added three-state manual-verify checkbox convention.
- `docs/13_frontend_design_standards.md` — added Accessibility section + TOC entry + a11y row in New-Pages checklist.
- `docs/10_requirements_status.md` — REQ-056 → In Bearbeitung.

**Modified (frontend, page-local fixes):**
- `frontend/src/app/(dashboard)/events/page.tsx` — `aria-label` on search/category/status filters; `aria-label`+`aria-pressed` on grid/list view-toggle buttons.
- `frontend/src/app/members/page.tsx` — `aria-label` on search/status/type filters.
- `frontend/messages/en.json` — new keys `events.gridView`, `events.listView`.
- `frontend/messages/de.json` — new keys `events.gridView`, `events.listView`.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike findings, critical-page inventory, DEC-1, A38 doc-bundle anchor, quality-gate tasks.
- 2026-06-07: Implemented (autonomous Epic-7 run) — authored `docs/16` baseline+audit; added three-state convention to docs/07; added Accessibility section to docs/13; page-local a11y fixes on members + events lists; REQ-056 status updated. DEC-1=A. Gates green (tsc/eslint clean; vitest 207/207; prettier drift pre-existing). Status → review.
