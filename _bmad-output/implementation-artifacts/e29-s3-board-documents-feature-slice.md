# Story E29.S3: Board Documents — Feature-Slice Extraction (list + detail, full surface)

Status: done

Depends on: **E29-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed), the E22 RHF+Zod form sub-recipe (closed — reused for the tag-edit form), and the suppliers/sponsors/events detail-slice recipe. Inherits E21-S1 boundary decisions (DEC-1 `useApiClient`, DEC-2 status/destructive colours). **Shares `@/lib/services/documents.ts` + the `documents.*` i18n namespace with E29-S2 (Documents) — re-verify at Task 0 what S2 actually shipped before depending on it (A62).** Independent of S2/S4 once S1 is green.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the Board Documents list and detail pages refactored into a `src/features/board-documents/` feature-slice following the proven slice shape,
so that the board-only document surface (browse, upload, status workflow, versioning) matches the standard architecture with behaviour preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E29-S1 board-documents tests stay green):**

1. `/board/documents` (list) works **exactly** as before: the Vorstand/Admin-only auth guard (`!isAuthenticated || (!isVorstand && !isAdmin)` → `router.push("/")` — see invariant below), list load (`getDocuments` with `search`/`status`/`category`/`folderId` params, each resetting `page→1`), `getAllTags`, pagination, folder navigation + breadcrumb, the **upload modal** (`FormData` name/folderId/category/description/tags + raw-fetch `getSession()` token → success resets form + refetch / `uploadError`), the upload-button-disabled-without-folder rule + `selectFolderFirst`, the **status-change actions** (`reviewDocument`/`publishDocument`/`archiveDocument` conditional on `doc.status` → refetch + `statusChanged`/`statusChangeError`), **delete** (confirm → `deleteDocument` → refetch + `deleteSuccess`/`deleteError`), the row → `/board/documents/{id}` link, and loading/empty/`loadError` states.

2. `/board/documents/[id]` (detail) works **exactly** as before: the same Vorstand/Admin gate, `getDocumentById` load, the **404/not-found** view, the header + status badge + metadata grid (category/size/de-CH date/content-type), **download current + per-version** (raw-fetch blob → object-URL anchor; `downloadError` — A76), the **tag-edit** toggle + `updateDocumentTags` save → refetch, the **version-upload modal** (`FormData` file+comment → refetch / `uploadError`), the **status transitions** conditional on `document.status`, the **version history** list (latest highlighted; Restore on non-latest → confirm modal → `restoreVersion` → refetch), and the success/error toast auto-dismiss timers.

**CRITICAL behavioural invariant (do NOT widen or narrow):**

3. The **board-only access rule is Vorstand OR Admin on BOTH pages** (`board/documents/page.tsx:62-65`, `board/documents/[id]/page.tsx:53-56`). Members must remain redirected to `/` with no list/detail fetch. The slice extraction must preserve this exactly — it is the single load-bearing access invariant of the epic's board surface.

**Improvements:**

4. Each route file (`board/documents/page.tsx`, `board/documents/[id]/page.tsx`) becomes a **thin entry** rendering a `features/board-documents/components` content component (the composition root is the only `"use client"`).

