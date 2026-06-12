# Story E26.S3: Finance Receivables/Payables — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E26-S1 (the S3 receivables/payables suites green at HEAD)** + **E26-S2 (the shared `finance-api.ts`/`finance.types.ts` foundation)** + the E22 RHF+Zod form sub-recipe (closed). Mutually independent of S4..S6 once S2's foundation lands (each extends the shared foundation with its own `<sub>-api.ts`/`<sub>.types.ts`, touching different files).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the seven receivables/payables pages extracted into `src/features/finance/`, reusing the S2 `api`/`types` foundation,
so that the invoice/payment/receipt/dunning/expense-claim flows and the invoice form move with no behaviour change and the `canReadFinance`/`canWriteFinance` guards stay exact.

## Acceptance Criteria

**Behaviour preserved (all E26-S1 receivables/payables tests stay green):**

1. Each page's CURRENT read guard is preserved EXACTLY (E26-S1 pins them — they are heterogeneous, do NOT normalise): `invoices` (list) keeps the canonical `isAuthenticated`/`authLoading` + `router.push("/")` + spinner→`return null`; `invoices/new` keeps `canWriteFinance`-only + `router.replace("/finance/invoices")` + `return null` (write-gated page); `invoices/[id]` keeps `canReadFinance`-only + `router.replace("/finance")` + the load-error full-page card; `receipts`/`dunning` keep `canReadFinance`-only + `router.replace("/")` + `return null`; `payments`/`expense-claims` keep the **inline "Not authorized" div** (NO redirect, NO `return null`). `canWriteFinance` still gates every mutation, and the **fine-grained role/ownership predicates** on payments (`isVorstand||isAdmin` for approve/reject) and expense-claims (`claimantId===user?.email||isAdmin`; kassier/vorstand review/approve/reject/reimburse) are preserved verbatim — never weakened.
2. **Invoices-list affordances preserved exactly:** "New invoice" link, per-row **Send** (Draft only, blue icon, modal confirm with orange confirm button) → `POST /api/v1/finance/invoices/{id}/send`, per-row **Cancel** (when status ∉ {Cancelled, Paid}, red icon, modal confirm with red confirm button) → **`DELETE /api/v1/finance/invoices/{id}`**, all only when `canWriteFinance`. The `actionLoading` per-id state, the **optimistic local-status patch with NO refetch** (Send→`Sent`, Cancel→`Cancelled`), and the no-change-on-error behaviour are preserved (A100 — if the list moves to a derived-overlay model, key the overlay reset on the filter, not `data` identity). Client-side search + **server-side** status/date filters (`?status=&from=&to=`) and the status-badge styling map preserved.
3. All `/api/v1/finance/invoices|receipts|payments|dunning|expense-claims` URLs (+ the non-finance `GET /api/v1/members?pageSize=500` lookup on invoices/new) unchanged. **Pin/preserve the two endpoint divergences for the same logical action:** list Cancel = `DELETE /invoices/{id}` vs detail Cancel = **`POST /invoices/{id}/cancel`**; and the detail-page Cancel fires with **NO confirmation** (vs the list's modal) — preserve both. The invoice PDF + e-invoice **blob downloads** (`/invoices/{id}/pdf`, `/invoices/{id}/einvoice?format=ubl`) and the e-invoice **409→`noProfileError`** amber branch preserved (A99). Payments **immediate Delete + receipt-detach with no confirm**, the receipt upload (`api.upload`, `file`+`notes`), and the payments **hardcoded-English error strings** preserved verbatim (do NOT translate — S1 pins them).

**Improvements:**

4. **Invoice new/edit forms use the E22 form sub-recipe: RHF + Zod** via `schemas/invoice.schema.ts` (shared new+edit), with mutation-invalidation of the relevant `financeKeys` on success. **A95 (load-bearing — this BIT the program twice):** the form's `recipientType` `<select>` renders/POSTs **`"Other"`** today while the canonical `RecipientType` is `"Member" | "External"` — the Zod field MUST be the FULL transport union (`z.string()` or the full union, NEVER `z.enum([rendered subset])`), keep the RAW stored value in `defaultValues`, and render the out-of-set value as an extra `<option>` so a no-touch edit-save round-trips it byte-identically. **A96:** NO `.trim()` / transform on any submitted-byte field (recipient name/address, line descriptions); the god-page sends raw input and has NO validation gate beyond `disabled={loading}` — so the Zod schema's required-ness MUST MATCH the current submit-enable gate (i.e. permissive — do NOT add required-field validation the god-page lacks); the `<form noValidate>` MUST render any per-field Zod errors (A96 companion). **A98:** the shared form threads every mode-divergent surface through props (Draft-vs-Send submit buttons, the create→`router.push('/finance/invoices/{id}')` navigation, the Member-vs-Other conditional fields) AND the net pins both modes.
5. Extract `components/*` (invoice table / filter-bar / status-badge / detail / form + Send/Cancel confirmation dialogs; receipts grid + upload modal + delete dialog; the payments status×method×direction badges + record/edit modal + reject modal + receipt-attach modal + preview modal; dunning table + create modal; expense-claims table + create/edit modal + action modals + detail modal) and `hooks/use-*.ts` (TanStack) reusing S2's foundation. Add the receivables URL builders + keys to a NEW `api/receivables-api.ts` (importing S2's `FINANCE_BASE` + `financeKeys` root — does NOT edit `finance-api.ts`) and receivables types to a NEW `types/receivables.types.ts` (re-exporting `@/types/finance` `Invoice`/`RecipientType`/`InvoiceStatus`/`PaymentStatus`/`PaymentMethod`/`ExpenseClaim`/`ExpenseClaimStatus` per A83, adding new ones). Keep `recipientType`/`status` unions in the shared types.
6. **Manual→TanStack deltas (A79/A92/A99/A100) decided explicitly:** the optimistic invoice-list status patch becomes a derived-overlay or a targeted `setQueryData`/invalidate that preserves "no refetch on the patched action + no change on error" (A100 — key any overlay reset on the filter); mutation errors surfaced exactly as today (incl. the hardcoded-English payments strings); the **await-then-reset form/modal handlers** (invoice create→navigate; payment/expense-claim modals that reset state in the success branch) must drive reset/close from the mutation OUTCOME (`onSuccess`), never synchronously after `mutate()`, so the ERROR path does not wipe user input (A92 — add an "input-preserved-on-error" assertion for the invoice form + the payment/claim modals); confirm/no-confirm mechanisms preserved per surface (A99 detail-cancel no-confirm, payments delete/detach no-confirm).
7. No new `any`, no new hard-coded user-facing strings beyond the ones S1 already pins as pre-existing, no new direct API URL in route files/components, no duplicate UI primitive; the blob-download helpers reused (not reinvented); i18n parity stays green (`finance`, `finance.vat`, `financeErrors`, `paymentApproval`, `expenseClaims` keys unchanged).

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E26-S1 receivables suites green at HEAD; E26-S2 foundation present. Re-read the 7 pages + the S2 `finance-api.ts`/`finance.types.ts` + the E22 form sub-recipe (`features/sponsors`/`members` forms) (A56). Note the recipientType `"Other"` vs `"External"` mismatch + the no-validation invoice form.
  - [ ] Resolve DEC-1..DEC-4 (recommended options below).
