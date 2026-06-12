# Epic-28 Boundary Review — Public Site Frontend Feature-Slice Migration

**Date:** 2026-06-12
**Reviewer:** bmad-code-review (hybrid CR+ER, epic-boundary per project workflow)
**Scope:** the entire Epic-28 diff — the new `frontend/src/features/public/` slice (25 files / ~3,393 LOC), the rewritten thin route entries under `frontend/src/app/public/**/page.tsx`, and the characterization net (8 new + 1 extended + 5 RSC-adapted + 2 kept specs).
**Stories covered:** E28-S1 (char net), E28-S2 (5 read-only pages → RSC slice + islands), E28-S3 (contact/newsletter RHF+Zod + unsubscribe state machine), E28-S4 (license RSC + layout shell).
**Significance:** the program's FIRST genuine client→RSC migration and the only unauthenticated/SEO surface.

## Method

Four parallel adversarial layers at full model capability, each with project read access + HEAD comparison (`git show HEAD:<path>`):

1. **Blind Hunter** — behaviour-preservation / RSC fidelity (per-page diff vs the HEAD god-pages).
2. **Edge Case Hunter** — branch/boundary walk (RSC error/empty paths, registration state machine, honeypot, `||undefined`, unsubscribe states, Zod deltas).
3. **Acceptance Auditor** — the 4 story ACs + DEC decisions vs the implementation.
4. **Net-Integrity Auditor** — did the S1 oracle get silently weakened when S2 adapted the 5 specs client→RSC?

## Outcome: **APPROVE** (clean — 0 HIGH, 0 MED)

| Layer | Verdict | HIGH | MED | LOW |
|---|---|---|---|---|
| Blind Hunter | APPROVE | 0 | 0 | 0 |
| Edge Case Hunter | APPROVE | 0 | 0 | 2 |
| Acceptance Auditor | APPROVE | 0 | 0 | 2 |
| Net-Integrity Auditor | **ORACLE-INTACT** | 0 | 0 | 0 |

Quality gates at review time: full suite **205 files / 1944 tests green** (1840 baseline → 1944); `tsc --noEmit` clean; `eslint --max-warnings=0` clean; `next build` exit 0 (all public routes compile as `ƒ` dynamic RSC).

## Triage

**1 patch applied, 3 dismissed (behaviourally-equivalent), 0 deferred.**

### Patch (applied)
- **P1 [LOW] — accidental prettier reflow on a pre-existing spec.** `license/page.test.tsx` picked up a 2-line prettier line-wrap from S2/S3's broad `prettier --write app/public/**` even though S4 changed it only by import path (it should have stayed byte-identical — A72 says `--write` NEW files only). **Reverted to HEAD** (`git checkout HEAD -- …`); the 2 license tests stay green. The file is now byte-identical to HEAD.

### Dismissed (confirmed equivalent / improvement by multiple layers)
- **[LOW] RSC detail pages render the generic error block for an empty/missing `id`** where the client original hung on an infinite loading spinner (`useEffect` `if (!id) return`). Unreachable through the `[id]` route (the segment is always non-empty); the new surface is the *better* behaviour and consistent with the epic's no-`notFound()` design (A56/AC-3). Documented note, not a defect.
- **[LOW] Sponsors CTA renders unconditionally** post-fetch vs the god-page's `{!loading && …}`. Behaviourally identical once the client loading lifecycle is gone (the licensed A79 delta) — the CTA showed in every non-loading branch (error/empty/populated) at HEAD too.
- **[LOW] Contact "send another" resets via island remount** (`setStatus("idle")` → `<ContactForm>` unmounts on the success panel and remounts with empty RHF `defaultValues`) rather than the god-page's explicit field clear. Verified identical observable outcome (form starts empty after "send another").

## Behaviour-preservation confirmations (the load-bearing invariants)

- **Transport byte-identical:** all fetch URLs/methods/bodies preserved (`/api/v1/blog/public`, `…/blog/public/{id}`, `/api/v1/events/public`, `…/events/public/{id}`, `…/{id}/fee-categories`, `/api/v1/events/{id}/registrations/public`, `/api/v1/sponsors/public`, `/api/v1/public/contact`). `@/lib/api/privacy.ts` **unchanged** (`git diff` empty) — newsletter/unsubscribe wrapped via a live-binding re-export.
- **Registration POST payload** `{name,email,phone?,numberOfGuests,specialRequirements?,feeCategoryId?}` byte-identical; `||undefined` omission + single-fee auto-select + the closed/form/success/waitlist/paid state machine all preserved (manual `useState`, NOT RHF-ified).
- **Contact honeypot** = first line of `onSubmit`, pre-fetch, raw value, `website` stays in the body. **Newsletter `firstName/lastName || undefined`** coercion preserved at the call site (empty names dropped by `JSON.stringify`).
- **Unsubscribe** five-state machine + error precedence verbatim; no redirect/auth.
- **RSC/client boundary correct:** no `onClick`/`useState` left in any Server Component; islands receive server-fetched data as props (SSR'd initial render — the SEO/SSR improvement). Detail pages `await params` (Next 16) then delegate.
- **License stays an async Server Component** (fs + `getTranslations`, repo-root walk unchanged); layout references `@/components/navigation/*` (no duplication, no premature `PageShell`); footer dead links left as-is; E30 deferral TODO present.
- **E21-S5 boundary:** no `@/features/<other>` imports from the slice; no new eslint entry needed.

## Net-integrity (the highest-risk failure mode)

The oracle was **NOT** weakened. The 3 pre-existing specs (license, REQ-022 fee, REQ-055 content-language) were extended/strengthened — the dropped `waitFor` wrappers actually *tighten* them (the awaited RSC renders synchronously, removing an async race window). The 5 RSC-adapted specs removed **exactly one assertion each** — the client loading-spinner test — which is the licensed, documented, structurally-valid A79 delta (the converted pages have no client loading state). All load-bearing invariants (honeypot+`website`-in-payload, `||undefined` coercion via `toHaveBeenCalledWith(…, undefined, undefined)`, unsubscribe states, the exact registration payload via `toEqual`) are still asserted at full strength. No tautologies, no softened matchers, no `.skip`/`.only`.

## A79 deltas (documented, accepted)

1. The five RSC pages have **no client loading-spinner** for the initial fetch (an RSC awaits the server fetch before render). The loading-state lifecycle is replaced by server-side wait / an optional future `loading.tsx` Suspense boundary. Error/empty COPY is pinned identically.
2. Contact/newsletter `noValidate` + Zod `z.string().min(1)` blocks an EMPTY submit via Zod + renders per-field `form.required` (the old HTML5 `required` did not block under jsdom `fireEvent`). No `.email()`/`.url()`/`.trim()` (A96).

## Verdict

**APPROVED** — proceed to retrospective, then flip e28-s1..s4 + epic-28 to `done`. No findings routed back to dev-story.
