# Story E30.4: Dashboard root page — `features/dashboard` feature-slice migration

Status: ready-for-dev

Depends on: **E30-S1 (PageShell/PageHeader)** + E21-S3 + E21-S5 (closed). **Added 2026-06-12 per user "Add both"** — expands E30 beyond the original 3-story skeleton. Owns `app/page.tsx`; runs **after E30-S3** (S3 froze + net-pinned `page.tsx`; this story is the sanctioned migration S3 explicitly deferred). Coordinated with **E30-S5** (the retrofit) which **excludes** `page.tsx` because this story owns it.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the 785-line root dashboard god-page (`app/page.tsx`) migrated into a `features/dashboard/` slice with its data on a TanStack hook and its chrome on PageShell, **without changing any rendered output or behaviour**,
so that the app's most-trafficked page matches the feature-slice template that every domain epic (E22-E29) established, and the last god-page in the app shell is retired.

## Context

This is the **final god-page migration of the whole program** and structurally identical to the E22-E29 domain migrations: characterization-net-first (A87), then extract `{api,hooks,types,components}` + thin the route entry, keeping the net green throughout (A103). `page.tsx` is unusual only in that it is the **root route** and already routes through the standard `useApiClient` contract (so the transport is **BUILD on `useApiClient`**, the A88/A94 "no lib module" path — like email-campaigns in E25). E30-S3 added the no-redirect characterization net for this page; **this story extends that net to full coverage, then migrates under it.**

## Acceptance Criteria

**Behaviour preserved (the net is the oracle — every branch byte-identical):**

1. **No redirect.** The root keeps its three-way **render** branch with **no** `redirect()`/`router.push`/`notFound()`: `isLoading` → the orange spinner (`border-orange-600`); `!isAuthenticated` → the gradient landing (`from-orange-50 to-amber-100`) with the branded logo block (`settings.logoBackgroundColor/logoTextColor/logoText/applicationName`), `home.welcomeGuest` text, and the four links `/public/events`, `/public/blog`, `/public/contact`, `/login`; authenticated → the dashboard (`OnboardingBanner`, welcome header, role-badge card driven by `isAdmin`/`isVorstand`/`isMember`, quick-actions grid, KPI sections).
2. **Auth + role gating unchanged.** `useAuth()` destructure (`isAuthenticated, isLoading, user, roles, isAdmin, isVorstand, isMember, canReadFinance`); `canViewKpis = isVorstand || isAdmin`; the KPI fetch only runs when `isAuthenticated && canViewKpis`; the Finance KPI section additionally requires `canReadFinance`; Member/Communication/Finance/Partner quick-actions require `isVorstand || isAdmin`; the Admin link requires `isAdmin`.
3. **Module gating unchanged (REQ-087).** Every quick-action `<Link>` and KPI `<section>` stays gated by `settings.modules.<events|documents|members|communication|finance|partners> !== false` (default-on `!== false` semantics — preserve exactly, do not flip to truthy checks).
4. **KPI data path preserved.** The dashboard overview is fetched from `/api/v1/reports/dashboard`, typed `DashboardOverview`; the same KPI cards render with the same `formatCHF` formatting and the same `KpiCard` `colorClasses` map (`green/red/yellow/blue/gray`); the error and empty surfaces render the **same copy** as today (A79 — pin the error/empty COPY even though the loading lifecycle mechanism changes).
5. **i18n keys unchanged** and resolvable in `en.json` + `de.json` (the real parity pair; `hi.json` is a partial stub missing `home.*` — **left as-is**, per the E30-S2 i18n correction). `home.*`/`common.*`/`roles.*` keys unchanged.
6. No route, route-group, or API-contract change. `npm run typecheck` + `npm test -- --run` green; `next build` (epic boundary) clean.

**Improvements (the migration):**