- [ ] Task 1: Scaffold `api/receivables-api.ts` (import S2 `FINANCE_BASE`+`financeKeys`; invoices/payments/receipts/dunning/expense-claims URL builders incl. the action sub-paths + the blob endpoints + the members lookup) + `types/receivables.types.ts` (re-export `@/types/finance` + new) + `schemas/invoice.schema.ts` (A95 full union for `recipientType`, A96 no-`.trim()`, required-ness matching the god-page enable-gate) + `api/receivables-api.test.ts`.
- [ ] Task 2: Hooks — queries (invoices list `?status=&from=&to=`, invoices/open, invoice detail (`retry:false` A99) + payment history, payments, receipts(+download blob), dunning, expense-claims `?status=&myClaimsOnly=`) + mutations (invoice create/send/cancel(both DELETE+POST variants)/dunning-generate; payment create/edit/submit/approve/reject/mark-paid/delete/receipt-attach-detach; receipt upload/delete; dunning create/send; expense-claim create/edit/submit/review/approve/reject/reimburse/delete) each invalidating `financeKeys`. Hook tests: invoice-detail no-retry + one mutation-invalidation + the optimistic-list-patch-preservation.
- [ ] Task 3: Components — invoices list — `invoices-page-content` + filter-bar (client search + server status/date) + table + status-badge + the Send/Cancel confirmation dialogs (blue/red affordances, orange/red confirm buttons preserved A86) + the `actionLoading` per-id state + the optimistic patch (A100).
- [ ] Task 4: Components — invoice form (`invoice-form` RHF+Zod, E22 sub-recipe; A95 recipientType full-union + extra-option; A96 no-`.trim()`; A98 mode-divergent props: Draft/Send buttons, create-navigate, Member/Other conditional fields; line-items editor + live VAT calc preserved) + `invoice-new-content`/`invoice-detail-content` (the action block, POST `/cancel` no-confirm, PDF/e-invoice blob downloads, 409 `noProfileError`).
- [ ] Task 5: Components — `receipts` (grid + upload modal `api.upload` `file`+`notes` + delete dialog) + `payments` (the status×role action matrix, record/edit/reject/attach/preview modals, immediate Delete/detach, hardcoded-English errors preserved) + `dunning` (table + create modal) + `expense-claims` (table + create/edit + action modals + detail modal, ownership/role predicates).
- [ ] Task 6: Thin route entries — the 7 route files → content components (keep `params: Promise<{id}>` + `use(params)` on `invoices/[id]`).
- [ ] Task 7: Green-the-net + DoD gate — E26-S1 receivables suites green (transport mocks unchanged — BUILD per A94; adapt only the licensed A79 surface, e.g. the RHF form-mechanism assertions); new slice unit tests; `tsc`/eslint(changed+boundary)/`vitest run` FULL green; LF; A79/A92/A99/A100 deltas recorded. (`next build` deferred to epic boundary.)

