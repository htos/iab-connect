# Story 10.4: Add Frontend Module Enforcement

Status: ready-for-dev

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

- [ ] **Task 1 — Extend `AppSettingsProvider` (AC: 1)** — `frontend/src/components/providers/AppSettingsProvider.tsx`:
  - [ ] Add `modules: Record<string, boolean>` (or a `ModuleKey` union type) to the `AppSettings` interface (lines 17–22).
  - [ ] Add `modules` to `defaultSettings` (lines 30–35) — all 7 keys `true`.
  - [ ] Map `modules: data.modules ?? defaultSettings.modules` in `fetchSettings()` (lines 54–61).
  - [ ] ⚠️ **E9-S1 collides here** — it adds branding fields to the same interface/defaults/mapping. Coordinate (see §Coordination).
- [ ] **Task 2 — Module→route contract (AC: 3)** — create a shared module-to-route-prefix map (e.g. `frontend/src/lib/modules.ts`) referenced by both `middleware.ts` and `Sidebar`: `members→/members`, `events→/events`, `documents→/documents`+`/board/documents`+`/admin/documents`, `communication→/communication`, `finance→/finance`, `partners→/sponsors`+`/suppliers`. (`public_view` handled in E10-S5.) Also export the `ModuleKey` type.
- [ ] **Task 3 — Sidebar filtering (AC: 2)** — `frontend/src/components/navigation/Sidebar.tsx`:
  - [ ] Add `requiresModule?: string` to the `NavItem` interface (lines 15–22).
  - [ ] Tag the module-owned top-level/submenu items in `navItems[]` (members, events, documents, communication, finance, partners — NOT dashboard/profile/admin).
  - [ ] Filter: `settings` is already in scope in `Sidebar()` (line 451 `const { settings } = useAppSettings()`). Add a `requiresModule` check to the **top-level** filter (lines 497–500) AND the **submenu** filter (lines 416–421) — mirror the `requiresDoubleEntry` check. `NavItemWithSubmenu` doesn't currently receive `settings` — either thread it down like `isDoubleEntry`, or pre-filter submenus before passing the item down (recommend pre-filter to avoid prop-threading).
- [ ] **Task 4 — Middleware (AC: 3, 6)** — new `frontend/src/middleware.ts`:
  - [ ] `export const config = { matcher: [...] }` listing the gated route prefixes (members, events, documents, board/documents, admin/documents, communication, finance, sponsors, suppliers), excluding `_next`, static assets, `/api`.
  - [ ] `export function middleware(request)` — read the `modules` map (fetch `${NEXT_PUBLIC_API_URL}/api/v1/settings/public` — anonymous; cache it short-lived to avoid a fetch per request), resolve the request path to a module via the Task-2 map, and if that module is disabled → `NextResponse.rewrite(new URL("/module-unavailable", request.url))`; else `NextResponse.next()`.
  - [ ] Verify the new file doesn't break `next-intl` locale handling (the project does locale via `getLocale()` server-side, not next-intl middleware — the new middleware must not interfere).
- [ ] **Task 5 — `/module-unavailable` page (AC: 4)** — new `frontend/src/app/module-unavailable/page.tsx`: authenticated shell (`MainLayout` renders it with Header+Sidebar since it's not under `/public` or `/login`), `max-w-4xl` centered card, an informative (non-alarming) lucide icon, a clear heading + short explanatory text, a `orange-600` "Back to dashboard" button (focusable on load — not a keyboard trap). All text via next-intl keys. Also handle the mid-session API-403 case: an inline alert + route to this page on next navigation (don't hard-crash).
- [ ] **Task 6 — Dashboard widget gating (AC: 5)** — `frontend/src/app/page.tsx`: add `useAppSettings()` (not currently imported), and wrap each module-sourced widget in a `settings.modules.<key>` check — Quick-action cards (Events ~151, Documents ~169, Members ~187, Communication ~207, Finance ~227, Partners ~247; Admin ~267 NOT gated) and KPI sections (Member ~305, Event ~353, Finance ~397).
- [ ] **Task 7 — i18n + tests (AC: 7)**
  - [ ] Add `moduleUnavailable.*` keys (heading, body, button, mid-session 403 alert) to `de.json` + `en.json`.
  - [ ] Vitest (jsdom): Sidebar hides a module's nav item when `settings.modules.<key>` is false (mock `useAppSettings`); `/module-unavailable` page renders + back button focusable.
  - [ ] Vitest (node env): `middleware.ts` rewrites a disabled-module path to `/module-unavailable`, passes through an enabled-module path. Mock the settings `fetch`.
  - [ ] `npm run typecheck && npm run lint && npm run format:check` green.

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

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
