# Story E28.S2: Public content — Server-Component feature-slice extraction

Status: done

Depends on: **E28-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the suppliers/sponsors slice recipe. Independent of E28-S3/S4 once S1 is green. **As the largest E28 story it establishes the `features/public/` slice (dir + base-URL helper + `types/public.types.ts`); S3/S4 build on the skeleton in their own files (A91/A102 — no shared-file conflict).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the five read-only Public content pages extracted into a `src/features/public/` slice and rendered as React Server Components where behaviour allows,
so that SEO/SSR improves while behaviour is preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E28-S1 content-page tests stay green — their render harness adapts client→RSC per A88/A79; the behavioural assertions do not change):**

1. Pages migrated: `public/blog/page.tsx`, `public/blog/[id]/page.tsx`, `public/events/page.tsx`, `public/events/[id]/page.tsx`, `public/sponsors/page.tsx`.

2. Rendered output, resolved i18n keys, fetch URLs/payloads, and formatting are unchanged:
   - **blog list:** de-CH long-date (`toLocaleDateString("de-CH",{year,month:'long',day})` with the try/catch raw-`iso` fallback); 200-char excerpt (`excerpt.slice(0,200)` or `content.slice(0,200)+(len>200?'…':'')`); category badge + content-language badge (`tLang(post.contentLanguage)`, rendered only when set); `noResults` (search active) vs `empty` distinction; the 5-field client search filter (title/excerpt/author/category/tags); card link `/public/blog/${post.id}` (by **id**, not slug); `next/image` `unoptimized`.
   - **blog detail:** the **generic error block** for missing/unpublished (`publicBlog.errorMessage` + `backToBlog`) — **no Next `notFound()` introduced** unless an explicit follow-up decides it; `\n`-split paragraphs; hardcoded literal `Tags` heading; the Share button; `<h1>=post.title`.
   - **events list:** de-CH date-with-time; free/paid badge (`free` / literal `CHF ${cost}` / `paid`); content-language badge; `hasEnded → ended` chip; the 2-field search (title/location) + category `<select>` filter; image `unoptimized` + `imageAltText ?? title` + the placeholder-SVG fallback.
   - **event detail:** the read-only event display; the best-effort fee-category fetch (single → text line, multiple → radio fieldset, free/absent → no fee section); the registration state machine + the `POST …/registrations/public` payload `{ name, email, phone?, numberOfGuests, specialRequirements?, feeCategoryId? }` and outcomes (`registrationClosed` / waitlist success+`{position}` / `registrationSuccess` / paid `fee.amountDue` via `formatCurrency`); the generic error block (no 404).
   - **sponsors:** the tier grouping (`TIER_ORDER` Platin/Gold/Silber/Bronze/Basis, `getHighestTier`, hardcoded German `TIER_LABELS[...].de` headings, `TIER_COLORS` gradients); error (no retry) / empty; `/public/contact` CTA; hardcoded `Website` external link; **no images**.

