# Sprint Change Proposal — Beta Deployment on Railway and Open Source Foundation

Date: 2026-05-15
Project: iab-connect
Author: Correct Course workflow (BMAD planning session for Beta-on-Railway pivot)
Status: Draft — awaiting user approval
Output location: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`

Inputs analyzed:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics-and-stories.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Codebase grounding (`backend/src/IabConnect.Api/{Program.cs,DependencyInjection.cs,appsettings.json}`, `frontend/{package.json,next.config.ts,.env.example}`, `infra/docker-compose.yml`, `infra/keycloak/`, `.gitignore`)
- Memory: `feedback_bmad_workflow.md`, `project_generic_white_label_pivot.md`

---

## Section 1: Issue Summary

### Problem statement

IAB Connect is functionally complete for Epics E1–E10 and runs reliably on a developer workstation via `infra/docker-compose.yml`. To validate the generic white-label pivot (REQ-086/REQ-087, 2026-05-14) with external testers, the application must be moved from a local-only stack to a **production-grade Beta environment hosted on Railway**, while staying **fully Open Source** so that forks and self-hosters can run the same configuration.

Two distinct gaps drive this change:

1. **No deployable artifact pipeline** — there are no Dockerfiles, no CI workflows, no environment-aware configuration story, no container registry strategy, and no reproducible build process. Local Docker Compose covers infrastructure services but not the application itself.
2. **No Open Source surface** — the repository has no `LICENSE` file, no `CONTRIBUTING.md`, no contributor identity mechanism, no source-disclosure mechanism in the running UI (required by the chosen license), and no public container images.

### Trigger context

- The white-label pivot (Sprint Change Proposal 2026-05-14) declared that the platform is *generic* and *configurable*. Validating that claim requires real testers on a remote deployment.
- The maintainer has decided to release IAB Connect as Open Source under a license that requires source disclosure on network use.
- The chosen deployment target is Railway (https://railway.app) because of its low-friction managed Postgres, Docker support, private networking, and free-tier-feasible Beta budget.

### Evidence from current state

- `backend/src/IabConnect.Api/appsettings.json` still contains `localhost`/`5433`/`9000`/`rustfsadmin` references intended as Dev defaults; no `appsettings.Beta.json` exists.
- `backend/src/IabConnect.Api/Program.cs` calls `MigrateAsync()` unconditionally for non-Development environments — acceptable for Beta, must become an opt-out for Production.
- `backend/src/IabConnect.Api/DependencyInjection.cs:189–191` registers `/health/ready` (DB + Keycloak tags) — Railway healthcheck wiring exists at the endpoint level but is not yet plumbed to Railway service config.
- Hangfire is registered with PostgreSQL storage in `backend/src/IabConnect.Infrastructure/DependencyInjection.cs:182–193` — shares the application DB connection, fine for Railway managed PG.
- `frontend/next.config.ts:14–28` hardcodes `NEXT_PUBLIC_API_URL` to `http://localhost:5000` and pins `images.remotePatterns` to `localhost:9000`. Both are blockers for any non-local deployment.
- `frontend/.env.example` references the local stack only.
- `infra/keycloak/providers/disable-new-users/` ships a custom SPI that must travel with the Keycloak deployment — today via Docker volume mount, which does not transfer to Railway.
- No `.github/workflows/*` exists.

---

## Section 2: Proposed Change

Move IAB Connect to a Beta environment on Railway, with the following non-negotiables locked in:

| Decision Area | Choice | Rationale |
| --- | --- | --- |
| License | **AGPL-3.0-or-later** | Author intent (protect against closed-source SaaS forks); compatible with current dependency set; standard for comparable platforms (Nextcloud, Mastodon, Plausible). |
| Contributor identity | **DCO (Developer Certificate of Origin)** | Lowest-friction OSS standard; enforceable by GitHub status check; keeps future dual-license option open. |
| REUSE/SPDX scope | **Minimal** (LICENSE + NOTICE.md + README badge; SPDX tags only on new files) | Full REUSE compliance is a Post-Beta cleanup task; minimal is AGPL-rechtskonform. |
| Source-disclosure UI (AGPL §13) | **Footer link + `/about` endpoint** | Returns name/license/version/commitSha/buildDate/sourceUrl. Backend-served, identical across frontend pages. |
| Identity Provider | **Keycloak self-hosted on Railway** (custom image with SPI baked-in) | Only OSS option compatible with existing custom SPI; aligns with self-host story. |
| Object Storage | **RustFS on Railway with Railway volume** | Apache-2.0, already in dev stack, fully self-hostable, S3-API contract preserved. |
| Backup target | **Same RustFS instance, bucket `backups`** | Single OSS service for documents + backups; acceptable for Beta. |
| Container distribution | **GHCR (public images)** with tags `:beta` (moving) + `:sha-{commit}` (immutable) | Forks/self-hosters can pull identical artifacts; Railway pulls from GHCR rather than rebuilding. |
| CI | **GitHub Actions** | Free for public OSS repos; standard. |
| Self-host paths officially documented | **Railway + local Docker Compose** | Honest minimum; VPS/K8s are post-Beta concerns. |
| SMTP in Beta | **Mailtrap Sandbox** (no actual delivery) | Zero deliverability risk; tester gets Mailtrap inbox view; provider-agnostic SMTP config means later swap is trivial. |
| Domain | **Railway-default `*.up.railway.app`** for Beta | No DNS work; custom domain becomes a Production-prep story (E19). |
| Hangfire Dashboard in Beta | **Off** (Dev-only behavior preserved) | Reduces attack surface; can opt in later via env-flag if ops need arises. |
| Auto-migrate on API startup in Beta | **On** | Fast feedback loop; production will gate via env-flag in E19. |
| Retention enforcement job in Beta | **Off** (`RetentionEnforcement__Enabled=false`) | Protects tester data while Retention defaults are not yet final per deployment. |
| Tester roles available in Beta | All seven: Admin, Vorstand, Kassier, Auditor, Member, EventManager, EventStaff | Full E1–E10 testing surface. |
| Railway production project | Deferred until Production-Go-Live | No standing leerstehender Slot. |
| DSGVO/DPA with Railway | Before tester onboarding | Article 28 compliance precondition. |

The Beta deployment uses **four Railway application services + two managed Postgres instances + one external SMTP relay (Mailtrap Sandbox)**:

```
                       Public Internet
                       │           │
              ┌────────┘           └──────────┐
              ▼                                 ▼
       web (Next.js)                    keycloak
       Dockerfile, port 3000            Dockerfile, port 8080
              │                                 │
              └───────────► api ◄──────────────┘
                            (.NET, port 8080)
                            │
                ┌───────────┼────────────────────┐
                ▼           ▼                    ▼
        postgres-app   postgres-kc            rustfs
        (managed PG)   (managed PG)           (volume-backed)
```

