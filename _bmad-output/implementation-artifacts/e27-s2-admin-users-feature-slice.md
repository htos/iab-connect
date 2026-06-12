# Story E27.S2: Admin Users — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E27-S1 (the users-area net must be green at HEAD first)**, plus E21-S3 (list recipe) + E21-S5 (import boundary) + the E22 RHF+Zod form sub-recipe (all closed). Inherits E21-S1 boundary decisions (DEC-1 transport, DEC-2 status colours). **This story CONFIRMS the area-vs-feature decision for admin** (recommended: `features/admin-users` sub-slice) and sets the `features/admin-*` naming + ESLint-boundary precedent S3..S6 follow. Independent of S3..S6 once S1 is green (the five sub-features are mutually independent).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the four admin users pages refactored into a `features/admin-users/` slice following the proven recipe,
so that user management matches the Suppliers/Sponsors/Members slices while the area-vs-feature decision for admin is confirmed and the largest admin slice (4 pages, 8+ mutations) sets the precedent for the rest of the epic.

## Acceptance Criteria

**Behaviour preserved (all E27-S1 users-area tests stay green):**

1. The admin auth guard is preserved on all four pages: non-admins redirected (`router.push("/")` — **`/`, not `/login`**); the data fetch stays gated on `isAuthenticated && isAdmin && accessToken`. Mirror the `sessions` page's explicit non-admin `return null` across all four so a stalled redirect can't produce skeleton-forever (A90/A97).
2. Routes, list load + explicit-submit search (`?search=`, resets `page=1`) + pagination (`pageSize=20`, shown only when `totalPages>1`), per-row actions (enable/disable toggle, password-reset `confirm`+`alert`, MFA-reset `confirm`+`alert`, delete `confirm` + row-filter + `totalCount--` + **list-preserved-on-failure**), role/status/`emailVerified` badges, the new create + the edit **two-step save** (`updateUser` then conditional `updateUserRoles` via Set-diff) + redirect/success-banner, sessions list + revoke (`confirm`, bordered-red, inline 4s banner, list-preserved-on-failure) + refresh, the `!user` not-found terminal block, the **409 `A user with this email already exists`** message, and all i18n texts work exactly as before.

**Improvements:**

3. **DECISION CONFIRMED: admin is an AREA**; this slice is `features/admin-users/` (composition root is the only `"use client"`; each route file becomes a thin entry). Add the ESLint import-boundary entry for `features/admin-users` (per E21-S5).
4. Slice shape mirrors the members/sponsors template:
   - `api/admin-users-api.ts` — **WRAPS `frontend/src/lib/api/users.ts` (A94 — token-param fns already own the `/api/v1/users` URLs; do NOT re-implement via `useApiClient`)** + an `adminUsersKeys` query-key factory (`all`/`list(filters)`/`detail(id)`/`roles`/`sessions(id)`). Keep `getAvailableRoles` (`/api/v1/users/roles`) as a DISTINCT key — it collides shape-wise with `getUser` (`/api/v1/users/{id}`).
   - `hooks/` — `use-users` (list `useQuery`), `use-user` (get-by-id; **`retry:false`** per A99 because the wrapped lib fn throws a generic `Error` with no status — define a `UserNotFoundError` for parity only, see DEC-3), `use-available-roles`, `use-user-sessions`; mutations `use-set-user-enabled`/`use-reset-password`/`use-reset-mfa`/`use-delete-user`/`use-create-user`/`use-update-user`/`use-revoke-session`, each invalidating `adminUsersKeys`. `use-update-user` replicates the two-step save (update + conditional roles diff).
   - `schemas/admin-user.schema.ts` — Zod for the create + edit forms (E22 sub-recipe). **NO `.trim()`/transform on submitted-byte fields (A96)**; `email` required via `.min(1)`/`.refine`. The form uses `<form noValidate>` and MUST render per-field Zod errors (A96 companion).
   - `components/` — `admin-users-page-content`, `admin-users-table`, `admin-users-filter-bar`, `user-role-badge`, `user-status-badge`, `delete-user-dialog` (or preserve the `confirm()` — see DEC-4), `admin-user-form` (shared new+edit, **A98** — thread the mode-divergent surfaces through props: title, submit label, redirect-vs-banner, `emailVerified`/`sendInvitation`/`temporaryPassword` field visibility), `user-sessions`.
   - `types/admin-user.types.ts` — **re-exports** the DTOs/interfaces from `@/lib/api/users` (DEC-2/A83 — `features→lib` legal).