5. A `features/board-documents/` slice exists mirroring `features/sponsors/` (list + detail, the fullest E29 slice):
   - `api/board-documents-api.ts` — encapsulated `/api/v1/documents…` URLs (list with board filters, get-by-id, review/publish/archive/delete, `updateDocumentTags`, `restoreVersion`, the download URLs, and the upload/version-upload `FormData` endpoints) + a `boardDocumentsKeys` query-key factory (`all` / `list(filters)` / `detail(id)`). **DEC-1 (transport)** — see DEC block.
   - `hooks/` — `use-board-documents` (list `useQuery`), `use-board-document` (get-by-id `useQuery` with a `BoardDocumentNotFoundError` for 404, mirroring `SupplierNotFoundError`/`EventNotFoundError`), and mutations for status-change / delete / tag-update / restore / upload / version-upload (`useMutation` + `invalidateQueries` on `boardDocumentsKeys.all` and `detail(id)`), plus a `use-board-document-download` side-effect hook (mirrors E29-S2 DEC-2).
   - `schemas/board-document.schema.ts` — Zod for the **tag-edit** form (and the upload-metadata form if it adopts RHF+Zod per DEC-2) — behaviour-preserving (the current tag editor is a free-text comma-list).
   - `components/` — `board-documents-page-content.tsx` (list root), `board-documents-filter-bar.tsx`, `board-documents-table.tsx`, `board-document-upload-dialog.tsx`, `board-document-detail.tsx`, `board-document-version-history.tsx`, `board-document-tag-editor.tsx`, `board-document-download-button.tsx`, plus the status-action + delete + restore confirm affordances.
   - `types/board-document.types.ts` — re-exporting/owning `DocumentDto`/`DocumentDetailDto`/`DocumentVersionDto`/`DocumentStatus` shapes from `@/lib/services/documents` (DEC-3 = the E23-S2/E24-S2 re-export pattern; `lib` must not import `features`).

6. The destructive **delete** affordance gets the `destructive` (red) Radix dialog variant **only if the HEAD surface had no explicit colour** (A86 — contextual: preserve an existing colour, introduce `destructive` only where a bare `confirm()` is being replaced). The current delete is a `confirm()` dialog → introduce the `destructive` variant; the per-version **Restore** and status actions keep their current (non-destructive) styling.

7. The manual→TanStack deltas (A79) are decided explicitly: list/detail query keys; status/tag/restore/upload as mutations invalidating the right keys; the chosen retry / refetch-spinner / sticky-error semantics + the toast-timer treatment documented in Completion Notes. The status-action visibility tied to `doc.status` string literals should map onto the `DocumentStatus` enum (no behaviour change).

8. i18n parity: reuse the existing `documents.*` keys (no renames/removals — S2 shares them, A62); the one hard-coded `"Document not found"` fallback (`[id]/page.tsx:65`) is replaced with the existing `documents.notFound` key (a behaviour-equivalent i18n fix, recorded); if `hi.json` lacks `documents.*` parity for the touched set, bring it to parity and keep `messages.parity.test.ts` green.

9. No new `any`, no new hard-coded user-facing strings (the `notFound` fix aside), no new direct `/api/v1` URL in route files, no duplicate UI primitive.

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [x] E29-S1 board specs green at HEAD. Confirmed `features/board-documents/` did NOT exist. **A62 re-verified:** E29-S2 wrapped `getDocuments`/`getFolders`/`getAllTags`/`getDownloadUrl` in `features/documents/api` (root key `["documents"]`), re-exported types, left `lib/services/documents.ts` UNTOUCHED. The board slice owns a DISTINCT `boardDocumentsKeys` (root `["board-documents"]`) → no collision; service confirmed untouched.
  - [x] **DEC-1 RESOLVED → A:** slice `api` wraps the existing `@/lib/services/documents` fns; raw-fetch upload/version-upload/download moved into the slice keeping the exact `getSession()` Bearer + `FormData` shape; `lib/services/documents.ts` untouched (sibling-safe).
  - [x] **DEC-2 RESOLVED → A:** E22 RHF+Zod for tag-editor + upload-metadata + version-comment forms (behaviour-preserving — free-text comma tags, validation only where the HTML form required).
  - [x] **DEC-3 RESOLVED → A:** `types/board-document.types.ts` re-exports `DocumentDto`/`DocumentDetailDto`/`DocumentVersionDto`/`DocumentStatus`/etc. from `@/lib/services/documents`.
