# Story E28.S1: Public site — characterization tests for all nine pages (regression net)

Status: ready-for-dev

Depends on: E21-S3 + E21-S5 (closed) and the suppliers/sponsors slice recipe. **Blocks E28-S2/S3/S4** — the net must be green at HEAD before any extraction lands. Inherits E21-S1 boundary decisions. This is a **test-only** story: no `src/features/public/` code, no source changes.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want a behaviour-pinning characterization suite over all nine Public pages plus the `public/layout.tsx` shell,
so that the S2 (Server-Component), S3 (forms) and S4 (static+layout) extractions are provably behaviour-preserving.

## Acceptance Criteria

**Behaviour preserved (this net pins HEAD; every E28-S1 test stays green through S2/S3/S4):**

1. Characterization tests pin all nine pages against HEAD render output, plus the `public/layout.tsx` shell (header / footer / `children` slot):
   - `public/blog/page.tsx`, `public/blog/[id]/page.tsx`
   - `public/events/page.tsx`, `public/events/[id]/page.tsx`
   - `public/sponsors/page.tsx`
   - `public/contact/page.tsx`, `public/newsletter/page.tsx`, `public/unsubscribe/[token]/page.tsx`
   - `public/license/page.tsx` (already an async Server Component — extend, don't rewrite)

2. Per A76, each data-driven page pins **error / empty / loading** paths, and each form page additionally pins **submit-success and submit-failure** paths:
   - **blog list:** loading spinner; error block (`publicBlog.errorMessage` + `publicBlog.retry` reload button); the `noResults` (search active) vs `empty` (no search) distinction (`blog/page.tsx:139`); the 5-field client search filter (title/excerpt/author/category/tags — `blog/page.tsx:54-58`); `de-CH` long-date format; 200-char excerpt truncation; category badge + content-language badge (`tLang(post.contentLanguage)`); card links to `/public/blog/${post.id}` (by **id**, not slug); `next/image` `unoptimized`.
   - **blog detail:** loading; the **single generic error block** for missing/unpublished (`publicBlog.errorMessage` + `backToBlog`) — there is **no distinct 404** today (`blog/[id]/page.tsx:78`); `\n`-split paragraph rendering; the hardcoded literal `Tags` heading (`blog/[id]/page.tsx:164`); the Share button (`publicBlog.copyLink`); `<h1>=post.title`.
   - **events list:** loading; error (`publicEvents.errorTitle` + raw error string); empty (`publicEvents.noEvents` + `noEventsSubtitle`); the 2-field search (title/location) + category `<select>` filter (`events/page.tsx:74-84`); `de-CH` date with time; free/paid badge (`free` / literal `CHF ${cost}` / `paid`); content-language badge; `hasEnded → ended` chip.
   - **event detail:** loading; generic error block (no distinct 404); the fee-category best-effort fetch (single fee → text, multiple → radio fieldset, free → no fee section — **already pinned**, see AC-5); the registration state machine (`registrationClosed` / waitlist success+position / `registrationSuccess` / paid `fee.amountDue` via `formatCurrency`); the `POST …/registrations/public` payload `{ name, email, phone?, numberOfGuests, specialRequirements?, feeCategoryId? }`.
   - **sponsors:** loading; error (`publicSponsors.errorMessage`, **no retry button**); empty (`publicSponsors.empty`); the tier grouping (`TIER_ORDER` Platin/Gold/Silber/Bronze/Basis, `getHighestTier`, hardcoded German `TIER_LABELS[...].de` headings); `/public/contact` CTA; hardcoded `Website` external link.
   - **contact:** the honeypot (`website`) silent-success short-circuit (`if (website) { setStatus("success"); return; }` BEFORE fetch — `contact/page.tsx:34-38`); `idle→loading→success` swap to the "send another" panel; `error` banner + submit-label swap (`sending` / `retry` / `submit`); the exact `subject` `<select>` option set (`""`/general/membership/events/sponsoring/other); the `POST /api/v1/public/contact` payload `{ name, email, subject, message, website }`; the `useAppSettings().settings.applicationName` sidebar line.
   - **newsletter:** the subscribe/unsubscribe tab toggle + per-tab reset; subscribe submit (`{ email, firstName?, lastName? }` with empty names dropped via `|| undefined`) → `subscribeSuccess` panel; unsubscribe submit (`{ email }`) → `unsubscribeSuccess`; per-tab error banner (`subscribeError` / `unsubscribeError`); loading label swaps.
   - **unsubscribe `[token]`:** the `[token]` param-driven flow — `verifyUnsubscribe(token)` on mount → `confirm` vs `already` state; `confirmUnsubscribe(token)` → `success`; the five `PageState` renders (`loading`/`confirm`/`already`/`success`/`error`) with their i18n keys; **no redirect, no auth check** (middleware exempts it — `middleware.ts:109-114`).

3. Detail pages (`blog/[id]`, `events/[id]`) pin the param-driven fetch (`useParams`) and the not-found / not-published path **as the generic error block that ships today** — the net must NOT presuppose a Next `notFound()`; introducing one is a deliberate S2 decision, not a silent change.

4. `public/sponsors/page.tsx` is pinned **independently** of the authenticated `src/features/sponsors/` slice — zero shared state, types, or transport (the public DTO is a 6-field shape over `/api/v1/sponsors/public` keyed off German tier names; the slice is `/api/v1/sponsors` via `useApiClient` keyed off English `SponsorTier` — confirmed disjoint).

5. The three **existing** public tests are EXTENDED, never rewritten or weakened, and stay green:
   - `public/license/page.test.tsx` — the RSC harness (mock `next-intl/server` `getTranslations` + `node:fs`, `await LicensePage()` then `render`); pins `fs` success → `<pre>` + `<h1>` and `fs` throw → gnu.org fallback `<a>` + `console.warn`.
   - `public/events/[id]/page.test.tsx` — REQ-022 fee categories (single/multiple/free).
   - `public/events/page.contentlanguage.test.tsx` — REQ-055 content-language badge present/absent.

6. No auth-redirect assertions on any of the nine pages — they have no auth guard; tests assert render / data / SEO / form behaviour only.

7. Suite green against HEAD before any extraction lands.

**Improvements:**

8. Tests assert **observable behaviour** (rendered text, resolved i18n keys, fetch URL + method + payload, status transitions, SEO `<h1>`/title) — NOT implementation detail — so the behavioural assertions survive the Server-Component / client-island reshaping in S2-S4. Snapshot SEO-relevant output where present (page `<h1>`/title text, blog/event metadata) to protect the SSR/SEO improvements in S2.

9. **Render-harness adaptation is licensed, not a regression (A88/A79 — load-bearing E28 divergence).** Unlike E26/E27 (where god-page and slice both used `useApiClient`, so the net survived literally unchanged — A103), the five read-only pages flip **client → RSC** in S2, which changes the render *model*: their tests adapt from client `render(<Page/>)` (mock `useEffect`-driven `fetch`) to RSC `render(await Page())` (mock server `fetch` + `next-intl/server` `getTranslations`), mirroring `license/page.test.tsx`. Write the net so the **behavioural assertions are identical across both idioms** and isolate the render-mechanism plumbing so S2 swaps only the harness shell, not the expectations. State this explicitly in each affected spec's header comment so S2/boundary-review reads it as expected, not breakage.

## Tasks / Subtasks

- [ ] Task 0: Spike + harness archetypes (AC: 5, 8, 9)
  - [ ] Re-read all nine pages + `public/layout.tsx` + the three existing specs at HEAD (A56). Confirm `features/public/` does NOT exist.
  - [ ] Codify the **two harness archetypes**: (A) **client-page** = `// @vitest-environment jsdom` + `import "@testing-library/jest-dom/vitest"` + `afterEach(cleanup)` (A35/A46) + a **stable per-namespace `next-intl` `useTranslations` mock** (A64/A78) + `vi.stubGlobal("fetch", …)` or `vi.mock("@/lib/api/privacy", …)` + `useParams` mock for dynamic routes; (B) **RSC** = mock `next-intl/server` `getTranslations` (stable async→sync map) + `node:fs` where needed, `const el = await Page(); render(el)`. No `QueryClientProvider` anywhere (no public page uses React Query — DEC-1).
- [ ] Task 1: Blog net (AC: 2, 3, 8) — `blog/page.test.tsx` + `blog/[id]/page.test.tsx`. Pin loading/error/empty + `noResults`-vs-`empty`, the 5-field search filter, de-CH long-date, 200-char excerpt, category + content-language badges, `/public/blog/${id}` link, `unoptimized` image; detail: generic-error (no 404), `\n`-paragraphs, literal `Tags` heading, Share button, `<h1>=title`.
- [ ] Task 2: Events net (AC: 2, 3, 5, 8) — `events/page.*.test.tsx` (NEW loading/error/empty/search/category specs; KEEP `page.contentlanguage.test.tsx`) + EXTEND `events/[id]/page.test.tsx` (loading/error/registration-state-machine/payload around the existing fee specs). Stable `t` (A64 — `t` is in both fetch-effect deps `events/page.tsx:67`, `events/[id]/page.tsx:118`).
- [ ] Task 3: Sponsors net (AC: 2, 4, 8) — `sponsors/page.test.tsx`: loading / error(no-retry) / empty / tier grouping + German `TIER_LABELS.de` headings + `getHighestTier` + CTA + hardcoded `Website` link. Pinned independently of `features/sponsors/`.
- [ ] Task 4: Contact net (AC: 2, 8) — `contact/page.test.tsx`: honeypot silent-success (pre-fetch, raw value), `idle→loading→success` "send another" panel, `error` + label swap (`sending`/`retry`/`submit`), the 6 subject options, the `{name,email,subject,message,website}` POST payload, the `settings.applicationName` sidebar line (mock `useAppSettings` for determinism).
- [ ] Task 5: Newsletter net (AC: 2, 8) — `newsletter/page.test.tsx`: tab toggle + reset, subscribe payload `{email, firstName?, lastName?}` (empty names dropped), unsubscribe payload `{email}`, per-tab success/error panels + label swaps. Mock `@/lib/api/privacy` (`subscribeNewsletter`/`unsubscribeByEmail`).
- [ ] Task 6: Unsubscribe net (AC: 2, 8) — `unsubscribe/[token]/page.test.tsx`: `useParams` token, verify-on-mount → `confirm`/`already`, confirm → `success`, the five states + keys, `err.message`/`invalidToken` error text. Mock `@/lib/api/privacy` (`verifyUnsubscribe`/`confirmUnsubscribe`). Assert NO redirect/auth.
- [ ] Task 7: Layout-shell net (AC: 1) — pin `public/layout.tsx` renders `PublicHeader` → `<main class="flex-1 pt-16">{children}</main>` → `PublicFooter` (structure + that the `children` slot renders). Reference (do not duplicate) `@/components/navigation/PublicHeader|PublicFooter`.
- [ ] Task 8: Green-the-net + DoD gate (AC: 6, 7) — full `npm test -- --run` green at HEAD (record the new baseline count); `tsc --noEmit` clean; `npx eslint` + `npx prettier --check` on the NEW test files (A58/A72, `--write` new files only); LF (A73). No source changes — `git diff --stat` shows only new `*.test.tsx` files.

## Dev Notes

This is the **regression oracle** for the whole epic. The net pins HEAD behaviour so S2/S3/S4 are provably behaviour-preserving. The single hardest E28-specific wrinkle (and the honest divergence from every prior program epic): **the net does NOT survive 100% unchanged** — the five read-only pages flip client→RSC in S2, so their *render harness* adapts (A88/A79). Mitigate by asserting observable behaviour only and isolating the render shell so S2 swaps plumbing, not expectations.

### Scope Boundaries

- In scope: new/extended `*.test.tsx` for the nine pages + the layout shell; the two harness archetypes; the new green baseline. **No source changes, no `features/public/` code.**
- Out of scope: any extraction (S2/S3/S4); i18n changes (en↔de parity holds, hi is a tolerated subset — A56); "fixing" any pinned quirk (routing-by-id, hardcoded `Tags`/`Website`/`CHF` literals, dual error-vs-404 collapse) — pin AS-IS.

### Architecture Guardrails

- **No `QueryClientProvider`, no `useApiClient` in the net** — no public page uses React Query, and `useApiClient` 401-gates on no-auth (`auth.ts:178`) so it is unusable for unauthenticated public endpoints. The transport-agnostic oracle here mocks `fetch` / `@/lib/api/privacy` / `next-intl(/server)`.
- **Stable translator (A64/A78)** is mandatory — `t` sits in the fetch-effect deps of events list/detail and the unsubscribe page; a fresh-function-per-render mock infinite-loops in jsdom. Mirror `events/page.contentlanguage.test.tsx:11-30` (per-namespace memoized) or `events/[id]/page.test.tsx:14-18` (module-scope const).
- **A35/A46:** `afterEach(cleanup)` + `// @vitest-environment jsdom` on every client spec that calls `render()`. The existing `license/page.test.tsx` omits `cleanup` (renders once); normalize NEW specs to the cleanup pattern.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; `prettier --write` only on the NEW test files (A58/A72). Keep files LF (A73). Stable mocks (A78).

### A56 spike findings (load-bearing)

- **9 pages, NOT zero-tested:** license + events/[id] + events.contentlanguage already have specs (EXTEND, don't rewrite — AC-5). The other 6 are net-new.
- **License is already an async Server Component** (`license/page.tsx:18`, `getTranslations`, `fs.readFileSync` of repo `LICENSE` with gnu.org fallback) — its test uses the RSC archetype (`await Page()`); this is the template the S2 conversions adopt.
- **Two detail pages collapse missing/unpublished into a generic error block** (no distinct 404) — pin AS-IS (AC-3).
- **Honeypot silent-success** (contact) is the single most fragile behaviour — pin the pre-fetch truthiness short-circuit AND that `website` is still in the POST payload.
- **Public sponsors page is fully independent** of `features/sponsors/` — pin independently (AC-4).
- **Routing-by-id, hardcoded `Tags`/`Website`/German tier labels/`CHF ${cost}` literals** — behaviour to preserve, not to "fix".

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — provider seam in the net.** A) **No `QueryClientProvider`** — render pages directly (mock `fetch`/`privacy`/`next-intl`); the net diverges deliberately from the E26/E27 self-wrap recipe because no public page uses React Query (`auth.ts:178` makes `useApiClient` unusable). B) self-wrap a QueryClient anyway "for parity". **Recommended: A** (B adds a provider nothing reads — false signal). Document so boundary review doesn't flag the missing provider.
- **DEC-2 — pin the five RSC-bound pages in their HEAD (client) idiom, or pre-emptively in the RSC idiom.** A) pin in the **HEAD client idiom** now (`render(<Page/>)` + `useEffect`-fetch mock), accept that S2 adapts the render shell to `await Page()` (A88-licensed). B) pre-write them as RSC now (would fail — they are `"use client"` at HEAD). **Recommended: A** — the net must be green at HEAD (AC-7), and HEAD is client; the render-harness swap is S2's licensed change (AC-9).

