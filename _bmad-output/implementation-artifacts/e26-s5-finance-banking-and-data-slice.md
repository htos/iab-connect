# Story E26.S5: Finance Banking/Data — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E26-S1 (the S5 banking/data suites green at HEAD)** + **E26-S2 (the shared `finance-api.ts`/`finance.types.ts` foundation)**. Mutually independent of S3/S4/S6 once S2's foundation lands.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the three banking/data pages extracted into `src/features/finance/`,
so that bank-import, transactions and exports migrate while their file UPLOAD (multipart) and DOWNLOAD (blob) flows are preserved byte-for-byte.

## Acceptance Criteria

**Behaviour preserved (all E26-S1 banking/data tests stay green):**

1. Each page's CURRENT read guard is preserved EXACTLY (E26-S1 pins them — heterogeneous): **`transactions` keeps the canonical** `isAuthenticated`/`authLoading` + `router.push("/")` + spinner→`return null`; **`bank-import` keeps the inline "Not authorized" div** (NO redirect, NO `return null`); **`exports` keeps** `canReadFinance`-only + `router.replace("/")` + `return null` (NO `isLoading` wait — the premature-redirect-on-cold-session quirk preserved AS-IS). `canWriteFinance` still gates every mutation — bank-import upload/camt + accept-match/reject-match/match/ignore/unmatch; transaction create/edit/delete + receipt attach/detach — never weakened. `exports` is read-only (no `canWriteFinance` read).
2. **Upload/download flows preserved BYTE-FOR-BYTE (the highest-risk behaviours in E26 — A76 class; do NOT convert to JSON query/mutation):**
   - **Upload**: `api.upload(endpoint, formData)` with `FormData` field `"file"` (bank-import `POST /bank-imports`, camt `POST /bank-imports/camt`) and `"file"`+`"notes"` (transactions receipt `POST /receipts`); Content-Type omitted (browser sets the multipart boundary). The bank-import single-shot upload (no preview/commit wizard — the "preview" is the separate detail view; "commit" equivalents are the per-item match/accept/ignore actions) and the camt auto-trigger-on-select are preserved.
   - **Download**: `api.get<Blob>(url)` → `res.data as Blob` → `window.URL.createObjectURL` → anchor `download=<hardcoded filename>` → `.click()` → `revokeObjectURL`. Preserve: `exports` `journal.csv`/`open-items.csv` hardcoded filenames + the anchor **NOT DOM-appended**; the transactions receipt-view filename (`fileName`/`"receipt"` fallback) + anchor **appended+removed** + the image/`application/pdf` **preview-modal branch** with deferred revoke-on-close.
3. All `/api/v1/finance/bank-imports|transactions|exports` URLs unchanged (incl. the transactions list `?from&to&type&accountId&categoryId` server filters built with `URLSearchParams`, the receipts lookup/upload/download, the accounts/categories/activity-areas selectors). **Pin/preserve the bank-import POST-vs-PUT divergence on the same `/items/{id}/ignore` path** (`handleIgnore` = POST, `handleUnmatch` = PUT) and the `exports` journal query built by **string interpolation** (NOT `URLSearchParams`). The transactions delete-confirm modal (red), the bank-import accept(green)/reject(red)/ignore affordances, the `exports`-uses-`router.replace` and the bank-import upload **hardcoded-English error strings** preserved verbatim (do NOT translate — S1 pins them).

**Improvements:**

