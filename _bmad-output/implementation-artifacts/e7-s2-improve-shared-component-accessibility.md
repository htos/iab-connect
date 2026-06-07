# Story E7.S2: Improve Shared Component Accessibility

Status: done

## Story

As a user (including keyboard and screen-reader users),
I want the shared UI controls to expose accessible names, programmatic labels, visible focus, and non-color-only status,
so that accessibility improves consistently across every page that reuses them, without regressing the visual design.

## Acceptance Criteria

1. Icon-only buttons rendered through the shared component library expose an accessible name (via `aria-label` or `sr-only` text), and the established pattern is documented so new icon-only buttons inherit it. The known offenders surfaced by the E7-S1 audit are fixed.
2. Shared form controls (`Input`, `Textarea`, `Select`, `Checkbox`) associate their label and validation message programmatically: a label tied via `htmlFor`/`id`, and error text linked via `aria-describedby` with `aria-invalid` set on the control when in error.
3. Focus states are visible and consistent across the shared controls (one design-system focus token, not per-component ad hoc colors).
4. Status badges and alerts do not rely on color alone (text/icon/sign carries the meaning) and meet WCAG AA contrast.
5. Changes preserve the existing visual design standards (`docs/13_frontend_design_standards.md`) — no layout shift, no brand-color regression, no new blue primary.

## Tasks / Subtasks

- [x] Task 0: Spike — load the E7-S1 audit work list (AC: all)
  - [x] Read `docs/16` Section B + the "Shared-component findings → deferred to E7-S2" table = this story's work list (A62 — verified E7-S1 shipped the audit table; all referenced findings present).
  - [x] Read each shared component end-to-end (input/dialog/textarea/select/checkbox/badge/alert/button); recorded shipped-state + what to preserve (AC-5).
  - [x] Resolved DEC-1 = A, DEC-2 = A (see Debug Log).