5. Role badge maps to Badge variants/tokens per DEC (no raw `getRoleColor` red/blue/green/gray strings in components); the mapping is verified against the named token's canonical value, NOT a comment (A77). **Cover all 5 roles** (admin/vorstand/kassier/auditor/member) or make the gray fallback intentional — today `kassier`/`auditor` fall through to gray. Status badge (enabled/disabled) + `emailVerified ✓` mapped likewise. Destructive affordances preserved per A86: delete=red, disable=conditional red/green, password-reset=blue, MFA-reset=orange, revoke=bordered-red — **preserve the existing colour, do NOT recolour to `destructive`** (every action already ships an intentional colour).
6. Manual→TanStack deltas (A79) decided explicitly: refetch-after-mutation via `invalidateQueries`; mutation error surfaced (not silently sticky); the toggle/delete/revoke optimistic-vs-invalidate behaviour preserves "list NOT cleared on failure"; `confirm`/`alert` flows preserved as-is (NOT converted to Radix — any dialog upgrade is out of scope, noted as residual debt); retry semantics documented (incl. the A99 `retry:false`).
7. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files/components, no duplicate UI primitive; i18n parity stays green (reuse the existing `users.*` keys + the root `profileSecurity.*`/`error.*` keys the sessions page uses — **do NOT relocate `profileSecurity.*` under an `admin.users` namespace; it is shared with the self-service profile security page**).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E27-S1 users-area specs green at HEAD. Confirm `features/admin-users/` does NOT exist. Re-read the 4 pages + `lib/api/users.ts` + the members slice (form + two-step patterns) + sponsors form recipe (A56).
  - [ ] Resolve DEC-1..DEC-4 (recommended options below).
- [ ] Task 1: Scaffold slice `api` + `types` + `schemas` — `admin-users-api.ts` (`adminUsersKeys` + wrapped lib fns, URLs/params byte-identical, keep `createUser` 409→message + `getAvailableRoles` distinct) + `types/admin-user.types.ts` (re-export) + `schemas/admin-user.schema.ts` (no `.trim()`; create+edit field sets) + `admin-users-api.test.ts`.
- [ ] Task 2: Hooks — list/detail(`retry:false`)/roles/sessions queries; create/update(two-step)/setEnabled/resetPassword/resetMfa/delete/revoke mutations + `adminUsersKeys` invalidation. `use-user.test.tsx`.
- [ ] Task 3: Components — list — `admin-users-page-content` + filter-bar + table + role/status badges (Badge tokens, A77) + the per-row `confirm`/`alert` actions (preserve colours, A86).
- [ ] Task 4: Components — new + edit — `admin-user-form` (RHF+Zod, E22 sub-recipe; A98 mode-divergent surfaces threaded; conditional `temporaryPassword`; `emailVerified` edit-only; role checkboxes reconciled against available roles) + `admin-user-new-content`/`admin-user-edit-content` (the `!user` terminal block) + `user-sessions` (revoke + 4s banner + `data-testid`s preserved). `admin-user-form.test.tsx`.
- [ ] Task 5: Thin route entries — the 4 route files → content components (keep `params: Promise<{id}>` + `use(params)` so S1 specs stay green).
- [ ] Task 6: Green-the-net + DoD gate — E27-S1 users specs green (transport mocks unchanged via A94 WRAP; adapt only the licensed A79 surface); new slice unit tests; `tsc` exit 0 / eslint(slice+changed, incl. E21-S5 boundary) clean / `vitest run` FULL green, no regressions; LF. A79 deltas recorded. (`next build` deferred to epic boundary per A58.)

## Dev Notes

First `features/admin-*` sub-slice — sets the naming + boundary precedent for S3..S6. Largest admin slice (4 pages, 8+ mutations). WRAP `lib/api/users.ts` (A94) so the S1 transport mocks keep intercepting. Update the `docs/architecture-frontend.md` recipe note with the admin-area sub-slice convention.

### Scope Boundaries

- In scope: `features/admin-users/` (api/hooks/components/schemas/types) for the 4 pages; thin route entries; ESLint boundary entry; new slice unit tests.
- Out of scope: the other admin areas (S3..S6); modifying `lib/api/users.ts` breaking-ly; the self-service `getMySessions`/`revokeMySession` fns (`/api/v1/identity/sessions`) in the same module — they belong to the profile page, do NOT pull them in; `profileSecurity.*` i18n keys (shared, keep in place); converting `confirm`/`alert` to Radix; any route-group move.

### Architecture Guardrails