- [x] Task 1: Scaffold slice `api` + `types` + `schemas` (AC: 5) — `board-documents-api.ts` (`boardDocumentsKeys` {all/list(filters)/detail(id)} + wrapped fns + raw-fetch upload/version-upload/download, byte-identical) + `types/board-document.types.ts` (re-export) + `schemas/board-document.schema.ts` + `board-documents-api.test.ts` (17 tests).
- [x] Task 2: Hooks (AC: 5, 6, 7) — `use-board-documents` list query; `use-board-document` detail query (+`BoardDocumentNotFoundError`); `use-board-document-mutations` status/delete/tag/restore/upload/version-upload with invalidation (`all` + `detail(id)`); `use-board-document-download` side-effect. `use-board-document.test.tsx` (9 tests: 404→NotFoundError + a mutation invalidation).
- [x] Task 3: Components — list (AC: 1, 3, 4, 5, 6) — `board-documents-page-content.tsx` (single `"use client"`; Vorstand/Admin guard VERBATIM; filter/folder/page state) + `board-documents-filter-bar` + `board-documents-table` + `board-document-upload-dialog` (RHF+Zod) + `board-document-delete-dialog` (A86 Radix `destructive`). Status actions gated by `DocumentStatus`; upload-disabled-without-folder + `selectFolderFirst` preserved; row→detail nav.
- [x] Task 4: Components — detail (AC: 2, 3, 4, 5, 6) — `board-document-detail.tsx` + `board-document-version-history.tsx` + `board-document-version-dialog.tsx` + `board-document-restore-dialog.tsx` + `board-document-tag-editor.tsx` (RHF+Zod, 5 tests) + `board-document-download-button.tsx`. Preserved 404 view, metadata grid (de-CH), download current+per-version + `downloadError`, version-upload, status transitions, restore confirm, 3000 ms toast auto-dismiss.
- [x] Task 5: Thin route entries + i18n (AC: 4, 8) — `board/documents/page.tsx` → `<BoardDocumentsPageContent/>`; `board/documents/[id]/page.tsx` → `use(params)` + `<BoardDocumentDetail id=.../>`. Hardcoded `"Document not found"` replaced by the existing `documents.notFound` key. NO i18n file change (reused keys; en↔de parity holds; hi subset permitted) — parity test green.
- [x] Task 6: Green-the-net + DoD gate (AC: 1, 2, 9) — board S1 suites **55 green** (list 33 UNCHANGED; detail 22 — one mechanism re-point: `useParams`→`use(params)` contract; ALL behavioural assertions preserved); +31 slice unit tests; full suite **811 passed / 96 files** (780 + 31, zero regressions); `tsc --noEmit` clean; `eslint` exit 0; `prettier --write` new + `--check` modified clean; LF; service untouched (A62). (`next build` deferred to epic boundary per A58.)

## Dev Notes

This is the **fullest** E29 slice — a list **and** a detail with upload, status workflow, versioning, and tag-editing. The A56 spike found the board surface is far richer than a "smallest list+detail slice": it has the same shape as the sponsors detail slice (mutation-heavy detail) PLUS file upload + version history. Treat it as the events/sponsors detail-slice peer, not a trivial two-pager.

### Scope Boundaries

- In scope: `src/features/board-documents/` (`api`/`hooks`/`components`/`schemas`/`types`) for both board pages; thin route entries; the `notFound` i18n fix; new slice unit tests; hi.json `documents.*` parity for the touched set.
- Out of scope: `app/documents/**` (member browser — S2); modifying `@/lib/services/documents.ts` in a way that breaks the S2 sibling (A62); any backend/route/API-contract change (the upload/version/status/restore endpoints stay byte-identical); renaming/removing shared `documents.*` keys; the suppliers/sponsors/members/events slices.

### Architecture Guardrails

- Mirror the sponsors **detail** slice exactly (api → `*Keys` + wrapped fns; hooks → query + `NotFoundError` + mutations + invalidation; thin `"use client"` root; relative intra-slice imports only — E21-S5 boundary).
- The upload/version-upload paths use raw `fetch` + `FormData` + `getSession()` today (the service module's `apiPost` can't carry `FormData`); preserve that exact shape inside the slice `api`/hook (or `useApiClient().upload` if S2 proved it). Keep the download token-at-click behaviour verbatim.
- A86 (contextual destructive colour): introduce the red `destructive` variant for the delete confirm (it replaces a bare `confirm()`); do NOT recolour the status actions or Restore.
- Do NOT change request/response contracts — list filter params, get-by-id, status POST URLs, `updateDocumentTags` PUT body `{tags}`, `restoreVersion` URL, the download URLs, the upload `FormData` field set — all byte-identical.
- DoD as E29-S2 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### A62 cross-story note (shared module + namespace + sibling re-verification)

