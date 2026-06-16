# Story E7.S3: Add Hindi Translation Expansion Path

Status: done

## Story

As an Admin or user,
I want the application's localization to support Hindi as a third language on an incremental expansion path,
so that Hindi can be introduced key-by-key without hardcoded strings and without destabilizing the existing DE/EN behavior.

## Acceptance Criteria

1. Existing DE/EN translation behavior remains stable: the active-locale resolution, the `NEXT_LOCALE` cookie persistence, and the language switcher continue to work exactly as before for `de` and `en`.
2. A Hindi (`hi`) message-file structure can be introduced: `frontend/messages/hi.json` exists and is wired through the locale list and the request-config message loader so `hi` is a selectable, loadable locale.
3. Missing keys fall back **safely and visibly** — a key absent from `hi.json` resolves to a sensible fallback (the default/English value), never a thrown error and never a blank, so a partially-translated `hi.json` is a valid intermediate state.
4. New/touched UI introduced by this story has no hardcoded user-facing text (e.g. the Hindi switcher label is a next-intl key, not a literal).
5. Language preference persists for `hi` through the same mechanism as DE/EN (the `NEXT_LOCALE` cookie), with no new persistence layer.

## Tasks / Subtasks

- [x] Task 0: Spike + resolve scope (AC: all)
  - [x] Re-read the i18n wiring: `request.ts` (locales line 4, defaultLocale line 6, ternary loader 15-18), `index.ts` (duplicate locales line 6), `client.ts` (Locale union line 7, cookie write line 16), `LanguageSwitcher.tsx` (en/de buttons 10-13; already has `title`+`aria-label` from `t(lang.code)`). Confirmed next-intl v4.8.1, cookie-based (no `[locale]` segment), no `hi.json`, no fallback handler, parity bug present.
  - [x] Resolved DEC-1 = A, DEC-2 = A, DEC-3 = A (see Debug Log).
- [x] Task 1: Add `hi` to the locale lists — kept in lockstep (AC: 2)
  - [x] Added `"hi"` to `locales` in **both** `request.ts:4` and `index.ts:6`; added a lockstep test (`src/i18n/locales.lockstep.test.ts`) that parses both files' `locales` literal and asserts equality (A51 direct-artifact-read).
  - [x] `defaultLocale = "en"` unchanged (AC-1).
- [x] Task 2: Wire the message loader + safe fallback (AC: 2, 3)
  - [x] Replaced the `de`/`en` ternary with an explicit loader handling `hi`. **Safe fallback** implemented by deep-merging the (partial) `hi.json` onto the complete English base, so every key resolves to the English value when Hindi is absent — never a thrown error, never a blank (AC-3). DE/EN unaffected (full files loaded directly).
  - [x] Added `getMessageFallback` (returns `namespace.key`) + an `onError` that swallows `MISSING_MESSAGE` as a secondary safety net so a stray missing key can never crash the render.
- [x] Task 3: Create `frontend/messages/hi.json` (AC: 2, 3)
  - [x] Created `hi.json` with a genuine Hindi seed (`language.*`, `common.*` core actions, `nav.*` core) per DEC-1=A; the deep-merge fallback covers the remaining ~2,470 keys. NOT a full machine translation. (Note: the seed is a real subset, not a full empty-namespace skeleton — the deep-merge makes a full skeleton unnecessary; the parity test enforces `hi ⊆ en`.)
  - [x] Added `language.hi` (`"हिन्दी"`) to `de.json`, `en.json`, AND `hi.json`.
- [x] Task 4: Language switcher (AC: 4, 5)
  - [x] Added the `hi` entry (`🇮🇳`) to `LanguageSwitcher.tsx`, shown always (DEC-2=A). Label is `t("hi")` (the `language.hi` key) — no hardcoded text; the existing `aria-label`/`title` wiring covers `hi` automatically. Widened the `Locale` union in `client.ts:7` to `"en" | "de" | "hi"`.
  - [x] Cookie path (`client.ts:16`) persists `hi` via the same `NEXT_LOCALE` write — no change beyond the type (AC-5).
