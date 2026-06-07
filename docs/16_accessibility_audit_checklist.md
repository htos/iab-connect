# Accessibility Audit Checklist (REQ-056 / Epic E7-S1, E7-S2)

This document is the project's durable accessibility baseline plus the audit of the
critical pages derived from the PRD user journeys. It targets **WCAG 2.2 AA** for the
critical authenticated and public flows. It is the single source of truth for the
accessibility work list: E7-S2 consumes Section B (the findings table marked
`deferred-to-E7-S2`) as its scope; do not re-audit there.

Sources of truth for the baseline (transcribed, not invented):

- `_bmad-output/planning-artifacts/prd.md:420-426` — REQ-056 acceptance criteria.
- `_bmad-output/planning-artifacts/ux-design.md:522-546` — Accessibility Baseline checklist.
- WCAG 2.2 AA — https://www.w3.org/TR/WCAG22/

## Verification convention (three-state)

Every checklist row and audit-evidence cell uses the project three-state convention
(also documented in `docs/07_dos_donts.md`):

- `[x]` — **dev-verified**: confirmed by the dev-agent through static code inspection
  or a headless automated assertion (e.g. an `aria-*` attribute present in source, a
  Vitest assertion).
- `[!]` — **needs human verify**: the check requires a live browser session the
  dev-agent cannot drive (real keyboard tab-order, visible focus rendering, measured
  colour contrast, screen-reader announcement, keyboard-trap behaviour). These join the
  live-walkthrough queue; they are **not** a false `[x]`.
- `[ ]` — **pending**: not yet checked.

## Section A — Baseline (WCAG 2.2 AA target)

The eight baseline items from `ux-design.md:532-541`, each mapped to the REQ-056 AC it
satisfies (`prd.md:420-426`) and a one-line "how to verify".

| # | Baseline item | REQ-056 AC | How to verify |
|---|---------------|-----------|---------------|
| A1 | **Keyboard navigation works** — every interactive control is reachable and operable with `Tab`/`Shift+Tab`/`Enter`/`Space`/arrows; no mouse-only actions. | AC-1 (keyboard) | `[!]` Live: tab through the page start-to-end, confirm every action is reachable and activates. |
| A2 | **Focus state is visible** — the focused control shows a clear, non-color-only focus indicator. | AC-2 (focus states) | `[!]` Live: tab and confirm a visible ring; `[x]` static: control uses the design-system focus token, not a removed/`outline-none`-only style. |
| A3 | **Form controls have labels** — every input/select/textarea has a programmatic label (`<label htmlFor>` + `id`, or `aria-label`). | AC-2 (programmatic labels) | `[x]` static: each control has an associated `<label htmlFor>` or `aria-label` in source. |
| A4 | **Validation errors are associated with fields** — error text is linked via `aria-describedby` and the control sets `aria-invalid` when in error. | AC-2 (visible validation) | `[x]` static: error `<p>` has an `id` referenced by the control's `aria-describedby`; `aria-invalid` toggles with the error. |
| A5 | **Icon-only buttons have accessible names** — a button whose only child is an icon exposes `aria-label`, `title`, or `sr-only` text. | AC-3 (icon-only names) | `[x]` static: each icon-only `<button>`/`<Button>` carries an accessible name. |
| A6 | **Status badges do not rely on color alone** — status/variance carries text, an icon, or a sign in addition to color. | AC-4 (status not by color) | `[x]` static: badge/variance has an accompanying text/sign; `[!]` live for contrast of the colour itself. |
| A7 | **Text and controls meet basic contrast targets** — text, primary actions, status badges, and alerts meet a basic WCAG AA contrast ratio. | AC-4 (contrast) | `[!]` Live/tooling: measure contrast (axe/Lighthouse or a contrast checker) for sampled pairs. |
| A8 | **Loading and error states are not keyboard traps** — focus is never trapped in a spinner, modal, or error overlay; `Escape`/`Tab` always escapes. | AC-1 (keyboard) | `[!]` Live: open each modal/overlay/loading state and confirm focus can leave via `Escape`/`Tab`. |

**Evidence requirement (AC-5):** each audited page in Section B records either an
automated/static result (`[x]`) or a `[!] manual-verify` marker for the live checks. A
page is never marked fully `[x]` when live checks remain.

### Fix boundary for E7-S1 vs E7-S2 (DEC-1 = Option A)

- **E7-S1 (this story):** authors this baseline + audit, and fixes only **cheap,
  page-local, non-shared** issues on the audited pages (e.g. a missing `aria-label` on a
  one-off filter control or icon button). New accessible-name text uses next-intl keys.
