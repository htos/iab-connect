# Story 10.5: Add Public View Toggle and Cross-Module Dependency Handling

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **the Public View module and cross-module dependencies handled safely**,
so that **disabling a module does not break dependent functionality or expose data**.

**Requirements:** REQ-086, REQ-087. Epic E10, Story 5 of 5 — closes Epic 10.
**Depends on E10-S3** (backend enforcement) and **E10-S4** (`middleware.ts`, the `modules` map, the module→route contract). This story special-cases the Public View module — which has no dedicated backend route group — and defines what happens when modules with dependencies are disabled.

## Acceptance Criteria

1. **Public site rewrite when Public View is off.** When the `public_view` module is disabled, `middleware.ts` rewrites `/public/*` and the public landing `/` to a minimal neutral "site not public" page (OD-5 resolved — minimal neutral page, **not** a login redirect).
2. **Minimal neutral page.** The "site not public" page renders organization branding (logo + name) from the still-reachable `GET /api/v1/settings/public`, offers a discreet member-login link, and falls back to a plain unbranded message if the settings fetch fails — the page must never error out. It uses a standalone minimal layout (not the authenticated shell, not the full public header/footer).
3. **Backend public endpoints gated.** Public/anonymous backend endpoints across modules are gated when `public_view` is disabled — **except `GET /api/v1/settings/public`**, which must stay reachable so the neutral page (and the frontend shell) can render branding and read the module map.
4. **Cross-module dependency: Events ↔ Finance.** The behavior when Events is enabled but Finance is disabled (paid registration requires Finance) is decided and implemented — block the toggle, warn, or degrade gracefully. Paid-event flows must not break or expose inconsistent state; free-event registration is unaffected.
5. **Background-job behavior.** Hangfire jobs belonging to a disabled module have defined, implemented behavior (skip / no-op / log) — a disabled module does not cause job failures or send communications it shouldn't.
6. **End-to-end coverage.** E2E tests cover enabling and disabling each of the 7 modules; tests cover the Public-View-disabled page (including the settings-fetch-failure fallback) and the Events↔Finance dependency behavior.
7. **Quality gate.** `dotnet test` from `backend/` green (1837/1837+, 0 warnings); `npm run typecheck`/`lint`/`format:check` green; the E2E suite passes.

## Tasks / Subtasks

- [x] **Task 1 — Public View middleware rewrite (AC: 1, 2)** — extended `frontend/src/middleware.ts`:
  - [x] When `modules.public_view === false`, `/public/*` and the **unauthenticated** landing `/` are `NextResponse.rewrite`-d to `/site-unavailable`. `/` is gated on the absence of a next-auth session cookie (`next-auth.session-token` / `__Secure-` variant) so an authenticated user still gets their dashboard. Matcher extended with `/` and `/public/:path*`.
  - [x] **Q1 resolved → exempt:** `/public/unsubscribe/*` is left reachable even when `public_view` is off (transactional email-unsubscribe is a compliance flow).
