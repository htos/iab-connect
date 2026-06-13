# Story E31.1: Migrate residual consumers to the standard HTTP contract

Status: ready-for-dev

Depends on: **ALL of E22–E30 (closed)** — every domain slice that will OWN a relocated transport already exists. Inherits the **E21-S1 standard contract** (`useApiClient` in `lib/auth.ts`; reference slices `features/suppliers/api`, `features/sponsors/api`) and the **E21-S5 import-boundary lint** (`frontend/eslint.config.mjs`). Blocks **E31-S2** (deletion) — S2 may delete a legacy module only once S1 has left it with **zero importers**. This is the penultimate story of the entire Frontend Refactoring Program.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want every remaining importer of the legacy HTTP clients (`lib/api-client.ts`, `lib/email-templates.ts`, every `lib/api/*` module, every `lib/services/*` module) migrated onto each resource's **owning feature slice**, with request/response shapes, endpoints, auth-header behaviour, error mapping and 204-empty handling **byte-identical**,
so that no production code path or test depends on a legacy client, the importer count of every legacy path reaches **zero**, and E31-S2 can delete the legacy layer safely.

## Context

This is **not** the "short residual tail" the epic skeleton assumed. The reason these legacy modules survived E22–E30 is the deliberate **A94 WRAP / A106 live-binding re-export** strategy: rather than re-implement each transport in the new slice, every domain epic *wrapped* the existing `lib` module so the old `vi.mock("@/lib/...")` test seams kept intercepting with zero edits. The consequence: **the `lib/api/*` and `lib/services/*` modules are still the actual transport implementations** — they were never reimplemented in the slices. "Retire the legacy clients" therefore means **unwinding every wrap**: relocate each transport's implementation into the slice that owns the resource, move the co-located DTOs/enums/pure-helpers with it, repoint every importer, and **retarget ~30+ existing `vi.mock` seams** from the `@/lib/...` path to the new slice path.

**The safety net already exists.** Unlike every prior epic, E31 needs **no new characterization net** — the 2013-test suite (216 files) that E22–E30 built *is* the oracle. Behaviour is "preserved" iff that suite stays green after each module's importers and mocks are repointed. There is **no behaviour-pinning step**; there is a **relocate-and-repoint step gated on the green suite** (A87 inverted: the net is pre-existing, not authored here).

**Epic-gap correction (load-bearing).** The epic's enumerated list omits **`lib/email-templates.ts`** — yet it is the **sole importer of `lib/api-client.ts`** (the `ApiClient` class S2 must delete). `email-templates.ts` exports `emailTemplatesApi` and is sibling-consumed by the `automations` and `email-campaigns` sub-slices (the E25 A83/A84 reason it stayed in `lib`). **You cannot delete `api-client.ts` without first migrating `email-templates.ts` off `ApiClient`.** This chain is therefore *required* scope for S1, not optional — it is included below.

**Transport-semantics hazard (load-bearing).** `useApiClient()` returns `{ data: T|null, error: string|null, status: number }` and **never exposes the response body** — it flattens ProblemDetails into a `string`. Several legacy `lib/services/*` fns return the richer `ApiResult<T>` = `{ success, data, error?, errorBody?, status? }`, and **`app/(dashboard)/events/[id]/VolunteerSelfSignupSection.tsx` depends on `res.errorBody?.errorCode`** (ShiftFull / AlreadyAssigned / SignupNotAllowed / NoMemberLink) **and `res.status === 204`**. Forcing that surface through `useApiClient` would silently drop the typed error-code discrimination — an A99-class behaviour regression. The migration must therefore **relocate the transport byte-identical (preserving the `ApiResult`/`errorBody` shape where a consumer reads it)**, not blanket-rewrite onto the hook (see DEC-1).

## Acceptance Criteria

**Behaviour preserved (the existing 2013-test suite is the oracle):**

