# Story E21.S3: Suppliers List Page — Feature-Slice Pilot Refactor (Gate 3)

Status: done

Depends on: E21-S1 (architecture decisions DEC-1/DEC-2), E21-S2 (characterization tests green).

## Story

As a maintainer,
I want the Suppliers list page refactored into the feature-slice pattern,
so that it becomes the proven reference template for migrating every other feature.

## Acceptance Criteria

**Behaviour preserved (all E21-S2 characterization tests stay green):**

1. Route `/suppliers`, admin/auth access, supplier load, status filter, search, loading/error/empty states, table, detail link, edit link, delete dialog, delete action, list-refresh-after-delete, and i18n texts all behave exactly as before.

**Improvements:**

2. `src/app/suppliers/page.tsx` is a thin entry — NOT `"use client"` — rendering a `features/suppliers` content component (per the source prompt's route-file example).
3. A `features/suppliers/` slice exists with separated responsibilities:
   - `api/` — encapsulated endpoint URLs using the E21-S1 client contract (no raw `/api/v1/...` strings in components).
   - `components/` — page-content, filter-bar, table, status-badge, and a delete-dialog that COMPOSES the existing `components/ui/alert-dialog.tsx` (no hand-rolled overlay).
   - `hooks/` — `use-suppliers` (TanStack `useQuery`), `use-delete-supplier` (`useMutation` + list invalidation).
   - `types/` — Supplier-specific types; shared `ContractLink*` and Sponsor types stay in `types/`.
4. Delete has a pending/disabled state; the inaccessible `fixed inset-0` dialog is replaced by the accessible Radix primitive.
5. The status badge is extracted (per DEC-2); no new hard-coded brand colours in feature components; `startTransition` around fetching is removed.
6. Quality: no new `any`; no new hard-coded user-facing strings; no new direct API URL in `page.tsx`; no duplicate UI primitive created; `page.tsx` is not a full client page when only sub-sections are interactive.

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites (AC: all)
  - [x] E21-S1 decisions recorded (DEC-1 client contract, DEC-2 status colours); E21-S2 tests green on HEAD (verified 10/10 before refactor).
  - [x] `git status --short` clean for the suppliers area; on feature branch `refactor/frontend-feature-slice` (the active refactor branch; not `beta` — adapted to the repo's branch reality).
- [x] Task 1: Create `features/suppliers/api` (AC: 3)
  - [x] Endpoint URLs moved out of the page into `api/suppliers-api.ts` (uses the DEC-1 `useApiClient` contract via `ReturnType<typeof useApiClient>`); Supplier-specific types moved to `features/suppliers/types/supplier.types.ts` (shared `ContractLink*` kept in `types/sponsors.ts`); 3 sibling suppliers pages' type-import lines updated.
- [x] Task 2: Create TanStack hooks (AC: 3, first adopter)
  - [x] `use-suppliers` (`useQuery`, key `["suppliers","list",{status}]`, server-side `status`, `enabled` mirrors the admin gate); `use-delete-supplier` (`useMutation` + `invalidateQueries(["suppliers"])`). Client-side search preserved in the component.
- [x] Task 3: Extract components (AC: 3, 4, 5)
  - [x] `suppliers-page-content` (the only `"use client"`), `suppliers-filter-bar`, `suppliers-table`, `supplier-status-badge` (DEC-2 Badge variants), `delete-supplier-dialog` (composes `ui/alert-dialog` + pending/disabled state). `startTransition` removed.
- [x] Task 4: Slim the route file (AC: 2)
  - [x] `app/suppliers/page.tsx` → thin server entry rendering `<SuppliersPageContent />`; no longer `"use client"` (−243 lines).
- [x] Task 5: Keep behaviour green (AC: 1)
  - [x] E21-S2 suite stays 10/10 against the refactored page. Only legitimate test seam adjusted: renders wrapped in a `QueryClientProvider` (retry off) — the page is now a TanStack consumer; no behaviour assertion changed.
- [x] Task 6: Architecture note + quality gate (AC: 6)
  - [x] Pilot Result Note added to `docs/architecture-frontend.md` (structure, what stays, rules, recipe for next page, tech debt, tests). `tsc` clean; `eslint` clean on changed files; full `vitest run` 246/246; i18n parity green; `next build` succeeds.

## Dev Notes

This is the "Pilot: Suppliers List Page" of the source prompt and the first `src/features/` slice + first TanStack adopter in the codebase.

### Scope Boundaries

In scope: `app/suppliers/page.tsx` (list only), the new `features/suppliers/*`, and read-only reuse of shared infra as the contract requires.
Out of scope: suppliers detail/new/edit pages (unless a trivial shared type import must follow); ALL other features; route-group moves; navigation; global token sweep; auth-architecture replacement; backend.

### Architecture Guardrails

- Behaviour-preserving refactor — the E21-S2 suite is the contract. Preserve the server-side status filter + client-side search split exactly.
- Reuse `components/ui/alert-dialog.tsx` — do NOT create a new dialog; a thin `ConfirmDialog` convenience wrapper is allowed (not a duplicate primitive) but optional.
- Type relocation: keep `ContractLinkType`/`ContractLinkDto` and Sponsor types in `types/sponsors.ts` (or a renamed neutral shared module) to avoid a Sponsors ripple — only Supplier-specific types move.
- i18n: keep all existing `suppliers.*` keys; any new visible text goes into `de.json` + `en.json` (and `hi.json` per E21-S4); never hardcode.
- DoD scripts: `npm run typecheck` + `npm run lint` + `npm test -- --run` only. Do NOT run `npm run format` (prettier-tailwind re-sorts classes repo-wide).

### Testing Requirements

- All E21-S2 characterization tests green post-refactor. Add focused tests for new units where cheap (status badge mapping, delete pending state).

### Decision-Needed

- Inherits DEC-1 (client contract) and DEC-2 (status-colour home) from E21-S1 — do not re-decide; if E21-S1 is incomplete, stop and finish it first.

### Project Structure Notes

- Target tree (names adaptable): `features/suppliers/{api/suppliers-api.ts, components/*, hooks/use-suppliers.ts, hooks/use-delete-supplier.ts, types/supplier.types.ts}`; `app/suppliers/page.tsx` thin entry.

### References

- `frontend/src/app/suppliers/page.tsx:1-241` (current god-page; every hotspot)
- `frontend/src/types/sponsors.ts:95-153` (Supplier types to relocate; shared ContractLink* to keep)
- `frontend/src/components/ui/alert-dialog.tsx` (the primitive to compose), `frontend/src/components/ui/badge.tsx` (variant base for DEC-2)
- `frontend/src/app/providers.tsx:10-20` (QueryClient available)
- `docs/frontend-refactoring-gate1-analysis.md` (§11 Recommended Pilot Scope)
- Source prompt: "Pilot: Suppliers List Page", "Akzeptanzkriterien", "Definition of Done"

## Validation Notes

- Created 2026-06-07. Status `drafted` until E21-S1 + E21-S2 close. Largest story of the epic — multi-commit; budget accordingly.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via bmad-dev-story.

### Debug Log References

**Inherited DEC-1/DEC-2 (no re-decision).** DEC-1 = `useApiClient` hook contract `{data,error,status}`; the feature `api/` types its client param as `ReturnType<typeof useApiClient>` so no contract drift. DEC-2 = status colours via Badge variants.

**Behaviour-preservation decisions (kept the E21-S2 suite green):**
- Inline admin redirect kept verbatim (`/login` for unauth, `/` for non-admin) — NOT moved to `useRequireAuth`, whose redirect targets differ (Gate-1 Q8); deferred follow-up.
- `useQuery({ enabled: isAuthenticated && isAdmin })` reproduces the original "only fetch for admins" gate, so no GET fires for unauth/non-admin (S2 asserts this).
- TanStack adoption changes the implementation of refresh-after-delete (now `invalidateQueries`) but not the observable contract (a new GET still fires).
- Test seam: the S2 suite now wraps renders in a `QueryClientProvider` (retry off) because the page is a TanStack consumer — a harness change, not a behaviour-assertion change (Task 5).

**Type relocation (A65/scope).** Only Supplier-specific types moved to `features/suppliers/types`; shared `ContractLink*`/Sponsor types stayed in `types/sponsors.ts` (Gate-1 §7 ripple warning). The 3 sibling suppliers pages (detail/new/edit) had only their type-import line repointed (the "trivial shared type import" the story permits) — no behavioural edit. Import direction stays legal: `app → features`, `features → types`.

**Status-variant mapping (DEC-2).** Active→default, Prospect→secondary, Paused→outline, Ended→destructive — onto the four existing Badge variants (no domain coupling added to the `ui` primitive, no raw colour classes). Original distinct colours (blue/green/yellow/gray) are not reproduced 1:1; the translated label carries meaning (a11y). Richer status tokens deferred.

### Completion Notes List

Largest story of the epic — first `src/features/` slice + first TanStack Query adopter. Behaviour-preserving structural refactor.

- ✅ AC-1: all 10 E21-S2 characterization tests pass against the refactored page — route, admin/auth redirects, load, server status filter, client search, loading/error/empty, table, detail/edit links, delete dialog, delete, list-refresh-after-delete, i18n all unchanged.
- ✅ AC-2: `app/suppliers/page.tsx` is a thin entry (not `"use client"`) rendering `<SuppliersPageContent />`.
- ✅ AC-3: `features/suppliers/{api,components,hooks,types}` slice with separated responsibilities; URLs encapsulated in `api/`; shared types kept in `types/`.
- ✅ AC-4: delete has a pending/disabled state; the inaccessible `fixed inset-0` overlay is replaced by the Radix `ui/alert-dialog` composition.
- ✅ AC-5: status badge extracted (Badge variants per DEC-2); no new hard-coded brand colours in feature components (existing classes moved, not added); `startTransition` removed.
- ✅ AC-6: no new `any`; no new hard-coded user-facing strings (all via next-intl); no direct API URL in `page.tsx`; no duplicate UI primitive created (composed existing `alert-dialog`/`badge`); `page.tsx` is not a client page.

Quality gate: `tsc --noEmit` clean; `eslint` clean on all changed files; `prettier --write` on new feature files (A72); full `vitest run` 246/246 (47 files; +5 status-badge unit tests); i18n parity green; `next build` succeeds; diff is LF-clean (no CRLF churn, A73). Playwright E2E not run (needs live services). Pre-existing repo lint errors (`members/segments/page.tsx`, A58) untouched.

### File List

New (feature slice):
- `frontend/src/features/suppliers/types/supplier.types.ts`
- `frontend/src/features/suppliers/api/suppliers-api.ts`
- `frontend/src/features/suppliers/hooks/use-suppliers.ts`
- `frontend/src/features/suppliers/hooks/use-delete-supplier.ts`
- `frontend/src/features/suppliers/components/suppliers-page-content.tsx`
- `frontend/src/features/suppliers/components/suppliers-filter-bar.tsx`
- `frontend/src/features/suppliers/components/suppliers-table.tsx`
- `frontend/src/features/suppliers/components/supplier-status-badge.tsx`
- `frontend/src/features/suppliers/components/delete-supplier-dialog.tsx`
- `frontend/src/features/suppliers/components/supplier-status-badge.test.tsx` (focused unit test)

Modified:
- `frontend/src/app/suppliers/page.tsx` (god-page → thin server entry)
- `frontend/src/types/sponsors.ts` (Supplier-specific types removed → feature slice; shared types kept)
- `frontend/src/app/suppliers/[id]/page.tsx`, `frontend/src/app/suppliers/new/page.tsx`, `frontend/src/app/suppliers/[id]/edit/page.tsx` (type-import path only)
- `frontend/src/app/suppliers/page.test.tsx` (E21-S2 suite: `QueryClientProvider` render seam)
- `docs/architecture-frontend.md` (Pilot Result Note)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (e21-s3 backlog → in-progress → review)
- `_bmad-output/implementation-artifacts/e21-s3-suppliers-list-feature-slice-pilot-refactor.md` (this story file)

## Change Log

- 2026-06-07: Story created (Suppliers feature-slice pilot, Gate 3); status drafted pending S1/S2.
- 2026-06-07: Implemented the pilot. Extracted the Suppliers list god-page into `features/suppliers/{types,api,hooks,components}` (first feature slice + first TanStack Query adopter), thinned the route to a server entry, replaced the hand-rolled delete overlay with the Radix `alert-dialog`, extracted a Badge-variant status badge (DEC-2), removed `startTransition`. Behaviour preserved — E21-S2 suite 10/10 (wrapped in `QueryClientProvider`). Full suite 246/246, tsc/eslint/prettier clean, `next build` green. Added the Pilot Result Note to `docs/architecture-frontend.md`. Status → review.

## Senior Developer Review (AI) — Epic E21 Boundary (2026-06-07)

3-layer adversarial review over the full E21 diff. Outcome: **Changes Requested** — 2 patches + 3 defers owned here. No High-severity acceptance violations; no fabricated completion.

### Review Follow-ups (AI)

- [x] [Review][Patch][Med] P2 — RESOLVED 2026-06-07: `AlertDialogAction` now passes `buttonVariants({ variant: "destructive" })` (cn/twMerge → red restored). Delete-confirm button had regressed from destructive (red) to primary (orange). `delete-supplier-dialog.tsx` `AlertDialogAction` uses the default `buttonVariants()` (`bg-primary`); the original confirm was `bg-red-600`. A destructive action lost its red. Fix: pass `buttonVariants({ variant: "destructive" })` (via `className`) to the action. Invisible to the green S2 suite (asserts text+click+fetch only). [frontend/src/features/suppliers/components/delete-supplier-dialog.tsx]
- [x] [Review][Patch][Med] P3 — RESOLVED 2026-06-07: delete error now takes precedence (`deleteMutation.error?.message ?? error?.message`) and is cleared via `deleteMutation.reset()` on status/search change; added a delete-fail regression test to `page.test.tsx` (now 11 cases). Delete-error display regression. `suppliers-page-content.tsx` `errorMessage = error?.message ?? deleteMutation.error?.message` (a) hides a delete error behind a stale query error and (b) never clears on filter/search — the old god-page cleared `error` at the start of every fetch and a delete failure overwrote it. Fix: give the delete error precedence and `deleteMutation.reset()` on status/search change; add a delete-fails characterization test to `page.test.tsx`. [frontend/src/features/suppliers/components/suppliers-page-content.tsx]
- [x] [Review][Defer] D1 — Out-of-union supplier status renders Badge `default` + the raw i18n key (pre-existing gap, also in the old `getStatusBadge`); add a status fallback later. [frontend/src/features/suppliers/components/supplier-status-badge.tsx]
- [x] [Review][Defer] D3 — Page-chrome brand colours (CTA / links / focus rings / spinner) still ship raw `orange-*` in the feature components; incremental token adoption deferred per DEC-2 (the status badge is already tokenised). [suppliers-page-content.tsx, suppliers-filter-bar.tsx, suppliers-table.tsx]
- [x] [Review][Defer] D4 — Broaden the S1 `[!]` Q1 visual-smoke scope to `<body bg-background>` + every shadcn token consumer (the token layer now resolves app-wide), not just the 3 dialogs. [frontend/src/app/globals.css]
