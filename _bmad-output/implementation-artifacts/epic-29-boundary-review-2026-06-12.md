# Epic-29 Boundary Code Review — Frontend Feature-Slice Migration (Smaller Features)

**Date:** 2026-06-12
**Scope:** the full E29 implementation diff (working tree vs commit `0cf788e`) — 3 new feature slices (`features/documents/`, `features/board-documents/`, `features/profile/`), 5 thin route entries, 5 characterization specs (E29-S1), the `ChannelPreferencesCard` relocation, and the 4 story files.
**Method:** 3-layer adversarial review (Blind Hunter / Edge Case Hunter / Acceptance Auditor) run as parallel sub-agents over the staged diff, then orchestrator triage. Hybrid CR+ER per project workflow (`feedback_bmad_workflow`).
**Reviewer model:** claude-opus-4-8[1m] orchestration + 3 general-purpose review sub-agents + 1 patch sub-agent.

## Verdict: **APPROVED** (5 patches applied, 4 Low defers)

- **Acceptance Auditor: PASS.** All E29 ACs and load-bearing invariants genuinely satisfied; the characterization specs assert real behaviour (none weakened/deleted to pass). DEC-1/2/3/4 = recommended A with claimed consequences holding. Confirmed independently: vitest 834/99 green (pre-patch), tsc clean, eslint exit 0, i18n parity 3/3 green, LF throughout, shared `lib/services/documents.ts` + `lib/api/{privacy,members,users}.ts` untouched.
- **Blind Hunter & Edge Case Hunter:** no HIGH; converged on the same 3 Med error-path regressions + the deterministic-404-retry delta. No correctness-breaking bug; the migration is behaviour-faithful on happy paths + auth gates (the board Vorstand/Admin gate and the profile guard matrix are verbatim; FormData/getSession Bearer shape byte-identical; query keys well-formed; download token-at-click + object-URL revoke preserved; toast timers cleared on unmount; no boundary violations / `any` / raw `/api/v1` in components / hardcoded strings).

## Patches APPLIED (5)

Both hunters independently flagged P1–P3; P4 flagged by both; P5 by the Blind Hunter.

- **P1 [Med] `board-document-upload-dialog.tsx` — upload form wiped on the ERROR path.** `submit()` cleared `file`+form synchronously (before the async mutation settled); on a failed upload the parent keeps the dialog open, so the user lost their file + metadata (the god-page preserved them on error). **Fix:** lifted the stateful body into an inner component mounted only while `open` → input preserved on error, cleared on close/reopen. (lint-clean mount-on-open pattern, avoids `react-hooks/set-state-in-effect`.)
- **P2 [Med] `board-document-version-dialog.tsx` — same wipe-on-error** for the version-upload (file+comment). Same mount-on-open fix.
- **P3 [Med] `board-document-tag-editor.tsx` (+ `board-document-detail.tsx`) — tag editor collapsed to view mode on a FAILED save** (losing the user's edit; the god-page kept edit mode open on error). **Fix:** `submit()` is now `async`, `await`s `onSave`, and only `setEditing(false)` on success; the parent uses `mutateAsync` + re-throws on error.
- **P4 [Med] deterministic-404 retried once.** `use-board-document` (404→`BoardDocumentNotFoundError`) and `use-profile` (404→`NoMemberRecordError`) were retried by the provider `retry:1` default → wasteful double-fetch + ~1s delay before the not-found/no-member view (the god-pages rendered it immediately). **Fix:** `retry: (n, err) => !(err instanceof Sentinel) && n < 1` on BOTH queries; list/other queries keep the program-wide `retry:1` default (shared with suppliers/members/events). Spec QueryClients got `retryDelay:0` for the 4 legitimate-retry error tests (mechanism-level only; no outcome assertion changed).
- **P5 [Low] `profile.schema.ts` — PUT body now byte-identical to HEAD.** The required fields used `z.string().trim()`, trimming the PUT `/members/me` body vs the god-page's raw input. **Fix:** dropped `.trim()` (kept `.min(1, "form.required")`); comment corrected.

**+5 regression tests** added (tag-editor stays-open-on-error; upload/version dialogs preserve-on-error). Post-patch gates: **full suite 839 passed / 101 files** (834 + 5; zero regressions), tsc clean, eslint exit 0 (1 pre-existing unrelated warning in `admin/backups/page.tsx`), prettier clean, LF.

## Deferred (4 Low → deferred-work.md, E29-CR-D1..D4)

- **E29-CR-D1 [Low]** session-revoke transient "revoking…" state + error-path flicker differ from HEAD (optimistic removal moved success-time→mutate-time); end state identical, S1 green.
- **E29-CR-D2 [Low]** unauthorized user briefly sees the not-found/empty content for one render before the redirect effect (TanStack disabled query `isLoading=false`); no data leak (queries `enabled`-gated).
- **E29-CR-D3 [Low]** concurrent revoke of two different rows can mis-rollback / mis-track the single `revokingSessionId` (pre-existing single-id limitation); fix = disable all revoke buttons while any pending.
- **E29-CR-D4 [Low]** consent success toast can show even when the (un-awaited) post-toggle refetch fails — an A76-branch divergence (god-page showed error if the refetch failed); self-heals on next interaction.

## Informational (no fix)

- `use-board-document.ts` non-404 error path throws `new Error(result.error ?? "documents.notFound")` — the key-string is used as a sentinel, never surfaced; the component renders the not-found view on any error-with-no-data (faithful to the god-page "document is null").
- AC-8 `documents.notFound` fix is behaviour-equivalent in English (`en` = "Document not found") and an improvement in German (`de` = "Dokument nicht gefunden").

## Cross-cutting invariants verified

Board Vorstand/Admin gate (both pages, verbatim) · profile guard matrix + 404 no-member admin-vs-member view + links · consent THREE branches (silent-load / success-3s / explicit-error-no-timer) · session optimistic-removal + rollback · profile-security ALERT-banner-on-load-failure (impl follows the S1 net, not the wrong AC-4 "silent" wording) · DEC-3 type homes re-export from `lib` (no `lib→features`) · A62 (`lib/services/documents.ts` untouched; `["documents"]` vs `["board-documents"]` non-colliding) · A86 contextual destructive colour (board delete → destructive; status/restore unchanged) · A58/A72/A73 (only thin-entry collapses + spec transport adaptations modified; no pre-drifted file ballooned; LF) · A65 (download-error A76 branch pinned on BOTH the documents table and the board detail) · A87 (green characterization net + provider seam = behaviour-preservation proof; documents S1 spec unchanged, board detail one `use(params)` re-point, profile transport-adapted, security unchanged).
