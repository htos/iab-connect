# Story E27.S5: Admin Integrations — Feature-Slice Extraction (Api-Clients / Webhooks / Deliveries)

Status: done

Depends on: **E27-S1 (the integrations-area net must be green at HEAD first)**, plus E21-S3 + E21-S5 + the E22 RHF+Zod form sub-recipe (closed). Inherits E21-S1 boundary decisions + the `features/admin-*` precedent from E27-S2. Independent of S2/S3/S4/S6 once S1 is green. **Highest data-loss risk in the epic: the two show-once secret panels (behaviour-LOCKED).**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the three admin integrations pages (api-clients, webhooks, webhook deliveries) refactored into ONE `features/admin-integrations/` slice,
so that integration management matches the proven slice pattern with behaviour preserved — INCLUDING the show-once secret panels, whose extraction is behaviour-locked because losing the secret is a hard data-loss path.

## Acceptance Criteria

**Behaviour preserved (all E27-S1 integrations-area tests stay green):**

1. The admin auth guard is preserved on all three pages: non-admins redirected (`router.push("/")`); data fetch gated on `isAuthenticated && isAdmin && accessToken`; on the gated-off path the page does NOT clear `loading` and does NOT set an error (the redirect effect bounces — A97; do NOT add an error banner on unauth).
2. **Api-clients**: list (`GET /api/v1/admin/api-clients/` — trailing slash) + scopes + create (`POST .../`, scope checkboxes) + revoke (`window.confirm` → `POST .../{id}/revoke`, red, only when `!isRevoked`) + the **show-once secret panel**. **Webhooks**: list (`GET /api/v1/admin/webhooks/`) + event-types + create/edit via the SHARED dialog + enable/disable toggle (`POST .../{id}/{enable|disable}`, no confirm, gray Power icon) + delete (`window.confirm` → `DELETE .../{id}`, red) + the **show-once signing-secret panel (create-only)**. **Deliveries**: list (`GET /api/v1/admin/webhook-deliveries/?page=&pageSize=20`) + pagination (prev/next on `hasPreviousPage`/`hasNextPage`) — **NO filters, NO retry action** (do not add them); payload body NOT rendered. All i18n texts work exactly as before.
3. **The two show-once secret panels keep IDENTICAL behaviour (behaviour-LOCKED, tested invariant):**
   - api-clients: the create response `secret` field stored in `createdSecret` state, rendered once in a `<code>`, `navigator.clipboard.writeText` → `copied` (NO timer), dismiss → `setCreatedSecret(null)`; the LIST refetch (`ApiClientDto[]`, no secret) must NOT reintroduce it; once dismissed/reloaded the cleartext is gone forever.
   - webhooks: identical, shown **ONLY on create** (the PUT/edit branch never sets a secret; there is **no regenerate action** — do not invent one).

**Improvements:**

4. `features/admin-integrations/` slice exists (mirroring the `features/communication` two-level nesting), with per-resource api/hooks/components:
   - `api/` — `api-clients-api.ts`, `webhooks-api.ts`, `webhook-deliveries-api.ts` — **built directly on `useApiClient` (there is NO `lib/api` fn module to wrap — `apiClients.ts`/`webhooks.ts` export ONLY types + URL-base constants; A94 "wrap" does NOT apply here)**. Move URL ownership into the slice api modules using the existing `API_CLIENTS_BASE`/`WEBHOOKS_BASE`/`WEBHOOK_DELIVERIES_BASE` constants. **Preserve the exact trailing-slash patterns** (list/create trailing `/`; PUT/DELETE/enable/disable no slash; deliveries `/?page=`). Per-resource query-key factories.
   - `hooks/` — `use-api-clients`+`use-scopes`+`use-create-api-client`/`use-revoke-api-client`; `use-webhooks`+`use-event-types`+`use-create-webhook`/`use-update-webhook`/`use-toggle-webhook`/`use-delete-webhook`; `use-webhook-deliveries` (page in key); mutations invalidate their keys.
   - `schemas/webhook.schema.ts` — Zod for the shared create/edit dialog (RHF+Zod, E22 sub-recipe): `name` non-empty after trim via `.min(1)`/`.refine` (**no `.trim()`/transform — A96**), `targetUrl` non-empty after trim (**do NOT tighten to `z.string().url()` — the god-page only checks non-empty; behaviour-preserve**), `eventTypes` `.min(1)`. Save stays disabled unless name + targetUrl + ≥1 eventType (validation parity). A98: thread the create/edit mode-divergent surfaces (dialog title differs; submit label SAME) through props + pin both. **A95**: a no-touch edit-save round-trips the stored `eventTypes` even if some are not in the current `availableEventTypes` (the body submits `selectedTypes` verbatim).
   - `components/` — `api-clients-page-content`/`api-clients-table`/`create-api-client-dialog`/`api-client-secret-panel`; `webhooks-page-content`/`webhooks-table`/`webhook-dialog` (shared create+edit)/`webhook-secret-panel`/(keep the `confirm()` delete — see DEC-3); `webhook-deliveries-page-content`/`deliveries-table` (no filter bar). Each route file becomes a thin entry (composition root is the only `"use client"`). ESLint boundary entry for `features/admin-integrations`.
