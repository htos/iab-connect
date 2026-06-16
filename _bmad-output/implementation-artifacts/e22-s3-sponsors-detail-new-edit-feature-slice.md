# Story E22.S3: Sponsors Detail/New/Edit — Feature-Slice Extraction and Form Sub-Recipe

Status: done

Depends on: E22-S1 (characterization tests green). Builds on E22-S2 (`features/sponsors/api` + `types`). This is the LARGEST E22 story — multi-commit; budget accordingly.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the Sponsors detail, new, and edit pages refactored into the `src/features/sponsors/` feature-slice pattern,
so that the first form pages establish the form sub-recipe that every later domain epic (E23+) inherits, with behaviour preserved.

## Acceptance Criteria

**Behaviour preserved (all E22-S1 detail/new/edit characterization tests stay green):**

1. `/sponsors/[id]`, `/sponsors/new`, `/sponsors/[id]/edit` access guards (`isVorstand || isAdmin`, same redirects), data load/prefill, the detail page's full surface (below), create/update submit, validation, success redirect (`/sponsors`), and submit-error handling all behave exactly as before.
2. **Detail surface preserved in full** (it is richer than Suppliers detail — do NOT drop any of it): `GET /api/v1/sponsors/{id}` (loading/error/not-found); render contact info, sponsor info, tier, status, agreement dates, notes, packages list, contract-links list; status change `PUT /api/v1/sponsors/{id}/status`; delete `DELETE /api/v1/sponsors/{id}` → redirect `/sponsors`; package add `POST /api/v1/sponsors/{id}/packages` + remove `DELETE /api/v1/sponsors/{id}/packages/{packageId}` (empty state `sponsors.noPackages`); link add `POST /api/v1/sponsors/{id}/links` + remove `DELETE /api/v1/sponsors/{id}/links/{linkId}` (empty state `sponsors.noLinks`); each in-flight action keeps its disabled/pending state.

**Improvements:**

3. Each route file (`[id]/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`) becomes a thin entry rendering a `features/sponsors/components` content component (the composition root is the only `"use client"`).
4. `features/sponsors/` gains (extending the E22-S2 slice — `api/sponsors-api.ts` stays the single source of `/api/v1/sponsors` URLs):
   - `api/sponsors-api.ts` += `getSponsor(api, id)`, `createSponsor(api, body)`, `updateSponsor(api, id, body)`, `updateSponsorStatus`, `addPackage`/`removePackage`, `addLink`/`removeLink` (all typed via the DEC-1 client contract; encapsulated URLs).
   - `hooks/` += `use-sponsor(id)` (get-by-id) and the create/update (and detail mutation) hooks per DEC-2.
   - `schemas/sponsor.schema.ts` — the form schema per DEC-1.
   - `components/` += `sponsor-detail` (+ `sponsor-packages`, `sponsor-contract-links`, status-change control, delete dialog reusing `delete-sponsor-dialog`), `sponsor-form` (shared by new + edit).
5. The shared `ContractLink*` types are imported from `src/types/sponsors.ts` (NOT duplicated); Sponsor-specific types from `features/sponsors/types/sponsor.types.ts` (created in S2).
6. Quality: no new `any`; no new hard-coded user-facing strings (all `sponsors.*`/`common.*`/`form.*` via next-intl); no new direct API URL in route files; no duplicate UI primitive; CRUD round-trips unchanged (create→redirect→list; edit→GET-prefill→PUT→redirect; detail status/delete/package/link all behave as before). `tsc`/eslint(changed)/prettier-check(changed)/`vitest run` green; `next build`; LF-clean diff (A73).
7. `docs/architecture-frontend.md` gains a short **"Form sub-recipe"** note (the DEC-1 form mechanism + the shared new/edit form component + the mutation-invalidation pattern) as the template E23+ forms follow — written once here, pointed to by later epics (A38).

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + verify S2 shipped the seam (A62) (AC: all)
  - [x] E22-S1 detail/new/edit suites green; E22-S2 done — `features/sponsors/{api,types}` exists and the 4 pages' type imports are repointed (S2 repointed imports only; this story migrates the bodies). Verified `api/sponsors-api.ts` + `types/sponsor.types.ts` present.
