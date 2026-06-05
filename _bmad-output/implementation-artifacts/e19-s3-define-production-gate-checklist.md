# Story E19-S3: Production gate checklist

Status: ready-for-dev

## Story

As **a maintainer facing a Production-Go-Live decision**, I want **a Production-gate checklist of measurable NFR thresholds (response-time, error-rate, backup-success-rate, uptime) plus the documented production-cutover blockers, each anchored to a telemetry source that already exists in Beta**, so that **the go/no-go is a documented, evidence-backed gate rather than a gut call, and every threshold can be checked against data the Beta deployment already produces**.

**Requirement:** REQ-088 AC-10. Epic E19, Story 3. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E19 Story E19-S3 (lines 1908–1924)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E19 — Story E19-S3 (lines 668–672)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-017 Logging and Health (lines 353–364)](../planning-artifacts/architecture.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-019 Backup Destination — Same RustFS (lines 376–384)](../planning-artifacts/architecture.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-015 Config Strategy (auto-migrate) + ADR-020 Beta-Mode Job Suppression (retention) (lines 329–341, 386–394)](../planning-artifacts/architecture.md)
- [RUNBOOK-beta.md §9 Production-gate NFR checklist (the placeholder this story fills)](./RUNBOOK-beta.md)
- [docs/14_beta_railway_setup.md §27 External uptime monitoring (E17-S4) + §9 Health probes + §26 CorrelationId logs](../../docs/14_beta_railway_setup.md)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-19)

This story was authored from the 19-line 2026-05-15 stub against post-Epic-18 reality. Findings (A56 existing-implementation spike):

- **`RUNBOOK-beta.md` already carries a pre-laid `## 9. Production-gate NFR checklist` placeholder** ([RUNBOOK-beta.md:286–290](./RUNBOOK-beta.md)), marked "authored by E19-S3". E18-S1 laid this anchor per A38. **This story FILLS §9 in place** — no new file, no renumber, §8 (E19-S1) untouched. TOC line 29 + §7 Quick-reference updated.
- **The load-bearing constraint is the epics test/evidence line: "a peer confirms the thresholds are measurable from existing Beta telemetry."** So every threshold MUST name a telemetry source the Beta deployment already produces. The existing telemetry surface (verified):
  - **Uptime %:** the external uptime monitor (E17-S4 — UptimeRobot / BetterStack / Uptime-Kuma free tier polling `/health/ready` every 5 min, alert on 3 consecutive failures; [docs/14 §27](../../docs/14_beta_railway_setup.md), [ADR-017](../planning-artifacts/architecture.md)). The monitor's dashboard reports the uptime percentage directly.
  - **Response-time + error-rate:** Railway's per-service **Metrics** tab (CPU/memory/network) gives infra-level signal; request-level latency + 5xx rate come from the **Serilog request log** (E17-S2 `UseSerilogRequestLogging`, CorrelationId-enriched; [docs/14 §26](../../docs/14_beta_railway_setup.md)) read from the Railway Logs tab. There is **no APM/metrics aggregator in Beta** (Seq/Loki/Prometheus are explicitly out of Beta scope, [ADR-017](../planning-artifacts/architecture.md)) — so a threshold like "p95 < Xms" is measurable only by sampling the request logs, not by a dashboard percentile. The checklist MUST be honest about this: thresholds that need a percentile dashboard are marked `[!] needs measurement tooling` rather than pretending Beta already reports them (A42 imprecise-claim discipline).
  - **Backup-success-rate:** the `daily-pg-backup` Hangfire job outcome — visible in the Railway Logs (success/failure log lines) and the count of `backups/yyyy/MM/dd-*.dump.gz.enc` objects on RustFS vs. expected daily cadence. E19-S2's restore-drill log is the *restorability* evidence that complements backup *success*.
