# Story E28.S3: Public forms — feature-slice extraction

Status: done

Depends on: **E28-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the **E22 form sub-recipe** (`features/sponsors/components/sponsor-form.tsx` + `schemas/sponsor.schema.ts`). Independent of E28-S2/S4 once S1 is green. **Builds in its OWN slice files (`api/public-forms-api.ts`, `schemas/*`, the form islands) — no shared-file conflict with S2's `public-content-api.ts`/`types` (A91).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want the three Public form/flow pages extracted into the `src/features/public/` slice with RHF+Zod client islands (where they are forms),
so that form handling is consistent with the E22 form sub-recipe while behaviour is preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E28-S1 form-page tests stay green):**

1. Pages migrated: `public/contact/page.tsx`, `public/newsletter/page.tsx`, `public/unsubscribe/[token]/page.tsx`.

2. **Contact** — all of the following unchanged:
   - the **honeypot** (`website`) silent-success short-circuit: `if (website) { setStatus("success"); return; }` runs **before** the fetch and reads the raw value (`contact/page.tsx:34-38`);
   - the `idle→loading→success` swap to the "send another" panel (`successTitle`/`successMessage`/`sendAnother` → `resetForm`); the `error` banner (`errorMessage`); the submit-button label swap `loading ? sending : error ? retry : submit`;
   - the `subject` `<select>` option set: `""`(placeholder, disabled) / `general` / `membership` / `events` / `sponsoring` / `other` — same values, same order;
   - the `POST /api/v1/public/contact` payload **`{ name, email, subject, message, website }`** (key set + that `website` is still sent);
   - the sidebar: `useAppSettings().settings.applicationName` (the only dynamic value — `contact/page.tsx:337`) + the hardcoded-i18n email/phone/address/opening-hours.

3. **Newsletter** — unchanged: the subscribe/unsubscribe tab toggle + per-tab `resetForm`; subscribe submit `subscribeNewsletter(email, firstName || undefined, lastName || undefined)` → `POST /api/v1/public/newsletter/subscribe` body `{ email, firstName?, lastName? }` (**empty names dropped via `|| undefined`** — load-bearing); unsubscribe submit `unsubscribeByEmail(email)` → `POST /api/v1/public/newsletter/unsubscribe` body `{ email }`; per-tab success panels (`subscribeSuccess`/`unsubscribeSuccess`) + per-tab error (`subscribeError`/`unsubscribeError`) + loading label swaps; the `useAppSettings().settings.applicationName` interpolation in `subscribeDescription`.

4. **Unsubscribe `[token]`** — the param-driven flow preserved **exactly**: `verifyUnsubscribe(token)` on mount → `confirm` (with `confirmText({email})`) vs `already`; `confirmUnsubscribe(token)` on click → `success`; the five `PageState` renders (`loading`/`confirm`/`already`/`success`/`error`) with their i18n keys; error text precedence (`invalidToken` / `err.message` / `error`). **No redirect, no auth check** introduced (middleware exempts `/public/unsubscribe*` for compliance — `middleware.ts:109-114`). This page is **NOT an RHF form** — it has no editable inputs, only a confirm button; migrate it as a state-machine client island, explicitly excluded from the RHF+Zod recipe.

**Improvements:**

5. **Contact + newsletter forms reshaped to RHF + Zod** per the E22 sub-recipe (mirror `sponsor-form.tsx` + `sponsor.schema.ts`):
   - `schemas/public-contact.schema.ts` + `schemas/public-newsletter.schema.ts` (Zod);
   - one shared form component per form under `components/` (`<ContactForm>`, `<NewsletterForm>` or per-tab), `<form noValidate>`, `handleSubmit(onSubmit)`, per-field error render `t(errors.x.message ?? "form.required")`, caller-owns-transport (the page/content component passes `onSubmit` + `pending` + `errorMessage`);
   - mutation via the slice `api/` module with the **existing endpoints** (no contract change).