- [x] Task 1: Resolve DEC-1 (form mechanism) + DEC-2 (detail server-state) (AC: 2, 4)
  - [x] Recorded the (a)/(b)/(c) Debug Log (A43) for each DEC (autonomous mode pre-declared — DEC-1=A RHF+Zod, DEC-2=A full TanStack).
- [x] Task 2: Extend `api/sponsors-api.ts` (AC: 4)
  - [x] Added `getSponsor`, `createSponsor`, `updateSponsor`, `updateSponsorStatus`, `addPackage`/`removePackage`, `addLink`/`removeLink` — encapsulated, typed via `ReturnType<typeof useApiClient>`.
- [x] Task 3: New + Edit forms — the form sub-recipe (AC: 1, 3, 4, 5)
  - [x] `sponsor-form` shared by new + edit (9 fields), RHF+Zod (`schemas/sponsor.schema.ts`), per DEC-1; thin `new/page.tsx` + `[id]/edit/page.tsx` entries; `use-create-sponsor`/`use-update-sponsor` hooks; success redirect `/sponsors`; API-error banner preserved.
- [x] Task 4: Detail page (AC: 1, 2, 3)
  - [x] `sponsor-detail` content component + `sponsor-packages` + `sponsor-contract-links`; status-change control; delete via `delete-sponsor-dialog`; preserved every endpoint + pending/empty state; DEC-2=A — converted to TanStack (`use-sponsor` query + `use-sponsor-detail-mutations`), writing each mutation's returned DTO into the detail cache (no extra GET).
- [x] Task 5: Keep behaviour green + architecture note + quality gate (AC: 1, 6, 7)
  - [x] All E22-S1 detail/new/edit tests green post-refactor (added the `QueryClientProvider` harness seam to the new + edit suites, as S3 makes them TanStack consumers — a harness change, not a behaviour-assertion change). Added focused `sponsor-form.test.tsx` (Zod required-validation blocks submit + happy/pending/error). Added the "Form sub-recipe" note to `docs/architecture-frontend.md` (A38). `tsc`/eslint(changed)/prettier-check(new)/`vitest run`(304/304) green; `next build` succeeds.

## Dev Notes

This story has two distinct shapes under one "non-list pages" umbrella: (a) the **forms** (new/edit) — simple, and the place the reusable form sub-recipe is born; (b) the **detail page** — mutation-heavy (7 endpoints + inline package/link CRUD + status change + delete), the largest single surface in E22. Suggested internal order: forms first (establish + prove the sub-recipe), then detail.

### Scope Boundaries

- In scope: the bodies of `app/sponsors/[id]/page.tsx`, `app/sponsors/new/page.tsx`, `app/sponsors/[id]/edit/page.tsx` → `features/sponsors/*`; extending the S2 `api`/`hooks`; the form schema; the architecture-frontend note.
- Out of scope: backend; the `/api/v1/sponsors/*` contract (URLs only relocate, shapes unchanged); route-group moves; any `suppliers`/other-feature change; the list page (S2).

### Architecture Guardrails

- Behaviour-preserving — the E22-S1 detail/new/edit suites are the contract. The detail page's full endpoint set + every pending/empty state must survive.
- **Current reality:** new/edit/detail all use manual `useState` (NO RHF+Zod today — neither Sponsors nor Suppliers). RHF+Zod is the project stack standard (project-context) and the epic GOAL names the RHF+Zod sub-recipe — but introducing it changes validation/submit semantics, so treat it as a deliberate, behaviour-preserving change (A79): HTML5 `required` → Zod `required`, same fields, same redirect, API error still shown in the banner.
- Reuse `delete-sponsor-dialog` (S2) for the detail delete; reuse `ContractLink*` from `src/types/sponsors.ts`; do not duplicate primitives.
- DoD identical to S2 (changed-files gate; never `npm run format`; `prettier --write` new files only, A72; LF, A73).

