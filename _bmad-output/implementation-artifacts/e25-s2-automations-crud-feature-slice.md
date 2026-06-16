# Story E25.S2: Automations — CRUD Feature-Slice Extraction

Status: review

Depends on: **E25-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient`, DEC-2 status colours). Independent of S3/S4 once S1 is green (the three CRUD sub-modules may proceed in parallel). **Consumes `@/lib/email-templates` for the template dropdown (boundary-legal `features→lib`; do NOT import the email-templates slice — A83/E21-S5).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the four Automations pages refactored into a `src/features/communication/automations/` slice following the proven recipe,
so that the first of three parallel Communication CRUD surfaces matches the standard architecture with no behaviour change.

## Acceptance Criteria

**Behaviour preserved (all E25-S1 Automations tests stay green):**

1. Routes `/communication/automations`, `/new`, `/[id]`, `/[id]/edit`; the Vorstand-or-Admin gate (redirect `/login` then `/`); automation load, server-side `?status=` filter, client-side search (name/templateName), pagination (shown when `totalPages>1`), loading/error/empty states, table, status badge (Draft/Active/Paused/Disabled), trigger label, detail/edit/new navigation; the lifecycle actions (activate/pause/resume/disable), the `canEdit` gating (Vorstand/Admin AND status∈{Draft,Paused}), the executions table (degrades to "no runs yet"); create/update submit → redirect `/communication/automations/{id}`, validation, submit-error; and the recipient `previewRecipients` action all work exactly as before.

**Improvements:**

2. Each route file becomes a **thin entry** (no `"use client"`) rendering a `features/communication/automations` content component (the only `"use client"` is the composition root).

3. A `features/communication/automations/` slice exists mirroring `features/sponsors/` + the E29 wrap recipe:
   - `api/automations-api.ts` — **WRAPS the existing `@/lib/api/automations.ts` fns** (A94 — do NOT re-implement the URLs; the module already owns them) + an `automationsKeys` query-key factory (`all` / `list(filters)` / `detail(id)` / `executions(id)`). The slice api adapts the token-param fns to the slice's calling convention (see DEC-1). **Also folds the inline raw-`fetch` segment-load (`/api/v1/member-segments/active`) into the api layer** (the HEAD quirk — no raw `/api/v1` URL left in a component).
   - `hooks/` — `use-automations` (`useQuery` list) + `use-automation` (get-by-id, with an `AutomationNotFoundError` for 404 + **`retry` disabled for that sentinel per A93**) + `use-automation-executions` + `use-create-automation`/`use-update-automation` + `use-automation-lifecycle` (activate/pause/resume/disable mutations) with `automationsKeys` invalidation; `use-recipient-preview`.
   - `schemas/automation.schema.ts` — Zod shared by new+edit (the 9 fields; required: name, templateId, offsetDays-when-time-relative, segmentFilter-when-MemberSegment; behaviour-preserving — validation only where the manual `clientValidate` enforced it; i18n-key messages).
   - `components/` — `automations-page-content`, `automations-filter-bar`, `automations-table`, `automation-status-badge`, `automation-form` (RHF+Zod, reused by new+edit), `automation-detail`, `automation-new-content`, `automation-edit-content`.
   - `types/automation.types.ts` — re-exports the DTOs/enums from `@/lib/api/automations` (DEC-3 = the E23-S2/E29 re-export pattern; `features→lib` legal).

4. The status badge maps to **Badge variants/tokens (DEC-2)** — no raw `getStatusColor` brand strings (`bg-gray-100`…) in feature components; the mapping is verified against the named token's canonical value, NOT a comment (A77). The form uses RHF+Zod (E22 sub-recipe) behind a stable, tested contract; validation messages via next-intl (no hard-coded strings).

5. The manual→TanStack deltas (A79) are decided explicitly: refetch via `invalidateQueries`; mutation error surfaced (not silently sticky); the lifecycle mutations update the detail view; chosen retry semantics documented (incl. the A93 deterministic-404 exclusion).

6. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files/components (incl. the relocated segment-load), no duplicate UI primitive; i18n parity stays green (reuse existing `automations.*` keys; no renames/removals).

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded in Dev Agent Record below
  - [x] E25-S1 Automations specs green at HEAD (65 tests). Confirmed `features/communication/automations/` did NOT exist. Re-read the 4 pages + `AutomationForm.tsx` + `lib/api/automations.ts` + the E29 documents/board wrap recipe + sponsors form recipe (A56).
  - [x] **DEC-1 = A WRAP** — `api/automations-api.ts` WRAPS `@/lib/api/automations.ts` (token-param fns); hooks read the token from `useAuth().accessToken`. URLs unchanged → the S1 `vi.mock("@/lib/api/automations")` specs keep intercepting with ZERO transport-mock edits (A94). Folded the inline segment-load → `fetchMemberSegments(token)` at the REAL url **`/api/v1/member-segments?pageSize=100`** (the story text's `/active` was wrong).
  - [x] **DEC-2 = A** — RHF+Zod `automation-form`; same `validation.*` keys; `.superRefine` for offsetDays-when-time-relative + segmentFilter-when-MemberSegment; preview action + template/segment/conditional fields + redirect + submit-error banner preserved.
  - [x] **DEC-3 = re-export** the DTOs/enums from `@/lib/api/automations` via `types/automation.types.ts`.
  - [x] **DEC-4 = Badge variants** — Draft→secondary, Active→default, Paused→outline, Disabled→destructive (mirrors `sponsor-status-badge.tsx`; A77 semantic tokens, no raw `getStatusColor` strings in feature components).
- [x] Task 1: Scaffolded slice `api` + `types` + `schemas` — `automations-api.ts` (`automationsKeys` + wrapped fns + folded segment-load, URLs/params byte-identical) + `types/automation.types.ts` + `schemas/automation.schema.ts` + `automations-api.test.ts` (13).
- [x] Task 2: Hooks — list/detail (retry:false per A93/A79 — see Debug Log; `AutomationNotFoundError` defined for parity but the wrapped lib fn has no status)/executions(swallow→[]) queries; create/update/lifecycle/preview mutations + invalidation. `use-automation.test.tsx` (5).
- [x] Task 3: Components — list + detail — `automations-page-content` (+filter-bar/table/status-badge) + `automation-detail` (lifecycle actions, `canEdit` gating, executions table). Status badge → Badge variants (A77).
- [x] Task 4: Components — new + edit forms — `automation-form` (RHF+Zod, E22 sub-recipe; trigger/segment conditional fields + previewRecipients action) + `automation-new-content`/`automation-edit-content`. `automation-form.test.tsx` (9).
- [x] Task 5: Thin route entries — the 4 route files → content components (KEPT `params: Promise<{id}>` + `use(params)` for [id]/[id]/edit so the S1 specs stay green). Deleted the old `AutomationForm.tsx`.
- [x] Task 6: Green-the-net + DoD gate — E25-S1 Automations specs green (transport mocks unchanged via A94 WRAP; only the detail-spec `QueryClientProvider` wrapper + the deleted-form test relocation adapted); new slice unit tests; `tsc` exit 0 / eslint(slice+changed) clean / `vitest run` FULL **1000/1000 green (114 files)**, no regressions; LF. A79 deltas recorded. (`next build` deferred to epic boundary per A58.)

## Dev Notes

First Communication sub-slice; nests under `features/communication/automations/` to keep the three sub-modules cohesive yet independently migratable. Wraps the existing `lib/api/automations.ts` (A94 — net survives with minimal transport edits) rather than duplicating fetch logic. Independent of S3/S4 — may run in parallel.

### Scope Boundaries

- In scope: `features/communication/automations/` (api/hooks/components/schemas/types) for the 4 pages; thin route entries; folding the inline segment-load into the api; new slice unit tests.
- Out of scope: email-campaigns + email-templates (S3/S4); the index page (S4); modifying `@/lib/api/automations.ts` breaking-ly; `@/lib/email-templates` (consumed read-only for the template dropdown — boundary-legal, do NOT move); i18n key changes; any route-group move.

### Architecture Guardrails

- Mirror the sponsors slice + the E29 wrap recipe exactly (api → `*Keys` + wrapped fns; hooks → query/mutation + invalidation; thin `"use client"` root; relative intra-slice imports only — E21-S5; **a feature must NOT import another `@/features/communication/<sibling>`**).
- The template dropdown calls `emailTemplatesApi.getAllTemplates` (`@/lib/email-templates`) — keep that import (lib, legal); do NOT reach into the email-templates slice.
- A77: verify the status-token value against the named brand colour (not a comment) — esp. since DEC-2's `--primary` lesson (orange-600 vs orange-500).
- A93: `use-automation` must disable retry for the 404 sentinel (`retry: (n,err)=>!(err instanceof AutomationNotFoundError) && n<1`).
- Do NOT change request/response contracts when wrapping — URLs/params/bodies byte-identical.
- DoD as E29 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) wrap `@/lib/api/automations` token-fns + `automationsKeys` (recommended; sibling-safe; net-survival). B) rewrite URLs via `useApiClient` (diverges; the token-fn module would be orphaned). **Recommended: A.**
- **DEC-2 form:** A) E22 RHF+Zod. B) keep manual `useState`. **Recommended: A.**
- **DEC-3 type home:** A) re-export from `@/lib/api/automations`. B) relocate (violates E21-S5). **Recommended: A.**
- **DEC-4 status badge:** A) Badge variants/tokens (A77-verified). B) keep raw `getStatusColor` strings. **Recommended: A** (the epic improvement goal).

### Testing Requirements

- The E25-S1 Automations specs are the regression oracle — keep green; only the transport-mock target + the form/lifecycle *mechanism* assertions are the licensed-update surface (A79). Auth gate, fetch URLs, navigation, status-badge presence, executions render, preview action must stay green verbatim.
- Add focused slice unit tests: `automations-api` URL/key shape; `use-automation` (404→sentinel, no-retry); a lifecycle mutation invalidation; `automation-form` RHF+Zod (mirror `sponsor-form.test.tsx`). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/communication/automations/{api,hooks,components,schemas,types}`; thin entries at `app/communication/automations/{page,new/page,[id]/page,[id]/edit/page}.tsx`.