## Dev Notes

The receivables/payables group — the form-heavy, mutation-heavy half of finance. Reuses S2's foundation; adds its own `receivables-api.ts`/`receivables.types.ts`/`schemas/invoice.schema.ts` without touching S2's files (parallel-safe). The invoice form is the epic's primary RHF+Zod showcase and carries the A95 `recipientType "Other"` trap; payments/expense-claims carry fine-grained role/ownership gating and hardcoded-English error strings that MUST be preserved.

### Scope Boundaries

- In scope: `features/finance/{api/receivables-api.ts, types/receivables.types.ts, schemas/invoice.schema.ts, hooks/*, components/*}` for the 7 pages; thin route entries; new slice unit tests.
- Out of scope: editing S2's `finance-api.ts`/`finance.types.ts` (import only); S4..S6 pages; the members module (consume the `/members` lookup only); "fixing" the recipientType `"Other"`/`"External"` mismatch (preserve the wire value `"Other"` — A95 round-trip), the two cancel-endpoint divergence, the no-confirm deletes, the hardcoded-English payment errors, or the silent receipt-upload `res.error` swallow.

### Architecture Guardrails

- A94 BUILD on `useApiClient` (URLs/bodies byte-identical — esp. the list-DELETE vs detail-POST `/cancel`, the `?status=` server filters, the `api.upload` `file`+`notes` receipt body). A95 invoice `recipientType` = full transport union + raw default + extra-option (NEVER `z.enum(subset)`). A96 no submitted-byte `.trim()`; `noValidate` form renders field errors; required-ness MATCHES the god-page enable-gate (the invoice form has NONE beyond `disabled={loading}` — keep it permissive). A98 shared form mode-divergent surfaces threaded + both modes pinned. A92 reset/close from mutation OUTCOME (input-preserved-on-error). A99 invoice-detail `retry:false`. A100 optimistic list overlay reset keyed on filter. A86 preserve action colours (send=blue, cancel=red, approve=blue, reject=red, mark-paid=green, submit=yellow).
- DoD as E27 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 recipientType union (A95):** A) Zod `recipientType: z.string()` (or the full `"Member"|"External"|"Other"` union), keep the raw stored value in `defaultValues`, render the out-of-set value as an extra `<option>`, POST the value byte-identically (recommended — the god-page sends `"Other"`; a `z.enum(["Member","External"])` would reject/rewrite it). B) "fix" the form to send `"External"` (REJECTED — behaviour change to the wire contract; preserve-over-improve). **Recommended: A.**
- **DEC-2 invoice-form validation strictness (A96 companion):** A) the Zod schema's required fields MATCH the god-page's current enable-gate (which is only `disabled={loading}` — i.e. effectively no required fields; submit must stay possible with empty recipient/items as today), render field errors only for genuinely-invalid coercions (recommended — preserve-over-improve; the server validates). B) add "sensible" required validation (REJECTED — rejects inputs the god-page accepted → net red + behaviour change). **Recommended: A.**
- **DEC-3 optimistic invoice-list patch (A100):** A) preserve the local status patch via a derived overlay keyed on the active filter (reset on filter change, NOT on `data` identity) OR a targeted `setQueryData` that survives a same-key refetch without flashing back (recommended; matches the god-page's no-refetch-on-action). B) replace with a plain `invalidateQueries` refetch (REJECTED — changes the god-page's no-refetch behaviour the net pins). **Recommended: A.**
- **DEC-4 payments/expense-claims action-modal reset (A92):** A) drive every modal reset/close from `onSuccess` (recommended — the error path keeps the modal open with input intact, matching the god-page). B) synchronous reset after `mutate()` (REJECTED — wipes input on error). **Recommended: A.**

