# Story 9.2: Replace Hardcoded Organization References in Frontend

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **no hardcoded organization name or branding in the frontend**,
so that **the deployed app shows my organization everywhere it currently shows "IAB Connect" / "Indischer Kulturverein Bern"**.

**Requirement:** REQ-086. Epic E9, Story 2 of 4.
**Depends on E9-S1** — this story renders removed references from `SystemSettings` via `useAppSettings()`. E9-S1 must land first: it extends the `AppSettings` type/provider with `description` (and the contact fields this story needs). If E9-S1 is not yet merged, coordinate the `AppSettingsProvider.tsx` edits.

## Acceptance Criteria

1. **Hardcoded org references removed from frontend source.** Every user-visible "IAB" / "IAB Connect" / "Indischer Kulturverein Bern" / "Indian Cultural Association Bern" string in `frontend/src/**` is replaced — either by a `useAppSettings()` value or a `next-intl` key. The complete confirmed list (Dev Notes) is the checklist; no user-visible string hardcodes a specific organization after this story.
2. **Logo blocks render from settings.** The logo circle + name in `PublicHeader.tsx`, `PublicFooter.tsx`, `app/page.tsx`, and `admin/register/page.tsx` render `settings.logoText` / `settings.applicationName` with `settings.logoBackgroundColor` / `settings.logoTextColor` — mirroring the canonical pattern already in `components/navigation/Header.tsx` (lines 96–108). Hardcoded `bg-[#EA580C]` / `bg-orange-600` on those specific logo circles are replaced with the settings colors.
3. **Browser metadata is de-branded.** `app/layout.tsx` no longer hardcodes `title: "IAB Connect"` / `description: "...Indian Cultural Association Bern"`. It uses `generateMetadata()` fetching `GET /api/v1/settings/public` server-side (the same endpoint the provider uses) so the tab title/description reflect the configured organization. A safe neutral fallback applies if the fetch fails.
4. **Email-campaign defaults de-branded.** `fromName` defaults in `communication/email-campaigns/new/page.tsx` and `[id]/edit/page.tsx` no longer hardcode `"IAB Connect"` — they default from `settings.applicationName` (populated via `useEffect` once settings load, not as a stale `useState` initializer).
5. **Behavior preserved.** When `SystemSettings` carries the previous values, every surface renders exactly as before. No layout, routing, or auth regression.
6. **Quality gate.** `npm run typecheck`, `npm run lint`, and `npm run format:check` pass from `frontend/`. New/updated Vitest tests cover the components now rendering from settings (see Testing). Manual check: changing `applicationName` in `/admin/settings` updates all listed surfaces.

## Tasks / Subtasks

- [x] **Task 1 — Logo/name components (AC: 2, 5)** — wired `useAppSettings()` into:
  - [x] `PublicHeader.tsx`: logo circle + name render `settings.logoText`/`applicationName` with `logoBackgroundColor`/`logoTextColor` (canonical `Header.tsx` pattern).
  - [x] `PublicFooter.tsx`: same treatment.
  - [x] `app/page.tsx`: guest-hero logo circle + h1 render from settings.
  - [x] `app/admin/register/page.tsx`: logo circle + h1 → settings; the `<p>Indischer Kulturverein Bern</p>` tagline **removed** (Q1); copyright footer → `© {year} {settings.applicationName}`.
- [x] **Task 2 — Browser metadata (AC: 3)** — `app/layout.tsx`: static `metadata` export replaced with `generateMetadata()` that fetches `/api/v1/settings/public` server-side (`next.revalidate: 300`) and returns `{ title, description }`; try/catch → neutral fallback (`"Organization Connect"`). Favicon line kept.
- [x] **Task 3 — Email-campaign defaults (AC: 4)** — `email-campaigns/new/page.tsx`: `fromName` initializes empty, populated from `settings.applicationName` via a `useEffect` gated on `!settingsLoading` (only when still empty). `[id]/edit/page.tsx`: fallback is `data.fromName || settings.applicationName` (dep added to the `loadCampaign` `useCallback`).
- [x] **Task 4 — Code comments (AC: 1, cosmetic)** — de-branded the file-header comments in `lib/auth.ts`, `lib/services/api.ts`, `app/page.tsx`, `app/auth/error/page.tsx`, `app/login/page.tsx`, `app/admin/register/page.tsx`.
- [x] **Task 5 — Tests (AC: 6)**
  - [x] Vitest/Testing Library: `PublicBranding.test.tsx` (PublicHeader + PublicFooter), `app/page.test.tsx`, `app/admin/register/page.test.tsx` — render with a mocked `useAppSettings()` returning custom values, assert the custom org name/logo render and "IAB" does not.
  - [x] `layout.test.ts` — `generateMetadata()` returns the fetched name + description, and falls back to the neutral title on fetch error / non-OK status.
  - [x] `npm run typecheck` green, `prettier --write` applied to all changed files. `npm run lint` — changed files clean (see Completion Notes for the pre-existing baseline failure).

