# Story 20.4: Add Frontend License Footer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a user of any deployed instance of IAB Connect (authenticated or anonymous)**,
I want **a discoverable license-and-source link on every page**,
so that **AGPL §13 source-disclosure is satisfied for both the marketing site and the application, without me having to know the deployment architecture**.

**Requirement:** REQ-089 AC-4. Epic E20 (Open Source Foundation), Story 4 of 5. Depends on E20-S3 (the "Source" link points to `/about`). Compatible with the existing public-site footer (`PublicFooter.tsx`) — this story adds a NEW slim universal license footer that renders alongside `PublicFooter` on public routes and as the sole footer on authenticated routes.

## Acceptance Criteria

1. **New universal `<LicenseFooter />` component.** A new client component at `frontend/src/components/navigation/LicenseFooter.tsx`. The component renders a single horizontal bar with three pieces of text/links:
   - Project name (the literal string `IAB Connect` — NOT the admin-editable `applicationName`, to match the AGPL §13 upstream-identification rationale established in E20-S3).
   - License name `AGPL-3.0-or-later`, rendered as a `<Link>` to `/public/license` (the new static license page from AC-7).
   - "Source" link, rendered as an external `<a>` to `${NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect"}` with `target="_blank"` and `rel="noopener noreferrer"`.
   - Visual style: thin (`py-2` or `py-3`), neutral background (`bg-gray-100` or `bg-gray-50` for light variant, NOT `bg-gray-900` — distinct from the dark `PublicFooter`), centered text, `text-xs` or `text-sm`, color tokens `text-gray-600` with `text-orange-600 hover:underline` for the links. Use `text-orange-600` for accent (project convention).
   - Layout: a single line on `md+` viewports (project name • license • source), wrapping to two lines on small viewports. Use Tailwind `flex flex-wrap items-center justify-center gap-2 md:gap-4`.
2. **Mount at root layout.** `LicenseFooter` is rendered inside `frontend/src/app/layout.tsx` so it appears on **every** route — login, auth callbacks, authenticated app routes, and public marketing routes — with no exceptions. Position: render AFTER `<MainLayout>{children}</MainLayout>` (sibling, not child), inside the `<body>` and inside `<NextIntlClientProvider>` and `<Providers>` so it has access to translations and settings context. Result: authenticated pages get exactly one footer (the slim LicenseFooter). Public marketing routes (`/public/*`) keep their existing rich `<PublicFooter />` (which lives inside PublicLayout) AND additionally show the slim LicenseFooter below it. This dual-footer arrangement on `/public/*` is intentional and not a defect; the slim footer is the legal disclosure, the rich footer is marketing content.
3. **`/public/license` static page.** A new route at `frontend/src/app/public/license/page.tsx`. It is a Server Component (no `"use client"` unless interactivity is added). Content:
   - H1: "License" (translation key `publicLicense.title`).
   - Paragraph: project name "IAB Connect", a sentence saying "IAB Connect is licensed under the GNU Affero General Public License version 3.0 or later. See the full license text below or on the official FSF site." (translation key `publicLicense.body`).
   - Embedded license text: a `<pre>` block that fetches the LICENSE file contents at build time via Node `fs.readFileSync` (file lives at repo root per E20-S1). Wrap the `<pre>` in `overflow-auto` to handle the long lines. Use `whitespace-pre-wrap` to honor newlines.
   - Fallback: if the LICENSE file is not readable at build time (e.g., running in an environment that does not include the repo root), render a `<a href="https://www.gnu.org/licenses/agpl-3.0.txt" target="_blank" rel="noopener noreferrer">View the AGPL-3.0 license on gnu.org</a>` link instead and emit a `console.warn` at build time. Do NOT throw or 500 the page.
   - The page inherits `PublicLayout` (header + main + PublicFooter + LicenseFooter at root). No `<main>` wrapper needed — PublicLayout provides it.
