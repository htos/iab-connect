# Story 10.4: Add Frontend Module Enforcement

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user**,
I want **disabled modules hidden from navigation and blocked on direct URL**,
so that **the UI reflects my deployment's configuration and I don't hit broken pages**.

**Requirement:** REQ-087. Epic E10, Story 4 of 5.
**Depends on E10-S2** (the `modules` map on `GET /api/v1/settings/public`) and E10-S3 (the backend 403 is the real control — this story is UX/direct-URL convenience, layers 2 & 3 of ADR-008). **Heavy file coordination with E9-S1** on `AppSettingsProvider.tsx`.

## Acceptance Criteria

1. **`AppSettings` carries `modules`.** The `AppSettings` interface, `defaultSettings`, and `fetchSettings()` mapping in `AppSettingsProvider.tsx` are extended with a `modules: Record<ModuleKey, boolean>` map, sourced from the `modules` field of `GET /api/v1/settings/public` (added in E10-S2). `defaultSettings.modules` has all 7 modules `true` (behavior-preserving).
2. **Sidebar filters disabled modules.** `NavItem` gains a `requiresModule?: string` flag; `Sidebar` hides nav items (top-level and submenu) whose module is disabled — using the same filtering mechanism as the existing `requiresDoubleEntry` flag. Dashboard, My Profile, and Admin are never gated.
3. **Middleware route guard.** A new `frontend/src/middleware.ts` rewrites direct navigation to a disabled-module route to `/module-unavailable`. The module→route mapping is a shared frontend contract referenced by both `middleware.ts` and `Sidebar`.
4. **`/module-unavailable` page.** A new `/module-unavailable` page renders inside the authenticated shell with a clear heading, short explanation, and a "Back to dashboard" action.
5. **Dashboard widgets gated.** Quick-action cards and KPI sections on `app/page.tsx` sourced from a disabled module are hidden (Events, Documents, Members, Communication, Finance, Partners widgets — Admin card never gated).
6. **UX-only, not the control.** UI hiding and route rewriting are explicitly convenience/direct-URL protection; the backend 403 from E10-S3 is the security boundary. (Public View / `/public/*` / `/` rewriting is **E10-S5**, not this story.)
7. **Quality gate.** `npm run typecheck`, `npm run lint`, `npm run format:check` pass; Vitest tests cover Sidebar filtering by module, middleware redirect/rewrite, and the `/module-unavailable` page. Manual: disable a module → nav entry hidden, direct URL rewritten, backend still 403s.

## Tasks / Subtasks

- [x] **Task 1 — Extend `AppSettingsProvider` (AC: 1)** — `frontend/src/components/providers/AppSettingsProvider.tsx`:
  - [x] Added `modules: Record<string, boolean>` to the `AppSettings` interface.
  - [x] Added `modules` to `defaultSettings` — all 7 keys `true` (behaviour-preserving).
  - [x] Mapped `modules: data.modules ?? defaultSettings.modules` in `fetchSettings()`.
  - [x] E9-S1 already landed (epic-9 done) — branding fields were already present; `modules` added cleanly on top, no conflict.