5. The show-once secret panels are extracted as components (`api-client-secret-panel`, `webhook-secret-panel`) but keep IDENTICAL behaviour — a tested invariant (once-only render + `clipboard.writeText` + `copied` + dismiss + list-refetch-doesn't-reintroduce). Manual→TanStack deltas (A79) decided explicitly (invalidate-on-mutation; mutation error surfaced via the shared error banner; retry semantics; A99 — status is available from `useApiClient` but every call site currently discards it and branches on `error`/`!data`, preserve that). DEC-2 badges/tokens (A77) — map the api-client active/revoked, webhook active/disabled, and delivery Delivered/Failed/other status colours to Badge variants/tokens (**the deliveries status TEXT stays the raw server string**); delete/revoke destructive variant tested (A76 — both already ship red, A86 preserve).
6. No new `any`, no new hard-coded user-facing strings, no new direct API URL in route files/components (URL constants live in the slice `api/`), no duplicate UI primitive; i18n parity stays green (reuse `admin.apiClients.*`/`admin.webhooks.*`/`admin.webhookDeliveries.*` + `common.*`; note `t("save")` = "Create" in apiClients vs "Save" in webhooks — preserve the divergent labels).

## Tasks / Subtasks

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) recorded below
  - [x] E27-S1 integrations specs (9 tests) green at HEAD. Confirm `features/admin-integrations/` does NOT exist. Re-read the 3 pages + `lib/api/apiClients.ts` + `lib/api/webhooks.ts` (types + URL constants only) + the communication slice (nesting) + sponsors form recipe (A56).
  - [x] Resolve DEC-1..DEC-3 (recommended options below).
