# Story E25.S1: Communication — Characterization Tests for All Twelve Pages (Regression Net)

Status: review

Depends on: E21-S3 + E21-S5 (closed), the E22 RHF+Zod form sub-recipe (closed), E23/E24/E29 (closed — their slice recipe + characterization harness are the templates). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract, DEC-2 status/destructive colours). **Blocks E25-S2 (Automations), E25-S3 (Email-campaigns), E25-S4 (Email-templates)** — each requires this net green at HEAD.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer about to refactor twelve un-slice'd Communication pages across three CRUD sub-modules with three different API clients,
I want a characterization test net that pins their current observable behaviour first,
so that the E25-S2/S3/S4 slice extractions are provably behaviour-preserving.

## Acceptance Criteria

**Behaviour preserved (test-only story — no production code changes; all E25-S1 tests stay green at HEAD):**

1. Tests cover all **12** pages under `app/communication/`: index (`page.tsx`); automations (`automations/page.tsx`, `automations/new/page.tsx`, `automations/[id]/page.tsx`, `automations/[id]/edit/page.tsx`); email-campaigns (`email-campaigns/page.tsx`, `email-campaigns/new/page.tsx`, `email-campaigns/[id]/page.tsx`, `email-campaigns/[id]/edit/page.tsx`); email-templates (`email-templates/page.tsx`, `email-templates/new/page.tsx`, `email-templates/[id]/page.tsx`).

