# Story E30.2: Auth, login, and system pages — slice/shell extraction

Status: review

Depends on: **E30-S1 (PageShell/PageHeader must exist + be green)**, E21-S3 + E21-S5 (closed). The login + auth-error surfaces currently have **no tests** — S2's regression net is the load-bearing safety device (A87). Independent of E30-S3.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the auth, login, and system/error pages organized onto the feature-slice template and (where applicable) the shared `PageShell`, without changing any behaviour,
so that the system-page surface matches the rest of the migrated frontend while the NextAuth sign-in flow, error-code rendering, and framework error/404/loading boundaries stay byte-for-byte identical.

## ⚠️ Reality matrix — most of these pages are NOT PageShell-shaped (read before AC)

The eight files in scope split into three kinds. Only **one** adopts `PageShell`. Forcing it onto the others is a regression.

| File | Component | Frame today | PageShell? | i18n |
|---|---|---|---|---|
| `app/login/page.tsx` | Client | full-screen gradient `from-orange-50 to-amber-100`, centered card | **No** (full-page, MainLayout treats `/login` as full-page) | global `useTranslations()` `auth.*`/`roles.*`/`common.*` |
| `app/auth/error/page.tsx` | Client | full-screen gradient `from-red-50 to-orange-100`, centered card | **No** (full-page `/auth/*`) | global `useTranslations()` `authError.*`/`auth.sessionRequired` |
| `app/module-unavailable/page.tsx` | Client | `min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8` → `mx-auto max-w-4xl` card | **YES** (renders **inside** the authenticated shell) | `useTranslations("moduleUnavailable")` |
| `app/site-unavailable/page.tsx` | Client | `flex min-h-screen … bg-gray-50` standalone | **No** (full-page; MainLayout registers it standalone) | `useTranslations("siteUnavailable")` |
| `app/error.tsx` | Client **boundary** (`reset`) | `flex min-h-screen … p-24`, indigo | **No** (route error boundary) | global `useTranslations()` `error.*`/`common.tryAgain` |
| `app/global-error.tsx` | Client **boundary** (`reset`, own `<html><body>`) | own document, indigo | **No** (root boundary — cannot use providers/PageShell) | **none** (hardcoded DE/EN) |
| `app/not-found.tsx` | **Server** | `flex min-h-screen … p-24`, indigo | **No** | **none** (hardcoded DE) |
| `app/loading.tsx` | **Server** | `flex min-h-screen items-center justify-center`, indigo spinner | **No** | **none** (hardcoded EN `Loading...`) |

## ⚠️ i18n correction (folded into AC — A52/A56 refresh)

The epic's S2 AC-3 says keys must be "resolvable in **both `en.json` and `hi.json`**". **That is factually wrong and following it literally is a behaviour change.** Ground truth: `frontend/messages/hi.json` is a **partial stub** (215 lines vs 2911 in `en.json`/`de.json`) holding only `language/common/nav/admin/suppliers/sponsors/form`. It is **missing every namespace these pages use** (`auth`, `authError`, `error`, `roles`, `home`, `moduleUnavailable`, `siteUnavailable`). The real i18n parity pair is **`en.json` ↔ `de.json`** (project memory: "i18n DONE — en↔de"; E21-S4). **Do NOT add keys to `hi.json`** — that fabricates Hindi parity the rest of the app never had and changes the `hi` locale's render. The corrected AC: every key these pages use already exists in **`en.json` and `de.json`** (verified — zero missing); leave `hi.json` exactly as-is.

## Acceptance Criteria

**Behaviour preserved (the contract — every item is byte-for-byte):**