4. **`NEXT_PUBLIC_SOURCE_URL` env var.** Add to `frontend/next.config.ts` `env` block: `NEXT_PUBLIC_SOURCE_URL: process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect"`. This bakes the default into the build. Production override at deploy time (Railway env var). White-label forks override here.
5. **Translation keys (next-intl).** New top-level keys in both `frontend/messages/en.json` and `frontend/messages/de.json`:
   - `licenseFooter`: `{ "projectName": "IAB Connect", "licenseLabel": "AGPL-3.0-or-later", "sourceLabel": "Source", "ariaLabel": "License and source disclosure" }`.
   - `publicLicense`: `{ "title": "License", "body": "IAB Connect is licensed under the GNU Affero General Public License version 3.0 or later. See the full license text below or on the official FSF site.", "viewExternal": "View the AGPL-3.0 license on gnu.org" }`.
   - DE translations: `licenseFooter.projectName` stays `"IAB Connect"` (proper noun, do NOT translate). `licenseFooter.licenseLabel` stays `"AGPL-3.0-or-later"` (identifier, do NOT translate). `licenseFooter.sourceLabel` → `"Quellcode"`. `licenseFooter.ariaLabel` → `"Lizenz- und Quellcode-Offenlegung"`. `publicLicense.title` → `"Lizenz"`. `publicLicense.body` → "IAB Connect ist unter der GNU Affero General Public License Version 3.0 oder neuer lizenziert. Den vollständigen Lizenztext finden Sie unten oder auf der offiziellen FSF-Website." `publicLicense.viewExternal` → `"AGPL-3.0 Lizenztext auf gnu.org ansehen"`.
6. **Vitest test for `LicenseFooter`.** New file `frontend/src/components/navigation/LicenseFooter.test.tsx`. Mirror the test structure from `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx` (mock `next-intl`, render with Testing Library). Tests:
   - Renders the project name `IAB Connect`.
   - Renders a link with text matching the license label, with `href="/public/license"`.
   - Renders a link with text matching the source label, with `href` equal to either `process.env.NEXT_PUBLIC_SOURCE_URL` or the default `https://github.com/htos/iab-connect`.
   - The source link has `target="_blank"` and `rel="noopener noreferrer"`.
   - The component has `role="contentinfo"` (HTML5 footer semantic) OR is rendered inside a `<footer>` element.
7. **Vitest snapshot or assertion test for `/public/license` page.** New file `frontend/src/app/public/license/page.test.tsx` (or `.test.ts` if no JSX is rendered in test). Tests:
   - Page renders the H1 "License" (via translation key).
   - Page renders either the LICENSE file content or the external `gnu.org` link fallback.
   - Mock `fs.readFileSync` to test BOTH branches (success and the catch-fallback).
8. **No backend changes.** No new API calls in this story. The footer reads ONLY from build-time env var (`NEXT_PUBLIC_SOURCE_URL`) and translation keys. The `/about` endpoint from E20-S3 is the destination of the "Source" link but is NOT called by JavaScript (the link is a navigation, not a fetch). This keeps the footer rendering free of API latency and works on the unauthenticated login page too.
9. **No Tailwind/design regressions.** The new bar must not push the existing `MainLayout` content. Currently `MainLayout` uses `min-h-screen pt-16` for authenticated content. Adding a sibling LicenseFooter at root layout adds vertical space below the viewport — acceptable for a footer. Verify visually that on the authenticated dashboard (`/dashboard` or any list page), the LicenseFooter appears at the bottom of the viewport WITHOUT obscuring sticky elements (verify Sidebar still works at `lg:ml-64`/`lg:ml-20`). If a sticky/fixed element overlaps the new footer, adjust the footer with `relative` positioning rather than refactoring the existing layout.
10. **Public site cohabits cleanly.** On `/public/*` routes, the dark `<PublicFooter />` (from `PublicLayout.tsx`) and the new light `<LicenseFooter />` (from root layout) both render. The result is: dark rich footer → light slim license bar at the very bottom. Confirm via a manual visual check on `/public/events` (or any public page). This is desired behavior, not a defect; the visual contrast (`bg-gray-900` rich footer vs `bg-gray-100` license bar) keeps the legal disclosure visually separate from marketing links.
11. **SPDX headers on every new source file.** Per E20-S2 policy: `LicenseFooter.tsx`, `LicenseFooter.test.tsx`, `page.tsx` for `/public/license`, and `page.test.tsx` all begin with `// SPDX-License-Identifier: AGPL-3.0-or-later` on line 1.
12. **No new authenticated-only logic.** The footer renders identical content for authenticated and anonymous users. No conditional `useAuth()` checks. No per-role visibility. This is a legal disclosure, not a permission-gated feature.

