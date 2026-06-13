# Story E23.S4: Member Segments — CRUD Feature-Slice

Status: done

Depends on: **E23-S1 (net green)** + **E23-S2 (`features/members/` conventions + the member enums/types)**. Inherits E21-S1 decisions, the E21-S3 pilot recipe, and the E22 RHF+Zod form sub-recipe. Final E23 story — completes the Members slice.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer,
I want the four Member Segments pages extracted into the Members slice,
so that the segments CRUD sub-domain follows the standard slice shape without behaviour change.

## Acceptance Criteria

**Behaviour preserved (all E23-S1 segments tests stay green; routes, auth gates, API contracts, i18n keys unchanged):**

1. Routes `/members/segments`, `/members/segments/new`, `/members/segments/[id]`, `/members/segments/[id]/edit` keep their access rule (unauth → `/login`; non-`isVorstand`-and-non-`isAdmin` → `/`) and all top-level `segments.*` i18n texts behave exactly as before.
2. List: search (Enter), `typeFilter` (all/Static/Dynamic) and `activeFilter` (all/true/false) changes reset page + refetch; the segment colour avatar/badges, member count, pagination, CSV export, and the **inline two-step delete** (`deletingId` → confirm/cancel, Admin-only — NOT `confirm()`/`alert()`) behave identically (A76 destructive lifecycle).
3. New/Edit: create submit → redirect `/members/segments`; edit submit → redirect `/members/segments/{id}`; segment **type is read-only on edit** (`segments.typeNotEditable`); `isActive` checkbox exists only on edit; the Dynamic-criteria builder (status/type chips, memberSince from/to, city/country) + the preview (`POST …/preview`) render only when `segmentType === Dynamic`.
4. Detail: `refreshKey` refetch after add/remove member; the member typeahead (debounced, min-2-char, outside-click-close) calling `GET /api/v1/members?search=…` (cross-feature); add member (`POST …/members`), remove member (inline confirm, Static-only), CSV export, and the not-found state behave identically.

**Improvements:**

