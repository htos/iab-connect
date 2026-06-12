# Story E25.S1: Communication — Characterization Tests for All Twelve Pages (Regression Net)

Status: ready-for-dev

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

- [ ] Task 0: Confirm prerequisites + harness spike (AC: all) — **DEC-1 (per-sub-module mock strategy) is load-bearing; resolve it first**
  - [ ] On branch `refactor/frontend-feature-slice`; confirm `src/features/communication/` does NOT exist yet. Re-read the 12 pages + `lib/api/automations.ts` + `lib/api/email-campaigns.ts` (DTOs/helpers only) + `lib/email-templates.ts` + `types/email-templates.ts` + `components/email-templates/EmailTemplateForm.tsx` + `app/communication/automations/AutomationForm.tsx` (A56).
  - [ ] **A56 correction (pin, don't assume zero-tested):** automations ALREADY has 2 tests — `automations/AutomationForm.test.tsx` + `automations/[id]/page.test.tsx`. Retain/augment them (mirror the E24-S1 retain-and-extend); email-campaigns + email-templates have ZERO tests. Net delta is ~10 new spec files + 2 retained.
  - [ ] **DEC-1 RESOLVED → [dev fills A43 (a)/(b)/(c)]:** Recommended **A — transport-matched hybrid mocks (one strategy per sub-module, since the three use different clients):** automations → `vi.mock("@/lib/api/automations")` (token-param fns) + stub `fetch` for the inline segment-load; email-campaigns → `vi.stubGlobal("fetch", …)` + `vi.mock("next-auth/react")` `getSession` (the pages fetch inline) + `vi.mock("@/lib/email-templates")` for the template dropdown + `vi.mock("@/lib/api/email-campaigns")` if any helper is consumed; email-templates → `vi.mock("@/lib/email-templates")` (`emailTemplatesApi` object) + `vi.stubGlobal("confirm")`. Stable `vi.mock("@/lib/auth")` `useAuth` for all guards. Flag every mock target as the surface S2/S3/S4 re-point (A88/A94 — wrapping a lib module keeps its mock intercepting; the inline-fetch email-campaigns will need the heaviest transport adaptation since S3 BUILDS its api layer).
- [ ] Task 1: Automations specs — `automations/page.test.tsx` (list) + retain/extend `automations/[id]/page.test.tsx` + `automations/AutomationForm.test.tsx` + new `automations/new` / `automations/[id]/edit` coverage (AC: 2, 3, 7, 8, 9).
- [ ] Task 2: Email-campaigns specs — `email-campaigns/page.test.tsx` (list) + `new` + `[id]` (detail, incl. the status-state-machine action matrix) + `[id]/edit` (AC: 2, 4, 7, 8, 9). Stub `fetch` per action; pin test/schedule/send/cancel/resend endpoints + confirm + refetch/alert.
- [ ] Task 3: Email-templates specs — `email-templates/page.test.tsx` (list, incl. the destructive delete affordance + delete-success-removal + delete-FAILURE-list-unchanged A76 branches) + `new` + `[id]` (AC: 2, 5, 7, 8, 9).
- [ ] Task 4: Index spec — `communication/page.test.tsx` (AC: 2, 6, 8, 9): guard + the 3 nav cards + 2 quick-action links.
- [ ] Task 5: Green-at-HEAD + DoD gate (AC: 1, 8, 9): `npx vitest run "src/app/communication"` green; full `npx vitest run` green, no regressions; `npx tsc --noEmit` clean; `npx eslint <new/changed specs>` clean; `npx prettier --write` new files / `--check` the 2 retained (LF). Record per-page spec counts + HEAD quirks pinned (not fixed) in Completion Notes.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (characterization net over the 12 Communication pages across 3 sub-modules with 3 different transports). DEC-1 = transport-matched hybrid mocks. A56 findings recorded (3 transports; automations not zero-tested; per-sub-module guards; shared emailTemplatesApi stays in lib). Status ready-for-dev.