1. `login/page.tsx` preserves the NextAuth sign-in flow **exactly**: `signIn("keycloak", { callbackUrl })` (no `redirect` key → next-auth default `redirect:true`); `callbackUrl = searchParams.get("callbackUrl") ?? "/"`; `error`/`error_description` query handling incl. the disabled-account derivation (`error_description` contains `"disabled"`/`"deaktiviert"` or `error === "access_denied"` → `showDisabledModal`); the error-param→message switch (`OAuthCallback→auth.signInError`, `OAuthSignin→auth.keycloakNotReachable`, `AccessDenied→auth.accessDenied`, default→`auth.unknownError`, throw→`auth.signInFailed`); the already-authenticated `router.push(callbackUrl)` effect; the Keycloak reset-credentials `<a>` (env-built URL), the `/admin/register` link, and the `NODE_ENV==="development"` dev-credentials block. Same `auth.*`/`roles.*`/`common.loading`/`common.confirm` keys.
2. `auth/error/page.tsx` renders the same `{titleKey, descKey}` for every one of the 11 mapped error codes (`Configuration`, `AccessDenied`, `Verification`, `OAuthSignin`, `OAuthCallback`, `OAuthCreateAccount`, `EmailCreateAccount`, `Callback`, `OAuthAccountNotLinked`, `SessionRequired`) **and** the `Default` fallback (plus the read-time `?? "Default"` + lookup `?? errorMappings.Default` double-fallback for unknown codes). Same `authError.*`/`auth.sessionRequired` keys, same `/login` + `/` links, same `NODE_ENV==="development"` debug block.
3. `module-unavailable/page.tsx` and `site-unavailable/page.tsx` render identical content and keep their exact behaviours: module-unavailable focuses the back-to-dashboard link on mount (not a keyboard trap) and renders **inside** the authenticated shell; site-unavailable fetches `${NEXT_PUBLIC_API_URL ?? "http://localhost:5000"}/api/v1/settings/public`, maps branding with the same fallbacks, **swallows fetch failure with `console.warn` + `setBranding(null)` (never throws)**, focuses the member-login link on mount, and stays standalone. Their **existing tests stay green and are not modified** (`module-unavailable/page.test.tsx` 2 tests; `site-unavailable/page.test.tsx` 3 tests).
4. `error.tsx` keeps the `reset` prop wired to the retry button + the `console.error(error)` effect; `global-error.tsx` keeps its **own `<html lang="de"><body>`**, its hardcoded bilingual strings, and `reset`; `not-found.tsx` stays a **Server Component** rendering the hardcoded German 404; `loading.tsx` stays a **Server Component** rendering the hardcoded `Loading...` spinner. Indigo accents preserved on all four. **No conversion of Server↔Client, no i18n added to the hardcoded files** (adding i18n to global-error/not-found/loading is a behaviour change and is out of scope).
5. No route, route-group, or API-contract change. MainLayout's full-page list (`/login`, `/auth/*`, `/public`, `/site-unavailable`) and the middleware rewrites to `/module-unavailable`/`/site-unavailable` are untouched. `npm run typecheck` + `npm test -- --run` green.

**Improvements:**