- `postgres-app`, `postgres-kc`, `rustfs` reachable **only via Railway private networking**.
- `web`, `api`, `keycloak` get **Railway-generated public domains**.
- The `mailtrap.io` SMTP relay is external; outgoing from `api` only.

---

## Section 3: PRD Delta

The following changes apply to `_bmad-output/planning-artifacts/prd.md`. A subsequent `bmad-edit-prd` pass will merge them.

### Add to Executive Summary (after current Generic Positioning paragraph)

> The platform is released as **Open Source under the GNU Affero General Public License version 3.0 or later (AGPL-3.0-or-later)**, with public container images and a documented reference deployment on Railway. Self-hosters can run the identical reference stack locally via Docker Compose. Source-code disclosure is exposed to running users through a footer link and an `/about` endpoint that reports name, license, version, commit SHA, build date, and source URL (AGPL §13 compliance).

### Add to Product Principles

> **Principle 9 — Open Source by Default.** All product surfaces — UI, API, deployment configuration, container images — are released under AGPL-3.0-or-later. Third-party dependencies must be license-compatible with AGPL-3.0-or-later. New code carries SPDX identifiers. Contributions are accepted under DCO sign-off.

> **Principle 10 — Deployment-Target Portability.** The platform must run identically on a developer workstation (Docker Compose) and on the reference Beta target (Railway). Configuration is environment-variable-driven; no environment-specific code branches beyond the existing `IsDevelopment()` checks (which remain Dev-only, not Beta).

### Add two PRD-native requirements

**REQ-088 — Beta Deployment Readiness**

Status: Backlog
Domain: Operations and Quality
Priority: Must

Acceptance criteria:

1. The application is deployable to Railway via published, versioned Docker images for `api`, `web`, and `keycloak`, each tagged with `:beta` (mutable, points to latest Beta build) and `:sha-{commit}` (immutable).
2. Build artifacts are produced by GitHub Actions on push to the `beta` branch and published to GitHub Container Registry (GHCR) under the `htos` organization namespace.
3. The Beta deployment uses Railway-managed PostgreSQL (separate instance for the API and for Keycloak) and a self-hosted RustFS instance with a Railway volume for document storage.
4. All secrets are supplied at runtime through Railway environment variables; the repository contains no production secrets and the built container images contain no embedded secrets.
5. The Beta environment exposes health endpoints `/health/ready` (api) and `/api/health` (web) consumed by Railway healthchecks.
6. A daily PostgreSQL backup job (`pg_dump`) runs against the API database and writes encrypted dumps to the RustFS `backups` bucket with 30-day retention.
7. Tester-facing UI shows a persistent "BETA" banner driven by `NEXT_PUBLIC_ENV_LABEL=beta`.
8. The Hangfire `enforce-retention-policies` recurring job is disabled in Beta via `RetentionEnforcement__Enabled=false` to prevent retention-driven data loss while defaults are not yet finalized per deployment.
9. SMTP outbound mail in Beta is routed to Mailtrap Sandbox; the application does not deliver mail to real recipients in this environment.
10. A documented Runbook (`_bmad-output/implementation-artifacts/RUNBOOK-beta.md`) covers deployment, rollback (via redeploy of a previous `:sha-` image), database restore, common incidents, and tester-onboarding steps.

**REQ-089 — Open Source License Surface**

Status: Backlog
Domain: Operations and Quality
Priority: Must

Acceptance criteria:

1. The repository root contains a `LICENSE` file with the full AGPL-3.0-or-later text and a `NOTICE.md` listing direct production dependencies with their licenses.
2. The repository root contains a `CONTRIBUTING.md` explaining the DCO sign-off requirement and the contribution workflow.
3. The `main` and `beta` branches require DCO sign-off via a GitHub Actions check; pull requests without a `Signed-off-by:` trailer fail status.
4. The frontend renders a persistent footer with the project name, license name, and a link to `/about`.
5. The backend exposes an unauthenticated `GET /about` endpoint returning JSON `{ name, license, version, commitSha, buildDate, sourceUrl }`. `commitSha` and `buildDate` are injected at Docker build time.
6. New source files committed after this requirement is implemented include an SPDX header (`// SPDX-License-Identifier: AGPL-3.0-or-later`). Mass-sweep of existing files is out of scope (per REUSE-Compliance minimal-scope decision); a follow-up Story may pursue it.
7. Published container images carry OCI labels: `org.opencontainers.image.source`, `org.opencontainers.image.licenses=AGPL-3.0-or-later`, `org.opencontainers.image.revision`, `org.opencontainers.image.created`.

### Add to Traceability Matrix

| Requirement | Epic | Stories |
| --- | --- | --- |
| REQ-088 | E11, E12, E13, E14, E15, E16, E17, E18 | E11-S1..S3, E12-S1..S4, E13-S1..S4, E14-S1..S5, E15-S1..S4, E16-S1..S3, E17-S1..S4, E18-S1..S4 |
| REQ-089 | E20 | E20-S1..S4 |

### NFR additions

- **Availability target for Beta**: best-effort, no SLA. Uptime monitoring at 5-minute polling on `/health/ready` with email alert on three consecutive failures.
- **Recovery point objective for Beta**: 24 hours (daily backup).
- **Recovery time objective for Beta**: 1 hour (manual `pg_restore` + redeploy).
- **Tester data sensitivity classification**: real personal data possible — DSGVO Art. 28 DPA with Railway must be signed before tester onboarding.

---

## Section 4: Architecture Delta

The following ADRs append to `_bmad-output/planning-artifacts/architecture.md`. A subsequent edit pass will merge them and re-number if needed.

### ADR-009: License — AGPL-3.0-or-later

**Status:** Accepted (2026-05-15).
**Context:** The project will be released as Open Source. The dominant question is whether to use a permissive license (Apache-2.0, MIT) that maximizes downstream adoption or a strong copyleft license (AGPL) that prevents closed-source SaaS forks. The current dependency set is permissive across the board (.NET MIT, Next.js MIT, Hangfire LGPL, Keycloak Apache-2.0, RustFS Apache-2.0, all NuGet/npm deps Apache/MIT/ISC/PostgreSQL/LGPL — all AGPL-compatible).
**Decision:** Adopt AGPL-3.0-or-later for the application source (frontend, backend, infrastructure scripts, Dockerfiles, CI workflows). The `-or-later` variant retains flexibility to accept future AGPL versions if FSF publishes them.
**Consequences:** Closed-source forks offering the application as a network service must publish their modifications. Some corporate contributors may decline to participate due to internal policies — accepted tradeoff. The maintainer retains the option to dual-license commercially (subject to DCO compliance and a future explicit CLA addition for that purpose).
**Alternatives rejected:** Apache-2.0 (permits closed-source SaaS — contrary to author intent); MIT (no patent grant); MPL-2.0 (file-level copyleft is too weak for the network-use scenario); SSPL (not OSI-approved, fragments OSS ecosystem).

