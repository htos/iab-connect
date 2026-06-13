# E26 Finance — Shared Characterization-Net Harness Brief (S1) + Slice Conventions

This brief is the SINGLE source of truth for the E26 Finance characterization net (S1) and the
five slice extractions (S2..S6). Every parallel sub-area agent MUST follow it verbatim so the 26
co-located `*.test.tsx` suites are a consistent, faithful oracle (A101 — pin the shared idioms in
ONE brief; divergence between parallel agents is the failure mode this prevents).

---

## 0. Non-negotiable goals

- **The net is the behaviour-preservation ORACLE (A87).** It pins the CURRENT (god-page) observable
  behaviour and must be **GREEN against branch HEAD** before any refactor. You iterate
  (write → `vitest run <your files>` → fix) until your sub-area's suites are 100% green at HEAD.
- **Pin AS-IS; do NOT "fix" quirks (DEC-2=A).** Heterogeneous guards, missing `return null`,
  premature redirects, silent `res.error` swallow, hardcoded-English error strings, endpoint
  divergences (DELETE-vs-POST cancel, POST-vs-PUT `/ignore`), tax-code ×100/÷100 — pin them exactly.
- **Test observable behaviour, not implementation detail**: rendered i18n-key text, fetch URLs +
  method + body, navigation target (`router.push`/`router.replace`), action handlers fired, badge
  presence via label, loading/error/empty states, destructive affordance colour + failure branch.

## 1. Harness recipe (top of EVERY `*.test.tsx` that calls `render()`)

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// next-intl: STABLE identity translator (A64/A78 — define ONCE, return the same fn).
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

// next/navigation: shared router spies (define push/replace OUTSIDE the factory is NOT allowed —
// vi.mock is hoisted; declare the spies INSIDE via a holder object, see below).
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useParams: () => params,            // only on pages that read params (invoices/[id])
  usePathname: () => "/finance",
}));

// next/link: passthrough
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href?: string }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

// @/lib/auth: mutable authState (flip per-test) + STABLE useApiClient bag (A78).
const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const apiUpload = vi.fn();
const authState = {
  isAuthenticated: true,
  isLoading: false,
  canReadFinance: true,
  canWriteFinance: true,
  isAdmin: true,
  isVorstand: true,
  isKassier: true,
  isAuditor: false,
  user: { name: "Kassier", email: "kassier@example.org" },
  accessToken: "tok",
};
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
  useApiClient: () => ({ get: apiGet, post: apiPost, put: apiPut, delete: apiDelete, upload: apiUpload }),
}));

import Page from "./page";   // the god-page at HEAD; the SAME import survives the slice migration

beforeEach(() => {
  // object-URL stubs for blob-download pages (exports, transactions receipt, invoices pdf)
  global.URL.createObjectURL = vi.fn(() => "blob:mock");
  global.URL.revokeObjectURL = vi.fn();
  apiGet.mockImplementation((url: string) => routeGet(url));  // per-URL routing, see §3
  apiPost.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiPut.mockResolvedValue({ data: {}, error: null, status: 200 });
  apiDelete.mockResolvedValue({ data: null, error: null, status: 200 });
  apiUpload.mockResolvedValue({ data: {}, error: null, status: 200 });
});

afterEach(() => {
  cleanup();                 // A35/A46 — MANDATORY for render()-calling suites (no auto-cleanup)
  vi.clearAllMocks();
  // reset authState to the read+write default
  Object.assign(authState, { isAuthenticated: true, isLoading: false, canReadFinance: true,
    canWriteFinance: true, isAdmin: true, isVorstand: true, isKassier: true, isAuditor: false });
});
```

### Rules
- **NO `QueryClientProvider` in the test.** Render `<Page />` DIRECTLY. At HEAD the god-pages are
  pre-TanStack (provider irrelevant). After the S2..S6 migration, each slice **content composition
  root embeds its OWN `QueryClientProvider`** (the `features/admin-settings/components/admin-settings-page-content.tsx`
  precedent — copy it), so the SAME test renders unchanged. This is the A94 BUILD case: the net
  survives the migration with ZERO transport edits because it mocks `@/lib/auth#useApiClient`, which
  the slice hooks keep calling. **Do not import `@tanstack/react-query` in any S1 suite.**
- `useApiClient` returns `{ get, post, put, delete, upload }`; each call resolves
  `{ data, error, status }`. For non-JSON (blob) responses `data` is the `Blob` itself.
- `useAuth` shape: `{ isAuthenticated, isLoading, user, roles, accessToken, isAdmin, isVorstand,
  isKassier, isAuditor, isMember, canReadFinance, canWriteFinance, hasRole, hasAnyRole, ... }`.
  Add `isMember`/`hasRole`/`hasAnyRole: () => false` to `authState` ONLY if a page reads them.