- **Post-MVP scope (DEC-2): the gate is more than four NFR numbers.** A real Production-Go-Live also has hard **cutover blockers** that are architectural decisions deferred to E19, each already named in the ADRs: retention enforcement re-enabled ([ADR-020](../planning-artifacts/architecture.md) — `RetentionEnforcement__Enabled` flips back to `true` with audited defaults), `Database__AutoMigrate` → `false` (manual migration path, [ADR-015](../planning-artifacts/architecture.md) + [SCP line 909](../planning-artifacts/sprint-change-proposal-2026-05-15.md)), off-site backup replication ([ADR-019](../planning-artifacts/architecture.md) single-failure-domain risk closed), custom domain done ([E19-S1](./e19-s1-add-custom-domain-runbook-entry.md)), and real outbound SMTP ([E19-S4](./e19-s4-document-postal-smtp-migration-plan.md) — Mailtrap Sandbox replaced). The post-MVP directive favours capturing these as a second checklist sub-table so the gate is complete, not just the four named NFRs.
- **A42 reread-as-a-stranger** mandatory (the pre-filled-status check is critical here: the checklist must ship as a reusable gate with **empty pass/fail/measured-value columns**, NOT pre-ticked — a pre-ticked checklist becomes a one-decision snapshot, exactly the E18-S1-flagged anti-pattern). **Zero production code, zero config** — pure documentation.

## Acceptance Criteria

1. **AC-1 (section authored in place).** [RUNBOOK-beta.md](./RUNBOOK-beta.md) `## 9. Production-gate NFR checklist` is filled (placeholder replaced). TOC line 29 drops the "*(placeholder — authored by E19-S3)*" suffix; §7 Quick-reference gains a "Production go/no-go → §9" row. No renumber; §8 (E19-S1) untouched.
2. **AC-2 (the four named NFR thresholds).** §9 contains a threshold table covering at minimum the four NFRs named in the epics AC: **response-time target, error-rate, backup-success-rate, uptime percentage** — each with a column for: metric · proposed threshold · **measurement source (existing Beta telemetry)** · pass/fail (blank) · measured value (blank).
3. **AC-3 (every threshold anchored to existing telemetry).** Each threshold's measurement-source column names a telemetry surface the Beta deployment already produces: uptime → the E17-S4 external monitor dashboard; error-rate + response-time → Railway Metrics tab + Serilog request logs (CorrelationId-enriched, [docs/14 §26](../../docs/14_beta_railway_setup.md)); backup-success-rate → `daily-pg-backup` Hangfire log outcomes + RustFS object count. Any threshold that would need tooling Beta does NOT have (e.g. a p95-percentile dashboard) is marked **`[!] needs measurement tooling`** with a one-line note on what would provide it — NOT presented as already-measurable (A42 imprecise-claim discipline). This AC directly satisfies the epics "measurable from existing Beta telemetry" evidence line.
4. **AC-4 (thresholds are concrete + justified, not blank placeholders).** Each NFR carries a **proposed** numeric threshold with a one-line rationale (e.g. uptime ≥ 99.5% monthly = the free-tier-monitor-observable floor; error-rate < 1% of requests over a rolling 7-day window; backup-success ≥ 29/30 daily backups present + the E19-S2 drill green; response-time target stated as a sampled-log guideline given no percentile dashboard). The numbers are proposals the maintainer can tune — but they are present, not `<TBD>`.
5. **AC-5 (production-cutover blockers sub-table — DEC-2).** §9 includes a second sub-table "Production-cutover blockers" listing the architectural items that must be resolved before Production, each cross-linking its ADR / story: retention re-enabled ([ADR-020](../planning-artifacts/architecture.md)); `Database__AutoMigrate` → `false` ([ADR-015](../planning-artifacts/architecture.md)); off-site backup replication ([ADR-019](../planning-artifacts/architecture.md)); custom domain cutover done ([E19-S1 §8](./RUNBOOK-beta.md)); real outbound SMTP live ([E19-S4](./e19-s4-document-postal-smtp-migration-plan.md)); backup-restore drill green ([E19-S2 §3.1](./RUNBOOK-beta.md)). Each row has a blank done-column.
6. **AC-6 (reusable gate — blank status columns).** The checklist ships with **empty** pass/fail · measured-value · done columns and an instruction line ("snapshot this section per go/no-go decision; do not tick the master copy"). It is NOT pre-ticked or pre-filled with a current snapshot (A42 pre-filled-status discipline — a pre-ticked gate is a one-decision artifact, not a reusable gate).
7. **AC-7 (how-to-measure pointers).** §9 includes a short "How to read each source" block: where the uptime % shows in the monitor dashboard ([docs/14 §27](../../docs/14_beta_railway_setup.md)), where request latency/5xx appear in the Serilog logs ([docs/14 §26](../../docs/14_beta_railway_setup.md)), where the Railway Metrics tab lives, and how to count backup objects/outcomes — so the gate is actionable without hunting.
8. **AC-8 (no contradiction; A42 reread).** Every metric name, monitor reference (5-min poll / 3-consecutive-failure rule), endpoint (`/health/ready`), env-var (`RetentionEnforcement__Enabled`, `Database__AutoMigrate`, `Backup__EncryptionKey`), cron, and ADR citation in §9 matches RUNBOOK §3/§4/§6, docs/14 §9/§26/§27, and architecture.md byte-for-byte. The "no APM in Beta / Seq-Loki out of scope" statement matches [ADR-017](../planning-artifacts/architecture.md). Verified by the A42 six-category reread.
9. **AC-9 (peer review — thresholds measurable from Beta telemetry, deferred per A47).** A peer reads §9 and confirms each threshold is genuinely measurable from existing Beta telemetry (and that the `[!] needs tooling` items are correctly flagged). The epics test/evidence line. Marked `[!]` — requires a human reviewer and, to validate the sources are real, a green Beta with the E17-S4 monitor live. Deferred to the unified Wave-10 walkthrough; surfaced as a Q-item in Completion Notes.

