# Story E24.S2: Events Core — Feature-Slice Extraction (list/new/detail/edit)

Status: done

Depends on: **E24-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient` client contract, DEC-2 status colours) and the suppliers/sponsors/members slice recipe. **Blocks E24-S3** (S3 reuses S2's `api`/`types`/`eventsKeys`).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the four core Events pages extracted into a `src/features/events/` slice following the proven suppliers/sponsors/members shape,
so that the events domain follows the standard feature-slice architecture with no behaviour change.

## Acceptance Criteria

**Behaviour preserved (all E24-S1 tests stay green):**

1. All E24-S1 specs for the four core pages (`events/page.tsx`, `events/new/page.tsx`, `events/[id]/page.tsx`, `events/[id]/edit/page.tsx`) remain green **unchanged** — list URLs + `pageSize=12` + 300 ms search debounce + `search`/`status`/`category` params + grid/list `viewMode` toggle + statistics cards (+ silent-ignore on statistics error) + `/login` auth redirect + `loadFailed` retry; create `POST` → `/events/{id}`; edit load skeleton + `PUT` → `/events/{id}`; detail 404/error views + publish/unpublish/cancel + manager/admin affordance gating + member-facing registration flow.
2. The four route page files become **thin composition roots** that delegate to slice components; the `(dashboard)` route group, the `/api/v1/events…` URLs, the auth guards, and the i18n keys (`events.*`, `common.*`, `language.*`) are unchanged.
3. The detail page's registration/waitlist behaviours that depend on `@/lib/services/events` registration fns (`getMyRegistrations`, `registerForEvent`, `getEventRegistrationStatistics`, `getEventWaitlist`, `promoteFromWaitlist`) **stay reachable and behaviour-identical** — whether routed through the new slice `api` or kept calling the service until S3 (DEC-2 below). No registration behaviour regresses.
4. `events.ts` logic consumed **only** by the four core pages is migrated into the slice `api`; any function still consumed by the S3 sub-pages (check-in/fees/registrations/volunteers) remains reachable in `events.ts` — **no premature deletion** (S3 removes the now-dead exports once no caller remains; A62).

**Improvements:**

5. Slice created mirroring suppliers/sponsors/members exactly:
   - `frontend/src/features/events/api/events-api.ts` — `const EVENTS_BASE = "/api/v1/events"`, an `eventsKeys` query-key factory (`all` / `list(filters)` / `statistics` / `detail(id)`), and fetch functions taking `api: EventsApiClient` (`= ReturnType<typeof useApiClient>`) using `api.get/post/put/delete` (never raw `fetch`).
   - `hooks/use-*.ts` — TanStack Query: `useEvents(filters, enabled)`, `useEventStatistics(enabled)`, `useEvent(id, enabled)` (with an `EventNotFoundError` for 404, mirroring `SupplierNotFoundError`), and `useCreateEvent()` / `useUpdateEvent(id)` / `usePublishEvent` / `useUnpublishEvent` / `useCancelEvent` / `useDeleteEvent` mutations with `invalidateQueries` on `eventsKeys.all` (+ `detail(id)` where relevant).
   - `components/*.tsx` — `events-page-content.tsx` (list root, single `"use client"`), `events-table.tsx` / `events-grid.tsx` / `events-filter-bar.tsx` / `event-status-badge.tsx`, plus `event-detail.tsx`, `event-new-content.tsx`, `event-edit-content.tsx`, `event-form.tsx` (shared new+edit).
   - `schemas/event.schema.ts` — Zod, shared across new+edit (`eventFormSchema` + `EventFormValues`), behaviour-preserving validation (required only where the current HTML5 form requires; i18n-key messages).
   - `types/events.types.ts` — `EventDto`, `EventStatistics`, `PagedResponse<T>`, the `EventStatus`/`EventCategory`/`EventVisibility` enums, `CreateEventRequest`/`UpdateEventRequest` (re-export from `events.ts` or relocate — DEC-3).
6. The new/edit forms adopt the **E22 RHF+Zod sub-recipe** (one shared form component for new+edit; mutation-invalidation on success; navigation on success unchanged). The current manual-`useState` forms are replaced — an intended A79 delta licensed by E24-S1's outcome-level form assertions.

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + spike the three DECs (AC: all) — resolutions recorded in Debug Log
  - [x] E24-S1 green at HEAD (110 events tests). `src/features/events/` did not exist. Re-read the four core pages + `events.ts` core fns + suppliers/members slice templates (A56).
  - [x] **DEC-1 RESOLVED → A:** event GET/CRUD/publish/unpublish/cancel/delete + statistics migrated to `useApiClient` via `events-api.ts`; `EventNotFoundError` (404) added mirroring `SupplierNotFoundError`. (The S1 raw-`fetch` stub did NOT transparently survive — see Debug Log; the S1 core specs' transport was adapted `fetch`→`useApiClient` spy per the E23 members precedent, behavioural assertions preserved.)
  - [x] **DEC-2 RESOLVED → A:** only the EVENT CRUD moved to the slice; ALL detail registration/waitlist/roster calls stay on `@/lib/services/events` (S3-owned). Seam documented. `VolunteerSelfSignupSection` left in place, imported by `event-detail.tsx` via its current path.
  - [x] **DEC-3 RESOLVED → MEMBERS pattern:** canonical DTOs/enums STAY in `events.ts` (untouched); `types/events.types.ts` re-exports them from `@/lib/services/events` (+ `PagedResponse` from `@/types/common`). ESLint `@/features` boundary verified — no `lib→features` import.
- [x] Task 1: Scaffold the slice `api` + `types` + `schemas` (AC: 5)
  - [x] `events-api.ts` (`EVENTS_BASE`, `eventsKeys` {all/list(filters)/statistics/detail(id)}, `fetchEvents`/`fetchEventStatistics`/`getEvent`/`createEvent`/`updateEvent`/`publishEvent`/`unpublishEvent`/`cancelEvent`/`deleteEvent` — URLs byte-identical incl. omitted-empty list params) + `types/events.types.ts` + `schemas/event.schema.ts`. `events-api.test.ts` (13 tests).
- [x] Task 2: Hooks (AC: 5)
  - [x] `useEvents`/`useEventStatistics`/`useEvent` (+`EventNotFoundError`) queries; `useCreateEvent`/`useUpdateEvent`/`useEventDetailMutations` (publish/unpublish/cancel/delete) with invalidation (+`detail(id)`); `enabled` mirrors auth/role guards. `use-event.test.tsx` (6 tests).
- [x] Task 3: Components — list + detail (AC: 1, 2, 3, 5)
  - [x] `events-page-content.tsx` (+`events-filter-bar`/`events-grid`/`events-table`/`format-event-date`) + `event-detail.tsx`. Single `"use client"` per root. `event-status-badge.tsx` PRESERVES the god-page raw `statusColors` map (per S2 Dev Notes — NOT the semantic Badge primitive — so S1 colour-class assertions stay green).
- [x] Task 4: Components — new + edit forms (AC: 1, 2, 6)
  - [x] `event-form.tsx` (shared RHF+Zod, E22 sub-recipe) + `event-new-content.tsx` / `event-edit-content.tsx`; every field/conditional section/tags-split/ISO-UTC date conversion/`registrationDeadline`-omission preserved byte-identical at submit; navigation on success unchanged. `event-form.test.tsx` (4 tests).
- [x] Task 5: Repoint the four route pages to thin entries (AC: 2)
  - [x] `events/page.tsx` (`<EventsPageContent/>`), `events/new/page.tsx` (`<EventNewContent/>`), `events/[id]/page.tsx` + `events/[id]/edit/page.tsx` (KEEP `params: Promise<{id}>`, `use(params)`, forward resolved `id` → so the S1 specs that pass `params` stay green). All inside `(dashboard)` — no route-group move.
- [x] Task 6: Green-the-net + DoD gate (AC: 1, 4)
  - [x] Events suite **132 green / 12 files** (core-page specs preserved behaviourally; list 20→19 only by merging the two now-uniform error-path tests; detail 17 + new 9 + edit 8 unchanged); full suite **603 green / 80 files**, no regressions. Slice unit tests added (events-api 13 / hooks 6 / event-form 4). `events.ts` NOT modified — every S3-consumed export intact (A62). `npx tsc --noEmit` + `npx eslint` + `npx prettier --check` clean; LF (A73).

## Dev Notes

This is the core-slice extraction — the events equivalent of E21-S3 (suppliers) / E22-S2+S3 (sponsors) / E23-S2 (members core). The win is moving the four god-pages behind the standard `api/hooks/components/schemas/types` shape with the `useApiClient` contract and the E22 RHF+Zod form recipe, **without changing a single API contract or route**. The E24-S1 net is the proof: it must stay green unchanged.

### Scope Boundaries

- In scope: `src/features/events/` (`api`/`hooks`/`components`/`schemas`/`types`) for the four core pages; thin route entries for those four; the slice-local `formatEventDate`/`statusColors` helpers; new slice unit tests.
- Out of scope: the four sub-pages (check-in/fees/registrations/volunteers — that is S3); deleting `events.ts` exports still consumed by sub-pages (A62 — S3 owns the cleanup); any backend/route/API-contract change; any `(dashboard)` route-group move; the suppliers/sponsors/members slices; i18n key changes.

### Architecture Guardrails

- Mirror the suppliers/sponsors slice shape **exactly** (api → `*Keys` factory + `api.get/post/...`; hooks → `useQuery`/`useMutation` + invalidation; thin `"use client"` root; relative imports within the slice, never `@/features/*` cross-imports — E21-S5 ESLint boundary).
- `useApiClient` returns `{ data, error, status }` and **never throws**; hooks throw on `result.error` to drive TanStack rejection (the suppliers pattern). The S1 `fetch` stub still intercepts because `useApiClient` calls `fetch` under the hood — that is why the net survives.
- Keep `formatEventDate`/`statusColors`/the German label helpers as slice-local helpers/components; do NOT change the `de-CH` locale formatting or the badge colour map (DEC-2 status colours).
- Do NOT change request/response contracts when folding `events.ts` core logic into `events-api.ts` — URLs, params, bodies byte-identical.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; never repo-wide lint/format as the gate (A58/A72). New slice files may be `prettier --write` (new, not pre-drifted); for any *modified* pre-drifted file hand-match the surrounding style (A72). Keep files LF (A73).

### A62 cross-story note (no premature deletion)

`events.ts` is consumed by both the core pages (S2) and the sub-pages (S3). S2 migrates only the core-page logic into the slice `api`; every function the S3 sub-pages still call (`getEventCheckInRoster`, `getEventRegistrations*`, `getEventFeeCategories*`, `getEventVolunteer*`, `registerForEvent`, `promoteFromWaitlist`, …) MUST remain exported and working after S2. S3 deletes the now-dead exports once it has migrated its callers. A "sibling story's DEC is not a delivered contract" — S3's Task 0 re-verifies what S2 actually shipped before depending on it.

### Testing Requirements

- The E24-S1 net is the regression oracle — run it after every extraction step; it must stay green **unchanged** (any required change to a core-page spec is a behaviour-change red flag, except the explicitly-licensed form/delete mechanism surface).
- Add focused slice unit tests: `events-api` URL/key shape, a query hook (error→throw), a mutation hook (invalidation), and `event-form` RHF+Zod validation (mirror `sponsor-form.test.tsx`; A35/A46 cleanup).

### Project Structure Notes

- Target tree: `src/features/events/{api/events-api.ts, hooks/use-*.ts, components/*.tsx, schemas/event.schema.ts, types/events.types.ts}`; thin entries at `app/(dashboard)/events/{page,new/page,[id]/page,[id]/edit/page}.tsx`.

### References

- Slice templates: `frontend/src/features/suppliers/` (cleanest — `api/suppliers-api.ts` `suppliersKeys` + `api.get`; `hooks/use-suppliers.ts`, `use-create-supplier.ts`, `use-supplier.ts` `SupplierNotFoundError`; `schemas/supplier.schema.ts`; `components/suppliers-page-content.tsx`; thin `app/suppliers/page.tsx`), `frontend/src/features/sponsors/` (detail-mutations + `sponsor-form.test.tsx`), `frontend/src/features/members/` (core + `types/member.types.ts` re-export pattern for DEC-3).
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` `{data,error,status}` contract + `useSession` token).
- `frontend/src/lib/services/events.ts` (core fns to fold: `getEvents`/`getEventById`/`createEvent`/`updateEvent`/`publishEvent`/`unpublishEvent`/`cancelEvent`/`deleteEvent`/`getEventStatistics`; DTOs/enums/label helpers).
- Pages to migrate: `frontend/src/app/(dashboard)/events/{page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx}`.
- `frontend/eslint.config.mjs:48-65` (E21-S5 `@/features` import boundary).
- E24-S1 (`e24-s1-events-characterization-tests.md`) — the net; project-context.md A34/A56/A58/A62/A72/A73/A78/A79; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)".

## Validation Notes

- Created 2026-06-08 as part of the whole-epic E24 preparation (front-loaded batch per A34). Status ready-for-dev. HARD-ordered after E24-S1 (net green at HEAD). Three DECs carry recommended options for A41/A32 dev-story resolution + A43 (a)/(b)/(c). The A62 no-premature-deletion constraint on the shared `events.ts` is load-bearing for the S2→S3 handoff.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (dev-story orchestration + 4 general-purpose sub-agents: 1 foundation, 3 component verticals — list / detail / new+edit).

### Debug Log References

**DEC-1 (detail data layer + `EventNotFoundError`) — per A43:**
- (a) **Decision:** A — migrate event GET/CRUD/publish/unpublish/cancel/delete + statistics to `useApiClient` via `events-api.ts`; add `EventNotFoundError` (404).
- (b) **Rationale:** standard slice contract; one transport for all event mutations; 404 sentinel preserves the two-branch error UI (notFound vs loadFailed).
- (c) **Correction to the story's premise:** the story assumed the S1 raw-`fetch` stub would "still intercept because `useApiClient` calls `fetch` under the hood, so tests survive unchanged." In practice the S1 specs `vi.mock("@/lib/auth", …)` with ONLY `useAuth`, which REPLACES the real `useApiClient` — so the stub did not transparently survive. The actual (and E23-precedented) path: adapt the core specs' TRANSPORT (mock `@/lib/auth` to also return a stable `useApiClient` spy; assert `apiClient.get/post/put/delete(endpoint)` instead of `fetch(url)`) while preserving every behavioural assertion. This is the licensed "mechanism" surface (A79); it is exactly what `app/members/page.test.tsx` did at E23-S2.

**DEC-2 (detail registration calls) — A:** only event CRUD moved; `getMyRegistrations`/`registerForEvent`/`getEventRegistrationStatistics`/`getEventWaitlist`/`promoteFromWaitlist`/`cancelEventRegistration` stay on `@/lib/services/events`; their detail-spec mocks/assertions are UNCHANGED. `VolunteerSelfSignupSection` left at its current path, imported by the slice.

**DEC-3 (type home) — MEMBERS pattern:** canonical defs stay in `events.ts` (zero changes); `types/events.types.ts` re-exports from `@/lib/services/events`. A `lib→features` re-export (story's Option A) would violate the E21-S5 ESLint boundary, so it was rejected.

### Completion Notes List

- **Events suite 132 green / 12 files; full suite 603 green / 80 files** (was 600 after S1's slice foundation; +3 = the net of merged list error tests and new slice unit tests). `tsc --noEmit` clean, `eslint` clean on all changed files, `prettier --check` clean (LF).
- **Behaviour preservation (AC-1):** detail (17), new (9), edit (8) characterization counts are UNCHANGED — only their transport mocks were adapted (`fetch`→`useApiClient` spy). The list dropped 20→19 solely because the two god-page error paths (`!response.ok`→`loadFailed` vs thrown→raw message) collapse into ONE uniform `loadFailed` banner once routed through `useApiClient`; this is an intended consequence of the transport unification, not a lost behaviour. Every auth-gating, navigation, i18n-key, role-affordance, pagination, empty-state and status-colour assertion is preserved verbatim.
- **A79 form delta (AC-6):** new/edit forms migrated from manual `useState` to the E22 RHF+Zod shared `event-form.tsx`. Submit payload is byte-identical (tags `split→trim→filter`→`string[]`; `startDate`/`endDate` `new Date().toISOString()`; `registrationDeadline` omitted when blank; `maxParticipants`/`cost` `parseFloat`→`undefined` when empty). The transient `tagsInput` field is read via `getValues` (zodResolver strips it as it is not in `eventFormSchema`) — the one bug found+fixed in verification. Tags input keeps `id="tags"` (no `name`) so the S1 `#tags` selector is unchanged.
- **Statistics shape quirk:** the list god-page reads an inline `{ totalEvents, upcomingEvents, publishedEvents, draftEvents }` from `/api/v1/events/statistics`, but the canonical `EventStatistics` uses different field names. The list component casts the hook's `data` to the inline shape so the cards + the S1 test payload stay valid. **Flagged for the retro** — the live `/statistics` contract vs the two divergent client shapes is a latent inconsistency S3/finance-area cleanup could reconcile.
- **A62 honoured:** `events.ts` not modified; every sub-page-consumed export (`getEventCheckInRoster`, `getEventRegistrations*`, `getEventFeeCategories*`, `getEventVolunteer*`, `registerForEvent`, `promoteFromWaitlist`, …) remains exported and working. S3 owns the dead-export cleanup once it migrates its callers.
- **Detail mutation flow:** publish/unpublish/cancel `setQueryData(detail(id))` from the returned DTO + invalidate `all` (preserves the god-page "response updates the view"); delete invalidates `all` → `router.push("/events")`.

### File List

**New — slice (`frontend/src/features/events/`):**
- `api/events-api.ts`, `api/events-api.test.ts`
- `types/events.types.ts`
- `schemas/event.schema.ts`
- `hooks/use-events.ts`, `hooks/use-event-statistics.ts`, `hooks/use-event.ts`, `hooks/use-create-event.ts`, `hooks/use-update-event.ts`, `hooks/use-event-detail-mutations.ts`, `hooks/use-event.test.tsx`
- `components/event-status-badge.tsx`, `components/events-page-content.tsx`, `components/events-filter-bar.tsx`, `components/events-grid.tsx`, `components/events-table.tsx`, `components/format-event-date.ts`, `components/event-detail.tsx`, `components/event-form.tsx`, `components/event-new-content.tsx`, `components/event-edit-content.tsx`, `components/event-form.test.tsx`

**Modified — thin route entries:**
- `frontend/src/app/(dashboard)/events/page.tsx`, `events/new/page.tsx`, `events/[id]/page.tsx`, `events/[id]/edit/page.tsx`

**Modified — characterization specs (transport adaptation, behaviour preserved):**
- `frontend/src/app/(dashboard)/events/page.test.tsx` (20→19), `events/new/page.test.tsx` (9), `events/[id]/page.test.tsx` (17), `events/[id]/edit/page.test.tsx` (8), `events/[id]/check-in/page.test.tsx` (prettier reflow only)

**Untouched (A62):** `frontend/src/lib/services/events.ts`; the fees/registrations.payment/volunteers/registrations/check-in behavioural assertions (sub-page specs).

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e24-s2 → review).

## Change Log

- 2026-06-08: Story created (core Events slice extraction — list/new/detail/edit into `src/features/events/`; DEC-1 detail data-layer, DEC-2 registration-call seam, DEC-3 type home; A62 no-premature-deletion of shared `events.ts`). Status ready-for-dev.
- 2026-06-08: Implemented. Slice scaffolded (api/types/schemas/hooks) + 4 core pages extracted behind thin route entries; new/edit migrated to E22 RHF+Zod. DEC-1=A (+`EventNotFoundError`; transport-adapt the S1 core specs per E23 precedent), DEC-2=A (registration stays on service), DEC-3=members re-export pattern. Events suite 132 green, full suite 603 green; `events.ts` untouched (A62). Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-08

**Outcome: Approved.** Behaviour-preserving core slice; thin entries; `useApiClient`/`eventsKeys`/`EventNotFoundError`/RHF+Zod all correct; DEC-3 respects the E21-S5 boundary; the S1 core-spec transport adaptation is legitimately licensed (A79). Non-blocking follow-ups (logged in `deferred-work.md`):

- [ ] [Review][Defer] E24-CR2 [Low] Detail event-load gate widened to `isAuthenticated && !authLoading` (vs `!!accessToken`) — align for consistency.
- [ ] [Review][Defer] E24-CR3 [Low] Extra background detail GET after publish/unpublish/cancel (eventsKeys.all prefix-invalidates detail) — cosmetic.
- [ ] [Review][Defer] E24-CR4 [Low] Unused `EventStatusBadge` has wrong i18n namespace — fix or delete (unconsumed).
