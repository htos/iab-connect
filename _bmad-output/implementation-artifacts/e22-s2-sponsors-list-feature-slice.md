# Story E22.S2: Sponsors List — Feature-Slice Extraction, Tier Badge, and `hi.json` Parity

Status: done

Depends on: E22-S1 (characterization tests green). Inherits E21-S1 decisions (DEC-1 client contract, DEC-2 status colours) and the E21-S3 pilot recipe.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the Sponsors list page refactored into the `src/features/sponsors/` feature-slice pattern,
so that it matches the proven Suppliers slice and validates the recipe on a second list page that carries an extra Tier dimension and a Vorstand-or-Admin auth rule.

## Acceptance Criteria

**Behaviour preserved (all E22-S1 list characterization tests stay green):**

1. Route `/sponsors`, `isVorstand || isAdmin` access (same redirects), sponsor load, server-side status filter, client-side search, loading/error/empty states, table, status badge, tier badge, detail link, edit link, **Admin-only** delete, delete dialog, delete action, delete-failure handling, list-refresh-after-delete, and all `sponsors.*` i18n texts behave exactly as before.

**Improvements:**

2. `src/app/sponsors/page.tsx` is a thin entry — NOT `"use client"` — rendering a `features/sponsors` content component (the single `"use client"` boundary).
3. A `features/sponsors/` slice exists, mirroring `features/suppliers/`:
   - `api/sponsors-api.ts` — `SPONSORS_BASE = "/api/v1/sponsors"`, a `sponsorsKeys` query-key factory (`all`/`list(status)`/`detail(id)`), and `fetchSponsors(api, status)` + `deleteSponsor(api, id)` typed via `ReturnType<typeof useApiClient>` (DEC-1). No raw `/api/v1/...` strings in components.
   - `hooks/use-sponsors.ts` — `useQuery` keyed by `sponsorsKeys.list(status)`, `enabled` mirroring the `isAuthenticated && (isVorstand || isAdmin)` gate so no GET fires for unauthorized users. `hooks/use-delete-sponsor.ts` — `useMutation` + `invalidateQueries({ queryKey: sponsorsKeys.all })`.
   - `components/` — `sponsors-page-content` (the only `"use client"`), `sponsors-filter-bar`, `sponsors-table`, `sponsor-status-badge`, `sponsor-tier-badge`, `delete-sponsor-dialog` (composes the EXISTING `components/ui/alert-dialog.tsx` with a pending/disabled confirm; confirm uses `buttonVariants({ variant: "destructive" })` — do NOT regress to the default primary variant, the E21 P2 lesson).
   - `types/sponsor.types.ts` — Sponsor-specific types.
4. **Type split** (E21 pilot pattern): move `SponsorStatus`, `SponsorTier`, `SponsorListDto`, `SponsorDetailDto`, `PackageDto`, `CreateSponsorRequest`, `UpdateSponsorRequest` to `features/sponsors/types/sponsor.types.ts`; **keep `ContractLinkType` + `ContractLinkDto` in `src/types/sponsors.ts`** (still imported by `features/suppliers/types/supplier.types.ts`). Repoint the 4 sponsors route pages' type imports; this story only repoints — the detail/new/edit page bodies migrate in E22-S3.
5. **Admin-only delete** is preserved in the slice: `sponsors-table` takes an `isAdmin` prop and renders the delete trigger only when true (the Suppliers table did not need this — Suppliers was admin-only for the whole page). The list itself stays visible to Vorstand.
6. **Status badge AND tier badge** are extracted as components; neither uses raw `bg-*` brand colour classes scattered in the page. Status badge mirrors `supplier-status-badge.tsx` (Badge variants per DEC-2). Tier badge per DEC-1 below. Any token/variant value is verified against the named token's canonical value, not a comment (A77).
7. `startTransition` around fetching is removed; the manual→TanStack deltas (A79) are decided and recorded: refetch-after-delete via `invalidateQueries`; the delete error takes precedence over a stale list error and is cleared via `deleteMutation.reset()` on filter/search change (the E21 P3 fix, already in `suppliers-page-content.tsx`).
8. `frontend/messages/hi.json` gains the full `sponsors.*` key set at parity with `en.json`/`de.json` (~52 keys incl. `status.{Prospect,Active,Paused,Ended}`), with real Hindi values (as E21-S4 did for suppliers). `frontend/messages/messages.parity.test.ts` stays green (it tolerates a hi SUBSET and forbids stray hi keys, so a full superset fill is safe); no key renames/removals in any locale.
9. Quality: no new `any`; no new hard-coded user-facing strings; no new direct API URL in `page.tsx`; no duplicate UI primitive; `page.tsx` is not a client page. `tsc`/eslint(changed)/prettier-check(changed)/`vitest run`/parity green; `next build` succeeds; diff is LF-clean (A73).