## Decision-Needed (per A32 / A41)

### DEC-1: Threshold sourcing — strict-existing-telemetry-only vs. allow aspirational thresholds flagged for tooling

**Scope:** The epics evidence line demands "measurable from existing Beta telemetry". A useful Production gate might want a p95-latency threshold that Beta has no percentile dashboard to measure. How does §9 handle thresholds that exceed current telemetry?

**Options:**

- **(A) Anchor every threshold to existing telemetry; where a desirable threshold exceeds current tooling, INCLUDE it but mark it `[!] needs measurement tooling` with the one-line note on what would provide it.** (RECOMMENDED, post-MVP) Honest and complete — the gate names what Production *should* check while being truthful that Beta can't measure it yet, which is itself a Production-readiness signal (the tooling gap is a blocker). Satisfies the evidence line (the measurable ones are clearly the measurable ones; the gaps are clearly gaps).
- **(B) Strict: only include thresholds measurable from existing Beta telemetry; omit anything needing new tooling.** Literally satisfies the evidence line and is simplest to peer-confirm, but produces a thinner gate that silently omits known-important NFRs (a p95 latency target) — the omission reads as "covered" when it isn't.

**Recommendation:** **A** (include-but-flag), given the post-MVP directive and that a flagged tooling-gap is more useful than a silent omission.

### DEC-2: Scope — four named NFRs only vs. NFRs + production-cutover blockers

**Scope:** The epics AC names four NFRs. A real Production gate also has the architectural cutover blockers (retention, auto-migrate, off-site backup, domain, SMTP). Does §9 include them?

**Options:**

- **(A) Two sub-tables: (1) the four NFR thresholds, (2) the production-cutover blockers cross-linking their ADRs/stories.** (RECOMMENDED, post-MVP) The cutover blockers are all already named in the ADRs as "E19 / Production" follow-ups; collecting them into the gate is exactly what a go/no-go decision needs, and it ties E19-S1/S2/S4 into the gate as evidence rows. Post-MVP favours the complete gate.
- **(B) NFR thresholds only.** Satisfies the literal AC; leaves the architectural blockers scattered across ADRs with no single go/no-go home.

**Recommendation:** **A** (NFRs + cutover-blockers sub-table).

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm telemetry surface + anchors + resolve DECs (A28; A41 escape if pre-declared)

- [ ] 0.1 Confirm RUNBOOK §9 placeholder + TOC line 29 + §7 table unchanged since E18-S1 close (re-grep `Production-gate NFR checklist`).
- [ ] 0.2 Re-confirm the E17-S4 monitor contract (5-min poll, 3-consecutive-failure alert, `/health/ready` target) + [docs/14 §27](../../docs/14_beta_railway_setup.md); confirm no APM/Seq/Loki in Beta ([ADR-017](../planning-artifacts/architecture.md)).
- [ ] 0.3 Re-confirm env-var names + ADR citations: `RetentionEnforcement__Enabled` (ADR-020), `Database__AutoMigrate` (ADR-015/E15-S2), off-site backup (ADR-019), `Backup__EncryptionKey`.
- [ ] 0.4 Confirm Serilog request-logging (E17-S2 `UseSerilogRequestLogging`, CorrelationId) is the request-latency/5xx source + [docs/14 §26](../../docs/14_beta_railway_setup.md).
- [ ] 0.5 Resolve DEC-1 + DEC-2 (A41 escape if pre-declared, else AskUserQuestion per A32 step d) — record (a)/(b)/(c) per A43.
- [ ] 0.6 Spike outcome recorded in Dev Agent Record.

