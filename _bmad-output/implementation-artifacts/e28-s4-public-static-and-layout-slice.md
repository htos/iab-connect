# Story E28.S4: Public static and layout — feature-slice consolidation

Status: ready-for-dev

Depends on: **E28-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed). Independent of E28-S2/S3 once S1 is green. **References (does not move) `@/components/navigation/PublicHeader|PublicFooter`; the `PageShell` extraction is explicitly deferred to E30 — no `PageShell` primitive exists today (grep-confirmed clean across `frontend/src`).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the static License page and the Public layout shell consolidated into the `src/features/public/` slice,
so that the public navigation chrome is referenced once from the slice and the slice is complete.

## Acceptance Criteria

**Behaviour preserved (all E28-S1 license + layout-shell tests stay green):**

1. `public/license/page.tsx` renders **identical** static content after migration into the slice: `<h1>=t("title")`, `<p>=t("body")`, the `<pre>` with the repo `LICENSE` text on `fs.readFileSync` success, and the gnu.org `<a target="_blank" rel="noopener noreferrer">=t("viewExternal")` fallback + `console.warn` on `fs` failure. i18n namespace `publicLicense`, keys `title`/`body`/`viewExternal` unchanged. **It stays an async Server Component** (`fs` + `getTranslations` are server-only) — do NOT add `"use client"`, do NOT change the `process.cwd()/../LICENSE` repo-root walk.

2. `public/layout.tsx` continues to render the public header, footer, and `children` slot in the same structure for all nine pages: `<div className="flex min-h-screen flex-col"> <PublicHeader/> <main className="flex-1 pt-16">{children}</main> <PublicFooter/> </div>`. No route-group move, no change to which pages receive the shell, no provider added/removed. The `pt-16` (offsets the `fixed h-16` header) is preserved.

3. `frontend/src/components/navigation/PublicHeader.tsx` and `PublicFooter.tsx` continue to render the same nav links / branding (header: `/public/events`, `/public/sponsors`, `/public/blog`, `/public/newsletter`, `/public/contact`, logo→`/`, login→`/login`; footer: the same Quick-Links set + the **pre-existing** legal links to `/public/privacy` + `/public/imprint`). Their usage is **referenced, not duplicated** — same import paths `@/components/navigation/*`.

**Improvements:**

4. `public/license/page.tsx` becomes a **thin route entry** that renders a slice-owned Server-Component static page under `features/public/components/` (e.g. `license-content.tsx`), preserving the async/`getTranslations`/`fs`-fallback behaviour verbatim. No `api/` or `schemas/` additions (the page has zero network dependency — its only data source is the local filesystem). No client hooks (static content needs none).

5. `public/layout.tsx` is consolidated to reference the public navigation primitives once via the slice (a slice-owned thin layout composition that imports `PublicHeader`/`PublicFooter` from `@/components/navigation/`). **Do NOT duplicate the header/footer primitives, do NOT build a competing shell** (hard constraints). Defer extracting `PublicHeader`/`PublicFooter` into the slice — and adopting an E30 `PageShell` — until E30 exists; reference E30 `PageShell` once available rather than introducing a competing shell now.

6. Residual debt is documented in the story file (Completion Notes) so E30 can pick it up: (a) `PublicHeader`/`PublicFooter` remain in `@/components/navigation/` (slice references them) pending the E30 `PageShell` consolidation; (b) the footer's `/public/privacy` + `/public/imprint` links target pages that do not exist under `app/public/` today — they are pre-existing forward/dead links and are **left exactly as-is** (S4 must NOT fabricate those pages).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [ ] E28-S1 license + layout-shell specs green at HEAD. Confirm `features/public/` exists (S2 may have created it) or create the slice dir. Re-read `license/page.tsx`, `layout.tsx`, `PublicHeader.tsx`, `PublicFooter.tsx`, and `license/page.test.tsx` (A56). Confirm NO `PageShell` primitive exists (grep `frontend/src` for `PageShell`).
  - [ ] **DEC-1** (license home) + **DEC-2** (layout consolidation shape) + **DEC-3** (E30 PageShell deferral) — see DEC block.
