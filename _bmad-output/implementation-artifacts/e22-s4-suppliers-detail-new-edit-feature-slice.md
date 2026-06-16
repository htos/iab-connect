# Story E22.S4: Suppliers Detail/New/Edit — Feature-Slice Extraction (Complete the E21 Pilot)

Status: done

Depends on: E22-S3 (the form sub-recipe + the full-TanStack detail pattern). Completes the E21-S3 Suppliers pilot, which migrated only the LIST page and left detail/new/edit as god-pages.

<!-- Created mid-session (2026-06-07) when the user noticed, after E22 (Sponsors) completed, that the Suppliers feature was only half-migrated — the same incomplete-migration the E21 pilot deliberately scoped to the list. The user chose "jetzt sofort nachziehen" (do it now). Authored + implemented in one pass following the E22 recipe. -->

## Story

As a maintainer,
I want the Suppliers detail, new, and edit pages migrated into `src/features/suppliers/` the same way Sponsors were in E22-S3,
so that the Suppliers feature (the E21 pilot) is fully migrated and consistent, and the new RHF+Zod form sub-recipe gets its first real second consumer.

## Acceptance Criteria

**Behaviour preserved (new E22-S4 detail/new/edit characterization tests stay green):**

1. `/suppliers/[id]`, `/suppliers/new`, `/suppliers/[id]/edit` access guards (**admin-only** — `isAdmin`, with the same `/login` and `/` redirects), data load/prefill, create/update submit, validation, success redirect (`/suppliers`), and submit-error handling all behave exactly as before.
2. **Detail surface preserved** (simpler than Sponsors — NO packages, `category` not `tier`): `GET /api/v1/suppliers/{id}` (loading/error/not-found `suppliers.notFound`); contact info, supplier info (category/status/links count), notes; status change `PUT /api/v1/suppliers/{id}/status`; delete `DELETE /api/v1/suppliers/{id}` → redirect `/suppliers`; contract-link add `POST /api/v1/suppliers/{id}/links` + remove `DELETE /api/v1/suppliers/{id}/links/{linkId}` (empty state `suppliers.noLinks`); each in-flight action keeps its disabled/pending state.

**Improvements:**

3. Each route file becomes a thin server entry rendering a `features/suppliers/components` composition root (the only `"use client"`).
4. `features/suppliers/` gains: `api/suppliers-api.ts` += `getSupplier`/`createSupplier`/`updateSupplier`/`updateSupplierStatus`/`addLink`/`removeLink`; `schemas/supplier.schema.ts`; `hooks/` += `use-supplier`, `use-create-supplier`, `use-update-supplier`, `use-supplier-detail-mutations`; `components/` += `supplier-form`, `supplier-new-content`, `supplier-edit-content`, `supplier-detail`, `supplier-contract-links` (delete reuses the existing `delete-supplier-dialog`; status badge reuses the existing `supplier-status-badge`).
5. The shared `ContractLink*` types come from `src/types/sponsors.ts` (not duplicated); Supplier-specific types from `features/suppliers/types/supplier.types.ts`.
6. Quality: no new `any`; no new hard-coded user-facing strings; no new direct API URL in route files; no duplicate UI primitive; CRUD round-trips unchanged. `tsc`/eslint(changed)/prettier-check(new)/`vitest run` green; `next build`; LF-clean diff (A73).
7. The form sub-recipe note in `docs/architecture-frontend.md` (written in E22-S3) is reused, not restated; the pilot note's "Open tech debt — remaining Supplier types/pages migrate" item is marked DONE.

## Tasks / Subtasks

- [x] Task 0: Characterization tests first (green baseline against the god-pages) (AC: 1, 2)
  - [x] Added co-located `*.test.tsx` for suppliers detail/new/edit; verified green against the un-refactored god-pages (22/22). Mirrored the E22-S1 sponsors harness (admin-only; `category` not `tier`; links only; `QueryClientProvider` seam; stable mocks; `alert` stub).
- [x] Task 1: Extend `api` + `types` (AC: 4, 5)
  - [x] `suppliers-api.ts` += 6 endpoint fns; `supplier.types.ts` += `AddLinkRequest` (shared `ContractLinkType` from `@/types/sponsors`).
- [x] Task 2: Schema + hooks (AC: 4)
  - [x] `schemas/supplier.schema.ts` (7 fields, RHF+Zod); `use-supplier` (query + `SupplierNotFoundError`), `use-create-supplier`, `use-update-supplier`, `use-supplier-detail-mutations` (status + link add/remove, `setQueryData` cache write).
