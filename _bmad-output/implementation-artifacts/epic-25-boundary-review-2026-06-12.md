# Epic-25 Boundary Code Review — Frontend Feature-Slice Migration (Communication)

**Date:** 2026-06-12
**Reviewer:** claude-opus-4-8[1m] (hybrid CR+ER epic-boundary review; 4 parallel adversarial layers + central triage)
**Scope:** the full E25 working-tree diff — the E25-S1 characterization net (11 new specs + 3 retained) + the three CRUD slices (`features/communication/automations` [S2 WRAP], `features/communication/email-campaigns` [S3 BUILD-on-`useApiClient`], `features/communication/email-templates` [S4 WRAP + `EmailTemplateForm` relocation + index thin-entry]) + the thinned `app/communication` route entries + the i18n key add. 97 files, +11,439/−4,665.
**Verdict:** ✅ **APPROVED** — 9 patches applied, 2 dismissed, 0 deferred, 0 decision-needed. Post-patch: full suite **1057/1057 green (122 files)**, `tsc --noEmit` exit 0, `eslint` clean (E21-S5 boundary), `next build` ✓ compiled successfully.

## Method (review layers — adapted to the >3000-line diff by chunking per sub-module, per the skill's chunking rule)

1. **Adversarial behaviour-preservation review per slice** (3 layers — automations / email-campaigns / email-templates+index): each reviewer diffed every slice production file against the original god-page at HEAD (`git show HEAD:…`) and hunted the program's recurring defect classes (A76/A80 destructive affordance+failure-branch, A85 stable callbacks, A86 contextual destructive colour, A92 error-path input preservation, A93 retry/sentinel, A88 transport-adaptation fidelity, A77 badge tokens, A79 manual→TanStack deltas, form-payload byte-parity, per-page guard parity, E21-S5 boundary).
2. **Characterization-net integrity auditor** (Acceptance Auditor): verified the S1 net was NOT weakened during the refactor (no hollow/deleted assertions), the relocated `AutomationForm` test assertions actually moved (not vanished), i18n parity, no raw `/api/v1` in production components, boundary cleanliness, and AC compliance. **Result: PASS — 0 findings; the net is a trustworthy regression oracle.**

## Findings & disposition

### Patches APPLIED (9)