## Dev Notes

### A. Confirmed user-visible references to fix (the checklist)

| File | Line(s) | Current | → becomes |
|------|---------|---------|-----------|
| `app/layout.tsx` | 15 | `title: "IAB Connect"` | `generateMetadata()` → `settings.applicationName` |
| `app/layout.tsx` | 16 | `description: "Web application for the Indian Cultural Association Bern"` | `generateMetadata()` → `settings.description` |
| `components/navigation/PublicHeader.tsx` | 30, 33 | `IAB` span, `IAB Connect` | `settings.logoText`, `settings.applicationName` (+ colors on 29) |
| `components/navigation/PublicFooter.tsx` | 17, 19 | `IAB` span, `IAB Connect` | `settings.logoText`, `settings.applicationName` (+ colors on 16) |
| `app/page.tsx` | 70, 73 | `IAB` span, `IAB Connect` h1 | `settings.logoText`, `settings.applicationName` (+ colors on 69) |
| `app/admin/register/page.tsx` | 114, 116 | `IAB` span, `IAB Connect` h1 | settings logo/name (+ colors on 113) |
| `app/admin/register/page.tsx` | 117 | `<p>Indischer Kulturverein Bern</p>` | **remove** (no tagline field — Q1) |
| `app/admin/register/page.tsx` | 263 | `© {year} Indischer Kulturverein Bern` | `© {year} {settings.applicationName}` |
| `app/public/contact/page.tsx` | 229–230, 257 | `info@iab-kulturverein.ch`, `Indischer Kulturverein` in address block | `settings.contactEmail` / address from settings (E9-S1 adds these fields) — see Q3 |
| `communication/email-campaigns/new/page.tsx` | 60 | `fromName: "IAB Connect"` | default from `settings.applicationName` via effect |
| `communication/email-campaigns/[id]/edit/page.tsx` | 101 | `fromName: data.fromName \|\| "IAB Connect"` | `data.fromName \|\| settings.applicationName` |

### B. Cosmetic — code-header comments (de-brand for consistency, low priority)

`lib/auth.ts:2`, `lib/services/api.ts:2`, `app/page.tsx:4`, `app/auth/error/page.tsx:4`, `app/login/page.tsx:4`, `app/admin/register/page.tsx:4` — all say "...for IAB Connect" / "...IAB Connect backend". Replace with neutral wording.

### C. Out of scope (do NOT touch in this story)