### Task 1: Author §9 NFR threshold table (AC-1, AC-2, AC-3, AC-4)

- [ ] 1.1 Replace §9 placeholder; intent paragraph (this is a reusable go/no-go gate; snapshot per decision; do not tick the master).
- [ ] 1.2 NFR threshold table: response-time · error-rate · backup-success-rate · uptime — columns metric / proposed threshold / measurement source / pass-fail(blank) / measured-value(blank).
- [ ] 1.3 (DEC-1) Anchor each to existing telemetry; mark any tooling-gap threshold `[!] needs measurement tooling` with the providing-tool note.
- [ ] 1.4 Fill concrete proposed thresholds + one-line rationale each (AC-4).

### Task 2: Author the cutover-blockers sub-table + how-to-measure block (AC-5, AC-7)

- [ ] 2.1 (DEC-2) Production-cutover blockers sub-table: retention (ADR-020) · auto-migrate→false (ADR-015) · off-site backup (ADR-019) · custom domain (E19-S1 §8) · real SMTP (E19-S4) · restore-drill green (E19-S2 §3.1) — each with a blank done-column + cross-link.
- [ ] 2.2 "How to read each source" block: monitor dashboard (§27), Serilog request logs (§26), Railway Metrics tab, backup object/outcome counting.

### Task 3: Reusable-gate hygiene + TOC/QuickRef (AC-6)

- [ ] 3.1 Ensure all status columns ship blank + the "snapshot per decision, don't tick the master" instruction (A42 pre-filled-status).
- [ ] 3.2 Update TOC line 29 (drop placeholder suffix) + §7 Quick-reference row.

### Task 4: A42 reread + Quality-Gates closing (AC-8, AC-9)

- [ ] 4.1 A42 six-category reread: (1) no contradiction with §3/§4/§6 + docs/14 §9/§26/§27 + ADRs; (2) checklist reads as a blank reusable gate, not a snapshot; (3) cross-links use §-numbers; (4) metric/env-var/cron/monitor-contract/ADR citations match sources; (5) no sprint leakage; (6) A57 — no documented command assumes an absent binary (this section is metrics-reading, mostly dashboard-based).
- [ ] 4.2 AC-Subitem Completion Check (A29) — Quality-Gates table one row per AC + per NFR threshold + per cutover-blocker.
- [ ] 4.3 (A47) AC-9 peer review → Completion Notes Q-item (needs human reviewer + live E17-S4 monitor).
- [ ] 4.4 Flip status to `review`.

## Dev Notes

### What this story does (and does NOT) do

- **Does:** fill RUNBOOK §9 with a reusable Production go/no-go gate — four telemetry-anchored NFR thresholds + a production-cutover-blockers sub-table + a how-to-measure block; status columns blank.
- **Does NOT:** make a go/no-go decision; pre-tick the gate; add new monitoring tooling; create a new file; renumber; touch §8; change production code/config.

### Verified facts (grounding for the ACs)

- **Uptime telemetry:** E17-S4 external monitor (UptimeRobot/BetterStack/Uptime-Kuma free tier), 5-min poll of `/health/ready`, alert on 3 consecutive failures ([ADR-017](../planning-artifacts/architecture.md), [docs/14 §27](../../docs/14_beta_railway_setup.md)). Detection floor ≈ 15–20 min (3×5min) — relevant when stating an uptime SLA.
- **Request latency / error-rate telemetry:** Serilog `UseSerilogRequestLogging` (E17-S2), CorrelationId-enriched, read from the Railway Logs tab; Railway Metrics tab for infra signal. **No percentile/APM dashboard in Beta** (Seq/Loki/Prometheus out of scope per [ADR-017](../planning-artifacts/architecture.md)) → percentile thresholds are `[!] needs tooling`.
- **Backup-success telemetry:** `daily-pg-backup` Hangfire job (`0 3 * * *` UTC) success/failure log lines + RustFS `backups/` object count; 30-day retention via `prune-old-backups` (`0 4 * * *` UTC). E19-S2 restore-drill log = restorability complement.
- **Cutover blockers (from ADRs):** `RetentionEnforcement__Enabled` false→true ([ADR-020](../planning-artifacts/architecture.md)); `Database__AutoMigrate` true→false ([ADR-015](../planning-artifacts/architecture.md), [SCP line 909](../planning-artifacts/sprint-change-proposal-2026-05-15.md)); off-site backup replication ([ADR-019](../planning-artifacts/architecture.md)); custom domain (E19-S1); real SMTP (E19-S4).

