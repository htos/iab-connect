# Story E29.S2: Documents — Feature-Slice Extraction

Status: done

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

- [x] Task 0: Verify prerequisites + resolve the three DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [x] E29-S1 documents spec green at HEAD. Confirmed `features/documents/` did NOT exist. Re-read `app/documents/page.tsx` + `lib/services/documents.ts` + `lib/services/api.ts` + the suppliers slice template (A56).
  - [x] **DEC-1 RESOLVED → A:** slice `api/documents-api.ts` WRAPS the existing `@/lib/services/documents` fns + a `documentsKeys` factory; `lib/services/documents.ts` untouched (sibling-safe for E29-S3 per A62).
  - [x] **DEC-2 RESOLVED → A:** `hooks/use-document-download.ts` side-effect behind `components/document-download-button.tsx`; not cached.
  - [x] **DEC-3 RESOLVED → A:** `types/document.types.ts` re-exports `DocumentDto`/`DocumentFolderDto`/`PagedDocumentsResult` from `@/lib/services/documents` (`features→lib` legal).
- [x] Task 1: Scaffold the slice `api` + `types` (AC: 3) — `documents-api.ts` (`DOCUMENTS_BASE`, `documentsKeys` {all/list(filters)/folders(parentId)/tags}, wrapped fns — URLs/params byte-identical incl. omitted-empty params + single-`tags` string) + `types/document.types.ts` (re-export) + `documents-api.test.ts` (9 tests).
- [x] Task 2: Hooks (AC: 3, 4, 5) — `use-documents` / `use-document-folders` / `use-document-tags` queries (`enabled` gated on auth; throw on `!result.success`); `use-document-download` side-effect (dynamic `getSession` token; error surfaced to caller). `use-documents.test.tsx` (6 tests: success/error-throw/disabled + tags-disabled + download success-revoke / error-surfaced).
- [x] Task 3: Components (AC: 2, 3, 4, 5) — `documents-page-content.tsx` (single `"use client"`; holds currentPath/selectedFolder/searchTerm/selectedTag/page + the `!isAuthenticated→/login` guard + authLoading spinner) composing `documents-filter-bar` / `documents-breadcrumb` / `documents-folder-grid` / `documents-table` / `document-download-button`. Preserved de-CH date, responsive column hiding, up-button-only-when-currentPath.length>0, single-tag string, pageSize=20, the dual currentPath/selectedFolder state.
- [x] Task 4: Thin route entry (AC: 2) — `app/documents/page.tsx` → `<DocumentsPageContent/>` (no `"use client"`).
- [x] Task 5: i18n parity (AC: 6) — NO message-file change needed: the refactor reuses existing `documents.*`/`common.*` keys (en↔de parity holds; hi may stay a subset — parity test green). No keys added/renamed/removed.
- [x] Task 6: Green-the-net + DoD gate (AC: 1, 7) — E29-S1 documents spec **21/21 green UNCHANGED** (DEC-1=A kept the transport on the mocked module → zero spec edits, A87 validated); new slice unit tests (15); full suite **780 passed / 93 files** (765 + 15, zero regressions); `tsc --noEmit` clean; `eslint` exit 0 on slice+page+spec; `prettier --write` new files + `--check` modified page clean; LF. A79 deltas recorded. (`next build` deferred to the epic boundary per A58.)

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

claude-opus-4-8[1m] (dev-story orchestration + 1 general-purpose sub-agent for the full slice extraction).

### Debug Log References

