# Story E21.S1: Frontend Target-State Architecture and Boundary Decisions (Gate 2)

Status: review

## Story

As a frontend architect,
I want a durable target-state (feature-slice) architecture with explicit boundary rules and the open decisions resolved,
so that every subsequent migration follows one agreed pattern instead of improvising per page.

## Acceptance Criteria

1. `docs/architecture-frontend.md` gains a "Target-State (Feature-Slice) Architecture" section (extended, not replaced) documenting the `src/features/<feature>/{api,components,hooks,schemas,types}` layout, the target import direction, and the 21 architecture rules from the source prompt — each adapted to verified project reality, not copied verbatim.
2. **HTTP-client contract decided.** One standard is chosen among the three that exist today; the decision records: standard return shape, token strategy, base-URL handling, and the migration direction with compatibility shims for the other two until empty. (See Decision DEC-1.)
3. **Server-state strategy confirmed.** TanStack Query is the official strategy (provider already mounted, zero usages); a query-key + cache-invalidation convention is documented. Suppliers (E21-S3) is named the first adopter.
4. **Theming rule recorded.** Semantic tokens already exist (shadcn vars in `globals.css`, Tailwind v4 `@theme`); the rule is adoption-in-feature-pages, NOT a system-wide colour sweep. The Supplier status colours (Prospect/Active/Paused/Ended) get a decided home (Badge variants vs bespoke tokens — DEC-2).
5. **Auth model documented.** Security boundary (backend 403 + `RequireModule`) vs UX guard (middleware module-gate, page/layout redirects) is written down; `useRequireAuth` is named the canonical UX guard.
6. **Route-group recommendation documented** (why only `events` sits under `(dashboard)`; whether a shared protected group is warranted). Recommendation ONLY — no route moves in this story or the pilot.
7. No production code behaviour changes. Docs/decisions only (non-behavioural scaffolding is allowed but not required). `tsc`/`lint`/`test` stay green.

## Tasks / Subtasks

- [x] Task 0: Re-read the Gate-1 analysis and its 8 Open Questions (AC: all)
  - [x] `docs/frontend-refactoring-gate1-analysis.md` end-to-end; treat §12 Open Questions as the decision agenda. Also read the source `docs/frontend-brownfield-refactoring-prompt.md` (16 rules + import-direction + boundary rules).
- [x] Task 1: Decide the HTTP-client contract (AC: 2)
  - [x] Compared the three: `lib/api-client.ts` (`ApiClient` class, throws), `useApiClient` in `lib/auth.ts:169-295` (`{data,error,status}`, used by suppliers), `lib/services/api.ts` (`{success,data,error,errorBody,status}`, used by `lib/api/*`). All three verified by direct read.
  - [x] Recorded DEC-1 = A (standard shape + token + base-URL + migration shims) — user-confirmed via AskUserQuestion.
- [x] Task 2: Decide server-state convention (AC: 3)
  - [x] Confirmed `QueryClientProvider` in `app/providers.tsx` (staleTime 60s, retry 1), zero usages; documented query-key + invalidation convention; named Suppliers the first adopter.
- [x] Task 3: Decide theming/token rule + status-colour home (AC: 4)
  - [x] Inspected `globals.css` + `components/ui/badge.tsx` variants. **Reality correction:** the semantic token layer did NOT exist (globals.css was 2 lines; no `@theme`/`:root`; no tailwind.config; compiled CSS had zero `--primary`/`--ring`). Recorded DEC-2 = A (introduce token layer + Badge variants) — user-confirmed via AskUserQuestion.
- [x] Task 4: Document auth model + route-group recommendation (AC: 5, 6)
  - [x] From `middleware.ts` (module-gate only, not role) + `lib/auth.ts` (`useAuth`/`useRequireAuth`). Recommendation only for route groups (single shared protected group; out of E21 scope).
