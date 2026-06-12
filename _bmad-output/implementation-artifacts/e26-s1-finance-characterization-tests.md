# Story E26.S1: Finance — Characterization Tests for All Twenty-Six Pages (Regression Net)

Status: ready-for-dev

Depends on: E21-S2 / E22-S1 / E27-S1 (the characterization-net recipe — closed). **Blocks E26-S2..S6** (each extraction story keeps its sub-area's suites green). Inherits E21-S1 boundary decisions; applies A76/A78/A79/A80/A86/A87/A90/A95/A96/A97/A99/A100/A101 + harness rules A35/A46/A64/A78. This is the **heaviest characterization story in the program** (26 pages — vs Admin's 15, Communication's 12).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer about to refactor the largest and most permission-sensitive surface in the program (26 Finance pages across five sub-areas),
I want a characterization test suite that pins each page's CURRENT observable behaviour — including its `canReadFinance`/`canWriteFinance` guards and its (heterogeneous) auth-redirect shape — first,
so that the E26-S2..S6 slice extractions are provably behaviour-preserving and the finance read/write guards are demonstrably never weakened.

## Acceptance Criteria

**Test-only; green against branch HEAD before any refactor commit.**

1. New (or extended) co-located `*.test.tsx` suites pin the CURRENT behaviour of all 26 Finance pages under `frontend/src/app/finance/`, organised by sub-area (S2..S6 groups below) so each extraction story owns a clear green baseline. **EVERY suite that reads finance data asserts the read guard for the page's ACTUAL shape** (see AC-7 — the guard is NOT uniform across finance; pin what each page does, do NOT normalise).

2. **Read-guard assertions per page (the dominant A56 finding — guards are heterogeneous; pin AS-IS):** for every page that reads finance data, a test asserts that when `!canReadFinance` (and, on the pages that also read it, `!isAuthenticated`), the page does NOT fire its finance API calls and reaches its CURRENT deny surface. The CURRENT deny surfaces differ per page and MUST be pinned exactly:
   - **Canonical** (`isAuthenticated` + `isLoading: authLoading` read; `router.push("/")`; spinner while `authLoading||loading` → `if (!isAuthenticated||!canReadFinance) return null`): `finance/page.tsx` (dashboard), `invoices/page.tsx`, `transactions/page.tsx`.
   - **Lean role-only** (reads `canReadFinance`(+`canWriteFinance`) only — NO `isAuthenticated`/`authLoading`; `router.replace("/")`; `if (!canReadFinance) return null`): `accounts`, `receipts`, `dunning`, `exports`, `categories`. (`categories` redirects WITHOUT an `authLoading` wait — pin the premature-redirect-on-cold-session behaviour AS-IS, do NOT fix.)
   - **Lean role-only + DoubleEntry mode guard** (same as above PLUS a second effect that GETs `/api/v1/finance/profile` and `router.replace("/finance/settings")` unless `accountingMode === "DoubleEntry"`; data waits on `modeChecked`): `ledger-accounts`, `journal-entries`, `posting-mappings`. `accounting-reports` additionally returns `null` while `!modeChecked` (blank, not spinner).
   - **Inline "Not authorized" div** (reads role only; NO redirect, NO `return null` — renders a centered "Not authorized" message): `payments`, `expense-claims`, `bank-import`.
   - **Inline error page** (`authLoading` spinner; `if (!canReadFinance)` renders an inline error main; NO `router`, NO redirect): `fiscal-periods`.
   - **Spinner→`return null`, no redirect** (`authLoading` gate then `if (!canReadFinance) return null`): `budgets`, `budget-vs-actual`, `activity-areas`, `settings/page.tsx`, `settings/activity-areas`.
   - **No `!canReadFinance` early-return** (renders the empty default form/table to a non-read user): `settings/profile`, `settings/invoice-templates`, `settings/tax-codes`. Pin this AS-IS (it is a latent quirk, NOT to be "fixed" here).
   - The **redirect TARGET also differs** and must be pinned: `/` (dashboard, invoices list, transactions, accounts, receipts, dunning, exports, categories), `/finance/invoices` (invoices/new), `/finance` (invoices/[id]), `/finance/settings` (the DoubleEntry-mode guard on ledger-accounts/journal-entries/accounting-reports/posting-mappings).

3. **Write-guard assertions (`canWriteFinance`):** for EVERY page exposing a mutation/create/action affordance, a test asserts those affordances render only when `canWriteFinance` is true and are absent (or, where the god-page disables rather than hides, disabled) when it is false — i.e. `canReadFinance && !canWriteFinance` yields a read-only render. Cover at minimum: accounts/ledger-accounts/posting-mappings/categories/activity-areas/budgets/tax-codes/invoice-templates **New + Edit + Delete**; journal-entries **Post/Reverse/Edit(Draft-only)**; fiscal-periods **Generate/Close/Lock/Reopen** (and **Unlock = `isAdmin`-only**, not `canWriteFinance`); invoices list **"New invoice" link + per-row Send(Draft) + Cancel(not Cancelled/Paid)**; invoices/[id] action block; payments **Record/Submit/Approve(`isVorstand||isAdmin`)/Reject/Mark-paid/Delete/receipt attach-detach**; expense-claims **per-claim ownership+role predicates** (`claimantId===user?.email||isAdmin`, kassier/vorstand review/approve/reject/reimburse); dunning **Create + per-row Send(Draft)**; receipts **Upload + Delete**; bank-import **upload/camt + accept/reject/match/ignore/unmatch**; transactions **New/Edit/Delete + receipt attach/detach**; settings **backfill(`isDoubleEntry&&canWriteFinance`) + reset(`canWriteFinance`)**; settings/profile **all fields `disabled={!canWriteFinance}` + save footer hidden**.

4. **Happy-path + endpoint assertions:** for the authenticated+`canReadFinance` path, a test asserts each page renders its primary content (table/cards/form/report) and that the expected `/api/v1/finance/*` URLs are requested. The complete per-sub-area endpoint inventory (deduped, method+path) is recorded in Dev Notes → Endpoint Inventory and MUST be asserted at the page level (URL strings, query params for the server-side-filter pages).

5. **A76/A80/A86 destructive-affordance assertions PER surface:** pin the CURRENT colour/variant AND the failure branch of every delete/cancel/send/post/reverse/restore/disable/reject/revoke/detach action, PER surface (A80), preserving the CURRENT colour (A86 — finance actions already ship intentional, heterogeneous colours: delete=`text-red-600`/`bg-red-600`, journal post=`text-green-600`, journal reverse=`text-red-600`, fiscal close=yellow, payment approve=blue/reject=red/mark-paid=green/submit=yellow, invoice send=blue-icon+orange-confirm, dunning send=orange, bank-import accept=green/reject=red). Pin the failure branch for each: which handlers keep the list/modal AS-IS on `res.error` and which silently swallow (`accounts`/`posting-mappings`/`dunning`/`receipts`-upload do NOT inspect `res.error`; `fiscal-periods` shows the banner but closes the modal in `finally`; `journal-entries`/`ledger-accounts`-save keep the modal open). Confirm-mechanism per surface (modal vs inline two-step vs `window.confirm` vs **immediate-no-confirm**: invoices/[id] Cancel, payments Delete + receipt-detach fire with NO confirmation — pin that absence).

6. **File upload/download flows (highest-risk; S5):** pin the EXACT mechanisms so S5 cannot silently convert them:
   - **Upload**: `api.upload(endpoint, formData)` with `FormData` field `"file"` (bank-import + camt) / `"file"`+`"notes"` (receipts on transactions + receipts page); Content-Type omitted. Assert the FormData field name(s) + the endpoint.
   - **Download**: `api.get<Blob>(url)` → `res.data as Blob` → `URL.createObjectURL` → anchor `download=<filename>` → click → `revokeObjectURL`. Assert the blob request URL + the hardcoded client filename (`journal.csv`, `open-items.csv`, the receipt `fileName`/`"receipt"` fallback). Pin the exports anchor NOT being DOM-appended vs the transactions receipt anchor being appended+removed, and the preview-vs-download branch (image/`application/pdf` → modal; else download) with its deferred revoke.
   - bank-import: pin the **POST `/items/{id}/ignore`** (handleIgnore) vs **PUT `/items/{id}/ignore`** (handleUnmatch) same-path method divergence.

7. **A79 / A95 / A96 / A99 deltas recorded** (in each suite's `// A79 deltas:` header + Completion Notes) so S2..S6 resolve them explicitly:
   - **Transport (A88/A94):** every finance page already calls `useApiClient` directly (none use raw `fetch`, none use a finance lib function module — `lib/api/budgets.ts` is types+constants only). So the suites mock `@/lib/auth`'s `useApiClient` (stable `{get,post,put,delete,upload}` bag per A78); S2..S6 hooks keep calling `useApiClient`, so the transport mock **keeps intercepting with ZERO edits** (the BUILD-on-`useApiClient` case, like E27 admin-settings/integrations — NOT the E24 raw-fetch adaptation). Record this so a slice author does not "adapt" a mock that does not need adapting.
   - **A95 out-of-set `<select>` round-trip risks** to pin BEFORE the RHF+Zod migrations (S3/S6): `invoices/new` `recipientType` renders/POSTs **`"Other"`** while the canonical `@/types/finance` `RecipientType` + list/detail use **`"External"`**; `settings/profile` `countryCode` (27 EU codes, conditional on `jurisdiction==="EU"`, a CH↔EU flip strands a stale value in `form`), `currency` (CHF/EUR), `jurisdiction` (CH/EU); `settings/invoice-templates` `language` (en/de) + `jurisdiction`; `expense-claims` `currency` (CHF/EUR); ledger-account/journal-line `<select>`s filtered to `isActive` (editing a row referencing a now-inactive account renders a blank-but-retained value). Add a no-touch-edit round-trip assertion where the god-page round-trips an out-of-set value, so S3/S6 must preserve it.
   - **A96**: NO finance page trims submitted text today; record that the RHF+Zod migrations must NOT add `.trim()` to submitted fields. The only `.trim()`s today are enable-guards (`rejectReason.trim()`, `actionReason.trim()`) not applied to submitted bytes — pin those as enable-guards.
   - **A99**: only `invoices/[id]` is a real detail route; it has NO not-found sentinel (generic error banner on load failure; the one status-specific branch is e-invoice **409→`noProfileError`** amber panel). Pin that. (Other "details" are modals.)
   - **A100**: any page with an optimistic local-list mutation (invoices list Send/Cancel local status patch with NO refetch; payments) — record the overlay-reset-on-filter-change concern so S3 keys overlay resets on the filter, not on `data` identity.

8. Tests follow harness conventions: `// @vitest-environment jsdom`, `afterEach(cleanup)` (A35/A46), stable `useTranslations`/`useApiClient`/`useAuth`/`useRouter`/`useParams` mocks (A64/A78 — define each mocked object/fn ONCE, mutate per-test; `useApiClient` returns a STABLE `{get,post,put,delete,upload}` bag), `QueryClientProvider` wrapper on every render (A87 — forward-compat seam even though the god-pages are pre-TanStack). The shared finance harness lives at ONE seam reused across all 26 specs.

9. No production code changed (test-only). Full `vitest run` green against HEAD; the per-page assertion inventory is recorded with the read-guard assertion present in every finance-data-reading page's suite and the per-page deny-surface variant noted.

## Tasks / Subtasks

- [ ] Task 0: Spike confirm + shared harness setup (AC: 1, 7, 8)
  - [ ] Re-confirm `src/features/finance/` does NOT exist yet; capture the current full `vitest run` count at HEAD (the green baseline the net must preserve). Read the 3 existing finance suites being extended: `budgets/page.test.tsx`, `journal-entries/page.test.tsx`, `budget-vs-actual/page.test.tsx` (note what each already covers — see Dev Notes).
  - [ ] Establish the shared finance test harness (stable `useAuth`/`useApiClient`/`useTranslations`/`useRouter` mocks per A64/A78 + `QueryClientProvider` per A87), mirroring `frontend/src/features/members` / `admin-*` S1 nets. The `useApiClient` mock returns a stable `{get,post,put,delete,upload}` bag with per-URL routing.
  - [ ] Record the per-page guard reality table (AC-2) as the harness's source of truth so each suite asserts the right deny surface.
- [ ] Task 1: S2 sub-area suites — ledger/accounting (AC: 1-5, 7, 8) — `finance/page` (dashboard, read-only), `accounts`, `ledger-accounts`, `journal-entries` (EXTEND existing), `accounting-reports` (read-only), `fiscal-periods`, `posting-mappings`. Pin the DoubleEntry mode guard on the 4 mode-gated pages; the journal post/reverse colours + balance gate; the silent-swallow save/delete on accounts/posting-mappings.
- [ ] Task 2: S3 sub-area suites — receivables/payables (AC: 1-5, 7, 8) — `invoices` (list: New-invoice link, per-row Send/Cancel modals, client search + server status/date filters, optimistic local-status patch, DELETE-on-cancel), `invoices/new` (recipientType `"Other"` A95, line items, no validation), `invoices/[id]` (POST `/cancel` divergence, immediate-no-confirm Cancel, PDF/e-invoice blob, 409 e-invoice `noProfileError`), `receipts`, `payments` (status×role action matrix, immediate Delete/detach, hardcoded-English errors), `dunning`, `expense-claims` (ownership predicates).
- [ ] Task 3: S4 sub-area suites — budgeting/reporting (AC: 1-5, 7, 8) — `budgets` (EXTEND), `budget-vs-actual` (EXTEND; server-computed rows, CSV export blob), `activity-areas` (manage+report tabs, toggle-active, inline-confirm delete, hardcoded-English errors, local `formatCurrency`), `categories` (outlier redirect guard, modal delete).
- [ ] Task 4: S5 sub-area suites — banking/data (AC: 1-6, 7, 8) — `bank-import` (upload `file` field, camt, POST-vs-PUT `/ignore`, inline "Not authorized"), `transactions` (canonical guard, receipt upload `file`+`notes` + blob download/preview), `exports` (read-only, blob download, hardcoded filenames, no-append anchor). **This task owns the upload/download mechanism pins (AC-6).**
- [ ] Task 5: S6 sub-area suites — settings (AC: 1-5, 7, 8) — `settings` (nav hub + backfill + danger-zone reset + `finance-profile-changed` event), `settings/profile` (the big form, no-`return null` guard, countryCode A95, disabled-when-read-only), `settings/invoice-templates` (create-vs-edit field immutability), `settings/activity-areas` (CRUD-only, shares endpoints/type/namespace with S4 activity-areas), `settings/tax-codes` (rate ×100/÷100 round-trip).
- [ ] Task 6: Green-the-net + DoD gate (AC: 9) — full `vitest run` green at HEAD (×2 deterministic); `tsc`/eslint(changed)/prettier-check(changed); record the A79/A95/A96/A99/A100 per-suite delta inventory + the per-page guard-variant + assertion inventory.

## Dev Notes

The pre-refactor characterization net for the whole `finance/` route tree — 26 pages, the largest in the program. Finance is migrated as ONE `src/features/finance/` slice with a SHARED `api`/`types` foundation (not five independent dirs like admin), so organise suites by sub-area (S2..S6 groups) and keep the harness shared. The highest-risk behaviours to pin: the **heterogeneous read guards** (AC-2 — five+ distinct shapes), the **`canWriteFinance` write-gating** on every mutation, the **file upload/download** flows (AC-6), the **A95 out-of-set selects** ahead of the S3/S6 RHF+Zod migrations, and the **DoubleEntry mode guard** on the four accounting pages.

### Scope Boundaries

- In scope: co-located `*.test.tsx` for all 26 pages (new where missing — 23 pages; extended where present — `budgets`, `journal-entries`, `budget-vs-actual`); the shared finance test harness.
- Out of scope: ANY production code change; the slice extractions (S2..S6); creating `features/finance/`; i18n changes. **Do NOT "fix" the discovered quirks** — pin them AS-IS; S2..S6 decide them explicitly: the heterogeneous guards / missing `return null` / premature `categories` redirect / silent `res.error` swallow / hardcoded-English error strings (payments, activity-areas, bank-import upload) / the invoices-list-DELETE vs detail-POST `/cancel` divergence / the bank-import POST-vs-PUT `/ignore` divergence / the tax-code ×100/÷100 rate conversion. The net pins them; it does not repair them.

### Architecture Guardrails

- Mirror the E27-S1 / E25-S1 net recipe: `// @vitest-environment jsdom` + `afterEach(cleanup)` (A35/A46) for every file that calls `render()`; stable mocks (A64/A78 — the `useApiClient` bag + the `next-intl` translator must be MODULE-STABLE identities, NOT fresh per render; finance god-pages keep `t`/`api` in `useRef` or effect-dep chains, an unstable identity causes infinite render loops / non-deterministic refetch counts); `QueryClientProvider` wrapper (A87).
- A76/A80: pin the destructive/conditional affordance AND the failure branch PER surface. A86: assert the CURRENT colour (finance colours are heterogeneous and intentional — do NOT normalise to a generic `destructive`).
- A79/A95/A96/A99/A100: record (in test comments + Completion Notes) the deltas a `retry:false` harness cannot observe, so S2..S6 resolve them. Because the god-pages are pre-TanStack `useState`/`useEffect`, the `QueryClientProvider` wrapper is INERT (kept only for A87 forward-compat parity); note there is no provider-retry double-fetch to mask yet.
- Mock `@/lib/auth` (`useAuth` returning `{isAuthenticated,isLoading,canReadFinance,canWriteFinance,isAdmin,isVorstand,isKassier,user,accessToken}` mutated per-test + `useApiClient` returning the stable bag). Real colour/format helpers (`formatCHF`/`formatCurrency` from `@/lib/utils`, page-local badge helpers) kept via `importActual` so badge-className assertions pin the real logic.

### Existing suites to EXTEND (do not rewrite — DEC-1)

- `budgets/page.test.tsx`: covers rows-from-API render, Add-button shown when `canWriteFinance`, Add hidden + `noBudgets` for read-only. **Add**: the create/edit/delete submit + inline-confirm delete, the area/period server filters, the `authLoading` skeleton, the save/delete failure banners.
- `journal-entries/page.test.tsx`: covers ONLY the create-dialog ActivityArea selector render (REQ-044/E6-S2 AC-1). **Add**: the read/write guards, the DoubleEntry mode guard, post/reverse (colours + confirm + failure-keeps-modal), edit-load (Draft-only), the balance gate, status filter (server) + client search.
- `budget-vs-actual/page.test.tsx`: covers no-render-without-`canReadFinance` + generate→variance render. **Add**: the CSV export blob path (`/exports/budget-vs-actual`), the area filter, `noData`.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 (existing-test strategy):** A) EXTEND the 3 existing suites in place + ADD new files for the 23 untested pages (recommended — keeps the green baseline + fills gaps). B) rewrite the 3 existing suites. **Recommended: A.**
- **DEC-2 (guard heterogeneity — pin vs normalise):** A) pin each page's ACTUAL guard shape + deny surface + redirect target AS-IS (recommended — A56/A87; the net is a faithful oracle, S2..S6 decide any reconciliation via A90/A97 as a tracked DEC). B) assert a single idealised guard across all pages (WRONG — would make the net a false oracle for ~15 pages and silently license a behaviour change). **Recommended: A.**
- **DEC-3 (upload/download fidelity):** A) pin the exact `api.upload` FormData field names + the `api.get<Blob>` → object-URL → anchor download incl. hardcoded filenames + the POST-vs-PUT `/ignore` divergence (recommended — A76 highest-risk class). B) assert only that an upload/download "happened" (insufficient — a JSON-mutation regression would pass). **Recommended: A.**

