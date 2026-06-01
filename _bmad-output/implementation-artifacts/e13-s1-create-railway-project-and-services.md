# Story 13.1: Create Railway project and services

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the maintainer**,
I want **a Railway project `iab-connect-beta` provisioned in Europe-West with six services (web, api, keycloak, rustfs, postgres-app, postgres-kc) wired to pull container images from GHCR with GitHub auto-deploy on the `beta` branch**,
so that **every push to `beta` produces a running, addressable end-to-end environment for testers without manual deploy steps and without forcing self-hosters to build images from source**.

**Requirement:** REQ-088 AC-3 (Beta Deployment Readiness — Railway provisioning). Epic E13 (Railway Beta Deployment), Story 1 of 4 — the **opening story** of E13 and the **first Wave-6 deliverable**. Provisioning is the foundation on which E13-S2 (env vars), E13-S3 (networking), E13-S4 (health probes + first deploy), E14 (security hardening), and E15-S3 (backup) all build.

**Upstream (HARD dependencies — this story is blocked until all four are confirmed):**
- **E20-S5 (GHCR publishing pipeline)** done — `.github/workflows/build-images.yml` lives at [.github/workflows/build-images.yml](.github/workflows/build-images.yml). The workflow must have **run at least once** on the `beta` branch and produced the three images on GHCR; without this the Railway `api`/`web`/`keycloak` services have no image to pull and the deploy phase of the Railway service will block on a 404.
- **3 GHCR images visible** at https://github.com/htos?tab=packages — `ghcr.io/htos/iabc-api:beta`, `ghcr.io/htos/iabc-web:beta`, `ghcr.io/htos/iabc-keycloak:beta`. All three packages must be flipped to **Public visibility** (Package settings → Danger Zone → Change visibility → Public). Without this, Railway's image pull fails with `unauthorized: authentication required` because Railway does not present GHCR credentials by default. This is a one-time manual GitHub UI step, called out in [.github/workflows/build-images.yml#L57-L63](.github/workflows/build-images.yml#L57-L63).
- **12 GHA repo variables configured** at Settings → Secrets and variables → Actions → Variables: `NEXT_PUBLIC_API_URL_BETA`, `NEXT_PUBLIC_API_URL_MAIN`, `NEXT_PUBLIC_KEYCLOAK_URL_BETA`, `NEXT_PUBLIC_KEYCLOAK_URL_MAIN`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`, `NEXT_PUBLIC_KEYCLOAK_ISSUER_MAIN`, `NEXT_PUBLIC_DOCUMENT_HOST_BETA`, `NEXT_PUBLIC_DOCUMENT_HOST_MAIN`, `NEXT_PUBLIC_ENV_LABEL_BETA`, `NEXT_PUBLIC_ENV_LABEL_MAIN` (see [.github/workflows/build-images.yml#L35-L55](.github/workflows/build-images.yml#L35-L55)). These bake into the `web` image and **need their final values BEFORE the first image-publish run that this story consumes**. The `_BETA` values include Railway-assigned public domains, which are themselves an output of this story → see chicken-and-egg note in **Task 0 spike** below.
- **DCO branch protection** on `beta` (optional but recommended) — Settings → Branches → `beta` → Require status checks → `DCO`. Not a hard blocker for this story; it keeps the workflow runs honest. Per [.github/workflows/build-images.yml#L62-L63](.github/workflows/build-images.yml#L62-L63).

**Downstream:**
- **E13-S2** (env vars) — uses the service names this story creates (`api`, `web`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) in the `${{<service>.<VAR>}}` reference syntax. Wave 6.
- **E13-S3** (networking) — enables Public Domain on `web`/`api`/`keycloak` and verifies that `postgres-app`/`postgres-kc`/`rustfs` do NOT have Public Domain. Wave 6.
- **E13-S4** (health probes + first deploy) — wires Railway healthcheckPath per service and runs the first end-to-end deploy. Wave 6.
- **E14** (security and secrets) — audits the Railway secret surface this story establishes.
- **E15-S3** (daily backup) — runs against the `postgres-app` service this story provisions, writing to the `rustfs` instance this story provisions.
- **E18-S1** (Beta runbook) — documents the Railway dashboard URLs, service IDs, and rollback procedure that this story makes real.

**Wave context:** Wave 6 opener. **NO source-code artifacts** — this story produces Railway infrastructure (project, services, volumes, GitHub integration) configured via Railway's dashboard or CLI. The "code" artifact is a [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) checklist file that documents the human steps so a self-hoster (or the next maintainer) can reproduce the project from scratch.

## Acceptance Criteria

1. **Railway project `iab-connect-beta` exists** in the Europe-West region, owned by the maintainer's Railway account on the Hobby plan or higher. Project visibility is set so the maintainer (and any co-maintainers added later) can deploy and inspect. Region must be Europe-West to keep latency low for the Swiss tester population and to keep data residency inside the EU/EEA — this is a soft DSGVO consideration (Art. 28 processor-agreement is the hard one, covered in Tech-Writer/E18-S1 follow-up).

2. **Six services exist in the project**:
   - **`web`** — image-deploy from `ghcr.io/htos/iabc-web:beta`.
   - **`api`** — image-deploy from `ghcr.io/htos/iabc-api:beta`.
   - **`keycloak`** — image-deploy from `ghcr.io/htos/iabc-keycloak:beta`.
   - **`rustfs`** — image-deploy from upstream `rustfs/rustfs:latest` AT FIRST PROVISION ONLY, immediately re-pinned to a specific digest (`rustfs/rustfs@sha256:<digest captured in Task 4>`) per ADR-014. The project does NOT rebuild RustFS ([infra/docker-compose.yml](infra/docker-compose.yml) confirms upstream is used as-is locally too). Digest-pinning is required, not deferred — an unexpected upstream `:latest` change must NOT silently roll into Beta.
   - **`postgres-app`** — Railway **managed Postgres** (use Railway's Postgres template, not a custom image). PostgreSQL 17 to match the local-dev version in [infra/docker-compose.yml](infra/docker-compose.yml). Owns the application schema; consumed by `api`.
   - **`postgres-kc`** — Railway **managed Postgres**, separate instance. PostgreSQL 17. Owns the Keycloak schema; consumed by `keycloak`. The two-Postgres separation is non-negotiable per ADR-012 (migration-blast-radius isolation) and verified in E15-S1.

3. **The three application services pull from GHCR with the moving `:beta` tag**:
   - Source: **Image** (not GitHub repo, not Dockerfile, not Nixpacks).
   - Image: `ghcr.io/htos/iabc-api:beta` / `ghcr.io/htos/iabc-web:beta` / `ghcr.io/htos/iabc-keycloak:beta`.
   - Auto-redeploy on image push: **Enabled** (Railway polls GHCR for new digests on the `:beta` tag and redeploys when the digest changes — this is the GitHub-driven-deploy mechanism for image-source services since Railway cannot watch `git push` directly when source is "Image").
   - Per ADR-014, rollback in Production-style operations means redeploying a specific `:sha-<commit>` immutable tag (changeable via Railway dashboard "Edit" on the service's source); for routine Beta, `:beta` is the working tag.

4. **The `rustfs` service mounts a Railway volume at `/data`** sized at **20 GB** (sized for real document storage + 30 daily encrypted Postgres dumps with headroom; Railway volume growth requires a redeploy, so over-provisioning at provision time is cheaper than re-sizing later). RustFS persists object data at `/data` per [infra/docker-compose.yml](infra/docker-compose.yml). Without the volume, every Railway redeploy of `rustfs` wipes all uploaded documents AND the daily Postgres backups (ADR-019 routes both to the same RustFS instance). The volume is the durability boundary.

5. **The `rustfs` service env vars seed an admin credential** so the application can authenticate against S3 endpoints:
   - `RUSTFS_ROOT_USER=<random>` (replaces the local-dev `rustfsadmin`).
   - `RUSTFS_ROOT_PASSWORD=<random ≥ 16 chars>`.
   - These get re-used in E13-S2 as `DocumentStorage__AccessKey` / `DocumentStorage__SecretKey` for the `api` service. Mark both as **Sealed** (Railway's encrypted-at-rest variable type).
   - **Bucket creation** (`iabconnect-documents`, `backups`) is NOT this story's scope — RustFS auto-creates them via the `RUSTFS_DEFAULT_BUCKETS` env var, OR is handled by the existing `rustfs-init` job pattern from [infra/docker-compose.yml](infra/docker-compose.yml) reinterpreted as a one-shot Railway service (out of scope, surfaced as E15-S3 prerequisite).

6. **The two Postgres services are provisioned via Railway's official Postgres template** (not a self-deployed `postgres:17` image). This gives automatic credential generation, the `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` reference variables that E13-S2 uses, and Railway-managed daily snapshots (which are NOT the same as the E15-S3 application-level backups — both run, layered). PostgreSQL major version 17 must be selected if Railway's template defaults to a different major version.

7. **The `keycloak` service receives `KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD` in this story's seed config** (real values supplied via E13-S2):
   - `KC_DB_URL=jdbc:postgresql://${{postgres-kc.RAILWAY_PRIVATE_DOMAIN}}:${{postgres-kc.PGPORT}}/${{postgres-kc.PGDATABASE}}`
   - `KC_DB_USERNAME=${{postgres-kc.PGUSER}}`
   - `KC_DB_PASSWORD=${{postgres-kc.PGPASSWORD}}` (Sealed).
   - This is necessary because [infra/keycloak/Dockerfile#L36-L37](infra/keycloak/Dockerfile#L36-L37) bakes `KC_DB=postgres` at build time, but the JDBC URL must be supplied at runtime. **Defining the names in this story (not E13-S2) is intentional**: the service won't successfully boot for the very first time without them, and Railway will get stuck in a crash loop that's hard to diagnose against an empty env-var surface. E13-S2 fleshes out the rest of the Keycloak env block (`KC_HOSTNAME`, `KC_PROXY`, `KC_HTTP_ENABLED`, etc.).

8. **GitHub auto-deploy is enabled for the three image services on every successful push to the `beta` branch**. The chain is: push → GHA `build-images.yml` builds + pushes new digest to `ghcr.io/htos/iabc-{api,web,keycloak}:beta` → Railway polls the registry → Railway pulls new digest → Railway redeploys. The trigger-push verification is in AC-9.

9. **Trigger-push verification:**
   - From the developer workstation, push an empty commit to `beta` (`git commit --allow-empty -m "verify: railway redeploy hook"` then `git push origin beta`).
   - Within 15 minutes, all three application services in Railway show a fresh deploy timestamp (visible in the Deploys tab of each service).
   - No human intervention beyond the `git push`.
   - **Note:** the application deploys may FAIL on first boot — that's expected because E13-S2/S3/S4 haven't run yet. The success criterion is only that the **redeploy was TRIGGERED**, not that the containers reach a healthy state.

10. **The setup is documented as a step-by-step checklist** at [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md). The checklist must be reproducible end-to-end by a self-hoster who has cloned the repository: project creation, service-by-service provisioning, volume creation, the `_BETA` GHA repo-variable values (the Railway-assigned `*.up.railway.app` hostnames that complete the chicken-and-egg from the **Upstream** block), and the cross-references to E13-S2/S3/S4 for the rest of the configuration surface. SPDX header on line 1: `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->`.

11. **No Railway secrets are committed to the repository**: no tokens in [backend/.env.example](backend/.env.example) or [frontend/.env.example](frontend/.env.example), no Railway CLI auth tokens in `.github/`, no Railway project/service IDs in tracked source. The Railway project ID and service IDs (which are non-secret but ops-noisy) may appear in `docs/14_beta_railway_setup.md` as documentation. Verified by `git grep -i 'railway' -- '!docs/*' '!_bmad-output/*' '!*.md' '!.github/*'` returning nothing operational.

## Tasks / Subtasks

- [ ] **Task 0 — SPIKE: confirm prerequisites + map Railway concepts to ACs** (AC-1..AC-11)
  - [ ] 0.1 Verify the 4 BLOCKING [!] preparation tasks from the sprint-status header are DONE:
    - `gh api /repos/htos/iab-connect/actions/variables --jq '.variables[].name'` returns ALL 12 `NEXT_PUBLIC_*_BETA` and `_MAIN` variable names. (Or via UI: Settings → Secrets and variables → Actions → Variables tab.)
    - `gh api /users/htos/packages?package_type=container --jq '.[] | {name, visibility}'` returns `iabc-api`, `iabc-web`, `iabc-keycloak` each with `visibility: "public"`. (Or via UI: https://github.com/htos?tab=packages.) If `htos` is an org, swap to `/orgs/htos/...`.
    - `.github/workflows/build-images.yml` has run successfully against `beta` at least once. Verify in Actions tab.
    - DCO branch protection: optional, document state.
  - [ ] 0.2 Resolve **chicken-and-egg** for `_BETA` variables: Railway domains are `<service>-<random>.up.railway.app` (assigned at service-create time) and the GHA workflow needs them BEFORE the image build that this story consumes. **Resolution order**: (a) create all six Railway services first with EMPTY env vars (this story Task 1 + Task 2); (b) Railway assigns public hostnames to web/api/keycloak; (c) Harry updates the 12 GHA repo variables with the real Railway hostnames; (d) Harry pushes an empty commit to `beta` to trigger the next image build with correct `NEXT_PUBLIC_*` bake; (e) Railway pulls the new digest and redeploys (E13-S4 then verifies the runtime contract). E13-S2 enforces the env-var values in Railway; this story enforces the service skeleton.
  - [ ] 0.3 Read [ADR-011](_bmad-output/planning-artifacts/architecture.md), [ADR-012], [ADR-013] end-to-end. Confirm the topology graphic in ADR-012 matches what this story provisions (3 public + 3 private).
  - [ ] 0.4 Inventory existing local-dev parallels by reading [infra/docker-compose.yml](infra/docker-compose.yml) — every service in Railway has a local-dev counterpart; flag any that don't (per A31 cross-story orthogonal-AC check).
  - [ ] 0.5 Spike output (one line): either `Confirmed prerequisites + Railway-concept map green → proceed` OR `Blocker found: <description> → escalate scope`.

- [ ] **Task 1 — Create Railway project** (AC-1)
  - [ ] 1.1 Sign in to https://railway.com → New Project → "Empty Project" (not template).
  - [ ] 1.2 Name: `iab-connect-beta`. Description: "Beta deployment of IAB Connect (AGPL-3.0-or-later, https://github.com/htos/iab-connect)".
  - [ ] 1.3 Region: **Europe-West** (`europe-west4` Amsterdam) → set as project default in Settings → Region.
  - [ ] 1.4 Document the project ID (visible in URL `https://railway.com/project/<UUID>`) in `docs/14_beta_railway_setup.md` — non-secret, ops-useful.

- [ ] **Task 2 — Provision the three image services (web, api, keycloak)** (AC-2, AC-3, AC-8)
  - [ ] 2.1 For each of `web`, `api`, `keycloak`: New Service → "Deploy from Image" → enter `ghcr.io/htos/iabc-{api,web,keycloak}:beta`. **Authentication: Public** (no credentials — GHCR images are public per the prerequisite).
  - [ ] 2.2 Service name (case-sensitive, used by `${{<service>.RAILWAY_*}}` references): set exactly to `web`, `api`, `keycloak`. Mistypes here break E13-S2 references silently.
  - [ ] 2.3 In each service's Settings → Deploy → enable **"Automatically deploy when new images are pushed"** to the `:beta` tag (this is the per-tag image-watch toggle; defaults to off for image-source services).
  - [ ] 2.4 Replicas: 1. Restart policy: ON_FAILURE, max 10 retries (the default).
  - [ ] 2.5 Do NOT set any env vars yet — that's E13-S2. Leaving them empty causes the first deploy to crash-loop, which is the documented expected state at this point.

- [ ] **Task 3 — Provision the two managed Postgres services** (AC-2, AC-6)
  - [ ] 3.1 New Service → "Database" → "PostgreSQL" → name `postgres-app`. Select PostgreSQL 17 if a version selector appears (Railway as of 2026-06 defaults to v17 for new instances; verify and document the actual version in `docs/14_beta_railway_setup.md`).
  - [ ] 3.2 Repeat for `postgres-kc`.
  - [ ] 3.3 In each Postgres service: Settings → Networking → confirm **NO Public TCP Proxy enabled, NO Public Domain** (Railway defaults to private-only for managed DBs; verify).
  - [ ] 3.4 Inspect the auto-generated `PGUSER`/`PGPASSWORD`/`PGDATABASE`/`PGHOST`/`PGPORT` reference variables in each Postgres service's Variables tab — they will be referenced as `${{postgres-app.PGUSER}}` etc. from `api` and `keycloak` in E13-S2.

- [ ] **Task 4 — Provision the `rustfs` service with volume** (AC-2, AC-4, AC-5)
  - [ ] 4.1 New Service → "Deploy from Image" → `rustfs/rustfs:latest` (upstream). Authentication: Public.
  - [ ] 4.2 Service name: `rustfs` (exact case).
  - [ ] 4.3 Volumes → Add Volume → name `rustfs-data`, mount path `/data`, size **20 GB**. Document the actual provisioned size in `docs/14_beta_railway_setup.md`. (Hobby plan supports up to 5 GB without metered pay; 20 GB exceeds Hobby and bills at $0.25/GB-month ≈ $5/month for the volume. If you choose to start at 5 GB on Hobby, document the constraint AND the resize plan in the runbook — re-size requires a redeploy.)
  - [ ] 4.4 **Capture the resolved digest** of `rustfs/rustfs:latest` AFTER the first successful pull (Railway dashboard → Deploys → click the deployment → image manifest shows `sha256:...`). Immediately edit the service source from `rustfs/rustfs:latest` to `rustfs/rustfs@sha256:<captured-digest>` and redeploy to confirm the digest-pinned image still works. Document the digest in `docs/14_beta_railway_setup.md`. Re-pin after any intentional RustFS upgrade.
  - [ ] 4.5 Env vars (Variables tab):
    - `RUSTFS_ROOT_USER=<paste a strong random ≥ 12 chars, alphanumeric>`
    - `RUSTFS_ROOT_PASSWORD=<paste a strong random ≥ 16 chars>` → toggle **Seal** on this one (the username is referenced openly by E13-S2; the password is the secret).
    - `RUSTFS_ADDRESS=:9000` (binds 0.0.0.0:9000).
    - `RUSTFS_CONSOLE_ADDRESS=:9001` (optional — RustFS web console; can be skipped if not exposed).
  - [ ] 4.6 Networking: ensure NO Public Domain and NO Public TCP Proxy. `rustfs` is private-only (E13-S3 enforces this).
  - [ ] 4.7 Restart policy: ON_FAILURE.

- [ ] **Task 5 — Seed the Keycloak service with the JDBC env block** (AC-7)
  - [ ] 5.1 In the `keycloak` service Variables tab, add:
    - `KC_DB_URL=jdbc:postgresql://${{postgres-kc.RAILWAY_PRIVATE_DOMAIN}}:${{postgres-kc.PGPORT}}/${{postgres-kc.PGDATABASE}}`
    - `KC_DB_USERNAME=${{postgres-kc.PGUSER}}`
    - `KC_DB_PASSWORD=${{postgres-kc.PGPASSWORD}}` (Seal toggle ON).
  - [ ] 5.2 Do NOT add `KC_HOSTNAME`, `KC_PROXY`, `KC_HTTP_ENABLED`, realm-import variable substitutions yet — that's E13-S2.

- [ ] **Task 6 — Document the setup as a reproducible checklist** (AC-10)
  - [ ] 6.1 Create [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md). SPDX header on line 1: `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->`. Structure:
    - **Prerequisites** (the 4 BLOCKING tasks from Task 0).
    - **Project creation** (Task 1).
    - **Service-by-service walkthrough** (Tasks 2/3/4/5) with screenshots optional; the text checklist is the contract.
    - **Variables to populate** (forward-reference to E13-S2; do NOT inline the full list here).
    - **Networking** (forward-reference to E13-S3).
    - **First deploy + health probes** (forward-reference to E13-S4).
    - **GHA repo-variable population**: the 12 `NEXT_PUBLIC_*` values; explicitly note that the `_BETA` URLs come from this story's Task 2 output (the `<service>-<random>.up.railway.app` Railway public hostnames assigned at service creation, captured AFTER Task 2 completes and BEFORE the next push to `beta`).
    - **Fork-replacement guidance**: how a self-hoster replaces `ghcr.io/htos/` with their own GHCR namespace in build-images.yml AND wires their own Railway project.
  - [ ] 6.2 Cross-link the file from [README.md](README.md) under a new "Beta deployment" section after the existing local-development sections. One short paragraph + link.

- [ ] **Task 7 — Trigger the first auto-deploy verification** (AC-9)
  - [ ] 7.1 From the dev workstation: `git checkout beta && git pull --rebase && git commit --allow-empty -m "verify: railway redeploy hook (E13-S1 AC-9)" && git push origin beta`.
  - [ ] 7.2 Watch the Actions tab — `Build and publish container images` workflow should trigger within ~10s and produce new `:beta` digests within ~5-10 min.
  - [ ] 7.3 Watch Railway dashboard — each of `web`/`api`/`keycloak` should show a fresh deploy timestamp within ~15 min of the workflow finishing.
  - [ ] 7.4 [!] Expected failure mode: containers crash-loop on first boot because they lack env vars (E13-S2 not yet done). Do NOT spend time debugging — that's E13-S2/S3/S4's job. Capture one screenshot of the crash logs as evidence the redeploy was TRIGGERED, attach to the Story Questions section.

- [ ] **Task 8 — Secrets-in-repo guard** (AC-11)
  - [ ] 8.1 Run `git grep -inE 'railway|RAILWAY_TOKEN' -- ':(exclude)docs/*' ':(exclude)_bmad-output/*' ':(exclude)*.md' ':(exclude).github/*'` and confirm zero hits in operational code. Document the command + output in the story Quality-Gates table.
  - [ ] 8.2 Confirm `docs/14_beta_railway_setup.md` does NOT contain real Postgres passwords, RustFS keys, or Keycloak admin credentials. Only the project ID + service IDs (non-secret operational pointers) are documented.

- [ ] **Task 9 — Cross-story orthogonal-AC verification** (per A31)
  - [ ] 9.1 **Image-naming parity**: the three image references in Railway (`ghcr.io/htos/iabc-api:beta` etc.) match byte-for-byte the names in [.github/workflows/build-images.yml#L119-L134](.github/workflows/build-images.yml#L119-L134). Grep both and diff.
  - [ ] 9.2 **Service-naming parity**: the six Railway service names (`web`, `api`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) match the `${{<service>.…}}` references that E13-S2 will use. Document the canonical list in `docs/14_beta_railway_setup.md` so renames break visibly.
  - [ ] 9.3 **Region parity**: Europe-West for the Railway project is consistent with Europe/Zurich `TZ` env var baked in [backend/Dockerfile#L39](backend/Dockerfile#L39) and the Hangfire `Europe/Zurich` reminder schedule at [backend/src/IabConnect.Api/DependencyInjection.cs#L321-L333](backend/src/IabConnect.Api/DependencyInjection.cs#L321-L333). Document the alignment.

- [ ] **Task 10 — Quality-Gates Closing Check (per A29)**
  - [ ] 10.1 Complete the Quality-Gates table at the bottom of this file with one row per AC sub-item: `covered` / `deferred` / `N/A`. Aggregate claims are NOT acceptable.

## Dev Notes

### Why this story has NO source-code changes

E13-S1 provisions **infrastructure as humanly-clicked dashboard state**, not as code. Railway has a Terraform provider (community-maintained, `terraform-provider-railway`), but adopting it for one story bloats the dependency surface and defers the actual provisioning behind a learning curve. The pattern this project follows for Beta is "human runbook, validated by reproduction" — `docs/14_beta_railway_setup.md` IS the artifact. E19 (Production prep) can revisit Terraform if maintenance burden warrants.

### The six-service topology (ADR-012)

```
                       Public Internet
                       │           │
              ┌────────┘           └──────────┐
              ▼                                 ▼
       web (Next.js)                    keycloak
       Image, port 3000                 Image, port 8080
              │                                 │
              └───────────► api ◄──────────────┘
                            (.NET, port 8080)
                            │
                ┌───────────┼────────────────────┐
                ▼           ▼                    ▼
        postgres-app   postgres-kc            rustfs
        (managed PG)   (managed PG)           (volume-backed)
```

Public services: `web`, `api`, `keycloak`. Private services: `postgres-app`, `postgres-kc`, `rustfs`. This story creates all six in their private default state; E13-S3 enables the three public domains and verifies the three private services stay private.

### Railway pricing / plan choice

- **Hobby ($5/month credit)** is enough for the bare wiring but Railway pauses services when the credit runs out — bad UX for a real deployment serving testers. Recommended starting plan: **Pro ($20/month subscription, no service-pause behavior)** so a credit overrun results in metered overage charges rather than tester-visible downtime. The dev-agent does NOT auto-upgrade; document the plan choice in `docs/14_beta_railway_setup.md` Task 1 and surface as Q2 to Harry.
- Pricing rates: $0.000463/GB-min RAM, $0.000231/vCPU-min, $0.25/GB volume-month. Six services × low traffic ≈ $10-25/month total at expected Beta load (more if Keycloak's JVM heap stays warm). Document actual first-month spend.
- Volume storage: 20 GB × $0.25 = $5/month. RustFS holds documents + 30 daily encrypted Postgres dumps.

### Why managed Postgres instead of running `postgres:17` ourselves

Railway-managed Postgres gives daily snapshots (separate from E15-S3 application-level encrypted backups), automatic credential generation that we don't have to handle, the `PGHOST`/`PGPORT`/etc. reference variables that other services can wire through `${{postgres-app.PGHOST}}` syntax, and zero maintenance. Self-deploying `postgres:17` would force us to provision a volume per Postgres + reinvent the credential-generation + reference-variable plumbing. The split-by-consumer (`postgres-app` vs `postgres-kc`) holds either way.

### RustFS digest pin: required, not deferred

ADR-014 prescribes digest-pinning for supply-chain integrity. RustFS upstream is small (single maintainer, ~250 GH stars); an unexpected `:latest` change could silently break the deploy. The provisioning flow in Task 4 deliberately uses `:latest` for the first successful pull (so we get whatever the current upstream is at provision time), captures the resolved digest from Railway's deploy log, and IMMEDIATELY re-pins the service source to `rustfs/rustfs@sha256:<digest>` before any tester traffic. Re-pinning after an intentional RustFS upgrade is a 30-second Railway edit. The captured digest is documented in `docs/14_beta_railway_setup.md` so a fork or future-Harry knows exactly what image was deployed.

### Railway reference-variable syntax (E13-S2 will use this heavily)

- `${{<service>.<VAR>}}` — references another service's environment variable. Railway resolves at deploy time.
- `<service>.RAILWAY_PRIVATE_DOMAIN` — internal hostname (`<service>.railway.internal`), reachable from within the project private network.
- `<service>.RAILWAY_PUBLIC_DOMAIN` — public hostname (`<service>-<random>.up.railway.app`), reachable from the internet IF the service has Public Domain enabled.
- `<service>.PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE` — auto-exposed by managed Postgres services.

### What "[!] expected failure" means in Task 7.4

Per project-context A30 ([Three-State Task Checkbox](docs/07_dos_donts.md)), `[!]` marks tasks the dev-agent cannot non-interactively verify. Here, the failure mode IS the expected state — first boot crashes because env vars are empty, that's not a bug. Capturing one screenshot is enough; do NOT debug or fix because that scope belongs to E13-S2/S3/S4.

### Cross-story orthogonal invariants this story establishes (per A31)

- **Service names are the project's interface to itself**: every other E13 story references `${{api.…}}`, `${{web.…}}`, etc. by these exact strings. Renaming a service post-creation forces every other story's env-var values to be rewritten.
- **GHCR image names are the project's interface to forks**: every fork starts by changing `htos` to its own org in `.github/workflows/build-images.yml` AND in the Railway image-deploy fields. Both must change in lockstep.
- **Railway public hostnames are baked into the `web` image**: the `_BETA` GHA repo variables MUST be the actual hostnames assigned by Railway in this story's Task 2 output, otherwise the frontend's NextAuth → Keycloak deep-link breaks at first browser login (the only surface that catches this is human browser smoke per A32 + E13-S4).

### LLM dev-agent guardrails

- **Do NOT** add a Railway Terraform module to the repo for this story (out of scope per "Why no source-code changes" above).
- **Do NOT** commit Railway tokens, credentials, or service IDs other than the project ID + service IDs in `docs/14_beta_railway_setup.md`.
- **Do NOT** flip any GHCR package visibility, edit GHA repo variables, or push to `beta` from automation — these are Harry-only manual actions per the prerequisite block.
- **Do NOT** scope-creep into E13-S2 (env vars), E13-S3 (networking), or E13-S4 (health probes). The bait is strong — Railway's dashboard makes it tempting to "just fill in the rest" — but each downstream story has explicit invariants that need their own AC coverage.
- **DO** verify each of the 11 ACs against the actual Railway dashboard state before flipping the story to `review`. Screenshots are optional; the `docs/14_beta_railway_setup.md` checklist IS the contract.
- **DO** record the actual public hostnames (`<service>-<random>.up.railway.app`) for `web`/`api`/`keycloak` in `docs/14_beta_railway_setup.md` so E13-S2 has them as input.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#L262-L270 (ADR-011)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L272-L303 (ADR-012)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L305-L315 (ADR-013)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L317-L327 (ADR-014)]
- [Source: _bmad-output/planning-artifacts/prd.md#L461-L472 (REQ-088)]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1355-L1381 (Epic-13 + Story E13-S1)]
- [Source: .github/workflows/build-images.yml] — upstream GHCR pipeline that this story consumes.
- [Source: infra/docker-compose.yml] — local-dev parallel of the Railway topology (E12-S4).
- [Source: backend/Dockerfile] — sets `EXPOSE 8080` and `HEALTHCHECK /health/ready` consumed by Railway.
- [Source: frontend/Dockerfile] — sets `EXPOSE 3000`, `HOSTNAME=0.0.0.0`, `HEALTHCHECK GET /`.
- [Source: infra/keycloak/Dockerfile] — bakes `KC_DB=postgres` and runs `start --optimized`; consumed in AC-7.

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` (dev-agent verified) · `deferred` (logged in deferred-work.md with reason) · `N/A` (sub-item doesn't apply to this story).

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | Railway project `iab-connect-beta` exists | | |
| 1 | Region Europe-West | | |
| 2 | Six services exist (`web`, `api`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) | | |
| 3 | `web`/`api`/`keycloak` source = Image (`ghcr.io/htos/iabc-{api,web,keycloak}:beta`) | | |
| 3 | Auto-redeploy on image push enabled per service | | |
| 2 | `rustfs` digest captured + service re-pinned to `rustfs/rustfs@sha256:<digest>` | | |
| 4 | `rustfs` volume `rustfs-data` mounted at `/data`, 20 GB | | |
| 5 | `RUSTFS_ROOT_USER` set | | |
| 5 | `RUSTFS_ROOT_PASSWORD` set + Sealed | | |
| 6 | `postgres-app` provisioned via Railway PostgreSQL template, v17 | | |
| 6 | `postgres-kc` provisioned via Railway PostgreSQL template, v17 | | |
| 7 | `KC_DB_URL` set with `${{postgres-kc.…}}` references | | |
| 7 | `KC_DB_USERNAME` set | | |
| 7 | `KC_DB_PASSWORD` set + Sealed | | |
| 8 | GitHub auto-deploy enabled on all 3 image services | | |
| 9 | Trigger-push verification — Railway redeploy fired within 15 min | | |
| 9 | [!] First-boot crash captured + expected (env vars empty until E13-S2) | | |
| 10 | `docs/14_beta_railway_setup.md` exists with SPDX header | | |
| 10 | Checklist reproduces project end-to-end | | |
| 10 | README.md cross-linked under "Beta deployment" section | | |
| 11 | `git grep` for Railway secrets returns 0 operational hits | | |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — `htos` is a user or an org?** GHCR package visibility URL differs (`/orgs/htos/packages` vs `/users/htos/packages`). Resolve in Task 0.1; if `htos` is a user account, document the actual package path.
- **Q2 — Pro plan ($20/month) or Hobby ($5 credit)?** Recommended: Pro for real deployment (Hobby pauses services on credit overrun, which is tester-visible downtime). Confirm in Task 1.
- **Q3 — Trigger-push verification: empty commit OR rerun existing workflow?** Empty commit is simpler and proves the end-to-end path; rerun-workflow proves only the GHCR-→-Railway leg. AC-9 says empty commit; confirm during Task 7.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

### Completion Notes List

### File List

- [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — NEW (the setup checklist; AC-10).
- [README.md](README.md) — EDIT (add "Beta deployment" cross-link; AC-10.2).
- No source code changes (per "Why this story has NO source-code changes" in Dev Notes).