7. A `features/dashboard/` slice is created following the template: `api/dashboard-api.ts` (the `/api/v1/reports/dashboard` URL + a `dashboardKeys` factory), `types/dashboard.types.ts` (the inline DTOs `MemberTrendItem`/`MemberKpis`/`EventCategoryBreakdown`/`EventKpis`/`FinanceKpis`/`DashboardOverview` relocated; shared types stay in `src/types` if any already live there), `hooks/use-dashboard-overview.ts` (a TanStack `useQuery` wrapping the existing `useApiClient` call), `components/dashboard-content.tsx` (the single `"use client"` composition root) + extracted presentational pieces (`kpi-card.tsx`, and the landing / role-badge / quick-actions blocks as the dev judges clean). `app/page.tsx` becomes a thin entry.
8. The dashboard chrome adopts `PageShell`/`PageHeader` (E30-S1) **where it produces byte-identical output** — the authenticated dashboard's `<main className="min-h-[calc(100vh-4rem)] …">` frame maps to `<PageShell>`; the spinner and gradient-landing branches keep their bespoke full-screen frames (they are not the standard content frame). No raw `/api/v1/...` URL remains in a component (it moves to `api/dashboard-api.ts`); only the composition root is `"use client"`.

## Tasks / Subtasks

- [ ] **Task 0: Spike + resolve DECs** (AC: all) — A56; A43 (a)/(b)/(c) per DEC.
  - [ ] Read **all** of `app/page.tsx` (~785 lines) — the 3 branches, the `apiRef`/`fetchKpis` pattern, the module gates, the inline DTOs + `KpiCard`, every `home.*`/`common.*`/`roles.*` key, every quick-action gate. Confirm E30-S3's `app/page.test.tsx` net is green at HEAD.
  - [ ] Enumerate the A79 manual-`useState`+`useEffect` → TanStack `useQuery` deltas for the KPI fetch (DEC-2) and decide each.
  - [ ] Resolve DEC-1 (slice decomposition depth), DEC-2 (query semantics), DEC-3 (landing/spinner branch placement).
- [ ] **Task 1: Extend the characterization net to FULL coverage** (AC: 1-5) — build on E30-S3's `app/page.test.tsx`. Mock `@/lib/auth#useAuth`/`useApiClient` (stable refs, A78), `next-intl#useTranslations` (stable identity, A64), `next/navigation` (assert `push` **not** called), `useAppSettings`, `OnboardingBanner`. Self-wrap `QueryClientProvider({ retry:false })` (A103) so the KPI path mounts deterministically. Pin: the 3 branches; the four landing links; the role-badge per role; **every module gate** (toggle each `settings.modules.X` true/false → the section/link appears/disappears); the KPI cards render from a mocked `/api/v1/reports/dashboard` payload with `formatCHF` output; the **KPI error copy** and **empty copy** (A79 — these survive the lifecycle change); `canViewKpis=false` → no KPI fetch fired. **Green at HEAD before extraction.**
- [ ] **Task 2: Slice transport + types** (AC: 7) — `features/dashboard/api/dashboard-api.ts` (`DASHBOARD_OVERVIEW_URL = "/api/v1/reports/dashboard"` builder-style + `dashboardKeys = { overview: () => ["dashboard","overview"] as const }`); `features/dashboard/types/dashboard.types.ts` (relocate the 6 inline DTOs; if any duplicate a `src/types/*` shape, re-export per A83 rather than fork). The api layer is **builders + keys only** — the hook owns the `useApiClient` call (A103).
- [ ] **Task 3: TanStack hook** (AC: 4, 7) — `features/dashboard/hooks/use-dashboard-overview.ts`: `useQuery({ queryKey: dashboardKeys.overview(), queryFn: () => apiClient.get<DashboardOverview>(DASHBOARD_OVERVIEW_URL)…, enabled: isAuthenticated && canViewKpis })`. **`enabled` must match the god-page's fetch gate** (`isAuthenticated && canViewKpis`), NOT a render/role gate (A97). Decide `retry` per DEC-2 (the manual version did a single fetch with no retry → `retry: false` preserves that; the provider default `retry:1` would double-fetch — A99). Surface `{ data, isLoading, isError, error }`; map the error to the **same copy** the god-page showed (A79 — error message preserved; `useApiClient` returns `{data,error}` so the error string is available).
- [ ] **Task 4: Composition root + presentational pieces + PageShell** (AC: 1-3, 8) — `features/dashboard/components/dashboard-content.tsx` (`"use client"`) holding the 3-branch render, consuming `useAuth` + `use-dashboard-overview`; extract `kpi-card.tsx` (+ `colorClasses`) and, per DEC-1, the landing/role-badge/quick-actions blocks. The authenticated dashboard frame adopts `<PageShell>` (byte-identical); spinner + gradient-landing keep their bespoke frames. Preserve `formatCHF`, the module gates, and all copy verbatim.
- [ ] **Task 5: Thin route entry** (AC: 6) — `app/page.tsx` → `export default function HomePage(){ return <DashboardContent />; }` (or re-export). Stays a client entry. E30-S3's `app/page.test.tsx` (now the Task-1 net) renders this entry → identical DOM → green.
- [ ] **Task 6: Net survives + A79 audit** (AC: 1-5) — re-run the full net after extraction. The manual→TanStack migration is the A79/A92/A93/A99 risk surface: confirm (a) no spinner-flash regression on the KPI section (the dashboard had `kpiLoading`; TanStack `isLoading` differs — pin the loading copy/skeleton if one existed), (b) the error is **not** sticky in a way that diverges (read-only page, no mutation, so low risk — but verify), (c) `retry` choice doesn't add a ~1s delay vs the god-page's immediate render (A93/A99). No spec softened (a boundary net-integrity check will diff vs HEAD).
- [ ] **Task 7: DoD gate** (AC: 6) — `npm run typecheck` clean; `npx eslint <changed> --max-warnings=0`; `npx prettier --write` on **new** slice files, `--check` (hand-matched) on the modified `app/page.tsx` (pre-drifted — A72/A81); `npm test -- --run` (full net green + suite unchanged). LF (A73). `git diff --stat` — `page.tsx` collapses to a thin entry (large deletion), slice files are new.

