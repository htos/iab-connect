# Story E21.S5: Architecture Boundary Enforcement

Status: done

Depends on: E21-S3 (the `features/` direction must be proven by the pilot first).

## Story

As a maintainer,
I want the target import boundaries enforced automatically,
so that the feature-slice architecture does not erode after the pilot.

## Acceptance Criteria

1. A low-false-positive enforcement is added for the E21-S1 import direction via ESLint `no-restricted-imports` and/or a small Vitest/Node boundary test, covering at minimum:
   - `components/ui` must NOT import from `features`
   - `lib` must NOT import from `app` or `features`
   - `features/<a>` must NOT deep-couple to `features/<b>` (cross-feature imports only with explicit justification)
2. The rules do NOT block the existing codebase: either `src/` is already clean against them, or the rules are scoped to the new paths; any pre-existing violation is documented (not silently failed).
3. `e2e/module-enforcement.spec.ts` is left intact and explicitly distinguished in docs from these static import rules (behaviour test vs architecture boundary).
4. `npm run lint` (and the boundary test, if added) is green on HEAD; an intentional bad import demonstrably fails.

## Tasks / Subtasks

- [x] Task 0: Confirm the rule set from E21-S1 (AC: 1)
  - [x] Took the 3 highest-value, lowest-false-positive directions from the E21-S1 "Target Import Direction": ui↛features/app, lib↛app/features, feature↛feature.
- [x] Task 1: Implement enforcement (AC: 1, 2)
  - [x] ESLint core `no-restricted-imports` (no new dependency) in three zone-scoped flat-config `files` blocks in `frontend/eslint.config.mjs`. (eslint-plugin-import is only transitively present via eslint-config-next; core `no-restricted-imports` is the AC-suggested, robust choice.)
  - [x] Ran against full `src/`: the three zones (`components/ui`, `lib`, `features`) are clean — no pre-existing boundary violations. The only standing `npm run lint` errors are pre-existing and unrelated (`src/app/members/segments/page.tsx`, `react-hooks/set-state-in-effect`), documented per A58; my rules add zero new errors.
- [x] Task 2: Document + distinguish (AC: 3)
  - [x] Added an "Architecture Enforcement" section to `docs/architecture-frontend.md` that explains the static rules AND explicitly distinguishes them from `e2e/module-enforcement.spec.ts` (runtime behaviour test, left intact).
- [x] Task 3: Prove it (AC: 4)
  - [x] Added a temporary bad-import probe to each zone → all 3 failed with the correct `no-restricted-imports` boundary message → probes reverted. `npm run lint` on real `src/` introduces no new errors (boundary zones clean).

## Dev Notes

The "Architecture Enforcement" section of the source prompt. Deliberately AFTER the pilot so the rules encode a proven structure, not a hypothesis.

### Scope Boundaries

In scope: ESLint config / a small boundary test + docs.
Out of scope: refactoring code to satisfy ambitious rules (only the minimum to land clean); changing `module-enforcement.spec.ts`.

### Architecture Guardrails

- Rules must not create churn or block migration — start with the highest-value, lowest-false-positive subset and expand later.
- Do not treat `module-enforcement.spec.ts` as a static boundary check; it is an E2E behaviour test.

### Testing Requirements

- `npm run lint` green on HEAD; intentional-violation check; if a boundary test is added, it runs under `vitest`.

### Project Structure Notes

- `frontend/eslint.config.*` (or `.eslintrc`), optional `frontend/src/__tests__/architecture-boundaries.test.ts`, `docs/architecture-frontend.md` (enforcement section).

### References

- `docs/frontend-refactoring-gate1-analysis.md` (§9 item 7; Open Questions)
- Source prompt: "Architecture Enforcement", "Ziel Import Richtung"

## Validation Notes

- Created 2026-06-07. Status `drafted` until E21-S3 closes.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via bmad-dev-story.

### Debug Log References

**Tooling choice.** ESLint core `no-restricted-imports` (zone-scoped via flat-config `files` blocks) instead of `import/no-restricted-paths` — `eslint-plugin-import` is only transitively available via `eslint-config-next` (not a direct dep), so relying on it for our own rule block would be fragile; core `no-restricted-imports` needs no dependency and is exactly what AC-1 suggests. Patterns target the `@/` alias (the repo convention); relative cross-zone imports are not the convention and are intentionally out of the low-false-positive subset (documented).

**Clean-landing verification.** Grepped `components/ui`, `lib`, `features` for the forbidden alias imports before adding rules — all clean (the feature slice uses relative imports internally; ui imports only `lib/utils`/radix; lib imports no app/features). So the rules land green without any refactor.

**Proof (AC-4).** Temporary probe files (`__boundary_probe`) in each zone with a forbidden import all errored with the correct boundary message (ui→features, lib→app, feature→feature), then were deleted. The standing 2 lint errors in `members/segments/page.tsx` are pre-existing/unrelated (A58) and unchanged by this story.

### Completion Notes List

Static import-boundary enforcement; the final E21 foundation story. Config + docs only, no app code changed.

- ✅ AC-1: `no-restricted-imports` rules added for the 3 minimum directions — `components/ui ↛ features|app`, `lib ↛ app|features`, `feature ↛ feature` — in `frontend/eslint.config.mjs`.
- ✅ AC-2: rules do not block the existing codebase — the three zones are already clean; no code change needed. Pre-existing unrelated lint errors documented (A58), not silently failed.
- ✅ AC-3: `e2e/module-enforcement.spec.ts` left intact and explicitly distinguished in `docs/architecture-frontend.md` (static boundary vs runtime behaviour test).
- ✅ AC-4: an intentional bad import demonstrably fails in each zone (3 probes); the boundary rules add zero new `npm run lint` errors on HEAD (boundary zones green).

Gate: boundary zones lint-clean; 3 intentional-violation probes failed as expected; full `vitest run` 246/246; prettier clean on `eslint.config.mjs`. tsc unaffected.

### File List

- `frontend/eslint.config.mjs` (modified — three zone-scoped `no-restricted-imports` boundary blocks)
- `docs/architecture-frontend.md` (modified — "Architecture Enforcement" section)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — e21-s5 backlog → in-progress → review)
- `_bmad-output/implementation-artifacts/e21-s5-architecture-boundary-enforcement.md` (modified — this story file)

## Change Log

- 2026-06-07: Story created (import-boundary enforcement); status drafted pending pilot.
- 2026-06-07: Added static feature-slice import-boundary enforcement to `frontend/eslint.config.mjs` (ESLint `no-restricted-imports`, 3 zone-scoped rules: ui↛features/app, lib↛app/features, feature↛feature). Codebase already clean (no refactor); intentional bad imports fail in all 3 zones; pre-existing unrelated lint errors untouched (A58). Documented + distinguished from the E2E module-enforcement test in `docs/architecture-frontend.md`. Full suite 246/246. Status → review.

## Senior Developer Review (AI) — Epic E21 Boundary (2026-06-07)

3-layer adversarial review over the full E21 diff. Outcome: **Approved with deferral** — 1 defer owned here.

### Review Follow-ups (AI)

- [x] [Review][Defer] D2 — ESLint boundary rules match only the `@/` alias; relative cross-zone imports (`../../features/...`) are not caught. Documented as intentional scope in `docs/architecture-frontend.md`; add relative-path patterns in a later hardening pass. [frontend/eslint.config.mjs]
