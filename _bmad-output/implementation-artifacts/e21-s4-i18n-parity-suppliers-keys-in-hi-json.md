# Story E21.S4: i18n Parity — Add Suppliers Keys to `hi.json`

Status: done

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

- [x] Task 0: Establish baseline (AC: 3)
  - [x] Ran `vitest run messages.parity.test.ts` on HEAD → **3/3 PASS**. The parity test treats `hi.json` as an allowed SUBSET of `en.json` (it only fails on stray hi keys absent from en, or on de↔en drift); de↔en is strict-identical. So `suppliers.*` missing from `hi.json` was a **tolerated gap, not a failure** → this story **fills a gap**, it does not fix a regression.
- [x] Task 1: Add the keys (AC: 1)
  - [x] Added the full `suppliers.*` subtree to `hi.json` with Hindi (Devanagari) values, matching the existing hi.json convention (real translations, not placeholders). Structure copied exactly from `en.json` (40 leaf keys incl. `status.{Prospect,Active,Paused,Ended}`); `{name}` interpolation placeholder preserved verbatim.
- [x] Task 2: Verify (AC: 2, 4)
  - [x] Parity test green (3/3); `git diff --numstat` = **44 insertions, 0 deletions** (additions-only, no renames/removals); en.suppliers↔hi.suppliers leaf-key sets identical (40/40, no missing/extra); prettier clean; full suite 246/246.

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

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via bmad-dev-story.

### Debug Log References

**Baseline (AC-3):** parity test PASSED on HEAD. `messages.parity.test.ts` enforces de↔en strict identity but treats `hi.json` as an allowed subset (only stray hi keys fail). `suppliers.*` (40 leaves) existed in en+de but was absent from hi — a tolerated gap. This story fills the gap; it is not a regression fix.

**Convention check:** `hi.json` uses real Devanagari translations (e.g. `common.save` = "सहेजें"), not English placeholders, so Hindi values were written (not placeholders). `language.en`/`language.de` keep each language's endonym; `suppliers.website` → "वेबसाइट" etc.

**Edit method:** a throwaway node script parsed `hi.json`, appended the `suppliers` object (exact en key paths), and re-serialized with `JSON.stringify(obj, null, 2) + "\n"`. The file was already canonical 2-space JSON, so the diff is additions-only (44 insertions, 0 deletions); the script was deleted after running.

### Completion Notes List

Small, independent i18n gap-fill (Gate-1 Open Question 4). No code/UI change.

- ✅ AC-1: full `suppliers.*` key set added to `frontend/messages/hi.json` at parity with en/de (40 leaf keys, same paths, Hindi values).
- ✅ AC-2: `messages.parity.test.ts` passes (3/3).
- ✅ AC-3: baseline recorded — parity test PASSED before (hi-subset tolerated); this fills a gap, not a regression.
- ✅ AC-4: no key renames or removals in any locale — `git diff --numstat` = 44/0; en↔hi suppliers leaf sets identical.

Gate: parity test green; full `vitest run` 246/246; prettier clean on `hi.json`. tsc/eslint unaffected (JSON-only change outside `src/`).

### File List

- `frontend/messages/hi.json` (modified — added the `suppliers` namespace, additions only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — e21-s4 status → in-progress → review)
- `_bmad-output/implementation-artifacts/e21-s4-i18n-parity-suppliers-keys-in-hi-json.md` (modified — this story file)

## Change Log

- 2026-06-07: Story created (i18n parity for Suppliers in hi.json); marked ready.
- 2026-06-07: Added the `suppliers.*` namespace (40 keys, Hindi/Devanagari) to `frontend/messages/hi.json` at parity with en/de. Baseline: parity test already passed (hi subset tolerated) → gap-fill, not regression. Additions-only (44/0); parity test 3/3; full suite 246/246. Status → review.
