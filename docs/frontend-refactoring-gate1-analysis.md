# Frontend Refactoring — Gate 1: As-Is Analysis

Generated: 2026-06-07
Scope: `frontend/` (Next.js App Router). Deep on `suppliers` + shared infrastructure (api-client, auth, services/api, providers, middleware, components/ui, messages, types). Other features (sponsors, members, events, finance, communication, documents, admin, board) covered at overview level only.
Purpose: Durable input for Gate 2 (frontend target-state architecture via `bmad-create-architecture`) and the Suppliers refactoring pilot.
Mode: Analysis only — no code was changed.

---

## 1. Executive Summary

The frontend is a healthy, modern Next.js 16 / React 19 / TypeScript / Tailwind v4 codebase with a **real, shadcn-style design system already in place** (16 UI primitives using semantic tokens) and a working test setup (Vitest + Testing Library + Playwright). The bones are good.

The dominant problem is **inconsistency, not absence**. Good infrastructure exists but is applied unevenly:

- **Three competing HTTP-client patterns** coexist (`ApiClient` class, `useApiClient` hook, `lib/services/api.ts` functions) with three different error/return shapes and three token strategies.
- **TanStack Query is installed AND provided but used in zero files** — every page does manual `useState`/`useEffect`/`fetch`.
- **Semantic design tokens exist at the primitive layer but feature pages bypass them** with hard-coded brand colours (`bg-orange-600`, `bg-blue-100`, …).
- **Feature logic lives directly in route files** (`src/app/**/page.tsx`) rather than in a feature layer; there is no `src/features/` directory at all.

The Suppliers List Page is a textbook example of every one of these issues and is an **excellent, realistic first pilot**. Caveat on sizing: it is not a pure file-move. A correct pilot also (a) introduces the first TanStack Query usage in the codebase, (b) replaces a hand-rolled dialog with the existing Radix `AlertDialog`, and (c) needs a characterization test written first because **no Suppliers test currently exists**. Budget it as a multi-hour, multi-commit story, not a one-hour refactor.

---

## 2. Existing Good Patterns (keep and propagate)