`@/lib/services/documents.ts` + `documents.*` are shared with E29-S2. **Task 0 MUST re-verify what S2 shipped** (which fns it wrapped/left intact, whether it touched the module) before this story wraps the board-specific fns — a sibling story's DEC is not a delivered contract (A62). Neither slice may rename/remove a shared `documents.*` key. If S2 and S3 land in either order, the shared module stays untouched by both (DEC-1=A wraps, never rewrites).

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — slice `api` transport.** A) wrap existing `@/lib/services/documents` fns + a `boardDocumentsKeys` factory; keep raw-fetch upload/download in the slice with the exact `getSession()`/`FormData` shape. B) migrate all calls to `useApiClient` (+ `useApiClient().upload` for `FormData`). **Recommended: A** (sibling-safe; B only if E29-S2 already proved the `useApiClient().upload` path cleanly).
- **DEC-2 — upload-metadata + tag forms.** A) adopt E22 RHF+Zod (epic goal; behaviour-preserving). B) keep manual `useState`. **Recommended: A.**
- **DEC-3 — type home.** A) re-export from `@/lib/services/documents` (boundary-legal, sibling-safe). B) relocate into the slice (violates E21-S5; breaks S2). **Recommended: A.**

### Testing Requirements

- The E29-S1 board specs are the regression oracle — keep green; only the transport-mock target re-points and the delete/upload/restore *mechanism* assertions are the licensed-update surface (per the S1 A76/A79/A80 note). The Vorstand/Admin gate, fetch URLs, navigation, status-action visibility, version-history render, and download outcomes must stay green verbatim.
- Add focused slice unit tests: `board-documents-api` URL/key shape (list filters + status POSTs + tags PUT + restore + download URLs); a query hook (404→`BoardDocumentNotFoundError`); a mutation hook (invalidation); the tag-editor RHF+Zod (mirror `sponsor-form.test.tsx`). A35/A46 cleanup; A78 stable mocks.
- A80: the delete destructive affordance + the delete-failure branch must be pinned on the surface they appear (list delete) — do not leave a destructive surface unpinned.

### Project Structure Notes

- Target tree: `src/features/board-documents/{api/board-documents-api.ts, hooks/use-*.ts, components/*.tsx, schemas/board-document.schema.ts, types/board-document.types.ts}`; thin entries at `app/board/documents/{page.tsx, [id]/page.tsx}`.

### References