## Dev Notes

The dashboard is already on the standard `useApiClient` contract, so there is **no transport rewrite** — the migration is: pin behaviour, lift the body into a slice, wrap the one fetch in `useQuery`, adopt PageShell on the one standard-frame branch, thin the route. The A79 deltas (manual `useState`/`useEffect` → `useQuery`) are the only real behaviour risk and are small here because the dashboard is **read-only** (no mutations → no sticky-error / no refetch-after-mutation concerns; the main items are `enabled`-gate parity (A97) and `retry` choice (A99)).

### Scope Boundaries

- **In scope:** `features/dashboard/` slice; the full characterization net; PageShell on the authenticated dashboard frame; thin `app/page.tsx`.
- **Out of scope:** changing any branch's rendered output, the module-gate semantics, the role gates, the landing links, or the KPI endpoint/DTOs; adding i18n to `hi.json`; adopting PageShell on the spinner/landing branches (bespoke full-screen frames); the `/api/v1/reports/dashboard` backend (frozen contract).

### Architecture Guardrails

- **`enabled` = the FETCH gate, not the role/redirect gate (A97):** `isAuthenticated && canViewKpis` (exactly the god-page's `useEffect` condition). A non-privileged user must reach the same no-KPI surface, not a stuck spinner.
- **`retry` (A99):** the god-page did one fetch, no retry. Default provider `retry:1` would double-fetch + delay. Choose `retry:false` (the status surface exists via `useApiClient`, but this isn't a 404-sentinel case — it's a section error, so plain `retry:false` matches HEAD). Record in DEC-2.
- **Error/empty COPY is pinned (A79):** the loading **mechanism** changes (manual `kpiLoading` → `isLoading`), but the error text + empty text must be byte-identical. Net asserts the copy.
- **`apiRef` indirection is gone post-migration** — TanStack's `queryFn` closure replaces the `apiRef`/`[t]`-deps dance; that's the sanctioned A79 mechanism swap, fine as long as the net stays green.
- **Module gates `!== false` (REQ-087):** default-on. Do not simplify to `settings.modules.X` (truthy) — `undefined`/missing must still render the section.
- **Only the composition root is `"use client"`**; the slice api/types are server-safe. PageShell (server-renderable) wraps the authenticated frame. DoD per epic; `--write` new files only (A72/A81); LF (A73).

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — decomposition depth.** A) full template: `dashboard-content` root + `kpi-card` + landing/role-badge/quick-actions extracted to sibling presentational components (cleanest, matches domain epics). B) `dashboard-content` root + `kpi-card` only, landing/dashboard inline in the root (smaller diff, still a valid slice). **Recommended: A** ("not an MVP" thoroughness; the program's slices decompose presentational pieces) — but B is acceptable if A risks copy drift.
- **DEC-2 — KPI query semantics.** A) `useQuery` with `enabled: isAuthenticated && canViewKpis`, `retry: false` (matches the god-page's single gated fetch; A97+A99). B) keep the manual `useState`+`useEffect` fetch inside the slice (no TanStack) — leaves the dashboard off the program's server-state standard. **Recommended: A** (adopt `useQuery`; the program standard).
- **DEC-3 — landing/spinner branch placement.** A) keep all 3 branches in `dashboard-content` (the root owns auth-state branching, like the god-page). B) split the unauth landing into its own component — fine, but the 3-way branch reads cleaner co-located. **Recommended: A**.