1. **Full enumeration.** A verification step (committed in the Dev Agent Record) lists, **before** and **after**, every importer of: `lib/api-client.ts` (incl. `ApiClient`/`createApiClient`/`ApiError`); **`lib/email-templates.ts`** (`emailTemplatesApi`); each `lib/api/*` module (`registration`, `audit`, `retention`, `backup`, `email-campaigns`, `users`, `members`, `automations`, `privacy`, `budgets`, `apiClients`, `webhooks`, `health`); each `lib/services/*` module (`api`, `documents`, `events`). Use the grep recipe in Dev Notes.
2. **Each importer migrated to the owning slice.** Every enumerated residual importer is repointed to the resource's owning `features/<domain>/api/<domain>-api.ts` (or its `types/`), per the **migration map** in Dev Notes. Request/response shapes, **exact URL paths + HTTP verbs**, auth-header behaviour (Bearer-token-param vs anonymous vs server-root `/health*`), error mapping (`ApiError`/non-OK throw vs `ApiResult.errorBody`), and 204/empty-body handling are **byte-identical**. No backend, route, route-group, or API-contract change.
3. **Importer count reaches ZERO.** After migration, the grep from AC-1 shows **zero** importers of every legacy path — OR any deliberately-retained shim is explicitly documented (path + reason + follow-up) so S2 knows to keep it. (Per the live scan, **no retained shim is expected**: every legacy module has an existing owning slice — record a shim only if a genuine blocker emerges.)
4. **Suite stays green, nothing removed.** `npm test -- --run` stays green; **no test is removed or skipped**; total test count is **unchanged or higher** (tests move with their transport — relocation, not deletion). Every `vi.mock("@/lib/...")` seam is retargeted to the new slice path (or the test is relocated). No route, API-contract, auth, or i18n behaviour change.

**Improvements (the migration):**

5. **One client, one error model.** Migrated calls collapse onto the owning slice's `api/` layer; the per-resource `lib` indirection and the class-based `ApiClient` `fetch` wrapper are no longer referenced by any consumer of a migrated resource.
6. **Recipe + boundary conformance.** Migrated slices follow the E21-S1 recipe (typed `api/<domain>-api.ts`, hook-based client access where applicable) and satisfy the E21-S5 import boundary **without new `@/features/**` cross-imports** — where a symbol is genuinely shared across sibling sub-slices/features, it is relocated to a shared `@/types/*` home (preferred) or, only with an explicit `// eslint-disable-next-line no-restricted-imports` + reason, cross-imported (see DEC-2/DEC-3).

## Tasks / Subtasks

- [ ] **Task 0: Spike + enumerate + resolve DECs** (AC: 1, all) — A56; record A43 (a)/(b)/(c) per DEC.
  - [ ] Run the **enumeration grep** (Dev Notes "Verification recipe") and capture the *before* importer list per legacy path. Confirm `npm test -- --run` is green at HEAD (the oracle).
  - [ ] For each legacy module, classify its live importers as **value-fn / pure-helper / type-or-enum / test-mock** (the Dev Notes migration map is the starting point — re-verify against HEAD; do not trust a stale list).
  - [ ] Resolve **DEC-1** (relocate-verbatim vs useApiClient-rewrite), **DEC-2** (shared-symbol home: `RecipientSegmentType`, `MemberDto`, `UserSession`/`SessionListResponse`, event DTOs/enums), **DEC-3** (shared *transport* home: the `documents` service used by 3 features; `emailTemplatesApi` used by 3 comm sub-slices), **DEC-4** (`services/api.ts` `ApiResult` helper placement), **DEC-5** (dead `lib/api/members.ts` fetch fns + `lib/services/events.ts` public fns — relocate-with-test vs delete-with-rationale).
- [ ] **Task 1: Pure type/const modules** (AC: 2, 3, 6) — **no fetch, lowest risk; do first.** Relocate the type/enum/const/helper definitions into the owning slice, drop the `lib` re-export, repoint importers:
  - [ ] `lib/api/budgets.ts` (types + `BUDGETS_ENDPOINT`/`BUDGET_VS_ACTUAL_ENDPOINT`/`BUDGET_VS_ACTUAL_EXPORT_ENDPOINT`) → `features/finance` (`budgeting.types.ts` + `budgeting-api.ts`).
  - [ ] `lib/api/apiClients.ts` (3 DTOs + `API_CLIENTS_BASE`) → `features/admin-integrations`.
  - [ ] `lib/api/webhooks.ts` (DTOs + `WEBHOOKS_BASE` + `WEBHOOK_DELIVERIES_BASE`; dedupe its local `PagedResult<T>` against `@/types/common`) → `features/admin-integrations`.
  - [ ] `lib/api/email-campaigns.ts` (NO fetch: helpers `getStatusColor`/`getRecipientStatusColor`/`getSegmentTypeLabel` + the campaign type-unions/DTOs incl. `RecipientSegmentType`) → `features/communication/email-campaigns`; resolve `RecipientSegmentType` per DEC-2 (consumed by `automations` too).
