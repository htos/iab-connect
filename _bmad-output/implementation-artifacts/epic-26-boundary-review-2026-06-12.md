# Epic-26 Boundary Code Review — Finance Frontend Feature-Slice Migration

**Date:** 2026-06-12
**Reviewer:** claude-opus-4-8[1m] orchestrator + 4 parallel adversarial review layers (autonomous mode, A41/A47)
**Scope:** the full E26 diff — 26 god-pages (16,205 LOC) → one `frontend/src/features/finance/` slice (91 files, 22,687 LOC) over a shared foundation, + 26 thin route shells + the 26-suite S1 characterization net.
**Verdict:** **APPROVED.** Net-integrity PASS, form-rules PASS, blind-hunt 0 findings, acceptance PASS; 2 MED cross-slice-consistency findings — **both applied as patches** (pure refactors, no behaviour change); 0 deferred, 0 dismissed-with-concern.

---

## Method

The E26 program migrated the largest, most permission-sensitive surface in the frontend (26 Finance pages, 16,215 LOC) using the A87/A101 pattern: a green S1 characterization net (309 tests) pins the god-page behaviour AS-IS, then S2 builds the shared foundation, then S3–S6 extract the remaining sub-areas in parallel — each keeping its sub-area's net green. The boundary review ran four adversarial layers over the full diff:

1. **Net-integrity auditor** — did the slice migrations weaken the S1 oracle?
2. **Form & mechanism rules auditor** — A95/A96/A92/A98/A99/A100 (the load-bearing rules that have bitten the program repeatedly).
3. **Blind Hunter** — real correctness bugs the green net does not assert.
4. **Acceptance auditor + cross-slice consistency (A101)** — ACs met + parallel-agent idiom divergence.

## Layer results

