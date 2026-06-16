# Frontend Refactoring — Full Program Roadmap (whole `frontend/`)

Created: 2026-06-07
Scope: the ENTIRE `frontend/` folder — not a single feature. Goal: a clean, consistent, feature-slice frontend.
Status of authoring: **Foundation epic (E21) is authored. The domain migration epics (E22+) below are PLANNED — they are materialised via `bmad-create-epics-and-stories` only AFTER the Suppliers pilot (E21-S3) closes**, so their stories inherit a proven recipe instead of provisional ACs.
Grounding: `docs/frontend-refactoring-gate1-analysis.md` (Gate-1 as-is analysis). Source: user-authored "Frontend Brownfield Refactoring Prompt".

---

## Why a program, not one epic

`frontend/src/app` holds **97 `page.tsx` files (84 are `"use client"`)** across ~13 domains. That is far too large for one epic. The program is sequenced so that:

1. **E21 proves the pattern once** (Suppliers pilot) and fixes the shared foundations (HTTP-client contract, TanStack convention, theming rule, boundary enforcement).
2. **E22+ repeat the proven recipe** domain by domain, each: characterization-tests-first → extract `features/<domain>/` → behaviour preserved → gates + i18n parity green.
3. **E31 cleans up** once every feature is migrated (retire legacy clients / shims).

Principle (from the source prompt): *"first one feature as a pattern, then repeat with review."* Therefore every E22+ epic is **blocked by E21-S3** and its detailed ACs are written post-pilot.

---

## Full domain inventory (page.tsx counts)

| Domain | Pages | Notes |
|---|---:|---|
| suppliers | 4 | **E21 pilot** (list) + detail/new/edit follow in E22-wave |
| sponsors | 4 | mirror of suppliers; shares `types/sponsors.ts` |
| members | 9 | list/[id]/edit/new + duplicates + segments(CRUD); has `components/members/*` to relocate |
| events `(dashboard)` | 8 | list/new/[id] edit/check-in/fees/registrations/volunteers |
| finance | 26 | largest by far — ledger, invoices, payments, budgets, settings, imports |
| admin | 15 | users, settings, audit, backups, health, retention, api-clients, webhooks, documents, register |
| communication | 12 | automations/email-campaigns/email-templates (CRUD each); has `components/email-templates/*` to relocate |
| public | 9 | unauthenticated site: blog, contact, events, license, newsletter, sponsors, unsubscribe — separate layout |
| board | 2 | board/documents |
| profile | 2 | profile + profile/security |
| documents | 1 | |
| auth + login | 2 | auth/error, login |
| app shell / api | — | `layout.tsx`, `providers.tsx`, root `page.tsx`, system pages, `api/auth/[...nextauth]`, `api/health` |
| **Total** | **~97** | + shared `components/*` |

Shared `components/`: `ui` (keep — design system), `navigation`/`providers`/`search` (keep — global infra), **`members` + `email-templates` (relocate into their feature slices)**.

---

## Foundation — Epic E21 (authored, in `epics-and-stories.md`)

- E21-S1 Target-state architecture + decisions (Gate 2) — **ready**
- E21-S2 Suppliers characterization tests — **ready**
- E21-S3 Suppliers feature-slice pilot (Gate 3) — drafted (dep S1+S2)
- E21-S4 i18n parity: suppliers keys in `hi.json` — **ready** (parallel)
- E21-S5 Architecture boundary enforcement — drafted (dep S3)

Open question for E21-S4 follow-up: if the `hi.json` gap is broad (not just suppliers), add a one-off **i18n parity sweep** story here once the S4 baseline is known.

---

## Migration program — planned epics (E22+, authored after E21-S3)

Each epic: blocked by E21-S3; recipe = E21-S3 artifact; every story is "tests-first → extract slice → behaviour preserved → gates + parity green"; no backend/route-group/contract changes beyond the agreed standard.

### E22 — Sponsors (≈1–2 stories)
4 pages (list, [id], [id]/edit, new). Closest mirror of Suppliers → the **recipe-validation epic**. Coordinate with the Supplier/Sponsor type split done in E21-S3 (keep shared `ContractLink*`).

