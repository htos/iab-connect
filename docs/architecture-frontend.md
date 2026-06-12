# IAB Connect - Frontend Architecture

Date: 2026-05-12
Part: Frontend Web App
Location: `frontend/`

## Purpose

The frontend is a Next.js application that provides the authenticated member/admin experience and public website pages. It consumes the backend API, authenticates through NextAuth/Keycloak, manages translations through next-intl, and applies Tailwind/Radix UI patterns.

## Architectural Style

The frontend uses Next.js App Router with feature routes under `frontend/src/app`. Shared components live under `frontend/src/components`, and cross-feature client code lives under `frontend/src/lib`.

Key frontend boundaries:

- `src/app`: route tree, page components, layouts, API route handlers
- `src/components/navigation`: authenticated shell, header, sidebar, public header/footer
- `src/components/ui`: shared UI primitives
- `src/components/providers`: global context providers
- `src/components/search`: global search UI
- `src/lib/api`: typed feature API wrappers
- `src/lib/services`: feature service helpers
- `src/lib/auth.ts`: auth hooks and API helper wrappers
- `src/types`: shared frontend DTO/type definitions
- `messages`: translation files

## Entry Points

- Root layout: `frontend/src/app/layout.tsx`
- Providers: `frontend/src/app/providers.tsx`
- Main shell: `frontend/src/components/navigation/MainLayout.tsx`
- Auth route: `frontend/src/app/api/auth/[...nextauth]/route.ts`
- Public layout: `frontend/src/app/public/layout.tsx`

## Layout and Navigation

Authenticated pages use `MainLayout`, which renders Header and Sidebar when authenticated. Public/login/auth routes bypass the authenticated shell.

The Sidebar is role-aware and includes module navigation for dashboard, profile, members, events, documents, communication, finance, partner management, and admin. Some finance menu items are controlled by double-entry accounting mode.

Public pages use a separate public layout/header/footer.

## State and Data Fetching

Global providers include:

- `SessionProvider` from next-auth
- `QueryClientProvider` from TanStack Query
- `SidebarProvider`
- `AppSettingsProvider`

The app contains both generic API helpers (`api-client.ts`, `auth.ts`) and feature-specific API modules under `src/lib/api` and `src/lib/services`. Existing code mixes helper usage and direct fetch calls; new work should prefer typed wrappers and consistent refresh patterns.

## Authentication and Authorization UX

`useAuth` exposes session state, roles, access token, and role helpers. Frontend role checks hide navigation and actions, but backend policies remain authoritative.

Known roles include:

- admin
- vorstand
- kassier
- auditor
- member

## Internationalization

The frontend uses next-intl. UI text should use translation keys and files under `frontend/messages`. Existing documentation states that UI text should be English by default with German translations available.

## UI and Styling

Styling uses Tailwind CSS 4 and shared UI components. Existing frontend design standards require:

- orange-600/orange-700 for primary actions and links
- authenticated page layout with gray background and max-width content containers
- search fields on list/table pages
- mobile-first responsive classes
- no hardcoded UI strings
- no new blue primary action styling

Radix primitives and lucide-react are available. Existing code still contains some manual SVGs and blue links; treat new work as an opportunity to align with standards.

## Route Surface

Major route areas:

- `/` dashboard
- `/login`, `/auth/*`
- `/admin/*`: audit, backups, documents, health, register, retention, settings, users
- `/members/*`: members and member segments
- `/events/*`: event management and registrations
- `/communication/*`: email campaigns and templates
- `/documents`, `/board/documents`
- `/finance/*`: dashboard, accounts, transactions, invoices, payments, dunning, receipts, fiscal periods, ledger, reporting, settings
- `/sponsors/*`, `/suppliers/*`
- `/profile`
- `/public/*`: blog, contact, events, newsletter, sponsors, unsubscribe

The 2026-05-12 rescan found 14 App Router route groups. The largest feature areas by file count are `finance`, `admin`, `public`, `members`, and `communication`.

## Testing Strategy

The frontend has Vitest, Testing Library, and Playwright configured, but visible test files are sparse. Add tests when changing shared UI, forms, auth-dependent rendering, routing, or critical workflows.

