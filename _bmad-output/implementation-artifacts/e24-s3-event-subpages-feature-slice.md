# Story E24.S3: Event Sub-pages — Feature-Slice Extraction (check-in/fees/registrations/volunteers)

Status: done

Depends on: **E24-S1 (net green) + E24-S2 (slice `api`/`types`/`eventsKeys` shipped)**, plus E21-S3 + E21-S5 (closed) and the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract, DEC-2 status colours). **Last story of E24** — on close, `src/lib/services/events.ts` should have no remaining callers outside the slice (then its dead exports are removed).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the four Event sub-pages extracted into the `src/features/events/` slice, reusing S2's `api`/`types`/`eventsKeys`,
so that the whole events domain lives in one slice with check-in/roster/fees/volunteer behaviours preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E24-S1 tests stay green):**

1. All E24-S1 specs for the four sub-pages (`events/[id]/check-in`, `…/fees`, `…/registrations`, `…/volunteers`) remain green **unchanged**.
2. **Check-in preserved exactly:** scanner/manual tabs; camera probe (`getUserMedia`) auto-flip to manual on unavailability; the dynamic `@yudiel/react-qr-scanner` import stays SSR-guarded + slice-local; the 250 ms manual-search debounce; client-side roster filter by name; QR token dedupe (`lastScannedToken`); `refreshKey`-keyed roster reload; `checkInByQrCode`/`manualCheckIn`/`getEventCheckInRoster` calls; the outcome banners `CheckedIn` / `AlreadyCheckedIn` (+ `checkedInAt`) / `Conflict`→`cancelledConflict`/`waitlistedConflict` / `NotFound` / `networkError` / `invalidQr` with `scanAgain` reset; `actionInFlight` disabled states; `loadRosterFailed`; the `canAccess` (event-manager) role guard.
3. **Fees / Registrations / Volunteers preserved exactly:** fees RHF+Zod dialog (create/edit/`confirm()`-deactivate) + Zurich↔UTC datetime conversion + `noCategories`/`saveFailed`/`loadFailed`; registrations `pageSize=20` + filter→page-reset + 7 stat cards + payment summary + per-status actions + PDF/CSV export + promote + `loadFailed`; volunteers parallel role/shift load + manual role form + RHF+Zod shift dialog + Zurich conversion + assignment-aware delete confirm + `refreshKey` reload. The role guards (`isVorstand||isAdmin||event-manager`, fees additionally `kassier`) and the `/login` redirect are unchanged. Backend `RequireEventStaff` remains the security boundary — the slice role guard stays UX-only.

**Improvements:**