6. Forms remain `"use client"` islands (genuine interactivity); the surrounding hero/sidebar may be server-rendered only where it does not break the E28-S1 pins **and** does not require threading the client-only `useAppSettings` context as props (the contact/newsletter sidebars read `settings.applicationName` from a client context — keeping the page a client island is the lower-risk default; see DEC-2).

7. `api/public-forms-api.ts` encapsulates the contact/newsletter/unsubscribe `/api/v1/...` URLs: **WRAP** the existing `@/lib/api/privacy.ts` public fns for newsletter + unsubscribe (do not edit `privacy.ts` — A87/A94); **BUILD** the contact `POST /api/v1/public/contact` fn (raw inline today, no module). The honeypot remains client-side and is NOT routed through validation in a way that alters the silent-success behaviour.

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [x] E28-S1 form specs green at HEAD. Confirm `features/public/` exists (S2 may have created it) or create the slice dir. Re-read the 3 pages + `lib/api/privacy.ts` + `sponsor-form.tsx`/`sponsor.schema.ts`/`sponsor-form.test.tsx` (the form recipe) + `AppSettingsProvider` (A56).
  - [x] **DEC-1** (transport wrap-vs-build), **DEC-2** (server-shell vs full-client-island), **DEC-3** (honeypot placement in RHF), **DEC-4** (`subject` `z.string().min(1)` vs `z.enum`), **DEC-5** (unsubscribe non-RHF island). See DEC block.
- [x] Task 1: Slice api (AC: 7) — `api/public-forms-api.ts`: WRAP `subscribeNewsletter`/`unsubscribeByEmail`/`verifyUnsubscribe`/`confirmUnsubscribe` from `@/lib/api/privacy` (re-export/thin-wrap — `privacy.ts` untouched, sibling-safe); BUILD `submitContact(payload)` → `POST /api/v1/public/contact` (`{ name, email, subject, message, website }`, byte-identical headers/order). Builder unit tests (URL/method/payload).
- [x] Task 2: Zod schemas (AC: 5) — `schemas/public-contact.schema.ts` (`name`/`email`/`subject`/`message` required, `website` honeypot; **no `.email()`/`.url()`** — the god-form does zero format validation, A96; required = `z.string().min(1,"form.required")`, NOT `.trim()` on fields whose bytes must match) + `schemas/public-newsletter.schema.ts` (`email` required; `firstName`/`lastName` optional bare `z.string()`). `defaultValues` = empty strings (match controlled-input initial state).
- [x] Task 3: Contact form island (AC: 2, 5, 6) — `<ContactForm>` `"use client"` mirroring `sponsor-form.tsx`: `noValidate`, per-field `t(errors.x.message ?? "form.required")`, the honeypot pre-fetch short-circuit as the first line of `onSubmit` reading the raw `website` (DEC-3), the 6 subject options (byte-identical), the status machine + "send another" panel + label swap, the `submitContact` call. The sidebar (`settings.applicationName` + hardcoded-i18n) preserved. Client spec (jsdom + A64 stable `t` + A35/A46).
- [x] Task 4: Newsletter form island (AC: 3, 5, 6) — `<NewsletterForm>` with the subscribe/unsubscribe tabs (tab stays component-local state, NOT an RHF field) + per-tab reset; the `firstName || undefined`/`lastName || undefined` coercion preserved at the call site (so empty names stay out of the body); the `subscribeDescription` `applicationName` interpolation. Client spec.
- [x] Task 5: Unsubscribe island (AC: 4) — `<UnsubscribeFlow>` `"use client"` state-machine island (NOT RHF): `useParams` token → `verifyUnsubscribe` on mount → `confirm`/`already`; `confirmUnsubscribe` → `success`; the five states + keys; no redirect/auth. Client spec covering all five states.
- [x] Task 6: Thin route entries (AC: 1, 6) — `app/public/{contact,newsletter,unsubscribe/[token]}/page.tsx` → render the slice islands. Decide per DEC-2 whether the page is a thin server entry wrapping a client island or stays a client root (default: client root for contact/newsletter due to `useAppSettings`).
- [x] Task 7: Green-the-net + DoD gate (AC: 1-4) — E28-S1 form specs green (the honeypot, status transitions, payload shape, token flow assertions UNCHANGED; the render harness stays client — these pages do NOT convert to RSC, so no A88 adaptation needed, unlike S2); the deliberate A79/A95/A96 deltas (whitespace-only now blocked on required fields via `min(1)`; `noValidate` + per-field errors) recorded. Full `npm test -- --run` green (S1 baseline + new schema/form/builder tests); `tsc --noEmit` clean; `eslint` + `prettier --check` on changed files (A58/A72, `--write` new slice files only); LF (A73). A regression test: a no-touch contact edit-save / honeypot-filled submit emits the exact HEAD behaviour.