6. A **characterization net** is added FIRST (Task 1) over the currently-untested surfaces — login flow, auth-error code mapping, and smoke-renders of the four framework files — so the slice/PageShell moves in Tasks 2-3 are gated on a green oracle (A87). The net asserts observable behaviour (i18n-key text, `signIn` call args, `router.push` target, error→message mapping, `reset` wiring), not implementation detail.
7. PageShell (E30-S1) is adopted on **`module-unavailable` only** — the one shell-wrapped page — replacing its `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-4xl">` with `<PageShell maxWidth="4xl">…</PageShell>`, producing **byte-identical** frame DOM (verify PageShell's `max-w-4xl` + frame classes match exactly; the page uses a centered card, **not** a `PageHeader` title block, so PageHeader is not used here). No other page adopts PageShell (per the reality matrix) — document per file why not.
8. The system-page bodies are consolidated into a `features/system/` slice following the thin-entry template (DEC-1): `login`, `auth/error`, `module-unavailable`, `site-unavailable` move their bodies into `features/system/components/<x>-content.tsx` (each keeps its existing `"use client"` + `signIn`/`fetch` imports verbatim) and their `app/**/page.tsx` become thin entries that render the content component. Page-local presentational pieces and the `errorMappings` table move with their body. **`error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` stay at their `app/` paths** (Next.js special-file convention — they cannot live in a slice) and are **not** relocated. No new duplicate UI primitive. i18n keys unchanged and resolvable in **`en.json` + `de.json`** (`hi.json` left as-is, per the i18n correction).

## Tasks / Subtasks

- [x] **Task 0: Spike + resolve DECs** (AC: all) — A56; record A43 (a)/(b)/(c) per DEC.
  - [x] Confirm E30-S1 `PageShell`/`PageHeader` exist + green. Re-read all 8 files + the 2 existing test files (A56). Confirm MainLayout full-page list + the middleware rewrites (do not change them).
  - [x] **i18n delta:** grep `frontend/messages/{en,de,hi}.json` for `auth`/`authError`/`error`/`moduleUnavailable`/`siteUnavailable`/`home`/`roles`; confirm en+de have them, hi does not. Record the corrected parity (en↔de) in the dev notes; **hi.json is not touched**.
  - [x] Resolve DEC-1 (slice extraction depth), DEC-2 (`features/system` naming), DEC-3 (keep existing app-level tests vs relocate).
- [x] **Task 1: Characterization net FIRST** (AC: 6) — the oracle, written BEFORE any extraction. All render-tests: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46); mock `next-auth/react#signIn`, `next/navigation` (`useRouter`/`useSearchParams`), and `next-intl#useTranslations` (stable identity fn per A64/A78), and `@/lib/auth#useAuth` where used. Pin:
  - [x] **login:** renders the sign-in button; clicking it calls `signIn("keycloak", { callbackUrl })` with `callbackUrl` from the `?callbackUrl=` param (default `"/"`); `?error=OAuthCallback` → `auth.signInError` shown, `OAuthSignin`→`auth.keycloakNotReachable`, `AccessDenied`→`auth.accessDenied`, unknown→`auth.unknownError`; `?error=…&error_description=…disabled…` (or `access_denied`) opens the disabled-account modal; `useAuth` returning authenticated → `router.push(callbackUrl)` fired. (signIn throwing → `auth.signInFailed` + button re-enabled.)
  - [x] **auth/error:** a table-driven test asserting each of the 11 codes → its `titleKey`/`descKey`, plus `?error=` absent → `Default`, plus an unknown code → `Default`.
  - [x] **framework files smoke:** `error.tsx` renders + clicking the button calls the injected `reset`; `global-error.tsx` renders its hardcoded strings + `reset` wired (note: it renders `<html>/<body>` — test the inner content, not via a full document mount if RTL complains; assert the heading/button text + `reset` onClick); `not-found.tsx` renders the German 404 + `/`-link; `loading.tsx` renders the spinner + `Loading...`. These are pure-render smokes (no i18n mock needed for the hardcoded ones).
  - [x] **Confirm the net is GREEN at HEAD** (before extraction) — this is the A87 proof the surface is pinned.