- [x] Task 5: Write the target-state section + 21 adapted rules into `docs/architecture-frontend.md` (AC: 1)
- [x] Task 6: Quality gate (AC: 7)
  - [x] `tsc --noEmit` clean; `vitest run` 231/231 pass (45 files), no regressions.
  - [x] `eslint src/`: 2 errors + 1 warning, ALL pre-existing in `src/app/members/segments/page.tsx` (`react-hooks/set-state-in-effect`), a file this story did not touch — zero new lint introduced (A58 changed-files gate; my only frontend change is `globals.css`, not ESLint-covered).
  - [!] Visual smoke-check deferred: defining the token layer fixes the previously token-broken shadcn `Dialog` (`bg-background`) used by 3 consumers — needs a quick browser look in a running app (sandbox cannot render). Behaviour-neutral for tsc/lint/test.

## Dev Notes

This story IS the "Gate 2 / Brownfield Zielbild" of the source prompt. It produces decisions, not refactors. Its output unblocks E21-S3.

### Scope Boundaries

In scope: `docs/architecture-frontend.md` (extend), the recorded decisions (DEC-1, DEC-2), optional non-behavioural type-only scaffolding.
Out of scope: any page/feature refactor, route-group moves, client consolidation, colour sweep, ESLint enforcement (that is E21-S5).

### Architecture Guardrails

- Adapt the 21 rules to reality — e.g. rule 8 ("reuse existing Supplier service") is VOID: no supplier service exists (Gate-1 CF, §7). Rule 10 holds (TanStack present) but note zero current usage.
- Do not invent a REQ; this is a technical initiative grounded in the Gate-1 analysis.

### Decision-Needed (resolve in this story)

- **DEC-1 — HTTP-client standard.** (A, recommended) Standardise on the hook contract pattern `{data,error,status}` for client components and keep `lib/services/api.ts` `{success,...}` as the module-level pattern, converging the two return shapes onto one documented shape over time; retire the throwing `ApiClient` class. (B) Standardise on `lib/services/api.ts` everywhere. (C) Defer — rejected: the pilot needs a contract.
- **DEC-2 — Supplier status-colour home.** (A, recommended) Add status variants to `Badge` / map to semantic tokens, no raw Tailwind colour classes in the feature. (B) Keep a small colour map co-located in the feature (matches the existing `lib/api/members.ts` pattern) but token-based. (C) Raw classes — rejected (violates theming rule).

### Project Structure Notes

- Docs: `docs/architecture-frontend.md`, evidence `docs/frontend-refactoring-gate1-analysis.md`.

### References

- `docs/frontend-refactoring-gate1-analysis.md` (Gate-1; §12 Open Questions = agenda)
- `frontend/src/lib/auth.ts:169-295`, `frontend/src/lib/services/api.ts`, `frontend/src/lib/api-client.ts`
- `frontend/src/app/providers.tsx:10-20`, `frontend/src/middleware.ts`
- `_bmad-output/planning-artifacts/epics-and-stories.md` (Epic E21)
- Source prompt: "Frontend Brownfield Refactoring Prompt" (Gate 2, Architekturregeln, Ziel-Import-Richtung)

## Validation Notes

- Created 2026-06-07 from the user-authored refactoring prompt via the BMad story workflow. Decisions-only story; no behavioural risk.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) via bmad-dev-story.

### Debug Log References

**Decision resolution (DEC-1, DEC-2) — NOT autonomous mode → AskUserQuestion used (A32 step d + project memory `feedback_decisions_via_ask_tool`).** The user did not pre-declare autonomous mode, so the A41 escape clause did not apply; both decisions were surfaced via `AskUserQuestion` and answered by the user before any doc was written.

- **DEC-1 — HTTP-client standard → option A (user-confirmed).** Standard for client components = the `useApiClient` hook contract `{data,error,status}`; module-level standard stays `lib/services/api.ts` `{success,...}`; throwing `ApiClient` retired via compatibility shim; both shapes converge over time; base-URL target = client owns `/api/v1` (interim: feature `api/` keeps full path, preserving current Suppliers behaviour).
- **DEC-2 — theming rule + Supplier status-colour home → option A (user-confirmed).** Introduce the missing shadcn token layer in `globals.css` (foundation); adopt tokens/Badge variants per-feature (no system-wide sweep); Supplier statuses get a Badge-based `supplier-status-badge` mapped to semantic tokens.