### Testing Requirements

- The net IS the behaviour-preservation oracle (A87). Assert observable behaviour (rendered text via i18n labels scoped to the right region — finance uses many namespaces: `finance`, `finance.accounting`, `finance.settings`, `finance.vat`, `finance.invoiceTemplates`, `finance.taxCodes`, `budgets`, `budgetVsActual`, `activityAreas`, `fiscalPeriods`, `paymentApproval`, `expenseClaims`, `financeErrors`, `common`, `nav`; mock `next-intl` with a stable identity translator returning the key), fetch URLs, navigation (`router.push`/`router.replace` target), action handlers, badge presence via label, loading/error/empty states — NOT implementation detail.
- A35/A46: `afterEach(cleanup)` only for `render()`-calling suites.

### Project Structure Notes

- Co-located suites: `frontend/src/app/finance/**/page.test.tsx` (incl. the `invoices/new`, `invoices/[id]`, `settings/profile|invoice-templates|activity-areas|tax-codes` nested pages). No `features/` files created in this story.

### Endpoint Inventory (assert these URLs per page; deduped per sub-area)

- **S2 ledger/accounting:** `GET /api/v1/finance/profile`; dashboard `GET .../transactions/summary|dashboard|invoices/open|transactions`; `GET|POST .../accounts`, `PUT|DELETE .../accounts/{id}`; `GET|POST .../ledger-accounts`, `PUT|DELETE .../ledger-accounts/{id}`; `GET|POST .../journal-entries[?status=]`, `GET|PUT .../journal-entries/{id}`, `POST .../journal-entries/{id}/post|reverse`; `GET .../tax-codes|activity-areas|categories`; `GET .../accounting-reports/trial-balance?from=&to=|balance-sheet?asOfDate=|profit-and-loss?from=&to=`; `GET .../fiscal-periods?year=`, `POST .../fiscal-periods/generate`, `POST .../fiscal-periods/{id}/close|reopen|lock|unlock`; `GET|POST .../posting-mappings`, `PUT|DELETE .../posting-mappings/{id}`.
- **S3 receivables/payables:** `GET .../invoices[?status=&from=&to=]`, `GET .../invoices/open`, `GET .../invoices/{id}`, `POST .../invoices`, `POST .../invoices/{id}/send`, `POST .../invoices/{id}/cancel` (detail), `DELETE .../invoices/{id}` (list-cancel), `GET .../invoices/{id}/pdf` (blob), `GET .../invoices/{id}/einvoice?format=ubl` (blob); `GET .../payments[?invoiceId=]`, `POST .../payments`, `PUT|DELETE .../payments/{id}`, `POST .../payments/{id}/submit|approve|reject|mark-paid`, `POST|DELETE .../payments/{id}/receipt`; `GET|POST .../receipts`, `GET .../receipts/{id}`, `GET .../receipts/{id}/download` (blob), `DELETE .../receipts/{id}`; `GET|POST .../dunning`, `POST .../dunning/{id}/send`; `GET|POST .../expense-claims[?status=&myClaimsOnly=]`, `PUT|DELETE .../expense-claims/{id}`, `POST .../expense-claims/{id}/submit|review|approve|reject|reimburse`; `GET .../tax-codes|activity-areas` + `GET /api/v1/members?pageSize=500` (non-finance lookup, invoices/new).
- **S4 budgeting/reporting:** `GET .../activity-areas`, `POST .../activity-areas`, `PUT|DELETE .../activity-areas/{id}`, `GET .../activity-areas/report?from=&to=`; `GET .../fiscal-periods`; `GET .../budgets[?activityAreaId=&fiscalPeriodId=]`, `POST .../budgets`, `PUT|DELETE .../budgets/{id}`, `GET .../budgets/budget-vs-actual?fiscalPeriodId=&[activityAreaId=]`, `GET .../exports/budget-vs-actual?...` (CSV blob); `GET|POST .../categories`, `PUT|DELETE .../categories/{id}`.
- **S5 banking/data:** `GET|POST .../bank-imports` (upload `file`), `POST .../bank-imports/camt` (upload `file`), `GET .../bank-imports/{id}`, `POST .../bank-imports/{id}/items/{itemId}/ignore`, `PUT .../bank-imports/{id}/items/{itemId}/ignore|accept-match|reject-match|match`; `GET .../transactions[?from&to&type&accountId&categoryId]`, `POST .../transactions`, `PUT|DELETE .../transactions/{id}`, `POST|DELETE .../transactions/{id}/receipt`; `GET .../accounts|categories|activity-areas|receipts`, `POST .../receipts` (upload `file`+`notes`), `GET .../receipts/{id}`, `GET .../receipts/{id}/download` (blob); `GET .../exports/journal?from=&to=` (blob), `GET .../exports/open-items` (blob).
- **S6 settings:** `GET|POST .../profile`, `PUT .../profile/{id}`, `POST .../backfill-double-entry`, `DELETE .../reset`; `GET|POST .../invoice-templates`, `PUT|DELETE .../invoice-templates/{id}`; `GET|POST .../activity-areas`, `PUT|DELETE .../activity-areas/{id}`; `GET|POST .../tax-codes`, `PUT|DELETE .../tax-codes/{id}`.