- [x] **Task 2 — Module→route contract (AC: 3)** — new `frontend/src/lib/modules.ts`: `MODULE_KEYS`, `ModuleKey`/`GatedModuleKey` types, `MODULE_ROUTE_PREFIXES` (members→/members, events→/events, documents→/documents+/board/documents+/admin/documents, communication→/communication, finance→/finance, partners→/sponsors+/suppliers), and `resolveModuleForPath()` (longest-prefix-wins so `/admin/documents` resolves to `documents` without gating the rest of `/admin`).
- [x] **Task 3 — Sidebar filtering (AC: 2)** — `Sidebar.tsx`: added `requiresModule?: ModuleKey` to `NavItem`; tagged the 6 module-owned top-level items (members, events, documents, communication, finance, partner — NOT dashboard/profile/admin); `visibleNavItems` now `.filter()`s top-level items by `isModuleEnabled` and `.map()`s a submenu pre-filter (no prop-threading into `NavItemWithSubmenu`).
- [x] **Task 4 — Middleware (AC: 3, 6)** — new `frontend/src/middleware.ts`: `config.matcher` lists the 9 gated prefixes (members, events, documents, board/documents, admin/documents, communication, finance, sponsors, suppliers); `middleware()` resolves the path via `resolveModuleForPath`, reads the `modules` map from the anonymous `/api/v1/settings/public` (in-memory 30 s TTL cache), and `NextResponse.rewrite`s to `/module-unavailable` when the module is disabled. No next-intl interference — there was no existing middleware and the project does locale server-side.
- [x] **Task 5 — `/module-unavailable` page (AC: 4)** — new `frontend/src/app/module-unavailable/page.tsx`: authenticated shell, `max-w-4xl` centered card, non-alarming `PackageX` lucide icon, clear heading + explanatory text + admin hint, `orange-600` "Back to dashboard" link focused on load (not a keyboard trap). All text via next-intl keys. Mid-session 403: the existing api-client returns `{ error }` (no hard-crash) and the middleware rewrites on the next navigation — a dedicated `moduleUnavailable.sessionAlert` key is provided for pages that want to specialize the inline message; a global 403 interceptor was deliberately not added (cross-cutting, out of scope, risky).
- [x] **Task 6 — Dashboard widget gating (AC: 5)** — `frontend/src/app/page.tsx`: `useAppSettings()` was already imported (E9-S1); wrapped each module-sourced widget in a `settings.modules.<key> !== false` check — Quick-action cards (Events, Documents, Members, Communication, Finance, Partners; Admin NOT gated) and KPI sections (Member, Event, Finance).
- [x] **Task 7 — i18n + tests (AC: 7)**
  - [x] Added `moduleUnavailable.*` keys (heading, body, adminHint, backToDashboard, sessionAlert) to `de.json` + `en.json`.
  - [x] Vitest (jsdom): `Sidebar.test.tsx` — hides a module's nav item when disabled, keeps siblings + Dashboard/Profile/Admin; `module-unavailable/page.test.tsx` — renders heading/body/link + back button focused on load.
  - [x] Vitest (node): `middleware.test.ts` — rewrites a disabled-module path, passes an enabled-module path through, treats unknown key as enabled; `lib/modules.test.ts` — `resolveModuleForPath` prefix mapping incl. `/admin/documents`.
  - [x] `npm run typecheck` green; `npm run lint` clean on all changed files (2 pre-existing errors remain in untouched files `app/admin/backups/page.tsx` + `app/members/segments/page.tsx`); all changed files Prettier-formatted (`npm run format:check` reports pre-existing repo-wide formatting debt across 2447 untouched files — not introduced by this story). Frontend Vitest: 70/70 pass, no regressions.

## Dev Notes

### Coordination with E9-S1 (READ FIRST)

`AppSettingsProvider.tsx` is edited by **both** E9-S1 (branding fields) and this story (`modules` map) — the **same three locations**: the `AppSettings` interface (17–22), `defaultSettings` (30–35), and the `fetchSettings` mapping (54–61). The mapping block is the highest-conflict zone. **Recommendation: land E9-S1 first**, then this story adds `modules` on top; or assign explicit line-ownership. `Sidebar.tsx`, `middleware.ts`, `/module-unavailable`, and `page.tsx` widget-gating are E10-only — low conflict.

### Current state of files being modified

- **`Sidebar.tsx`** (564 lines) — `NavItem` interface (15–22) already has `requiredRoles?: string[]` and `requiresDoubleEntry?: boolean`. `navItems[]` (25–324) is a hardcoded array. **`requiresDoubleEntry` is the exact pattern to copy:** declared on submenu items (lines 251, 257), data fetched in `Sidebar()` via `GET /api/v1/finance/profile` (lines 462–471) into `isDoubleEntry` state, threaded into `NavItemWithSubmenu` as a prop (line 535, declared in `SidebarItemProps` line 330), filtered in the submenu `.filter()` (lines 416–421). Top-level filtering is at lines 497–500 (`visibleNavItems`). **For `requiresModule`, no new fetch/state is needed** — `settings` (with `modules`) is already in scope at `Sidebar()` line 451; just add the check to both filter sites. `roles` comes from `useAuth()` (line 450).
- **`AppSettingsProvider.tsx`** (89 lines) — `AppSettings` interface (17–22, 4 branding fields today), `defaultSettings` (30–35), `fetchSettings()` (47–68) maps each field with `data.X || default.X`, fetches `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/v1/settings/public`, swallows errors → keeps defaults. `useAppSettings()` returns `{ settings, isLoading, refresh }`.
- **No `middleware.ts` exists** — confirmed absent. `next.config.ts` uses `withNextIntl`, has `env.NEXT_PUBLIC_API_URL` (default `http://localhost:5000`) and an `async headers()` block, no existing matcher/rewrite. Middleware runs on the Edge runtime — it can read `process.env.NEXT_PUBLIC_API_URL` and `fetch`. Next.js matcher cannot be fully dynamic — use a broad matcher then branch in the function.
- **`MainLayout.tsx`** — line 52: `isFullPageLayout = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/public")` — anything else gets the authenticated Header+Sidebar shell. `/module-unavailable` is NOT in that list → it correctly renders inside the authenticated shell.
- **`app/page.tsx`** (519 lines) — `/` is both the unauthenticated landing page AND the authenticated dashboard. Quick-action cards at lines 149–286 (each with a `requiredRoles`-style auth gate already), KPI sections 288–428 (gated by `canViewKpis`). `KpiCard` component at 493–518. `useAppSettings()` is **not** currently imported here — add it next to `useAuth`/`useTranslations` (lines 10–11). KPI data is one `GET /api/v1/reports/dashboard` call.
- **Tests** — Vitest, co-located `*.test.tsx`, `environment: 'node'` default with per-file `// @vitest-environment jsdom` opt-in. Component tests mock `next-intl` (`useTranslations: () => (key) => key`), `next/navigation`, and provider hooks. Reference: `src/app/(dashboard)/events/[id]/check-in/page.test.tsx`.

