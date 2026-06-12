# Story E30.5: Retrofit `PageShell`/`PageHeader` across the migrated authenticated pages

Status: ready-for-dev

Depends on: **E30-S1 (PageShell/PageHeader)** + the origin char-nets of E22-E29 (closed). **Added 2026-06-12 per user "Add both"** — expands E30 beyond the original 3-story skeleton and **deliberately overrides the epic's "no cosmetic mass changes" guardrail** for this one consolidation (user-authorized). **Excludes** `app/page.tsx` (E30-S4), `app/module-unavailable` (E30-S2), and the public surface (E28). Independent of S2/S3/S4; can run after any of them.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the repeated inline page-content frame (`<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-Nxl">`) and the canonical title/description/actions header block swept onto the shared `PageShell`/`PageHeader` primitives across the ~73 already-migrated authenticated slice pages,
so that the whole authenticated frontend renders its page frame through one tested primitive instead of 73 hand-copied frames — with **byte-identical** output on every page.

## ⚠️ This is a byte-identical structural swap, NOT a redesign (read before AC)

`PageShell` (E30-S1) was built to emit the **exact** frame these pages already hand-write. So this is a mechanical, **zero-DOM-diff** swap, page by page — not a styling change. The safety model is two-fold:
1. **Each slice's existing characterization net is the oracle (A87).** Every slice (suppliers, sponsors, members, events, finance, communication/*, admin-*, documents, board-documents, profile) carries a green net from its origin epic (E22-E29). The swap must keep that net green **with zero spec edits** — because the rendered DOM (classes, structure) is identical.
2. **It is the A72/A73/A81 prettier-drift minefield** — ~73 pre-drifted files. The single biggest risk is a `prettier --write` ballooning a 4-line frame swap into a whole-file reformat. **NEVER `prettier --write` a modified page** here.

If a swap is **not** byte-identical (a page uses a non-canonical frame, an extra wrapper class, a bespoke header), it is **left inline + documented**, not forced.

## Acceptance Criteria

**Behaviour preserved (every page, byte-for-byte):**