### Decision-Needed

- **DEC-1 (Form mechanism for new/edit).**
  - **Option A (recommended):** introduce React Hook Form + Zod via a shared `sponsor-form` + `schemas/sponsor.schema.ts`, behaviour-preserving (same fields/required/redirect/error-banner). Establishes the form sub-recipe E23+ inherit — the epic's stated goal; aligns with the project stack standard. Enumerate the A79 deltas (validation timing, submit handler) and preserve the observable contract.
  - Option B: keep manual `useState`, just slice into feature components (lowest risk; does NOT establish the sub-recipe → defers the RHF+Zod decision to a later epic, weakening the "recipe-validation" purpose).
- **DEC-2 (Detail server-state).**
  - **Option A (recommended):** convert the detail `GET` to `use-sponsor` (`useQuery`) and the 6 mutations (status/delete/package-add/remove/link-add/remove) to `useMutation` with `sponsorsKeys.detail(id)` invalidation (and `sponsorsKeys.all` on delete) — consistent with the list slice + coherent cache. Heaviest part of the epic.
  - Option B: keep detail on manual `useState` (the current re-GET-after-mutation pattern) behind the same observable contract, converting only new/edit — bounds risk on the most complex surface, at the cost of two server-state styles inside one slice.
  - Resolve both at dev-story per A41/A32 with the A43 (a)/(b)/(c) Debug Log; if autonomous-mode is not pre-declared, AskUserQuestion.

### Testing Requirements

- All E22-S1 detail/new/edit tests green post-refactor. Add focused tests: form validation (required companyName/tier), create + update mutation calls + redirect, and (if DEC-2=A) the detail query/mutation wiring. A78 stable mocks; A79 record the manual→TanStack/RHF deltas a `retry:false` harness can't see.

### Project Structure Notes

- Target additions: `features/sponsors/{schemas/sponsor.schema.ts, hooks/use-sponsor.ts (+ create/update/detail-mutation hooks), components/{sponsor-detail,sponsor-form,sponsor-packages,sponsor-contract-links}.tsx}`; three thin route entries. `api/sponsors-api.ts` extended (not duplicated).

### References

- `frontend/src/app/sponsors/[id]/page.tsx` (detail: GET :65; status PUT :101-104; delete :119; package POST :132 / DELETE :156; link POST :171 / DELETE :193; empty states `noPackages`/`noLinks`; inline manual-useState mini-forms)
- `frontend/src/app/sponsors/new/page.tsx` (POST :44 → redirect :49; 9 fields, manual useState, HTML5-required) and `frontend/src/app/sponsors/[id]/edit/page.tsx` (GET prefill :45, PUT :77 → redirect :82, startTransition :66)
- `frontend/src/features/sponsors/api/sponsors-api.ts` + `types/sponsor.types.ts` (created in E22-S2 — extend, don't fork)
- `frontend/src/features/suppliers/**` (slice template; note suppliers detail/new/edit are NOT yet migrated, so there is no form precedent to copy — this story creates it)
- `frontend/src/types/sponsors.ts` (shared `ContractLink*` to import)
- project-context.md: A38 (write the sub-recipe doc once), A41/A32/A43 (DEC resolution), A58/A72/A73 (gates), A78/A79 (mock fidelity + semantic deltas); `docs/architecture-frontend.md` target-state + Pilot Result Note

## Validation Notes

- Created 2026-06-07. Status ready-for-dev. Depends on E22-S1 green + E22-S2 slice. Largest E22 story — two DECs (form mechanism, detail server-state) for dev-story to resolve; suggested internal order forms → detail.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous epic-wide dev-story run, E22 S1→S2→S3).

