# Story E30.3: App shell — layout, providers, root page, and API routes

Status: ready-for-dev

Depends on: **E30-S1 (PageShell exists — referenced only if the root page can adopt it without output change; otherwise not used)**, E21-S3 + E21-S5 (closed). **Highest-risk infra story of E30** — `providers.tsx`, `layout.tsx`, `page.tsx`, and both route handlers are **behaviour-frozen**. Independent of E30-S2.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the root shell files (providers, layout, root page, API routes) covered by a regression net and normalized onto the consolidated structure **without altering the providers tree, root behaviour, metadata, or route handlers**,
so that the app shell is consistent with the feature-slice template while NextAuth, TanStack Query, next-intl, the de-branded metadata fetch, and the health/auth endpoints behave exactly as before.

## ⚠️ This is a NET + NORMALIZE story, not a refactor (read before AC)

The epic constrains S3 to **"Only non-behavioural normalization is allowed: import ordering/barrels, comments, and adopting shared types — no logic change to providers, metadata, route handlers, or root page."** Treat all five files as **frozen**. The real deliverable is the **regression net** the epic asks for (providers-mount test, root-page characterization, auth-route smoke; the health test already exists as the anchor). The "normalization" is genuinely cosmetic — if a change touches a config value, a provider order, a metadata param, or a route payload, it is **out of scope by definition**. When tempted to improve, choose the lower-risk no-op and document residual debt (Conflict priority 1-3).

**`page.tsx` is a 785-line client dashboard god-page that has NEVER been migrated to a slice — and S3 does NOT migrate it** (that is a logic-touching refactor the epic forbids here). It is pinned by a characterization test and left in place; its slice migration is tracked as out-of-E30 residual (A82).

## Acceptance Criteria

**Behaviour preserved (frozen — every value byte-for-byte):**

1. `providers.tsx` keeps the exact provider nesting and config: `SessionProvider` → `QueryClientProvider` (client created via `useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } } }))` — **no other `defaultOptions`, no `gcTime`, no mutations defaults**) → `SidebarProvider` → `AppSettingsProvider` → `{children}`. No provider added, removed, reordered, or reconfigured; `SessionProvider`/`SidebarProvider`/`AppSettingsProvider` keep **no props**; `QueryClientProvider` keeps `client={queryClient}` only. The `useState` lazy-init stays (do **not** hoist the client to module scope — that changes instance-per-mount semantics).
2. `layout.tsx` preserves `generateMetadata` **exactly**: fetch `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/v1/settings/public` with `next: { revalidate: 300 }` + `signal: AbortSignal.timeout(3000)`; `!response.ok` → fallback; any throw (incl. timeout) → fallback; success maps `title ← data.applicationName || fallback.title`, `description ← data.description || fallback.description`, `icons` always `{ icon: "/favicon.ico" }` (note `||` not `??`); fallback strings `"Organization Connect"` / `"Web application for your organization"`. The `Inter({ subsets: ["latin"], variable: "--font-inter" })` font applied as `className={inter.variable}` on `<html>`; `getLocale`/`getMessages` from `next-intl/server`; `<html lang={locale} className={inter.variable}>`, `<body className="bg-background min-h-screen font-sans antialiased">`, and the `<Providers>` → `<NextIntlClientProvider messages={messages}>` → **`<BetaBanner/>` → `<MainLayout>{children}</MainLayout>` → `<LicenseFooter/>`** sibling order. **No `export const metadata/viewport/dynamic/revalidate/runtime` is added.**
3. `page.tsx` (root home) preserves its current rendering behaviour exactly: **it does NOT redirect** (no `redirect()`/`router.push`/`notFound()`); it render-branches on `isLoading` (orange spinner) → `!isAuthenticated` (gradient landing with `/public/events`, `/public/blog`, `/public/contact`, `/login` links) → authenticated dashboard (`OnboardingBanner`, role-badge, quick-actions, KPI sections). The `apiRef = useRef(api); apiRef.current = api` indirection + `fetchKpis` deps `[t]` + endpoint `/api/v1/reports/dashboard` + the module gating (`settings.modules.X !== false`) + the `canReadFinance`/`isVorstand||isAdmin` gates are unchanged. **`page.tsx` is NOT migrated to a slice.**
4. `api/auth/[...nextauth]/route.ts` is unchanged in contract: `export { handler as GET, handler as POST }` over `NextAuth(authOptions)`; KeycloakProvider with `KEYCLOAK_CLIENT_ID/SECRET/ISSUER`; the `jwt`/`session` callbacks, the `extractRolesFromToken` client-role key `"iabconnect-frontend"`, `refreshAccessToken`, `pages: { signIn:"/login", error:"/auth/error" }`, `session: { strategy:"jwt", maxAge: 30*24*60*60 }`, and the `next-auth`/`next-auth/jwt` module augmentations all byte-identical. (`authOptions` is defined **inline in this file** — there is no `auth.config.ts`/`@/lib/auth` config; do not invent one.)
5. `api/health/route.ts` is unchanged: synchronous `export function GET()` returning `Response.json({ status: "ok" }, { status: 200 })` + the SPDX/ADR-017 header; **no `export const dynamic/runtime/revalidate`**. `api/health/route.test.ts` stays green and is **not modified** (the regression anchor).
6. `npm run typecheck` + `npm test -- --run` green; every page still renders; `next build` (epic boundary) clean.