- Mirror `features/members/` + `features/sponsors/` exactly (api → `*Keys` + wrapped fns; hooks → query/mutation + invalidation; thin `"use client"` root; relative intra-slice imports only — E21-S5; a feature must NOT import another `@/features/*`).
- A94: WRAP `lib/api/users.ts`; URLs/params/bodies byte-identical. A99: `use-user` `retry:false` (generic `Error`, no status). A96: no Zod `.trim()` on submitted-byte fields; `noValidate` form renders field errors. A98: thread the create/edit mode-divergent surfaces through props AND keep both pinned in the net. A86: preserve existing action colours. A77: verify Badge token values against the named colour.
- Preserve the two-step edit save (update + conditional `updateUserRoles` via Set-diff) and the create 409→`A user with this email already exists` message (status-derived — keep `createUser` on the wrapper, do NOT swap to a `useApiClient` that would surface a different `detail`).
- DoD as E25 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) WRAP `@/lib/api/users` token-fns + `adminUsersKeys` (recommended; A94; net-survival; preserves the 404/409 string sentinels). B) rewrite URLs via `useApiClient` (loses the 409 conflict message + the 404 string; orphans the lib module — also consumed by the profile sessions UI). **Recommended: A.**
- **DEC-2 type home:** A) re-export DTOs from `@/lib/api/users` via `types/admin-user.types.ts` (recommended; A83; `features→lib` legal). B) relocate (violates E21-S5; the module's self-service fns + profile page still import them). **Recommended: A.**
- **DEC-3 404 sentinel (A99):** A) `retry:false` on `use-user`; define `UserNotFoundError` for parity only (recommended; the wrapped lib fn throws a generic `Error` with no status, so a real status sentinel isn't feasible without editing the lib module). B) extend `lib/api/users.ts` to throw a typed `UserNotFoundError{status}` so a real sentinel + `retry`-exclusion works (cleaner long-term but widens scope). **Recommended: A** (B is a good follow-up — record as residual debt if not taken).
- **DEC-4 delete/revoke dialog:** A) keep the browser `confirm()`/`alert()` flows as-is (recommended — keeps S1 green; Radix upgrade out of scope, residual debt). B) convert to a Radix `delete-user-dialog` (changes behaviour the net pins; defer). **Recommended: A.**

### Testing Requirements

- The E27-S1 users specs are the regression oracle — keep green; only the transport-mock target + the form/action mechanism assertions are the licensed A79 update surface. Auth gate (`/` redirect + `return null`), fetch URLs, search/pagination, per-row actions, badges-via-label, two-step save, sessions `data-testid`s must stay green verbatim.
- Add focused slice unit tests: `admin-users-api` URL/key shape (incl. the `roles` vs `{id}` distinction + the 409 message); `use-user` (no-retry); a mutation invalidation; `admin-user-form` RHF+Zod (mirror `member`/`sponsor` form tests — A96 field-error rendering, no-`.trim()`, A98 mode-divergent props). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/admin-users/{api,hooks,components,schemas,types}`; thin entries at `app/admin/users/{page,new/page,[id]/page,[id]/sessions/page}.tsx`.

### References

- Slice templates: `frontend/src/features/members/` (forms + two-step + detail mutations + `*NotFoundError`), `frontend/src/features/sponsors/` (form recipe + status badge).
- Pages: `frontend/src/app/admin/users/{page,new,[id],[id]/sessions}.tsx`.
- Client to wrap: `frontend/src/lib/api/users.ts` (full fn inventory in the E27 spike; note `getMySessions`/`revokeMySession` are self-service — exclude).
- `frontend/src/lib/auth.ts` (useAuth/useApiClient); `frontend/eslint.config.mjs` (E21-S5 boundary).
- E27-S1; project-context.md A34/A56/A58/A72/A73/A77/A78/A79/A83/A86/A90/A94/A96/A97/A98/A99; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. HARD-ordered after E27-S1.
- **A56 findings:** `lib/api/users.ts` = token-param raw-fetch module → A94 WRAP (DEC-1=A). Throws generic `Error` (no status) → `retry:false` (DEC-3=A); 404 pre-translated to `User not found` string, create 409 → hard-coded `A user with this email already exists` (status-derived — keep on wrapper). TWO separate manual forms (not shared) → consolidate into ONE shared RHF+Zod `admin-user-form` with A98 mode-divergent props; edit = two-step save (update + conditional roles Set-diff). Roles are CHECKBOXES (no `<select>` → no classic A95, but reconcile a stored role not in `availableRoles`). Redirect `/` not `/login`. i18n namespace = `users` + `common`; sessions uses ROOT + `profileSecurity.*`/`error.*` (shared — keep). `getRoleColor` red/blue/green/gray + inline status strings → Badge tokens (A77); `kassier`/`auditor` unmapped today. All destructive actions already ship intentional colours (A86 preserve). No existing users tests (S1 writes them).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (admin users 4 pages → `features/admin-users/` slice; DEC-1 WRAP `lib/api/users`, DEC-2 type re-export, DEC-3 `retry:false`+parity sentinel, DEC-4 keep `confirm`/`alert`; shared RHF+Zod form with A98 mode props + two-step edit save; Badge tokens A77; preserve action colours A86; confirms admin=area). Status ready-for-dev.