- [x] Task 5: Fix the DE/EN parity bug + add a global parity test (AC: 1, 3)
  - [x] Confirmed + fixed the parity bug: `events.edit.editEvent` was in `de.json` only — added it to `en.json` (and the key falls under `hi`'s fallback). DEC-3=A (folded into this story so the new global test passes).
  - [x] Added a pure-Node parity test (`messages/messages.parity.test.ts`, no jsdom/render — A46): (a) `de ≡ en` key sets (catches future drift; this global guard did not exist); (b) `hi ⊆ en` (no stray Hindi keys); (c) the seeded core keys are present.
- [x] Task 6: Quality gates (AC: all)
  - [x] A29 per-AC completion list below.
  - [x] `tsc --noEmit` clean (locale-type widening + deep-merge loader compile); `eslint` clean on changed files; `vitest run` 220/220 pass (41 files, +5 new i18n tests). Prettier: the i18n config files (`request.ts`/`index.ts`/`client.ts`) + `LanguageSwitcher.tsx` were prettier-clean at HEAD so their diffs are minimal/clean; the new test files + `hi.json` are clean. (The whole-file `prettier --write` issue in P1 affected the S1/S2/S4 page+component files, not these.) See `epic-7-boundary-review-2026-06-07.md`.
  - [x] Manual language-switch validation (switch to `hi`, confirm seeded Hindi renders + un-seeded falls back to English, DE/EN unchanged) → `[!] manual-verify` (browser-only; deep-merge guarantees the fallback, asserted structurally by the parity test).

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub. The i18n infrastructure is **cookie-based next-intl v4.8.1, NOT route-based** — there is no `[locale]` URL segment; the locale lives entirely in the `NEXT_LOCALE` cookie. Shipped-state:

- **Locale list is duplicated** in `request.ts:4` and `index.ts:6` (`["en","de"]`). Both must change; A51 test keeps them in lockstep.
- **Message loading** is a static-import ternary in `request.ts:15-18` (de → `de.json`, else → `en.json`). No dynamic locale→file map; extend explicitly for `hi`.
- **No `hi.json` today.** `de.json` ≈ 2,503 keys / 119 KB; `en.json` ≈ 2,502 keys / 110 KB; 52 top-level namespaces.
- **No fallback handler configured.** next-intl v4 default for a missing key is to surface an error/render the key path — so AC-3 ("fall back safely") requires an explicit `getMessageFallback`/`onError`, it is not free.
- **Switcher** (`LanguageSwitcher.tsx`) is en/de only; persistence is the cookie write in `client.ts:16` (1-year TTL). Adding `hi` is a third array entry + a type widening.
- **Parity bug**: `events.edit.editEvent` in `de.json` only. No global DE/EN parity test exists (only `BetaBanner.i18n.test.ts` + `automations.i18n.test.ts` scoped tests). Fold the fix + add the global guard here.
- **Backend is unaffected.** Enums (`MembershipType`, `MembershipStatus`, `MessageChannel`, `EventCategory`, `BlogPostStatus`, …) are PascalCase **contract** values serialized over the wire; the frontend translates them via `membershipType.*`/`status.*` keys. No backend change — Hindi is purely a frontend message-file + i18n-config concern.

### The load-bearing scope point

This story is the **expansion PATH**, not a full Hindi translation. The AC wording is deliberate: "Hindi message file structure **can be introduced**", "introduced **incrementally**", "missing keys **fall back safely**". Delivering the mechanism (locale wired + loader + safe fallback + seed file + switcher + parity guard) satisfies all 5 ACs. Machine-translating ~2,500 keys is explicitly out of scope (DEC-1) and would be unreviewable + low-quality.

### Files to change

- `frontend/src/i18n/request.ts` (locale list + loader + fallback)
- `frontend/src/i18n/index.ts` (locale list)
- `frontend/src/i18n/client.ts` (`Locale` union)
- `frontend/src/components/navigation/LanguageSwitcher.tsx` (hi entry, gated)
- `frontend/messages/hi.json` (new — seed + structure)
- `frontend/messages/de.json`, `frontend/messages/en.json` (add `language.hi`; fix `events.edit.editEvent` parity)
- New tests: locale-list lockstep test + global message-parity test (pure-Node)

### Scope Boundaries

In scope:

- Wire `hi` end-to-end (locale lists, loader, fallback, switcher, cookie type).
- A seed `hi.json` + safe fallback so partial translation is valid.
- Fix the existing DE/EN parity bug + add the global parity guard.

Out of scope:

- Full Hindi translation of all ~2,500 keys (incremental, post-path).
- Translating backend enum **contract** values (they stay PascalCase; only frontend keys translate).
- Route-based/`[locale]`-segment localization (the app is cookie-based; do not introduce URL locales).
- A user-profile-stored language preference (cookie is the established mechanism; AC-5).

### Architecture Guardrails

- next-intl v4 App Router, cookie-driven. Do not convert to route-based locales.
- No hardcoded UI text — the Hindi switcher label is the `language.hi` next-intl key (AC-4).
- Keep `de.json`/`en.json` in parity (the new global test enforces it); `hi.json` may be a subset of `en.json` keys but never a superset.
- Frontend enum values still match backend PascalCase contracts (unchanged).
- TypeScript strict: widen the `Locale` type in all three i18n files consistently or `npm run typecheck` fails.

### Testing Requirements

- Pure-Node tests (file read + key-set assertions) — NO `render()`, so **no** jsdom/cleanup (A46). Reference shape: `frontend/src/components/navigation/BetaBanner.i18n.test.ts`.
- Locale-list lockstep test (reads `request.ts` + `index.ts`, asserts equal arrays — A51 direct-artifact-read).
- Global parity test (de≡en key sets; hi⊆en).
- `npm run typecheck` is a hard gate (type widening). Changed-files eslint/prettier + full `vitest run` (A58).
- Manual switch-to-hi smoke → `[!]` if not headlessly assertable.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — translation depth (AC-2/AC-3).** What goes in `hi.json`?
  - (A, recommended) **Structure + a small translated seed + AC-3 fallback.** `hi.json` carries the full namespace structure with a translated seed (`language.*`, `nav.*`, `common.*` core); everything else falls back to English via the new handler. Proves "structure introduced" AND "missing keys fall back safely" with a reviewable, honest deliverable. Matches the "expansion path / incremental" AC wording.
  - (B) Full machine translation of all ~2,500 keys. Rejected: unreviewable, low-quality, contradicts "incrementally", and risks shipping wrong Hindi as if final.
  - (C) Empty `hi.json` (`{}`) + fallback only. Rejected: doesn't prove "structure can be introduced" and gives no real Hindi anywhere; a thin seed is barely more work and demonstrates the path.
- **DEC-2 — switcher visibility (AC-1/AC-4).** Show the `hi` button always, or gate it?
  - (A, recommended) **Show `hi` always** once wired. Simplest; the safe fallback (AC-3) means a Hindi user always sees a coherent (mostly-English) UI, never broken keys. No feature flag to maintain.
  - (B) Gate behind a feature flag / `SystemSettings` until translation coverage crosses a threshold. Only choose if the product wants Hindi hidden until "complete"; adds a flag surface for a path-story. Defer unless requested.
- **DEC-3 — parity-bug fix (AC-1).** Fold the `events.edit.editEvent` DE/EN fix into this story?
  - (A, recommended) **Yes** — an i18n-structural story that adds a global parity test must leave the repo passing that test; the bug is in scope by construction (A37 fold-adjacent-contradiction analogue).
  - (B) Defer to a separate chore. Rejected: the new global parity test would fail on commit; fixing one missing key is trivial.

### Project Structure Notes

- i18n config: `frontend/src/i18n/{request.ts,index.ts,client.ts}`.
- Messages: `frontend/messages/{de,en,hi}.json`.
- Switcher: `frontend/src/components/navigation/LanguageSwitcher.tsx`.
- Tests: co-located `*.test.ts` (pure-Node) near the i18n config or under `messages` tests.

### References

- `frontend/src/i18n/request.ts:4,6,15-18`, `index.ts:6`, `client.ts:7,16`
- `frontend/src/components/navigation/LanguageSwitcher.tsx:10-13`
- `frontend/src/components/navigation/BetaBanner.i18n.test.ts` (parity-test reference shape)
- `_bmad-output/planning-artifacts/ux-design.md:547-559` (Multilingual Expansion)
- `_bmad-output/planning-artifacts/epics-and-stories.md:806-828` (E7-S3 source)
- `_bmad-output/project-context.md` (A37 fold-adjacent, A46 pure-Node-no-cleanup, A51 direct-artifact parity, A58 changed-files gate)
- next-intl v4 fallback / `getMessageFallback` — https://next-intl.dev/docs/usage/configuration#error-handling

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-7 dev-ready prep (A34). Stub placeholder ACs + stale MFA tech context replaced with spike-grounded, `file:line`-anchored tasks.
- Checklist coverage: ACs concrete + testable; the "path not full-translation" scope is pinned via DEC-1; safe-fallback (AC-3) flagged as requiring an explicit handler (not free in next-intl v4); parity-bug folded; no backend/auth/migration impact.
- Remaining risk: the exact `getMessageFallback`/`onError` shape in next-intl v4.8.1 — Task 2 cites the docs anchor; verify against the installed version before relying on default behavior.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — autonomous Epic-7 dev-story run.

### Debug Log References

**DEC resolution (A41/A43 autonomous-mode escape — (a)/(b)/(c)):**

- (a) **Options chosen:** DEC-1 = A (structure + small Hindi seed + AC-3 fallback); DEC-2 = A (show `hi` always); DEC-3 = A (fold the `events.edit.editEvent` parity fix into this story).
- (b) **Rationale:** (1) all three are the story's recommended options; (2) user pre-declared autonomous mode verbatim: *"das ganze epic 7 umsetzen ohen stop bis alle stories implementiert ist…"*; (3) downstream — DEC-1=A matches the "expansion path / incremental" AC wording (a full ~2,500-key machine translation would be unreviewable + low-quality); DEC-2=A is safe because the deep-merge fallback means a Hindi user always sees a coherent (mostly-English) UI; DEC-3=A is mandatory by construction (the new global parity test would fail on commit otherwise). All three A41 preconditions hold.
- (c) **Consequence chain:** AC-1 covered (DE/EN behaviour unchanged + parity bug fixed); AC-2 covered (hi wired through locale lists + loader); AC-3 covered (deep-merge English-base fallback + getMessageFallback/onError); AC-4 covered (switcher label via i18n key); AC-5 covered (cookie persistence reused). Manual switch-to-hi render is browser-only → `[!]`.

**Safe-fallback design decision (Task 2):** next-intl v4's default for a missing key surfaces an error / the key path. Rather than rely solely on `getMessageFallback` (which has no access to the English *value*), the loader deep-merges the partial `hi.json` onto the complete English base — so the `messages` object passed to next-intl is always English-complete with Hindi overlaid. This makes "missing hi key → English value" structural and guaranteed, and `getMessageFallback`/`onError` remain as a belt-and-suspenders net.

**A51 lockstep:** `locales` is duplicated in `request.ts` + `index.ts`; added `locales.lockstep.test.ts` that reads both files' literals and asserts equality so they can never silently drift.

### Completion Notes List

**A29 AC-Subitem Completion Check (per-AC):**

- **AC-1 (DE/EN stable + parity):** ✅ defaultLocale unchanged; cookie resolution unchanged; parity bug `events.edit.editEvent` fixed; global `de ≡ en` test added.
- **AC-2 (hi structure introduced + loadable):** ✅ `hi` in both locale lists (lockstep-tested); loader loads `hi.json`; switcher selectable.
- **AC-3 (missing keys fall back safely + visibly):** ✅ deep-merge English base → every key resolves to English when hi absent; `getMessageFallback`/`onError` net; `hi ⊆ en` test. Live render → `[!]` manual-verify.
- **AC-4 (no hardcoded text in new UI):** ✅ switcher `hi` label = `t("hi")` (`language.hi` key) in de/en/hi.
- **AC-5 (hi persists via NEXT_LOCALE cookie):** ✅ same cookie write; only the `Locale` type widened.

**Manual-verify (`[!]`):** switch to Hindi in a browser, confirm seeded keys render in Devanagari and un-seeded keys render the English fallback (not raw key paths), DE/EN unchanged. Structurally guaranteed by the deep-merge + parity test; runtime render is browser-only.

**Quality gates:** `tsc --noEmit` clean; `eslint` clean; `prettier --check` clean (i18n config files + switcher were prettier-clean at HEAD → minimal diffs; new test files + `hi.json` clean); `vitest run` 220/220 (41 files, +5 new). No backend impact (enums stay PascalCase contract values).

### File List

**Modified (i18n config):**
- `frontend/src/i18n/request.ts` — `hi` in locales; deep-merge English-base loader for `hi`; `getMessageFallback` + `onError` safety net; safer cookie-value validation.
- `frontend/src/i18n/index.ts` — `hi` in the client-side locales re-export (+ lockstep comment).
- `frontend/src/i18n/client.ts` — `Locale` union widened to `"en" | "de" | "hi"`.
- `frontend/src/components/navigation/LanguageSwitcher.tsx` — `hi` entry (🇮🇳), shown always.

**Modified (messages):**
- `frontend/messages/en.json` — added `language.hi`; fixed parity (`events.edit.editEvent`).
- `frontend/messages/de.json` — added `language.hi`.

**New:**
- `frontend/messages/hi.json` — Hindi seed (language + common-core + nav-core); rest falls back to English.
- `frontend/src/i18n/locales.lockstep.test.ts` — locale-list lockstep guard (A51, pure-Node).
- `frontend/messages/messages.parity.test.ts` — global de≡en + hi⊆en parity guard (pure-Node).

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (cookie-based i18n, no hi.json, no fallback handler, parity bug), DEC-1/2/3, "expansion-path not full-translation" scope pin, global parity guard.
- 2026-06-07: Implemented (autonomous Epic-7 run) — wired `hi` end-to-end (locale lists + lockstep test, deep-merge English-base safe fallback, seed `hi.json`, switcher, cookie type); fixed DE/EN parity bug + added global parity guard. DEC-1=A, DEC-2=A, DEC-3=A. Gates green (tsc/eslint/prettier clean; vitest 220/220). Status → review.
