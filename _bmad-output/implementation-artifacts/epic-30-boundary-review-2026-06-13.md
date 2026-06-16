# Epic-30 Boundary Code Review — Frontend Feature-Slice Migration (Auth & App Shell)

**Date:** 2026-06-13
**Reviewer:** bmad-code-review (4 parallel adversarial layers) + orchestrator triage
**Scope:** the full E30 diff (S1-S5), reviewed at the epic boundary per the project hybrid workflow policy.
**Outcome:** ✅ **APPROVED** — 0 HIGH, 0 MEDIUM behavioural findings. 2 patches applied (1 LOW code, 1 MED doc-correction); the remaining findings are LOW and informational. Net-integrity auditor: **ORACLE-INTACT**.

## Diff under review

- **59 tracked files modified** — 7434/8909 raw lines, but only **383/1858 lines ignoring whitespace** (the bulk is S5 prettier re-indent from removing one nesting level).
- **12 new artifacts** — `components/layout/{PageShell,PageHeader,index,*.test}`, `features/system/components/*` (4 slice content + S2 nets), `features/dashboard/*` (api/types/hooks/components), and 8 app-shell/auth/framework `*.test.tsx`/`route.test.ts`.
- Stories: E30-S1 (primitives), E30-S2 (auth/system slice + net), E30-S3 (app-shell regression net, frozen), E30-S4 (dashboard god-page → slice), E30-S5 (PageShell retrofit across 51 pages). All 5 in status `review`.

## Layer 1 — Blind Hunter (diff only, no context)

**0 HIGH / 0 MED.** "Unusually clean for its size." Verified: dashboard 3-way branch + every module gate + role badges reproduced verbatim; auth slice byte-for-byte identical to the deleted god-page bodies; the manual→TanStack migration faithful (enabled-gate / retry:false / error-copy preserved / `result.data ?? null`); `PageShell`/`PageHeader` JIT-safe (static class map, no interpolation); every removed retrofit container was exactly `mx-auto max-w-Nxl` (no `space-y-6` collapsed). 3 LOW (informational): (1) dashboard self-wraps a 2nd QueryClient shadowing the app-root `retry:1` — intentional/A103-documented; (2) ~11 retrofit pages are "frame swap + portal/`fixed` modal reparent (verified safe)" rather than literal byte-identical source; (3) the auth-route smoke proves construction, not config (inherent NextAuth-boundary limit).

## Layer 2 — Edge Case Hunter (diff + repo read)

**0 HIGH.** i18n parity intact (en/de 2567 leaf keys each, all 105 migrated keys present, `hi.json` untouched, guarded by `messages.parity.test.ts`); the retrofit moved no inline-rendered overlay (`board-document-detail` correctly excluded — its restore dialog is a deliberate non-portal sibling). 3 LOW: **(1) [PATCHED P1]** the dashboard KPI query now refetches on window-focus (TanStack default `refetchOnWindowFocus:true`), whereas the god-page did a single ungated `useEffect` fetch — a new path vs the documented "single fetch" invariant (A79/A99); harmless in practice (bounded by `staleTime:60s`). (2) `result.data ?? null` vs `if (res.data)` — verified equivalent, not newly broken. (3) the god-page `catch → t("common.error")` fallback was dropped but the path is unreachable in both versions (`useApiClient().get` returns `{error}` instead of throwing). Many paths explicitly checked SAFE (type-narrowing, enabled-false no-spinner, error-then-auth-change, maxWidth union, thin-entry useSearchParams static-bailout, login disabled-account derivation).

## Layer 3 — Acceptance Auditor (diff + 5 story specs)

**0 HIGH.** Ran tsc (0) + eslint --max-warnings=0 (0) + prettier --check (clean) + the E30 nets + 62 retrofit slice test files (green, zero existing-test edits). **All S1-S4 ACs + every DEC resolution fully satisfied and match the shipped code.** 2 MED + 1 LOW, all on **S5 AC-text-vs-reality** (both reduce to one root cause, **[PATCHED P2 doc-correction]**): (MED) AC-6's "inline frame otherwise gone" grep end-state is unachievable as written + AC-2's literal "swap the suppliers guard / never half-adopt" is contradicted — because the guard/loading branches are NON-canonical (`mx-auto flex … justify-center py-12` / centered-spinner `<div>`), so they are correctly left inline for byte-identity; (LOW) the "23 left inline" list under-counts the retained guard-branch retentions. The Auditor's own conclusion: **the correct engineering decision (byte-identity over forced adoption) was made**; recommended a spec-correction note re-scoping AC-2/AC-6 to "page-level adoption keyed on the main frame" — now folded into the S5 story.

