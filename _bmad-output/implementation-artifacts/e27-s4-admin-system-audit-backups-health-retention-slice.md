# Story E27.S4: Admin System — Feature-Slice Extraction (Audit / Backups / Health / Retention)

Status: done

Depends on: **E27-S1 (the system-area net must be green at HEAD first)**, plus E21-S3 + E21-S5 + the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions + the `features/admin-*` precedent from E27-S2. Independent of S2/S3/S5/S6 once S1 is green.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the four admin system pages (audit, backups, health, retention) refactored into ONE `features/admin-system/` slice,
so that operational admin tooling matches the proven slice pattern with behaviour preserved — including the server-side audit filters, the inline-confirm backup restore, the 30-second health poll, and the retention form.

## Acceptance Criteria

**Behaviour preserved (all E27-S1 system-area tests stay green):**

1. The admin auth guard is preserved on all four pages: non-admins redirected (`router.push("/")`), `return null` for the non-admin render path (this guard is LOAD-BEARING — it's why the un-cleared `loading=true` on the gated path is harmless; preserve it OR clear loading on the gated branch, A90/A97); data fetch gated on `isAuthenticated && isAdmin && accessToken`.
2. **Audit**: log load + the 7 **server-side** filter controls (fromDate/toDate/category/eventType/severity/success/search — any filter change resets `page:1` + refetches), collapsible filter panel (default closed), pagination shown when `totalPages>1` (`pageSize=50`), CSV export (Blob → anchor `audit_export_<date>.csv`), severity/category/success badges.
3. **Backups**: list + stats; create (modal + notes); **restore (inline 2-button confirm, current trigger=blue / confirm=ORANGE; failure keeps confirm state — preserve the CURRENT affordance, see DEC-4)**; **delete (inline 2-button confirm, RED; failure keeps confirm state)**; download (only `Completed`; token-bearing blob → anchor); upload (modal + FormData); retry (`Failed` rows → re-create with old notes); schedule view + disable-schedule; status badge (`getStatusColor`) + type badge.
4. **Health**: overall + per-service cards (status badge + inline status dot + duration + exception box); **30-second auto-refresh** (interval, gated on admin+token) + `lastChecked` + manual refresh.
5. **Retention**: policy list; inline edit (manual form: `displayName`, `retentionMonths` number≥1, `action` `<select>` Anonymize/Archive/Delete, `legalBasis`, `isActive`; `dataCategory` read-only) → save (`updateRetentionPolicy`) + success toast (auto-dismiss 5s); enforce (`enforceRetention`, **no confirm**, orange) + result count; loading/error/empty per page; all i18n texts work exactly as before.

**Improvements:**

6. `features/admin-system/` slice exists; because the four pages are loosely-related operational tools sharing the area, keep them as sibling component+api sets inside ONE slice (per the recommended area split), with per-resource api files sharing the slice (A91):
   - `api/` — `audit-api.ts`, `backups-api.ts`, `health-api.ts`, `retention-api.ts` (each encapsulating its `/api/v1/...` URLs — note health hits server-root `/health*`, NOT `/api/v1`) + per-resource query-key factories. **DEC-1**: WRAP the existing `lib/api/{audit,backup,retention,health}.ts` token-param fns (A94 — they already own the URLs) OR migrate to `useApiClient` (which gains the status A99 currently lacks); recommended = WRAP (net-survival) and add a thin status surface only where A99 needs it.
   - `hooks/` — `use-audit-log` (query includes the full `filters` object in the key so it refetches on change), `use-export-audit`; `use-backups` + `use-create-backup`/`use-restore-backup`/`use-delete-backup`/`use-upload-backup`/`use-download-backup` + schedule hooks; `use-health` (**`refetchInterval: 30_000`** — replaces the `setInterval`); `use-retention` + `use-update-retention`/`use-enforce-retention`; mutations invalidate their keys.
   - `schemas/retention.schema.ts` (the retention edit form, RHF+Zod; the `action` `<select>` widened to the full transport union + out-of-set value rendered as an extra `<option>` per A95; **no `.trim()`/transform on submitted-byte fields A96**; `noValidate` renders field errors). Add an `isSaving` guard the god-page lacked (no double-submit).
   - `components/` — one page-content + table/filter/status set per resource: `audit-page-content`/`audit-table`/`audit-filter-bar`; `backups-page-content`/`backups-table`/`create-backup-dialog`/`upload-backup-dialog`/inline restore+delete confirms; `health-page-content`/`health-status`; `retention-page-content`/`retention-form`; per-resource `types/`.
   - Each route file becomes a thin entry (composition root is the only `"use client"`). ESLint boundary entry for `features/admin-system`.
7. Manual→TanStack deltas (A79) decided explicitly (invalidate-on-mutation; mutation error surfaced; the inline-confirm "failure keeps confirm state" preserved; health `setInterval`→`refetchInterval`; retry semantics; A99). Status/severity indicators map to Badge variants/tokens per DEC-2 (A77) — consolidate `getSeverityColor`/`getCategoryColor`/`getStatusColor`/`getTypeColor`/`getActionColor` + the health inline-dot ternary into the token layer; verify token values against the named colour. Destructive affordances tested per A76/A80: **delete-backup stays red; restore is the one place to ADD red (A86) — currently orange/blue, the highest-risk action with no destructive affordance (confirm via DEC-4)**; enforce stays orange.
8. The `getHealthDetail` fetch gains an `res.ok` check (today it `res.json()`s unconditionally → swallowed SyntaxError on error responses) — a strict behaviour improvement that surfaces a real error. The backups `fetchSchedule()`-not-in-deps staleness is folded into a proper hook.
9. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files/components, no duplicate UI primitive; i18n parity stays green (reuse `audit.*` (top-level!) + `admin.backups.*`/`admin.health.*`/`admin.retention.*` + `common.*`).

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [x] E27-S1 system specs green at HEAD. Confirm `features/admin-system/` does NOT exist. Re-read the 4 pages + `lib/api/{audit,backup,retention,health}.ts` (note `health.ts` already exists at `/health*`) + members/sponsors form recipe (A56).
  - [x] Resolve DEC-1..DEC-4 (recommended options below).
- [x] Task 1: Scaffold slice `api` (4 per-resource files + keys) + `types` + `schemas/retention.schema.ts` + `*-api.test.ts` (URL/key shape; the audit querystring; the `/health*` non-`/api/v1` paths).
- [x] Task 2: Hooks — audit (filters-in-key) + export; backups CRUD + schedule + download(blob); health (`refetchInterval:30_000` + `res.ok`); retention + enforce; invalidation. `use-health.test.tsx` (interval), `use-backups.test.tsx` (restore/delete invalidation).
- [x] Task 3: Components — audit (server-side filter bar + table + export + badges).
- [x] Task 4: Components — backups (list + create/upload dialogs + inline restore(DEC-4 affordance)/delete confirms + download + retry + schedule + badges).
- [x] Task 5: Components — health (status cards + dot + 30s refresh display) + retention (`retention-form` RHF+Zod with A95 action widening + `isSaving` guard + enforce). `retention-form.test.tsx`.
- [x] Task 6: Thin route entries (4 files) + Green-the-net + DoD gate — E27-S1 system specs green (transport mocks per DEC-1); new slice unit tests; `tsc`/eslint(slice+changed, E21-S5 boundary)/`vitest run` FULL green; LF. A79 deltas recorded.

## Dev Notes

Four loosely-related operational pages in ONE `admin-system` slice (sibling sets, not four slices) — matches the recommended area split. Backups restore is the highest-risk destructive action; health auto-refreshes; audit filters are server-side. `health.ts` already exists (the skeleton missed it) and hits server-root `/health*` with two token-less endpoints — relocate it into the slice, do NOT mint a new one.

### Scope Boundaries

- In scope: `features/admin-system/` (api/hooks/components/schemas/types) for the 4 pages; thin route entries; ESLint boundary entry; new slice unit tests; the `res.ok` + `isSaving` + schedule-deps fixes (in-scope behaviour-safe improvements).
- Out of scope: the other admin areas (S2/S3/S5/S6); backend/route/contract changes; the public health endpoints' auth posture (`/health` + `/health/ready` stay token-less); i18n key changes; any route-group move.

### Architecture Guardrails

- A91: per-resource api files inside one slice. A94: WRAP the existing token-param modules (URLs/params byte-identical) — preferred over a `useApiClient` rewrite, but note A99 (the modules throw generic `Error` with no status; `getHealthDetail` doesn't even check `res.ok`) — add a thin status/`res.ok` surface where a sentinel/error matters. A95: retention `action` `<select>` round-trips an out-of-set value. A96: no `.trim()`; `noValidate` field errors. A77: consolidate the raw colour helpers into Badge tokens. A86: keep delete-backup red; ADD red to restore (currently orange).
- Audit query KEY must include the full `filters` object (server-side filtering). Health → `refetchInterval: 30_000` (preserve the 30s cadence). Backups download is a token-bearing raw fetch → blob → anchor inside the api fn — keep that mechanism (or route through `useApiClient` blob handling) without changing the URL.
- DoD as E25 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) WRAP the existing `lib/api/{audit,backup,retention,health}.ts` token-param fns + per-resource keys (recommended — A94, net-survival; add a thin status surface only where A99 needs it). B) migrate all calls to `useApiClient` (gains `{status}` everywhere but is a larger transport change + re-mocks the S1 specs). **Recommended: A.**
- **DEC-2 badges:** A) Badge variants/tokens (A77-verified), consolidating the 5 colour helpers + the health dot (recommended — epic goal). B) keep raw colour strings. **Recommended: A.**
- **DEC-3 health 30s poll:** A) `refetchInterval: 30_000` on `use-health` + `res.ok` fix (recommended — preserves the cadence, surfaces real errors). B) keep an effect+`setInterval`. **Recommended: A.**
- **DEC-4 restore affordance (A86):** A) preserve the CURRENT inline 2-button confirm but recolour the confirm button to `destructive` red (recommended — restore is the highest-risk action and ships only orange today; A86 sanctions ADDING red where the destructive affordance is missing). B) preserve orange verbatim (record as residual debt). **Recommended: A** (pin the CURRENT orange in S1; flip to red here as the deliberate, tested A86 change).

