# Story E21.S3: Suppliers List Page — Feature-Slice Pilot Refactor (Gate 3)

Status: drafted

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

- [ ] Task 0: Confirm prerequisites (AC: all)
  - [ ] E21-S1 decisions recorded (DEC-1 client contract, DEC-2 status colours); E21-S2 tests green on HEAD.
  - [ ] `git status --short` clean for the suppliers area; branch off `beta`.
- [ ] Task 1: Create `features/suppliers/api` (AC: 3)
  - [ ] Move the supplier endpoint URLs out of the page into the chosen-contract client; types from `types/sponsors.ts` → `features/suppliers/types/` (Supplier-only).
- [ ] Task 2: Create TanStack hooks (AC: 3, first adopter)
  - [ ] `use-suppliers` (query-key per E21-S1 convention; server-side `status` param); `use-delete-supplier` (mutation + invalidate the list query). Preserve client-side search.
- [ ] Task 3: Extract components (AC: 3, 4, 5)
  - [ ] page-content (the only `"use client"`), filter-bar, table, `supplier-status-badge` (DEC-2), `delete-supplier-dialog` (composes `ui/alert-dialog`, pending state).
- [ ] Task 4: Slim the route file (AC: 2)
  - [ ] `app/suppliers/page.tsx` → thin server entry rendering `<SuppliersPageContent />`.
- [ ] Task 5: Keep behaviour green (AC: 1)
  - [ ] Run E21-S2 tests continuously; adjust only test seams that legitimately moved (not assertions on behaviour).
- [ ] Task 6: Architecture note + quality gate (AC: 6)
  - [ ] Short note: what was introduced, what stays, rule for new work, recipe for the next page. `tsc`/`eslint`/`vitest run` green; i18n parity green.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-07: Story created (Suppliers feature-slice pilot, Gate 3); status drafted pending S1/S2.
