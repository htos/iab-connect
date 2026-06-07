# Story E21.S4: i18n Parity — Add Suppliers Keys to `hi.json`

Status: ready

## Story

As a Hindi-locale user,
I want the Suppliers screens translated,
so that the locale is complete and the parity test reflects reality.

## Acceptance Criteria

1. The full `suppliers.*` key set is added to `frontend/messages/hi.json` at parity with `en.json` and `de.json` (same keys, Hindi values).
2. `frontend/messages/messages.parity.test.ts` passes.
3. The prior baseline is recorded in the story: did the parity test PASS before (tolerated gap) or FAIL (pre-existing red)? This makes clear whether the story fixes a regression or fills a gap.
4. No key renames or removals in any locale.

## Tasks / Subtasks

- [ ] Task 0: Establish baseline (AC: 3)
  - [ ] Run `vitest run messages.parity.test.ts` on HEAD; record pass/fail and which keys it flags. Inspect how the parity test treats `hi.json` (strict 3-way vs en↔de only).
- [ ] Task 1: Add the keys (AC: 1)
  - [ ] Copy the `suppliers.*` subtree from `en.json`; translate values to Hindi; keep structure identical.
- [ ] Task 2: Verify (AC: 2, 4)
  - [ ] Parity test green; diff shows only additions under `suppliers.*` in `hi.json`.

## Dev Notes

Gate-1 found `suppliers.*` present in `en.json`/`de.json` but absent in `hi.json`. This is pre-existing debt, independent of the pilot — it can run in parallel with E21-S2/S3 (no code dependency).

### Scope Boundaries

In scope: `frontend/messages/hi.json` (additions only); the parity test as the gate.
Out of scope: other missing locale keys beyond `suppliers.*` (unless the parity test forces a minimal set to pass — then document them); any UI/code change.

### Architecture Guardrails

- Additions only; never rename/remove keys (would break en/de). Match the exact key paths from `en.json`.
- If Hindi wording is uncertain, use a clearly-marked placeholder consistent with how `hi.json` already handles untranslated areas (check existing convention before inventing one).

### Testing Requirements

- `vitest run messages.parity.test.ts` green; record before/after key counts per locale.

### Project Structure Notes

- `frontend/messages/{en,de,hi}.json`, `frontend/messages/messages.parity.test.ts`.

### References

- `docs/frontend-refactoring-gate1-analysis.md` (i18n inconsistency; Open Question 4)
- `frontend/messages/en.json` (source of the `suppliers.*` key set)

## Validation Notes

- Created 2026-06-07. Small, independent, parallelisable with the pilot.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-07: Story created (i18n parity for Suppliers in hi.json); marked ready.