- [x] Task 1: Scaffold slice `api` (3 useApiClient-based modules + keys, exact trailing-slash URLs) + `types` (re-export the DTOs from `lib/api/apiClients`+`webhooks`) + `schemas/webhook.schema.ts` + `*-api.test.ts` (URL/key shape incl. trailing slashes + the separate deliveries base).
- [x] Task 2: Hooks — api-clients (list+scopes+create+revoke), webhooks (list+event-types+create+update+toggle+delete), deliveries (paged); invalidation. `use-webhooks.test.tsx`.
- [x] Task 3: Components — api-clients (table + create dialog + **`api-client-secret-panel`** behaviour-locked). `api-client-secret-panel.test.tsx`.
- [x] Task 4: Components — webhooks (table + `webhook-dialog` RHF+Zod shared create+edit + **`webhook-secret-panel`** create-only + `confirm()` delete + toggle). `webhook-dialog.test.tsx` + `webhook-secret-panel.test.tsx`.
- [x] Task 5: Components — deliveries (table + pagination, NO filters/retry) + thin route entries (3 files).
- [x] Task 6: Green-the-net + DoD gate — the 9 E27-S1 integrations specs green (they mock `@/lib/auth`'s `useApiClient` — keep that seam; the secret-once tests stay locked) + the S1 webhooks extensions; new slice unit tests; `tsc`/eslint(slice+changed, E21-S5 boundary)/`vitest run` FULL green; LF. A79 deltas recorded.

## Dev Notes

The two show-once secret panels are the highest data-loss risk in the whole program — extract them with behaviour locked verbatim (the secret lives ONLY in `createdSecret` state, sourced ONLY from the one-time create response; the list refetch CANNOT repopulate it). The webhook dialog is the form anchor (shared create+edit). DISTINCT from prior slices: there is NO `lib/api` fn module to wrap — the transport is already inline `useApiClient`, so the slice api is built directly on `useApiClient`. The 9 existing tests mock `@/lib/auth`'s `useApiClient` — keep that mock seam.

### Scope Boundaries

- In scope: `features/admin-integrations/` (api/hooks/components/schemas/types) for the 3 pages; thin route entries; ESLint boundary entry; new slice unit tests.
- Out of scope: the other admin areas (S2/S3/S4/S6); backend/route/contract changes; adding a regenerate-secret action, deliveries filters, or a retry-delivery action (NONE exist — do not invent); converting the `confirm()` delete/revoke to Radix; i18n key changes; any route-group move.

### Architecture Guardrails

- A94 does NOT apply (no fn module to wrap) — build the slice api on `useApiClient`; the existing tests mock `@/lib/auth`'s `useApiClient`, so keep the slice consuming it through that seam. Preserve the EXACT URLs incl. trailing slashes (list/create `/`; PUT/DELETE/enable/disable no slash; deliveries `/?page=`) and the separate `WEBHOOK_DELIVERIES_BASE`.
- Behaviour-LOCK the secret panels (A76/A80 + the data-loss invariant). A96: webhook form no `.trim()`; `noValidate` field errors; do NOT add `z.string().url()`. A98: dialog mode-divergent surfaces threaded + both pinned. A95: edit round-trips stored `eventTypes` even if out of `availableEventTypes`. A77: status colours → Badge tokens (deliveries text stays raw). A86: delete/revoke already red — preserve.
- A99: status is available from `useApiClient` but discarded at every call site; preserve the `error`/`!data` branching unless a status distinction is explicitly wanted.
- DoD as E25 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) build the slice api on `useApiClient`, moving the URL constants into the slice `api/` modules (recommended — there is nothing to wrap; the pages already use `useApiClient`; keeps the S1 mock seam). B) introduce token-param `lib/api` fns (regressive). **Recommended: A.**
- **DEC-2 badges:** A) Badge variants/tokens (A77), deliveries status TEXT stays the raw server string (recommended — epic goal). B) keep raw colour spans. **Recommended: A.**
- **DEC-3 webhook delete dialog:** A) keep the `window.confirm()` delete/revoke as-is (recommended — keeps S1 green; Radix upgrade out of scope, residual debt). B) convert to a Radix dialog (changes pinned behaviour; defer). **Recommended: A.**

### Testing Requirements

- The 9 E27-S1 integrations specs are the oracle (esp. the 3 secret-once tests) — keep green; the licensed A79 surface is the secret-panel/dialog/toggle mechanism + the TanStack hook wiring. Auth gate, exact URLs, secret-once + clipboard + dismiss + list-refetch-doesn't-reintroduce, webhook save-disabled parity, deliveries pagination (no filters) must stay green.
- Add slice unit tests: `*-api` URL/key shape (trailing slashes, separate deliveries base); `webhook-dialog` RHF+Zod (save-disabled parity, A96 field errors, no-url-format, A98 mode props, A95 eventTypes round-trip); the two secret panels (once-only + clipboard + dismiss). A35/A46; A78 stable mocks.

### Project Structure Notes

- Target tree: `features/admin-integrations/{api,hooks,components,schemas,types}`; thin entries at `app/admin/api-clients/page.tsx`, `app/admin/webhooks/page.tsx`, `app/admin/webhooks/deliveries/page.tsx`.

### References