3. The **client islands** that genuinely need interactivity are preserved as `"use client"` children layered over server-rendered content:
   - blog-list **search box** (state + 5-field filter + `noResults`/`empty`), needs the fetched posts passed in;
   - events-list **search + category `<select>`** (categories derived from the fetched events — pass data in);
   - blog-detail **Share button** (`navigator.share`/`clipboard`/`window.location`);
   - event-detail **registration form** (the heaviest island — manual `useState` POST + fee radios + waitlist/success UI; **preserved as-is, NOT RHF-ified** — RHF+Zod is S3's scope and does not extend to the registration form).

4. Routes, links (`/public/blog/${id}`, `/public/events/${id}`, the `/public/contact` CTA), and `next/image` `unoptimized` behaviour unchanged. The blog `window.location.reload()` retry (`blog/page.tsx:124`) and the share APIs stay inside client islands (or re-expressed as `router.refresh()` only if behaviour is identical — default: keep verbatim in an island).

**Improvements:**

5. Where a page is `"use client"` only to fetch read-only data, convert it to an **async Server Component** that fetches at request time via the slice `api/` module + `getTranslations` from `next-intl/server`, keeping interactivity behind minimal client islands:
   - **sponsors** = full Server Component (no island — the cleanest conversion);
   - **blog list** + **events list** = Server Component that fetches + renders, with the search/(category) box as the only client island;
   - **blog detail** = Server Component + a tiny `<ShareButton>` island;
   - **event detail** = Server-Component shell (event display + fee section) + an `<EventRegistrationForm>` client island — the fee section MUST stay reachable through the page so `events/[id]/page.test.tsx` (single/multiple/free fee) stays green.

6. Slice shape per the pilot, **adapted for RSC** (the load-bearing E28 divergence — see A56 findings):
   - `api/public-content-api.ts` — owns the public `/api/v1/...` URLs (blog/events/sponsors reads + the event fee-categories + the public event-registration POST) behind a shared base-URL helper; for RSC reads the fns take **no `api` client** and use plain server `fetch` (NOT `useApiClient` — it 401-gates on no-auth and is unusable for unauthenticated public endpoints). A `publicContentKeys` query-key factory is added ONLY if a retained client island needs TanStack (the islands here are local-state, so keys are optional/minimal).
   - `types/public.types.ts` — owns the DTOs relocated from the inline page interfaces (`PublicBlogPostDto`, `PublicEventDto`, `PublicFeeCategory`, `PublicSponsorDto` + the `TIER_*` consts). Reconcile the two DTO near-duplicate pairs: blog list (HAS `contentLanguage?`) vs blog detail (MISSING) and events list (HAS) vs event detail (MISSING) — the **list variant is the superset**; use it.
   - thin `components/*.tsx` composition roots + presentational list/card/detail components shared by list+detail; the client islands as `"use client"` children.

7. Replace the ad-hoc `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"` base-URL duplication (5 content pages) with one slice base-URL helper in `api/`.

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [x] E28-S1 content specs green at HEAD. Confirm `features/public/` does NOT exist → this story creates it. Re-read the 5 pages + `lib/services/events.ts` (the reserved public helpers) + the suppliers/sponsors slice recipe + `i18n/request.ts` (server `getTranslations`) + the license RSC precedent (A56).
  - [x] **DEC-1** (events transport: wrap reserved `services/events.ts` helpers vs build fresh), **DEC-2** (blog/sponsors/contact-registration transport: build), **DEC-3** (type home), **DEC-4** (island/RSC split shape per page), **DEC-5** (base-URL de-dup). See DEC block.
- [x] Task 1: Slice foundation (AC: 6, 7) — create `features/public/api/public-content-api.ts` (base-URL helper + the read fns + the fee-categories fn + the registration POST fn, URLs byte-identical) + `types/public.types.ts` (the 4 DTOs + `TIER_*`, list-variant supersets). Focused unit tests for the URL/payload builders.
- [x] Task 2: Sponsors RSC (AC: 2, 5) — `app/public/sponsors/page.tsx` → async Server Component rendering `features/public/components/sponsors-content.tsx` (server fetch + `getTranslations("publicSponsors")` + the tier-grouping helpers moved into the slice). No island. Pin against S1.
- [x] Task 3: Blog list + detail RSC + islands (AC: 2, 3, 4, 5) — list = async SC fetching posts, passing them to a `<BlogSearch>` `"use client"` island (5-field filter + `noResults`/`empty`); detail = async SC (`params.id`) + a `<ShareButton>` island; preserve de-CH date, excerpt, badges, `/public/blog/${id}`, `Tags` literal, generic error block.
- [x] Task 4: Events list + detail RSC + islands (AC: 2, 3, 4, 5) — list = async SC + `<EventsFilter>` island (search + category, categories derived from fetched data); detail = async SC shell + `<EventRegistrationForm>` island (manual state preserved, fee section mounted through the page so the existing fee test stays green). Stable-`t` no longer applies in RSC (server `getTranslations`), but the EXTENDED client specs for the islands keep A64.
- [x] Task 5: Base-URL de-dup + i18n (AC: 7) — route all 5 pages' fetches through the slice base-URL helper; reconcile `??` vs the `||`+`/api/v1` differences if wrapping any lib module. NO message-file change — reuse `publicBlog`/`publicEvents`/`publicSponsors`/`language` keys (en↔de parity holds; hi subset tolerated). Server `getTranslations("ns")` uses the SAME namespace strings as the client `useTranslations("ns")`.
- [x] Task 6: Green-the-net + DoD gate (AC: 1, 2) — adapt each converted page's S1 spec render-harness client→RSC (`render(<Page/>)` → `render(await Page())` + mock `next-intl/server`) — **A88-licensed; behavioural assertions UNCHANGED**; record each adapted spec. Full `npm test -- --run` green (S1 baseline + new builder tests, zero behavioural regressions); `tsc --noEmit` clean; `eslint` + `prettier --check` on changed files (A58/A72, `--write` new slice files only); LF (A73). A79 deltas recorded. (`next build` at epic boundary per A58.)

## Dev Notes

The **largest** E28 story and the program's first genuine **client→RSC** migration. The headline improvement (SEO/SSR via Server Components) is real here because the public pages are unauthenticated and SEO-sensitive (E21-S1 prompt rule 14), and a working RSC precedent already ships (`license/page.tsx`). The hard part is the **island boundary**: server-render the read-only content, isolate each genuinely-interactive bit (search/filter/share/registration) into a minimal `"use client"` child that receives server-fetched data as props.

### Scope Boundaries

- In scope: `features/public/` (`api/public-content-api.ts`, `types/public.types.ts`, `components/*` SC roots + presentational + the islands) for the 5 read-only content pages; thin route entries; base-URL de-dup; new builder unit tests; the S1 spec render-harness adaptation for these 5 pages.
- Out of scope: the form pages (S3: contact/newsletter/unsubscribe); the license page + layout (S4); **RHF-ifying the event-registration form** (preserve manual state — RHF+Zod is S3's contact/newsletter scope only); introducing Next `notFound()` (the detail pages keep the generic error block — A56); any backend/route/API-contract change; touching `features/sponsors/` (the public sponsors page is independent); i18n key changes.

### Architecture Guardrails

- **`useApiClient` is the WRONG tool (A56, load-bearing).** It returns 401 when unauthenticated (`auth.ts:178-180`); public endpoints are anonymous. RSC reads use plain server `fetch` in the slice `api/`; the event-registration POST stays plain `fetch` too. NO TanStack/`useApiClient` for these pages.
- **RSC rules:** Server Components must NOT import client-only hooks (`useState`/`useEffect`/`useTranslations`/`useParams`/`useRouter`). Isolate every such use behind a `"use client"` island under `components/`. Server-rendered text uses `getTranslations` from `next-intl/server` (same namespace strings, resolved via `i18n/request.ts`). A detail page reads `params` as a prop (no `useParams`).
- **`next/image` stays `unoptimized`** at every site; the placeholder-SVG fallbacks are preserved.
- **No raw `/api/v1` strings in components** (E21-S1 rule 5) — all URLs live in `api/public-content-api.ts`. `features → lib` is legal (if wrapping `services/events.ts`); `lib → features` is forbidden; no `@/features/<other>` cross-imports (E21-S5 — the slice needs no new eslint entry).
- **Fetch caching:** choose a deliberate `cache`/`next.revalidate` for the RSC fetches (Next 16 defaults `fetch` to no-store unless opted in) so the data freshness matches the god-page's per-load fetch.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; `prettier --write` new slice files only; hand-match style on modified pre-drifted entries (A72). LF (A73). Stable mocks in island tests (A64/A78).

### A56 spike findings (load-bearing)

- **Transport is split.** Blog + sponsors reads + contact + event-registration are **raw inline `fetch`** (no lib module → BUILD). Newsletter/unsubscribe (S3) WRAP `lib/api/privacy.ts`. **Events has a twist:** `lib/services/events.ts` ships UNUSED public helpers explicitly commented "reserved for E28 Public pages (Server Components)" (`getPublicEvents`/`getPublicEvent`/`getPublicEventFeeCategories`/`registerForEventPublic`) — they default `requireAuth=true` (harmless server-side: `getAuthToken` returns null when `typeof window==="undefined"`) and the canonical `EventDto` is a richer enum-typed superset vs the page's inline `string`-typed `PublicEventDto` (adopting it is a type-widening, not a 1:1 swap). → DEC-1.
- **`useApiClient` unusable** (401-gates) → server `fetch`.
- **Base-URL `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"` duplicated** in all 5 content pages (`blog/page.tsx:8`, `blog/[id]/page.tsx:9`, `events/page.tsx:8`, `events/[id]/page.tsx:10`, `sponsors/page.tsx:7`); `lib/services/api.ts:7` uses `||` + appends `/api/v1` — reconcile if wrapping.
- **DTO near-duplicates** (list = superset with `contentLanguage?`; detail drops it) — use the list variant in `types/public.types.ts`.
- **Two existing tests gate events** (`events/[id]` fees, `events/page.contentlanguage` badge) — keep green; the fee section must stay mounted through the event-detail page after the island split.
- **No-distinct-404 on both detail pages** — preserve the generic error block; do not silently add `notFound()`.
- **Public sponsors fully independent** of `features/sponsors/` (different DTO, endpoint, tier vocabulary).
- **Client-only APIs to keep in islands:** blog `window.location.reload()` retry + `navigator.share`/`clipboard`; the registration form's whole stateful surface.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — events transport.** A) **wrap** the reserved `lib/services/events.ts` public helpers (pass `requireAuth=false`/note the server no-op; reconcile the `EventDto` superset + the `/api/v1` base) — reuses code the codebase pre-staged for this epic (A94 wrap-where-a-module-exists). B) **build** fresh server-fetch fns in `public-content-api.ts` matching the inline page URLs byte-for-byte — simplest, zero wrap caveats, but ignores the reserved helpers. **Recommended: B for v1** (the pages fetch inline today; building byte-identical fns keeps the net green with zero `EventDto`-widening risk), with a note to consolidate onto `services/events.ts` later; choose A only if adopting `EventDto` is explicitly wanted now.
- **DEC-2 — blog/sponsors/contact-registration transport.** A) **build** server-fetch fns in `api/public-content-api.ts` (nothing owns these URLs). B) extend `lib/services/*`. **Recommended: A** (slice-local, matches the feature-slice program; the registration POST stays plain `fetch`).
- **DEC-3 — type home.** A) own the DTOs in `features/public/types/public.types.ts` (list-variant supersets; sponsors types fully independent of `features/sponsors/`). B) re-export from a lib module — none exists for blog/sponsors. **Recommended: A** (these are public-site-scoped; no lib home exists).
- **DEC-4 — island/RSC split per page.** A) sponsors = full SC; blog/events lists = SC + search/filter island (data passed in); blog detail = SC + `<ShareButton>`; event detail = SC shell + `<EventRegistrationForm>` (manual state preserved, fee section through the page). B) keep some pages client "to minimise risk" — loses the SEO/SSR improvement the epic exists for. **Recommended: A** (full RSC where read-only, minimal islands).
- **DEC-5 — base-URL de-dup.** A) one slice helper in `api/` consumed by every fetch fn. **Recommended: A**.