- [ ] Task 1: License content component (AC: 1, 4) — create `features/public/components/license-content.tsx` as an `async` Server Component owning the `getTranslations("publicLicense")` + `fs.readFileSync(process.cwd()/../LICENSE)` + try/catch gnu.org fallback logic, byte-identical to `license/page.tsx:18-52`. No `"use client"`.
- [ ] Task 2: Thin license route entry (AC: 4) — `app/public/license/page.tsx` → `async function LicensePage(){ return <LicenseContent/>; }` (or re-export). Keep it async so the RSC test's `await LicensePage()` still works.
- [ ] Task 3: Layout consolidation (AC: 2, 3, 5) — move the shell composition into a slice-owned thin layout (e.g. `features/public/components/public-layout-shell.tsx`) that imports `PublicHeader`/`PublicFooter` from `@/components/navigation/` and renders the exact `div.flex.min-h-screen.flex-col > header + main.flex-1.pt-16{children} + footer` structure; `app/public/layout.tsx` becomes a thin wrapper that renders it. Preserve the `"use client"` boundary decision (DEC-2). No duplicate header/footer.
- [ ] Task 4: E30 deferral note (AC: 6) — add a clearly-marked `// TODO(E30): extract PublicHeader/PublicFooter into a slice-owned PageShell; reference E30 PageShell once it exists` at the consolidation site; record residual debt (a)+(b) in Completion Notes.
- [ ] Task 5: Green-the-net + DoD gate (AC: all) — E28-S1 license + layout-shell specs green UNCHANGED (license stays RSC → the `await Page()` harness still applies; only the import path moves). `tsc --noEmit` clean; `npx eslint` + `npx prettier --check` on changed files (A58/A72 — `--write` only on NEW slice files; hand-match style on the modified `app/public/license/page.tsx` + `layout.tsx` if pre-drifted); LF (A73). `git diff --stat` minimal.

## Dev Notes

The **simplest** E28 story and the **RSC reference** the other stories cite: the license page is already a working async Server Component (the de-risking precedent for the whole RSC premise). S4 is "relocate + consolidate", not "convert" — the AC-literal "extract as a Server-Component static page" reads as net-new but the page already ships as RSC (A56 correction). The only real work is moving the body into the slice and threading the layout shell through the slice while leaving the nav primitives where they are for E30.

### Scope Boundaries

- In scope: `features/public/components/license-content.tsx` (RSC) + the thin `app/public/license/page.tsx` entry; a slice-owned layout-shell composition referenced by `app/public/layout.tsx`; the E30 deferral TODO + residual-debt note.
- Out of scope: moving/copying `PublicHeader`/`PublicFooter` into the slice (E30); building any `PageShell` (E30); creating `/public/privacy` or `/public/imprint` pages (pre-existing dead links — leave as-is); any `api/`/`schemas/` for license (none needed); the content pages (S2) and form pages (S3).

### Architecture Guardrails

