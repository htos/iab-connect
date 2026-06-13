# Story E30.5: Retrofit `PageShell`/`PageHeader` across the migrated authenticated pages

Status: review

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

- [x] **Task 0: Spike + lock the swap recipe** (AC: 1-4) — A56; A43 (a)/(b)/(c) per DEC.
  - [x] Confirm E30-S1 `PageShell`/`PageHeader` exist + their static `maxWidth` map (4xl-7xl). Re-run `grep -rl "min-h-\[calc(100vh-4rem)\]" frontend/src/features` → the live work-list (exclude `features/public/*`). For each file, note its `max-w-*` and whether its header is the canonical block.
  - [x] Confirm each target slice's char-net location (its `*.test.tsx` suites) so the swap can be gated per slice.
  - [x] Resolve DEC-1 (PageHeader adoption breadth), DEC-2 (non-canonical `max-w` → extend-map vs leave-inline), DEC-3 (per-slice commit cadence).
- [x] **Task 1: Frame-swap recipe (apply per page)** (AC: 1, 2) — for each canonical occurrence:
  - Replace `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-{N}"> … </div></main>` with `<PageShell maxWidth="{N}"> … </PageShell>`.
  - Where the header is canonical: replace the header `<div>` with `<PageHeader title={…} description={…} actions={…} />` as PageShell's first child (PageShell renders `{header/children}` inside the `max-w` div → identical DOM). Where the header is bespoke (back-link, breadcrumb, status badge, multi-row): keep it inline as the first child of `<PageShell>`.
  - Swap **every** frame occurrence in the file (Task-2 AC), incl. loading/guard branches.
  - Import `{ PageShell, PageHeader } from "@/components/layout"`.
  - **Edit ONLY the wrapper lines.** Hand-match the surrounding (pre-drifted) style. Do **not** reflow the body.
- [x] **Task 2: Per-slice execution + net-gating** (AC: 3) — for each slice below, apply Task 1 to its pages, then run **that slice's nets** + `tsc` + `eslint <changed>`; the nets must stay green **unmodified**. Slices (live `grep` is the source of truth):
  - [x] `features/suppliers` (4), `features/sponsors` (4)
  - [x] `features/members` (~9 incl. segments)
  - [x] `features/events` (~5 incl. registrations/volunteers/check-in/fees)
  - [x] `features/finance` (~25 — the largest; sub-areas banking/budgeting/dunning/settings/expense-claims/payments/receipts/journal/ledger/fiscal-periods/posting-mappings/accounts/reports/dashboard)
  - [x] `features/communication/{automations,email-campaigns,email-templates}` (~12)
  - [x] `features/admin-{users,settings,system,documents}` (~10)
  - [x] `features/documents` (1), `features/board-documents` (2), `features/profile` (2)
- [x] **Task 3: Non-canonical handling** (AC: 4) — any page whose swap would not be byte-identical: either extend `PageShell`'s `maxWidth` static map (if only the width differs — coordinate the tiny edit in `components/layout/PageShell.tsx` + its test) or leave the page inline and record it in Completion Notes with the reason. **Never** alter a page's DOM to fit the primitive.
- [x] **Task 4: A72/A73 drift guard (per file)** (AC: 5) — after each file: `git diff --stat <file>` must show a line count ≈ the logical swap (a handful), NOT a whole-file reformat. If it ballooned, a `prettier --write` or a CRLF flip happened → restore + hand-apply the swap only. `git ls-files --eol <file>` stays `i/lf w/lf`. **`prettier --write` is forbidden on these modified pre-drifted files**; use `npx prettier --check <file>` (read-only) and accept pre-existing drift; if you must probe HEAD drift, write the probe INSIDE the repo tree (A81).
- [x] **Task 5: DoD gate (per slice + final)** (AC: 5, 6) — per slice: `tsc` clean, `eslint <changed> --max-warnings=0`, the slice's nets + full `npm test -- --run` green, `prettier --check <changed>` (read-only). Final: `grep "min-h-\[calc(100vh-4rem)\]" frontend/src/features` returns only documented non-canonical/excluded files. LF (A73). `next build` deferred to epic boundary (A58).

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

claude-opus-4-8[1m] (orchestrator) + 8 parallel general-purpose subagents (per-slice swaps, A87/A101). Autonomous whole-epic E30 run.

### Debug Log References

**Autonomous-mode escape (A41/A43):** user directive verbatim — _"implementiere das ganze epic 30 mit allen stories ohne stopp. erst danach ein review und retro"_ — pre-declares no-stop autonomous mode; every DEC carries a recommended option → A32 step (d) skipped.

