# Story E29.S1: Smaller Features — Characterization Tests for Documents, Board Documents, and Profile (Regression Net)

Status: done

Depends on: E21-S3 + E21-S5 (closed), the E22 RHF+Zod form sub-recipe (closed), E23 + E24 (closed — their slice recipe + characterization harness are the templates). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract, DEC-2 status/destructive colours). **Blocks E29-S2 (Documents), E29-S3 (Board Documents), E29-S4 (Profile)** — each requires this net green at HEAD.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer about to migrate five un-slice'd small-feature pages,
I want a pinned characterization-test net over the Documents, Board Documents (list + detail), Profile, and Profile Security pages,
so that the E29-S2/S3/S4 slice extractions can prove behaviour was preserved against a green baseline.

## Acceptance Criteria

**Behaviour preserved (test-only story — no production code changes; all E29-S1 tests stay green at HEAD):**

1. Tests cover all **5** pages: `app/documents/page.tsx` (member document browser), `app/board/documents/page.tsx` (board list), `app/board/documents/[id]/page.tsx` (board detail), `app/profile/page.tsx`, `app/profile/security/page.tsx`.

2. **Auth guards pinned per page (the guards are NOT uniform — pin each page's actual shape):**
   - **Documents** (`documents/page.tsx:40-44`): `authLoading` → centred spinner; `!isAuthenticated` → `router.push("/login")`. **No role gate** — every authenticated user may browse (REQ-034). The data-load effect must not fire before auth settles.
   - **Board list** (`board/documents/page.tsx:62-65`) and **Board detail** (`board/documents/[id]/page.tsx:53-56`): identical hard role gate — `if (!authLoading && (!isAuthenticated || (!isVorstand && !isAdmin))) router.push("/")`. **Vorstand OR Admin only** — this is the load-bearing behavioural invariant (must NOT widen/narrow). Pin that a Member-only authenticated user is redirected and triggers no list/detail fetch.
   - **Profile** (`profile/page.tsx:149-159`): `!isAuthenticated` → `router.push("/login")`; authenticated-but-`!isMember` → `router.push("/")`; member with a `GET /members/me` **404** → the no-member-record view (`profile/page.tsx:243-276`) with the `isAdmin||isVorstand` message + `/admin` link vs the plain member message, and always a `/profile/security` link.
   - **Profile Security** (`profile/security/page.tsx:82-86`): `!isAuthenticated` → `router.push("/login")`; no member-status check (any authenticated user can view their sessions).

3. **Role-gated affordances asserted present/absent** (A76 — affordance gating): the board list/detail render the forbidden/redirect surface for a Member-only authenticated user and fire no fetch; the board status-action buttons (Mark-Reviewed / Publish / Archive) and Delete render only for the Vorstand/Admin gate.

4. **Documents page behaviours pinned** (`documents/page.tsx`): `pageSize=20`; server-side `search` (resets `page→1`), `folderId`, single-`tags` (string, NOT array) filters wired onto `getDocuments(...)`; folder navigation into (`navigateToFolder` :90-94) / up (`navigateUp` :96-104) / root (`navigateToRoot` :106-110) and the breadcrumb (last item text-only, earlier items clickable, :159-186); the up-button shows only when `currentPath.length>0`; pagination Prev/Next bounds; loading spinner (authLoading + `loading`); empty state when `!loading && documents.length===0` (:282-298); the parallel `getAllTags()` load; the **authenticated download** path (`handleDownload` :112-132 — dynamic `next-auth/react getSession()` → `fetch(getDownloadUrl(doc.id))` with `Authorization: Bearer` → `.blob()` → object-URL `<a download>` click → revoke) and the **download-error branch** that sets the error banner (A76 silent side-effect, :129-131).

5. **Board list behaviours pinned** (`board/documents/page.tsx`): search / status / category / folder filters (each resets `page→1`); pagination; folder navigation + breadcrumb; the **upload modal** (:271-397 — `FormData` name/folderId/category/description/tags via raw `fetch` + `getSession()` token; success resets the form + refetches `fetchData()`; `uploadError` on failure); the **upload button disabled when no folder selected** (:238) + the `selectFolderFirst` on-submit error (:116); **status-change actions** `reviewDocument`/`publishDocument`/`archiveDocument` conditional on `doc.status` (success refetch + `statusChanged`/`statusChangeError`); **delete** via the confirm dialog (`deleteDocument` → refetch + `deleteSuccess`/`deleteError`); row → `router.push("/board/documents/{id}")` (:645); loading/empty/`loadError` states.

6. **Board detail behaviours pinned** (`board/documents/[id]/page.tsx`): `getDocumentById` load; **404/not-found view** (:185-191; pin that the current fallback string `"Document not found"` :65 is the HEAD behaviour — characterize, do NOT i18n-fix here); header + status badge + metadata grid (category/size/date de-CH/content-type); **download current + per-version** (`handleDownload` :152-172 → blob anchor; `downloadError` branch — A76); **tag edit** toggle + `updateDocumentTags` save → refetch (:136-150); **version-upload modal** (`FormData` file+comment → refetch; `uploadError`); **status transitions** conditional on `document.status`; **version history** list (latest highlighted; Restore on non-latest → confirm modal → `restoreVersion` → refetch :124-134); the success/error toast **auto-dismiss after 3000 ms** (:85/116/130/146/171).

7. **Profile behaviours pinned** (`profile/page.tsx`): `GET /api/v1/members/me` (raw `fetch` + `useAuth().accessToken` :80) load + skeleton; view↔edit toggle (:45/311-331/391-679); the edit form field set (`firstName`/`lastName`/`street`/`postalCode`/`city` HTML5-required, `phone`/`country` optional — :414/431/480/500/519/455/534); `PUT /api/v1/members/me` submit (:183-190 — `saving` flag; success closes edit + updates `member`; error sets the banner + stays in edit, :201); Cancel resets `formData` (:212-226). **Consent (A76 — three branches, load-bearing):** load via `getConsents` (silent empty-catch failure, `profile/page.tsx:120-122`); grant/revoke toggle (`handleConsentToggle` :125-147) → **success** message + **3000 ms auto-dismiss** (:140-141) vs **explicit error** message with **no timer** (:142-143). **Channel-preferences card** render/load/change (see `ChannelPreferencesCard`).

8. **Profile Security behaviours pinned** (`profile/security/page.tsx`): `getMySessions(token)` load (best-effort — empty list on error, no error surface, :42-57); the session-list render (ipAddress fallback, `start`/`lastAccess` via `formatDateTime` :15-26, `clients[]` badges); empty state `noSessions` (:165-168); **revoke session** (`handleRevoke` :63-76 — `window.confirm(revokeConfirm)` → `revokeMySession` → optimistic remove from the list + success message **auto-dismiss 4000 ms** (:76); error message no-timer; `revokingSessionId` disables the button). Revoke is the **only** mutating action — there is no device-change action; pin exactly what ships.

9. **Error/empty/loading lifecycle pinned per page including failure paths** (A76): a data-load rejection renders each page's actual error surface (inline banner for documents/board-list `loadError`; full-page/not-found for board-detail; the silent-empty path for profile-security load; the consent silent-vs-explicit split for profile); empty results render the empty state.

**Improvements:**

10. Harness follows A35/A46 (`// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)`), A64/A78 stable mocks for `useTranslations` (identity translator captured once), `useRouter` (stable object), `useAuth` (mutated-in-place stable state exposing `isAuthenticated`/`isLoading`/`isVorstand`/`isAdmin`/`accessToken`), and wraps **every** render in a fresh `QueryClientProvider` (`{ queries: { retry: false }, mutations: { retry: false } }`) so the S2/S3/S4 TanStack adopters need no harness rework. Pure-Node specs (none expected here) would skip jsdom per A46.

11. Tests assert via **i18n keys** (identity translator returns the key), ARIA roles, service-fn call args / `fetch` URLs, and navigation — **not** brittle display copy — so they survive the S2/S3/S4 refactor unchanged. The suite records (A79) that a `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas that S2/S3/S4 must decide on explicitly.

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + harness spike (AC: all) — **DEC-1 (mock strategy) is load-bearing; resolve it first**
  - [x] On branch `refactor/frontend-feature-slice`; confirmed `src/features/{documents,board-documents,profile}/` do NOT exist yet. Re-read the five pages + `lib/services/documents.ts` + `lib/api/privacy.ts` + `lib/api/users.ts` + `lib/services/api.ts` (A56).
  - [x] **A56 correction confirmed:** `app/profile/ChannelPreferencesCard.test.tsx` ALREADY exists (3 tests) — retained untouched + verified still 3/3 green after the new profile spec. Net delta = +5 new spec files / +106 tests.
  - [x] **DEC-1 RESOLVED → A (layer-matched hybrid mocks):** `vi.mock("@/lib/services/documents", …importActual)` (keeps real enums/helpers like `formatFileSize`) for documents + board pages; `vi.mock("@/lib/api/privacy")` for profile consent/channel; `vi.mock("@/lib/api/users")` for security; `vi.mock("@/lib/auth")` returning a stable `useAuth`; `vi.stubGlobal("fetch")` for the raw-fetch surfaces (profile GET/PUT /members/me, blob downloads, board FormData upload) + `vi.mock("next-auth/react")` `getSession` for the download token path; `vi.stubGlobal("confirm")` + `vi.unstubAllGlobals()` in `afterEach` for board delete + session revoke + restore. See Debug Log for the A43 (a)/(b)/(c) record.
- [x] Task 1: Documents spec — `app/documents/page.test.tsx` (AC: 2, 4, 9, 10, 11) — **21 tests**
  - [x] Auth spinner/login-redirect+no-fetch; `pageSize=20`; search→page-reset + folderId + single-tag STRING filter on `getDocuments`; folder nav into/up/root + breadcrumb; up-button visibility; pagination bounds; loading/empty/`loadError`; download success (`getDownloadUrl`→`getSession`→`fetch` blob→object-URL anchor) + download-error banner (A76).
- [x] Task 2: Board list spec — `app/board/documents/page.test.tsx` (AC: 2, 3, 5, 9, 10, 11) — **33 tests**
  - [x] Vorstand/Admin-only gate (Member redirected); search/status/category/folder filters→page-reset; pagination; folder nav + breadcrumb; upload modal `FormData` + success-refetch + `uploadError`; upload-disabled-without-folder + `selectFolderFirst`; status actions gated by `doc.status` + refetch + `statusChanged`/`statusChangeError`; delete confirm → refetch + `deleteSuccess`/`deleteError`; row→detail nav; loading/empty/`loadError`.
- [x] Task 3: Board detail spec — `app/board/documents/[id]/page.test.tsx` (AC: 2, 3, 6, 9, 10, 11) — **22 tests**
  - [x] Vorstand/Admin gate; `getDocumentById` load; 404/not-found VIEW renders `documents.notFound` key (hardcoded `"Document not found"` lands only in `error` state — pinned the split); metadata grid; download current + per-version + `downloadError`; tag edit toggle + save→refetch; version-upload modal→refetch + `uploadError`; status transitions (Draft→Review+Publish, Reviewed→Publish+Archive, Published→Archive); version history (latest highlight, restore non-latest → confirm → refetch); toast auto-dismiss 3000 ms (fake timers).
- [x] Task 4: Profile spec — `app/profile/page.test.tsx` (AC: 2, 7, 9, 10, 11) — **18 tests**
  - [x] login/`/`/no-record guard matrix (admin-vs-member 404 message + `/admin`-link presence/absence + always-`/profile/security` link, 3 tests); `/members/me` load skeleton + 500-notice; view↔edit toggle; required/optional field set; `PUT` submit success (close+update, error-precedence `errorData.message`→`error.savingError`) + error (banner+stay-in-edit) + Cancel reset; **consent three branches** (silent load failure; success+3 s auto-dismiss; explicit error no-timer — fake timers); channel-prefs card present (internals deferred to existing `ChannelPreferencesCard.test.tsx`, still 3/3 green).
- [x] Task 5: Profile Security spec — `app/profile/security/page.test.tsx` (AC: 2, 8, 9, 10, 11) — **12 tests**
  - [x] login guard (no member check); `getMySessions` load; session render (ip fallback / `formatDateTime` / client badges); `noSessions` empty state; **HEAD divergence pinned (see Completion Notes): load failure is NOT silent — it sets an `error` alert banner** (page.tsx:49-56); revoke flow (`confirm` → `revokeMySession(token,id)` → optimistic removal + success → 4 s auto-dismiss via setTimeout spy; declined-confirm short-circuit; error → message + row persists; button-disabled while revoking).
- [x] Task 6: Green-at-HEAD + DoD gate (AC: 1, 10, 11)
  - [x] `npx vitest run` full suite **765 passed / 91 files** (was 659/86 at HEAD → +106 / +5 files, zero regressions); `npx tsc --noEmit` clean; `npx eslint <5 new specs>` exit 0; `npx prettier --check <5 new specs>` clean (LF). Per-page counts + HEAD quirks recorded in Completion Notes.

## Dev Notes

This is the regression net that gates the entire E29 epic — the Documents/Board/Profile equivalent of E21-S2 / E23-S1 / E24-S1. Write it against the **current god-pages** (raw `fetch` + `lib/services/documents` + `lib/api/privacy`/`lib/api/users`, manual `useState`, `window.confirm` for delete/revoke/restore, `setTimeout` toasts), pin actual behaviour, keep it green at HEAD before any extraction. Mirror the proven `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations/`vi.stubGlobal("alert")`) + `frontend/src/app/members/page.test.tsx` (list/auth/pagination) harnesses and the E24-S1 hybrid-mock discipline.

