# Story E27.S6: Admin Documents (Folder Manager) and Register (Public Signup) — Feature-Slice Extraction

Status: done

Depends on: **E27-S1 (the documents-area net must be green at HEAD first)**, plus E21-S3 + E21-S5 + the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions + the `features/admin-*` precedent from E27-S2. Independent of S2..S5 once S1 is green. **Final admin sub-slice — closes the area and enables the E27 boundary review.**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the admin documents page and the registration page refactored into a `features/admin-documents/` slice,
so that they match the proven slice pattern with behaviour preserved — based on what these pages ACTUALLY are (a folder/permission manager + a public self-signup form), not the upload/approve-reject surfaces the epic skeleton mistakenly assumed.

> **REALITY CORRECTION (A56 — the epic skeleton was wrong here):** `admin/documents/page.tsx` is a **FOLDER & PERMISSION manager (REQ-035)** — there is NO file upload, NO document list, NO delete-document, NO status badges. `admin/register/page.tsx` is the **PUBLIC self-signup FORM** (`POST /api/v1/registration`, unauthenticated) — NO registration entries, NO filters/pagination, NO approve/reject, NO auth guard. This story behaviour-preserves what EXISTS. Do NOT scaffold upload or approve/reject surfaces — they do not exist anywhere under `admin/`.

## Acceptance Criteria

**Behaviour preserved (all E27-S1 documents-area tests stay green):**

