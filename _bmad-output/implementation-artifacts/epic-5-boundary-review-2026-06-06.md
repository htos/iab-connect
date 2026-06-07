# Epic-5 Boundary Code Review — Communication Automation (REQ-028 + REQ-030)

**Date:** 2026-06-06
**Scope:** Full Epic-5 diff (e5-s1..s5), uncommitted working tree on branch `beta`.
**Method:** 3-layer adversarial (Blind Hunter — diff only · Edge Case Hunter — diff + repo read · Acceptance Auditor — diff + specs), per the hybrid CR+ER policy (`feedback_bmad_workflow`).
**Pre-review state:** all 5 stories in `review`; backend 2211 + frontend 201 tests green.

## Outcome

**Approved with 2 patches applied.** The review surfaced one convergent HIGH (idempotency crash-gap) and one convergent HIGH (time-relative triggers re-sending daily). Both were genuine correctness defects in S2's load-bearing behaviour and were **fixed in place**; the rest are dismissed-with-evidence or deferred as tracked follow-ups (E5-FT-*). Post-patch: backend 2213 + frontend 201 green (no regression; +2 new idempotency tests).

## Patches applied

### P1 — Idempotency was not crash-safe → duplicate sends on restart (HIGH; converged across all 3 layers)
- **Finding:** `AutomationExecutionService` sent every recipient and then persisted the whole execution (with all `AutomationRecipient` rows + their idempotency keys) in a single `SaveChangesAsync` *after* the loop. A crash / pod-restart / host-shutdown mid-batch left **zero** rows committed, so a Hangfire retry's pre-check found no keys and **re-sent every already-emailed recipient**. Separately, a unique-index collision on that final batch save rolled back the entire execution (including non-colliding recipients) while the emails had already gone out. This directly contradicts S2 AC-3 ("a duplicate send is structurally impossible") — the headline AC of the story.
- **Fix:** **claim-before-send.** Recipients are now created `Pending` and the execution is persisted *first* (committing every unique `idempotency_key`) before any message is sent; each recipient is then transitioned to `Sent`/`Failed`/`Skipped` and the execution re-saved (`UpdateAsync`). A crash mid-batch now leaves the `Pending` claims on record, so the retry's pre-check skips them (at-most-once — no duplicate). A concurrent-run claim collision (`DbUpdateException` on the up-front insert) abandons the pass *before* any send. New domain mutators `AutomationRecipient.MarkSent/MarkFailed/MarkSkipped` + `Pending` factory; new `IAutomationExecutionRepository.UpdateAsync`.
- **Tests:** `ClaimIsPersistedBeforeSending` (status==Pending at claim time), `ClaimCollision_AbandonsRun_WithoutSending` (no send on collision); existing `RunTwice…` / failure-isolation / skip tests stay green.

### P2 — Time-relative triggers re-sent every day → email spam (HIGH; Blind M3 + Acceptance H2 + Edge #11)
- **Finding:** `EventUpcoming` / `MembershipRenewalDue` idempotency keys embedded `today + OffsetDays`. Because that date shifts every day, each poll produced a **new** key → not deduped → an Active definition emailed every recipient **every single day**.
- **Fix:** removed the shifting date from the time-relative keys — `MemberJoined`/`EventUpcoming`/`MembershipRenewalDue` now fire **once ever per recipient** (key carries no date); `Scheduled` keeps its per-day date by design; `Manual` is not auto-fired. v1 time-relative triggers are therefore one-time segment broadcasts (`OffsetDays` is retained as UI/metadata); binding them to specific event/renewal records is deferred (E5-FT-1). Evaluator docstring + S2 QGT AC-7 corrected to state this honestly.
- **Tests:** evaluator tests rewritten to assert the date-free, stable-across-days keys.

## Dismissed (with evidence)

- **Blind M1 — `ChannelPreferenceEndpoints.GetUserId` reads `FindFirst("sub")` → 401 in prod.** FALSE POSITIVE. The project sets `options.MapInboundClaims = false` (`Api/DependencyInjection.cs:171`), so the `sub` claim is preserved; the shared `HttpContextExtensions.GetUserId()` and `PrivacyEndpoints.GetKeycloakUserId` both read `FindFirst("sub")` identically. Behaviour is correct (the Blind Hunter had no project context). Minor consistency nit (could call the shared extension) — not a defect.
- **Blind M3 "MemberJoined blasts the whole back-catalogue on activation":** accepted as v1 semantics, not a defect — `MemberJoined` fires once-ever per current+future recipient (a welcome to the active segment on activation is bounded + non-repeating). Documented; real event-binding is E5-FT-1.

## Deferred follow-ups (tracked in deferred-work.md)

- **E5-FT-1** — Bind time-relative triggers (`EventUpcoming`/`MembershipRenewalDue`) to real event/renewal records (per-event occurrence keys + due-window query), replacing the v1 once-per-recipient broadcast.
- **E5-FT-2** — DEC-3 consolidation: refactor the two campaign recipient-resolution helpers (`EmailCampaignEndpoints`, `EmailCampaignJobService`) onto `IRecipientResolutionService` so there is truly one implementation (the shared criteria evaluator is already single-source; the send-path helpers are not yet).
- **E5-FT-3** — `GetAutomationsQuery` loads the full `EmailTemplate` table per list call to render the template-name column; switch to a targeted id→name lookup for the page's template ids (Blind M4).
- **E5-FT-4** — `AutomationForm` swallows template/segment load failures to empty dropdowns with no surfaced error (Edge #8); surface a load error.
- **E5-FT-5** — Per-definition isolation in `ExecuteDueAsync`: a throwing definition (e.g. corrupt dynamic-segment `CriteriaJson`, DB timeout) aborts the whole pass; wrap each definition in try/catch so one bad definition doesn't starve the others (Edge #5/#6).

## Honest-disclosure notes (no change needed — already disclosed in Dev Agent Records)

- **S3 AC-1** "recent execution state" is on the **detail** panel, not the list row (DEC-2 — a per-row column would be N queries). Disclosed in the S3 QGT + Completion Notes.
- **S1 AC-3 / A31-invariant-1** campaign send-path consolidation deferred (DEC-3 documented fallback; the shared criteria evaluator IS single-source). Now tracked as E5-FT-2.

## Verified-correct (sampled across layers)
Lifecycle guards (S1); dispatch-job decorators + module-skip + A44 6→7 (S2); failure isolation (S2 AC-4); only the automation path routes through `IMessageDispatcher` while campaigns/event-notifications stay on `IEmailSender` (S4 DEC-3); disabled-stub `ChannelDisabledException` + email fallback (S4); three-way eligibility gate + all degradation branches (S5); self-scoped + unknown-channel-400 + audited preferences API (S5); de/en i18n parity (S3/S5).