## Key Risks and Observations

- Some pages use direct `fetch` and inline refresh calls despite newer project rules favoring refresh-trigger state plus effects.
- Some UI still uses inline SVGs and blue links; new work should use lucide-react and orange primary styling.
- The route surface is broad; test coverage should be expanded around shared patterns and critical admin/finance/member workflows.
- Public and authenticated layouts are intentionally separate; avoid blending their navigation models.

---

# Target-State (Feature-Slice) Architecture

Added: 2026-06-07 (Epic E21-S1, "Gate 2 / Brownfield-Zielbild"). This section
**extends** the as-is description above; it does not replace it. It is the durable
target every subsequent migration (the Suppliers pilot E21-S3, then the program
epics E22–E31) must follow. It is grounded in
[`docs/frontend-refactoring-gate1-analysis.md`](frontend-refactoring-gate1-analysis.md)
(the Gate-1 as-is analysis) and the source
[`docs/frontend-brownfield-refactoring-prompt.md`](frontend-brownfield-refactoring-prompt.md).

This is a **technical initiative — there is no REQ**. The rules below are adapted
to *verified* project reality, not copied from the prompt verbatim (see "Reality
corrections" callouts).

## Feature-Slice Layout

New and migrated feature code lives in a feature slice, not in the route file:

```text
src/features/<feature>/
  api/        # typed client functions for this feature; URLs encapsulated here
  components/ # feature client components ("use client" composition root + parts)
  hooks/      # server-state hooks (TanStack Query) + feature UI hooks
  schemas/    # Zod schemas for filters/forms (optional, add when needed)
  types/      # feature-specific types (shared cross-domain types stay in src/types)
```

The route file under `src/app/**/page.tsx` becomes a thin entrypoint:

```tsx
import { SuppliersPageContent } from "@/features/suppliers/components/suppliers-page-content";

export default function SuppliersPage() {
  return <SuppliersPageContent />;
}
```

`src/components` keeps only **domain-neutral** shared code:
`components/ui` (primitives), `components/navigation`, `components/providers`,
`components/search`, and `components/layout` (if/when introduced).
`src/lib` stays **technical infrastructure only** (auth, http client, config,
utils) — it is not a home for feature services.

**Area sub-slices (E27 precedent).** A broad route *area* that groups several
distinct sub-domains under one URL prefix is migrated as one slice **per
sub-area**, not a single mega-slice. `admin/*` (15 pages) became five
mutually-independent slices — `features/admin-users`, `features/admin-settings`,
`features/admin-system` (audit/backups/health/retention), `features/admin-integrations`
(api-clients/webhooks/deliveries), and `features/admin-documents` (folder manager +
public register). Each owns its own `{api,hooks,components,schemas,types}`, wraps
its own `lib` transport (or builds on `useApiClient` where no `lib` module owns the
URLs), and may not import a sibling `features/admin-*` (the generic `src/features/**`
ESLint boundary covers them with no per-feature config entry). Naming convention:
`features/admin-<sub-area>/`.

**One slice + shared foundation (E26 Finance precedent).** Where a route area is
**one cohesive feature** whose pages share DTOs, query keys, and endpoint families
(rather than several independent sub-domains), it is migrated as a **single
`features/finance/` slice with a shared foundation** — contrast the admin area's five
*mutually-independent* sub-slices above. The foundation story (E26-S2) OWNS
`api/finance-api.ts` (`FINANCE_BASE` + a `financeKeys` root key-factory with a `scope`
namespacing helper + all the ledger/accounting URL builders + the shared read-lookup
builders activity-areas/tax-codes/categories/profile) and `types/finance.types.ts`
(re-export of `@/types/finance` per A83 + the new ledger/accounting + shared read-lookup
types). The api layer is **URL builders + keys only — no fetching**; the hooks own the
`useApiClient` calls, so a BUILD-on-`useApiClient` characterization net survives the
migration with zero transport edits (A94). Later finance stories (E26-S3..S6) ADD their
own `<sub>-api.ts`/`<sub>.types.ts` that **import** the foundation root and never edit
it — keeping the sibling slice extractions parallel-safe (A91/A101). Each page-content
composition root is the only `"use client"` and self-embeds its own
`QueryClientProvider` (`new QueryClient({ defaultOptions: { queries: { retry: false } } })`,
the admin-settings precedent); the app-router `page.tsx` files are thin server entries
importing the content root. Intra-slice imports are relative (it is one feature). Naming
convention: `features/finance/` (one slice; sub-resources live in files, not sibling
features).

## Target Import Direction

```text
app        -> features, components/{layout,navigation,providers}, lib
features   -> components/ui, lib, src/types (shared types only)
components/{layout,navigation} -> components/ui
components/providers           -> lib
components/ui -> lib/utils                  (allowed)
components/ui -> features | app             (FORBIDDEN)
lib        -> app | features                (FORBIDDEN — lib is leaf infra)
features/<a> -> features/<b>                (only with explicit justification)
```

Enforcement is **documented now, mechanically enforced later** (E21-S5: an ESLint
`no-restricted-imports` config and/or a small boundary test). Do not block the
pilot on enforcement tooling.

## Architecture Rules For New And Migrated Work (21, adapted)

1. `src/app` contains primarily Next.js routing conventions and **thin** page
   entrypoints — not feature logic.
2. Larger feature client components belong in `src/features/<feature>/components`.
3. Components under `src/components` are allowed only when domain-neutral and
   reusable; feature components do not belong there.
4. `src/components/ui` holds generic primitives. **Always check existing
   primitives before creating one** — 16 already exist (Gate-1 §2).
5. API URLs and HTTP details never appear directly in page/component JSX.
6. Feature API functions belong in `src/features/<feature>/api`.
7. **Reality correction (was prompt rule 7 "reuse the existing Supplier
   service").** VOID: there is **no** supplier service/API module anywhere
   (Gate-1 §7). The Suppliers pilot **creates** the feature API from scratch on
   the chosen contract (DEC-1); this is not a "reuse existing service" case.
8. The central HTTP client stays technical infrastructure in `lib` and is not
   duplicated per feature. Feature `api/` modules **call** the standard client;
   they do not re-implement transport.
9. TanStack Query is the **single** server-state strategy. Do not introduce a
   second one. **Reality note:** it is installed and provider-mounted but used in
   **zero** files today (Gate-1 CF-2) — adoption is precedent-setting; Suppliers
   is the first adopter (see Server-State below).
10. Styling stays compatible with [`docs/13_frontend_design_standards.md`]
    (13_frontend_design_standards.md) (orange-600 primary, standard page layout,
    search on list pages, no new blue primary, no hardcoded UI strings).
11. **Reality correction (was "token migration is possible but not big-bang").**
    The semantic-token *layer did not exist* (see Theming below). It is now
    introduced once as a foundation in `globals.css`; **adoption** in feature
    pages is incremental and per-feature — there is still **no** system-wide
    colour sweep.
12. `"use client"` sits as deep as sensible. Page files are not blanket client
    components when only sub-sections are interactive.
13. Auth/role checks are centralised via guards (`useRequireAuth`), not
    duplicated inline in each page.
14. i18n keys must be preserved. New visible text goes into **all** locale files
    (`en`, `de`, `hi`) and the parity test must stay green.
15. Existing tests are not removed; they are adapted or extended when behaviour
    or architecture rules change.
16. Refactoring is incremental: one feature as the proven pattern, then repeat
    with review (the E21 pilot → E22–E31 program model).
17. `app` may import feature entrypoints and the shared component/lib layers, but
    not deep feature internals.
18. `features` may import `components/ui`, `lib`, and shared `src/types`; a
    feature imports another feature only with explicit, documented justification.
19. `components/ui` may import `lib/utils` only; it must never import from
    `features` or `app`.
20. `lib` is leaf infrastructure: it must never import from `app` or `features`.
21. Boundary rules are enforced mechanically in E21-S5 (ESLint
    `no-restricted-imports` and/or a Node/Vitest import-direction test), added
    only if false-positives stay low and migration is not blocked.

---

## Decision DEC-1 — HTTP-Client Contract (RESOLVED: option A)

Three HTTP clients coexist today (Gate-1 CF-1, verified 2026-06-07):

| Client | Shape | Throws? | Token | Base URL |
|---|---|---|---|---|
| `lib/auth.ts` → `useApiClient()` | `{ data, error, status }` | no | session via `useAuth()` | `NEXT_PUBLIC_API_URL` (**no** `/api/v1`) — caller passes full path |
| `lib/services/api.ts` (`apiGet`…) | `{ success, data, error, errorBody, status }` | no | dynamic `getSession()` | `NEXT_PUBLIC_API_URL` **+ `/api/v1`** |
| `lib/api-client.ts` (`ApiClient`) | returns `T`, **throws** `ApiError` | yes | constructor injection | `NEXT_PUBLIC_API_URL` (no `/api/v1`) |

**Decision (A):**
- **Standard for client components** is the hook contract
  `{ data, error, status }` (`useApiClient`). It never throws; callers branch on
  `result.error`. The Suppliers page already uses it, so the pilot has zero
  contract churn.
- **Module-level standard** (for non-component modules under `lib/api/*` and
  feature `api/` files that run outside React) stays `lib/services/api.ts`
  `{ success, data, error, errorBody, status }`.
- **Token strategy:** client components read the access token from the session
  via `useAuth()`/`useApiClient`; module-level code uses `getSession()`. No token
  is passed through constructors.
- **Base-URL handling:** the **target** is that the client owns the `/api/v1`
  prefix and callers pass only the resource path (`/suppliers`), matching
  `lib/services/api.ts`. Until `useApiClient` is updated, feature `api/` modules
  keep passing the full `/api/v1/...` path (as the Suppliers page does today) so
  behaviour is preserved.
- **Migration direction & shims:** converge both surviving shapes onto one
  documented result type over time; **retire the throwing `ApiClient` class**,
  keeping it only as a compatibility shim until its last caller is migrated, then
  delete it. Convergence is per-feature, never a big-bang.

## Server-State Strategy (TanStack Query)

`QueryClientProvider` is mounted in
[`app/providers.tsx`](../frontend/src/app/providers.tsx) (staleTime 60s, retry 1)
but consumed in **zero** files (Gate-1 CF-2). It is the **official and only**
server-state strategy. **Suppliers (E21-S3) is the first adopter.**

Conventions:
- **Query keys** are arrays, feature-namespaced, with serialisable params:
  `["suppliers", "list", { status }]` for the list,
  `["suppliers", "detail", id]` for a single supplier. Client-side search is **not**
  part of the key (it filters already-fetched data — preserve the Suppliers
  server-status-filter / client-search split exactly).
- **Mutations invalidate** the affected list/detail keys via
  `queryClient.invalidateQueries({ queryKey: ["suppliers"] })` (e.g. after delete),
  replacing the manual refetch. The pilot must add a test for "list refreshes
  after delete".
- Hooks live in `features/<feature>/hooks` (`use-suppliers.ts`,
  `use-delete-supplier.ts`) and call the feature `api/` module.

## Theming Rule + Status-Colour Home (DEC-2: RESOLVED option A)

**Reality correction (corrects AC-3/AC-4 premise and Gate-1 §2/§6).** The claim
"semantic tokens already exist in `globals.css` `@theme`" was **false**. Verified
2026-06-07: `globals.css` had only `@import "tailwindcss"` + the typography
plugin; there was **no** `tailwind.config.*` and **no** `:root`/`@theme` token
definitions. The shadcn primitives (`button`, `badge`, `checkbox`, `dialog`,
`select`, `alert`, `card`, …) reference `bg-primary`, `bg-background`,
`text-muted-foreground`, `ring-ring`, etc., but Tailwind v4 emitted **no colour**
for them (the compiled CSS contained zero `--primary`/`--ring`/… tokens). Feature
pages "work" only because they bypass tokens with hard-coded `bg-orange-600`.

**Decision (A) — introduce the token layer as a foundation, then adopt it
per-feature:**
- The missing shadcn semantic-token layer is defined **once** in
  [`globals.css`](../frontend/src/app/globals.css): a `:root` block of HSL token
  values + a Tailwind v4 `@theme inline` mapping to `--color-*`. `--primary` and
  `--ring` are mapped to the brand orange (orange-600) per design standards.
  Radius/spacing tokens are intentionally **not** overridden, so existing
  `rounded-*` usages are unchanged. Light theme only (no dark toggle exists).
- **Theming rule:** adopt tokens / Badge variants **in feature pages as they are
  migrated** — there is still **no** system-wide colour sweep. Do not introduce
  new hard-coded brand colours in feature components.
- **Supplier status-colour home (DEC-2 = A):** the four statuses
  (Prospect / Active / Paused / Ended) get a `supplier-status-badge` built on the
  existing [`Badge`](../frontend/src/components/ui/badge.tsx) primitive, mapped to
  semantic variants/tokens — **no raw Tailwind colour classes** in the feature
  (replacing the inline `bg-blue-100`/`green`/`yellow`/`gray` map in
  `suppliers/page.tsx:64-76`). Because `Badge` only ships
  `default/secondary/destructive/outline`, the pilot either adds status variants
  to `Badge` or maps the four statuses onto existing variants — decided in E21-S3.

## Auth Model — Security Boundary vs UX Guard

- **Security boundary (authoritative):** the backend. Every protected operation
  is enforced server-side (policies + `RequireModule`, returning 403). Frontend
  checks are **never** the security control.
- **UX guard (cosmetic):** [`middleware.ts`](../frontend/src/middleware.ts) does
  **module-gating only** (Edge rewrite for disabled modules — explicitly
  documented there as UX, not security); page/layout redirects and navigation
  hiding handle login/role UX.
- **Canonical guard:** [`useRequireAuth`](../frontend/src/lib/auth.ts) is the one
  UX guard for login/role gating. Feature pages should move their inline
  `useEffect` redirect logic (e.g. `suppliers/page.tsx:27-30`) onto
  `useRequireAuth` — UX-only, behaviour-preserving. Role helpers
  (`isAdmin`, `hasAnyRole`, `canWriteFinance`, …) stay on `useAuth`.

## Route-Group Recommendation (recommendation only — no moves here or in the pilot)

Today only `events` sits under an `app/(dashboard)` route group; `admin`,
`finance`, `members`, `suppliers`, `sponsors`, `communication`, `documents` are
top-level. This is historically grown, not a deliberate boundary.

**Recommendation:** a single shared **protected** route group (e.g.
`app/(protected)/…`) for all authenticated areas would let one group layout own
the `MainLayout` shell + a shared `useRequireAuth` gate, removing per-page guard
duplication. **However:**
- Route-group folders do **not** change URLs, but moving folders **does** change
  import paths and can ripple through tests and relative imports — medium risk.
- This must be a **dedicated, isolated change**, never bundled into a feature
  migration, and is **out of scope for E21** (pilot and foundation).

Decision: **document the recommendation; do not move route groups** in E21. Revisit
as its own story after the pilot proves the feature-slice pattern.

---

## Pilot Result Note — Suppliers (E21-S3)

Added: 2026-06-07. The Suppliers list page is the first migrated feature slice and
the reference template for E22–E31.

**Structure introduced** (`src/features/suppliers/`):
`types/supplier.types.ts` (Supplier-specific types; shared `ContractLink*` stay
in `src/types/sponsors.ts`) · `api/suppliers-api.ts` (encapsulated URLs +
`suppliersKeys`) · `hooks/use-suppliers.ts` (first TanStack `useQuery` adopter)
+ `hooks/use-delete-supplier.ts` (`useMutation` + list invalidation) ·
`components/` (`suppliers-page-content` = the only `"use client"`,
`suppliers-filter-bar`, `suppliers-table`, `supplier-status-badge`,
`delete-supplier-dialog`). The route `app/suppliers/page.tsx` is a thin server
entry.

**What stays unchanged:** the `ui/*` primitives, `useAuth`, `middleware.ts`,
the `QueryClientProvider` config, the public/auth layout split, the existing
`suppliers.*` i18n keys, and all sibling suppliers routes' behaviour (only their
type-import path moved).

**Rules confirmed for new work:** no raw `/api/v1/...` in components (URLs in
`api/`); server state via TanStack hooks keyed per E21-S1; status colours via
Badge variants (DEC-2), not raw colour classes; compose `ui/alert-dialog` rather
than hand-rolling overlays; only the composition root is `"use client"`.

**Recipe for the next page (e.g. Sponsors):** (1) write characterization tests
first (E21-S2 pattern: stable `useApiClient`/`useRouter` mocks +
`QueryClientProvider` wrapper); (2) create `features/<f>/{types,api,hooks,
components}`; (3) move feature-specific types, leave shared types in `src/types`;
(4) thin the route file; (5) keep the characterization suite green throughout.

**Open tech debt (deferred, not pilot scope):** inline admin redirect not yet on
`useRequireAuth` (Gate-1 Q8 — different redirect targets need their own check);
~~full relocation of the remaining Supplier types waits until the detail/new/edit
pages migrate~~ — **DONE in E22-S4**: the Suppliers detail/new/edit pages were
migrated into the slice (the first real consumer of the E22-S3 form sub-recipe),
so the Suppliers feature is now fully migrated; richer semantic status tokens
(success/warning/info) for the Badge are a future theming add-on; boundary
enforcement is E21-S5.

**Tests:** `tsc` clean; `eslint` clean on changed files; full Vitest 246/246
(10 characterization + 5 status-badge new), i18n parity green; `next build`
succeeds. Not run: Playwright E2E (needs live services).

---

## Form Sub-Recipe (E22-S3)

Added: 2026-06-07. The Sponsors new/edit pages are the first migrated **form**
pages and define the form mechanism every later domain epic (E23+) inherits.
Written once here; later epics point back rather than restate (A38).

**Mechanism (DEC-1 = React Hook Form + Zod):**

- A feature-local Zod schema (`features/<f>/schemas/<f>.schema.ts`) is the single
  source of field shape + validation. Required fields mirror the page's prior
  HTML5 `required`; optional fields stay plain strings unless a real format rule
  is intended (don't silently add `.email()`/`.url()` — that changes behaviour,
  A79). The required message is a next-intl key, rendered via
  `t(errors.<field>.message)`.
- One shared `<FeatureForm>` component (`"use client"`) wired with
  `useForm({ resolver: zodResolver(schema), defaultValues })` + `{...register}`,
  rendered as `<form noValidate onSubmit={handleSubmit(onSubmit)}>`. It is reused
  by BOTH the new and the edit composition roots — props: `defaultValues`,
  `onSubmit`, `submitLabel` (i18n key), `pending`, `errorMessage`.
- **New vs Edit prefill:** the new root passes empty defaults; the edit root
  loads via the get-by-id query (`use-<f>`) and renders the form ONLY after the
  data settles, so the loaded values become the form `defaultValues` (the old
  GET→setFormData prefill, with no `reset()` plumbing).

**Mutations + cache (DEC-2 = full TanStack on detail):**

- create/update are `useMutation`s that throw on API error (so the shared form's
  `errorMessage` banner shows `mutation.error.message`) and invalidate the list
  (and detail, for update) on success; the redirect to the list stays in the
  composition root's `onSuccess`.
- The detail page's status change + inline package/link CRUD are `useMutation`s
  that write the endpoint's returned DTO straight into the detail query cache via
  `setQueryData(<f>Keys.detail(id), data)` — preserving the god-page's "the
  mutation response updates the view, no extra GET" semantics (A79). A 404 on the
  detail query throws a typed sentinel so the dedicated not-found message renders.

**Behaviour-preservation contract:** the only deliberate change is HTML5
`required` → Zod `required`; same fields, same redirect, same API-error banner.
The pre-refactor characterization suite (the E22-S1 net for Sponsors) stays green
throughout — the only test-harness change permitted is wrapping renders in a
`QueryClientProvider` (retry:false) once a page becomes a TanStack consumer.

**Tests:** `tsc`/`eslint`(changed)/`prettier --check`(new)/full Vitest/i18n
parity green; `next build` succeeds. A focused `<FeatureForm>` test pins the new
Zod required-validation (blocks submit) the manual form did not enforce.

---

## Architecture Enforcement (E21-S5)

Added: 2026-06-07. The import-direction boundaries above are enforced statically
in [`frontend/eslint.config.mjs`](../frontend/eslint.config.mjs) via ESLint core
`no-restricted-imports`, scoped per zone with flat-config `files` blocks:

- `src/components/ui/**` must not import from `@/features` or `@/app` (leaf
  primitive layer).
- `src/lib/**` must not import from `@/app` or `@/features` (leaf infrastructure).
- `src/features/**` must not import another feature via the `@/features` alias
  (use relative imports within a feature; cross-feature coupling needs an explicit
  `// eslint-disable-next-line no-restricted-imports` with a reason).

Scope (per the E21-S5 guardrail "highest-value, lowest-false-positive subset"):
the rules cover the three highest-risk directions and match the `@/`-alias
convention; relative cross-zone imports are not the convention here and are not
covered. The wider direction set in "Target Import Direction" can be tightened
later if drift appears. `src/` is clean against these rules today (the only
standing `npm run lint` errors are pre-existing and unrelated, in
`src/app/members/segments/page.tsx`).

**Static boundary vs runtime behaviour test.** These ESLint rules are *static
architecture boundaries* (which module may import which). They are deliberately
distinct from [`frontend/e2e/module-enforcement.spec.ts`](../frontend/e2e/module-enforcement.spec.ts),
which is a *runtime Playwright behaviour test* asserting module-enablement
gating (UX rewrite + backend 403). Do not conflate the two: the E2E test is not
an import-boundary check, and the ESLint rules are not a behaviour check.

---

## Finance feature slice — one shared foundation (E26)

Added: 2026-06-12. The entire `app/finance/**` tree is now **thin server-entry
shells** over a single shared feature slice at `src/features/finance/` (the
"one-slice-shared-foundation" pattern, A101 — NOT one dir per page). E26-S2 owns
the foundation (`api/finance-api.ts` = `FINANCE_BASE` + the `financeKeys` root +
the ledger/accounting/profile/activity-areas URL builders; `types/finance.types.ts`
= the re-exported `@/types/finance` DTOs + the shared `ActivityArea`/`TaxCode`
lookups). The four sub-slices add their OWN `<sub>-api.ts`/`<sub>.types.ts`
importing that root and NEVER edit it (parallel-safe, A91): S3 receivables
(invoices), S4 budgeting (budgets/budget-vs-actual/categories + the
activity-areas `/report` builder), S5 payments/expense-claims/bank-import, and
**S6 settings** (the FINAL slice — `api/settings-api.ts` + `types/settings.types.ts`
+ `schemas/{finance-profile,invoice-template,tax-code,settings-activity-area}.schema.ts`
+ the `components/settings/*` content roots for the hub, profile form,
invoice-templates, settings/activity-areas, and tax-codes). Each content root is
the only `"use client"` boundary and self-embeds its own
`QueryClient({ retry:false })` `QueryClientProvider`; the route files are server
entries (`export default () => <XContent/>`).

The settings forms use the E22 RHF+Zod sub-recipe with the program's load-bearing
traps preserved verbatim (A56): the profile `countryCode`/`currency`/`jurisdiction`
+ invoice-template `language`/`jurisdiction` are FULL `z.string()` unions with the
raw stored value in `defaultValues` and an extra `<option>` for an out-of-set
value (A95 — never `z.enum(renderedSubset)`); no submitted byte is `.trim()`ed and
optionals map `"" → null` at the wire boundary (A96); the profile 404→POST vs
PUT `/profile/{id}` branch, the `finance-profile-changed` CustomEvent, the
read-only render (every field `disabled` + hidden footer), the tax-code rate
×100/÷100 round-trip, and the invoice-template create-only-jurisdiction /
edit-locked-countryCode immutability (A98) are all pinned by the E26-S1
characterization net and survive the migration with ZERO transport-mock edits
(A94 BUILD). `settings/activity-areas` REUSES the foundation's `ActivityArea`
type + the activity-areas CRUD builders (DEC-3 — single owner; its form omits
`isActive`, edit hard-codes `isActive:true`). The Finance domain is now fully
migrated.

---

Generated using BMAD Method `document-project` workflow.