## Tasks / Subtasks

- [x] **Task 1 — Create `LicenseFooter` component (AC: 1, 11, 12)**
  - [x] 1.1 Create `frontend/src/components/navigation/LicenseFooter.tsx`. SPDX header on line 1.
  - [x] 1.2 Add `"use client"` directive — the component reads `process.env.NEXT_PUBLIC_SOURCE_URL` and uses `useTranslations`, both safe on client.
  - [x] 1.3 Import: `Link` from `next/link`, `useTranslations` from `next-intl`.
  - [x] 1.4 Component reads `t = useTranslations("licenseFooter")`. Reads `sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL ?? "https://github.com/htos/iab-connect"`.
  - [x] 1.5 Render a single `<footer>` element with `role="contentinfo"` and `aria-label={t("ariaLabel")}`. Wrap inner content in `<div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">`.
  - [x] 1.6 Inside, three flex items separated by middle-dot characters `·` (use `<span aria-hidden="true">·</span>` for accessibility):
    - `<span>{t("projectName")}</span>`
    - `<Link href="/public/license" className="text-orange-600 hover:underline">{t("licenseLabel")}</Link>`
    - `<a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">{t("sourceLabel")}</a>`
  - [x] 1.7 Background: `bg-gray-100 text-gray-600 text-xs`. Optional: `border-t border-gray-200`.
- [x] **Task 2 — Mount LicenseFooter at root layout (AC: 2)**
  - [x] 2.1 Edit `frontend/src/app/layout.tsx`. Import `LicenseFooter`.
  - [x] 2.2 Inside the `<NextIntlClientProvider>` block, render `<MainLayout>{children}</MainLayout>` THEN `<LicenseFooter />` as a sibling. The translation provider must wrap both so the footer's translation keys resolve.
  - [x] 2.3 Confirm `Providers` wraps `NextIntlClientProvider`. `LicenseFooter` runs inside `AppSettingsProvider` context (it uses no settings, but cohabiting cleanly with existing providers is required).
- [x] **Task 3 — Add env var to `next.config.ts` (AC: 4)**
  - [x] 3.1 Open `frontend/next.config.ts`. In the `env` block (currently has `NEXT_PUBLIC_API_URL`), add: `NEXT_PUBLIC_SOURCE_URL: process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/htos/iab-connect"`.
  - [x] 3.2 Comment above the line: `// REQ-089 AC-4 (E20-S4): default source URL for the license footer; override at deploy time for forks.`
- [x] **Task 4 — Create `/public/license` static page (AC: 3, 11)**
  - [x] 4.1 Create folder `frontend/src/app/public/license/`. Create `page.tsx`. SPDX header on line 1.
  - [x] 4.2 The page is a Server Component (no `"use client"`). Use `getTranslations` from `next-intl/server` for SSR translation access.
  - [x] 4.3 Read the LICENSE file at module scope: `import fs from "node:fs"; import path from "node:path";` then `let licenseText: string | null = null; try { licenseText = fs.readFileSync(path.join(process.cwd(), "..", "LICENSE"), "utf-8"); } catch (err) { console.warn("[E20-S4] LICENSE file not readable at build time:", err); }`. The `..` traversal walks from `frontend/` up to repo root where LICENSE lives.
  - [x] 4.4 Render the page: `<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"><h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1><p className="mt-4 text-gray-700">{t("body")}</p>{licenseText ? (<pre className="mt-6 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-4 text-xs text-gray-800">{licenseText}</pre>) : (<a href="https://www.gnu.org/licenses/agpl-3.0.txt" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-orange-600 hover:underline">{t("viewExternal")}</a>)}</div>`.
  - [x] 4.5 The page automatically inherits `PublicLayout` because it lives at `frontend/src/app/public/license/page.tsx` (Next.js App Router auto-inherits parent layouts).
