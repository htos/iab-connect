# Story E17-S4: External uptime monitoring

Status: done

## Story

As **an operator (Harry today; any fork operator tomorrow)**, I want **a polite external uptime monitor polling the public Beta `/health/ready` endpoint on a fixed cadence with email alerts on sustained failure**, so that **a Beta outage is detected without depending on Railway's own internal monitoring, with a documented configuration that an OSS fork can reproduce in their own monitoring account**.

**Requirement:** REQ-088 AC-5. Epic E17, Story 4. Sources:

- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E17 — Story E17-S4](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §3 ADR-017 — Logging and Health for Container Runtimes](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E17 Story E17-S4 (lines 1766–1783)](../planning-artifacts/epics-and-stories.md)
- Companion: this story sits alongside [e17-s1-restrict-serilog-to-console-in-containers.md](e17-s1-restrict-serilog-to-console-in-containers.md) and [e17-s2-validate-structured-logs-with-correlation-id.md](e17-s2-validate-structured-logs-with-correlation-id.md) in the E17 Monitoring/Logging/Health epic.

## Refresh Notes (2026-06-02, bmad-create-story bulk refresh)

This story was refreshed from the 19-line 2026-05-15 stub against post-Epic-13 (Railway deploy) + post-Epic-14 reality. Material drift vs. the SCP-2026-05-15 §5 text:

