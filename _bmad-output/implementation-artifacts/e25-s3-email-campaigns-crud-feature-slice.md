# Story E25.S3: Email Campaigns — CRUD Feature-Slice Extraction

Status: review

Depends on: **E25-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions. Independent of S2/S4 once S1 is green. **Consumes `@/lib/email-templates` for the template load-into-campaign dropdown (boundary-legal `features→lib`; do NOT import the email-templates slice — A83/E21-S5).** **The LARGEST E25 sub-slice** — the detail page is a status state machine with five mutations.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the four Email-campaigns pages refactored into a `src/features/communication/email-campaigns/` slice,
so that the second parallel Communication CRUD surface matches the proven recipe with the send/schedule/cancel/resend behaviours preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E25-S1 Email-campaigns tests stay green):**

1. Routes `/communication/email-campaigns`, `/new`, `/[id]`, `/[id]/edit`; the Vorstand-or-Admin gate; list load + server `?status=` filter + client search + pagination + loading/error/empty + table + status badge (Draft/Scheduled/Sending/Sent/Cancelled/Failed) + per-row Draft-only edit/delete + statistics columns + delete (`confirm`→DELETE→refetch); new/edit form (basic info / sender / recipients-segment selection incl. MemberSegment search + Custom / content with RichTextEditor↔HtmlSourceEditor toggle + plaintext / template load-in dropdown), submit → POST/PUT → redirect, validation, submit-error, the edit Draft-only guard; the AppSettings `fromName` default race-guard (REQ-086).

2. The **detail page status state machine** works exactly as before: parallel load (campaign + statistics + recipients); the per-status action set — Draft → {Edit, Test-email modal, Schedule modal, Send-now (`confirm`)}, Scheduled → {Cancel (`confirm`)}, Sent → {Resend modal: all vs failed-only}; the 7-card statistics grid; the DOMPurify-sanitized email preview; the recipients table + `getRecipientStatusColor`. Each action's endpoint (`/test`, `/schedule`, `/send`, `/cancel`, `/resend`, `/resend-failed`), confirm, success(refetch)/error(alert) branch preserved (A76).

**Improvements:**

3. Each route file becomes a **thin entry** (no `"use client"`) rendering a `features/communication/email-campaigns` content component (the only `"use client"` is the composition root).

4. A `features/communication/email-campaigns/` slice exists mirroring `features/sponsors/` + the E29 recipe. **NOTE: there is NO existing `lib/api/email-campaigns` client module — the god-pages fetch inline; `lib/api/email-campaigns.ts` holds only DTOs/enums/helpers. So this slice BUILDS the api layer (it does not merely wrap):**
   - `api/email-campaigns-api.ts` — `EMAIL_CAMPAIGNS_BASE = "/api/v1/email-campaigns"`, an `emailCampaignsKeys` factory (`all`/`list(filters)`/`detail(id)`/`statistics(id)`/`recipients(id)`), and fetch fns using `useApiClient` (consolidating the inline page fetches — list/get/create/update/delete + the 5 detail actions test/schedule/send/cancel/resend(+failed-only) + statistics + recipients). URLs/params/bodies byte-identical to the current inline fetches. Reuse the EXISTING `getStatusColor`/`getRecipientStatusColor`/`getSegmentTypeLabel` + DTOs/enums from `@/lib/api/email-campaigns.ts` (helpers stay; the slice api owns the transport).
   - `hooks/` — `use-email-campaigns` (list) + `use-email-campaign` (get-by-id, +`EmailCampaignNotFoundError` + A93 retry-exclusion) + `use-campaign-statistics` + `use-campaign-recipients` + `use-create-email-campaign`/`use-update-email-campaign`/`use-delete-email-campaign` + `use-campaign-actions` (test/schedule/send/cancel/resend mutations) with `emailCampaignsKeys` invalidation.
   - `schemas/email-campaign.schema.ts` — Zod shared by new+edit (name/subject/fromName/fromEmail/htmlContent/segmentType required; behaviour-preserving).
   - `components/` — `email-campaigns-page-content`, `email-campaigns-filter-bar`, `email-campaigns-table`, `email-campaign-status-badge`, `email-campaign-form` (RHF+Zod, reused by new+edit, holding the segment-selection + content-editor sub-components), `email-campaign-detail` (the state-machine action bar + modals + stats + preview + recipients), `email-campaign-new-content`/`email-campaign-edit-content`. Reuse the EXISTING shared `RichTextEditor`/`HtmlSourceEditor` ui components (do NOT duplicate).
   - `types/email-campaign.types.ts` — re-exports DTOs/enums from `@/lib/api/email-campaigns` (DEC-3).