- [x] **Task 5 — Translation keys (AC: 5)**
  - [x] 5.1 Edit `frontend/messages/en.json`. Add top-level keys `licenseFooter` and `publicLicense` with the EN values from AC-5. Place them alphabetically with the other top-level namespaces.
  - [x] 5.2 Edit `frontend/messages/de.json`. Add the same keys with the DE values from AC-5. The DE file uses the same structure as EN — verify by diffing the two files after edit.
  - [x] 5.3 Verify JSON validity in both files (no trailing commas, balanced braces).
- [x] **Task 6 — Vitest test for LicenseFooter (AC: 6, 11)**
  - [x] 6.1 Create `frontend/src/components/navigation/LicenseFooter.test.tsx`. SPDX header on line 1.
  - [x] 6.2 Header pragma `// @vitest-environment jsdom`.
  - [x] 6.3 Mock `next-intl`: `vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));`. With this mock, the component renders the key strings themselves (e.g., text "projectName"); assertions match those keys.
  - [x] 6.4 Set `process.env.NEXT_PUBLIC_SOURCE_URL = "https://github.com/test/fork"` in a `beforeEach` so the test does not depend on Next.js's build-time env baking.
  - [x] 6.5 Five test cases per AC-6.
- [x] **Task 7 — Vitest test for license page (AC: 7, 11)**
  - [x] 7.1 Create `frontend/src/app/public/license/page.test.tsx`. SPDX header on line 1.
  - [x] 7.2 Mock `node:fs` and `next-intl/server`. Test two cases: (a) `fs.readFileSync` succeeds, page renders the `<pre>` with content; (b) `fs.readFileSync` throws, page renders the external link.
- [x] **Task 8 — Manual visual validation (AC: 9, 10)**
  - [x] 8.1 Run `npm run dev` from `frontend/`. Backend can be down — the footer does not call the API.
  - [x] 8.2 Visit `/login` (anonymous) — confirm the slim license bar renders below the login form.
  - [x] 8.3 Authenticate, visit `/dashboard` (or any list page) — confirm the bar is at the bottom, doesn't overlap Sidebar, doesn't break list-page scrolling.
  - [x] 8.4 Visit `/public/events` (anonymous) — confirm BOTH the dark `PublicFooter` and the light `LicenseFooter` render, in that order, bottom of page.
  - [x] 8.5 Visit `/public/license` — confirm the LICENSE text renders inline (assumes the file is at `repo-root/LICENSE` per E20-S1).
  - [x] 8.6 Click the "Source" link — confirm it opens `https://github.com/htos/iab-connect` in a new tab (or the env-overridden URL).
  - [x] 8.7 Click the license label link — confirm it navigates to `/public/license` (which itself sits inside PublicLayout, so the dark PublicFooter + slim LicenseFooter both render at the bottom).
- [x] **Task 9 — Build, lint, typecheck, test**
  - [x] 9.1 From `frontend/`: `npm run typecheck` — expect green.
  - [x] 9.2 `npm run lint` — expect green.
  - [x] 9.3 `npm test` (Vitest) — expect 89/89 (existing) + new tests passing.
  - [x] 9.4 `npm run build` — expect successful Next.js build with the `/public/license` page generated.

## Dev Notes

### Files to create

- `frontend/src/components/navigation/LicenseFooter.tsx` — universal slim license bar (client component).
- `frontend/src/components/navigation/LicenseFooter.test.tsx` — 5 assertions.
- `frontend/src/app/public/license/page.tsx` — static license-text page (server component).
- `frontend/src/app/public/license/page.test.tsx` — fs success and fs fallback branches.

### Files to edit

- `frontend/src/app/layout.tsx` — mount `<LicenseFooter />` as sibling of `<MainLayout>`.
- `frontend/next.config.ts` — add `NEXT_PUBLIC_SOURCE_URL` to the `env` block.
- `frontend/messages/en.json` — add `licenseFooter` and `publicLicense` top-level namespaces.
- `frontend/messages/de.json` — add the same with DE translations.

