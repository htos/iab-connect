# Epic-27 Boundary Code Review — Frontend Feature-Slice Migration (Admin)

**Date:** 2026-06-12
**Reviewer:** claude-opus-4-8[1m] (hybrid CR+ER epic-boundary review; 4 parallel adversarial layers + central triage)
**Scope:** the full E27 working-tree diff — the E27-S1 characterization net (10 new specs + 5 extended, 15 admin pages, +223 tests) + the five admin sub-area slices (`features/admin-users` [S2 WRAP `lib/api/users`], `features/admin-settings` [S3 BUILD-on-`useApiClient`], `features/admin-system` [S4 WRAP audit/backup/health/retention], `features/admin-integrations` [S5 BUILD-on-`useApiClient`], `features/admin-documents` [S6 WRAP `lib/services/documents` + public register]) + the 14 thinned `app/admin` route entries + the `lib/api/health.ts` `res.ok` guard + the `docs/architecture-frontend.md` area-sub-slice note. ~173 frontend `.ts/.tsx` files (21 tracked changed: +1,518/−6,889 as god-pages gutted into thin entries; 152 new slice files).
**Verdict:** ✅ **APPROVED** — 4 patches applied, 3 dismissed-with-evidence, 0 deferred, 0 decision-needed. Post-patch: full suite **1434/1434 green (158 files)**, `tsc --noEmit` exit 0, `eslint` clean (E21-S5 boundary), `prettier --check` clean. (`next build` deferred to the program-level gate per A58.)

## Method (4 parallel adversarial review layers + central triage)

1. **Net-integrity auditor** (Acceptance Auditor): verified the S1 net was NOT weakened during S2..S6 (no hollow/deleted/loosened assertions beyond the 2 licensed changes), no tautological/skipped tests, and that each net still pins the ORIGINAL behaviour against the NEW slice code (spot-checked users two-step-save, api-clients/webhooks secret-once, documents delete-folder-modal). **Result: NET INTEGRITY = PASS.**
2. **Behaviour-preservation / correctness auditor** (per-slice): diffed every god-page against its slice, hunting transport-fidelity (A94 byte-identical URLs/params/bodies/trailing-slashes), TanStack invalidation correctness, the two-step user save, derived-state refactors, query gating/retry (A99).
3. **Data-loss & security edge-case hunter**: the show-once secret panels (leak/loss), the auth guards (bypass/weakening/token-gating), the destructive-action FAILURE branches (un-rolled-back optimistic updates), FormData/upload/token paths.
4. **Boundary & cross-cutting quality auditor**: E21-S5 import boundary (no `@/features/*` cross-imports), no new direct API URLs in components, no new `any`, A77 badge tokens, A86 affordance colours, A96 form rules, dead code, i18n.

## Findings & disposition

### Patches APPLIED (4)

| # | Sev | Slice | Title | Fix |
|---|-----|-------|-------|-----|
| P1 | MED | admin-users | The list delete/disable overlays (`deletedIds`/`overrides`) were never reset, contradicting a comment that claimed they reset on a new fetch — so a stale optimistic edit could mask fresher server data after a search/page change (the god-page re-seeded its whole list on every fetch). | Reset the overlays when the active FILTER (page/search) changes, via React's sanctioned adjust-state-during-render pattern — keyed on the filter, NOT on `data` identity (a same-key invalidation refetch must NOT clear an optimistic delete, or the S1 delete spec's just-deleted row would flash back). Comment corrected to match. |
| P2 | LOW | admin-system | The retention form's A95 "out-of-set action round-trips" was dead: the comment + the extra `<option>` promised a round-trip, but `action: z.enum([...3])` would REJECT an out-of-set stored value (latent only — the backend enum is exactly those 3 today). | `action` → `z.string().min(1)` (matches the members A95 precedent), making the extra-option round-trip genuinely work; removed the now-unused `ALL_RETENTION_ACTIONS` const. |
| P3 | LOW | admin-integrations | `webhook-deliveries-page-content` lacked the explicit non-admin `return null` terminal that every sibling admin page has, so a non-admin saw the page shell for one beat before the redirect (no data leak — the query was gated off). | Added `if (!isAuthenticated || !isAdmin) return null;` after the `authLoading` gate (A90/A97 parity with api-clients/webhooks). |
| P4 | LOW | admin-users | A77 inconsistency: `user-role-badge` kept the god-page's blue `vorstand` badge (self-pinned by a fresh slice test) while the sibling `custom-role-badge` (S3) remapped `Vorstand` blue→amber per DEC-3 ("no blue in authenticated UI"). | Remapped `user-role-badge` `vorstand` to `bg-amber-100 text-amber-800` to match the settings slice + updated its slice test. The E27-S1 list net asserts the role by translated LABEL (not colour), so it stays green; the password-reset BUTTON stays blue (A86 affordance, out of scope). |