**Improvements:**

7. A regression net is added: a **providers** test (mount `<Providers>` with a child that reads `useQueryClient()` (non-null) and a child that consumes `useSidebar()`/`useAppSettings()` without throwing → proves the tree mounts in order with the QueryClient available); a **root-page** characterization test (the 3-way render branch incl. asserting **no navigation** happens — `redirect`/`router.push` not called — and the unauth branch shows the `/login` link); an **auth-route** smoke (import the route module, assert `GET` and `POST` are defined functions — i.e. `NextAuth(authOptions)` resolves — **without** hitting the network/Keycloak). The existing **health** test is kept as-is.
8. Only non-behavioural normalization is applied where it is genuinely zero-risk: import ordering/grouping, the `@/components/navigation` barrel already used, comments, and adopting shared types if any duplicate inline type can point at an existing shared type **without changing the emitted shape**. ESLint import-boundary rules (E21-S5) satisfied for any touched shell import. If a normalization can't be proven behaviour-neutral, **skip it** and note it.

## Tasks / Subtasks

- [ ] **Task 0: Spike + resolve DECs** (AC: all) — A56; record A43 (a)/(b)/(c) per DEC.
  - [ ] Re-read all 5 files (A56). Confirm `authOptions` is inline in the route (grep `authOptions` → only the 2 hits in `route.ts`; **no** `auth.config.ts`). Confirm `page.tsx` has **no** redirect call. Confirm the health test uses `toMatchObject({ status:"ok" })` + sync `GET()`.
  - [ ] Resolve DEC-1 (root-page PageShell adoption — recommend **no**), DEC-2 (normalization scope — recommend **comments/import-order only**), DEC-3 (whether to hoist `authOptions` to a shared module — recommend **no**).