- Slice templates: `frontend/src/features/sponsors/` (detail-mutations + `sponsor-detail.tsx` + `sponsor-form.test.tsx`), `frontend/src/features/events/` (detail slice + `EventNotFoundError` + `types/events.types.ts` re-export), `frontend/src/features/suppliers/` (list slice).
- Pages to migrate: `frontend/src/app/board/documents/page.tsx` (guard :62-65; load :67-89; upload :134-151,271-397; status actions :157-190; delete; folder nav :192-208; breadcrumb :401-427; row→detail :645), `frontend/src/app/board/documents/[id]/page.tsx` (guard :53-56; `getDocumentById` :58-65; 404 view :185-191; download :152-172; tag edit :136-150,301-345; version upload :102-118,348-432; restore :124-134,494-536; version history :435-490; status transitions :258-297; toasts auto-dismiss :85/116/130/146/171; the `"Document not found"` literal :65).
- Service to wrap (do NOT modify breaking): `frontend/src/lib/services/documents.ts` (`getDocuments`, `getFolders`, `getAllTags`, `getDocumentById`, `reviewDocument`/`publishDocument`/`archiveDocument`/`deleteDocument`, `updateDocumentTags`, `restoreVersion`, `getDownloadUrl`); `frontend/src/lib/services/api.ts` (`ApiResult<T>`; token via dynamic `getSession()`).
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` `{data,error,status}` + `upload`/`uploadFile` :233-277); `frontend/eslint.config.mjs` (E21-S5 boundary :11-65); `frontend/messages/messages.parity.test.ts` (hi may be a subset).
- E29-S1 + E29-S2; project-context.md A34/A56/A58/A62/A72/A73/A78/A79/A80/A83/A84/A86; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)" + "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E29 preparation (front-loaded batch per A34). Status ready-for-dev. HARD-ordered after E29-S1. Three DECs carry recommended options for A41/A32 + A43 (a)/(b)/(c).
- **A56 spike divergence from the epic skeleton (load-bearing; do NOT regress to the AC literal):** the E29 skeleton called this "the smallest full E22-shaped slice... no forms here, so no RHF/Zod". The SHIPPED board surface is the OPPOSITE — the largest E29 slice: list has an upload modal (FormData) + status workflow (review/publish/archive) + delete + folder nav; detail has version history + restore + tag editing (a form) + version upload + status transitions. The story is scoped to the FULL surface (kein MVP) with RHF+Zod for the forms (DEC-2). The Vorstand/Admin-only gate is the load-bearing invariant (AC-3). Shared `documents.ts` + `documents.*` namespace with S2 (A62). One hard-coded `"Document not found"` string to fix to `documents.notFound`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story orchestration + 1 general-purpose sub-agent for the full list+detail slice extraction).

### Debug Log References

**DEC-1/2/3 (all = recommended A) — per A43, autonomous mode ("für das ganze epic … ohne stop"):**
- **DEC-1 (transport) = A:** (a) slice `api` wraps `@/lib/services/documents`; raw-fetch upload/version-upload/download moved into the slice with the exact `getSession()` Bearer + `FormData` shape; service untouched. (b) sibling-safe (E29-S2 shares the module, A62); `apiPost` can't carry `FormData`; story recommended A; user pre-declared autonomous. (c) the S1 mocks (`@/lib/services/documents` + global `fetch`) still intercept → nets stayed green.
- **DEC-2 (forms) = A:** (a) E22 RHF+Zod for tag-editor + upload-metadata + version-comment. (b) epic goal; behaviour-preserving (free-text comma tags; validation only where HTML required = none strict). (c) `board-document-tag-editor.test.tsx` mirrors `sponsor-form.test.tsx`.
- **DEC-3 (type home) = A:** (a) `types/board-document.types.ts` re-exports from `@/lib/services/documents`. (b) `features→lib` legal; relocation violates E21-S5 + breaks S2. (c) ESLint boundary clean.

### Completion Notes List

- **A62 re-verification (Task 0):** E29-S2 left `lib/services/documents.ts` untouched + owns root key `["documents"]`; the board slice owns a DISTINCT `["board-documents"]` root + a board-specific fn set (getById/review/publish/archive/delete/updateTags/restoreVersion + FormData uploads). No collision; service confirmed untouched (orchestrator re-verified empty diff).
- **Behaviour preserved (AC-1/2): board S1 suites 55 green.** List spec (33) UNCHANGED — the Radix destructive delete dialog + the RHF+Zod upload were transparent to the outcome-level assertions (heading key, last `common.delete` confirm, FormData fetch URL/body, refetch counts, toast keys). Detail spec (22) — ONE mechanism re-point: the route entry migrated `useParams()` → the `params: Promise<{id}>` + `use(params)` contract (E24 events precedent), so the spec renders `<DocumentDetailPage params={syncThenable({id})}/>` with a synchronous-`use` shim; EVERY behavioural assertion preserved (gate, `getDocumentById` args, 404/notFound view, download URLs+Bearer, tag-save args, version-upload FormData, status-transition visibility, restore confirm, version-history, 3000 ms toast). These are exactly the mechanism-level surfaces the S1 net licensed for update (A79/A86).
- **A86 destructive colour:** the list DELETE (was a hand-rolled in-component confirm overlay) → `board-document-delete-dialog.tsx` Radix `alert-dialog` + `buttonVariants({variant:"destructive"})` (red). Status actions + per-version Restore NOT recoloured (Restore was already a modal, kept its existing blue — contextual A86).
- **documents.notFound fix (AC-8):** the hardcoded `"Document not found"` fallback is gone; the detail renders the existing `documents.notFound` view on error-with-no-data; `BoardDocumentNotFoundError` distinguishes 404s. No new i18n key.
- **A79 deltas:** list `useQuery` keyed by every server filter; status/delete/tag/restore/upload/version-upload `useMutation` invalidating `all` (+`detail(id)` for status/tag/restore/version); folders/tags queries swallow `!success` (god-page silent-no-op parity); 3000 ms toast via `useRef` timer (cleared on unmount); sticky error banner; no optimistic updates; status-action visibility on the `DocumentStatus` enum.
- **Gates:** full suite **811 passed / 96 files** (780 baseline + 31 new; zero regressions); `tsc --noEmit` clean; `eslint` exit 0; `prettier --check` clean on modified route files + specs (only NEW slice files `--write`, A72); LF (A73). Orchestrator re-verified full suite + tsc + eslint + service-untouched independently.

### File List

**New — slice (`frontend/src/features/board-documents/`):**
- `api/board-documents-api.ts`, `api/board-documents-api.test.ts`
- `types/board-document.types.ts`
- `schemas/board-document.schema.ts`
- `hooks/use-board-documents.ts`, `hooks/use-board-document.ts`, `hooks/use-board-document-mutations.ts`, `hooks/use-board-document-download.ts`, `hooks/use-board-document.test.tsx`
- `components/board-documents-page-content.tsx`, `board-documents-filter-bar.tsx`, `board-documents-table.tsx`, `board-document-upload-dialog.tsx`, `board-document-delete-dialog.tsx`, `board-document-detail.tsx`, `board-document-version-history.tsx`, `board-document-version-dialog.tsx`, `board-document-restore-dialog.tsx`, `board-document-tag-editor.tsx`, `board-document-tag-editor.test.tsx`, `board-document-download-button.tsx`

**Modified — thin route entries + spec re-point:** `frontend/src/app/board/documents/page.tsx`, `frontend/src/app/board/documents/[id]/page.tsx`, `frontend/src/app/board/documents/[id]/page.test.tsx` (mechanism re-point only). `page.test.tsx` (list) UNCHANGED.

**Untouched (A62 sibling-safe):** `frontend/src/lib/services/documents.ts`; `frontend/src/features/documents/` (E29-S2 slice).

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e29-s3 → review).

## Change Log

- 2026-06-12: Story created (board-documents list+detail full surface → `src/features/board-documents/` slice; DEC-1 wrap-shared-service, DEC-2 RHF+Zod forms, DEC-3 type re-export; A62 + A86; A56 divergence — LARGEST E29 slice). Status ready-for-dev.
- 2026-06-12: Implemented. 21 new slice files (api/types/schemas/hooks/components); both pages → thin entries; DEC-1/2/3=A. A86 destructive delete dialog; `documents.notFound` fix. Board S1 suites 55 green (list unchanged; detail one `use(params)` re-point); +31 slice tests; full suite 811 green; tsc/eslint/prettier clean; service untouched (A62). Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-12

**Outcome: Approved with patches applied (3).** Behaviour-faithful full-surface slice; Vorstand/Admin gate verbatim; A86 destructive delete correct; A62 honoured. Both hunters flagged 3 error-path regressions FIXED at the boundary: **P1** upload dialog wiped file+form on error (now mount-on-open, preserved on error); **P2** version-upload dialog same; **P3** tag editor collapsed on a failed save (now collapses only on success). +3 regression tests added. 1 deferred (E29-CR-D2 unauth-flash, shared). Full review + patch detail: `epic-29-boundary-review-2026-06-12.md`.
