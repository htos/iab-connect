# Story E25.S2: Automations — CRUD Feature-Slice Extraction

Status: ready-for-dev

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

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — record A43 (a)/(b)/(c) per DEC
  - [ ] E25-S1 Automations specs green at HEAD. Confirm `features/communication/automations/` does NOT exist. Re-read the 4 pages + `AutomationForm.tsx` + `lib/api/automations.ts` + the E29 documents/board wrap recipe + sponsors form recipe (A56).
  - [ ] **DEC-1 (transport — wrap vs adapt the token-param fns):** recommended **A** — slice `api/automations-api.ts` WRAPS `@/lib/api/automations.ts`; since those fns take a `token` param (not the `useApiClient` shape), the slice api fns take the token from a hook the components hold (or pass `useApiClient`-style — pick the minimal adaptation that keeps the S1 mock on `@/lib/api/automations` intercepting). Do NOT rewrite the URLs. `lib/api/automations.ts` stays (consumed nowhere else, but wrapping is the recipe).
  - [ ] **DEC-2 (form):** recommended **A** — adopt E22 RHF+Zod for `automation-form` (epic goal; behaviour-preserving — same required set as the manual `clientValidate`).
  - [ ] **DEC-3 (type home):** recommended **re-export** the DTOs/enums from `@/lib/api/automations` via `types/automation.types.ts`.
  - [ ] **DEC-4 (status badge):** recommended **map to Badge variants/tokens** (DEC-2/A77); verify the token value against the named brand colour, not a comment.
- [ ] Task 1: Scaffold slice `api` + `types` + `schemas` (AC: 3, 4) — `automations-api.ts` (`automationsKeys` + wrapped fns + folded segment-load, URLs/params byte-identical) + `types/automation.types.ts` + `schemas/automation.schema.ts` + `automations-api.test.ts`.
- [ ] Task 2: Hooks (AC: 3, 5) — list/detail (+`AutomationNotFoundError`, A93 retry-exclusion)/executions queries; create/update/lifecycle/preview mutations + invalidation. `use-automation.test.tsx`.
- [ ] Task 3: Components — list + detail (AC: 1, 2, 3, 4) — `automations-page-content` (+filter-bar/table/status-badge) + `automation-detail` (lifecycle actions, `canEdit` gating, executions table). Status badge → Badge variants (A77).
- [ ] Task 4: Components — new + edit forms (AC: 1, 2, 4) — `automation-form` (RHF+Zod, E22 sub-recipe; the trigger/segment conditional fields + previewRecipients action) + `automation-new-content`/`automation-edit-content`. `automation-form.test.tsx`.
- [ ] Task 5: Thin route entries (AC: 2) — the 4 route files → content components (KEEP `params: Promise<{id}>` + `use(params)` for [id]/[id]/edit so the S1 specs stay green).
- [ ] Task 6: Green-the-net + DoD gate (AC: 1, 6) — E25-S1 Automations specs green (transport-mock re-pointed only; form/lifecycle mechanism is the licensed-update surface); new slice unit tests; `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; i18n parity green; `next build` succeeds (or deferred to epic boundary per A58); LF. Record A79 deltas.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (Automations 4 pages → `features/communication/automations/` slice; DEC-1 wrap token-fn module, DEC-2 RHF+Zod, DEC-3 type re-export, DEC-4 Badge tokens; fold inline segment-load; A93 404-no-retry; emailTemplatesApi stays in lib). Status ready-for-dev.
