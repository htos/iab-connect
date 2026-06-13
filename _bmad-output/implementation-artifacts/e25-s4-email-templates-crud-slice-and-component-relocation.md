# Story E25.S4: Email Templates — CRUD Feature-Slice and `components/email-templates` Relocation

Status: review

Depends on: **E25-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions. Independent of S2/S3 once S1 is green. **Owns the `communication/page.tsx` index thin-entry conversion. Relocates ONLY the `EmailTemplateForm` component; `emailTemplatesApi` + types STAY in `@/lib`/`@/types` because automations (S2) + email-campaigns (S3) consume them (A83/A84/E21-S5).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the Email-templates pages and the Communication index refactored into the feature-slice pattern, and the orphaned `components/email-templates/EmailTemplateForm.tsx` relocated into its owning slice,
so that the third Communication CRUD surface is cohesive and free of cross-tree component imports, with behaviour preserved.

## Acceptance Criteria

**Behaviour preserved (all E25-S1 tests stay green):**

1. Routes `/communication/email-templates`, `/new`, `/[id]`, plus the `/communication` index; the per-page guards EXACTLY as today (list — NO redirect guard, empty grid if no token; new/[id] — silent `return null` if `!isAuthenticated || (!isAdmin && !isVorstand)`; index — `isAdmin||isVorstand` redirect `/`); `emailTemplatesApi.getAllTemplates` load, client-side search (name/description), loading/error/empty, **card-grid** render, category badge + inactive badge, edit link; **delete (native `confirm()` → `deleteTemplate` → `templates.filter` removal on SUCCESS; delete-FAILURE → error banner, list UNCHANGED — item stays)** (A76); create/update submit via the relocated `EmailTemplateForm` → success banner + 1.5 s redirect, validation, submit-error; and the index's three sub-module nav cards + two quick-action links all work exactly as before. `EmailTemplate.id` is a **number**.

**Improvements:**

2. Each route file (incl. `communication/page.tsx`) becomes a **thin entry** (no `"use client"`) rendering a `features/communication/...` content component (the only `"use client"` is the composition root).

3. A `features/communication/email-templates/` slice exists mirroring `features/sponsors/` + the E29 wrap recipe:
   - `api/email-templates-api.ts` — **WRAPS the existing `emailTemplatesApi` (`@/lib/email-templates`)** (A94 — do NOT re-implement the URLs; `emailTemplatesApi` STAYS in `@/lib` because S2/S3 consume it) + an `emailTemplatesKeys` factory (`all`/`list`/`detail(id)`).
   - `hooks/` — `use-email-templates` (`useQuery` list) + `use-email-template` (get-by-id, +`EmailTemplateNotFoundError` + A93 retry-exclusion) + `use-delete-email-template` + `use-create-email-template`/`use-update-email-template` (`useMutation` + `emailTemplatesKeys` invalidation).
   - `schemas/email-template.schema.ts` — Zod for the template form (name/subject/category/htmlContent/textContent required; variables array; behaviour-preserving).
   - `components/` — `email-templates-page-content`, `email-templates-search-bar`, `email-template-card`, `email-template-category-badge`, the **RELOCATED `EmailTemplateForm`** (reused by new + detail/edit), `communication-index-content` (the index page body); the native `confirm()` delete flow preserved as-is (no new dialog primitive unless behaviour-identical — A86).
   - `types/email-template.types.ts` — **re-exports** `EmailTemplate`/`EmailTemplateVariable`/`Create…`/`Update…`/`EMAIL_TEMPLATE_CATEGORIES` from `@/types/email-templates` (which STAYS — S2/S3 consume it; DEC-3).

4. `frontend/src/components/email-templates/EmailTemplateForm.tsx` is **MOVED** into the slice `components/`; the **two in-epic importers** (`email-templates/new/page.tsx` + `email-templates/[id]/page.tsx`, now the slice content components) are repointed. A Task-0 spike confirms the importer set: `EmailTemplateForm` has exactly 2 importers (both in-epic). The now-empty `components/email-templates/` directory is removed (it contains only `EmailTemplateForm.tsx`). **`@/lib/email-templates` (`emailTemplatesApi`) + `@/types/email-templates` are NOT moved** — their out-of-epic/sibling importers (`automations/AutomationForm.tsx`, `email-campaigns/new`, `email-campaigns/[id]/edit`) keep importing them from `@/lib`/`@/types` (boundary-legal; moving them into the slice would force forbidden cross-feature imports — A83).