## Tasks / Subtasks

- [x] Task 0: Confirm prerequisites + type-split spike (AC: all)
  - [x] E22-S1 list suite green on HEAD; sponsors area clean; on `refactor/frontend-feature-slice`.
  - [x] Verified the type-split blast radius (A62/A65): importers of `@/types/sponsors` are the 4 sponsors pages (Sponsor-specific → repoint) + `features/suppliers/types/supplier.types.ts` (`ContractLinkDto` only → stays). Confirmed no other importer.
- [x] Task 1: `features/sponsors/api` + type split (AC: 3, 4)
  - [x] Created `types/sponsor.types.ts` (moved Sponsor-specific types); left `ContractLink*` in `src/types/sponsors.ts`; repointed the 4 page imports (list body fully migrated; detail/new/edit got import-path-only changes here — bodies migrate in S3). Also dropped a pre-existing unused `SponsorTier` import on `new/page.tsx`.
  - [x] Created `api/sponsors-api.ts` (mirror `suppliers-api.ts`: base URL, `sponsorsKeys`, `fetchSponsors`, `deleteSponsor`).
- [x] Task 2: TanStack hooks (AC: 3, 7)
  - [x] `use-sponsors(status, enabled)` (`useQuery`); `use-delete-sponsor()` (`useMutation` + invalidate `sponsorsKeys.all`). Mirror `use-suppliers.ts`/`use-delete-supplier.ts`.
- [x] Task 3: Components (AC: 2, 3, 5, 6, 7)
  - [x] `sponsor-status-badge` (clone `supplier-status-badge`; same 4-variant map; `t("sponsors.status.${status}")`).
  - [x] `sponsor-tier-badge` per DEC-1 resolution (Option A — feature-local, colours preserved verbatim).
  - [x] `sponsors-filter-bar`, `sponsors-table` (with `isAdmin` prop for the delete trigger), `delete-sponsor-dialog` (compose `ui/alert-dialog`, destructive confirm, pending state), `sponsors-page-content` (the only `"use client"`; inline `isVorstand || isAdmin` redirect kept verbatim; delete-error precedence + reset-on-filter/search).
- [x] Task 4: Thin the route file (AC: 2)
  - [x] `app/sponsors/page.tsx` → thin server entry rendering `<SponsorsPageContent />`; removed `"use client"`.
- [x] Task 5: i18n parity (AC: 8)
  - [x] Added the full `sponsors.*` tree (real Hindi, 49 leaf + 4 `status.*` = 53 keys) to `hi.json`; `messages.parity.test.ts` green. hi key count: before 0 sponsors keys → after 53 (text insertion, no full-file rewrite; LF preserved, A72/A73).
- [x] Task 6: Keep behaviour green + quality gate (AC: 1, 9)
  - [x] E22-S1 list suite green against the refactored page (17/17 — the S1 harness already had the `QueryClientProvider` seam; one fragile list-test selector hardened: it had matched the filter-bar `<option>` of the same text during loading, fixed to wait for the row first). Added `sponsor-status-badge.test.tsx` + `sponsor-tier-badge.test.tsx` (mapping assertions).
  - [x] `tsc`/eslint(changed)/prettier-check(new)/`vitest run`(300/300)/parity green; `next build` succeeds; diff LF-clean.

## Dev Notes

This is the recipe-validation half of E22: a near-1:1 application of the E21-S3 Suppliers pilot to the Sponsors list, plus three Sponsors-specific deltas (Tier badge, Vorstand-or-Admin + Admin-only-delete split, the `hi.json` gap). Reuse the suppliers slice as a literal template.

### Scope Boundaries