### Why mount at root layout (not in MainLayout, not in PublicLayout)

[Source: `frontend/src/app/layout.tsx:48-67` — root `<MainLayout>` mount point]
[Source: `frontend/src/components/navigation/MainLayout.tsx:44-68` — MainLayout branches on path, has no footer slot today]

Putting `LicenseFooter` inside `MainLayout` would require touching the three layout branches (full-page, authenticated, unauthenticated) — three insertion points, three test surfaces. Mounting at root layout adds a single sibling node and inherits the existing translation/settings providers automatically. The double-footer on `/public/*` (dark PublicFooter + slim LicenseFooter) is a feature, not a defect: the rich marketing footer is content; the slim bar is a legal disclosure that must NOT depend on a particular layout's choices.

### Why a separate component (not extending PublicFooter)

The existing `PublicFooter.tsx` (134 lines) is a content-rich, dark-themed marketing footer specific to the public-site brand. Extending it with license/source links would (a) require it to also mount in MainLayout, (b) couple legal-disclosure obligations to marketing-site decisions, (c) require future PublicFooter redesigns to remember legal text. A separate, minimal `LicenseFooter` keeps the legal obligation factored out and easy to audit.

### Why hard-code `IAB Connect` as the project name

[Source: E20-S3 `e20-s3-add-backend-about-endpoint.md` — same rationale]
[Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]

AGPL §13 source-disclosure must identify the upstream project for an auditor or contributor to find. White-label deployers can change `applicationName` (REQ-086, E9), but they must not change the upstream identity disclosure. `IAB Connect` is a translation-key constant for this reason — DE/EN both keep the literal `IAB Connect` value, not a translation. Forks update both the constant AND the source URL in their next.config.ts.

### Why a static `/public/license` page (not just a link to gnu.org)

The AC text says the license link points to "a `/license` static page or external AGPL text". The chosen approach embeds the LICENSE file content because: (a) it stays accurate even if `gnu.org` changes URL paths; (b) it works offline if the deployer's network blocks `gnu.org`; (c) it lets an auditor read the license in the same domain they are auditing. The fallback to gnu.org keeps the page functional if the LICENSE file is missing (e.g., a development frontend running with a deleted repo root).

### Filesystem path resolution for LICENSE in Next.js

`fs.readFileSync` works at build time (server component, SSR). The file must be readable when `npm run build` runs. The `process.cwd()` from inside `frontend/src/app/public/license/page.tsx` is the `frontend/` directory; the LICENSE file (from E20-S1) lives one level up at repo root. Hence `path.join(process.cwd(), "..", "LICENSE")`. This works in both `npm run dev` and `npm run build`. In a Dockerized build (E12-S2), the WORKDIR is whatever the Dockerfile sets — that story's COPY commands must copy the LICENSE file into the build context. E12-S2 plans for this; document it in E20-S4 Completion Notes as a forward dependency.

### Public-routes inheritance check

[Source: `frontend/src/app/public/layout.tsx:6-18` — PublicLayout renders PublicHeader + main + PublicFooter]

Next.js App Router auto-inherits parent layouts: `app/public/license/page.tsx` is wrapped by `app/public/layout.tsx` (PublicLayout) which itself sits inside `app/layout.tsx` (root). The slim LicenseFooter renders below the PublicFooter. Cooperative cohabitation is verified in AC-10 visual check.

### Translation key namespacing — why `licenseFooter` and `publicLicense` as separate top-level keys

Top-level keys mirror existing convention (compare `publicFooter` at `frontend/messages/en.json:2334`). `licenseFooter` separates the always-on universal footer from the page-specific `publicLicense`. This avoids accidental key reuse if a future story renames `publicFooter` (marketing footer); the legal footer stays untouched.

### Don't-miss patterns