- [ ] **Task 1: Providers regression test** (AC: 7) — `app/providers.test.tsx` (or `__tests__`). `// @vitest-environment jsdom` + `afterEach(cleanup)`. Render `<Providers><Probe/></Providers>` where `Probe` calls `useQueryClient()` (from `@tanstack/react-query`) and asserts it is defined, and (a second probe or the same) consumes `useSidebar()`/`useAppSettings()` without throwing. Mock `next-auth/react#SessionProvider` as a passthrough if a real session context is needed; keep the QueryClient real (the point is the client is provided). Assert no error is thrown on mount → the nesting order holds. **Do not assert internal config numbers via private APIs** — assert observable availability.
- [ ] **Task 2: Root-page characterization test** (AC: 7) — `app/page.test.tsx`. Mock `@/lib/auth#useAuth`/`useApiClient` (stable refs, A78), `next-intl#useTranslations` (stable identity, A64), `next/navigation` (capture `useRouter().push` — assert **not called**), `@/components/providers/AppSettingsProvider#useAppSettings`, `@/components/OnboardingBanner`. Assert: `isLoading:true` → spinner; `isAuthenticated:false` → landing with the `/login` + `/public/*` links and **no `router.push`/`redirect`**; authenticated → dashboard renders (OnboardingBanner + a role badge). This pins "root is a render-branching dashboard, not a redirector" (the most likely thing a careless normalization breaks). Wrap renders in a `QueryClientProvider({ retry:false })` if the KPI fetch path mounts (A103 self-wrap pattern), or gate the test to the non-KPI branches.
- [ ] **Task 3: Auth-route smoke** (AC: 7) — `app/api/auth/[...nextauth]/route.test.ts`. Import `{ GET, POST }` from `./route`; assert both are defined and are functions. Provide dummy `KEYCLOAK_*` env if module-init reads them. **Do not invoke** the handler against a network. This proves `NextAuth(authOptions)` constructs without throwing (catches a broken provider/callback config at test time).
- [ ] **Task 4: Health test untouched** (AC: 5) — confirm `api/health/route.test.ts` stays green and is **not edited** (anchor). If it isn't currently in the run, just verify it passes.
- [ ] **Task 5: Zero-risk normalization only** (AC: 8) — DEC-2. Limited to: import-ordering/grouping, comment tidy, and adopting an already-exported shared type **only** where the emitted type is unchanged. **No** provider/metadata/route/page logic edit. If `page.tsx`'s inline DTOs (`DashboardOverview` etc.) could point at a shared type, do so **only** if byte-shape-identical; otherwise leave them. Verify each edit is behaviour-neutral by diffing rendered output / the net.
- [ ] **Task 6: DoD gate** (AC: 6) — `npm run typecheck` clean; `npx eslint <changed> --max-warnings=0`; `npx prettier --write` on **new** test files, `--check` (hand-matched) on any modified pre-drifted shell file (A72/A81 — `providers.tsx`/`layout.tsx`/`page.tsx` are likely pre-drifted; comment/import-order edits must NOT trigger a whole-file reformat); `npm test -- --run` (new net green + health anchor green + full suite unchanged). LF (A73). `git diff --stat` — shell files should show a handful of lines at most.

## Dev Notes

S3 is **risk management, not feature work**. The shell files are the load-bearing wiring for the entire app (session, query cache, i18n, metadata, auth endpoint, health probe). The epic deliberately freezes them and asks only for a regression net + cosmetic tidy. The discipline is to **resist** the urge to refactor: `providers.tsx` is 30 lines of deliberately-ordered nesting; `layout.tsx`'s `generateMetadata` carries a documented REQ-086/E9 hardening (the 3s `AbortSignal.timeout` so a stuck backend can't stall SSR) — touching either is how you cause an outage. The net is the value: it locks today's behaviour so any future shell change is caught.

### Scope Boundaries

- **In scope:** providers-mount test, root-page characterization test, auth-route smoke; zero-risk normalization (imports/comments/shared-types-if-byte-identical).
- **Out of scope (do NOT do):**
  - **Migrating `page.tsx` to a slice.** It's a 785-line god-page; the epic forbids logic change to the root page. Its `features/dashboard` migration is **out-of-E30 residual** (A82) — surfaced to the user as a candidate follow-up.
  - Any change to provider order/config, `generateMetadata` params, the font wiring, the route handlers, the auth callbacks/role-key, or the health payload.
  - Hoisting `authOptions` out of the route handler (nothing else imports it; moving it is a behaviour-neutral-but-pointless risk).
  - Adding `export const dynamic/runtime/metadata/viewport` to layout or routes.
  - Modifying `api/health/route.test.ts` (anchor).

