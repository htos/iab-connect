# Epic-23 Boundary Code Review — Members Frontend Feature-Slice Migration

Date: 2026-06-07
Reviewer: bmad-code-review (3-layer adversarial: Blind Hunter / Edge Case Hunter / Acceptance Auditor), hybrid epic-boundary mode (full E23 diff across S1–S4).
Scope: 69 files, +8966 / −3890 (the new `src/features/members/` slice + duplicates + segments sub-area, the 9 thin `app/members/*` route entries, the relocated `components/members/*`, the deleted `lib/api/member-segments.ts`, the characterization-test net, en/de i18n additions).
Outcome: **APPROVED** — 3 patches applied inline (CR-P1/P2/P3); 7 items deferred as residual debt; Acceptance Auditor full PASS.

## Layer results

- **Acceptance Auditor — PASS (no findings).** All four story specs satisfied. Architecture rules verified clean: no `"use client"` in any `page.tsx` (9 thin entries); no raw `/api/v1/...` strings in any component/page (only in `api/*`; the few in JSDoc are documentation); import boundary clean (`lib ↛ features` = 0; no cross-feature `@/features` inside the slice; intra-slice relative). DEC compliance confirmed: S2 transport (useApiClient + raw-fetch create/update exception for the 409 body), S2 feature-local badges (verbatim colours, A76/A77), S2 delete dialog + `members.confirmDeleteTitle` en+de lockstep; S3 `components/members/` deleted + **A76 orange confirms preserved** (NOT destructive); S4 `lib/api/member-segments.ts` deleted + **DEC-2 inline two-step delete preserved** + shared `segment-form` (read-only type + edit-only isActive).
- **Blind Hunter — 0 HIGH.** Confirmed correct: the onWatch/useCallback stability defusing (A64/A78), the 409 duplicate synthesis + Exact/Likely submit gating, all mutation→invalidation keys, the merge modal's required-target/N=2-auto-source (no silent destruction), `buildCanonicalPairs` C(N,2).
- **Edge Case Hunter — overwhelmingly faithful.** Auth gates, server-side search/filter/page query-key granularity, statistics fail-silent, cascade-dismiss, duplicate state machines, inline deletes, typeahead debounce/min-2/outside-click, refreshKey→invalidation, pagination bounds — all preserved. Found the drifts below.

## Patches APPLIED (3)

- **CR-P1 [MED] `member-detail.tsx`** — the error/not-found guard was `if (queryError)` BEFORE `if (!member)`, so a transient background-refetch error (window-focus refetch) would blow away the cached, already-rendered member and show the full-page error. Fixed to `if (queryError && !member)` (matches `member-edit-content`). 404 + initial-load-error paths unchanged (member is undefined there). S1 detail tests stay green.
- **CR-P2 [MED] `segment-edit-content.tsx`** — no `!segment` guard after the loading gate: a failed/absent load (useSegment collapses 404 + GET-error to null) rendered a BLANK editable form whose submit would PUT to a missing/forbidden id. Added a not-found view (mirrors `segment-detail-content`, reuses `segments.notFound` + `segments.backToList`).
- **CR-P3 [LOW-MED] `member-new-content.tsx` + `member-edit-content.tsx`** — the create/update body mapped empty `phone`/`country` via `|| undefined` (omitting the field). The god-pages sent `""` (and on edit `""` clears a field) and the suppliers slice sends raw values; omitting changes clear-on-edit semantics. Fixed to send the raw form values. (The duplicate pre-flight's `phone: values.phone || undefined` is intentionally left — it matches the god-page lookup.)

Post-patch gates: `tsc --noEmit` clean, `eslint` clean, members+slice **147 tests green**.

## Deferred — residual debt (real but not actionable now; conflict-priority preserve-over-improve / pre-existing / spec-mandated)

- **CR-D1 [MED→accepted] Client-side email-format validation removed.** The god-pages used `<input type="email" required>` (native gate); the slice form is `noValidate` + Zod without `.email()`. This is MANDATED by E23-S2 AC-10 ("no new `.email()`/`.url()` constraints") and matches the program-wide E22 form sub-recipe (suppliers/sponsors). Backend still validates. Not a members-specific regression — a deliberate, consistent recipe trade-off. Candidate for a future program-wide form-validation story.
- **CR-D2 [MED] `useSegment`/`useSegmentMembers` error surfacing.** `useSegment` resolves null for BOTH 404 and generic GET error (S4 quirk to match the detail god-page), so a transient detail refetch error after add/remove can flip the loaded view to `segments.notFound`; `useSegmentMembers` errors fall through to the empty state with no banner. The god-page kept last-good data + an inline banner. Rework (throw-on-non-404 + surface members error) deferred — transient-error edge, S1 net green.
- **CR-D3 [LOW] Segment-detail typeahead lost-update race.** No AbortController/sequence guard (unlike the edit-member dup re-check). Pre-existing — the god-page typeahead had none either; behaviour preserved.
- **CR-D4 [LOW] Cascade-dismiss non-atomic.** A partial `Promise.all` failure leaves some pairs dismissed with no rollback; idempotency-tolerant on retry. Pre-existing (god-page identical).
- **CR-D5 [LOW] Detail status/type selects disable independently.** God-page used one shared `statusUpdating` flag (both disabled during either PUT); the slice disables each by its own mutation. Cosmetic.
- **CR-D6 [LOW] Edit header subtitle static.** Bound to the cached `member` name, not the live-typed form value (god-page bound to formData). Cosmetic.
- **CR-D7 [LOW] Whitespace-only required fields now rejected.** Zod `.trim().min(1)` vs HTML5 `required` (which accepted whitespace). Minor tightening, arguably an improvement; program-wide recipe.

## Dismissed (noise / by-design)

- Statistics fetch error swallowed to null (`use-member-statistics`) — by design, god-page parity (cards just don't render; never a banner).
- Various Blind-Hunter "looks suspicious but verified correct" items (merge source select for N>2, mutation keying, onWatch subscription) — confirmed not bugs.

## Net assessment

A large, disciplined, behaviour-preserving migration. The E23-S1 characterization net (113 pinned behaviours) held green through all three extractions; the 3 applied patches close the only genuine behaviour-drifts worth fixing now. Residual debt is documented and low-risk. Epic is ready for retrospective + close.