- [x] Task 1: Icon-only button accessible names (AC: 1)
  - [x] Confirmed `Button` (`button.tsx:36`) forwards `aria-label` via `...props` — gap is call-sites + convention. Pattern documented in `docs/13` Accessibility (added in E7-S1, icon-only ⇒ `aria-label={t(...)}`).
  - [x] Fixed audited offender `finance/budgets/page.tsx:511` close button → `aria-label={tc("close")}`. (The 12-page audit's icon-only offenders were already fixed in E7-S1; budgets was the deferred seed.)
  - [x] i18n'd the hardcoded `sr-only` "Close" in `dialog.tsx` → `useTranslations("common")` + `t("close")`; added `common.close` to `de.json` + `en.json`.
- [x] Task 2: Form-control label + validation association (AC: 2)
  - [x] `Input` (`input.tsx`): error `<p>` gets a stable `${inputId}-error` id (with `useId()` fallback when no id/name); `aria-describedby` set when `error` present (preserves a caller-supplied describedby by appending); `aria-invalid` set on error. Existing label/`htmlFor` + visual error styling preserved.
  - [x] `Textarea`/`Select`/`Checkbox`: documented the accessibility caller contract in each component (Radix supplies roles/keyboard; caller supplies the accessible name via `<label htmlFor>`/`aria-label`). No Radix ARIA hand-rolled (AC-5 preserve).
- [x] Task 3: Consistent visible focus token (AC: 3, 5)
  - [x] `Input` outlier replaced: `focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500` → `ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (matches `Button`/`Textarea`/`Select`/`Badge`). Error override aligned to `border-red-500 focus-visible:ring-red-500` (same ring width). Documented in docs/13 — intentional, not drift.
- [x] Task 4: Status not by color alone + contrast (AC: 4)
  - [x] Confirmed `Badge` + `Alert` (no code change needed): `Alert` sets `role="alert"` (`alert.tsx:28`) and the destructive variant carries an icon + text, not colour alone; badge colour pairs pass AA per the spike; all audited badge usages carry text labels (recorded in `docs/16`). Variance numeric+sign requirement is satisfied by existing finance variance rendering.
- [x] Task 5: Tests (AC: all)
  - [x] Net-new `components/ui/*` a11y tests (none existed): `input.test.tsx` (5 — aria-invalid/describedby present-and-absent, label assoc, focus token not indigo, caller-describedby preserved), `dialog.test.tsx` (1 — close accessible name from i18n key, not hardcoded), `button.test.tsx` (2 — icon-only accessible name via aria-label, focus token).
  - [x] All `render()` tests use `afterEach(cleanup)` + `// @vitest-environment jsdom` (A35/A46); dialog test mocks `useTranslations` with a STABLE function (A64).
- [x] Task 6: Quality gates (AC: all)
  - [x] A29 per-AC sub-item completion list below (one row per changed component, A54).
  - [x] A58 changed-files gate: `tsc --noEmit` clean; `eslint` clean on all changed files; `vitest run` 215/215 pass (39 files, +8 new) at S2 close, zero regressions. **Prettier note (post-boundary-review):** the edited shared components (input/dialog/textarea/select/checkbox) were already prettier-drifted at HEAD; an initial `prettier --write` was reverted in the boundary review (P1) and only the logical changes re-applied (A58/A72). The new `*.test.tsx` files are prettier-clean. See `epic-7-boundary-review-2026-06-07.md`.
  - [x] Evidence points at `docs/16` audit rows (A38 — audit not re-authored).

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub (placeholder ACs, stale MFA "Latest Technical Context"). The shared component library already ships and is mostly accessible — this is **targeted fixes + test coverage**, NOT a rewrite. Do NOT regress the shipped components to match an AC literal (A56).

Shipped-state (spike, with `file:line`):

- **`Button`** (`button.tsx`) — CVA variants incl. `size: "icon"` (line 25) for icon-only; spreads `ButtonHTMLAttributes` (line 36) so `aria-label` already passes through. Focus is already correct: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (line 7). **Gap is call-sites + a documented convention, not the component.**
- **`Input`** (`input.tsx`) — has label/`htmlFor` (lines 11-22) + error `<p>` (line 34), but **no `aria-describedby`, no `aria-invalid`**, and a **non-standard focus ring** (`indigo-500`, `ring-1`, line 27). These are the two AC-2/AC-3 fixes.
- **`Select`/`Checkbox`/`Dialog`/`Tabs`/`DropdownMenu`/`AlertDialog`** — Radix-based, native ARIA. **Preserve.** `dialog.tsx` close button has a **hardcoded** `sr-only` "Close" → i18n it (project rule).
- **`Badge`/`Alert`** — `Alert` has `role="alert"`. Sampled badge/alert color pairs (`yellow-100/yellow-800`, `orange-100/orange-800`, `red-100/red-700`, `orange-200/orange-900`) all pass AA. AC-4 is mostly "confirm + ensure non-color signal", not a contrast overhaul.
- **No `components/ui/*` unit tests exist** — page-level tests only. Task 5 adds the first component-level a11y tests (harness conventions: `frontend/src/app/admin/settings/page.test.tsx` is a good reference — `// @vitest-environment jsdom`, `vi.mock("next-intl")`, `cleanup`).

### Components to change (read fully before editing — AC-5 preserve visuals)

- `frontend/src/components/ui/input.tsx` (AC-2 aria-*, AC-3 focus token)
- `frontend/src/components/ui/textarea.tsx` (AC-2 association)
- `frontend/src/components/ui/select.tsx`, `checkbox.tsx` (AC-2 caller contract — Radix, document/verify)
- `frontend/src/components/ui/dialog.tsx` (AC-1 i18n close)
- `frontend/src/components/ui/badge.tsx`, `alert.tsx` (AC-4 confirm)
- `frontend/src/app/finance/budgets/page.tsx:511` + any other audited call-sites (AC-1)
- `frontend/messages/de.json` + `en.json` (new accessible-name keys; keep DE/EN parity)
- `docs/13_frontend_design_standards.md` (Accessibility section, extended from E7-S1)

### Scope Boundaries

In scope:

- Shared components under `frontend/src/components/ui` + `navigation`, plus the specific high-traffic call-sites the E7-S1 audit flagged.
- Net-new component-level a11y tests.
- i18n keys for any new accessible-name text.

Out of scope:

- Re-running the page audit (that is E7-S1; consume its table).
- One-off page fixes where a shared-component change already solves the issue.
- Hindi/localization → E7-S3/S4.
- A full design-system focus-token refactor beyond aligning the `Input` outlier.

### Architecture Guardrails

- Frontend-only. No backend/Domain/Application/EF/migration changes.
- All user-visible/accessible-name text via next-intl keys (`de.json` + `en.json` in lockstep) — never hardcoded. The hardcoded dialog "Close" is the exact anti-pattern being fixed.
- Preserve Radix primitive behavior; do not hand-roll ARIA that Radix already provides.
- Preserve `docs/13` visual standards: orange-600 primary, standard layout, no blue. The focus-token change is documented + intentional (AC-5), not silent drift.

### Testing Requirements

- Vitest + Testing Library for each changed shared control; assert the ARIA contract (accessible name, `aria-invalid`/`aria-describedby` presence-and-absence, focus class).
- `afterEach(cleanup)` + jsdom directive for `render()` tests (A35/A46); stable `useTranslations` mock (A64).
- Changed-files gate: `npx eslint <files>` + `npx prettier --check <files>` + full `vitest run` for regressions (A58).
- Manual screen-reader/keyboard spot-check where automated assertions can't prove it → `[!] manual-verify` (A47), recorded against the `docs/16` audit rows.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — call-site fix breadth (AC-1).** Which icon-only call-sites get fixed here?
  - (A, recommended) **Shared components + the high-impact call-sites enumerated in the E7-S1 audit table.** Fix the shared library + every offender the audit graded High/Medium; track remaining Low one-offs in `docs/16` for incremental cleanup. Rationale: bounded, audit-driven, reviewable; avoids an open-ended "grep every icon button in 94 pages" sweep while still closing the real gaps.
  - (B) Fix every icon-only button in the entire app. Rejected: unbounded, mixes unrelated pages into a shared-component story, high regression surface.
  - (C) Fix shared components only, no call-sites. Rejected: leaves the concrete audited violations (e.g. budgets close button) live; AC-1 explicitly wants the known offenders fixed.
- **DEC-2 — `Input` focus color (AC-3/AC-5).** Replace `indigo-500` with what?
  - (A, recommended) The design-system ring token already used by `Button`/`Select`/etc. (`ring-ring`, `ring-2`, `ring-offset-2`). Consistent + brand-neutral focus halo; matches every other control. Document the change in `docs/13` so it reads as intentional.
  - (B) `orange-500` to match brand. Acceptable but diverges from the neutral `ring-ring` the rest of the library uses; only choose if `docs/13` mandates an orange focus ring.

### Project Structure Notes

- Frontend: `frontend/src/components/ui/*`, `frontend/src/components/navigation/*`, audited `frontend/src/app/**` call-sites, `frontend/messages/{de,en}.json`.
- Docs: `docs/13_frontend_design_standards.md` (Accessibility section), evidence → `docs/16_accessibility_audit_checklist.md`.
- Tests: co-located `*.test.tsx` next to each changed component.

### References

- `docs/16_accessibility_audit_checklist.md` (E7-S1 deliverable — the work list)
- `_bmad-output/planning-artifacts/ux-design.md:530-541, 520` (shared-component fixes; non-color status)
- `_bmad-output/planning-artifacts/epics-and-stories.md:782-804` (E7-S2 source)
- `_bmad-output/project-context.md` (A35/A46 cleanup, A58 changed-files gate, A62 sibling-DEC-not-a-contract, A64 stable useTranslations)
- WCAG 2.2 AA — https://www.w3.org/TR/WCAG22/

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-7 dev-ready prep (A34). Stub placeholder ACs + stale tech context replaced with spike-grounded, `file:line`-anchored tasks.
- Checklist coverage: ACs concrete + testable; shipped-state documented so dev verifies-not-rewrites (A56); i18n rule enforced; net-new component test harness specified; no backend/auth/migration impact.
- Remaining risk: AC-2 for Radix `Select`/`Checkbox` is a caller-contract concern more than a component change — the DEC + Task 2 handle it by documenting + verifying rather than wrapping Radix.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous Epic-7 dev-story run.

### Debug Log References

**DEC resolution (A41/A43 autonomous-mode escape — (a)/(b)/(c)):**

- (a) **Options chosen:** DEC-1 = A (shared components + the high-impact audited call-sites); DEC-2 = A (the design-system `ring-ring` token, not orange).
- (b) **Rationale:** (1) both are the story's recommended options; (2) user pre-declared autonomous mode verbatim: *"das ganze epic 7 umsetzen ohen stop bis alle stories implementiert ist…"*; (3) downstream — DEC-1=A keeps the change bounded + audit-driven (no "grep every icon button in 94 pages" sweep); DEC-2=A makes `Input` consistent with every other control's neutral focus halo (`docs/13` documents it as intentional). All three A41 preconditions hold.
- (c) **Consequence chain:** AC-1 covered (budgets close button fixed + dialog i18n + Button convention documented); AC-2 covered (Input aria assoc + Textarea/Select/Checkbox caller contract); AC-3 covered (Input focus token aligned); AC-4 covered (Badge/Alert confirmed, no change); AC-5 preserved (no layout/brand-colour regression; Radix ARIA untouched).

**A62 sibling-contract verification:** confirmed E7-S1 actually shipped `docs/16` with the `deferred-to-E7-S2` table before consuming it; all five shared findings (Input aria, Input focus, dialog close, budgets:511, Select/Textarea/Checkbox association) were present — none had to be re-scoped.

**Caller-contract decision (Task 2):** `Textarea`/`Select`/`Checkbox` were NOT wrapped or given a new error prop — they spread `...props` (so callers can pass `aria-label`/`aria-describedby`) and the Radix ones already provide native ARIA. Per the DEC + AC-5 "preserve", documented the caller contract in-component (JSDoc/comment) rather than rewriting, avoiding regression risk.

### Completion Notes List

**A29 AC-Subitem Completion Check (one row per changed component, A54):**

- **AC-1 (icon-only accessible names + documented pattern):** ✅ `dialog.tsx` close → i18n key; `budgets/page.tsx:511` → `aria-label`; `button.tsx` confirmed forwards `aria-label`; pattern in `docs/13`.
- **AC-2 (form label + validation association):** ✅ `input.tsx` aria-describedby/aria-invalid wired; `textarea.tsx`/`select.tsx`/`checkbox.tsx` caller-contract documented.
- **AC-3 (consistent visible focus token):** ✅ `input.tsx` indigo outlier → design-system `ring-ring` token; `button`/`textarea`/`select`/`checkbox`/`badge` already on the token (confirmed).
- **AC-4 (status not color-only + contrast):** ✅ `alert.tsx` `role="alert"` + icon (confirmed, no change); `badge.tsx` pairs pass AA (confirmed); audited badge usages carry text.
- **AC-5 (preserve visual design):** ✅ no layout shift, no brand-colour regression, no new blue; Radix primitives untouched; focus-token change is documented/intentional.

**Manual-verify (`[!]`):** screen-reader announcement of the wired `aria-describedby` and runtime visible-focus rendering across themes are browser/AT-only → tracked under `docs/16` Live-walkthrough queue (Q2, Q3) rather than a false `[x]`.

**Quality gates:** `tsc --noEmit` clean; `eslint` clean on changed files; `vitest run` 215/215 (39 files, +8 new). Prettier: edited components left at pre-existing drift (A58/A72), new test files clean; initial `prettier --write` churn reverted in the boundary review (P1). No backend/auth/migration impact.

### File List

**Modified (shared components):**
- `frontend/src/components/ui/input.tsx` — `aria-describedby` (stable error id via `useId` fallback) + `aria-invalid` on error; focus ring indigo → design-system `ring-ring` token.
- `frontend/src/components/ui/dialog.tsx` — close button `sr-only` text via `useTranslations("common")` `t("close")` (was hardcoded "Close").
- `frontend/src/components/ui/textarea.tsx` — accessibility caller-contract JSDoc.
- `frontend/src/components/ui/select.tsx` — accessibility caller-contract comment on `SelectTrigger`.
- `frontend/src/components/ui/checkbox.tsx` — accessibility caller-contract comment.

**Modified (call-site + i18n):**
- `frontend/src/app/finance/budgets/page.tsx` — close button `aria-label={tc("close")}`.
- `frontend/messages/en.json` — new key `common.close`.
- `frontend/messages/de.json` — new key `common.close`.

**New (tests):**
- `frontend/src/components/ui/input.test.tsx` — Input a11y (5 tests).
- `frontend/src/components/ui/dialog.test.tsx` — Dialog close i18n (1 test).
- `frontend/src/components/ui/button.test.tsx` — Button icon-only accessible name + focus token (2 tests).

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (shipped-state + `file:line` offenders), DEC-1/DEC-2, net-new component a11y tests, A38 evidence pointer to E7-S1's `docs/16`.
- 2026-06-07: Implemented (autonomous Epic-7 run) — Input aria-association + focus-token fix; Dialog close i18n; budgets close-button aria-label; Textarea/Select/Checkbox caller-contract docs; net-new component a11y test harness (8 tests). DEC-1=A, DEC-2=A. Gates green (tsc/eslint clean; vitest 215/215). Status → review.