### Testing Requirements

- The E26-S1 receivables suites are the regression oracle — keep green; only the form-mechanism (RHF+Zod) + data-mechanism (TanStack) are the licensed A79 update surface. Guards (each page's exact shape + redirect target), the two cancel-endpoint divergence, the no-confirm deletes, the optimistic list patch, the blob downloads, the 409 `noProfileError`, the role/ownership predicates, badges-via-label must stay green verbatim.
- Add focused slice unit tests: `receivables-api` URL/key shape (the action sub-paths + blob endpoints + the list-DELETE vs detail-POST split); `invoice-form` RHF+Zod (A95 recipientType out-of-set round-trip, A96 no-`.trim()` + field errors, A98 mode-divergent props, A92 input-preserved-on-error); invoice-detail no-retry; one optimistic-patch-preservation test.

### Project Structure Notes

- Target tree (all NEW under the existing `features/finance/`): `api/receivables-api.ts(+test)`, `types/receivables.types.ts`, `schemas/invoice.schema.ts`, `hooks/use-invoices*.ts`/`use-payments*.ts`/`use-receipts*.ts`/`use-dunning*.ts`/`use-expense-claims*.ts`, `components/invoices/*`/`payments/*`/`receipts/*`/`dunning/*`/`expense-claims/*`. Thin entries at `app/finance/{invoices,invoices/new,invoices/[id],receipts,payments,dunning,expense-claims}/page.tsx`.

### References

- Form sub-recipe: `frontend/src/features/sponsors/` + `features/members/` (RHF+Zod, A95/A96/A98 examples), `docs/architecture-frontend.md` "Form Sub-Recipe".
- Pages: `frontend/src/app/finance/{invoices,invoices/new,invoices/[id],receipts,payments,dunning,expense-claims}/page.tsx`.
- Foundation to import: `features/finance/api/finance-api.ts` + `types/finance.types.ts` (E26-S2). Shared types: `frontend/src/types/finance.ts`.
- E26-S1/S2; project-context.md A34/A56/A58/A72/A73/A79/A83/A86/A88/A92/A94/A95/A96/A97/A98/A99/A100; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. Ordered after E26-S2 foundation.
- **A56 findings:** all 7 pages `useApiClient` direct (BUILD, A94). Heterogeneous guards: canonical (invoices list), write-only redirect (invoices/new → `/finance/invoices`), read-only redirect (invoices/[id] → `/finance`), lean (receipts/dunning → `/`), inline "Not authorized" (payments, expense-claims). **A95**: invoices/new `recipientType` renders+POSTs `"Other"` vs canonical `"External"` — the form's central trap. **A96**: no page trims; invoice form has NO validation (submit only `disabled={loading}`) — the Zod schema must stay permissive. Endpoint divergences: list cancel `DELETE` vs detail cancel `POST /cancel`; detail cancel no-confirm; payments delete/detach no-confirm. Blob downloads (PDF, e-invoice UBL) + e-invoice 409 `noProfileError`. Payments has hardcoded-English errors + a status×role action matrix (`isVorstand||isAdmin`); expense-claims gates by `claimantId===user?.email||isAdmin` + kassier/vorstand. `@/types/finance` already exports `Invoice`/`RecipientType`/`PaymentStatus`/`ExpenseClaim` etc (re-export, A83).

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (7 receivables/payables pages → `features/finance/` reusing the S2 foundation; invoice form → E22 RHF+Zod with the A95 recipientType `"Other"` full-union round-trip + A96 permissive-no-`.trim()` + A98 mode props + A92 input-preserved-on-error; preserve the list-DELETE/detail-POST cancel divergence, the no-confirm deletes, the optimistic list patch A100, the blob downloads + 409 branch, the role/ownership predicates + hardcoded-English payment errors). Status ready-for-dev.