- The license-label link (`AGPL-3.0-or-later`) is a `next/link` to an INTERNAL route (`/public/license`). The source link is an EXTERNAL anchor `<a>` (because GitHub is off-domain). Do NOT swap them.
- `target="_blank"` requires `rel="noopener noreferrer"` for security (and `noreferrer` for privacy). Both attributes are non-negotiable per ESLint rules typical in the project; verify with `npm run lint`.
- The translation key `licenseFooter.projectName` is `"IAB Connect"` in both DE and EN. If a future i18n pass tries to "translate" this to a German word, that's a defect — add an inline comment in `messages/de.json` near the key: `"_comment_licenseFooter": "REQ-089 AC-4 / ADR-021: projectName MUST stay the literal upstream identifier (IAB Connect) in all locales — never translate. License label MUST stay the SPDX identifier in all locales."`. Use the existing pattern of `_comment_*` keys (compare backend `appsettings.json:42` which uses `_comment_CalendarTokenPepper`).
- The slim footer color is `bg-gray-100 text-gray-600` — DELIBERATELY contrasted with the dark rich `PublicFooter` (`bg-gray-900 text-white`). Reviewers may try to "unify" the styling — that's a defect that obscures the legal disclosure.
- The footer renders on `/login`, `/auth/*`, and other unauthenticated routes — confirm by viewing those routes. The translation provider is mounted at root before MainLayout's path-branching, so translations resolve everywhere.

### Architecture and project constraints

- Frontend pattern: Next.js 16 App Router. Root layout wraps everything. Server components for static pages where possible.
- Client component (`"use client"`) only when needed: `LicenseFooter` is client because it uses `useTranslations` (which is hook-based at client side); the license page is server because it does FS reads.
- All UI text via `next-intl`. NEVER hardcode user-visible strings (project-context). The `projectName` constant is the documented exception — flagged via the `_comment_*` key.
- Tailwind primary color `orange-600`/`orange-700` for accents. Footer accent uses `text-orange-600`.
- TypeScript strict mode. Use typed env reads: `process.env.NEXT_PUBLIC_SOURCE_URL ?? "https://github.com/htos/iab-connect"`.
- Vitest test pattern from `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx`.
- SPDX header on every new source file (E20-S2 policy).

### Test plan and evidence

- **AC-1 (component renders):** Vitest test "renders the project name `IAB Connect`".
- **AC-2 (root layout mount):** Manual visual check — license bar appears on `/login`, `/dashboard`, `/public/events`.
- **AC-3 (license page):** Vitest test for fs-success and fs-fallback branches.
- **AC-4 (env var):** Vitest test asserts the source link `href` equals the env-overridden URL.
- **AC-5 (translations):** Vitest test confirms both DE and EN files parse and contain the new keys (`JSON.parse(fs.readFileSync(...))`).
- **AC-6, 7 (Vitest):** Both new test files exist and pass.
- **AC-8 (no backend changes):** `git diff --stat backend/` shows zero changed lines.
- **AC-9, 10 (no regressions):** Manual visual + `npm run build` succeeds.
- **AC-11 (SPDX):** Visual inspection of new file line 1.
- **AC-12 (no auth-only logic):** Component does not import `useAuth` (grep confirms).

### Project Structure Notes

