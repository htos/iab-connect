# Story E29.S2: Documents — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E29-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the suppliers/sponsors/members/events slice recipe. Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract). Independent of E29-S3/S4 once S1 is green. **Shares `@/lib/services/documents.ts` + the `documents.*` i18n namespace with E29-S3 (Board Documents) — neither may break the shared seam (A62).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the member Documents browser refactored into a `src/features/documents/` feature-slice following the proven suppliers/sponsors shape,
so that the document browser matches the standard feature-slice architecture with no behaviour change.

## Acceptance Criteria

**Behaviour preserved (all E29-S1 documents tests stay green):**

1. Route `/documents`, the auth guard (`!isAuthenticated` → `/login`; **no role gate** — every authenticated user browses), documents + folders + tags load, server-side `search` (resets `page→1`) / `folderId` / single-`tags` (string) filters, folder navigation (into / up / root / breadcrumb), `pageSize=20` pagination, loading / error (`documents.loadError`) / empty (`documents.noDocuments`) states, the table render (name+inline tags, category hidden <md, size hidden <lg, de-CH date hidden <lg, download action), the authenticated blob download, the download-error banner (A76), and all `documents.*`/`common.*` i18n all work **exactly** as before. The E29-S1 documents spec stays green (transport-mock target re-pointed only — outcomes unchanged).

**Improvements:**

2. `app/documents/page.tsx` becomes a **thin entry** (no `"use client"`) rendering a `features/documents` content component (the only `"use client"` is the composition root) — mirroring `app/sponsors/page.tsx`.

3. A `features/documents/` slice exists mirroring `features/sponsors/`:
   - `api/documents-api.ts` — `const DOCUMENTS_BASE = "/api/v1/documents"` (+ `/api/v1/document-folders`, `/api/v1/documents/tags`), a `documentsKeys` query-key factory (`all` / `list(filters)` / `folders(parentId)` / `tags`), and fetch functions. **DEC-1 (transport)** decides whether these wrap the existing `@/lib/services/documents` functions or call `useApiClient` directly — see DEC block.
   - `hooks/use-documents.ts` (`useQuery` list), `hooks/use-document-folders.ts`, `hooks/use-document-tags.ts`, and `hooks/use-document-download.ts` (the authenticated-download side-effect, see DEC-2).
   - `components/` — `documents-page-content.tsx` (the single `"use client"` root holding the folder-nav + breadcrumb local state), `documents-filter-bar.tsx`, `documents-breadcrumb.tsx`, `documents-folder-grid.tsx`, `documents-table.tsx`, `document-download-button.tsx`.
   - `types/document.types.ts` — owning/re-exporting `DocumentDto`/`DocumentFolderDto`/`PagedDocumentsResult` shapes. **`@/lib/services/documents.ts` stays the transport seam — do not duplicate it; do not relocate its types into the slice if a sibling (board) still imports them from there** (DEC-3, the E23-S2/E24-S2 type-home pattern + the E21-S5 boundary: `lib` must not import `features`).

4. The **authenticated download** (dynamic `next-auth/react getSession()` → `fetch(getDownloadUrl(id))` with Bearer → `.blob()` → object-URL `<a download>` → revoke) is preserved behind `document-download-button` + `use-document-download`; the **download-error** branch is surfaced (A76) exactly as today (sets the page error banner; no button-disabled change unless DEC-2 chooses a mutation).

5. The folder-navigation + breadcrumb state (`currentPath: DocumentFolderDto[]` + `selectedFolder: string|null`) is preserved verbatim, kept **local to `documents-page-content`** (characterization-only; do NOT "fix" the dual-state to a URL param in this story). `startTransition`/manual `setLoading` plumbing is replaced by TanStack; the manual→TanStack deltas (A79) are decided explicitly: refetch-on-filter via query keys; the chosen retry / refetch-spinner / sticky-error semantics documented in Completion Notes.

6. i18n parity: reuse the existing `documents.*` keys (no renames/removals — the board page shares them, A62); if `frontend/messages/hi.json` lacks `documents.*` parity with `en.json`/`de.json` for the touched key set, bring it to parity and keep `frontend/messages/messages.parity.test.ts` green (hi.json may stay a subset, never a superset; record the prior baseline).

