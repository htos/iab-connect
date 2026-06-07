# Story E21.S5: Architecture Boundary Enforcement

Status: drafted

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

- [ ] Task 0: Confirm the rule set from E21-S1 (AC: 1)
- [ ] Task 1: Implement enforcement (AC: 1, 2)
  - [ ] Prefer ESLint `no-restricted-imports`/`import/no-restricted-paths`; add a Node/Vitest scan only if ESLint can't express a needed rule.
  - [ ] Run against full `src/`; record/fix or scope any pre-existing violation.
- [ ] Task 2: Document + distinguish (AC: 3)
- [ ] Task 3: Prove it (AC: 4)
  - [ ] Add a temporary bad import → lint/test fails → revert. `npm run lint` green on real `src/`.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-07: Story created (import-boundary enforcement); status drafted pending pilot.