### A31 cross-story orthogonal-AC invariants in scope

1. **Monitor-contract parity** (AC-3/AC-8) — the 5-min-poll / 3-consecutive-failure / `/health/ready` description must match E17-S4 / docs/14 §27 exactly; §9 must not invent a different SLA mechanism.
2. **Env-var/flag parity** (AC-5/AC-8) — `RetentionEnforcement__Enabled`, `Database__AutoMigrate`, `Backup__EncryptionKey` names must match code + ADRs.
3. **Cross-story gate rows** — the cutover-blockers sub-table references E19-S1 §8, E19-S2 §3.1, E19-S4; those anchors must resolve (they are authored in the same epic).
4. **A38 doc-bundle anchor integrity** — §9 fills the placeholder without renumber; §8 stays as E19-S1's.

### Anti-patterns (do NOT)

- Do **not** ship a pre-ticked / pre-measured checklist — status columns blank; snapshot per decision (A42 pre-filled-status; this is the explicit E18-S1-flagged anti-pattern).
- Do **not** claim a p95/percentile threshold is measurable from Beta telemetry — Beta has no APM; mark it `[!] needs tooling` (A42 imprecise-claim).
- Do **not** restate the monitor setup — cross-link docs/14 §27 (A38).
- Do **not** leave thresholds as `<TBD>` — propose concrete numbers with rationale (AC-4); the maintainer tunes them.
- Do **not** create a separate `PRODUCTION-GATE.md` — it belongs in RUNBOOK §9 (A38 anchor).

## Quality-Gates Closing

| AC | Evidence (planned) | Status |
|---|---|---|
| AC-1 §9 authored in place + TOC/QuickRef | placeholder replaced; line 29 suffix dropped; §7 row; no renumber | pending |
| AC-2 four NFR thresholds | response-time · error-rate · backup-success · uptime table | pending |
| AC-3 telemetry-anchored (+ `[!]` tooling-gaps) | source column per threshold; gaps flagged | pending |
| AC-4 concrete thresholds + rationale | numeric proposals + one-line each | pending |
| AC-5 cutover-blockers sub-table | retention/auto-migrate/off-site/domain/SMTP/drill rows + cross-links | pending |
| AC-6 reusable gate (blank status cols) | empty pass-fail/measured/done + snapshot instruction | pending |
| AC-7 how-to-measure block | dashboard/logs/metrics/backup-count pointers | pending |
| AC-8 no contradiction / A42 reread | six-category reread + diff vs docs/14 §9/§26/§27 + ADRs | pending |
| AC-9 peer review measurability | live walkthrough (Q1) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Primary deliverable:** edits to `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` §9 (+ TOC line 29 + §7 row).
- **No automated tests** — documentation artifact; correctness enforced by the A42 reread (AC-8).
- **Peer-review evidence** (thresholds confirmed measurable from existing Beta telemetry) deferred to the unified Wave-10 walkthrough per A47.

## Dev Agent Record

### Agent Model Used

_(populated by dev-story)_

### Debug Log References

_(DEC-1 + DEC-2 resolution recorded here at dev-story time per A43 (a)/(b)/(c))_

### Completion Notes List

_(populated by dev-story)_

### File List

_(populated by dev-story)_

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A38** doc-bundle pattern (fill the E18-S1 RUNBOOK §9 anchor; cross-link the monitor setup, don't restate)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** reread-as-a-stranger — esp. pre-filled-status (blank reusable gate) + imprecise-claim (no percentile dashboard in Beta) categories
- **A47** uniform autonomous-mode escape for the `[!]` peer-review item (AC-9)
- **A56** existing-implementation spike (RUNBOOK §9 placeholder exists → fill-in, not net-new file)

## Story Completion Status

Status: ready-for-dev

Comprehensive context engine analysis completed — comprehensive developer guide created. §9 of RUNBOOK-beta.md to be filled with a reusable Production go/no-go gate: four telemetry-anchored NFR thresholds (each naming an existing Beta telemetry source, tooling-gaps flagged `[!]`) + a production-cutover-blockers sub-table (retention / auto-migrate / off-site backup / domain / SMTP / restore-drill) + a how-to-measure block, all status columns blank for per-decision snapshotting. DEC-1 (include-but-flag tooling-gaps) + DEC-2 (NFRs + cutover blockers) carry recommendations for dev-story resolution. AC-9 peer review deferred-pending-beta-green per A47.