1. **Documents** (folder manager): the admin auth guard is preserved (non-admins redirected `router.push("/")`; page-level guard `isAuthenticated && isAdmin`; **note: this page does NOT early-return `null` for non-admins — it renders the spinner during the redirect; preserve that CURRENT behaviour, see DEC-3**). Folder list (`getFolders(parentId)`), drill-down + back-to-parent navigation, create-folder modal, edit-folder modal, set-permissions modal (Member `<select>` ""/Read/Write; Vorstand `<select>` ""/Read/Write/Manage), delete-folder (styled **modal**, not `window.confirm`, RED confirm; on failure the error shows and the row stays), permission chips, search box, loading/error/empty (`noFolders`/`noSubfolders`) — all work exactly as before.
2. **Register** (public signup form): NO auth guard (public). The 5-field form (firstName/lastName/email/password(min 8)/confirmPassword, all required), client validation (password mismatch, too-short), submit → `registerUser` → success screen, the error path incl. the `already exists` → `registration.emailExists` message, and the white-label branding (the existing test's REQ-086 surface) all work exactly as before.

**Improvements:**

3. `features/admin-documents/` slice exists mirroring the template:
   - `api/` — `admin-folders-api.ts` (encapsulates the `/document-folders` URLs via the SHARED `@/lib/services/documents` module — **WRAP it, do NOT relocate it (A62/A94): it is shared with the member `features/documents` slice; relocating into `features/admin-documents` would force a `features→features` import which E21-S5 forbids**) + `registration-api.ts` (wraps `@/lib/api/registration.registerUser`, a public throwing raw-fetch fn) + per-resource query-key factories.
   - `hooks/` — `use-folders` (list, parentId in key) + `use-create-folder`/`use-update-folder`/`use-delete-folder`/`use-set-folder-permissions` (invalidate `adminFoldersKeys`); `use-register` (mutation; public).
   - `schemas/` — `folder.schema.ts` (create/edit folder form, RHF+Zod; `name` required via `.min(1)`/`.refine`, **no `.trim()`/transform A96**) + `folder-permissions.schema.ts` (the two permission `<select>`s widened to the full `DocumentPermissionType` union + an out-of-set stored value rendered as an extra `<option>` per **A95**) + `registration.schema.ts` (the 5 fields + password-match `.refine` + min(8); RHF+Zod replacing the manual validation, A96 field errors).
   - `components/` — `admin-folders-page-content`/`folders-table`/`create-folder-dialog`/`edit-folder-dialog`/`folder-permissions-dialog`/`delete-folder-dialog` (preserve the RED modal confirm, A86); `register-page-content`/`register-form`/`register-success`. Each route file becomes a thin entry (composition root is the only `"use client"`). ESLint boundary entry for `features/admin-documents`.
   - `types/` — re-export `DocumentFolderDto`/`DocumentPermissionType`/`DocumentAccessRole` from `@/lib/services/documents` and `RegisterRequest`/`RegisterResponse` from `@/lib/api/registration` (A83 — `features→lib` legal).
4. Manual→TanStack deltas (A79) decided explicitly (invalidate-on-mutation; mutation error surfaced; the delete-folder "modal already closed before await, error shows but row stays" behaviour preserved; retry semantics; A99 — `ApiResult.status` / `ApiError.status` exist but are discarded at the UI, preserve the generic-message UX). The register page reads `error.detail` then `error.title` (A89) + string-sniffs `already exists` → keep that mapping. Permission chips → Badge variants/tokens per DEC-2 where applicable (A77; the chips are `bg-blue-100 text-blue-700` "role: permissionType" — map to a token, no raw blue); delete-folder destructive affordance tested (A76, preserve RED).
5. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files/components, no duplicate UI primitive; i18n parity stays green (reuse the root `documents.*` + `registration.*` + `common.*` keys — note `documents.adminTitle`="Folder Management").

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [x] E27-S1 documents specs green at HEAD. Confirm `features/admin-documents/` does NOT exist. Re-read `admin/documents/page.tsx` (folder manager) + `admin/register/page.tsx` (public form) + `@/lib/services/documents` (shared with member slice) + `@/lib/api/registration` + the existing member `features/documents` slice (A62 sibling-safety) + sponsors form recipe (A56).
  - [x] Resolve DEC-1..DEC-3 (recommended options below).
- [x] Task 1: Scaffold slice `api` (`admin-folders-api.ts` wrapping `@/lib/services/documents` folder fns + `registration-api.ts` wrapping `registerUser`) + `types` (re-export) + the 3 schemas + `*-api.test.ts`.
- [x] Task 2: Hooks — folders list + folder CRUD + permissions mutations (invalidation); register mutation. `use-folders.test.tsx`.
- [x] Task 3: Components — folders (page-content + table + drill-down/back + create/edit/permissions dialogs + RED delete modal + chips + search). `folder-permissions-dialog.test.tsx` (A95 out-of-set round-trip).
- [x] Task 4: Components — register (`register-form` RHF+Zod + `register-success` + the `already exists` mapping). `register-form.test.tsx`.
- [x] Task 5: Thin route entries (2 files) + Green-the-net + DoD gate — E27-S1 documents specs green (the existing `register/page.test.tsx` branding test stays green; documents folder specs added in S1 stay green); new slice unit tests; `tsc`/eslint(slice+changed, E21-S5 boundary)/`vitest run` FULL green; LF. A79 deltas recorded. **With S2..S6 merged the whole `admin/` route tree is feature-sliced → enables the E27 boundary review.**

## Dev Notes

The final admin sub-slice. The two pages share NOTHING functionally (a folder/permission CRUD manager + a public signup form) — they sit together only because the epic carved admin by leftover pages. The documents page's data layer (`@/lib/services/documents`) is SHARED with the member `features/documents` slice (A62) — WRAP it from the admin slice, do NOT move it (moving would break the member slice AND require a forbidden `features→features` import). The register page is public/unauthenticated — keep it unguarded.

### Scope Boundaries

- In scope: `features/admin-documents/` (api/hooks/components/schemas/types) for `admin/documents/page.tsx` (folder manager) + `admin/register/page.tsx` (public form); thin route entries; ESLint boundary entry; new slice unit tests.
- Out of scope: the other admin areas (S2..S5); **building a file-upload / document-list / approve-reject surface (NONE exist — the skeleton was wrong)**; relocating or forking `@/lib/services/documents` (shared with the member slice — wrap, don't move); the member `features/documents` slice; the document-level fns in `services/documents` (review/publish/archive/restore/tags — used by the member/board slices, not this admin folder page); i18n key changes; any route-group move.

### Architecture Guardrails

- A62/A94: WRAP `@/lib/services/documents` (folder fns) from `features/admin-documents/api/admin-folders-api.ts` — keep the canonical module in `@/lib/services` (a sibling member slice consumes it; `features→features` is forbidden by E21-S5). `registration.ts` is a public throwing raw-fetch fn → wrap it; keep the page unguarded.
- A95: the two permission `<select>`s round-trip an out-of-set stored `permissionType` (widen the union + extra `<option>`). A96: no `.trim()` on submitted-byte fields; `noValidate` renders field errors. A86: preserve the RED delete-folder modal confirm. A77: map the permission chips' `bg-blue-*` to a token. A89: keep the register `error.detail`→`error.title` + `already exists` mapping.
- Preserve the documents page's current non-`return null` redirect behaviour (DEC-3) unless the boundary review decides to align it with the sibling admin pages.
- DoD as E25 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 documents transport:** A) WRAP `@/lib/services/documents` folder fns + `adminFoldersKeys` (recommended — A62/A94; keeps the module shared-safe with the member slice). B) rewrite via `useApiClient` (orphans the shared module / risks divergence). **Recommended: A.**
- **DEC-2 register slice membership:** A) bring the public register form INTO `features/admin-documents` as a thin slice (RHF+Zod form + mutation), keeping it unguarded (recommended — it's the area's second page; minimal, behaviour-preserving). B) leave `admin/register/page.tsx` as a god-page (it's public + already branding-tested) and scope this story to documents only. **Recommended: A** (RHF+Zod is the epic goal; the form is small) — if B, record the register page as deferred residual.
- **DEC-3 documents unauth guard (A97):** A) preserve the CURRENT behaviour (renders spinner during redirect, no `return null`) (recommended — behaviour-preserving; flag for the boundary review). B) add the `return null` non-admin guard to match sibling admin pages (a behaviour change the S1 net pins — defer to the boundary review). **Recommended: A.**