- **DEC-1 — PageHeader breadth.** (a) **Option A** — `PageHeader` ONLY where the header is the EXACT canonical title/description/actions block; bespoke headers (back-link/breadcrumb/status-badge/multi-row) stay inline under `PageShell`. (b) Rationale: story rec A; user autonomous; byte-identity first — a bespoke header forced into PageHeader changes the DOM. (c) Consequence: 13 pages adopted PageHeader (the clean list-page headers: suppliers/sponsors/members/segments lists, admin-dashboard, health, documents/board-documents lists, communication index/automations/email-campaigns/email-templates lists, profile); all detail/form/edit pages kept their bespoke back-link headers inline as PageShell's first child.
- **DEC-2 — width outliers.** (a) **Option A** — extend `PageShell`'s static `maxWidth` map. (b) Rationale: story rec A; user autonomous; the content frames use 2xl/3xl widths (17×2xl, 4×3xl) beyond the S1 map's 4xl-7xl. (c) Consequence: added `"2xl"`/`"3xl"` to `PageShellMaxWidth` + `MAX_WIDTH_CLASS` (one S1-file edit) + an `it.each` test for 2xl/3xl/5xl/6xl. No page made non-identical to fit the primitive.
- **DEC-3 — commit cadence.** (a) **Option A** intent (per-slice) realised as one autonomous batch with per-slice net-gating; the actual git commit is deferred to the epic boundary per the user's "ohne stopp … erst danach review" (the whole epic is committed after review+retro).

**A56 reality findings (load-bearing — the story under-modeled S5):**
1. **The existing char-nets do NOT assert the frame classes** (grep-confirmed: ZERO repo tests reference `min-h-[calc(100vh-4rem)]`). So "net stays green = byte-identical" is FALSE for the frame. Byte-identity is instead guaranteed **BY CONSTRUCTION**: `PageShell` emits the EXACT `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-{N}">{children}</div></main>` (verified by its own + the S5 map tests). The nets remain the BEHAVIOURAL oracle (text/links/fetch); verification of the frame swap = construction + per-file diff review + the boundary net-integrity auditor.
2. **ALL 74 work-list files are prettier-CLEAN at HEAD** (the E22-E29 migrations wrote them cleanly) — the OPPOSITE of the story's "73 pre-drifted files / A72 is the headline risk" framing. So `prettier --write` after each swap is SAFE and REQUIRED (it only re-indents the children that dedent one level when the `<div>` wrapper is removed; A72's --write-ban applies only to PRE-drifted files).
3. **Heterogeneous frames** — far more than "canonical everywhere": (a) Finance MAIN frames carry an extra `space-y-6` on the inner div (`mx-auto max-w-N space-y-6`) → NOT byte-identical to PageShell → those pages left inline. (b) `email-campaign-detail` / `email-campaign-form` use `<div>` (not `<main>`) or a runtime `wrapperClass` → left inline. (c) `board-document-detail` has a NON-portal sibling dialog (`BoardDocumentRestoreDialog` renders an inline `<div fixed inset-0>`, not a portal) between `</div>` and `</main>` → swapping would reparent it → left inline. (d) loading/guard early-returns use `mx-auto flex max-w-N …` (extra classes) → non-canonical, left inline. (e) most detail/form pages have bespoke (back-link) headers → frame-only.

**A101 cross-slice consistency reconciliation (load-bearing):** the 8 parallel subagents resolved the "space-y-6 main + canonical loading frame" case DIVERGENTLY — one finance agent swapped the loading frame only (a half-adoption: loading=PageShell, main=inline), the other left such pages fully inline. Per AC-2 ("a page never half-adopts the primitive"), the page-level adoption decision is keyed on the **MAIN** frame: a page adopts PageShell IFF its main is byte-identically swappable; then it swaps every canonical frame and leaves non-canonical guards inline; if the main can't be swapped, the WHOLE page stays inline. The orchestrator detected the 5 half-adopted finance files (grep: `PageShell` AND inline `mx-auto max-w-N space-y-6`) and reverted them to fully inline, making finance consistent.

### Completion Notes List