- [x] **Task 2: PageShell on module-unavailable** (AC: 7) — swap the inline frame for `<PageShell maxWidth="4xl">{the existing card markup}</PageShell>`. Verify the rendered `<main>` classes + `max-w-4xl` are byte-identical so `module-unavailable/page.test.tsx` (heading/body/adminHint/link + focus) stays green unmodified. The mount-focus `useEffect` stays in the content component (PageShell is a passive frame).
- [x] **Task 3: `features/system` slice extraction** (AC: 8) — DEC-1=A. Create `features/system/components/{login-content,auth-error-content,module-unavailable-content,site-unavailable-content}.tsx` (bodies moved verbatim, `"use client"` + imports preserved — `signIn` from `next-auth/react`, `useSearchParams`/`useRouter`, the env-built reset URL, the `errorMappings` table, the branding fetch). Thin `app/login/page.tsx`, `app/auth/error/page.tsx`, `app/module-unavailable/page.tsx`, `app/site-unavailable/page.tsx` → render the content component. **`error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` stay where they are** (special files). Keep NextAuth `signIn` wiring byte-for-byte (epic: "Login stays a client component with its existing signIn import"); if any extraction friction touches the flow, **document residual debt rather than altering the flow** (Conflict priority 1-3) and fall back to DEC-1=B (net + PageShell only; leave pages in `app/`).
- [x] **Task 4: Net survives** (AC: 6) — re-run the Task-1 net after Tasks 2-3. The login/auth-error specs target the content components (or the thin entries — identical DOM); the 2 existing app-level tests stay green via the thin entries (DEC-3). **No spec is softened to pass** — the only legitimate change is import-path repointing of the SUT (A88-style; these are client pages, no RSC harness swap). If a transport mock needs editing, the BUILD contract was broken — stop and reconsider.
- [x] **Task 5: DoD gate** (AC: 5) — `npm run typecheck` clean; `npx eslint <changed> --max-warnings=0`; `npx prettier --write` on **new** slice files, `--check` (hand-matched) on modified pre-drifted `app/**` files (A72/A81); `npm test -- --run` (new net green + the 5 existing tests green + full suite unchanged). LF (A73). `git diff --stat` — body moves should be near-zero net logical change.

## Dev Notes

The auth surface is the **highest-trust, least-tested** part of the frontend: `login` and `auth/error` ship with **no tests today**, and login is the single most security-relevant page (the Keycloak sign-in entry). So S2's center of gravity is **Task 1 (the net)**, not the extraction. Get the net green at HEAD first; then the slice move + the one PageShell adoption are mechanical relocations the green oracle protects (exactly the E28-S4 license-relocation shape, but for client pages — no RSC harness swap).

### Scope Boundaries

- **In scope:** the characterization net; PageShell on `module-unavailable`; `features/system/` slice extraction of the 4 route pages + thin entries; the i18n-correction dev note.
- **Out of scope (do NOT do):**
  - Relocating `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` out of `app/` (Next.js special files — they MUST stay at their route paths).
  - Adding i18n to the hardcoded `global-error`/`not-found`/`loading` (behaviour change; they were always hardcoded).
  - **Adding keys to `hi.json`** (fabricates parity that never existed — i18n correction).
  - Converting any Server↔Client component, changing any gradient/indigo styling, or altering the `signIn`/callback/redirect wiring.
  - Adopting PageShell on any page other than `module-unavailable`.
  - Fabricating `/public/privacy` or `/public/imprint` pages (pre-existing dead links owned by the public footer — not in S2).

### Architecture Guardrails

- **NextAuth flow is frozen** (epic + Conflict priority 1-3). `signIn("keycloak", { callbackUrl })` keeps no `redirect` key. The disabled-account modal logic, the error-param switch, and the already-auth redirect effect move verbatim. If extraction can't keep it byte-identical, fall back to DEC-1=B and document.
- **`global-error.tsx` is a root boundary** — it renders its own `<html>/<body>` and **cannot** depend on providers/`next-intl`/`PageShell`. Leave it minimal and self-contained (epic architecture note).
- **`module-unavailable` is the ONLY shell page** — it's the only one whose frame matches PageShell. PageShell's `max-w-4xl` branch must produce the identical `mx-auto max-w-4xl` + `min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8` so the existing test stays green.
- **Slice imports are boundary-legal** (`features/system → @/components/layout`, `@/lib/auth`, `next-auth/react`); the generic `src/features/**` eslint rule covers the new slice with no config entry. A `features/system` slice must not import another `features/*`.
- DoD per epic: `typecheck` + `eslint <changed>` + `prettier --check <changed>` + `npm test -- --run`. NEVER `npm run format`. `--write` only on new slice files (A72/A81). LF (A73).

### A56 spike findings (load-bearing — from the surface characterization)