- **shadcn-style UI primitives with semantic tokens** — `components/ui/` (16 primitives). `badge.tsx`, `alert-dialog.tsx`, `button.tsx` use `class-variance-authority` + `cn()` and semantic Tailwind classes (`bg-primary`, `bg-destructive`, `text-muted-foreground`, `bg-background`). This is the theming foundation; it is already correct.
- **Radix-backed accessible primitives already present**: `alert-dialog.tsx` (full Root/Trigger/Content/Header/Footer/Title/Description/Action/Cancel), `dialog.tsx`, `select.tsx`, `checkbox.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `label.tsx`.
- **Centralized, role-aware auth hook** — `lib/auth.ts` exposes `useAuth()` with typed role checks (`isAdmin`, `hasAnyRole`, `canWriteFinance`, …) and a `useRequireAuth()` guard hook. Reusable; under-used by pages.
- **Co-located feature API modules with typed DTOs** — `lib/api/members.ts`, `lib/api/users.ts`, etc. — typed DTOs + enums + helpers. This is the closest thing to a feature-API convention and is the right direction (with caveats — see §4).
- **TanStack Query correctly configured** — `app/providers.tsx` mounts `QueryClientProvider` with sane defaults (`staleTime` 60s, `retry` 1). Ready to use.
- **Module-enablement middleware with a clear security model** — `middleware.ts` documents the boundary distinction explicitly (Edge rewrite is UX; backend 403 is the real control). Good reference for the auth section.
- **Established testing patterns** — unit tests for lib/api modules, services, middleware, and several UI primitives (`button.test`, `input.test`, `dialog.test`); i18n parity test (`messages/messages.parity.test.ts`); E2E `module-enforcement.spec.ts`.

---

## 3. Critical Findings

**CF-1 — Three competing HTTP clients (highest-impact inconsistency).**
- `lib/api-client.ts`: `ApiClient` class; **throws** `ApiError` on non-OK; base URL = `NEXT_PUBLIC_API_URL` (no `/api/v1`); token passed to constructor via `createApiClient(token)`.
- `lib/auth.ts` → `useApiClient()`: hook; returns `{ data, error, status }` (**never throws**); parses ProblemDetails `.detail`; reads token from session. **This is what the Suppliers page uses.**
- `lib/services/api.ts`: `apiGet/apiPost/...`; returns `{ success, data, error, errorBody, status }`; base includes `/api/v1`; token via dynamic `getSession()`. **This is what `lib/api/*.ts` feature modules use.**
- Net: two different success/error contracts in active use (`{data,error,status}` vs `{success,data,error,errorBody,status}`) plus a throwing class. Any feature-API extraction must consciously pick one.

**CF-2 — TanStack Query is dead infrastructure.** Provider mounted, **zero** `useQuery`/`useMutation`/`useQueryClient` usages in `src/`. All server state is hand-rolled. Adopting it in the pilot is safe (provider present) but makes Suppliers the **first** adopter — a precedent decision that belongs in Gate 2, not improvised at pilot time.

**CF-3 — Feature logic in route files; no feature layer.** `src/features/` does not exist. Large `page.tsx` files own data fetching, auth gating, filtering, dialogs, and presentation. `suppliers/page.tsx` is 241 lines doing all of it.

**CF-4 — Hard-coded colours bypass the existing token system.** Feature pages use `bg-orange-600`, `text-orange-600`, `bg-blue-100/green-100/yellow-100/gray-100`, `border-orange-500` directly, while the primitives next door already expose `bg-primary`, `bg-destructive`, etc. The same status-colour-in-TS smell exists even in the "good" `lib/api/members.ts` (`getMembershipStatusColor` returns raw Tailwind classes). So this is a **codebase-wide pattern**, not a Suppliers quirk.

**CF-5 — No regression net for Suppliers.** There is no `suppliers*.test.tsx` anywhere. A behaviour-preserving refactor without a test is the single biggest risk → characterization test must precede the refactor (ATDD).

**CF-6 — Hand-rolled, inaccessible delete dialog.** `suppliers/page.tsx` builds a `fixed inset-0` overlay div with no focus trap, no `Escape` handling, no `role="dialog"`/`aria` — while `components/ui/alert-dialog.tsx` (accessible Radix) sits unused. Real a11y defect, trivially fixable by composing the existing primitive.

---

## 4. Inconsistencies

- **Return-shape drift** between `useApiClient` (`{data,error,status}`) and `lib/services/api.ts` (`{success,...}`) — see CF-1.
- **Token acquisition drift**: constructor injection vs `useAuth()` session vs dynamic `getSession()` vs raw `fetch` with `Authorization` header (e.g. `findMemberDuplicates` in `members.ts` hand-builds `fetch`).
- **Base-URL drift**: some clients append `/api/v1`, others expect the caller to include it (Suppliers calls `/api/v1/suppliers` against the hook whose base has no `/api/v1`).
- **Filtering inconsistency within one page**: Suppliers status filter is **server-side** (`?status=`), search is **client-side** (in-memory `.filter`). Must be preserved verbatim during refactor.
- **i18n locale drift**: `suppliers.*` keys exist in `messages/en.json` and `de.json` but **not in `hi.json`** (0 occurrences). Either the parity test is lenient or this is pre-existing red. Establish baseline before touching i18n.
- **`"use client"` over-applied**: whole pages are client components even where only sub-sections are interactive.
- **`startTransition` misuse**: Suppliers wraps data fetching in `startTransition` (no concurrent-rendering benefit here).
- **Mixed casing/quote conventions** between `components/ui/` (single quotes, shadcn style) and feature pages (double quotes).

---

## 5. Hotspots With File References

| Hotspot | Location | Issue |
|---|---|---|
| God-page | `frontend/src/app/suppliers/page.tsx:1-241` | `"use client"`, auth+fetch+filter+dialog+table+badge in one file |
| Auth in page | `…/suppliers/page.tsx:27-30` | redirect logic in `useEffect` instead of a guard |
| API in page | `…/suppliers/page.tsx:36,55` | raw `api.get`/`api.delete` + hard-coded `/api/v1/...` URLs |
| `startTransition` | `…/suppliers/page.tsx:47` | wraps fetch needlessly |
| Inline status colours | `…/suppliers/page.tsx:64-76` | hard-coded `bg-blue-100`/`green`/`yellow`/`gray` |
| Delete w/o pending | `…/suppliers/page.tsx:53-62` | no in-flight/disabled state |
| Hand-rolled dialog | `…/suppliers/page.tsx:212-238` | not Radix; a11y defects |
| Foreign type import | `…/suppliers/page.tsx:12` → `frontend/src/types/sponsors.ts:95-153` | Supplier types live in `sponsors.ts` |
| Three HTTP clients | `frontend/src/lib/api-client.ts`, `frontend/src/lib/auth.ts:169-295`, `frontend/src/lib/services/api.ts` | competing contracts |
| Colours-in-TS (codebase-wide) | `frontend/src/lib/api/members.ts:165-189,413-437` | raw Tailwind class maps in API layer |
| Dead TanStack | `frontend/src/app/providers.tsx:10-20` | provider mounted, never consumed |
| i18n gap | `frontend/messages/hi.json` | no `suppliers.*` keys |

Other supplier routes share the same shape and the same foreign-type import: `suppliers/new/page.tsx`, `suppliers/[id]/page.tsx`, `suppliers/[id]/edit/page.tsx`.

---

## 6. Risk Assessment

| Area | Risk if refactored carelessly | Mitigation |
|---|---|---|
| Auth/role gating | Moving the `isAdmin` redirect could change who sees the page | It is UX-only (backend 403 is the boundary, per `middleware.ts`); preserve exact redirect behaviour; cover with test |
| API contract | Switching client/return-shape can silently swallow errors | Pick one contract in Gate 2; keep `{data,error}` semantics the page relies on |
| i18n | Renaming/removing keys breaks parity test & UI | Keep all existing keys; add new keys to **all** locales; run parity test before & after |
| TanStack adoption | First-ever use; wrong cache keys cause stale lists after delete | Define query-key + invalidation convention in Gate 2; test "list refreshes after delete" |
| Type move | `sponsors.ts` shares `ContractLink*` with Sponsors; 4 supplier pages import it | Keep shared types in place or re-export; move only Supplier-specific types |
| Tailwind v4 | Token work using v3 `tailwind.config.js` mental model will fail | v4 is CSS-first (`@theme` in `globals.css`); tokens already exist there |
| Prettier | `npm run format` re-sorts Tailwind classes repo-wide | Never run `format` on unrelated files; only `lint`/`typecheck`/`test` in DoD |

---

## 7. Assumptions That Were Wrong Or Unclear

- **WRONG: "a clean Supplier service exists"** (prompt rule 8). There is **no** supplier service/API module in `lib/services` or `lib/api`. The pilot must create the feature API from scratch (choosing a contract per CF-1) — it is not a "reuse existing service" case.
- **RESOLVED: "TanStack Query is present or will be validated"** — present **and** provider-mounted, but **never used**. Adopting it is therefore safe but precedent-setting (CF-2).
- **RESOLVED: "no central dialog primitive → may add one"** — an accessible Radix `AlertDialog` already exists (`components/ui/alert-dialog.tsx`). Compose it; a thin `ConfirmDialog` convenience wrapper is optional, not required.
- **PARTLY WRONG: "introduce semantic tokens as a separate migration"** — semantic tokens already exist and are used by the primitives. The work is **adoption in feature pages**, not introduction.
- **NUANCE: "Supplier types imported from a foreign module"** — true, but `sponsors.ts` legitimately shares `ContractLinkType`/`ContractLinkDto` across both domains; a naive move would ripple into Sponsors.

---

## 8. What Should Stay (do not "fix")

- `components/ui/` primitives and their semantic-token approach.
- `lib/auth.ts` `useAuth()` / role model / `ROLES`.
- `middleware.ts` module-gating model and its documented UX-vs-security boundary.
- TanStack `QueryClientProvider` config in `providers.tsx`.
- Existing tests, the i18n parity test, and `e2e/module-enforcement.spec.ts`.
- The `lib/api/<feature>.ts` co-location idea (refine the contract, keep the shape).

---

## 9. What Should Be Migrated Incrementally

1. Extract feature logic out of route `page.tsx` files into a new `src/features/<feature>/` layer (components/hooks/api/types), one feature at a time.
2. Converge on **one** HTTP-client contract; migrate features onto it gradually with the others kept as compatibility shims until empty.
3. Adopt TanStack Query per feature for server state (starting with Suppliers as the reference).
4. Replace hard-coded colours with semantic tokens / Badge variants per feature.
5. Move feature-specific types into their feature folder, leaving shared types (e.g. `ContractLink*`) centralized.
6. Replace hand-rolled dialogs/overlays with the existing Radix primitives.
7. Optionally add ESLint `no-restricted-imports` / a small boundary test once the `features/` direction is proven (Gate 2 recommendation, not pilot).

---

## 10. What Must Not Be Changed In A Big Bang

- HTTP-client consolidation across all features at once (do it feature-by-feature behind shims).
- System-wide colour→token sweep.
- Route-group restructuring (e.g. moving `admin/finance/members/...` under a shared `(dashboard)` group) — **analyze and recommend only**, do not move in the pilot.
- Auth architecture replacement.
- Backend endpoints / API contracts / public routes.
- Mass file moves, repo-wide reformat, or import re-sorting.

---

## 11. Recommended Pilot Scope

**Suppliers List Page** — confirmed ideal. Target structure (names adaptable to project convention):

```
src/app/suppliers/page.tsx                 # thin entry → renders feature component
src/features/suppliers/
  api/suppliers-api.ts                      # typed client (chosen contract), encapsulated URLs
  components/
    suppliers-page-content.tsx              # "use client" composition root
    suppliers-filter-bar.tsx
    suppliers-table.tsx
    supplier-status-badge.tsx               # Badge-based, token/variant driven
    delete-supplier-dialog.tsx              # composes ui/alert-dialog
  hooks/
    use-suppliers.ts                        # TanStack useQuery (first adopter)
    use-delete-supplier.ts                  # TanStack useMutation + list invalidation
  types/supplier.types.ts                   # Supplier-specific types (shared ContractLink* stay in types/)
```

Mandatory ordering inside the pilot:
1. Write a characterization test for current `/suppliers` behaviour (CF-5) **before** any refactor.
2. Establish i18n baseline (run parity test; note the `hi.json` gap as pre-existing).
3. Refactor within scope; preserve server-side status filter + client-side search exactly.

In scope to change: the 4 files of the suppliers route only where needed for the list page, the new `features/suppliers/*`, and (if a contract decision requires it) read-only reuse of an existing client. Out of scope: every other feature, route groups, navigation, global token sweep, auth architecture, backend.

Definition-of-Done guardrails (correcting the original): use `npm run typecheck`, `npm run lint`, `npm test -- --run` only — **not** `npm run format` (Prettier Tailwind plugin reorders classes repo-wide). `page.tsx` itself must no longer be `"use client"`; the interactive content may remain a client component.

---

## 12. Open Questions (carry into Gate 2 / `bmad-create-architecture`)

1. **HTTP-client convergence target (CF-1):** which of the three becomes the standard? Recommendation to decide in Gate 2: standardize on a single typed result shape and one token strategy; treat `useApiClient` and `lib/services/api.ts` as migration sources.
2. **TanStack Query as the official server-state strategy (CF-2):** confirm Suppliers becomes the reference adopter and define the query-key + invalidation convention before coding.
3. **Tailwind v4 token strategy:** tokens already live in `globals.css` `@theme`. Confirm status colours (Prospect/Active/Paused/Ended) map to Badge variants vs. bespoke tokens.
4. **i18n parity baseline:** verify whether `messages.parity.test.ts` currently passes given `hi.json` lacks `suppliers.*`. If red, fixing it is pre-existing debt, tracked separately from the pilot; if green, understand why and keep it green.
5. **ConfirmDialog wrapper:** compose `ui/alert-dialog` directly, or add a thin generic `ConfirmDialog`? (Adding one is allowed — it is not a duplicate primitive.)
6. **Type relocation ripple:** confirm acceptable to move Supplier-specific types while leaving `ContractLink*`/Sponsor types in `types/sponsors.ts` (or rename that file to a neutral shared module).
7. **Branch & commit policy:** feature branch off `beta`; small reviewable commits; where the per-pilot architecture note is filed.
8. **`useRequireAuth` adoption:** should the page's inline admin redirect move to the shared `useRequireAuth` guard (UX-only, safe), or stay inline for the pilot?

---

*Next BMad step: `bmad-create-architecture` (Gate 2 target-state) consuming this analysis, then `bmad-create-epics-and-stories` to turn the migration roadmap into an epic with Suppliers as Story 1.*
