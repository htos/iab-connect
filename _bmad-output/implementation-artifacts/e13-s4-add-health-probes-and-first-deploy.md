# Story 13.4: Health probes and first end-to-end deploy

Status: ready-for-dev

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

- [ ] **Task 0 — SPIKE: confirm prerequisites + resolve DEC-1** (AC-1..AC-9, DEC-1)
  - [ ] 0.1 Verify E13-S1, E13-S2, E13-S3 are all `done` or at minimum `review` with all ACs satisfied. If any are short, this story is blocked.
  - [ ] 0.2 **Resolve DEC-1**: surface the 3 options to Harry via AskUserQuestion. Document the choice + rationale in Dev Agent Record → Debug Log References as `DEC-1: <option> — <rationale>`. If Option B or C, adjust the Tasks/Subtasks list below before proceeding.
  - [ ] 0.3 Verify the [DependencyInjection.cs#L336-L342](backend/src/IabConnect.Api/DependencyInjection.cs#L336-L342) `/health/ready` registration is intact (it must include both `database` and `keycloak` health checks via `Tags.Contains("ready")` filter).
  - [ ] 0.4 Verify `KC_HEALTH_ENABLED=true` is set on the `keycloak` service per E13-S2 AC-4.
  - [ ] 0.5 Spike output (one line): `proceed with DEC-1=<choice>` OR `escalate: <blocker>`.

- [ ] **Task 1 — (CONDITIONAL on DEC-1 = Option A) Add the frontend `/api/health` endpoint** (AC-8)
  - [ ] 1.1 Create [frontend/src/app/api/health/route.ts](frontend/src/app/api/health/route.ts):
    ```typescript
    // SPDX-License-Identifier: AGPL-3.0-or-later
    // E13-S4 AC-2: Railway healthcheckPath for the `web` service. Returns a lightweight
    // 200 JSON so Railway's edge proxy can determine readiness without rendering the
    // full landing-page HTML.
    export function GET() {
      return Response.json({ status: 'ok' }, { status: 200 });
    }
    ```
  - [ ] 1.2 Create [frontend/src/app/api/health/route.test.ts](frontend/src/app/api/health/route.test.ts) with one Vitest test that imports `GET` and asserts the response body shape + 200 status. Apply `afterEach(cleanup)` per A35 even though no React render is involved (defense-in-depth + convention parity with other test files).
  - [ ] 1.3 Run `npm run typecheck && npm run lint && npm test` from `frontend/`. Expect 0 new typecheck errors, 2 baseline lint errors unchanged, +1 Vitest test.
  - [ ] 1.4 Update sprint-status.yaml to flip e17-s3-add-frontend-api-health-endpoint from `backlog` to `done-absorbed-by-e13-s4` (or similar) — document the decision so a future agent doesn't try to ship E17-S3 separately. (Out-of-band action; the dev-agent surfaces the recommendation but doesn't auto-edit sprint-status — that's the workflow's job at story close.)

- [ ] **Task 2 — Configure Railway healthcheckPath per service** (AC-1, AC-2, AC-3)
  - [ ] 2.1 In `api` service Settings → Deploy: Healthcheck Path = `/health/ready`, Healthcheck Timeout = 60 seconds. Save.
  - [ ] 2.2 In `web` service Settings → Deploy: Healthcheck Path = `/api/health` (Option A) OR `/` (Option C) per DEC-1, Healthcheck Timeout = 30 seconds. Save.
  - [ ] 2.3 In `keycloak` service Settings → Deploy: Healthcheck Path = `/health/ready`, Healthcheck Timeout = 30 seconds. Save.

- [ ] **Task 3 — Trigger first end-to-end deploy** (AC-4, AC-7)
  - [ ] 3.1 If DEC-1 = Option A, commit the new frontend files + push to `beta` — this triggers GHA → GHCR → Railway pipeline.
  - [ ] 3.2 If DEC-1 = Option C, do NOT need a new commit (config-only change in Task 2); trigger a manual redeploy of `web` from Railway dashboard to pick up the healthcheckPath change.
  - [ ] 3.3 Watch all 3 Railway service Deploys tabs simultaneously. Expected sequence:
    - `api`: pulls new digest → boot → EF migrations execute (visible in logs) → `/health/ready=200` within ~60s → marked healthy.
    - `keycloak`: pulls new digest (or restarts to pick up env vars) → JDBC connect → realm import → `/health/ready=200` within ~30s → marked healthy.
    - `web`: pulls new digest → Node boot → `/api/health=200` within ~10s → marked healthy.
  - [ ] 3.4 [!] If any service fails to go healthy, capture the deploy log + investigate. Common causes: env-var typo (E13-S2 Task 1.3 re-verify), CORS string mismatch (E13-S2 Task 4.3 re-verify), Keycloak admin password drift (Task 0.4).