- Slice templates: `frontend/src/features/communication/automations/` (nesting + wrap-vs-build), `features/sponsors/` (form + Badge).
- Pages: `frontend/src/app/admin/api-clients/page.tsx`, `app/admin/webhooks/page.tsx`, `app/admin/webhooks/deliveries/page.tsx`. Existing tests: the three co-located `page.test.tsx` (9 tests; secret-once already locked).
- Types + URL constants: `frontend/src/lib/api/apiClients.ts` (`API_CLIENTS_BASE`, `ApiClientDto`/`ApiClientCreatedDto`/`CreateApiClientRequest`), `frontend/src/lib/api/webhooks.ts` (`WEBHOOKS_BASE`, `WEBHOOK_DELIVERIES_BASE`, `WebhookSubscriptionDto`/`WebhookSubscriptionCreatedDto`/`WebhookRequest`/`WebhookDeliveryDto`/`PagedResult`).
- `frontend/src/lib/auth.ts` (useApiClient — `{data,error,status}`); `frontend/eslint.config.mjs` (E21-S5 boundary).
- E27-S1; project-context.md A34/A56/A58/A72/A73/A76/A77/A78/A79/A80/A86/A95/A96/A97/A98/A99; `docs/architecture-frontend.md` "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 (whole-epic E27 batch, A34). Status ready-for-dev. HARD-ordered after E27-S1.
- **A56 findings:** `apiClients.ts`/`webhooks.ts` export ONLY types + URL-base constants (`API_CLIENTS_BASE`/`WEBHOOKS_BASE`/`WEBHOOK_DELIVERIES_BASE`) — NO fns → A94 wrap does NOT apply; build on `useApiClient` (DEC-1=A). Both show-once secret panels behaviour-locked (source = create response `secret`; clipboard; no timer; dismiss=`setCreatedSecret(null)`; list refetch can't reintroduce). Webhook signing-secret shown ONLY on create. **NO regenerate action, NO deliveries filters, NO retry-delivery action exist** (skeleton was wrong). Webhook dialog SHARED create+edit, manual `useState` → RHF+Zod; `targetUrl` has NO url-format validation (don't add `z.string().url()`); event types = checkboxes (no `<select>`/A95-classic, but stored `eventTypes` round-trip risk). A98: dialog title differs, submit label SAME; api-clients `t("save")`="Create" vs webhooks="Save". Trailing-slash URLs matter. Status colours are raw spans (A77); delete/revoke already red (A86). Status discarded at every call site (A99). The 9 existing tests mock `@/lib/auth`'s `useApiClient` (keep the seam). Two-level nesting like `features/communication`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (orchestrator) + a dedicated general-purpose subagent for the slice extraction.

### Debug Log References

- DEC-1 transport = **A** (build the slice api directly on `useApiClient`; `lib/api/{apiClients,webhooks}.ts` export only types + URL bases — nothing to wrap, A56 confirmed. URL bases moved into the slice `api/` with exact trailing slashes preserved: list/create `/`; PUT/DELETE/enable/disable no slash; deliveries `/?page=`).
- DEC-2 badges = **A** (status colours → Badge variants; delivery badge TEXT stays the raw server string; delete/revoke kept red, A86).
- DEC-3 delete dialog = **A** (keep `window.confirm()` for delete + revoke; Radix out of scope — residual debt).

### Completion Notes List