### Testing Requirements

- The E27-S1 documents specs are the oracle — keep green; the licensed A79 surface is the transport-mock target + the folder-dialog/permissions/register-form mechanism. Auth gate (documents), folder CRUD + drill-down, the RED delete modal + failure branch, the permission `<select>`s, the public register form submit/validation/error + branding must stay green.
- Add slice unit tests: `admin-folders-api`/`registration-api` URL/key shape; a folder mutation invalidation; `folder-permissions-dialog` (A95 out-of-set round-trip); `register-form` (RHF+Zod password-match + min(8) + A96 field errors + `already exists` mapping). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/admin-documents/{api,hooks,components,schemas,types}`; thin entries at `app/admin/documents/page.tsx` + `app/admin/register/page.tsx`.

### References

- Slice templates: `frontend/src/features/documents/` (the MEMBER documents slice — A62 sibling that shares `@/lib/services/documents`; study its wrap pattern but do NOT import it), `features/sponsors/` (RHF+Zod form).
- Pages: `frontend/src/app/admin/documents/page.tsx` (folder manager), `frontend/src/app/admin/register/page.tsx` (public form). Existing test: `frontend/src/app/admin/register/page.test.tsx` (branding only).
- Shared service (WRAP, don't move): `frontend/src/lib/services/documents.ts` (`getFolders`/`createFolder`/`updateFolder`/`deleteFolder`/`setFolderPermissions` + `DocumentFolderDto`/`DocumentPermissionType`/`DocumentAccessRole`). Public fn: `frontend/src/lib/api/registration.ts` (`registerUser`).
- `frontend/src/lib/auth.ts` (useAuth); `frontend/eslint.config.mjs` (E21-S5 boundary).
- E27-S1; project-context.md A34/A56/A58/A62/A72/A73/A77/A78/A79/A83/A86/A89/A94/A95/A96/A97; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. HARD-ordered after E27-S1. Final admin sub-slice → enables the E27 boundary review.
- **A56 findings (BIGGEST epic-skeleton divergence — the skeleton's S6 ACs describe surfaces that do not exist):** `admin/documents/page.tsx` is a FOLDER & PERMISSION manager (REQ-035) — NO file upload, NO document list, NO delete-document, NO status badges (the skeleton's "file-upload net-new surface" is fictional). `admin/register/page.tsx` is the PUBLIC self-signup FORM (`POST /api/v1/registration`, unauthenticated) — NO entries/filters/pagination/approve-reject, NO auth guard (the `admin.register` i18n description "Manage and approve new user registrations" is aspirational/misleading; the test confirms branding-only). Documents transport = `@/lib/services/documents` (ApiResult `{success,data,error}`, SHARED with the member `features/documents` slice → A62: WRAP, do NOT move). registration = raw fetch that THROWS, reads `error.detail`→`error.title` (A89) + string-sniffs `already exists`. documents has TWO permission `<select>`s (A95 out-of-set risk). delete-folder = RED modal (not `confirm()`, A86 preserve). documents page does NOT early-return `null` for non-admins (renders spinner during redirect — diverges from siblings; DEC-3). Permission chips = `bg-blue-*` (A77). Status discarded at the UI (A99). register has a branding test; documents has none (S1 writes it).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (orchestrator) + a dedicated general-purpose subagent for the slice extraction.

### Debug Log References

- DEC-1 = **A** (WRAP the shared `@/lib/services/documents` folder fns + own `adminFoldersKeys`; A62/A94 — module stays shared-safe with the members slice).
- DEC-2 = **A** (bring the public register form INTO the slice as a thin unguarded sub-area).
- DEC-3 = **A** (preserve the documents page's CURRENT non-`return null` redirect — renders the spinner shell while `push("/")`; flagged for the boundary review).

### Completion Notes List

- **The documents folder/permission manager + the public register signup form extracted into `features/admin-documents/{api,hooks,components,schemas,types}`; the A56 reality corrections carried through.** Scoped gate = 7 files / 61 tests green (36 S1 oracle + 25 new slice tests). Central full-suite + tsc + eslint + prettier all green.
- Reality preserved: documents = folder/permission manager (NO upload / doc-list / status badges); register = public unauthenticated signup (NO guard / approve-reject). `api/admin-folders-api.ts` wraps the shared service folder fns + `adminFoldersKeys`; `api/registration-api.ts` wraps public `registerUser`. Folder mutations (create/update/delete/set-permissions) go through TanStack hooks with invalidation; the imperative folder-list useState/useEffect + subfolder-count `Promise.all` probe is kept verbatim (S1 pins it).
- Behaviour-locked: the RED delete-folder STYLED modal (`bg-red-600`, not `window.confirm`) + the close-before-await failure path (modal closed before the error surfaces); permission chips remapped raw `bg-blue-*` → token-backed `Badge variant="secondary"` (text unchanged, A77); A95 out-of-set `permissionType` round-trip (extra `<option>` + verbatim re-save); A96 no-`.trim()` on folder name + register fields.
- **A79 deltas:** the register form keeps the god-page's SYNCHRONOUS single-banner validation — RHF+zodResolver is async and drops the HTML `required`/`minLength=8` the oracle pins, so the register form uses controlled inputs + a synchronous Zod `safeParse` (schema-sourced per A96) while preserving the HTML attributes + the mismatch-then-too-short priority; and it calls `registerUser` with local `isSubmitting` (NOT a TanStack mutation) because the register oracle renders with no `QueryClientProvider`. A `key={editFolder.id}` re-inits RHF `defaultValues` across folders.
- **S1 oracle changes: NONE** (documents 27/27, register 9/9 unmodified; the service/registration mocks keep intercepting). **Residual debt:** the documents non-`return null` redirect divergence from sibling admin pages (DEC-3=A — deferred to the E27 boundary review).

### File List

NEW — `frontend/src/features/admin-documents/`:

- `types/admin-documents.types.ts`
- `api/admin-folders-api.ts`, `api/admin-folders-api.test.ts`, `api/registration-api.ts`, `api/registration-api.test.ts`
- `schemas/folder.schema.ts`, `schemas/folder-permissions.schema.ts`, `schemas/registration.schema.ts`
- `hooks/use-folders.ts`, `hooks/use-folder-mutations.ts`, `hooks/use-folder-mutations.test.tsx`
- `components/`: `admin-folders-page-content.tsx`, `folders-table.tsx`, `folder-form-dialog.tsx`, `folder-permissions-dialog.tsx`, `folder-permissions-dialog.test.tsx`, `delete-folder-dialog.tsx`, `register-page-content.tsx`, `register-form.tsx`, `register-form.test.tsx`, `register-success.tsx`

MODIFIED (thin route entries):

- `frontend/src/app/admin/documents/page.tsx`, `frontend/src/app/admin/register/page.tsx`

## Change Log

- 2026-06-12: Story created (admin documents folder-manager + public register form → `features/admin-documents/` slice; REALITY-CORRECTED per A56 — no upload/no approve-reject; DEC-1 WRAP shared @/lib/services/documents (A62), DEC-2 bring register in as RHF+Zod thin slice, DEC-3 preserve documents non-return-null redirect; A95 permission-select widening, A96 no-trim, A89 register error mapping; preserve RED delete-folder modal). Status ready-for-dev. Final sub-slice → enables E27 boundary review.
- 2026-06-12: Implemented — documents folder-manager + public register form → `features/admin-documents/` slice (WRAP shared `lib/services/documents`; RED delete-folder modal + close-before-await preserved; register sync-safeParse validation A96; A95 permission round-trip). +25 slice tests; S1 oracle unchanged (36 green); central full-suite / tsc / eslint / prettier green. DEC-1..3 = A. Status review. Final sub-slice → whole admin/ tree is feature-sliced; enables E27 boundary review.
