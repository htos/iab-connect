# Story E27.S3: Admin Settings — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E27-S1 (the settings-area net must be green at HEAD first)**, plus E21-S3 + E21-S5 + the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions + the `features/admin-*` naming/boundary precedent set by E27-S2. Independent of S2/S4/S5/S6 once S1 is green.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the admin settings page and the admin dashboard refactored into a `features/admin-settings/` slice,
so that they match the proven slice pattern with behaviour preserved — INCLUDING the three-tab settings surface (branding / custom roles / modules) the epic skeleton under-described.

## Acceptance Criteria

**Behaviour preserved (all E27-S1 settings-area tests stay green):**

1. Both pages preserve the admin auth guard: non-admins redirected (`router.push("/")`), `return null` for the non-admin render path; the page-level guard is `isAuthenticated && isAdmin` (the `accessToken` gate lives inside `useApiClient` — do NOT add `accessToken` to the page guard expecting parity).
2. `admin/page.tsx` (dashboard): the 7 static navigation tiles/links render with their current labels (`t("<section>.title")` / `.description`) + hrefs (`/admin/users`, `/admin/audit`, `/admin/register`, `/admin/settings`, `/admin/backups`, `/admin/retention`, `/admin/health`); no data fetch. The static "Quick Info" block renders unchanged.
3. `admin/settings/page.tsx` (the THREE-TAB page) preserves all current behaviour exactly:
   - **Branding tab** (E9 SystemSettings): load `GET /api/v1/settings`, the 10 editable fields + live preview, the `primaryColor` hex-regex + `contactEmail` regex validation (blank → saved as `null`), save `PUT /api/v1/settings` (blanks→null), the logo upload as a SECOND request `POST /api/v1/settings/logo` (`api.upload`, FormData field `"file"`, the `LogoUploadState` machine + client type/size allowlist), and the **`refreshAppSettings()`** side effect after save.
   - **Custom Roles tab**: list `GET /api/v1/custom-roles`, create `POST /api/v1/custom-roles` (subset body, no `isActive`), edit `PUT /api/v1/custom-roles/{id}` (full form), inline delete-confirm → `DELETE /api/v1/custom-roles/{id}`, role/isActive badges, the role colour swatch (inline style from user data).
   - **Modules tab** (E10): load `GET /api/v1/module-settings`, the 7 module toggles, the disable-confirmation modal + advisory dependency warnings (e.g. finance↔events), `PUT /api/v1/module-settings/{key}` `{enabled}`, the **`refreshAppSettings()`** side effect, the no-spinner-reflash-on-refresh nuance.
   - Success/error banners stay **persistent (NO auto-dismiss timer, NO toast)** per tab; all i18n texts work as before.

**Improvements:**

4. `features/admin-settings/` slice exists mirroring the template:
   - `api/admin-settings-api.ts` — encapsulates the `/api/v1/settings`, `/settings/logo`, `/custom-roles`, `/module-settings` URLs (built on `useApiClient` — the page is ALREADY on the DEC-1 hook contract, no token-param module exists to wrap) + `adminSettingsKeys` (`settings`/`customRoles`/`modules`).
   - `hooks/` — `use-settings`+`use-update-settings`+`use-upload-logo`; `use-custom-roles`+`use-create-role`/`use-update-role`/`use-delete-role`; `use-modules`+`use-update-module`; mutations invalidate their keys AND call `refreshAppSettings()` where the god-page did (branding + module saves).
   - `schemas/` — `admin-settings.schema.ts` (branding form, RHF+Zod; port the hex + email regex as `.refine`, blank→null; **no `.trim()`/transform on submitted-byte fields — A96**; `<form noValidate>` renders field errors) + `custom-role.schema.ts` (the create/edit role modal form, A98 mode-divergent surfaces threaded; the `linkedRole` `<select>` widened to the full transport union + the out-of-set stored value rendered as an extra `<option>` per **A95**).
   - `components/` — `admin-dashboard` (the `admin/page.tsx` tile grid), `admin-settings-page-content` (tab shell), `branding-settings-form`, `custom-roles-tab` (+ `custom-role-form`/`role-badge`/inline delete-confirm), `modules-tab` (+ disable-confirm modal).
   - `types/admin-settings.types.ts` — `SystemSettings`/`CustomRole`/`ModuleSetting` types (define locally or re-export; there is no `lib/api` module — they live in the page today).
   - Both `admin/page.tsx` and `admin/settings/page.tsx` become thin entries (composition root is the only `"use client"`). ESLint boundary entry for `features/admin-settings`.