### Testing Requirements

- The full `npm test -- --run` must be green at HEAD before this story closes; record the new total in Completion Notes (it becomes the S2/S3/S4 baseline).
- Assert observable behaviour only (text, resolved i18n keys, `fetch` URL+method+body, status transitions, SEO `<h1>`); snapshot SEO output (AC-8). A35/A46 cleanup; A64/A78 stable mocks.

### Project Structure Notes

- Tests live beside the pages they pin, mirroring the existing suffixed-spec convention (`events/page.contentlanguage.test.tsx`): e.g. `blog/page.test.tsx`, `events/page.loading.test.tsx`, `sponsors/page.test.tsx`, `contact/page.test.tsx`, `newsletter/page.test.tsx`, `unsubscribe/[token]/page.test.tsx`, `public/layout.test.tsx`. No `src/features/public/` directory is created by this story.

### References

- Pages: `frontend/src/app/public/{blog,blog/[id],events,events/[id],sponsors,contact,newsletter,unsubscribe/[token],license}/page.tsx`; `frontend/src/app/public/layout.tsx` (`:11-17` shell skeleton).
- Existing specs to extend: `public/license/page.test.tsx` (`:13-22` RSC `getTranslations` mock, `:37` `await Page()`), `public/events/[id]/page.test.tsx` (`:9-18` `useParams`+stable `t`, `:43-54` URL-routed `fetch`), `public/events/page.contentlanguage.test.tsx` (`:11-30` per-namespace stable translator).
- Transport seams: `frontend/src/lib/api/privacy.ts` (`:112-175` newsletter/unsubscribe public fns); raw inline fetch in the read pages (`blog/page.tsx:36`, `events/page.tsx:56`, `sponsors/page.tsx:54`, `contact/page.tsx:43`).
- `frontend/src/middleware.ts:109-114` (unsubscribe exemption — no redirect to pin against). `frontend/messages/messages.parity.test.ts:46-58` (en↔de identical, hi subset tolerated).
- project-context.md A35/A46/A56/A58/A64/A72/A73/A76/A78/A87/A88/A103; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)". Epic: `epics-and-stories.md` §E28-S1.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E28 preparation (front-loaded batch per A34, user directive "das ganze nächste epic mit allen stories … kein mvp mehr"). Status ready-for-dev. **Blocks S2/S3/S4** (net green at HEAD first). Two DECs carry recommended options for A41/A32 + A43.
- **A56 spike findings (load-bearing):** 9 pages, 3 already-tested (extend, not rewrite); license already RSC (RSC archetype); two detail pages collapse not-found into a generic error block (no `notFound()` today); honeypot silent-success is the fragile behaviour; public sponsors fully independent of `features/sponsors/`; **the net does NOT survive 100% unchanged — the 5 read-only pages' render harness adapts client→RSC in S2 (A88-licensed), the first such case in the program.** No `QueryClientProvider`/`useApiClient` (public is unauthenticated; `useApiClient` 401-gates). No i18n work.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (characterization net over all 9 public pages + layout shell; two harness archetypes — client + RSC; pins honeypot/tier-grouping/state-machines/SEO; DEC-1 no-QueryClientProvider, DEC-2 pin-at-HEAD-client-idiom). Status ready-for-dev.