### References

- Net recipe: `frontend/src/app/admin/**/page.test.tsx` (E27-S1, 15-page net), `frontend/src/features/members/**/*.test.tsx`; the E21-S2/E22-S1/E25-S1 ATDD nets.
- Existing finance tests to extend: `frontend/src/app/finance/{budgets,journal-entries,budget-vs-actual}/page.test.tsx`.
- Pages: all 26 under `frontend/src/app/finance/`. Transport seam: `frontend/src/lib/auth.ts` (`useAuth` `canReadFinance`=admin/kassier/auditor, `canWriteFinance`=admin/kassier; `useApiClient` `{get,post,put,delete,upload}` → `{data,error,status}`, blob for non-JSON). Shared types: `frontend/src/types/finance.ts`. Budgets types/consts: `frontend/src/lib/api/budgets.ts`. Helpers: `frontend/src/lib/utils.ts` (`formatCHF`/`formatCurrency`).
- project-context.md A34/A35/A46/A56/A58/A64/A72/A73/A76/A78/A79/A80/A86/A87/A90/A95/A96/A97/A99/A100/A101; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. Blocks S2..S6.
- **A56 findings (load-bearing — the epic skeleton over-generalises finance behaviour):**
  - **Guards are NOT uniform** (the dominant finding): five+ distinct read-guard shapes + four distinct redirect targets across the 26 pages (see AC-2). The epic spec's "redirect to `/` + `null` render when `!isAuthenticated || !canReadFinance`" is true for only 3 pages (dashboard/invoices-list/transactions). The net pins each page's ACTUAL guard; the slice stories preserve them per page.
  - **Test baseline:** only `budgets`, `journal-entries`, `budget-vs-actual` have tests (extend); the other 23 pages have NONE (write fresh).
  - **`lib/api/budgets.ts` is types+constants only** (zero functions, zero fetching) — S4 BUILDs typed functions over `useApiClient` reusing its types/consts; there is nothing to "wrap" (corrects the spec's "wrap budgets.ts" framing).
  - **ALL pages use `useApiClient` direct** — so the net mocks `useApiClient`; S2..S6 hooks keep calling it → transport mocks survive with ZERO edits (BUILD-on-`useApiClient`, like E27 admin-settings/integrations).
  - **DoubleEntry mode guard** on ledger-accounts/journal-entries/accounting-reports/posting-mappings (GET profile → redirect `/finance/settings` unless DoubleEntry) — extra guard the spec omits.
  - **A95 traps** confirmed: `invoices/new` recipientType `"Other"` vs canonical `"External"`; `settings/profile` countryCode CH↔EU strand; many `isActive`-filtered selects. **A96**: no page trims submitted bytes.
  - **Endpoint divergences to pin (not fix):** invoices list cancel = `DELETE /invoices/{id}` vs detail cancel = `POST /invoices/{id}/cancel`; bank-import `POST` vs `PUT` on `/items/{id}/ignore`; tax-codes rate ×100 (display) / ÷100 (wire).
  - **Hardcoded-English error strings** (payments, both activity-areas, bank-import upload) — preserve verbatim, do NOT translate.

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (characterization net for all 26 finance pages across 5 sub-areas; reality-corrected guard inventory per A56 — five+ heterogeneous guard shapes + four redirect targets pinned AS-IS; behaviour-lock the `canReadFinance`/`canWriteFinance` split, the upload/download flows, the DoubleEntry mode guard, the A95 out-of-set selects, and the endpoint divergences). Status ready-for-dev. Blocks S2..S6.