**Load-bearing reality correction (doc-vs-code accuracy, per A45/A52/A56 family).** AC-3/AC-4 and the Gate-1 analysis (§2/§6) asserted "semantic tokens already exist in `globals.css` `@theme`". Verified false on 2026-06-07: `globals.css` was 2 lines (`@import "tailwindcss"` + typography plugin); no `tailwind.config.*`; no `:root`/`@theme`; the compiled `.next` CSS contained **zero** `--primary`/`--ring`/`--destructive`/`--background`. The shadcn primitives (`button`/`badge`/`checkbox`/`dialog`/…) referenced token classes that emitted no colour. Additionally, `@/components/ui/{button,badge,checkbox}` are imported by **no** app file (only their own tests) → defining the token layer is non-behavioural for those; the one rendered token consumer is `dialog.tsx` (`bg-background`, 3 consumers), whose dialogs were token-broken and are now fixed.

### Completion Notes List

Decisions-only Gate-2 story; the deliverable is documentation + one foundation scaffolding edit.

- ✅ AC-1: `docs/architecture-frontend.md` extended (not replaced) with a "Target-State (Feature-Slice) Architecture" section: feature-slice layout, target import direction, and **21 adapted rules** (16 source work-rules + 5 import/boundary rules), each adapted to verified reality (rule 7 marked VOID — no supplier service exists; rule 9 notes TanStack zero-usage; rule 11 rewritten because the token layer was missing).
- ✅ AC-2: DEC-1 recorded with the 3-client comparison table + standard shape + token strategy + base-URL handling + migration shims.
- ✅ AC-3: TanStack Query confirmed as the official strategy; query-key (`["suppliers","list",{status}]`) + invalidation convention documented; Suppliers named first adopter.
- ✅ AC-4: theming rule recorded (adopt-in-feature, no system-wide sweep); DEC-2 status-colour home decided (Badge-based). The premise "tokens already exist" was corrected and the missing token layer was introduced.
- ✅ AC-5: auth model documented (backend 403 + `RequireModule` = security boundary; middleware module-gate + redirects = UX guard; `useRequireAuth` named canonical).
- ✅ AC-6: route-group recommendation documented (single shared protected group; medium-risk; out of E21 scope; no moves).
- ✅ AC-7: no behaviour change to feature code. `tsc --noEmit` clean; `vitest run` 231/231 (45 files); `next build` exit 0. ESLint: only 2 pre-existing errors in an untouched file (A58). **Token-layer caveat:** the foundation edit to `globals.css` makes the previously token-broken shadcn `Dialog` render its intended background (3 consumers) — a beneficial visual fix, flagged `[!]` for a browser visual smoke-check (sandbox cannot render). Verified the foundation works: pre-change compiled CSS had **zero** semantic tokens; post-change build emits `bg-primary`/`--ring` etc.

**Q-items (human verification queue):**

| Q | Item | Why deferred |
|---|---|---|
| Q1 | Visual smoke-check of the 3 `Dialog` consumers (events fees page, member dismiss/merge modals) after the token layer landed | Requires a running browser; sandbox is non-interactive. Behaviour-neutral for tsc/lint/test. |

### File List

- `docs/architecture-frontend.md` (modified — appended Target-State section, 21 rules, DEC-1/DEC-2, server-state, theming, auth, route-group recommendation)
- `frontend/src/app/globals.css` (modified — added the shadcn semantic token layer: `:root` HSL tokens + Tailwind v4 `@theme inline` mapping; primary/ring = brand orange; no radius override; light-theme only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — e21-s1 status → in-progress → review)
- `_bmad-output/implementation-artifacts/e21-s1-frontend-target-state-architecture-and-boundary-decisions.md` (modified — this story file)

## Change Log

- 2026-06-07: Story created from the Frontend Brownfield Refactoring prompt (Gate 2) and the Gate-1 analysis; marked ready.
- 2026-06-07: Implemented Gate-2 decisions. Extended `docs/architecture-frontend.md` with the Target-State (Feature-Slice) Architecture section + 21 adapted rules + DEC-1 (HTTP-client = hook contract, option A) + DEC-2 (theming = introduce token layer + Badge variants, option A) + server-state, auth-model, and route-group recommendation. Corrected the false "tokens already exist" premise and introduced the missing shadcn semantic token layer in `frontend/src/app/globals.css`. Quality gate: tsc clean, vitest 231/231, next build exit 0, token utilities now compile. Status → review.