- **E7-S2:** fixes **shared-component** issues (the `Input`/`Dialog`/`Select` library) and
  the high-impact call-sites the audit graded High/Medium. Every shared finding below
  carries status `deferred-to-E7-S2` with a `file:line` pointer — that is the E7-S2 work
  list.

## Section B — Critical Pages Audit

Audit scope = the journey-mapped critical-page set (`prd.md:93-156`), **not** all ~94
`page.tsx` files. Route-vs-reality reconciliation performed during the audit:

- The dashboard entry is the app root `frontend/src/app/page.tsx` (there is no
  `(dashboard)/page.tsx`).
- There is no standalone `/privacy/export` or `/privacy/delete` route; GDPR
  export/delete self-service lives within `/profile`. Audited there.
- There is no standalone `/public` landing `page.tsx`; the public surface is its
  sub-pages (events/blog/contact/...). The anonymous registration form
  `/public/events/[id]` is audited as the representative public flow.

Static-detectable results are `[x]`/finding rows; live-only checks (A1, A2-runtime, A7,
A8) are `[!] manual-verify` for **every** page and are tracked once in the
"Live-walkthrough queue" below rather than repeated per row.

| # | Page (route) | File | A3 labels | A4 valid. assoc | A5 icon names | A6 status-not-color | Severity | Status | Evidence |
|---|--------------|------|-----------|-----------------|---------------|---------------------|----------|--------|----------|
| 1 | `/login` | `login/page.tsx` | `[x]` ok | n/a | `[x]` ok | n/a | Low | accepted | Static; account-disabled modal is custom (`login/page.tsx:202`) → A8 `[!]` |
| 2 | `/` dashboard | `page.tsx` | `[x]` ok | n/a | `[x]` ok | `[x]` role badges have text labels (`page.tsx:164-178`) | — | accepted | Static |
| 3 | `/members` list | `members/page.tsx` | **fixed** — raw search/status/type filters had no label; added `aria-label` (`members/page.tsx:273,281,295`) | n/a | `[x]` row actions use `title` (`members/page.tsx:422,432,442`) | `[x]` badges have text labels (`members/page.tsx:403-410`) | Medium | **fixed (E7-S1)** | Static + local fix |
| 4 | `/members/new`, `/members/[id]/edit` | `members/new/page.tsx`, `members/[id]/edit/page.tsx` | `[x]` all inputs have `htmlFor` labels | uses raw inputs with inline error text — `aria-describedby`/`aria-invalid` not wired | `[x]` ok | n/a | Low | accepted | Static — error-association is page-raw, not the shared `Input`; tracked as A4 live-verify `[!]` |
| 5 | `/events` list | `(dashboard)/events/page.tsx` | **fixed** — raw search/category/status filters had no label; added `aria-label` (`events/page.tsx:278,288,309`) | n/a | **fixed** — grid/list view-toggle buttons had no name; added `aria-label`+`aria-pressed` (`events/page.tsx:324,332`) | `[x]` status badge has text (`events/page.tsx:421,508`) | Medium | **fixed (E7-S1)** | Static + local fix |
| 6 | `/events/new`, `/events/[id]/edit` | `(dashboard)/events/new/page.tsx`, `.../[id]/edit/page.tsx` | `[x]` all inputs have `htmlFor` labels | raw inputs; `aria-describedby`/`aria-invalid` not wired | `[x]` ok | n/a | Low | accepted | Static; A4 `[!]` live-verify |
| 7 | `/events/[id]/check-in` (mobile) | `(dashboard)/events/[id]/check-in/page.tsx` | `[x]` manual search input has `sr-only` label + `aria-label` (`check-in/page.tsx:352`) | n/a | `[x]` tabs use `aria-pressed` + text | `[x]` result card has text status | Low | accepted | Static; mobile keyboard/focus → A1/A2 `[!]` |
| 8 | `/finance/invoices/new` (complex form) | `finance/invoices/new/page.tsx` | `[x]` all inputs have `htmlFor` labels | raw inputs; not wired | `[x]` row delete button has `title={t("removeItem")}` (`invoices/new/page.tsx:587`) | n/a | Low | accepted | Static (delete button is accessible via `title` — verified) |
| 9 | `/admin/settings` | `admin/settings/page.tsx` | `[x]` all inputs have `htmlFor` labels | raw inputs; not wired | `[x]` role row actions use `title` (`settings/page.tsx:1113,1148`) | `[x]` active badge has text (`settings/page.tsx:1086`) | Medium | accepted | Static; module-disable + role modals are custom (`settings/page.tsx:1281,1334`) → A8 `[!]` |
| 10 | `/communication/email-campaigns/new` | `communication/email-campaigns/new/page.tsx` | `[x]` all inputs have `htmlFor` labels | raw inputs; not wired | `[x]` mode toggles carry text | `[x]` segment badge has text (`email-campaigns/new/page.tsx:521`) | Low | accepted | Static; A4 `[!]` live-verify |
| 11 | `/public/events/[id]` (anon registration) | `public/events/[id]/page.tsx` | `[x]` registration inputs have `htmlFor` labels (`public/events/[id]/page.tsx:604`) | raw inputs; not wired | `[x]` ok | `[x]` event badges have text | Low | accepted | Static; A4 `[!]` live-verify |
| 12 | `/profile` (self-service + GDPR export/delete) | `profile/page.tsx` | `[x]` edit-mode inputs have `htmlFor` labels | raw inputs; not wired | `[x]` edit button has text (`profile/page.tsx:312`) | `[x]` membership badges have text (`profile/page.tsx:358`) | Low | accepted | Static; consent/channel toggles inline (not modal) |

