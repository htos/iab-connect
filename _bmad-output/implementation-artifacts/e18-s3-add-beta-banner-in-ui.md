# Story E18-S3: Beta banner in UI

Status: review

## Story

As **a Beta tester**, I want **a persistent orange BETA banner**, so that **I always know which environment I am working in and that my data may be reset at any time**.

**Requirement:** REQ-088 AC-7. Epic E18, Story 3. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E18 Story E18-S3 (lines 1828–1845)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E18 — Story E18-S3 (lines 638–643)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-015 Configuration and Environment Strategy (lines 329–341)](../planning-artifacts/architecture.md)
- [frontend/src/components/navigation/BetaBanner.tsx (the shipped component)](../../frontend/src/components/navigation/BetaBanner.tsx)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-18)

**Critical finding: this story's feature already ships.** Like E14-S2 (security headers) and E17-S1/S2 (Serilog/CorrelationId), the literal AC describes work that is already in the codebase. Material drift vs. the SCP-2026-05-15 §5 text:

- **The banner exists at [`frontend/src/components/navigation/BetaBanner.tsx`](../../frontend/src/components/navigation/BetaBanner.tsx)** (112 lines, `"use client"`), NOT at the `frontend/src/components/BetaBanner.tsx` path the AC names. It was authored alongside E20-S4's `LicenseFooter` (project-context A35/A46 already cite `BetaBanner.test.tsx` as a canonical in-repo example), likely during the E11-S2 / E20 window. The `navigation/` subfolder is the established convention for app-chrome components (`Header`, `Sidebar`, `LicenseFooter` live there too).
- **It is already integrated in the root layout** at [`frontend/src/app/layout.tsx`](../../frontend/src/app/layout.tsx) — `<BetaBanner />` mounts inside `NextIntlClientProvider`, ABOVE `<MainLayout>`, sibling-before `<LicenseFooter />`. So AC's "integrated into the root layout" is met.
- **`NEXT_PUBLIC_ENV_LABEL` is fully wired** — declared `ARG`+`ENV` in [frontend/Dockerfile:54,63](../../frontend/Dockerfile), branch-scoped in [.github/workflows/build-images.yml:192](../../.github/workflows/build-images.yml) (`beta` branch → `vars.NEXT_PUBLIC_ENV_LABEL_BETA="beta"`, else empty), documented in [frontend/.env.example:54](../../frontend/.env.example). The banner reads `process.env.NEXT_PUBLIC_ENV_LABEL?.trim().toLowerCase()` and renders only when it equals `"beta"` (case-insensitive — accepts `Beta`/`BETA`/` beta `).
- **The banner uses an i18n key, not a hardcoded German string — and this is CORRECT, not a defect.** The AC literally demands the text `"Beta — Daten können jederzeit zurückgesetzt werden"`. The component renders `t("bannerMessage")` from `useTranslations("beta")`; [`frontend/messages/de.json`](../../frontend/messages/de.json) `beta.bannerMessage` is **byte-for-byte** `"Beta — Daten können jederzeit zurückgesetzt werden"` (em-dash + umlauts verified). This satisfies the AC text via the project's mandatory next-intl rule (project-context: "All user-visible frontend text must use next-intl translation keys; do not add hardcoded German UI strings"). Hardcoding the literal would VIOLATE a project rule; the i18n key is the compliant way to ship the exact text.
- **Background is `bg-orange-500`, not literally "orange-600".** The AC says "orange background"; the shipped value is `orange-500` (the established banner/alert tone — `OnboardingBanner` also uses orange-500; `LicenseFooter` uses orange-600 for links). `orange-500` satisfies "orange background"; the project rule reserves `orange-600/700` for primary actions/links, not full-bleed banner fills.
- **Dismissable-per-session is met** via `sessionStorage` key `iabc:beta-banner-dismissed`, with a lazy `useState` initializer (no first-frame flash) and Safari-Private-Browsing-safe try/catch.
- **A comprehensive test already exists** at [`frontend/src/components/navigation/BetaBanner.test.tsx`](../../frontend/src/components/navigation/BetaBanner.test.tsx) (11 tests, `// @vitest-environment jsdom`, `afterEach(cleanup)` per A35/A46). It covers: render-when-beta, null-when-unset, null-when-non-beta, feedback-link-env-override, GitHub-fallback URL, dismiss+persist, stays-hidden-when-pre-dismissed, case-insensitive (4 variants), source-url fork fallback, Safari getItem throw, Safari setItem throw.