5. Manual→TanStack deltas (A79) decided explicitly (invalidate-on-save, mutation error surfaced, the persistent-banner behaviour preserved — do NOT silently swap to an auto-dismissing toast, the no-spinner-reflash module nuance, retry semantics; A99 status now available via `useApiClient` but preserve the existing generic-message UX unless a status distinction is wanted). Badges per DEC-2 (A77) — **map the `Vorstand → bg-blue-*` linked-role badge to a Badge variant/token, NOT raw blue** (the "no blue in authenticated UI" rule); active/inactive badges likewise.
6. The `apiRef`/`tRef` stable-ref dance the god-page used to keep effect deps empty is REMOVED (TanStack Query obviates it — do not port verbatim).
7. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files, no duplicate UI primitive; i18n parity stays green (reuse `settings.*` + `admin.*` + `common.*` keys, incl. the dynamic `modules.{key}.name`/`.description` keys).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E27-S1 settings specs green at HEAD. Confirm `features/admin-settings/` does NOT exist. Re-read `settings/page.tsx` (all 3 tabs) + `admin/page.tsx` + `AppSettingsProvider` + the sponsors/members form recipe (A56).
  - [ ] Resolve DEC-1..DEC-4 (recommended options below).
- [ ] Task 1: Scaffold slice `api` + `types` + `schemas` — `admin-settings-api.ts` (`adminSettingsKeys` + the 9 endpoints, URLs/bodies byte-identical; logo via `api.upload`) + types + the two schemas + `admin-settings-api.test.ts`.
- [ ] Task 2: Hooks — settings/customRoles/modules queries + their mutations + invalidation + `refreshAppSettings()` side effect on branding/module saves. `use-modules.test.tsx`.
- [ ] Task 3: Components — `admin-dashboard` (static tiles) + thin `admin/page.tsx` entry.
- [ ] Task 4: Components — `admin-settings-page-content` tab shell + `branding-settings-form` (RHF+Zod; hex/email `.refine`; logo upload machine + allowlist; live preview) + thin `admin/settings/page.tsx` entry.
- [ ] Task 5: Components — `custom-roles-tab` (table + `custom-role-form` RHF+Zod with A95 `linkedRole` widening + A98 mode props + inline delete-confirm + role badge A77) + `modules-tab` (toggles + disable-confirm modal + dependency warning). `custom-role-form.test.tsx`.
- [ ] Task 6: Green-the-net + DoD gate — E27-S1 settings specs green (extend only the licensed A79 surface; the existing `settings/page.test.tsx` mocks `useApiClient` — keep that seam working); new slice unit tests; `tsc`/eslint(slice+changed, E21-S5 boundary)/`vitest run` FULL green; LF. A79 deltas recorded.

## Dev Notes

The settings page is the second-largest admin surface (3 tabs, 5 endpoints, 2 modals, 3 state machines), NOT a single form — scope it as ~3 query keys + ~6 mutations. The dashboard is genuinely static (hooks-light). The branding + module saves couple to the global `AppSettingsProvider` (`refreshAppSettings()` re-fetches `/api/v1/settings/public`) — preserve that side effect or the app shell (logo/sidebar/module-gating) goes stale.

### Scope Boundaries

- In scope: `features/admin-settings/` (api/hooks/components/schemas/types) for `settings/page.tsx` + `admin/page.tsx`; thin route entries; ESLint boundary entry; new slice unit tests.
- Out of scope: the other admin areas (S2/S4/S5/S6); the public `/api/v1/settings/public` fetch inside `AppSettingsProvider` (consumed read-only via `refreshAppSettings()` — do NOT move it); `MODULE_KEYS` semantics / dependency rules (preserve); i18n key changes; any route-group move.

### Architecture Guardrails