4. The four sub-pages become **thin composition roots** over slice components (`components/check-in/*`, `components/fees/*`, `components/registrations/*`, `components/volunteers/*`); the check-in/roster/fees/volunteer DTOs (`CheckInResultDto`, `CheckInOutcome`, `CheckInConflictReason`, `EventCheckInRosterDto`, `EventCheckInRosterItemDto`, `EventRegistrationDto`, `EventRegistrationStatistics`, `PagedRegistrationResult`, `EventFeeCategoryDto`, `SaveFeeCategoryRequest`, `EventVolunteerRoleDto`, `EventVolunteerShiftDto`, `EventVolunteerAssignmentDto`, `CreateVolunteerShiftRequest`, the `RegistrationStatus`/`PaymentStatus`/`FeeApplicability`/`VolunteerAssignmentStatus` unions, etc.) move into `types/events.types.ts` (reusing S2's file).
5. The sub-page service functions migrate into `api/events-api.ts` (reusing S2's `eventsKeys`, extended with `roster`/`registrations(filters)`/`fees`/`volunteerRoles`/`volunteerShifts` key branches); new hooks (`use-check-in-roster`, `use-manual-check-in`, `use-qr-check-in`, `use-event-registrations`, `use-event-fee-categories`, `use-volunteer-roles`, `use-volunteer-shifts`, + the mutation hooks) wrap them with TanStack invalidation. The dynamic `@yudiel/react-qr-scanner` import stays SSR-guarded and slice-local.
6. Once no caller remains, the now-dead `frontend/src/lib/services/events.ts` exports are removed (A62 — the cleanup S2 deferred); if any out-of-slice caller is found (public pages, other features), it is migrated or the export is retained with a documented reason — **no behaviour regression**.

## Tasks / Subtasks

- [x] Task 0: Verify the S2 seam + spike DECs (AC: all) — resolutions in Debug Log
  - [x] **A62 verification:** confirmed S2 shipped `events-api.ts` (`EVENTS_BASE`+`eventsKeys`), `types/events.types.ts`, hooks/components for the core. Extended (not duplicated): `eventsKeys` gained `roster`/`registrations`/`registrationStatistics`/`waitlist`/`myRegistrations`/`fees`/`volunteerRoles`/`volunteerShifts` branches; `types/events.types.ts` re-exports all sub-page DTOs; `EVENTS_BASE` exported.
  - [x] **A62 importer sweep (deletion-safety inventory):** before — the 4 sub-pages + `event-detail.tsx` (S2-DEC-2 seam) + `VolunteerSelfSignupSection.tsx` + the slice types re-export. After this story — the ONLY remaining non-test runtime importer is `VolunteerSelfSignupSection.tsx` (+ the types re-export).
  - [x] **DEC-1 RESOLVED → A:** all registration fns migrated to the slice (`event-registrations-api.ts` + hooks); BOTH the registrations sub-page AND the detail page's registration section repointed → S2-DEC-2 seam CLOSED. `event-detail.tsx` uses the slice api fns with a `useApiClient()` instance (the imperative `Promise.all`/silent-fail/`regSuccess` flow doesn't fit the throw-and-invalidate hooks).
  - [x] **DEC-2 RESOLVED → A:** the dynamic `import("@yudiel/react-qr-scanner")` lives in a slice-local `"use client"` `check-in-scanner.tsx` with the SAME specifier + SSR guard → the S1 scanner mock keeps intercepting. Camera-probe/`getUserMedia` flow unchanged.
- [x] Task 1: Extend the slice `api` + `types` + `eventsKeys` (AC: 4, 5)
  - [x] Sub-page service fns folded into per-domain slice api files (`event-check-in-api.ts`, `event-fees-api.ts`, `event-registrations-api.ts`, `event-volunteers-api.ts` — members-style multi-api modules sharing the one `eventsKeys`/`EVENTS_BASE`, NOT duplicated). URLs byte-identical (incl. `encodeURIComponent` QR token, the absolute `/registrations/check-in/{token}` path, `…/fee-categories` trailing slash, POST-`deactivate`/POST-`cancel` verbs, pageSize=20 + filter order). DTOs re-exported via `types/events.types.ts`; `eventsKeys` extended.
- [x] Task 2: Hooks (AC: 4, 5)
  - [x] Roster/registrations/stats/waitlist/my-registrations/fees/volunteer-roles/volunteer-shifts query hooks + check-in/fee/registration/volunteer mutation hooks with invalidation. `refreshKey` reload OUTCOME preserved (check-in kept the `refreshKey` mechanism since the god-page had no QueryClient; fees/registrations/volunteers use `invalidateQueries`). `includeWaitlisted`/paging/filter params byte-identical.
- [x] Task 3: Components — check-in (AC: 2, 4)
  - [x] `components/check-in/{check-in-page-content,check-in-scanner}.tsx`: camera probe, tabs, 250ms debounce + client filter, `lastScannedToken` dedupe, full outcome-banner matrix, `actionInFlight`, `scanAgain`, `canAccess` guard — all verbatim. Scanner dynamic import slice-local + SSR-guarded.
- [x] Task 4: Components — fees + registrations + volunteers (AC: 1, 3, 4)
  - [x] `components/fees/*` (RHF+Zod dialog, slice-local Zurich↔UTC helpers, `confirm()`-deactivate, `noCategories`/`saveFailed`/`loadFailed`), `components/registrations/*` (pageSize=20, filter→page-reset, 7 stat cards, payment summary, per-status actions, PDF/CSV export, promote, `loadFailed`), `components/volunteers/*` (parallel load, manual role form, RHF+Zod shift dialog + Zurich conversion, assignment-aware delete confirm, `refreshKey`-reload outcome). Slice schemas added (`fee-category.schema.ts`, `volunteer-shift.schema.ts`).
- [x] Task 5: Repoint the four sub-pages to thin entries + close the S2-DEC-2 seam (AC: 1, 4) — DEC-1
  - [x] `events/[id]/{check-in,fees,registrations,volunteers}/page.tsx` → thin entries (KEEP `params: Promise<{id}>`, `use(params)`, forward `id`). Detail registration section repointed to slice (seam closed). No route-group move.
- [x] Task 6: Delete dead `events.ts` exports + green-the-net + DoD gate (AC: 1, 6)
  - [x] Removed **~39 dead function exports** (event CRUD + manager registration set + check-in + staff volunteer set + fee CRUD + 7 dead label/format helpers) — every one verified zero-caller (grep + tsc safety net). RETAINED with `// A62 retained:` reasons: ALL types/enums (DEC-3 canonical home), `FEE_CURRENCIES`, the 5 public/unauthenticated fns (reserved for E28), the 3 volunteer self-signup fns (`VolunteerSelfSignupSection` needs `ApiResult.errorBody.errorCode`, which `useApiClient` cannot express). `events.ts` 878→**502 lines**. Slice unit tests added (check-in 5 / fees 4+7 / registrations 21 / volunteers 13+8 / api+schemas). Events+slice **195 green**; full suite **659 green / 86 files**; `tsc`+`eslint`+`prettier --check` clean; LF.

## Dev Notes

This finishes the events migration: the four sub-pages join the slice S2 created, and `events.ts` is emptied of its now-dead exports. The hard parts are the check-in page (dynamic QR scanner + camera probe + the outcome-banner matrix + token dedupe) and the two RHF+Zod dialog pages (fees, volunteers) with their Zurich-timezone datetime conversion. None of the behaviour changes — the E24-S1 net is the oracle, and S2's `api`/`types`/`eventsKeys` are reused (not duplicated).

### Scope Boundaries

- In scope: `components/{check-in,fees,registrations,volunteers}/*` + the matching hooks + extending `events-api.ts`/`types/events.types.ts`/`eventsKeys`; thin entries for the four sub-pages; closing the S2-DEC-2 detail-registration seam (DEC-1); removing dead `events.ts` exports (A62).
- Out of scope: the four core pages (S2 owns them, except the detail registration repoint per DEC-1); any backend/route/API-contract change; the camera-probe / scanner UX flow (preserve verbatim); any `(dashboard)` route-group move; i18n key changes; other slices.

### Architecture Guardrails

- **Reuse S2's `api`/`types`/`eventsKeys` — do NOT duplicate them** (extend the existing files). Cross-feature imports via `@/features/*` are forbidden (E21-S5); within the events slice use relative imports.
- Preserve the `'use client'` boundary and the camera-only dynamic import; keep the scanner component slice-local so the S1 mock (same import specifier) keeps intercepting (DEC-2).
- Backend `RequireEventStaff` is the real security boundary; the slice role guard stays UX-only (do not "tighten" it into a security control).
- No contract changes when folding sub-page logic into `events-api.ts` — URLs/params/bodies byte-identical (incl. `encodeURIComponent` on the QR token, the `includeWaitlisted` flag, the registrations paging/filter params).
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; never repo-wide lint/format as the gate (A58/A72). New slice files may be `prettier --write`; modified pre-drifted files hand-matched (A72). Keep files LF (A73).

### A62 deletion-safety note

`events.ts` is shared by core (S2) + sub-pages (S3) + possibly public/other surfaces. AC-6 removes only exports with **zero** remaining callers, established by the Task-0 grep inventory (not assumed). Any out-of-slice consumer found is migrated (if cheap) or the export is retained with a one-line documented reason. The goal state is `events.ts` empty/deleted, but correctness (no orphaned import, no behaviour regression) wins over completeness.

### Testing Requirements

- The E24-S1 sub-page specs are the regression oracle — keep them green **unchanged** through the extraction; a forced spec edit (beyond the licensed form/delete mechanism surface) signals a behaviour change.
- The check-in outcome-banner matrix + `lastScannedToken` dedupe + camera-probe auto-flip are the load-bearing assertions; the fees/volunteer Zurich↔UTC conversion is the second.
- Add slice unit tests for the migrated api/hooks (URL/key shape, error→throw, invalidation) and the RHF+Zod fee/shift schemas (A35/A46 cleanup).

### Project Structure Notes

- Target tree: extend `src/features/events/{api/events-api.ts, types/events.types.ts}`; add `hooks/use-*.ts` (roster/registrations/fees/volunteers) + `components/{check-in,fees,registrations,volunteers}/*.tsx`; thin entries at `app/(dashboard)/events/[id]/{check-in,fees,registrations,volunteers}/page.tsx`.

### References

- S2 deliverable: `src/features/events/{api/events-api.ts, hooks/, components/, types/events.types.ts, schemas/}` (the slice this story extends) — re-verify at Task 0 (A62).
- Slice templates: `frontend/src/features/members/` (multi-sub-domain slice — `api/members-api.ts` + `api/member-segments-api.ts`, many hooks) for the multi-domain api/hooks shape; `frontend/src/features/sponsors/` for RHF+Zod form + `sponsor-form.test.tsx`.
- Sub-pages to migrate: `frontend/src/app/(dashboard)/events/[id]/{check-in/page.tsx, fees/page.tsx, registrations/page.tsx, volunteers/page.tsx}`.
- `frontend/src/lib/services/events.ts` (sub-page fns to fold + delete: `getEventCheckInRoster`/`checkInByQrCode`/`manualCheckIn`; `getEventRegistrations*`/`registerForEvent`/`promoteFromWaitlist`/`getEventWaitlist`/`getMyRegistrations`/`confirm`/`checkIn`/`no-show`/`revert*`; `getEventFeeCategories`/`createEventFeeCategory`/`updateEventFeeCategory`/`deactivateEventFeeCategory`; `getEventVolunteerRoles`/`createVolunteerRole`/`updateVolunteerRole`/`getEventVolunteerShifts`/`createVolunteerShift`/`updateVolunteerShift`/`cancelVolunteerShift`/`getVolunteerShiftAssignments`).
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` contract); `frontend/eslint.config.mjs:48-65` (E21-S5 boundary).
- E24-S1 (`e24-s1-events-characterization-tests.md`) — the net; E24-S2 (`e24-s2-events-core-feature-slice.md`) — the slice base; project-context.md A34/A56/A58/A59/A62/A72/A73/A78/A79.

## Validation Notes

- Created 2026-06-08 as part of the whole-epic E24 preparation (front-loaded batch per A34). Status ready-for-dev. HARD-ordered after E24-S1 (net) + E24-S2 (slice base). Two DECs carry recommended options for A41/A32 dev-story resolution + A43 (a)/(b)/(c). The A62 deletion-safety inventory (grep every `@/lib/services/events` consumer at Task 0) is load-bearing for emptying `events.ts` without regression.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story orchestration: shared eventsKeys/types extension done inline; 4 parallel sub-page sub-agents — check-in/fees/registrations/volunteers; 1 final-wave sub-agent — detail seam + A62 cleanup).

### Debug Log References

**DEC-1 (registration ownership + detail seam) — per A43:**
- (a) **Decision:** A — all registration fns migrated to the slice (`event-registrations-api.ts` + hooks); the registrations sub-page AND the detail registration section both repointed (S2-DEC-2 seam closed).
- (b) **Rationale:** lets `events.ts` shed its registration layer; one transport for the whole domain. The detail section uses the slice api fns with a `useApiClient()` instance rather than the hooks because its imperative flow (`Promise.all(stats, waitlist)` with silent-fail, local `regSuccess` state, reading `result.error` straight into a banner) doesn't fit TanStack's throw-and-invalidate model — preserving behaviour byte-for-byte mattered more than hook purity.
- (c) **Boundary found:** `VolunteerSelfSignupSection` reads `ApiResult.errorBody?.errorCode` (4 branches: ShiftFull/AlreadyAssigned/SignupNotAllowed/NoMemberLink). `useApiClient` returns only `{data,error,status}` (no structured `errorBody`), so repointing it would REGRESS the 409 error-code UX. Per AC-6 it was RETAINED on `@/lib/services/events` with a documented reason — the one deliberate gap to fully emptying `events.ts`. **Flagged for retro:** a `useApiClient` error-body enhancement would let S-future migrate it.

**DEC-2 (scanner mock durability) — A:** the dynamic `import("@yudiel/react-qr-scanner")` stays in a slice-local `"use client"` `check-in-scanner.tsx` with the same specifier + SSR guard; the S1 mock keeps intercepting. Camera-probe/`getUserMedia` untouched.

**Multi-api-file deviation (documented):** the story said "extend `events-api.ts`". To allow parallel-safe authoring AND mirror the members slice (`members-api.ts` + `member-segments-api.ts`), each sub-domain got its OWN api file (`event-{check-in,fees,registrations,volunteers}-api.ts`) importing the shared `EVENTS_BASE`/`eventsKeys` from `events-api.ts`. `eventsKeys` and the DTO re-exports are NOT duplicated (the guardrail's real intent) — only the physical file split differs.

### Completion Notes List

- **Full suite 659 green / 86 files** (was 603 after S2; +56 = the new sub-domain slice unit tests minus the 2 `lib/services/volunteers.test.ts` cases for now-deleted wrappers, which the slice `event-volunteers-api.test.ts` re-covers). Events+slice subset: 195 green / 23 files. `tsc` clean, `eslint` clean, `prettier --check` clean on changed files, LF.
- **Behaviour preservation (AC-1/2/3):** all 4 sub-page characterization suites kept their counts (check-in 28, fees 5, registrations 12 + payment 1, volunteers 10) and EVERY behavioural assertion — only the transport mechanism changed (`@/lib/services/events` service spies → `useApiClient` spy, byte-identical endpoints). The detail suite stayed 17 after the seam close (registration assertions now drive the `apiClient` spy; the `@/lib/services/events` mock reduced to just `getEventVolunteerShifts` for the retained self-signup section).
- **Byte-identical wire quirks pinned (not changed):** QR token `encodeURIComponent` on the absolute `/api/v1/registrations/check-in/{token}` path; roster sends NO `includeWaitlisted` query (god-page always passed `false`); manual check-in body `{ searchQuery: searchQuery ?? null }`; fee-categories trailing slash + POST-`deactivate` (not DELETE); volunteer cancel = POST-`cancel` with `{reason: reason ?? null}`; registrations list pageSize=20 + filter order `status→isWaitlisted→searchTerm→page→pageSize`; PDF export `…/registrations/export-pdf`, CSV `/api/v1/reports/export/events/{id}/registrations`.
- **Zurich↔UTC** datetime helpers lifted verbatim into slice-local modules (fees `datetime-zurich.ts`, volunteers `volunteer-shift.schema.ts`); DST round-trip pinned by both page + schema tests (CEST +2 / CET +1).
- **A62 cleanup:** `events.ts` 878→502 lines; ~39 dead function exports removed (all zero-caller, tsc-verified); types/enums + `FEE_CURRENCIES` + 5 public fns (E28-reserved) + 3 self-signup fns retained with inline `// A62 retained:` reasons. The slice `types/events.types.ts` remains the canonical import surface (DEC-3); the only non-test runtime importer left is `VolunteerSelfSignupSection.tsx`.
- **Benign A79 delta (fees/volunteers):** with TanStack a disabled query reports `isLoading=false`, so an out-of-role user now reaches the `permissionDenied`/skeleton path slightly differently than the god-page's "skeleton-forever" latent quirk. The in-role paths (the only ones the S1 oracle exercises) are unchanged; noted in code comments.

### File List

**New — slice api (`frontend/src/features/events/api/`):** `event-check-in-api.ts` (+`.test.ts`), `event-fees-api.ts` (+`.test.ts`), `event-registrations-api.ts` (+`.test.ts`), `event-volunteers-api.ts` (+`.test.ts`)
**New — slice hooks (`frontend/src/features/events/hooks/`):** `use-check-in-roster.ts`, `use-manual-check-in.ts`, `use-qr-check-in.ts`, `use-event-fee-categories.ts`, `use-fee-category-mutations.ts`, `use-event-registrations.ts`, `use-event-registration-statistics.ts`, `use-event-waitlist.ts`, `use-my-registrations.ts`, `use-registration-mutations.ts`, `use-volunteer-roles.ts`, `use-volunteer-shifts.ts`, `use-volunteer-mutations.ts`
**New — slice schemas:** `schemas/fee-category.schema.ts` (+`.test.ts`), `schemas/volunteer-shift.schema.ts` (+`.test.ts`)
**New — slice components:** `components/check-in/{check-in-page-content,check-in-scanner}.tsx`, `components/fees/{event-fees-content,fee-form-dialog,datetime-zurich}.{tsx,ts}`, `components/registrations/event-registrations-content.tsx`, `components/volunteers/event-volunteers-content.tsx`
**Modified — shared slice (extended, additive):** `api/events-api.ts` (eventsKeys branches + `EVENTS_BASE` export), `types/events.types.ts` (sub-page DTO re-exports), `components/event-detail.tsx` (registration seam closed → slice api)
**Modified — thin route entries:** `app/(dashboard)/events/[id]/{check-in,fees,registrations,volunteers}/page.tsx`
**Modified — characterization specs (transport adaptation, behaviour preserved):** `…/check-in/page.test.tsx`, `…/fees/page.test.tsx`, `…/registrations/page.test.tsx`, `…/registrations/page.payment.test.tsx`, `…/volunteers/page.test.tsx`, `…/[id]/page.test.tsx`
**Modified — A62 cleanup:** `frontend/src/lib/services/events.ts` (878→502), `frontend/src/lib/services/volunteers.test.ts` (dropped 2 cases for removed wrappers)
**Untouched (A62 retained):** `app/(dashboard)/events/[id]/VolunteerSelfSignupSection.tsx`
**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e24-s3 → review).