- [ ] **Task 4 — Manual browser smoke** (AC-4)
  - [ ] 4.1 [!] Harry: open `https://<web-public-domain>/` in incognito browser. Expect the landing page (no CORS errors in console).
  - [ ] 4.2 [!] Harry: in Keycloak Admin Console (`https://<keycloak-public-domain>/admin/` — login as the env-var-seeded `admin` from E13-S2 AC-4), create a test user `harry@iabconnect.app` with password and the `Admin` role. (NOTE: this is the user that gets used for app login; it's separate from the master-realm admin.)
  - [ ] 4.3 [!] Harry: click "Login" on the web landing page → redirected to Keycloak → enter test-user credentials → redirected back to web. Expect to land on the authenticated dashboard.
  - [ ] 4.4 [!] Harry: navigate to `https://<api-public-domain>/health/detail` while signed in (or via Postman with the bearer token). Expect HTTP 200 with `entries` array including `database: Healthy` + `keycloak: Healthy`. If 401, the bearer token isn't being forwarded; if 503, one of the health checks is failing — drill into the entries.

- [ ] **Task 5 — Failure-mode documentation** (AC-5)
  - [ ] 5.1 In `docs/14_beta_railway_setup.md`, append "## Health probes" section documenting:
    - Each service's healthcheckPath + timeout (the AC-1/2/3 values).
    - The atomic-swap behavior on probe failure (deploy aborts; previous version stays live).
    - The keycloak-↔-api cascade (keycloak down → api `/health/ready` returns 503 even if Postgres is fine → Railway marks api unhealthy → cascade).
    - The recovery flow when `/health/detail` cannot be reached (chicken-and-egg if Keycloak admin login is needed but Keycloak is down): `railway run --service api curl http://localhost:8080/health/detail` from a Railway CLI shell bypasses auth-required because it hits the container directly; OR temporarily lift the `RequireAuthorization("RequireAdmin")` on `/health/detail` for debugging (with a TODO to revert).

- [ ] **Task 6 — Cross-story orthogonal-AC verification** (AC-9, per A31)
  - [ ] 6.1 Healthcheck-path parity: diff each service's Railway healthcheckPath against the in-image HEALTHCHECK path. Document where they differ (web — Railway probes `/api/health`, image probes `/`) and why both must succeed for healthy.
  - [ ] 6.2 Realm-issuer triangle: confirm `/health/detail` reports `keycloak: Healthy` after Task 4 → this is the END-TO-END verification of E13-S2 AC-9 issuer parity (was structural before; now live).
  - [ ] 6.3 CORS live: open browser dev-tools Console during Task 4.3 login flow → confirm zero CORS errors → live confirmation of E13-S3 AC-5 + E13-S2 AC-2 `Frontend__BaseUrl` correctness.

- [ ] **Task 7 — Update sprint-status.yaml + announce E13 closure** (post-review)
  - [ ] 7.1 At story-close (after this file flips to `review`), the closing agent updates sprint-status.yaml: e13-s4 review → done, epic-13 in-progress → done, and (if DEC-1 = Option A) e17-s3 backlog → `done-absorbed-by-e13-s4` (or just `done` with a note in the last_updated header).
  - [ ] 7.2 Per project memory `feedback_bmad_workflow`, Epic-13 boundary now triggers `bmad-code-review` (adversarial review of E13-S1..S4 deltas) + `bmad-retrospective`.

- [ ] **Task 8 — Quality-Gates Closing Check (per A29)**
  - [ ] 8.1 Complete the Quality-Gates table at the bottom with one row per AC sub-item.

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
| 1 | api healthcheckPath = `/health/ready`, timeout 60s | | |
| 2 | web healthcheckPath = `/api/health` (Option A) OR `/` (Option C) per DEC-1 | | |
| 3 | keycloak healthcheckPath = `/health/ready`, timeout 30s | | |
| 4 | [!] Browser GET `https://<web>/` → landing page 200 | | |
| 4 | [!] Login redirect to Keycloak realm | | |
| 4 | [!] Test user can sign in and reaches authenticated dashboard | | |
| 4 | [!] `/health/detail` reports `database: Healthy` + `keycloak: Healthy` | | |
| 5 | Atomic-swap behavior documented in docs/14_beta_railway_setup.md | | |
| 6 | External-monitoring contract documented (forward-link to E17-S4) | | |
| 7 | docs/14_beta_railway_setup.md "First end-to-end deploy" section | | |
| 7 | docs/14_beta_railway_setup.md recovery procedure | | |
| 8 | (applies-only-if DEC-1=A) frontend/src/app/api/health/route.ts exists | | |
| 8 | (applies-only-if DEC-1=A) route.test.ts exists + green | | |
| 8 | (applies-only-if DEC-1=A) typecheck/lint/Vitest green | | |
| 9 | Healthcheck-path parity (Railway vs in-image HEALTHCHECK) documented | | |
| 9 | Realm-issuer triangle live-verified via `/health/detail` | | |
| 9 | CORS live-verified via browser console during login flow | | |

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

(Reserve DEC-1 resolution line: `DEC-1: <Option-letter> — <rationale>`.)

### Completion Notes List

### File List

- [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — EDIT (append "## First end-to-end deploy" + "## Health probes" sections; AC-5, AC-7).
- [frontend/src/app/api/health/route.ts](frontend/src/app/api/health/route.ts) — NEW (CONDITIONAL on DEC-1 = Option A; AC-8).
- [frontend/src/app/api/health/route.test.ts](frontend/src/app/api/health/route.test.ts) — NEW (CONDITIONAL on DEC-1 = Option A; AC-8).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) — EDIT (e17-s3 absorption at story-close; AC dependency on DEC-1).