5. The category + inactive badges map to **Badge variants/tokens (DEC-2)** — no raw `bg-gray-100`/`bg-gray-500` brand strings in feature components; verified against the named token (A77). The relocated `EmailTemplateForm` adopts RHF+Zod (E22 sub-recipe); the hard-coded German `RichTextEditor` placeholder ("E-Mail-Inhalt eingeben…") becomes a next-intl key (an i18n fix, recorded). The native `confirm()` delete is preserved (A86 — the AC keeps the confirm flow; no destructive-dialog swap).

6. The manual→TanStack deltas (A79) are decided explicitly: refetch-after-delete via `invalidateQueries` (replacing the manual `templates.filter`); the delete-FAILURE branch keeps the item (the cache is not mutated on error) — preserving the current behaviour; mutation error surfaced; chosen retry semantics documented (A93).

7. No new `any`, no new hard-coded user-facing strings (the placeholder i18n fix aside), no new direct API URL in route files, no duplicate UI primitive; i18n parity stays green (reuse existing `emailTemplates.*`/`communication.*` keys; no renames/removals).

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + relocation spike + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded in Dev Agent Record below
  - [x] E25-S1 Email-templates + index specs green at HEAD. Confirmed `features/communication/email-templates/` did NOT exist. **Relocation spike (post-S2/S3 reality):** `EmailTemplateForm` had exactly 2 in-epic importers (new + [id] pages). `@/lib/email-templates` is now imported by the SIBLING SLICE forms — `features/communication/automations/components/automation-form.tsx` (S2) + `features/communication/email-campaigns/components/email-campaign-form.tsx` (S3) — so the api+types MUST stay in lib (a slice importing another slice violates E21-S5). Confirmed via grep before+after.
  - [x] **DEC-1 = A WRAP** — `api/email-templates-api.ts` WRAPS `emailTemplatesApi` (token-arg delegation) + `emailTemplatesKeys` (`all`/`list`/`detail(id)`); `emailTemplatesApi` STAYS in lib (sibling-consumed; A83/A84/A94). `EmailTemplate.id` kept numeric. S1 `vi.mock("@/lib/email-templates")` specs keep intercepting (A94, zero transport-mock edits).
  - [x] **DEC-2 = A** — MOVED `EmailTemplateForm` → slice + RHF+Zod; props contract (`template?`/`onSave`/`isSaving`) + `onSave` payload byte-identical; variables-array sub-editor preserved as local state (mirrors HEAD's `newVariable`); name+subject → Zod `.min(1,"form.required")` (the only deliberate A79 change). Placeholder i18n-ed.
  - [x] **DEC-3 = re-export** `EmailTemplate`/`EmailTemplateVariable`/`Create…`/`Update…`/`EMAIL_TEMPLATE_CATEGORIES` from `@/types/email-templates` (which STAYS — sibling-consumed) via `types/email-template.types.ts`.
  - [x] **DEC-4 = A** — native `confirm()` delete (A86) → TanStack mutation invalidating `emailTemplatesKeys.all`; SUCCESS refetch removes the item; FAILURE leaves the cache (item stays) + error banner — matching HEAD.
- [x] Task 1: Scaffolded slice `api` + `types` + `schemas` — `email-templates-api.ts` (wrap + `emailTemplatesKeys`) + `types/email-template.types.ts` (re-export) + `schemas/email-template.schema.ts` + `email-templates-api.test.ts`.
- [x] Task 2: Hooks — list/detail(+`EmailTemplateNotFoundError`, A93 — a REAL 404 sentinel since the legacy `ApiClient` throws `ApiError{statusCode}`)/create/update/delete mutations + invalidation. `use-email-template.test.tsx`.
- [x] Task 3: Relocated `EmailTemplateForm` → `features/communication/email-templates/components/email-template-form.tsx`; migrated to RHF+Zod (props contract + variables-array editor preserved); i18n'd the hard-coded placeholder (`emailTemplates.form.editorPlaceholder` added to de+en); removed the empty `components/email-templates/` dir. `email-template-form.test.tsx`.
- [x] Task 4: Components — list + index — `email-templates-page-content` (card-grid + search-bar + category/inactive Badge tokens + destructive delete affordance + native `confirm()` + delete success/failure branches) + `email-template-card` + `email-template-category-badge` + `email-templates-search-bar` + `communication-index-content` (3 nav cards + 2 quick-action links). New/detail content components render the relocated form.
- [x] Task 5: Thin route entries — `email-templates/{page,new/page,[id]/page}.tsx` + `communication/page.tsx` → content components ([id] content keeps `useParams()` — the god-page used it). Per-page guards preserved EXACTLY (list no-guard; new/[id] silent-null; index redirect).
- [x] Task 6: Green-the-net + DoD gate — E25-S1 Email-templates + index specs green (only the delete-success-refetch mechanism adapted; A94 WRAP kept transport mocks); new slice unit tests; `tsc` exit 0 / eslint(slice+changed+siblings) clean (boundary) / `vitest run` FULL **1050/1050 green (120 files)**, no regressions; i18n parity green; LF. The 2 sibling `@/lib/email-templates` importers still compile. A79 deltas recorded. (`next build` deferred to epic boundary per A58.)

## Dev Notes

Third Communication sub-slice + the index page. The distinctive work: **relocate ONLY the `EmailTemplateForm` component** (2 in-epic importers) while keeping `emailTemplatesApi` + types in `@/lib`/`@/types` (the E21-S5 boundary forbids the automations/email-campaigns sibling slices from importing `@/features/communication/email-templates`, and those siblings consume `emailTemplatesApi` for their template dropdowns — so the shared client must remain lib-resident; this is the A83 type-relocation + A84 shared-surface lesson applied to a shared CLIENT). Independent of S2/S3.

### Scope Boundaries

- In scope: `features/communication/email-templates/` (api/hooks/components/schemas/types) for the 3 template pages + the index; thin route entries (incl. `communication/page.tsx`); the `EmailTemplateForm` relocation + RHF+Zod migration + placeholder i18n; removing the empty `components/email-templates/` dir; new slice unit tests.
- Out of scope: automations + email-campaigns (S2/S3); MOVING `emailTemplatesApi`/types out of `@/lib`/`@/types` (they stay — sibling-consumed); the legacy `@/lib/api-client.ts` `ApiClient` retirement (E31 owns it — wrap, don't retire); i18n key changes beyond the one placeholder fix; route-group moves.

### Architecture Guardrails

- Mirror the E29 documents wrap recipe + the sponsors form recipe (api → wrap + `*Keys`; hooks → query/mutation + invalidation; thin `"use client"` root; relative intra-slice imports; NO `@/features/communication/<sibling>` import — E21-S5).
- **The relocation is the form ONLY.** `emailTemplatesApi` (`@/lib/email-templates`, over the legacy `ApiClient`) + `@/types/email-templates` STAY put; the slice wraps/re-exports them. Verify the 3 sibling/out-of-epic importers still resolve `@/lib/email-templates` after the story.
- A77: verify the category/inactive badge token values against the named brand colours.
- A93: `use-email-template` disables retry for the 404 sentinel.
- A86: keep the native `confirm()` delete (the AC preserves it); the delete mutation's failure branch must leave the cache (item stays) — matching HEAD's "removal only on success".
- `EmailTemplate.id` is a **number** — keep the numeric id through the keys/hooks/URLs (do not stringify-coerce in a way that changes the API call).
- DoD as E29 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43)

- **DEC-1 transport:** A) wrap `emailTemplatesApi` (keep in lib; sibling-safe). B) move + rewrite (breaks the automations/email-campaigns sibling imports via the E21-S5 boundary). **Recommended: A.**
- **DEC-2 form:** A) relocate + RHF+Zod. B) relocate as-is (manual `useState`) — misses the epic form goal. **Recommended: A.**
- **DEC-3 type home:** A) re-export from `@/types/email-templates` (stays — sibling-consumed). B) relocate types (breaks siblings). **Recommended: A.**
- **DEC-4 delete:** A) native `confirm()` + TanStack mutation (failure keeps item). B) Radix destructive dialog — A86 says keep confirm() unless behaviour-identical. **Recommended: A.**