- **login** ([login/page.tsx](../../frontend/src/app/login/page.tsx)): client; `signIn` from `next-auth/react`; `signIn("keycloak", { callbackUrl })`; `callbackUrl ?? "/"`; disabled-modal derivation from `error`/`error_description`; error-switch (OAuthCallback/OAuthSignin/AccessDenied/default + throw→signInFailed); already-auth `router.push(callbackUrl)`; reset-credentials `<a>` from `NEXT_PUBLIC_KEYCLOAK_*` env; `/admin/register` link; dev-creds block on `NODE_ENV`. **No `<form>`** — a single button `onClick`. Global `useTranslations()`. **No existing test.**
- **auth/error** ([auth/error/page.tsx](../../frontend/src/app/auth/error/page.tsx)): client; **no next-auth import**; `errorType = searchParams.get("error") ?? "Default"`; `errorMappings[errorType] ?? errorMappings.Default`; 11 codes + Default (SessionRequired maps both keys to `auth.sessionRequired`); `/login` + `/` links; debug block on `NODE_ENV`. **No existing test.**
- **module-unavailable** ([module-unavailable/page.tsx](../../frontend/src/app/module-unavailable/page.tsx)): client; `useTranslations("moduleUnavailable")` (keys `heading`/`body`/`adminHint`/`backToDashboard`); mount-focus the back link; frame `min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8` → `mx-auto max-w-4xl`; renders inside the authenticated shell (reached by middleware rewrite). **2 existing tests** (don't modify).
- **site-unavailable** ([site-unavailable/page.tsx](../../frontend/src/app/site-unavailable/page.tsx)): client; branding fetch with `console.warn`+`setBranding(null)` swallow; mount-focus login link; standalone. **3 existing tests** (don't modify).
- **error.tsx**: client boundary, `reset`, `console.error`, indigo, global `error.*`/`common.tryAgain`. **global-error.tsx**: client boundary, own `<html lang="de"><body>`, hardcoded DE/EN, indigo, `reset`. **not-found.tsx**: Server, hardcoded DE 404, indigo, `/`-link. **loading.tsx**: Server, hardcoded `Loading...` spinner, indigo.
- **Consumers/wiring** (do not change): NextAuth route `pages: { signIn:"/login", error:"/auth/error" }`; `middleware.ts` rewrites to `/module-unavailable` (disabled module) + `/site-unavailable` (public-off / unauth `/`); MainLayout full-page list.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — slice extraction depth.** A) extract the 4 route-page bodies into `features/system/components/*-content.tsx` + thin entries (matches the slice template; the green net protects the verbatim body move — E28-S4 precedent). B) net + PageShell-on-module-unavailable only; leave the 4 pages in `app/` (the most conservative, if the NextAuth flow shows any extraction friction). **Recommended: A** (the epic asks the surface to "match the feature-slice template"; "no longer an MVP" favors the full consolidation; B is the documented fallback if Task 3 can't keep `signIn` byte-identical).
- **DEC-2 — slice name.** A) `features/system` (covers auth + system-availability + the framework smokes' SUTs). B) `features/auth` — narrower, risks confusion with `@/lib/auth`. **Recommended: A** (`features/system`).
- **DEC-3 — existing app-level tests.** A) keep `module-unavailable/page.test.tsx` + `site-unavailable/page.test.tsx` at their `app/` paths (they render the thin entry → slice content → identical DOM → stay green; mirrors E28-S4). B) relocate them into the slice — needless churn + a relocation diff. **Recommended: A** (leave them; only the SUT body moved).

### Testing Requirements

- **Net-first (A87):** green at HEAD before extraction; survives the move with only SUT import-path repointing (A88 — client pages, no RSC harness swap; the transport here is `signIn`/`fetch` mocks, which keep intercepting). No softened matchers (a future net-integrity check at the epic boundary will diff the net vs HEAD).
- All render-tests: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46). Stable identity for `useTranslations`/`useAuth` mocks (A64/A78) — login keeps `t` and auth state in effect deps.
- The 5 existing system-page tests stay green **unmodified** (regression anchors). `loading.tsx`/`not-found.tsx` are Server Components but are trivially render-testable (no async, no server-only API) — smoke them directly.

