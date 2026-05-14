# Story 10.5: Add Public View Toggle and Cross-Module Dependency Handling

Status: ready-for-dev

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

- [ ] **Task 1 — Public View middleware rewrite (AC: 1, 2)** — extend `frontend/src/middleware.ts` (created in E10-S4):
  - [ ] When `modules.public_view === false`, rewrite `/public/*` **and** `/` to the neutral page. ⚠️ `/` is dual-purpose (unauthenticated landing AND authenticated dashboard) — rewrite `/` to the neutral page **only for unauthenticated requests**, or let the neutral page itself handle the authed case (recommend: gate `/` rewrite on absence of an auth session cookie).
  - [ ] ⚠️ Confirm whether `/public/unsubscribe/*` is exempt (it's a transactional email-unsubscribe flow — see Q1).
- [ ] **Task 2 — Neutral "site not public" page (AC: 2)** — new page (e.g. `frontend/src/app/site-unavailable/page.tsx` — a path NOT under `/public` so the rewrite target isn't itself rewritten; add it to `MainLayout`'s full-page-layout list or give it its own minimal layout). Centered: org logo + name from `GET /api/v1/settings/public`; one short neutral sentence; a discreet "Member login" link (a link, not a forced redirect). On settings-fetch failure → plain unbranded message, never errors. All text via next-intl keys. Single clear heading, readable body, keyboard-focusable login link, no reliance on imagery.
- [ ] **Task 3 — Backend public-endpoint gating (AC: 3)** — when `public_view` is disabled, gate the anonymous/public backend endpoints (public event/sponsor/blog feeds, public contact, etc. — the `AllowAnonymous` groups E10-S3 deliberately left un-gated). **`GET /api/v1/settings/public` must stay reachable.** Mechanism: a `Module:public_view` policy on the public groups, or an equivalent check — but it must allow the settings/public endpoint through. Decide and document the exact mechanism (see Q2).
- [ ] **Task 4 — Events ↔ Finance dependency (AC: 4)** — implement the decided behavior (see Q3 — recommend: **warn on the toggle + degrade gracefully**, don't hard-block). If Finance is disabled while Events is enabled: paid-event registration paths must degrade safely (e.g. paid events become unavailable for new registration / show a clear "registration temporarily unavailable" state) without breaking free-event registration or leaving partial finance records. Surface the dependency warning in the E10-S2 Modules tab (the advisory warning) and enforce the degraded behavior in the relevant Events/Finance code paths.
- [ ] **Task 5 — Hangfire job behavior (AC: 5)** — audit the recurring/background jobs (dunning emails, automation sends, retention, etc.) and ensure jobs belonging to a disabled module skip/no-op cleanly (check `IModuleSettingsService.IsEnabledAsync` at job entry, log a skip). A disabled Communication or Finance module must not cause job exceptions or send messages.
- [ ] **Task 6 — E2E + tests (AC: 6, 7)**
  - [ ] E2E (Playwright): for each of the 7 modules — disable it, assert nav hidden + direct URL rewritten + backend 403 (or public rewrite for `public_view`); re-enable, assert restored.
  - [ ] E2E/integration: Public-View-disabled → `/public/*` and `/` show the neutral page; the neutral page renders branding; settings-fetch-failure → unbranded fallback.
  - [ ] Tests for the Events↔Finance degraded behavior (paid registration when Finance is off).
  - [ ] Backend tests: public endpoints gated when `public_view` off; `GET /api/v1/settings/public` still reachable.
  - [ ] All quality gates green.

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

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