### Testing Requirements

- The E25-S1 Email-templates + index specs are the regression oracle. The `emailTemplatesApi` mock still intercepts after the wrap (DEC-1=A). Adapt only: the relocated-form import path; the manual-`templates.filter` → TanStack-invalidate delete (assert the outcome: success→item gone, failure→item stays+banner); the form manual→RHF+Zod. Preserve the per-page guards, card-grid, badges, search, navigation verbatim.
- Add slice unit tests: `email-templates-api` URL/key shape; `use-email-template` (404→sentinel, no-retry); `use-delete-email-template` (invalidation; failure keeps cache); `email-template-form` RHF+Zod incl. the variables-array (mirror `sponsor-form.test.tsx`). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/communication/email-templates/{api,hooks,components (incl. relocated email-template-form.tsx + communication-index-content.tsx),schemas,types}`; thin entries at `app/communication/email-templates/{page,new/page,[id]/page}.tsx` + `app/communication/page.tsx`. `components/email-templates/` removed.

### References

- Slice templates: `frontend/src/features/documents/api/documents-api.ts` (the WRAP recipe), `frontend/src/features/sponsors/` (form recipe + `sponsor-form.test.tsx`), `frontend/src/features/members/types/member.types.ts` (re-export pattern).
- Pages: `frontend/src/app/communication/email-templates/{page,new,[id]}.tsx` + `frontend/src/app/communication/page.tsx` (index :82-126). Form: `frontend/src/components/email-templates/EmailTemplateForm.tsx` (manual `useState`, `template?`/`onSave`/`isSaving` props, variables-array editor, the hard-coded placeholder).
- Client/types to wrap (KEEP in lib): `frontend/src/lib/email-templates.ts` (`emailTemplatesApi` over `@/lib/api-client.ts`, `id:number`, `getAllTemplates`/`getTemplateById`/`createTemplate`/`updateTemplate`/`deleteTemplate`/`previewTemplate`/`deactivateTemplate`) + `frontend/src/types/email-templates.ts` (`EmailTemplate`/`EmailTemplateVariable`/`EMAIL_TEMPLATE_CATEGORIES`). Sibling importers to verify: `automations/AutomationForm.tsx`, `email-campaigns/new/page.tsx`, `email-campaigns/[id]/edit/page.tsx`.
- `frontend/src/lib/auth.ts:169-295`; `frontend/eslint.config.mjs` (E21-S5); E25-S1; project-context.md A34/A56/A58/A72/A73/A76/A77/A78/A79/A83/A84/A86/A93/A94; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E25 batch, A34). Status ready-for-dev. HARD-ordered after E25-S1. Four DECs carry recommended options for A41/A32 + A43.
- **A56 findings (load-bearing):** `emailTemplatesApi` (`@/lib/email-templates`, over the legacy throwing `ApiClient`, `id:number`) is consumed by THREE sub-modules → STAYS in lib; only `EmailTemplateForm` (2 in-epic importers) relocates (the A83/A84 shared-surface lesson applied to a shared client). Per-page guards differ (list NO guard; new/[id] silent-null; index redirect — pin/preserve each). Delete: removal on success only → failure keeps the item (A76; the delete mutation's cache must mirror this). `EmailTemplateForm` is manual `useState` + a variables-array editor + a hard-coded German placeholder (i18n-fix). i18n: emailTemplates(40)/communication(15) en↔de parity, hi=0 (subset OK) → reuse keys. This story owns the `communication/page.tsx` index thin-entry conversion.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous whole-epic dev-story; slice extraction + component relocation by a focused subagent, central verification by the orchestrator). The LAST E25 slice — all 12 Communication pages now sliced.

### Debug Log References

**A43 (a)/(b)/(c) — DEC resolutions (A41 autonomous mode; user directive "das ganze epic implementieren mit allen stories. ohne stop"):**
- **DEC-1 (a)** WRAP `emailTemplatesApi`; it STAYS in `@/lib`. **(b)** sibling-consumed by the S2 `automation-form` + S3 `email-campaign-form` for their template dropdowns — moving it would force an E21-S5 cross-feature import (A83/A84). The slice api fns take an explicit `token` and delegate byte-identically; `EmailTemplate.id` kept numeric. **(c)** S1 `vi.mock("@/lib/email-templates")` specs keep intercepting (A94, zero transport edits); verified the sibling importers still resolve `@/lib`/`@/types` before+after.
- **DEC-2 (a)** MOVE the form + RHF+Zod. **(b)** props contract (`template?`/`onSave`/`isSaving`) + the `onSave` payload byte-identical → the new/[id] `createTemplate`/`updateTemplate` call args unchanged; the variables-array sub-editor stays local state (mirrors HEAD's `newVariable`). **(c)** name+subject → Zod `.min(1,"form.required")` (the only deliberate A79 behaviour change); the hard-coded German placeholder → `t("editorPlaceholder")` (key `emailTemplates.form.editorPlaceholder` added to de+en, parity green).
- **DEC-3 (a)** re-export the types. **(b)** `@/types/email-templates` STAYS (sibling-consumed); `features→@/types` legal. **(c)** slice code imports from `../types/email-template.types`, never reaching across to `@/types` directly.
- **DEC-4 (a)** native `confirm()` + TanStack mutation. **(b)** A86 keeps the confirm flow (no destructive-dialog swap). **(c)** SUCCESS → `deleteTemplate(id,token)` + `invalidateQueries(all)` (item gone); FAILURE → cache NOT mutated (item stays) + error banner — HEAD's "removal only on success"; confirm-cancel → no call.
- **A93 (a)** real sentinel — `use-email-template` throws `EmailTemplateNotFoundError` on `err.statusCode === 404`, rethrows otherwise; `retry: (n,err)=>!(err instanceof EmailTemplateNotFoundError) && n<1`. **(b)** the legacy `ApiClient` throws `ApiError{message,statusCode,errors?}` so a 404 IS distinguishable (DIVERGES from the S2 automations `retry:false`). **(c)** not-found surface renders on the first fetch (god-page parity); a generic error still gets one retry.

### Completion Notes List

- ✅ Email-templates 3 pages + the Communication INDEX → `features/communication/email-templates/` slice; `EmailTemplateForm` RELOCATED into the slice (manual `useState` → RHF+Zod); the empty `components/email-templates/` directory removed. **All 12 Communication pages are now feature-sliced** (S2 automations + S3 email-campaigns + S4 email-templates+index).
- ✅ **Full suite 1050/1050 green (120 files)** = 1029 (post-S3) + 21 new slice unit tests; **no regressions**. `tsc --noEmit` exit 0. `eslint` on slice + changed + the 2 SIBLING slice forms clean incl. the E21-S5 boundary (no `@/features/**` imports — relative only). No raw `/api/v1` URL in any email-templates component/route. New files `prettier --write` (LF); modified route files hand-matched (god-pages → thin entries, net −639 lines).
- ✅ Licensed-update surface (A79/A94): only ONE S1 spec mechanism adaptation (delete-success now resolves the post-delete refetch to [] — the manual `filter` became a TanStack invalidate; outcome identical). Every behavioural assertion preserved: delete two-branch (success-removes/failure-keeps/confirm-cancel) + destructive-red affordance, numeric ids in call-args, list no-token→spinner, new/[id] silent-null vs index `push("/")`, the 3 nav + 2 quick-action hrefs, card-grid/search/category+inactive badges.
- ✅ i18n fix recorded: `emailTemplates.form.editorPlaceholder` added to de.json + en.json (parity test green; hi.json subset tolerated).

### File List

New — slice `frontend/src/features/communication/email-templates/`:
- `api/email-templates-api.ts`, `api/email-templates-api.test.ts`
- `schemas/email-template.schema.ts`
- `hooks/use-email-templates.ts`, `use-email-template.ts`, `use-create-email-template.ts`, `use-update-email-template.ts`, `use-delete-email-template.ts`, `use-email-template.test.tsx`
- `components/email-templates-page-content.tsx`, `email-templates-search-bar.tsx`, `email-template-card.tsx`, `email-template-category-badge.tsx`, `email-template-form.tsx` (RELOCATED), `email-template-form.test.tsx`, `communication-index-content.tsx`, `email-template-new-content.tsx`, `email-template-edit-content.tsx`
- `types/email-template.types.ts`

Moved: `frontend/src/components/email-templates/EmailTemplateForm.tsx` → `frontend/src/features/communication/email-templates/components/email-template-form.tsx`.

Modified (thin route entries + S1-spec delete adaptation + i18n): `frontend/src/app/communication/{page,email-templates/page,email-templates/new/page,email-templates/[id]/page}.tsx`, `frontend/src/app/communication/email-templates/page.test.tsx`, `frontend/messages/de.json`, `frontend/messages/en.json`.

Deleted: `frontend/src/components/email-templates/EmailTemplateForm.tsx` (moved) + the now-empty `frontend/src/components/email-templates/` directory.

## Change Log

- 2026-06-12: Story created (Email-templates 3 pages + index → `features/communication/email-templates/` slice; relocate ONLY EmailTemplateForm; DEC-1 wrap emailTemplatesApi (stays in lib), DEC-2 RHF+Zod, DEC-3 type re-export (types stay), DEC-4 native confirm() + TanStack delete; A83/A84 shared-client stays lib-resident; A86 confirm preserved; A93 404-no-retry; A77 badge tokens; placeholder i18n fix). Status ready-for-dev.
- 2026-06-12: Implemented (autonomous whole-epic E25 session). Slice built (WRAP); EmailTemplateForm relocated + RHF+Zod; index thinned; real 404 sentinel (ApiClient carries statusCode); placeholder i18n'd. emailTemplatesApi + types stay lib-resident (sibling slices consume them). Full suite 1050/1050 green, tsc/eslint clean, dir removed. Status → review.
- 2026-06-12: Epic-25 boundary review — 4 patches applied (P6 MED: dropped `.trim()` on `name`/`subject` so the `onSave`/`createTemplate`/`updateTemplate` payload is byte-identical to HEAD; P7 LOW: edit no-token spinner parity with the list page; P8 LOW: edit generic load-error → server `message` not the generic key; P9 LOW: inactive badge → distinct variant (category `outline`, inactive `secondary`) so they're visually separable again). +regression test. See epic-25-boundary-review-2026-06-12.md.
