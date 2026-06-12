# Story E30.1: Introduce and consolidate `components/layout` primitives (PageShell, PageHeader)

Status: ready-for-dev

Depends on: **E21-S3 + E21-S5 (closed)**. First story of Epic E30 — lands the shared primitives that E30-S2/S3 adopt. **Picks up the E28-S4 residual debt** (the `TODO(E30)` markers in `features/public/components/public-layout-shell.tsx` + `app/public/layout.tsx`). No story blocks on S1 except E30-S2/S3.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want shared `PageShell` and `PageHeader` layout primitives that lift the repeated authenticated page-content frame into one tested wrapper,
so that the auth/system/root surfaces (E30-S2/S3) and any future page have one consistent, tested page-frame instead of ad-hoc per-page `<main>` markup.

## ⚠️ Load-bearing disambiguation — read this before AC

The epic goal phrases this as "introduce PageShell/PageHeader **by composing** `components/navigation/{MainLayout,Header,Sidebar}`". **That phrasing is imprecise and a literal reading is a disaster.** The ground truth (verified against the code):

- `MainLayout` (+ `Header`/`Sidebar`) is mounted **once** in the root `app/layout.tsx` and renders the authenticated chrome (sidebar + header + the outer `<main className="… pt-16 …">` wrapper) around **all** authenticated pages — see [MainLayout.tsx:30-41](../../frontend/src/components/navigation/MainLayout.tsx#L30-L41).
- Each page then renders its **own** inner content frame `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">…</div></main>` — that inner frame is what repeats 116× across 60 files (`grep min-h-\[calc\(100vh-4rem\)\]`).
- **PageShell/PageHeader extract ONLY that inner content frame.** They do **NOT** import, render, or re-implement `MainLayout`/`Header`/`Sidebar`, the sidebar context, or any responsive chrome. "Compose `components/navigation`" here means *"these primitives are designed to sit inside the chrome MainLayout already provides — and must not duplicate it"*, NOT *"render MainLayout inside PageShell"*. Rendering MainLayout inside PageShell would produce double chrome / nested sidebars — a regression on every adopting page. **PageShell imports nothing from `components/navigation`.**

## Acceptance Criteria

**Behaviour preserved:**

1. The root `layout.tsx` `MainLayout` mount, `BetaBanner`, and `LicenseFooter` ordering are **untouched** — `PageShell` lives in `components/layout/`, is mounted by *pages*, and never appears in the root layout. Chrome rendering is byte-identical (no page adopts PageShell in S1; S1 only *introduces* the primitives).
2. No `components/navigation` file is modified. No sidebar/header/responsive logic moves out of `components/navigation`. `PageShell`/`PageHeader` import **nothing** from `@/components/navigation`.
3. "Reconcile any provisional `PageShell` usages introduced in E22-E29" — **there are none** (grep-confirmed: the only `PageShell` string matches in `frontend/src` are the two `TODO(E30)` comments left by E28-S4). So this AC sub-item resolves to: introduce the primitive cleanly + close the two E28 TODO markers (AC-7). **Do NOT retrofit the ~60 existing authenticated pages** — that is out of E30 scope (see Scope Boundaries).
4. `npm run typecheck` + `npm test -- --run` stay green; no existing test is modified to pass.

**Improvements (the deliverable):**

5. New primitives live at `frontend/src/components/layout/PageShell.tsx` and `frontend/src/components/layout/PageHeader.tsx`, with a barrel `frontend/src/components/layout/index.ts` mirroring the navigation-barrel convention ([navigation/index.ts](../../frontend/src/components/navigation/index.ts) — plain `export { X } from "./X"` lines).
6. `PageShell` props: `children` + optional `header` slot + optional `maxWidth` (default the dominant `7xl`); it renders the exact frame `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-{N}">{header}{children}</div></main>`. `PageHeader` props: `title` (string) + optional `description` (string) + optional `actions` slot; it renders the exact header block `<div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>{description && <p className="mt-1 text-gray-600">{description}</p>}</div>{actions}</div>`. Typed props, **no `any`**, no inline hex (reuse the existing Tailwind utility classes verbatim — they already map to the E21 token layer).
7. The two E28-S4 `TODO(E30)` markers are resolved (AC-7) — see Task 4. PublicHeader/PublicFooter **stay** in `@/components/navigation/` (they are chrome, like Header/Sidebar — the hard constraint forbids moving header logic out of `components/navigation`); the public shell stays `features/public/components/public-layout-shell.tsx`. The TODO comments are updated to record this **final** resolution (not left dangling) so E31 sees closed debt, not an open promise.

## Tasks / Subtasks

- [ ] **Task 0: Spike + resolve DECs** (AC: all) — A56 existing-implementation spike; record A43 (a)/(b)/(c) for each DEC in Debug Log.
  - [ ] Grep `frontend/src` for `PageShell`/`PageHeader` → confirm the only hits are the two E28 `TODO(E30)` comments (no provisional component exists; AC-3 is a clean introduction).
  - [ ] Confirm `frontend/src/components/layout/` does **not** exist yet and `components/ui` has no `index.ts` barrel (so the barrel convention to mirror is `components/navigation/index.ts`).
  - [ ] Read [suppliers-page-content.tsx:76-152](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L76-L152) to lock the exact frame + header markup the primitives must reproduce. Note the per-page `max-w-*` varies (suppliers `7xl`, module-unavailable `4xl`) → `maxWidth` prop with a **static class map** (DEC-2).
  - [ ] Resolve DEC-1 (`<main>` vs `<div>` element), DEC-2 (maxWidth handling), DEC-3 (E28 residual resolution), DEC-4 (eslint leaf-boundary for `components/layout`).
- [ ] **Task 1: `PageShell.tsx`** (AC: 6) — presentational, prop-driven, no `"use client"` (no hooks/state). Render `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className={\`mx-auto ${maxWidthClass}\`}>{header}{children}</div></main>`. `maxWidthClass` comes from a **static lookup object holding full class strings** (`{ "4xl": "max-w-4xl", "5xl": "max-w-5xl", "6xl": "max-w-6xl", "7xl": "max-w-7xl" }`, default `"7xl"`) — **never** template-interpolate `max-w-${maxWidth}` (Tailwind's JIT cannot see interpolated classes → the width silently disappears). Typed `PageShellProps` interface, no `any`.
- [ ] **Task 2: `PageHeader.tsx`** (AC: 6) — presentational. Render the header block verbatim from the spike (title `<h1>`, optional `description` `<p>` rendered only when truthy, optional `actions` slot). Typed `PageHeaderProps`, no `any`. No `"use client"`. **Title/description are resolved strings passed in by the consumer** — `PageHeader` does NOT call `useTranslations` (the consuming page owns i18n; keeps the primitive pure + server-renderable).
- [ ] **Task 3: Barrel `index.ts`** (AC: 5) — `export { PageShell } from "./PageShell"; export { PageHeader } from "./PageHeader";` plus `export type { PageShellProps } from "./PageShell"; export type { PageHeaderProps } from "./PageHeader";` if the prop types are useful to consumers. Mirror navigation/index.ts style.
- [ ] **Task 4: Close the E28-S4 residual TODO markers** (AC: 7) — DEC-3. In [public-layout-shell.tsx:13-18](../../frontend/src/features/public/components/public-layout-shell.tsx#L13-L18) (and the matching note in `app/public/layout.tsx`), replace the open `TODO(E30): extract … into a slice-owned PageShell` promise with a **resolution comment**: PublicHeader/PublicFooter intentionally remain in `@/components/navigation/` (chrome, mirroring Header/Sidebar — moving header logic out is a hard-constraint violation); `PageShell` (the authenticated content-frame primitive introduced in E30-S1) does **not** apply to the public surface, whose shell is the distinct `public-layout-shell.tsx`. No code change to the public shell — comment-only. (These are pre-drifted files: comment-only edit, hand-match surrounding style, do NOT `prettier --write`, per A72/A81.)
- [ ] **Task 5 (DEC-4): eslint leaf-boundary for `components/layout`** — add a fourth entry to `boundaryRules` in [eslint.config.mjs](../../frontend/eslint.config.mjs#L10-L66) mirroring the `components/ui` rule: `files: ["src/components/layout/**/*.{ts,tsx}"]`, `no-restricted-imports` forbidding `@/features`/`@/features/**`/`@/app`/`@/app/**` with a message "components/layout is a shared presentational layer and must not import from features or app (E21 boundary)." This keeps PageShell a true leaf (it must not reach into a feature). Features importing `@/components/layout` stays legal (no rule restricts the consumer direction).
- [ ] **Task 6: Tests** (AC: 4, 6) — `PageShell.test.tsx` + `PageHeader.test.tsx`. Both call Testing-Library `render()` → **mandatory** `// @vitest-environment jsdom` at file top + `import { cleanup } from "@testing-library/react"; afterEach(cleanup);` (A35/A46). No hooks/i18n in the primitives → **no `next-intl` mock, no stable-ref concern (A78 N/A)** — pass plain strings/nodes as props.
  - [ ] PageShell: renders `children`; default container is `max-w-7xl`; `maxWidth="4xl"` yields `max-w-4xl` (assert the class is present, proving the static-map path); the `<main>` carries `min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8`; the optional `header` slot renders above `children` when provided and is absent otherwise.
  - [ ] PageHeader: renders `title` as an `<h1>`; `description` `<p>` present when passed and **absent** when omitted; `actions` slot present when passed and absent otherwise.
- [ ] **Task 7: DoD gate** (AC: 4) — `npm run typecheck` clean; `npx eslint frontend/src/components/layout/** frontend/eslint.config.mjs` (and the 2 touched public files) `--max-warnings=0`; `npx prettier --write` on the **new** `components/layout` files only, `--check` (read-only, hand-matched) on the pre-drifted public files (A72); `npm test -- --run` — new tests green, **full suite unchanged otherwise** (no existing spec edited). LF on every edited file (A73). `git diff --stat` minimal (the public-file diffs are comment-only).

## Dev Notes

S1 is **pure additive infrastructure**: two presentational primitives + a barrel + two tests + one eslint entry + one comment-only resolution of E28 debt. No page adopts them in S1 (that is S2/S3), so there is zero behaviour-change risk to any existing page — the green-suite proof is "the full suite is unchanged and the two new tests pass." The whole value is getting the primitive's **shape** exactly right so S2/S3 (and any future retrofit) adopt it without per-page divergence.

### Scope Boundaries

- **In scope:** `components/layout/{PageShell.tsx, PageHeader.tsx, index.ts, PageShell.test.tsx, PageHeader.test.tsx}`; one `eslint.config.mjs` boundary entry; comment-only resolution of the two E28 `TODO(E30)` markers.
- **Out of scope (do NOT do in S1):**
  - **Retrofitting the ~60 existing authenticated pages** to use `PageShell`/`PageHeader`. They were migrated in E22-E29 with inline frame markup before the primitive existed; sweeping all 60 is a "cosmetic mass change" (epic hard constraint) and a preserve-vs-improve risk. It is tracked as **out-of-E30 residual** (A82) — surfaced to the user as a candidate follow-up story, not silently dropped.
  - Touching `MainLayout`/`Header`/`Sidebar`/`SidebarContext` or the public shell structure.
  - Adopting PageShell anywhere (S2 adopts it on `module-unavailable`; S3 evaluates the root page).
  - "Fixing" the pre-existing nested-`<main>` (MainLayout's outer `<main>` + the page's inner `<main>`). PageShell reproduces the inner `<main>` verbatim to stay byte-identical; the double-`main` a11y nit is pre-existing and out of scope.

### Architecture Guardrails

- **PageShell ≠ chrome.** Re-read the load-bearing disambiguation above. PageShell is the inner content frame only; it imports nothing from `components/navigation`. A dev rendering `<MainLayout>` inside PageShell has misread the epic.
- **`components/layout` is the correct home** — [architecture-frontend.md:152-154](../../docs/architecture-frontend.md#L152-L154) names `components/layout` as the planned shared layer "(if/when introduced)"; this story introduces it. `src/components` is for domain-neutral shared code; these primitives are domain-neutral.
- **Tailwind token layer (A77):** reuse the existing utility classes verbatim (`bg-gray-50`, `text-gray-900`, `text-gray-600`, `md:text-3xl`, etc.). No inline hex, no global token sweep. The classes already resolve through the E21 `globals.css` token layer.
- **Static maxWidth map (Tailwind JIT):** the single most likely silent bug. `max-w-${prop}` is invisible to Tailwind → the constraint vanishes and the page goes full-bleed. Use a literal-string lookup object. Tested by the `maxWidth="4xl"` assertion.
- **Presentational + prop-driven**, identical boundary to the `features/suppliers`/`features/sponsors` template — no state, no hooks, server-renderable (no `"use client"`). This lets a Server Component page (should any adopt it) use PageShell without a client boundary.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`. `prettier --write` only on the **new** files; hand-match the pre-drifted public files (A72/A81 — if you must probe HEAD drift, write the probe INSIDE the repo tree so `.prettierrc`+the tailwind plugin resolve). LF (A73).

### A56 spike findings (load-bearing)

- **No `PageShell`/`PageHeader` exists.** The two `frontend/src` grep hits are E28 `TODO(E30)` comments in [public-layout-shell.tsx](../../frontend/src/features/public/components/public-layout-shell.tsx#L13-L18) + `app/public/layout.tsx`. Clean introduction; nothing to reconcile.
- **Exact frame to reproduce** ([suppliers-page-content.tsx:87-88](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L87-L88)): `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-7xl">`. `100vh-4rem` offsets MainLayout's `h-16`/`pt-16` header.
- **Exact header to reproduce** ([suppliers-page-content.tsx:90-103](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L90-L103)): the `mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between` wrapper, `h1.text-2xl.font-bold.text-gray-900.md:text-3xl`, `p.mt-1.text-gray-600`, then an actions node (a `+ Create` `<Link>` in suppliers). The `actions` slot is generic — the consumer passes whatever (a Link, buttons, or nothing).
- **`max-w-*` varies per page** → `maxWidth` prop is necessary (suppliers `7xl`; [module-unavailable](../../frontend/src/app/module-unavailable/page.tsx) `4xl`). Default `7xl` (the dominant value).
- **`components/ui` has no barrel** → mirror `components/navigation/index.ts` for the barrel convention.
- **eslint** ([eslint.config.mjs:10-66](../../frontend/eslint.config.mjs#L10-L66)) restricts `components/ui` + `lib` as leaves and `features/**` cross-imports; `components/layout` has no entry yet → DEC-4 adds the leaf rule. The generic config already permits `features → @/components/layout`.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — root element of PageShell.** A) render `<main>` (matches the existing per-page markup byte-for-byte; preserves the pre-existing nested-`<main>` so any future adoption is a zero-DOM-diff swap). B) render `<div>` (cleaner single-`main` a11y) — but every existing page uses `<main>`, so B diverges from HEAD and breaks byte-identity for adopters. **Recommended: A** (`<main>`; the nested-main cleanup, if ever wanted, is a separate cross-cutting a11y story).
- **DEC-2 — maxWidth handling.** A) `maxWidth` prop + static class-map, default `7xl`. B) hardcode `max-w-7xl` (no prop) — fails `module-unavailable`'s `4xl` and any future non-7xl page. **Recommended: A** (static map; never interpolate).
- **DEC-3 — E28 residual debt.** A) resolve the two `TODO(E30)` markers comment-only: PublicHeader/PublicFooter stay in `components/navigation` (chrome), public shell stays in `features/public`, PageShell does not apply to the public surface. B) actually move PublicHeader/PublicFooter into a slice/PageShell now — **forbidden** (moves header logic out of `components/navigation`, a hard constraint; conflates the public shell with the authenticated content-frame). **Recommended: A**.
- **DEC-4 — eslint leaf-boundary for `components/layout`.** A) add the leaf rule (forbid `components/layout → features/app`), consistent with `components/ui`, cheap, "no longer an MVP" thoroughness. B) rely on the generic config (no explicit rule) — works, but leaves the new shared layer unguarded against a future feature back-import. **Recommended: A**.

### Testing Requirements

- Both test files call `render()` → `// @vitest-environment jsdom` + `afterEach(cleanup)` are **mandatory** (A35/A46). The primitives have no hooks/i18n/memoized deps → A64/A78 stable-ref discipline is **N/A** (no `next-intl` mock needed; pass literal strings).
- Assert the **class strings** that matter (`min-h-[calc(100vh-4rem)]`, `bg-gray-50`, `p-4`, `md:p-8`, `max-w-7xl`/`max-w-4xl`, header `<h1>` classes) so a future refactor that silently changes the frame is caught (A76 — pin the semantic surface, here the layout classes).
- No transport/i18n/RHF tests (presentational primitives). No `next build` needed at story close (A58 — boundary runs it).

### Project Structure Notes

- Target tree: `frontend/src/components/layout/{PageShell.tsx, PageHeader.tsx, index.ts, PageShell.test.tsx, PageHeader.test.tsx}`. One edit each to `frontend/eslint.config.mjs`, `frontend/src/features/public/components/public-layout-shell.tsx`, `frontend/src/app/public/layout.tsx` (latter two comment-only).
- No `api/`, `hooks/`, `schemas/`, `types/` (presentational primitives carry their prop types inline).

### References

- Frame/header source: [suppliers-page-content.tsx:76-152](../../frontend/src/features/suppliers/components/suppliers-page-content.tsx#L76-L152).
- Chrome (do NOT touch): [MainLayout.tsx](../../frontend/src/components/navigation/MainLayout.tsx); barrel convention: [navigation/index.ts](../../frontend/src/components/navigation/index.ts).
- eslint boundary: [eslint.config.mjs:10-66](../../frontend/eslint.config.mjs#L10-L66). Architecture: [architecture-frontend.md:152-154](../../docs/architecture-frontend.md#L152-L154) (`components/layout` planned), [Pilot Result Note §379](../../docs/architecture-frontend.md#L379) (slice template).
- E28 residual: [public-layout-shell.tsx:13-18](../../frontend/src/features/public/components/public-layout-shell.tsx#L13-L18); E28-S4 story `e28-s4-public-static-and-layout-slice.md` (Completion Notes residual-debt (a)).
- project-context.md A77 (token-not-comment), A76 (pin semantic surface), A82 (track deferred remainder), A58/A72/A73/A81 (gates/drift). Epic: `epics-and-stories.md` §E30-S1.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E30 preparation (front-loaded batch per A34; user: "implementations ready machen … nicht mehr ein mvp"). Status ready-for-dev. First story of E30; blocks E30-S2/S3.
- **Spec-vs-reality corrections folded in (A52/A56):** (1) the epic's "compose `components/navigation`" phrasing is corrected to the real "inner-content-frame extraction, no chrome import" via the load-bearing disambiguation; (2) the "reconcile provisional PageShell usages from E22-E29" AC is a no-op (none exist) and resolves to closing the two E28 TODO markers; (3) the ~60-page retrofit is explicitly excluded from E30 and surfaced to the user as a candidate follow-up. Four DECs carry recommended options for A41/A32 + A43.

## Dev Agent Record

### Agent Model Used

_(unset until dev-story runs)_

### Debug Log References

_(dev-story records A43 (a)/(b)/(c) per DEC here)_

### Completion Notes List

_(dev-story fills in)_

### File List

_(dev-story fills in)_

## Change Log

- 2026-06-12: Story created — introduce `components/layout/{PageShell,PageHeader}` (inner content-frame + header-block primitives, presentational, static maxWidth map) + barrel + tests + `components/layout` eslint leaf-boundary + comment-only resolution of the E28-S4 `TODO(E30)` markers. DEC-1 `<main>`, DEC-2 static maxWidth map, DEC-3 resolve-E28-debt-comment-only, DEC-4 add-eslint-leaf-rule. ~60-page retrofit excluded from E30 (tracked residual). Status ready-for-dev.