### Shared-component findings → deferred to E7-S2

These are **not** page-local; they live in the shared UI library and affect every
consumer. E7-S2's work list:

| Finding | Location | Severity | Status |
|---------|----------|----------|--------|
| `Input` error text not programmatically associated — error `<p>` has no `id`, control has no `aria-describedby` / `aria-invalid` (baseline A4). | `frontend/src/components/ui/input.tsx:34` | Medium-High | `deferred-to-E7-S2` |
| `Input` focus ring is the outlier — `focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500` vs the design-system `focus-visible:ring-2 focus-visible:ring-ring` used by `Button`/`Select`/`Badge`/etc. Indigo is not a brand token (baseline A2). | `frontend/src/components/ui/input.tsx:27` | Medium | `deferred-to-E7-S2` |
| Dialog close uses a **hardcoded** `sr-only` "Close" — violates the next-intl no-hardcoded-text rule (baseline A5 + i18n). | `frontend/src/components/ui/dialog.tsx:49` | Low-Medium | `deferred-to-E7-S2` |
| Icon-only close button with no accessible name on a non-audited page (seed finding; high-traffic). | `frontend/src/app/finance/budgets/page.tsx:511` | High (local) | `deferred-to-E7-S2` |
| `Select` / `Textarea` / `Checkbox` have no label-association wrapper (unlike `Input`) — document/enforce a caller contract (baseline A3). | `frontend/src/components/ui/{select,textarea,checkbox}.tsx` | Medium | `deferred-to-E7-S2` |

### Live-walkthrough queue (`[!]` — needs human verify in a browser)

These checks require a real browser/AT session the dev-agent cannot run. They apply to
every audited page above; the dev-agent cannot mark them `[x]`.

- **Q1 — Keyboard navigation (A1):** tab through each audited page start-to-end; confirm
  every interactive control is reachable and operable; no mouse-only action.
- **Q2 — Visible focus at runtime (A2):** confirm a clearly visible focus indicator on
  every control on each page (static token presence is verified; rendering is not).
- **Q3 — Validation-message association at runtime (A4):** trigger a validation error on
  each form page and confirm the screen reader announces the error for the field. Note:
  the shared `Input` association fix lands in E7-S2; raw-input pages additionally need a
  runtime check.
- **Q4 — Colour contrast (A7):** run axe/Lighthouse or a contrast checker on each page;
  record measured ratios for text, primary actions, status badges, and alerts.
- **Q5 — Keyboard traps in modals/loading (A8):** open every custom modal (login
  account-disabled `login/page.tsx:202`; settings module-disable `settings/page.tsx:1281`
  and role modal `settings/page.tsx:1334`; budgets dialog `finance/budgets/page.tsx:504`)
  and confirm `Escape` closes and `Tab` cycles within then escapes; confirm loading
  spinners do not trap focus.
- **Q6 — Custom-modal focus management (A8):** the custom (non-Radix) modals above lack
  built-in focus-trap/restore; verify focus moves into the modal on open and returns to
  the trigger on close. Candidate for migrating to the shared Radix `Dialog` in a
  follow-up (out of E7 scope).

## Notes

- The audited pages predominantly use **raw `<input>`/`<select>`** with manual `<label>`
  wiring rather than the shared `Input` component, so the shared `Input` aria/focus gap
  (deferred to E7-S2) does not by itself fix the page-level forms; per-page
  `aria-describedby`/`aria-invalid` wiring is tracked as Q3 live-verify, and broader
  form-error-association is an incremental follow-up beyond E7-S2's shared-component scope.
- No accessibility regressions were introduced: page-local fixes only **add**
  `aria-label`/`aria-pressed` attributes; no layout, colour, or behaviour changed.