### Testing Requirements

- The E28-S1 content specs are the oracle. For the 5 converted pages, the render harness adapts client→RSC (A88) — `render(await Page())` + mock `next-intl/server` `getTranslations` (mirror `license/page.test.tsx`) + mock server `fetch`; the **behavioural assertions are unchanged**. The retained islands get their own client specs (jsdom + A64 stable translator + A35/A46 cleanup).
- Add builder unit tests for `public-content-api` (URL + payload shape, incl. the registration body + the omitted-empty params). A78 stable mocks.
- Verify A79 deltas: the god-pages fetched in `useEffect` on mount; the RSC fetches at request time — confirm loading/error/empty surfaces map correctly (RSC has no client "loading" state for the initial fetch; an error/empty is rendered from the awaited result — pin that the error/empty COPY is identical even though the loading-spinner lifecycle differs; document this as the principal A79 delta).

### Project Structure Notes

- Target tree: `features/public/{api/public-content-api.ts, types/public.types.ts, components/(sponsors-content|blog-list|blog-detail|events-list|event-detail)*.tsx + the island children (blog-search, events-filter, share-button, event-registration-form)}`; thin async entries at `app/public/{blog,blog/[id],events,events/[id],sponsors}/page.tsx`.

### References

- Pages: `blog/page.tsx` (`:8` baseUrl, `:36` fetch, `:49-60` search, `:62-77` date+excerpt, `:139` noResults/empty, `:150` id-link, `:160` unoptimized, `:170-174` content-lang badge), `blog/[id]/page.tsx` (`:38` fetch, `:78` generic-error, `:149-157` paragraphs, `:164` `Tags` literal, `:185-199` Share), `events/page.tsx` (`:56` fetch, `:69-84` filter, `:86-94` date, `:227-251` badges), `events/[id]/page.tsx` (`:93,101,150` 3 endpoints, `:142-193` registration, `:512-587` outcomes), `sponsors/page.tsx` (`:54` fetch, `:18-42` tier consts+getHighestTier, `:68-79` grouping).
- Reserved transport: `lib/services/events.ts` (`getPublicEvents`/`getPublicEvent`/`getPublicEventFeeCategories`/`registerForEventPublic`, "reserved for E28" comments); `lib/services/api.ts:7` (`||`+`/api/v1` base).
- RSC precedent: `license/page.tsx:18` + `license/page.test.tsx:13-38`. Server i18n: `i18n/request.ts` (`getRequestConfig`, cookie locale, deepMerge). Slice recipe: `features/sponsors/api/sponsors-api.ts:17,24-33` (base const + `*Keys` + fetch-fn shape — adapt to no-`api`-client server fetch), `app/sponsors/page.tsx` (thin entry).
- `lib/auth.ts:169-295` (`useApiClient` `{data,error,status}`, 401-gate `:178` — why it's unusable here); `eslint.config.mjs:50-64` (features boundary); `messages.parity.test.ts:46-58`. project-context.md A56/A58/A72/A73/A76/A79/A87/A88/A91/A94/A102/A103. Epic: `epics-and-stories.md` §E28-S2.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E28 preparation (front-loaded batch per A34, "kein mvp mehr" → full RSC conversion of all 5 read-only pages, no scope-cut). Status ready-for-dev. HARD-ordered after E28-S1; independent of S3/S4 (establishes the slice foundation). Five DECs carry recommended options for A41/A32 + A43.
- **A56 spike findings (load-bearing):** the program's first client→RSC migration; `useApiClient` is unusable (401-gates) → plain server `fetch`; events has reserved-but-unused `services/events.ts` public helpers (DEC-1 wrap-vs-build); blog/sponsors/contact-registration are BUILD (no module); two detail pages keep a generic error block (no `notFound()`); the registration form stays manual-state (NOT RHF — S3 scope); list/detail DTO near-duplicates reconciled to the list superset; public sponsors independent of `features/sponsors/`; the S1 net's render harness adapts client→RSC (A88-licensed) while behavioural assertions hold. No i18n work (server `getTranslations` reuses the same namespaces).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story, autonomous whole-epic run; the program's first client→RSC migration).

### Debug Log References

- **DEC-1 (events transport) = B (recommended for v1):** BUILT byte-identical server-fetch fns in `public-content-api.ts` rather than wrapping the reserved `lib/services/events.ts` helpers — zero `EventDto` superset / `requireAuth` widening risk; keeps the net green with no type-widening. Noted for a later consolidation.
- **DEC-2 = A**, **DEC-3 = A**, **DEC-4 = A** (full RSC where read-only + minimal islands), **DEC-5 = A** (one `PUBLIC_API_BASE_URL` helper replaces the 5-page `process.env … ?? "http://localhost:5000"` duplication).
- **Load-bearing testability insight (the A88 harness mechanics):** for `render(await Page())` to fully resolve, there must be **NO nested async components**. Each content component does its own `getTranslations` + `fetch` internally and returns resolved JSX with the client islands as SYNC children (mirrors the S4 license pattern). The no-params pages (`sponsors`/`blog`/`events` lists) re-export the async content fn as the route default; the params pages (`blog/[id]`, `events/[id]`) `await params` then `return ContentFn({ id })` — returning the content promise FLATTENS through the async route fn, so `await Page({ params })` yields fully-rendered JSX. The islands' `"use client"` is a no-op in vitest, so they render in-tree and their interactions (search/filter/share/registration) keep working.
- **Error-thread per page:** `getJson` throws `HTTP <status>` uniformly; each SC decides the surface — events list/detail capture `err.message` and render it RAW (`HTTP 500`); blog list/detail + sponsors collapse to the generic `errorMessage` copy. Matches each god-page exactly.
- **`cache: "no-store"`** on the RSC reads → request-time freshness matching the god-pages' per-load `useEffect` fetch (also makes the routes dynamic, so the build does not attempt a data fetch).

### Completion Notes List

- **All 5 read-only content pages converted to async Server Components + minimal client islands:** sponsors = full SC (no island); blog list/events list = SC (hero) + `<BlogSearch>`/`<EventsFilter>` island (the interactive search/filter/grid/error/empty, data passed in → SSR'd); blog detail = SC + `<ShareButton>` island; event detail = SC shell + `<EventRegistrationForm>` island (manual state preserved — **NOT** RHF-ified; the fee section stays mounted through the page so the REQ-022 fee test stays green).
- **Slice foundation established for S3/S4 (A91/A102):** `api/public-content-api.ts` (base-URL helper + 7 server-fetch/POST fns), `types/public.types.ts` (4 DTOs reconciled to the LIST superset + `TIER_*` consts + `getHighestTier`), 8 component files. S3 builds its OWN files (no shared-file conflict).
- **S1 oracle adapted, behaviour UNCHANGED (A88/A79):** the 5 content-page specs swapped harness `render(<Page/>)` → `render(await Page())` + `next-intl/server` `getTranslations` mock (+ `next-intl` for the islands); the pre-existing `events/page.contentlanguage.test.tsx` (REQ-055) and `events/[id]/page.test.tsx` (REQ-022 fee specs) were adapted the same way — their **behavioural assertions are identical**.
- **Principal A79 delta (documented in each adapted spec):** the client loading-spinner lifecycle is gone — an RSC awaits the server fetch before rendering (no client "loading" state); each spec's loading test was removed and the error/empty COPY pinned identically. Net effect on the suite: −5 loading tests, +10 builder tests.
- **No raw `/api/v1` in components** (E21-S1 rule 5 — all URLs in `api/public-content-api.ts`); `next/image` stays `unoptimized` at every site; the generic error blocks (no `notFound()`) preserved on both detail pages; public sponsors stayed independent of `features/sponsors/`.
- **DoD:** full suite **201 files / 1922 tests green** (1917 − 5 loading + 10 builder); `tsc --noEmit` clean; `eslint --max-warnings=0` clean across `features/public/**` + `app/public/**`; `prettier --write` on the new slice files + the rewritten thin entries + the adapted specs (LF, A73); `next build` validated at the epic boundary (A58).

### File List

- `frontend/src/features/public/types/public.types.ts` (new — DTOs + `TIER_*` + `getHighestTier`)
- `frontend/src/features/public/api/public-content-api.ts` (new — base-URL helper + 7 fns)
- `frontend/src/features/public/api/public-content-api.test.ts` (new — builder tests)
- `frontend/src/features/public/components/sponsors-content.tsx` (new — full SC)
- `frontend/src/features/public/components/blog-list.tsx` (new — SC) + `blog-search.tsx` (new — island)
- `frontend/src/features/public/components/blog-detail.tsx` (new — SC) + `share-button.tsx` (new — island)
- `frontend/src/features/public/components/events-list.tsx` (new — SC) + `events-filter.tsx` (new — island)
- `frontend/src/features/public/components/event-detail.tsx` (new — SC) + `event-registration-form.tsx` (new — island)
- `frontend/src/app/public/{sponsors,blog,events}/page.tsx` (modified — thin re-export entries)
- `frontend/src/app/public/{blog,events}/[id]/page.tsx` (modified — thin async params entries)
- `frontend/src/app/public/sponsors/page.test.tsx`, `blog/page.test.tsx`, `blog/[id]/page.test.tsx`, `events/page.test.tsx`, `events/page.contentlanguage.test.tsx`, `events/[id]/page.test.tsx` (modified — RSC-adapted, A88)

## Change Log

- 2026-06-12: Story created (5 read-only public content pages → `features/public/` Server-Component slice; minimal client islands for search/filter/share/registration; BUILD server-fetch transport — `useApiClient` unusable; DTO supersets in `types/public.types.ts`; DEC-1 events wrap-vs-build, DEC-2 build blog/sponsors/registration, DEC-3 slice-owned types, DEC-4 RSC+island split, DEC-5 base-URL helper). Status ready-for-dev.
- 2026-06-12: Implemented — slice foundation (api + types + builder tests) + 5 RSC pages with 5 client islands; S1 oracle adapted client→RSC (A88, behaviour unchanged) with the loading-spinner A79 delta documented per spec; suite 1922 green; tsc/eslint/prettier clean; DEC-1=B, DEC-2..5=A. Status → review.