## Change Log

- 2026-06-08: Story created (Event sub-pages slice extraction — check-in/fees/registrations/volunteers into `src/features/events/`, reusing S2's api/types/eventsKeys; DEC-1 registration-call ownership + detail seam close, DEC-2 scanner-mock durability; A62 deletion-safety sweep of shared `events.ts`). Status ready-for-dev.
- 2026-06-08: Implemented. 4 sub-pages extracted to the slice (per-domain api + hooks + components, thin route entries) reusing S2's eventsKeys/types; detail registration seam closed (DEC-1=A); scanner slice-local (DEC-2=A). A62: events.ts 878→502 (~39 dead fns removed; types/public/self-signup retained with reasons — VolunteerSelfSignupSection kept on the service for its errorBody.errorCode). Full suite 659 green; tsc/eslint/prettier clean. Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-08

**Outcome: Approved.** All 4 sub-pages extracted; scanner slice-local + SSR-guarded (DEC-2); registration seam closed (DEC-1=A); A62 verified (events.ts 878→502, removed exports caller-free, retentions justified). Non-blocking follow-ups (logged in `deferred-work.md`):

- [ ] [Review][Defer] E24-CR1 [Med] Fees vs Volunteers disabled-query surface inconsistency (permissionDenied alert vs skeleton-forever) — pick one direction + add a test.
- [ ] [Review][Defer] E24-CR5 [Low] Unused slice exports (5 registration hooks, signUp/withdraw mutations, getMyWaitlistPosition) — adopt or prune.
- [ ] [Review][Defer] E24-CR6 [Low] `features → app` import for retained `VolunteerSelfSignupSection` — relocate into slice; blocked on a `useApiClient` errorBody enhancement to fully empty events.ts.