5. Status + recipient badges map to **Badge variants/tokens (DEC-2)** — no raw brand strings in feature components; verified against the named token (A77). The forms use RHF+Zod (E22); validation messages via next-intl.

6. The manual→TanStack deltas (A79) are decided explicitly: list refetch via `invalidateQueries`; the 5 detail mutations invalidate `detail(id)`+`statistics(id)`+`recipients(id)`+`all` as appropriate; mutation errors surfaced (the current alert UX preserved, not silently sticky); chosen retry semantics documented (A93 404-exclusion).

7. No new `any`, no new hard-coded user-facing strings, no new direct `/api/v1` URL in route files/components (all consolidated into the slice api), no duplicate UI primitive; i18n parity stays green (reuse existing `emailCampaigns.*` keys; no renames/removals). The neutral `noreply@example.org` default + the AppSettings `fromName` race-guard (REQ-086) are preserved.

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded in Dev Agent Record below
  - [x] E25-S1 Email-campaigns specs green at HEAD (75). Confirmed `features/communication/email-campaigns/` did NOT exist. Re-read the 4 pages + `lib/api/email-campaigns.ts` (DTOs/helpers) + the E29 board-documents detail slice (A56).
  - [x] **DEC-1 = A BUILD** — consolidated the inline fetches into `api/email-campaigns-api.ts` via `useApiClient` (no module to wrap). `EMAIL_CAMPAIGNS_BASE` + `emailCampaignsKeys` (`all`/`list`/`detail`/`statistics`/`recipients`); URLs/params/bodies byte-identical. Helpers/DTOs stay in `@/lib/api/email-campaigns.ts`.
  - [x] **DEC-2 = A** — RHF+Zod `email-campaign-form`. **Required set VERIFIED against the god-page = native-required name/subject/fromName/fromEmail ONLY** (htmlContent + segmentType carried NO `required` → kept optional so the S1 net's empty-htmlContent submit still POSTs; no `.email()` added — the native form applied none). REQ-086 `fromName` race-guard preserved (structural now: TanStack settings query doesn't re-run + RHF captures defaults once at mount → the god-page's no-clobber ref was dropped, also fixing a lint); neutral `noreply@example.org` default preserved.
  - [x] **DEC-3 = re-export** DTOs/enums from `@/lib/api/email-campaigns` via `types/email-campaign.types.ts`.
  - [x] **DEC-4 = A** — `use-campaign-actions` TanStack mutations (test invalidates nothing; schedule/send/cancel/resend invalidate detail+statistics+recipients+all). Native `confirm()` on send-now + cancel + the test/schedule/resend modals + the per-status matrix preserved (A86); error branch keeps the god-page's FIXED failure-key `alert` (A76 parity).
- [x] Task 1: Scaffolded slice `api` + `types` + `schemas` — `email-campaigns-api.ts` (+ the 5 actions + statistics + recipients + folded `fetchActiveMemberSegments`) + `types/email-campaign.types.ts` + `schemas/email-campaign.schema.ts` + `email-campaigns-api.test.ts`.
- [x] Task 2: Hooks — list/detail(+`EmailCampaignNotFoundError`, A93 retry-exclusion — a REAL 404 sentinel is feasible here since `useApiClient` returns `status`)/statistics/recipients queries; create/update/delete + `use-campaign-actions` mutations + invalidation. `use-email-campaign.test.tsx`.
- [x] Task 3: Components — list — `email-campaigns-page-content` (+filter-bar/table/status-badge); Draft-only edit/delete affordances; delete confirm flow.
- [x] Task 4: Components — detail — `email-campaign-detail`: the state-machine action bar + test/schedule/resend modals + send/cancel confirms + 7-card stats + DOMPurify preview + recipients table. Per-status action matrix preserved exactly.
- [x] Task 5: Components — new + edit forms — `email-campaign-form` (RHF+Zod; segment selection incl. MemberSegment search + Custom; content editor toggle reusing shared RichTextEditor/HtmlSourceEditor; template load-in dropdown via `emailTemplatesApi`) + `email-campaign-new-content`/`email-campaign-edit-content` (edit Draft-only guard + the REQ-086 fromName race-guard). `email-campaign-form.test.tsx`.
- [x] Task 6: Thin route entries + green-the-net + DoD — 4 route files → thin entries (detail/edit content keep `useParams()` — the god-pages used it, NOT `use(params)`); E25-S1 specs green via the A88 transport adaptation (global-fetch stub → `useApiClient` spy added to the `@/lib/auth` mock; endpoint+body re-pointed; EVERY behavioural assertion preserved); new slice unit tests; `tsc` exit 0 / eslint(slice+changed) clean (boundary) / `vitest run` FULL **1029/1029 green (117 files)**, no regressions; LF. A79 deltas recorded. (`next build` deferred to epic boundary per A58.)

## Dev Notes

Second Communication sub-slice; nests under `features/communication/email-campaigns/`. **Unlike automations (a token-fn module to wrap), email-campaigns has NO api module — the fetches are inline in the pages — so this slice BUILDS the api layer** (consolidating ~6 inline-fetch surfaces across 4 pages into `email-campaigns-api.ts`). The detail page is the richest surface in E25 (a Draft/Scheduled/Sending/Sent/Cancelled/Failed state machine with test/schedule/send/cancel/resend mutations + statistics + recipients + a DOMPurify preview) — treat it like the E29 board-documents detail. Independent of S2/S4.

### Scope Boundaries

- In scope: `features/communication/email-campaigns/` (api/hooks/components/schemas/types) for the 4 pages; thin route entries; consolidating the inline fetches; new slice unit tests.
- Out of scope: automations + email-templates (S2/S4); the index (S4); the shared `RichTextEditor`/`HtmlSourceEditor` (reuse, do NOT modify/duplicate); `@/lib/email-templates` (read-only for the template load-in; do NOT move); `@/lib/api/email-campaigns.ts` helpers/DTOs (reused, keep); i18n changes; route-group moves.

### Architecture Guardrails

- Mirror the E29 board-documents detail slice (mutation-heavy) + the sponsors form recipe (api → `*Keys` + fns via `useApiClient`; hooks → query/mutation + invalidation; thin `"use client"` root; relative intra-slice imports; NO `@/features/communication/<sibling>` import — E21-S5).
- The template load-in dropdown calls `emailTemplatesApi` (`@/lib/email-templates`) — keep that import (lib, legal).
- `useApiClient` returns `{data,error,status}` and never throws; hooks throw on `result.error` to drive TanStack rejection; a 404 → `EmailCampaignNotFoundError` with retry disabled (A93).
- A77: verify status/recipient badge token values against the named brand colours.
- The DOMPurify sanitize + the RichTextEditor/HtmlSourceEditor behaviour must be preserved verbatim (these are the email-content surfaces).
- Do NOT change request/response contracts — the 6 endpoints' URLs/params/bodies byte-identical to the current inline fetches.
- DoD as E29 (changed-files eslint/prettier; never `npm run format`; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43)

- **DEC-1 BUILD vs wrap:** A) BUILD `email-campaigns-api.ts` via `useApiClient` consolidating the inline fetches (recommended — no lib module exists to wrap; this is the A94 "raw-fetch god-page → adapt" branch). B) first extract a `lib/api/email-campaigns` client then wrap it (extra indirection, no benefit). **Recommended: A.**
- **DEC-2 form:** A) E22 RHF+Zod. B) manual `useState`. **Recommended: A.**
- **DEC-3 type home:** A) re-export from `@/lib/api/email-campaigns`. B) relocate. **Recommended: A.**
- **DEC-4 detail mutations:** A) `use-campaign-actions` TanStack mutations + preserved confirm/modals. B) keep inline handlers. **Recommended: A.**