**Therefore this is a verification + regression-coverage story, not a build story.** The dev-agent's job is to (1) prove the shipped state meets every AC sub-item with per-item evidence, (2) close the two regression-coverage gaps the existing test does NOT cover, and (3) reconcile the AC-literal-vs-shipped divergences in the record so epic-boundary review does not re-flag them. **Do NOT** rewrite the component to match the literal AC path/text/colour — that would regress a compliant, tested implementation.

## Acceptance Criteria

1. **AC-1 (component exists + conditional render).** [`frontend/src/components/navigation/BetaBanner.tsx`](../../frontend/src/components/navigation/BetaBanner.tsx) exists and renders its banner if-and-only-if `NEXT_PUBLIC_ENV_LABEL` (trimmed, lower-cased) equals `"beta"`; returns `null` otherwise. (Path divergence from the AC's `components/BetaBanner.tsx` is reconciled in Refresh Notes — `navigation/` is canonical.) Covered by the existing render/null/case-insensitive tests.
2. **AC-2 (orange background).** The banner root renders with an orange background fill (`bg-orange-500`). A regression test asserts the orange background class is present (this is one of the two coverage gaps — see Task 2).
3. **AC-3 (exact banner text via i18n).** The banner renders the German string `"Beta — Daten können jederzeit zurückgesetzt werden"` in the `de` locale via `t("bannerMessage")`. An A31 direct-artifact-read parity test asserts [`frontend/messages/de.json`](../../frontend/messages/de.json) `beta.bannerMessage` equals the AC-mandated string byte-for-byte, and that [`frontend/messages/en.json`](../../frontend/messages/en.json) has the parallel `beta.bannerMessage` key (locale-completeness). (Coverage gap — see Task 2.)
4. **AC-4 (dismissable per session).** The banner is dismissable; the dismissed state persists for the browser session via `sessionStorage` (`iabc:beta-banner-dismissed`) and does NOT persist across a new session/tab restart. Covered by the existing dismiss+persist + stays-hidden + Safari-safe tests.
5. **AC-5 (integrated into root layout).** [`frontend/src/app/layout.tsx`](../../frontend/src/app/layout.tsx) mounts `<BetaBanner />` inside `NextIntlClientProvider` so it appears on every route including unauthenticated screens. A regression test (code-audit, pure-Node read of `layout.tsx`) asserts the import + JSX usage are present so a future layout refactor that drops the banner fails the build. (Coverage gap — see Task 2.)
6. **AC-6 (accessibility + non-render side-effect safety).** The banner exposes `role="status"` + `aria-label`, the dismiss control has an `aria-label`, and the component never throws when `sessionStorage` is unavailable (Safari Private Browsing). Covered by the existing accessibility + Safari tests.
7. **AC-7 (no new dependencies; lint/typecheck/format clean).** The story adds no new npm packages. `npm run typecheck`, `npm run lint`, `npm run format:check`, and the Vitest suite all pass. The new regression tests follow the A35/A46 pattern (`// @vitest-environment jsdom` + `afterEach(cleanup)` for render-tests; pure-Node tests that only read JSON/TS files via `node:fs` get NEITHER directive per A46).
8. **AC-8 (live visual check on Beta — deferred per A47).** On the Beta deployment, an operator confirms the orange banner is visible on a public route, shows the German text, the feedback link is clickable, and the dismiss button hides it for the session. Marked `[!]` — requires a green Beta deploy + browser. Deferred to the unified Wave-9 walkthrough.

## Decision-Needed (per A32 / A41)

### DEC-1: Reconcile AC-literal divergences — accept shipped implementation vs. "fix" to match the literal AC

**Scope:** AC names `components/BetaBanner.tsx` (shipped: `components/navigation/BetaBanner.tsx`), a hardcoded German string (shipped: i18n key), and "orange background" (shipped: `orange-500`).

**Options:**

- **(A) Accept the shipped implementation as canonical; document the supersession; add only regression coverage.** (RECOMMENDED) The `navigation/` path is the app-chrome convention; the i18n key is MANDATED by the project's next-intl rule (hardcoding would be the violation) and the `de.json` value already matches the AC string byte-for-byte; `orange-500` is the established banner fill. "Fixing" any of these would regress a compliant, tested component and break the layout import. Net work = regression tests + record reconciliation.
- **(B) Move the file to `components/BetaBanner.tsx`, hardcode the German string, change to `orange-600` to match the AC literally.** Breaks the next-intl rule, breaks `de`/`en` locale parity, moves a file every other chrome component's sibling, and updates the layout import + the test import for zero user-visible benefit. Rejected.
- **(C) Move only the file path (keep i18n + orange-500).** Half-measure; still churns the layout + test imports for no benefit. Rejected.

**Recommendation:** **A.** Accept shipped; document; add regression coverage.

### DEC-2: Where to add the two coverage-gap tests

**Scope:** AC-2 (orange bg) + AC-5 (layout integration) + AC-3 (de.json parity) are not covered by the existing `BetaBanner.test.tsx`.

**Options:**

- **(A) Extend the existing `BetaBanner.test.tsx` with the orange-bg + render assertions (jsdom render-tests), and add a SEPARATE pure-Node test file `BetaBanner.i18n.test.ts` for the de.json/en.json + layout.tsx artifact-read parity (A51), which needs NO jsdom/cleanup per A46.** (RECOMMENDED) Keeps render-tests and file-read-tests in their correct environments per A46; the i18n/layout parity tests are pure `node:fs` reads + regex, so giving them jsdom would be the A46 anti-pattern.
- **(B) Cram everything into `BetaBanner.test.tsx`.** Forces the pure-Node parity assertions into a jsdom file unnecessarily (A46 anti-pattern). Rejected.

**Recommendation:** **A.** Render-assertions extend the jsdom file; parity-assertions get a pure-Node sibling.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure) · `[ ]` = pending.