### ADR-010: Contributor Identity — DCO

**Status:** Accepted (2026-05-15).
**Context:** Every contribution must carry an audit trail of who legally certified the right to submit the code. Two mainstream mechanisms exist: DCO (commit sign-off, used by Linux/Docker/Kubernetes/Hangfire) and CLA (out-of-band agreement, used by Google/Apache projects). DCO is lower-friction and sufficient for the project's current scope.
**Decision:** Require DCO sign-off (`Signed-off-by: Name <email>` commit trailer) on every commit merged to `main` or `beta`. Enforce via the `dcoapp/dco`-style GitHub App or an equivalent GitHub Actions check.
**Consequences:** Drive-by contributions need a one-line `git commit -s`. Maintainer keeps dual-license option open in principle (DCO grants the rights AGPL-3.0-or-later requires), but a future commercial dual-license would need explicit per-contributor consent — DCO does not by itself authorize re-licensing.

### ADR-011: Beta Deployment Target — Railway

**Status:** Accepted (2026-05-15).
**Context:** A managed PaaS for the Beta phase reduces operational overhead compared to a VPS/Kubernetes deployment. Candidates considered: Railway, Render, Fly.io, Hetzner Cloud (raw VPS). Railway offers Dockerfile builds, managed PostgreSQL, private networking (`*.railway.internal`), volumes for stateful services, built-in healthchecks, GitHub auto-deploy, and is feasible inside a hobby budget for the duration of Beta.
**Decision:** Use Railway as the reference Beta deployment target. The architecture remains portable — every Railway-specific feature has an OSS-equivalent self-host path (private networking → docker-compose internal network; managed PG → docker postgres; volumes → docker volumes).
**Consequences:** Documentation explicitly covers Railway (RUNBOOK-beta.md) and lokales Docker Compose (`infra/docker-compose.yml`). Other deployment targets (VPS, K8s, other PaaS) are not officially supported in the Beta phase; the architecture does not preclude them but does not promise them.

### ADR-012: Service Topology on Railway