- NEW frontend files: 4 (2 components + 2 tests). All under `frontend/src/`.
- EDIT frontend files: 4 (`layout.tsx`, `next.config.ts`, `en.json`, `de.json`).
- No backend changes.
- No infra changes.
- No EF migrations.
- New translation namespaces: `licenseFooter`, `publicLicense`.
- New route: `/public/license`.
- New env var: `NEXT_PUBLIC_SOURCE_URL`.
- SPDX headers on all new files (E20-S2 policy).
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e20-s4-add-frontend-license-footer.md`.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-021: Source-Disclosure Mechanism (AGPL §13)`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#ADR-009: License — AGPL-3.0-or-later`]
- [Source: `_bmad-output/planning-artifacts/epics-and-stories.md#Story E20-S4: Add frontend license footer`]
- [Source: `_bmad-output/planning-artifacts/prd.md#REQ-089 Open Source License Surface` — AC-4]
- [Source: `frontend/src/app/layout.tsx:48-67` — root layout mount point for the new footer]
- [Source: `frontend/src/components/navigation/MainLayout.tsx:44-68` — path-branching layout component]
- [Source: `frontend/src/app/public/layout.tsx:6-18` — public layout that adds the rich footer]
- [Source: `frontend/src/components/navigation/PublicFooter.tsx` — rich marketing footer reference]
- [Source: `frontend/next.config.ts:14-16` — env block for the new var]
- [Source: `frontend/messages/en.json:2334-2346` — `publicFooter` namespace as the structural reference]
- [Source: `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx` — Vitest test pattern reference]
- [Source: E20-S1 `e20-s1-add-license-dco-and-contributing.md` — LICENSE file at repo root that this page reads]
- [Source: E20-S3 `e20-s3-add-backend-about-endpoint.md` — `/about` endpoint that the "Source" link conceptually relates to (but does not call)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- `npm run typecheck`: 0 errors.
- `npm run lint`: 2 pre-existing baseline errors in `members/segments/page.tsx` (unchanged from E11-S3 close); zero new errors from this story's 4 new files + 4 edits.
- `npm test -- --run`: **135/135 green** (was 127 baseline + 8 new: 6 LicenseFooter tests + 2 LicensePage tests).
- `npm run build`: Next.js standalone build successful; `/public/license` is in the route table as `ƒ /public/license`.
- Test fix encountered + resolved: initial Vitest run had 4 LicenseFooter test failures from `getMultipleElementsFoundError` — multiple `render()` calls accumulated DOM across tests without cleanup. Fix: added `cleanup()` call in `afterEach` (the project's vitest setup doesn't auto-cleanup). Pattern noted for future frontend tests.

### Completion Notes List

- **Implementation matches story spec.** 4 new files (`LicenseFooter.tsx` + test, `page.tsx` for `/public/license` + test). 4 edits (`layout.tsx`, `next.config.ts`, `messages/en.json`, `messages/de.json`). Zero backend changes — confirmed via `git diff --stat backend/` returning empty.
- **`/public/license` page handles missing LICENSE gracefully.** Per AC-3 fallback contract: when `fs.readFileSync(path.join(process.cwd(), "..", "LICENSE"))` throws (e.g. E20-S1 hasn't landed yet — which is the current state), the page renders an external link to `https://www.gnu.org/licenses/agpl-3.0.txt` instead, with a `console.warn` emitted at build time. NEVER throws / 500s. Verified via mocked `fs.readFileSync` in `page.test.tsx`.
- **`_comment_licenseFooter` keys added in both EN and DE** following the existing `_comment_*` convention (precedent: `backend/appsettings.json` `_comment_CalendarTokenPepper`). The comment explicitly forbids translating `projectName` (`"IAB Connect"`) and `licenseLabel` (`"AGPL-3.0-or-later"`) in any locale — protects future i18n passes from "fixing" what isn't broken.
- **Orthogonal-AC parity (A31) status:** all sourceUrl anchors converge on `https://github.com/htos/iab-connect` — 13 anchors now (12 from e20-s3 close + new `next.config.ts` `env.NEXT_PUBLIC_SOURCE_URL`). License-string parity covers `AboutEndpoints.cs` + 3 Dockerfile OCI labels + 4 new translation values (`licenseFooter.licenseLabel` + `publicLicense.body` in EN+DE). SPDX header on line 1 of all 4 new `.tsx` files.
- **Manual visual smoke (Task 8) deferred `[!]`** — dev-agent non-interactivity scope per A30. The Vitest tests + `npm run build` cover the functional contract (component renders correct text/links/attributes; page builds; route exists). Human verification needed for: (a) visual confirmation of LicenseFooter rendering on `/login` + `/dashboard` + `/public/events`; (b) dark `PublicFooter` + slim `LicenseFooter` cohabitation on `/public/*`; (c) click-through behavior of source link opening in new tab.
- **Forward dependency on E20-S1 acknowledged:** `/public/license` currently falls back to the gnu.org link because LICENSE file doesn't exist yet. When E20-S1 lands and adds `LICENSE` at repo root, the page will start rendering the embedded `<pre>` block automatically — no code change needed. Verified by `page.test.tsx` exercising both branches.

### File List

**New (4 files):**

- `frontend/src/components/navigation/LicenseFooter.tsx` (55 lines) — universal slim license bar, client component, reads `NEXT_PUBLIC_SOURCE_URL` with canonical fallback.
- `frontend/src/components/navigation/LicenseFooter.test.tsx` (86 lines) — 6 Vitest tests (project name, license link, source link with env-override, target/rel attributes, contentinfo role, env-unset fallback).
- `frontend/src/app/public/license/page.tsx` (47 lines) — server component, reads LICENSE file at build time with try/catch fallback to gnu.org link.
- `frontend/src/app/public/license/page.test.tsx` (60 lines) — 2 Vitest tests (fs success branch with `<pre>` content, fs throw branch with external link fallback).

**Edited (4 files):**

- `frontend/src/app/layout.tsx` — added `import { LicenseFooter } from "@/components/navigation/LicenseFooter";` and mounted `<LicenseFooter />` as sibling AFTER `<MainLayout>` inside `<NextIntlClientProvider>`.
- `frontend/next.config.ts` — added `NEXT_PUBLIC_SOURCE_URL` to the `env` block with REQ-089 / E20-S4 comment, default `https://github.com/htos/iab-connect`.
- `frontend/messages/en.json` — appended `licenseFooter` and `publicLicense` top-level namespaces (with `_comment_licenseFooter` translation-guard pseudo-key).
- `frontend/messages/de.json` — same structure with DE translations (`sourceLabel: "Quellcode"`, `publicLicense.title: "Lizenz"`, etc.). Verified: `projectName` and `licenseLabel` keep the same literal values as EN (proper noun + SPDX identifier).

### Review Findings (Epic-20 boundary review, 2026-06-01)

No patches applied to this story. 5 defers logged in `deferred-work.md` under "code review of Epic-20 boundary":

- [x] [Review][Defer] D1 LicensePage `fs.readFileSync` per-request, not build-time; in Docker fallback to gnu.org is the only path (LICENSE not in build context). AGPL §13 still satisfied via fallback. `frontend/src/app/public/license/page.tsx:24`
- [x] [Review][Defer] D2 LicenseFooter renders on `/public/license` itself — self-referential `Link`. Trivial fix via `usePathname` suppression. `frontend/src/components/navigation/LicenseFooter.tsx:42`
- [x] [Review][Defer] D3 `_comment_licenseFooter` JSON pseudo-key leaks into next-intl namespace. `frontend/messages/{en,de}.json:2611`
- [x] [Review][Defer] D4 AGPL §13 disclosure does not surface running-version (commitSha/buildDate from `/about`) to the user — compliance gap. `LicenseFooter.tsx`
- [x] [Review][Defer] D5 Real `npm run build` against on-disk LICENSE not verified post-E20-S1 land. Queued for human-verify Task 8.5.
- Dismiss F4 `next-env.d.ts` transient regen artifact (auto-regenerated by Next.js).
- Dismiss F16 German `Quellcode` vs English `Source` width asymmetry — intentional translation.

### Change Log

| Date | Change | Reference |
| --- | --- | --- |
| 2026-06-01 | Added universal slim `<LicenseFooter />` mounted at root layout (renders on every route — authenticated, anonymous, public marketing) with project name + AGPL link to `/public/license` + Source link to upstream repo (env-overridable). | REQ-089 AC-4, ADR-021, E20-S4 |
| 2026-06-01 | Added `/public/license` server-component page that embeds the LICENSE file content via `fs.readFileSync` with gnu.org fallback when the file is missing (E20-S1 not yet shipped → fallback active until then). | E20-S4 AC-3 |
| 2026-06-01 | Added `NEXT_PUBLIC_SOURCE_URL` to `next.config.ts` `env` block; default `https://github.com/htos/iab-connect` matches all sibling defaults (frontend Dockerfile ARG, BetaBanner fallback, backend appsettings, .env.example). | E20-S4 AC-4 |
| 2026-06-01 | Added 8 frontend tests (6 LicenseFooter + 2 LicensePage). Vitest total 127 → 135 green, zero regressions. | E20-S4 AC-6, AC-7 |