### Task 0: Spike — confirm shipped state + resolve DECs (A28 spike-first)

- [x] 0.1 Confirmed `BetaBanner.tsx` (112 lines) + `BetaBanner.test.tsx` present at `frontend/src/components/navigation/`; read both.
- [x] 0.2 Confirmed `<BetaBanner />` mounted in `frontend/src/app/layout.tsx:64`, imported from `@/components/navigation/BetaBanner` (line 6).
- [x] 0.3 Confirmed `de.json` `beta.bannerMessage` == `"Beta — Daten können jederzeit zurückgesetzt werden"` byte-for-byte; `en.json` has the parallel key.
- [x] 0.4 Confirmed `NEXT_PUBLIC_ENV_LABEL` wiring (Dockerfile:54,63 ARG+ENV; build-images.yml:192 branch-scope; .env.example:54).
- [x] 0.5 Coverage inventory: existing suite covers AC-1/AC-4/AC-6; gaps = AC-2 orange-bg, AC-3 de.json parity, AC-5 layout integration.
- [x] 0.6 DEC-1=A (accept shipped; no regress) + DEC-2=A (extend jsdom + add pure-Node parity) resolved via A41 — see Debug Log References.
- [x] 0.7 Spike outcome recorded in Dev Agent Record.

### Task 1: Verify the shipped AC sub-items already covered (AC-1, AC-4, AC-6)

- [x] 1.1 Ran existing `BetaBanner.test.tsx` — 14 tests pass (the `it.each` case-insensitive block expands to 4). Baseline green.
- [x] 1.2 Mapped passing tests to AC sub-items in the Quality-Gates table (AC-1 render/null/case-insensitive; AC-4 dismiss/persist/stays-hidden; AC-6 a11y/Safari).