4. Extract `hooks/use-*.ts` (TanStack) and `components/*` (bank-import list + upload buttons + camt + import-detail item-match panel + match modal; transactions table + filter-bar + create/edit form + delete modal + receipt-attach/preview modals; exports panel with the two export cards) reusing S2's foundation. Add the banking URL builders + keys to a NEW `api/banking-api.ts` (importing S2's `FINANCE_BASE`/`financeKeys`) and banking types to a NEW `types/banking.types.ts` (re-exporting any shared `@/types/finance` types per A83, adding bank-import/transaction types). **Keep file-upload (multipart) and download (blob) handling in dedicated api/hook functions** that call `api.upload`/`api.get<Blob>` — do NOT convert these to plain JSON query/mutation patterns where they currently stream files. No change to `Content-Type` or response handling.
5. Transactions create/edit form follows the E22 RHF+Zod sub-recipe with mutation-invalidation — **A96** no `.trim()` on submitted bytes (description/reference/notes); required-ness MATCHES the current enable-gate (description + amount≥0.01 + accountId + categoryId, per the god-page's `disabled` logic); **A95** the type (`Income`/`Expense`), account, category, activity-area `<select>`s are closed sets seeded from the lookups — keep the raw stored value rendered on edit (an out-of-set/now-inactive account renders blank-but-retained → preserve). The receipt-attach modal's mutually-exclusive "pick existing vs upload new" logic is preserved.
6. **Manual→TanStack deltas (A79/A92) decided explicitly:** the upload mutation drives the list refetch + the file-input reset from the mutation OUTCOME (`onSuccess`, A92 — the error path keeps the selected file/input, not a synchronous reset that loses it); the transactions list query keys on the filter object (server filters in the key, client search applied during render); the receipt blob-download + the export blob-download stay imperative side-effect functions (NOT queries — they create object URLs + trigger anchor clicks); the import-item match/accept/reject/ignore/unmatch mutations invalidate the import-detail query.
7. No new `any`, no new hard-coded user-facing strings beyond the ones S1 pins, no new direct API URL in route files/components, no duplicate UI primitive; i18n parity stays green (`finance` keys unchanged).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E26-S1 banking suites green at HEAD; E26-S2 foundation present. Re-read the 3 pages + `lib/auth.ts` (`upload` + the blob branch of `get`) + the S2 foundation (A56). Confirm the upload field names + the POST-vs-PUT `/ignore` divergence + the two download anchor styles.
  - [ ] Resolve DEC-1..DEC-2 (recommended options below).
- [ ] Task 1: Scaffold `api/banking-api.ts` (import S2 `FINANCE_BASE`/`financeKeys`; bank-imports incl. the item-action sub-paths with the POST-vs-PUT `/ignore` split, transactions incl. `?from&to&type&accountId&categoryId`, exports journal/open-items blob URLs, receipts upload/download) + `types/banking.types.ts` + `api/banking-api.test.ts` (URL/key shape incl. the POST/PUT `/ignore` distinction + the string-interpolated journal query).
- [ ] Task 2: Hooks — queries (bank-imports list, import detail, transactions `?filters`, accounts/categories/activity-areas selectors, receipts list) + mutations (bank-import upload (`api.upload`, `file`), camt upload (`api.upload`, `file`), item accept-match/reject-match/match/ignore(POST)/unmatch(PUT); transaction create/edit/delete; receipt upload (`api.upload`, `file`+`notes`) + transaction receipt attach/detach) each invalidating `financeKeys`; the receipt + export **blob-download** helpers as imperative functions (NOT queries). Hook tests: the upload mutation (multipart body shape + `onSuccess` reset, A92), the POST-vs-PUT `/ignore` mutations, the blob-download helper.
- [ ] Task 3: Components — `bank-import` (list + upload/camt buttons (write-gated, hardcoded-English errors preserved) + import-detail item-match panel (accept-green/reject-red/ignore/match) + match modal; the inline "Not authorized" guard preserved).
- [ ] Task 4: Components — `transactions` (table + filter-bar (server filters + client search) + create/edit form RHF+Zod + delete modal + receipt-attach modal (mutually-exclusive pick/upload) + preview modal (image/PDF, deferred revoke); the canonical guard preserved).
- [ ] Task 5: Components — `exports` (two export cards: journal with from/to dates (string-interpolated query) + open-items; both blob-download via `api.get<Blob>` + non-appended anchor + hardcoded filenames; the read-only `router.replace("/")` guard preserved).
- [ ] Task 6: Thin route entries — the 3 route files → content components.
- [ ] Task 7: Green-the-net + DoD gate — E26-S1 banking suites green (transport mocks unchanged — BUILD per A94; the `upload`/blob mocks must keep intercepting); new slice unit tests; `tsc`/eslint(changed+boundary)/`vitest run` FULL green; LF; A79/A92 deltas recorded + the upload/download fidelity confirmed. (`next build` deferred to epic boundary.)

## Dev Notes

The banking/data group — three pages but the HIGHEST-RISK behaviours in the epic: multipart file upload and blob file download. These MUST stay on `api.upload`/`api.get<Blob>`; a naive TanStack-JSON migration would corrupt the multipart body or the blob response. The `useApiClient` contract already exposes `upload` and returns `response.blob()` for non-JSON, so the slice keeps using it (BUILD, A94) — the E26-S1 `upload`/blob mocks keep intercepting. bank-import is single-shot (no wizard); the POST-vs-PUT `/ignore` divergence and the two download-anchor styles (appended vs not) are pin-and-preserve quirks.

### Scope Boundaries

- In scope: `features/finance/{api/banking-api.ts, types/banking.types.ts, schemas/transaction.schema.ts, hooks/*, components/*}` for the 3 pages; thin route entries; new slice unit tests.
- Out of scope: editing S2's foundation files (import only); the receipts PAGE (that is S3's `receipts/page.tsx` — here only the receipt upload/download/lookup that transactions consumes); S3/S4/S6 pages; "fixing" the bank-import POST-vs-PUT `/ignore` divergence, the hardcoded-English upload errors, the exports string-interpolated query / non-appended anchor / hardcoded filenames, or the exports premature-redirect guard. Converting upload/download to JSON patterns is FORBIDDEN.

### Architecture Guardrails