## Layer 4 — Net-Integrity Auditor (mandatory) — **ORACLE-INTACT**

All 4 checks pass: (1) **zero `.test.*` files edited in S5** (`git diff --name-only | grep test` empty — the frame swap touched no oracle); (2) the new nets assert real observable behaviour, no tautologies/softened matchers (login 12-case `signIn`/error-map/modal; auth-error full 11-code table + double-`Default` fallback + link hrefs; providers context-availability; framework smokes pin exact copy + `reset` + `console.error`); (3) the dashboard net pins all 8 required invariants at full strength — 3-way branch, no-redirect, every module gate `!== false` toggled BOTH ways, role badges, KPI fetch URL+method, the **exact** KPI error COPY (A79, verbatim string), and `canViewKpis=false → no fetch` (A97); the `formatCHF(98765)` value assertion uses an identity normalizer (de-CH U+202F) + a collision-proof payload; (4) S5 byte-identity is genuinely verifiable because `PageShell.test.tsx` pins the exact frame string + the full `max-w-*` static map by construction. **No false-green oracle detected.**

## Patches applied

| # | Sev | Layer | Change | Verification |
|---|-----|-------|--------|--------------|
| **P1** | LOW | Edge Case Hunter | `features/dashboard/components/dashboard-content.tsx` — added `refetchOnWindowFocus: false` to the slice's self-wrapped QueryClient `defaultOptions.queries`, so the dashboard KPI query faithfully matches the god-page's single ungated fetch (A79/A99). | dashboard net 22/22 green, tsc/eslint clean, full suite 2013 green. |
| **P2** | MED | Acceptance Auditor | `e30-s5-…md` — added a spec-correction note (A52/A56, mirrors the S2 i18n correction) re-scoping AC-2/AC-6 to "page-level adoption keyed on the MAIN frame; non-canonical guard/spinner branches stay inline by design" + documented the retained guard-branch retentions + the modal-reparent (portal/fixed, safe) note. Doc-only. | n/a (documentation). |

## Dismissed-with-evidence (no patch)

- **Nested dashboard QueryClient** (Blind L1) — A103-sanctioned self-wrap (the E27-S3 precedent); the dashboard query is deliberately isolated with `retry:false`; "nearest wins" makes it correct. Documented in S4.
- **Modal reparenting** (Blind L2 / Edge) — every reparented dialog is a Radix portal or `fixed` overlay → rendered-identical; the one non-portal sibling (`board-document-detail`) was correctly left fully inline. Documented in S5 (P2).
- **auth-route smoke proves construction not config** (Blind L3) — inherent NextAuth module-boundary limit; the smoke still catches a throwing `NextAuth(authOptions)` at module-init. Acceptable.
- **`result.data ?? null` / dropped `common.error` catch** (Edge L2/L3) — verified equivalent / unreachable in both versions.

## Gate summary (post-patch)

- `tsc --noEmit` clean · `npx eslint <changed> --max-warnings=0` clean · `npx prettier --check <changed>` clean · `npx vitest run` = **216 files / 2013 tests green** (E28-close 1944 → 2013 = +69 across E30; ZERO existing test files modified; every slice net green unmodified) · `next build` exit 0 (root `/`, `/auth/error`, `/login`, `/module-unavailable`, `/site-unavailable` all `ƒ` dynamic) · LF throughout.

## Verdict

✅ **APPROVED.** No behavioural defect across the whole-frontend program's FINAL domain epic: the auth/login flow is byte-frozen, the app shell is frozen + net-pinned, the last god-page (the 785-line root dashboard) is migrated under a 22-test oracle that survived the manual→TanStack flip with zero spec edits, and 51 pages adopted the shared PageShell/PageHeader byte-identically (verified by construction). The 2 patches (1 LOW behaviour-faithfulness, 1 MED doc-correction) are applied. **Recommend bmad-retrospective, then flip E30 stories + epic to `done`.** E31 (legacy-client retirement) is unblocked once E30 closes.