### Testing Requirements

- **Net-first (A87/A103):** extend E30-S3's `app/page.test.tsx` to full coverage at HEAD; self-wrap `QueryClientProvider({retry:false})`; survive the migration with only SUT import-path repointing + the A79-licensed loading-mechanism accommodation (a `waitFor` where TanStack commits one render later). Mock `useApiClient` as a stable bag (A78) returning the dashboard payload; assert URL `/api/v1/reports/dashboard` + method `get`.
- Render-tests: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46). Pin every module gate (the highest-value regression guard — a flipped `!==`/`!` silently hides/shows whole sections). Pin the no-redirect invariant (`router.push` not called).

### Project Structure Notes

- Target: `features/dashboard/{api/dashboard-api.ts, hooks/use-dashboard-overview.ts, types/dashboard.types.ts, components/dashboard-content.tsx, components/kpi-card.tsx (+ DEC-1 extras), components/*.test.tsx}`; thin `app/page.tsx`; the net at `app/page.test.tsx` (kept from S3) or relocated into the slice (DEC — recommend keep at app/ per E28-S4/DEC-3 precedent).

### References

- Surface: `app/page.tsx` (3-branch dashboard); the E30-S3 characterization-net seed `app/page.test.tsx`. KPI endpoint `/api/v1/reports/dashboard`.
- PageShell: E30-S1. Slice template: [architecture-frontend.md §379 Pilot Result Note](../../docs/architecture-frontend.md#L379); manual→TanStack precedent: E21-S3 + the E25 email-campaigns BUILD-on-`useApiClient` path.
- project-context.md A79 (manual→TanStack deltas), A88/A94 (BUILD on `useApiClient` — no lib module), A97 (`enabled`=fetch-gate), A99 (`retry` per transport), A103 (transport-agnostic oracle / self-wrap), A78/A64 (stable mocks), A35/A46, A82 (this retires the tracked dashboard residual), A58/A72/A73/A81. Epic: `epics-and-stories.md` §E30 (expanded per user "Add both" 2026-06-12).

## Validation Notes

- Created 2026-06-12 — **added to E30 per the user's "Add both" scope decision** (the original epic deferred `page.tsx`; this story is the sanctioned migration). Status ready-for-dev. After E30-S3; coordinated with E30-S5 (S4 owns `page.tsx`, S5 excludes it).
- The dashboard is already on `useApiClient`, so this is a BUILD-path migration (A88/A94) with the A79/A97/A99 read-only deltas as the only behaviour risk — all pinned by the extended net. Three DECs carry recommended options.

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

- 2026-06-12: Story created (added to E30 per user "Add both") — migrate the 785-line root dashboard `app/page.tsx` into `features/dashboard/` (api/hooks/types/components + thin entry), data on TanStack `useQuery` (BUILD on `useApiClient`, A97 enabled-gate + A99 retry:false), authenticated frame on PageShell, full characterization net first. DEC-1 full decomposition, DEC-2 useQuery+retry:false, DEC-3 branches co-located. Status ready-for-dev.