1. For each retrofitted page, the rendered DOM is **identical** to HEAD: the `<main>` keeps `min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8`, the inner container keeps `mx-auto max-w-Nxl`, and the header block (where adopted) keeps `mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between` + `h1.text-2xl.font-bold.text-gray-900.md:text-3xl` + `p.mt-1.text-gray-600` + the same actions node. PageShell/PageHeader emit these exact strings.
2. **Every adopted occurrence in a file** is swapped (including the auth-guard/loading early-return branches that also use the frame, e.g. suppliers' `if (authLoading || !isAdmin)` block) — so a page never half-adopts the primitive.
3. **Each slice's existing characterization net stays green with NO spec changes.** No test is edited to accommodate the swap; the nets that assert frame classes stay true because the strings are unchanged.
4. Pages with a **non-canonical** frame/header (different `bg`, an extra wrapper class, a `max-w` not in PageShell's static map, a bespoke header with breadcrumbs/back-links/status badges) are **left inline** and listed in Completion Notes as "not retrofitted (non-canonical) — by design", OR the `max-w` map in `components/layout/PageShell.tsx` is extended (a tiny S1-file edit) when only the width differs. No page is made non-identical to fit the primitive.
4b. **Excluded surfaces untouched:** `app/page.tsx` (E30-S4 owns it), `app/module-unavailable` (E30-S2), and `features/public/*` (E28 — a distinct server-component shell on `PublicLayoutShell`, not the authenticated MainLayout frame).
5. No route, route-group, API-contract, or i18n change. `npm run typecheck` + each touched slice's nets + the full `npm test -- --run` stay green; `next build` (epic boundary) clean.

**Improvements:**

6. `PageShell` is adopted on the canonical content frame and `PageHeader` on the canonical title/description/actions header across the ~73 authenticated slice pages; afterward, `grep "min-h-\[calc(100vh-4rem)\]" frontend/src/features` returns only the intentionally-excluded non-canonical pages (documented) — the inline frame is otherwise gone from the authenticated slices. No raw frame markup remains where PageShell applies; no duplicate primitive introduced.

## Tasks / Subtasks

> **Phaseable:** each slice is independent. Execute and **commit slice-by-slice** (per the session-pacing practice — a heavy 73-file sweep should not be one marathon). Order is free; suppliers/sponsors (smallest, the template authors) first is a good warm-up.

- [ ] **Task 0: Spike + lock the swap recipe** (AC: 1-4) — A56; A43 (a)/(b)/(c) per DEC.
  - [ ] Confirm E30-S1 `PageShell`/`PageHeader` exist + their static `maxWidth` map (4xl-7xl). Re-run `grep -rl "min-h-\[calc(100vh-4rem)\]" frontend/src/features` → the live work-list (exclude `features/public/*`). For each file, note its `max-w-*` and whether its header is the canonical block.
  - [ ] Confirm each target slice's char-net location (its `*.test.tsx` suites) so the swap can be gated per slice.
  - [ ] Resolve DEC-1 (PageHeader adoption breadth), DEC-2 (non-canonical `max-w` → extend-map vs leave-inline), DEC-3 (per-slice commit cadence).
- [ ] **Task 1: Frame-swap recipe (apply per page)** (AC: 1, 2) — for each canonical occurrence:
  - Replace `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-{N}"> … </div></main>` with `<PageShell maxWidth="{N}"> … </PageShell>`.
  - Where the header is canonical: replace the header `<div>` with `<PageHeader title={…} description={…} actions={…} />` as PageShell's first child (PageShell renders `{header/children}` inside the `max-w` div → identical DOM). Where the header is bespoke (back-link, breadcrumb, status badge, multi-row): keep it inline as the first child of `<PageShell>`.
  - Swap **every** frame occurrence in the file (Task-2 AC), incl. loading/guard branches.
  - Import `{ PageShell, PageHeader } from "@/components/layout"`.
  - **Edit ONLY the wrapper lines.** Hand-match the surrounding (pre-drifted) style. Do **not** reflow the body.
- [ ] **Task 2: Per-slice execution + net-gating** (AC: 3) — for each slice below, apply Task 1 to its pages, then run **that slice's nets** + `tsc` + `eslint <changed>`; the nets must stay green **unmodified**. Slices (live `grep` is the source of truth):
  - [ ] `features/suppliers` (4), `features/sponsors` (4)
  - [ ] `features/members` (~9 incl. segments)
  - [ ] `features/events` (~5 incl. registrations/volunteers/check-in/fees)
  - [ ] `features/finance` (~25 — the largest; sub-areas banking/budgeting/dunning/settings/expense-claims/payments/receipts/journal/ledger/fiscal-periods/posting-mappings/accounts/reports/dashboard)
  - [ ] `features/communication/{automations,email-campaigns,email-templates}` (~12)
  - [ ] `features/admin-{users,settings,system,documents}` (~10)
  - [ ] `features/documents` (1), `features/board-documents` (2), `features/profile` (2)
- [ ] **Task 3: Non-canonical handling** (AC: 4) — any page whose swap would not be byte-identical: either extend `PageShell`'s `maxWidth` static map (if only the width differs — coordinate the tiny edit in `components/layout/PageShell.tsx` + its test) or leave the page inline and record it in Completion Notes with the reason. **Never** alter a page's DOM to fit the primitive.
- [ ] **Task 4: A72/A73 drift guard (per file)** (AC: 5) — after each file: `git diff --stat <file>` must show a line count ≈ the logical swap (a handful), NOT a whole-file reformat. If it ballooned, a `prettier --write` or a CRLF flip happened → restore + hand-apply the swap only. `git ls-files --eol <file>` stays `i/lf w/lf`. **`prettier --write` is forbidden on these modified pre-drifted files**; use `npx prettier --check <file>` (read-only) and accept pre-existing drift; if you must probe HEAD drift, write the probe INSIDE the repo tree (A81).
- [ ] **Task 5: DoD gate (per slice + final)** (AC: 5, 6) — per slice: `tsc` clean, `eslint <changed> --max-warnings=0`, the slice's nets + full `npm test -- --run` green, `prettier --check <changed>` (read-only). Final: `grep "min-h-\[calc(100vh-4rem)\]" frontend/src/features` returns only documented non-canonical/excluded files. LF (A73). `next build` deferred to epic boundary (A58).

## Dev Notes

This is **breadth, not depth**: each individual swap is trivial and byte-identical; the challenge is doing ~73 of them without (a) editing a net, (b) tripping the prettier-drift trap, or (c) silently changing a page that wasn't canonical. The green per-slice nets make (a) self-checking; the per-file `git diff --stat` makes (b)/(c) visible. Treat it as 13 small independent chores, committed separately.

### Scope Boundaries

- **In scope:** PageShell/PageHeader adoption on the canonical frame/header across the authenticated slices listed; optional tiny `PageShell` `maxWidth`-map extension for width-only outliers.
- **Out of scope (do NOT do):**
  - `app/page.tsx` (E30-S4), `app/module-unavailable` (E30-S2), `features/public/*` (E28 server-component shell — distinct surface; the `100vh-4rem` there offsets `PublicHeader`, not the authenticated chrome — leave it).
  - Editing any characterization-net spec to make the swap pass (a net needing edits means the swap wasn't byte-identical — fix the swap, not the test).
  - Any styling/copy/behaviour change, `prettier --write` on a modified page, the auth-guard logic, or the destructive-affordance/badge surfaces (A76/A80/A86 — the frame swap doesn't touch them; don't drive-by-change them).
  - Forcing PageShell onto a non-canonical page.

### Architecture Guardrails

- **Byte-identical or skip.** PageShell emits the exact `<main>`/`<div>` strings; PageHeader the exact header block. If a page differs, leave it inline. There is no "close enough."
- **The slice nets are the oracle (A87/A103).** They assert observable DOM (often the frame classes themselves) — they stay green because the strings are unchanged. Zero spec edits is the success signal; a needed spec edit is a red flag.
- **A72/A73/A81 (the headline risk):** ~73 pre-drifted files. Per-file: edit only the wrapper, hand-match style, `prettier --check` (never `--write`), keep LF, verify `git diff --stat` is tiny. This story is where the A72 trap is most likely to fire — guard every file.
- **Don't drive-by-fix the nested-`<main>`.** PageShell renders `<main>` (per E30-S1 DEC-1) — the pre-existing MainLayout-outer-main + page-inner-main stays. Changing it would alter DOM on every page (out of scope).
- **eslint:** `features/* → @/components/layout` is boundary-legal (the E30-S1 leaf rule restricts `components/layout`, not its consumers). No per-slice config change.
- DoD per epic. NEVER `npm run format`. LF (A73).

### A56 spike findings (load-bearing)

- **Work-list:** `grep -rl "min-h-\[calc(100vh-4rem)\]" frontend/src/features` = 75 files (2026-06-12); minus `features/public/{event-detail,events-list}.tsx` (E28, excluded) = **~73 authenticated targets** across ~13 slices (finance ~25, communication ~12, members ~9, admin-* ~10, events ~5, suppliers/sponsors 4+4, documents/board-documents/profile ~5). Re-run the grep at dev time — it is the authoritative list.
- **Canonical frame** (the swap target): [suppliers-page-content.tsx:87-88,140-150](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L87-L150) — `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">…</div></main>` with the canonical header at `:90-103`. Most slices were built from this template, so most are canonical; **detail/form pages more often carry bespoke headers** (back-link/status badge) → PageShell-frame-only there.
- **`max-w` varies** (`4xl`/`5xl`/`6xl`/`7xl` seen; PageShell's S1 map covers 4xl-7xl). A page outside the map → DEC-2.
- Guard/loading early-returns in the same file also use the frame (AC-2 — swap them too).

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — PageHeader breadth.** A) adopt `PageHeader` only where the header is the **exact** canonical title/description/actions block; leave bespoke headers (detail/form pages) inline under `PageShell`. B) also try to normalize bespoke headers into PageHeader (extend PageHeader props) — risks non-identical DOM. **Recommended: A** (PageShell frame everywhere it's canonical; PageHeader only on clean matches; bespoke headers stay inline — byte-identity first).
- **DEC-2 — width outliers.** A) extend `PageShell`'s `maxWidth` static map (+ its test) for any width that only differs by `max-w-*` (one tiny S1-file edit, keeps the page on the primitive). B) leave width-outlier pages inline. **Recommended: A** for pure width differences (cheap, completes coverage); B if the page also differs structurally.
- **DEC-3 — commit cadence.** A) commit per slice (independent, reviewable, matches session-pacing). B) one big commit. **Recommended: A** (per-slice commits; the boundary review can diff each).