| # | Sev | Slice | Title | Fix |
|---|-----|-------|-------|-----|
| P1 | HIGH | automations | Edit silently rewrote an out-of-set `segmentType`/`consentFilter` (the form offers 3 of the backend's 6/5 enum values; the god-page round-tripped the raw stored value, the slice coerced it to `AllActiveMembers`/`null` on a no-touch save) | Widened the Zod schema to the full transport unions; `buildDefaultValues` keeps the RAW value; the segment/consent `<select>`s render an extra `<option>` for an out-of-set value so it displays + round-trips. |
| P2 | MED | automations | Detail + edit showed an infinite spinner (not the god-page error panel) for an authenticated NON-privileged user on direct-nav (the god-page fetched on token-only → 403 → red error panel; the slice gated the query `enabled` on role → query never ran → stuck spinner) | `enabled` gate → token-only (`isAuthenticated && !!accessToken`); render the `loadError` panel on `isError && !automation`. `canEdit` action-gate (Vorstand/Admin) unchanged. |
| P3 | HIGH | email-campaigns | Edit-form header back-link went to the LIST + plural label (the edit god-page pointed to the DETAIL page + singular `backToCampaign`) | Threaded `backHref` + `backLabelKey` props (like `cancelHref`); new→list+plural, edit→detail+singular. |
| P4 | MED | email-campaigns | `<form noValidate>` + no field-error rendering → empty-required submit silently no-ops (god-page showed native bubbles). Also schema `.trim()` mutated the POST body | Render per-field Zod `form.required` messages under the 4 required inputs (sponsor-form recipe); schema `.trim().min(1)` → `.min(1)` so the body is byte-identical. |
| P5 | LOW | email-campaigns | Detail not-found banner showed the raw server message on a non-404 (god-page always showed localized `notFound`) | `!campaign` banner renders `t("notFound")` unconditionally; sentinel + A93 retry unchanged. |
| P6 | MED | email-templates | Relocated form `.trim()` on `name`/`subject` → `onSave` payload not byte-identical (god-page sent raw) | Dropped the `.trim()` transform (`.min(1)` only). |
| P7 | LOW | email-templates | Edit no-token route fell to silent-null instead of the god-page's stuck-spinner (inconsistent with the list page, which preserved it) | Edit spinner gate → `authLoading \|\| !accessToken \|\| queryLoading` (list-page parity). |
| P8 | LOW | email-templates | Edit generic load-error showed the generic key instead of the server message (inconsistent with the list page + god-page) | `bannerError` → `loadError.message`. |
| P9 | LOW | email-templates | Inactive badge collapsed to the same `secondary` variant as the category badge (god-page rendered them as two distinct greys) | Category → `outline`, inactive → `secondary` (A77 semantic-token variants; distinct again). |

**7 regression tests added** (suite 1050 → 1057) pinning the restored behaviour for P1 (out-of-set round-trip), P2 (non-privileged error panel), P3 (edit back-link target+label), P4 (field-error + no-POST), P6 (raw untrimmed payload).

### Dismissed (2)

- **D1** (email-campaigns, informational): create/update/delete error message now comes from `useApiClient`'s `parsed.detail` rather than the god-page's `errorData.message`. This is the **established E21-S1 DEC-1 transport contract** already shipped across E21–E29 — not introduced by this epic. For standard ASP.NET ProblemDetails it is arguably more correct. Not a regression of this change.
- **D2** (automations, cosmetic): a stale *submit* mutation error can remain visible across a subsequent *successful preview* (the god-page's shared `error` state cleared on preview). Low/cosmetic — the next `mutate` clears it; not worth a behavioural patch.

### Deferred (0) — all the Low parity items were cheap behaviour-preserving fixes and were applied rather than deferred.

## Cross-cutting confirmations (all PASS)

- **Characterization-net integrity:** substantive, not weakened; the email-campaigns detail action-matrix spec still asserts each status's endpoint+body+confirm-gate+success/error branch (the A88 fetch-spy→apiClient-spy adaptation kept the URL/body assertions). The relocated `AutomationForm` assertions moved into the slice test (superset). 0 findings.
- **Behaviour preservation (post-patch):** the 5-action email-campaigns state machine + confirm gates + modals (A92 input preserved on error) + the REQ-086 fromName race-guard (structural via TanStack+RHF) + the A93 sentinels (real 404 for email-campaigns/email-templates via status; `retry:false` for automations since the wrapped lib fn carries no status) + the A76 email-templates delete two-branch (success-removes/failure-keeps + destructive-red affordance) — all faithful.
- **Boundary (E21-S5):** no `@/features/**` cross-sibling imports inside any slice; the shared `emailTemplatesApi` + types stay in `@/lib`/`@/types` (sibling-consumed by the S2/S3 forms); no raw `/api/v1` URL in any production component (all in the `api/*.ts` layer).
- **i18n:** `emailTemplates.form.editorPlaceholder` added to de+en (parity green); no key renamed/removed.
- **Build/tsc/eslint:** `next build` ✓ compiled successfully; `tsc --noEmit` exit 0; `eslint` clean.

## Outcome

All 12 Communication pages are now feature-sliced (`features/communication/{automations,email-campaigns,email-templates}`), the route files are thin entries, `EmailTemplateForm` is relocated into its owning slice, and the Communication index is a thin entry. The S1 characterization net (151 tests) + the new slice unit tests prove behaviour preservation. **Review APPROVED → proceed to bmad-retrospective**, then flip E25-S1..S4 + epic-25 to `done`.
