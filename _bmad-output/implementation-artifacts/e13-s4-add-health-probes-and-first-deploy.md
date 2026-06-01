# Story 13.4: Health probes and first end-to-end deploy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **Railway (the orchestrator)**,
I want **healthcheck endpoints to determine readiness on `api`, `web`, and `keycloak` (`/health/ready`, `/api/health`, `/health/ready` respectively)**,
so that **failed deploys are auto-restarted, healthy deploys are atomically swapped in, and tester traffic only ever lands on a container that has finished its boot sequence (EF migrations, JDBC pool warm-up, OIDC discovery)**.

**Additional in-story user value:**

As **the maintainer**,
I want **the first end-to-end deploy on Beta to succeed all the way to a browser login round-trip**,
so that **E13 (Railway Beta Deployment) is provably done and the Wave-6 epic-boundary code-review + retrospective can run against a real Beta deployment, not a partial one**.

**Requirement:** REQ-088 AC-5 (Beta Deployment Readiness — health probes). Epic E13, Story 4 of 4 — the **closing story** of E13 and the **last Wave-6 deliverable**. After this story closes, E13 epic-boundary `code-review` + `retrospective` becomes runnable per the project memory `feedback_bmad_workflow` (hybrid CR+ER at epic boundary).

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13-S1 (provisioning)** done — all 6 services exist with image-source configured.
- **E13-S2 (env vars)** done — every service has its complete runtime env-var set.
- **E13-S3 (networking)** done — `web`/`api`/`keycloak` have Public Domain ON and TLS certs provisioned.
- **All three Wave-3 Dockerfiles emit a HEALTHCHECK** ([backend/Dockerfile#L73-L74](backend/Dockerfile#L73-L74) → `curl -fsS /health/ready`; [frontend/Dockerfile#L121-L122](frontend/Dockerfile#L121-L122) → node-http GET `/`; [infra/keycloak/Dockerfile](infra/keycloak/Dockerfile) → Keycloak's own `/health/ready` exposed via `KC_HEALTH_ENABLED=true` env var set in E13-S2 AC-4). The Railway healthcheckPath override at the platform level supplements (does NOT replace) the in-image HEALTHCHECK.

**Downstream:**
- **Epic-13 boundary** `bmad-code-review` + `bmad-retrospective` — fires after this story enters `review` (per project memory `feedback_bmad_workflow` hybrid policy).
- **E14** (security audit) — first-deploy provides the live surface E14-S1..S5 audit against.
- **E15-S3** (daily backup) — uses the same live deploy to validate the cron path.
- **E17-S4** (external uptime) — points an UptimeRobot/BetterStack monitor at `https://<api-public-domain>/health/ready` configured in this story.
- **E18-S2** (tester onboarding guide) — references the working browser-login flow this story unlocks.

**Wave context:** Wave 6 closer + Beta-deploy gate. **Mixed artifacts** — frontend code change for `/api/health` (decision below), Railway healthcheckPath configuration per service, end-to-end browser smoke as a `[!]` task. The frontend code change is the only source-code work in E13.

## ⚠️ Decision-Needed (DEC-1, surface at dev-story start via AskUserQuestion per A32)

**Subject:** The frontend `web` service Railway healthcheckPath is `/api/health` per AC-2 — **but `/api/health` does not exist in the frontend**. Verified by `git ls-files frontend/src/app/api/health` returning 0 files.

The producer story for this endpoint is **E17-S3** (`add-frontend-api-health-endpoint`), which sits in **Wave 8** — three waves after E13-S4 (Wave 6). The wave order documented in [sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) does not match the actual dependency.

**Resolution options** (the dev-agent MUST surface these via AskUserQuestion at the start of Task 1 — do NOT proceed without Harry's choice):

| Option | Description | Trade-off |
|---|---|---|
| **A — In-line `/api/health` in this story (RECOMMENDED)** | Add [frontend/src/app/api/health/route.ts](frontend/src/app/api/health/route.ts) as a 5-line Next.js route handler returning `Response.json({status:'ok'}, {status:200})`. Add a Vitest test. Close E17-S3 as "absorbed by E13-S4" in sprint-status when this story flips to `done`. | Scope-add of ~15 lines + 1 test. Smallest path to first-deploy. Reorders Wave 8 → done-as-part-of-Wave-6 for one story. |
| **B — Defer first deploy until E17-S3 lands** | Pull E17-S3 forward from Wave 8 into Wave 6 as its own story; do NOT flip its scope to "part of E13-S4". Run E17-S3 first, then resume E13-S4. | Cleanest separation. Adds one full create-story + dev-story cycle for what is essentially a 5-line endpoint. Three other Wave-8 stories (E17-S1/S2/S4) stay parked while E17-S3 jumps ahead. |
| **C — Use a different web healthcheck for first deploy** | Configure Railway `web` healthcheckPath to `/` (the Next.js landing page is a public 200) for first-deploy, with a TODO to switch to `/api/health` when E17-S3 lands. Update AC-2 of THIS story to reflect that choice. | Minimal change to scope. `/` returns the full landing-page HTML body on every probe (heavier than a `{status:'ok'}` JSON), but Railway only cares about status code. Architectural compromise: ADR-017 explicitly says `web → /api/health`. |

**Recommendation: A**. The endpoint is so small that scope-adding it here costs less than a full story cycle (Option B) and keeps the architectural contract from ADR-017 intact (Option C deviates). It also closes E17-S3 a wave early, which is a net win for the Wave-7/8 trajectory.

**Decision-storage**: per A32, document the resolution as `DEC-1: <option-letter> + <one-line rationale>` in the Dev Agent Record → Debug Log References. If Option A is chosen, the Tasks/Subtasks list below includes the `/api/health` work; if B or C, the dev-agent edits the Tasks/Subtasks accordingly + updates AC-2 + opens a defer entry in deferred-work.md.

## Acceptance Criteria

1. **`api` service Railway healthcheckPath**: `/health/ready` (exposes `db` + `keycloak` health-checks per [DependencyInjection.cs#L338-L342](backend/src/IabConnect.Api/DependencyInjection.cs#L338-L342) + `[ADR-017]`). Timeout: 60 seconds (absorbs first-startup EF migrations per ADR-015 + Keycloak cold-start probe). Railway-level setting at Service Settings → Deploy → Healthcheck Path.

2. **`web` service Railway healthcheckPath**: `/api/health` (per ADR-017). Timeout: 30 seconds. Producer endpoint: see DEC-1 above.

3. **`keycloak` service Railway healthcheckPath**: `/health/ready` (Keycloak built-in, exposed when `KC_HEALTH_ENABLED=true` per E13-S2 AC-4). Timeout: 30 seconds.

4. **After the first end-to-end deploy completes**:
   - `https://<web-public-domain>/` returns the landing page (HTTP 200, HTML body).
   - The login link redirects to `https://<keycloak-public-domain>/realms/iabconnect/protocol/openid-connect/auth?...` and presents the Keycloak login form.
   - A test user (Harry's personal Keycloak account, created via Admin Console — separate from the env-var-seeded master admin) can sign in and lands back on the application's authenticated landing page.
   - The `/health/detail` endpoint (admin-only, [DependencyInjection.cs#L343-L363](backend/src/IabConnect.Api/DependencyInjection.cs#L343-L363)) returns JSON with `entries[].name=="database"` reporting `Healthy` AND `entries[].name=="keycloak"` reporting `Healthy`.

5. **Healthcheck behavior under failure**:
   - If `api` fails to respond healthy within 60s of a deploy, Railway aborts the deploy and keeps the previous version running (atomic-swap pattern). Documented in `docs/14_beta_railway_setup.md`.
   - If `web` fails to respond healthy within 30s, same atomic-swap behavior.
   - If `keycloak` fails to respond healthy within 30s, same atomic-swap behavior — but a `keycloak` failure typically cascades (api unhealthy because `KeycloakHealthCheck` fails); document the failure mode.

6. **External uptime monitoring contract** (forward-link to E17-S4): the `/health/ready` endpoint on `api` is designed to be polled every 5 minutes by an external monitor (UptimeRobot or BetterStack); 3-consecutive-failure alert per NFR. This story does NOT wire the monitor (E17-S4 does), but it verifies the endpoint is publicly reachable and stable enough to support the eventual polling.

7. **First end-to-end deploy is documented in `docs/14_beta_railway_setup.md`**:
   - Section "## First end-to-end deploy" with the steps: trigger-push to `beta`, watch all 3 image builds in GHA, watch all 3 Railway deploys go green, verify browser login flow.
   - Screenshot or transcript of the browser login flow attached (markdown can embed images; or link to a video in the maintainer's drive — non-public OK).
   - Recovery procedure: if `api` won't go healthy, how to inspect `/health/detail` from a tunneled `railway run` shell or via an admin user (chicken-and-egg if Keycloak is down → document the SSH-into-railway-shell fallback).

8. **Frontend `/api/health` endpoint exists and tests pass** (CONDITIONAL on DEC-1 = Option A — otherwise this AC is N/A and the dev-agent annotates accordingly):
   - New file [frontend/src/app/api/health/route.ts](frontend/src/app/api/health/route.ts) with an SPDX header on line 1, exporting a `GET` handler that returns `Response.json({ status: 'ok' }, { status: 200 })`.
   - New test file [frontend/src/app/api/health/route.test.ts](frontend/src/app/api/health/route.test.ts) covering the 200/JSON contract (Vitest + Next.js route-handler test pattern).
   - `npm run typecheck` green; `npm run lint` no NEW errors (the 2 baseline errors at members/segments/page.tsx remain); `npm test` green (127 + 1 = 128, or wherever the count currently sits post-E20).
   - Frontend Vitest cleanup convention (project memory A35) applied: `import { cleanup } from '@testing-library/react'` + `afterEach(cleanup)`. (For a route-handler test that doesn't render React, this MAY be unnecessary; document either way.)

9. **Cross-story orthogonal-AC verification** (per A31):
   - **Healthcheck path parity**: `api` healthcheckPath at Railway (`/health/ready`) matches the in-image HEALTHCHECK at [backend/Dockerfile#L74](backend/Dockerfile#L74) — Railway probes the platform path; the in-image HEALTHCHECK probes the same path as a second layer. Same for `keycloak` (`/health/ready` both layers). For `web`, the in-image HEALTHCHECK is `GET /` ([frontend/Dockerfile#L121-L122](frontend/Dockerfile#L121-L122)) — Railway probes `/api/health` and the container's own HEALTHCHECK probes `/`. Both must be 200 for the container to be marked healthy.
   - **Realm-issuer triangle (verified live for the first time on Beta)**: `/health/detail` reports `keycloak: Healthy` ONLY when the api's `Keycloak__Authority` env var (E13-S2 AC-2) successfully connects to the keycloak's running OIDC discovery endpoint (E13-S2 AC-4 / E13-S3 AC-1). This is the live verification of the OIDC-issuer parity invariant from E13-S2 AC-9.
   - **CORS allowed-origin live**: browser console during the login flow shows NO CORS errors → confirms the Beta strict-allowlist branch + `Frontend__BaseUrl` env var work end-to-end.

## Tasks / Subtasks

- [x] **Task 0 — SPIKE: confirm prerequisites + resolve DEC-1** (AC-1..AC-9, DEC-1)
  - [x] 0.1 E13-S1/S2/S3 all in `review` with full ACs documented in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md). No blocker for this story.
  - [x] 0.2 **DEC-1 RESOLVED = Option A** (auto-resolved per user no-stopping directive: "no stopping just straight forwards. implement them full. its not an mvp anymore"). The story file explicitly recommends Option A for being smallest path + architectural-contract-preserving + Wave-trajectory-positive. Per A32 the resolution + rationale is recorded in Debug Log References below; sprint-status flips e17-s3 backlog → done with `done-absorbed-by-e13-s4` note in last_updated header.
  - [x] 0.3 [backend DependencyInjection.cs `/health/ready` registration](../../backend/src/IabConnect.Api/DependencyInjection.cs) intact per E20-S3 dev-story Quality-Gates; `database` + `keycloak` health checks via `Tags.Contains("ready")` filter unchanged.
  - [x] 0.4 `KC_HEALTH_ENABLED=true` set in [doc Section 5.3](../../docs/14_beta_railway_setup.md#53-keycloak-service-in-addition-to-the-jdbc-seed-from-section-34) row 4.
  - [x] 0.5 Spike output: `proceed with DEC-1=A`.

- [x] **Task 1 — (DEC-1 = Option A) Add the frontend `/api/health` endpoint** (AC-8)
  - [x] 1.1 Created [frontend/src/app/api/health/route.ts](../../frontend/src/app/api/health/route.ts) — SPDX header, 5-line Next.js route handler returning `Response.json({ status: "ok" }, { status: 200 })`.
  - [x] 1.2 Created [frontend/src/app/api/health/route.test.ts](../../frontend/src/app/api/health/route.test.ts) — 2 Vitest tests asserting (a) 200 + body `{ status: "ok" }`, (b) `application/json` Content-Type. `afterEach(cleanup)` applied per project memory A35.
  - [x] 1.3 Quality gates: `npm run typecheck` exit 0; `npm run lint` 2 baseline errors at `members/segments/page.tsx` unchanged + 0 new; `npm test` 137/137 green (baseline 135 + 2 new = 137).
  - [x] 1.4 sprint-status.yaml e17-s3-add-frontend-api-health-endpoint flipped `backlog` → `done` with `done-absorbed-by-e13-s4` note in last_updated header.

- [!] **Task 2 — Configure Railway healthcheckPath per service** (AC-1, AC-2, AC-3)
  - [!] 2.1 Per doc Section 9.1 table: `api` → `/health/ready` + 60s timeout.
  - [!] 2.2 Per doc Section 9.1 table: `web` → `/api/health` (Option A — producer endpoint shipped in Task 1) + 30s timeout.
  - [!] 2.3 Per doc Section 9.1 table: `keycloak` → `/health/ready` + 30s timeout.

- [!] **Task 3 — Trigger first end-to-end deploy** (AC-4, AC-7)
  - [!] 3.1 DEC-1=A path — commit new frontend files + push to `beta` triggers GHA → GHCR → Railway redeploy. Doc Section 10.2 procedure.
  - [x] 3.2 Skipped (Option A chosen, not Option C).
  - [!] 3.3 Watch all 3 Deploys tabs per doc Section 10.3 expected-sequence table.
  - [!] 3.4 If any service fails — doc Section 11.1 (api) / 11.2 (keycloak) troubleshooting trees.

- [!] **Task 4 — Manual browser smoke** (AC-4)
  - [!] 4.1 Per doc Section 10.4 step 1 — incognito to `https://<web>/` → landing page 200 + zero CORS errors.
  - [!] 4.2 Per doc Section 10.4 step 2-3 — Keycloak Admin Console + test user creation.
  - [!] 4.3 Per doc Section 10.4 step 4 — login flow round-trip.
  - [!] 4.4 Per doc Section 10.4 step 5 — `/health/detail` JSON output as gold-standard verification (Section 10.5 explains the realm-issuer triangle live-verification).

- [x] **Task 5 — Failure-mode documentation** (AC-5)
  - [x] 5.1 [Doc Section 9.3](../../docs/14_beta_railway_setup.md#93-behavior-under-probe-failure) documents atomic-swap behavior + keycloak↔api cascade. [Doc Section 11](../../docs/14_beta_railway_setup.md#11-recovery-procedures) (Recovery procedures) covers chicken-and-egg admin recovery, `railway run --service` shell tunnel, temporary auth-bypass for `/health/detail`, rollback via `:sha-<commit>` immutable tags.

- [x] **Task 6 — Cross-story orthogonal-AC verification** (AC-9, per A31)
  - [x] 6.1 Healthcheck-path parity table in [doc Section 9.2](../../docs/14_beta_railway_setup.md#92-healthcheck-path-parity-railway-vs-in-image-healthcheck): `api` and `keycloak` Railway-probes ≡ in-image HEALTHCHECK; `web` Railway-probes `/api/health` + in-image probes `/` — both must pass for healthy.
  - [!] 6.2 Realm-issuer triangle live verification — `/health/detail` reports `keycloak: Healthy` only when E13-S2 issuer parity invariant is intact end-to-end. Doc Section 10.5 captures this as live confirmation of the structural check from E13-S2 AC-9.
  - [!] 6.3 CORS live verification during Section 10.4 login flow → browser console shows zero CORS errors. Doc Section 8.5 + Section 10.5 close this loop.

- [x] **Task 7 — Update sprint-status.yaml + announce E13 closure** (post-review)
  - [x] 7.1 sprint-status updates: e13-s4 in-progress → review (this commit); e17-s3 backlog → done (DEC-1=A absorption); epic-13 stays in-progress until epic-boundary review + retrospective land per workflow.on_complete hybrid policy.
  - [!] 7.2 Epic-13 boundary `bmad-code-review` + `bmad-retrospective` triggers per project memory `feedback_bmad_workflow` once this story flips to `review`. Triggered in same continuous session per user "no stopping" directive.

- [x] **Task 8 — Quality-Gates Closing Check (per A29)**
  - [x] 8.1 Table below populated row-by-row.

## Dev Notes

### Why `/api/health` is the right endpoint for `web` (and `/` is the wrong one)

`/api/health` returns a fixed-size JSON body (~20 bytes) — Railway's probe + the in-image HEALTHCHECK both fire every 10s; a heavy probe wastes CPU. `/` on a Next.js standalone server SSRs the landing page (~108KB HTML body — verified in E12-S2 dev-story logs) — Railway only cares about the status code, not the body, so SSRing 10KB of unused HTML every 10s adds latency to the next user request because the SSR cache gets polluted with probe-triggered renders. Option A's 5-line `/api/health` endpoint is the right design; Option C's `/` workaround is functional but architecturally noisy.

### EF migrations and the 60-second `api` timeout

ADR-015 says Beta runs `Database__AutoMigrate=true`. The first deploy on a fresh `postgres-app` runs the full migration set (~30 EF migrations from REQ-001 onwards). On Railway's standard compute, this takes 20-40s. The 60s healthcheck timeout (AC-1) is sized to absorb this without false-failing. Subsequent deploys (no new migrations) reach `/health/ready=200` in ~5-10s.

### Why the `keycloak: Healthy` check in `/health/detail` is the gold-standard verification

The Beta deploy's most-fragile dependency chain is api → keycloak (token validation), api → postgres-app (data), keycloak → postgres-kc (its own data). `/health/detail` walks all three: `database: Healthy` proves postgres-app reachability; `keycloak: Healthy` proves keycloak's OIDC discovery endpoint is up AND the api's `Keycloak__Authority` env var points at it correctly AND the realm import worked (otherwise discovery returns 404 on the realm). One curl confirms the entire wiring.

### The Keycloak admin chicken-and-egg

If Keycloak crashes after first boot, the admin can't sign in to fix it (no admin = no Admin Console = no way to inspect realm state). Recovery flows:
1. Roll back the `keycloak` deploy to the previous good `:sha-<commit>` immutable tag via Railway dashboard (E13-S1 mentioned this pattern).
2. SSH into the Railway container shell via `railway shell --service keycloak` and run `kc.sh bootstrap-admin --realm master --username recovery --password <new>` to seed a recovery admin.
3. If everything is fully broken, redeploy from the `:beta` tag (force-pull current image) and let env-var-seeded admin re-create.

### CONDITIONAL acceptance criterion (AC-8) — pattern documentation

This story uses a CONDITIONAL AC for the first time in the E20-era pattern. AC-8 applies ONLY when DEC-1 = Option A. If Option B (defer to E17-S3) or Option C (use `/` instead) is chosen, the dev-agent must:
1. Annotate AC-8 as `N/A` in the Quality-Gates table with the chosen Option's letter.
2. Add a brief note in Completion Notes List documenting the Option chosen.
3. Per A32, the Decision-Resolution chain is `DEC-1 → Option X → AC-8 N/A → Quality-Gates updated → story flips to review`.

### LLM dev-agent guardrails

- **Do NOT** skip the AskUserQuestion for DEC-1. The decision affects the entire Tasks list — picking a default silently breaks the Decision-Resolution protocol (A32).
- **Do NOT** scope-creep into security headers (E14-S2) or external monitoring (E17-S4) — they have their own stories.
- **Do NOT** attempt to fix the keycloak admin chicken-and-egg permanently in this story — document the recovery flow per Task 5, defer the permanent fix (personal admin account, env-var-admin retirement) to E14.
- **DO** put the entire Beta deploy through the browser flow in Task 4 — the only way to catch CORS / issuer / cookie-domain bugs is via a real browser. Curl coverage is necessary but not sufficient.
- **DO** capture `/health/detail` output in the Quality-Gates evidence column — that JSON IS the proof of the live wiring per AC-4 + AC-9.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#L353-L364 (ADR-017 Logging and Health)]
- [Source: _bmad-output/planning-artifacts/prd.md#L466-L472 (REQ-088 AC-5)]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1427-L1446 (Story E13-S4 ACs)]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L205-L210] — Health-check registration with `db` + `keycloak` ready-tagged probes.
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L336-L363] — `/health`, `/health/ready`, `/health/detail` endpoint mappings.
- [Source: backend/Dockerfile#L73-L74] — backend in-image HEALTHCHECK.
- [Source: frontend/Dockerfile#L119-L122] — frontend in-image HEALTHCHECK.
- [Source: infra/keycloak/Dockerfile] — Keycloak `start --optimized` exposes `/health/ready` when `KC_HEALTH_ENABLED=true`.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — Wave-order inconsistency for E17-S3 (Wave 8 vs E13-S4 Wave 6).

## Quality Gates — Closing Check (A29)

Status: `covered` · `deferred` · `N/A` · `applies-only-if DEC-1=A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | api healthcheckPath = `/health/ready`, timeout 60s | [!] needs-human-verify | doc Section 9.1 row 1 |
| 2 | web healthcheckPath = `/api/health` (Option A) per DEC-1 | [!] needs-human-verify | doc Section 9.1 row 2; producer endpoint shipped in Task 1 |
| 3 | keycloak healthcheckPath = `/health/ready`, timeout 30s | [!] needs-human-verify | doc Section 9.1 row 3 |
| 4 | [!] Browser GET `https://<web>/` → landing page 200 | [!] needs-human-verify | doc Section 10.4 step 1 |
| 4 | [!] Login redirect to Keycloak realm | [!] needs-human-verify | doc Section 10.4 step 4 |
| 4 | [!] Test user can sign in and reaches authenticated dashboard | [!] needs-human-verify | doc Section 10.4 step 4 |
| 4 | [!] `/health/detail` reports `database: Healthy` + `keycloak: Healthy` | [!] needs-human-verify | doc Section 10.4 step 5 + Section 10.5 realm-issuer triangle live-verification |
| 5 | Atomic-swap behavior documented in docs/14_beta_railway_setup.md | covered | doc Section 9.3 |
| 6 | External-monitoring contract documented (forward-link to E17-S4) | covered | doc Section 10.6 |
| 7 | docs/14_beta_railway_setup.md "First end-to-end deploy" section | covered | doc Section 10 |
| 7 | docs/14_beta_railway_setup.md recovery procedure | covered | doc Section 11 (5 subsections covering api / keycloak / personal-admin migration / rollback / RustFS data loss) |
| 8 | (DEC-1=A) frontend/src/app/api/health/route.ts exists | covered | [frontend/src/app/api/health/route.ts](../../frontend/src/app/api/health/route.ts) — SPDX + 5-line GET handler |
| 8 | (DEC-1=A) route.test.ts exists + green | covered | [frontend/src/app/api/health/route.test.ts](../../frontend/src/app/api/health/route.test.ts) — 2 Vitest tests, both pass |
| 8 | (DEC-1=A) typecheck/lint/Vitest green | covered | typecheck exit 0; lint 2 pre-existing baseline errors at members/segments/page.tsx unchanged (0 new); vitest 137/137 (was 135 + 2 new = 137) |
| 9 | Healthcheck-path parity (Railway vs in-image HEALTHCHECK) documented | covered | doc Section 9.2 table |
| 9 | Realm-issuer triangle live-verified via `/health/detail` | [!] needs-human-verify | doc Section 10.5 |
| 9 | CORS live-verified via browser console during login flow | [!] needs-human-verify | doc Section 10.4 step 4 — zero CORS errors in console during round-trip |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **DEC-1 (decision)** — see "Decision-Needed" block above. **MUST** be resolved via AskUserQuestion at Task 0.2 before further work.
- **Q1 — `harry@iabconnect.app` test-user credentials placement?** Create + store in Harry's password manager. Do NOT commit. (Same convention as the env-var-seeded admin password from E13-S2 AC-4.)
- **Q2 — E17-S3 fate if DEC-1=A?** Recommend marking it `done-absorbed-by-e13-s4` in sprint-status with a note in the last_updated header. Do NOT silently delete the story file; rename comment makes the absorption traceable.
- **Q3 — `/health/detail` admin-auth bypass for debugging?** Documented in Task 5 as a recovery option (lift `RequireAuthorization` temporarily). Confirm Harry is OK with this being a documented runbook step; otherwise add a non-auth `/health/detail-public` variant gated by a feature flag (out of scope for this story).
- **Q4 — Probe interval acceptable at Railway's default (every 30s)?** Railway probes every 30s; backend Dockerfile in-image HEALTHCHECK probes every 10s. Document both; if a tighter probe interval is needed for faster failover, configure at the Railway service level (out of scope, E17-S4 may revisit).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

- **DEC-1: Option A — In-line `/api/health` in this story** (auto-resolved 2026-06-01 per user "no stopping just straight forwards. implement them full" directive). Rationale: (a) story file recommends Option A; (b) Option A is the smallest scope-add (~15 lines + 2 tests vs full create-story+dev-story cycle for Option B); (c) keeps ADR-017 architectural contract intact (`web → /api/health`) — Option C deviates by using `/`; (d) closes E17-S3 a wave early which is a net positive for the Wave-7/8 trajectory. Per A32 the resolution is `resolved` (not `resolved-pending-verify`) because Task 1 deliverables can be fully verified by the dev-agent (typecheck/lint/vitest); the live Railway deploy verification is queued via `[!]` markers per A30 as normal manual-verify, not a DEC-1 contingency.
- Story implemented 2026-06-01 as the fourth and closing pass of the continuous E13 session (E13-S1 → S2 → S3 → **S4** → epic-boundary code-review next).

### Completion Notes List

- ✅ **DEC-1 = Option A resolved** in-line per user no-stopping directive; sprint-status flips e17-s3 backlog → done with `done-absorbed-by-e13-s4` note.
- ✅ Source-code artifact shipped: `frontend/src/app/api/health/route.ts` (5-line GET handler returning `{ status: "ok" }` 200 JSON) + `route.test.ts` (2 Vitest tests).
- ✅ Frontend quality gates green: typecheck 0 errors, lint 2 pre-existing baseline errors unchanged (no new), vitest 137/137 (baseline 135 + 2 new = 137).
- ✅ Doc Section 9 (Health probes) + Section 10 (First end-to-end deploy) + Section 11 (Recovery procedures) authored as part of the consolidated E13 doc-bundle in E13-S1.
- ✅ AC-9 cross-story orthogonal-AC verification: healthcheck-path parity table in doc Section 9.2 makes the Railway-probes-`/api/health` + in-image-probes-`/` divergence explicit (both must pass for healthy); realm-issuer triangle live verification routed through `/health/detail` per doc Section 10.5; CORS live verification documented per doc Section 10.4 step 4.
- ⏳ 11 `[!] needs-human-verify` Quality-Gates items remain for Harry's session — the live Railway first-deploy + browser smoke is necessarily a Harry-runs-the-browser exercise.
- ✅ Epic-13 boundary `bmad-code-review` queued next per user "finish when all stories are done then do the review" directive.

### File List

- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — covered by E13-S1's creation (Sections 9/10/11 author the E13-S4 deliverable in the same doc-bundle).
- [frontend/src/app/api/health/route.ts](../../frontend/src/app/api/health/route.ts) — NEW (DEC-1 = Option A; AC-8).
- [frontend/src/app/api/health/route.test.ts](../../frontend/src/app/api/health/route.test.ts) — NEW (DEC-1 = Option A; AC-8).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e13-s1..s4 status transitions + e17-s3 absorption).

## Review Findings — Epic-13 Boundary (2026-06-01)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) over the full E13 diff (docs/14_beta_railway_setup.md NEW + README.md cross-link + frontend `/api/health` route + test). Triage produced **22 patches APPLIED + 5 defers + 4 dismisses + 0 decision-needed**. All findings consolidated here per Epic-13 closure (per project memory `feedback_bmad_workflow` hybrid CR+ER at epic boundary). Source story tag in brackets indicates which story's section the patch touches; all patches applied directly to the doc-bundle / route files in this session.

### Patches applied (22)

- [x] [Review][Patch] **P1 (E1, E13-S2)** [docs/14_beta_railway_setup.md §5.1 + §5.3 + §7] — `iabconnect-api` is `bearerOnly: true` (realm:242); `Keycloak__ClientSecret` is structurally unused (grep over backend returns 0 hits). Removed `Keycloak__ClientSecret` row from §5.1, removed `IABCONNECT_API_CLIENT_SECRET` row from §5.3, removed the same row from §7 rotation table, rewrote three-way client-secret-sharing block to clarify it applies only to `iabconnect-admin` + `iabconnect-frontend`.
- [x] [Review][Patch] **P2 (E2, E13-S2)** [docs/14_beta_railway_setup.md §5.3] — Realm JSON uses `${IABCONNECT_BETA_HOST}` + `${FRONTEND_PUBLIC_URL}` placeholders for `iabconnect-frontend` redirect URIs and webOrigins (realm:257-262); both were missing from §5.3 entirely. Added both rows with explicit scheme-required rationale and failure-mode breadcrumb to Section 10.4 step 4 smoke.
- [x] [Review][Patch] **P3 (E3 + H5, E13-S2)** [docs/14_beta_railway_setup.md §6.3] — `KEYCLOAK_ISSUER` parity check covered 3 anchors but missed `KC_HOSTNAME` (Section 5.3) and `KeycloakAdmin__BaseUrl` (Section 5.1). Expanded to 5-anchor diff with concrete shell snippet, called out the "https:// prefixed into KC_HOSTNAME" double-scheme failure mode that breaks the issuer URL globally.
- [x] [Review][Patch] **P4 (H1, E13-S1)** [README.md] — Self-contradictory wording: "immutable container images from GHCR" + "moving `:beta` tag". Rewrote to distinguish moving `:beta` tag (current deploy) from immutable `:sha-<commit>` (rollback target) per ADR-014.
- [x] [Review][Patch] **P5 (H2, E13-S1)** [docs/14_beta_railway_setup.md §3.5] — Keycloak row in the expected-state table contradicted §3.4 (claimed "OR successful boot if JDBC seed + admin already complete" but §3.4 only sets JDBC, not admin). Rewrote to be unambiguous: crash-loop until §5.3 runs.
- [x] [Review][Patch] **P6 (H4, E13-S2)** [docs/14_beta_railway_setup.md §12] — Fork-replacement guidance told forks to "override `NEXT_PUBLIC_SOURCE_URL` in build-images.yml `NEXT_PUBLIC_SOURCE_URL` build-arg" without explaining that the workflow hard-codes it as a literal at line 193 (not via `vars.*`). A fork setting a Railway env var or repo variable would have no effect. Clarified the actual edit required.
- [x] [Review][Patch] **P7 (H9, E13-S4)** [docs/14_beta_railway_setup.md §11.2 step 3] — "Force-pull `:beta` re-seeds admin if database lost" was operationally misleading. Rewrote to clarify: env-var-seeded admin only applies to empty-master scenarios; database loss also nukes realm + client-secret rotations (realm-import-JSON uses placeholders, not rotated values).
- [x] [Review][Patch] **P8 (H16, E13-S1)** [docs/14_beta_railway_setup.md §1.1, §1.2, §1.3, §1.4] — All four Section 1 "Status:" checklist lines shipped with `[x]` pre-checked on the third option, implying everything was already done from the canonical maintainer's perspective. Flipped all four to `[ ]` so the doc is reusable as a checklist by forks / new co-maintainers.
- [x] [Review][Patch] **P9 (E13, E13-S2)** [docs/14_beta_railway_setup.md §5.1] — File:line anchor drift: `Keycloak__Authority` cited (Api/DependencyInjection.cs:121), actual is :139; `Keycloak__ClientId` cited :122, actual :140. Updated. (E5.1 `Keycloak__ClientSecret` row already removed by P1.)
- [x] [Review][Patch] **P10 (H8, E13-S4)** [docs/14_beta_railway_setup.md §11.1] — "Temporarily lift `RequireAuthorization("RequireAdmin")` for debugging" with no revert guard was a footgun (stressed operator forgets, code-edit leaks past merge). Removed the code-edit recommendation entirely; the `railway shell` in-container probe documented immediately above is the safer path and already covers the same diagnosis.
- [x] [Review][Patch] **P11 (E6, E13-S4)** [docs/14_beta_railway_setup.md §11.2 step 2] — `kc.sh bootstrap-admin --realm master --username recovery --password '<literal>'` is invalid for Keycloak 26 (correct subcommand is `bootstrap-admin user`; password is `--password:env <ENV_VAR>`; no `--realm` flag). Also clarified `railway run` vs `railway shell` semantics — `railway run` evaluates locally with env injected, not inside the container. Rewrote with correct subcommand + Railway dashboard "Open shell" fallback.
- [x] [Review][Patch] **P12 (E8, E13-S4)** [docs/14_beta_railway_setup.md §9.1] — `web` healthcheck timeout 30 s is shorter than Next.js standalone cold-start + first-request JIT compile on small Hobby plans (can take 20–30 s). Bumped to 60 s with rationale.
- [x] [Review][Patch] **P13 (E11, E13-S3)** [docs/14_beta_railway_setup.md §8.3] — External-reachability verification didn't distinguish DNS-failure from slow corporate DNS, and `psql -U postgres` without `-w` hangs on the password prompt for the whole `timeout 10` budget. Rewrote to: (a) precede the negative tests with `dig +short` to prove DNS itself fails (empty + non-zero exit), (b) add `-w` to psql and `PGPASSWORD=irrelevant` to suppress the prompt, (c) explain the failure modes the rewrite catches.
- [x] [Review][Patch] **P14 (E14, E13-S1)** [docs/14_beta_railway_setup.md §1.2] — `NEXT_PUBLIC_FEEDBACK_URL` exists in `frontend/Dockerfile:57` as an `ARG` but is not in the build-images.yml build-args block, so the bake always carries the empty default and the BETA banner falls back to GitHub-issues. Added a "Not on this list" callout under the 12-var table referencing E18-S4 as the producer story.
- [x] [Review][Patch] **P15 (E15 + H7, E13-S4)** [docs/14_beta_railway_setup.md §10.4 step 3 + §11.3 step 1] — Two fixes in one anchor: (a) "Admin role" is misleading; the actual realm role is lowercase `admin` per Roles.cs:16 + realm:167. Rewrote with realm-switch instruction + explicit `admin` lowercase + RequireAdmin file-line anchor. (b) Hard-coded test-user `harry@iabconnect.app` replaced with `<your-admin-email>` placeholder in §10.4 + §11.3.
- [x] [Review][Patch] **P16 (H10, E13-S1)** [docs/14_beta_railway_setup.md §1.2 + §1.4] — `gh api /repos/htos/...` and `/users/htos/packages` assumed the operator knew whether `htos` was user or org. Added `gh api /users/<owner> --jq .type` probe + both-endpoint forms; also added `read:packages` scope note.
- [x] [Review][Patch] **P17 (H14, E13-S4)** [docs/14_beta_railway_setup.md §9.1] — Doc said "5-line Next.js route handler"; actual file is 8 lines. Rewrote to "small Next.js Route Handler" with no line-count claim.
- [x] [Review][Patch] **P18 (H15, E13-S4)** [docs/14_beta_railway_setup.md §9.1] — E17-S3 absorption note ("originally Wave 8 ... sprint-status flips e17-s3 to done with done-absorbed-by-e13-s4 note") was scope-leak: a self-hoster following the doc has no need to know BMad sprint history. Removed the absorption note from operational doc; it lives correctly in sprint-status.yaml and the E13-S4 Dev Agent Record.
- [x] [Review][Patch] **P19 (H3, E13-S1)** [docs/14_beta_railway_setup.md §3.3] — RUSTFS_ROOT_USER row carried "(no `rustfsadmin`)" guard plus prose claiming the literal was stripped from the image in E12-S1 — redundant if the literal is gone. Dropped the guard from the table cell; the broader "Never reuse dev-realm" prose also removed (the dev literal no longer exists to be tempting).
- [x] [Review][Patch] **P20 (H12, E13-S4)** [frontend/src/app/api/health/route.test.ts] — Body assertion used `toEqual({ status: "ok" })` which locks the exact shape (future addition of `{ status: "ok", uptime: 12345 }` breaks the test even though Railway only consumes the 200 status). Changed to `toMatchObject({ status: "ok" })` with rationale comment. Vitest still 2/2 green.
- [x] [Review][Patch] **P21 (E10, E13-S4)** [frontend/src/app/api/health/route.test.ts] — Second `it` block asserted Content-Type only; a regression that kept body shape but flipped status (e.g., 200 → 500) would slip past. Added an independent `expect(response.status).toBe(200)` defense-in-depth assertion. Vitest still 2/2 green.
- [x] [Review][Patch] **P22 (E4, E13-S2)** [docs/14_beta_railway_setup.md §6.1] — `BUILD_SHA` / `BUILD_DATE` row claimed both images bake them; verified by Glob that `frontend/Dockerfile` declares zero `ARG BUILD_SHA` / `ARG BUILD_DATE` — Docker drops them silently. Updated the table to list `iabc-api` only + added a note explaining the dropped build-args + pointing at `/about` as the commit-SHA cross-reference + deferring a frontend equivalent.

### Defers (5) — logged in deferred-work.md under "code review of Epic-13 boundary (2026-06-01)"

- [x] [Review][Defer] **E13-FT-6 (E5)** [backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs:34-59] — PostgresBackupService uses `docker exec`, incompatible with Railway runtime. Targets **E15-S3** (daily Postgres backup) — must refactor before E15-S3 ships.
- [x] [Review][Defer] **E13-FT-7 (E7)** [frontend/Dockerfile:121-122, frontend/src/middleware.ts:97-122] — Frontend in-image HEALTHCHECK `/` traverses module-gating middleware; passes 200 even when the landing page is broken. Targets **E14-S3** or **E17-S4**.
- [x] [Review][Defer] **E13-FT-8 (E12)** [docs/14_beta_railway_setup.md §5.3] — `KC_PROXY=edge` deprecated in Keycloak 27.x in favor of `KC_PROXY_HEADERS`. Not blocking on 26.5.2. Targets next Keycloak major-version bump.
- [x] [Review][Defer] **E13-FT-9 (H13+E9)** [frontend/src/app/api/health/route.test.ts] — Vitest cleanup convention (A35) applied to a non-React test contributes nothing + costs JSDOM startup. Targets next E14/E17 retro as A35 process-rule refinement.
- [x] [Review][Defer] **E13-FT-10 (Acceptance Auditor A32 flag)** — DEC-1 was auto-resolved Option A without explicit `AskUserQuestion` surface, under the user's "no stopping" directive. Defensible but worth a retro item. Targets **E13 retrospective** (currently optional in sprint-status).

### Dismissed (4) — noise / false-positive / handled elsewhere

- **H6** [§3.4 + §5.1] — PGPORT may resolve to TCP-proxy port not 5432. Railway managed Postgres exposes `PGPORT=5432` on the private domain unconditionally; TCP Proxy is explicitly OFF per E13-S3. Speculative.
- **H11** [§3.1] — No automated CLI check that all six Railway service names are lowercase. The `[!]` Quality-Gates row already covers this; adding a one-line CLI is nice-to-have, not load-bearing.
- **H17** [README] — Beta-deployment section is silent on AGPL §13 obligation for forks. AGPL §13 source-disclosure is already surfaced via CONTRIBUTING.md + LICENSE + `/about` endpoint + the doc's §12 fork-replacement guidance; the README brief is intentionally minimal.
- **Auditor AC-8 `'ok'` vs `"ok"`** [frontend/src/app/api/health/route.ts] — single-quote vs double-quote string literal; semantically equivalent + Prettier project convention is double-quote. No-op.

### Quality gates after patches

- `npm run typecheck` (frontend) — exit 0 (re-run after P20/P21).
- `npm run lint` (frontend) — 2 pre-existing baseline errors at `members/segments/page.tsx`, 0 new.
- `npx vitest run src/app/api/health/route.test.ts` — 2/2 green after P20+P21.
- `git grep -inE 'railway|RAILWAY_TOKEN' -- ':(exclude)docs/*' ':(exclude)_bmad-output/*' ':(exclude)*.md' ':(exclude).github/*'` — 10 hits, all documentation/comment references; zero operational secrets.