### References

- Slice templates: `frontend/src/features/sponsors/` (form recipe), `frontend/src/features/documents/api/documents-api.ts` + `frontend/src/features/board-documents/api/board-documents-api.ts` (the E29 WRAP recipe + `*Keys`), `frontend/src/features/events/` (detail slice + `EventNotFoundError`).
- Pages: `frontend/src/app/communication/automations/{page,new,[id],[id]/edit}.tsx` + `AutomationForm.tsx` (manual form, the inline segment-load quirk).
- Client to wrap: `frontend/src/lib/api/automations.ts` (`listAutomations`/`getAutomation`/`createAutomation`/`updateAutomation`/`changeAutomationStatus`/`previewRecipients`/`getExecutions` + `getStatusColor`/`getTriggerLabel`).
- `frontend/src/lib/auth.ts:169-295` (useApiClient/useAuth); `frontend/eslint.config.mjs` (E21-S5 boundary :11-65); `frontend/src/lib/email-templates.ts` (the template dropdown source — lib, keep).
- E25-S1; project-context.md A34/A56/A58/A72/A73/A77/A78/A79/A88/A93/A94; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E25 batch, A34). Status ready-for-dev. HARD-ordered after E25-S1. Four DECs carry recommended options for A41/A32 + A43.
- **A56 findings:** automations = `@/lib/api/automations` token-fn module → A94 WRAP (DEC-1=A); manual `AutomationForm` → E22 RHF+Zod (DEC-2=A); `getStatusColor` raw strings → Badge tokens (DEC-4=A, A77); the inline segment-load (`/api/v1/member-segments/active`) folds into the api; `emailTemplatesApi` stays in lib (consumed for the template dropdown; A83/E21-S5). Automations had 2 pre-existing tests (E25-S1 retains them).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous whole-epic dev-story; slice extraction by a focused subagent, central verification by the orchestrator).