- [ ] **Task 2: admin-system transports** (AC: 2, 3, 4, 6) — absorb each wrapped `lib/api/*` impl into the existing `features/admin-system/api/*-api.ts` (the WRAP target), move helpers/types, retarget mocks: `audit.ts`, `backup.ts`, `health.ts` (preserve **server-root `/health*`** + the public no-token `getHealthBasic`/`getHealthReady`), `retention.ts`.
- [ ] **Task 3: admin-users + profile + registration** (AC: 2, 3, 4, 6) —
  - [ ] `lib/api/users.ts` → **split**: the admin user-management fns (`getUsers`…`revokeUserSession`) + `getRoleDisplayName`/`getRoleColor` + `User`/`Role` types → `features/admin-users`; the caller's-own-session fns (`getMySessions` `/api/v1/identity/sessions`, `revokeMySession`) + `UserSession`/`SessionListResponse` → `features/profile` (DEC-2 if shared). Absorb the `admin-users-api.ts` wrap.
  - [ ] `lib/api/registration.ts` (`registerUser`, **public POST `/api/v1/registration`**) → `features/admin-documents` (the `registration-api.ts` wrap target).
- [ ] **Task 4: members** (AC: 2, 3, 4, 6) — `lib/api/members.ts`: relocate the enums **`MembershipType`/`MembershipStatus` (runtime values — preserve identity)**, the DTOs, and the 7 pure helpers (`parseMatchReason`, `getTypeTranslationKey`, …) into `features/members`; `MemberDto`/`UpdateOwnProfileRequest` are also consumed by `profile` → DEC-2. Handle the 4 fetch fns per DEC-5 (pages already call `useApiClient` directly — the fns may be dead except for `members.test.ts`).
- [ ] **Task 5: communication + the `api-client.ts` retirement chain** (AC: 2, 3, 4, 5, 6) —
  - [ ] `lib/api/automations.ts` → `features/communication/automations` (absorb the wrap; move 3 helpers + types; resolve the `RecipientSegmentType` cross-dep per DEC-2).
  - [ ] **`lib/email-templates.ts`** → `features/communication/email-templates`: rewrite the 5 `emailTemplatesApi` fns off `ApiClient` onto byte-identical `fetch` (token-param; preserve the `ApiError`-throw + `{}`-for-204 semantics), then repoint the `email-templates-api.ts` wrap **and** the two cross-sub-slice consumers `automation-form.tsx` + `email-campaign-form.tsx` per DEC-3. **This leaves `lib/api-client.ts` with zero importers** (the precondition S2's `api-client.ts` deletion depends on).
- [ ] **Task 6: privacy split** (AC: 2, 3, 4, 6) — `lib/api/privacy.ts`: consent/channel fns (`getConsents`/`grantConsent`/`revokeConsent`/`getChannelPreference`/`updateChannelPreference`) + `ConsentDto`/`ChannelPreferenceDto` → `features/profile`; the **public anonymous** newsletter/unsubscribe fns (`verifyUnsubscribe`/`confirmUnsubscribe`/`subscribeNewsletter`/`unsubscribeByEmail`) + their result types → `features/public` (the `public-forms-api.ts` live-binding re-export becomes the real home). Retarget every `vi.mock("@/lib/api/privacy")` (profile + public + `i18n-branding.test.tsx`).
- [ ] **Task 7: services layer (heaviest — `ApiResult` + `errorBody`)** (AC: 2, 3, 4, 6) —
  - [ ] `lib/services/documents.ts` (shared by `documents` + `board-documents` + `admin-documents`): relocate the 16 `ApiResult` fns + 4 helpers (`formatFileSize`/`getStatusColor`/`getCategoryLabel`/`getDownloadUrl`) + 4 enums (`DocumentStatus`/`DocumentCategory`/`DocumentAccessRole`/`DocumentPermissionType`) + DTOs per DEC-3 (shared-transport home).
  - [ ] `lib/services/events.ts`: relocate the **3 self-signup fns** (`getEventVolunteerShifts`/`signUpForVolunteerShift`/`withdrawFromVolunteerShift`) **preserving the `ApiResult`/`errorBody` shape** (DEC-1 → NOT `useApiClient`) into `features/events`; repoint `VolunteerSelfSignupSection.tsx` (and consider relocating it into the slice); relocate `lib/services/volunteers.test.ts` → `features/events`. Move the event enums/DTOs that `events.types.ts` re-exports; handle the public event fns per DEC-5.
  - [ ] `lib/services/api.ts` (`apiGet`/`apiPost`/`apiPut`/`apiDelete` → `ApiResult`, auto-token via `next-auth`): relocate the helper per DEC-4 (it is consumed **only** internally by `services/documents` + `services/events`; it moves with whichever slice(s) keep an `ApiResult` transport).
- [ ] **Task 8: Verify zero importers + full DoD gate** (AC: 1, 3, 4) — re-run the enumeration grep → **zero** importers of every legacy path (or documented shim). `npm run typecheck` clean; `npx eslint <changed> --max-warnings=0` (no new `@/features/**` violations); `npx prettier --write` on **new** slice files / `--check` (hand-matched) on modified pre-drifted files (A72/A81); `npm test -- --run` green with count **≥ HEAD** (no removals/skips). LF on every edited file (A73). Capture the *after* importer list in the Dev Agent Record.

> **Note:** `lib/api-client.ts`, `lib/api/*`, `lib/services/*`, `lib/email-templates.ts` are **NOT deleted in this story** — S1 only drives importer counts to zero. Deletion + the E21-S5 lint tightening + `next build` are **E31-S2**. (Several modules will be left importer-free but still present after S1; that is expected and is the S2 hand-off.)

## Dev Notes

### Verification recipe (AC-1 / AC-3)

Run from `frontend/`, capture before (Task 0) and after (Task 8):

```
# importers of the class client + its sole consumer
grep -rn "lib/api-client\|lib/email-templates" src --include=*.ts --include=*.tsx
# importers of every lib/api/* module
grep -rn "@/lib/api/\(registration\|audit\|retention\|backup\|email-campaigns\|users\|members\|automations\|privacy\|budgets\|apiClients\|webhooks\|health\)" src
# importers of every lib/services/* module
grep -rn "@/lib/services/\(api\|documents\|events\)" src
```

Exclude (a) the legacy module's own internal cross-imports (they vanish together) and (b) the legacy module files themselves. **Zero remaining importers outside the to-be-deleted files = the S2 green light.**

### Migration map — legacy module → owning slice (resource ownership)

| Legacy module | Kind | Owning slice | Live importers (repoint) | Test seams to retarget |
|---|---|---|---|---|
| `lib/api/budgets.ts` | types + 3 endpoint consts (no fns) | `features/finance` | `finance/types/budgeting.types.ts`, `finance/api/budgeting-api.ts` | none (budgets only named in finance page-test *comments*) |
| `lib/api/apiClients.ts` | 3 DTOs + `API_CLIENTS_BASE` | `features/admin-integrations` | `admin-integrations.types.ts`, `api-clients-api.ts` | `admin-integrations-api.test.ts` (types only) |
| `lib/api/webhooks.ts` | DTOs + 2 URL bases | `features/admin-integrations` | `admin-integrations.types.ts`, `webhooks-api.ts`, `webhook-deliveries-api.ts` | — |
| `lib/api/email-campaigns.ts` | 3 helpers + types (no fns) | `features/communication/email-campaigns` | `email-campaign.types.ts`, `email-campaign-form.tsx`, **`lib/api/automations.ts` (RecipientSegmentType)** | — |
| `lib/api/audit.ts` | 6 fns + 3 helpers + types | `features/admin-system` | `audit-api.ts`, `audit.types.ts`, `audit-table.tsx`, `audit-badges.tsx` | `audit-api.test.ts`, `app/admin/audit/page.test.tsx` |
| `lib/api/backup.ts` | 10 fns + 3 helpers + types | `features/admin-system` | `backups-api.ts`, `backups.types.ts`, `backups-table.tsx`, `backups-page-content.tsx`, `backup-badges.tsx` | `backups-api.test.ts`, `use-backup-mutations.test.tsx`, `app/admin/backups/page.test.tsx` |
| `lib/api/health.ts` | 3 fns + 1 helper + types (**server-root `/health*`**) | `features/admin-system` | `health-api.ts`, `health.types.ts`, `health-badges.tsx` | `health-api.test.ts`, `use-health.test.tsx`, `app/admin/health/page.test.tsx` |
| `lib/api/retention.ts` | 3 fns + 2 helpers + types | `features/admin-system` | `retention-api.ts`, `retention.types.ts`, `retention-badges.tsx` | `retention-api.test.ts`, `app/admin/retention/page.test.tsx` |
| `lib/api/users.ts` | 16 fns + 2 helpers + types | `features/admin-users` **+ `features/profile`** (own-session split) | `admin-users-api.ts`, `admin-user.types.ts`, `user-role-badge.tsx`, `profile/api/profile-api.ts`, `profile/hooks/use-sessions.ts`, `profile.types.ts` | `admin-users-api.test.ts`, `use-user.test.tsx`, `app/admin/users/**/*.test.tsx`, `profile/security/page.test.tsx`, `use-profile.test.tsx`, `lib/api/users.test.ts` (relocate → S2) |
| `lib/api/registration.ts` | 1 fn (**public POST**) + types | `features/admin-documents` | `registration-api.ts`, `admin-documents.types.ts` | `registration-api.test.ts`, `app/admin/register/page.test.tsx` |
| `lib/api/members.ts` | 4 fns + 7 helpers + 2 **enums** + DTOs | `features/members` (+ `MemberDto` shared w/ `profile`) | `member.types.ts`, `member-segment.types.ts`, `member-*-badge.tsx`, `duplicate-*`/`merge-*`/`dismiss-*`/`member-new`/`member-edit` components, `profile-page-content.tsx` | `app/members/{new,[id]/edit,duplicates}/page.test.tsx`, `lib/api/members.test.ts` (relocate → S2); fetch fns likely dead (DEC-5) |
| `lib/api/automations.ts` | 7 fns + 3 helpers + types | `features/communication/automations` | `automations-api.ts`, `automation.types.ts`, `automations-table.tsx`, `automation-form.tsx`, `automation-detail.tsx` | `automations-api.test.ts`, `use-automation.test.tsx`, `automation-form.test.tsx`, `automation-detail.auth-gate.test.tsx`, `app/communication/automations/**/*.test.tsx` |
| `lib/api/privacy.ts` | 9 fns (5 auth + 4 **public anon**) | **split**: consent/channel → `features/profile`; newsletter/unsubscribe → `features/public` | `profile-api.ts`, `public-forms-api.ts`, `profile.types.ts`, `channel-preferences-card.tsx` | `profile-api.test.ts`, `use-profile.test.tsx`, `channel-preferences-card.test.tsx`, `app/profile/page.test.tsx`, `app/public/{newsletter,unsubscribe/[token]}/page.test.tsx`, `i18n-branding.test.tsx` |
| `lib/email-templates.ts` | `emailTemplatesApi` (5 fns over **`ApiClient`**) | `features/communication/email-templates` | `email-templates-api.ts`, **`automation-form.tsx`**, **`email-campaign-form.tsx`** (cross-sub-slice → DEC-3) | `email-templates-api.test.ts`, `use-email-template.test.tsx`, `email-campaign-form*.test.tsx`, `automation-form.test.tsx`, `automation-detail.auth-gate.test.tsx`, `app/communication/{email-templates,email-campaigns,automations}/**/*.test.tsx` |
| `lib/api-client.ts` | `ApiClient` class + `createApiClient` + `ApiError` | — (no slice; **deleted in S2**) | **only `lib/email-templates.ts`** → zero after Task 5 | — |
| `lib/services/documents.ts` | 16 `ApiResult` fns + 4 helpers + 4 **enums** + DTOs | shared: `features/{documents,board-documents,admin-documents}` (DEC-3) | 3 `*-api.ts` wraps + 3 `*.types.ts` + many components (`formatFileSize`/`getStatusColor`) + `use-*` hooks | `app/{documents,board/documents,admin/documents}/**/*.test.tsx`, feature `*-api.test.ts`/`use-*.test.tsx`/component tests |
| `lib/services/events.ts` | 10 `ApiResult` fns (3 use **`errorBody`**) + enums/DTOs | `features/events` | `events.types.ts`, **`VolunteerSelfSignupSection.tsx`** (3 self-signup fns) | `lib/services/volunteers.test.ts` (relocate → S2); event page-test mocks reference it in comments / volunteer-shift path |
| `lib/services/api.ts` | `apiGet`/`apiPost`/`apiPut`/`apiDelete` → `ApiResult` | internal base (DEC-4) | **only** `services/documents.ts` + `services/events.ts` | — |

### DEC — Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 — migration mechanism (the central decision).** **A) Relocate-verbatim** — move each transport's implementation into the owning slice's `api/` dir keeping its **exact signature** (token-param raw-`fetch` that throws on non-OK / returns raw `T`; or `ApiResult`-returning where the consumer reads `errorBody`/`status`). Call sites + `vi.mock` seams just repoint; behaviour is byte-identical by construction. **B) Rewrite onto `useApiClient`** — convert each call to the hook's `{data,error,status}` contract. **Recommended: A.** Conflict-priority ranks "preserve functionality" (#1) above "improve architecture" (#5); `useApiClient` **cannot express `errorBody.errorCode`** (the `VolunteerSelfSignupSection` regression) and is a hook (can't be called outside render, where the token-param fns run in `queryFn`s/effects). Adopt the hook **only** where a call site is already inside a component/hook AND reads nothing richer than `{data,error,status}` — never for the `ApiResult.errorBody` consumers.
- **DEC-2 — shared *type/enum* home.** Symbols read by two features that may not `@/features/**`-cross-import: `RecipientSegmentType` (automations↔email-campaigns), `MemberDto`/`UpdateOwnProfileRequest` (members↔profile), `UserSession`/`SessionListResponse` (admin-users↔profile), event DTOs/enums (events↔public if any survive). **A) Relocate to a shared `@/types/*` module** (lib-leaf, import-legal from any feature). **B) Owner-slice + explicit `eslint-disable` cross-import.** **Recommended: A** for pure types/enums (the E22 `ContractLink*`-in-`@/types/sponsors` precedent); keep the *fetch* in the owner slice.
- **DEC-3 — shared *transport* home.** The `documents` service is wrapped by **3 features**; `emailTemplatesApi` is consumed by **3 comm sub-slices**. Relocating into one and cross-importing from the others trips E21-S5. **A) Designate the primary owner** (`features/documents` for the document transport; `features/communication/email-templates` for templates) and have the 1–2 sibling consumers cross-import with an explicit `// eslint-disable-next-line no-restricted-imports` + reason (the lint comment *explicitly* sanctions justified exceptions). **B) A shared non-client transport module under `@/lib`** (e.g. a thin `@/lib/http`) — rejected: re-creates a parallel lib HTTP layer the program is retiring. **Recommended: A** (single owner + justified, documented exceptions; the program-ending state still has exactly one implementation per resource).
- **DEC-4 — `services/api.ts` `ApiResult` helper placement.** It is the base `fetch`→`ApiResult` (+ `next-auth` token) used only by `documents`/`events`. **A) Move into the documents owner slice and let `events` reach it per DEC-3, OR give each owner its own minimal copy.** **B) Keep one shared helper.** **Recommended: A** consistent with DEC-3 (no surviving `@/lib` HTTP layer).
- **DEC-5 — dead transport fns.** `lib/api/members.ts` fetch fns (pages already use `useApiClient`) and any unused `lib/services/events.ts` public fns may have **no live value-importer** (only `members.test.ts` / dead). **A) Relocate the fn + its test into the owning slice** (keeps coverage; safest). **B) Delete the dead fn in S2 with a documented rationale** (no consumer, no coverage value). **Recommended: A** if a test exercises it (relocate to preserve the suite count, AC-4); B only for genuinely untested dead code, recorded for S2.