5. Extract a `segments` sub-area under `features/members/` mirroring the slice shape: `api/member-segments-api.ts` (`MEMBER_SEGMENTS_BASE = "/api/v1/member-segments"` + a `segmentKeys` factory + `useApiClient`-typed fns for list/detail/create/update/delete/preview/members-list/add-member/remove-member/export — **all URLs encapsulated here**; the current `lib/api/member-segments.ts` is types-and-helpers only, so these fns are net-new extractions of the pages' inline URLs), `hooks/use-segment*.ts`, `components/segment-*.tsx`, `schemas/segment.schema.ts`, segment types.
6. New/Edit segment forms use the **E22 RHF+Zod sub-recipe** via a **single shared `segment-form.tsx`** (the two pages are byte-for-byte duplicated today) with a `mode: "create" | "edit"` prop (edit adds `isActive` + read-only type); behaviour-preserving Zod (only the HTML5-`required` `name` field gets `.min(1, "form.required")`); mutation-invalidation + list invalidation on success.
7. Align `frontend/src/lib/api/member-segments.ts` to the standard api contract: relocate `SegmentType`/`MemberSegmentDto`/`SegmentMemberDto`/`SegmentCriteria`/`Create*`/`Update*`/`PreviewResult`/`SEGMENT_COLORS`/`getSegmentColorClasses` into the slice `types`/api, **preserving the `import { MembershipStatus, MembershipType } from "./members"` cross-feature coupling** (now sourced from S2's `features/members/types/member.types.ts` re-export); the detail typeahead keeps calling the members list endpoint via the members `api` (no duplicated URL builder).
8. Quality: no new `any`; no new hard-coded strings; no raw API URL in any `page.tsx`; no duplicate UI primitive; `page.tsx` files not client pages. `tsc` / eslint(changed) / prettier-check(changed) / `vitest run` green; `next build` succeeds; diff LF-clean (A73).

## Tasks / Subtasks

- [x] Task 0: Prereqs + DEC resolution (AC: all)
  - [x] E23-S1 segments suite green; E23-S2 member-enums source verified (`features/members/types/member.types.ts`); `@/lib/api/member-segments` confirmed consumed ONLY by the 4 segments pages.
  - [x] DECs auto-resolved (autonomous): DEC-1=A (sub-area under `features/members/`), DEC-2=A (PRESERVE inline two-step delete — no dialog), DEC-3=A (TanStack + `invalidateQueries`).
- [x] Task 1: `api/member-segments-api.ts` + segment `types` (AC: 5, 7)
  - [x] `MEMBER_SEGMENTS_BASE` + `segmentKeys` + `useApiClient`-typed fns (list/detail/members-list/create/update/delete/preview/add-member/remove-member/export Blob) — every inline URL extracted. Types relocated to `types/member-segment.types.ts` (member enums via `./member.types`); `lib/api/member-segments.ts` DELETED (grep-clean). Detail typeahead reuses members `api` via a new `searchMembers` fn (no duplicated `/api/v1/members` URL).
- [x] Task 2: Hooks (AC: 5, 6)
  - [x] 9 hooks: `use-segments`, `use-segment` (+ `SegmentNotFoundError`), `use-segment-members`, `use-create-segment`/`use-update-segment`/`use-delete-segment`, `use-add-segment-member`/`use-remove-segment-member` (invalidate detail+members), `use-segment-preview`. TanStack + invalidation (replaces `refreshKey`).
- [x] Task 3: List + Detail surfaces (AC: 1, 2, 4)
  - [x] `segments-list-content` (search-Enter/type/active filters reset page; colour avatar; pagination; CSV; inline two-step delete Admin-only, DEC-2). `segment-detail-content` (debounced min-2-char outside-click typeahead; add/remove; CSV; not-found; remove-confirm Static-only). Thin `app/members/segments/page.tsx` + `[id]/page.tsx`.
- [x] Task 4: New + Edit forms (AC: 3, 6)
  - [x] `schemas/segment.schema.ts` (only `name` required), shared `segment-form.tsx` (`mode` prop; de-duplicated Dynamic-criteria builder + preview; colour picker; edit-only `isActive` + read-only type via `segments.typeNotEditable`), `segment-new-content` (→`/members/segments`) + `segment-edit-content` (→`/members/segments/{id}`). Thin `new/page.tsx` + `[id]/edit/page.tsx`.
- [x] Task 5: Keep behaviour green + quality gate (AC: 1-4, 8)
  - [x] E23-S1 segments suite (44 tests, 4 files) green UNCHANGED (DEC-2 = no delete-mechanism change). Added `segment-form.test.tsx` (6). Members+slice **147 green**; full frontend **481 green**.
  - [x] `tsc` clean; `eslint src/app/members src/features/members` **0 errors/0 warnings** (the 2 pre-existing `set-state-in-effect` errors ELIMINATED by the TanStack migration); prettier-check clean; `next build` succeeds; LF.

## Dev Notes

The segments pages already use `useApiClient` (unlike the core god-pages), so the transport is half-done; the work is extracting the inline URLs into `api/member-segments-api.ts`, adopting TanStack hooks (preserving the `refreshKey`/manual-refetch outcomes), de-duplicating the two forms onto the E22 RHF+Zod recipe, and relocating the types. `lib/api/member-segments.ts` is types-and-helpers only today (no fetch fns) — so the api module is a net-new extraction, not a relocation of existing fns.

### Scope Boundaries

- In scope: the 4 segments pages → `features/members/` segments sub-area; the shared `segment-form`; the api/types relocation; preserving the cross-feature member-enums import + the members-list typeahead call.
- Out of scope: backend/route changes; the core/duplicates surfaces (S2/S3); changing the segment endpoints or the criteria JSON shape; `hi.json` work (`segments.*` hi stays a tolerated subset; add new keys to en+de in lockstep only if introduced — none expected).

### Architecture Guardrails

- **i18n namespace is top-level `segments.*` (57 keys), NOT `members.segments.*`** — do not move keys under `members.`; the parity test enforces de==en and tolerates the hi subset (`messages.parity.test.ts`). Reuse existing keys.
- Behaviour-preserving — the E23-S1 segments net is the contract. Preserve: the three list filters resetting page, the inline two-step delete outcome, the read-only type on edit + `isActive` only on edit, the detail typeahead debounce/outside-click, the `refreshKey`-driven refetch after add/remove (now via `invalidateQueries`).
- The two forms are byte-for-byte duplicated — the shared `segment-form.tsx` with a `mode` prop is the de-dup target (suppliers has one `supplier-form.tsx`); the edit-only `isActive` + read-only type are the only deltas.
- Cross-feature coupling to preserve (A62): `SegmentMemberDto` references `MembershipStatus`/`MembershipType` (imported from the members domain — now S2's types); the detail typeahead calls the members list endpoint (reuse the members `api`, don't duplicate the URL).
- DoD per A58/A72/A73.

### Decision-Needed

- **DEC-1 (sub-area placement).** Where the segments slice lives.
  - **Option A (recommended):** a `segments` sub-area UNDER `features/members/` (`features/members/{api/member-segments-api.ts, hooks/use-segment*.ts, components/segment-*.tsx, schemas/segment.schema.ts}`), per the epic skeleton, sharing `types/member.types.ts` for the member enums. Keeps the member domain cohesive.
  - Option B: a separate `features/member-segments/` slice — rejected (the cross-feature member-enums coupling + the members-list typeahead make a sibling slice import-heavier; the epic scopes segments under the Members slice).
- **DEC-2 (delete UX).** Both list + detail use an **inline two-step `deletingId`/`deleting` confirm** (not `confirm()`/`alert()`).
  - **Option A (recommended):** preserve the inline two-step delete as-is (it's already a non-blocking, accessible pattern — no native dialogs to migrate; behaviour-preserving, lowest risk). Record as residual debt that the slice-standard `delete-*-dialog` (alert-dialog) was NOT adopted here to avoid changing a working interaction.
  - Option B: migrate to `delete-segment-dialog` (alert-dialog + destructive) to match S2 — defer; it changes a working UX the S1 net pins (the licensed A79 update would apply, but the inline pattern is fine and lower-risk).
- **DEC-3 (transport).** Pages already use `useApiClient` but with manual `useState`/`useEffect`/`refreshKey`.
  - **Option A (recommended):** adopt TanStack `useQuery`/`useMutation` + `invalidateQueries` (replacing `refreshKey`), preserving outcomes; same A79 deltas as S2-DEC-1 (retry/spinner/sticky-error) — record them.
  - Option B: keep manual `useState`/`refreshKey` inside extracted hooks — rejected (diverges from the slice standard; the whole-program goal is TanStack adoption).

### Testing Requirements

- E23-S1 segments suite green post-refactor (delete-mechanism assertion updated only if DEC-2 picks the dialog). Add a `segment-form.test.tsx` (RHF+Zod required-field block, A79) and a criteria JSON (de)serialisation unit test. The S1 `QueryClientProvider` seam means no harness rework.

### Project Structure Notes

- Target tree adds (under `features/members/`): `api/member-segments-api.ts`; `hooks/use-segments.ts`, `use-segment.ts`, `use-segment-members.ts`, `use-create-segment.ts`, `use-update-segment.ts`, `use-delete-segment.ts`, `use-add-segment-member.ts`, `use-remove-segment-member.ts`, `use-segment-preview.ts`; `components/{segments-list-content,segment-detail-content,segment-new-content,segment-edit-content,segment-form,segment-type-badge}.tsx`; `schemas/segment.schema.ts`; segment types in `types/`. Four thin `app/members/segments/*` entries.

### References

- Current pages: `frontend/src/app/members/segments/page.tsx` (377 lines; auth :70-83; filters; inline delete :312-339; export :108), `…/new/page.tsx` (422; submit :97-117; Dynamic criteria :237-399), `…/[id]/page.tsx` (606, largest; `refreshKey` :62; typeahead :152-187; add :136-139 / remove :191-193; delete :123-131; export :204-206), `…/[id]/edit/page.tsx` (478; read-only type :242-253; `isActive` :277-290; submit :147-170 — criteria block duplicated from new).
- `frontend/src/lib/api/member-segments.ts` (94 lines; types-and-helpers only; `SegmentType` :9, `MemberSegmentDto` :15, `SegmentMemberDto` :27 references member enums :32-33, `getSegmentColorClasses` :81; **`import { MembershipStatus, MembershipType } from "./members"` :6**).
- Template: `frontend/src/features/suppliers/**` (`supplier-form.tsx` + `supplier.schema.ts` shared-form recipe; hooks; api factory).
- `frontend/messages/{en,de}.json` `segments.*` (57 keys each; hi = 0, tolerated); `frontend/messages/messages.parity.test.ts`.
- E23-S2 `features/members/types/member.types.ts` (member enums source); project-context.md A56/A58/A62/A64/A72/A73/A76/A79.

## Validation Notes

- Created 2026-06-07. Status ready-for-dev. Depends on E23-S1 + E23-S2. Final E23 story. Load-bearing A56 findings: segments already use `useApiClient` (transport half-done); the api module is types-only so fns are net-new; the two forms are byte-duplicated (shared-form de-dup target); the i18n namespace is top-level `segments.*`. DEC-1/2/3 carry recommended options for A41/A32 + A43.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story; delegated to a general-purpose subagent with full context, orchestrator-verified centrally).

### Debug Log References

- DECs → Option A across the board (autonomous). DEC-2 residual debt recorded (inline two-step delete preserved, no alert-dialog). DEC-3 TanStack migration also fixed the 2 pre-existing `set-state-in-effect` eslint errors in the segments list page.
- Central verification: `grep @/lib/api/member-segments src` → 0 hits (module deleted); `tsc --noEmit` clean; `eslint src/app/members src/features/members` → 0 errors/0 warnings; full frontend suite **481 green**; `next build` succeeds (74 pages).

### Completion Notes List

Behaviour-preserving extraction of the 4 segments pages into a `segments` sub-area under `features/members/`. Segments already used `useApiClient`, so the work was: extract the inline URLs into `api/member-segments-api.ts` (+ `segmentKeys`), relocate the types/helpers out of `lib/api/member-segments.ts` into `types/member-segment.types.ts` (member enums via `./member.types`) and delete the lib module, adopt 9 TanStack hooks (`refreshKey` → `invalidateQueries`), and de-duplicate the byte-identical new/edit forms onto one shared RHF+Zod `segment-form.tsx` (`mode` prop; edit-only `isActive` + read-only type; Dynamic-criteria builder + preview gated on type). The 4 S1 segments specs stayed green UNCHANGED (DEC-2 preserved the inline delete; endpoints/payloads unchanged). Cross-feature couplings preserved: `SegmentMemberDto` uses the member enums; the detail typeahead reuses the members `api` (`searchMembers`) rather than duplicating `/api/v1/members`.

Residual debt: (DEC-2) segments keep the inline two-step delete (slice-standard delete-dialog deliberately not adopted — preserve working UX over harmonising). Two preserved god-page quirks pinned: `useSegment` resolves null for both 404 and generic GET error (the detail page showed `segments.notFound` for both, never the error string); the detail data-load `enabled` is gated on auth-not-role, so GETs still fire for an unauthorized user before the redirect resolves.

### File List

New (under `frontend/src/features/members/`):
- `types/member-segment.types.ts`
- `api/member-segments-api.ts` (+ `searchMembers` added to `api/members-api.ts`)
- `hooks/use-segments.ts`, `use-segment.ts`, `use-segment-members.ts`, `use-create-segment.ts`, `use-update-segment.ts`, `use-delete-segment.ts`, `use-add-segment-member.ts`, `use-remove-segment-member.ts`, `use-segment-preview.ts`
- `components/segments-list-content.tsx`, `segment-detail-content.tsx`, `segment-form.tsx` (+ `segment-form.test.tsx`), `segment-new-content.tsx`, `segment-edit-content.tsx`
- `schemas/segment.schema.ts`

Modified: 4 thin entries `app/members/segments/{page,new/page,[id]/page,[id]/edit/page}.tsx`; `api/members-api.ts` (+`searchMembers`).
Deleted: `frontend/src/lib/api/member-segments.ts`.

## Change Log

- 2026-06-07: Story created (Member Segments CRUD sub-area under `features/members/`; shared RHF+Zod segment-form; DEC-1 placement / DEC-2 delete UX / DEC-3 transport). Status ready-for-dev.
- 2026-06-07: Implemented — 4 segments pages extracted to the slice (TanStack hooks, shared segment-form, types relocated, lib module deleted). 147 members/slice + 481 full tests green; tsc/eslint(0)/prettier/build clean; pre-existing set-state-in-effect errors fixed. Status → review.
- 2026-06-07: Epic-23 boundary review applied CR-P2 (`segment-edit-content` not-found guard — render `segments.notFound` instead of a blank editable form when the load fails). CR-D2 (useSegment/useSegmentMembers error surfacing) + CR-D3 (typeahead lost-update race) deferred as residual debt. See `epic-23-boundary-review-2026-06-07.md`.