- **The 3 integrations pages extracted into one `features/admin-integrations/{api,hooks,components,schemas,types}` slice; behaviour preserved, both show-once secret panels behaviour-LOCKED.** Scoped gate = 7 files / 65 tests green (37 S1 oracle + 28 new slice tests). Central full-suite + tsc + eslint + prettier all green.
- api built on `useApiClient` (`api-clients-api.ts`, `webhooks-api.ts`, `webhook-deliveries-api.ts` + keys); 11 hooks (api-clients list/scopes/create/revoke; webhooks list/event-types/create/update/toggle/delete; deliveries list). Manual `useState` list + `refresh*()` → TanStack reads + invalidate-on-success only (failure branches never invalidate → preserves the pinned no-refetch-on-error). Read-error→banner is DERIVED (`mutationError ?? readError`), not effect-synced (satisfies `react-hooks/set-state-in-effect`).
- Preserved EXACTLY (S1-pinned): api-clients show-once secret (create→shown once, `clipboard.writeText`→`copied`, dismiss→cleared, list-refetch does NOT reintroduce — secret lives only in `createdSecret` component state sourced only from the create response) + scope checkboxes + revoke(confirm, red, hidden when revoked); webhooks signing-secret only on create (NO regenerate; edit PUT shows none) + enable/disable(no confirm) + delete(confirm, red) + shared edit dialog + the no-touch-edit eventTypes round-trip (A95 — stored type not in `availableEventTypes` survives) + dialog save-disabled gate (name.trim()+targetUrl.trim()+≥1 type); deliveries list+pagination(20, prev/next on hasPrev/hasNext), NO filters/NO retry/payload not rendered.
- Webhook dialog → RHF+Zod (A96 no-`.trim()`); unused `formState.errors` removed (god-page rendered no field errors → avoids `noUnusedLocals`).
- **S1 oracle changes: NO assertion changes** — only a `QueryClientProvider` (retry:false) `renderPage()` wrapper added to the 3 oracle suites (A88 harness adaptation, mirrors the E25-S1/S3 admission). **Residual debt:** DEC-3 `confirm()`→Radix; one benign derived-error edge (a list-read error stays visible if the create dialog is then opened — no oracle covers it).

### File List

NEW — `frontend/src/features/admin-integrations/`:

- `types/admin-integrations.types.ts`, `schemas/webhook.schema.ts`
- `api/`: `api-clients-api.ts`, `webhooks-api.ts`, `webhook-deliveries-api.ts`, `admin-integrations-api.test.ts`
- `hooks/`: `use-api-clients.ts`, `use-scopes.ts`, `use-create-api-client.ts`, `use-revoke-api-client.ts`, `use-webhooks.ts`, `use-event-types.ts`, `use-create-webhook.ts`, `use-update-webhook.ts`, `use-toggle-webhook.ts`, `use-delete-webhook.ts`, `use-webhook-deliveries.ts`
- `components/`: api-clients (`api-clients-page-content`, `api-clients-table`, `create-api-client-dialog`, `api-client-secret-panel` + test, `api-client-status-badge`); webhooks (`webhooks-page-content`, `webhooks-table`, `webhook-dialog` + test, `webhook-secret-panel` + test, `webhook-status-badge`); deliveries (`webhook-deliveries-page-content`, `deliveries-table`, `delivery-status-badge`)

MODIFIED:

- `frontend/src/app/admin/api-clients/page.tsx`, `frontend/src/app/admin/webhooks/page.tsx`, `frontend/src/app/admin/webhooks/deliveries/page.tsx` (thin entries)
- `frontend/src/app/admin/api-clients/page.test.tsx`, `frontend/src/app/admin/webhooks/page.test.tsx`, `frontend/src/app/admin/webhooks/deliveries/page.test.tsx` (S1 oracle — `QueryClientProvider` wrapper only, zero assertion changes)

## Change Log

- 2026-06-12: Story created (admin integrations 3 pages → ONE `features/admin-integrations/` slice; DEC-1 build on useApiClient (nothing to wrap), DEC-2 Badge tokens, DEC-3 keep confirm() delete; behaviour-LOCK both show-once secret panels; webhook dialog → RHF+Zod with save-disabled parity + A95 eventTypes round-trip + A96 no-trim + no url-format-tightening; no regenerate/filters/retry invented; exact trailing-slash URLs). Status ready-for-dev.
- 2026-06-12: Implemented — 3 integrations pages → one `features/admin-integrations/` slice (build on useApiClient; both show-once secret panels behaviour-LOCKED; webhook dialog RHF+Zod with eventTypes round-trip A95; deliveries no-filters/no-retry preserved). +28 slice tests; S1 oracle: zero assertion changes (only a QueryClientProvider wrapper, A88); central full-suite / tsc / eslint / prettier green. DEC-1..3 = A. Status review.
