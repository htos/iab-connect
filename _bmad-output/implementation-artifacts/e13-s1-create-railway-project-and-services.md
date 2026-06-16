# Story 13.1: Create Railway project and services

Status: done

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

- [x] **Task 0 — SPIKE: confirm prerequisites + map Railway concepts to ACs** (AC-1..AC-11)
  - [!] 0.1 Verify the 4 BLOCKING [!] preparation tasks — dev-agent cannot run `gh api` against the live repo from this sandbox; Harry's session note confirms the four prerequisites are complete except `_BETA` GHA-var values which carry the documented chicken-and-egg per Task 0.2. The doc Section 1 captures the exact verification gh-api commands for repeatability.
  - [x] 0.2 Chicken-and-egg resolution documented in [docs/14_beta_railway_setup.md Section 4](../../docs/14_beta_railway_setup.md#4-gha-repo-variable-population). Resolution order: (a) create six Railway services with empty env vars → (b) Railway assigns hostnames → (c) Harry updates the 12 GHA repo vars with real hostnames → (d) empty-commit push to `beta` triggers fresh image build with correct `NEXT_PUBLIC_*_BETA` bake → (e) Railway pulls new digest and redeploys (Section 4.3).
  - [x] 0.3 ADRs read; topology graphic in [docs/14_beta_railway_setup.md Section 3](../../docs/14_beta_railway_setup.md#3-service-by-service-provisioning) matches ADR-012 (3 public + 3 private). Story note about ADR-012 graphic enumerating 6 services as "five plus two managed Postgres" reconciled by treating the two managed PG as separate services everywhere in the doc.
  - [x] 0.4 Local-dev parallels inventoried — every Railway service has a local-dev counterpart in [infra/docker-compose.yml](../../infra/docker-compose.yml): web↔frontend (Option-4 overlay), api↔backend (Option-4 overlay), keycloak↔keycloak (base), rustfs↔rustfs (base), postgres-app↔postgres (base), postgres-kc↔postgres (shared with app in dev — only Beta splits them for migration-blast-radius isolation per ADR-012).
  - [x] 0.5 Spike output: `Confirmed prerequisites + Railway-concept map green → proceed`.

- [!] **Task 1 — Create Railway project** (AC-1)
  - [!] 1.1 Sign in to https://railway.com → New Project → "Empty Project" — Harry-only manual UI action; documented in doc Section 2.1.
  - [!] 1.2 Name `iab-connect-beta`; description verbatim per doc Section 2.1.
  - [!] 1.3 Region Europe-West (`europe-west4` Amsterdam) — doc Section 2.2 with rationale (Swiss latency + DSGVO + Europe/Zurich TZ parity).
  - [!] 1.4 Project ID recorded in doc Section 13.1 reference table (placeholder until Harry populates).

- [!] **Task 2 — Provision the three image services (web, api, keycloak)** (AC-2, AC-3, AC-8)
  - [!] 2.1 Per doc Section 3.1 (image-deploy services). Image refs are exactly `ghcr.io/htos/iabc-{api,web,keycloak}:beta`, byte-identical to [.github/workflows/build-images.yml#L120-L131](../../.github/workflows/build-images.yml#L120-L131).
  - [!] 2.2 Service names exactly `web`, `api`, `keycloak` (case-sensitive — Section 3.1 step 4 and Section 13.2 canonical table).
  - [!] 2.3 Auto-deploy on `:beta` image push enabled per Section 3.1 step 5.
  - [!] 2.4 Replicas 1, Restart ON_FAILURE per Section 3.1 step 6.
  - [!] 2.5 Empty env vars; first-boot crash-loop is the documented expected state until E13-S2 (Section 3.1 step 7).

- [!] **Task 3 — Provision the two managed Postgres services** (AC-2, AC-6)
  - [!] 3.1 Per doc Section 3.2.
  - [!] 3.2 Per doc Section 3.2 (both `postgres-app` and `postgres-kc`).
  - [!] 3.3 No Public TCP Proxy, no Public Domain — Section 3.2 step 4 + Section 8.2.
  - [!] 3.4 Auto-generated `PG*` reference vars confirmed available (Section 3.2 step 5).

- [!] **Task 4 — Provision the `rustfs` service with volume** (AC-2, AC-4, AC-5)
  - [!] 4.1 Per doc Section 3.3 step 1.
  - [!] 4.2 Service name `rustfs` exact case (Section 3.3 step 2).
  - [!] 4.3 Volume `rustfs-data` at `/data`, 20 GB (Section 3.3 step 3 with sizing rationale + Hobby/Pro pricing).
  - [!] 4.4 Digest pin from upstream `:latest` after first successful pull (Section 3.3 step 7 with ADR-014 rationale). Digest recorded in Section 13.2 reference table.
  - [!] 4.5 Env vars `RUSTFS_ROOT_USER` / `RUSTFS_ROOT_PASSWORD` (Sealed) / `RUSTFS_ADDRESS` / optional `RUSTFS_CONSOLE_ADDRESS` per Section 3.3 step 4.
  - [!] 4.6 No Public Domain, no Public TCP Proxy (Section 3.3 step 5, re-asserted in Section 8.2).
  - [!] 4.7 Restart ON_FAILURE (Section 3.3 step 6).

- [!] **Task 5 — Seed the Keycloak service with the JDBC env block** (AC-7)
  - [!] 5.1 Three JDBC env vars per doc Section 3.4 table (`KC_DB_URL`, `KC_DB_USERNAME`, `KC_DB_PASSWORD` Sealed). Reference syntax uses `${{postgres-kc.…}}` to inherit auto-generated PG values.
  - [!] 5.2 KC_HOSTNAME / KC_PROXY / KC_HTTP_ENABLED / realm-secret placeholders parked for E13-S2 Section 5.3.

- [x] **Task 6 — Document the setup as a reproducible checklist** (AC-10)
  - [x] 6.1 Created [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) with SPDX header on line 1 and the full structure: Prerequisites · Project creation · Service-by-service · GHA repo-variable population · Variables per service · Build-time-vs-runtime · Secret rotation · Networking topology · Health probes · First end-to-end deploy · Recovery procedures · Fork-replacement guidance · Reference tables. Doc covers E13-S1/S2/S3/S4 deliverables in one document (per E13 Wave-6 bundle).
  - [x] 6.2 README "Beta deployment" cross-link added under the existing local-development "Option 4: Local Beta-shape testing" subsection.

- [!] **Task 7 — Trigger the first auto-deploy verification** (AC-9)
  - [!] 7.1 Harry runs `git commit --allow-empty -s -m "verify: railway redeploy hook (E13-S1 AC-9)"` + `git push origin beta` after Section 4 GHA-var update — procedure documented in doc Section 4.3 + Section 10.2.
  - [!] 7.2 GHA `Build and publish container images` workflow triggers within ~10s; new `:beta` digests within ~5-10 min (doc Section 10.3).
  - [!] 7.3 Railway redeploys all three image services within ~15 min of workflow finish (doc Section 10.3).
  - [!] 7.4 Expected first-boot crash-loop captured as evidence; debugging deferred to E13-S2/S3/S4 (doc Section 3.5).

- [x] **Task 8 — Secrets-in-repo guard** (AC-11)
  - [x] 8.1 `git grep -inE 'railway|RAILWAY_TOKEN' -- ':(exclude)docs/*' ':(exclude)_bmad-output/*' ':(exclude)*.md' ':(exclude).github/*' ':(exclude)_bmad/*' ':(exclude).claude/*'` returns 10 hits — ALL are comment / documentation references in `.env.example` / `Dockerfile` / `docker-compose.full.yml`; **ZERO operational tokens** or credentials. Logged in doc Appendix.
  - [x] 8.2 `docs/14_beta_railway_setup.md` Audited — contains only variable NAMES + `${{…}}` REFERENCES + placeholder phrases like `<populate after Section 2.4>`; **zero Sealed values, zero real Postgres passwords, zero RustFS keys, zero Keycloak admin credentials**.

- [x] **Task 9 — Cross-story orthogonal-AC verification** (per A31)
  - [x] 9.1 **Image-naming parity verified**: Doc Section 3.1 step 2 uses `ghcr.io/htos/iabc-api:beta`, `ghcr.io/htos/iabc-keycloak:beta`, `ghcr.io/htos/iabc-web:beta` — byte-identical to [.github/workflows/build-images.yml#L120-L131](../../.github/workflows/build-images.yml#L120-L131) matrix entries.
  - [x] 9.2 **Service-naming parity established**: Canonical list of six service names (`web`, `api`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) documented in doc Section 13.2 reference table; consumed by E13-S2's `${{<service>.…}}` references in Section 5.
  - [x] 9.3 **Region parity documented**: Europe-West (`europe-west4` Amsterdam) consistent with `Europe/Zurich` TZ in [backend/Dockerfile#L39](../../backend/Dockerfile#L39) and the Hangfire Europe/Zurich reminder schedule. Doc Section 2.2 captures the alignment.

- [x] **Task 10 — Quality-Gates Closing Check (per A29)**
  - [x] 10.1 Quality-Gates table below populated row-by-row with `covered` / `[!] needs-human-verify` / `N/A` per A30 Three-State convention. Aggregate claims avoided.

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
| 1 | Railway project `iab-connect-beta` exists | [!] needs-human-verify | doc Section 2.1; Section 13.1 reference table |
| 1 | Region Europe-West | [!] needs-human-verify | doc Section 2.2; rationale tied to Swiss latency + DSGVO + Europe/Zurich TZ |
| 2 | Six services exist (`web`, `api`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) | [!] needs-human-verify | doc Section 3 (six subsections); Section 3.5 expected-state table; Section 13.2 canonical list |
| 3 | `web`/`api`/`keycloak` source = Image (`ghcr.io/htos/iabc-{api,web,keycloak}:beta`) | [!] needs-human-verify | doc Section 3.1 step 2; byte-identical to build-images.yml#L120-L131 |
| 3 | Auto-redeploy on image push enabled per service | [!] needs-human-verify | doc Section 3.1 step 5 |
| 2 | `rustfs` digest captured + service re-pinned to `rustfs/rustfs@sha256:<digest>` | [!] needs-human-verify | doc Section 3.3 step 7 with ADR-014 rationale; digest landed in Section 13.2 |
| 4 | `rustfs` volume `rustfs-data` mounted at `/data`, 20 GB | [!] needs-human-verify | doc Section 3.3 step 3 with sizing rationale |
| 5 | `RUSTFS_ROOT_USER` set | [!] needs-human-verify | doc Section 3.3 step 4 table |
| 5 | `RUSTFS_ROOT_PASSWORD` set + Sealed | [!] needs-human-verify | doc Section 3.3 step 4 table |
| 6 | `postgres-app` provisioned via Railway PostgreSQL template, v17 | [!] needs-human-verify | doc Section 3.2 step 3 (with version verification clause) |
| 6 | `postgres-kc` provisioned via Railway PostgreSQL template, v17 | [!] needs-human-verify | doc Section 3.2 (same procedure repeated) |
| 7 | `KC_DB_URL` set with `${{postgres-kc.…}}` references | [!] needs-human-verify | doc Section 3.4 table |
| 7 | `KC_DB_USERNAME` set | [!] needs-human-verify | doc Section 3.4 table |
| 7 | `KC_DB_PASSWORD` set + Sealed | [!] needs-human-verify | doc Section 3.4 table |
| 8 | GitHub auto-deploy enabled on all 3 image services | [!] needs-human-verify | doc Section 3.1 step 5 + Section 10.2 |
| 9 | Trigger-push verification — Railway redeploy fired within 15 min | [!] needs-human-verify | doc Section 4.3 + Section 10 |
| 9 | [!] First-boot crash captured + expected (env vars empty until E13-S2) | [!] needs-human-verify | doc Section 3.5 expected-state table |
| 10 | `docs/14_beta_railway_setup.md` exists with SPDX header | covered | docs/14_beta_railway_setup.md:1 `<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->` |
| 10 | Checklist reproduces project end-to-end | covered | 13-section doc covers Prereqs → Project → Services × 6 → GHA vars → Variables × per service → Networking → Health → First deploy → Recovery → Fork-replacement → Reference tables |
| 10 | README.md cross-linked under "Beta deployment" section | covered | README.md "#### Beta deployment (Railway)" subsection added after "Option 4" |
| 11 | `git grep` for Railway secrets returns 0 operational hits | covered | doc Appendix — 10 hits all in comments / .env.example / Dockerfile, ZERO operational tokens |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — `htos` is a user or an org?** GHCR package visibility URL differs (`/orgs/htos/packages` vs `/users/htos/packages`). Resolve in Task 0.1; if `htos` is a user account, document the actual package path.
- **Q2 — Pro plan ($20/month) or Hobby ($5 credit)?** Recommended: Pro for real deployment (Hobby pauses services on credit overrun, which is tester-visible downtime). Confirm in Task 1.
- **Q3 — Trigger-push verification: empty commit OR rerun existing workflow?** Empty commit is simpler and proves the end-to-end path; rerun-workflow proves only the GHCR-→-Railway leg. AC-9 says empty commit; confirm during Task 7.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

- Story implemented 2026-06-01 in a continuous E13 session (E13-S1 → E13-S2 → E13-S3 → E13-S4 → epic-boundary code-review) per user directive "no stopping between stories, implement them full".
- User confirmed the 4 BLOCKING [!] preparation tasks (DCO branch protection, 12 GHA repo vars populated, first GHCR publish green, GHCR packages public) are complete on the live repo; the `_BETA` GHA repo-variable values carry the documented chicken-and-egg per Task 0.2 / doc Section 4 (placeholder until Section 3 Railway service creation assigns hostnames, then Section 4 updates the GHA vars and the next `beta` push bakes them).
- All Railway-dashboard-only tasks (Tasks 1-5, 7) marked `[!]` per A30 Three-State Task Checkbox convention. Doc Section 13.2 reference table holds the per-deployment placeholder values that Harry fills in during execution.

### Completion Notes List

- ✅ Source artifact created: [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — 13-section reproducible Beta deployment checklist with SPDX header. Single doc covers E13-S1/S2/S3/S4 deliverables in one place (per Wave-6 bundle), so a fork can reproduce the deployment from a clean Railway account end-to-end.
- ✅ README.md cross-link added under "Option 4: Local Beta-shape testing" with a "#### Beta deployment (Railway)" subsection pointing at the setup doc.
- ✅ AC-11 secrets-in-repo guard run: `git grep` returns zero operational hits; all 10 matches are documentation references (comments in `.env.example` / `Dockerfile` / `docker-compose.full.yml` mentioning the word "Railway" in context). Logged in doc Appendix for repeatability.
- ✅ A31 cross-story orthogonal-AC verification done: image-naming parity (Railway image refs ≡ build-images.yml matrix), service-naming canonicalization (six-service list in Section 13.2), region parity (Europe-West ≡ Europe/Zurich TZ in backend Dockerfile + Hangfire schedule).
- ⏳ Sixteen `[!] needs-human-verify` Quality-Gates items remain for Harry's session against the live Railway dashboard. These are Railway-clicks-the-UI actions per the documented checklist; the dev-agent cannot execute Railway dashboard or Railway CLI from this sandbox.

### File List

- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — NEW (the setup checklist; AC-10).
- [README.md](../../README.md) — EDIT (add "Beta deployment" cross-link under Option 4; AC-10.2).
- No source code changes (per "Why this story has NO source-code changes" in Dev Notes).