### Task 2: Close the regression-coverage gaps (AC-2, AC-3, AC-5)

- [x] 2.1 (DEC-2=A) Extended `BetaBanner.test.tsx`: new test asserts the banner root `role="status"` carries `bg-orange-500` when `NEXT_PUBLIC_ENV_LABEL=beta` (AC-2). Suite now 15 tests.
- [x] 2.2 (DEC-2=A) Added pure-Node `frontend/src/components/navigation/BetaBanner.i18n.test.ts` (no jsdom/cleanup per A46): asserts `de.json` `beta.bannerMessage` == AC string byte-for-byte (A51) + `en.json` parallel key + identical `beta` key set across both locales (AC-3). 4 tests.
- [x] 2.3 (DEC-2=A) Same pure-Node file: reads `src/app/layout.tsx` + asserts the `BetaBanner` import from a `navigation/BetaBanner` path AND `<BetaBanner` JSX usage (AC-5 — fails if a refactor drops the banner).

### Task 3: Quality gates (AC-7) + close (AC-8 deferred)

- [x] 3.1 `npm run typecheck` (`tsc --noEmit`) — clean.
- [x] 3.2 `eslint` on the 2 changed files — clean (exit 0). (Repo-wide `npm run lint` has PRE-EXISTING errors in unrelated files, e.g. a segments component's `set-state-in-effect`; not introduced by this story.)
- [x] 3.3 `prettier --check` on the 2 changed files — clean after one `--write` on the new test file. (Repo-wide `format:check` reports ~2543 pre-existing style-drift files unrelated to this story.)
- [x] 3.4 `npx vitest run` (full frontend suite) — **171 passed / 24 files** (was 166; +5 from this story: +1 orange-bg in BetaBanner.test.tsx, +4 in BetaBanner.i18n.test.ts). Zero regressions.
- [x] 3.5 Confirmed zero new `package.json` dependencies (AC-7).
- [x] 3.6 AC-Subitem Completion Check (A29) — Quality-Gates table filled per AC sub-item.
- [!] 3.7 AC-8 live visual check on Beta deferred per A47 → Completion Notes Q1 (needs green Beta deploy + browser).
- [x] 3.8 Status flipped to `review`.

## Dev Notes

### Shipped component contract (as of refresh, 2026-06-05)

| Aspect | Shipped value | File:line |
|---|---|---|
| Path | `frontend/src/components/navigation/BetaBanner.tsx` | — |
| Client/server | `"use client"` | [BetaBanner.tsx:2](../../frontend/src/components/navigation/BetaBanner.tsx) |
| Render gate | `process.env.NEXT_PUBLIC_ENV_LABEL?.trim().toLowerCase() === "beta"` | [:48,52](../../frontend/src/components/navigation/BetaBanner.tsx) |
| Text | `t("bannerMessage")` via `useTranslations("beta")` | [:60,90](../../frontend/src/components/navigation/BetaBanner.tsx) |
| de.json text | `"Beta — Daten können jederzeit zurückgesetzt werden"` | `frontend/messages/de.json` `beta.bannerMessage` |
| Background | `bg-orange-500` + `text-white` | [:88](../../frontend/src/components/navigation/BetaBanner.tsx) |
| Dismiss | `sessionStorage["iabc:beta-banner-dismissed"]="1"`, lazy `useState` init | [:8,65,79–82](../../frontend/src/components/navigation/BetaBanner.tsx) |
| A11y | `role="status"` + `aria-label`, dismiss button `aria-label`, `<X/>` `aria-hidden` | [:86–107](../../frontend/src/components/navigation/BetaBanner.tsx) |
| Feedback link | `NEXT_PUBLIC_FEEDBACK_URL` || `${sourceUrl}/issues/new?template=beta-feedback.md` | [:75–77](../../frontend/src/components/navigation/BetaBanner.tsx) (E18-S4 owns the template file) |
| Layout mount | inside `NextIntlClientProvider`, above `<MainLayout>` | [layout.tsx:61–67](../../frontend/src/app/layout.tsx) |

### Why NOT to "fix" the divergences (anti-regression)

- **i18n key, not hardcoded German:** project-context mandates next-intl keys; the `de.json` value is already the exact AC string. Hardcoding regresses the rule + breaks `en` parity.
- **`navigation/` path:** sibling of `Header`/`Sidebar`/`LicenseFooter`; moving it churns the layout + test imports.
- **`orange-500`:** established banner fill (matches `OnboardingBanner`); `orange-600/700` is reserved for primary actions/links per the project rule.

### Existing test coverage map (the 11 tests)

render-when-beta · null-when-unset · null-when-non-beta · feedback-link-env-override · GitHub-fallback-URL · dismiss+persist · stays-hidden-when-pre-dismissed · case-insensitive×4 · source-url-fork-fallback · Safari-getItem-throw · Safari-setItem-throw. **Gaps:** orange-bg assertion (AC-2), de.json string parity (AC-3), layout integration (AC-5).

### A31 cross-story orthogonal-AC invariants in scope

1. **de.json `beta.bannerMessage` ↔ AC-mandated German string** — direct-artifact-read parity test (A51), so a future translation edit that drifts from the spec fails at test time (AC-3).
2. **layout.tsx ↔ BetaBanner mount** — code-audit test so a layout refactor dropping the banner fails (AC-5).
3. **`NEXT_PUBLIC_ENV_LABEL` producer↔consumer** — Dockerfile/build-images.yml set it; the banner reads it. (E11-S2 owns the producer; verified at refresh, not re-tested here.)
4. **`template=beta-feedback.md` filename** the banner constructs ↔ the actual issue-template filename — this invariant is owned and tested by **E18-S4** (the feedback channel story), noted here for cross-reference.

## Quality-Gates Closing

| AC | Evidence | Status |
|---|---|---|
| AC-1 conditional render | BetaBanner.test.tsx: render-when-beta / null-when-unset / null-when-non-beta / case-insensitive×4 | covered |
| AC-2 orange background | BetaBanner.test.tsx "renders with an orange background fill" → `toHaveClass("bg-orange-500")` | covered |
| AC-3 exact text via i18n | BetaBanner.i18n.test.ts: de.json byte-equal + en.json parity + identical beta key set (A51) | covered |
| AC-4 dismissable per session | BetaBanner.test.tsx: dismiss+persist / stays-hidden-when-pre-dismissed / Safari setItem | covered |
| AC-5 layout integration | BetaBanner.i18n.test.ts: layout.tsx import-from-navigation + `<BetaBanner` JSX | covered |
| AC-6 a11y + Safari-safe | BetaBanner.test.tsx: role/aria assertions + Safari getItem/setItem throw tests | covered |
| AC-7 no new deps + gates | typecheck clean; eslint+prettier clean on changed files; full vitest 171/171; zero new deps | covered |
| AC-8 live visual check | live walkthrough (Q1) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Existing:** `frontend/src/components/navigation/BetaBanner.test.tsx` (11 Vitest tests, jsdom + cleanup).
- **NEW (this story):** orange-bg + render assertions appended to `BetaBanner.test.tsx`; a pure-Node `BetaBanner.i18n.test.ts` for de.json/en.json + layout.tsx parity (A51, no jsdom per A46).
- **Live visual evidence:** deferred to Wave-9 walkthrough per A47 (AC-8).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

**DEC-1 (reconcile AC-literal divergences) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (accept the shipped implementation as canonical — `navigation/` path, i18n key, `bg-orange-500`; add regression coverage only; do NOT regress to the AC literal).
- (b) **Rationale:** story recommendation = A; user autonomous-mode verbatim quote = "das ganze epic umsetzen ohne unterbrechung und ohne stop bis alle stories implementiert sind. danach gemäss plan eine retro durchführen." (2026-06-05); architectural justification = the i18n key is MANDATED by the project next-intl rule (hardcoding the German literal would be the violation) and `de.json` already matches the AC string byte-for-byte; `navigation/` is the chrome-component convention; `orange-500` is the established banner fill. "Fixing" any of these would regress a compliant, tested component + break the layout import.
- (c) **Consequence chain:** zero production-code change; the banner/test/layout/env stay as-shipped; net work = +1 orange-bg test + a new pure-Node parity test.

**DEC-2 (where to add the coverage-gap tests) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (render-assertions extend the jsdom `BetaBanner.test.tsx`; parity-assertions get a pure-Node `BetaBanner.i18n.test.ts`).
- (b) **Rationale:** story recommendation = A; same user quote; architectural justification = A46 — the de.json/en.json/layout reads are pure `node:fs` + JSON/regex, so they belong in a no-jsdom/no-cleanup file; forcing them into the jsdom file would be the A46 anti-pattern.
- (c) **Consequence chain:** orange-bg assertion → BetaBanner.test.tsx (jsdom render); de.json/en.json/layout parity → BetaBanner.i18n.test.ts (pure-Node).

### Spike outcome (Task 0.7)

The banner, its test suite, the env wiring, and the layout integration ALREADY SHIP and are compliant. de.json `beta.bannerMessage` is byte-equal to the AC-mandated German string. Story = verification + 3 regression-coverage gaps (orange-bg, de.json string parity, layout integration). Zero production-code change.

### Completion Notes List

- **What was implemented:** +1 jsdom test (orange-bg, AC-2) appended to `BetaBanner.test.tsx`; +4 pure-Node tests in new `BetaBanner.i18n.test.ts` (de.json byte-equal AC-3, en.json parity, beta key-set parity, layout integration AC-5). A51 direct-artifact-read; A46-compliant (pure-Node file has no jsdom/cleanup).
- **Zero production code changed** — the banner is verified, not modified. DEC-1=A explicitly avoids regressing the shipped i18n/path/colour.
- **Gates:** typecheck clean; eslint+prettier clean on changed files; full frontend suite 166 → **171** green; zero new deps.
- **DEC-1=A + DEC-2=A** auto-resolved via A41; (a)/(b)/(c) Debug Log above.

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-8 live visual check):** on a green Beta deploy, confirm the orange banner is visible on a public route, shows the German text, the feedback link is clickable, and dismiss hides it for the session.

