# Epic-22 Boundary Code Review — Frontend Feature-Slice Migration (Sponsors + Suppliers completion)

Date: 2026-06-07
Branch: `refactor/frontend-feature-slice`
Reviewer: bmad-code-review (3-layer adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor), epic-boundary hybrid policy.
Scope: e22-s1 (sponsors characterization tests), e22-s2 (sponsors list slice + tier badge + hi.json), e22-s3 (sponsors detail/new/edit slice + form sub-recipe), e22-s4 (suppliers detail/new/edit slice). Behaviour-preserving refactor; the E22-S1/S4 characterization suites are the contract.

Diff size: ~5,638 new lines (slice code + tests) + 2,621 deletions (god-pages) + 226 tracked insertions across 12 modified files.

## Layer verdicts

- **Blind Hunter:** Approve — auth gates, URLs, payloads, and error/empty/loading behaviour faithfully preserved; one Med to verify (query retry), two Low (cosmetic).
- **Edge Case Hunter:** 2 Med + 7 Low edge cases; most are preserved-from-god-page boundaries.
- **Acceptance Auditor:** s1 Pass-with-notes, s2 Pass, s3 Pass, s4 Pass-with-notes. A77/A78/A79, architecture rules, decisions (S2-DEC-1, S3-DEC-1, S3-DEC-2), i18n parity, AC sub-item completeness all verified sound.

## Triage

### PATCH (actionable, unambiguous)

- **P1 [Med] Suppliers detail suite missing the A76 delete-failure + destructive-affordance assertions.** `frontend/src/app/suppliers/[id]/page.test.tsx` covers delete→redirect but never asserts a failed `DELETE` surfaces the error (via `alert`) without redirecting, nor that the delete affordance is visibly destructive. The dialog code is correct (`delete-supplier-dialog.tsx` uses `buttonVariants({ variant: "destructive" })`), but nothing pins it — the exact E21 P2/P3 regression class is unguarded for suppliers. Source: auditor. Fix: add a delete-failure test (DELETE error → `alert` called, no `/suppliers` redirect) + a destructive-affordance assertion (header delete button red, or a focused dialog test).
- **P2 [Low] Sponsors detail suite lacks a delete-failure assertion.** `frontend/src/app/sponsors/[id]/page.test.tsx` tests delete→redirect only. Mitigated (the list suite pins the destructive affordance; detail reuses the same shared dialog), but the failure branch (alert + no redirect) is unpinned. Source: auditor. Fix: add the symmetric delete-failure test.
- **P3 [Low] `form.required` missing in `hi.json` → English validation text under Hindi.** The RHF+Zod required message (`t("form.required")`) is a NEW render path (the old forms used the browser-native HTML5 `required` bubble, browser-localized). `form.required` is absent from `messages/hi.json`, so the deep-merge falls back to English. Source: edge. Fix: add `form.required` to `hi.json` (additive; parity test tolerates the hi superset/subset).

### DEFER (pre-existing / preserved from the god-pages — see deferred-work.md)

- **D1 [Low]** 200-with-`data:null` detail GET writes null into cache → silent blank page (no error/not-found). Preserved from god-page (`if (!sponsor) return null`).
- **D2 [Low]** A mutation returning 2xx with `data:null` no-ops the `setQueryData` cache write → stale view, no alert (success path). Preserved.
- **D3 [Low]** `toLocaleDateString` on a non-null but invalid date (or null `createdAt`) renders "Invalid Date" — truthiness guard only. Pre-existing.
- **D4 [Low]** Detail status `<select>` with an out-of-enum `status` shows no matching option. Type-narrowed at compile time, unguarded at runtime. Pre-existing pattern.
- **D5 [Low]** Concurrent inline mutation + status-change both `setQueryData` a full snapshot → last-write-wins can drop a change until reload. Identical race existed in the single-`setSponsor` god-page.
- **D6 [Low]** `supplier-detail` retains `text-blue-600` links vs the "no new blue links" design standard. Copied verbatim in a behaviour-preserving migration; align in a future theming chore.

### DISMISS (no defect)

- **retry:1 + no-spinner-on-refetch + transient-error-retry** (blind+edge, raised Med). These are PRECISELY the manual→TanStack A79 deltas the Dev Records enumerated and deliberately accepted (`app/providers.tsx` sets `queries.retry:1`, bounded — not the 3x default the Blind Hunter feared without provider visibility; mutations fail-fast). Documented decision, not a regression.
- **Whitespace-only `companyName` now rejected** (`.trim().min(1)`) — a beneficial tightening, harmless.
- **`categoryPlaceholder` on the supplier edit form** — cosmetic; the i18n key exists; arguably more consistent.
- **Sponsor `Ended` badge gray→destructive (and the other 3 status colours)** — the deliberate E21 shared-Badge variant decision (DEC-2), pinned by `sponsor-status-badge.test.tsx`.

## Notable confirmations (verified correct, no action)

- Auth gates preserved exactly: sponsors `isVorstand||isAdmin` view + `isAdmin`-only delete; all suppliers `isAdmin`-only; query `enabled` mirrors each old effect guard (no GET for unauthorized).
- `setQueryData` writes the correct `detail(id)` key with the returned DTO (response-driven update, no extra GET — A79).
- A77 token verification sound (`--primary` = orange-600 #ea580c; badge tests assert the named-token classes `ui/badge` emits; tier classes copied verbatim and pinned).
- A78 stable mocks; A79 deltas enumerated + decided + (mostly) tested.
- Architecture: thin non-client route entries, single `"use client"` composition roots, zero raw `/api/v1/...` in components, `ContractLink*` kept in `@/types/sponsors`, legal import direction.
- i18n parity exact (en/de/hi 53 `sponsors.*` keys each, zero stray/missing).

## Outcome

3 patch, 6 defer, 4 dismissed. No HIGH findings. No decision-needed. Patches are test-coverage + i18n completeness (the A76 detail-delete-failure gap is the one Med).

**Patches APPLIED 2026-06-07:**
- P1 — added `A76: the delete affordance is visibly destructive` + `A76: a failed delete surfaces an error (alert) and does not redirect` to `frontend/src/app/suppliers/[id]/page.test.tsx` (suppliers detail 11 → 13 tests).
- P2 — added the symmetric two A76 assertions to `frontend/src/app/sponsors/[id]/page.test.tsx` (sponsors detail 15 → 17 tests).
- P3 — added `form.required` (`"आवश्यक"`) to `frontend/messages/hi.json` (text-insertion, LF-preserved; parity test green).

Post-patch gates: `tsc` clean, full Vitest **334/334** (was 330, +4), i18n parity green, eslint clean on changed files, LF-clean. Review **APPROVED**. Per the hybrid epic-boundary policy, all four E22 stories + epic-22 flip to `done` at the retrospective close (next step).