7. No new `any`, no new hard-coded user-facing strings, no new direct `/api/v1` URL in `page.tsx`, no duplicate UI primitive. The single-`tags` (string, not array) server filter and `pageSize=20` are preserved (do NOT convert to multi-select).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the three DECs (AC: all) — record A43 (a)/(b)/(c) per DEC
  - [ ] E29-S1 documents spec green at HEAD. Confirm `features/documents/` does NOT exist. Re-read `app/documents/page.tsx` + `lib/services/documents.ts` + `lib/services/api.ts` + the suppliers slice template (A56).
  - [ ] **DEC-1 (transport — wrap service vs. useApiClient):** see DEC block; recommended **A** (wrap the existing `@/lib/services/documents` fns inside `api/documents-api.ts` + a `documentsKeys` factory; do NOT re-implement the URLs nor migrate the service to `useApiClient`, because the board sibling shares the module — A62).
  - [ ] **DEC-2 (download location):** recommended **A** (extract `handleDownload` into a `use-document-download` hook behind `document-download-button` — a deterministic user-initiated side-effect, NOT a TanStack query/mutation cache entry).
  - [ ] **DEC-3 (type home):** recommended **MEMBERS/EVENTS re-export pattern** (canonical DTOs stay where `lib/services/documents` defines them; `types/document.types.ts` re-exports from `@/lib/services/documents` — `features → lib` is boundary-legal; a `lib → features` move would violate E21-S5 and break the board sibling).