### Architecture Guardrails

- **Frozen surfaces** (epic + Conflict priority 1-3): `providers.tsx`, `layout.tsx`, `page.tsx`, both `route.ts`. The "improvement" budget is comments + import order only.
- **`generateMetadata` hardening is load-bearing** — the `AbortSignal.timeout(3000)` + `next:{revalidate:300}` + `||`-coercion fallbacks are a REQ-086/E9-review patch; preserve every param. The `||` (not `??`) means empty-string `applicationName` falls back — keep it.
- **`useState` QueryClient** — the lazy initializer guarantees one client per mount; hoisting to module scope would share it across requests (SSR leak). Frozen.
- **`page.tsx` `apiRef` indirection is deliberate** — it keeps `fetchKpis` deps `[t]` (not `[api]`) to avoid a refetch loop (A78 class). Do not "fix" the deps.
- **`global-error`/auth/health are special files** — the auth route is a catch-all handler; health is a fixed-size 200 for Railway's probe (ADR-017). Don't relocate or restructure.
- **Two unrelated `auth` modules** — `@/lib/auth` (client hooks `useAuth`/`useApiClient`, used by `page.tsx`) is **NOT** the NextAuth `authOptions` (inline in the route). Don't conflate them during normalization.
- DoD per epic. NEVER `npm run format`. `--write` only on new test files (A72/A81). LF (A73).

### A56 spike findings (load-bearing — from the surface characterization)

- **providers.tsx** ([providers.tsx](../../frontend/src/app/providers.tsx)): client; `Providers` named export; QueryClient via `useState(() => new QueryClient({ defaultOptions:{ queries:{ staleTime: 60*1000, retry: 1 } } }))`; nesting `SessionProvider > QueryClientProvider(client) > SidebarProvider > AppSettingsProvider > children`; no provider props besides `client`.
- **layout.tsx** ([layout.tsx](../../frontend/src/app/layout.tsx)): server async; `Inter({subsets:["latin"],variable:"--font-inter"})` → `className={inter.variable}`; `generateMetadata` de-branded fetch (URL/`revalidate:300`/`AbortSignal.timeout(3000)`/`||`-fallbacks `"Organization Connect"`/`"Web application for your organization"`/`{icon:"/favicon.ico"}`); `getLocale`/`getMessages`; tree `<html lang={locale} className={inter.variable}><body className="bg-background min-h-screen font-sans antialiased"><Providers><NextIntlClientProvider messages={messages}><BetaBanner/><MainLayout>{children}</MainLayout><LicenseFooter/>`. **No `export const`.**
- **page.tsx** ([page.tsx](../../frontend/src/app/page.tsx)): client god-page (~785 lines); **no redirect**; 3-way branch (isLoading spinner / unauth gradient landing / auth dashboard); `useApiClient` + `apiRef` + `fetchKpis` deps `[t]`; endpoint `/api/v1/reports/dashboard`; module gates `settings.modules.X !== false`; inline DTOs + `KpiCard` at module scope.
- **api/auth/[...nextauth]/route.ts** ([route.ts](../../frontend/src/app/api/auth/[...nextauth]/route.ts)): `export { handler as GET, handler as POST }`; inline `export const authOptions`; KeycloakProvider env-keyed; role key `"iabconnect-frontend"`; `pages` + `session{jwt,maxAge:30d}`; module augmentations. No `runtime` export (uses `Buffer` → Node).
- **api/health/route.ts** ([route.ts](../../frontend/src/app/api/health/route.ts)): sync `GET()` → `Response.json({status:"ok"},{status:200})`; SPDX header; no dynamic/runtime. **route.test.ts**: 2 tests (`toMatchObject({status:"ok"})`, status 200, content-type `/application\/json/`, sync `GET()`) — anchor, do not modify.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — root-page PageShell adoption.** A) **do not** adopt PageShell on `page.tsx` — its three branches use bespoke frames (orange spinner main, gradient landing main, dashboard main); forcing PageShell risks changing rendered output on the app's most-trafficked page for cosmetic gain, and the epic only permits adoption "without changing rendered output". B) adopt PageShell on the authenticated-dashboard branch only — higher risk, low reward. **Recommended: A** (no adoption; the dashboard frame consolidation rides with the deferred slice migration).
- **DEC-2 — normalization scope.** A) comments + import-ordering only (provably behaviour-neutral). B) also relocate inline DTOs to shared types — only if byte-shape-identical, else skip. **Recommended: A** (B only opportunistically and only when proven identical).
- **DEC-3 — hoist `authOptions`.** A) leave it inline in the route (nothing imports it; moving it gains nothing and risks the auth construct). B) hoist to `auth.config.ts` / `@/lib/auth` — a refactor the epic forbids here. **Recommended: A**.