### Scope Boundaries

- In scope: five new `*.test.tsx` files colocated with the route pages; the shared mock/harness conventions; the Task-0 DEC-1 resolution.
- Out of scope: any production-code change (test-only); creating `features/{documents,board-documents,profile}/` (that is S2/S3/S4); i18n changes; touching the suppliers/sponsors/members/events slices; the existing `ChannelPreferencesCard.test.tsx` (retain untouched).

### Architecture Guardrails

- **The data layer is NOT uniform** (load-bearing A56 finding): Documents + Board pages call `@/lib/services/documents` (which wraps `@/lib/services/api` `apiGet/Post/Put/Delete` — token via dynamic `getSession()`), plus **raw `fetch`** for downloads (all three) and uploads (board); Profile uses **raw `fetch` + `useAuth().accessToken`** for `/members/me` and `@/lib/api/privacy` for consent/channel; Profile-Security uses `@/lib/api/users`. DEC-1's layer-matched hybrid makes the net survive S2/S3/S4 unchanged; that is why pinning at the **service-call-args / fetch-URL / rendered-key / navigation** level (AC-11) matters.
- Wrap every render in `QueryClientProvider` even though the god-pages don't use TanStack yet — the forward-compat seam (AC-10) so S2/S3/S4 reuse the same specs without harness churn.
- A64/A78: mocked hooks MUST return stable references (define once, mutate fields per-test). The documents page keeps `searchTerm`/filters + `t` in effect deps (:74/:88); the board pages key reloads on refetch; profile/security key on `accessToken`/`isMember` — a fresh translator/router/auth per render would re-fire effects and loop.
- Assert via keys/roles/service-args/fetch-URLs/navigation (AC-11), never display copy.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run`. NEVER `npm run format` (prettier-tailwind re-sorts repo-wide) and never repo-wide lint/format as the gate (A58/A72). New test files may be `prettier --write` (they are new, not pre-drifted). Keep files LF (A73).

### A76/A79 note on the silent side-effect branches (the bug-magnet surface)

Pin these explicitly because a manual→TanStack/Radix refactor most easily drops them (the E21 P2/P3 + A76/A80 class):
- **Documents/Board download-error** sets the error banner but does NOT block re-trigger (no disabled state) — assert the banner appears, at the outcome level.
- **Profile consent** has THREE distinct branches — silent load failure (empty catch), success-with-3 s-timer, explicit-error-no-timer. Assert all three; they are the A76 load-bearing assertions for S4.
- **Session revoke** does an **optimistic** list removal before the network settles + a 4 s success timer; pin the optimistic removal + the error path.
Write delete/revoke/restore/submit assertions at the **outcome** level (confirm → mutation fires → list/nav/refresh + failure surfaced) so S2/S3/S4 can change the mechanism (Radix dialog, RHF+Zod form, TanStack mutation) under a still-green net. Flag in Completion Notes that the *mechanism-level* assertions are the surface S2/S3/S4 are licensed to update; everything else must stay green verbatim.

### Cross-story note — shared `documents.*` namespace + `lib/services/documents.ts` (A62)

`/documents` (S2) and `/board/documents` (S3) share the SAME `documents.*` i18n namespace AND the SAME `@/lib/services/documents` module. Neither slice may rename/remove a shared `documents.*` key nor break a shared service function. This net pins both surfaces so a shared-key/shared-service change that regresses the sibling page is caught immediately. (S3's Task 0 re-verifies what S2 actually shipped before depending on it — a sibling DEC is not a delivered contract.)

### Testing Requirements

- Vitest + Testing Library; `// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)` on every render-based spec.
- Stub `navigator`-free here (no camera); stub `window.confirm` for board delete + session revoke + version restore; `vi.unstubAllGlobals()` in `afterEach`.
- The consent three-branch matrix (silent/success-timer/explicit-error) + the board Vorstand/Admin gate + the session optimistic-removal are the load-bearing assertions.