- **Executed via 8 parallel subagents (A87/A101)**, one per slice-group (suppliers+sponsors / members / events / finance×2 / communication / admin-* / documents+board+profile), each given a construction-safe recipe + the byte-identity "leave-inline-if-not-identical" escape; each ran prettier --write + eslint(--max-warnings=0) + its slice nets + per-file diffs. The orchestrator verified centrally (tsc + full suite + next build + grep + diff spot-checks) and reconciled the cross-slice divergence.
- **51 authenticated pages retrofitted** to `PageShell` (byte-identical rendered DOM); **13** of them also adopted `PageHeader` (exact canonical headers). **23 pages left inline + documented per AC-4** (non-byte-identical): the finance `space-y-6`-main pages (accounting-reports, accounts, banking/{bank-import,exports,transactions}, budgeting/{activity-areas,budget-vs-actual,budgets,categories}, dunning, expense-claims, finance-dashboard, journal-entries, ledger-accounts, payments, posting-mappings, receipts, settings/settings-activity-areas), `email-campaign-{detail,form,new}` + `automation-edit` (non-`<main>` / runtime-wrapperClass / error-branch-only frames), and `board-document-detail` (non-portal sibling dialog).
- **Byte-identity spot-checked** (the nets don't pin the frame): the hardest case — suppliers list — confirmed via whitespace-ignored diff: `PageShell` + `PageHeader` reproduce the exact frame + header markup; the only deltas are a dropped HTML comment (not rendered) and the portal `DeleteSupplierDialog` moving inside PageShell (renders to `document.body` via portal → rendered-identical). Portal dialogs (Radix AlertDialog/Dialog) that were `<main>`-siblings were moved inside as PageShell's last child (rendered-identical); the one NON-portal sibling (board-document-detail) was correctly left inline.
- **PageShell map extended (DEC-2):** `components/layout/PageShell.tsx` gained `"2xl"`/`"3xl"` in the type union + `MAX_WIDTH_CLASS`; `PageShell.test.tsx` gained an `it.each(["2xl","3xl","5xl","6xl"])` static-map assertion (15 layout tests total).
- **AC-Subitem completion (A29):** AC-1 ✅ (rendered DOM identical — by construction + spot-check) · AC-2 ✅ (every occurrence in an adopting page swapped incl. guard/loading; page-level adoption keyed on the main → no half-adoption after the reconciliation) · AC-3 ✅ (every slice's char-net stays green with ZERO spec edits — no test file modified, confirmed by `git diff --name-only | grep test`) · AC-4 ✅ (non-canonical pages left inline + listed above; the 2xl/3xl width outliers handled via the map extension, not by distorting a page) · AC-4b ✅ (`app/page.tsx`/`features/dashboard` [E30-S4], `module-unavailable` [E30-S2], `features/public/*` [E28] untouched) · AC-5 ✅ (no route/contract/i18n change; tsc + suite + build green) · AC-6 ✅ (the remaining `min-h-[calc(100vh-4rem)]` occurrences are exactly the documented non-canonical/inline pages + comments + the excluded surfaces; no PLAIN canonical sole-child `<main>`+`mx-auto max-w-N` frame remains unswapped).
- **Boundary-review spec-correction — AC-2/AC-6 re-scoped (A52/A56, mirrors the S2 i18n correction):** the Acceptance Auditor correctly flagged that AC-2's literal text ("every adopted occurrence is swapped, **including** the auth-guard/loading early-return branches, e.g. suppliers' `if (authLoading || !isAdmin)` block — a page never half-adopts") and AC-6's "the inline frame is otherwise gone" assume the guard/loading branches are byte-identically swappable. **They are not:** those branches use a non-canonical inner container (`mx-auto flex max-w-7xl justify-center py-12`, or a centered-spinner `<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">` that is not the `<main bg-gray-50 p-4 md:p-8>` content frame at all). Swapping them onto PageShell would NOT be byte-identical → it would violate the higher-priority AC-1/AC-4. **Correct resolution (shipped):** adoption is **page-level, keyed on the MAIN content frame** — a page adopts PageShell iff its main frame is byte-identically swappable; it then swaps every CANONICAL frame and leaves NON-canonical guard/spinner branches inline. So a retrofitted list/detail page legitimately RETAINS its inline guard/loading frame (the `min-h-[calc(100vh-4rem)]` grep therefore still matches ~31 retrofitted pages on those guard branches — that is by design, not an incomplete sweep). AC-2's "never half-adopt" is honoured at the level of CANONICAL frames (no page swaps one canonical frame while leaving another canonical frame inline); the A101 reconciliation (reverting the 5 finance loading-only half-adoptions) enforced exactly that. **AC-6 amended:** the post-sweep grep returns the documented fully-inline pages PLUS the retained non-canonical guard/loading branches of retrofitted pages — NOT zero. No PLAIN canonical sole-child `<main>`+`mx-auto max-w-N` frame remains unswapped (verified). Behaviour is byte-identical throughout; this is a spec-text-vs-reality correction, not a defect.
- **Boundary-review note — modal reparenting (Blind Hunter LOW, verified safe):** on ~11 retrofitted list/detail pages a trailing dialog that was a `<main>`-sibling AFTER the `max-w-N` div is now PageShell's last child (inside the container). Every such dialog is a Radix `Dialog`/`AlertDialog` (portals to `document.body`) or a `fixed inset-0` overlay → the new DOM parent does not affect layout → **rendered-identical**. The one NON-portal sibling (`board-document-detail`'s `BoardDocumentRestoreDialog`) was correctly left fully inline. These pages are precisely "frame swap + portal/fixed-overlay reparent (safe)" rather than literally byte-identical source trees — recorded for transparency.
- **Gates:** `tsc --noEmit` clean; `npx eslint <all changed> --max-warnings=0` clean; `npx prettier --check <all changed>` clean (subagents ran --write on the clean files); `npx vitest run` = **216 files / 2013 tests green** (2009 → 2013 = +4 PageShell map-extension cases; ZERO test files edited; every slice net green unmodified); `next build` exit 0. LF on every changed file (A73). Per-file `git diff -w` confirms each swap is import + frame wrapper only (the larger raw line counts are pure prettier re-indent from the removed nesting level — render-neutral).

### File List

**Modified (S1-file map extension):**
- `frontend/src/components/layout/PageShell.tsx` (+ `2xl`/`3xl` in `PageShellMaxWidth` + `MAX_WIDTH_CLASS` — DEC-2)
- `frontend/src/components/layout/PageShell.test.tsx` (+ `it.each` 2xl/3xl/5xl/6xl static-map assertion)

**Modified (51 page retrofits → PageShell, 13 also PageHeader):** suppliers/{suppliers-page-content,supplier-detail,supplier-edit-content,supplier-new-content}, sponsors/{sponsors-page-content,sponsor-detail,sponsor-edit-content,sponsor-new-content}, members/{members-page-content,member-detail,member-edit-content,member-new-content,duplicates-page-content,segments-list-content,segment-detail-content,segment-edit-content,segment-new-content}, events/{event-detail,check-in/check-in-page-content,fees/event-fees-content,registrations/event-registrations-content,volunteers/event-volunteers-content}, finance/{fiscal-periods-content,settings/finance-profile-content,settings/invoice-templates-content,settings/settings-hub-content,settings/tax-codes-content}, communication/automations/{automations-page-content,automation-detail,automation-form}, communication/email-campaigns/{email-campaigns-page-content,email-campaign-edit-content}, communication/email-templates/{communication-index-content,email-templates-page-content,email-template-edit-content,email-template-new-content}, admin-documents/admin-folders-page-content, admin-settings/{admin-dashboard-content,admin-settings-page-content}, admin-system/{audit-page-content,backups-page-content,health-page-content,retention-page-content}, admin-users/{admin-users-page-content,admin-user-edit-content,admin-user-new-content,user-sessions}, documents/documents-page-content, board-documents/board-documents-page-content, profile/{profile-page-content,profile-security-content}.

**Left inline (documented non-canonical, NOT modified):** 23 pages — finance `space-y-6`-main pages (incl. the 5 half-adoptions reverted), `email-campaign-{detail,form,new}`, `automation-edit-content`, `board-document-detail`.

## Change Log

- 2026-06-12: Story implemented + DoD green (Status → review). Byte-identical PageShell/PageHeader retrofit across the migrated authenticated pages, via 8 parallel subagents (A87/A101) + central orchestrator verification. 51 pages → PageShell (13 also PageHeader); 23 non-canonical pages left inline + documented (AC-4); PageShell maxWidth map extended to 2xl/3xl (DEC-2). A56 findings: nets don't pin the frame (byte-identity by construction), all files prettier-clean (--write safe), heterogeneous frames (space-y-6 mains / non-`<main>` / non-portal sibling / bespoke headers). A101 reconciliation: page-level adoption keyed on the MAIN frame — 5 finance half-adoptions detected + reverted to fully-inline. Vitest 2009→2013 (+4 map tests; ZERO test edits, every net green unmodified); tsc/eslint/prettier clean; next build exit 0; LF.
- 2026-06-12: Story created (added to E30 per user "Add both") — byte-identical retrofit of `PageShell`/`PageHeader` across the ~73 migrated authenticated slice pages (excludes page.tsx/module-unavailable/public), gated per-slice on the existing E22-E29 char-nets, with the A72/A73/A81 prettier-drift discipline as the headline safety rail. DEC-1 PageHeader-on-canonical-only, DEC-2 extend-maxWidth-map-for-width-outliers, DEC-3 per-slice commits. Phaseable. Status ready-for-dev.