### Architecture & project constraints

- **ADR-008 layers 2 & 3:** middleware route guard (direct-URL protection) + sidebar nav filtering (UX) — neither is the security control; the E10-S3 backend 403 is. [Source: architecture.md#ADR-008]
- The module→route mapping is a **shared frontend contract** referenced by both `middleware.ts` and `Sidebar`. [Source: architecture.md#ADR-008]
- Middleware reads the module map from the anonymous `GET /api/v1/settings/public` (E10-S2 adds it there precisely so middleware has an unauthenticated source). [Source: architecture.md#ADR-008]
- Frontend: next-intl for all text, `orange-600` primary, lucide-react icons, reuse shared components, authenticated page layout standard. [Source: project-context.md, ux-design.md]
- `requiresModule` follows the existing `requiresDoubleEntry` flag mechanism exactly. [Source: architecture.md#ADR-008, sprint-change-proposal-2026-05-14.md]

### UX specifics [Source: ux-design.md#Module Unavailable and Access Denied]

- `/module-unavailable`: authenticated shell, `max-w-4xl` centered content card, clear heading ("This module is not available"), short explanatory text, primary "Back to dashboard" button (`orange-600`), informative non-alarming lucide icon, optional "contact an admin" hint.
- Direct navigation to a disabled-module route → middleware **rewrites** to `/module-unavailable` (keeps the URL meaningful, avoids a confusing silent redirect).
- Mid-session 403 (module disabled while the user is active): inline alert + route to this page on next navigation; do not hard-crash.
- Not a keyboard trap; primary action focusable on load; status conveyed in text, not icon/color alone. All text via next-intl keys.

### Project Structure Notes

NEW: `frontend/src/middleware.ts`, `frontend/src/app/module-unavailable/page.tsx`, `frontend/src/lib/modules.ts` (shared module→route contract + `ModuleKey` type). UPDATE: `AppSettingsProvider.tsx`, `Sidebar.tsx`, `app/page.tsx`, `de.json`, `en.json`. No new packages.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E10-S4: Add Frontend Module Enforcement]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] — layers 2 & 3
- [Source: _bmad-output/planning-artifacts/ux-design.md#Module Unavailable and Access Denied]
- [Source: frontend/src/components/navigation/Sidebar.tsx] — `requiresDoubleEntry` pattern to mirror
- [Source: frontend/src/components/providers/AppSettingsProvider.tsx]
- [Source: e10-s2-add-module-settings-api-and-modules-admin-tab.md] — dependency (`modules` on public settings)
- [Source: e9-s1-extend-systemsettings-and-add-branding-admin-ui.md] — `AppSettingsProvider.tsx` file-coordination

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **Middleware settings-fetch cost.** Fetching `/api/v1/settings/public` on every matched request is expensive. Recommend a short-lived cache (e.g. `fetch` with `next: { revalidate: 30 }` or an in-memory TTL). Confirm an acceptable staleness window for module changes to take effect (≤30–60s seems fine).
2. **`/admin/documents` gating.** It's part of the Documents module but lives under `/admin`. Middleware must gate that specific subpath without gating the rest of `/admin`. Confirm `/admin/documents` is gated under `documents` while the rest of `/admin` is never gated.
3. **E9-S1 sequencing.** Strongly recommend E9-S1 lands before E10-S4 (shared `AppSettingsProvider.tsx` edit points). Confirm sequencing or assign line-ownership.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Amelia / bmad-dev-story)

### Debug Log References

- `npm run typecheck`: green.
- `npm run lint`: changed files clean (`eslint <12 changed files>` exit 0); repo-wide run reports 2 pre-existing errors in untouched files (`app/admin/backups/page.tsx`, `app/members/segments/page.tsx`).
- `npm run format:check`: pre-existing repo-wide formatting debt (2447 files) — all 12 files changed by this story were run through `prettier --write` and are clean.
- Frontend Vitest (full suite): 70/70 passed, 14 files — incl. 11 new E10-S4 tests, no regressions.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- ✅ **Task 1** — `AppSettings` extended with `modules: Record<string, boolean>`; `defaultSettings.modules` all-true; `fetchSettings` maps `data.modules ?? default`. E9-S1 had already landed so there was no live coordination conflict.
- ✅ **Task 2** — `lib/modules.ts` is the shared contract: `MODULE_KEYS`, `ModuleKey`/`GatedModuleKey`, `MODULE_ROUTE_PREFIXES`, `resolveModuleForPath()` (longest-prefix-wins; `/admin/documents` → `documents`, bare `/admin` → `null`).
- ✅ **Task 3** — `Sidebar` `NavItem.requiresModule?: ModuleKey`; 6 top-level items tagged; `visibleNavItems` filters top-level + pre-filters submenus by `isModuleEnabled` (`settings.modules[key] !== false`). Dashboard/My Profile/Admin untagged → never gated.
- ✅ **Task 4** — `middleware.ts` with a 9-prefix `config.matcher`; reads the module map from the anonymous public-settings endpoint behind a 30 s in-memory TTL cache; `NextResponse.rewrite` → `/module-unavailable` for disabled modules, else `.next()`. Unknown key / fetch failure → treated as enabled (behaviour-preserving; the E10-S3 backend 403 is the real control).
- ✅ **Task 5** — `/module-unavailable/page.tsx`: authenticated-shell card, `PackageX` icon, heading/body/adminHint, focused `orange-600` back-to-dashboard link. Mid-session 403 is already non-crashing via the existing api-client `{ error }` contract + middleware rewrite-on-next-navigation; `sessionAlert` i18n key provided. A global 403 interceptor was intentionally NOT built — cross-cutting, out of scope, and risky.
- ✅ **Task 6** — Dashboard quick-action cards (Events/Documents/Members/Communication/Finance/Partners) and KPI sections (Member/Event/Finance) gated by `settings.modules.<key> !== false`; Admin card never gated.
- ✅ **Task 7** — `moduleUnavailable.*` i18n keys (de + en); 11 new Vitest tests across 4 files (jsdom: Sidebar, module-unavailable page; node: middleware, modules contract). Quality gate: typecheck green, changed files lint-clean and Prettier-formatted; pre-existing repo-wide lint/format debt in untouched files is left as-is (out of scope).
- **ADR-008 layers 2 & 3 only:** sidebar hiding + middleware rewrite are UX / direct-URL convenience — the E10-S3 backend 403 remains the security boundary (AC-6).

### File List

**New:**
- `frontend/src/lib/modules.ts`
- `frontend/src/middleware.ts`
- `frontend/src/app/module-unavailable/page.tsx`
- `frontend/src/lib/modules.test.ts`
- `frontend/src/middleware.test.ts`
- `frontend/src/app/module-unavailable/page.test.tsx`
- `frontend/src/components/navigation/Sidebar.test.tsx`

**Modified:**
- `frontend/src/components/providers/AppSettingsProvider.tsx` (`modules` on `AppSettings` + defaults + fetch mapping)
- `frontend/src/components/navigation/Sidebar.tsx` (`requiresModule` flag + nav filtering)
- `frontend/src/app/page.tsx` (dashboard widget + KPI-section gating)
- `frontend/messages/en.json`, `frontend/messages/de.json` (`moduleUnavailable.*` keys)

## Change Log

| Date       | Change                                                                                          |
|------------|-------------------------------------------------------------------------------------------------|
| 2026-05-14 | E10-S4 implemented: `AppSettings.modules` map, shared `lib/modules.ts` contract, `Sidebar` `requiresModule` filtering, `middleware.ts` direct-URL route guard, `/module-unavailable` page, dashboard widget gating, `moduleUnavailable.*` i18n. 11 new Vitest tests; frontend 70/70 green, typecheck green. Status → review. |

## Review Findings

_Epic-10 boundary code review — bmad-code-review, 2026-05-14. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

- [ ] [Review][Patch] `hasAuthSession` in `middleware.ts` only matches `next-auth.session-token` / `__Secure-next-auth.session-token` — it misses chunked cookies (`.0`, `.1`, … when the session JWT exceeds ~4 KB), the `__Host-` prefix, and Auth.js v5 `authjs.*` names. An authenticated user with a chunked session hitting `/` while `public_view` is off is misclassified as anonymous and rewritten to `/site-unavailable` — locked out of their own dashboard. Use prefix/`startsWith` matching [frontend/src/middleware.ts]
- [ ] [Review][Patch] `getModules()` (middleware) and `fetchSettings()` (`AppSettingsProvider`) cast `data.modules` with no shape validation — a malformed settings response (array, string, or string-valued booleans like `"true"`) makes every `modules[key] === false` check falsey-but-not-`false`, silently disabling all frontend gating with no error [frontend/src/middleware.ts, frontend/src/components/providers/AppSettingsProvider.tsx]