**Status:** Accepted (2026-05-15).
**Context:** Five logical components — frontend, backend, identity provider, application database, object storage — can be packed onto Railway as separate services, co-located, or shared with infrastructure dependencies. Three architectural questions: (1) frontend and backend co-deployed or separate; (2) one shared Postgres or split per consumer; (3) object storage on Railway or external.
**Decision:**
- **Five application services** on Railway: `web` (Next.js), `api` (.NET), `keycloak` (custom image), `rustfs` (object storage with volume), and two managed Postgres instances (`postgres-app` for the API, `postgres-kc` for Keycloak — separated for ownership clarity and migration safety).
- `web`, `api`, `keycloak` get public Railway domains.
- `postgres-app`, `postgres-kc`, `rustfs` are reachable only via Railway private networking (`*.railway.internal`).
- Browsers call `api` directly (CORS strict-allowlists `web`'s public domain).
**Consequences:** Frontend can be redeployed independently of backend. Database migration mishaps in the API cannot corrupt the Keycloak schema. Object storage is self-hostable as part of the same Railway project.
**Alternatives rejected:** Shared Postgres for API and Keycloak (would couple migration risk); external S3-compatible storage like Cloudflare R2 (contradicts "fully self-hostable" OSS posture); reverse-proxying API through the web service (extra hop, no clear benefit for Beta).

### ADR-013: Object Storage — RustFS on Railway with Volume

**Status:** Accepted (2026-05-15).
**Context:** The application talks to an S3-compatible storage layer for documents and finance artifacts (existing `DocumentStorage:*` configuration). For Beta, the storage backend can be (a) self-hosted in the Railway project, (b) external SaaS (R2, B2, Tigris, SES), or (c) re-used as a contract with no shipped default. RustFS (Apache-2.0) is already the local-dev backend and works against Railway volumes.
**Decision:** Run RustFS as a fifth Railway service with a Railway volume mounted at `/data`. The same instance serves application documents (bucket `iabconnect-documents`) and backups (bucket `backups`). The application's S3 client configuration (`DocumentStorage:ServiceUrl` etc.) points to the private network address.
**Consequences:** A single OSS service handles both document storage and backup destination. No external SaaS dependency for storage. Storage durability is limited to Railway volume durability (no off-site replication in Beta); for Production, an off-site replication strategy is on E19's scope.
**Alternatives rejected:** Cloudflare R2 (proprietary service, contradicts OSS-self-host story); MinIO (AGPL-3.0 is fine but adds license-talk surface unnecessarily when RustFS suffices); SeaweedFS (mature but heavier setup); not shipping a default (forks would need to make this choice cold).

### ADR-014: Container Image Distribution — GHCR

**Status:** Accepted (2026-05-15).
**Context:** Forks and self-hosters benefit from pre-built container images they can pull directly instead of building from source. The maintainer's CI must produce reproducible artifacts. Three registry options: Docker Hub (rate-limited for anonymous pulls), GitHub Container Registry (free for public OSS, OCI-compliant), self-hosted (operational overhead).
**Decision:** Publish public images to GHCR under `ghcr.io/htos/iabc-{api,web,keycloak}`. Tag strategy: `:beta` (moving, tracks the `beta` branch HEAD) and `:sha-{commit}` (immutable, every Beta build). Railway pulls `:beta` for routine deploys. Rollback in production means redeploying a previously good `:sha-` tag.
**Consequences:** Identical artifacts run in CI, in Beta, in fork environments. Image OCI labels (`org.opencontainers.image.{source,licenses,revision,created}`) carry provenance metadata. CI requires a GitHub Personal Access Token or GITHUB_TOKEN with `packages:write` scope.
**Alternatives rejected:** Docker Hub (anonymous pull rate limits); building only on Railway (forks lose pre-built convenience); semver-tagged images (premature ceremony for Beta iterations — can be added in E19).

### ADR-015: Configuration and Environment Strategy

**Status:** Accepted (2026-05-15).
**Context:** Today's configuration uses `appsettings.json` + `appsettings.Development.json` + environment overrides on the backend; `.env.local` + Next.js `process.env` on the frontend. Beta introduces a third environment between Development and Production. Production deployment-time behavior (HSTS, no Swagger, strict CORS, real auth) must match Beta; tester-visible behavior (BETA banner) must differ.
**Decision:**
- Introduce `ASPNETCORE_ENVIRONMENT=Beta` and `appsettings.Beta.json` (non-sensitive defaults only).
- Existing `IsDevelopment()` checks in code stay **Development-only**, not "Beta or Production". Production hardenings (HSTS, HTTPS-redirect, no Swagger, no Hangfire-Dashboard, strict CORS) apply to Beta verbatim.
- Frontend tester-visible difference uses `NEXT_PUBLIC_ENV_LABEL=beta` (build-time) → orange BETA banner component.
- Backend `Database__AutoMigrate` toggle is added but defaults remain unchanged in Beta (auto-migrate on); E19 introduces the manual migration path for Production.
**Consequences:** A misconfigured environment never accidentally exposes Swagger or relaxes CORS — only `IsDevelopment()` does that. The Beta environment behaves like Production save for the visual label and the auto-migrate convenience.

### ADR-016: Custom Keycloak Image with SPI Baked In

**Status:** Accepted (2026-05-15).
**Context:** The Keycloak deployment depends on `infra/keycloak/providers/disable-new-users/`, a Maven-built custom SPI JAR. Today, Docker Compose mounts the JAR as a volume. Railway does not support per-service file mounts from a Git source path; the SPI must travel with the image.
**Decision:** Build a custom Keycloak image (`infra/keycloak/Dockerfile`) that copies the SPI JAR into `/opt/keycloak/providers/` and runs `kc.sh build` as part of the image build. The CI workflow first compiles the SPI (`mvn package` on `infra/keycloak/providers/disable-new-users/`) and feeds the resulting JAR into the Keycloak image build. The realm import JSON travels in the image at `/opt/keycloak/data/import` with placeholders for tester accounts (no committed credentials).
**Consequences:** Keycloak start time on Railway is fast (build is image-time, not container-start time). A new SPI version requires an image rebuild — acceptable for Beta cadence. The realm import JSON must be sanitized of any committed dev client secrets before merge.

### ADR-017: Logging and Health for Container Runtimes

**Status:** Accepted (2026-05-15).
**Context:** The backend currently writes Serilog logs to both Console and File sinks (`backend/src/IabConnect.Api/appsettings.json:21–30`). Container runtimes (Railway, GHCR-pulled-anywhere) treat the container filesystem as ephemeral, and Railway aggregates Console output. File logging on Railway is wasted writes at best and a non-recoverable crash at worst if the `logs/` directory is not writable.
**Decision:**
- In Beta (and Production), override Serilog to **Console-only**. File sink remains in `appsettings.Development.json` for developer ergonomics.
- Health probes wire to Railway: `api` → `/health/ready` (covers `db` + `keycloak` health-checks already registered at `backend/src/IabConnect.Api/DependencyInjection.cs:189–191`); `web` → `/api/health` (a new minimal Next.js route handler returning `{status:"ok"}`).
- External uptime monitoring (UptimeRobot or BetterStack free tier) polls `/health/ready` every 5 minutes and alerts on three consecutive failures.
**Consequences:** All log data is available via Railway's log viewer with CorrelationId enrichment (already implemented via `CorrelationIdMiddleware`). Long-term log storage requires shipping logs to an external aggregator (Seq, Loki) — out of Beta scope.

### ADR-018: Beta Mail Routing — Mailtrap Sandbox

**Status:** Accepted (2026-05-15).
**Context:** Outbound mail from cloud PaaS providers like Railway is structurally hostile to real-world delivery: port 25 is blocked for outbound to arbitrary hosts; cloud IP ranges sit on RBL blocklists; reverse-DNS cannot be configured. Tester-visible features (password reset, invoices, dunning, volunteer-shift-reminders) all generate outbound mail. Three options: route through an external transactional provider (Brevo, Postmark, SES), self-host a mail server on a separate VPS (Postal, mailcow, docker-mailserver, xmox), or use a sandbox that captures mail without delivering.
**Decision:** Use **Mailtrap Sandbox** for Beta. SMTP variables (`Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`) point to the Mailtrap sandbox endpoint. Mails are visible in the Mailtrap inbox but never delivered to real recipients. Tester guide (`E18-S2`) documents how testers either receive a Mailtrap inbox link or use Mailtrap's "forward-to-email" feature.
**Consequences:** Zero deliverability risk and zero spam-reputation exposure during Beta. The backend's SMTP code stays provider-agnostic; transition to a real provider in Post-Beta is a four-environment-variable change. A self-hosted Postal-on-Hetzner path is documented in `E19` as the Production-Sovereignty option.

### ADR-019: Backup Destination — Same RustFS

**Status:** Accepted (2026-05-15).
**Context:** Daily `pg_dump` output needs a durable destination. Options range from "same infrastructure as primary storage" (single failure domain) to "separate cloud provider" (off-site, but introduces non-OSS surface).
**Decision:** Backups land in a dedicated bucket (`backups`) on the same RustFS instance that hosts documents. Dumps are gzipped and encrypted symmetrically with a key from `Backup__EncryptionKey`. Retention: 30 days, enforced by a second Hangfire job. For Production (E19), off-site replication to a second RustFS in a different Railway project (or to a different OSS S3 on Hetzner) becomes the durability story.
**Consequences:** A catastrophic Railway-volume loss takes down both primary documents and backups — an accepted Beta-phase risk documented in the RUNBOOK. The backup encryption key must be stored separately from the database credentials (Railway Variable, never logged).

### ADR-020: Beta-Mode Job Suppression

**Status:** Accepted (2026-05-15).
**Context:** The application registers four recurring Hangfire jobs in `backend/src/IabConnect.Api/DependencyInjection.cs:286–316`: `mark-invoices-overdue` (daily, status mutation), `generate-dunning-notices` (weekly, mail+status), `enforce-retention-policies` (weekly, **data deletion**), and `send-volunteer-shift-reminders` (daily 09:00 Europe/Zurich, mail). In Beta, the retention-enforcement job can permanently delete tester data based on default policies that are not yet finalized for white-label deployments.
**Decision:** Introduce a feature flag `RetentionEnforcement__Enabled` (default `true`, set to `false` in `appsettings.Beta.json` and on the Beta Railway service). When false, the recurring job is not registered. The other three jobs run normally; their mail outputs land in Mailtrap (ADR-018).
**Consequences:** Beta data is not retention-deleted. The retention behavior must be explicitly re-validated and re-enabled as part of Production-readiness (E19). The flag also enables individual organizations (Post-Beta white-label deployments) to disable retention enforcement during their own initial setup phase.

### ADR-021: Source-Disclosure Mechanism (AGPL §13)

**Status:** Accepted (2026-05-15).
**Context:** AGPL-3.0 §13 requires that users interacting with a modified version over a network be able to access the corresponding source code. A repository link is sufficient in principle, but a runtime-introspectable build identity (commit SHA, build date) is best practice and helpful for forks.
**Decision:**
- Frontend footer (visible on every page): `IAB Connect — AGPL-3.0-or-later — Source` with the "Source" link pointing to `/about`.
- Backend `/about` endpoint (unauthenticated): returns JSON `{ name: "IAB Connect", license: "AGPL-3.0-or-later", version: <package-version>, commitSha: <git-sha>, buildDate: <ISO-timestamp>, sourceUrl: "https://github.com/htos/iab-connect" }`.
- `commitSha` and `buildDate` are injected as Docker build-args in CI.
**Consequences:** Forks that modify the application must update `sourceUrl` to their fork URL (an item in the fork-setup checklist documented in README). The `/about` endpoint is part of the application contract and must remain reachable in all environments.

---

## Section 5: Epics and Stories Delta

The following epics and stories append to `_bmad-output/planning-artifacts/epics-and-stories.md`.

### Epic E11 — Environment and Configuration Management for Beta

Implements REQ-088 acceptance criterion 4 (no secrets in repo/image) and configuration prerequisites for E12 and E13.

#### Story E11-S1 — Add `.env.example` files and document configuration precedence

As **a new developer or self-hoster**, I want a complete `.env.example` for backend and frontend so that I can configure local, Beta, and Production deployments without reading the source.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `backend/.env.example` exists and covers `ASPNETCORE_ENVIRONMENT`, `ASPNETCORE_URLS`, `ConnectionStrings__DefaultConnection`, `Keycloak__Authority`, `Keycloak__ClientId`, `Keycloak__ClientSecret`, `Auth__CalendarTokenPepper`, `Frontend__BaseUrl`, `DocumentStorage__*`, `Smtp__*`, `Branding__*`, `RetentionEnforcement__Enabled`, `Backup__EncryptionKey`.
- `frontend/.env.example` is updated to include `NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`, `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`.
- Every entry carries a `# Required | Optional | Dev-only` annotation; no entry contains a real secret value (placeholders use `__set_in_environment__` or similar non-token-looking strings).
- `.gitignore` is verified to exclude `**/.env`, `**/.env.local`, `**/.env.*.local`.
- README contains a new "Configuration precedence" section documenting `appsettings.json` < `appsettings.{Env}.json` < environment variables (backend) and `.env` < `.env.local` < runtime environment (frontend).

Architecture notes: ADR-015.

Tests/evidence: ripgrep for `localhost`, `5433`, `9000`, `rustfsadmin`, `iabconnect-documents` outside of `appsettings.Development.json`, dev-compose, and test code yields zero hits.

#### Story E11-S2 — Introduce `ASPNETCORE_ENVIRONMENT=Beta`

As **the maintainer**, I want a distinct Beta environment label so that Production-grade hardenings apply while a tester-visible label can differentiate Beta from Production.

Requirements: REQ-088 AC-7

Acceptance criteria:

- `backend/src/IabConnect.Api/appsettings.Beta.json` exists with non-sensitive Beta defaults: Serilog Console-only (`WriteTo` array excludes File sink), `Logging.LogLevel.Default = Information`, `RetentionEnforcement:Enabled = false`.
- Code audit confirms no `IsDevelopment()` check has been relaxed to `IsDevelopment() || envName == "Beta"` — Beta inherits Production hardenings (no Swagger, no Hangfire dashboard, strict CORS, HSTS, HTTPS redirect).
- Frontend renders a persistent orange BETA banner when `NEXT_PUBLIC_ENV_LABEL=beta`; banner is dismissable per session.

Architecture notes: ADR-015.

Tests/evidence: Manual `dotnet run` with `ASPNETCORE_ENVIRONMENT=Beta` shows: Swagger 404, no Hangfire dashboard, strict CORS error from a non-allowed origin, retention job not registered (verify via `IRecurringJobManager` listing).

#### Story E11-S3 — Make `next.config.ts` environment-driven

As **the maintainer**, I want frontend image and API hosts to be environment-driven so that the build is not hardcoded to localhost.

Requirements: REQ-088 AC-4

Acceptance criteria:

- `frontend/next.config.ts`: `images.remotePatterns` is computed from `process.env.NEXT_PUBLIC_DOCUMENT_HOST` at build time, with a localhost fallback for dev.
- `output: 'standalone'` is enabled.
- `NEXT_PUBLIC_API_URL` continues to be exposed but is documented as build-time-constant (any URL change requires a rebuild).

Architecture notes: ADR-015.

Tests/evidence: `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.app --build-arg NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app .` then `grep -r "api.example.app" .next/static/` returns matches.

### Epic E12 — Dockerization

Implements REQ-088 acceptance criteria 1, 5.

#### Story E12-S1 — Backend Dockerfile (multi-stage)

As **the CI pipeline**, I want a reproducible backend image so that Railway pulls identical artifacts on every deploy.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `backend/Dockerfile` exists with two stages: build (`mcr.microsoft.com/dotnet/sdk:9.0`, `dotnet restore` + `dotnet publish -c Release`) and runtime (`mcr.microsoft.com/dotnet/aspnet:9.0`).
- Runtime stage installs `tzdata` and sets `TZ=Europe/Zurich` so that `ResolveReminderJobTimeZone` (DependencyInjection.cs:361) does not fall back to UTC.
- Container runs as non-root `USER 1000`.
- Container exposes 8080 and `ASPNETCORE_URLS=http://+:8080`.
- `backend/.dockerignore` excludes `bin/`, `obj/`, `logs/`, `tests/`, `*.user`, `.env*`, `.vs/`.
- Image contains no `appsettings.*.json` carrying secrets — only Dev/Beta non-sensitive defaults.
- Build-args `BUILD_SHA` and `BUILD_DATE` are accepted and surfaced via the `/about` endpoint (consumed by Story E20-S3).

Architecture notes: ADR-012.

Tests/evidence: `docker build -t iabc-api backend/` succeeds; `docker run --rm iabc-api` shows the application logging "missing connection string" and exiting without crash-looping.

#### Story E12-S2 — Frontend Dockerfile (Next standalone)

As **the CI pipeline**, I want a reproducible frontend image with the correct build-time public variables baked in.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `frontend/Dockerfile` exists with three stages: deps (`npm ci`), build (`next build` with build-args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`), runtime (`node:22-alpine` + `.next/standalone`).
- Container runs as non-root `USER node`.
- Container exposes 3000 and starts via `node server.js`.
- `frontend/.dockerignore` excludes `node_modules`, `.next`, `coverage`, `e2e`.

Architecture notes: ADR-012.

Tests/evidence: `docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.app -t iabc-web frontend/` succeeds; output image size ≤ 250 MB; the resulting `.next/static/` chunks contain `https://api.example.app`.

#### Story E12-S3 — Custom Keycloak image with SPI baked-in

As **the deployment**, I want Keycloak's `disable-new-users` SPI to travel inside the container image so that Railway does not need volume mounts for it.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `infra/keycloak/Dockerfile` exists with a builder stage that compiles the SPI (`mvn -f infra/keycloak/providers/disable-new-users/pom.xml package`) and a final stage based on `quay.io/keycloak/keycloak:26.5.2`.
- Final stage copies the SPI JAR into `/opt/keycloak/providers/` and runs `RUN /opt/keycloak/bin/kc.sh build` to pre-build Keycloak with the provider.
- Realm import JSON is copied to `/opt/keycloak/data/import` and contains all seven roles (Admin, Vorstand, Kassier, Auditor, Member, EventManager, EventStaff) and the two confidential clients (`iabconnect-api`, `iabconnect-frontend`), with no committed dev client secrets.
- `ENTRYPOINT` uses `start` (not `start-dev`).

Architecture notes: ADR-016.

Tests/evidence: `docker build -t iabc-keycloak infra/keycloak/` succeeds; `docker run -e KC_DB=dev-file -e KC_HOSTNAME=localhost -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin iabc-keycloak start --optimized` boots in <30 seconds.

#### Story E12-S4 — Optional `docker-compose.full.yml` for local Beta-like testing

As **a developer**, I want to test the full container stack locally so that I can verify a Railway-equivalent setup before pushing to `beta`.

Requirements: REQ-088 AC-1

Acceptance criteria:

- `infra/docker-compose.full.yml` exists and references the three application images (built locally or pulled from GHCR).
- `docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up` starts the entire stack, with the application services networked to the existing Postgres, RustFS, and Keycloak.
- README documents the command and the expected health-check URLs.

Architecture notes: ADR-011, ADR-012.

### Epic E13 — Railway Beta Deployment

Implements REQ-088 acceptance criteria 2, 3, 5.

#### Story E13-S1 — Create Railway project and services

As **the maintainer**, I want a Railway project `iab-connect-beta` provisioned with five services so that GitHub-driven deploys can target it.

Requirements: REQ-088 AC-3

Acceptance criteria:

- Railway project `iab-connect-beta` exists in region Europe-West.
- Five services exist: `api`, `web`, `keycloak`, `rustfs`, plus two managed Postgres instances `postgres-app` and `postgres-kc`.
- `api`, `web`, `keycloak` are configured to pull their images from GHCR (`ghcr.io/htos/iabc-{api,web,keycloak}:beta`).
- `rustfs` runs from `rustfs/rustfs:latest` (upstream image; the project does not need to rebuild it) and mounts a Railway volume at `/data`.
- All services have GitHub auto-deploy enabled for the `beta` branch.

Architecture notes: ADR-011, ADR-012, ADR-013.

Tests/evidence: An empty trigger-push to `beta` redeploys all services without manual intervention.

#### Story E13-S2 — Configure Railway environment variables

As **the deployed application**, I want all configuration supplied through Railway variables so that no secrets live in the image.

Requirements: REQ-088 AC-4

Acceptance criteria:

- Each service's variables match the list documented in the Beta runbook section "Railway Variables per Service".
- Postgres connection strings reference `${{postgres-app.PGHOST}}` style placeholders to use Railway private networking.
- `Keycloak__Authority` references `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect`.
- `Frontend__BaseUrl` references `https://${{web.RAILWAY_PUBLIC_DOMAIN}}`.
- Sensitive variables are marked Sealed where Railway supports it.
- The `api` service has `RetentionEnforcement__Enabled=false` (ADR-020).
- The `web` service has `NEXT_PUBLIC_ENV_LABEL=beta` and `NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect`.

Architecture notes: ADR-015.

#### Story E13-S3 — Public networking and private networking enforced

As **a security operator**, I want only the three application services public and the datastore services private so that the database is not internet-reachable.

Requirements: REQ-088 AC-3

Acceptance criteria:

- `web`, `api`, `keycloak`: public Railway domain enabled.
- `postgres-app`, `postgres-kc`, `rustfs`: no TCP Proxy, no Public Domain.
- Connection from outside Railway to `postgres-app.railway.internal:5432` fails (curl/psql test from a non-Railway host).

Architecture notes: ADR-012.

#### Story E13-S4 — Health probes and first end-to-end deploy

As **Railway**, I want healthcheck endpoints to determine readiness so that failed deploys are auto-restarted.

Requirements: REQ-088 AC-5

Acceptance criteria:

- `api` service `healthcheckPath = /health/ready`, timeout 60s (to absorb first-startup migrations).
- `web` service `healthcheckPath = /api/health`, timeout 30s.
- `keycloak` service `healthcheckPath = /health/ready`, timeout 30s.
- After the first end-to-end deploy: a browser request to `web` shows the landing page; the login flow succeeds (Keycloak round-trip); `/health/detail` (admin-only) shows `db: Healthy` and `keycloak: Healthy`.

Architecture notes: ADR-017.

### Epic E14 — Security and Secrets Management

Implements REQ-088 acceptance criterion 4 and the Security Checklist (Sprint Change Proposal Section H of the planning conversation).

#### Story E14-S1 — Secrets audit and repository cleanup

Acceptance criteria:

- `git log -p -S "password"` and `git log -p -S "secret"` reveal no historic real secrets. If found: rotate the affected secret (does not require history rewrite unless the secret is still operational).
- `appsettings.Development.json` contains only well-known development values (`postgres/postgres`, `rustfsadmin/rustfsadmin`) — documented as Dev-only.
- The Keycloak realm import JSON contains no committed client secrets.

#### Story E14-S2 — Security headers and HTTPS enforcement review

Acceptance criteria:

- Backend pipeline confirms `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`, HSTS active in Beta.
- Frontend `next.config.ts` headers match.
- A Content-Security-Policy is defined for the frontend with `connect-src` whitelisting api and keycloak public origins.

#### Story E14-S3 — Verify Hangfire dashboard is dev-only in Beta

Acceptance criteria:

- Code audit confirms Hangfire dashboard registration remains gated by `IsDevelopment()`.
- Manual GET `/hangfire` on the Beta API returns 404.

#### Story E14-S4 — Rate-limiting baseline

Acceptance criteria:

- ASP.NET Core Rate-Limiting middleware is registered with conservative defaults (e.g. 100 req/min/IP anonymous, 600 req/min/IP authenticated, 10 req/min/IP on `/api/v1/auth/*`).
- Healthcheck endpoints are exempt.
- A 429 response is returned with a `Retry-After` header.

#### Story E14-S5 — Log audit

Acceptance criteria:

- Serilog configuration destructure-blocks password and token-shaped fields.
- Request-body logging is verified off.
- JWT presence is logged as `bearer-present`/`bearer-absent`, never the token contents.

### Epic E15 — Database, Persistence, and Migrations

Implements REQ-088 acceptance criterion 6 plus persistence prerequisites.

#### Story E15-S1 — Verify two-Postgres separation in Beta

Acceptance criteria:

- `postgres-app` and `postgres-kc` are distinct Railway services with distinct credentials.
- `api`'s connection string uses `postgres-app.railway.internal`; `keycloak`'s uses `postgres-kc.railway.internal`.

#### Story E15-S2 — Add `Database__AutoMigrate` toggle

Acceptance criteria:

- `Program.cs` reads `Database:AutoMigrate` (default `true`) and skips `MigrateAsync` when `false`.
- Beta value: `true` (documented). Production-Go-Live target: `false` (Story E19-S2).

#### Story E15-S3 — Daily PostgreSQL backup to RustFS

Acceptance criteria:

- A new Hangfire recurring job `daily-pg-backup` runs at 03:00 UTC, runs `pg_dump` via Npgsql streaming or a subprocess, gzips and symmetrically encrypts with `Backup__EncryptionKey`, and uploads to `s3://rustfs/backups/yyyy/MM/dd-HHmmss.sql.gz.enc`.
- A second Hangfire job `prune-old-backups` runs daily at 04:00 UTC and removes objects older than 30 days.
- A manual restore is documented and tested once.

Architecture notes: ADR-019.

#### Story E15-S4 — Beta seeding strategy

Acceptance criteria:

- The `DevelopmentDataSeeder` does not fire in Beta (it is gated on `IsDevelopment()` — verified).
- The Keycloak realm bootstrap has all seven roles created.
- The first Beta-Admin is created manually via the Keycloak admin console; the steps are documented in RUNBOOK-beta.md.

### Epic E16 — Frontend ↔ Backend Integration on Railway

Implements REQ-088 acceptance criteria 5, 7.

#### Story E16-S1 — Verify frontend public URLs

Acceptance criteria:

- The deployed `web` image's `.next/static/` chunks contain the correct Beta `api` Railway domain (no `localhost`).
- Keycloak client redirect URIs in the realm config include the `web` Railway domain.

#### Story E16-S2 — End-to-end OIDC test in Beta

Acceptance criteria:

- A test admin logs in via the Beta web app and is redirected back successfully.
- The JWT's `iss` claim matches `Keycloak__Authority`.
- The backend `/api/v1/me` endpoint returns 200 with the admin's claims.
- Logout terminates the session on both client and Keycloak side.

#### Story E16-S3 — Document upload/download against RustFS

Acceptance criteria:

- An authenticated admin uploads a document; the file appears in the RustFS `iabconnect-documents` bucket.
- The download flow returns the same bytes.
- The Next.js `Image` component renders document thumbnails (no `next/image` host-not-allowed errors).

### Epic E17 — Monitoring, Logging, and Health Checks

Implements REQ-088 acceptance criteria 5, 7.

#### Story E17-S1 — Serilog Console-only for container envs

Acceptance criteria:

- `appsettings.Beta.json` overrides `Serilog:WriteTo` to contain only the Console sink.
- File-sink configuration remains in `appsettings.Development.json` for developer ergonomics.

#### Story E17-S2 — Structured logs with CorrelationId

Acceptance criteria:

- Sample request logs in Railway show CorrelationId enrichment.
- Log levels: Information for application code, Warning for `Microsoft.*`, Warning for `Microsoft.EntityFrameworkCore.*`.

#### Story E17-S3 — Frontend `/api/health` endpoint

Acceptance criteria:

- A new Next.js route handler at `frontend/src/app/api/health/route.ts` returns 200 with JSON `{status:"ok",version:<from env>}`.
- Railway's `web` service healthcheckPath uses this endpoint.

#### Story E17-S4 — External uptime monitoring

Acceptance criteria:

- An UptimeRobot (or BetterStack) monitor polls `/health/ready` every 5 minutes.
- A simulated 2-minute outage triggers an email alert.

### Epic E18 — Beta Test Preparation and Operations Documentation

Implements REQ-088 acceptance criteria 7, 9, 10.

#### Story E18-S1 — Author RUNBOOK-beta.md

Acceptance criteria:

- `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` covers: deployment, rollback (redeploy `:sha-` tag), database restore, log access, common incidents (at least 5).
- Each incident has a Symptoms / Diagnose / Fix / Verify structure.

#### Story E18-S2 — Beta tester onboarding guide

Acceptance criteria:

- `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md` (German, ≤2 pages) explains: signup process, scope of beta, how to access Mailtrap inbox to see mails, how to file feedback, known limitations.

#### Story E18-S3 — Beta banner in UI

Acceptance criteria:

- `frontend/src/components/BetaBanner.tsx` exists; renders when `NEXT_PUBLIC_ENV_LABEL=beta`; orange background; text "Beta — Daten können jederzeit zurückgesetzt werden"; dismissable per session.
- Banner integrated into the root layout.

#### Story E18-S4 — Feedback channel

Acceptance criteria:

- The banner contains a clickable feedback link pointing to a GitHub issue template or a `mailto:` address.
- `.github/ISSUE_TEMPLATE/beta-feedback.md` exists (if GitHub-Issue path chosen).

### Epic E19 — Production Readiness Preparation

Items prepared during Beta to remove blockers from a future Production-Go-Live decision. Not on the Beta-Go-Live critical path.

#### Story E19-S1 — Custom-domain runbook entry

Acceptance criteria:

- RUNBOOK-beta.md gains a section "Migrating from Railway-default domain to a custom domain" covering DNS, Keycloak hostname change, redirect URI update, `Frontend__BaseUrl` update.

#### Story E19-S2 — Backup restore drill

Acceptance criteria:

- A backup from the previous day is restored into a throwaway Postgres instance; the API is pointed at it; smoke tests pass.

#### Story E19-S3 — Production gate checklist

Acceptance criteria:

- A checklist of NFR thresholds (response-time targets, error-rate, backup-success-rate, uptime percentage) is authored and added to RUNBOOK-beta.md.

#### Story E19-S4 — Self-host SMTP migration plan (Postal on Hetzner)

Acceptance criteria:

- A document `_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md` describes the path from Mailtrap-Sandbox to self-hosted Postal on a separate VPS, including IP-warmup expectations.

### Epic E20 — Open Source Foundation

Implements REQ-089 fully.

#### Story E20-S1 — Add LICENSE, NOTICE, CONTRIBUTING and DCO enforcement

As **a contributor**, I want clear license and contribution terms so that I understand my obligations before submitting a PR.

Requirements: REQ-089 AC-1, AC-2, AC-3

Acceptance criteria:

- `LICENSE` (repo root) contains the full AGPL-3.0 text exactly as published by the FSF (https://www.gnu.org/licenses/agpl-3.0.txt).
- `NOTICE.md` lists the direct production dependencies of `backend/` and `frontend/` with their declared licenses (collected automatically from `dotnet list package --include-transitive` and `npm ls --omit=dev`).
- `CONTRIBUTING.md` explains the project's contribution flow and explicitly states the DCO sign-off requirement with an example `Signed-off-by:` trailer.
- `README.md` carries an AGPL-3.0-or-later badge near the top.
- `.github/workflows/dco.yml` enforces DCO sign-off on pull requests targeting `main` and `beta`.
- Branch protection on `main` and `beta` requires the DCO check to pass.

Architecture notes: ADR-009, ADR-010.

#### Story E20-S2 — Add SPDX headers to new files going forward

Acceptance criteria:

- A short policy is added to `CONTRIBUTING.md`: "New source files must begin with `// SPDX-License-Identifier: AGPL-3.0-or-later`".
- An optional linter or editor configuration is documented (out of scope to enforce automatically).

Architecture notes: ADR-009.

#### Story E20-S3 — Add backend `/about` endpoint

As **a user of a network-deployed instance**, I want to find the source code corresponding to the running version so that I can exercise AGPL §13 rights.

Requirements: REQ-089 AC-5

Acceptance criteria:

- `GET /about` returns JSON `{ name: "IAB Connect", license: "AGPL-3.0-or-later", version, commitSha, buildDate, sourceUrl }`.
- The endpoint is unauthenticated.
- `commitSha` and `buildDate` are populated from environment variables `BUILD_SHA` and `BUILD_DATE` injected by the Dockerfile build-args (Story E12-S1).
- `sourceUrl` is populated from `Branding:SourceUrl` (default `https://github.com/htos/iab-connect`).

Architecture notes: ADR-021.

#### Story E20-S4 — Add frontend license footer

Requirements: REQ-089 AC-4

Acceptance criteria:

- A `<Footer />` component renders on every page with: project name, license (linked to `/license` static page or external AGPL text), "Source" link to `/about`.
- The component reads `NEXT_PUBLIC_SOURCE_URL` for the GitHub repo link.

Architecture notes: ADR-021.

#### Story E20-S5 — GHCR image publishing pipeline

As **a self-hoster**, I want to pull pre-built application images so that I do not have to build from source.

Requirements: REQ-088 AC-1, AC-2; REQ-089 AC-7

Acceptance criteria:

- `.github/workflows/build-images.yml` triggers on push to `beta` and `main`.
- The workflow uses `docker/build-push-action` to build all three images (`api`, `web`, `keycloak`) and push to GHCR with tags `:beta` (or `:main`) and `:sha-${{github.sha}}`.
- OCI labels are set: `org.opencontainers.image.source=https://github.com/htos/iab-connect`, `org.opencontainers.image.licenses=AGPL-3.0-or-later`, `org.opencontainers.image.revision=${{github.sha}}`, `org.opencontainers.image.created=${{github.run_id}}` (or ISO timestamp).
- GHCR packages are public.

Architecture notes: ADR-014.

---

## Section 6: Release and Sprint Guidance

The Beta-pivot work runs **after** Epics E1–E10 (already done) and **before** any further Backlog requirements. Suggested implementation waves:

1. **Wave 1 — OSS Foundation**: E20-S1, E20-S2 (license/DCO/CONTRIBUTING). Quick, unblocks public collaboration.
2. **Wave 2 — Configuration hygiene**: E11-S1, E11-S2, E11-S3. No external dependencies.
3. **Wave 3 — Containerization**: E12-S1, E12-S2, E12-S3. Local-only verifiable.
4. **Wave 4 — Source-disclosure**: E20-S3, E20-S4 (depends on Wave 3 build-args).
5. **Wave 5 — CI publish**: E20-S5. Requires Wave 3 to be merged.
6. **Wave 6 — Railway provisioning**: E13-S1, E13-S2, E13-S3, E13-S4. Requires Wave 5 to be pulling.
7. **Wave 7 — Persistence and storage**: E15-S1..S4, E16-S3.
8. **Wave 8 — Security and observability**: E14-S1..S5, E17-S1..S4.
9. **Wave 9 — Beta operations**: E18-S1..S4.
10. **Wave 10 — Production prep (not Beta blocker)**: E19-S1..S4.

Per the hybrid BMAD workflow already in use (memory `feedback_bmad_workflow.md`): bundle `bmad-code-review` + `bmad-retrospective` at each epic boundary, not per story. This applies equally to E11–E20.

---

## Section 7: Acceptance Criteria for This Proposal

- The proposal preserves the existing modular monolith architecture and does not introduce microservices or alternate persistence engines.
- All deployment decisions are achievable on the chosen Railway plan (Hobby or higher).
- Every locked-in decision in Section 2 has supporting analysis in Section 4 (ADRs).
- All new requirements are traceable to existing acceptance-criteria style (REQ-088, REQ-089).
- Every new epic has at least one acceptance-testable story.
- The proposal does not require touching any of the 71 Done requirements' implementations.

---

## Section 8: Validation Checklist

- [ ] User accepts AGPL-3.0-or-later as project license.
- [ ] User accepts the Railway service topology of Section 2 / ADR-012.
- [ ] User accepts that Beta does not deliver real outbound mail (Mailtrap Sandbox, ADR-018).
- [ ] User accepts that Beta retention enforcement is disabled (ADR-020).
- [ ] User accepts that backups share RustFS with documents in Beta (ADR-019).
- [ ] DSGVO/DPA with Railway is in progress and will be signed before tester onboarding.

---

## Section 9: Residual Risks and Open Items

- A future commercial dual-license requires explicit per-contributor consent — DCO does not authorize re-licensing on its own.
- RustFS at version `:latest` is the upstream-image choice; the project should pin a specific tag once a stable release exists, and document the pinning rationale.
- `NEXT_PUBLIC_API_URL` is build-time-constant; any future API-URL change (e.g., custom domain swap) requires a frontend image rebuild and redeploy. Documented in RUNBOOK-beta.md.
- Mailtrap Sandbox has free-tier limits (typically 100 mails/day depending on plan); a Beta with many testers may hit the cap and need a plan upgrade or earlier transition to a real provider.
- Railway's free-tier limits and pricing changes are outside this project's control; if Railway becomes non-viable, the same architecture transplants to Hetzner Cloud + Docker Compose via the documented self-host path.

---

## Section 10: Handoff Steps

After approval of this proposal:

1. `bmad-edit-prd` to merge Section 3 (REQ-088, REQ-089, NFRs, principles 9 and 10) into `_bmad-output/planning-artifacts/prd.md`.
2. Append Section 4 ADRs (ADR-009 through ADR-021) into `_bmad-output/planning-artifacts/architecture.md` and update its "Last revised" line.
3. Append Section 5 epics and stories into `_bmad-output/planning-artifacts/epics-and-stories.md` and update its Traceability Matrix.
4. Use `bmad-create-story` to generate full implementation-artifact files for each Wave-1 and Wave-2 story (E20-S1, E11-S1, E11-S2). Sprint-1 starter story files are pre-authored in `_bmad-output/implementation-artifacts/`: `e20-s1-add-license-dco-and-source-footer.md`, `e11-s1-add-env-examples-and-document-config-precedence.md`, `e12-s1-add-backend-dockerfile-multistage.md`.
5. `bmad-validate-prd` to confirm the merged PRD remains internally consistent.
6. `bmad-check-implementation-readiness` to confirm the merged epic/story tree is ready for `bmad-dev-story`.