- **AC literal text contains an internal inconsistency.** SCP §5 AC-2: "A simulated 2-minute outage triggers an email alert." But ADR-017 §Decision sets "polls `/health/ready` every 5 minutes and alerts on three consecutive failures" — meaning the minimum detection latency is `2 × 5 min + a few seconds = ~10 minutes`, and the email-alert latency is ≥10 minutes. A 2-minute outage cannot trip a 3-consecutive-failure rule at 5-minute polling cadence. Surface as **DEC-2** for resolution.
- **Story is largely external-SaaS operator action.** The dev-agent cannot create an UptimeRobot or BetterStack account from its sandbox, cannot configure the monitor, cannot trigger a real Railway service restart, cannot verify the email alert lands in Harry's inbox. The deliverables that DO fit dev-agent scope: (a) author docs/14 Section 27 with the operator runbook + alternatives matrix; (b) confirm `/health/ready` is unauthenticated and rate-limit-exempt per E14-S4 P3; (c) verify the in-image healthcheck pattern doesn't conflict with external polling; (d) provide a backend-side regression test that the `/health/ready` endpoint is rate-limit-exempt; (e) provide the `[!]` task queue for the live walkthrough operator. The actual monitor configuration is a Wave-8/9 walkthrough item per A47.
- **Post-MVP scope expansion per Harry's 2026-06-02 directive ("es handelt sich nicht mehr um ein mvp"):** the story now documents BOTH UptimeRobot AND BetterStack as supported options (DEC-1=C), with a comparison table so fork operators can pick the service that best fits their account-creation constraints. The SCP text named "UptimeRobot (or BetterStack)" — this story formalizes the "or" into a side-by-side configuration runbook.
- **A52 endpoint-pattern verification:** SCP AC references `/health/ready`. The endpoint EXISTS at [`backend/src/IabConnect.Api/DependencyInjection.cs:395-399`](../../backend/src/IabConnect.Api/DependencyInjection.cs) with `.DisableRateLimiting()` chained per E14-S4. Verified ✓.
- **A40 shell-command-syntax check:** UptimeRobot CLI does NOT exist (UptimeRobot is API-only or web-UI-only; there's no official CLI). BetterStack has a `bt` CLI but it's tier-gated and not relevant for monitor creation. All runbook commands here are either UI screenshots/click-paths OR direct API calls via `curl`. UI click-paths are version-stable enough to document with screenshots-replaced-by-text-descriptions; API call examples for UptimeRobot use the `https://api.uptimerobot.com/v2/newMonitor` endpoint with `api_key=<readonly-or-main-key>` body params (documented at [UptimeRobot API docs §Add monitor](https://uptimerobot.com/api/) — pinned in §27.4). For BetterStack the API endpoint is `https://uptime.betterstack.com/api/v2/monitors` (documented at [BetterStack Uptime API §Monitors](https://betterstack.com/docs/uptime/api/list-existing-monitors/)). Both endpoints documented in §27 with **explicit `[!] verify against current docs before executing` markers** per A40.
- **A38 doc-bundle pattern:** docs/14 Section 27 (E17-S4) inserts between Section 26 (E17-S2) and the Appendix.
- **A47 escape applied:** all monitor-configuration ACs (AC-6, AC-7, AC-8) and the alert-fire-drill AC (AC-9) are `deferred-pending-beta-green` for the Wave-8/9 unified walkthrough.
- **Cross-epic dependency:** this story has a soft prerequisite on Epic-13 (Railway Beta Deployment) being live + on `/health/ready` being externally reachable. Both gates close in the Wave-8/9 walkthrough.

## Acceptance Criteria

1. **AC-1 (`/health/ready` exists, is unauthenticated, returns 200 when DB + Keycloak healthy).** Refresh confirms the endpoint at [`backend/src/IabConnect.Api/DependencyInjection.cs:395-399`](../../backend/src/IabConnect.Api/DependencyInjection.cs) with `Predicate = check => check.Tags.Contains("ready")` covering DatabaseHealthCheck + KeycloakHealthCheck. A regression test confirms the endpoint is mapped at `/health/ready` with no `RequireAuthorization` chained.
2. **AC-2 (`/health/ready` is exempt from rate-limiting).** Regression test reads `DependencyInjection.cs` and asserts `.DisableRateLimiting()` is chained on the `MapHealthChecks("/health/ready", ...)` call. The contract: a polling monitor at 5-min cadence (288/day) must never trip the anonymous 100/min/IP limiter even when sharing an egress IP with a noisy neighbour. Confirmed at line 399.
3. **AC-3 (`/health/ready` returns 503 when a dependency is unhealthy).** Regression test reads `WriteHealthCheckResponse` at [`DependencyInjection.cs:526-540`](../../backend/src/IabConnect.Api/DependencyInjection.cs) (the response writer); confirms it sets HTTP status reflecting `HealthReport.Status`. (Already a behavior; locked in by test.) Operators rely on 503 as the failure signal for the external monitor.
4. **AC-4 (docs/14 Section 27 published with full operator runbook).** [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) Section 27 documents (a) the polling cadence + alert rule chosen per DEC-2, (b) side-by-side UptimeRobot vs. BetterStack configuration per DEC-1=C, (c) `[!] verify against current docs` API/UI references per A40, (d) failure tree, (e) live-deploy `[!]` queue.
5. **AC-5 (alternatives + rationale table).** Section 27.2 contains a comparison table covering UptimeRobot Free vs. BetterStack Free vs. self-hosted (Uptime Kuma) with columns: polling cadence (free tier), alert channels included, monitor cap, account setup friction (credit card, OSS-friendly), notes. Empowers a fork operator to pick.
6. **AC-6 (UptimeRobot monitor created and polling — A47 deferred).** When the unified Wave-8/9 walkthrough runs, the operator: (a) creates an UptimeRobot Free account; (b) adds a `HTTP(s)` monitor pointed at `https://api.<beta-host>/health/ready`; (c) sets polling interval to 5 minutes (free-tier minimum); (d) sets alert contact to operator's email; (e) sets "alert when monitor goes down" with the chosen DEC-2 latency rule. Marked `[!]`.
7. **AC-7 (alert email contact verified — A47 deferred).** Operator confirms the email-contact verification handshake from UptimeRobot (one-time verification email; click link in inbox). Marked `[!]`.
8. **AC-8 (monitor dashboard captured in RUNBOOK — A47 deferred).** Once the monitor is active, the operator captures a screenshot of the UptimeRobot dashboard showing the monitor as `Up` with response time chart; pastes link or filename into RUNBOOK-beta.md (or the equivalent operator-facing artifact that E18 will produce). For now, this story's docs/14 Section 27.6 has a placeholder line that an operator fills in during the walkthrough. Marked `[!]`.
9. **AC-9 (alert fire drill — A47 deferred).** Operator triggers a deliberate API outage (Railway dashboard → restart `api` service; OR temporarily change the Railway healthcheck path to a 404 path); waits the configured detection window per DEC-2; confirms (a) alert email received in operator's inbox; (b) UptimeRobot dashboard shows the monitor as `Down`; (c) once the outage is restored, recovery email is received; (d) total alert latency is logged in the unified walkthrough notes for review against DEC-2's stated latency. Marked `[!]`.
10. **AC-10 (cross-story A31 invariant — `/health/ready` rate-limit-exempt parity).** A regression test reads BOTH the `MapHealthChecks` registrations at `DependencyInjection.cs:394-399` AND docs/14 Section 27.3 + Section 23.4 (E14-S4's rate-limit-exemption doc) + Section 9 (E13-S4's healthcheck-path doc); asserts the three documented surfaces all reference `/health/ready` consistently. A31 doc-vs-code per A51.

## Decision-Needed (per A32 / A41)

### DEC-1: Which monitoring service does this story make canonical?

**Scope:** ADR-017 names "UptimeRobot or BetterStack." SCP §5 AC-1 says "An UptimeRobot (or BetterStack) monitor." This story's Section 27 has to pick a primary recommendation OR document both.

**Options:**

- **(A) UptimeRobot only (Free tier).** Established (since 2010), 50 monitors free, 5-minute polling, no credit card required to create an account, OSS-friendly. The "default" in the SCP. Single-vendor lock-in for the runbook makes the doc shorter and faster to follow.
- **(B) BetterStack only (Free tier).** Modern UI, integrated status page (free 10 monitors), 3-minute polling cadence on the free tier (faster detection), nicer alerting integrations. Requires email but no credit card for the basic Uptime tier.
- **(C) Both, side-by-side runbook + comparison table. (RECOMMENDED — post-MVP per Harry's 2026-06-02 directive)** OSS-fork-friendly. A fork operator with an existing BetterStack workspace can wire it up in minutes without needing a separate UptimeRobot account; an operator who prefers UptimeRobot's longevity can pick that. The cost is doubling Section 27.4 length to cover two service setups — manageable. Adds AC-5 (the comparison table).

**Recommendation:** **C**. Aligns with post-MVP OSS posture; the runbook doubling is one section deeper, not architecturally heavier.

### DEC-2: Polling cadence + alert rule (reconciling SCP AC-2 vs. ADR-017)

**Scope:** SCP AC-2 says "A simulated 2-minute outage triggers an email alert." ADR-017 says "polls every 5 minutes and alerts on three consecutive failures." These are inconsistent — `3 consecutive × 5-min interval` ≈ 15-minute detection latency, so a 2-min outage cannot fire an alert.

**Options:**

- **(A) Relax AC-2 to align with ADR-017: "A simulated 15-minute outage triggers an email alert within 5 minutes of detection (worst-case total: ~20 minutes from outage start to email)."** (RECOMMENDED) Matches ADR-017's free-tier reality. Three consecutive failures + 5-min polling = ~15 min absolute floor for the alert to fire, plus 0-5 min for the polling cadence to surface it. The walkthrough fire drill (AC-9) triggers a 20-minute deliberate outage and confirms detection. Document the latency math explicitly in Section 27.3 so operators understand the SLA boundary.
- **(B) Tighten polling cadence: pay for UptimeRobot Pro ($7-12/mo) which polls every 1 minute.** A 2-minute outage with `2 consecutive × 1-min` would alert in ~3 minutes. Operationally tighter; cost is real but small. Out of scope for a "Beta" SLO and out of the OSS-fork-friendly default.
- **(C) Switch to alert-on-first-failure (single failure triggers alert).** Catches 2-minute outages at the 5-minute polling cadence. Cost is alert noise from transient blips that auto-recover (Railway deploy windows, transient JWKS-fetch failures, Keycloak GC pauses). High false-positive rate; operators stop trusting the alert.
- **(D) Switch monitor to BetterStack 3-minute polling.** Detection floor = `3 consecutive × 3-min` = ~9-12 minutes for the alert. Tighter than (A); still doesn't catch a 2-minute outage. Half-measure.

**Recommendation:** **A**. Document the latency math + the chosen rule transparently. Production-grade SLOs (E19) can revisit if Beta data shows the latency is operationally insufficient. Post-MVP doesn't mean "pay for SaaS" — it means be honest about the floor.

### DEC-3: Live-fire-drill methodology (AC-9)

**Scope:** AC-9 needs a way to trigger a real outage for the alert fire-drill. Two viable methods.

**Options:**

- **(A) Railway dashboard → Settings → Restart `api` service.** Railway's restart blackholes the service for ~30-90s during pod swap. To extend to the AC-9 fire-drill window (≥15 min per DEC-2=A), stop the service entirely (Railway dashboard → Settings → Stop). Then wait the configured detection latency. Then Start. Simple, repeatable, no code changes.
- **(B) Temporarily change Railway healthcheck path to a 404 path** (e.g. set `healthcheckPath = /does-not-exist`); Railway marks the service unhealthy after its own healthcheck timeout; UptimeRobot sees 503/404 from `/health/ready` and fires the alert. More invasive (changes Railway service config), and the path change can trigger Railway to redeploy.
- **(C) Trip a backend dependency (e.g. stop the `postgres-app` private service) to drive `/health/ready` to 503 organically.** Most realistic outage simulation. Side effect: any in-flight requests fail too, which is fine for Beta (no real users) but is a more invasive fire drill.

**Recommendation:** **A**. Cleanest. Document (B) as "if the operator cannot stop the service for organizational reasons, the path-change alternative achieves the same surface". (C) is too risky for casual fire drills; document as "advanced — only during a planned maintenance window."

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (external SaaS configuration / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm dev-agent-side AC literal text + Decision-Needed surface

- [x] 0.1 Two MapHealthChecks endpoints confirmed (`/health` + `/health/ready`); plus `/health/detail` admin-only.
- [x] 0.2 Three `.DisableRateLimiting()` chains confirmed at lines 394 + 399 + 420 (per E14-S4 P3).
- [x] 0.3 Public host placeholder `https://api.<beta-host>/...` confirmed in docs/14 §5.1 (per E13-S2 close).
- [x] 0.4 DEC-1/DEC-2/DEC-3 resolved via A41 autonomous-mode escape per A43 (a)/(b)/(c) template — see Debug Log References.
- [x] 0.5 Spike outcome documented in Dev Agent Record.

### Task 1: Add regression tests for AC-1 / AC-2 / AC-3 (backend `/health/ready` properties)

- [x] 1.1 Created [`backend/tests/IabConnect.Api.Tests/HealthChecks/HealthReadyEndpointTests.cs`](../../backend/tests/IabConnect.Api.Tests/HealthChecks/HealthReadyEndpointTests.cs).
- [x] 1.2 `HealthReady_IsRegistered_AndIsRateLimitExempt_AC1_AC2` — passing. Multi-line regex asserts the entire chain.
- [x] 1.3 `HealthReady_HasNoAuthorizationRequirement_AC1` — passing.
- [x] 1.4 `HealthReady_ResponseWriter_PropagatesHealthReportStatus_AC3` — passing. Walks brace-balanced method body.
- [x] 1.5 `HealthReady_PathReferencesParity_AC10` — passing. Asserts Sections 9 + 23 + 27 all reference the canonical `/health/ready` literal string (A31 doc-vs-code).
- [x] 1.6 Bonus: `Docs14Section27_DocumentsRateLimitExemption_AndUnauthenticated_AC10b` — passing. Asserts Section 27 documents both rate-limit-exemption and unauthenticated contracts.

### Task 2: Document the monitoring runbook in docs/14 Section 27 (A38 doc-bundle)

- [x] 2.1 Section 27 inserted between Section 26 (E17-S2) and Appendix.
- [x] 2.2 Section 27 contents authored:
    - **27.1 Goal and rationale (per ADR-017).** Two paragraphs: (a) external monitoring is independent of Railway's own monitoring, so a Railway-wide outage is still detected; (b) the polling target is `/health/ready` because it covers DB + Keycloak readiness, the two dependencies an `api` instance needs to do useful work.
    - **27.2 Service-choice comparison table (per DEC-1=C).** Columns: *Service*, *Free-tier polling cadence*, *Monitor cap (free)*, *Alert channels (free)*, *Account-creation friction*, *Best-fit profile*. Rows: UptimeRobot Free (5-min, 50 monitors, email/SMS limited, email-only account, "longevity + simplest setup"); BetterStack Free (3-min, 10 monitors, email/Slack/PagerDuty/webhook, email-only account, "more channels + status page included"); Uptime Kuma self-hosted (configurable, unlimited, all integrations, requires hosting setup, "OSS-only fork operators or full-sovereignty"). Footnote that free tiers change; cite each provider's current pricing page (link with `[!] verify against current pricing` per A40).
    - **27.3 Polling cadence + alert rule (per DEC-2=A).** State the rule explicitly: polling interval = 5 minutes (UptimeRobot Free; 3 minutes if using BetterStack Free); alert rule = 3 consecutive failures. Compute the detection-latency floor: `3 × interval` = 15 minutes (UptimeRobot) / 9 minutes (BetterStack), plus the polling-phase offset of 0..interval. Document this as the **Beta SLO floor for monitor-detected outages: ~15-20 minutes (UptimeRobot Free) / ~9-12 minutes (BetterStack Free)**. Note that an operator who needs tighter detection can either upgrade UptimeRobot to Pro 1-min polling ($7-12/mo) or self-host Uptime Kuma with 30-second polling (no SaaS cost; infrastructure cost = one tiny VPS).
    - **27.4 Step-by-step runbook (per DEC-1=C, both services).**
      - **27.4.A UptimeRobot Free setup.** 7-step UI walkthrough: (1) sign up at `https://uptimerobot.com/signUp`; (2) verify email (one-time); (3) Dashboard → "+ Add New Monitor"; (4) Monitor Type = `HTTP(s)`; (5) Friendly Name = `iabconnect-beta-api-health-ready`; (6) URL = `https://api.<beta-host>/health/ready` (substitute the actual Railway-assigned host from docs/14 §5.1); (7) Monitoring Interval = `5 minutes`; (8) Alert Contacts To Notify = operator's email contact (create the contact first if needed); (9) Save. Confirm monitor shows `Up` within ~5 minutes. **`[!] verify against UptimeRobot UI at run-time` per A40** because UI specifics may shift; the underlying API endpoint shape is `POST https://api.uptimerobot.com/v2/newMonitor` with body params `api_key=<MAIN_KEY>&friendly_name=<NAME>&url=<URL>&type=1&interval=300` per the UptimeRobot API docs.
      - **27.4.B BetterStack Free setup.** 6-step UI walkthrough: (1) sign up at `https://betterstack.com/uptime`; (2) verify email; (3) Monitors → Create monitor; (4) URL = `https://api.<beta-host>/health/ready`; (5) Check frequency = `Every 3 minutes`; (6) Notification preferences = email-only (no PagerDuty/Slack/etc. for the Beta default); (7) Save. **`[!] verify against BetterStack UI at run-time` per A40**.
      - **27.4.C Uptime Kuma self-hosted setup (optional, for full-sovereignty operators).** Reference link to [uptime.kuma docker-compose snippet](https://github.com/louislam/uptime-kuma#%EF%B8%8F-installation); leave the actual setup as operator-instruction-only (out of E17 scope for this iteration).
    - **27.5 Alert email format.** What the operator can expect to receive: subject line shape, body content shape, recovery email shape. (Both services email-content patterns documented based on current docs; flagged `[!] verify against actual received emails` because email-template changes are not in the audit surface.)
    - **27.6 Monitor dashboard reference (AC-8 placeholder).** A line: "Monitor dashboard URL: ___ (operator fills in during walkthrough)." A note that the dashboard link should be added to RUNBOOK-beta.md (or whatever operator-facing artifact E18 produces).
    - **27.7 Failure tree.**
      - (a) Monitor shows `Up` but operator reports the site is down → check monitor URL matches `https://api.<beta-host>/health/ready` exactly (no trailing slash mismatch, no http vs https confusion); confirm `/health/ready` returns 200 from the operator's own `curl`; if both pass, the monitor is healthy but the user-visible surface (e.g. frontend) is the actual outage location — add a separate monitor for `https://web.<beta-host>/api/health`.
      - (b) Monitor shows `Down` but operator confirms the site is up → check the monitor's IP-source list (UptimeRobot publishes its probe IPs; Railway's edge proxy may have temporarily blocked one); check the regional probe location (UptimeRobot Free uses multiple probe locations; one timing out is normal but should not trip the alert until 3 consecutive). If alert fires despite real uptime: check the Railway healthcheck timeout (`api` is 60s per docs/14 §9.1); 503-on-cold-start in the first 30s after a deploy can trip the monitor if it lands in that window.
      - (c) Alert email not received but dashboard shows `Down` → operator's email-contact verification incomplete; recheck the verification email link from initial setup. Also check the operator's spam folder for `noreply@uptimerobot.com` / `notifications@betterstackhq.com`.
      - (d) Both monitors disagree (UptimeRobot says `Up`, BetterStack says `Down` or vice versa) → likely a regional probe-network issue or a transient Railway edge issue; check the per-probe-location timings in each monitor's incident view; if both agree the site was unavailable from at least 2 probe locations for ≥3 consecutive polls, treat as a real outage.
    - **27.8 Fire drill (per DEC-3=A; matches AC-9).** Step-by-step: (1) Note current time `T0`; (2) Railway dashboard → `api` service → Settings → Stop; (3) wait for the configured detection latency from §27.3 plus a 5-minute buffer (UptimeRobot Free: ~20 min; BetterStack Free: ~15 min); (4) confirm: alert email received in operator inbox AND monitor dashboard shows `Down` AND incident-start time matches T0 + first-probe-after-T0; (5) Railway dashboard → `api` service → Settings → Start; (6) wait ≤1 polling cycle for the monitor to flip back to `Up`; (7) confirm recovery email received; (8) record total alert latency in walkthrough notes; (9) if latency exceeds the §27.3 documented floor by more than 50%, capture probe-location details for follow-up.
    - **27.9 Live-deploy verification (deferred per A47).** Six `[!]` items: UptimeRobot account created; UptimeRobot monitor configured; UptimeRobot alert email verified; BetterStack account created (if DEC-1=C delivered); BetterStack monitor configured; BetterStack alert email verified. Followed by fire-drill `[!]` items: §27.8 steps 2-9 executed; alert latency recorded; dashboard screenshot captured into RUNBOOK-beta.md (when E18 makes it available).
- [x] 2.3 A42 reread-as-a-stranger pass complete: (a) goal stated before service-specifics ✓; (b) DEC-1=C comparison table has clear pick paths (3 rows: UptimeRobot / BetterStack / Kuma) ✓; (c) DEC-2 latency math shown explicitly (best-case + worst-case per service) ✓; (d) all `[!] verify against current docs/UI` markers placed per A40 (UptimeRobot UI + UptimeRobot API + BetterStack UI + BetterStack API + free-tier pricing) ✓; (e) fire-drill steps reach a confirmable end-state (T0 → Stop → wait → confirm Down → Start → wait → confirm Up → record latency) ✓; (f) A45 binary reachability: `curl` (operator-provided) + `browser` + Railway dashboard + SaaS UIs all flagged ✓; (g) no sprint-tracking commentary leaked into Section 27 ✓.

### Task 3: Add A31 doc-vs-code invariant test (AC-10)

- [x] 3.1 + 3.2 + 3.3 + 3.4 `HealthReady_PathReferencesParity_AC10` — passing. Reads docs/14 Sections 9, 23, 27 + reads DependencyInjection.cs; asserts the canonical `/health/ready` literal string appears in all four surfaces. A31 doc-vs-code invariant: edit any side, test fails.

### Task 4: Run the full test suite + Quality-Gates closing

- [x] 4.1 `dotnet build` — 0 warnings, 0 errors.
- [x] 4.2 Full backend test suite: **2075 passed / 0 failed** (Application 1442 + Api 219 + Infrastructure 414). Baseline was 2070 after E17-S2; +5 new from E17-S4.
- [x] 4.3 Targeted filter: 5 passed / 0 failed (all in `HealthReadyEndpointTests`).
- [x] 4.4 AC-Subitem Completion Check per A29 — see Quality-Gates Closing table below.
- [x] 4.5 A42 reread pass on Section 27 — clean (see 2.3).
- [x] 4.6 Status flipped to `review`.

## Dev Notes

### Why `/health/ready` is the right polling target (not `/health`)

The repo registers three healthcheck endpoints at [DependencyInjection.cs:394-420](../../backend/src/IabConnect.Api/DependencyInjection.cs):

| Path | What it covers | Auth | Rate-limit exempt |
|---|---|---|---|
| `/health` | All registered checks (no tag predicate) | No | Yes |
| `/health/ready` | Checks tagged `ready` (DB + Keycloak) | No | Yes |
| `/health/detail` | All checks with per-check details | **`RequireAdmin`** | Yes |

External polling must use `/health/ready` because: (a) it filters to the dependencies that determine whether the `api` instance can do useful work — DB + Keycloak; (b) it's unauthenticated (an external monitor cannot present a Keycloak JWT); (c) `/health/detail` returns 503 on any unhealthy dependency too but requires an admin JWT — unusable from an external monitor; (d) Railway's own healthcheck also uses `/health/ready` per [docs/14 §9.1](../../docs/14_beta_railway_setup.md#9-health-probes) — using the same path for external monitoring keeps the contract consistent.

### A47 escape pattern — applied uniformly per Epic-16 precedent

This story's six dev-agent ACs (AC-1 through AC-5 + AC-10) cover everything the dev-agent can verify in-process. The four walkthrough ACs (AC-6, AC-7, AC-8, AC-9) require: a real UptimeRobot account, a real email inbox, a live Beta deploy with a public hostname, the ability to stop/start the Railway service. None of these are dev-agent-reachable from a sandbox. The A47 escape (Epic-16 retro 2026-06-02) covers this case explicitly: when the user has pre-declared the deferral via standing language like "es handelt sich nicht mehr um ein mvp" + the story file pre-acknowledges the walkthrough gate, the dev-agent flips the live-walkthrough ACs from `covered` to `deferred-pending-beta-green` with a (a)/(b)/(c) Debug Log entry, surfaces a Q1..QN unified human-verify queue in Completion Notes for operator-time execution.

### A40 explicit list of `[!] verify` markers in Section 27

This story documents specifics of two external SaaS UIs the dev-agent has not exercised. Every such reference carries an explicit `[!] verify against current docs/UI before executing` marker so an operator running the walkthrough doesn't blindly trust SaaS-vendor specifics that may have drifted. The markers cover:

- UptimeRobot UI step-paths (vendor may have redesigned the dashboard).
- UptimeRobot API endpoint shape (`POST /v2/newMonitor`) — pinned at https://uptimerobot.com/api/.
- BetterStack UI step-paths.
- BetterStack API endpoint shape — pinned at https://betterstack.com/docs/uptime/api/.
- Free-tier polling cadences (vendors change tiers).
- Free-tier monitor caps (same).
- Email-template wording samples.

### A31 cross-story orthogonal-AC invariants in scope

1. **`/health/ready` path parity across code + 3 docs sections.** Section 9 (E13-S4) + Section 23 (E14-S4) + Section 27 (E17-S4) all reference `/health/ready`. AC-10 enforces. A future story that mistypes the path in any of the three locations or in `DependencyInjection.cs:395` trips AC-10.
2. **Rate-limit-exemption parity.** Section 23 documents `.DisableRateLimiting()` on healthcheck endpoints; Section 27 documents the operator-observable consequence ("monitor at 5-min cadence never trips the limiter"); AC-2 + AC-10 enforce the code-doc parity.
3. **Unauthenticated parity.** Section 27 documents that `/health/ready` is unauthenticated (a precondition for external polling); AC-1's no-`RequireAuthorization` assertion enforces.

### What this story does NOT do

- It does NOT create the UptimeRobot or BetterStack account. Operator action; queued in A47.
- It does NOT add a frontend uptime monitor (separate path `https://web.<beta-host>/api/health` per E13-S4). Documented in Section 27.7 failure tree as a recommended addition. A follow-up monitor configuration can ride the same walkthrough.
- It does NOT introduce status-page generation. BetterStack's status page is free-tier-included; if Harry wants a public-status-page URL for testers, it can be enabled in the BetterStack UI as part of AC-6. Out of explicit AC scope.
- It does NOT integrate the alert with PagerDuty / Slack / Discord. Beta default is email-only. Enriching later is one-click in either SaaS UI.
- It does NOT add an in-application metric for "uptime as observed by external monitor" (a meta-metric). Out of scope.

## Quality-Gates Closing

| AC | Evidence | Status | Notes |
|---|---|---|---|
| AC-1 | `HealthReadyEndpointTests.HealthReady_IsRegistered_AndIsRateLimitExempt_AC1_AC2` + `HealthReady_HasNoAuthorizationRequirement_AC1` | covered | Code-audit per A51 + A49; both rate-limit-exemption AND no-auth-required asserted. |
| AC-2 | `HealthReadyEndpointTests.HealthReady_IsRegistered_AndIsRateLimitExempt_AC1_AC2` | covered | `.DisableRateLimiting()` chain verified at DependencyInjection.cs:399. |
| AC-3 | `HealthReadyEndpointTests.HealthReady_ResponseWriter_PropagatesHealthReportStatus_AC3` | covered | Walks brace-balanced WriteHealthCheckResponse body; asserts JSON content-type + report.Status serialization. |
| AC-4 | docs/14 Section 27 published; A42 reread complete | covered | Section anchor `#27-external-uptime-monitoring-e17-s4`. |
| AC-5 | docs/14 Section 27.2 comparison table (3 rows: UptimeRobot / BetterStack / Kuma) | covered | DEC-1=C delivered. |
| AC-6(a) UptimeRobot account created | live walkthrough (Q1) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q1. |
| AC-6(b) UptimeRobot HTTP(s) monitor pointed at `/health/ready` | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q2. |
| AC-6(c) Polling interval = 5 min (free tier minimum) | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q2 explicitly enumerates the 5-min cadence. |
| AC-6(d) Alert contact = operator's email | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q2 explicitly enumerates the alert-contact setup. |
| AC-6(e) Alert rule = 3 consecutive failures per DEC-2=A | live walkthrough (Q2) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q2 explicitly enumerates the DEC-2=A 3-consecutive rule. (Boundary-review A7 expansion: rule must be explicitly configured + verified in walkthrough.) |
| AC-7 Alert-contact email verification handshake | live walkthrough (Q3) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q3. |
| AC-8 Monitor dashboard URL captured | live walkthrough (Q6) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q6; gated by E18 RUNBOOK-beta availability. |
| AC-9(a) Alert email received within DEC-2=A floor latency | live walkthrough (Q7) | `deferred-pending-beta-green` | Per A47 + DEC-3=A / docs/14 §27.9 Q7. (Boundary-review A6 expansion: per-sub-item enumeration.) |
| AC-9(b) UptimeRobot dashboard shows `Down` during outage | live walkthrough (Q7) | `deferred-pending-beta-green` | Per A47 / §27.8 step 4. |
| AC-9(c) Recovery email received once outage restored | live walkthrough (Q7) | `deferred-pending-beta-green` | Per A47 / §27.8 step 7. |
| AC-9(d) Total alert latency logged in walkthrough notes + compared vs §27.3 floor | live walkthrough (Q8) | `deferred-pending-beta-green` | Per A47 / docs/14 §27.9 Q8. |
| AC-10 | `HealthReadyEndpointTests.HealthReady_PathReferencesParity_AC10` + `Docs14Section27_DocumentsRateLimitExemption_AndUnauthenticated_AC10b` | covered | A31 doc-vs-code: Sections 9, 23, 27 all reference canonical `/health/ready` + Section 27 documents both rate-limit-exemption + unauthenticated contracts. |

## Tests / Evidence

- **Backend code-audit tests:** 5 NEW [Fact]s in `HealthReadyEndpointTests.cs` (AC-1, AC-2, AC-3, AC-1-auth, AC-10).
- **Doc-bundle deliverable:** docs/14 Section 27 inserted between Section 26 (E17-S2) and Appendix.
- **Live-deploy evidence:** deferred to Wave-8/9 walkthrough per A47 (AC-6 / AC-7 / AC-8 / AC-9). Alert latency captured per DEC-2=A's ~15-20 min floor.

## Dev Agent Record

### Debug Log References

**DEC-1 (canonical monitoring service) — resolved C via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** C (UptimeRobot + BetterStack + Uptime Kuma side-by-side runbook with comparison table).
- (b) **Rationale:**
    - Story recommendation: C (post-MVP OSS-fork-friendly; aligns with Harry's standing "kein MVP mehr" directive).
    - User autonomous-mode verbatim quote: "implementiere das ganze epic 17 mit den stories. höre erst auf wenn alle stories geamcht sind und führe danach das retro aus. nicht stoppen bis es durch ist. berücksichtige dabei das es sich nicht um ein mvp handelt." (2026-06-02).
    - Architectural justification: doubling Section 27.4's runbook length is manageable; fork operators benefit from being able to pick whichever service matches their account-creation constraints. Adds the AC-5 comparison table.
- (c) **Consequence chain:**
    - Section 27.2 comparison table (3 rows).
    - Section 27.4.A UptimeRobot runbook + 27.4.B BetterStack runbook + 27.4.C Uptime Kuma pointer.
    - Section 27.9 Q-list distinguishes per-service (Q1-Q3 UptimeRobot; Q4-Q5 BetterStack).

**DEC-2 (polling cadence + alert rule; reconciling SCP AC-2 vs ADR-017) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (relax AC-2 to align with ADR-017's free-tier reality; document latency floors transparently).
- (b) **Rationale:**
    - Story recommendation: A (matches free-tier reality; SCP AC-2's "2-min outage triggers alert" is mathematically incompatible with 5-min polling × 3 consecutive failures).
    - User autonomous-mode verbatim quote: same as DEC-1.
    - Architectural justification: tightening to 1-min polling requires paid UptimeRobot tier (out of OSS-friendly scope); alert-on-first-failure produces unacceptable noise; self-hosting Kuma is documented as the path for operators who need tighter detection.
- (c) **Consequence chain:**
    - AC-2 reworded: "polling 5-min (UptimeRobot Free) / 3-min (BetterStack Free); alert on 3 consecutive failures; floor latency 15-20 / 9-12 min."
    - Section 27.3 documents the latency math explicitly (best-case + worst-case per service).
    - Section 27.8 fire drill waits ≥15-20 min not 2 min.

**DEC-3 (live-fire-drill methodology for AC-9) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c) template:**
- (a) **Option chosen:** A (Railway dashboard Stop the `api` service for the detection-latency window).
- (b) **Rationale:**
    - Story recommendation: A (cleanest; no code/config changes; repeatable).
    - User autonomous-mode verbatim quote: same as DEC-1.
    - Architectural justification: Stop > Restart because restart resolves too fast for the 3-consecutive-failure rule; healthcheck-path-mutation alternative documented as fallback; postgres-stop alternative documented as advanced-only.
- (c) **Consequence chain:**
    - Section 27.8 step 2 says **Stop** (not "Restart").
    - Section 27.8 step 3 wait time matches DEC-2=A's floor (~20 min UptimeRobot Free / ~15 min BetterStack Free).
    - Alternatives documented in Section 27.8 footnote.

### Spike outcome (Task 0.5)

Confirmed `/health/ready` is mapped at DependencyInjection.cs:395-399 with Predicate=ready-tagged + `.DisableRateLimiting()` + no `.RequireAuthorization()`. Story scope = 5 code-audit regression tests + docs/14 Section 27 + [!] queue for walkthrough.

### Completion Notes List

- **What was implemented:** 5 new code-audit tests + 1 new docs/14 section (~290 lines, the largest of the 3 E17 sections because of the per-service runbook duplication per DEC-1=C).
- **Test counts:** Backend Api.Tests went from 214 → 219 (+5 new for E17-S4). Full backend suite 2070 → 2075 / 0 failed.
- **What was NOT changed:** zero production code changes. Story is verification + documentation only.

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-6.a):** UptimeRobot account created + email verified.
- **Q2 (AC-6.b):** UptimeRobot monitor created with URL `https://api.<beta-host>/health/ready` + 5-min cadence + alert contact.
- **Q3 (AC-7):** UptimeRobot alert-contact email verification handshake complete.
- **Q4 (AC-6.c — DEC-1=C):** BetterStack Uptime account created + email verified.
- **Q5 (AC-6.d — DEC-1=C):** BetterStack monitor configured at 3-min cadence + email-only alerts.
- **Q6 (AC-8):** Monitor dashboard URL pasted into docs/14 §27.6 + into RUNBOOK-beta.md (when E18 ships it).
- **Q7 (AC-9.a):** Fire drill executed per §27.8 → Railway Stop → wait 20 min → alert email received → Railway Start → recovery email received.
- **Q8 (AC-9.b):** Alert latency recorded in walkthrough notes; comparison vs §27.3 floor (UptimeRobot ~15-20 min / BetterStack ~9-12 min); if actual >50% above floor, capture probe-location details.

### File List

**NEW:**
- `backend/tests/IabConnect.Api.Tests/HealthChecks/HealthReadyEndpointTests.cs` (~175 lines, 5 [Fact] tests)

**MODIFIED:**
- `docs/14_beta_railway_setup.md` (+~290 lines: new Section 27 inserted between Section 26 and Appendix)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → in-progress → review)

### Change Log

- 2026-06-02 — E17-S4 dev-story execution: 1 NEW test file (5 new code-audit tests) + Section 27 in docs/14 + status transitions. DEC-1=C + DEC-2=A + DEC-3=A auto-resolved via A41 autonomous-mode escape; (a)/(b)/(c) Debug Log per A43. All 5 new tests green; full backend suite 2075/2075 green. AC-1..AC-5 + AC-10 covered; AC-6/7/8/9 (8 sub-items) deferred-pending-beta-green per A47 → unified walkthrough Q1-Q8.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A31** cross-story orthogonal-AC inventory (this story closes 3 invariants — see Dev Notes)
- **A34** bulk spec-refresh at epic start (applied: this is a batch with E17-S1 + E17-S2)
- **A38** doc-bundle pattern (Section 27 in docs/14)
- **A40** verify shell-command syntax for tools dev-agent doesn't exercise OR mark `[!] verify before executing` (applied: UptimeRobot + BetterStack API/UI refs)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log template
- **A42** + **A45** reread-as-a-stranger pass (six categories incl. binary reachability)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (applied to AC-6 / AC-7 / AC-8 / AC-9)
- **A49** Program.cs Serilog re-entrancy constraint (steers AC-1/AC-3 to code-audit not runtime)
- **A51** A31 invariants tested via direct artifact-read (AC-10 pattern)
- **A52** when SCP/spec AC references an endpoint pattern, verify endpoint exists at refresh time (applied: `/health/ready` confirmed at refresh)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-02)

Ultimate context engine analysis completed — comprehensive developer guide created. Dev-story execution complete; 5 new code-audit tests + docs/14 Section 27 shipped; A47 escape applied to AC-6/7/8/9 sub-items.