### Architecture Guardrails

- **Byte-identical or it's a regression.** Same URL string, same HTTP verb, same headers (Bearer-token-param vs anonymous vs server-root `/health*` with no `/api/v1` prefix), same throw-vs-`ApiResult` error model, same `{}`-for-204 / `status===204` handling. The suite is the oracle — a green suite after repointing is the proof; a *softened* mock is not (a net-integrity check in the boundary review will diff mock targets vs behaviour).
- **Enums are runtime values, not just types.** `MembershipType`/`MembershipStatus` (members), `DocumentStatus`/`DocumentCategory`/`DocumentAccessRole`/`DocumentPermissionType` (documents), and the event enums are `enum`s — relocating them moves a *value*. Update every `import { X }` (value) and `import type { X }` consistently; a value imported as `type` (or vice-versa) breaks at runtime/build.
- **`errorBody` survives (A99).** Where a consumer reads `ApiResult.errorBody`/`.status` (`VolunteerSelfSignupSection`, document detail surfaces), the relocated fn keeps returning `ApiResult` — do **not** route it through `useApiClient`.
- **No new cross-feature alias imports (E21-S5).** Resolve shared symbols via DEC-2/DEC-3. A justified exception needs `// eslint-disable-next-line no-restricted-imports` + a one-line reason; lint runs `--max-warnings=0` on changed files.
- **Test seams move with the transport.** Retarget `vi.mock("@/lib/api/X")` → `vi.mock("@/features/<domain>/api/<domain>-api")` (or wherever the impl lands). Keep `importActual`/`importOriginal` spread patterns intact so real helpers/enums stay real. **No test removed or skipped** (AC-4).
- **Pre-drifted files:** `--write` new slice files only; `--check` (hand-matched) on modified pre-existing files (A72/A81/A112). LF (A73). Cleanup `afterEach(cleanup)` only for render tests (A35/A46).