- Keep REAL helpers (`formatCHF`/`formatCurrency` from `@/lib/utils`) via NOT mocking `@/lib/utils`
  (import the real module) so currency/badge-class assertions pin the real logic.
- `next-intl` translator returns the KEY — assert on the i18n KEY string (e.g. `screen.getByText("save")`),
  scoped via `within(...)` when a key appears multiple times. Finance namespaces: `finance`,
  `finance.accounting`, `finance.settings`, `finance.vat`, `finance.invoiceTemplates`,
  `finance.taxCodes`, `budgets`, `budgetVsActual`, `activityAreas`, `fiscalPeriods`,
  `paymentApproval`, `expenseClaims`, `financeErrors`, `common`, `nav`.

## 2. Read-guard assertions (AC-2) — pin each page's ACTUAL shape (do NOT normalise)

For every page that reads finance data, assert: when the deny condition holds, the page does NOT
fire its finance API GETs AND reaches its CURRENT deny surface. The shapes (pin EXACTLY):

- **Canonical** (`isAuthenticated`+`authLoading`; spinner while `authLoading||loading`; `router.push("/")`;
  `if (!isAuthenticated||!canReadFinance) return null`): `finance/page` (dashboard), `invoices/page`,
  `transactions/page`.
- **Lean role-only** (`canReadFinance`(+`canWriteFinance`) only; `router.replace("/")`;
  `if (!canReadFinance) return null`): `accounts`, `receipts`, `dunning`, `exports`, `categories`
  (`categories` redirects WITHOUT an `authLoading` wait — pin the premature-redirect-on-cold-session AS-IS).
- **Lean + DoubleEntry mode guard** (GET `/api/v1/finance/profile`; `router.replace("/finance/settings")`
  unless `accountingMode === "DoubleEntry"`; data waits on `modeChecked`): `ledger-accounts`,
  `journal-entries`, `posting-mappings`. `accounting-reports` additionally returns `null` while `!modeChecked`.
- **Inline "Not authorized" div** (role only; NO redirect, NO `return null`): `payments`,
  `expense-claims`, `bank-import`.
- **Inline error page** (`authLoading` spinner; `if (!canReadFinance)` inline error main; NO redirect):
  `fiscal-periods`.
- **Spinner→`return null`, no redirect**: `budgets`, `budget-vs-actual`, `activity-areas`,
  `settings/page`, `settings/activity-areas`.
- **No `!canReadFinance` early-return** (renders empty form/table to a non-read user — pin AS-IS):
  `settings/profile`, `settings/invoice-templates`, `settings/tax-codes`.
- **Redirect TARGET differs** — pin it: `/` (dashboard, invoices list, transactions, accounts, receipts,
  dunning, exports, categories), `/finance/invoices` (invoices/new), `/finance` (invoices/[id]),
  `/finance/settings` (DoubleEntry-mode guard on ledger-accounts/journal-entries/accounting-reports/posting-mappings).

**You MUST verify each guard against the actual page source** — read the page, find the guard effect +
render-time early-returns, and pin what it ACTUALLY does. The list above is the expected map; if a page
diverges, pin the REALITY and note it in the suite's `// A56 note:` header.

## 3. Per-URL GET routing helper

Define a `routeGet(url)` that returns the right fixture per endpoint (mirror the admin-settings test's
`apiGet.mockImplementation`). Use `.startsWith`/`.includes` matching since pages append query strings.
Assert the EXACT URL strings (incl. query params for server-filtered pages) in happy-path tests.

## 4. Write-guard (AC-3), affordance (AC-5), upload/download (AC-6), A79/A95/A96/A99/A100 deltas