- **Keycloak realm / client-ID identifiers** (`lib/auth.ts:135`, `login/page.tsx:138`, `api/auth/[...nextauth]/route.ts:41–43`, `users.test.ts`): `iabconnect` / `iabconnect-frontend` are infrastructure identifiers that must match Keycloak config — env-driven, separate concern. The **dev-credentials block** in `login/page.tsx:161–167` (`admin@iabconnect.ch` etc.) is the only user-visible one and is `NODE_ENV === "development"` only — leave it; flag as Q4.
- **`#EA580C` / `bg-orange-600` outside the four logo circles** — general theming (login button accent, etc.) is not this story. Only the logo-circle background/text on the four components in Task 1 get wired to settings colors.
- **i18n message-file strings** — `de.json`/`en.json` org strings are **E9-S4**, not here. (`PublicFooter`'s `t("description")`/`t("copyright")` keys are E9-S4 territory.)
- **The favicon** (`layout.tsx:18`) — build-time asset, no `favicon.ico` currently exists in `frontend/public/`; configurable favicon is a separate concern (Q2).

### D. Current state of files being modified

- **`useAppSettings()`** is in `frontend/src/components/providers/AppSettingsProvider.tsx`, mounted globally via `app/providers.tsx`. Client-side only (`"use client"`, fetches `/api/v1/settings/public` in a `useEffect`). Returns `{ settings, isLoading, refresh }`. **Canonical consumer to copy: `components/navigation/Header.tsx`** — line 12 import, line 21 `const { settings } = useAppSettings()`, lines 96–108 the logo+name JSX. `PublicHeader`/`PublicFooter`/`page.tsx`/`admin/register` should adopt that exact shape.
- **`app/layout.tsx`** is a **Server Component** (`export const metadata`, `async function RootLayout`) — it **cannot** call the client hook. `generateMetadata()` is the correct mechanism; it can `fetch` server-side.
- **Email-campaign pages** use `useState` initializers for the form. `useAppSettings()` returns the provider default until the async fetch resolves — so don't put `settings.applicationName` directly in the `useState(...)` initializer (stale-default flash). Initialize empty, set in `useEffect` once `!isLoading`.
- **Provider default** is `applicationName: "Association Connect by Harwinder Singh"` / `logoText: "AC"` — itself semi-branded. Leaving it is fine for this story (E9-S1 owns the provider defaults); just don't introduce new "IAB" defaults.

### E. Architecture & project constraints

- All user-visible frontend text uses `next-intl` keys; no hardcoded German/English literals. Frontend: double quotes, 2-space indent, Prettier Tailwind class sorting, `orange-600`/`orange-700` primary. [Source: project-context.md]
- Reuse existing nav/layout components (`Header`, `PublicHeader`, `PublicFooter`, `useAuth`) — this story extends them, creates nothing new. [Source: project-context.md, architecture.md#ADR-006]
- Public routes live under `frontend/src/app/public` with the public layout. [Source: project-context.md]
- `useAppSettings()` is the sanctioned settings access path — do not fetch settings ad hoc per component. [Source: architecture.md#REQ-086]

### Project Structure Notes

UPDATE-only story — 8 source files + 2 email-campaign pages, no new files, no new packages. The `app/layout.tsx` change from static `metadata` to `generateMetadata()` is the only structural change. The Sprint Change Proposal estimated ~23 occurrences across 13 files; the exploration confirmed ~23 user-facing/functional + 6 cosmetic comments — the table in §A is the authoritative list.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E9-S2: Replace Hardcoded Organization References in Frontend]
- [Source: _bmad-output/planning-artifacts/prd.md#REQ-086]
- [Source: _bmad-output/planning-artifacts/architecture.md#REQ-086] — `useAppSettings()` provider as the settings path
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md] — frontend codebase scan (~23 occurrences / 13 files)
- [Source: frontend/src/components/navigation/Header.tsx:96-108] — canonical logo-from-settings pattern to copy
- [Source: e9-s1-extend-systemsettings-and-add-branding-admin-ui.md] — dependency: adds `description` + contact fields to `AppSettings`

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **`admin/register` tagline.** Line 117 `<p>Indischer Kulturverein Bern</p>` has no matching settings field. Recommended: remove it (the org name is already in the h1 above). Confirm, or add a `tagline` setting in a later story.
2. **Favicon.** `layout.tsx:18` references `/favicon.ico` which doesn't exist in `frontend/public/`. A configurable/neutral favicon is a build-time asset concern — recommend deferring to a follow-up. Confirm out-of-scope.
3. **Contact page fields.** `public/contact/page.tsx` needs `contactEmail` and an address — E9-S1 adds `ContactEmail`/`ContactPhone`/`ContactAddress` to `SystemSettings` but **`GET /api/v1/settings/public` deliberately does NOT expose contact fields** (admin-only, per E9-S1). So the public contact page cannot read them from `useAppSettings()`. Options: (a) expose contact fields publicly after all, (b) move the contact-page values to `next-intl` keys (→ E9-S4), (c) the public contact page fetches the admin endpoint — no, it's anonymous. **Recommend (b): the contact page strings become i18n keys, handled in E9-S4.** Confirm — this shifts contact-page lines 229/230/257 out of E9-S2 scope into E9-S4.
4. **Dev-credentials block.** `login/page.tsx:161–167` shows `admin@iabconnect.ch` etc. in a `development`-only block. Leave as-is, or de-brand the demo emails?

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (bmad-dev-story)

### Debug Log References

- `Write` tool repeatedly appended a stray closing tag to created files; each occurrence was stripped before running tests.

### Completion Notes List

- All confirmed user-visible org references from the §A checklist replaced — logo blocks (`PublicHeader`/`PublicFooter`/`app/page.tsx` hero/`admin/register`) now render from `useAppSettings()`; browser metadata via `generateMetadata()`; email-campaign `fromName` defaults from settings. The `admin/register` tagline `<p>Indischer Kulturverein Bern</p>` was removed (Q1 recommendation — the org name is already in the h1).
- **Q3 (public contact page)** — followed the Dev Notes recommendation: `public/contact/page.tsx` lines 229/230/257 are **NOT** touched here; they move to E9-S4 (i18n keys), since `GET /api/v1/settings/public` deliberately does not expose contact fields.
- **§C out-of-scope respected** — Keycloak realm/client-ID identifiers, the `development`-only dev-credentials block, the `noreply@iabconnect.ch` `fromEmail` default, the favicon, and general theming colors were left untouched.
- **Validations:**
  - `npm run typecheck` → pass.
  - `npx vitest run` → **52/52 pass** (full suite; +14 new across 5 files, no regressions).
  - `prettier --write` applied to all 16 changed files; they are now format-clean.
  - `npm run lint` → all files changed by this story are lint-clean. ⚠️ The global `npm run lint` reports **2 pre-existing errors + 1 warning** (`react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`) in `src/app/members/segments/page.tsx` and `src/app/admin/backups/page.tsx` — files **not touched by this story**. Same pre-existing baseline failure flagged in E9-S1; recommend a dedicated cleanup item (E9 retro candidate).
- `npm run format:check` flags `.next/` build artifacts (pre-existing `.prettierignore` gap, unrelated to source).

### File List

**Frontend (new — tests):**
- `frontend/src/components/navigation/PublicBranding.test.tsx`
- `frontend/src/app/layout.test.ts`
- `frontend/src/app/page.test.tsx`
- `frontend/src/app/admin/register/page.test.tsx`

**Frontend (modified):**
- `frontend/src/components/navigation/PublicHeader.tsx`
- `frontend/src/components/navigation/PublicFooter.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/admin/register/page.tsx`
- `frontend/src/app/communication/email-campaigns/new/page.tsx`
- `frontend/src/app/communication/email-campaigns/[id]/edit/page.tsx`
- `frontend/src/lib/auth.ts`
- `frontend/src/lib/services/api.ts`
- `frontend/src/app/auth/error/page.tsx`
- `frontend/src/app/login/page.tsx`

### Change Log

- 2026-05-14 — Story 9.2 implemented (REQ-086, E9-S2): hardcoded organization references removed from frontend source — logo/name blocks render from `useAppSettings()`, browser metadata via `generateMetadata()`, email-campaign `fromName` defaults from settings, file-header comments de-branded. 4 new Vitest files (14 cases); full suite 52/52 green; typecheck clean. Status → review.

## Review Findings

_Epic-boundary code review — 2026-05-14 (bmad-code-review). 3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

### Decision Needed (resolved 2026-05-14 → patch)

- [x] [Review][Patch] Login page logo block still hardcodes branding [`app/login/page.tsx`] — the page imports `useAppSettings()` (S4 wired `auth.useYourCredentials`) but the logo circle + name still render literal `ACA` / `Association Connect` / `Vereins Applikation`; not on the authoritative S2 §A checklist. **Resolution: fix in E9** — wire the login logo circle + name to `settings.logoText`/`settings.applicationName` (+ logo colors), mirroring the canonical `Header.tsx` pattern.
- [x] [Review][Patch] `noreply@iabconnect.ch` / dev-credential emails still hardcoded [`email-campaigns/new/page.tsx`, `email-campaigns/[id]/edit/page.tsx`, `app/login/page.tsx`] — `fromEmail: "noreply@iabconnect.ch"` ships as the default in both campaign pages; the login page lists `admin@iabconnect.ch` etc. as dev credentials. The S4 re-grep checked `iab-kulturverein` but not `iabconnect`. **Resolution: fix in E9** — de-brand the `fromEmail` defaults to a neutral placeholder; de-brand the dev-credential example emails on the login page.

### Patches

- [x] [Review][Patch] `generateMetadata()` has no fetch timeout [`app/layout.tsx` `generateMetadata`] — the server-side `fetch` to `/api/v1/settings/public` has `next.revalidate: 300` and a try/catch fallback, but no `AbortController`/`AbortSignal.timeout`; a slow/hanging backend (not down) stalls SSR of every page up to the platform timeout. Add a timeout signal.
- [x] [Review][Patch] `EditEmailCampaignPage` clobbers unsaved edits when settings resolve late [`email-campaigns/[id]/edit/page.tsx`] — `settings.applicationName` is in the `loadCampaign` `useCallback` deps (S2 AC-4 literally prescribed this); if `AppSettingsProvider` resolves after the campaign loads, the load effect re-fires and overwrites the form, discarding interim user edits. Apply the `applicationName` fallback without putting it in the load callback's deps (ref, or apply-once).
- [x] [Review][Patch] `NewEmailCampaignPage` can submit an empty `fromName` [`email-campaigns/new/page.tsx`] — `fromName` initializes `""` and the `settings.applicationName` default is applied only by a post-load `useEffect`; submitting before `settingsLoading` flips false sends `""`. Guard submit while settings load, or fall back at submit time.

### Deferred

- [x] [Review][Defer] Pre-existing lint baseline failure in untouched files [`members/segments/page.tsx`, `admin/backups/page.tsx`] — all 4 E9 stories self-report this baseline `npm run lint` failure in files E9 never touched; not an E9 regression. — deferred, pre-existing — flagged for the E9 retrospective / a cleanup pass.