### Dismissed (3, with evidence)

- **D1** (admin-settings, LOW): the god-page's `validationError` TOP banner on a malformed hex/email is no longer shown — but the per-field Zod error renders AND the save is still blocked (the essential behaviour holds; the per-field surface is the A96 improvement). The S1 net does not pin the banner. Not worth re-adding a second redundant error surface.
- **D2** (admin-system retention, LOW): clearing `retentionMonths` now blocks the save with a field error instead of silently coercing the empty input to `1`. The old silent coerce-to-1 was lossy; blocking is the deliberate A96 improvement. Only differs on the empty-input edge (not pinned by the net's valid-input tests).
- **D3** (admin-users, LOW): the create form now shows the email-required AND password/invitation-required errors together rather than the god-page's email-first short-circuit. Both still block submit and prevent `createUser`; the net pins each message independently. Acceptable parity.

### Deferred (0). Decision-needed (0).

## Cross-cutting confirmations (all PASS)

- **Net integrity:** PASS — the 15-page characterization net (247 admin tests) was not weakened beyond the 2 licensed changes (S4's DEC-4 restore blue/orange→RED affordance promotion, verified to pin a real distinct class; S5's `QueryClientProvider` render-wrapper with zero assertion drift). No tautological/skipped tests. The net remains a trustworthy regression oracle.
- **Transport fidelity (A94):** no URL/param/body/trailing-slash regression in any slice — users (WRAP `lib/api/users`, 409 message + two-step save preserved), settings (logo FormData field `"file"`, blank→null, create-subset vs edit-full role bodies), system (audit 7 server-side filters + pageSize=50, the `health.ts res.ok` guard is success-path-byte-identical), integrations (exact trailing slashes: list/create `/`, PUT/DELETE/enable/disable no slash, deliveries `/?page=`), documents (`getFolders(parentId)`, set-permissions body).
- **Data-loss / security:** SECRETS=OK (both show-once panels source the cleartext only from the create response, render once, dismiss clears permanently, the list DTOs carry no secret so a refetch can't resurrect it; webhooks shows it create-only, no invented regenerate). GUARDS=OK (every real admin page gates on `isAuthenticated && isAdmin && accessToken` → `push("/")` → `return null`; `register` stays public; the documents non-`return null` spinner-during-redirect is the explicitly pinned DEC-3 behaviour). FAILURE-BRANCHES=OK (every delete/revoke/restore/disable applies its optimistic change only `onSuccess` — no un-rolled-back optimistic update anywhere; failed deletes keep the list/confirm state).
- **Boundary (E21-S5):** zero `@/features/admin-*` cross-sibling imports; every intra-slice import is relative; no raw `/api/v1` URL in any production component or route file (all in the slice `api/` layer or the wrapped lib); every route `page.tsx` is a thin server entry (the only `"use client"` is the slice composition root).
- **Quality rules:** no new `any`; no new hard-coded user-facing strings; A77 badges are token-mapped or the documented literal-class exception (pinned by the net); A86 affordance colours preserved (delete=red, mfa-reset=orange, password-reset=blue, restore=red per DEC-4); A96 forms use `<form noValidate>` + per-field errors and no `.trim()`/transform on submitted-byte fields; no `console.log`/`TODO`/`FIXME`; no abandoned hooks/dead exports.
- **tsc/eslint/prettier (post-patch):** `tsc --noEmit` exit 0; `eslint` clean (incl. the generic `src/features/**` boundary); `prettier --check` clean on all changed files.

## Outcome

All 15 admin pages are now feature-sliced into five mutually-independent sub-area slices (`features/admin-{users,settings,system,integrations,documents}`), the 14 route files are thin server entries, and the `admin/*` area-sub-slice convention is recorded in `docs/architecture-frontend.md`. The S1 characterization net (247 admin tests / +223) plus the new slice unit tests (+154) prove behaviour preservation; the whole frontend suite is **1434/1434 green**. **Review APPROVED → proceed to bmad-retrospective**, then flip E27-S1..S6 + epic-27 to `done`.