- [x] **Task 2 — Neutral "site not public" page (AC: 2)** — new `frontend/src/app/site-unavailable/page.tsx`: standalone minimal layout (added `/site-unavailable` to `MainLayout`'s `isFullPageLayout` list — no authenticated shell, no public header/footer). Centered org logo + name from a self-contained `GET /api/v1/settings/public` fetch; one neutral sentence; a discreet focusable "Member login" link. On fetch failure → `branding` stays `null` → plain unbranded message; errors are swallowed, the page never throws. All text via next-intl `siteUnavailable.*` keys.
- [x] **Task 3 — Backend public-endpoint gating (AC: 3)** — **Q2 resolved:** new `ModuleEnabledEndpointFilter` (`IEndpointFilter`) + `.RequireModule(key)` extension — the `Module:` *policy* from E10-S3 cannot reach `AllowAnonymous` endpoints (auth middleware short-circuits on `IAllowAnonymous`), so an endpoint filter is the correct mechanism. Applied `.RequireModule("public_view")` to the Blog public group, Contact public group, Sponsor public group, and the two public Event endpoints + the public RSVP endpoint. **`GET /api/v1/settings/public` is deliberately NOT gated** (verified by test). `UnsubscribeEndpoints` left exempt (Q1). Calendar feeds left always-on (**Q4 resolved** — opaque-token subscription URLs; gating them would break already-distributed feeds and they expose no more than the events module itself).
- [x] **Task 4 — Events ↔ Finance dependency (AC: 4)** — **Q3 resolved → warn + degrade, no hard-block.** The advisory warning is already rendered in the E10-S2 Modules tab (`MODULE_DEPENDENCY_WARNINGS = { finance: ["events"], events: ["finance"] }` → `enabledDependents()` → `moduleDependencyWarning` i18n). The structural backend guard is E10-S3's `Module:finance` enforcement: any future paid-event flow (Epic E4, currently deferred backlog — no paid-registration code exists today) that calls a finance endpoint while Finance is disabled gets a clean 403 instead of creating partial finance records; free-event registration touches no finance endpoint and is unaffected.
- [x] **Task 5 — Hangfire job behavior (AC: 5)** — `MarkInvoicesOverdueJob` + `DunningScheduleGenerationJob` skip cleanly (log + return) when `finance` is disabled; `VolunteerShiftReminderJob` skips when `events` is disabled — each checks `IModuleSettingsService.IsEnabledAsync` at job entry. `RetentionEnforcementJob` is cross-cutting/admin (not a module) → left always-on. No automation/communication jobs exist yet (Epic E5 deferred).
- [x] **Task 6 — E2E + tests (AC: 6, 7)**
  - [x] E2E (Playwright): new `frontend/playwright.config.ts` + `frontend/e2e/module-enforcement.spec.ts` — data-driven over the 6 app modules (disable → nav hidden + direct URL rewritten; re-enable → restored), the `public_view` neutral-page rewrite, and the Events↔Finance advisory. The suite `test.skip()`s itself when `E2E_ADMIN_PASSWORD` is unset, so `npx playwright test` is a clean no-op without the full local stack and runs for real with it (see Debug Log).
  - [x] Neutral-page coverage: `site-unavailable/page.test.tsx` (Vitest/jsdom) — renders + focused login link, branded on fetch success, **unbranded fallback on fetch failure (never errors)**.
  - [x] Events↔Finance: covered by the advisory-warning E2E assertion + the E10-S3 `Module:finance` backend-enforcement tests (the structural guard).
  - [x] Backend tests: `ModulePublicViewEndpointTests` — public endpoints 403 when `public_view` off, reachable when on, **`GET /api/v1/settings/public` always reachable**; `ModuleGuardedJobTests` — jobs skip/run by module state.
  - [x] Quality gates: `dotnet test` 1930/1930 green, 0 warnings; `npm run typecheck` green; changed files lint-clean + Prettier-formatted; Vitest 78/78. (Pre-existing repo-wide lint/format debt in untouched files is unchanged — out of scope.)

## Dev Notes

### Public View is special — no dedicated backend route group

Unlike the other 6 modules, Public View has **no dedicated backend endpoint group**. Its surface is the set of `AllowAnonymous` public endpoints scattered across modules (public event/blog/sponsor feeds, public contact, newsletter). E10-S3 deliberately left those un-gated; **E10-S5 owns them.** The critical exception: `GET /api/v1/settings/public` must remain reachable even when Public View is disabled, because the neutral page and the frontend shell need branding + the module map to render anything at all. [Source: architecture.md#ADR-008]

### Public routes & layout facts

- `/public/*` routes (from exploration): `/public/blog`, `/public/blog/[id]`, `/public/contact`, `/public/events`, `/public/events/[id]`, `/public/newsletter`, `/public/sponsors`, `/public/unsubscribe`, `/public/unsubscribe/[token]`. `frontend/src/app/public/layout.tsx` wraps them in `PublicHeader` + `PublicFooter`.
- `frontend/src/components/navigation/MainLayout.tsx` line 52: `isFullPageLayout = pathname === "/login" || pathname.startsWith("/auth/") || pathname.startsWith("/public")` — the neutral page must either be added to this list or live under a path that gets a minimal layout. **Do not** put the neutral page under `/public` (it would be rewritten by its own rule).
- `frontend/src/app/page.tsx` (`/`) is dual-purpose: unauthenticated landing (lines 65–107) + authenticated dashboard. The `/` rewrite must be conditional on auth state.
- ⚠️ `/public/unsubscribe/*` is a **transactional** flow (email unsubscribe links) — blocking it when Public View is off may be undesirable (users who got an email before the toggle still need to unsubscribe). See Q1.

### Backend public endpoints (the surface to gate)

From E10-S3's exploration, the `AllowAnonymous` public groups left un-gated: `SponsorEndpoints` public group (~20), `BlogEndpoints` public `/api/v1/blog/public` (~17), `ContactEndpoints` public `/api/v1/public/contact` (~17), `UnsubscribeEndpoints` `/api/v1/public/newsletter` (~17, `AllowAnonymous`), `EventRegistrationEndpoints` public RSVP endpoint (~29), public event feeds. **`SettingsEndpoints` public group (`/api/v1/settings/public`) must NOT be gated.** Calendar feed endpoints (`EventEndpoints.cs:228`) are public — confirm whether they're Public-View-gated or stay (they're member/public calendar subscriptions — see Q4).

### Cross-module dependency: the Events ↔ Finance case

Paid event registration (Epic E4) needs the Finance module. Architecture ADR-008 explicitly flags this dependency and defers the *handling decision* to this story: "Whether to hard-block such a toggle is a product rule deferred to E10-S5; the architecture flags the dependency rather than enforcing it." Recommended approach (Q3): **warn, don't hard-block** — the E10-S2 Modules tab shows the advisory warning; if Finance is disabled anyway, paid-event registration degrades gracefully (paid events show "registration unavailable", free events unaffected, no partial finance records created). Note Epic E4 (paid registration) is currently in the deferred backlog — so today there is little/no paid-registration code to degrade; this story should implement the *guard* so that when E4 resumes the dependency is already handled.

### `public_site_enabled` vs `module_settings['public_view']` — RESOLVE HERE

E9-S1 added `SystemSettings.PublicSiteEnabled`; E10-S1 seeded a `public_view` row in `module_settings`. **Two switches for overlapping concerns** (flagged in the readiness report and E10-S1 Q2). This story is the right place to resolve it (Q5): recommend `module_settings['public_view']` is the **single authoritative** toggle for serving the public site, and `SystemSettings.PublicSiteEnabled` is either (a) removed/deprecated, or (b) repurposed narrowly (e.g. "show public-site nav links" UX hint) — decide and document. Do not leave both as independent enforcement inputs.

### Architecture & project constraints

- **OD-5 resolved:** minimal neutral page over a login redirect — a redirect to `/login` would read as a defect to anonymous visitors and conflate "module off" with "auth required". [Source: architecture.md#ADR-008, ux-design.md#Public View Disabled]
- `GET /api/v1/settings/public` must remain reachable when Public View is disabled. [Source: architecture.md#ADR-008]
- Background jobs belonging to a disabled module: behavior defined here; the 3 enforcement layers govern HTTP/UI only. [Source: architecture.md#ADR-008]
- Backend is the security boundary; middleware rewrite is direct-URL convenience. [Source: architecture.md#ADR-003, ADR-008]
- Hangfire for background work; jobs must not break user-facing workflows on failure. [Source: architecture.md#ADR-005, project-context.md]
- Privacy/retention/audit not weakened — public endpoints expose only intended public data. [Source: project-context.md]

### UX specifics [Source: ux-design.md#Public View Disabled]

- Standalone minimal layout — not the authenticated shell, not the full public header/footer. Centered org logo+name (from `GET /api/v1/settings/public`) + one short neutral sentence + a quiet "Member login" link.
- Settings-fetch failure → plain unbranded message; the page must never error.
- Single clear heading, readable body, keyboard-focusable login link, no reliance on imagery. Neutral message + login link via next-intl keys; logo/name from settings, not hardcoded.

### Project Structure Notes

NEW: the neutral "site unavailable" page (+ possibly a minimal layout for it). UPDATE: `frontend/src/middleware.ts` (Public View rewrite + `/` conditional), `MainLayout.tsx` (full-page-layout list), backend public endpoint groups (gating), Events/Finance code paths (dependency degradation), Hangfire job entry points, `de.json`/`en.json`. Possibly UPDATE `SystemSettings`/E9-S1 surface if `public_site_enabled` is deprecated (Q5). E2E test suite. No migration expected (unless Q5 removes a column).

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E10-S5: Add Public View Toggle and Cross-Module Dependency Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-008] — Public View special-casing, cross-module dependency note
- [Source: _bmad-output/planning-artifacts/ux-design.md#Public View Disabled] — OD-5 resolution
- [Source: e10-s3-add-backend-module-enforcement.md] + [Source: e10-s4-add-frontend-module-enforcement.md] — dependencies
- [Source: e9-s1-extend-systemsettings-and-add-branding-admin-ui.md] — `public_site_enabled` overlap (Q5)
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-05-14.md] — the `public_site_enabled` vs `public_view` design tension

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **`/public/unsubscribe/*` exemption.** Transactional email-unsubscribe links — should they stay reachable even when Public View is disabled? Recommend **yes, exempt** (compliance: people must be able to unsubscribe). Confirm.
2. **Backend public-endpoint gating mechanism.** A `Module:public_view` policy on the anonymous groups, or a dedicated middleware/filter check? The wrinkle: it must let `GET /api/v1/settings/public` through. Recommend a `Module:public_view` policy applied to the public groups, explicitly NOT applied to the settings/public endpoint. Confirm.
3. **Events ↔ Finance dependency handling.** Recommend **warn + degrade** (not hard-block the toggle). Confirm — or do you want disabling Finance to be blocked while Events is enabled?
4. **Calendar feed endpoints.** Public iCal/`.ics` feeds (`EventEndpoints.cs:228`, from done Epic E3) — gated by `public_view`, or by `events`, or left always-on? Recommend gated by `events` (they're event data), not `public_view`. Confirm.
5. **`public_site_enabled` vs `public_view` (design resolution).** Recommend `module_settings['public_view']` is the single authoritative toggle; `SystemSettings.PublicSiteEnabled` (added by E9-S1) is deprecated or repurposed as a non-enforcing UX hint. This needs a decision before implementation — it affects whether E9-S1's column stays.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Amelia / bmad-dev-story)

### Debug Log References

- `dotnet build` (backend): succeeded, 0 warnings / 0 errors.
- `dotnet test` (backend full suite): **1930/1930** — Application.Tests 1439, Api.Tests 102 (+7 `ModulePublicViewEndpointTests`), Infrastructure.Tests 389 (+5 `ModuleGuardedJobTests`). 0 warnings.
- `npm run typecheck` (frontend): green.
- `npm run lint` (frontend): changed files clean; repo-wide run still reports the same 2 pre-existing errors in untouched files.
- Frontend Vitest (full suite): **78/78** passed, 15 files — incl. the new `site-unavailable/page.test.tsx` (3) and the extended `middleware.test.ts` (8).
- Playwright E2E (`frontend/e2e/module-enforcement.spec.ts`): **authored, not executed in this environment** — the suite needs the full local stack (Docker: PostgreSQL + Keycloak + RustFS, the backend, the frontend) plus a seeded Keycloak admin. It `test.skip()`s itself when `E2E_ADMIN_PASSWORD` is unset, so `npx playwright test` is a clean no-op here; the CI-runnable proof of the same behaviour is the backend + Vitest suites above.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- ✅ **Task 1** — `middleware.ts` extended: `public_view` off rewrites `/public/*` (except `/public/unsubscribe/*`, Q1) and the unauthenticated `/` to `/site-unavailable`; `/` is session-cookie-gated so the authenticated dashboard is untouched.
- ✅ **Task 2** — `/site-unavailable` neutral page: standalone minimal layout, self-contained branding fetch with a never-throw unbranded fallback, focused member-login link, `siteUnavailable.*` i18n.
- ✅ **Task 3** — **Q2:** introduced `ModuleEnabledEndpointFilter` + `.RequireModule(key)` (an `IEndpointFilter` — works on `AllowAnonymous` endpoints where the E10-S3 `Module:` policy cannot). Applied to Blog/Contact/Sponsor public groups + the public Event endpoints + public RSVP. `GET /api/v1/settings/public` deliberately exempt. **Q4:** calendar feeds left always-on. **Q1:** newsletter/unsubscribe left exempt.
- ✅ **Task 4** — **Q3:** warn + degrade. Advisory warning already present in the E10-S2 Modules tab; the backend structural guard is E10-S3's `Module:finance` enforcement (paid-event finance calls 403 cleanly when Finance is off — no partial records; free-event registration is finance-free and unaffected). Epic E4 paid-registration is deferred, so there is no degradation code path to write yet — the guard is in place for when it resumes.
- ✅ **Task 5** — `IModuleSettingsService` skip checks at job entry: `MarkInvoicesOverdueJob` + `DunningScheduleGenerationJob` (finance), `VolunteerShiftReminderJob` (events). `RetentionEnforcementJob` is admin/cross-cutting → left always-on.
- ✅ **Task 6** — `ModulePublicViewEndpointTests` (backend, 7), `ModuleGuardedJobTests` (backend, 5), `site-unavailable/page.test.tsx` (3) + extended `middleware.test.ts` (+5) on the frontend, and the Playwright `module-enforcement.spec.ts` E2E suite (full-stack-gated).
- **Q5 resolved** — `module_settings['public_view']` is the single authoritative toggle for serving the public site (enforced by `middleware.ts` + the `RequireModule` filter). `SystemSettings.PublicSiteEnabled` (E9-S1) is **deprecated for enforcement** — left in place (no migration churn, still returned by the public settings endpoint) but no longer an enforcement input. A follow-up cleanup could repurpose it as a pure UX hint or drop the column.
- **Test reconciliation** — E10-S3's `ModuleEnforcementEndpointTests` had an `AnonymousEndpoints_StayReachable_WithModulesDisabled` test asserting `/api/v1/sponsors/public/` stays reachable with all modules off; E10-S5 deliberately gates that endpoint by `public_view`, so the test was renamed `AlwaysOnAnonymousEndpoints_…` and narrowed to the genuinely-always-on surface (`/settings/public` + calendar feeds), with public_view gating now covered by `ModulePublicViewEndpointTests`.

### File List

**New — backend:**
- `backend/src/IabConnect.Api/Authorization/ModuleEndpointFilter.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/ModulePublicViewEndpointTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/ModuleGuardedJobTests.cs`

**New — frontend:**
- `frontend/src/app/site-unavailable/page.tsx`
- `frontend/src/app/site-unavailable/page.test.tsx`
- `frontend/playwright.config.ts`
- `frontend/e2e/module-enforcement.spec.ts`

**Modified — backend:**
- `backend/src/IabConnect.Api/Endpoints/BlogEndpoints.cs`, `ContactEndpoints.cs`, `SponsorEndpoints.cs`, `EventEndpoints.cs`, `EventRegistrationEndpoints.cs` (`.RequireModule("public_view")` on the public surface)
- `backend/src/IabConnect.Infrastructure/Finance/Jobs/MarkInvoicesOverdueJob.cs`, `DunningScheduleGenerationJob.cs`, `backend/src/IabConnect.Infrastructure/Events/Jobs/VolunteerShiftReminderJob.cs` (module skip checks)
- `backend/tests/IabConnect.Api.Tests/Endpoints/ModuleEnforcementEndpointTests.cs` (test reconciliation — see Completion Notes)

**Modified — frontend:**
- `frontend/src/middleware.ts` (Public View rewrite + matcher), `frontend/src/middleware.test.ts` (+5 tests)
- `frontend/src/components/navigation/MainLayout.tsx` (`/site-unavailable` full-page layout)
- `frontend/messages/en.json`, `frontend/messages/de.json` (`siteUnavailable.*` keys)
- `frontend/vitest.config.ts` (exclude `e2e/**`)

## Change Log

| Date       | Change                                                                                          |
|------------|-------------------------------------------------------------------------------------------------|
| 2026-05-14 | E10-S5 implemented (closes Epic 10): Public View middleware rewrite + `/site-unavailable` neutral page, `ModuleEnabledEndpointFilter` (`.RequireModule`) gating the public backend surface (`/settings/public` exempt), Hangfire job module-skip checks, Events↔Finance warn-and-degrade guard, Playwright E2E suite. Q1–Q5 resolved. Backend 1930/1930 green, frontend Vitest 78/78, typecheck green. Status → review. |
| 2026-05-14 | Addressed code review findings — 2 [Review][Patch] items resolved: `ModuleEnabledEndpointFilter` now fail-opens (try/catch + log) on a module-service failure instead of 500-ing the public surface, newsletter `POST /subscribe` gated with `.RequireModule("public_view")` (unsubscribe stays exempt). 2 new Api tests; backend 1936/1936 green, 0 warnings. |

## Review Findings

_Epic-10 boundary code review — bmad-code-review, 2026-05-14. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

- [x] [Review][Patch] `ModuleEnabledEndpointFilter.InvokeAsync` — wrap `IsEnabledAsync` in try/catch and **fail-open** (treat as enabled) on a module-service failure, matching the frontend middleware's degrade-to-enabled behaviour; today any service failure 500s the entire public surface _(resolves the original Decision)_ [backend/src/IabConnect.Api/Authorization/ModuleEndpointFilter.cs] — **RESOLVED 2026-05-14:** `InvokeAsync` now wraps `IsEnabledAsync` in `try/catch` — a module-service failure is logged (`LogError`) and treated as enabled (fail-open), so a cache/DB outage no longer 500s the entire public surface.
- [x] [Review][Dismissed] Audit for `ModuleEnabledEndpointFilter` denials — reviewed and decided: keep the bare 403, do **not** audit anonymous public-endpoint denials (audit-log flood risk from bots; "public site is off" is not a security event — the authenticated `ModuleAuthorizationHandler` audit remains the meaningful signal). No code change.
- [x] [Review][Patch] Gate `/api/v1/public/newsletter` (newsletter signup) with `.RequireModule("public_view")` — it is a public-site feature, not a transactional-compliance flow; signups should not be accepted while the public site is off _(resolves the original Decision)_ [backend/src/IabConnect.Api/Endpoints/UnsubscribeEndpoints.cs] — **RESOLVED 2026-05-14:** `.RequireModule("public_view")` applied to the `POST /subscribe` endpoint only — the unsubscribe endpoints stay exempt (Q1, transactional compliance flow). Covered by `NewsletterSubscribe_Returns403_WhenPublicViewDisabled` + `NewsletterSubscribe_NotGated_WhenPublicViewEnabled`.
- [x] [Review][Defer] Playwright E2E suite (`module-enforcement.spec.ts`) is authored but `test.skip()`s itself without `E2E_ADMIN_PASSWORD` — AC-6/AC-7 "the E2E suite passes" is unverified in CI [frontend/e2e/module-enforcement.spec.ts] — deferred, needs the full local stack (Docker + Keycloak + seeded admin); the backend + Vitest suites are the CI-runnable proof of the same behaviour
