# Story E27.S1: Admin — Characterization Tests for All Fifteen Pages (Regression Net)

Status: ready-for-dev

Depends on: E21-S2 / E22-S1 (the characterization-net recipe — closed). **Blocks E27-S2..S6** (each extraction story keeps its sub-area's suites green). Inherits E21-S1 boundary decisions; applies A76/A78/A79/A80/A86/A87/A90/A97/A99 + harness rules A35/A46/A64/A78.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer about to refactor fifteen admin pages across five sub-areas,
I want a characterization test suite that pins each page's CURRENT observable behaviour — including its admin auth guard — first,
so that the E27-S2..S6 slice extractions are provably behaviour-preserving.

## Acceptance Criteria

**Test-only; green against branch HEAD before any refactor commit.**

1. New (or extended) co-located `*.test.tsx` suites pin the CURRENT behaviour of all fifteen admin pages, organised by sub-area so each S2..S6 story owns a clear green baseline. **EVERY suite asserts the admin auth guard explicitly**: the redirect-away path (`router.push("/")` — note **`/`, NOT `/login`**) when authenticated-but-not-admin, the unauthenticated path, and that the protected data fetch is gated on `isAuthenticated && isAdmin && accessToken` (where the page uses that gate — see the per-page reality notes; `admin/register` is the documented PUBLIC exception with NO guard).

2. **Users area** (`admin/users/page.tsx`, `admin/users/new/page.tsx`, `admin/users/[id]/page.tsx`, `admin/users/[id]/sessions/page.tsx` — NO tests exist today, write from scratch):
   - List: load (`GET /api/v1/users`), explicit-submit search (`?search=`, resets `page=1`), pagination shown only when `totalPages>1` (`pageSize=20`), loading/error(dismissible banner)/empty (`noUsersFound` when searching vs `noUsers`).
   - Per-row actions: enable/disable toggle (no confirm; **conditional colour** red-when-enabled / green-when-disabled), password-reset (`confirm`+success `alert`, **blue**), MFA-reset (`confirm`+success `alert`, **orange**), delete (`confirm`, no alert, **red**; on success row filtered + `totalCount--`; **on FAILURE list preserved**).
   - Role badges (`getRoleColor` → red/blue/green/gray; assert via translated label scoped to the row, not the colour class) + status badge (enabled green / disabled red) + `emailVerified ✓`.
   - new form: required `email`, conditional-required `temporaryPassword` (only when `!sendInvitation`), role checkboxes (default `["member"]`), submit → `createUser` → redirect `/admin/users/{id}`; **409 → the `A user with this email already exists` message preserved**; submit-error surfaced.
   - edit form: `emailVerified` field (edit-only), role checkboxes seeded from user; submit = **two-step** (`updateUser` then conditional `updateUserRoles` via a Set-diff) → success banner (no redirect); the distinct `!user` not-found terminal block; submit-error.
   - sessions: load (`GET /api/v1/users/{id}/sessions`), revoke (`window.confirm`, **bordered-red** button, inline `message` banner auto-clearing 4s, **list preserved on failure**), refresh button, empty (`data-testid="admin-sessions-empty"`) / list (`data-testid="admin-sessions-list"`) — **preserve the existing `data-testid`/ARIA hooks**.

3. **Settings area** (`admin/settings/page.tsx` — test EXISTS, extend; `admin/page.tsx` dashboard — NO test, write):
   - `admin/settings/page.tsx` is a **THREE-TAB page** (`branding | customRoles | modules`). The existing `settings/page.test.tsx` covers Branding (fields render, live preview, PUT `/api/v1/settings`, logo POST `/api/v1/settings/logo`, invalid-type inline, failed-upload surfaced) + Modules (7 toggles, disable-confirm modal gating, finance↔events advisory warning, confirm→PUT `/api/v1/module-settings/{key}`+`refreshAppSettings`, single GET on mount, error-keeps-modal-open, enable-without-confirm). **Add the missing coverage: the admin auth-redirect path; the Custom Roles tab (list `GET /api/v1/custom-roles`, create POST subset, edit PUT full form, inline delete-confirm → DELETE, role badge colours); the settings `loadError`/`saveError` paths.** Pin that success/error banners are **persistent (NO auto-dismiss timer)** and that branding/module saves call `refreshAppSettings()`.
   - `admin/page.tsx`: pure static navigation (no fetch). Assert the 7 tiles/links render with correct labels (`t("<section>.title")`) + hrefs (`/admin/users`, `/admin/audit`, `/admin/register`, `/admin/settings`, `/admin/backups`, `/admin/retention`, `/admin/health`); assert the auth-redirect + `return null` non-admin guard.

4. **System area** (`admin/audit/page.tsx`, `admin/backups/page.tsx`, `admin/health/page.tsx`, `admin/retention/page.tsx` — NO tests exist, write):
   - audit: log load + the 7 **server-side** filter controls (fromDate/toDate/category/eventType/severity/success/search — changing a filter resets `page:1` + refetches), collapsible filter panel, pagination shown when `totalPages>1` (`pageSize=50`), CSV export (`exportAuditEvents` → Blob → anchor download `audit_export_<date>.csv`), severity/category/success badges; loading/error/empty.
   - backups: list + stats; create (modal, notes); **restore (inline 2-button confirm, trigger blue / confirm ORANGE — pin the CURRENT orange affordance; failure keeps confirm state)**; **delete (inline 2-button confirm, RED; failure keeps confirm state)**; download (only `Completed`); upload (modal, FormData); retry (`Failed` rows); disable-schedule; status badge (`getStatusColor`: Completed green / InProgress yellow / Failed red) + type badge.
   - health: status render (overall + per-service cards, exception box), status badges + inline dot (Healthy/Degraded/Unhealthy), **30s auto-refresh** (assert the page re-fetches on interval, or at minimum that `lastChecked` + interval wiring exists), manual refresh; loading/error.
   - retention: policy list load; edit (manual form: `displayName`, `retentionMonths` number, `action` `<select>` Anonymize/Archive/Delete, `legalBasis`, `isActive`; `dataCategory` read-only) → save (`updateRetentionPolicy`) + success toast (auto-dismiss 5s); enforce (`enforceRetention`, **no confirm**, orange) + result count; loading/error.

5. **Integrations area** (`admin/api-clients/page.tsx`, `admin/webhooks/page.tsx`, `admin/webhooks/deliveries/page.tsx` — tests EXIST (9 tests), verify + extend):
   - **The show-once secret panels (data-loss path) stay behaviour-LOCKED**: api-clients create → `secret` shown once, `navigator.clipboard.writeText` → `copied`, dismiss → `setCreatedSecret(null)`, the LIST refetch must NOT reintroduce the secret; webhooks signing-secret shown **only on create** (NOT edit, NOT regenerate — no regenerate action exists). Keep the 3 existing secret-once tests green and confirm the list-refetch-doesn't-reintroduce invariant.
   - **Extend the webhooks gaps the existing suite omits**: enable/disable toggle (`POST .../{id}/{enable|disable}`, no confirm), delete (`window.confirm` → `DELETE .../{id}`, red), edit via the shared dialog (PUT, no secret), and the no-touch-edit round-trips stored `eventTypes` even if not in `availableEventTypes`. Webhook dialog save disabled unless `name.trim()` + `targetUrl.trim()` + `eventTypes.length>=1`.
   - deliveries: list + pagination (`pageSize=20`, prev/next on `hasPreviousPage`/`hasNextPage`); **NO filters, NO retry action** (assert their absence is fine — do not test for them); the payload body is NOT rendered (existing test asserts no `/payload/i`).

6. **Documents area** (`admin/documents/page.tsx` — NO test, write; `admin/register/page.tsx` — test EXISTS (branding only), extend). **NOTE the reality correction (the epic skeleton was wrong here):**
   - `admin/documents/page.tsx` is a **FOLDER & PERMISSION manager (REQ-035), NOT a file/document manager** — there is NO file upload, NO document list, NO delete-document, NO status badges. Pin what EXISTS: folder list (`getFolders(parentId)`), folder drill-down/back navigation, create-folder modal, edit-folder modal, set-permissions modal (two `<select>`s — Member: ""/Read/Write; Vorstand: +Manage), delete-folder (styled **modal**, not `window.confirm`, RED confirm; failure shows error, modal already closed), permission chips, search box; loading/error/empty (`noFolders`/`noSubfolders`); the admin auth-redirect (note: this page does NOT early-return `null` for non-admins — it renders the spinner during redirect; pin the CURRENT behaviour).
   - `admin/register/page.tsx` is the **PUBLIC self-signup FORM (unauthenticated `POST /api/v1/registration`), NOT an admin approval register** — NO entries list, NO filters, NO pagination, NO approve/reject, NO status badges, and NO auth guard. Keep the existing branding/white-label test green and **extend it**: the 5-field form (firstName/lastName/email/password(min 8)/confirmPassword, all required), client validation (password mismatch, too-short), submit → `registerUser` → success screen, error path (incl. the `already exists` → `registration.emailExists` string-sniff). Do NOT add an admin-guard assertion here (it is the documented public exception to AC-1).

7. Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useApiClient`/`useAuth`/`useRouter`/`useParams` mocks (A64/A78 — define each mocked object/fn ONCE, mutate per-test; `useApiClient` returns a STABLE `{get,post,put,delete,upload}` bag), `QueryClientProvider` wrapper on every render (A87 — forward-compat seam even though the god-pages are pre-TanStack). Each suite RECORDS (A79) the manual→TanStack/RHF deltas a `retry:false` harness masks (provider `retry:1` double-fetch + ~1s delay on a 404-sentinel query per A93/A99; `isLoading=false` on a same-key refetch → no spinner; sticky-mutation-error; an await-then-reset handler that wipes input on the error path per A92) so S2..S6 decide them explicitly.

8. **A76/A80/A86 destructive-affordance assertions per surface**: pin the CURRENT colour/variant AND the failure branch of every delete/revoke/restore/disable/reject action listed above — PER surface (A80), and preserve the CURRENT colour in the assertion (A86: most admin actions already ship an intentional colour — delete=red, restore=orange, disable=conditional, password-reset=blue, mfa-reset=orange — pin what is there, do NOT assume `destructive` red).

9. No production code changed (test-only). Full `vitest run` green against HEAD; the per-page assertion inventory is recorded with the admin-guard assertion present in every authenticated page's suite.

## Tasks / Subtasks

- [ ] Task 0: Spike confirm + harness setup (AC: 1, 7)
  - [ ] Re-confirm `features/admin-*` does NOT exist yet; confirm current full `vitest run` count at HEAD (the green baseline the net must preserve). Read the existing tests being extended: `admin/settings/page.test.tsx`, `admin/api-clients/page.test.tsx`, `admin/webhooks/page.test.tsx`, `admin/webhooks/deliveries/page.test.tsx`, `admin/register/page.test.tsx`.
  - [ ] Establish the shared admin test harness (stable mocks per A64/A78 + `QueryClientProvider` per A87), mirroring `frontend/src/features/members` / `events` S1 nets.
- [ ] Task 1: Users-area suites (AC: 1, 2, 7, 8) — 4 new suites; cover the two-step edit save, the conditional `temporaryPassword`, the `confirm`/`alert` flows, the 409 message, the sessions `data-testid`/ARIA hooks + 4s message timer.
- [ ] Task 2: Settings-area suites (AC: 1, 3, 7, 8) — extend `settings/page.test.tsx` (Custom Roles tab + auth-redirect + settings error paths + persistent-banner + `refreshAppSettings`); new `admin/page.test.tsx` (static tiles + guard).
- [ ] Task 3: System-area suites (AC: 1, 4, 7, 8) — 4 new suites; server-side audit filters + CSV export; backups inline-confirm restore(orange)/delete(red) + download + upload; health 30s interval + status; retention manual form + enforce.
- [ ] Task 4: Integrations-area suites (AC: 1, 5, 7, 8) — verify the 9 existing tests green; extend webhooks (toggle/delete/edit + eventTypes round-trip) + confirm the secret-once list-refetch invariant.
- [ ] Task 5: Documents-area suites (AC: 1, 6, 7, 8) — new `documents/page.test.tsx` (folder CRUD + permissions modal + delete-modal); extend `register/page.test.tsx` (form submit/validation/error). Record the reality corrections in Completion Notes.
- [ ] Task 6: Green-the-net + DoD gate (AC: 9) — full `vitest run` green at HEAD; `tsc`/eslint(changed)/prettier-check(changed); record the A79 per-suite delta inventory + the per-page assertion inventory.

## Dev Notes

The pre-refactor characterization net for the whole `admin/` route tree. Because admin is an AREA (5 sub-slices), organise suites by sub-area so each S2..S6 inherits a clear green baseline. The show-once secret panels (api-clients, webhooks), the `confirm`/`alert` browser-dialog patterns (users), the inline-confirm restore/delete (backups), the two-step user-edit save, and the 30s health poll are the highest-risk behaviours to pin.

### Scope Boundaries

- In scope: co-located `*.test.tsx` for all 15 pages (new where missing, extended where present); the shared admin test harness.
- Out of scope: ANY production code change; the slice extractions (S2..S6); creating `features/admin-*`; i18n changes. **Do NOT "fix" the discovered quirks** (the no-`return null` on documents/page; the un-cleared `loading` on the gated path; restore's orange affordance) — pin them AS-IS; S2..S6 decide them explicitly via A90/A97/A86.

### Architecture Guardrails

- Mirror the E21-S2/E22-S1/E23-S1 net recipe: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46) for every file that calls `render()`; stable mocks (A64/A78); `QueryClientProvider` wrapper (A87).
- A76/A80: pin the destructive/red (or contextual) affordance AND the failure branch PER surface. A86: assert the CURRENT colour (do not normalise to `destructive`).
- A79/A93/A99: record (in test comments + Completion Notes) the deltas a `retry:false` harness cannot observe, so S2..S6 resolve them.
- Redirect target is **`/`** everywhere (not `/login`). `admin/register` is the PUBLIC exception (no guard).

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 (existing-test strategy):** A) EXTEND the 5 existing test files in place + ADD new files for the 10 untested pages (recommended — keeps the green baseline + fills gaps). B) rewrite the existing suites. **Recommended: A.**
- **DEC-2 (health 30s poll assertion):** A) assert the interval wiring + a single fake-timer advance triggers a refetch (recommended; behaviour-locks the poll → S4 `refetchInterval`). B) only assert the initial render (skip the timer). **Recommended: A.**
- **DEC-3 (documents/register reality):** A) pin the ACTUAL surfaces (folder manager + public signup form) and record the epic-skeleton divergence (recommended — A56). B) author against the skeleton's (non-existent) upload/approve-reject surfaces. **Recommended: A — B is impossible (those surfaces don't exist).**

### Testing Requirements

- The net IS the behaviour-preservation oracle (A87). Assert observable behaviour (rendered text via i18n labels scoped to the right region, fetch URLs, navigation, action handlers, badge presence via label, loading/error/empty), NOT implementation detail.
- Mock `next-intl` with a stable identity translator (A64); mock `@/lib/auth` (`useAuth` + `useApiClient`); mock `@/lib/api/*` token-param modules (users/audit/backup/retention/health) at the module boundary for the pages that use them; mock `@/lib/services/documents` for documents; mock `@/lib/api/registration` for register.
- A35/A46: `afterEach(cleanup)` only for `render()`-calling suites.

### Project Structure Notes

- Co-located suites: `frontend/src/app/admin/**/page.test.tsx` (+ the `[id]` / `[id]/sessions` / `new` user pages, the `webhooks/deliveries` page). No `features/` files created in this story.

### References

- Net recipe: `frontend/src/features/members/**/*.test.tsx`, `frontend/src/features/events/api/*.test.ts`; the E21-S2/E22-S1 ATDD nets.
- Existing admin tests to extend: `frontend/src/app/admin/settings/page.test.tsx`, `admin/api-clients/page.test.tsx`, `admin/webhooks/page.test.tsx`, `admin/webhooks/deliveries/page.test.tsx`, `admin/register/page.test.tsx`.
- Pages: all 15 under `frontend/src/app/admin/`. Transports: `frontend/src/lib/api/{users,audit,backup,retention,health,apiClients,webhooks,registration}.ts`, `frontend/src/lib/services/documents.ts`, `frontend/src/lib/auth.ts` (`useAuth`/`useApiClient`).
- project-context.md A34/A35/A46/A58/A64/A72/A73/A76/A78/A79/A80/A86/A87/A90/A92/A93/A97/A99; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. Blocks S2..S6.
- **A56 findings (load-bearing — the epic skeleton diverges from reality):**
  - **Test baseline:** users (4 pages), audit, backups, health, retention, documents, `admin/page.tsx` have NO tests → write. settings, api-clients, webhooks, deliveries, register HAVE tests → extend (don't rewrite).
  - **S3 reality:** `settings/page.tsx` is a 3-tab page (branding/customRoles/modules), not one form; `admin/page.tsx` is static.
  - **S6 reality (biggest divergence):** `admin/documents` = folder/permission manager (no upload/no doc-list); `admin/register` = public signup form (no approve/reject, no guard). The skeleton's S1 ACs for those surfaces were rewritten to match reality.
  - **S5 reality:** secret panels behaviour-locked (already tested); no regenerate action; deliveries has no filters/no retry.
  - **S4 reality:** `health.ts` exists (`/health*`); audit filters server-side; backups restore is orange (not red); health polls 30s.
  - **S2 reality:** redirect `/` (not `/login`); namespace `users`/root `profileSecurity`; two-step edit save; role checkboxes (not selects).
  - **Cross-cutting quirks pinned AS-IS (not fixed here):** un-cleared `loading` on the gated path (safe via `return null` on most pages; documents/page lacks it); status discarded at every `useApiClient` call site (A99).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (characterization net for all 15 admin pages across 5 sub-areas; reality-corrected ACs for documents/register/settings per A56; behaviour-lock secret panels + restore/delete affordances + two-step user save + 30s health poll). Status ready-for-dev.