### Project Structure Notes

- Target: `features/system/components/{login-content, auth-error-content, module-unavailable-content, site-unavailable-content}.tsx` + their `*.test.tsx`; thin entries at `app/login/page.tsx`, `app/auth/error/page.tsx`, `app/module-unavailable/page.tsx`, `app/site-unavailable/page.tsx`. `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` stay at `app/` (smoke tests may live beside them or in the slice). No `api/`/`schemas/` (login uses `signIn`; site-unavailable's one `fetch` is inline branding, not a transport module — keep it inline unless DEC-1=A naturally lifts it; do not invent an api module for a single settings fetch).

### References

- Surface: [login/page.tsx](../../frontend/src/app/login/page.tsx), [auth/error/page.tsx](../../frontend/src/app/auth/error/page.tsx), [module-unavailable/page.tsx](../../frontend/src/app/module-unavailable/page.tsx) + [.test.tsx](../../frontend/src/app/module-unavailable/page.test.tsx), [site-unavailable/page.tsx](../../frontend/src/app/site-unavailable/page.tsx) + [.test.tsx](../../frontend/src/app/site-unavailable/page.test.tsx), [error.tsx](../../frontend/src/app/error.tsx), [global-error.tsx](../../frontend/src/app/global-error.tsx), [not-found.tsx](../../frontend/src/app/not-found.tsx), [loading.tsx](../../frontend/src/app/loading.tsx).
- Wiring (do NOT change): [api/auth/[...nextauth]/route.ts](../../frontend/src/app/api/auth/[...nextauth]/route.ts) `pages` block; [MainLayout.tsx:50-54](../../frontend/src/components/navigation/MainLayout.tsx#L50-L54) full-page list; `frontend/src/middleware.ts` rewrites.
- i18n: `frontend/messages/{en,de}.json` (parity pair); `frontend/messages/hi.json` (partial stub — leave as-is).
- PageShell: E30-S1 `e30-s1-introduce-pageshell-pageheader-layout-primitives.md`. Slice template: [architecture-frontend.md §379 Pilot Result Note](../../docs/architecture-frontend.md#L379); RSC/relocation precedent: `e28-s4-public-static-and-layout-slice.md`.
- project-context.md A87 (net-first), A88 (transport-mock is the licensed change), A64/A78 (stable mocks), A35/A46 (cleanup), A52/A56 (refresh-time delta), A82 (track deferred), A58/A72/A73/A81 (gates). Epic: `epics-and-stories.md` §E30-S2.

## Validation Notes

- Created 2026-06-12 (whole-epic E30 batch per A34; "nicht mehr ein mvp"). Status ready-for-dev. After E30-S1; independent of S3.
- **Spec-vs-reality corrections folded in (A52/A56):** (1) **AC-3 i18n parity corrected** from "en.json + hi.json" to the real "en.json + de.json"; `hi.json` is a partial stub and is left untouched (extending it = behaviour change). (2) "Page chrome adopts PageShell where applicable" scoped to the reality matrix — **only `module-unavailable`** is PageShell-shaped; the full-page auth pages + framework boundaries explicitly do not adopt it. (3) The currently-untested login + auth-error surfaces get a net-first regression oracle (A87) — the load-bearing safety device. Three DECs carry recommended options.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous whole-epic E30 dev-story run.

### Debug Log References

**Autonomous-mode escape (A41/A43):** user directive verbatim — _"implementiere das ganze epic 30 mit allen stories ohne stopp. erst danach ein review und retro"_ — pre-declares no-stop autonomous mode; every DEC carries a story-recommended option → A32 step (d) skipped, resolutions recorded below.

- **DEC-1 — slice extraction depth.** (a) **Option A** — extract the 4 route-page bodies into `features/system/components/*-content.tsx` + thin entries. (b) Rationale: story rec A; user autonomous quote above; the epic asks the surface to "match the feature-slice template"; the green net (Task 1) protects the verbatim body move (E28-S4 precedent). The NextAuth `signIn` flow moved byte-for-byte with no friction → the DEC-1=B fallback was not needed. (c) Consequence: AC-8 covered (4 content components + 4 thin server entries); the 4 framework special-files stayed at `app/`.
- **DEC-2 — slice name.** (a) **Option A** — `features/system`. (b) Rationale: story rec A; user autonomous; covers auth + system-availability + the framework smokes' SUTs; avoids confusion with `@/lib/auth`. (c) Consequence: slice dir is `features/system/components/`.
- **DEC-3 — existing app-level tests.** (a) **Option A** — keep `module-unavailable/page.test.tsx` + `site-unavailable/page.test.tsx` at their `app/` paths. (b) Rationale: story rec A; user autonomous; they render the thin entry → slice content → identical DOM → stay green unmodified (mirrors E28-S4); relocating them is needless churn. (c) Consequence: both existing tests stayed green UNMODIFIED through the extraction + PageShell adoption (the A87/A88 proof).

**i18n delta (A52/A56):** grep confirmed `auth`/`authError`/`error`/`moduleUnavailable`/`siteUnavailable`/`home`/`roles` exist in BOTH `en.json` + `de.json`; `hi.json` is a 215-line partial stub missing all of them. Per the AC-3 correction, the real parity pair is en↔de; `hi.json` was NOT touched (extending it would fabricate Hindi parity the app never had).

### Completion Notes List

- **Net-first (A87) executed exactly:** the 6-file characterization net (login 12 tests, auth/error 14, error/global-error/not-found/loading 1 each = 30 tests) was written + confirmed **GREEN AT HEAD** (zero source edits) BEFORE any extraction. It renders the route entries (`./page`), so the body-move into `features/system` required **zero net import-path edits** — the net survived the migration verbatim (A88; these are client pages, no RSC harness swap). No spec softened.
- **PageShell adoption (Task 2, AC-7):** `module-unavailable` is the ONLY E30-S2 page that adopts PageShell. Swapped its inline `<main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8"><div className="mx-auto max-w-4xl">` for `<PageShell maxWidth="4xl">` → byte-identical DOM (PageShell's `max-w-4xl` branch + frame classes match exactly). The existing `module-unavailable/page.test.tsx` (2 tests, incl. mount-focus) stayed green unmodified. The mount-focus `useEffect` stays in the content component (PageShell is a passive frame). **No other page adopts PageShell** — per the reality matrix: login/auth-error are full-page gradient cards; site-unavailable is standalone full-screen; error/global-error/not-found/loading are framework boundaries (global-error renders its own `<html><body>` and cannot use providers/PageShell).
- **Slice extraction (Task 3, AC-8, DEC-1=A):** 4 content components (`login-content`, `auth-error-content`, `module-unavailable-content`, `site-unavailable-content`) hold the relocated bodies verbatim (each keeps its `"use client"` + `signIn`/`fetch`/`errorMappings`/branding-fetch). The 4 `app/**/page.tsx` are thin **server** entries rendering the named content. `error.tsx`/`global-error.tsx`/`not-found.tsx`/`loading.tsx` stayed at `app/` (Next.js special files — not relocated).
- **Behaviour frozen (AC-1..5):** NextAuth `signIn("keycloak", { callbackUrl })` (no `redirect` key), the callbackUrl/error-param/disabled-modal derivation, the already-auth `router.push` effect, the 11-code auth-error mapping + double-`Default` fallback, the site-unavailable `console.warn`+`setBranding(null)` swallow, and the indigo framework boundaries are all unchanged. No Server↔Client conversion of the special files; no i18n added to the hardcoded ones; **no keys added to `hi.json`**; no route/middleware/MainLayout-full-page-list change.
- **Server-entry build-safety verified:** the 2 useSearchParams pages (login, auth/error) flipped from page-level `"use client"` to a server thin entry rendering the client content. `next build` confirms `/login`, `/auth/error`, `/module-unavailable`, `/site-unavailable` are all `ƒ` (Dynamic, server-rendered) — the app is dynamic-by-default (next-intl cookie locale), so there is no `useSearchParams`-without-Suspense static-bailout. Build exit 0.
- **AC-Subitem completion (A29):** AC-1 ✅ (login flow byte-frozen) · AC-2 ✅ (11 codes + Default mapping) · AC-3 ✅ (module/site-unavailable behaviour + existing tests green) · AC-4 ✅ (4 framework files unchanged, no Server↔Client/i18n change) · AC-5 ✅ (no route/contract change; typecheck+suite green) · AC-6 ✅ (net-first oracle, 30 tests) · AC-7 ✅ (PageShell on module-unavailable only, byte-identical) · AC-8 ✅ (features/system slice, en↔de i18n, hi untouched).
- **Gates:** `tsc --noEmit` clean; `npx eslint <changed> --max-warnings=0` clean; `npx prettier --write` (new files) + `--check` (rewritten thin entries) clean; `npx vitest run` = **213 files / 1985 tests green** (1955 → 1985 = +30 net; the 5 existing system tests unmodified + green); `next build` exit 0. LF on every edited/new file (A73). `git diff --stat` thin-entry deletions (562) are the verbatim body relocation into `features/system` (matched additions), not a reformat.

### File List

**New (slice content):**
- `frontend/src/features/system/components/login-content.tsx`
- `frontend/src/features/system/components/auth-error-content.tsx`
- `frontend/src/features/system/components/module-unavailable-content.tsx` (adopts PageShell, maxWidth="4xl")
- `frontend/src/features/system/components/site-unavailable-content.tsx`

**New (characterization net):**
- `frontend/src/app/login/page.test.tsx`
- `frontend/src/app/auth/error/page.test.tsx`
- `frontend/src/app/error.test.tsx`
- `frontend/src/app/global-error.test.tsx`
- `frontend/src/app/not-found.test.tsx`
- `frontend/src/app/loading.test.tsx`

**Modified (route bodies → thin server entries):**
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/auth/error/page.tsx`
- `frontend/src/app/module-unavailable/page.tsx`
- `frontend/src/app/site-unavailable/page.tsx`

**Unchanged anchors (verified green, not edited):** `frontend/src/app/module-unavailable/page.test.tsx`, `frontend/src/app/site-unavailable/page.test.tsx`, `frontend/src/app/error.tsx`, `frontend/src/app/global-error.tsx`, `frontend/src/app/not-found.tsx`, `frontend/src/app/loading.tsx`.

## Change Log

- 2026-06-12: Story implemented + DoD green (Status → review). Net-first oracle (30 tests over login/auth-error/4 framework files, green at HEAD then survived extraction with zero spec edits); PageShell adopted on `module-unavailable` only (byte-identical, existing 2 tests green); `features/system` slice extraction of the 4 route bodies into `*-content.tsx` + thin server entries (DEC-1=A); framework special-files left in `app/`; en↔de i18n parity, `hi.json` untouched (AC-3 correction). DEC-2 `features/system`, DEC-3 keep app-level tests. Vitest 1955→1985 (+30); tsc/eslint/prettier clean; next build exit 0; LF.
- 2026-06-12: Story created — net-first regression oracle over login/auth-error/framework-boundaries (currently untested) + PageShell on `module-unavailable` (only shell-shaped page) + `features/system` slice extraction of the 4 route pages (thin entries; framework special-files stay in `app/`). AC-3 i18n parity corrected to en↔de (`hi.json` is a stub, left as-is). DEC-1 extract-depth (A=full, B=net+PageShell-only fallback), DEC-2 `features/system` name, DEC-3 keep existing app-level tests. Status ready-for-dev.