- **AC-3 write-guard**: for every mutation/create/action affordance, assert it renders only when
  `canWriteFinance` (or the page's finer predicate), and is absent/disabled when
  `canReadFinance && !canWriteFinance`. Cover the per-page affordance list in your sub-area spec.
- **AC-5 destructive affordance (A76/A80/A86)**: pin the CURRENT colour class AND the failure branch
  (which handlers keep the modal/list on `res.error`, which silently swallow). PER surface. Preserve
  the heterogeneous finance colours (delete=`text-red-600`/`bg-red-600`, journal post=`text-green-600`,
  reverse=`text-red-600`, fiscal close=yellow, payment approve=blue/reject=red/mark-paid=green/submit=yellow,
  invoice send=blue-icon+orange-confirm, dunning send=orange, bank accept=green/reject=red). Pin
  confirm-mechanism per surface (modal / inline two-step / `window.confirm` / immediate-no-confirm).
- **AC-6 upload/download** (S5 owns the pins): upload = `api.upload(endpoint, formData)`, FormData field
  `"file"` (+`"notes"` for receipts), Content-Type omitted — assert the field name(s) + endpoint.
  Download = `api.get<Blob>(url)` → `URL.createObjectURL` → anchor `download=<filename>` → click →
  `revokeObjectURL` — assert blob URL + hardcoded client filename; pin appended-vs-not anchor + preview branch.
- **Record deltas** in each suite's `// A79 deltas:` header comment + report them back: A95 out-of-set
  `<select>` round-trips (invoices/new `recipientType "Other"`; settings/profile `countryCode`; etc.),
  A96 (no page trims submitted bytes today), A99 (only invoices/[id] is a real detail route, no
  not-found sentinel, 409→`noProfileError`), A100 (optimistic local-list patches with no refetch).

## 5. Existing suites to EXTEND in place (DEC-1=A — do NOT rewrite)

- `budgets/page.test.tsx` (S4 group) — ADD create/edit/delete + inline-confirm delete, area/period
  server filters, `authLoading` skeleton, save/delete failure banners.
- `journal-entries/page.test.tsx` (S2 group) — ADD read/write guards, DoubleEntry mode guard,
  post/reverse (colours+confirm+failure-keeps-modal), edit-load (Draft-only), balance gate, status filter+search.
- `budget-vs-actual/page.test.tsx` (S4 group) — ADD CSV export blob path, area filter, `noData`.

## 6. DoD for your sub-area (S1)

- `npx vitest run <your files>` → 100% green at HEAD, run TWICE (deterministic).
- `npx tsc --noEmit` clean for your files; `npx eslint <your files>` clean; `npx prettier --check <your NEW files>`.
- Report back: the list of suites written/extended, per-page guard-variant confirmed, the A79/A95/A96/A99/A100
  deltas you found, and any page whose REALITY diverged from the §2 expected map.

---

## SLICE CONVENTIONS (S2..S6 — for the extraction phase, after the net is green)

- Slice = ONE `src/features/finance/` dir with a SHARED foundation (NOT five dirs). S2 OWNS
  `api/finance-api.ts` (`FINANCE_BASE="/api/v1/finance"` + `financeKeys` root + ledger/accounting URL
  builders) + `types/finance.types.ts` (re-export `@/types/finance` per A83 + new ledger/accounting types
  + the SHARED `ActivityArea`/`TaxCode`/`Category` read-lookup types). S3..S6 ADD their own
  `<sub>-api.ts`/`<sub>.types.ts` importing S2's root — they NEVER edit S2's files (parallel-safe, A91/A101).
- **API layer = URL builders + `financeKeys` ONLY (no fetching).** Hooks own the `useApiClient` calls.
  This keeps the S1 `useApiClient` mock intercepting → net survives with ZERO transport edits (A94 BUILD).
- **Each slice content composition root embeds its OWN `QueryClientProvider`** (copy admin-settings).
  Use `new QueryClient({ defaultOptions: { queries: { retry: false } } })` so A93/A99 retry-delays don't
  appear; the journal/invoice detail queries explicitly `retry: false` (A99).
- Thin route shell: `app/finance/**/page.tsx` becomes `export default function X(){ return <XContent/> }`,
  a server entry (NO `"use client"`). The content root is the only `"use client"`.
- Forms: S3 (invoice) + S4 (budget/activity-area/category) + S6 (settings) use the E22 RHF+Zod sub-recipe.
  **A95**: Zod field = FULL transport union (`z.string()`, NEVER `z.enum(renderedSubset)`); raw stored value
  in `defaultValues`; render out-of-set value as an extra `<option>`. **A96**: NEVER `.trim()` a submitted
  field — use `.min(1)`/`.refine`; required-ness MATCHES the god-page's enable-gate (do NOT add validation
  the god-page lacks); `<form noValidate>` renders per-field Zod errors. **A98**: thread mode-divergent
  surfaces through props + pin both modes. **A92**: drive form/modal reset+close from the mutation OUTCOME
  (`onSuccess`), never synchronously after `mutate()` (error path must preserve input).
- Preserve action colours (A86). Reuse `formatCHF`/`formatCurrency` from `@/lib/utils`. No new `any`, no
  new hardcoded user-facing strings, no raw API URL in components (all URLs centralised in the api layer).
- DoD: `tsc --noEmit` exit 0; `eslint` slice+changed clean (incl. the generic `features/**` boundary);
  `prettier --check` (NEW files may be `prettier --write`; NEVER `prettier --write` a modified pre-drifted
  file — A72); full `vitest run` green; LF endings (A73). `next build` deferred to epic boundary (A58).
