# Story E26.S6: Finance Settings — Feature-Slice Extraction

Status: ready-for-dev

Depends on: **E26-S1 (the S6 settings suites green at HEAD)** + **E26-S2 (the shared `finance-api.ts`/`finance.types.ts` foundation, incl. the shared `ActivityArea` type)** + **E26-S4 (the activity-areas CRUD/report builders it owns)**. Mutually independent of S3/S5 once S2's foundation lands. **Final E26 slice** — closes out the shared foundation so the whole Finance domain lives under `src/features/finance/` with thin app-router shells.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the five Finance settings pages extracted into `src/features/finance/`,
so that the settings forms migrate to the shared E22 form sub-recipe with no behaviour change and the activity-area type is reused (not re-declared) from S4.

## Acceptance Criteria

**Behaviour preserved (all E26-S1 settings tests stay green):**

1. Each page's CURRENT read guard is preserved EXACTLY (E26-S1 pins them — heterogeneous): `settings` (hub) keeps spinner-while-`!profileLoaded` → `if (!canReadFinance) return null` (NO redirect); `settings/activity-areas` keeps `authLoading` skeleton → `if (!canReadFinance) return null`; **`settings/profile`, `settings/invoice-templates`, `settings/tax-codes` keep their NO-`!canReadFinance`-early-return shape** (they render the empty default form/table to a non-read user — preserve AS-IS, do NOT add a guard). `canWriteFinance` still gates every settings mutation (profile save — via `disabled={!canWriteFinance}` on EVERY field + hidden save footer; invoice-template create/edit/delete; activity-area create/edit/delete; tax-code create/edit/delete; hub backfill (`isDoubleEntry && canWriteFinance`) + danger-zone reset (`canWriteFinance`)). **`canReadFinance && !canWriteFinance` yields a read-only render** — for `settings/profile` that means all fields `disabled` + no save footer (the canonical read-only-render page); for the list pages it means the create/edit/delete affordances are hidden — preserve each mechanism (disabled-fields vs hidden-affordances) AS-IS.
2. All `/api/v1/finance/settings|tax-codes|invoice-templates|activity-areas|profile|backfill-double-entry|reset` URLs, routes and `finance.*`/`finance.settings`/`finance.invoiceTemplates`/`finance.taxCodes`/`activityAreas` i18n keys unchanged. Preserve verbatim: the profile **404-on-GET → "create mode" (POST) vs existing-profile (PUT `/profile/{id}`)** branch; the profile **`jurisdiction`→`currency`/`countryCode` reset side-effect** + the `finance-profile-changed` CustomEvent (emitted by profile + hub, cross-page listener); the tax-code **rate ×100 (display) / ÷100 (wire) round-trip**; the invoice-template **`jurisdiction`/`countryCode` immutability-on-edit**; the `{items}` GET envelope on all list pages; the activity-areas **inline-confirm delete** vs invoice-templates/tax-codes **modal delete**; the activity-areas **hardcoded-English error strings**; the hub's static nav-card arrays + the DoubleEntry-derived card enable/disable + the typed-word reset-confirm gate.

**Improvements:**