### Scope Boundaries

- **In scope:** repointing every legacy-path importer onto its owning slice; relocating transports/helpers/enums/DTOs + their tests; retargeting `vi.mock` seams; driving every legacy-path importer count to zero.
- **Out of scope (→ E31-S2):** deleting `lib/api-client.ts`, `lib/email-templates.ts`, `lib/api/*`, `lib/services/*`; tightening the E21-S5 lint to *ban* the deleted paths; the `next build` gate. **Also out:** any backend/route/route-group/API-contract change; converting an `ApiResult.errorBody` consumer to `useApiClient`; touching `lib/auth.ts` (`useApiClient`), `lib/modules.ts`, `lib/utils.ts` (these are not legacy HTTP clients — they stay).

### Testing Requirements

- The **existing suite is the net** (A87 inverted). Green at HEAD (Task 0) → relocate+repoint → green after each module. Run `npm test -- --run` per task group, not just at the end, to localize any mock-retarget miss.
- When a legacy module had its own unit test (`lib/api/users.test.ts`, `lib/api/members.test.ts`, `lib/services/volunteers.test.ts`), **relocate** it alongside the moved transport (retargeted import) rather than delete — preserves the count (AC-4). Actual file deletion of the now-empty legacy module is **S2**.

### Project Structure Notes