- In scope: `app/sponsors/page.tsx` (list only) → `features/sponsors/*`; the type split; `hi.json` sponsors parity; import-path-only repoint of the 3 sibling pages.
- Out of scope: the detail/new/edit page BODIES (E22-S3); route-group moves; navigation; global token sweep; backend; any `suppliers` change.

### Architecture Guardrails

- Behaviour-preserving refactor — the E22-S1 list suite is the contract. Preserve server-status-filter + client-search split, the `isVorstand || isAdmin` view gate, and the `isAdmin`-only delete.
- Mirror the proven suppliers files verbatim where possible; the only structural new piece is `sponsor-tier-badge` + the `isAdmin` prop on the table.
- Reuse `components/ui/alert-dialog.tsx` + `buttonVariants({ variant: "destructive" })`; do NOT hand-roll an overlay; do NOT regress the confirm to primary (E21 P2).
- Delete-error precedence + `deleteMutation.reset()` on filter/search (E21 P3) — copy the pattern from `suppliers-page-content.tsx:56,108-115`.
- DoD: `npm run typecheck` + changed-files eslint/prettier + `npm test -- --run`. NEVER `npm run format` (prettier-tailwind re-sorts repo-wide) and never repo-wide lint as the gate (A58/A72). `prettier --write` ONLY on the NEW feature files, never on pre-drifted modified files (A72).

### Decision-Needed

- **DEC-1 (Tier badge rendering).** Tier (Bronze/Silver/Gold/Platinum) is net-new vs the Suppliers pilot and is intrinsically colour-coded (currently `bg-amber-100`/`bg-gray-200`/`bg-yellow-100`/`bg-purple-100`). There are only 4 generic Badge variants (default/secondary/destructive/outline) and mapping tier onto them mislabels (e.g. Gold→`destructive`/red).
  - **Option A (recommended):** a feature-local `sponsor-tier-badge.tsx` that encapsulates the four tier colours in ONE place, documented as an intentional semantic-colour exception (tier colour IS the meaning, like a traffic-light), preserving the current visuals exactly (no regression) and de-scattering them. Status badge still uses Badge variants per DEC-2. Rationale: E21 rule "no domain coupling on the `ui` primitive" — tier is sponsor-specific, so it should NOT be baked into shared `ui/badge.tsx`.
  - Option B: extend `ui/badge.tsx` with 4 tier variants — couples the shared primitive to a sponsor concept (violates the E21 rule); rejected unless tiers prove cross-feature.
  - Option C: map tier onto the existing 4 variants — semantically wrong colours = a visual regression the S1 suite won't catch (A76 class). Rejected.
  - Resolve at dev-story per A41/A32 with the A43 (a)/(b)/(c) Debug Log. If autonomous-mode is not pre-declared, surface via AskUserQuestion.

### Testing Requirements

- All E22-S1 list tests green post-refactor. Add `sponsor-status-badge.test.tsx` + `sponsor-tier-badge.test.tsx` (mapping assertions, mirroring `supplier-status-badge.test.tsx`). A77: assert any token value against the named token's canonical value.

### Project Structure Notes

- Target tree: `features/sponsors/{api/sponsors-api.ts, hooks/use-sponsors.ts, hooks/use-delete-sponsor.ts, components/{sponsors-page-content,sponsors-filter-bar,sponsors-table,sponsor-status-badge,sponsor-tier-badge,delete-sponsor-dialog}.tsx, types/sponsor.types.ts}`; `app/sponsors/page.tsx` thin entry. Import direction stays legal: `app → features → types`.

### References