### 1. NET-INTEGRITY — PASS (0 findings)
Oracle intact. All 26 suites / 309 tests green post-migration; **zero transport-mock (`useApiClient`) edits**; zero weakened/deleted assertions. The 3 extended pre-existing suites (budgets/budget-vs-actual/journal-entries) are pure tail-append hardening (promoting anonymous write-spies to stable named spies per A78 — net-strengthening, not weakening). Two **licensed A79 data-mechanism timing accommodations** verified legitimate: S4 `categories-content` button-gate/derived-loading (in PRODUCTION content, not the suite — even cleaner) and S5 `bank-import/page.test.tsx` a single `waitFor` wrapper (a TanStack query commits one render later than the god-page's awaited setState). All 26 content roots self-wrap `QueryClientProvider({ retry:false })`. No `.skip`/`.only`/`xit` anywhere in the net. The 4 highest-risk suites' assertions confirmed intact (DELETE-vs-POST cancel, countryCode round-trip + 404→POST, POST-vs-PUT `/ignore` + upload field, blob filenames + non-appended anchor).

### 2. FORM & MECHANISM RULES — PASS (0 findings)
- **A95** (the program's #1 recurrence): every `<select>`-backed field that can hold an out-of-set value is `z.string()`/full-union with an extra `<option>` + raw default — `recipientType` (round-trips `"Other"`), `countryCode`/`currency`/`jurisdiction`, invoice-template `language`/`jurisdiction`, transaction account/category/activity-area, budget area/period. The 4 `z.enum(...)` hits (`type` Income/Expense ×2, `currency` CHF/EUR ×1, plus closed sets) are genuinely-closed rendered sets with no stored out-of-set possibility — legitimate.
- **A96**: no schema `.trim()`; profile `"" → null` optional mapping preserved without trim; the one S5 transaction submit-handler `.trim()` correctly MIRRORS the god-page byte-for-byte (the documented exception).
- **A92**: every form/modal reset+close driven from `onSuccess` (or mount-on-open) — input preserved on error. `transactions-content` even inspects `res.error` inside `onSuccess` and returns without closing on a soft error.
- **A98**: invoice form (Draft/Send + create-navigate + Member/Other), invoice-template (create-only jurisdiction / edit-locked countryCode), tax-code (edit rate-prefill ×100) — mode-divergent surfaces threaded + both modes pinned.
- **A99**: invoice-detail + payments + journal detail/edit-load queries are `retry:false`.
- **A100**: invoices-list Send/Cancel optimistic patch is a derived `statusOverrides` overlay keyed on the active filter (reset on filter change, NOT `data` identity), no refetch on the patched action, unchanged on error.

### 3. BLIND HUNT — 0 findings (0 H / 0 M / 0 L)
All 9 high-value classes clean across the api layer (5 files), ~30 hooks, and the high-risk components, cross-referenced against the god-pages retrieved from git: endpoints/methods/bodies (incl. every divergence) byte-identical; query invalidation keys are correct prefixes (incl. the intentional A100 no-invalidation); role-predicate gating verbatim (payments approve/reject = `isVorstand||isAdmin`, expense-claims ownership matrix, fiscal unlock = `isAdmin`-only); DoubleEntry mode guard correct (`enabled` = `modeChecked && canReadFinance`, redirect `/finance/settings`, no loop); upload/download fidelity (FormData fields, Content-Type omitted, appended-vs-not anchor, preview branch, hardcoded filenames); no query-key collisions; number/format (balance gate `<0.005`, ×100/÷100, VAT) preserved; no setState-in-render; all route shells are server entries.

### 4. ACCEPTANCE + CROSS-SLICE CONSISTENCY (A101)
- **ACCEPTANCE: PASS (0 findings)** — every load-bearing AC across all 6 stories met and not overstated (no A65/A29 multi-surface/sub-item trap). Foundation owns `/activity-areas` in exactly one place; S4/S6 reuse it; the close-out doc note is present.
- **CONSISTENCY: 2 MED findings (both applied as patches — pure refactors, no behaviour change):**
  - **P1 — `watch()` vs `useWatch` divergence.** 4 S6 settings forms used `watch()` (14 sites, emitting `react-hooks/incompatible-library` advisory warnings) while the S3/S4 forms used the compiler-clean `useWatch({ control })`. **Applied:** converged all 14 sites onto `useWatch` → eslint now `--max-warnings=0` clean.
  - **P2 — duplicate URL-builder re-declaration.** `banking-api.ts` + `receivables-api.ts` re-declared the foundation-owned `activityAreas`/`categories`/`taxCodes` builders as fresh literals (byte-identical URLs, but the foundation is the single owner). **Applied:** both now reference `financeUrls.*`.

## Patches applied (2)

| # | Sev | Finding | Fix | Verify |
|---|-----|---------|-----|--------|
| P1 | MED | 4 S6 settings forms use `watch()` (react-compiler advisory) — A101 library-idiom divergence | 14 `watch(name)` → `useWatch({ control, name })` across finance-profile/invoice-templates/settings-activity-areas/tax-codes content | eslint `--max-warnings=0` exit 0; S6 settings suites green |
| P2 | MED | `banking-api.ts` + `receivables-api.ts` re-declare foundation-owned `activityAreas`/`categories`/`taxCodes` builders (A101 single-owner divergence) | reference `financeUrls.*` instead of local literals | api-test assertions still green (URLs byte-identical) |

**Deferred:** none. **Dismissed-with-evidence:** none (the 4 `z.enum` hits + the S5 transaction `.trim()` were verified legitimate, not findings).

## Post-patch verification (central, orchestrator)
- `npx vitest run` (FULL): **192 files / 1840 tests passed** (baseline 158/1434 → +34 files / +406 tests; zero regressions). The 26 S1 characterization suites stayed green through all 5 slice migrations + both patches — the A87 behaviour-preservation proof at 26-page scale.
- `npx tsc --noEmit`: exit 0.
- `npx eslint src/features/finance src/app/finance --max-warnings=0`: exit 0 (0 errors, 0 warnings).
- Test-only/refactor-only diff: 37 tracked files changed (1146 insertions / 16,205 deletions — the god-pages gutted to thin shells) + the new `features/finance/` slice (91 files, 22,687 LOC). No production code outside `app/finance/**` touched; `@/types/finance` + `@/lib/api/budgets.ts` re-exported, never edited. LF endings (A73); pre-drifted repo files untouched (A72/A58). `next build` deferred per A58.

## New action items for the retro (→ project-context.md)
- **A102** — foundation must own shared-WRITE endpoint builders when N parallel sub-slices touch the same endpoint (refines A101/A62); the cross-slice-consistency pass must also check **library-idiom** divergence (watch vs useWatch), not just behavioural divergence. (Both surfaced as P1+P2.)
- **A103** — the canonical zero-edit-net pattern: each slice content root self-wraps `QueryClientProvider({retry:false})` + the api layer is builders+keys-only (hooks own `useApiClient`) → the S1 net renders `<Page/>` directly and survives the migration mocking only `@/lib/auth#useApiClient`. Proven at 26-page scale (2 licensed A79 accommodations total across 26 suites; consolidates A87/A88/A94).