3. Settings forms use the E22 form sub-recipe: **RHF + Zod** via `schemas/*.schema.ts` (shared new+edit per resource: profile, invoice-template, tax-code, activity-area), with mutation-invalidation of the relevant `financeKeys` on save. **A95 (load-bearing — the program's recurring trap, two prior recurrences):** the profile `countryCode` `<select>` (27 EU codes, conditional on `jurisdiction==="EU"`, a CH↔EU flip strands a stale value) is the canonical out-of-set case — the Zod field MUST be the FULL transport union (`z.string()`, NEVER `z.enum([rendered EU subset])`), keep the RAW stored `countryCode` in `defaultValues`, and render an out-of-set stored value as an extra `<option>` so a no-touch edit-save round-trips it. Apply the same to profile `currency`/`jurisdiction` and invoice-template `language`/`jurisdiction`. **A96:** NO `.trim()`/transform on any submitted-byte field (org name/address/uid/iban/bic, template notes, tax-code label/code, area name/code); the god-pages map `"" → null` for optionals but never trim — preserve; required-ness MATCHES the current enable-gate (profile: the `*` fields gate nothing today — submit only sets server-validated; so keep permissive matching the god-page; invoice-template: name+language; tax-code: code+label; activity-area: name+code); the `<form noValidate>` MUST render per-field Zod errors (A96 companion). **A98:** any shared create/edit form threads mode-divergent surfaces through props (the invoice-template create-only `jurisdiction` field + edit-locked `countryCode`; the tax-code edit rate-prefill ×100) AND the net pins both modes.
4. Extract `components/*` (settings hub nav-sections + backfill panel + danger-zone reset modal; profile form; invoice-template form + list; activity-area list/form; tax-code list/form) and `hooks/use-*.ts` (TanStack) reusing S2's foundation. Add the settings URL builders + keys to a NEW `api/settings-api.ts` (importing S2's `FINANCE_BASE`/`financeKeys`) and settings types to a NEW `types/settings.types.ts` (re-exporting `@/types/finance` `FinanceProfile`/`TaxCode`/`InvoiceTemplate` per A83 where present, adding new). **REUSE the shared `ActivityArea` type from S2's foundation + the activity-areas CRUD builders/keys from S4** for `settings/activity-areas` — do NOT re-declare them; the settings activity-area FORM omits `isActive` (edit hard-codes `isActive:true`) while S4's includes it — the type covers both, the forms diverge per page, distinct routes/components per the no-route-move constraint.
5. **Manual→TanStack deltas (A79/A92) decided explicitly:** list refetch via `invalidateQueries`; form save reset/close driven from the mutation OUTCOME (`onSuccess`, A92 — the error path keeps the form open with input intact, matching the god-pages); the profile POST-vs-PUT chosen from the loaded-profile presence (404 → POST), `enabled` matching the god-page's `!authLoading && canReadFinance` fetch gate (A97); the `finance-profile-changed` CustomEvent still dispatched on profile save + finance reset; the inline-confirm / modal delete state preserved on failure.
6. No new `any`, no new hard-coded user-facing strings beyond the ones S1 pins (the activity-areas hardcoded-English errors preserved — do NOT translate), no new direct API URL in route files/components, no duplicate UI primitive; i18n parity stays green.

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [ ] E26-S1 settings suites green at HEAD; E26-S2 foundation + E26-S4's shared `ActivityArea` type present. Re-read the 5 pages + the S2 foundation + S4's activity-areas type + the E22 form sub-recipe (A56). Confirm the profile countryCode A95 surface + the tax-code rate ×100/÷100 + the invoice-template edit-immutability + the hub's two operational panels.
  - [ ] Resolve DEC-1..DEC-3 (recommended options below).