- `frontend/src/features/suppliers/**` — the literal template: `api/suppliers-api.ts`, `hooks/use-suppliers.ts`, `hooks/use-delete-supplier.ts`, `components/{suppliers-page-content,suppliers-filter-bar,suppliers-table,supplier-status-badge,delete-supplier-dialog}.tsx`, `components/supplier-status-badge.test.tsx`.
- `frontend/src/app/sponsors/page.tsx:1-262` (current god-page; access :15,:28-31; delete-admin :214; status badge :65-77; tier badge :79-91; overlay :233-259)
- `frontend/src/types/sponsors.ts` (split source; keep `ContractLinkType`/`ContractLinkDto` :5,:53-59)
- `frontend/src/components/ui/badge.tsx` (4 variants), `frontend/src/components/ui/alert-dialog.tsx`, `frontend/src/components/ui/button.tsx` (`buttonVariants`)
- `frontend/messages/{en,de}.json` `sponsors.*` (~52 keys incl. `status.*`); `frontend/messages/messages.parity.test.ts` (hi tolerates subset, forbids stray keys)
- `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)"; project-context.md A58/A72/A73/A76/A77/A78/A79; DEC-1/DEC-2 in `e21-s1-...md`

## Validation Notes

- Created 2026-06-07. Status ready-for-dev. Depends on E22-S1 green. Recipe-validation epic — expect a clean mirror of the suppliers slice plus the Tier-badge and i18n deltas.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous epic-wide dev-story run, E22 S1→S2→S3).

### Debug Log References

**DEC-1 (Tier badge rendering) — resolved A41/A43 (autonomous mode):**
- **(a) Option chosen:** Option A — a feature-local `sponsor-tier-badge.tsx` that encapsulates the four tier colours in ONE place.
- **(b) Rationale:** (1) story recommendation = Option A; (2) user pre-declared autonomous mode verbatim — *"das ganze epic umsetzen bis alle stories implementiert sind. nicht stoppen, danach werde ich eine review und eine retro durchführen"*; (3) the E21 architectural rule "no domain coupling on the shared `ui` primitive" — tier is a sponsor concept, so baking 4 tier variants into `ui/badge.tsx` (Option B) would violate it; mapping tier onto the 4 generic variants (Option C) would mislabel colours (e.g. Gold→destructive-red) — a visual regression the A76 class warns about.
- **(c) Consequence chain:** AC-6 tier-badge satisfied by the new component with the four colour classes copied VERBATIM from the original god-page `getTierBadge` (no visual regression, de-scattered); the status badge continues to use the shared `Badge` variants per E21-DEC-2; A77 token-value verification applies to the status badge path (the `--primary` token = `20.5 90.2% 48.2%` = orange-600 #ea580c, already correct since E21-S1 P1), while the tier classes are literal Tailwind utilities (a documented semantic-colour exception, no named-token to verify — copied by identity and pinned by `sponsor-tier-badge.test.tsx`).

**A79 manual→TanStack deltas — decided & preserved (list):**
- refetch-after-delete now via `useDeleteSponsor`'s `onSuccess → invalidateQueries({ queryKey: sponsorsKeys.all })` (replaces the manual `fetchSponsors()` call); `enabled: isAuthenticated && (isVorstand || isAdmin)` keeps the no-GET-for-unauthorized behaviour.
- delete-error precedence over a stale list error preserved (`deleteMutation.error?.message ?? error?.message`), cleared via `deleteMutation.reset()` on filter/search change (the E21 P3 fix, copied from `suppliers-page-content.tsx`).
- `startTransition` removed; the provider's production `retry: 1`, sticky-mutation-error, and no-spinner-on-refetch deltas are the global `Providers` defaults and are invisible to the `retry:false` test harness by design (recorded for S1/S2 awareness).

**Type-split blast radius (A62):** importers of `@/types/sponsors` confirmed = the 4 sponsors pages + `features/suppliers/types/supplier.types.ts` (only `ContractLinkDto`). The shared `ContractLinkType` + `ContractLinkDto` stay in `src/types/sponsors.ts`; everything else moved to `features/sponsors/types/sponsor.types.ts`.

**A72/A73 (the trap that bit mid-story):** an initial `prettier --write` on the three sibling route pages turned a 1-line import change into a 535/143/145-line whole-file reformat (the files were pre-drifted at HEAD). Reverted via `git checkout HEAD --`, then re-applied ONLY the multi-line import edit by hand (prettier-correct since the import exceeds 80 cols) — final sibling diffs are 5/5/2 lines. New feature files got `prettier --write` (legitimate — they are new, not pre-drifted). `hi.json` was edited by text-insertion (no full-file rewrite), LF preserved.

### Completion Notes List

- Extracted the Sponsors list page into `src/features/sponsors/` mirroring the E21-S3 Suppliers pilot, plus the three Sponsors-specific deltas (Tier badge, Vorstand-or-Admin view + Admin-only delete, `hi.json` parity).
- **AC-1 (behaviour preserved):** ✅ all 17 E22-S1 list characterization tests green against the refactored page.
- **AC-2 (thin entry):** ✅ `app/sponsors/page.tsx` is a 1-line server entry rendering `<SponsorsPageContent />`; NOT `"use client"`.
- **AC-3 (slice exists):** ✅ `api/sponsors-api.ts` (encapsulated URLs + `sponsorsKeys`), `hooks/use-sponsors.ts` + `use-delete-sponsor.ts`, `components/{sponsors-page-content,sponsors-filter-bar,sponsors-table,sponsor-status-badge,sponsor-tier-badge,delete-sponsor-dialog}.tsx`, `types/sponsor.types.ts`. No raw `/api/v1/...` in components.
- **AC-4 (type split):** ✅ Sponsor-specific types moved; `ContractLinkType`/`ContractLinkDto` kept in `src/types/sponsors.ts` (still imported by suppliers); 4 pages repointed.
- **AC-5 (admin-only delete):** ✅ `sponsors-table` takes `isAdmin` and renders the delete trigger only when true; the list stays visible to Vorstand.
- **AC-6 (badges extracted):** ✅ status badge (Badge variants, DEC-2) + tier badge (feature-local, DEC-1=A); no raw brand `bg-*` scattered in the page; A77 honoured.
- **AC-7 (TanStack deltas):** ✅ `startTransition` removed; `invalidateQueries` refetch; delete-error precedence + `reset()` on filter/search.
- **AC-8 (hi.json parity):** ✅ full `sponsors.*` tree (53 keys, real Hindi incl. `status.{Prospect,Active,Paused,Ended}`) added to `hi.json`; `messages.parity.test.ts` green (de==en identical; hi a valid subset/superset with no stray keys); no key renames/removals.
- **AC-9 (quality):** ✅ no new `any`; no new hard-coded strings; no direct API URL in `page.tsx`; `page.tsx` not a client page. `tsc` clean; `eslint` clean on changed files; `prettier --check` clean on new files (siblings carry pre-existing drift, untouched per A58/A72); `vitest run` 300/300; parity green; `next build` succeeds; diff LF-clean (A73).

### File List

New:
- `frontend/src/features/sponsors/types/sponsor.types.ts`
- `frontend/src/features/sponsors/api/sponsors-api.ts`
- `frontend/src/features/sponsors/hooks/use-sponsors.ts`
- `frontend/src/features/sponsors/hooks/use-delete-sponsor.ts`
- `frontend/src/features/sponsors/components/sponsor-status-badge.tsx`
- `frontend/src/features/sponsors/components/sponsor-tier-badge.tsx`
- `frontend/src/features/sponsors/components/sponsors-filter-bar.tsx`
- `frontend/src/features/sponsors/components/sponsors-table.tsx`
- `frontend/src/features/sponsors/components/delete-sponsor-dialog.tsx`
- `frontend/src/features/sponsors/components/sponsors-page-content.tsx`
- `frontend/src/features/sponsors/components/sponsor-status-badge.test.tsx`
- `frontend/src/features/sponsors/components/sponsor-tier-badge.test.tsx`

Modified:
- `frontend/src/types/sponsors.ts` (type split — now only `ContractLinkType` + `ContractLinkDto`)
- `frontend/src/app/sponsors/page.tsx` (god-page → thin server entry)
- `frontend/src/app/sponsors/[id]/page.tsx` (type import repoint only)
- `frontend/src/app/sponsors/[id]/edit/page.tsx` (type import repoint only)
- `frontend/src/app/sponsors/new/page.tsx` (type import repoint + drop unused `SponsorTier`)
- `frontend/src/app/sponsors/page.test.tsx` (hardened one fragile list-test selector)
- `frontend/messages/hi.json` (added the `sponsors.*` Hindi tree)

## Change Log

- 2026-06-07: Story created (Sponsors list feature-slice extraction + Tier badge + `hi.json` parity; mirrors E21-S3). DEC-1 (tier badge) recorded. Status ready-for-dev.
- 2026-06-07: Implemented the list feature-slice; DEC-1 resolved Option A (feature-local tier badge); hi.json sponsors parity (53 keys); S1 list suite green post-refactor; full suite 300/300; next build green. Status → review.
