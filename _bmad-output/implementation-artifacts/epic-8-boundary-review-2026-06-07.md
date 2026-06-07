# Epic-8 Boundary Code Review — External API & Webhooks (REQ-058)

**Date:** 2026-06-07
**Reviewer:** claude-opus-4-8 (autonomous, 3-layer adversarial — hybrid CR+ER per feedback_bmad_workflow)
**Scope:** the full Epic-8 diff across all 4 stories (E8-S1 credentials/scopes, E8-S2 external read API, E8-S3 webhook subscriptions/signing, E8-S4 delivery/retry/history) — backend (Domain/Application/Infrastructure/Api) + frontend admin UIs + tests.
**Quality baseline at review:** backend `dotnet test` 2375 passed / 0 failed (1584 Application + 288 Api + 503 Infrastructure incl. Testcontainers); A44 recurring-job count unchanged at 7; frontend tsc/eslint/prettier clean on changed files + vitest (pages + de/en/hi parity) green.

## Method

Three adversarial layers over the new code:
- **Blind Hunter** — correctness bugs (auth bypass, idempotency, transaction/tracking, concurrency).
- **Edge Case Hunter** — boundary inputs (empty scopes, clamps, non-https URLs, unresolvable hosts, paused mid-retry).
- **Acceptance Auditor** — each AC has a real, load-bearing test (not a vacuous assertion).

## Findings

### Patches APPLIED

**P1 (Medium → applied) — claim-before-send: a unique-key collision left the failed row tracked.**
`WebhookDeliveryRepository.AddAsync` did `Add` + `SaveChangesAsync`; on a unique `DedupKey` violation the failed entity remained in the `DbContext` change tracker in `Added` state. If a second, *distinct* delivery were inserted on the same context within one `EmitAsync` fan-out loop, EF would re-attempt the doomed insert and poison the unrelated delivery (it would be wrongly skipped + never enqueued). Not reachable on the normal at-most-once trigger path (each `EmitAsync` runs in its own request scope, and within one loop every subscription yields a distinct key), but a latent correctness hazard the moment a duplicate emit coincides with a multi-subscription fan-out.
**Fix:** catch `DbUpdateException` in `AddAsync`, detach the failed entity (`Entry(delivery).State = Detached`), and rethrow so the dispatch service abandons just that one delivery. Added a Testcontainers test (`Collision_DetachesFailedRow_SubsequentInsertSucceeds_OnSameContext`) proving a later distinct insert succeeds on the same context after a collision. All 3 layers converged on this being the only real robustness gap in the claim-before-send path.

### Dismissed (verified clean)

- **Auth additivity (S1):** the new `ApiKey` scheme returns `NoResult` on an absent header — existing JWT routes keep their 401 (unit-tested + the full 288-test Api suite green, no regression). The scheme is registered additively; the default scheme is unchanged.
- **Secret safety (S1/S3):** API secrets stored as `HMAC-SHA256(pepper, SHA256)` hash + non-secret prefix (verify via `FixedTimeEquals`); webhook signing secrets stored AES-256-GCM reversible (DEC-2=B — required because the server must sign each delivery). Tests assert the stored row never contains the cleartext; list/history never leak hash/secret/payload.
- **DTO leak (S2):** `ExternalEventDto`/`ExternalBlogPostDto` are whitelist-by-construction; the load-bearing test serializes the response and asserts organizer/contact/PII fields are absent. The internal `EventDto`/`MemberDto` are never reused.
- **Existence oracle (S2):** `/{id}` resolves from the published-only set → 404 (not 403) for unpublished/nonexistent ids.
- **Idempotent retry (S4):** the delivery job is `[AutomaticRetry(5)]`, no `[DisableConcurrentExecution]`; `DeliverAsync` reloads by id and short-circuits already-`Delivered` rows, so a retry can't double-deliver. A44 stays at 7 (one-off Enqueue, no cron).

### Deferred follow-ups (logged, not blocking)

- **E8-FT-1 (Low):** `WebhookDeliveryService.RecordFailure` is called per *retry attempt*, so the auto-pause threshold (default 15) counts attempts rather than distinct failed events. Behaviour is safe (a persistently-down receiver pauses sooner, which is the goal) but the threshold semantics could be documented/tuned.
- **E8-FT-2 (Low):** the SSRF guard fails-closed on a DNS-resolution exception and does **not** rethrow (no Hangfire retry) — a transient DNS outage permanently fails that one delivery. Safe-by-default (SSRF protection prioritised) but a transient-vs-permanent distinction (retry on resolution error, block only on confirmed private result) would improve availability.
- **E8-FT-3 (Low):** `payment.received` is wired only on the explicit `MarkPaymentAsPaidCommandHandler` path (A68 degrade-to-less, documented). Other paid transitions (`CreatePayment`, bank-import match) are candidate future hooks once a real consumer needs them.
- **E8-FT-4 (Low):** S2 external events expose only future published events (`GetPublicEventsAsync` bounds `EndDate >= now`) — by-design v1 parity with the public calendar; a `from`/`to` query param could surface past events later.

## Outcome

**1 patch applied (P1), 0 HIGH defects, 4 low-severity follow-ups logged.** Epic-8 is correctness-sound and ready to close. The claim-before-send + signing + scope/module enforcement seams are tested at the load-bearing level (crash-safety proven by a claim-persisted-before-enqueue test + a collision-detach test, not run-twice). Recommend proceeding to the Epic-8 retrospective and flipping all stories + the epic to `done`.