- A94 BUILD on `useApiClient` — including `api.upload(endpoint, formData)` and `api.get<Blob>(url)`; FormData field names (`file`, `file`+`notes`) and Content-Type (omitted) byte-identical; the POST `/items/{id}/ignore` vs PUT `/items/{id}/ignore` split preserved exactly. A92 upload mutation resets the file input from `onSuccess` (input preserved on error). A96 no submitted-byte `.trim()` on the transaction form; required-ness matches the enable-gate. A95 transaction selects keep raw stored values on edit. A86 preserve affordance colours (accept=green, reject=red, delete=red, primary=orange).
- The blob download helpers are imperative side-effect functions (createObjectURL → anchor → click → revoke) — NOT TanStack queries. Preserve the exports-anchor-not-appended vs transactions-anchor-appended distinction and the preview-vs-download branch.
- DoD as E27 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 upload/download transport (A76/A94):** A) keep upload on `api.upload` (multipart, field `file`/`file`+`notes`, no Content-Type) and downloads on `api.get<Blob>` → object-URL → anchor, wrapped in dedicated hook/api functions but NOT TanStack-JSON-ified (recommended — these stream files; converting them is the exact A76 silent-regression class the net guards). B) model them as TanStack mutations/queries with custom `mutationFn`/`queryFn` that still call `api.upload`/`api.get<Blob>` (acceptable ONLY if the multipart body + blob handling are byte-identical AND the net stays green; higher risk). **Recommended: A** (a thin hook wrapping the imperative function is fine; the file handling must not change).
- **DEC-2 POST-vs-PUT `/ignore` (A56):** A) preserve BOTH — a `ignoreItem` (POST) and an `unmatchItem` (PUT) hook against the same path (recommended — the god-page distinguishes them; collapsing to one changes behaviour). B) unify to one method (REJECTED — behaviour change; the backend may treat them differently). **Recommended: A.**

### Testing Requirements

- The E26-S1 banking suites are the regression oracle — keep green; only the data/form mechanism is the licensed A79 surface. The upload FormData field names, the blob-download URLs + filenames + anchor styles, the POST-vs-PUT `/ignore` split, the canonical-vs-inline-vs-replace guards, the transaction filters, the preview branch must stay green verbatim.
- Add focused slice unit tests: `banking-api` URL/key shape (the item-action sub-paths + the POST/PUT `/ignore` distinction + the string-interpolated journal query + the receipts upload/download URLs); the upload mutation (multipart body + `onSuccess` reset); the blob-download helper (object-URL + anchor + revoke).

### Project Structure Notes

- Target tree (NEW under `features/finance/`): `api/banking-api.ts(+test)`, `types/banking.types.ts`, `schemas/transaction.schema.ts`, `hooks/use-bank-imports*.ts`/`use-transactions*.ts`/`use-exports.ts`/`use-receipt-download.ts`, `components/banking/*`. Thin entries at `app/finance/{bank-import,transactions,exports}/page.tsx`.

### References

- Pages: `frontend/src/app/finance/{bank-import,transactions,exports}/page.tsx`.
- Transport seam: `frontend/src/lib/auth.ts` (`useApiClient.upload` = multipart no-Content-Type; `get` returns `response.blob()` for non-JSON). Foundation to import: `features/finance/api/finance-api.ts` + `types/finance.types.ts` (E26-S2). Helpers: `frontend/src/lib/utils.ts`.
- E26-S1/S2; project-context.md A34/A56/A58/A72/A73/A76/A79/A83/A86/A92/A94/A95/A96; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. Ordered after E26-S2 foundation.
- **A56 findings:** all 3 pages `useApiClient` direct (BUILD, A94) — `upload` is a real method, blob download is implicit in `get` (non-JSON → `response.blob()`). Heterogeneous guards: `transactions` canonical (`router.push("/")` + spinner→null); `bank-import` inline "Not authorized" (no redirect/null); `exports` `router.replace("/")` + `return null`, no `isLoading` wait (premature-redirect quirk). **bank-import is single-shot upload** (no preview/commit wizard — the spec's "wizard" framing corrected); the "preview" is the detail view, "commit" = per-item match/accept/ignore. **POST-vs-PUT on the same `/items/{id}/ignore` path** (handleIgnore POST, handleUnmatch PUT) — preserve. Upload FormData field = `"file"` (+`"notes"` for receipts); Content-Type omitted. Download: `api.get<Blob>` → object-URL → anchor; `exports` anchor NOT DOM-appended + hardcoded `journal.csv`/`open-items.csv`; transactions anchor appended+removed + image/PDF preview-modal branch with deferred revoke. `exports` journal query is string-interpolated (not `URLSearchParams`). Hardcoded-English upload errors on bank-import.

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (3 banking/data pages → `features/finance/` reusing the S2 foundation; BUILD over `useApiClient` keeping `api.upload` multipart (`file`/`file`+`notes`) + `api.get<Blob>` downloads byte-identical — NOT JSON-ified; preserve the bank-import single-shot upload + POST-vs-PUT `/ignore` split + inline guard, the exports hardcoded filenames + non-appended anchor + premature-redirect guard, the transactions canonical guard + preview branch; transaction form → RHF+Zod enable-gate-matching + A96 no-`.trim()`; upload reset from onSuccess A92). Status ready-for-dev.
