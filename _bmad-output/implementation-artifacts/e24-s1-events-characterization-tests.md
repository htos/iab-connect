# Story E24.S1: Events — Characterization Tests for All Eight Pages (Regression Net)

Status: done

Depends on: E21-S3 + E21-S5 (closed), E22 form sub-recipe (closed), E23 (closed — its slice recipe + harness are the templates). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract, DEC-2 status colours) and the E21-S3/E22/E23 pilot recipe. **Blocks E24-S2/S3** (each requires this net green).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer,
I want a pinned characterization-test net over all eight Events pages,
so that the subsequent slice extractions (E24-S2 core, E24-S3 sub-pages) can prove behaviour was preserved against a green baseline.

## Acceptance Criteria

**Behaviour preserved (test-only story — no production code changes; all E24-S1 tests stay green at HEAD):**

1. Tests cover all **8** pages (under the `(dashboard)` route group, which is **NOT** moved): `events/page.tsx` (list), `events/new/page.tsx` (create), `events/[id]/page.tsx` (detail), `events/[id]/edit/page.tsx` (edit), `events/[id]/check-in/page.tsx`, `events/[id]/fees/page.tsx`, `events/[id]/registrations/page.tsx`, `events/[id]/volunteers/page.tsx`.
2. **Auth guards pinned per page** (the guards are NOT uniform — pin each page's actual shape):
   - List: `authLoading` renders the centred spinner; unauthenticated → `router.push("/login")`; the fetch effect is gated on `isAuthenticated && (isVorstand||isAdmin) && accessToken` so **no events/statistics fetch fires** for an unauthenticated or token-less user.
   - New + Edit: hard role block — `!isVorstand && !isAdmin` renders the forbidden alert (`errors.noPermission` / `errors.noPermissionCreate` + `backToEvents` link); no POST/PUT possible.
   - Detail: `authLoading` skeleton; `!isAuthenticated` → `router.push("/login")` (and the page returns null); manager-only sections gated on `canManageEvents = isVorstand||isAdmin`, delete gated on `canDeleteEvents = isAdmin`.
   - Check-in: `authLoading` skeleton; `!isAuthenticated` → null; the role guard `canAccess = isVorstand || isAdmin || roles.includes("event-manager")` renders the `forbidden` alert when denied.
   - Fees: `!isAuthenticated` → `router.push("/login")`; role guard `canManage = isVorstand || isAdmin || roles.includes("event-manager") || roles.includes("kassier")` → permission-denied alert when denied.
   - Registrations: `!isAuthenticated || !canManage` (`canManage = isVorstand||isAdmin`) → returns null.
   - Volunteers: `!isAuthenticated` → null; `canManage = isVorstand || isAdmin || roles.includes("event-manager")` → permission-denied alert when denied.
3. **Role-gated affordances** asserted present/absent per the guard above (A76 — affordance gating): list "Create Event" link + status filter + statistics cards shown only for `canManageEvents`; detail action bar (Edit/Manage-Fees/Publish/Unpublish/Cancel) only for `canManageEvents`, Delete only for `canDeleteEvents` (Admin); check-in/fees/volunteers render the forbidden/denied surface for an out-of-role authenticated user.
4. **List behaviours pinned:** `pageSize=12`; the 300 ms search/filter debounce; query string `?page={n}&pageSize=12&search=&status=&category=` asserted on the fetch mock; `search`/`status`/`category` param wiring; grid/list `viewMode` toggle (default `grid`); statistics cards render only when the statistics payload is present (and statistics fetch errors are **silently ignored** — A76 failure path); status-badge `statusColors` map (Draft→gray, Published→green, Cancelled→red, Completed→blue); pagination Prev disabled at `page===1`, Next disabled at `page===totalPages`; `loadFailed` inline error banner on fetch reject; empty state when `!loading && events.length===0`.
5. **Create/Edit behaviours pinned (manual `useState` forms — NOT RHF+Zod today):** required-field set + `isAllDay`/`registrationRequired`/`cost` conditional fields; tags comma-split→trim→filter; date→ISO-UTC conversion on submit; create `POST /api/v1/events` → `router.push("/events/{id}")`; edit `PUT /api/v1/events/{id}` → `router.push("/events/{id}")`; `createFailed`/`updateFailed`/`networkError`/`notFound`/`loadFailed` error surfaces (A76). Edit's data-load skeleton + full-page error view (when load fails with no `formData.title`).
6. **Detail behaviours pinned (the page is MIXED — raw `fetch` for the event + `@/lib/services/events` fns for registrations):** 404 → not-found view, other load error → full-page error view; publish/unpublish/cancel `POST /api/v1/events/{id}/{publish|unpublish|cancel}`; cancel + delete + cancel-registration dialogs; delete (admin) → `router.push("/events")`; the manager registration-stats + waitlist sections (`promoteFromWaitlist`, `promoteFailed`); the **member-facing** registration section (`getMyRegistrations` filter, `registerForEvent`, guest count, `registrationFailed`). Assert at the outcome level (call fired + state/nav), not internal wiring.
7. **Check-in behaviours pinned exactly (A76 — the richest failure surface):** scanner/manual tabs; the camera probe (`navigator.mediaDevices.getUserMedia`) with auto-flip to manual on unavailability (`cameraState` probing→available/unavailable); the dynamic `@yudiel/react-qr-scanner` import stays SSR-guarded; the 250 ms manual-search debounce; client-side roster filter by name; QR token dedupe via `lastScannedToken`; `refreshKey`-keyed roster reload after a successful check-in; `checkInByQrCode`/`manualCheckIn`/`getEventCheckInRoster` calls; the outcome banners `CheckedIn` / `AlreadyCheckedIn` (+ `checkedInAt`) / `Conflict`→`cancelledConflict`/`waitlistedConflict` / `NotFound` / `networkError` (5xx or status 0) / `invalidQr` (token prefix); `scanAgain` reset (clears `networkError`/`lastScannedToken`); `actionInFlight` disabled state; `loadRosterFailed`.
8. **Fees / Registrations / Volunteers behaviours pinned:** fees — `getEventFeeCategories` load, RHF+Zod dialog (create/edit), `deactivateEventFeeCategory` via `confirm()`, `loadFailed`/`saveFailed`/`noCategories`, the Zurich-localtime ↔ UTC-ISO datetime conversion. Registrations — `pageSize=20`, status filter + search (page reset to 1), 7-stat cards, payment summary (REQ-022), per-status action buttons (Confirm/CheckIn/MarkNoShow/Revert*/Cancel), PDF + CSV export endpoints, `promoteFromWaitlist`, `loadFailed`. Volunteers — `getEventVolunteerRoles`/`getEventVolunteerShifts` parallel load, manual role-create form, RHF+Zod shift dialog (+ Zurich datetime conversion), `cancelVolunteerShift` with assignment-aware confirm copy, `refreshKey` reload, `loadFailed`/`saveFailed`.
9. **Error/empty/loading lifecycle pinned per page including failure paths** (A76): a data-load rejection renders the page's error surface (inline banner for list, full-page for detail/edit, denied/forbidden alerts where role-gated, `loadRosterFailed`/`loadFailed` for sub-pages); an empty result renders the empty state.

**Improvements:**

10. Harness follows A35/A46 (`// @vitest-environment jsdom` + `afterEach(cleanup)`), A64/A78 stable mocks for `useTranslations` (identity translator captured once), `useRouter`/`useParams` (stable objects), `useAuth` (mutated-in-place stable state object exposing `isAuthenticated`/`isLoading`/`isVorstand`/`isAdmin`/`roles`/`accessToken`), and wraps every `render` in a fresh `QueryClientProvider` (`{ queries: { retry: false }, mutations: { retry: false } }`) so the S2/S3 TanStack adopters need **no harness rework**.
11. Tests assert via i18n keys (identity translator returns the key), ARIA roles, fetch URLs, and navigation — **not** brittle display copy — so they survive the S2/S3 refactor unchanged.

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + harness spike (AC: all) — **DEC-1 below is load-bearing; resolve it first**
  - [x] On branch `refactor/frontend-feature-slice`; `src/features/events/` does NOT exist yet. **CORRECTION to the A56 spike:** the tree was NOT zero-tested — three partial specs pre-existed and pass at HEAD (`[id]/check-in/page.test.tsx` 4 tests, `[id]/fees/page.test.tsx` 5 tests, `[id]/registrations/page.payment.test.tsx` 1 test = 10 tests). They were retained (fees/payment untouched; check-in augmented). Net delta = +100 events tests (110 total over 9 spec files).
  - [x] **Pinned the data layer (confirmed NON-uniform exactly as predicted):** core (list/new/edit + detail event GET + publish/unpublish/cancel/delete) = raw `fetch` + `useAuth().accessToken`; sub-pages (check-in/fees/registrations/volunteers) + detail registration/waitlist = `@/lib/services/events`. Registrations page additionally uses `useApiClient().get` for the PDF/CSV export endpoints.
  - [x] **DEC-1 RESOLVED (HYBRID — see Debug Log / Completion Notes for the A43 record):** Option A (uniform global-`fetch` stub + `useAuth` token mock) for the raw-`fetch` CORE pages; Option B (`vi.mock("@/lib/services/events", …importActual)`) for the sub-pages + detail's registration/waitlist surface — matching the page's actual layer split. Sub-page service-mock specs flagged as the S3-updatable surface.
  - [x] Mocked the scanner dynamic import (`next/dynamic` stub wiring `onScan`/`onError` to hidden buttons so QR outcomes are drivable without a camera); stubbed `navigator.mediaDevices.getUserMedia` per check-in test; `vi.stubGlobal("confirm"/"alert", …)` + `vi.unstubAllGlobals()` in `afterEach`.
- [x] Task 1: List spec — `app/(dashboard)/events/page.test.tsx` (AC: 2, 3, 4, 9) — **20 tests**
  - [x] Auth spinner/login-redirect+no-fetch; Vorstand+Admin render; manage-affordances present/absent by role. `pageSize=12`; initial URL pinned as `?page=1&pageSize=12` (empty filters OMITTED — HEAD quirk); grid/list toggle; statistics gated + silent-ignore; pagination bounds; `loadFailed` banner (+ thrown-vs-!ok divergence pinned); empty state.
- [x] Task 2: Create + Edit specs — `…/events/new/page.test.tsx` (**9**), `…/events/[id]/edit/page.test.tsx` (**8**) (AC: 2, 5, 9)
  - [x] Forbidden alerts (no POST/PUT); conditional sections; tags comma-split/trim/filter; ISO-UTC conversion; create `POST` → `/events/{id}`; edit load skeleton + `PUT` → `/events/{id}`; `createFailed`/`updateFailed`/`networkError`/`notFound`/`loadFailed` surfaces; edit full-page error view + permission-gate ordering pinned.
- [x] Task 3: Detail spec — `app/(dashboard)/events/[id]/page.test.tsx` (AC: 2, 3, 6, 9) — **17 tests**
  - [x] auth skeleton/login-null; 404 not-found vs full-page error; manager action bar + admin-only delete; publish/unpublish/cancel POSTs; delete → `/events`; manager registration-stats + waitlist promote; member-facing register flow (mixed data layer pinned simultaneously; hidden `VolunteerSelfSignupSection` service caller captured).
- [x] Task 4: Check-in spec — `app/(dashboard)/events/[id]/check-in/page.test.tsx` (AC: 2, 3, 7, 9) — **28 tests** (4 pre-existing + 24 added)
  - [x] `canAccess` forbidden gating; scanner/manual tabs; camera probe auto-flip; 250 ms debounce + client filter; QR dedupe via `lastScannedToken`; `refreshKey` roster reload (and NO reload on failure); full outcome-banner matrix (`CheckedIn`/`AlreadyCheckedIn`+checkedInAt/`cancelledConflict`/`waitlistedConflict`/`NotFound`→`invalidQr`/`networkError`/`checkInFailed`); `scanAgain` reset; `actionInFlight` disabled; `loadRosterFailed`.
- [x] Task 5: Fees + Registrations + Volunteers specs (AC: 2, 3, 8, 9)
  - [x] Fees (**5 pre-existing, retained**): load, RHF+Zod dialog, `confirm()`-deactivate, `noCategories`. Registrations (**12 new** + 1 pre-existing payment): `pageSize=20`, filter→page-reset, 7 stat cards, per-status actions, PDF/CSV export, promote, `loadFailed`. Volunteers (**10 new**): parallel role/shift load, manual role form, RHF+Zod shift dialog + Zurich→UTC conversion, assignment-aware delete confirm, `loadFailed`/`saveFailed`.
- [x] Task 6: Green-at-HEAD + DoD gate (AC: 1, 10, 11)
  - [x] `npx vitest run "src/app/(dashboard)/events"` → **110 passed (9 files)**; full suite **581 passed (77 files)**, no regressions; `npx tsc --noEmit` clean; `npx eslint <new/changed test files>` clean; `npx prettier --write` applied to new files (LF). Spec counts + HEAD quirks recorded in Completion Notes.

## Dev Notes

This is the regression net that gates the entire E24 epic — the equivalent of E21-S2/E23-S1 for Events. Write it against the **current god-pages** (raw-`fetch` core + `events.ts`-service sub-pages, manual-`useState` core forms, RHF+Zod fees/volunteer-shift dialogs, `confirm()`/`alert()` for delete/deactivate), pin actual behaviour, and keep it green at HEAD before any extraction. Mirror the proven `frontend/src/app/members/page.test.tsx` (list/auth/pagination) and `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations/`vi.stubGlobal("alert")`) harnesses, and the E23-S1 three-sub-harness discipline.

### Scope Boundaries

- In scope: new `*.test.tsx` files colocated with each of the 8 route pages; the shared mock/harness conventions; the Task-0 DEC-1 resolution.
- Out of scope: any production-code change (this is test-only); creating `features/events/` (that is S2/S3); i18n changes; touching the suppliers/sponsors/members slices; any `(dashboard)` route-group move.

### Architecture Guardrails

- **The data layer is NOT uniform** (the load-bearing A56 finding): core pages do raw `fetch`+`useAuth.accessToken`; sub-pages + detail registrations go through `@/lib/services/events`→`api.ts`→`fetch` with a `next-auth getSession()` token. DEC-1 Option A (uniform `fetch` stub + `next-auth/react` session mock) makes the net survive both S2 and S3 unchanged; that is why pinning at the **fetch-URL / rendered-text / navigation** level (AC-11) matters.
- Wrap every render in `QueryClientProvider` even though the god-pages don't use TanStack yet — the forward-compat seam (AC-10) so S2/S3 reuse the same specs without harness churn.
- A64/A78: mocked hooks MUST return stable references (define once, mutate fields per-test). The list keeps `searchTerm`/filters in effect deps and the detail/sub-pages key reloads on `refreshKey`; a fresh translator/router/auth/client per render would re-fire effects and loop.
- Assert via keys/roles/fetch-URLs/navigation (AC-11), never display copy.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run`. NEVER `npm run format` (prettier-tailwind re-sorts repo-wide) and never repo-wide lint/format as the gate (A58/A72). New test files may be `prettier --write` (they are new, not pre-drifted). Keep files LF (A73).

### A76/A79 note on delete/deactivate + form mechanism (cross-story)

S1 pins the **current** `confirm()`-gated detail delete + fees `confirm()`-deactivate and the manual-`useState` create/edit forms. S2 will migrate the core forms to the E22 RHF+Zod sub-recipe and may route delete through the slice `DeleteDialog` — intended A79 deltas. Write delete/deactivate + submit assertions at the **outcome** level (DELETE/POST/PUT fires after confirmation; navigation/refresh happens; failure is surfaced) so the mechanism can change under a still-green net. Flag in Completion Notes that the *mechanism-level* form/delete tests are the surface S2/S3 are licensed to update; everything else must stay green through the migration.

### Testing Requirements

- Vitest + Testing Library; `// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)` (A35/A46) on every render-based spec.
- Check-in spec stubs `navigator.mediaDevices.getUserMedia` and mocks the dynamic `@yudiel/react-qr-scanner` import; detail/fees specs stub `window.confirm`/`window.alert`; reset with `vi.unstubAllGlobals()` in `afterEach`.
- The check-in outcome-banner matrix (`CheckedIn`/`AlreadyCheckedIn`/`Conflict`×2/`NotFound`/`networkError`/`invalidQr`) + the token-dedupe (`lastScannedToken`) are the load-bearing assertions.

### Project Structure Notes

- Target tree (test-only): `app/(dashboard)/events/page.test.tsx`, `…/events/new/page.test.tsx`, `…/events/[id]/page.test.tsx`, `…/events/[id]/edit/page.test.tsx`, `…/events/[id]/check-in/page.test.tsx`, `…/events/[id]/fees/page.test.tsx`, `…/events/[id]/registrations/page.test.tsx`, `…/events/[id]/volunteers/page.test.tsx`.

### References

- Harness templates: `frontend/src/app/members/page.test.tsx` (list/auth/pagination), `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations, `vi.stubGlobal("alert", …)`), `frontend/src/features/sponsors/components/sponsor-form.test.tsx` (RHF+Zod form unit).
- Pages under test (all under `frontend/src/app/(dashboard)/events/`): `page.tsx` (list — auth/fetch effect :110-193; `statusColors` :52-57; `pageSize=12` :121; 300 ms debounce :188; pagination :533-547), `new/page.tsx` (forbidden :88-110; manual form; submit POST :165 → push :176), `[id]/page.tsx` (detail — skeleton :402-416; raw event fetch :146; service registration calls :184-248; publish/unpublish/cancel :302-354; delete :558-565; member registration :698-783; waitlist :872-931), `[id]/edit/page.tsx` (load :93/:153; forbidden :332-353; PUT :263 → push :273), `[id]/check-in/page.tsx` (scanner dynamic import :32-35; camera probe :77-103; QR decode + `lastScannedToken` :144-174; banners :268-318; manual debounce :106-109; roster filter :130-135), `[id]/fees/page.tsx` (RHF+Zod dialog :117-375; Zurich conversion :65-99; deactivate :476-489), `[id]/registrations/page.tsx` (`pageSize=20` :84; stats :426-481; payment summary :484-526; actions :666-743; export :339-383), `[id]/volunteers/page.tsx` (role form :506-540; RHF+Zod shift dialog :118-305; delete confirm :436-456).
- `frontend/src/lib/services/events.ts` (the ~878-line service the sub-pages consume; DTOs `EventDto`/`EventStatistics`/`CheckInResultDto`/`EventCheckInRosterDto`/registration/volunteer/fee DTOs; label/colour helpers `formatEventDate`/`getStatus*`).
- `frontend/src/lib/services/api.ts` (`ApiResult<T>` `{success,data,error?,errorBody?,status?}`; token via dynamic `import("next-auth/react").getSession()`).
- `frontend/src/lib/auth.ts` (`useApiClient` `{data,error,status}` contract — the layer S2/S3 migrate TO; reads token via `useSession()`).
- `frontend/messages/messages.parity.test.ts` (pure-Node parity example — no jsdom, A46).
- project-context.md A34/A35/A46/A56/A58/A64/A72/A73/A76/A78/A79; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)"; E23-S1 (`e23-s1-members-characterization-tests.md`) for the three-sub-harness precedent.

## Validation Notes

- Created 2026-06-08 as part of the whole-epic E24 preparation (front-loaded batch per A34). Status ready-for-dev. Test-only; must be green at HEAD before E24-S2 begins. The non-uniform data layer (raw `fetch` core vs `events.ts`-service sub-pages vs the future `useApiClient` slice) is the load-bearing A56 result, captured as DEC-1 with a recommended uniform-`fetch`-stub option so the net survives both extractions unchanged.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story orchestration + 5 parallel general-purpose sub-agents, one per spec cluster).

### Debug Log References

**DEC-1 resolution (per A43):**
- (a) **Decision:** HYBRID harness. Option A (stub global `fetch` + mock `@/lib/auth` `useAuth` with a stable `accessToken`) for the raw-`fetch` CORE pages (list / new / edit / detail's event GET + publish/unpublish/cancel/delete). Option B (`vi.mock("@/lib/services/events", …importActual)`) for the SUB-PAGES (check-in/fees/registrations/volunteers) and the detail page's registration/waitlist surface. The registrations export endpoints additionally needed a stable `useApiClient().get` spy.
- (b) **Rationale:** the data layer is genuinely non-uniform; mocking each page at the layer it actually uses keeps assertions ergonomic and the specs readable. Core assertions (fetch URL + method + `Authorization` header + navigation) survive S2's `useApiClient` migration unchanged because both bottom out at `fetch`/URL-level checks. The recommended pure-Option-A (also stubbing `next-auth getSession` so the service path hits the same `fetch`) was viable but would have made sub-page outcome assertions express awkward `ApiResult` JSON through raw `fetch`; the service mock is clearer.
- (c) **Cost / alternative flagged:** the sub-page service-mock specs are the surface S3 is *licensed to update* — when S3 repoints sub-pages from `@/lib/services/events` to the slice `events-api`/`useApiClient`, those `vi.mock("@/lib/services/events")` factories stop intercepting and must be re-pointed (the calls' URLs/outcomes don't change, only the mock target). Flagged here and in Completion Notes so S3 expects it. The CORE specs (list/new/edit/detail) and the check-in banner matrix are layer-agnostic and must stay green through both S2 and S3.

### Completion Notes List

- **110 events tests green at HEAD** across 9 spec files (no production code touched). Full frontend suite: **581 passed / 77 files**, no regressions (was 481 pre-E24 per E23 retro; +100 net new — the 10 pre-existing events tests are counted in both). `tsc --noEmit` clean, `eslint` clean on all new/changed files, `prettier --write` applied (LF).
- **A56 spike correction:** the events tree was NOT zero-tested. Pre-existing & retained: `fees/page.test.tsx` (5) and `registrations/page.payment.test.tsx` (1) untouched; `check-in/page.test.tsx` (4) augmented to 28.
- **HEAD behaviour quirks pinned (characterized, NOT fixed):**
  1. List initial fetch URL is `…/api/v1/events?page=1&pageSize=12` — empty `search`/`status`/`category` are NOT appended (the AC's idealized `&search=&status=&category=` string does not occur).
  2. List error paths diverge: `!response.ok` → `errors.loadFailed`; a *thrown/rejected* fetch → the raw `Error.message` (not the `loadFailed` key).
  3. Edit page has a dead `loadEvent` useCallback (never invoked; load runs in the effect, gated on `accessToken`); permission-gate ordering is load→error-view→permission→form, so a non-manager only sees the forbidden view after a successful GET.
  4. Detail dialogs are hand-rolled fixed-overlay divs (NOT the Radix `@/components/ui/dialog`); confirm buttons reuse the action-bar i18n label. The always-rendered `VolunteerSelfSignupSection` child is a hidden third service caller (`getEventVolunteerShifts`) that must be mocked or it hits the real `apiGet`.
  5. Volunteers + registrations have effectively-unreachable `permissionDenied`/login-redirect branches: the load effect bails early WITHOUT clearing `loading`, pinning the skeleton. Tests assert the observable outcome (skeleton + no service call), not the dead copy. **Candidate cleanup for S3.**
  6. Tags input on new/edit has `id="tags"` but no `name` attribute.
  7. Zurich→UTC datetime conversion pinned exactly (e.g. `2026-07-01T12:00` CEST → `2026-07-01T10:00:00.000Z`).
- **A76/A79 cross-story flag:** the *mechanism-level* assertions (manual-`useState` create/edit forms; `confirm()`-gated detail delete + fees deactivate) are written at the OUTCOME level (POST/PUT/DELETE fires + nav/refresh + failure surfaced) so S2's RHF+Zod form migration and any slice `DeleteDialog` reroute keep the net green. These + the sub-page service mocks are the only S2/S3-updatable surfaces; everything else (auth gating, fetch URLs, navigation, banner matrix) must stay green verbatim.
- **Forward-compat seam (AC-10/11):** every render is wrapped in a fresh `QueryClientProvider` (retry:false) and all assertions go via i18n keys / ARIA roles / fetch URLs / navigation — so the S2/S3 TanStack adopters need no harness rework.

### File List

**New (test-only):**
- `frontend/src/app/(dashboard)/events/page.test.tsx`
- `frontend/src/app/(dashboard)/events/new/page.test.tsx`
- `frontend/src/app/(dashboard)/events/[id]/edit/page.test.tsx`
- `frontend/src/app/(dashboard)/events/[id]/page.test.tsx`
- `frontend/src/app/(dashboard)/events/[id]/volunteers/page.test.tsx`
- `frontend/src/app/(dashboard)/events/[id]/registrations/page.test.tsx`

**Modified (test-only, augmented):**
- `frontend/src/app/(dashboard)/events/[id]/check-in/page.test.tsx` (4 → 28 tests)

**Pre-existing, retained untouched (part of the net):**
- `frontend/src/app/(dashboard)/events/[id]/fees/page.test.tsx` (5)
- `frontend/src/app/(dashboard)/events/[id]/registrations/page.payment.test.tsx` (1)

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e24-s1 → review).

## Change Log

- 2026-06-08: Story created (characterization net over all 8 Events pages; non-uniform data layer pinned as DEC-1 with a recommended uniform-`fetch`-stub harness). Status ready-for-dev.
- 2026-06-08: Implemented. DEC-1 resolved as a HYBRID harness (Option A for raw-`fetch` core pages, Option B service mock for sub-pages + detail registrations). 100 new events tests authored (110 total / 9 files); full suite 581 green, tsc/eslint clean. HEAD quirks pinned (not fixed). Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-08

**Outcome: Approved.** Epic-24 reviewed at the epic boundary (3 adversarial layers). No High/Med blockers for S1. The characterization net is faithful and assertions are key/role/URL-based (AC-11). One coverage follow-up (non-blocking, logged in `deferred-work.md`):

- [ ] [Review][Defer] E24-CR7 [Low/Med] 300ms list search debounce not pinned at the page level (positive filter-param wiring is covered at the api-unit level). Add a fake-timer page test to fully close S1 AC-4.
