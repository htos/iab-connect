# IAB Connect Architecture

Date: 2026-05-11
Last revised: 2026-05-15 — appended ADR-009 through ADR-021 for the Beta-on-Railway and Open Source Foundation pivot (Sprint Change Proposal 2026-05-15, handoff step 2); updated Executive Summary, Deployment and Infrastructure Impact, Residual Risks, and Architecture Validation Checklist accordingly. Previously revised 2026-05-14 (ADR-007, ADR-008, REQ-086/087 data architecture, and the Module Enforcement authorization-matrix row) for the generic white-label pivot (Sprint Change Proposal 2026-05-14, handoff step 2).
Project: IAB Connect
Document status: Draft solution architecture from validated PRD
Output location: `_bmad-output/planning-artifacts/architecture.md`
Primary inputs:

- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/prd-validation-report.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-14.md`
- `_bmad-output/planning-artifacts/prd-validation-report-2026-05-15.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md`
- `docs/architecture-backend.md`
- `docs/architecture-frontend.md`
- `docs/architecture-infra.md`
- `docs/integration-architecture.md`
- `_bmad-output/project-context.md`

## Executive Summary

IAB Connect remains a modular monolith with a Next.js frontend, ASP.NET Core backend, PostgreSQL persistence, Keycloak identity, RustFS document storage, Hangfire background jobs, and Docker Compose local infrastructure.

This architecture document does not replace the generated backend, frontend, infrastructure, or integration architecture docs. It defines solution decisions for the validated PRD, especially the 14 remaining Backlog requirements. The central architectural choice is to extend existing modules and integration points rather than introduce new deployables, microservices, or alternate identity/storage stacks.

The 2026-05-15 revision (Sprint Change Proposal 2026-05-15) extends the architecture for a Beta deployment on Railway and an Open Source release under AGPL-3.0-or-later. ADR-001 through ADR-008 (modular monolith, Keycloak identity, mandatory backend authorization, PostgreSQL + EF Core persistence, Hangfire background jobs, frontend App Router patterns, module-configuration data model, and three-layer module enforcement) remain unchanged and continue to govern in-application decisions. ADR-009 through ADR-021 (this revision) add Open Source licensing and contributor identity, the Beta deployment target and service topology, container image distribution, configuration-and-environment strategy, custom Keycloak image construction, logging and health for container runtimes, Beta mail routing, backup destination, Beta-mode job suppression, and the source-disclosure mechanism for AGPL §13 compliance.

## Architecture Goals

1. Preserve the existing modular monolith and Clean Architecture-style boundaries.
2. Keep Keycloak as the identity authority and backend policies as the security boundary.
3. Implement remaining Backlog scope through existing modules, endpoint patterns, MediatR/Application services, EF Core migrations, and typed frontend API wrappers.
4. Maintain audit, retention, finance, privacy, and authorization behavior for all sensitive workflows.
5. Make future epic/story implementation consistent enough for multiple agents to work without inventing new patterns.

## System Context

### Components

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, next-auth, next-intl, TanStack Query.
- Backend: ASP.NET Core 10 Minimal APIs, MediatR, FluentValidation, EF Core 10, PostgreSQL, Hangfire, Serilog.
- Identity: Keycloak/OIDC and Keycloak Admin REST API.
- Persistence: PostgreSQL for application data and Hangfire storage.
- Object storage: RustFS through S3-compatible APIs for documents and finance artifacts.
- Email and jobs: SMTP/MailHog in development, Hangfire for scheduled/background work.
- Observability: Serilog console/file/Seq sinks, correlation IDs, health endpoints.

### Runtime Data Flow

1. Frontend authenticates users through NextAuth and Keycloak.
2. Frontend calls backend `/api/v1/...` endpoints with bearer tokens.
3. Backend validates JWTs, maps roles, applies endpoint policies and permission checks.
4. Endpoints delegate workflow behavior to MediatR handlers, repositories, or application services.
5. EF Core persists state in PostgreSQL; migrations live in Infrastructure.
6. RustFS stores binary document/receipt artifacts through an abstraction.
7. Hangfire runs scheduled and asynchronous work such as email, dunning, retention, and future automation jobs.

## Architectural Decisions

### ADR-001: Keep Modular Monolith

Decision: Remaining Backlog scope is implemented inside the existing modular monolith.

Rationale:

- The current repository already has clear API, Application, Domain, and Infrastructure boundaries.
- The remaining Backlog items are feature extensions, not independent products.
- Extra services would add deployment, security, observability, and data consistency burden without clear value.

Implications:

- New backend code belongs under the existing projects.
- Modules remain code boundaries, not deployable service boundaries.
- Cross-module workflows use Application services, MediatR, domain services, repositories, and database transactions where appropriate.

### ADR-002: Keycloak Remains Identity Authority

Decision: Social login, MFA, and session/device management extend Keycloak configuration and integration rather than creating a local identity model.

Rationale:

- User management already uses Keycloak Admin API.
- OIDC roles and claims already flow into frontend and backend.
- MFA and identity provider federation are native Keycloak responsibilities.

Implications:

- No local password or identity credential storage.
- Backend can add admin endpoints only for controlled Keycloak operations.
- Frontend can expose account/security screens, but Keycloak remains source of truth.

### ADR-003: Backend Authorization Is Mandatory

Decision: Every protected capability must enforce backend authorization through policies, permissions, or resource checks.

Rationale:

- Frontend role checks are UX only.
- Remaining scope touches sensitive identity, member, event, communication, finance, and integration surfaces.

Implications:

- Endpoint groups must declare authorization requirements.
- Application services must perform resource-level checks when ownership or object permissions matter.
- Sensitive failures and denied access paths must be auditable where relevant.

### ADR-004: PostgreSQL and EF Core Remain Persistence Backbone

Decision: New persistent state uses EF Core migrations and PostgreSQL.

Rationale:

- Existing domain data and Hangfire storage use PostgreSQL.
- Test strategy already supports PostgreSQL integration through Testcontainers.
- Existing compliance behavior depends on relational state, query filters, transactions, and audit metadata.

Implications:

- Add migrations under `backend/src/IabConnect.Infrastructure/Migrations`.
- Avoid EF InMemory for relational behavior validation.
- Prefer explicit aggregates/entities for durable Backlog concepts.

### ADR-005: Hangfire for Scheduled and Asynchronous Work

Decision: Automation journeys, reminders, webhook delivery retries, and provider-send retries use existing Hangfire infrastructure.

Rationale:

- Hangfire is already configured and persisted in PostgreSQL.
- The project already schedules invoice/dunning/retention jobs.

Implications:

- Keep background processing in Infrastructure/Application.
- Jobs must be idempotent where retries are possible.
- Failures must be logged and visible to authorized users for operational follow-up.

### ADR-006: Frontend Uses Existing App Router and Shared UI Patterns

Decision: New UI surfaces use the current route tree, authenticated shell, public layout split, shared UI primitives, typed API wrappers, next-intl messages, and orange primary actions.

Rationale:

- The frontend has a broad route surface and established design standards.
- Inconsistent direct fetch and styling patterns already exist; new work should converge rather than diversify.

Implications:

- Use `frontend/src/lib/api` or `frontend/src/lib/services` for feature API calls.
- Use next-intl for all user-visible strings.
- Use lucide-react icons where suitable.
- Add search/filter controls on list/table pages.

### ADR-007: Module Configuration as a Single-Tenant Settings Model

Decision: Module enablement state is persisted in a dedicated `module_settings` table — one row per module. The application remains single-organization (`SystemSettings` is a singleton), so there is no `organization_id` column and no multi-tenant data model. This resolves OD-2 from Sprint Change Proposal 2026-05-14 in favour of a dedicated table over a JSON column on `system_settings`.

Rationale:

- The codebase is single-tenant by construction. `SystemSettings` (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) is a singleton entity with a `CreateDefault()` factory and a single persisted row. A per-organization model would add complexity with no consumer.
- A dedicated table — over a JSON column on `system_settings` — gives per-module audit columns (`updated_at`, `updated_by`), a natural unique key for lookup and indexing, and a clean extension point: a new module is a new seeded row plus a new module-key constant, with no schema change.
- It follows the EF conventions already used in `backend/src/IabConnect.Infrastructure/Persistence/Configurations/` (explicit `ToTable`, explicit snake_case `HasColumnName`), so it is consistent with every other entity.

Schema (`module_settings`):

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `module_key` | text | UNIQUE, NOT NULL — one of the known module keys |
| `enabled` | boolean | NOT NULL, DEFAULT true |
| `updated_at` | timestamptz | NOT NULL |
| `updated_by` | text | NULL |

Module keys, seeded on the creating migration with all 7 enabled to preserve current behaviour: `members`, `events`, `documents`, `communication`, `finance`, `partners`, `public_view`.

Implications:

- New `ModuleSetting` entity in `IabConnect.Domain` with a private EF constructor and an invariant-friendly factory, following the `SystemSettings` pattern (private setters, explicit update method such as `SetEnabled(bool, string? updatedBy)`).
- EF configuration `ModuleSettingConfiguration : IEntityTypeConfiguration<ModuleSetting>` in `Persistence/Configurations/`, with `ToTable("module_settings")`, explicit snake_case columns, and a unique index on `module_key`.
- One EF Core migration under `backend/src/IabConnect.Infrastructure/Migrations/` that creates the table and seeds the 7 rows in the same migration, so existing deployments behave identically after upgrade.
- Read access goes through a cached `IModuleSettingsService` (Application-layer interface, Infrastructure implementation — see ADR-008), backed by an `IModuleSettingsRepository` following the `ISystemSettingsRepository` pattern. The cache is invalidated on write.
- The module-key list is a shared contract: a `ModuleKeys` constants class in a layer both `IabConnect.Api` and `IabConnect.Application` can reference. See the Module → Route/Endpoint Mapping table in ADR-008.

### ADR-008: Three-Layer Module Enforcement

Decision: A disabled module is enforced at three layers, with the backend as the single security boundary:

1. Backend (security boundary): a module-aware authorization requirement gates each module's endpoint group; a disabled module returns 403 and writes a security audit event on denial.
2. Frontend route guard (direct-URL protection): a Next.js `middleware.ts` redirects or blocks direct navigation to disabled-module routes.
3. Navigation (UX only): the `Sidebar` hides nav items for disabled modules.

Layers 2 and 3 are convenience and UX; only layer 1 is a security control, consistent with ADR-003 ("Frontend role checks are UX only").

Rationale and mechanism (code-grounded):

- There is no `IEndpointFilter` infrastructure in the codebase today. There is a proven authorization-extensibility pattern: `PermissionRequirement : IAuthorizationRequirement`, `PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>`, and `PermissionPolicyProvider : IAuthorizationPolicyProvider` (dynamic policies via a `Permission:` name prefix), all in `backend/src/IabConnect.Api/Authorization/`. Module enforcement models this existing pattern rather than introducing a parallel endpoint-filter mechanism:
  - `ModuleRequirement(string moduleKey) : IAuthorizationRequirement`.
  - `ModuleAuthorizationHandler : AuthorizationHandler<ModuleRequirement>` — resolves `IModuleSettingsService`, succeeds when the module is enabled, otherwise fails and logs via `ISecurityAuditLogger.LogAccessDenied(...)`.
  - The `PermissionPolicyProvider` is extended (or a sibling provider added) to recognise a `Module:` policy-name prefix, so route groups declare `.RequireAuthorization("Module:finance")` — the same ergonomic as the existing `"Permission:..."` and named policies.
  - This keeps one authorization model, one registration site (`DependencyInjection.cs`, alongside `PermissionAuthorizationHandler`), and reuses the access-denied audit path.
- A failing authorization requirement yields `403 Forbidden` by default, which is the desired "module disabled" response.

Layer 1 — Backend, applied per module route group:

| Module | Backend endpoint groups | Enforcement policy |
| --- | --- | --- |
| Members | `MemberEndpoints` | `Module:members` |
| Events | `EventEndpoints` | `Module:events` |
| Documents | `DocumentEndpoints` | `Module:documents` |
| Communication | `EmailCampaignEndpoints`, `EmailTemplateEndpoints` | `Module:communication` |
| Finance | `Invoice`, `Payment`, `Dunning`, `Receipt`, `ExpenseClaim`, `FiscalPeriod`, `JournalEntry`, `AccountingReport`, `FinanceProfile` endpoints | `Module:finance` |
| Partners | `SponsorEndpoints`, `SupplierEndpoints` | `Module:partners` |
| Public View | public/anonymous endpoints across modules — no dedicated group | special-cased (see below) |

Always-on, never gated: Dashboard, My Profile, Admin — including the module-settings endpoints themselves, so an admin can always re-enable a module.

Public View is special: it has no dedicated backend endpoint group; its surface is the set of `AllowAnonymous` public endpoints (public event/blog feeds and similar). When `public_view` is disabled, those public endpoints are gated and the public site is unavailable — but `GET /api/v1/settings/public` itself must remain reachable, because the frontend shell needs branding and the module map even to render a "site not public" page.

Layer 2 — Frontend route guard:

- No `frontend/src/middleware.ts` exists today; it is created new.
- The middleware reads the module map and, for a request whose path maps to a disabled module, redirects authenticated users to a safe page (dashboard) or renders a 403 / "module unavailable" page.
- The module map is exposed to the frontend by extending the anonymous `GET /api/v1/settings/public` response (`PublicSettingsResponse`) with a `modules` map — `AppSettingsProvider` already consumes this endpoint, and middleware needs an unauthenticated-readable source.

Layer 3 — Navigation:

- `NavItem` in `frontend/src/components/navigation/Sidebar.tsx` gains an optional `requiresModule?: string`, filtered exactly like the existing `requiresDoubleEntry` flag (submenu filter and top-level filter).
- The enabled-module set comes from `AppSettingsProvider` (extended `AppSettings` type with a `modules` map), consumed via the existing `useAppSettings()` hook.

Implications:

- New `AuditEventType` enum value (such as `ModuleAccessDenied`) in `backend/src/IabConnect.Domain/Audit/AuditEnums.cs`; denial logged via `ISecurityAuditLogger.LogAccessDenied(...)`.
- `IModuleSettingsService` is cached; the cache is invalidated whenever the module-settings write endpoint runs, so a toggle takes effect without redeploy.
- The module → route (frontend) and module → endpoint-group (backend) mapping is a shared contract. The frontend mapping lives where both `middleware.ts` and `Sidebar` can reference it; the backend `ModuleKeys` constants live in a layer both `IabConnect.Api` and `IabConnect.Application` reference.
- Cross-module dependency: paid event registration (E4) needs Finance. If Events is enabled but Finance is disabled, paid-registration flows must degrade safely. Whether to hard-block such a toggle is a product rule deferred to E10-S5; the architecture flags the dependency rather than enforcing it.
- Background jobs (Hangfire) belonging to a disabled module: behaviour defined in E10-S5. The three enforcement layers above govern HTTP and UI surfaces only.

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

## Backend Architecture

### Project Boundaries

- `IabConnect.Api`: route groups, endpoint mapping, auth policies, request/response mapping, health, middleware.
- `IabConnect.Application`: commands, queries, handlers, validators, application services, interfaces.
- `IabConnect.Domain`: aggregates, value objects, enums, domain events, domain rules.
- `IabConnect.Infrastructure`: EF Core configurations, migrations, repositories, Keycloak, email, jobs, storage, provider integrations.

### Endpoint Pattern

New endpoint groups should follow the existing Minimal API extension pattern:

- `MapXEndpoints(this RouteGroupBuilder group)`
- Tags, endpoint names, descriptions, and explicit auth policies.
- Request DTOs and response DTOs at API/Application boundaries.
- No EF entity leakage into responses.

### Application Pattern

Use MediatR plus FluentValidation when a feature contains workflow, validation, side effects, audit, or cross-module orchestration.

Use direct repository/application service reads only for simple list/detail queries that match existing local patterns.

All async flows must accept and propagate `CancellationToken`.

### Persistence Pattern

New entities should define:

- Required fields and invariant-friendly constructors/factory methods.
- EF Core configuration in Infrastructure.
- Indexes for tenant-like partitioning dimensions where applicable, such as event ID, member ID, status, date, and external provider identifiers.
- Soft-delete or audit behavior where required by domain sensitivity.

## Frontend Architecture

### Route Placement

Use authenticated routes for staff/member workflows and `/public/*` only for public website flows.

Suggested route areas:

- Identity/account: `/profile/security`, `/admin/users/[id]/security`, or existing admin/user routes.
- Duplicate detection: `/members/duplicates` or embedded warnings in member create/edit.
- Event ticketing/check-in/volunteers/calendar: under `/events/[id]/*` or event detail tabs.
- Automations: under `/communication/automations`.
- Multi-channel preferences: profile and communication settings.
- Budget/cost centers: under `/finance/settings` or `/finance/cost-centers`.
- Accessibility does not need a route; it is a quality baseline.
- APIs/webhooks: `/admin/integrations` or `/admin/webhooks`.

### Data Access

New frontend code should:

- Use typed DTOs aligned with backend contracts.
- Prefer typed API wrappers under `src/lib/api` or `src/lib/services`.
- Avoid hardcoded enum strings that differ from backend PascalCase values.
- Use refresh-trigger state plus effects/cancellation guards after mutations.

### UI and Accessibility

New UI should:

- Use authenticated page layout standards.
- Use orange-600/orange-700 for primary actions.
- Use shared components from `components/ui`.
- Use lucide-react icons instead of manual SVGs where available.
- Include keyboard-visible focus states, labels, accessible names, and validation messaging.

## Data Architecture by Backlog Area

### REQ-006 Social / Enterprise Logins

Primary architecture:

- Configure Google/Microsoft as Keycloak identity providers.
- Add optional backend admin/config visibility endpoints only if needed.
- Store any local provider-link metadata only when Keycloak data is insufficient for product needs.

Key data:

- Keycloak federated identity link.
- Audit events for account linking/unlinking or support actions.

Security:

- Scopes must be minimal.
- Account-linking flows must avoid account enumeration.

### REQ-009 Multi-factor Authentication

Primary architecture:

- Use Keycloak required actions, OTP policies, and role/group-based enforcement.
- Backend may expose admin support endpoints for MFA reset only through Keycloak Admin API.

Key data:

- Keycloak MFA enrollment state.
- Audit events for reset, failure-sensitive actions, and admin support operations.

Security:

- Admin and Kassier roles are minimum MFA candidates.
- Recovery/bypass flows require strict authorization.

### REQ-010 Session and Device Management

Primary architecture:

- Use Keycloak session APIs for active sessions and revocation.
- Frontend surfaces session state in profile/admin screens where feasible.

Key data:

- Keycloak session records.
- Optional local audit events for revocations.

Limitations:

- Device detail quality depends on Keycloak and client metadata.

### REQ-018 Duplicate Detection

Primary architecture:

- Add member duplicate detection in Application layer.
- Warn during create/edit based on deterministic rules first: email, normalized name/date/contact signals.
- Add merge workflow only with explicit safeguards and audit.

Suggested backend elements:

- `DuplicateCandidate` DTO/query model.
- `FindMemberDuplicatesQuery`.
- `MergeMembersCommand`.
- Merge audit service or audit event category.

Persistence:

- Prefer using existing Member data for detection.
- Add a `MemberMergeHistory` entity if durable merge evidence is not already covered by audit.

Testing:

- Unit tests for matching rules.
- Integration tests for merge reference preservation.

### REQ-022 Ticketing / Fees

Primary architecture:

- Extend Events with fee configuration.
- Integrate with Finance for invoices/receipts/payment records.
- Do not build a separate payment service unless a provider integration is explicitly approved.

Suggested backend elements:

- Event fee category/value objects.
- Registration payment status.
- Application service to create finance records from paid registration.

Finance rules:

- Cancellation/refund uses existing finance cancellation/reversal behavior.
- Sent/posted records must not be hard deleted.

Testing:

- Cross-module tests for paid registration to finance record.
- Regression tests for cancellation/refund behavior.

### REQ-023 On-site QR Check-in

Primary architecture:

- Reuse existing event registration QR token primitives.
- Add event-day check-in UI and backend operations around those primitives.
- Treat scanner/manual lookup/export/audit as the missing product scope.

Suggested backend elements:

- `CheckInRegistrationCommand`.
- `ManualCheckInRegistrationCommand`.
- `GetEventCheckInRosterQuery`.
- `ExportEventCheckInRosterQuery`.

Security:

- Only authorized event staff/admin roles can check in participants.
- Duplicate scans are idempotent and auditable.

Frontend:

- Event-scoped check-in route or tab.
- QR scanner where browser capabilities allow it.
- Manual attendee search fallback.
- Offline export before event.

### REQ-024 Volunteer Planning and Tasks

Primary architecture:

- Add event volunteer planning as part of Events module.
- Model roles/tasks/shifts and assignments under event aggregate or adjacent event-planning aggregate.

Suggested entities:

- `EventVolunteerRole`
- `EventVolunteerShift`
- `EventVolunteerAssignment`

Communication:

- Use existing email/notification infrastructure for reminders.

Security:

- Event manager/admin manages shifts.
- Member self-signup depends on event policy.

### REQ-025 Calendar Integration

Primary architecture:

- Generate `.ics` content from Event read models.
- Provide public and protected feeds based on event visibility.

Implementation:

- Backend endpoint for public iCal feed where only public events are included.
- Authenticated endpoint for member-visible feed if token/session model supports it safely.
- Per-event `.ics` export can be generated on demand.

Security:

- Never expose member-only/private event details through unauthenticated feeds unless explicitly approved.

### REQ-028 Automations / Journeys

Primary architecture:

- Use existing email templates, email sender, consent filtering, member/event/finance triggers, and Hangfire.
- Store automation definitions and execution records in PostgreSQL.

Suggested entities:

- `AutomationDefinition`
- `AutomationTrigger`
- `AutomationExecution`
- `AutomationRecipient`

Execution:

- Triggered by domain/application events where available, or scheduled polling jobs where safer.
- Idempotency keys prevent duplicate sends.
- Failures are logged and visible in UI.

### REQ-030 Multi-channel Messages

Primary architecture:

- Add channel abstraction behind communication Application/Infrastructure interfaces.
- Email remains the baseline channel.
- SMS/WhatsApp providers are adapters, not core domain dependencies.

Suggested interfaces:

- `IMessageChannelSender`
- `IMessageProvider`
- `IChannelPreferenceService`

Security/compliance:

- Provider credentials are configuration secrets.
- Channel preference and consent must be checked before send.

### REQ-044 Budgets and Cost Centers

Primary architecture:

- Extend Finance module with cost centers and budget periods.
- Associate cost center references with eligible finance records.

Suggested entities:

- `CostCenter`
- `CostCenterBudget`
- Optional mapping entities for transactions/invoices/journal lines if direct nullable foreign keys are unsuitable.

Reports:

- Soll/Ist comparison by fiscal period and cost center.
- Export respects finance read permissions.

### REQ-055 Multilingual DE/EN/HI

Primary architecture:

- Continue next-intl for frontend UI.
- Preserve existing DE/EN behavior and add Hindi incrementally through message files.
- Public content language metadata belongs in content/event/blog models where multilingual content is required.

Rules:

- No hardcoded UI strings in components.
- Backend enum values remain contract-stable and not translated.

### REQ-056 Basic Accessibility

Primary architecture:

- Accessibility is a cross-cutting quality requirement, not a standalone module.
- Add checks to component/page implementation and test practice.

Implementation targets:

- Keyboard navigation.
- Programmatic labels.
- Accessible names for icon controls.
- Visible focus.
- Contrast review.
- Validation messages.

Testing:

- Add focused component tests where practical.
- Use Playwright/manual validation for critical flows.

### REQ-058 API / Webhooks

Primary architecture:

- Add admin-managed API credentials and webhook subscriptions inside backend.
- Webhook delivery uses Hangfire with retry, signing, and delivery history.

Suggested entities:

- `ApiClient`
- `ApiScope`
- `WebhookSubscription`
- `WebhookDelivery`

Security:

- API credentials are hashed or stored using a one-way/token-safe design.
- Rate limiting applies to external API routes.
- Webhook payloads are signed.
- Admin can revoke credentials and disable failing webhooks.

### REQ-086 Generic Positioning / White-Label Branding

Primary architecture:

- Extend the existing `SystemSettings` singleton (`backend/src/IabConnect.Domain/Common/SystemSettings.cs`) with additional nullable branding/profile fields rather than introducing a new entity.
- New nullable columns on `system_settings`: `description`, `contact_email`, `contact_phone`, `contact_address`, `primary_color`, `public_site_enabled`, plus a logo asset reference. All nullable with behaviour-preserving defaults so existing rows stay valid after migration.
- Add an update method on the entity (such as `UpdateOrganizationProfile(...)` alongside the existing `UpdateBranding(...)`), keeping the private-setter plus explicit-method invariant pattern.
- Expose the extended fields through the existing settings endpoints: admin `GET/PUT /api/v1/settings` (`RequireRole("admin")`) for editing, anonymous `GET /api/v1/settings/public` for the public and shell read path.

Key data:

- Extended `SystemSettings` row (still a singleton).
- Audit event on branding/profile change — the existing `AuditEventType.SettingsChanged` path already covers this.

Frontend:

- Extend the `AppSettings` type and `AppSettingsProvider` (`frontend/src/components/providers/AppSettingsProvider.tsx`) with the new fields; consumed via `useAppSettings()`.
- New "Branding" tab in `frontend/src/app/admin/settings/page.tsx`, which already has a `general` / `customRoles` tab structure to extend.
- No user-visible string hardcodes a specific organization; values render from `SystemSettings` or next-intl keys. The de-branding sweep itself is Epic E9 (stories E9-S2/S3/S4).

Security:

- The edit path is admin-only; the public read path exposes only non-sensitive presentation fields.

### REQ-087 Module Configuration / Access Enforcement

Primary architecture:

- Data model: dedicated `module_settings` table — see ADR-007.
- Enforcement: three-layer (backend / route guard / navigation) — see ADR-008.

Suggested backend elements:

- `ModuleSetting` entity, `ModuleSettingConfiguration`, and a creating-plus-seeding migration.
- `IModuleSettingsService` (cached) and `IModuleSettingsRepository`.
- `ModuleRequirement`, `ModuleAuthorizationHandler`, and `Module:` policy-prefix support in the policy provider.
- Module-settings MediatR query/command plus an admin-only endpoint group (`MapModuleSettingsEndpoints`), and the `modules` map added to `PublicSettingsResponse`.
- `ModuleAccessDenied` audit event type.

Suggested frontend elements:

- Extended `AppSettings` (`modules` map) and `AppSettingsProvider`.
- `requiresModule` on `NavItem` plus Sidebar filtering.
- New `frontend/src/middleware.ts` route guard and a 403 / "module unavailable" page.
- New "Modules" tab in admin settings: toggle list, per-module description, dependency warnings, save and confirm.

Testing:

- Backend: `ModuleAuthorizationHandler` returns 403 plus audit when a module is disabled (API tests); `module_settings` persistence and seed (Testcontainers integration); `IModuleSettingsService` cache invalidation.
- Frontend: Sidebar filtering by module; `middleware.ts` redirect and 403; admin Modules tab behaviour.

Security:

- The backend is the only security boundary (ADR-003, ADR-008). Admin and the module-settings endpoints themselves are never gated.

## Cross-Cutting Architecture

### Authorization Matrix

Minimum authorization expectations:

| Area | Primary roles | Backend requirement |
| --- | --- | --- |
| Identity providers, MFA, sessions | Admin, affected user | Keycloak admin/user authorization plus audit |
| Duplicate detection/merge | Admin, Vorstand | Member write permission and merge audit |
| Event fees/check-in/volunteers/calendar | Event manager, Admin, Kassier where finance applies | Event permissions plus finance permissions for money flows |
| Automations/multi-channel | Communication, Admin, Kassier for finance reminders | Communication permissions, consent checks, audit/send logs |
| Budgets/cost centers | Kassier, Vorstand | Finance read/write permissions |
| Multilingual/accessibility | All | No special backend permission except content management |
| API/webhooks | Admin/IT | Admin-only configuration, scoped external access |
| Module configuration and enforcement | Admin/IT | Admin-only module-settings endpoints; `Module:*` authorization requirement on every gated route group; denial returns 403 and is audit logged. Admin and module-settings endpoints are never gated. |

### Audit and Logging

Audit events are required for:

- MFA reset and security-sensitive identity support.
- Session revocation by admin.
- Member merge.
- Paid event registration finance transitions.
- Check-in changes.
- Volunteer assignment changes if operational accountability is required.
- Automation sends, failures, and disabled definitions.
- Multi-channel sends and provider failures.
- Budget/cost center configuration changes.
- API key creation/revocation and webhook subscription changes.
- Module enablement changes and denied access to a disabled module.

### Integration Boundaries

External provider integrations must be Infrastructure adapters behind Application interfaces:

- Google/Microsoft identity stays in Keycloak.
- SMS/WhatsApp providers hide behind channel sender interfaces.
- Webhook outbound delivery hides behind a delivery service.
- Calendar output can be generated locally without third-party dependency.

### Background Job Rules

Jobs must:

- Be idempotent or have duplicate prevention.
- Log failures with enough context for support.
- Avoid exposing sensitive payloads in logs.
- Respect cancellation where framework supports it.
- Use explicit retry policies for provider interactions.

## Deployment and Infrastructure Impact

Local Docker Compose remains the development baseline.

Expected infrastructure changes by Backlog area:

- Social login and MFA: Keycloak realm/client/provider configuration changes.
- Session management: no new service, Keycloak Admin API usage.
- Automations and webhooks: more Hangfire jobs and PostgreSQL tables.
- Multi-channel messages: provider credentials and outbound network configuration in production.
- Calendar: no new service.
- Cost centers: database migrations only.
- Accessibility/multilingual: frontend assets/message files only unless content language metadata is added.

### Beta Deployment on Railway

The 2026-05-15 pivot introduces a Beta deployment target on Railway. Service topology and decisions are documented in ADR-011 (Railway as Beta target), ADR-012 (five-service topology: `web`, `api`, `keycloak`, `rustfs`, plus two managed Postgres instances `postgres-app` and `postgres-kc`), ADR-013 (RustFS on Railway volume), ADR-014 (GHCR image distribution), ADR-015 (`ASPNETCORE_ENVIRONMENT=Beta` and environment-variable-driven configuration), ADR-016 (custom Keycloak image with SPI baked in), ADR-017 (Serilog Console-only and healthcheck wiring), ADR-018 (Mailtrap Sandbox SMTP), ADR-019 (backup to same RustFS instance), and ADR-020 (`RetentionEnforcement:Enabled=false` in Beta).

Infrastructure requirements introduced by the Beta target:

- Railway project `iab-connect-beta` with five application services and two managed PostgreSQL instances; private networking via `*.railway.internal` for datastore services.
- Public GitHub Container Registry (GHCR) images at `ghcr.io/htos/iabc-{api,web,keycloak}`, tagged `:beta` (moving, tracks the `beta` branch HEAD) and `:sha-{commit}` (immutable per build).
- GitHub Actions CI pipeline (`.github/workflows/build-images.yml`) triggered on push to the `beta` branch, building the three images with `BUILD_SHA` and `BUILD_DATE` build-args; OCI labels populate from CI environment.
- Railway volume mounted at `/data` on the `rustfs` service; buckets `iabconnect-documents` for primary storage and `backups` for daily encrypted PostgreSQL dumps with 30-day retention.
- DSGVO Article 28 data-processing agreement signed with Railway before tester onboarding (PRD Beta Environment Operations NFR).
- `backend/src/IabConnect.Api/appsettings.Beta.json` carries non-sensitive Beta defaults (Console-only Serilog, `RetentionEnforcement:Enabled=false`, `Database:AutoMigrate=true`); secrets are Railway Variables, sealed where the platform supports it.
- Daily Hangfire backup job (`daily-pg-backup`, 03:00 UTC) and retention prune job (`prune-old-backups`, 04:00 UTC) added to the existing four recurring jobs.

Open Source release surface introduced by ADR-009, ADR-010, and ADR-021:

- Repository-root files: `LICENSE` (full AGPL-3.0-or-later text), `NOTICE.md` (direct production dependency licenses from `dotnet list package` and `npm ls`), `CONTRIBUTING.md` (DCO sign-off requirement and example trailer).
- DCO sign-off enforcement via `.github/workflows/dco.yml` GitHub Actions check on protected branches `main` and `beta`.
- Backend `GET /about` endpoint (unauthenticated) returns `{ name, license, version, commitSha, buildDate, sourceUrl }`; `commitSha` and `buildDate` from Docker build-args, `sourceUrl` from `Branding:SourceUrl` config.
- Frontend `<Footer />` component on every page links to `/about` with project name, license, and Source link; reads `NEXT_PUBLIC_SOURCE_URL` for the GitHub repo link.
- OCI provenance labels on published images: `org.opencontainers.image.source`, `licenses=AGPL-3.0-or-later`, `revision=${commit}`, `created=<ISO timestamp>`.

Production considerations:

- Provider credentials must be per-environment secrets.
- Outbound webhooks and SMS/WhatsApp providers require monitoring and failure handling.
- Rate limiting should be reviewed before external API exposure.
- Backup/restore coverage must include any new tables.
- For Production (E19): `Database:AutoMigrate` defaults to `false` (manual migration path); off-site backup replication is required (single-volume failure domain accepted only in Beta per ADR-019); custom-domain migration (Keycloak hostname, redirect URIs, `Frontend__BaseUrl`) is documented in the Beta runbook; retention enforcement (ADR-020) re-enabled with audited defaults.

## Testing Architecture

### Backend

Required test types:

- Application unit tests for validators, handlers, duplicate detection rules, automation rules, cost center calculations.
- Infrastructure integration tests with Testcontainers PostgreSQL for repositories, migrations, relational constraints, merge behavior, webhook delivery persistence, and finance interactions.
- API tests for authorization, routing, serialization, and response contracts on sensitive endpoints.

Sensitive areas needing regression coverage:

- MFA/session admin support.
- Member merge.
- Paid event registration to finance records.
- Event check-in idempotency.
- Automation idempotency.
- Webhook signing/retry history.
- Finance budget/cost center reports.

### Frontend

Required test types:

- Vitest/Testing Library for shared controls, forms, permission-based rendering, validation, and API helper behavior.
- Playwright or manual validation for event check-in, paid event registration, member merge, automation setup, admin integration setup, and accessibility-critical flows.

### Acceptance Evidence

Each story should record:

- Requirement IDs covered.
- Backend tests run.
- Frontend checks run.
- Manual validation notes where browser, Keycloak, provider, or event-day behavior is involved.

## Implementation Sequencing Guidance

Recommended architecture-driven order:

1. Security and identity foundation: REQ-009, REQ-010, REQ-006.
2. Member data quality: REQ-018.
3. Event operational enhancements: REQ-023, REQ-024, REQ-025.
4. Event monetization: REQ-022, because it crosses Events and Finance.
5. Communication automation: REQ-028, then REQ-030.
6. Finance planning: REQ-044.
7. Cross-cutting quality: REQ-056, REQ-055.
8. External integration surface: REQ-058 after authorization/rate-limit/signing decisions are implemented.

This order reduces risk by stabilizing identity, member data, and event operations before adding provider integrations and externally callable APIs.

## Architecture Validation Checklist

- The design keeps IAB Connect as a modular monolith.
- Keycloak remains identity authority.
- Backend remains security boundary.
- All persistent state uses EF Core/PostgreSQL migrations.
- Background work uses Hangfire.
- External integrations are Infrastructure adapters behind Application interfaces.
- Finance changes preserve audit, retention, soft-delete, cancellation, and reversal behavior.
- Frontend work uses shared layout, typed API wrappers, next-intl, and existing UI standards.
- Each remaining Backlog requirement has an architecture path and security/testing expectations.
- The Beta deployment uses Railway-managed PostgreSQL (two instances: `postgres-app`, `postgres-kc`), a self-hosted RustFS service with a Railway volume, and outbound mail routed to Mailtrap Sandbox (ADR-018) — never to real recipients in Beta. Backups land in the same RustFS instance under the `backups` bucket with 30-day retention (ADR-019).
- Open Source license surface is present: `LICENSE` (AGPL-3.0-or-later), `NOTICE.md`, `CONTRIBUTING.md` with DCO sign-off enforcement on protected branches, unauthenticated `/about` endpoint returning `{name, license, version, commitSha, buildDate, sourceUrl}`, frontend footer linking to source, SPDX headers on new files, and OCI provenance labels on published images (ADR-009, ADR-010, ADR-014, ADR-021).
- Container images are reproducible: backend, frontend, and Keycloak images are built by GitHub Actions on push to `beta`, published to GHCR with both moving (`:beta`) and immutable per-commit (`:sha-{commit}`) tags (ADR-014).
- Backend honours `Database:AutoMigrate` (true in Beta per ADR-015; gated for Production via E19) and `RetentionEnforcement:Enabled` (false in Beta per ADR-020).
- Beta and Production share the same hardening profile (HSTS, HTTPS-redirect, strict CORS, Swagger off, Hangfire-Dashboard off); only the tester-visible BETA banner, the auto-migrate default, and the sandboxed SMTP destination differ from Production (ADR-015).

## Residual Risks

- The installed BMAD create-architecture workflow files are missing, so this document follows the available BMAD manifest/menu and local project architecture docs.
- Some source implementation details may differ from generated docs; epic/story planning should inspect relevant code before assigning work.
- Provider-specific details for Google, Microsoft Entra ID, SMS, WhatsApp, and production webhooks require environment-specific configuration decisions.
- REQ-023 remains a product/status ambiguity in the source status file; this architecture treats it as event-day workflow completion until product owners update status.
- Railway's free-tier limits and pricing changes are outside the project's control; if Railway becomes non-viable, the same architecture transplants to Hetzner Cloud + Docker Compose via the documented self-host path (ADR-011 alternatives).
- RustFS is currently pinned to the upstream `:latest` tag (ADR-013); the project should pin a specific tag once a stable release exists and document the pinning rationale.
- Mailtrap Sandbox free-tier limits (typically 100 mails/day) may be hit by a Beta with many testers; transition to a real SMTP provider or self-hosted Postal (E19-S4) is the documented escape path.
- DCO grants the rights AGPL-3.0-or-later requires but does not by itself authorize commercial dual-licensing (ADR-010); any future commercial dual-license decision requires explicit per-contributor consent.
- `NEXT_PUBLIC_API_URL` is build-time-constant in the frontend image (ADR-015); any future API-URL change (such as a custom-domain swap) requires a frontend image rebuild and redeploy. Documented in the Beta runbook.
- The Beta backup destination shares the RustFS volume with primary document storage (ADR-019); a catastrophic Railway-volume loss would take down both. This single-failure-domain risk is accepted for the Beta phase and addressed in E19 (off-site backup replication for Production).
- The retention-enforcement Hangfire job is disabled in Beta (ADR-020); retention behavior must be explicitly re-validated and re-enabled as part of Production-readiness.
- The Keycloak realm import JSON travels in the custom Keycloak image (ADR-016) and must be sanitized of any committed dev client secrets before merge.
- `docs/10_requirements_status.md` is out of sync with closed Epics E1/E2/E3/E9/E10 (PRD OD-6); a separate documentation-sync task updates that file before the Backlog-area sections in this architecture (REQ-006..058) can be marked as retrospectively complete.