### Debug Log References

**A43 (a)/(b)/(c) — DEC resolutions (A41 autonomous mode; user directive "das ganze epic implementieren mit allen stories. ohne stop"):**
- **DEC-1 (a)** WRAP `@/lib/api/automations`. **(b)** the lib module already owns its `/api/v1` URLs; rewriting against `useApiClient` would be a transport change not a relocation; wrapping keeps request bytes identical AND keeps every S1 `vi.mock("@/lib/api/automations")` spec intercepting with zero edits (A94). **(c)** no raw `/api/v1` string left in any component (the inline segment-load now lives behind `fetchMemberSegments` at the REAL `/api/v1/member-segments?pageSize=100`); the lib fns still throw a generic `Error` (no status) — constrains DEC-A93.
- **DEC-2 (a)** RHF+Zod `automation-form`. **(b)** the E22 sub-recipe; Zod `.superRefine` centralises the conditional validation the god-page did imperatively. **(c)** validation MECHANISM moved from a single yellow `fieldError` banner → per-field messages, BUT the same `validation.*` message keys are reused so the S1 new/edit specs pass unchanged.
- **DEC-3 (a)** re-export DTOs/enums via `types/automation.types.ts`. **(b)** `features→lib` legal; single import surface. **(c)** no component reaches across to `@/lib/api/automations` for a type.
- **DEC-4 (a)** Badge variants (Draft→secondary/Active→default/Paused→outline/Disabled→destructive). **(b)** DEC-2(E21)/A77 — semantic tokens on the shared Badge, no raw brand strings. **(c)** S1 list spec asserts the badge via the translated label scoped to the table, not a colour class → passes unchanged.
- **DEC-A93/A79 (a)** `retry: false` on the `use-automation` detail query (`AutomationNotFoundError` defined for parity only). **(b)** the wrapped `getAutomation` throws a generic `Error` with NO status so a 404 sentinel can't be distinguished without modifying the wrapped lib fn (out of scope); the god-page rendered its error panel on the first failed fetch, so `retry:false` is behaviour-preserving and avoids the A93 double-fetch. **(c)** A79 deltas: list refetch via query-key + `invalidateQueries`; lifecycle mutations `setQueryData(detail(id))` (mirrors god-page `setAutomation(updated)`) + invalidate list; mutation errors surfaced via `mutation.error.message`, not silently sticky; executions swallow failure → `[]` (god-page "no runs yet").