- [ ] Task 1: Scaffold the slice `api` + `types` (AC: 3) — `documents-api.ts` (`DOCUMENTS_BASE`, `documentsKeys` {all/list(filters)/folders(parentId)/tags}, wrapped fetch fns — request URLs/params byte-identical incl. omitted-empty params + the single-`tags` string) + `types/document.types.ts` (re-export) + `documents-api.test.ts`.
- [ ] Task 2: Hooks (AC: 3, 4, 5) — `useDocuments(filters, enabled)` / `useDocumentFolders(parentId, enabled)` / `useDocumentTags(enabled)` queries (mirror suppliers `useQuery`; `enabled` gated on auth); `useDocumentDownload()` side-effect hook (token via dynamic `getSession`; error surfaced). `use-documents.test.tsx` (query error→surface; download error path).
- [ ] Task 3: Components (AC: 2, 3, 4, 5) — `documents-page-content.tsx` (single `"use client"`; holds `currentPath`/`selectedFolder`/`searchTerm`/`selectedTag`/`page` local state + the auth-guard redirect) composing `documents-filter-bar` / `documents-breadcrumb` / `documents-folder-grid` / `documents-table` / `document-download-button`. Preserve the de-CH date format, the responsive column hiding, and the up-button-only-when-`currentPath.length>0` rule.
- [ ] Task 4: Thin route entry (AC: 2) — `app/documents/page.tsx` → `<DocumentsPageContent/>` (no `"use client"`).
- [ ] Task 5: i18n parity (AC: 6) — fill any missing `documents.*` keys in hi.json to parity with en/de for the touched set; keep `messages.parity.test.ts` green; no key renames/removals (board shares the namespace).
- [ ] Task 6: Green-the-net + DoD gate (AC: 1, 7) — E29-S1 documents spec green (transport-mock re-pointed only); new slice unit tests; `npx tsc --noEmit` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` clean; `next build` succeeds; LF (A73). Record the A79 deltas chosen.

## Dev Notes

This is a **list-style slice over a pre-existing service module** — the new wrinkle vs Sponsors is wrapping `@/lib/services/documents.ts` (which itself wraps `lib/services/api.ts` `apiGet` with a dynamic `getSession()` token) inside the slice `api/` layer **without re-implementing it**, because the board sibling (S3) also consumes that module. The folder-navigation + breadcrumb state is the net-new local surface; keep it inside `documents-page-content`.

### Scope Boundaries

- In scope: `src/features/documents/` (`api`/`hooks`/`components`/`types`) for the single `/documents` page; the thin route entry; the slice-local breadcrumb/folder-nav state; new slice unit tests; hi.json `documents.*` parity.
- Out of scope: `app/board/documents/**` (that is S3); modifying `@/lib/services/documents.ts` in a way that breaks the board sibling (A62 — read-only-compatible only); any backend/route/API-contract change; the suppliers/sponsors/members/events slices; renaming/removing shared `documents.*` keys; converting the single-tag filter to multi-select.

### Architecture Guardrails

- Mirror the suppliers slice shape **exactly** (api → `*Keys` factory + wrapped fetch fns; hooks → `useQuery` + `enabled`; thin `"use client"` root; relative imports within the slice, never `@/features/*` cross-imports — E21-S5 ESLint boundary).
- `useApiClient` returns `{ data, error, status }` and **never throws** (auth.ts:169-295); but DEC-1=A keeps the transport on `@/lib/services/documents` (which returns `ApiResult<T>` `{success,data,error?,status?}`), so the hooks throw on `result.error`/`!result.success` to drive TanStack rejection. Keep the download token path (dynamic `getSession`) verbatim.
- Do NOT change request/response contracts when wrapping `documents.ts` — URLs, params, bodies byte-identical (the single-`tags` string param, the omitted-empty params, `pageSize=20`).
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; never repo-wide lint/format as the gate (A58/A72). New slice files may be `prettier --write` (new, not pre-drifted); for any *modified* pre-drifted file hand-match the surrounding style (A72). Keep files LF (A73).

### A62 cross-story note (shared module + namespace)

`@/lib/services/documents.ts` and the `documents.*` namespace are shared with E29-S3 (Board Documents). S2 wraps the member-browse functions (`getDocuments`/`getFolders`/`getAllTags`/`getDownloadUrl`) in the slice `api`; it must NOT delete/rename any export the board page still calls, nor rename/remove a `documents.*` key. S3 re-verifies what S2 shipped at its Task 0.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — slice `api` transport.** A) wrap the existing `@/lib/services/documents` fns + add `documentsKeys` (no URL re-impl, service untouched — sibling-safe). B) re-implement the URLs in `documents-api.ts` via `useApiClient` (diverges the member-browse transport from the shared module; risks board drift). C) migrate `lib/services/documents` itself to `useApiClient` (touches the board sibling — out of scope). **Recommended: A** (sibling-safe, mirrors how E24-S2 folded a shared service without rewriting it).
- **DEC-2 — download.** A) `use-document-download` hook wrapping the current blob/getSession/object-URL logic (side-effect, not cached). B) a TanStack `useMutation`. C) route through `useApiClient().get` blob. **Recommended: A** (downloads are user-initiated side-effects, not server state; keeps RQ cache clean; preserves the exact token-at-download-time behaviour).
- **DEC-3 — type home.** A) re-export DTOs from `@/lib/services/documents` via `types/document.types.ts` (boundary-legal `features→lib`; sibling-safe). B) relocate DTOs into the slice + re-export from `lib` (violates E21-S5 `lib→features`; breaks board). **Recommended: A** (the E23-S2/E24-S2 precedent).

### Testing Requirements

- The E29-S1 documents spec is the regression oracle — run it after every step; it must stay green (only the transport-mock target re-points from `@/lib/services/documents` to the slice `api`, per the E24-S1 note; outcomes unchanged).
- Add focused slice unit tests: `documents-api` URL/key shape (incl. omitted-empty params + single-tag string), a query hook (error→throw), the `use-document-download` hook (success creates+revokes object URL; error surfaced). A35/A46 cleanup; A78 stable mocks.

### Project Structure Notes

- Target tree: `src/features/documents/{api/documents-api.ts, hooks/use-documents.ts, use-document-folders.ts, use-document-tags.ts, use-document-download.ts, components/*.tsx, types/document.types.ts}`; thin entry at `app/documents/page.tsx`.

### References

- Slice templates: `frontend/src/features/suppliers/` (cleanest list slice), `frontend/src/features/sponsors/api/sponsors-api.ts` (`sponsorsKeys` :24-28 + `SPONSORS_BASE` :17 + fetch-fn-takes-`api` shape :30-33), `frontend/src/features/members/types/member.types.ts` + `frontend/src/features/events/types/events.types.ts` (the re-export type-home pattern for DEC-3), `frontend/src/app/sponsors/page.tsx` (thin entry).
- Page to migrate: `frontend/src/app/documents/page.tsx` (guard :40-44; loads :46-74; `pageSize=20` :53; folder nav :90-110; breadcrumb :159-186; download :112-132; table :300-403; error banner :221-225).
- Service to wrap (do NOT modify breaking): `frontend/src/lib/services/documents.ts` (`getDocuments` :173-191, `getFolders` :135-140, `getAllTags` :237-239, `getDownloadUrl` :279-288); `frontend/src/lib/services/api.ts` (`ApiResult<T>` :10-23; token via dynamic `getSession()` :32-37).
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` `{data,error,status}` contract); `frontend/eslint.config.mjs` (E21-S5 `@/features`/`lib`/cross-feature boundary rules :11-65); `frontend/messages/messages.parity.test.ts` (parity test; hi may be a subset).
- E29-S1 (`e29-s1-smaller-features-characterization-tests.md`) — the net; project-context.md A34/A56/A58/A62/A72/A73/A78/A79/A83/A84; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)".

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E29 preparation (front-loaded batch per A34). Status ready-for-dev. HARD-ordered after E29-S1 (net green at HEAD). Three DECs carry recommended options for A41/A32 dev-story resolution + A43 (a)/(b)/(c).
- **A56 spike findings (load-bearing):** documents is a clean greenfield slice (no existing tests/slice); the transport is `@/lib/services/documents` (NOT `useApiClient`), so DEC-1=A wraps rather than rewrites; the download is a raw-fetch+`getSession` side-effect (DEC-2=A hook); the `documents.*` namespace + the service module are SHARED with the board page (A62 — sibling-safe constraints). Single-tag (string) filter + `pageSize=20` are HEAD invariants to preserve.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (member Documents browser → `src/features/documents/` slice; DEC-1 wrap-shared-service, DEC-2 download-hook, DEC-3 type re-export; A62 shared `documents.ts` + `documents.*` namespace constraint vs the board sibling). Status ready-for-dev.