### Project Structure Notes

- Target tree (test-only): `app/documents/page.test.tsx`, `app/board/documents/page.test.tsx`, `app/board/documents/[id]/page.test.tsx`, `app/profile/page.test.tsx`, `app/profile/security/page.test.tsx`. (`app/profile/ChannelPreferencesCard.test.tsx` already exists — leave untouched.)

### References

- Harness templates: `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations, `vi.stubGlobal("alert", …)`), `frontend/src/app/members/page.test.tsx` (list/auth/pagination + `vi.unstubAllGlobals()`), `frontend/src/app/profile/ChannelPreferencesCard.test.tsx` (existing card unit).
- Pages under test: `frontend/src/app/documents/page.tsx` (guard :40-44; `getDocuments`/`getFolders`/`getAllTags` :46-74; `pageSize=20` :53; folder nav :90-110; breadcrumb :159-186; download :112-132); `frontend/src/app/board/documents/page.tsx` (guard :62-65; load :67-89; upload :134-151,271-397; status actions :157-190; delete; row→detail :645); `frontend/src/app/board/documents/[id]/page.tsx` (guard :53-56; `getDocumentById` :58-65; download :152-172; tags :136-150; version upload :102-118; restore :124-134; toasts auto-dismiss); `frontend/src/app/profile/page.tsx` (guard :149-159; `/members/me` :80-94,183-205; edit fields :414-534; consent :114-147); `frontend/src/app/profile/security/page.tsx` (guard :82-86; sessions :42-80; revoke :63-76).
- Services: `frontend/src/lib/services/documents.ts` (`getDocuments` :173-191, `getFolders` :135-140, `getAllTags` :237-239, `getDownloadUrl` :279-288, review/publish/archive/delete + `getDocumentById`/`restoreVersion`/`updateDocumentTags`); `frontend/src/lib/services/api.ts` (`ApiResult<T>` :10-23, token via dynamic `getSession()` :32-37); `frontend/src/lib/api/privacy.ts` (`getConsents`/`grantConsent`/`revokeConsent` :23-55, `getChannelPreference`/`updateChannelPreference` :57-97); `frontend/src/lib/api/users.ts` (`getMySessions` :357-371, `revokeMySession` :403-423, `UserSession` :53-59).
- `frontend/src/lib/auth.ts` (`useApiClient` `{data,error,status}` contract :169-295 — the layer S2/S3/S4 migrate TO; `useAuth` role flags).
- `frontend/messages/messages.parity.test.ts` (pure-Node parity example — no jsdom, A46).
- project-context.md A34/A35/A46/A56/A58/A62/A64/A72/A73/A76/A78/A79/A80; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)"; E24-S1 (`e24-s1-events-characterization-tests.md`) for the hybrid-mock precedent.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E29 preparation (front-loaded batch per A34). Status ready-for-dev. Test-only; must be green at HEAD before E29-S2/S3/S4 begin.
- **A56 spike divergences from the epic skeleton (recorded, do NOT regress the shipped implementation to match the AC literal):** (1) the epic E29 §S1 skeleton framed board documents as "list/detail, filter/search/pagination, download" — the SHIPPED board surface is far richer (upload modal + FormData, status workflow review/publish/archive, delete, version history + restore, tag editing) and this net must pin ALL of it. (2) Profile is NOT zero-tested — `ChannelPreferencesCard.test.tsx` exists (A56 correction). (3) Documents single-tag filter is a STRING not an array; `pageSize=20` (not 12). The non-uniform data layer (services + raw fetch + privacy/users APIs) is the load-bearing A56 result captured as DEC-1.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story orchestration + 4 parallel general-purpose sub-agents, one per page-cluster: documents / board list+detail / profile / profile-security).

### Debug Log References

**DEC-1 (characterization mock strategy) — per A43:**
- (a) **Decision:** A — layer-matched hybrid mocks. `vi.mock("@/lib/services/documents", …importActual)` for documents + board pages (keeps real enums/`formatFileSize`); `vi.mock("@/lib/api/privacy")` for profile consent/channel; `vi.mock("@/lib/api/users")` for security; stable `vi.mock("@/lib/auth")` `useAuth`; `vi.stubGlobal("fetch")` for the raw-fetch surfaces; `vi.mock("next-auth/react")` `getSession` for the download token path; `vi.stubGlobal("confirm")` + `vi.unstubAllGlobals()` in `afterEach`.
- (b) **Rationale:** the data layer is genuinely non-uniform (services + raw fetch + privacy/users modules); mocking each page at the layer it actually uses keeps assertions ergonomic and the specs readable; the user pre-declared autonomous mode ("für das ganze epic … ohne stop"); the story's DEC-1 recommended Option A.
- (c) **Consequence / cross-story note:** the service-mock targets + the mechanism-level assertions (in-component delete/restore confirm modals, raw-fetch FormData upload, the `getSession` token path, the RHF/manual form submit, the `setTimeout` toasts) are the surface S2/S3/S4 are **licensed to re-point** (A79). Two harness gotchas surfaced for the siblings: (1) the `@/lib/services/documents` mock needs `vi.hoisted` (factory references fns at eval time → TDZ otherwise); (2) the download-error branch must also `vi.doMock("next-auth/react")` or `getSession`'s internal `/api/auth/session` fetch rejection escapes as an unhandled error.

### Completion Notes List

- **+106 new tests across 5 new spec files; full suite 765 passed / 91 files** (was 659 / 86 at HEAD; zero regressions). `tsc --noEmit` clean; `eslint` exit 0 on all 5; `prettier --check` clean (LF). Per-file: documents 21, board list 33, board detail 22, profile 18, profile-security 12. Existing `ChannelPreferencesCard.test.tsx` (3) retained + verified still green.
- **HEAD quirks pinned (characterized, NOT fixed):**
  1. Documents: single-`tags` STRING (not array); initial URL omits empty `search`/`folderId`/`tags`; `pageSize=20`; no role gate (any authed user); search/tag change resets `page→1` even on page 2.
  2. Board detail: the 404/not-found VIEW renders the i18n key `documents.notFound`; the hardcoded `"Document not found"` string (`[id]/page.tsx:65`) only lands in the `error` STATE, not visibly — pinned the split (S3 may i18n-fix the state string).
  3. Board: toast 3000 ms auto-dismiss; upload button `disabled={!selectedFolder}`; `authLoading` does NOT gate the data-load effect (it keys on role flags) — the "no fetch" invariant holds only for the Member-only redirect cases.
  4. Profile: silent consent-load catch (no surface); consent success 3 s auto-dismiss vs explicit-error no-timer; the no-member-record admin/vorstand-vs-member branch (+`/admin` link) always shows the `/profile/security` link; PUT error precedence `errorData.message` → `error.savingError`.
  5. **Profile-security DIVERGENCE from the story AC-8 / spike (load-bearing for S4):** the AC said the `getMySessions` load failure is "best-effort — empty list on error, NO error surface". The SHIPPED code (`security/page.tsx:49-56`) DOES `setError(...)` in the catch → a `role="alert"` banner appears alongside the empty list. The spec pins the ACTUAL behaviour (empty-list + alert-banner, two tests). S4 must preserve the alert banner, not the (incorrect) "silent" AC wording. Also pinned: optimistic removal on revoke success; 4 s auto-dismiss; revoke is the ONLY mutating action (no device-change).
- **Forward-compat seam (AC-10/11):** every render wrapped in a fresh `QueryClientProvider` (retry:false); all assertions via i18n keys / ARIA roles / service-call args / fetch URLs / navigation — so the S2/S3/S4 TanStack adopters need no harness rework.

### File List

**New (test-only):**
- `frontend/src/app/documents/page.test.tsx`
- `frontend/src/app/board/documents/page.test.tsx`
- `frontend/src/app/board/documents/[id]/page.test.tsx`
- `frontend/src/app/profile/page.test.tsx`
- `frontend/src/app/profile/security/page.test.tsx`

**Untouched (part of the net, retained):** `frontend/src/app/profile/ChannelPreferencesCard.test.tsx` (3 tests).

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e29-s1 → review).

## Change Log

- 2026-06-12: Story created (characterization net over the 5 small-feature pages). Non-uniform data layer pinned as DEC-1 (layer-matched hybrid mocks). A56 divergences recorded. Status ready-for-dev.
- 2026-06-12: Implemented (4 parallel sub-agents). 106 new tests / 5 files; full suite 765 green / 91 files, zero regressions; tsc/eslint/prettier clean. DEC-1=A (layer-matched hybrid). HEAD quirks pinned incl. the profile-security load-failure-NOT-silent divergence (S4 must preserve the alert banner). Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-12

**Outcome: Approved.** Acceptance Auditor confirmed the characterization specs assert REAL behaviour (gates, guard matrix, consent three-branch, session optimistic-removal, both download-error surfaces) — none weakened or deleted to pass. The profile-security load-failure-NOT-silent divergence was correctly characterized (the net is the oracle, used to correct the S4 AC). No findings against S1. Full review: `epic-29-boundary-review-2026-06-12.md`.