- [x] Task 3: Components + thin routes (AC: 1, 2, 3)
  - [x] `supplier-form` (shared new+edit), `supplier-new-content`, `supplier-edit-content`, `supplier-detail` (+ `supplier-contract-links`); the 3 route files thinned to server entries.
- [x] Task 4: Keep behaviour green + quality gate (AC: 1, 6, 7)
  - [x] Detail/new/edit char suites green post-refactor; added `supplier-form.test.tsx` (Zod required-validation). `tsc`/eslint(changed)/prettier-check(new)/`vitest run`(330/330) green; `next build` succeeds; LF-clean. architecture-frontend.md tech-debt item marked DONE.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (continued from the E22 autonomous run, after the user spotted the half-migrated Suppliers pilot).

### Debug Log References

- **Trigger:** after E22 (Sponsors) completed, the user observed that the Suppliers detail (526 lines)/new (225)/edit (257) pages were still god-pages — the E21 pilot migrated only the list. Confirmed: no char tests for those three, all `"use client"` + manual `useState`, slice held list artefacts only.
- **Recipe reuse:** applied the E22-S3 pattern verbatim, minus the Sponsor-only bits — Suppliers have NO packages and use a free-text `category` (rendered as an inline indigo badge, preserved from the god-page) instead of the `tier` enum, and are admin-only for the whole feature (no `isVorstand` branch). DEC-1 (RHF+Zod) and DEC-2 (full TanStack detail) were already resolved in E22-S3; this story is their first reuse.
- **A79 deltas:** identical to E22-S3 — create/update throw → form banner; detail mutations `setQueryData(suppliersKeys.detail(id))` (no extra GET); 404 → `SupplierNotFoundError` → `suppliers.notFound`; mutation errors via `alert`. The new/edit/detail char suites got the `QueryClientProvider` harness seam from the start (written WITH the wrapper, a no-op against the god-pages, then green against the TanStack pages).
- **A72/A73:** the extended `suppliers-api.ts` + `supplier.types.ts` were prettier-clean at HEAD, so `prettier --write` produced minimal diffs (60 + 9 lines = only the additions, no balloon); the 3 route pages were fully replaced with thin clean entries (`--check` passes); all new files LF-clean.

### Completion Notes List

- Completed the E21 Suppliers pilot: detail/new/edit migrated into `features/suppliers/`, the three route files are now thin server entries, and the Suppliers feature is fully consistent with the E22 Sponsors slice.
- **AC-1/AC-2 (behaviour preserved):** ✅ new char suites — detail (11), new (6), edit (5) — green against the refactored pages; admin-only guards, GET/404/error/loading, status PUT, delete→redirect, link add/remove + empty state, all endpoints + pending states intact.
- **AC-3 (thin entries):** ✅ all three route files render a composition root (the only `"use client"`).
- **AC-4/AC-5 (slice + types):** ✅ api/schema/hooks/components added; `ContractLink*` imported from `@/types/sponsors`; Supplier types from the slice.
- **AC-6 (quality):** ✅ `tsc` clean; eslint clean on changed files; prettier-check clean on new files; `vitest run` 330/330; `next build` succeeds; LF-clean.
- **AC-7 (doc):** ✅ reused the E22-S3 form sub-recipe note; marked the pilot note's Suppliers tech-debt item DONE in `docs/architecture-frontend.md`.

### File List

New:
- `frontend/src/app/suppliers/[id]/page.test.tsx`, `frontend/src/app/suppliers/new/page.test.tsx`, `frontend/src/app/suppliers/[id]/edit/page.test.tsx`
- `frontend/src/features/suppliers/schemas/supplier.schema.ts`
- `frontend/src/features/suppliers/hooks/use-supplier.ts`, `use-create-supplier.ts`, `use-update-supplier.ts`, `use-supplier-detail-mutations.ts`
- `frontend/src/features/suppliers/components/supplier-form.tsx`, `supplier-new-content.tsx`, `supplier-edit-content.tsx`, `supplier-detail.tsx`, `supplier-contract-links.tsx`, `supplier-form.test.tsx`

Modified:
- `frontend/src/features/suppliers/api/suppliers-api.ts` (+ 6 detail/form endpoint fns)
- `frontend/src/features/suppliers/types/supplier.types.ts` (+ `AddLinkRequest`)
- `frontend/src/app/suppliers/[id]/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` (god-pages → thin entries)
- `docs/architecture-frontend.md` (pilot tech-debt item marked DONE)

## Change Log

- 2026-06-07: Story created + implemented mid-session — completes the E21 Suppliers pilot (detail/new/edit feature-slice extraction) using the E22-S3 recipe; new char suites + form-validation test; full suite 330/330; next build green. Status → review.