### Debug Log References

**DEC-1 (Form mechanism for new/edit) — resolved A41/A43 (autonomous mode):**
- **(a) Option chosen:** Option A — React Hook Form + Zod via a shared `sponsor-form` + `schemas/sponsor.schema.ts`.
- **(b) Rationale:** (1) story recommendation = Option A; (2) user pre-declared autonomous mode verbatim — *"das ganze epic umsetzen bis alle stories implementiert sind. nicht stoppen, danach werde ich eine review und eine retro durchführen"*; (3) RHF+Zod is the project stack standard (project-context Technology Stack) and the epic's stated GOAL is to establish the form sub-recipe E23+ inherit — keeping manual `useState` (Option B) would defer that and weaken the recipe-validation purpose.
- **(c) Consequence chain:** new/edit bodies move to the shared `SponsorForm`; the only deliberate behaviour change is HTML5 `required` → Zod `required` (companyName + tier), with same fields/redirect/error-banner (A79 — optional fields kept as plain strings, no new `.email()`/`.url()`). AC-3/AC-4 satisfied; the sub-recipe is documented once in `docs/architecture-frontend.md` (AC-7).

**DEC-2 (Detail server-state) — resolved A41/A43 (autonomous mode):**
- **(a) Option chosen:** Option A — convert the detail GET to `use-sponsor` (`useQuery`) and the 6 mutations (status/delete/package-add/remove/link-add/remove) to `useMutation`.
- **(b) Rationale:** (1) story recommendation = Option A; (2) same autonomous-mode directive quoted above; (3) consistency with the list slice + a single coherent cache (the detail mutations `setQueryData(sponsorsKeys.detail(id), data)`), rather than two server-state styles inside one slice.
- **(c) Consequence chain:** AC-2 detail surface preserved via TanStack; the A79 deltas decided — each mutation writes its returned `SponsorDetailDto` straight into the detail cache (preserving the god-page's "mutation response updates the view, no extra GET"); a 404 throws a typed `SponsorNotFoundError` so `sponsors.notFound` renders; mutation errors still surface via `alert` (unchanged). The S1 detail/new/edit suites needed the `QueryClientProvider` harness seam added to the new + edit files (detail already had it from S1).

**A79 deltas (manual→TanStack/RHF) enumerated & preserved:**
- create/update mutations throw on error → the shared form banner shows `mutation.error.message` (= the god-page `setError`); redirect stays in the composition-root `onSuccess`.
- detail query 404 → typed sentinel → `sponsors.notFound`; generic error → `error.message`.
- detail mutations use `setQueryData` (not invalidate) to avoid an extra GET, matching the god-page's response-driven update.
- the `retry:false` test harness cannot observe the provider's `retry:1` / sticky-mutation-error / no-spinner-on-refetch — noted, owned by this story's design (same as S1/S2).
- RHF required-validation now blocks submit (the manual form did not under `fireEvent`) — pinned by the new `sponsor-form.test.tsx`.

**A72/A73:** new feature/test files got `prettier --write` (legitimate — new, not pre-drifted); the three route pages were FULLY replaced with thin clean entries (prettier-clean by construction, `--check` passes); `docs/architecture-frontend.md` got a hand-matched markdown section. All new files LF-clean.

### Completion Notes List

- Migrated the Sponsors detail, new, and edit page BODIES into `src/features/sponsors/`, establishing the RHF+Zod form sub-recipe (DEC-1=A) and full-TanStack detail server state (DEC-2=A). The three route files are now thin server entries.
- **AC-1 (behaviour preserved):** ✅ all E22-S1 detail (15) / new (6) / edit (5) characterization tests green against the refactored pages.
- **AC-2 (detail surface in full):** ✅ GET (loading/error/404), contact + sponsor info + tier + status + agreement + notes + packages + links, status `PUT /status`, delete → redirect, package add/remove (`POST`/`DELETE /packages[/id]`, empty `noPackages`), link add/remove (`POST`/`DELETE /links[/id]`, empty `noLinks`), each with its pending/disabled state.
- **AC-3 (thin entries):** ✅ `[id]/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx` each render a `features/sponsors/components` composition root (the only `"use client"`).
- **AC-4 (slice extended):** ✅ `api/sponsors-api.ts` += 8 endpoint fns; `hooks/` += `use-sponsor`, `use-create-sponsor`, `use-update-sponsor`, `use-sponsor-detail-mutations`; `schemas/sponsor.schema.ts`; `components/` += `sponsor-form`, `sponsor-new-content`, `sponsor-edit-content`, `sponsor-detail`, `sponsor-packages`, `sponsor-contract-links` (delete reuses `delete-sponsor-dialog`).
- **AC-5 (shared types):** ✅ `ContractLink*` imported from `src/types/sponsors`; Sponsor-specific types from `features/sponsors/types/sponsor.types.ts`.
- **AC-6 (quality):** ✅ no new `any`; no new hard-coded user-facing strings; no direct API URL in route files; no duplicate UI primitive; CRUD round-trips unchanged. `tsc`/eslint(changed)/prettier-check(new)/`vitest run` (304/304) green; `next build` succeeds; LF-clean.
- **AC-7 (form sub-recipe doc):** ✅ added the "Form Sub-Recipe (E22-S3)" section to `docs/architecture-frontend.md` (mechanism + shared form + mutation-invalidation pattern), the template E23+ point back to (A38).

### File List

New:
- `frontend/src/features/sponsors/schemas/sponsor.schema.ts`
- `frontend/src/features/sponsors/hooks/use-sponsor.ts`
- `frontend/src/features/sponsors/hooks/use-create-sponsor.ts`
- `frontend/src/features/sponsors/hooks/use-update-sponsor.ts`
- `frontend/src/features/sponsors/hooks/use-sponsor-detail-mutations.ts`
- `frontend/src/features/sponsors/components/sponsor-form.tsx`
- `frontend/src/features/sponsors/components/sponsor-new-content.tsx`
- `frontend/src/features/sponsors/components/sponsor-edit-content.tsx`
- `frontend/src/features/sponsors/components/sponsor-detail.tsx`
- `frontend/src/features/sponsors/components/sponsor-packages.tsx`
- `frontend/src/features/sponsors/components/sponsor-contract-links.tsx`
- `frontend/src/features/sponsors/components/sponsor-form.test.tsx`

Modified:
- `frontend/src/features/sponsors/api/sponsors-api.ts` (+ 8 detail/form endpoint fns)
- `frontend/src/features/sponsors/types/sponsor.types.ts` (+ `AddPackageRequest`/`AddLinkRequest`)
- `frontend/src/app/sponsors/[id]/page.tsx` (god-page → thin entry)
- `frontend/src/app/sponsors/new/page.tsx` (god-page → thin entry)
- `frontend/src/app/sponsors/[id]/edit/page.tsx` (god-page → thin entry)
- `frontend/src/app/sponsors/new/page.test.tsx` (+ QueryClientProvider harness seam)
- `frontend/src/app/sponsors/[id]/edit/page.test.tsx` (+ QueryClientProvider harness seam)
- `docs/architecture-frontend.md` (+ "Form Sub-Recipe (E22-S3)" section)

## Change Log

- 2026-06-07: Story created (Sponsors detail/new/edit feature-slice extraction + form sub-recipe; extends the E22-S2 slice). DEC-1 (form mechanism) + DEC-2 (detail server-state) recorded. Status ready-for-dev.
- 2026-06-07: Implemented the detail/new/edit feature-slice; DEC-1=A (RHF+Zod sub-recipe) + DEC-2=A (full-TanStack detail) resolved; S1 detail/new/edit suites green post-refactor; form-validation test added; architecture-frontend.md form sub-recipe note added; full suite 304/304; next build green. Status → review.