**DEC-1/2/3 (all = recommended A) — per A43, autonomous mode ("für das ganze epic … ohne stop"):**
- **DEC-1 (transport) = A:** (a) `api/documents-api.ts` wraps `@/lib/services/documents` + adds `documentsKeys`; `lib/services/documents.ts` untouched. (b) the board page (E29-S3) shares the module (A62); rewriting to `useApiClient` would diverge the transport + the user pre-declared autonomous mode + the story recommended A. (c) the S1 spec's `vi.mock("@/lib/services/documents")` still intercepts byte-for-byte → the net stayed green with ZERO behavioural-assertion edits (A87 validated).
- **DEC-2 (download) = A:** (a) `use-document-download.ts` side-effect hook behind `document-download-button.tsx`; error returned to caller, not cached/thrown. (b) a download is a user-initiated side-effect, not server state. (c) RQ cache clean; click-time token behaviour preserved; A76 error banner driven via the button's `onError`.
- **DEC-3 (type home) = A:** (a) `types/document.types.ts` re-exports from `@/lib/services/documents`. (b) `features→lib` legal; a `lib→features` move violates E21-S5 + breaks the board sibling. (c) mirrors E23-S2/E24-S2; ESLint boundary clean.

### Completion Notes List

- **Behaviour preserved (AC-1): all 21 E29-S1 documents tests pass UNCHANGED** — the spec was authored forward-compatibly (QueryClientProvider wrapper, mocked at `@/lib/services/documents`), and DEC-1=A keeps the transport on that exact module, so the mock still intercepts. `app/documents/page.test.tsx` was not edited. This is the A87 proof: a green characterization net + the provider seam = behaviour-preservation evidence with no harness rework.
- **A79 deltas (AC-5):** manual `setLoading`/`startTransition` → TanStack; refetch-on-filter via `documentsKeys.list({page,pageSize,search,folderId,tags})` (all server filters in the key; tags now an independent cached query vs the god-page's parallel-on-every-load); loading spinner mapped to `query.isLoading`; folders/tags failures stay silent (matching the god-page `if(result.success)` no-op); the A76 download error is a separate sticky `downloadError` state taking precedence over the list error, cleared on next filter/nav.
- **i18n:** no message-file change — reuses existing `documents.*`/`common.*` keys (en↔de parity holds; `hi.documents` empty, which the parity test permits). No keys added/renamed/removed (sibling-safe for S3, A62).
- **Gates:** full suite **780 passed / 93 files** (765 baseline + 15 new slice tests; zero regressions); `tsc --noEmit` clean; `eslint` exit 0; `prettier --check` clean on the modified page (only NEW slice files were `--write`, per A72); LF (A73). Orchestrator re-verified the full suite + tsc + eslint independently.

### File List

**New — slice (`frontend/src/features/documents/`):**
- `api/documents-api.ts`, `api/documents-api.test.ts`
- `types/document.types.ts`
- `hooks/use-documents.ts`, `hooks/use-document-folders.ts`, `hooks/use-document-tags.ts`, `hooks/use-document-download.ts`, `hooks/use-documents.test.tsx`
- `components/documents-page-content.tsx`, `components/documents-filter-bar.tsx`, `components/documents-breadcrumb.tsx`, `components/documents-folder-grid.tsx`, `components/documents-table.tsx`, `components/document-download-button.tsx`

**Modified — thin route entry:** `frontend/src/app/documents/page.tsx`

**Untouched (A62 sibling-safe):** `frontend/src/lib/services/documents.ts`; `frontend/src/app/documents/page.test.tsx` (E29-S1 net, unchanged + green).

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e29-s2 → review).

## Change Log

- 2026-06-12: Story created (member Documents browser → `src/features/documents/` slice; DEC-1 wrap-shared-service, DEC-2 download-hook, DEC-3 type re-export; A62 shared `documents.ts` + `documents.*` constraint vs the board sibling). Status ready-for-dev.
- 2026-06-12: Implemented. Slice scaffolded (api/types/hooks/components); page → thin entry; DEC-1/2/3=A. E29-S1 documents net 21/21 green UNCHANGED (A87); +15 slice tests; full suite 780 green; tsc/eslint/prettier clean. No i18n change (reused keys). Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-12

**Outcome: Approved.** Clean list-style slice wrapping the shared `lib/services/documents.ts` (A62 sibling-safe — service untouched). DEC-1/2/3=A correct; the S1 net stayed green unchanged (A87 proof). No findings against S2. Full review: `epic-29-boundary-review-2026-06-12.md`.
