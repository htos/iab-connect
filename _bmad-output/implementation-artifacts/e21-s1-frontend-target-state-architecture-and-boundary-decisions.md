# Story E21.S1: Frontend Target-State Architecture and Boundary Decisions (Gate 2)

Status: ready

## Story

As a frontend architect,
I want a durable target-state (feature-slice) architecture with explicit boundary rules and the open decisions resolved,
so that every subsequent migration follows one agreed pattern instead of improvising per page.

## Acceptance Criteria

1. `docs/architecture-frontend.md` gains a "Target-State (Feature-Slice) Architecture" section (extended, not replaced) documenting the `src/features/<feature>/{api,components,hooks,schemas,types}` layout, the target import direction, and the 21 architecture rules from the source prompt — each adapted to verified project reality, not copied verbatim.
2. **HTTP-client contract decided.** One standard is chosen among the three that exist today; the decision records: standard return shape, token strategy, base-URL handling, and the migration direction with compatibility shims for the other two until empty. (See Decision DEC-1.)
3. **Server-state strategy confirmed.** TanStack Query is the official strategy (provider already mounted, zero usages); a query-key + cache-invalidation convention is documented. Suppliers (E21-S3) is named the first adopter.
4. **Theming rule recorded.** Semantic tokens already exist (shadcn vars in `globals.css`, Tailwind v4 `@theme`); the rule is adoption-in-feature-pages, NOT a system-wide colour sweep. The Supplier status colours (Prospect/Active/Paused/Ended) get a decided home (Badge variants vs bespoke tokens — DEC-2).
5. **Auth model documented.** Security boundary (backend 403 + `RequireModule`) vs UX guard (middleware module-gate, page/layout redirects) is written down; `useRequireAuth` is named the canonical UX guard.
6. **Route-group recommendation documented** (why only `events` sits under `(dashboard)`; whether a shared protected group is warranted). Recommendation ONLY — no route moves in this story or the pilot.
7. No production code behaviour changes. Docs/decisions only (non-behavioural scaffolding is allowed but not required). `tsc`/`lint`/`test` stay green.

## Tasks / Subtasks

- [ ] Task 0: Re-read the Gate-1 analysis and its 8 Open Questions (AC: all)
  - [ ] `docs/frontend-refactoring-gate1-analysis.md` end-to-end; treat §12 Open Questions as the decision agenda.
- [ ] Task 1: Decide the HTTP-client contract (AC: 2)
  - [ ] Compare the three: `lib/api-client.ts` (`ApiClient` class, throws), `useApiClient` in `lib/auth.ts:169-295` (`{data,error,status}`, used by suppliers), `lib/services/api.ts` (`{success,data,error,errorBody,status}`, used by `lib/api/*`).
  - [ ] Record DEC-1 (standard shape + token + base-URL + migration shims).
- [ ] Task 2: Decide server-state convention (AC: 3)
  - [ ] Confirm `QueryClientProvider` in `app/providers.tsx:10-20`; document query-key + invalidation convention; name Suppliers the first adopter.
- [ ] Task 3: Decide theming/token rule + status-colour home (AC: 4)
  - [ ] Inspect `globals.css` `@theme` + `components/ui/badge.tsx` variants; record DEC-2.
- [ ] Task 4: Document auth model + route-group recommendation (AC: 5, 6)
  - [ ] From `middleware.ts` (module-gate only, not role) + `lib/auth.ts` (`useAuth`/`useRequireAuth`). Recommendation only for route groups.
- [ ] Task 5: Write the target-state section + 21 adapted rules into `docs/architecture-frontend.md` (AC: 1)
- [ ] Task 6: Quality gate (AC: 7)
  - [ ] `tsc --noEmit`, `eslint src/`, `vitest run` green (no behavioural change expected).

## Dev Notes

This story IS the "Gate 2 / Brownfield Zielbild" of the source prompt. It produces decisions, not refactors. Its output unblocks E21-S3.

### Scope Boundaries

In scope: `docs/architecture-frontend.md` (extend), the recorded decisions (DEC-1, DEC-2), optional non-behavioural type-only scaffolding.
Out of scope: any page/feature refactor, route-group moves, client consolidation, colour sweep, ESLint enforcement (that is E21-S5).

### Architecture Guardrails

- Adapt the 21 rules to reality — e.g. rule 8 ("reuse existing Supplier service") is VOID: no supplier service exists (Gate-1 CF, §7). Rule 10 holds (TanStack present) but note zero current usage.
- Do not invent a REQ; this is a technical initiative grounded in the Gate-1 analysis.

### Decision-Needed (resolve in this story)

- **DEC-1 — HTTP-client standard.** (A, recommended) Standardise on the hook contract pattern `{data,error,status}` for client components and keep `lib/services/api.ts` `{success,...}` as the module-level pattern, converging the two return shapes onto one documented shape over time; retire the throwing `ApiClient` class. (B) Standardise on `lib/services/api.ts` everywhere. (C) Defer — rejected: the pilot needs a contract.
- **DEC-2 — Supplier status-colour home.** (A, recommended) Add status variants to `Badge` / map to semantic tokens, no raw Tailwind colour classes in the feature. (B) Keep a small colour map co-located in the feature (matches the existing `lib/api/members.ts` pattern) but token-based. (C) Raw classes — rejected (violates theming rule).

### Project Structure Notes

- Docs: `docs/architecture-frontend.md`, evidence `docs/frontend-refactoring-gate1-analysis.md`.

### References

- `docs/frontend-refactoring-gate1-analysis.md` (Gate-1; §12 Open Questions = agenda)
- `frontend/src/lib/auth.ts:169-295`, `frontend/src/lib/services/api.ts`, `frontend/src/lib/api-client.ts`
- `frontend/src/app/providers.tsx:10-20`, `frontend/src/middleware.ts`
- `_bmad-output/planning-artifacts/epics-and-stories.md` (Epic E21)
- Source prompt: "Frontend Brownfield Refactoring Prompt" (Gate 2, Architekturregeln, Ziel-Import-Richtung)

## Validation Notes

- Created 2026-06-07 from the user-authored refactoring prompt via the BMad story workflow. Decisions-only story; no behavioural risk.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-07: Story created from the Frontend Brownfield Refactoring prompt (Gate 2) and the Gate-1 analysis; marked ready.