2. **Auth guards pinned per page — the guards are NOT uniform (pin each page's actual shape):**
   - **Index** (`communication/page.tsx:82-89`): `authLoading` → spinner; `!isAuthenticated || (!isAdmin && !isVorstand)` → `router.push("/")` + returns null.
   - **Automations list** (`automations/page.tsx:68-72`): `!isAuthenticated` → `/login`; authenticated-but-`!isVorstand && !isAdmin` → `/`. (new/[id]/edit rely on the same `useAuth` gate; pin each page's actual guard.)
   - **Email-campaigns list/new/detail/edit** (`email-campaigns/page.tsx:74-81` + siblings): same Vorstand-OR-Admin gate (`/login` then `/`) with the post-load `return null` when unauthorized.
   - **Email-templates list** (`email-templates/page.tsx`): **NO redirect guard** — renders to any authenticated user; if no `accessToken` the load effect early-returns and the grid stays empty (pin this exactly). **new + [id]** (`new/page.tsx:39-54`, `[id]/page.tsx:62-77`): `!isAuthenticated || (!isAdmin && !isVorstand)` → **silent `return null`** (NOT a redirect — pin the silent-null, it differs from the other sub-modules).

3. **Automations behaviours pinned** (4 pages): list — `listAutomations(token,{page,pageSize,status})` load, server-side `?status=` filter, client-side search (name/templateName via `useMemo`), pagination (manual, shown only when `totalPages>1`), loading/error/empty, table render, status badge (`getStatusColor` → `bg-gray-100`/`green`/`yellow`/`red`), trigger label (`getTriggerLabel`), detail/New links. new/edit — the manual-`useState` `AutomationForm` (9 fields, manual `clientValidate` requiring name+templateId+offsetDays-when-time-relative+segmentFilter-when-MemberSegment), submit → `createAutomation`/`updateAutomation` → redirect `/communication/automations/{id}`, submit-error banner, the recipient `previewRecipients` action, the inline raw-`fetch` segment load (`/api/v1/member-segments/active` — a HEAD quirk). detail — `getAutomation` + `getExecutions` (silently degrades to "no runs yet" on executions error), lifecycle actions (activate/pause/resume/disable via `changeAutomationStatus`), Edit link only when `canEdit` (Vorstand/Admin AND status∈{Draft,Paused}), executions table.

4. **Email-campaigns behaviours pinned** (4 pages): list — inline-`fetch` load (`/api/v1/email-campaigns?page&pageSize&status`), server status filter, client search (name/subject/status/createdByName), pagination, loading/error/empty, table + status badge (`getStatusColor` Draft/Scheduled/Sending/Sent/Cancelled/Failed → gray/blue/yellow/green/orange/red) + per-row conditional edit/delete (Draft only) + statistics columns, delete (`confirm` → DELETE → refetch; error alert). new/edit — manual-`useState` form, template-load dropdown (`emailTemplatesApi.getAllTemplates`/`getTemplateById`), segment selection (incl. MemberSegment search + Custom), RichTextEditor/HtmlSourceEditor toggle, submit → POST/PUT → redirect; edit Draft-only guard. detail — parallel load (campaign + statistics + recipients), the **status state machine actions** per status: Draft→{Edit, Test-email modal, Schedule modal, Send-now (`confirm`)}, Scheduled→{Cancel (`confirm`)}, Sent→{Resend modal: all vs failed-only}; statistics grid (7 cards), DOMPurify email preview, recipients table + `getRecipientStatusColor`. Pin each detail action's endpoint + confirm + success(refetch)/error(alert) branch (A76).

5. **Email-templates behaviours pinned** (3 pages): list — `emailTemplatesApi.getAllTemplates(accessToken)` load, client-side search (name/description), loading/error/empty, **card-grid** render, category badge (`bg-gray-100 text-gray-800`) + inactive badge (`bg-gray-500 text-white`), edit link, **delete button (destructive/red affordance — A76) + native `confirm()` → `deleteTemplate` → `templates.filter` removal on success; the delete-FAILURE branch sets the error banner and the list is NOT mutated (item stays — correct)**. new/[id] — form render via `EmailTemplateForm` (manual `useState`, NOT RHF+Zod today; `template?` prop prefills; `onSave`/`isSaving` contract), required fields, submit → `createTemplate`/`updateTemplate` → success banner + 1.5 s redirect, submit-error banner. Note `EmailTemplate.id` is a **number**.

6. **Index page behaviours pinned** (`communication/page.tsx`): the guard + the three sub-module navigation cards (→ email-campaigns / email-templates / automations) + the two quick-action links (→ `{submodule}/new`).

7. **Error/empty/loading lifecycle pinned per page including failure paths** (A76): each page's actual error surface (inline banner / alert / silent-null), empty state, and the load/submit/delete failure branches — especially the email-templates delete-failure (the two regressions the green E21-S2 suite missed: destructive affordance + delete-failure).

**Improvements:**

8. Harness follows A35/A46 (`// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)` + `vi.unstubAllGlobals()`), A64/A78 stable mocks for `useTranslations` (identity translator), `useAuth` (mutated-in-place stable state), `useRouter`, and **the correct transport per sub-module** (DEC-1): mock `@/lib/api/automations` (token-fn module) for automations; stub global `fetch` (+ `next-auth getSession`) for the email-campaigns inline fetches; mock `@/lib/email-templates` (`emailTemplatesApi` object) for email-templates. Wrap every render in a fresh `QueryClientProvider` (`{queries:{retry:false},mutations:{retry:false}}`) so the S2/S3/S4 TanStack adopters need no harness rework.

9. Tests assert via i18n **keys** (identity translator returns the key), ARIA roles, service-call args / `fetch` URLs, and navigation — **not** display copy — so they survive the S2/S3/S4 refactor unchanged. The suite records (A79) that a `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas (and the A93 deterministic-404 retry), which S2/S3/S4 must decide on explicitly.

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + harness spike (AC: all) — **DEC-1 (per-sub-module mock strategy) is load-bearing; resolve it first**
  - [x] On branch `refactor/frontend-feature-slice`; confirmed `src/features/communication/` does NOT exist yet. Re-read the 12 pages + `lib/api/automations.ts` + `lib/api/email-campaigns.ts` (DTOs/helpers only) + `lib/email-templates.ts` + `types/email-templates.ts` + `components/email-templates/EmailTemplateForm.tsx` + `app/communication/automations/AutomationForm.tsx` (A56).
  - [x] **A56 correction (pin, don't assume zero-tested):** automations ALREADY has 2 tests — `automations/AutomationForm.test.tsx` + `automations/[id]/page.test.tsx` (+ `automations.i18n.test.ts`). Retained unchanged; added list/new/edit coverage. email-campaigns + email-templates had ZERO tests. Net delta: 11 new spec files + 3 retained.
  - [x] **DEC-1 RESOLVED → A (transport-matched hybrid mocks).** (a) **Option chosen:** A — one mock strategy per sub-module. (b) **Rationale:** the three sub-modules use three different transports (story A56 finding) so a single mock cannot intercept all; story-recommended A; user pre-declared autonomous mode ("das ganze epic implementieren mit allen stories. ohne stop"); keeping each transport's natural mock surface means S2/S3/S4 re-point only their own transport (A88/A94). (c) **Consequence chain:** automations → `vi.mock("@/lib/api/automations")` (importActual + override token-fns) + `vi.stubGlobal("fetch")` for the inline segment-load; email-campaigns → `vi.stubGlobal("fetch")` (pages fetch inline via `useAuth().accessToken` — NOT `getSession` as the story guessed) + `vi.mock("@/lib/email-templates")` (template dropdown) + editor-component stubs + `useAppSettings` mock; email-templates → `vi.mock("@/lib/email-templates")` (`emailTemplatesApi`) + `vi.stubGlobal("confirm")`. Stable `vi.mock("@/lib/auth")` for all guards. Every render wrapped in `QueryClientProvider` (retry:false) seam.
- [x] Task 1: Automations specs — added `automations/page.test.tsx` (list, 17) + `automations/new/page.test.tsx` (8) + `automations/[id]/edit/page.test.tsx` (6); retained `automations/[id]/page.test.tsx` (4) + `automations/AutomationForm.test.tsx` (5) + `automations.i18n.test.ts` (3) unchanged (AC: 2, 3, 7, 8, 9).
- [x] Task 2: Email-campaigns specs — `email-campaigns/page.test.tsx` (list, 22) + `new` (14) + `[id]` (detail, 26 — incl. the status-state-machine action matrix) + `[id]/edit` (13) (AC: 2, 4, 7, 8, 9). Stubbed `fetch` per action; pinned test/schedule/send/cancel/resend(+failed-only) endpoints + confirm + refetch/alert.
- [x] Task 3: Email-templates specs — `email-templates/page.test.tsx` (list, 13 — incl. destructive delete affordance + delete-success-removal + delete-FAILURE-list-unchanged + confirm-cancel A76 branches) + `new` (7) + `[id]` (7) (AC: 2, 5, 7, 8, 9).
- [x] Task 4: Index spec — `communication/page.test.tsx` (6, AC: 2, 6, 8, 9): guard + the 3 nav cards + 2 quick-action links.
- [x] Task 5: Green-at-HEAD + DoD gate (AC: 1, 8, 9): `npx vitest run src/app/communication` green (14 files / 151 tests); full `npx vitest run` green (112 files / 978 tests, no regressions — 839 E29-baseline + 139 new); `npx tsc --noEmit` clean (exit 0); `npx eslint <new specs>` clean; `npx prettier --write` new files (LF). Per-page spec counts + HEAD quirks recorded in Completion Notes.

## Dev Notes

This is the regression net that gates the entire E25 epic — the Communication equivalent of E21-S2 / E23-S1 / E24-S1 / E29-S1. Write it against the **current god-pages** across three sub-modules, pin actual behaviour, keep it green at HEAD before any extraction. Mirror `frontend/src/app/members/page.test.tsx` (list/auth) + `frontend/src/app/sponsors/[id]/page.test.tsx` (detail/mutations/`vi.stubGlobal`) + the E24-S1/E29-S1 hybrid-mock discipline.

### Scope Boundaries

- In scope: ~10 new `*.test.tsx` files + retain/extend the 2 existing automations tests; the per-sub-module mock conventions; the Task-0 DEC-1 resolution.
- Out of scope: any production-code change (test-only); creating `features/communication/**` (that is S2/S3/S4); relocating `EmailTemplateForm` (S4); i18n changes; touching other slices; any route-group move.

### Architecture Guardrails

- **Three DIFFERENT transports (the load-bearing A56 finding):** automations = `@/lib/api/automations` raw-`fetch`+token-param fns (`listAutomations`/`getAutomation`/`createAutomation`/`updateAutomation`/`changeAutomationStatus`/`previewRecipients`/`getExecutions`); email-campaigns = **inline raw `fetch` in the pages** (`lib/api/email-campaigns.ts` is DTOs/enums/helpers ONLY — `getStatusColor`/`getRecipientStatusColor`/`getSegmentTypeLabel`); email-templates = `emailTemplatesApi` object (over the legacy throwing `@/lib/api-client.ts` `ApiClient`, `accessToken?` params, `id:number`). Pin each at its actual layer.
- Wrap every render in `QueryClientProvider` (forward-compat seam) even though the god-pages don't use TanStack yet.
- A64/A78: stable mock references (define once, mutate fields). The automations list keeps `t` in the `fetchAutomations` dep array (stable — OK); email-campaigns new/edit have AppSettings-race guards (REQ-086 patches) — pin the observable outcome, not the internal ref dance.
- Assert via keys/roles/service-args/fetch-URLs/navigation (AC-9), never display copy.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run`. NEVER `npm run format`; never repo-wide lint/format as the gate (A58/A72). New test files may be `prettier --write`. LF (A73).

### A76/A79/A93 note on the bug-magnet surfaces (cross-story)

- **Email-templates delete:** removal happens AFTER `await deleteTemplate` success → on failure the list correctly stays + an error banner shows. Pin BOTH branches at the outcome level (the E21 P2/P3 + A76 class). The destructive/red affordance must be asserted.
- **Email-campaigns detail mutations** (test/schedule/send/cancel/resend) + the status state machine: pin the available-actions-per-status matrix + each action's endpoint + confirm + refetch/alert at the outcome level (these are the surfaces S3 turns into slice mutations).
- **A93:** the email-campaign detail (404) + automation detail load throw/return paths — pin the not-found surface; flag that the future TanStack queries must disable retry on a deterministic 404 (the harness `retry:false` masks the prod `retry:1`).
Write delete/submit/lifecycle assertions at the **outcome** level so S2/S3/S4 can change the mechanism (RHF+Zod, TanStack mutation, Badge variants) under a still-green net. Flag the mechanism-level surfaces as the S2/S3/S4-licensed-update set.

### Cross-story note — shared `emailTemplatesApi` + nested-slice boundary (A83/E21-S5)

`emailTemplatesApi` (`@/lib/email-templates`) is consumed by THREE sub-modules: email-templates (its owner), AND automations + email-campaigns (template dropdowns). It MUST stay in `@/lib` so all three slices can import it (boundary-legal `features→lib`); it does NOT move into the email-templates slice (only the `EmailTemplateForm` component relocates, S4). The three sub-slices are independent — the E21-S5 rule forbids `@/features/**` imports between them; any shared code uses relative `../shared` imports. This net pins all three sub-modules so a shared-client or shared-key change that regresses a sibling is caught.

### Testing Requirements

- Vitest + Testing Library; jsdom + `afterEach(cleanup)` (A35/A46). Stub `window.confirm` for the campaign + template deletes/sends; `vi.unstubAllGlobals()` in `afterEach`. Mock RichTextEditor/HtmlSourceEditor/DOMPurify as needed for the campaign new/edit/detail specs.
- The email-templates delete two-branch matrix + the email-campaigns status-action matrix + the per-page auth guards (esp. the email-templates silent-null vs the others' redirect) are the load-bearing assertions.

### Project Structure Notes

- Target tree (test-only): co-located `*.test.tsx` beside each of the 12 route pages (retaining the 2 existing automations tests).

### References

- Harness templates: `frontend/src/app/members/page.test.tsx`, `frontend/src/app/sponsors/[id]/page.test.tsx`, the existing `frontend/src/app/communication/automations/AutomationForm.test.tsx` + `automations/[id]/page.test.tsx`.
- Pages under test (all under `frontend/src/app/communication/`): `page.tsx` (index :82-126); `automations/{page,new,[id],[id]/edit}.tsx` + `automations/AutomationForm.tsx`; `email-campaigns/{page,new,[id],[id]/edit}.tsx`; `email-templates/{page,new,[id]}.tsx`.
- Clients: `frontend/src/lib/api/automations.ts` (token-fn module + `getStatusColor` :109-122 + `getTriggerLabel` :130-150), `frontend/src/lib/api/email-campaigns.ts` (DTOs/enums + `getStatusColor` :137-154 + `getRecipientStatusColor` :156-180 + `getSegmentTypeLabel`), `frontend/src/lib/email-templates.ts` (`emailTemplatesApi` over `@/lib/api-client.ts`) + `frontend/src/types/email-templates.ts`.
- project-context.md A34/A35/A46/A56/A58/A62/A64/A72/A73/A76/A78/A79/A88/A93/A94; `docs/architecture-frontend.md` "Pilot Result Note"; E24-S1 + E29-S1 (`e24-s1-…` + `e29-s1-…`) for the hybrid-mock + retain-existing-tests precedents.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E25 preparation (front-loaded batch per A34). Status ready-for-dev. Test-only; must be green at HEAD before E25-S2/S3/S4.
- **A56 spike divergences/findings (load-bearing):** (1) THREE different transports — automations token-fn module, email-campaigns INLINE fetch (no api module — S3 builds one), email-templates `emailTemplatesApi` over the legacy `ApiClient`. (2) automations NOT zero-tested (2 existing tests — retain/extend). (3) auth guards vary per sub-module (email-templates list has NO guard; new/[id] silent-null; others redirect). (4) `emailTemplatesApi` is consumed cross-module (automations + campaigns dropdowns) → stays in lib (A83/A94). (5) email-campaigns detail is the richest surface (status state machine + 5 mutations + statistics + recipients + DOMPurify preview). (6) i18n: all namespaces en↔de parity, hi=0 (subset OK) → no i18n work.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous whole-epic dev-story; A87 parallel-subagent characterization-net authoring, one agent per sub-module, central verification by the orchestrator).

### Debug Log References

- **DEC-1 (a)/(b)/(c)** recorded in Task 0 above (A43 template; A41 autonomous-mode escape — user directive "das ganze epic implementieren mit allen stories. ohne stop das wird jetzt implementiert. danach review und retro").
- **HEAD quirks pinned (corrections vs the story's pre-spike guesses — these are the ACTUAL behaviours the net asserts):**
  - The AutomationForm inline segment-load URL is **`/api/v1/member-segments?pageSize=100`** (NOT `/api/v1/member-segments/active` as the story text guessed). **S2 must fold THIS URL.**
  - Email-campaigns detail + edit read the id via **`useParams()`** (no React `use(params)` shim needed). Automations detail + edit use React **`use(params)`** (the `vi.mock("react")` sync-`use` shim + `syncThenable` helper are required for those two).
  - Email-campaigns pages fetch INLINE via `useAuth().accessToken` Bearer (NOT `next-auth getSession` — the story guessed `getSession`).
  - Email-templates LIST: no-token → the loading spinner stays shown (initial `loading=true`, the effect early-returns before `setLoading(false)`); `getAllTemplates` is NOT called. Same no-token-stuck-spinner shape on the email-campaigns list (bails inside the fetch before `setLoading(false)`).
  - Per-page guard asymmetry pinned exactly: automations/email-campaigns list+detail → `push("/login")` (unauth) / `push("/")` (authed-not-Vorstand/Admin); email-templates list → NO guard; email-templates new/[id] → silent `return null` (no push); index → `push("/")` redirect.
  - `getSegmentTypeLabel` returns hard-coded German (asserted literally — it is not i18n today; a candidate S3 i18n note, not an S1 fix).
  - Resend modal `sendToFailedOnly` is disabled when `statistics.failed === 0`.

### Completion Notes List

- ✅ **Characterization net green at HEAD** over all 12 Communication pages across the 3 sub-modules (3 transports). **11 new spec files + 3 retained** automations specs; **139 new tests** (automations 31 new / email-campaigns 75 / email-templates 27 / index 6) on top of the 12 retained → **151 tests in `src/app/communication`**.
- ✅ Full frontend suite **978/978 green (112 files)** = 839 E29-baseline + 139 new; **no regressions**. `tsc --noEmit` exit 0. `eslint` on the new specs clean. New specs `prettier --write` (LF, A73).
- ✅ Harness per AC-8/9: `// @vitest-environment jsdom` + `@testing-library/jest-dom/vitest` + `afterEach(cleanup + vi.unstubAllGlobals)` (A35/A46); stable identity translator + mutable `authState` + stable router/`useParams` (A64/A78); `QueryClientProvider` (retry:false) seam on every render so S2/S3/S4 TanStack adopters need no harness rework. Assertions via i18n keys / ARIA roles / service-call args / fetch URLs / navigation — never display copy.
- ✅ A79 recorded: the `retry:false` harness masks the provider's `retry:1` + sticky-mutation-error + no-spinner-on-refetch deltas (and the A93 deterministic-404 retry); S2/S3/S4 must decide these explicitly.
- ✅ A76 bug-magnet surfaces pinned at the outcome level: email-templates delete two-branch (success-removes / failure-keeps + destructive-red affordance), email-campaigns detail status→action matrix (5 mutations + confirm gates + refetch/alert), the deterministic-404 not-found surfaces.
- **Licensed-update surface flagged for S2/S3/S4** (A79/A88/A94): only the per-sub-module transport mock target + the form/lifecycle/delete *mechanism* assertions are re-pointable; the auth gate, fetch URLs/endpoints, navigation, status-badge presence, action matrix, search/pagination/empty/error assertions must stay green verbatim.

### File List

New (test-only — no production code changed):
- `frontend/src/app/communication/automations/page.test.tsx`
- `frontend/src/app/communication/automations/new/page.test.tsx`
- `frontend/src/app/communication/automations/[id]/edit/page.test.tsx`
- `frontend/src/app/communication/email-campaigns/page.test.tsx`
- `frontend/src/app/communication/email-campaigns/new/page.test.tsx`
- `frontend/src/app/communication/email-campaigns/[id]/page.test.tsx`
- `frontend/src/app/communication/email-campaigns/[id]/edit/page.test.tsx`
- `frontend/src/app/communication/email-templates/page.test.tsx`
- `frontend/src/app/communication/email-templates/new/page.test.tsx`
- `frontend/src/app/communication/email-templates/[id]/page.test.tsx`
- `frontend/src/app/communication/page.test.tsx`

Retained unchanged (pre-existing automations specs): `frontend/src/app/communication/automations/[id]/page.test.tsx`, `frontend/src/app/communication/automations/AutomationForm.test.tsx`, `frontend/src/app/communication/automations/automations.i18n.test.ts`.

## Change Log

- 2026-06-12: Story created (characterization net over the 12 Communication pages across 3 sub-modules with 3 different transports). DEC-1 = transport-matched hybrid mocks. A56 findings recorded (3 transports; automations not zero-tested; per-sub-module guards; shared emailTemplatesApi stays in lib). Status ready-for-dev.
- 2026-06-12: Implemented (autonomous whole-epic E25 session). 11 new spec files + 3 retained; 151 tests in `src/app/communication`, full suite 978/978 green, tsc clean. DEC-1=A resolved with A43 (a)/(b)/(c). HEAD-quirk corrections recorded (segment-load URL `?pageSize=100`; useParams vs use(params) per sub-module; inline `accessToken` fetch not getSession; no-token-stuck-spinner). Status → review.
