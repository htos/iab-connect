# Story E31.2: Delete the legacy client and compatibility shims

Status: ready-for-dev

Depends on: **E31-S1** (must have left every legacy path with **zero importers**, or only explicitly-documented retained shims). Final story of **Epic-31** and of the entire **Frontend Refactoring Program** (E21–E31). Adds `next build` to the gate (beyond the standard per-story DoD).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the now-unused legacy HTTP client (`lib/api-client.ts`), the legacy template transport (`lib/email-templates.ts`), and every `lib/api/*` + `lib/services/*` compatibility shim deleted, the still-needed tests relocated (not dropped), and the E21-S5 import boundary tightened to **ban** the deleted paths,
so that the codebase has exactly **one** HTTP contract (`useApiClient` + the per-slice `api/` layer), `frontend/src/lib/` no longer hosts a parallel HTTP-client layer, and the legacy paths can never silently return.

## Context

E31-S1 unwound every WRAP and drove the importer count of each legacy path to zero (verified by the enumeration grep, captured in S1's Dev Agent Record). This story is the **physical deletion + guardrail** half: remove the files, relocate any test that still carries value, and add the lint ban that makes the single-contract end-state permanent. It is a small, mechanical, *high-leverage* story whose only real risk is a **dangling import that only surfaces at build/type time** — which is exactly why `next build` joins the gate.

**Two corrections to the epic skeleton (carried from S1):**
1. **`lib/email-templates.ts` is in the deletion set** (the epic omitted it). It was the sole importer of `lib/api-client.ts`; S1 migrated it into `features/communication/email-templates`, so both it and `api-client.ts` are now importer-free and deletable here.
2. **The E21-S5 lint config has NO legacy-path *allowances* to remove** (the skeleton assumed there were). The `no-restricted-imports` rules in `frontend/eslint.config.mjs` only encode cross-zone boundaries — none ever exempted `@/lib/api/*` etc. So the literal AC ("remove allowances") is satisfied by construction; the **substantive** work (and the "stricter config" intent) is to **add a ban** on the deleted paths (DEC-1).

## Acceptance Criteria

**Behaviour preserved:**

1. **Pre-deletion gate.** Re-run the S1 enumeration grep (Dev Notes) and confirm **zero importers** of each target legacy path — excluding any shim S1 explicitly documented as retained. Deletion proceeds **only** for modules with zero importers; a still-referenced module is **not** deleted (record the blocker instead).
2. **Delete the legacy layer.** Remove `frontend/src/lib/api-client.ts`, **`frontend/src/lib/email-templates.ts`**, every module under `frontend/src/lib/api/` (`registration`, `audit`, `retention`, `backup`, `email-campaigns`, `users`, `members`, `automations`, `privacy`, `budgets`, `apiClients`, `webhooks`, `health`), and every module under `frontend/src/lib/services/` (`api`, `documents`, `events`). Confirm `frontend/src/lib/` retains only the non-legacy infrastructure: `auth.ts`, `modules.ts`, `utils.ts` (+ their `*.test.ts`).
3. **Tests preserved by relocation, not deletion.** Any still-needed test that S1 left under a legacy path (`lib/api/members.test.ts`, `lib/api/users.test.ts`, `lib/services/volunteers.test.ts`) is **moved** into the owning slice and retargeted at the slice's `api/<domain>-api.ts` (members → `features/members`, users → `features/admin-users`, volunteers → `features/events`). If S1 already relocated a test (DEC-5=A), just verify it landed. A test obsoleted purely because its legacy module is gone is dropped **only** with a documented rationale (no silent coverage loss).
4. **No broken references.** No remaining import resolves to a deleted path; no route, API-contract, auth, or i18n behaviour change. `npm run typecheck` (`tsc`) + full `npm test -- --run` + **`next build`** all green.

**Improvements:**

5. **Lint bans the legacy paths (DEC-1).** `frontend/eslint.config.mjs` gains a `no-restricted-imports` rule banning `@/lib/api-client`, `@/lib/api/*`, `@/lib/services/*`, and `@/lib/email-templates` repo-wide, with a message pointing to the per-slice `api/` layer. Lint passes `--max-warnings=0` with the stricter config; a future re-creation of any legacy path fails lint.
6. **Single contract.** `frontend/src/lib/` no longer hosts an HTTP-client layer parallel to `src/features/*/api`; the program ends on one `useApiClient` + per-slice `api/` contract.

## Tasks / Subtasks

- [ ] **Task 0: Pre-deletion gate** (AC: 1) — re-run the enumeration grep from S1; confirm zero importers of every target path (or a documented retained shim). If any path still has an importer, **HALT that path** and record it — do not delete a referenced module. Confirm the full suite is green at HEAD.
- [ ] **Task 1: Relocate retained tests** (AC: 3) — for each of `lib/api/members.test.ts`, `lib/api/users.test.ts`, `lib/services/volunteers.test.ts`: if S1 already moved it (DEC-5=A), verify; else move it into the owning slice and retarget its imports at the slice `api/` module. Run the moved test green before deleting the source module. Record any test dropped (with rationale).
- [ ] **Task 2: Delete shims under `lib/api/` and `lib/services/`** (AC: 2) — delete the 13 `lib/api/*` modules + the 3 `lib/services/*` modules (zero-importer gate per Task 0). The internal cross-imports (`automations`→`email-campaigns`; `documents`/`events`→`services/api`) vanish together. Run `tsc` after to surface any dangling reference immediately.
- [ ] **Task 3: Delete the class client + template transport** (AC: 2) — delete `lib/email-templates.ts` first (so `api-client.ts` is provably importer-free), then `lib/api-client.ts`. Confirm `lib/` now contains only `auth.ts`/`modules.ts`/`utils.ts` (+ tests).
- [ ] **Task 4: Tighten the E21-S5 lint** (AC: 5) — add the `no-restricted-imports` ban (DEC-1) to `frontend/eslint.config.mjs`. Run `npx eslint . --max-warnings=0` (or the changed-file set per A58/A72) to confirm zero violations and that the rule *would* catch a re-introduced legacy import (spot-check with a throwaway import, then revert).
- [ ] **Task 5: Final scan + full gate** (AC: 1, 4) — final enumeration grep shows **zero** references to any deleted path. `npm run typecheck` clean; `npx eslint <changed> --max-warnings=0`; `npx prettier --check <changed>` (no `--write` needed on deletions; `--write` only any new/moved test file — A72/A81); `npm test -- --run` green (count ≥ S1 end, accounting for relocations); **`next build` exit 0**. Record deleted files (full paths), relocated tests (old → new), and the lint-config diff in the Dev Agent Record. LF (A73).

## Dev Notes

### Pre-deletion verification recipe (AC-1 / Task 0)

```
grep -rn "lib/api-client\|lib/email-templates" frontend/src --include=*.ts --include=*.tsx
grep -rn "@/lib/api/\(registration\|audit\|retention\|backup\|email-campaigns\|users\|members\|automations\|privacy\|budgets\|apiClients\|webhooks\|health\)" frontend/src
grep -rn "@/lib/services/\(api\|documents\|events\)" frontend/src
```
Expected: only matches inside the to-be-deleted files themselves (and their relocated-pending tests). Any *other* hit is a blocker — that path stays until its importer is migrated.

### Deletion order (AC-2; minimizes transient build breaks)

1. Confirm zero importers (Task 0 gate).
2. Relocate retained tests (Task 1) — move coverage *before* deleting its source.
3. Delete `lib/api/*` + `lib/services/*` shims (Task 2) → `tsc` to surface danglers.
4. Delete `lib/email-templates.ts`, then `lib/api-client.ts` (Task 3).
5. Tighten the E21-S5 lint (Task 4).
6. Full build (Task 5) — `next build` catches any tolerated-until-now dangling import that `tsc` alone missed.

### DEC — Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — lint posture.** **A) Add a `no-restricted-imports` ban** on `@/lib/api-client`, `@/lib/api/*`, `@/lib/services/*`, `@/lib/email-templates` (message → "use the owning `features/<domain>/api` layer; the legacy HTTP clients were retired in E31"). **B) Literal-only** — note that no allowance exists and skip adding a rule. **Recommended: A.** The epic's "stricter config" intent + the "kein MVP" directive are served by a *positive guard* that prevents regression, not by a no-op; deletion alone lets a future dev recreate `lib/api/foo.ts`. Scope the ban repo-wide (the deleted paths have no legitimate consumer left). **Caution:** do **not** ban `@/lib/auth`, `@/lib/modules`, `@/lib/utils` — those are live infrastructure.
- **DEC-2 — retained-test landing (only if S1 left them).** **A) Co-locate at `features/<domain>/api/<domain>-api.test.ts`** (mirror the slice's existing test layout). **B) Keep as a dedicated transport test next to the relocated impl.** **Recommended: A** (matches the slice test convention; the assertions retarget at the slice `api/` module).

### Architecture Guardrails

- **Zero-importer gate is absolute (AC-1).** Never delete a module that still has an importer — that converts a clean retirement into a build break. If S1 documented a retained shim, leave it and record why it survives the program.
- **`next build` is the real backstop.** `tsc` + vitest can pass while a dynamic/688 `next/*`-resolved import dangles; the production build is the definitive "nothing references a deleted path" check. It is a hard gate here (AC-4).
- **No behaviour change.** This story moves/deletes files and adds a lint rule — it must not touch any runtime code path. If deleting a module surfaces a *needed* behaviour that was only in the legacy file, that means S1 missed an importer → stop and fix in S1 scope, do not patch here.
- **Deletions don't need `prettier --write`.** Only a newly-moved test file does (A72/A81). LF (A73).

### Scope Boundaries

- **In scope:** deleting the 16 legacy modules + `api-client.ts` + `email-templates.ts`; relocating the 3 retained transport tests; adding the E21-S5 legacy-path ban; the `next build` gate; final zero-reference scan.
- **Out of scope:** any transport migration (that was S1 — if a path still has importers, this story HALTS, it does not migrate); backend/route/API-contract changes; touching `lib/auth.ts`/`lib/modules.ts`/`lib/utils.ts`; refactoring slice internals.

### Testing Requirements

- The suite (now sourced entirely from `features/*` + `app/*`) must stay green with count **≥ S1 end state** (relocations preserve count; the only legitimate decreases are documented obsolete-test drops). Run `npm test -- --run` after Task 2 and again at Task 5.
- After adding the lint ban (Task 4), spot-verify it *fires*: add a throwaway `import "@/lib/api/members"` in a scratch file, confirm `eslint` errors, then revert.

### Project Structure Notes

- End state: `frontend/src/lib/` = `auth.ts`, `modules.ts`, `utils.ts` (+ `*.test.ts`) only — no `api/`, no `services/`, no `api-client.ts`, no `email-templates.ts`. Every HTTP call resolves through a `features/<domain>/api/` module on the E21-S1 contract. This closes Epic-31 and the Frontend Refactoring Program.

### References

- Deletion targets: `lib/api-client.ts`, `lib/email-templates.ts`, `lib/api/*` (13), `lib/services/*` (3). Retained infra: `lib/auth.ts` (`useApiClient`), `lib/modules.ts`, `lib/utils.ts`. Lint: `frontend/eslint.config.mjs` (E21-S5 `boundaryRules`; add the legacy-path ban). Retained tests: `lib/api/members.test.ts`, `lib/api/users.test.ts`, `lib/services/volunteers.test.ts`.
- Previous story: E31-S1 (the migration — its Dev Agent Record carries the before/after importer scan + any DEC-5 test relocations + any retained-shim documentation this story consumes). Epic: `epics-and-stories.md` §E31 (S2). project-context.md: A58/A72/A73/A81 (gates), E21-S5 boundary lint, A35/A46 (test hygiene). This story adds `next build` to the gate (epic AC).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-13: Story created (bulk-refresh of the entire Epic-31, 2-story shape per user decision "Keep epic's 2 stories as-defined" + "kein MVP mehr"). The deletion/guardrail half: delete the 16 legacy modules + `api-client.ts` + the epic-gap `email-templates.ts`, relocate the 3 retained transport tests, and (DEC-1=A recommended) add an E21-S5 `no-restricted-imports` ban on the deleted paths (the skeleton's "remove allowances" AC is a no-op — no allowance ever existed — so the substantive value is the positive guard). Hard-gated on a zero-importer pre-check (depends on S1) and `next build`. Closes Epic-31 and the Frontend Refactoring Program. Status ready-for-dev.