### Testing Requirements

- The E25-S1 Email-campaigns specs are the regression oracle. Because this slice BUILDS the api (inline `fetch` → `useApiClient`), the S1 transport mocks (global `fetch` stub) must adapt to the slice api / `useApiClient` spy (the E24-S2/A88 lesson — the heaviest adaptation in E25); preserve EVERY behavioural assertion (gate, action endpoints, navigation, status badges, state-machine action matrix, preview). Document the adapted assertions.
- Add slice unit tests: `email-campaigns-api` URL/key shape (incl. the 5 actions); `use-email-campaign` (404→sentinel, no-retry); a `use-campaign-actions` mutation invalidation; `email-campaign-form` RHF+Zod. A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/communication/email-campaigns/{api,hooks,components,schemas,types}`; thin entries at `app/communication/email-campaigns/{page,new/page,[id]/page,[id]/edit/page}.tsx`.

### References

- Slice templates: `frontend/src/features/board-documents/` (the E29 mutation-heavy detail slice — closest precedent), `frontend/src/features/sponsors/` (form recipe), `frontend/src/features/documents/api/documents-api.ts` (`*Keys` shape).
- Pages: `frontend/src/app/communication/email-campaigns/{page,new,[id],[id]/edit}.tsx` (inline fetches; the detail action handlers; the REQ-086 fromName guard).
- Helpers/DTOs to reuse: `frontend/src/lib/api/email-campaigns.ts` (`getStatusColor` :137-154, `getRecipientStatusColor` :156-180, `getSegmentTypeLabel`, DTOs/enums, `EmailCampaignStatus`). Shared ui: `frontend/src/components/ui/rich-text-editor` + the HtmlSourceEditor. Template load-in: `frontend/src/lib/email-templates.ts`.
- `frontend/src/lib/auth.ts:169-295` (useApiClient); `frontend/eslint.config.mjs` (E21-S5); E25-S1; project-context.md A34/A56/A58/A72/A73/A76/A77/A78/A79/A86/A88/A93/A94; `docs/architecture-frontend.md`.

## Validation Notes

- Created 2026-06-12 (whole-epic E25 batch, A34). Status ready-for-dev. HARD-ordered after E25-S1. Four DECs carry recommended options for A41/A32 + A43.
- **A56 findings (load-bearing):** email-campaigns has **NO api module** — the 4 god-pages fetch inline (`lib/api/email-campaigns.ts` is DTOs/helpers only) → S3 BUILDS the api layer via `useApiClient` (DEC-1=A; the A94 "no lib module → adapt" branch, NOT a wrap). The detail page is a Draft/Scheduled/Sending/Sent/Cancelled/Failed state machine with five mutations (test/schedule/send/cancel/resend) + statistics + recipients + DOMPurify preview — the richest E25 surface (treat as the board-documents-detail peer). Forms manual `useState` → E22 RHF+Zod. The S1 transport adaptation is the heaviest of the epic (inline-fetch-stub → slice-api spy). `emailTemplatesApi` stays in lib (template load-in dropdown). REQ-086 fromName race-guard + neutral noreply default preserved.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (autonomous whole-epic dev-story; slice extraction by a focused subagent, central verification by the orchestrator). The richest/heaviest E25 slice.

### Debug Log References

**A43 (a)/(b)/(c) — DEC resolutions (A41 autonomous mode; user directive "das ganze epic implementieren mit allen stories. ohne stop"):**
- **DEC-1 (a)** BUILD `email-campaigns-api.ts` on `useApiClient`. **(b)** no lib client module exists (the 4 god-pages fetched INLINE via `useAuth().accessToken`) so there is nothing to WRAP — the A94 "raw-fetch god-page → adapt" branch. **(c)** URLs/params/bodies byte-identical; because the page now routes through `useApiClient` (not inline fetch) the S1 specs needed the A88 fetch-spy→apiClient-spy adaptation.
- **DEC-2 (a)** RHF+Zod form. **(b)** the E22 sub-recipe; editors + `emailTemplatesApi` shared/boundary-legal so no duplication. **(c)** required set VERIFIED = native-required name/subject/fromName/fromEmail ONLY; htmlContent/segmentType kept optional (god-page had no `required` on them) so the S1 empty-htmlContent submit still POSTs; no `.email()` added (would reject previously-accepted values). REQ-086 fromName no-clobber is now STRUCTURAL (TanStack settings query + RHF mount-once defaults) → the god-page ref dropped (also fixed a `react-hooks/refs` lint); neutral default preserved.
- **DEC-3 (a)** re-export DTOs/enums. **(b)** E23/E29 pattern, `features→lib` legal. **(c)** feature code never reaches across to `@/lib/api/email-campaigns` for a type; lib stays the source of the DTOs + colour/label helpers.
- **DEC-4 (a)** `use-campaign-actions` mutation set. **(b)** mirrors the board-documents mutation-set recipe; invalidation replaces the god-page `await fetchCampaign()`. **(c)** native `confirm()` on send-now + cancel + the test/schedule/resend MODALS + the per-status MATRIX preserved (A86); error branch keeps the god-page's FIXED failure-key `alert` (testEmailFailed/scheduleFailed/sendFailed/cancelFailed/resendFailed), NOT the server message (A76 parity); `test` invalidates nothing (god-page parity).
- **A93 (a)** real sentinel — `use-email-campaign` throws `EmailCampaignNotFoundError` on `status===404`, generic Error otherwise; `retry: (n,err)=>!(err instanceof EmailCampaignNotFoundError) && n<1` (mirrors `use-board-document`). **(b)** unlike the automations sibling (no status from the wrapped lib fn → retry:false), `useApiClient` returns `status` so a 404 is distinguishable. **(c)** not-found/error surface preserved; the edit spec sets `retryDelay:0` to keep the one non-404 retry deterministic (timing only).

### Completion Notes List

- ✅ Email-campaigns 4 pages → `features/communication/email-campaigns/` slice (api/hooks/components/schemas/types) mirroring the board-documents (mutation-heavy detail) + sponsors (form) recipes. The detail status state machine (Draft/Scheduled/Sending/Sent/Cancelled/Failed) + 5 mutations (test/schedule/send/cancel/resend(+failed-only)) + statistics + recipients + DOMPurify preview all behaviour-preserving.
- ✅ **Full suite 1029/1029 green (117 files)** = 1000 (post-S2) + 29 new slice unit tests; **no regressions**. `tsc --noEmit` exit 0. `eslint` on slice + changed files clean incl. the E21-S5 boundary (no `@/features/**` imports — relative only). No raw `/api/v1` URL left in any component/route (consolidated into the api). New files `prettier --write` (LF); modified route files hand-matched (god-pages → thin entries: 4 files, +18/−2591).
- ✅ **Heaviest S1 adaptation (A88/E24-S2):** the 4 S1 email-campaigns specs re-pointed from `vi.stubGlobal("fetch")` → a stable `useApiClient` spy added to the `@/lib/auth` mock; transport assertions re-pointed to method+endpoint+body; EVERY behavioural assertion preserved (per-status action matrix + endpoints + confirm gates + refetch/alert, list Draft-only edit/delete + delete flow, badges via label, 7-card stats, DOMPurify preview, recipients, navigation, REQ-086).

### File List

New — slice `frontend/src/features/communication/email-campaigns/`:
- `api/email-campaigns-api.ts`, `api/email-campaigns-api.test.ts`
- `schemas/email-campaign.schema.ts`
- `hooks/use-email-campaigns.ts`, `use-email-campaign.ts`, `use-campaign-statistics.ts`, `use-campaign-recipients.ts`, `use-create-email-campaign.ts`, `use-update-email-campaign.ts`, `use-delete-email-campaign.ts`, `use-campaign-actions.ts`, `use-email-campaign.test.tsx`
- `components/email-campaigns-page-content.tsx`, `email-campaigns-filter-bar.tsx`, `email-campaigns-table.tsx`, `email-campaign-status-badge.tsx`, `email-campaign-recipient-badge.tsx`, `email-campaign-form.tsx`, `email-campaign-form.test.tsx`, `email-campaign-detail.tsx`, `email-campaign-new-content.tsx`, `email-campaign-edit-content.tsx`
- `types/email-campaign.types.ts`

Modified (thin route entries + S1-spec A88 adaptation): `frontend/src/app/communication/email-campaigns/{page,new/page,[id]/page,[id]/edit/page}.tsx` + their `*.test.tsx`.

## Change Log

- 2026-06-12: Story created (Email-campaigns 4 pages → `features/communication/email-campaigns/` slice; DEC-1 BUILD api (no lib module to wrap), DEC-2 RHF+Zod, DEC-3 type re-export, DEC-4 detail-mutation hooks; status state machine + 5 mutations preserved; A93 404-no-retry; A77 badge tokens; emailTemplatesApi stays in lib). Status ready-for-dev.
- 2026-06-12: Implemented (autonomous whole-epic E25 session). Slice BUILT on `useApiClient` (heaviest transport adaptation); 5-action mutation set with preserved confirm gates + matrix + fixed-key alerts; RHF+Zod form (required set verified, REQ-086 structural); real 404 sentinel + retry-exclusion (A93). Full suite 1029/1029 green, tsc/eslint clean. Status → review.
- 2026-06-12: Epic-25 boundary review — 3 patches applied (P3 HIGH: edit-form header back-link → detail page + singular `backToCampaign` via threaded `backHref`/`backLabelKey`, was list+plural; P4 MED: restored per-field Zod `form.required` rendering — empty-required submit no longer silently no-ops — + dropped schema `.trim()` for a byte-identical POST body; P5 LOW: detail not-found banner → localized `notFound` on non-404). +regression tests. See epic-25-boundary-review-2026-06-12.md.
