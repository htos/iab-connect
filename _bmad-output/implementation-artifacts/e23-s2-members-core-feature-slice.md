# Story E23.S2: Members Core — Feature-Slice Extraction (List / Detail / New / Edit)

Status: done

Depends on: **E23-S1 (characterization net green at HEAD)**. Inherits E21-S1 decisions (DEC-1 `useApiClient` contract, DEC-2 status colours), the E21-S3 pilot recipe, and the E22 RHF+Zod form sub-recipe. Blocks E23-S3 (reuses this slice's `api`/`types`) and E23-S4 (reuses conventions).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a refactoring engineer,
I want the four core Members pages extracted into `src/features/members/`,
so that the list/detail/new/edit surface follows the proven `suppliers`/`sponsors` slice shape without behaviour change.

## Acceptance Criteria

**Behaviour preserved (all relevant E23-S1 tests stay green; routes, auth gates, API contracts, and i18n keys unchanged):**

1. Routes `/members`, `/members/[id]`, `/members/[id]/edit`, `/members/new` keep their access rule (unauth → `/login`; non-`isVorstand`-and-non-`isAdmin` → `/`) and all `members.*` i18n texts behave exactly as before.
2. List: server-side search (`?search=`), status + type filtering, statistics cards, pagination (Prev/Next bounds), and **Admin-only** CSV export behave identically; the destructive delete flow's **outcome** is preserved (confirm → DELETE → list+statistics refresh; failure surfaced) — the mechanism migrates to a dialog per AC-9/DEC-3.
3. Detail: 404 not-found view; status-quick-change and type-quick-change (`PUT …/status`, `PUT …/type`) update the view from the response; **Admin-only** delete → redirect `/members`.
4. New/Edit: the load-bearing duplicate-detection (REQ-018) is preserved exactly — new = single pre-flight inside submit (fail-open); edit = 350 ms-debounced `AbortController` recheck with `excludeMemberId`; both hard-block Exact, gate Likely behind `confirmedProceed`, handle `409 + existingMemberId`; success → `router.push("/members")`; new has `membershipType`, edit does not.

**Improvements:**

5. `src/app/members/{page,[id]/page,[id]/edit/page,new/page}.tsx` become **thin server entries** (NOT `"use client"`), each rendering a `features/members` content component that is the single `"use client"` boundary.
6. A `features/members/` slice exists in the proven shape, mirroring `features/suppliers/`:
   - `api/members-api.ts` — `MEMBERS_BASE = "/api/v1/members"`, a `membersKeys` factory (`all` / `list(status, type, search, page)` / `detail(id)` / `statistics()`), and functions typed via `ReturnType<typeof useApiClient>` for list/detail/create/update/delete/status/type/statistics/CSV-export. **No raw `/api/v1/...` strings in components** (slice rule 5).
   - `hooks/` — `use-members` (`useQuery`, `enabled` mirrors `isAuthenticated && (isVorstand || isAdmin)`), `use-member` (detail `useQuery` with a `MemberNotFoundError` sentinel on 404), `use-member-statistics`, `use-create-member`, `use-update-member`, `use-delete-member` (`useMutation` + `invalidateQueries({ queryKey: membersKeys.all })`), and detail status/type mutations (`setQueryData(detail(id), …)` from the response, mirroring `use-supplier-detail-mutations`).
   - `components/` — `members-page-content` (single `"use client"`), `members-filter-bar`, `members-table`, `member-detail`, `member-new-content`, `member-edit-content`, `member-form` (shared new/edit, RHF+Zod), `member-status-badge`, `member-type-badge`, `delete-member-dialog`.
   - `schemas/member.schema.ts` — Zod (shared new+edit; behaviour-preserving — only the HTML5-`required` fields get `.min(1, "form.required")`, no new `.email()`/`.url()` constraints).
   - `types/member.types.ts` — relocated DTOs/enums.
7. **Adopt `useApiClient`** for the migrated surface (DEC-1 below): the legacy raw `fetch` + manual `Bearer` header in the four pages is replaced by the slice `api` module on the standard client contract (`{ data, error, status }`, never throws). This is a transport change with preserved behaviour — enumerate the A79 deltas (Task in DEC-1).
8. **Type relocation:** move the Member DTOs/enums/`GetMembersParams` from `frontend/src/lib/api/members.ts` into `features/members/types/member.types.ts`; **keep the duplicate-related types + the `findMemberDuplicates`/`getDuplicateGroups`/`dismissDuplicateCandidate`/`mergeMembers` functions in `lib/api/members.ts`** (S3 migrates the duplicates surface; new/edit still import `findMemberDuplicates` + `DuplicateCandidateDto` + `<DuplicateWarning>` from their current locations until S3). Re-export relocated types from `lib/api/members.ts` if needed to avoid breaking segments' `import { MembershipStatus, MembershipType } from "./members"` (S4 owns the segments repoint).
9. **Colour helpers → feature-local badges** (DEC-2 below): replace `getMembershipStatusColor`/`getMembershipTypeColor` (raw Tailwind in TS, numeric|string|enum input, 8 mappings) with `member-status-badge.tsx` + `member-type-badge.tsx`. Preserve the exact colour classes (A76 — colour IS the meaning); A77 — any value mapped to a named token is verified against the token's canonical value, not a comment; classes copied by identity are pinned by badge unit tests.
10. Forms use the **E22 RHF+Zod sub-recipe** (`schemas/member.schema.ts` + a shared `member-form.tsx`, `resolver: zodResolver`, error message keys, `pending`/`errorMessage` props), while preserving the duplicate-detection wiring around submit (AC-4). Keep the `DuplicateWarning` integration importing from its current path (S3 relocates it).
11. Quality: no new `any`; no new hard-coded user-facing strings; no raw API URL in any `page.tsx`; no duplicate UI primitive; `page.tsx` files are not client pages. `tsc` / eslint(changed) / prettier-check(changed) / `vitest run` green; `next build` succeeds; diff LF-clean (A73).

## Tasks / Subtasks

- [x] Task 0: Prereqs + DEC resolution + blast-radius spike (AC: all)
  - [x] E23-S1 net green on HEAD; on `refactor/frontend-feature-slice`.
  - [x] DECs auto-resolved per A41/A32 (autonomous "ohne stop" directive) all to **Option A**: DEC-1 adopt `useApiClient`, DEC-2 feature-local badges, DEC-3 delete dialog, DEC-4 server-side search in the query key. See Completion Notes for the (a)/(b)/(c) reasoning + the DEC-1 raw-fetch exception + DEC-5 boundary-safe type relocation.
  - [x] A62 blast-radius grepped: consumers of `@/lib/api/members` = the 4 core pages (S2), duplicates page + `components/members/*` (S3), `lib/api/member-segments.ts` enums (S4), new/edit `findMemberDuplicates`, AND **`app/profile/page.tsx`** (out-of-epic: uses `MemberDto` + the colour/translation-key helpers). Conclusion: `lib/api/members.ts` left UNCHANGED (canonical), the slice re-exports from it.
- [x] Task 1: `api/members-api.ts` + `types/member.types.ts` (AC: 6, 7, 8)
  - [x] `types/member.types.ts` is the slice's type surface, RE-EXPORTING the DTOs/enums from `@/lib/api/members` (DEC-5: the E21-S5 ESLint boundary forbids `lib → features`, and profile/segments/duplicates still import from lib — so the canonical defs stay in lib, the slice re-exports; `features → lib` is legal).
  - [x] `MEMBERS_BASE` + `membersKeys` factory (`all`/`list(status,type,search,page)`/`detail(id)`/`statistics()`) + `useApiClient`-typed fns: `fetchMembers`, `fetchMember`, `fetchStatistics`, `deleteMember`, `updateMemberStatus`, `updateMemberType`, `exportMembersCsv` (Blob). `createMember`/`updateMember` stay raw-fetch (DEC-1 exception, 409 body) + `MemberConflictError`/`MemberSaveError`. All URLs live here only.
- [x] Task 2: Hooks (AC: 6, 7)
  - [x] `use-members`, `use-member` (+ `MemberNotFoundError` on 404), `use-member-statistics` (swallows error → null, god-page optional-statistics behaviour), `use-create-member`, `use-update-member`, `use-delete-member` (invalidate `all`), `use-member-detail-mutations` (`changeStatus`/`changeType` via `setQueryData(detail(id))`).
- [x] Task 3: Badges (AC: 9)
  - [x] `member-status-badge.tsx` + `member-type-badge.tsx` per DEC-2 (exact verbatim classes, numeric|string|enum + gray fallback, `sm`/`md` size variants for list vs detail); `.test.tsx` mapping assertions (A77) — 21 tests.
- [x] Task 4: List surface (AC: 1, 2, 5)
  - [x] `members-filter-bar`, `members-table` (`isAdmin` gates CSV export + delete trigger), `delete-member-dialog` (alert-dialog + destructive + pending, DEC-3), `members-page-content` (only `"use client"`; auth redirect + `enabled` gate; statistics cards; pagination; server-side search DEC-4; delete-error precedence + `reset()` on filter/search — E21 P3; error-banner retry preserved; CSV export with its own error surface). Thin `app/members/page.tsx`. (subagent-authored, orchestrator-verified)
- [x] Task 5: Detail surface (AC: 1, 3, 5)
  - [x] `member-detail` (`"use client"`; not-found via `MemberNotFoundError`; status/type quick-change via `setQueryData` mutations with `alert()` on error preserved; admin-only delete → dialog → `/members`; full-page error view). Thin `app/members/[id]/page.tsx`. (subagent-authored, orchestrator-verified)
- [x] Task 6: New + Edit forms (AC: 1, 4, 5, 10)
  - [x] `schemas/member.schema.ts` (behaviour-preserving Zod), `member-form.tsx` (shared; `membershipType` shown only in create; reports field changes via `onWatch`), `member-new-content` (pre-flight fail-open) + `member-edit-content` (350ms-debounced AbortController re-check with `excludeMemberId`). REQ-018 preserved EXACTLY: Exact hard-block, Likely `confirmedProceed`, `409+existingMemberId` synthesis via `MemberConflictError`. `<DuplicateWarning>` import path unchanged (S3 relocates). Thin `app/members/new/page.tsx` + `app/members/[id]/edit/page.tsx`.
- [x] Task 7: Keep behaviour green + quality gate (AC: 1-4, 11)
  - [x] S1 delete-mechanism assertions updated to the dialog (licensed A79 delta) on list+detail; core S1 transport assertions repointed `fetch` → `useApiClient` (new kept raw-fetch create; edit GET → `useMember`, PUT raw-fetch). Added badge unit tests. Members suite **136 green** (list 24, detail 14, new 9, edit 10, badges 21, + S1 duplicates/segments 58 untouched).
  - [x] `tsc --noEmit` clean; eslint(changed) clean (the 2 `set-state-in-effect` errors are PRE-EXISTING in the unmodified `segments/page.tsx` — S4 territory, A58/A72 changed-files gate); prettier-check clean; **full frontend suite 470 green**; `next build` succeeds; LF.

## Dev Notes

The four core Members pages are **legacy god-pages** — `"use client"` route files doing raw `fetch()` + `useState`/`useEffect`/`useRef` + manual `Bearer` header + manual `useState` forms + `confirm()`/`alert()`. This is the most involved E23 story: a behaviour-preserving rewrite onto the established slice patterns, not a relocation. Reuse the suppliers slice as the literal template and the E22 RHF+Zod recipe for the forms.

### Scope Boundaries

- In scope: the 4 core pages → `features/members/*`; the type relocation; feature-local badges; the delete dialog; the RHF+Zod forms.
- Out of scope: the duplicates page + `components/members/*` relocation (S3); the segments pages (S4); the `<DuplicateWarning>` relocation (S3); backend/route changes; route-group moves; global token sweep; `hi.json` work (members hi stays a tolerated subset; only add keys to en+de in lockstep if any are introduced — none expected).

### Architecture Guardrails

- Behaviour-preserving — the E23-S1 net is the contract. The transport change (raw `fetch` → `useApiClient`) and the form change (manual → RHF+Zod) are the sanctioned improvements; the delete-mechanism change (confirm/alert → dialog) is the single licensed S1-test update.
- `useApiClient` returns `{ data, error, status }` and **never throws** (`lib/auth.ts`); hooks unwrap `error` by throwing inside `queryFn`/`mutationFn` so TanStack error states fire (the suppliers pattern).
- Reuse `components/ui/{alert-dialog,button}.tsx`; `buttonVariants({ variant: "destructive" })` on the delete confirm; do NOT hand-roll an overlay; do NOT regress the confirm to primary (E21 P2).
- Detail mutations use `setQueryData` (response updates the view, no extra GET) — the current god-page already replaces state from the response, so this is faithful.
- DoD per A58/A72/A73 (changed-files gate; `prettier --write` only on NEW files; LF).

### Decision-Needed

- **DEC-1 (transport: adopt `useApiClient`).** The core pages use raw `fetch` + `process.env.NEXT_PUBLIC_API_URL` + manual `Bearer`; the slice standard (E21-S1 DEC-1) is `useApiClient`.
  - **Option A (recommended):** migrate the 4 pages onto `useApiClient` via `api/members-api.ts` (matches suppliers/sponsors; one transport for the whole frontend; gets 401-refresh + base-URL handling for free). A79 deltas to record: TanStack `retry:1` (provider default) retries before surfacing; `isLoading` false on same-key refetch (no spinner during refetch-after-mutation); mutation error is sticky until `reset()`/next `mutate`. Preserve the page-reset-on-filter and the three distinct failure surfaces (list inline banner, CSV inline banner, delete dialog/banner) deliberately — do NOT homogenize.
  - Option B: keep raw `fetch` inside slice fns — rejected (diverges from the whole-program contract; loses the client's auth handling).
  - Resolve per A41/A32 + A43.
- **DEC-2 (colour helpers → badges).** Two dimensions (status + type), 4 values each, numeric|string|enum input, gray fallback — 8 mappings. Only 4 generic `Badge` variants exist; the existing colours are semantic (green=Active, red=Suspended, etc.).
  - **Option A (recommended):** two feature-local components (`member-status-badge`, `member-type-badge`) encapsulating the exact Tailwind classes in one place each, documented as an intentional semantic-colour exception (like `sponsor-tier-badge`, E22-DEC-1), preserving visuals exactly (no regression), handling all input forms. Pinned by badge unit tests (A77).
  - Option B: map onto the 4 `Badge` variants — mislabels colours (visual regression the A76 class warns about). Rejected.
  - Option C: bake 8 variants into `ui/badge.tsx` — couples the shared primitive to member concepts (violates the E21 rule). Rejected.
- **DEC-3 (delete UX).** The list/detail use `confirm()`→`alert()`.
  - **Option A (recommended):** replace with `delete-member-dialog` (alert-dialog + destructive confirm) + error precedence/`reset()`, matching the slice standard; the S1 delete-mechanism assertions are updated as the licensed A79 delta (outcome preserved). 
  - Option B: keep `confirm()`/`alert()` — rejected (diverges from the slice; the whole point of the migration).
- **DEC-4 (server-side search semantics).** Current list search is **server-side** (`?search=`) and refetches on every keystroke (searchTerm in effect deps) plus resets page on submit — unlike the suppliers slice's client-side search.
  - **Option A (recommended):** preserve server-side search by including `search` (and `page`, `status`, `type`) in `membersKeys.list(...)` so TanStack refetches as the term changes; keep submit's `page=1` reset. Behaviour-preserving. Optionally note a debounce as deferred polish (do NOT add it here — that would change timing the S1 net pins).
  - Option B: switch to client-side search — changes the API call pattern + result set semantics (server paginates); rejected as a behaviour change.

### Testing Requirements

- All non-delete E23-S1 core tests green post-refactor; delete-mechanism tests updated to the dialog (A79). Add `member-status-badge.test.tsx` + `member-type-badge.test.tsx` (mapping, A77), and hook/schema units as useful. The S1 `QueryClientProvider` seam means no harness rework.

### Project Structure Notes

- Target tree: `features/members/{api/members-api.ts, hooks/use-*.ts, components/{members-page-content,members-filter-bar,members-table,member-detail,member-new-content,member-edit-content,member-form,member-status-badge,member-type-badge,delete-member-dialog}.tsx, schemas/member.schema.ts, types/member.types.ts}`; 4 thin `app/members/*` entries. Import direction stays legal: `app → features → lib/types`.

### References

- Template: `frontend/src/features/suppliers/**` (api/hooks/components/schemas/types; `use-supplier.ts` 404 sentinel; `use-supplier-detail-mutations.ts` `setQueryData`; `delete-supplier-dialog.tsx` destructive; `supplier-form.tsx` + `supplier.schema.ts` RHF+Zod) and `frontend/src/features/sponsors/**` (`sponsor-tier-badge.tsx` feature-local-colour precedent).
- Current pages: `frontend/src/app/members/page.tsx` (list, 489 lines; auth :115-125; admin :223,:439; delete :174-194; CSV :144-167; pagination :460-482; colour use :406-412), `…/[id]/page.tsx` (detail, 374; PUT :91-132; delete :140-160), `…/[id]/edit/page.tsx` (448; dup recheck :111-158; submit :160-210), `…/new/page.tsx` (373; submit :60-131; `membershipType` select :335-347).
- `frontend/src/lib/api/members.ts` (438 lines; colour helpers `getMembershipStatusColor` :165-189 + `getMembershipTypeColor` :413-437 — copy classes verbatim; DTOs/enums :13-98; duplicate fns/types :191-411 STAY for S3).
- `frontend/src/components/members/DuplicateWarning.tsx` (imported by new/edit; relocated in S3 — leave path unchanged here).
- `frontend/src/lib/auth.ts` (`useApiClient` contract); `frontend/src/components/ui/{alert-dialog,button,badge}.tsx`.
- project-context.md A56/A58/A62/A64/A72/A73/A76/A77/A78/A79; `docs/architecture-frontend.md` Pilot Result Note; E22-S2/S3 stories (RHF+Zod recipe, tier-badge DEC).

## Validation Notes

- Created 2026-06-07. Status ready-for-dev. Depends on E23-S1 green. The four DECs (transport, badges, delete UX, search semantics) carry recommended options for A41/A32 + A43. Largest E23 story — a behaviour-preserving rewrite of legacy god-pages, not a relocation.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story; orchestrator built the shared foundation + new/edit surface, 2 parallel general-purpose subagents migrated the list + detail surfaces; all verified centrally).

### Debug Log References

- DEC-1 (a)/(b)/(c): (a) options = adopt `useApiClient` vs keep raw `fetch`; (b) chose useApiClient (Option A) — whole-frontend single transport, 401-refresh + base-URL for free; (c) **exception**: `createMember`/`updateMember` stay raw-fetch because the 409 ProblemDetails body carries `existingMemberId`/`error` that the shared `{data,error,status}` contract discards, and the S1-pinned REQ-018 409-synthesis REQUIRES that body. URLs stay centralized in `members-api.ts` (no raw URL in components).
- DEC-2/3/4 → Option A (feature-local badges / delete dialog / server-side search in the query key). Autonomous "ohne stop" directive ⇒ A41 auto-resolve, no AskUserQuestion.
- DEC-5 (NEW, boundary-forced): AC-8 says move DTOs into the slice + re-export FROM lib. The E21-S5 ESLint boundary forbids `lib → features`, and `app/profile` (out of epic) + segments + duplicate components still import member types from `@/lib/api/members`. Resolution: canonical defs stay in `lib/api/members.ts` (UNCHANGED), `features/members/types/member.types.ts` re-exports them as the slice surface (`features → lib` legal). Inverts AC-8's literal direction; satisfies its no-breakage intent + the boundary.
- Bug found & fixed mid-dev: the form's `onWatch` effect re-fired every render because `handleWatch` was a fresh closure each render (A64/A78) → cleared just-set duplicate candidates → new/Exact tests failed. Fixed by `useCallback` (new reads latest candidates via a ref). Also moved the `useCallback`s above the early returns (rules-of-hooks).
- `tsc` initially flagged the duplicates S1 spec's `pagedResult` helper missing `hasNextPage`/`hasPreviousPage` (fixed in S1 wrap-up).

### Completion Notes List

Behaviour-preserving rewrite of the 4 core Members god-pages onto the proven slice pattern. The E23-S1 net is the contract: all S1 behavioural assertions preserved; only the transport (raw `fetch` → `useApiClient`, with the documented create/update exception) and the delete mechanism (`confirm()`/`alert()` → `delete-member-dialog`, the licensed A79 delta on list+detail) changed; status/type quick-change keeps its `alert()` on error (NOT licensed to change).

Slice created under `features/members/`: `types` (re-export surface), `api/members-api.ts` (all URLs + `membersKeys` + `MemberConflictError`/`MemberSaveError`), 7 hooks (TanStack; `useMember` 404 sentinel; detail mutations via `setQueryData`; statistics swallow-error-to-null), feature-local `member-status-badge`/`member-type-badge` (verbatim colour classes, A77 tests), `delete-member-dialog`, `members-filter-bar`/`members-table`/`members-page-content`, `member-detail`, shared RHF+Zod `member-form` + `member-new-content`/`member-edit-content`. The 4 `app/members/*` route files are now thin server entries (no `"use client"`). Import direction legal (`app → features → lib/types`); intra-slice imports are relative (boundary rule).

New i18n key `members.confirmDeleteTitle` added to en + de in lockstep (dialog title); hi left a tolerated subset (epic scope note).

Gates: members suite 136 green; full frontend suite **470 green**; `tsc --noEmit` clean; eslint(changed) clean; prettier-check clean; `next build` succeeds. The only eslint errors in `src/app/members` are 2 PRE-EXISTING `react-hooks/set-state-in-effect` in the unmodified `segments/page.tsx` (verified present at HEAD) — S4 fixes them when it migrates segments.

### File List

New (slice):
- `frontend/src/features/members/types/member.types.ts`
- `frontend/src/features/members/api/members-api.ts`
- `frontend/src/features/members/hooks/use-members.ts`
- `frontend/src/features/members/hooks/use-member.ts`
- `frontend/src/features/members/hooks/use-member-statistics.ts`
- `frontend/src/features/members/hooks/use-delete-member.ts`
- `frontend/src/features/members/hooks/use-member-detail-mutations.ts`
- `frontend/src/features/members/hooks/use-create-member.ts`
- `frontend/src/features/members/hooks/use-update-member.ts`
- `frontend/src/features/members/schemas/member.schema.ts`
- `frontend/src/features/members/components/member-status-badge.tsx` (+ `.test.tsx`)
- `frontend/src/features/members/components/member-type-badge.tsx` (+ `.test.tsx`)
- `frontend/src/features/members/components/delete-member-dialog.tsx`
- `frontend/src/features/members/components/members-filter-bar.tsx`
- `frontend/src/features/members/components/members-table.tsx`
- `frontend/src/features/members/components/members-page-content.tsx`
- `frontend/src/features/members/components/member-detail.tsx`
- `frontend/src/features/members/components/member-form.tsx`
- `frontend/src/features/members/components/member-new-content.tsx`
- `frontend/src/features/members/components/member-edit-content.tsx`

Modified:
- `frontend/src/app/members/page.tsx` (→ thin entry) + `page.test.tsx` (transport repoint, +dialog)
- `frontend/src/app/members/[id]/page.tsx` (→ thin) + `page.test.tsx` (transport repoint, +dialog)
- `frontend/src/app/members/[id]/edit/page.tsx` (→ thin) + `edit/page.test.tsx` (GET→useApiClient, PUT raw-fetch)
- `frontend/src/app/members/new/page.tsx` (→ thin) — `new/page.test.tsx` unchanged (still green)
- `frontend/messages/en.json`, `frontend/messages/de.json` (+`members.confirmDeleteTitle`)

Unchanged (deliberately): `frontend/src/lib/api/members.ts` (canonical types/enums/helpers/duplicate fns — re-exported by the slice).

## Change Log

- 2026-06-07: Story created (core Members slice: list/detail/new/edit → `features/members/`; DEC-1 transport / DEC-2 badges / DEC-3 delete / DEC-4 search recorded). Status ready-for-dev.
- 2026-06-07: Implemented — 4 core pages migrated to `features/members/`; DECs auto-resolved Option A + DEC-1 raw-fetch create/update exception + DEC-5 boundary-safe type re-export. 136 members / 470 full tests green; tsc/eslint/prettier clean; next build succeeds. Status → review.
- 2026-06-07: Epic-23 boundary review applied 2 patches to this story's surface — CR-P1 (`member-detail` error guard → `queryError && !member`, preserve cached member on transient refetch error) + CR-P3 (`member-new/edit-content` send raw `phone`/`country` `""` not `|| undefined`). 147 members tests green post-patch. See `epic-23-boundary-review-2026-06-07.md`.