- [ ] Task 1: Scaffold `api/settings-api.ts` (import S2 `FINANCE_BASE`/`financeKeys`; profile incl. `/{id}` + backfill + reset, invoice-templates, tax-codes URL builders; REUSE S4's activity-areas builders) + `types/settings.types.ts` (re-export `@/types/finance` + new) + `schemas/{finance-profile,invoice-template,tax-code,settings-activity-area}.schema.ts` (A95 full unions for countryCode/currency/jurisdiction/language; A96 no-`.trim()`; required-ness matching the god-page enable-gates) + `api/settings-api.test.ts`.
- [ ] Task 2: Hooks — queries (profile, invoice-templates, tax-codes, activity-areas (reuse S4 hook or a settings-scoped one)) + mutations (profile create/update + backfill + reset; invoice-template/tax-code/activity-area CRUD) each invalidating `financeKeys`; preserve the tax-code rate ×100/÷100 mapping at the hook/schema boundary; dispatch `finance-profile-changed` on profile save + reset. Hook tests: the profile POST-vs-PUT 404 branch + one mutation-invalidation + the tax-code rate round-trip.
- [ ] Task 3: Components — settings hub (`settings-hub-content`: static nav-card sections + DoubleEntry-derived enable/disable + backfill panel + danger-zone reset modal with typed-word gate + `finance-profile-changed` dispatch).
- [ ] Task 4: Components — `finance-profile-form` (RHF+Zod, the big form; A95 countryCode full-union + extra-option + raw default; A96 no-`.trim()` + `"" → null` optional mapping preserved; jurisdiction→currency/countryCode side-effect; `disabled={!canWriteFinance}` on every field + hidden save footer; the read-only render is this page's canonical case).
- [ ] Task 5: Components — `invoice-templates` (list + form, A98 create-only jurisdiction + edit-locked countryCode, modal delete) + `settings/activity-areas` (list + form REUSING S4's `ActivityArea` type, inline-confirm delete, hardcoded-English errors preserved, omit `isActive` in the form) + `tax-codes` (list + form, rate ×100/÷100, modal delete).
- [ ] Task 6: Thin route entries — the 5 route files → content components.
- [ ] Task 7: Green-the-net + DoD gate — E26-S1 settings suites green (transport mocks unchanged — BUILD per A94); new slice unit tests; `tsc`/eslint(changed+boundary)/`vitest run` FULL green; LF; A79/A92/A95 deltas recorded. **Close-out:** confirm the whole `app/finance/**` tree is thin shells over `features/finance/`; update `docs/architecture-frontend.md` with the finance one-slice-shared-foundation result note. (`next build` deferred to epic boundary.)

## Dev Notes

The final E26 slice — closes the Finance domain under `features/finance/`. Settings is form-heavy: the profile form is the second-biggest RHF+Zod target in the epic (≈17 fields) and carries the canonical A95 `countryCode` trap; the tax-code rate ×100/÷100 round-trip and the invoice-template edit-immutability are fragile behaviours to preserve. `settings/activity-areas` REUSES S4's shared `ActivityArea` type (the A62/A101 "two slices, one shared sub-decision" discipline). The hub is a nav page with two embedded operational panels (backfill + danger-zone reset) and a cross-page `finance-profile-changed` CustomEvent.

### Scope Boundaries

- In scope: `features/finance/{api/settings-api.ts, types/settings.types.ts, schemas/*, hooks/*, components/settings/*}` for the 5 pages; thin route entries; new slice unit tests; the architecture-doc close-out note.
- Out of scope: editing S2's foundation files or S4's shared `ActivityArea` type (import only); the S4 budgeting `finance/activity-areas` PAGE (distinct route — S4 owns it; S6 owns `settings/activity-areas`); "fixing" the profile/invoice-template/tax-codes no-`return null` guard, the activity-areas hardcoded-English errors, the tax-code ×100/÷100 (preserve it), or any `{items}` envelope handling.

### Architecture Guardrails

- A94 BUILD on `useApiClient` (URLs/bodies byte-identical incl. profile `/{id}` PUT vs POST, backfill, reset, the `{items}` GET envelope). A95 profile `countryCode` (+ currency/jurisdiction, invoice-template language/jurisdiction) = full transport union + raw default + extra-option (NEVER `z.enum(subset)`). A96 no submitted-byte `.trim()`; `"" → null` optional mapping preserved; `noValidate` form renders field errors; required-ness matches the god-page enable-gate. A98 shared form mode-divergent surfaces threaded + both modes pinned (invoice-template create-jurisdiction/edit-locked-countryCode; tax-code edit rate-prefill). A92 form reset/close from mutation OUTCOME. A97 profile query `enabled` matches the god-page fetch gate. A86 preserve affordance colours (delete red, primary orange, danger-zone red).
- REUSE S4's shared `ActivityArea` type/keys (A62/A101) — do NOT re-declare. The settings form omits `isActive`; the type still covers it.
- DoD as E27 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 profile countryCode union (A95):** A) Zod `countryCode: z.string()` (full union), raw stored value in `defaultValues`, render an out-of-set stored value as an extra `<option>`, keep the jurisdiction→reset side-effect, POST/PUT byte-identically (recommended — a `z.enum(EU_COUNTRIES)` rejects/blanks a stale CH-side value and silently rewrites it on save, the exact A95 recurrence). B) `z.enum(EU_COUNTRIES)` (REJECTED — silent rewrite-on-save). **Recommended: A.**
- **DEC-2 settings-form required-ness (A96 companion):** A) the Zod required set MATCHES each god-page's current enable-gate exactly — profile is effectively permissive (the `*` are decorative, no submit gate today; server validates), invoice-template = name+language, tax-code = code+label, activity-area = name+code; render field errors for invalid coercions only (recommended — preserve-over-improve). B) make all `*` fields Zod-required (REJECTED for profile — rejects inputs the god-page accepted → net red + behaviour change). **Recommended: A.**
- **DEC-3 settings/activity-areas type source (A62/A101):** A) REUSE the shared `ActivityArea` type (S2 foundation) + the activity-areas CRUD builders/keys (S4); S6 owns only its own route/form/list components (recommended — single type source, single endpoint owner, no divergence). B) re-declare in the settings slice (REJECTED — two slices owning `/api/v1/finance/activity-areas`; the A101 divergence trap). **Recommended: A.**