### E23 — Members (≈4 stories)
9 pages + `components/members/*` relocation. Suggested stories: (a) members core (list/[id]/edit/new), (b) duplicates UI, (c) segments (CRUD), (d) relocate `components/members` + align `lib/api/members.ts` to the chosen contract and move colour-in-TS helpers to tokens/Badge variants.

### E24 — Events (≈2–3 stories)
8 pages under `(dashboard)`. Suggested: (a) events core (list/new/[id]/edit), (b) event sub-pages (check-in/fees/registrations/volunteers). Route group is NOT moved (E21-S1 recommendation only).

### E25 — Communication (≈3–4 stories)
12 pages + `components/email-templates/*` relocation. Suggested: (a) automations CRUD, (b) email-campaigns CRUD, (c) email-templates CRUD + relocate `components/email-templates`.

### E26 — Finance (≈5–6 stories; may split into two epics)
26 pages — the largest surface. Suggested story groups: (a) core ledger/accounting (accounts, ledger-accounts, journal-entries, accounting-reports, fiscal-periods, posting-mappings), (b) receivables/payables (invoices+[id]+new, receipts, payments, dunning, expense-claims), (c) budgeting/reporting (budgets, budget-vs-actual, activity-areas, categories), (d) banking/data (bank-import, transactions, exports), (e) finance settings (settings + activity-areas/invoice-templates/profile/tax-codes). Sensitive area: preserve `canReadFinance`/`canWriteFinance` checks; route through guards, do not weaken.

### E27 — Admin (≈4–5 stories) — includes the route-group/feature decision
15 pages. First resolve the E21-S1 question: is `admin` one feature or an area containing sub-features (Users, Settings, Audit, Backups, Health)? Suggested stories: (a) admin users (+[id]/sessions/new), (b) admin settings, (c) admin system (audit/backups/health/retention), (d) admin integrations (api-clients/webhooks/deliveries), (e) admin documents/register.

### E28 — Public Site (≈3 stories)
9 unauthenticated pages with a separate layout. Distinct concerns: SEO/SSR — strongest candidate for genuine **Server Components** (prompt rule 14). Suggested: (a) public content (blog/events/sponsors), (b) public forms (contact/newsletter/unsubscribe), (c) public static (license).

### E29 — Smaller Features (≈3 stories)
documents (1), board/documents (2), profile + profile/security (2). One story each.

### E30 — Auth & App Shell (≈2–3 stories)
`layout.tsx`, `providers.tsx`, root `page.tsx`, system pages (module-unavailable, site-unavailable, error/global-error/not-found/loading), auth/error, login, `api/auth/[...nextauth]`, `api/health`. Introduce `components/layout` primitives (PageShell, PageHeader from the prompt's building blocks). NOTE: introduce PageShell/PageHeader **early** (as needed during the first migrations) and **consolidate** them here.

### E31 — Legacy HTTP-client Retirement (≈1–2 stories) — last
Once every feature uses the E21-S1 standard contract: remove compatibility shims and delete the retired client(s) (`lib/api-client.ts` class and/or whichever pattern loses). Final consolidation; depends on ALL migration epics.

---

## Suggested sequencing waves (post-pilot)

1. **Validate recipe:** E22 Sponsors.
2. **Mid-size features:** E23 Members, E24 Events, E29 Smaller.
3. **Broad features:** E25 Communication, E27 Admin.
4. **Largest:** E26 Finance.
5. **Public surface:** E28.
6. **Shell/auth:** E30 (extract a minimal PageShell early; full consolidation here).
7. **Cleanup:** E31 (retire legacy clients).

Per the hybrid BMAD workflow (`feedback_bmad_workflow.md`): bundle `bmad-code-review` + `bmad-retrospective` at each epic boundary, not per story.

---

## Rough magnitude

~13 domain/cross-cutting epics (E22–E31), an estimated **30–40 stories** total once decomposed, covering all ~97 pages + component relocation + shell + client retirement. Exact counts are set when `bmad-create-epics-and-stories` runs against this roadmap after E21-S3.

## Next action

1. Implement E21 (S1 → S2 → S3; S4 in parallel; S5 after S3).
2. After E21-S3 closes, run `bmad-create-epics-and-stories` against this roadmap to author E22+ with grounded ACs.