### Testing Requirements

- The E27-S1 system specs are the oracle — keep green; the licensed A79 surface is the transport-mock target + the inline-confirm/poll/form mechanism assertions. Auth gate, server-side filter refetch, export, restore/delete confirm flows + failure branches, 30s refresh, retention save/enforce must stay green.
- Add slice unit tests: `audit-api` querystring/key (filters in key); `use-health` interval; a backups mutation invalidation; `retention-form` (A95 out-of-set `action` round-trip, A96 field errors, `isSaving` guard). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/admin-system/{api,hooks,components,schemas,types}` (sibling sets per resource); thin entries at `app/admin/{audit,backups,health,retention}/page.tsx`.

### References

- Slice templates: `frontend/src/features/members/`, `features/sponsors/` (forms + Badge tokens + detail mutations).
- Pages: `frontend/src/app/admin/{audit,backups,health,retention}/page.tsx`.
- Clients to wrap: `frontend/src/lib/api/audit.ts`, `backup.ts`, `retention.ts`, **`health.ts` (already exists; `/health`, `/health/ready` token-less, `/health/detail` token)** — full inventories in the E27 spike.
- `frontend/src/lib/auth.ts` (useAuth/useApiClient); `frontend/eslint.config.mjs` (E21-S5 boundary).
- E27-S1; project-context.md A34/A56/A58/A72/A73/A77/A78/A79/A86/A90/A91/A94/A95/A96/A97/A99; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. HARD-ordered after E27-S1.
- **A56 findings:** audit/backup/retention = token-param raw-fetch modules (generic `Error`, no status → A99) → A94 WRAP (DEC-1=A). **`health.ts` ALREADY EXISTS** (skeleton missed it) — 3 fns at server-root `/health*` (two token-less); `getHealthDetail` doesn't check `res.ok`. Audit filters are SERVER-SIDE (7 controls, `pageSize=50`); export is a Blob+anchor. Backups: restore = inline 2-button confirm, ORANGE not red (A86: add red here, DEC-4); delete = inline confirm RED; download = token blob; failure keeps confirm state. Health POLLS every 30s (→ `refetchInterval`). Retention = manual form, `action` `<select>` A95 risk, no `isSaving` guard (double-submit), enforce = no confirm + orange. All badges raw colour strings (5 helpers + health dot) → tokens (A77). i18n: `audit` is TOP-LEVEL (not `admin.audit`); others are `admin.*`. No existing tests (S1 writes them). The `loading`-never-cleared-on-gated-path is safe via the load-bearing `return null` guard. Backups `fetchSchedule()` not-in-deps staleness.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (orchestrator) + a dedicated general-purpose subagent for the slice extraction.

### Debug Log References

- DEC-1 transport = **A** (WRAP the `lib/api/{audit,backup,retention,health}` token-param fns + per-resource keys; A94, zero transport-mock edits).
- DEC-2 badges = **A** (consolidate the 5 colour helpers + the health dot into feature-local literal-class badge components — the `member-status-badge` A77 precedent; literal Tailwind classes kept verbatim, not mapped onto the 4 generic `ui/badge` variants which resolve to different tokens than S1 pins).
- DEC-3 health poll = **A** (`refetchInterval: 30_000` + `refetchOnWindowFocus:false` replaces `setInterval`; added a non-breaking `res.ok` guard to `getHealthDetail` in `lib/api/health.ts`).
- DEC-4 restore affordance = **A** (flip restore trigger + confirm blue/orange → RED — A86 promotes the highest-risk action to a destructive affordance; delete stays red, enforce stays orange). This is the one licensed S1 change.

### Completion Notes List

- **The 4 admin-system pages extracted into one `features/admin-system/{api,hooks,components,schemas,types}` slice, organised by sub-area; behaviour preserved.** Scoped gate = 11 files / 116 tests green (83 S1 oracle + 33 new slice tests). Central full-suite + tsc + eslint + prettier all green. Confirmed: the health 30s-poll fake-timer test and the retention 5s-toast fake-timer test stayed green under `refetchInterval` + the toast effect.
- Per-resource `api/{audit,backups,health,retention}-api.ts` WRAP the lib fns + `*Keys` factories; hooks per surface with invalidate-on-mutation (create/delete/restore/upload→`backupsKeys.list()`; retention update→`retentionKeys.all`; enforce + download deliberately no invalidation); `retry:false` everywhere (generic `Error`, no status, A99). Inline-confirm "failure-keeps-confirm-state" preserved (confirm id cleared only in the success branch).
- Preserved EXACTLY: audit 7 server-side filters (each change resets `page:1` + refetches) + collapsible panel + pagination(50) + CSV Blob/anchor export + badges; backups list/stats + create/upload modals + restore/delete inline-confirm + download(Completed)/retry(Failed)/disable-schedule + badges; health overall+per-service cards + exception box + status badges/dots + 30s refresh + manual refresh; retention list + edit form(action `<select>` A95-widened, no-`.trim()` A96) + save+5s toast + enforce(no confirm, orange)+count. AC-8 fixes shipped: `getHealthDetail` `res.ok` guard; the backups schedule preset folded into `useBackupSchedule` (degrades to disabled on a missing-schedule throw — god-page parity).
- **S1 oracle changes:** only the licensed DEC-4 A86 change — 2 assertions in `backups/page.test.tsx` (restore trigger `text-blue-600`→`text-red-600`; restore confirm orange→red). Audit/health/retention suites: ZERO assertion changes. **Residual debt:** none material (load-error banners are derived from the query rather than dismissable-via-effect — the net doesn't test load-error dismissal; action errors stay dismissable).

### File List

NEW — `frontend/src/features/admin-system/`:

- `types/`: `audit.types.ts`, `backups.types.ts`, `health.types.ts`, `retention.types.ts`
- `api/`: `audit-api.ts`, `backups-api.ts`, `health-api.ts`, `retention-api.ts` (+ `audit-api.test.ts`, `backups-api.test.ts`, `health-api.test.ts`, `retention-api.test.ts`)
- `schemas/retention.schema.ts`
- `hooks/`: `use-audit-log.ts`, `use-audit-filter-options.ts`, `use-export-audit.ts`, `use-backups.ts`, `use-backup-schedule.ts`, `use-backup-mutations.ts`, `use-health.ts`, `use-retention.ts`, `use-retention-mutations.ts` (+ `use-health.test.tsx`, `use-backup-mutations.test.tsx`)
- `components/`: audit (`audit-page-content`, `audit-table`, `audit-filter-bar`, `audit-badges`); backups (`backups-page-content`, `backups-table`, `create-backup-dialog`, `upload-backup-dialog`, `backup-badges`); health (`health-page-content`, `health-status`, `health-badges`); retention (`retention-page-content`, `retention-form`, `retention-badges`) (+ `retention-form.test.tsx`)

MODIFIED:

- `frontend/src/app/admin/{audit,backups,health,retention}/page.tsx` (thin entries)
- `frontend/src/lib/api/health.ts` (non-breaking `res.ok` guard on `getHealthDetail`)
- `frontend/src/app/admin/backups/page.test.tsx` (S1 oracle — licensed DEC-4 A86: 2 restore assertions orange/blue → red)

## Change Log

- 2026-06-12: Story created (admin system 4 pages → ONE `features/admin-system/` slice; DEC-1 WRAP token-param modules incl. existing health.ts, DEC-2 Badge tokens, DEC-3 30s refetchInterval + res.ok fix, DEC-4 restore→destructive-red; server-side audit filters, A95 retention action widening, isSaving guard; preserve inline-confirm failure-keeps-state + token-blob download). Status ready-for-dev.
- 2026-06-12: Implemented — 4 admin-system pages → one `features/admin-system/` slice (WRAP audit/backup/health/retention; health 30s `refetchInterval` + `res.ok` guard; literal-class badges A77/A86; restore→RED per DEC-4). +33 slice tests; S1 oracle: only the licensed 2 backups restore-colour assertions (DEC-4); health-poll + retention-toast timers stayed green; central full-suite / tsc / eslint / prettier green. DEC-1..4 = A. Status review.