## Dev Notes

This story applies the **E22 RHF+Zod form sub-recipe** to the two real public forms (contact, newsletter) and migrates the unsubscribe **confirm-flow** (not a form) as a preserved state-machine island. The single most fragile behaviour is the contact **honeypot silent-success** — it must stay a pre-fetch, raw-value, untrimmed guard. Two transports already live in `@/lib/api/privacy.ts` (WRAP, never edit — A87/A94); contact is inline raw fetch (BUILD).

### Scope Boundaries

- In scope: `features/public/` `api/public-forms-api.ts` (wrap privacy + build contact), `schemas/public-{contact,newsletter}.schema.ts`, the `<ContactForm>`/`<NewsletterForm>` RHF islands + the `<UnsubscribeFlow>` state-machine island, thin route entries; new schema/form/builder tests.
- Out of scope: the content pages (S2) + the registration form on event-detail (S2, kept manual); the license/layout (S4); editing `@/lib/api/privacy.ts` (A87 — wrap only; it also owns authenticated consent endpoints used elsewhere, so do NOT absorb it wholesale); RHF on the unsubscribe page (it has no inputs); adding `.email()`/`.url()` validation (behaviour change — A96); i18n key changes (`publicContact`/`newsletter`/`unsubscribe` exist en↔de; `form.required` exists `en.json:436`).

### Architecture Guardrails