### Completion Notes List

- ✅ Automations 4 pages → `features/communication/automations/` slice (api/hooks/components/schemas/types) mirroring the sponsors + E29 wrap recipe. Behaviour-preserving — every E25-S1 Automations assertion stays green.
- ✅ **Full suite 1000/1000 green (114 files)** = 978 (post-S1) + 22 new slice unit tests; **no regressions**. `tsc --noEmit` exit 0. `eslint` on slice + changed files clean incl. the E21-S5 boundary (no `@/features/**` imports inside the slice — relative only). New files `prettier --write` (LF); modified route/spec files hand-matched (diff stayed logical: 5 files, +44/−542 as the route logic moved into the slice).
- ✅ Licensed-update surface (A79/A94): only the detail-spec `QueryClientProvider` wrapper was added and the deleted-`AutomationForm.tsx` test was relocated into the slice `automation-form.test.tsx`; `page.test.tsx`/`new`/`[id]/edit` specs needed NO edits (WRAP kept transport mocks + Zod reused the message keys).

### File List

New — slice `frontend/src/features/communication/automations/`:
- `api/automations-api.ts`, `api/automations-api.test.ts`
- `schemas/automation.schema.ts`
- `hooks/use-automations.ts`, `hooks/use-automation.ts`, `hooks/use-automation-executions.ts`, `hooks/use-create-automation.ts`, `hooks/use-update-automation.ts`, `hooks/use-automation-lifecycle.ts`, `hooks/use-recipient-preview.ts`, `hooks/use-automation.test.tsx`
- `components/automations-page-content.tsx`, `automations-filter-bar.tsx`, `automations-table.tsx`, `automation-status-badge.tsx`, `automation-form.tsx`, `automation-detail.tsx`, `automation-new-content.tsx`, `automation-edit-content.tsx`, `automation-form.test.tsx`
- `types/automation.types.ts`

Modified (thin route entries / S1-spec adaptation): `frontend/src/app/communication/automations/{page,new/page,[id]/page,[id]/edit/page}.tsx`, `frontend/src/app/communication/automations/[id]/page.test.tsx`.

Deleted: `frontend/src/app/communication/automations/AutomationForm.tsx`, `frontend/src/app/communication/automations/AutomationForm.test.tsx`.

## Change Log

- 2026-06-12: Story created (Automations 4 pages → `features/communication/automations/` slice; DEC-1 wrap token-fn module, DEC-2 RHF+Zod, DEC-3 type re-export, DEC-4 Badge tokens; fold inline segment-load; A93 404-no-retry; emailTemplatesApi stays in lib). Status ready-for-dev.
- 2026-06-12: Implemented (autonomous whole-epic E25 session). Slice built; AutomationForm → RHF+Zod; transport WRAPPED (S1 mocks unchanged, A94); segment-load url corrected to `?pageSize=100`; detail query retry:false (A93/A79, no status from wrapped lib fn). Full suite 1000/1000 green, tsc/eslint clean. Status → review.
- 2026-06-12: Epic-25 boundary review — 2 patches applied (P1 HIGH: out-of-set `segmentType`/`consentFilter` now round-trip on a no-touch edit-save — schema widened to full transport unions + raw defaults + extra `<option>`; P2 MED: detail/edit query `enabled` → token-only so a non-privileged direct-nav shows the `loadError` panel instead of an infinite spinner). +regression tests. See epic-25-boundary-review-2026-06-12.md.