### Testing Requirements

- The E26-S1 settings suites are the regression oracle — keep green; only the form/data mechanism is the licensed A79 surface. The heterogeneous guards (incl. the no-`return null` pages), the profile 404→POST branch + countryCode round-trip, the tax-code rate ×100/÷100, the invoice-template edit-immutability, the hub backfill/reset panels + `finance-profile-changed` event, the inline-vs-modal deletes, the `{items}` envelopes must stay green verbatim.
- Add focused slice unit tests: `settings-api` URL/key shape (profile `/{id}` + backfill + reset + the reused activity-areas builders); the profile POST-vs-PUT 404 branch; `finance-profile-form` RHF+Zod (A95 countryCode out-of-set round-trip, A96 no-`.trim()` + `"" → null`, A92 input-preserved-on-error); the tax-code rate ×100/÷100 round-trip.

### Project Structure Notes

- Target tree (NEW under `features/finance/`): `api/settings-api.ts(+test)`, `types/settings.types.ts`, `schemas/{finance-profile,invoice-template,tax-code,settings-activity-area}.schema.ts`, `hooks/use-finance-profile*.ts`/`use-invoice-templates*.ts`/`use-tax-codes*.ts`/`use-settings-activity-areas*.ts`, `components/settings/*`. Thin entries at `app/finance/settings/{page,profile,invoice-templates,activity-areas,tax-codes}/page.tsx`.

### References

- Pages: `frontend/src/app/finance/settings/{page,profile,invoice-templates,activity-areas,tax-codes}/page.tsx`.
- Foundation to import: `features/finance/api/finance-api.ts` + `types/finance.types.ts` (E26-S2); the shared `ActivityArea` type/keys (E26-S4). Shared types: `frontend/src/types/finance.ts`. Helpers: `frontend/src/lib/utils.ts`.
- Form sub-recipe: `docs/architecture-frontend.md` "Form Sub-Recipe"; `features/sponsors`/`members` forms (A95/A96/A98 examples).
- E26-S1/S2/S4; project-context.md A34/A56/A58/A62/A72/A73/A79/A83/A86/A92/A94/A95/A96/A97/A98/A101; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E26 batch, A34). Status ready-for-dev. Ordered after E26-S2 foundation + E26-S4 shared activity-areas type; FINAL E26 slice.
- **A56 findings:** all 5 pages `useApiClient` direct (BUILD, A94). `settings/page.tsx` is a **nav hub** (static card sections) + a **backfill panel** (`POST /backfill-double-entry`) + a **danger-zone reset modal** (`DELETE /reset`) + the `finance-profile-changed` CustomEvent — NOT a single form/tabs (A56). Heterogeneous guards: hub + activity-areas do `if (!canReadFinance) return null`; **profile/invoice-templates/tax-codes do NOT** (render empty form/table to non-read users — preserve). `settings/profile` is the canonical read-only-render page (every field `disabled={!canWriteFinance}` + hidden save footer). **A95**: profile `countryCode` (27 EU codes, conditional, CH↔EU strand) is THE trap; also currency/jurisdiction, invoice-template language/jurisdiction. **A96**: no page trims; profile maps `"" → null` for optionals (preserve, don't trim). **tax-code rate ×100 (display)/÷100 (wire)** round-trip — preserve exactly. **invoice-template** `jurisdiction`/`countryCode` immutable-on-edit. `{items}` GET envelope on all list pages. **activity-areas overlap**: REUSE S4's `ActivityArea` type/keys/endpoints (settings form omits `isActive`); distinct route/component; hardcoded-English errors on the settings activity-areas page (preserve). Delete UX: inline-confirm (activity-areas) vs modal (invoice-templates, tax-codes).

## Dev Agent Record

### Agent Model Used

_(to be filled by dev-story)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (5 settings pages → `features/finance/` reusing the S2 foundation + S4's shared `ActivityArea` type; settings forms → E22 RHF+Zod with the A95 countryCode full-union round-trip + A96 permissive-no-`.trim()`+`""→null` + A98 mode props + A92 input-preserved-on-error; preserve the hub nav+backfill+reset+`finance-profile-changed` event, the profile 404→POST branch + read-only-render, the tax-code rate ×100/÷100, the invoice-template edit-immutability, the no-`return null` guards, the inline-vs-modal deletes, the hardcoded-English activity-areas errors; closes the Finance domain under features/finance). Status ready-for-dev.