- **License MUST stay server-side.** `fs.readFileSync` has no browser equivalent and `getTranslations` is a `next-intl/server` API — a `"use client"` slice would break the build and the existing RSC test. The slice must tolerate one server-rendered page among otherwise-client pages (folder layout must NOT force a top-level `"use client"`).
- **No duplicate UI primitives** (hard constraint): the consolidated layout REFERENCES `@/components/navigation/PublicHeader|PublicFooter` — it does not re-implement them. `features → lib`/`components` imports are boundary-legal (E21-S5); the new slice needs NO new eslint config entry (generic `src/features/**` rule covers it).
- **Do not pre-empt E30.** Leave a TODO/reference, not a parallel shell abstraction.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`. New slice files may be `prettier --write`; for the modified `app/public/license/page.tsx` + `layout.tsx`, hand-match the surrounding style if pre-drifted (A72). LF (A73).

### A56 spike findings (load-bearing)

- **`license/page.tsx` is ALREADY an async Server Component** (`:18`) using `getTranslations` (`:4,:19`) + `fs.readFileSync(process.cwd()/"../LICENSE")` (`:24-27`) with a try/catch → gnu.org fallback (`:28-33,:44-51`); it never throws/500s by design (`:11-12`). Keys: `title`/`body`/`viewExternal` (`:37,:38,:50`). The existing `license/page.test.tsx` already pins both branches via the RSC archetype.
- **`public/layout.tsx` is `"use client"`** (`:1`) and provider-free; structure `div.flex.min-h-screen.flex-col > PublicHeader + main.flex-1.pt-16{children} + PublicFooter` (`:11-17`). A client layout legally renders the async license child via the `children` slot.
- **Header/Footer are client, reuse-by-reference.** Header hooks: `useTranslations`/`usePathname`/`useAppSettings`/`useState` (+`LanguageSwitcher`→`useChangeLocale`); Footer hooks: `useTranslations`/`useAppSettings`. **Neither uses next-auth.** Nav hrefs enumerated in AC-3.
- **NO `PageShell` exists** anywhere (`frontend/src` grep clean) → shell extraction is E30; S4 leaves a TODO.
- **Footer links `/public/privacy` + `/public/imprint` have no page** under `app/public/` (`PublicFooter.tsx:97,105`) — pre-existing forward/dead links; do NOT fabricate pages.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — license home.** A) move the body into `features/public/components/license-content.tsx` (RSC) + thin `app/public/license/page.tsx` re-export — mirrors every slice's thin-entry pattern. B) leave `license/page.tsx` in place (no slice file) — leaves the slice incomplete. **Recommended: A** (completes the slice; the test re-points the import only).
- **DEC-2 — layout consolidation + the `"use client"` directive.** A) move the shell composition into a slice component, keep its `"use client"` directive (lowest-risk — the directive is harmless and removing it is E30's call once `PageShell` lands). B) drop `"use client"` from the layout now (the body needs no client API today, so a Server layout would work) — but it's E30's scope and gains nothing here. **Recommended: A** (preserve the directive; defer the server-conversion of the shell to E30).
- **DEC-3 — E30 `PageShell` deferral.** A) reference `@/components/navigation/*` from the slice + leave a `TODO(E30)` + residual-debt note (no `PageShell` exists). B) build a `PageShell` now — **forbidden** (pre-empts E30, risks a competing shell, violates "no duplicate primitives"). **Recommended: A**.

### Testing Requirements

- The E28-S1 license + layout-shell specs are the oracle — they stay green; the license test continues to use `await LicensePage()` (RSC), only the import path moves. A35/A46 where new render-tests are added; A78 stable mocks.
- No new transport tests (no `api/` for license). If the slice layout-shell gets a focused unit test, mock `PublicHeader`/`PublicFooter` as passthroughs and assert the `children` slot + `pt-16` structure.

### Project Structure Notes

- Target tree: `features/public/components/{license-content.tsx, public-layout-shell.tsx}`; thin entries at `app/public/license/page.tsx` + `app/public/layout.tsx`. No `api/`, `hooks/`, `schemas/`, or `types/` added by this story.

### References

- `frontend/src/app/public/license/page.tsx` (`:18` async, `:24-27` fs read, `:28-33,:44-51` fallback); `frontend/src/app/public/license/page.test.tsx` (`:13-22` `next-intl/server` mock, `:37-38` `await Page()`).
- `frontend/src/app/public/layout.tsx` (`:1` `"use client"`, `:11-17` shell); `frontend/src/components/navigation/PublicHeader.tsx` (`:10-16` navLinks, `:27` `fixed h-16`), `PublicFooter.tsx` (`:48-113` links incl. `:97,105` dead legal links).
- `frontend/eslint.config.mjs` (`:50-64` `src/features/**` boundary — no new entry needed). `docs/architecture-frontend.md` "Pilot Result Note"; project-context.md A56/A58/A72/A73/A82 (deferred remainder must be tracked — the E30 PageShell debt). Epic: `epics-and-stories.md` §E28-S4.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E28 preparation (front-loaded batch per A34, "kein mvp mehr"). Status ready-for-dev. HARD-ordered after E28-S1; independent of S2/S3. Three DECs carry recommended options for A41/A32 + A43.
- **A56 spike findings (load-bearing):** license is ALREADY a working async Server Component (the AC-literal "extract as a Server Component" is relocation, not conversion — A56 spec correction) and the de-risking RSC reference for S2; layout is `"use client"`+provider-free and legally renders the async license child; header/footer are reuse-by-reference (E30 extraction deferred — no `PageShell` exists, A82 residual-debt tracked); footer has pre-existing dead legal links to leave alone. No transport, no schemas, no i18n work.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (license RSC relocation + layout-shell consolidation into `features/public/`; header/footer reuse-by-reference; E30 `PageShell` deferral + residual-debt note; DEC-1 license-thin-entry, DEC-2 keep-`"use client"`-layout, DEC-3 defer-PageShell). Status ready-for-dev.