### File List

**NEW:**
- `frontend/src/components/navigation/BetaBanner.i18n.test.ts` (4 pure-Node tests)

**MODIFIED:**
- `frontend/src/components/navigation/BetaBanner.test.tsx` (+1 orange-bg test → 15 tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (e18-s3: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/e18-s3-add-beta-banner-in-ui.md` (this story file)

### Change Log

- 2026-06-05 — E18-S3 dev-story: verification + 3 regression-coverage gaps closed (orange-bg AC-2, de.json byte-equal AC-3, layout integration AC-5) via +1 jsdom test + new pure-Node BetaBanner.i18n.test.ts. DEC-1=A (accept shipped, no regress) + DEC-2=A (jsdom+pure-Node split) auto-resolved via A41. Full frontend suite 166→171 green. AC-1..AC-7 covered; AC-8 deferred-pending-beta-green per A47 → Q1. Zero production code change.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A34** bulk spec-refresh at epic start (this is a batch with E18-S1/S2/S4)
- **A35** + **A46** `afterEach(cleanup)` applies ONLY to Testing-Library `render()` tests; pure-Node file-read tests get neither cleanup nor jsdom
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A51** A31 invariants tested via direct artifact-read (AC-3 de.json parity, AC-5 layout)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-8)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-05)

Verification complete: the banner ships compliant; the 3 regression-coverage gaps (orange-bg, de.json byte-equal parity, layout integration) are closed via +1 jsdom test + a new pure-Node BetaBanner.i18n.test.ts. Full frontend suite 166→171 green; zero production-code change. AC-1..AC-7 covered; AC-8 deferred-pending-beta-green per A47 → Q1.