- **Form recipe (mirror `sponsor-form.tsx`):** `"use client"`; `useForm({ resolver: zodResolver(schema), defaultValues })`; `<form onSubmit={handleSubmit(onSubmit)} noValidate>`; error banner above the form gated on `errorMessage`; per-field `{errors.x && <p className="...text-red-600">{t(errors.x.message ?? "form.required")}</p>}`; the form does NOT own transport — `onSubmit`/`pending`/`errorMessage` come from the caller (A102/A103 builders-only split).
- **A96 — never `.trim()` a field whose submitted bytes must match the god-page**, and a `noValidate` form MUST render per-field Zod errors. Required fields use `z.string().min(1,"form.required")` (the deliberate A79 delta: whitespace-only now blocked where HTML5 `required` let a single space through — acceptable, document it). Do NOT trim the honeypot.
- **A95 — `subject` must round-trip the option set:** use `z.string().min(1,"form.required")` (NOT `z.enum(subset)`); keep the 6 markup option values byte-identical; the empty placeholder `""` validates as "required".
- **`useApiClient` is unusable** (401-gates on no-auth — `auth.ts:178`); these public POSTs go through the wrapped `privacy.ts` (plain fetch) / the built contact fn (plain fetch). No TanStack needed (the forms are local-state; a `useMutation` is optional — default to a plain async `onSubmit` matching the god-page).
- `features → lib` legal (wrap `privacy.ts`); no `@/features/<other>` cross-import; slice needs no new eslint entry (E21-S5). No raw `/api/v1` in components — URLs live in `api/public-forms-api.ts`.
- DoD: `npm run typecheck` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` only. NEVER `npm run format`; `prettier --write` new slice files only (A72). LF (A73). A64/A78 stable mocks.

### A56 spike findings (load-bearing)

- **Honeypot (contact `:34-38`)** = `website`; silent-success short-circuit runs BEFORE `setStatus("loading")` and the fetch, on the raw value; `website` is STILL in the POST payload `{name,email,subject,message,website}` (`:46`). Keep the guard as the first line of `onSubmit`, untrimmed, and keep `website` in the body.
- **Newsletter `|| undefined` coercion (`:35-36`)** keeps empty first/last names OUT of the JSON (`privacy.ts` `JSON.stringify` drops `undefined`). If RHF passes `firstName:""` straight through, the payload changes — preserve the coercion at the call site.
- **`useAppSettings` surface is tiny** — only `settings.applicationName` (contact `:337`, newsletter `:164`); everything else in the sidebar is hardcoded i18n. The sidebar can be preserved verbatim. `useAppSettings` is a **client** context → keeping the page a client island is the low-risk default (DEC-2).
- **Unsubscribe `[token]` is NOT a form** — a `useEffect`-verify + confirm-button state machine over `verifyUnsubscribe`/`confirmUnsubscribe`; no editable inputs; no redirect/auth (middleware-exempt). Do NOT shoehorn RHF onto it.
- **Two transports already in `lib/api/privacy.ts`** (`:112-175`: subscribe/unsubscribe/verify/confirm) → WRAP; contact is inline raw fetch (`contact/page.tsx:43`) → BUILD. `privacy.ts` also owns authenticated consent/channel endpoints → wrap the public fns, don't relocate the module.
- **No existing tests** for any of the 3 pages (S1 adds the net first).
- **`subject` placeholder `""` is `disabled`** (`:181`) — A95: validate as required, keep options byte-identical.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — transport wrap-vs-build (A94).** A) WRAP `privacy.ts` (newsletter+unsubscribe — zero-edit, sibling-safe) + BUILD a slice `submitContact` fn (contact). B) build all four fresh (duplicates the privacy logic). **Recommended: A** (wrap where a module exists, build where none does).
- **DEC-2 — server-shell vs full-client-island.** A) keep the contact/newsletter pages **client islands** (the sidebars read `settings.applicationName` from the client-only `AppSettingsProvider` context; threading it as a prop from a server parent gains little). B) split a static server hero from the form island and pass `applicationName` down. **Recommended: A** (lowest-risk, behaviour-preserving; defer any server-shell of these pages).
- **DEC-3 — honeypot placement in RHF.** A) keep `website` a registered RHF field with `if (values.website) { setStatus("success"); return; }` as the FIRST line of `onSubmit` (reads raw value, no trim, stays in payload — mirrors `:34-38`). B) handle outside RHF. **Recommended: A** (keeps it in form state + payload, preserves the silent-success trigger exactly).
- **DEC-4 — `subject` schema.** A) `z.string().min(1,"form.required")` (round-trips the placeholder default as "required", keeps the 6 option values byte-identical — A95). B) `z.enum([6 values])` (the empty default is an invalid enum member at init → friction). **Recommended: A**.
- **DEC-5 — unsubscribe is non-RHF.** A) migrate as a state-machine client island, explicitly excluded from the RHF recipe, five states pinned. **Recommended: A** (it has no editable inputs).

### Testing Requirements

- The E28-S1 form specs are the oracle and stay client (these pages do NOT convert to RSC — no A88 render-harness change, unlike S2). They must stay green: honeypot silent-success, status transitions, payload byte-shape, the token flow. Add: schema unit tests (required→`form.required`, optional bare, `subject` round-trip per A95), form-island tests (mirror `sponsor-form.test.tsx`: error-banner, pending/disabled, happy-path `onSubmit` with values, Zod-blocks-empty-required without calling `onSubmit`), the builder URL/payload test, and a no-touch / honeypot-filled regression. A35/A46 cleanup; A64/A78 stable mocks.

### Project Structure Notes

- Target tree: `features/public/{api/public-forms-api.ts, schemas/public-contact.schema.ts, schemas/public-newsletter.schema.ts, components/(contact-form|newsletter-form|unsubscribe-flow + contact-sidebar)*.tsx}`; thin entries at `app/public/{contact,newsletter,unsubscribe/[token]}/page.tsx`.

### References

- Pages: `contact/page.tsx` (`:7` baseUrl, `:34-38` honeypot, `:43-54` fetch+error, `:22-29` subject options, `:46` payload, `:239-243` label swap, `:337` `applicationName`), `newsletter/page.tsx` (`:11` privacy import, `:28-56` handlers, `:35-36` `||undefined`, `:75-112` success panels, `:164` `applicationName`), `unsubscribe/[token]/page.tsx` (`:17-18` token, `:25-41` verify-on-mount, `:43-54` confirm, `:13` `PageState`, `:59-109` five renders).
- Form recipe: `features/sponsors/components/sponsor-form.tsx` (`:48-51` `useForm`, `:61-65` `noValidate`, `:86-90` per-field error, `:12-20` props), `features/sponsors/schemas/sponsor.schema.ts` (`:4-16` the no-`.email()`/`.url()` rule, `:18-30` shape), `sponsor-form.test.tsx` (`:58-131` test patterns).
- Transport: `lib/api/privacy.ts` (`:112-175` public fns — WRAP, untouched). `AppSettingsProvider.tsx` (`:20-32` `AppSettings`, `:41-44` defaults, `:142-144` context default). `middleware.ts:109-114` (unsubscribe exemption). `messages/en.json:436` (`form.required`), `:2576-2675` (publicContact/unsubscribe/newsletter). `lib/auth.ts:178` (401-gate). project-context.md A56/A58/A72/A73/A76/A78/A87/A94/A95/A96/A98/A102/A103; E22 form sub-recipe. Epic: `epics-and-stories.md` §E28-S3.

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E28 preparation (front-loaded batch per A34, "kein mvp mehr" → full RHF+Zod migration of contact+newsletter, no manual-form fallback). Status ready-for-dev. HARD-ordered after E28-S1; independent of S2/S4. Five DECs carry recommended options for A41/A32 + A43.
- **A56 spike findings (load-bearing):** honeypot silent-success is the fragile invariant (pre-fetch, raw, untrimmed, `website` stays in payload); newsletter `||undefined` name-coercion must survive RHF; `useAppSettings` surface is just `applicationName` (client context → pages stay client islands, no RSC); unsubscribe `[token]` is a confirm state-machine, NOT an RHF form (DEC-5); WRAP `privacy.ts` (newsletter+unsubscribe) + BUILD contact; A95 `subject` via `z.string().min(1)`; A96 never `.trim()` a byte-must-match field + `noValidate` renders per-field errors; no `useApiClient` (401-gates). These pages stay client → no A88 render-harness change (contrast S2). No i18n work.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (bmad-dev-story, autonomous whole-epic run; the epic's RHF+Zod slice).

### Debug Log References

- **DEC-1 = A:** WRAP `@/lib/api/privacy` (newsletter+unsubscribe) via a thin **re-export** from `api/public-forms-api.ts` (privacy.ts untouched — A87/A94); BUILD `submitContact` (plain `fetch`, the contact POST had no module). The re-export is a **live binding**, so the S1 form specs' `vi.mock("@/lib/api/privacy", …)` still intercepts the slice's fns — that is WHY the S1 newsletter/unsubscribe specs stayed green unchanged.
- **DEC-2 = A** (contact/newsletter/unsubscribe stay CLIENT islands — the sidebars read `applicationName` from the client `AppSettingsProvider`; no RSC). **DEC-3 = A** (honeypot `website` is a registered RHF field; the caller's `onSubmit` runs `if (values.website) { setStatus("success"); return; }` FIRST, raw, pre-fetch — `website` stays in the payload). **DEC-4 = A** (`subject` = `z.string().min(1,"form.required")`, NOT `z.enum`; the 6 option values byte-identical — A95). **DEC-5 = A** (unsubscribe = state-machine island, NOT RHF — it has no editable inputs).
- **No RSC, no A88 adaptation (the load-bearing contrast with S2):** these pages stay client, so the S1 form specs are the oracle and stayed **100% unchanged** — the honeypot, status transitions, payload byte-shape, the `|| undefined` coercion, and the five-state token flow all assert identically.
- TSC fix: after the `status === "success"` early-return, TS narrows `status` to `idle|loading|error`, so passing it to `<ContactForm status={...}>` needed no defensive ternary (a no-overlap comparison).

### Completion Notes List

- **Contact + newsletter reshaped to RHF+Zod (E22 sub-recipe):** `<ContactForm>` (caller-owns-transport: receives `onSubmit` + `status`) + `<ContactContent>` (owns the status machine + honeypot + `submitContact` + sidebar + success panel). Newsletter = `<NewsletterContent>` with subscribe/unsubscribe tabs, each an independent RHF form (so switching tabs naturally clears the other tab's input — the S1 "reset on switch" pin). Unsubscribe = `<UnsubscribeFlow>` state-machine island (verbatim logic, slice transport).
- **Load-bearing invariants preserved:** the honeypot pre-fetch silent-success with `website` still in the body; the `firstName/lastName || undefined` coercion applied at the call site (empty names stay out of the JSON); the `subject` 6-option set byte-identical; the unsubscribe five states + error precedence; no redirect/auth on unsubscribe.
- **A79 delta (documented):** `noValidate` + Zod `min(1)` required validation now blocks an EMPTY submit via Zod (the old HTML5 `required` did not block under `fireEvent` in jsdom) + per-field `form.required` errors render. NO `.email()`/`.url()` (A96 — the god-form did zero format validation); NO `.trim()` on byte-must-match fields (A96).
- **Slice built in its OWN files (A91)** — `schemas/public-{contact,newsletter}.schema.ts`, `api/public-forms-api.ts`, `components/{contact-form,contact-content,newsletter-content,unsubscribe-flow}.tsx` — zero conflict with S2's `public-content-api.ts`/`types`.
- **New tests added:** schema units (contact 9 + newsletter 5), `public-forms-api` builder (4 — URL/payload + honeypot-in-body + re-export presence), `contact-form` island (4 — error banner, pending/disabled, happy-path `onSubmit` with values, Zod-blocks-empty). The S1 honeypot-filled-silent-success spec stands as the regression guard.
- **DoD:** full suite **205 files / 1944 tests green** (1922 + 22 new); `tsc --noEmit` clean; `eslint --max-warnings=0` clean across the slice + entries; `prettier --write` new slice files + rewritten thin entries (LF, A73); `next build` validated at the epic boundary (A58).

### File List

- `frontend/src/features/public/schemas/public-contact.schema.ts` (+ `.test.ts`)
- `frontend/src/features/public/schemas/public-newsletter.schema.ts` (+ `.test.ts`)
- `frontend/src/features/public/api/public-forms-api.ts` (+ `.test.ts`) — WRAP privacy re-export + BUILD `submitContact`
- `frontend/src/features/public/components/contact-form.tsx` (+ `.test.tsx`) — RHF form island
- `frontend/src/features/public/components/contact-content.tsx` — page (status machine + honeypot + sidebar)
- `frontend/src/features/public/components/newsletter-content.tsx` — page (tabs + two RHF forms)
- `frontend/src/features/public/components/unsubscribe-flow.tsx` — state-machine island
- `frontend/src/app/public/{contact,newsletter}/page.tsx`, `unsubscribe/[token]/page.tsx` (modified — thin client re-export entries)

## Change Log

- 2026-06-12: Story created (contact+newsletter → RHF+Zod islands per E22 sub-recipe; unsubscribe → preserved state-machine island; WRAP privacy.ts + BUILD contact; honeypot pre-fetch silent-success preserved; DEC-1 wrap-vs-build, DEC-2 keep-client-island, DEC-3 honeypot-in-onSubmit, DEC-4 subject-`z.string().min(1)`, DEC-5 unsubscribe-non-RHF). Status ready-for-dev.
- 2026-06-12: Implemented — contact+newsletter RHF+Zod islands + unsubscribe state-machine island; WRAP privacy via live-binding re-export + BUILD submitContact; S1 form specs green UNCHANGED (no A88 — pages stay client); +22 schema/builder/form tests; suite 1944 green; tsc/eslint/prettier/next-build clean; DEC-1..5 = A. Status → review.