### Testing Requirements

- **No new tests** are the primary deliverable — the existing per-slice nets are the oracle and must stay green **unmodified**. If a slice's net does NOT assert the frame (so the swap is unverified there), add a minimal frame assertion (A76 — pin the semantic surface) rather than leaving it unguarded; note which slices needed this.
- Re-run each slice's nets before (green at HEAD) and after the swap. A spec needing edits = the swap diverged → fix the swap.
- `// @vitest-environment jsdom` + `afterEach(cleanup)` apply to any new frame-assertion test (A35/A46).

### Project Structure Notes

- Edits are confined to existing `features/*/components/*.tsx` page/content files + their imports. Possibly one small edit to `frontend/src/components/layout/PageShell.tsx` (+ test) if DEC-2=A extends the map. No new slice, no route change.

### References

- Primitives: E30-S1 `e30-s1-introduce-pageshell-pageheader-layout-primitives.md`. Canonical frame: [suppliers-page-content.tsx:76-152](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L76-L152).
- Work-list: `grep -rl "min-h-\[calc(100vh-4rem)\]" frontend/src/features`. Slice template: [architecture-frontend.md §379](../../docs/architecture-frontend.md#L379).
- project-context.md A87/A103 (nets are the oracle), A72/A73/A81 (prettier-drift / LF / HEAD-probe — the headline risk), A76 (pin the frame surface if a net lacks it), A80/A86 (don't drive-by-change affordances/badges), A82 (this retires the tracked ~60-page retrofit residual), A58 (gates; build at boundary). Epic: `epics-and-stories.md` §E30 (expanded per user "Add both" 2026-06-12).

## Validation Notes

- Created 2026-06-12 — **added to E30 per the user's "Add both" scope decision**, which **explicitly authorizes overriding the epic's "no cosmetic mass changes" guardrail** for this one byte-identical consolidation. Status ready-for-dev. Excludes `page.tsx` (S4), `module-unavailable` (S2), and the public surface (E28). Phaseable per slice; independent of S2/S3/S4.
- The swap is a zero-DOM-diff structural consolidation gated on the existing per-slice nets — so it is not a behaviour change, just the removal of 73 hand-copied frames. The A72/A73/A81 prettier-drift discipline is the load-bearing safety rail. Three DECs carry recommended options.

## Dev Agent Record

### Agent Model Used

_(unset until dev-story runs)_

### Debug Log References

_(dev-story records A43 (a)/(b)/(c) per DEC + the per-slice green-net evidence here)_

### Completion Notes List

_(dev-story fills in — incl. the list of non-canonical pages left inline, per AC-4)_

### File List

_(dev-story fills in)_

## Change Log

- 2026-06-12: Story created (added to E30 per user "Add both") — byte-identical retrofit of `PageShell`/`PageHeader` across the ~73 migrated authenticated slice pages (excludes page.tsx/module-unavailable/public), gated per-slice on the existing E22-E29 char-nets, with the A72/A73/A81 prettier-drift discipline as the headline safety rail. DEC-1 PageHeader-on-canonical-only, DEC-2 extend-maxWidth-map-for-width-outliers, DEC-3 per-slice commits. Phaseable. Status ready-for-dev.