- The page is ALREADY on the `useApiClient` (DEC-1) contract — build the slice api on `useApiClient`, do NOT invent a token-param `lib/api/settings.ts`. A94 "wrap" does not apply (nothing to wrap).
- A95: the `linkedRole` `<select>` must round-trip an out-of-set stored value (widen the Zod union to the full transport set + render the stored value as an extra `<option>`). A96: no `.trim()`/transform; `noValidate` renders field errors. A98: thread the role create/edit mode-divergent surfaces through props + pin both modes. A77: map the `Vorstand` blue badge to a token (no raw blue).
- Preserve: persistent (non-dismissing) banners; `refreshAppSettings()` after branding + module saves; the logo `LogoUploadState` machine + `ALLOWED_LOGO_TYPES`/`MAX_LOGO_SIZE_BYTES` client allowlist; the modules no-spinner-reflash nuance.
- DoD as E25 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) build the slice api on `useApiClient` (recommended — the page already uses it; `{data,error,status}` available, A99). B) introduce a token-param `lib/api/settings.ts` (regressive — diverges from the shipped DEC-1 contract). **Recommended: A.**
- **DEC-2 forms:** A) RHF+Zod for branding + custom-role forms (recommended — E22 sub-recipe; A95/A96/A98). B) keep manual `useState` + hand-rolled regex. **Recommended: A.**
- **DEC-3 badges:** A) map linked-role/active badges to Badge variants/tokens, A77-verified, **fixing the `Vorstand` blue → token** (recommended — epic improvement + the no-blue rule). B) keep raw colour strings. **Recommended: A.**
- **DEC-4 scope split:** A) keep `settings/page.tsx` (3 tabs) + `admin/page.tsx` (dashboard) in ONE `features/admin-settings` slice (recommended — they are the settings area; the dashboard is a 1-component tile grid). B) split the dashboard into its own slice. **Recommended: A.**

### Testing Requirements

- The E27-S1 settings specs are the oracle. The existing `settings/page.test.tsx` already mocks `useApiClient`/`useAuth`/`AppSettingsProvider`/`next-intl` and asserts exact URLs/bodies (`/api/v1/settings`, `/settings/logo`, `/module-settings/finance` `{enabled:false}`) — keep these seams + assertions green; the new Custom-Roles + auth-redirect + settings-error coverage S1 adds must also stay green.
- Add slice unit tests: `admin-settings-api` URL/key shape; `use-modules` invalidation + `refreshAppSettings` call; `branding-settings-form` (hex/email validation, blank→null, A96 field errors); `custom-role-form` (A95 out-of-set `linkedRole` round-trip, A98 mode props). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/admin-settings/{api,hooks,components,schemas,types}`; thin entries at `app/admin/page.tsx` + `app/admin/settings/page.tsx`.

### References

- Slice templates: `frontend/src/features/sponsors/` + `features/members/` (RHF+Zod forms + Badge tokens).
- Pages: `frontend/src/app/admin/settings/page.tsx` (3 tabs), `frontend/src/app/admin/page.tsx` (dashboard). Existing test: `frontend/src/app/admin/settings/page.test.tsx`.
- `frontend/src/components/providers/AppSettingsProvider.tsx` (`refreshAppSettings`); `frontend/src/lib/auth.ts` (useApiClient); `frontend/eslint.config.mjs` (E21-S5 boundary). `ModuleKeys`/`MODULE_KEYS` (E10).
- E27-S1; project-context.md A34/A56/A58/A72/A73/A77/A78/A79/A95/A96/A98/A99; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. HARD-ordered after E27-S1.
- **A56 findings (the epic skeleton badly under-described S3):** `settings/page.tsx` is a THREE-TAB page (branding/E9 + custom-roles CRUD + modules/E10), 5 endpoints across GET/PUT/POST/DELETE/upload, 2 modals, 3 state machines, couples to the global `AppSettingsProvider` via `refreshAppSettings()`. It is ALREADY on `useApiClient` (DEC-1) — no token-param module to wrap (A94 N/A); status is available but discarded (A99). `admin/page.tsx` IS purely static navigation (skeleton "hooks-light" correct). Branding + custom-role forms are manual `useState` + hand-rolled regex → RHF+Zod (A96/A98); the `linkedRole` `<select>` carries A95 out-of-set risk. Success/error banners are PERSISTENT (no toast/timer) — preserve. `Vorstand` linked-role badge uses `bg-blue-*` (A77 fix target). Existing `settings/page.test.tsx` covers branding+modules but NOT custom-roles/auth-redirect (S1 fills the gap). The `apiRef`/`tRef` dance is a workaround TanStack removes.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (admin settings 3-tab page + static dashboard → `features/admin-settings/` slice; DEC-1 build on useApiClient, DEC-2 RHF+Zod branding+role forms, DEC-3 Badge tokens incl. Vorstand-blue fix, DEC-4 one slice; A95 linkedRole widening, A96 no-trim, A98 role-form mode props; preserve refreshAppSettings + persistent banners + logo upload machine). Status ready-for-dev.
