# Story 13.3: Public networking and private networking enforced

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a security operator**,
I want **only the three application services (`web`, `api`, `keycloak`) reachable on a public Railway domain and the three datastore services (`postgres-app`, `postgres-kc`, `rustfs`) reachable ONLY through Railway's private network (`*.railway.internal`)**,
so that **the application databases cannot be reached from the internet, breach-via-direct-database is taken off the table, and the public attack surface is exactly the three application services covered by the application's own authn/authz**.

**Requirement:** REQ-088 AC-3 (Beta Deployment Readiness — networking topology). Epic E13 (Railway Beta Deployment), Story 3 of 4. Wave-6 middle deliverable, sandwiched between E13-S2 (env vars) and E13-S4 (health + first deploy).

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13-S1 (Railway project + 6 services)** — all six services must exist; this story toggles their networking state.
- **E13-S2 (env vars)** — `keycloak`'s `KC_HOSTNAME` and `api`'s `Frontend__BaseUrl` (set in E13-S2) reference Railway public domains; enabling the public domains in this story is a no-op for those references because Railway assigns the hostname at service creation (E13-S1), independent of whether Public Domain is toggled ON. The TOGGLE controls whether traffic from the internet is routed; the hostname exists either way. (Confirm in Task 0 spike.)

**Downstream:**
- **E13-S4 (health + first deploy)** — depends on the three application services being publicly reachable so browser smoke and external uptime probes can hit them.
- **E14-S2 (security headers and HTTPS)** — verifies Beta-environment HSTS, HTTPS redirect, security headers ARE active on the public endpoints. Beta runs the production-hardening branch per ADR-015 ([DependencyInjection.cs#L255-L258](backend/src/IabConnect.Api/DependencyInjection.cs#L255-L258), [#L279-L282](backend/src/IabConnect.Api/DependencyInjection.cs#L279-L282)).
- **E17-S4** (external uptime monitoring) — depends on `api`'s public HTTPS endpoint for /health/ready polling.

**Wave context:** Wave 6 middle, security-critical. **NO source-code artifacts** beyond updating [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — this story flips Railway dashboard toggles and verifies the resulting public/private split with concrete reachability tests from outside the Railway network.

## Acceptance Criteria

1. **The three application services have a Public Railway Domain enabled**:
   - `web` → `<web-hostname>.up.railway.app` resolves and serves HTTP 200 (or a redirect to a 200 — the Next.js standalone server returns the landing page on `/`).
   - `api` → `<api-hostname>.up.railway.app` resolves and serves HTTP 200 on `/health/ready` (when E13-S4 wires the probe; this story may catch a 503 or 401 if E13-S2 isn't fully done — that is acceptable as long as the connection establishes and TLS handshake completes).
   - `keycloak` → `<keycloak-hostname>.up.railway.app` resolves and serves HTTP 200 on `/realms/iabconnect/.well-known/openid-configuration` (Keycloak's discovery endpoint, public by realm contract).
   - All three respond on HTTPS port 443; Railway provisions and renews the TLS cert automatically (Let's Encrypt under the hood).

2. **The three datastore services have NO Public Domain AND NO TCP Proxy enabled**:
   - `postgres-app`: Public Networking → "Generate a TCP Proxy Domain" must be OFF. Dashboard Networking tab shows no public endpoint, only the private hostname `postgres-app.railway.internal`.
   - `postgres-kc`: same as above.
   - `rustfs`: same as above. RustFS is reachable ONLY at `rustfs.railway.internal:9000` from within the project private network — never from the public internet.

3. **External-reachability tests confirm the split**:
   - From a developer workstation OUTSIDE Railway (Harry's laptop is fine):
     - `psql -h <postgres-app private domain> -U postgres -p 5432` → timeout or connection-refused (the private hostname is not resolvable from outside Railway's DNS).
     - `psql -h <postgres-kc private domain> -U postgres -p 5432` → timeout or connection-refused.
     - `curl --max-time 10 http://rustfs.railway.internal:9000/` → timeout or DNS failure.
     - `curl https://<web-public-domain>/` → HTTP 200 (or redirect chain ending at 200).
     - `curl https://<api-public-domain>/health/ready` → HTTP 200 OR HTTP 503 (503 is acceptable for this AC if E13-S4 hasn't fully landed yet; the success criterion is that the connection establishes — the body shape is E13-S4's concern).
     - `curl https://<keycloak-public-domain>/realms/iabconnect/.well-known/openid-configuration` → HTTP 200 with a JSON body containing `"issuer":"https://<keycloak-public-domain>/realms/iabconnect"`.

4. **Inside the Railway project, `api` and `keycloak` resolve their datastore dependencies via `*.railway.internal`** — verified by deploy-log inspection:
   - `api` log on boot includes a successful Postgres connection line (Npgsql logs `Connection opened` against `postgres-app.railway.internal:5432` per the env var set in E13-S2).
   - `keycloak` log on boot includes `KC-SERVICES0009` ("Added user 'admin' to realm 'master'") AND `Keycloak ... started in NN.NNNs` lines, confirming JDBC against `postgres-kc.railway.internal:5432` worked.
   - `api` log on first /api/documents/... call shows S3 client targeting `http://rustfs.railway.internal:9000/...` — proves the private DocumentStorage:ServiceUrl resolves.

5. **CORS allowlist on the api is the SINGLE Railway-assigned web public domain** — verified by:
   - `Access-Control-Allow-Origin` response header on a preflight OPTIONS from `<web-public-domain>` returns the exact same web public domain (NOT `*` — that would defeat the Beta hardening); preflight from any other origin (e.g., `http://localhost:3000`) is REJECTED.
   - One curl example: `curl -i -X OPTIONS -H 'Origin: https://evil.example.com' -H 'Access-Control-Request-Method: GET' https://<api-public-domain>/api/members` → returns NO `Access-Control-Allow-Origin` header (or returns one not matching `evil.example.com`).
   - This relies on E13-S2 setting `Frontend__BaseUrl=https://<web-public-domain>` correctly. The verification fails loudly if it's wrong.

6. **HTTPS redirect is enforced on `web` and `api`** — Beta runs the production branch per ADR-015 / [DependencyInjection.cs#L279-L282](backend/src/IabConnect.Api/DependencyInjection.cs#L279-L282). Verified by:
   - `curl -i http://<web-public-domain>/` → HTTP 301/308 redirect to `https://<web-public-domain>/`. (Railway's edge may handle this before the container sees it; either path is acceptable.)
   - `curl -i http://<api-public-domain>/health/ready` → HTTP 301/308 redirect to `https://<api-public-domain>/health/ready`.

7. **HSTS header is present on HTTPS responses from `api`** — per [DependencyInjection.cs#L255-L258](backend/src/IabConnect.Api/DependencyInjection.cs#L255-L258). Verified by:
   - `curl -sI https://<api-public-domain>/health/ready | grep -i strict-transport-security` → returns a header line. The Beta env var surface should not need to override the HSTS max-age (default from `app.UseHsts()` is 30 days).

8. **No service is reachable on a private hostname from outside Railway** — the spot-checks in AC-3 establish this; document the negative test cases in `docs/14_beta_railway_setup.md` so a future operator can reproduce.

9. **Documentation update**: [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) acquires a "## Networking topology" section enumerating: each service's public/private state, the resolved public hostnames, the reachability-verification commands from AC-3/4/5/6/7, and explicit `Public:`/`Private:` labels matching the ADR-012 graphic.

10. **Cross-story orthogonal-AC verification** (per A31):
   - **Topology parity**: the 3-public + 3-private split matches the ADR-012 graphic byte-for-byte. Render the live state from the Railway dashboard and diff conceptually against the architecture text.
   - **Hostname parity**: every `${{<service>.RAILWAY_PUBLIC_DOMAIN}}` reference in `api` (Frontend__BaseUrl), `web` (NEXTAUTH_URL), `keycloak` (KC_HOSTNAME) resolves to the actual public hostname this story confirms is reachable. Drift means E13-S2 was wrong.
   - **Private-only parity**: every `${{<service>.RAILWAY_PRIVATE_DOMAIN}}` reference resolves to `<service>.railway.internal`. Confirm in deploy logs (AC-4).

## Tasks / Subtasks

- [ ] **Task 0 — SPIKE: confirm Railway networking semantics + E13-S1/S2 prerequisites** (AC-1..AC-10)
  - [ ] 0.1 Verify E13-S1 done: all 6 services exist with the names from E13-S1.
  - [ ] 0.2 Verify E13-S2 done OR at least far enough that `api` has `Frontend__BaseUrl` set + `keycloak` has `KC_HOSTNAME` set. This story can run before E13-S2 fully closes BUT the reachability checks in ACs 4/5 require E13-S2's env-var work.
  - [ ] 0.3 Read Railway's networking documentation to confirm the toggle semantics: Public Domain ON = TLS-terminating proxy routes internet traffic to the service's exposed port; Public Domain OFF = service unreachable from the internet but still reachable from sibling services via `<service>.railway.internal`. TCP Proxy is a SEPARATE toggle for non-HTTP protocols (used for raw Postgres exposure if a maintainer chose to — we explicitly choose NOT to in AC-2).
  - [ ] 0.4 Snapshot the current state of each service's Networking tab BEFORE making any changes — a "before" reference.
  - [ ] 0.5 Spike output: one line either `Confirmed semantics + prerequisites → proceed` OR `Blocker found: <description> → escalate scope`.

- [ ] **Task 1 — Enable Public Domain on `web`, `api`, `keycloak`** (AC-1)
  - [ ] 1.1 For each of `web`, `api`, `keycloak`: Settings → Networking → "Generate a Public Domain" (Railway-assigned `<service>-<random>.up.railway.app`). Confirm Railway issues a Let's Encrypt cert within ~30s. The domain becomes resolvable globally within minutes.
  - [ ] 1.2 For each, set the exposed port to match the container's `EXPOSE` directive: `web` 3000 ([frontend/Dockerfile#L117](frontend/Dockerfile#L117)), `api` 8080 ([backend/Dockerfile#L71](backend/Dockerfile#L71)), `keycloak` 8080 (Keycloak default).
  - [ ] 1.3 Verify the public hostname is visible in the service's Settings → Networking → Public Networking tab and copy-pasteable for AC-9 documentation.

- [ ] **Task 2 — Confirm `postgres-app`, `postgres-kc`, `rustfs` have NO Public Domain AND NO TCP Proxy** (AC-2)
  - [ ] 2.1 For each datastore: Settings → Networking → Public Networking. Confirm the "Generate Public Domain" toggle is OFF (Railway defaults to OFF for managed-Postgres but verify; for `rustfs` the toggle was set to OFF in E13-S1 Task 4.5 — verify it didn't drift).
  - [ ] 2.2 For each, confirm "TCP Proxy" is OFF. Railway's TCP Proxy lets you expose a non-HTTP service publicly on a high-numbered port — useful for `psql` over the public internet, but the explicit anti-AC of this story.
  - [ ] 2.3 Document the state in `docs/14_beta_railway_setup.md` Task 5.

- [ ] **Task 3 — External-reachability verification** (AC-3)
  - [ ] 3.1 [!] From the dev workstation:
    ```sh
    # PUBLIC services — should respond:
    curl -fIv https://<web-public-domain>/                                    # expect 200 (or 302 → 200)
    curl -fIv https://<api-public-domain>/health/ready                        # expect 200 or 503 — connection establishes
    curl -fIv https://<keycloak-public-domain>/realms/iabconnect/.well-known/openid-configuration  # expect 200
    
    # PRIVATE services — should be unreachable:
    timeout 10 psql -h postgres-app.railway.internal -U postgres -p 5432      # expect: timeout / DNS failure
    timeout 10 psql -h postgres-kc.railway.internal -U postgres -p 5432       # expect: timeout / DNS failure
    timeout 10 curl http://rustfs.railway.internal:9000/                      # expect: timeout / DNS failure
    ```
  - [ ] 3.2 Capture the outputs in a session log (Markdown code block); attach to AC-8 documentation.
  - [ ] 3.3 [!] (Optional but recommended) repeat from a second outside-Railway location (mobile hotspot, friend's laptop) to confirm the result isn't a coincidence of Harry's ISP.

- [ ] **Task 4 — Internal-reachability verification via deploy-log inspection** (AC-4)
  - [ ] 4.1 In Railway dashboard, redeploy `api` (Deploys → ... → Redeploy). Watch the Logs tab.
    - **Expected**: Npgsql logs a successful connection to `postgres-app.railway.internal:5432` (or the resolved Railway-injected `PGHOST` private value) within ~5s of boot.
    - If the log shows `connection refused` or `host not found`, E13-S2's `ConnectionStrings__DefaultConnection` reference is wrong OR `postgres-app` hasn't finished its own boot yet (managed PG takes ~30s on cold start). Retry once; if it persists, surface as Story Question.
  - [ ] 4.2 In Railway dashboard, redeploy `keycloak`. Watch the Logs tab.
    - **Expected**: `KC-SERVICES0009` log line + `Keycloak ... started in NN.NNNs`.
    - If `keycloak` logs `Failed to obtain JDBC connection`, the env vars from E13-S1 Task 5 + E13-S2 Task 3 are wrong; cross-check.
  - [ ] 4.3 Trigger an api-side call that touches RustFS by uploading a document (Harry, via browser, requires E13-S2 done — if not, defer this sub-step to E13-S4). Watch `api` logs.
    - **Expected**: AWS S3 client logs an HTTP request to `http://rustfs.railway.internal:9000/...`.
    - If the log shows the public Railway domain instead, `DocumentStorage__ServiceUrl` is wrong (E13-S2 Task 1).

- [ ] **Task 5 — CORS allowlist verification (Beta strict-allowlist branch)** (AC-5)
  - [ ] 5.1 [!] Sanity preflight from the canonical origin:
    ```sh
    curl -i -X OPTIONS \
      -H 'Origin: https://<web-public-domain>' \
      -H 'Access-Control-Request-Method: GET' \
      -H 'Access-Control-Request-Headers: authorization, content-type' \
      https://<api-public-domain>/api/members
    ```
    Expect a response header `Access-Control-Allow-Origin: https://<web-public-domain>` (byte-identical, not `*`).
  - [ ] 5.2 [!] Hostile preflight from a random origin:
    ```sh
    curl -i -X OPTIONS \
      -H 'Origin: https://evil.example.com' \
      -H 'Access-Control-Request-Method: GET' \
      https://<api-public-domain>/api/members
    ```
    Expect EITHER: (a) NO `Access-Control-Allow-Origin` header at all, OR (b) the header set to the configured `Frontend__BaseUrl` (Railway web public domain) — NOT to `https://evil.example.com`. Either outcome blocks the malicious browser request; only `*` or echo-back-origin would be a fail.

- [ ] **Task 6 — HTTPS-redirect + HSTS verification** (AC-6, AC-7)
  - [ ] 6.1 [!] `curl -i http://<web-public-domain>/` and `curl -i http://<api-public-domain>/health/ready` — expect 301/308 to https. (Railway's edge may handle this transparently; the result we care about is "no clear-text HTTP serving").
  - [ ] 6.2 [!] `curl -sI https://<api-public-domain>/health/ready | grep -i strict-transport-security` — expect a non-empty header. Default `app.UseHsts()` emits `Strict-Transport-Security: max-age=2592000` (30 days). **The 30-day default is the initial state, not the final state** — E14-S2 MUST bump to ≥ 6 months + `includeSubDomains` before non-Harry testers are onboarded. Tracked at deferred-work.md E13-FT-3. This story confirms the header is present (the protocol works); E14-S2 strengthens the parameters.
  - [ ] 6.3 [!] `curl -sI https://<web-public-domain>/ | grep -i strict-transport-security` — Railway's edge may apply HSTS regardless of the Next.js standalone server. Document the observed behavior.

- [ ] **Task 7 — Document the networking topology in `docs/14_beta_railway_setup.md`** (AC-9)
  - [ ] 7.1 Append "## Networking topology" section under E13-S1's existing structure. Include:
    - **Public services table**: Service | Public hostname | Exposed port | TLS source.
    - **Private services table**: Service | Private hostname | Port | Public toggle state.
    - **Verification commands** (the curl + psql commands from Task 3) with example outputs.
    - **CORS** (link to `Frontend__BaseUrl` doc in Task 6 of E13-S2).
    - **HSTS + HTTPS redirect** (link to the relevant DependencyInjection.cs anchors).
  - [ ] 7.2 Embed the ADR-012 topology diagram (or a Markdown ASCII version) so the doc is self-contained.

- [ ] **Task 8 — Cross-story orthogonal-AC verification** (AC-10, per A31)
  - [ ] 8.1 Diff the live Railway state (public ON for {web,api,keycloak}; public OFF for {postgres-app, postgres-kc, rustfs}) against the ADR-012 graphic. Document.
  - [ ] 8.2 Hostname parity: read each `${{<service>.RAILWAY_PUBLIC_DOMAIN}}` reference value (visible in the consuming service's resolved-variable view in Railway, or by inspecting the deploy log envs) and confirm it equals the actual hostname assigned in Task 1.1.
  - [ ] 8.3 Private parity: read each `${{<service>.RAILWAY_PRIVATE_DOMAIN}}` reference value and confirm it equals `<service>.railway.internal`.

- [ ] **Task 9 — Quality-Gates Closing Check (per A29)**
  - [ ] 9.1 Complete the Quality-Gates table at the bottom with one row per AC sub-item.

## Dev Notes

### Why this story is its own beast (not folded into E13-S1 or E13-S2)

Provisioning (E13-S1) is "make services exist". Env vars (E13-S2) is "make services configured". Networking (this story) is "make the security boundary correct". Folding networking into provisioning would hide the public/private decision in the noise of service creation; folding it into env vars would conflate the routing layer with the application config layer. ADR-012 treats networking as a first-class architectural decision; this story makes it a first-class verification step.

### Railway's networking model in one paragraph

Every Railway project has a private virtual network. Services on that network resolve each other via `<service>.railway.internal` DNS — short-circuit routing, no public hop, no TLS overhead. The "Public Domain" toggle attaches a Railway-managed TLS-terminating edge proxy (HTTP/HTTPS only) to a service; that proxy gets a `<service>-<random>.up.railway.app` hostname with a Let's Encrypt cert and routes inbound HTTPS:443 traffic to the service's exposed port (HTTP, on the container's port). The "TCP Proxy" toggle is a different, public, non-HTTP exposure (e.g., for raw Postgres). We use ONE public HTTP toggle on three services and NEITHER toggle on three services.

### Why Beta runs the production-hardening branch (HSTS, HTTPS-redirect, strict CORS) — ADR-015 again

ADR-015 explicitly chooses to make `IsDevelopment()`-gated hardenings Development-only, not "Beta or Production". That means Beta runs HSTS + HTTPS-redirect + strict CORS verbatim like Production would. The implication for this story: the public endpoints we expose in Task 1 are NOT "soft Beta-mode" endpoints with relaxed security; they are hardened endpoints, and the network-layer reachability tests in Tasks 3-7 are simultaneously security tests. Catching a misconfigured CORS allowlist (Task 5) or a missing HSTS header (Task 6) is in-scope here.

### What "[!] manual-verify" means for the curl tests

Per project-context A30 ([Three-State Task Checkbox](docs/07_dos_donts.md)), `[!]` marks tasks that need a human — the dev-agent CAN execute Bash curl commands, but Harry needs to verify the outputs match the expected outcomes AND confirm the source IP is genuinely outside Railway. The dev-agent isn't on Harry's home network; running curl from the dev-agent's sandbox tests a different network path than Harry's laptop would.

### Why we accept "503 on /health/ready" as PASS for AC-3 api check

This story runs BEFORE E13-S4 (health probes). The api container may not have reached a healthy state yet (E13-S2 env vars + first migrations + Keycloak boot-order). The point of the AC-3 api check is "the public endpoint is reachable" — TLS handshake completes, the proxy routes correctly. A 503 from the application means the proxy successfully routed to the container; that's the success we're measuring. The body shape and 200-on-healthy are E13-S4's concern.

### LLM dev-agent guardrails

- **Do NOT** enable a TCP Proxy on any service. Even with the Postgres user/password sealed in Railway, exposing port 5432 publicly is a defense-in-depth-loss for zero ergonomic benefit (Harry can reach postgres-app via Railway CLI tunnel for ad-hoc queries; no need for permanent public exposure).
- **Do NOT** enable Public Domain on `rustfs`, `postgres-app`, `postgres-kc`. If a future requirement needs direct public RustFS access (e.g., a CDN-fronted document download), that becomes its own story with its own threat-model review — not a side-effect of this E13-S3 work.
- **Do NOT** modify any backend or frontend code in service of this story. CORS, HSTS, HTTPS-redirect are already in [DependencyInjection.cs](backend/src/IabConnect.Api/DependencyInjection.cs) and the Next.js `output: standalone` shape — all this story does is verify they work as designed when public exposure is enabled.
- **DO** be explicit about timing in the verification (TLS cert provisioning takes ~30s after Public Domain toggle ON; Railway's first redeploy after env-var change takes ~60s). A "fail" that's actually "not yet ready" wastes investigation time.
- **DO** document the resolved public hostnames in `docs/14_beta_railway_setup.md` — they are the source of truth that downstream stories and operators consume.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#L272-L303 (ADR-012 Service Topology)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L329-L341 (ADR-015 — Beta = production-hardening branch)]
- [Source: _bmad-output/planning-artifacts/prd.md#L466-L472 (REQ-088 AC-3)]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1407-L1425 (Story E13-S3 ACs)]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L106-L132] — CORS strict-allowlist branch (Beta + Production).
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L255-L258] — HSTS in non-Dev/non-Testing environments.
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L279-L282] — HTTPS-redirect in non-Dev/non-Testing environments.
- [Source: backend/Dockerfile#L71] — backend EXPOSE 8080.
- [Source: frontend/Dockerfile#L117] — frontend EXPOSE 3000.
- [Source: infra/keycloak/Dockerfile] — Keycloak exposes 8080 (default).

## Quality Gates — Closing Check (A29)

Status: `covered` · `deferred` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | `web` Public Domain ON, exposes port 3000, TLS cert provisioned | | |
| 1 | `api` Public Domain ON, exposes port 8080, TLS cert provisioned | | |
| 1 | `keycloak` Public Domain ON, exposes port 8080, TLS cert provisioned | | |
| 2 | `postgres-app` Public Domain OFF + TCP Proxy OFF | | |
| 2 | `postgres-kc` Public Domain OFF + TCP Proxy OFF | | |
| 2 | `rustfs` Public Domain OFF + TCP Proxy OFF | | |
| 3 | [!] External reachability: 3 public hostnames respond (200 / 503-acceptable / 200) | | |
| 3 | [!] External reachability: 3 private hostnames unreachable (timeout/DNS fail) | | |
| 4 | api deploy log shows `postgres-app.railway.internal` connection success | | |
| 4 | keycloak deploy log shows `postgres-kc.railway.internal` connection success | | |
| 4 | [!] api log shows `rustfs.railway.internal:9000` outbound on first /api/documents call | | |
| 5 | [!] CORS preflight from web-public-domain origin → ACAO returned | | |
| 5 | [!] CORS preflight from evil.example.com → ACAO NOT echoed back | | |
| 6 | [!] http → https redirect on web | | |
| 6 | [!] http → https redirect on api | | |
| 7 | [!] HSTS header present on api HTTPS responses | | |
| 7 | [!] HSTS header present on web HTTPS responses (observe / document) | | |
| 8 | Negative test cases documented in docs/14_beta_railway_setup.md | | |
| 9 | docs/14_beta_railway_setup.md "Networking topology" section added | | |
| 10 | Topology parity vs ADR-012 graphic documented | | |
| 10 | Public-hostname parity across api/web/keycloak references | | |
| 10 | Private-hostname parity (3 services) | | |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Custom domain wiring deferred to deferred-work.md E13-FT-2 / E19-S1.** Confirmed at create-story (2026-06-01): Beta runs on `*.up.railway.app` for initial deploy; CNAMEs added when domain is registered. No story-level action required.
- **Q2 — HSTS max-age bump tracked at deferred-work.md E13-FT-3 / E14-S2.** Confirmed at create-story (2026-06-01): the 30-day default ships in initial deploy; bump to ≥6 months + `includeSubDomains` lands in E14-S2 before non-Harry testers are onboarded.
- **Q3 — TCP Proxy for Postgres EVER appropriate?** No — current story explicitly forbids it. Document the explicit "no" with rationale in `docs/14_beta_railway_setup.md` so a future maintainer wondering "should I enable this for ad-hoc psql?" sees the answer before clicking.
- **Q4 — Verify private-DNS behavior from inside vs outside Railway** — confirm the deploy-log evidence in AC-4 IS proof that the inside-Railway resolution works (vs running the curl from a `railway run` shell context, which is a separate verification mode). Pick one and document.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

### Completion Notes List

### File List

- [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — EDIT (append "Networking topology" section; AC-9).
- No source code changes (all work in Railway dashboard + curl reachability tests).