### Testing Requirements

- Net asserts **observable availability/behaviour**, not private config (no reaching into QueryClient internals). Providers test: client is provided + tree mounts without throw. Root-page test: the render branches + **no navigation**. Auth-route smoke: handlers construct. Health: existing anchor unchanged.
- All render-tests: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46); stable mocks for `useAuth`/`useTranslations`/`useApiClient` (A64/A78). Self-wrap `QueryClientProvider({retry:false})` if the KPI path mounts (A103) so `retry:1` doesn't delay/flake the test.
- `next build` is deferred to the epic boundary (A58); typecheck/eslint/prettier/vitest are the per-story gates.

### Project Structure Notes

- New test files: `app/providers.test.tsx`, `app/page.test.tsx`, `app/api/auth/[...nextauth]/route.test.ts`. No source relocation (the shell files stay at their `app/` paths — special-file + frozen-surface constraints). No new `features/` slice in S3 (the dashboard slice is deferred residual).

### References

- Surface: [providers.tsx](../../frontend/src/app/providers.tsx), [layout.tsx](../../frontend/src/app/layout.tsx), [page.tsx](../../frontend/src/app/page.tsx), [api/auth/[...nextauth]/route.ts](../../frontend/src/app/api/auth/[...nextauth]/route.ts), [api/health/route.ts](../../frontend/src/app/api/health/route.ts) + [route.test.ts](../../frontend/src/app/api/health/route.test.ts).
- PageShell: E30-S1. Slice template: [architecture-frontend.md §379](../../docs/architecture-frontend.md#L379).
- project-context.md A87/A103 (net + self-wrap), A64/A78 (stable mocks), A35/A46 (cleanup), A56 (spike), A82 (track deferred — the dashboard slice migration), A58/A72/A73/A81 (gates). Epic: `epics-and-stories.md` §E30-S3.

## Validation Notes

- Created 2026-06-12 (whole-epic E30 batch per A34; "nicht mehr ein mvp"). Status ready-for-dev. The highest-risk infra story; after E30-S1, independent of S2.
- **Spec-vs-reality corrections folded in (A52/A56):** (1) `page.tsx` "redirect/home rendering" is precisely a **3-way render branch with NO redirect** — the characterization test pins "not a redirector" (a careless normalization could introduce one). (2) `authOptions` is **inline** in the route (no `auth.config.ts`) — DEC-3 keeps it there. (3) `page.tsx` slice migration is explicitly **out of E30** (logic-frozen) and surfaced as candidate residual. (4) `next: { revalidate: 300 }` + `AbortSignal.timeout(3000)` carry a REQ-086/E9 hardening — frozen. Three DECs carry recommended options (all "leave it frozen").

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

- 2026-06-12: Story created — regression net over the frozen app shell (providers-mount + root-page-no-redirect characterization + auth-route smoke; health test kept as anchor) + zero-risk normalization (imports/comments only). `page.tsx` NOT migrated (logic-frozen; dashboard slice = out-of-E30 residual). DEC-1 no-root-PageShell, DEC-2 comments/import-order only, DEC-3 keep authOptions inline. Status ready-for-dev.