- Targets are the existing owning slices' `api/`/`types/` dirs (no new top-level slice; "do not create a catch-all" — epic). New files are confined to those slices + a possible shared `@/types/*` home (DEC-2) and a documents-transport owner (DEC-3).

### References

- Standard contract: `lib/auth.ts` `useApiClient` (shape `{data,error,status}` — **no `errorBody`**); reference slices `features/suppliers/api`, `features/sponsors/api`. Class client: `lib/api-client.ts` (`ApiClient`/`createApiClient`/`ApiError`, `{}`-for-204). Base service: `lib/services/api.ts` (`ApiResult` + `errorBody`). Hazard site: `app/(dashboard)/events/[id]/VolunteerSelfSignupSection.tsx` (reads `errorBody?.errorCode` + `status===204`). Lint: `frontend/eslint.config.mjs` (E21-S5 `no-restricted-imports`; **no legacy-path allowance exists today**).
- Epic: `epics-and-stories.md` §E31 (S1). project-context.md: A94 (WRAP), A106 (live-binding re-export), A83/A84 (DTO/shared-symbol home), A99 (error-surface feasibility = transport's status surface), A88/A87 (net-as-oracle), A58/A72/A73/A81/A112 (gates), A35/A46/A64/A78 (test hygiene), A97 (`enabled`=fetch-gate, if any hook is added). Blocks E31-S2.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-13: Story created (bulk-refresh of the entire Epic-31, 2-story shape per user decision "Keep epic's 2 stories as-defined" + "kein MVP mehr"). Authored from a live-code A56 import-scan: the residual set is ~17 legacy modules across ~9 owning slices (the deliberate A94/A106 WRAP strategy kept them as the real transport). Records the epic-gap correction (`lib/email-templates.ts` → sole `ApiClient` consumer, required scope to enable S2's `api-client.ts` deletion), the `useApiClient`-has-no-`errorBody` hazard (`VolunteerSelfSignupSection`, A99), and the recurring shared-symbol/shared-transport cross-feature-boundary DECs. Existing 2013-test suite is the oracle (no new char-net). Status ready-for-dev.
