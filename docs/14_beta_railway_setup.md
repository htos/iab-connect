<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

# 14 · Beta Deployment on Railway — Setup Checklist

> **Audience.** Maintainers and self-hosters provisioning the IAB Connect Beta deployment on
> [Railway](https://railway.com) from a clean account. The checklist is **reproducible end-to-end** — every
> step in this document is something a human (Harry, a co-maintainer, a fork's first deployer)
> can re-execute against an empty Railway account and reach a working Beta in a documented
> amount of time.
>
> **Scope (Epic 13).** Wave-6 of the Beta-on-Railway pivot (SCP-2026-05-15). Closes
> **REQ-088 AC-3/AC-4/AC-5** (Railway provisioning, environment-variable surface, health probes,
> networking topology, first end-to-end deploy). Source-of-truth ADRs: ADR-011 (Beta runs on
> Railway), ADR-012 (six-service topology), ADR-013 (GitHub-driven deploy), ADR-014 (digest-pinned
> images), ADR-015 (configuration and environment), ADR-016 (custom Keycloak image), ADR-017
> (logging and health), ADR-018 (Mailtrap sandbox), ADR-020 (Beta-mode job suppression),
> ADR-021 (AGPL §13 source disclosure).
>
> **Not covered here.** Runbook for incident response (E18-S1), backup-restore drill (E19-S2),
> custom-domain wiring (E19-S1), production gate checklist (E19-S3). The checklist below
> assumes Beta runs on `*.up.railway.app` hostnames.

---

## Table of Contents

1. [Prerequisites — Harry-only manual actions before any dev-story runs](#1-prerequisites)
2. [Project creation](#2-project-creation)
3. [Service-by-service provisioning](#3-service-by-service-provisioning)
4. [GHA repo-variable population (chicken-and-egg resolution)](#4-gha-repo-variable-population)
5. [Railway variables per service](#5-railway-variables-per-service)
6. [Build-time vs runtime variables](#6-build-time-vs-runtime-variables)
7. [Secret rotation](#7-secret-rotation)
8. [Networking topology](#8-networking-topology)
9. [Health probes](#9-health-probes)
10. [First end-to-end deploy](#10-first-end-to-end-deploy)
11. [Recovery procedures](#11-recovery-procedures)
12. [Fork-replacement guidance](#12-fork-replacement-guidance)
13. [Reference: canonical service-name + image-name + hostname tables](#13-reference-tables)
14. [Two-Postgres separation verification (E15-S1)](#14-two-postgres-separation-verification-e15-s1)
15. [Daily PostgreSQL backup + restore (E15-S3)](#15-daily-postgresql-backup--restore-e15-s3)
16. [First Beta-Admin seeding (E15-S4)](#16-first-beta-admin-seeding-e15-s4)
17. [Frontend public URLs: bake + redirect-URI verification (E16-S1)](#17-frontend-public-urls-bake--redirect-uri-verification-e16-s1)
18. [End-to-end OIDC verification (E16-S2)](#18-end-to-end-oidc-verification-e16-s2)
19. [Document upload/download verification against RustFS (E16-S3)](#19-document-uploaddownload-verification-against-rustfs-e16-s3)

---

## 1. Prerequisites

> Four **BLOCKING** manual actions Harry (or the fork's first deployer) must complete **before**
> the `bmad-dev-story` for E13-S1 starts. The dev-agent cannot execute any of these — they
> require GitHub UI access, an admin account, and human judgment on package visibility.

### 1.1 DCO branch protection on `main` and `beta`

GitHub → repo → Settings → Branches → Branch protection rules. For both `main` and `beta`:

- Require status checks to pass before merging
- Required check: **`DCO`** (the workflow defined in [.github/workflows/dco.yml](../.github/workflows/dco.yml), E20-S1)
- Recommended: also require pull request reviews + dismiss stale reviews

Status (deployer to fill in): `[ ]` not configured · `[ ]` configured for `beta` only · `[ ]` configured for both.

### 1.2 Twelve GHA repository variables populated

GitHub → repo → Settings → Secrets and variables → Actions → **Variables** tab (not Secrets — these are intentionally public per [build-images.yml#L35-L51](../.github/workflows/build-images.yml#L35-L51)).

| Variable | First-deploy value | Final value (after section 4) |
|---|---|---|
| `NEXT_PUBLIC_API_URL_BETA` | `https://placeholder.up.railway.app` (or empty) | Real `api-<random>.up.railway.app` |
| `NEXT_PUBLIC_API_URL_MAIN` | empty (no production yet) | (E19) |
| `NEXT_PUBLIC_KEYCLOAK_URL_BETA` | placeholder | Real `keycloak-<random>.up.railway.app` |
| `NEXT_PUBLIC_KEYCLOAK_URL_MAIN` | empty | (E19) |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `iabconnect` | `iabconnect` (no change) |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `iabconnect-frontend` | `iabconnect-frontend` (no change) |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` | placeholder | `https://<keycloak-public-domain>/realms/iabconnect` |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_MAIN` | empty | (E19) |
| `NEXT_PUBLIC_DOCUMENT_HOST_BETA` | placeholder | RustFS proxy host (often `<rustfs-pub>.up.railway.app` only if exposed publicly; for Beta this is **n/a** because `rustfs` stays private — leave as placeholder unless a CDN proxy is wired) |
| `NEXT_PUBLIC_DOCUMENT_HOST_MAIN` | empty | (E19) |
| `NEXT_PUBLIC_ENV_LABEL_BETA` | `beta` | `beta` (no change) |
| `NEXT_PUBLIC_ENV_LABEL_MAIN` | empty | empty |

**Not on this list — `NEXT_PUBLIC_FEEDBACK_URL`.** The frontend Dockerfile declares
`ARG NEXT_PUBLIC_FEEDBACK_URL=` ([frontend/Dockerfile#L57](../frontend/Dockerfile#L57)) but
[.github/workflows/build-images.yml#L183-L193](../.github/workflows/build-images.yml#L183-L193)
does **not** pass it as a build-arg. The bake therefore always carries the empty default, and
the BETA banner falls back to `${NEXT_PUBLIC_SOURCE_URL}/issues/new?template=beta-feedback.md`
per [frontend/.env.example#L65-L70](../frontend/.env.example#L65-L70). Wiring a real feedback
channel (Discord webhook, Mailtrap address, support form) is the scope of **E18-S4**;
adding `NEXT_PUBLIC_FEEDBACK_URL_BETA` and the matching build-args line is part of that story,
not E13-S1.

**Chicken-and-egg.** The `_BETA` URLs need the Railway-assigned hostnames that are the output of
Section 3 (service creation). The resolution flow is documented in [Section 4](#4-gha-repo-variable-population).

Status: `[ ]` 0/12 set · `[ ]` 12/12 set with placeholders · `[ ]` 12/12 set with final Railway hostnames.

Quick verification via gh CLI:

```sh
# Works against any repo owned by the authenticated user / an org you're a member of:
gh api /repos/<owner>/iab-connect/actions/variables --jq '.variables[].name' | sort
# Expect 12 NEXT_PUBLIC_* names; the dedicated SOURCE_URL var is intentionally NOT in this list
# (the GHA workflow hard-codes `https://github.com/htos/iab-connect` per build-images.yml:193).
```

### 1.3 First GHCR publish on `beta` is green

`.github/workflows/build-images.yml` must have run successfully against `beta` at least once
and produced three images in GHCR. Trigger by pushing any commit to `beta` (an `--allow-empty`
commit is fine):

```sh
git checkout beta
git pull --rebase
git commit --allow-empty -s -m "chore(e13-s1): trigger first GHCR publish"
git push origin beta
```

Watch the workflow in the Actions tab; expect ~5–10 minutes. After completion the three images
appear at <https://github.com/htos?tab=packages>.

Status: `[ ]` workflow has not run · `[ ]` run failed · `[ ]` workflow run green, three packages visible.

### 1.4 GHCR package visibility = Public

For each of `iabc-api`, `iabc-web`, `iabc-keycloak`: Package settings → Danger Zone →
Change visibility → **Public**. Without this Railway's image pull fails with
`unauthorized: authentication required` because Railway does not present GHCR credentials by
default. Documented at [.github/workflows/build-images.yml#L57-L63](../.github/workflows/build-images.yml#L57-L63).

Quick verification:

```sh
# Determine first whether the owner is a user account or an organization:
gh api /users/htos --jq '.type'      # returns "User" or "Organization"

# Then query packages on the matching endpoint:
gh api /users/htos/packages?package_type=container --jq '.[] | {name, visibility}'   # for User
# OR
gh api /orgs/htos/packages?package_type=container  --jq '.[] | {name, visibility}'   # for Organization

# Either way: expect three entries with visibility: "public".
# The endpoint requires `read:packages` scope on the gh CLI token for private packages;
# public packages are also visible via https://github.com/<owner>?tab=packages without a token.
```

Status: `[ ]` 0/3 public · `[ ]` partial · `[ ]` 3/3 public.

> **All four checks must be green before Section 2 begins.** If any are red the dev-agent
> for E13-S1 will HALT at the Task 0.1 spike and surface the gap.

---

## 2. Project creation

> Story alignment: **E13-S1 AC-1** + Task 1.

### 2.1 Sign in and create the project

1. Open <https://railway.com>; sign in with the maintainer account.
2. Click **New Project** → **Empty Project** (do **not** pick a template — the topology this doc
   describes intentionally diverges from any boilerplate).
3. Name: `iab-connect-beta`. Description (copy verbatim):
   `Beta deployment of IAB Connect (AGPL-3.0-or-later, https://github.com/htos/iab-connect)`.

### 2.2 Region

Settings → Region → **Europe-West** (`europe-west4` Amsterdam). Region matters because:

- Latency to Switzerland (the testers' country) is < 25 ms vs > 100 ms for US-East.
- Data residency stays inside EU/EEA (soft DSGVO consideration; processor agreement under
  Art. 28 is the hard one — handled separately by E18-S1 / the runbook).
- The `Europe/Zurich` timezone baked into [backend/Dockerfile#L39](../backend/Dockerfile#L39)
  + the Hangfire reminder schedule (Europe/Zurich, see backend DI) aligns naturally.

### 2.3 Plan

**Recommended: Pro ($20/month)** for a real deployment serving testers. Reasoning:

- Hobby ($5/month credit) pauses services when the credit runs out — tester-visible downtime.
- Pro flips overrun into metered overage rather than pause behavior.
- Expected first-month spend at low Beta load: $10–25 (six services + 20 GB volume).

Document the actual plan choice in Section 13 below.

### 2.4 Record the project ID

After creation the dashboard URL is `https://railway.com/project/<UUID>`. Record the UUID in
[Section 13](#13-reference-tables); it is non-secret operational data.

---

## 3. Service-by-service provisioning

> Story alignment: **E13-S1 AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8** + Tasks 2–5.

The Beta topology is six services across three roles:

```
                       Public Internet
                       │           │
              ┌────────┘           └──────────┐
              ▼                                ▼
       web (Next.js)                    keycloak
       Image, port 3000                 Image, port 8080
              │                                │
              └───────────► api ◄──────────────┘
                            (.NET, port 8080)
                            │
                ┌───────────┼────────────────────┐
                ▼           ▼                    ▼
        postgres-app   postgres-kc            rustfs
        (managed PG)   (managed PG)           (volume-backed)
```

Public services: `web`, `api`, `keycloak`. Private services: `postgres-app`, `postgres-kc`, `rustfs`.
Section 8 (Networking topology) enforces this split; this section creates services in
their default state (private until Public Domain is toggled in Section 8).

### 3.1 The three image-deploy services (`web`, `api`, `keycloak`)

For each service in the order `api`, `keycloak`, `web` (lowest-to-highest user-facing dependency):

1. **New Service** → **Deploy from Image**.
2. Image (paste exact string — capitalization and namespace matter):
   - `api` → `ghcr.io/htos/iabc-api:beta`
   - `keycloak` → `ghcr.io/htos/iabc-keycloak:beta`
   - `web` → `ghcr.io/htos/iabc-web:beta`
3. Authentication: **Public** (no credentials — GHCR images are public per Section 1.4).
4. **Service name is case-sensitive.** Set exactly to `api`, `keycloak`, `web` — these are used
   by `${{<service>.<VAR>}}` Railway reference syntax in Section 5; a mistype breaks downstream
   wiring silently.
5. Settings → Deploy → enable **"Automatically deploy when new images are pushed"** on the
   `:beta` tag. This is the per-tag image-watch toggle; it defaults to OFF for image-source
   services. With it ON, Railway polls GHCR roughly every minute for new digests on the
   `:beta` tag and redeploys when the digest changes — this **is** the GitHub-driven-deploy
   mechanism for image-source services (ADR-013), because Railway cannot subscribe to
   `git push` events directly when source is "Image".
6. Replicas: **1**. Restart policy: **ON_FAILURE**, max 10 retries (the default — leave it).
7. Do **not** set any environment variables yet — Section 5 (E13-S2) covers that. The first
   deploy will crash-loop with empty env vars; that is the documented expected state until
   Section 5 is complete.

After all three are created Railway assigns each a `<service>-<random>.up.railway.app`
hostname (visible in Settings → Networking). Record these in [Section 13](#13-reference-tables) —
they are the input to Section 4.

### 3.2 The two managed Postgres services (`postgres-app`, `postgres-kc`)

For each of `postgres-app` and `postgres-kc`:

1. **New Service** → **Database** → **PostgreSQL**.
2. Name (exact case): `postgres-app` resp. `postgres-kc`.
3. Major version selector (if shown): **PostgreSQL 17** to match
   [infra/docker-compose.yml](../infra/docker-compose.yml). Railway as of 2026-06 defaults to 17;
   verify in Settings and record the actual version in [Section 13](#13-reference-tables).
4. Settings → Networking → verify **NO Public TCP Proxy** and **NO Public Domain** (Railway
   defaults to private-only for managed databases; verify nothing was changed). Section 8
   re-asserts this and verifies it.
5. Open the Variables tab; Railway auto-generates `PGUSER`, `PGPASSWORD`, `PGDATABASE`,
   `PGHOST`, `PGPORT`, `RAILWAY_PRIVATE_DOMAIN`. These will be referenced from `api` and
   `keycloak` in Section 5 (e.g. `${{postgres-app.PGUSER}}`).

**Why two Postgres instances and not one?** ADR-012 mandates migration-blast-radius isolation.
Application schema and Keycloak schema live in separate databases so a misbehaving migration
in one cannot affect the other. The two-Postgres split is verified by E15-S1; it is
non-negotiable.

**Why Railway managed Postgres and not `postgres:17` deployed as an image?** Railway managed
Postgres gives daily snapshots (layered with the application-level encrypted backups from
E15-S3 — both run), automatic credential generation that we don't have to handle,
the `PGHOST`/`PGPORT`/etc. reference variables, and zero maintenance.

### 3.3 The RustFS service (`rustfs`) — volume + admin credentials + digest pin

1. **New Service** → **Deploy from Image** → `rustfs/rustfs:latest` (upstream, first time only).
2. Service name: `rustfs`.
3. Volumes → **Add Volume** → name `rustfs-data`, mount path `/data`, size **20 GB**.
   - Sized for member documents (10–50 MB per active member at typical retention) + 30 daily
     encrypted Postgres dumps (~5–50 MB per dump per database, two databases) + headroom.
   - Hobby plan supports 5 GB free; 20 GB exceeds Hobby and bills at $0.25/GB-month ≈ $5/month
     for the volume.
   - **Volume re-size requires a redeploy** — over-provisioning at provision time is cheaper
     than re-sizing later.
4. Variables tab — set the four envs below. `RUSTFS_ROOT_PASSWORD` must be Sealed (Railway's
   encrypted-at-rest variable type); the others can be plain.

   | Variable | Value | Sealed |
   |---|---|---|
   | `RUSTFS_ROOT_USER` | strong random alphanumeric, ≥ 12 chars | No |
   | `RUSTFS_ROOT_PASSWORD` | strong random, ≥ 16 chars | **Yes** |
   | `RUSTFS_ADDRESS` | `:9000` | No |
   | `RUSTFS_CONSOLE_ADDRESS` | `:9001` (optional — skip if not exposed) | No |

   Generate with `openssl rand -base64 24` (one per value), or `pwgen -s 24 1`.

5. Networking: confirm **no Public Domain** and **no Public TCP Proxy** — Section 8
   re-asserts this. RustFS is reachable only from within the private network at
   `rustfs.railway.internal:9000`.
6. Restart policy: ON_FAILURE.
7. **Digest pin (ADR-014).** After the first successful pull:
   - Railway dashboard → service `rustfs` → Deploys → click the deployment → image manifest
     shows `sha256:<digest>`. Copy the digest.
   - Settings → Source → change source from `rustfs/rustfs:latest` to
     `rustfs/rustfs@sha256:<captured-digest>` and **Redeploy** to confirm the digest-pinned
     image still works.
   - Record the captured digest in [Section 13](#13-reference-tables).
   - Re-pinning after an intentional RustFS upgrade is a 30-second Railway edit.

**Bucket creation** (`iabconnect-documents`, `backups`) is NOT this story's scope — RustFS
auto-creates buckets via the `RUSTFS_DEFAULT_BUCKETS` env var on first boot, OR they are
created by the existing `rustfs-init` pattern reinterpreted as a Railway one-shot service
in E15-S3. For first deploy the application will create the documents bucket on demand.

### 3.4 Seed the Keycloak service with the JDBC env block

> Story alignment: **E13-S1 AC-7** + Task 5. The JDBC seed lives in **E13-S1** (not E13-S2)
> because Keycloak crash-loops without it and an empty env-var surface is hard to diagnose.

The custom Keycloak image bakes `KC_DB=postgres` at build time per
[infra/keycloak/Dockerfile](../infra/keycloak/Dockerfile) (E12-S3), but the JDBC URL is
runtime. Add these three to the `keycloak` service Variables tab now:

| Variable | Value | Sealed |
|---|---|---|
| `KC_DB_URL` | `jdbc:postgresql://${{postgres-kc.RAILWAY_PRIVATE_DOMAIN}}:${{postgres-kc.PGPORT}}/${{postgres-kc.PGDATABASE}}` | No |
| `KC_DB_USERNAME` | `${{postgres-kc.PGUSER}}` | No |
| `KC_DB_PASSWORD` | `${{postgres-kc.PGPASSWORD}}` | **Yes** |

The rest of the Keycloak env block (`KC_HOSTNAME`, `KC_PROXY`, `KC_HTTP_ENABLED`,
`KC_HEALTH_ENABLED`, `KEYCLOAK_ADMIN*`, realm-secret placeholders) is set in [Section 5](#5-railway-variables-per-service) (E13-S2).

### 3.5 Verification — six services in place

After 3.1–3.4 the project dashboard shows six services in their default state:

| # | Service | Source | First-deploy expected state |
|---|---|---|---|
| 1 | `api` | image `ghcr.io/htos/iabc-api:beta` | crash-loop (no env vars) |
| 2 | `web` | image `ghcr.io/htos/iabc-web:beta` | crash-loop (no env vars) |
| 3 | `keycloak` | image `ghcr.io/htos/iabc-keycloak:beta` | crash-loop — only the JDBC seed is in Section 3.4; `KC_HOSTNAME`, `KC_PROXY`, `KEYCLOAK_ADMIN*`, realm-import placeholders are not set until Section 5.3 |
| 4 | `postgres-app` | Railway managed | healthy |
| 5 | `postgres-kc` | Railway managed | healthy |
| 6 | `rustfs` | image `rustfs/rustfs@sha256:<digest>` | healthy (volume + admin creds set) |

Capture one screenshot of the crash logs of `api`/`web` as evidence that the GitHub-driven
auto-deploy was **triggered** (E13-S1 AC-9), and stop debugging — Section 5 + Section 9 take
the crash-loops to healthy.

---

## 4. GHA repo-variable population

> Resolves the chicken-and-egg between Section 1.2 (GHA vars need final hostnames) and
> Section 3 (Railway assigns hostnames at service creation). Story alignment:
> **E13-S1 Task 0.2** + AC-10.

After Section 3 completes, Railway has assigned each public-eligible service a hostname.
Update the 12 GHA repo variables with the real values, then trigger a fresh image build so
the `web` image bakes the correct `NEXT_PUBLIC_*_BETA` values.

### 4.1 Capture the assigned hostnames

For each of `web`, `api`, `keycloak`: Settings → Networking. Railway shows the assigned
hostname even before Public Domain is enabled (the hostname exists at service-create time;
the toggle controls whether traffic is routed). Record them:

| Service | Assigned hostname |
|---|---|
| `web` | `<web-random>.up.railway.app` |
| `api` | `<api-random>.up.railway.app` |
| `keycloak` | `<keycloak-random>.up.railway.app` |

Update [Section 13](#13-reference-tables).

### 4.2 Update the 12 GHA repo variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL_BETA` | `https://<api-public-domain>` |
| `NEXT_PUBLIC_API_URL_MAIN` | (empty until E19 production cut) |
| `NEXT_PUBLIC_KEYCLOAK_URL_BETA` | `https://<keycloak-public-domain>` |
| `NEXT_PUBLIC_KEYCLOAK_URL_MAIN` | empty |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `iabconnect` |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `iabconnect-frontend` |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` | `https://<keycloak-public-domain>/realms/iabconnect` |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_MAIN` | empty |
| `NEXT_PUBLIC_DOCUMENT_HOST_BETA` | leave as placeholder (rustfs stays private — see ADR-014) |
| `NEXT_PUBLIC_DOCUMENT_HOST_MAIN` | empty |
| `NEXT_PUBLIC_ENV_LABEL_BETA` | `beta` |
| `NEXT_PUBLIC_ENV_LABEL_MAIN` | empty |

### 4.3 Trigger the next image build

```sh
git checkout beta && git pull --rebase
git commit --allow-empty -s -m "chore(e13-s1): bake real Beta hostnames into web image"
git push origin beta
```

The GHA workflow rebuilds `iabc-web:beta` with the correct `NEXT_PUBLIC_*_BETA` bakes. Railway
detects the new digest within ~1 minute and redeploys the `web` service. Sections 5–9
configure everything else; only after Section 5 does the `web` deploy reach a healthy state.

---

## 5. Railway variables per service

> Story alignment: **E13-S2 AC-1..AC-11** + Tasks 1–6. **Every Sealed value listed below is a
> strong random generated at provisioning time.** None of these values lives in the repository;
> they exist only in the Railway dashboard + the maintainer's password manager.

### 5.1 `api` service

| Variable | Value or reference | Sealed | Rationale (consumer file:line) |
|---|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Beta` | No | Activates [appsettings.Beta.json](../backend/src/IabConnect.Api/appsettings.Beta.json) overlay per ADR-015 — Console-only Serilog, retention-disabled. |
| `ASPNETCORE_URLS` | `http://+:8080` | No | Kestrel binds to container port 8080 ([backend/Dockerfile#L71](../backend/Dockerfile#L71)). |
| `ConnectionStrings__DefaultConnection` | `Host=${{postgres-app.RAILWAY_PRIVATE_DOMAIN}};Port=${{postgres-app.PGPORT}};Database=${{postgres-app.PGDATABASE}};Username=${{postgres-app.PGUSER}};Password=${{postgres-app.PGPASSWORD}}` | **Yes** | Npgsql connection string consumed at Infrastructure/DependencyInjection.cs:53. |
| `Database__AutoMigrate` | `true` | No | Beta auto-migrates per ADR-015 / E15-S2. Set to `false` for Production manual-migration path (apply via `dotnet ef database update` in a controlled change window before api start so rolling restarts don't race the migration). Read at [Api/Program.cs `ShouldAutoMigrate`](../backend/src/IabConnect.Api/Program.cs). |
| `Keycloak__Authority` | `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect` | No | JWT bearer authority (Api/DependencyInjection.cs:139). |
| `Keycloak__ClientId` | `iabconnect-api` | No | OIDC client id / Audience (Api/DependencyInjection.cs:140). |
| `KeycloakAdmin__BaseUrl` | `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}` | No | Admin API base URL (KeycloakAdminService.cs:58). |
| `KeycloakAdmin__Realm` | `iabconnect` | No | |
| `KeycloakAdmin__ClientId` | `iabconnect-admin` | No | |
| `KeycloakAdmin__ClientSecret` | `${{keycloak.IABCONNECT_ADMIN_CLIENT_SECRET}}` | **Yes** | |
| `Auth__CalendarTokenPepper` | strong random ≥ 32 chars | **Yes** | HMAC pepper for calendar-subscription-token hashing (appsettings.json:42 comment). |
| `Frontend__BaseUrl` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | No | **CRITICAL** — strict CORS allowlist in Beta admits exactly this one origin (Api/DependencyInjection.cs:106–132). Drift = browser CORS rejection. |
| `DocumentStorage__ServiceUrl` | `http://${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000` | No | Private network, plain HTTP (Infrastructure/DependencyInjection.cs:258–259). |
| `DocumentStorage__AccessKey` | `${{rustfs.RUSTFS_ROOT_USER}}` | No | Reference, not literal — propagates RustFS username from Section 3.3. |
| `DocumentStorage__SecretKey` | `${{rustfs.RUSTFS_ROOT_PASSWORD}}` | **Yes** | Reference; source is already Sealed in `rustfs` so the reference inherits sealed semantics. |
| `DocumentStorage__BucketName` | `iabconnect-documents` | No | |
| `DocumentStorage__UseHttps` | `false` | No | Private network — no TLS overhead. |
| `Smtp__Host` | `sandbox.smtp.mailtrap.io` | No | ADR-018 Mailtrap sandbox for initial Beta — flip to real provider before non-Harry testers per deferred-work.md E13-FT-1. |
| `Smtp__Port` | `587` | No | STARTTLS. |
| `Smtp__EnableSsl` | `true` | No | |
| `Smtp__Username` | Mailtrap sandbox inbox username | **Yes** | |
| `Smtp__Password` | Mailtrap sandbox inbox password | **Yes** | |
| `Smtp__FromEmail` | `noreply@iabconnect.app` (or your verified sender domain) | No | |
| `Smtp__FromName` | `IAB Connect` | No | |
| `Email__UnsubscribeSecret` | strong random ≥ 32 chars | **Yes** | HMAC for unsubscribe-token signing (Infrastructure/Email/UnsubscribeTokenService.cs:18–19). |
| `Branding__SourceUrl` | `https://github.com/htos/iab-connect` | No | AGPL §13 disclosure consumed by `/about` (E20-S3). Forks override. |
| `InvoiceSettings__OrganizationName` | **REAL** organization name | No | Appears on every invoice PDF + Swiss QR-bill. **No placeholders.** |
| `InvoiceSettings__OrganizationAddress` | **REAL** postal address | No | Same constraint as above. |
| `InvoiceSettings__OrganizationEmail` | `info@iabconnect.app` (or real org address) | No | |
| `InvoiceSettings__PaymentInstructions` | **REAL** payment instructions paragraph | No | Same constraint as above. |
| `InvoiceSettings__Currency` | `CHF` | No | |
| `InvoiceSettings__DefaultPaymentTermDays` | `30` | No | |
| `RetentionEnforcement__Enabled` | `false` | No | ADR-020 / REQ-088 — Beta suppresses retention deletions. Belt-and-suspenders with appsettings.Beta.json. |
| `Backup__Directory` | `/tmp/backups` | No | Local cache landing path. Under E15-S3 DEC-1 Option A (hybrid local + RustFS), pg_dump writes locally first; the gzipped + encrypted copy uploads to RustFS immediately. Local copy serves the admin-UI download/restore path. |
| `Backup__BucketName` | `backups` | No | RustFS bucket name for encrypted backup objects (E15-S3 / ADR-019). Distinct from `DocumentStorage__BucketName` (`iabconnect-documents`) — two independent buckets on the same RustFS instance per ADR-019. |
| `Backup__EncryptionKey` | base64-encoded 32-byte random (44 base64 chars) | **Yes** | AES-256-GCM symmetric key for the gzipped pg_dump output (ADR-019 / E15-S3). Missing or wrong-length value fails the `PostgresBackupService` constructor fast in non-Dev / non-Testing envs — backups MUST be encrypted before upload. Read at [Infrastructure/Backup/PostgresBackupService.cs](../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs). |
| `Logging__LogLevel__Default` | `Information` | No | Matches [appsettings.Beta.json](../backend/src/IabConnect.Api/appsettings.Beta.json) line 8. |

**Not set on `api` (intentional):**

- `Branding__ApiTitle` / `Branding__ApiDescription` — defaults from
  [appsettings.json](../backend/src/IabConnect.Api/appsettings.json) carry "IAB Connect API" /
  "Member management and communication platform." which work for the canonical project; only
  forks override.
- `Hangfire__DashboardPath` — dashboard is mounted only when `IsDevelopment()` per
  backend DI (line ~293). Irrelevant on Beta.
- `Features__EInvoiceExport` — defaults to `true` from base appsettings; flip to `false` only
  if Swiss QR e-bill should be hidden.

### 5.2 `web` service

| Variable | Value or reference | Sealed | Rationale |
|---|---|---|---|
| `NEXTAUTH_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | No | NextAuth callback canonical URL ([frontend/.env.example#L22–L23](../frontend/.env.example#L22)). |
| `NEXTAUTH_SECRET` | strong random ≥ 32 chars | **Yes** | NextAuth JWT signing HMAC (middleware.ts:88). Rotating invalidates all sessions. |
| `KEYCLOAK_CLIENT_ID` | `iabconnect-frontend` | No | Server-side OIDC client id ([frontend/src/app/api/auth/[...nextauth]/route.ts:62, :96]). |
| `KEYCLOAK_CLIENT_SECRET` | `${{keycloak.IABCONNECT_FRONTEND_CLIENT_SECRET}}` | **Yes** | Server-side OIDC client secret. Three-way shared (Keycloak realm + Keycloak env + this var). |
| `KEYCLOAK_ISSUER` | `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect` | No | Server-side issuer. **MUST be byte-identical to `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`** baked at GHA build time — see Section 6 parity check. |

`NEXT_PUBLIC_*` variables are **not** set on Railway — they are baked at GHA build time
(see [Section 6](#6-build-time-vs-runtime-variables)). Setting them on Railway is harmless but
misleading; the frontend bundle ignores runtime overrides on `NEXT_PUBLIC_*`.

`NODE_ENV=production` is already baked at [frontend/Dockerfile#L94](../frontend/Dockerfile#L94);
no Railway override needed. `PORT` is Railway-auto-injected and read by Next.js standalone.

### 5.3 `keycloak` service (in addition to the JDBC seed from Section 3.4)

| Variable | Value | Sealed | Rationale |
|---|---|---|---|
| `KC_HOSTNAME` | `${{keycloak.RAILWAY_PUBLIC_DOMAIN}}` | No | Canonical hostname Keycloak emits in token issuers + OIDC discovery; mismatch breaks JWT validation. |
| `KC_PROXY` | `edge` | No | Railway terminates TLS at the edge; Keycloak trusts `X-Forwarded-*` headers. |
| `KC_HTTP_ENABLED` | `true` | No | Container speaks HTTP behind Railway's TLS terminator (refuses to start otherwise). |
| `KC_HEALTH_ENABLED` | `true` | No | Exposes `/health/ready` consumed by Section 9. |
| `KC_METRICS_ENABLED` | `false` | No | No Prometheus scrape in Beta (defer to E17). |
| `KEYCLOAK_ADMIN` | `admin` | No | Initial master-realm admin username (Keycloak 26 env-var convention). |
| `KEYCLOAK_ADMIN_PASSWORD` | strong random ≥ 16 chars | **Yes** | Initial master-realm admin password. Store in password manager **immediately**. Personal-admin migration documented in Section 11. |
| `IABCONNECT_ADMIN_CLIENT_SECRET` | strong random ≥ 32 chars | **Yes** | Resolves `${IABCONNECT_ADMIN_CLIENT_SECRET}` placeholder in [infra/keycloak/realms-beta/iabconnect-realm.json](../infra/keycloak/realms-beta/iabconnect-realm.json) at import time. Mirrors `api.KeycloakAdmin__ClientSecret`. |
| `IABCONNECT_FRONTEND_CLIENT_SECRET` | strong random ≥ 32 chars | **Yes** | Resolves the same-named placeholder in the realm import; mirrors `web.KEYCLOAK_CLIENT_SECRET`. |
| `IABCONNECT_BETA_HOST` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` (with `https://` scheme — **mandatory**) | No | Resolves `${IABCONNECT_BETA_HOST}` placeholder in the realm import → becomes the `iabconnect-frontend` client's `redirectUris[0]` (`<host>/*`) and `webOrigins[0]`. Without this set OR with a bare-hostname value (no scheme), Keycloak rejects the OIDC callback with `Invalid parameter: redirect_uri` and the first browser smoke at Section 10.4 step 4 fails. |
| `FRONTEND_PUBLIC_URL` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` (same value as `IABCONNECT_BETA_HOST` in Beta — the canonical custom domain only diverges in Production via E19-S1) | No | Resolves `${FRONTEND_PUBLIC_URL}` → becomes `redirectUris[1]` / `webOrigins[1]`. Same scheme constraint as above. |
| `JAVA_OPTS_KC_HEAP` | `-Xms256m -Xmx512m` (optional) | No | JVM tuning if Keycloak OOMs on first realm import. |

**Why `iabconnect-api` does NOT appear in this section.** The `iabconnect-api` Keycloak client
is declared `"bearerOnly": true` in [infra/keycloak/realms-beta/iabconnect-realm.json](../infra/keycloak/realms-beta/iabconnect-realm.json)
(line 242) — bearer-only clients do not authenticate to Keycloak; they only validate inbound
JWTs. There is no `${IABCONNECT_API_CLIENT_SECRET}` placeholder in the realm JSON, no consumer
in the backend ([grep returns 0 hits](../backend/src) for any code that reads `Keycloak__ClientSecret`),
and therefore no need for an `IABCONNECT_API_CLIENT_SECRET` on the `keycloak` service. If a
future story flips the client to non-bearer-only (e.g., to call `/connect/token` from the API),
add the secret + placeholder + consumer in lockstep.

**Three-way client-secret sharing** (applies to `iabconnect-admin` and `iabconnect-frontend`
only). Each non-bearer-only client secret lives in three places:

1. `${IABCONNECT_ADMIN_CLIENT_SECRET}` / `${IABCONNECT_FRONTEND_CLIENT_SECRET}` placeholder in
   the imported realm JSON → Keycloak substitutes at realm-import time and stores the resolved
   value in its DB.
2. `IABCONNECT_ADMIN_CLIENT_SECRET` / `IABCONNECT_FRONTEND_CLIENT_SECRET` on the `keycloak`
   service Variables tab (this section).
3. The consuming service's variable (`api.KeycloakAdmin__ClientSecret`,
   `web.KEYCLOAK_CLIENT_SECRET`) is set as a **reference** `${{keycloak.IABCONNECT_*_CLIENT_SECRET}}`
   so a single source-of-truth change in Keycloak propagates to consumers.

If a consumer's variable is set as a **literal** (paste) instead of a reference, drift becomes
possible and a future rotation will silently break consumer authentication with `401 Unauthorized`
on the token endpoint. Use references, not literals.

### 5.4 `rustfs` service

Section 3.3 already sets `RUSTFS_ROOT_USER` / `RUSTFS_ROOT_PASSWORD` / `RUSTFS_ADDRESS`
/ `RUSTFS_CONSOLE_ADDRESS`. No further variables are required in Section 5.

### 5.5 `postgres-app` and `postgres-kc`

Railway-managed; the auto-generated `PGUSER` / `PGPASSWORD` / `PGDATABASE` / `PGHOST` /
`PGPORT` / `RAILWAY_PRIVATE_DOMAIN` are referenced by `api` (resp. `keycloak`) and are not
overridden manually.

---

## 6. Build-time vs runtime variables

> Story alignment: **E13-S2 Task 0.3**. Frequent operator-confusion source: setting a
> `NEXT_PUBLIC_*` on Railway expecting it to take effect at runtime. It does not.

### 6.1 Build-time (baked into the image at GHA `docker build`)

| Variable | Image | Source | Producer story |
|---|---|---|---|
| `BUILD_SHA` | `iabc-api` | `${{ github.sha }}` | E20-S5 |
| `BUILD_DATE` | `iabc-api` | `${{ github.event.head_commit.timestamp }}` | E20-S5 |
| `NEXT_PUBLIC_API_URL` | `iabc-web` | `vars.NEXT_PUBLIC_API_URL_BETA` | E13-S1 + E20-S5 |
| `NEXT_PUBLIC_KEYCLOAK_URL` | `iabc-web` | `vars.NEXT_PUBLIC_KEYCLOAK_URL_BETA` | E13-S1 + E20-S5 |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | `iabc-web` | `vars.NEXT_PUBLIC_KEYCLOAK_REALM` | E20-S5 |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | `iabc-web` | `vars.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | E20-S5 |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER` | `iabc-web` | `vars.NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` | E13-S1 + E20-S5 |
| `NEXT_PUBLIC_DOCUMENT_HOST` | `iabc-web` | `vars.NEXT_PUBLIC_DOCUMENT_HOST_BETA` | E20-S5 |
| `NEXT_PUBLIC_ENV_LABEL` | `iabc-web` | `vars.NEXT_PUBLIC_ENV_LABEL_BETA` | E11-S2 + E20-S5 |
| `NEXT_PUBLIC_SOURCE_URL` | `iabc-web` | hard-coded `https://github.com/htos/iab-connect` | E20-S4 |
| `KC_DB` (=`postgres`) | `iabc-keycloak` | Dockerfile `ARG KC_DB=postgres` baked via `kc.sh build --optimized` | E12-S3 |

Note: the build-images.yml `build-args` block also passes `BUILD_SHA` / `BUILD_DATE` to the
`iabc-web` matrix entry, but [frontend/Dockerfile](../frontend/Dockerfile) does not declare
matching `ARG` directives, so Docker silently drops them — the web image carries no commit
stamp. The backend's `/about` endpoint (E20-S3) is the canonical commit-SHA cross-reference
per Section 11.4. A frontend equivalent would require declaring `ARG BUILD_SHA` / `ARG BUILD_DATE`
in the frontend Dockerfile and projecting them through a small surface (deferred to E17-era
observability work, not E13).

Changing any build-time variable requires a fresh `docker build` and a new push to `:beta`.

### 6.2 Runtime (read by the container at startup or per-request)

All `__`-syntax `.NET` variables on `api` (Section 5.1). All `NEXTAUTH_*` + server-side
`KEYCLOAK_*` variables on `web` (Section 5.2). All `KC_*` variables on `keycloak`
(Section 5.3) **except `KC_DB`** which is build-time-frozen under `start --optimized`.
`RUSTFS_*` variables on `rustfs`.

Runtime variable changes apply on the next deploy of that service (Railway redeploys
automatically when a variable is edited).

### 6.3 The `KEYCLOAK_ISSUER` parity invariant

A frequent silent-failure mode in OIDC deployments: the build-time-baked
`NEXT_PUBLIC_KEYCLOAK_ISSUER` and the runtime-set `KEYCLOAK_ISSUER` (on `web`) and the
runtime-set `Keycloak__Authority` (on `api`) MUST be **byte-identical strings**. They are
also tightly coupled to two other anchors that drift in the same family of failures:
`keycloak.KC_HOSTNAME` (Section 5.3 — what Keycloak emits as the `iss` claim) and
`api.KeycloakAdmin__BaseUrl` (Section 5.1 — what the backend's admin SPI calls). All five
must point at the same canonical Keycloak public domain.

Run the full 5-anchor diff after Section 5 is complete:

```sh
# Capture the canonical value once (Railway-assigned hostname of the keycloak service):
KC_HOST="<your-keycloak-public-domain>"   # no scheme — e.g. keycloak-abc123.up.railway.app
EXPECTED_ISSUER="https://${KC_HOST}/realms/iabconnect"
EXPECTED_ADMIN_BASE="https://${KC_HOST}"

# 1. Build-time bake (GHA repo var):
gh api /repos/htos/iab-connect/actions/variables/NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA --jq .value

# 2-5: Copy the following Railway Variable values into a shell var, then `echo "$ISSUER_2"` etc.
#      Railway does not expose env-var values via CLI without `railway run`, so the diff is
#      copy-paste-then-shell. Compare each against $EXPECTED_ISSUER / $EXPECTED_ADMIN_BASE:
#
#   - web.KEYCLOAK_ISSUER                 → must equal $EXPECTED_ISSUER
#   - api.Keycloak__Authority             → must equal $EXPECTED_ISSUER
#   - keycloak.KC_HOSTNAME                → must equal $KC_HOST (bare hostname, no scheme)
#   - api.KeycloakAdmin__BaseUrl          → must equal $EXPECTED_ADMIN_BASE
```

Drift between any two of these causes the browser-initiated login to start at issuer A and
end at issuer B → token validation rejects the result silently (the user sees a 404 or
redirect-loop with no clear log line on the api side). `KC_HOSTNAME` carrying a scheme
prefix (`https://...`) instead of a bare hostname is a particularly common authoring mistake
— Keycloak treats the literal as a host string and the resulting issuer URL becomes
`https://https://...` which fails validation everywhere downstream.

---

## 7. Secret rotation

> Story alignment: **E13-S2 Task 6.4**. A separate-from-provisioning runbook section so
> "rotate this thing" is a 60-second action with known blast radius.

| Sealed value | What rotation does | What breaks during the gap |
|---|---|---|
| `Auth__CalendarTokenPepper` | Invalidates existing `.ics` calendar-subscription tokens; users must re-fetch their feed URL from the app. | Calendar feed URLs in external subscribers (Google Cal / Outlook) return 401 until users re-fetch. |
| `Email__UnsubscribeSecret` | Invalidates existing unsubscribe links in already-sent emails. | Already-sent emails' unsubscribe links break; new emails fine. |
| `Backup__EncryptionKey` | New backups encrypt with new key; old backups remain decryptable only with old key — **archive the old key** before rotation. | None for live system; restore from old backup needs the old key. |
| `NEXTAUTH_SECRET` | All NextAuth JWT sessions are invalidated. | All signed-in users are kicked out and must re-login. |
| `RUSTFS_ROOT_PASSWORD` | Document upload + backup write breaks until `api`'s `DocumentStorage__SecretKey` reference is reseated (Railway auto-resolves the reference on next deploy). | ~30s during `api` redeploy. |
| `KEYCLOAK_ADMIN_PASSWORD` | Master-realm admin login uses new password. | None — the env-var-seeded admin is rarely used; rotate freely. After personal admin works (Section 11) the env-var admin is removed entirely. |
| `IABCONNECT_API_CLIENT_SECRET` | OIDC handshake between `api` and `keycloak` breaks until **all three** anchors are updated: realm DB (re-import or Admin Console edit), Keycloak service env var, and `api.Keycloak__ClientSecret` reference (auto-resolves on `api` redeploy). | If realm DB and env var drift: `api` returns 401 on every `/connect/token` exchange → users can authenticate to Keycloak but `api` rejects their tokens. |
| `IABCONNECT_ADMIN_CLIENT_SECRET` | Same as above for the admin SPI client. | Backend user-provisioning ops break. |
| `IABCONNECT_FRONTEND_CLIENT_SECRET` | Same as above for the frontend client. | Login flow breaks at Keycloak token-exchange step. |
| `Smtp__Password` | Outbound mail (password-reset, invoice, dunning, volunteer-reminder) fails. | All outbound mail queues up; verify Hangfire job state recovers when password is fixed. |

**Rotation procedure (generic):**

1. Generate new value (`openssl rand -base64 24` or `pwgen -s 32 1`).
2. Update the Sealed variable in Railway → service auto-redeploys.
3. For Keycloak client secrets: also edit the realm DB via Admin Console → Clients → secret → Regenerate, OR re-import the realm with the new env-var.
4. Verify with a smoke flow (see Section 10 browser smoke).

---

## 8. Networking topology

> Story alignment: **E13-S3 AC-1..AC-10** + Tasks 1–8.

### 8.1 Public services (Public Domain ON)

| Service | Public hostname | Exposed port | TLS source |
|---|---|---|---|
| `web` | `<web-public-domain>` | 3000 ([frontend/Dockerfile#L117](../frontend/Dockerfile#L117)) | Railway-managed Let's Encrypt |
| `api` | `<api-public-domain>` | 8080 ([backend/Dockerfile#L71](../backend/Dockerfile#L71)) | Railway-managed Let's Encrypt |
| `keycloak` | `<keycloak-public-domain>` | 8080 (Keycloak default) | Railway-managed Let's Encrypt |

To enable: each service → Settings → Networking → **Generate Public Domain**. TLS cert
issuance typically completes within ~30 seconds; the domain is globally resolvable within
a few minutes.

### 8.2 Private services (Public Domain OFF, TCP Proxy OFF)

| Service | Private hostname | Port | Public toggle state |
|---|---|---|---|
| `postgres-app` | `postgres-app.railway.internal` | 5432 | Public Domain **OFF**, TCP Proxy **OFF** |
| `postgres-kc` | `postgres-kc.railway.internal` | 5432 | Public Domain **OFF**, TCP Proxy **OFF** |
| `rustfs` | `rustfs.railway.internal` | 9000 (and console 9001) | Public Domain **OFF**, TCP Proxy **OFF** |

These services are reachable **only** from within the project private network. Verify in
each service's Settings → Networking that neither toggle is on.

### 8.3 External reachability verification (run from outside Railway)

Run from a developer workstation NOT inside Railway (Harry's laptop). Public services
should respond; private services should time out / fail DNS:

```sh
# --- PUBLIC services — should respond ---
curl -fIv https://<web-public-domain>/                                                       # expect 200 or 30x→200
curl -fIv https://<api-public-domain>/health/ready                                           # expect 200 (or 503-acceptable until Section 9)
curl -fIv https://<keycloak-public-domain>/realms/iabconnect/.well-known/openid-configuration  # expect 200, JSON body

# --- PRIVATE services — should fail at DNS resolution ---
# First, prove DNS itself fails (no host found). `dig +short` returns empty AND non-zero,
# distinguishing "this host doesn't exist" from "this host exists but the network is slow":
dig +short postgres-app.railway.internal     # expect: empty output AND exit code != 0
dig +short postgres-kc.railway.internal      # expect: empty output AND exit code != 0
dig +short rustfs.railway.internal           # expect: empty output AND exit code != 0

# Then, sanity-check the network actually tries to reach them (these should fail fast).
# `-w` on psql disables the interactive password prompt so `timeout 10` measures network,
# not stdin. Without -w, psql hangs on the password prompt for the full timeout budget and
# the output looks identical to a successful timeout — false PASS.
PGPASSWORD=irrelevant timeout 10 psql -h postgres-app.railway.internal -U postgres -p 5432 -w -c 'select 1'
PGPASSWORD=irrelevant timeout 10 psql -h postgres-kc.railway.internal -U postgres -p 5432 -w -c 'select 1'
timeout 10 curl http://rustfs.railway.internal:9000/
# All three: expect "could not translate host name" / "Could not resolve host" / "name resolution failure".
```

`*.railway.internal` is not in the public DNS, so the negative tests rely on **DNS resolution
failure** rather than connection timeout. A captive-portal or split-tunnel resolver that
returns a synthetic NXDOMAIN with delay can otherwise stall the timeout budget and mask a
real DNS success — running `dig` first catches that. Document the actual output (the
`dig +short` empty results + the error strings from the network attempts) in the
Quality-Gates evidence column of the story.

### 8.4 Internal reachability verification (deploy-log inspection)

Inside Railway, `api` and `keycloak` resolve datastore dependencies via `*.railway.internal`.
Verify by redeploying each service and inspecting the Logs tab:

- `api` boot log must include a successful Npgsql connection to
  `postgres-app.railway.internal:5432` within ~5 seconds.
- `keycloak` boot log must include `KC-SERVICES0009` ("Added user 'admin' to realm 'master'")
  and `Keycloak ... started in N.NNs`.
- `api` first request that touches RustFS shows the AWS S3 client targeting
  `http://rustfs.railway.internal:9000/...`.

### 8.5 CORS allowlist verification (Beta strict-allowlist branch)

Beta runs the production-hardening branch per ADR-015 — strict CORS via
[backend DI](../backend/src/IabConnect.Api/DependencyInjection.cs) admits exactly one origin
(`Frontend__BaseUrl`). Verify:

```sh
# Sanity — canonical origin should be allowed
curl -i -X OPTIONS \
  -H 'Origin: https://<web-public-domain>' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization, content-type' \
  https://<api-public-domain>/api/members
# Expect: Access-Control-Allow-Origin: https://<web-public-domain>

# Hostile preflight — random origin must NOT be echoed back
curl -i -X OPTIONS \
  -H 'Origin: https://evil.example.com' \
  -H 'Access-Control-Request-Method: GET' \
  https://<api-public-domain>/api/members
# Expect: NO Access-Control-Allow-Origin header (or one set to <web-public-domain>, NOT evil.example.com)
```

### 8.6 HTTPS redirect + HSTS verification

```sh
# HTTPS redirect (Railway edge may handle this transparently; either path acceptable)
curl -i http://<web-public-domain>/                  # expect 301/308 to https
curl -i http://<api-public-domain>/health/ready      # expect 301/308 to https

# HSTS header on HTTPS responses
curl -sI https://<api-public-domain>/health/ready | grep -i strict-transport-security
# Expect: Strict-Transport-Security: max-age=2592000 (30 days, ASP.NET default)
```

The 30-day HSTS default is the **initial** state. E14-S2 bumps to ≥ 6 months +
`includeSubDomains` before non-Harry testers are onboarded. Tracked at
deferred-work.md E13-FT-3.

### 8.7 Why TCP Proxy is explicitly NOT enabled for Postgres

Even with the Postgres user/password Sealed, exposing port 5432 publicly is a defense-in-depth
loss with no ergonomic benefit:

- Maintainers can reach `postgres-app` via Railway CLI tunnel for ad-hoc queries:
  `railway run --service postgres-app psql`.
- A future requirement for public Postgres access (e.g. an analytics workload) becomes its own
  story with its own threat-model review — not a side effect of E13-S3.

If a future maintainer wonders "should I enable TCP Proxy for ad-hoc psql?" the answer is
**no**; use Railway CLI tunneling.

---

## 9. Health probes

> Story alignment: **E13-S4 AC-1..AC-3** + Task 2. **AC-9 cross-story orthogonal-AC verification** + Task 6.1.

### 9.1 Per-service healthcheckPath

For each service, Settings → Deploy → Healthcheck Path. Save.

| Service | healthcheckPath | Timeout | Producer file (in-image HEALTHCHECK) |
|---|---|---|---|
| `api` | `/health/ready` | **60 seconds** (absorbs first-startup EF migrations per ADR-015 + Keycloak cold-start) | [backend/Dockerfile#L73–L74](../backend/Dockerfile#L73) (`curl -fsS /health/ready`) |
| `web` | `/api/health` | **60 seconds** (Next.js standalone cold-start + JIT compile of `/api/health` on first request can take 20–30 s on a small Hobby plan; 60 s absorbs that without false-failing the first deploy) | [frontend/Dockerfile#L121–L122](../frontend/Dockerfile#L121) probes `/` separately — both probes must pass for the container to be marked healthy |
| `keycloak` | `/health/ready` | **30 seconds** (requires `KC_HEALTH_ENABLED=true` set in Section 5.3) | Keycloak built-in |

The `web` healthcheckPath `/api/health` is implemented by
[frontend/src/app/api/health/route.ts](../frontend/src/app/api/health/route.ts), a small
Next.js Route Handler returning `Response.json({ status: "ok" }, { status: 200 })`.

### 9.2 Healthcheck-path parity (Railway vs in-image HEALTHCHECK)

| Service | Railway probes | In-image HEALTHCHECK probes | Both must pass |
|---|---|---|---|
| `api` | `/health/ready` | `/health/ready` | Yes |
| `keycloak` | `/health/ready` | `/health/ready` | Yes |
| `web` | `/api/health` | `/` | **Yes** (Railway-level + in-image both gate readiness) |

### 9.3 Behavior under probe failure

Railway uses atomic-swap deploy semantics: if a new deploy fails its healthcheck within the
configured timeout, Railway aborts the new deploy and keeps the previous version running.
Tester-visible downtime is zero for unhealthy deploys.

Cascade behavior: `keycloak` down → `api`'s `KeycloakHealthCheck` fails → `/health/ready`
returns 503 on `api` → Railway marks `api` unhealthy even though Postgres is fine. The
top-of-funnel is always Keycloak; if `api` is red, check `keycloak` first.

---

## 10. First end-to-end deploy

> Story alignment: **E13-S4 AC-4, AC-7** + Tasks 3–4.

### 10.1 Pre-flight checklist

Before triggering the first deploy, confirm:

- [ ] All four Section 1 prerequisites green.
- [ ] All six services provisioned (Section 3) and assigned Railway hostnames.
- [ ] All 12 GHA repo variables populated with **real** Railway hostnames (Section 4).
- [ ] GHA `build-images.yml` re-run after Section 4 update (Section 4.3 trigger commit).
- [ ] All Section 5 variables set per service (`api`, `web`, `keycloak`, `rustfs`).
- [ ] Section 8 networking enabled (3 public + 3 private, verified).
- [ ] Section 9 healthcheckPath configured per service.

### 10.2 Trigger the deploy

Either:

- Push a fresh commit to `beta` (any change). GHA rebuilds images → Railway detects new
  digest → all three image services redeploy.
- Or trigger a manual redeploy of each service from Railway dashboard (faster if Section 4.3
  already ran and the image is up to date).

### 10.3 Watch the deploys

Open the Deploys tab of each service in parallel:

- `api`: pulls new digest → boot → EF migrations execute (visible in logs) → `/health/ready=200`
  within ~60 seconds → marked healthy.
- `keycloak`: pulls new digest → JDBC connect to `postgres-kc.railway.internal:5432` → realm
  import → `/health/ready=200` within ~30 seconds → marked healthy.
- `web`: pulls new digest → Node boot → `/api/health=200` within ~10 seconds → marked healthy.

### 10.4 Browser smoke (mandatory — only way to catch CORS/issuer/cookie-domain bugs)

1. Open `https://<web-public-domain>/` in an incognito browser. Expect the landing page,
   no CORS errors in the console.
2. Sign in to the Keycloak Admin Console at `https://<keycloak-public-domain>/admin/`
   as the env-var-seeded `admin` / `KEYCLOAK_ADMIN_PASSWORD`.
3. Switch the realm dropdown (top-left) from `master` to `iabconnect`. Create a test user
   `<your-admin-email>` (e.g. the maintainer's address) with a password. On the **Role mappings**
   tab → **Assign role** → filter `By realm roles` and add **`admin`** (lowercase — the canonical
   realm-admin role per [Roles.cs#L16](../backend/src/IabConnect.Api/Authorization/Roles.cs#L16)
   and [iabconnect-realm.json#L167](../infra/keycloak/realms-beta/iabconnect-realm.json#L167);
   the backend's `RequireAdmin` policy at [DependencyInjection.cs#L171](../backend/src/IabConnect.Api/DependencyInjection.cs#L171)
   matches on `Roles.Admin = "admin"`).
4. Back at `https://<web-public-domain>/` click **Login** → redirected to Keycloak →
   enter test-user credentials → redirected back to the authenticated dashboard.
5. Navigate to `https://<api-public-domain>/health/detail` while signed in (or via Postman
   with the bearer token). Expect HTTP 200 with `entries[]` including
   `database: Healthy` and `keycloak: Healthy`.

The `/health/detail` JSON output **is** the gold-standard verification of the live wiring —
`database: Healthy` proves `postgres-app` reachability + the connection string + EF migrations
ran; `keycloak: Healthy` proves Keycloak's OIDC discovery endpoint is up AND `Keycloak__Authority`
on `api` points at it correctly AND the realm import worked.

### 10.5 Realm-issuer triangle (live verification)

The OIDC-issuer parity invariant from Section 6.3 + Section 5.3 is **live-verified** the
moment `/health/detail` reports `keycloak: Healthy`. The check is structural (string-equal) at
configuration time but only end-to-end at first deploy. If `keycloak: Healthy` returns
`Unhealthy` with a "discovery document mismatch" message, drift exists — re-run the Section
6.3 diff before debugging anything else.

### 10.6 External-monitoring contract (forward-link to E17-S4)

The `api`'s `/health/ready` endpoint is designed to be polled by an external uptime monitor
(UptimeRobot or BetterStack) every 5 minutes with 3-consecutive-failure alerting per the NFR.
E13-S4 does not wire the monitor; E17-S4 does. This story verifies the endpoint is publicly
reachable and stable enough to support eventual polling.

---

## 11. Recovery procedures

### 11.1 `api` won't go healthy

Most common: env-var typo (Section 5.1 — re-verify), CORS string mismatch
(`Frontend__BaseUrl` ≠ `<web-public-domain>`), Keycloak admin password drift, or
EF migration failure on first run.

Inspect via the Railway CLI without modifying any code:

```sh
# Inject the api service's env-vars into a local shell, then call its container directly.
# `railway run` evaluates the command on the local machine with the service's env-vars
# bound — it does NOT shell into the container. For an in-container probe, prefer
# `railway shell --service api` (where supported) and run `curl http://localhost:8080/health/detail`
# from inside the container.
railway shell --service api
# then, inside:
curl -s http://localhost:8080/health/detail | jq .
```

If `railway shell` isn't available on the current Railway plan, use the Railway dashboard's
"Open shell" button on the service's Deploys tab. **Do not** lift `RequireAuthorization("RequireAdmin")`
on `/health/detail` in source code as a debug shortcut — the in-container probe above
covers the same diagnosis without a code change that could leak past merge.

### 11.2 `keycloak` won't go healthy / admin can't sign in

Chicken-and-egg: Keycloak admin login is needed to fix Keycloak, but Keycloak is the thing
that's broken. Recovery paths:

1. **Roll back via Railway**: redeploy the previous good `:sha-<commit>` immutable tag
   via Railway dashboard → Settings → Source → edit image to `ghcr.io/htos/iabc-keycloak:sha-<previous-commit>` → Redeploy.
2. **Seed a recovery admin from inside the Keycloak container.** Open a shell on the running
   `keycloak` service (Railway dashboard → keycloak → Deploys → "Open shell", or
   `railway shell --service keycloak` if your plan supports it), then use Keycloak 26's
   `bootstrap-admin user` subcommand. The password is read from an env var, not a flag literal:

   ```sh
   # Inside the keycloak container (the kc.sh binary is on $PATH; the database is already wired):
   export KC_BOOTSTRAP_ADMIN_PASSWORD='<new-strong-random>'
   kc.sh bootstrap-admin user --username recovery --password:env KC_BOOTSTRAP_ADMIN_PASSWORD
   ```

   `bootstrap-admin user` always targets the `master` realm — there is no `--realm` flag.
   This command works only when the `master` realm currently has zero admin users; if an
   admin still exists, log in as that admin via Admin Console instead.
3. **Force-pull `:beta`**: change the image to a different tag and back to `:beta` to force
   a clean pull. **Caveat**: `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` only seed the master
   admin on the very first boot against an empty database — they are **not** re-applied to an
   existing database. If `postgres-kc` retains state, the existing admin (and existing realm,
   client secrets, users, federation state) persists across the redeploy. If `postgres-kc`
   has been wiped, the redeploy re-imports the realm from
   [infra/keycloak/realms-beta/iabconnect-realm.json](../infra/keycloak/realms-beta/iabconnect-realm.json)
   and re-seeds the admin — **but** any post-import secret rotations done via the Admin Console
   (Section 7) are lost because the realm-import JSON contains the placeholder `${IABCONNECT_*_CLIENT_SECRET}`
   values, not the rotated values. Plan accordingly before deciding to force-pull on a partially
   broken Keycloak.

### 11.3 Personal-admin migration (post-first-deploy hardening)

After the first deploy is stable, replace the env-var-seeded `admin` with a personal account
attributed to a real user:

1. Sign in as `admin` → Master realm → Users → Add user `<your-admin-email>`.
2. Credentials tab → set permanent password (store in password manager).
3. Role mappings → assign `admin` role from the master realm.
4. Verify the personal admin can sign in (use a private/incognito browser).
5. Use the personal admin for ~1 week of normal Beta operations.
6. After 1 week clean → delete the env-var-seeded `admin` from the master realm AND remove
   `KEYCLOAK_ADMIN` + `KEYCLOAK_ADMIN_PASSWORD` from the `keycloak` service Variables tab.

The env-var pair stays in Railway as chicken-and-egg insurance during the first week.
Tracked at deferred-work.md E13-FT-5.

### 11.4 Rollback a bad deploy

Per ADR-014, rollback for image-source services is redeploying a specific
`:sha-<40-char-commit>` immutable tag via Railway dashboard. The `:beta` tag is overwritten
on every push and is **not** a rollback target. Cross-reference the commit SHA via the
`/about` endpoint (E20-S3) to see what is actually running.

### 11.5 RustFS data loss prevention

The `rustfs-data` volume (Section 3.3) is the durability boundary. Railway redeploys of
the `rustfs` service do not delete the volume; only explicit volume deletion does. The
volume is also where E15-S3's daily encrypted Postgres backups land — losing it loses
both documents and backups.

---

## 12. Fork-replacement guidance

A fork of `htos/iab-connect` setting up its own Beta needs to substitute three things:

1. **GHCR namespace.** Edit [.github/workflows/build-images.yml#L109](../.github/workflows/build-images.yml#L109)
   `IMAGE_NAMESPACE: htos` to the fork's GitHub username/org. Push to `beta`; GHA will publish
   to the new namespace.
2. **Railway image-deploy URLs.** In each of `api`, `web`, `keycloak` services on the fork's
   Railway project, edit the image source from `ghcr.io/htos/iabc-<name>:beta` to
   `ghcr.io/<fork>/iabc-<name>:beta`.
3. **`Branding__SourceUrl` (api) + `NEXT_PUBLIC_SOURCE_URL` build-arg (web).** The backend
   `Branding__SourceUrl` is a runtime Railway env var on the `api` service — override there.
   The frontend `NEXT_PUBLIC_SOURCE_URL` is **hard-coded** in [build-images.yml#L193](../.github/workflows/build-images.yml#L193)
   (`NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect`) rather than read from a
   `vars.*` repo variable. A fork must edit that line in the workflow file — adding a Railway
   env var or a repo variable named `NEXT_PUBLIC_SOURCE_URL` has no effect because the
   workflow's `build-args` block doesn't read either. Once the workflow file is edited, the
   change propagates to the next `:beta` image build. This ensures the AGPL §13 source-disclosure
   links on the `/about` endpoint and license footer point at the fork's repository, not the upstream.

GHCR package visibility (Section 1.4) must be set to Public on the fork's packages as well.

---

## 13. Reference tables

> Per-deployment values. Replace placeholders with the real values captured during provisioning.
> Non-secret only — Sealed values live exclusively in Railway + a password manager.

### 13.1 Project + plan

| Field | Value |
|---|---|
| Railway project name | `iab-connect-beta` |
| Project UUID | `<populate after Section 2.4>` |
| Region | `europe-west4` (Amsterdam) |
| Plan | `<populate: Hobby / Pro / Team>` |
| Provisioned at | `<YYYY-MM-DD>` |
| Provisioned by | `<maintainer email>` |

### 13.2 Service inventory

| Service | Source | Internal hostname | Public hostname | Notes |
|---|---|---|---|---|
| `api` | `ghcr.io/htos/iabc-api:beta` | `api.railway.internal:8080` | `<populate>.up.railway.app` | |
| `web` | `ghcr.io/htos/iabc-web:beta` | `web.railway.internal:3000` | `<populate>.up.railway.app` | |
| `keycloak` | `ghcr.io/htos/iabc-keycloak:beta` | `keycloak.railway.internal:8080` | `<populate>.up.railway.app` | |
| `rustfs` | `rustfs/rustfs@sha256:<populate digest>` | `rustfs.railway.internal:9000` | n/a | Volume `rustfs-data` 20 GB at `/data` |
| `postgres-app` | Railway managed PG 17 | `postgres-app.railway.internal:5432` | n/a | App schema |
| `postgres-kc` | Railway managed PG 17 | `postgres-kc.railway.internal:5432` | n/a | Keycloak schema |

### 13.3 Cross-references

- AGPL license + `/about` endpoint contract: [E20-S3](../_bmad-output/implementation-artifacts/e20-s3-add-backend-about-endpoint.md) / ADR-021.
- License footer + `NEXT_PUBLIC_SOURCE_URL`: [E20-S4](../_bmad-output/implementation-artifacts/e20-s4-add-frontend-license-footer.md).
- GHCR publish workflow: [.github/workflows/build-images.yml](../.github/workflows/build-images.yml) (E20-S5).
- DCO workflow: [.github/workflows/dco.yml](../.github/workflows/dco.yml) (E20-S1).
- Local Beta-shape testing (no Railway burn): README "Option 4: Local Beta-shape testing (full overlay)" + [infra/docker-compose.full.yml](../infra/docker-compose.full.yml) (E12-S4).
- Architecture decision records: [_bmad-output/planning-artifacts/architecture.md](../_bmad-output/planning-artifacts/architecture.md) ADR-011..021.
- Frontend image bake + Keycloak realm redirect URIs: [E16-S1](../_bmad-output/implementation-artifacts/e16-s1-verify-frontend-public-urls.md) — see [Section 17](#17-frontend-public-urls-bake--redirect-uri-verification-e16-s1).
- End-to-end OIDC walkthrough + JWT `iss` parity (runtime): [E16-S2](../_bmad-output/implementation-artifacts/e16-s2-validate-end-to-end-oidc-in-beta.md) — see [Section 18](#18-end-to-end-oidc-verification-e16-s2).
- Document upload/download against RustFS + two-bucket separation invariant: [E16-S3](../_bmad-output/implementation-artifacts/e16-s3-validate-document-upload-against-rustfs.md) — see [Section 19](#19-document-uploaddownload-verification-against-rustfs-e16-s3).

---

## 14. Two-Postgres separation verification (E15-S1)

> Story alignment: **E15-S1** — REQ-088 AC-3. Validates the ADR-012 migration-blast-radius
> isolation invariant against the live Beta project. Re-run whenever a PG credential rotates
> or whenever either Postgres service is rebuilt (e.g., after a Railway-side schema reset).
>
> **Why this section is separate from Section 8 (Networking topology).** Section 8 verifies the
> *transport-layer* isolation (from outside Railway, `dig postgres-app.railway.internal` fails;
> the public hostname doesn't route). This section verifies the *data-layer* isolation: even
> from inside Railway with valid credentials for one DB, the other DB's user store / migration
> history / row data are unreachable. ADR-012 calls the latter "migration safety" — the
> verifiable promise that an EF Core migration in the application's bounded context cannot
> accidentally touch Keycloak's realm tables. These are distinct security properties: Section 8
> covers attacker-from-internet; Section 14 covers attacker-with-one-leaked-credential.
>
> **All verification commands are non-destructive** — every check is read-only
> (`SELECT version()`, `\dt`, attempted-but-failing `psql -c 'SELECT 1'`). Do NOT run a
> destructive `DROP DATABASE` or `DROP SCHEMA` to "prove" the separation.

### 14.1 Service inventory

Run from a shell with the Railway CLI authenticated to the `iab-connect-beta` project and the
Beta environment selected (`railway environment` reports `beta`):

```sh
railway service list --json | jq '.[] | {name, plugin}'
```

Expected output shape (two managed PG services + the four application services from Section 13.2):

```json
{ "name": "postgres-app", "plugin": "PostgreSQL" }
{ "name": "postgres-kc",  "plugin": "PostgreSQL" }
```

PostgreSQL major-version probe per service:

```sh
railway run --service postgres-app psql -c 'SELECT version();'
railway run --service postgres-kc  psql -c 'SELECT version();'
```

Expected: both report `PostgreSQL 17.x ...`. Drift (one on 16.x, one on 17.x) indicates a
Railway-managed PG version pin divergence — escalate before proceeding.

| Field | postgres-app | postgres-kc |
|---|---|---|
| Service plugin | `PostgreSQL` | `PostgreSQL` |
| Major version | `17.x` (populate after probe) | `17.x` (populate after probe) |
| Private hostname | `postgres-app.railway.internal:5432` | `postgres-kc.railway.internal:5432` |
| Public hostname | _none_ (Public Domain OFF — see 14.6) | _none_ (Public Domain OFF — see 14.6) |
| Consumer | `api` (Section 5.1 `ConnectionStrings__DefaultConnection`) | `keycloak` (Section 3.4 `KC_DB_URL`) |

### 14.2 Credential distinctness

```sh
railway variables --service postgres-app --json | jq '{PGUSER, PGDATABASE, RAILWAY_PRIVATE_DOMAIN}'
railway variables --service postgres-kc  --json | jq '{PGUSER, PGDATABASE, RAILWAY_PRIVATE_DOMAIN}'
```

Expected shape (concrete values redacted — Sealed credentials NEVER pasted into this doc; the
verifier records only that the values differ):

| Variable | postgres-app | postgres-kc | Invariant |
|---|---|---|---|
| `PGUSER` | `u_<16-hash-chars>` | `u_<different-16-hash-chars>` | **MUST differ** (per-service random username) |
| `PGPASSWORD` | `<32-char-Sealed-random>` | `<different-32-char-Sealed-random>` | **MUST differ** (per-service random; byte-distinct) |
| `PGDATABASE` | `railway` (Railway default) | `railway` (Railway default) | May match — the **credential** is the discriminator, not the database name |
| `RAILWAY_PRIVATE_DOMAIN` | `postgres-app.railway.internal` | `postgres-kc.railway.internal` | **MUST differ** (per-service hostname) |

> **Note on `PGDATABASE` parity.** Railway's managed PostgreSQL template defaults
> `PGDATABASE=railway` for every instance. Both `postgres-app` and `postgres-kc` will likely
> have `PGDATABASE=railway` — this is acceptable per the invariant above; the credential
> (`PGUSER`/`PGPASSWORD`) is the cross-DB authentication discriminator, not the database name.
>
> **Sealed-value redaction.** When populating this section after running the commands, paste
> only the **shape** (length + hash prefix) of `PGUSER` / `PGPASSWORD` — never the resolved
> values. The Sealed values live exclusively in Railway + the maintainer's password manager.

### 14.3 Connection-string targets

#### 14.3.1 `api` → `postgres-app`

```sh
railway variables --service api --json | jq -r '.ConnectionStrings__DefaultConnection'
```

Expected resolved string (with credentials redacted):

```
Host=postgres-app.railway.internal;Port=5432;Database=railway;Username=<redacted>;Password=<redacted>
```

`api` deploy logs on boot should show the Npgsql connection success line:

```sh
railway logs --service api --tail 200 | grep -E 'Npgsql|Connection opened|Database migrations'
```

Expected: `Database migrations applied` (per Beta default `Database__AutoMigrate=true`, see
E15-S2 Section 5.1 row) within ~5 seconds of the most recent deploy.

**Failure modes to watch for:**
- `connection refused` → `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` reference unresolved in Section 5.1.
- `host not found` → `postgres-app` service was renamed or removed.
- `password authentication failed` → `${{postgres-app.PGPASSWORD}}` reference points at the
  wrong service. Escalate to a Section 5.1 patch + redeploy.

#### 14.3.2 `keycloak` → `postgres-kc`

```sh
railway variables --service keycloak --json | jq -r '.KC_DB_URL'
```

Expected resolved JDBC URL:

```
jdbc:postgresql://postgres-kc.railway.internal:5432/railway
```

`keycloak` deploy logs on boot should show:

```sh
railway logs --service keycloak --tail 200 | grep -E 'KC-SERVICES000[19]|Keycloak.*started in'
```

Expected: `KC-SERVICES0009 Added user 'admin' to realm 'master'` AND
`Keycloak 26.5.2 on JVM ... started in N.NNs` — the second proves the JDBC handshake against
`postgres-kc` succeeded.

**Failure modes to watch for:**
- `Failed to obtain JDBC connection` → `KC_DB_URL` or `KC_DB_USERNAME`/`KC_DB_PASSWORD` env vars
  from Section 3.4 / Section 5.3 drifted from the actual `postgres-kc` references.

### 14.4 Schema isolation

#### 14.4.1 `postgres-app` table list

```sh
railway run --service postgres-app psql -c '\dt'
```

Expected: application tables matching the EF Core migration set — `Members`, `Events`,
`EmailCampaigns`, `EmailTemplates`, `EmailRecipients`, `AuditLogs`, `__EFMigrationsHistory`,
`Documents`, `Invoices`, plus any other migration-produced tables (exact count drifts with the
migration history — record the count at verification time).

**Negative check** (grep the captured `\dt` output for Keycloak tables):

```sh
railway run --service postgres-app psql -c '\dt' | grep -iE 'USER_ENTITY|REALM|CLIENT|RESOURCE_SERVER|KEYCLOAK_ROLE|COMPONENT|MIGRATION_MODEL|RESOURCE_ATTRIBUTE|SCOPE_MAPPING'
```

Expected: **zero matches**. If any Keycloak table is present in `postgres-app`, the
two-Postgres separation is broken at the schema layer — critical defect, escalate immediately.

#### 14.4.2 `postgres-kc` table list

```sh
railway run --service postgres-kc psql -c '\dt'
```

Expected: ~80 Keycloak 26 internal tables (canonical Keycloak schema imported by
`kc.sh start --optimized` against an empty PG). Exact count may differ slightly across
Keycloak patch versions — the verifiable claim is "Keycloak's canonical schema present, zero
application tables".

**Negative check** (grep for application tables):

```sh
railway run --service postgres-kc psql -c '\dt' | grep -iE 'Members|Events|EmailCampaigns|EmailTemplates|Invoices|__EFMigrationsHistory'
```

Expected: **zero matches**. Any hit indicates the application's EF Core migrations ran against
`postgres-kc` instead of `postgres-app` — escalate (likely `ConnectionStrings__DefaultConnection`
on `api` pointed at the wrong managed-PG reference).

### 14.5 Cross-credential rejection

The highest-confidence isolation check: even if both schemas were somehow visible, the
credential-level rejection makes the data unreachable across the boundary.

#### 14.5.1 api credentials → postgres-kc (should fail)

```sh
railway run --service api bash -c '
  # Try to use api'\''s connection-string credentials against postgres-kc'\''s host.
  PGPASSWORD="$(echo "$ConnectionStrings__DefaultConnection" | sed -n "s/.*Password=\([^;]*\).*/\1/p")"
  PGUSER_API="$(echo "$ConnectionStrings__DefaultConnection" | sed -n "s/.*Username=\([^;]*\).*/\1/p")"
  PGPASSWORD="$PGPASSWORD" psql -h postgres-kc.railway.internal -p 5432 -U "$PGUSER_API" -d railway -w -c "SELECT 1;"
'
```

Expected output:

```
psql: error: connection to server at "postgres-kc.railway.internal" (...), port 5432 failed:
FATAL:  password authentication failed for user "<api-PGUSER>"
```

#### 14.5.2 keycloak credentials → postgres-app (should fail)

```sh
railway run --service keycloak bash -c '
  KC_USER="$KC_DB_USERNAME"
  KC_PASS="$KC_DB_PASSWORD"
  PGPASSWORD="$KC_PASS" psql -h postgres-app.railway.internal -p 5432 -U "$KC_USER" -d railway -w -c "SELECT 1;"
'
```

Expected output (same shape, swapped user/host):

```
psql: error: connection to server at "postgres-app.railway.internal" (...), port 5432 failed:
FATAL:  password authentication failed for user "<kc-PGUSER>"
```

Both rejections together establish the cross-credential isolation invariant: a leaked
application-DB credential cannot pivot to read Keycloak's user store; a leaked
Keycloak-DB credential cannot pivot to read member/finance/audit rows.

> **Audit-log side-effect.** The two failed `psql` attempts above will generate authn-failure
> audit-log entries on the target Postgres. This is intentional + useful for E14-S5 (audit
> logs audit). If the audit-log volume is rate-sensitive, capture timestamps so the failed
> attempts can be correlated and explained.

### 14.6 Private-networking re-assertion

This re-asserts Section 8.2 + Section 8.3 — neither Postgres service exposes itself to the
public internet.

From a workstation **outside** Railway:

```sh
dig +short postgres-app.railway.internal
dig +short postgres-kc.railway.internal
echo "exit codes: $?"
```

Expected: both produce empty output + non-zero exit code (DNS resolution fails outside the
Railway private network — matches Section 8.3's negative-test baseline).

Railway-dashboard state probe:

```sh
railway service show postgres-app --json | jq '.serviceInstances[0].domains'
railway service show postgres-kc  --json | jq '.serviceInstances[0].domains'
```

Expected: both return `null` or `[]` (Public Domain OFF) and no TCP Proxy entry (Section 8.2
state preserved).

> **Do NOT propose enabling TCP Proxy on either Postgres for "easier verification"**.
> Section 8.7 explicitly forbids this; the verification works via `railway run --service` shell
> tunneling without any exposure change. Even temporarily flipping the toggle creates an
> attack-window incident.

---

## 15. Daily PostgreSQL backup + restore (E15-S3)

> Story alignment: **E15-S3** — REQ-088 AC-6 / ADR-019 (backup destination) /
> ADR-020 (Hangfire job suppression inverse). Closes the
> [E13-FT-6 deferred-work entry](../_bmad-output/implementation-artifacts/deferred-work.md)
> by removing the 6 `docker exec` / `docker cp` invocations that were Railway-incompatible.
>
> **What this section gives you.** A 24-hour RPO for `postgres-app` data: a daily
> encrypted `pg_dump` of the application database lands on RustFS at 03:00 UTC; a 30-day
> retention prune removes older copies at 04:00 UTC; a documented manual-restore procedure
> reverses the pipeline end-to-end. Keycloak's `postgres-kc` schema is **not** backed up —
> it is reproducible from
> [infra/keycloak/realms-beta/iabconnect-realm.json](../infra/keycloak/realms-beta/iabconnect-realm.json)
> on container restart; the realm DB only carries hashed user passwords + resolved
> client secrets, both of which increase the attacker surface for marginal recovery
> value if exfiltrated.

### 15.1 Cron schedule

| Job ID | When (UTC) | What | Source |
|---|---|---|---|
| `daily-pg-backup` | `0 3 * * *` (03:00 UTC) | `pg_dump --format=custom` → gzip → AES-256-GCM → upload to `s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc` | [ScheduledBackupJob.cs](../backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs) wired by [Api/DependencyInjection.cs `RegisterDailyBackupJob`](../backend/src/IabConnect.Api/DependencyInjection.cs) |
| `prune-old-backups` | `0 4 * * *` (04:00 UTC) | List `backups/` prefix → delete RustFS objects + local cache files older than 30 days | [PruneOldBackupsJob.cs](../backend/src/IabConnect.Infrastructure/Backup/PruneOldBackupsJob.cs) |

Both jobs are gated `!IsDevelopment()` per ADR-020 inverse — Dev environments do not
run nightly pg_dump locally. A Dev install that previously ran Beta in the same
Hangfire storage cleans up the orphaned schedule via `RemoveIfExists` (E11-S2 review
D4 pattern). Test verification: [RegisterDailyBackupJobTests.cs](../backend/tests/IabConnect.Api.Tests/RegisterDailyBackupJobTests.cs).

### 15.2 Required env vars + Sealed flags

These already appear in Section 5.1; reiterated here for self-contained reference.

| Variable | Service | Value | Sealed | Rationale |
|---|---|---|---|---|
| `Backup__EncryptionKey` | `api` | base64-encoded 32-byte random (44 base64 chars) | **Yes** | AES-256-GCM symmetric key. Missing/wrong-length value fails the `PostgresBackupService` constructor fast in non-Dev/non-Testing — backups MUST be encrypted before upload. |
| `Backup__BucketName` | `api` | `backups` | No | RustFS bucket name. Distinct from `DocumentStorage__BucketName` (`iabconnect-documents`) — two independent buckets per ADR-019. |
| `Backup__Directory` | `api` | `/tmp/backups` | No | Local cache landing path (DEC-1 Option A hybrid). Admin-UI download/restore reads from here. |
| `DocumentStorage__ServiceUrl` | `api` | `http://${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000` | No | The same RustFS instance hosts both the documents bucket and the backups bucket. |
| `DocumentStorage__AccessKey` / `DocumentStorage__SecretKey` | `api` | RustFS root creds | partial | The S3 client is bucket-agnostic — the same creds work for both buckets. |

> **Bucket-creation chicken-and-egg.** On a fresh Beta deploy the `backups` bucket
> may not yet exist on RustFS. The current code path expects the operator to create
> it once via the RustFS admin console or `aws s3 mb s3://backups --endpoint-url
> http://<rustfs-host>:9000`. A future story may add auto-create-on-first-upload
> semantics — for now, manual one-time creation matches the
> `iabconnect-documents` precedent.

### 15.3 Storage path convention

| Layer | Path |
|---|---|
| Local cache | `${Backup__Directory}/iabconnect_backup_yyyyMMdd_HHmmss.sql` (pg_dump `--format=custom` despite the `.sql` extension; preserved for admin-UI backward compat) |
| RustFS object key | `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC; nested by year + month for human-readable listings) |
| On-disk encryption format | `[12-byte nonce][16-byte tag][ciphertext]` (AES-256-GCM via [BackupEncryption.cs](../backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs)) |

The local and RustFS filename conventions diverge intentionally: the local file
keeps its `BackupRecord.FileName` legacy extension so admin-UI download / restore
endpoints work unchanged; the RustFS object name encodes the gzip + encrypt steps
in the suffix for clarity.

### 15.4 Listing backups

```sh
# Local cache (ephemeral; may be empty after a Railway redeploy of the api):
railway run --service api ls -lh /tmp/backups/
```

For the RustFS-side listing the backend image intentionally does NOT bundle the
AWS CLI (every binary added to the runtime image is reviewed for attack-surface
growth at E14-S1). Use one of these two paths instead:

1. **RustFS web console** (recommended). The RustFS service in Beta exposes its
   admin console on the address declared via `RUSTFS_CONSOLE_ADDRESS`. From the
   Railway dashboard → `rustfs` service → Settings → enable temporary public
   access on the console port if you have not already (revoke when done), open
   the URL, sign in with the Sealed `RUSTFS_ROOT_USER` / `RUSTFS_ROOT_PASSWORD`,
   navigate `backups/` to browse the encrypted objects.
2. **Direct `mc` (MinIO CLI) inside the rustfs container.** `railway shell
   --service rustfs` lands in the container which ships `mc`:

   ```sh
   # Inside the rustfs container:
   mc alias set local http://127.0.0.1:9000 "$RUSTFS_ROOT_USER" "$RUSTFS_ROOT_PASSWORD"
   mc ls --recursive local/backups/
   ```

   `[!] verify against rustfs/rustfs container docs before executing` — `mc`
   ships in the default RustFS image but the alias step assumes the loopback +
   internal port pattern; confirm by reading `${{RUSTFS_ADDRESS}}` first.

### 15.5 Manual restore procedure

> Use this procedure when a Beta data-loss incident requires restoring `postgres-app`
> from a known-good backup. **Do NOT run `pg_restore` against the live `postgres-app`
> instance receiving traffic** — restore into a throwaway `postgres-app-restore-test`
> Railway service first, validate row counts, then cut traffic over via a coordinated
> redeploy.

#### Step 1 — Download the encrypted backup from RustFS

The backend image does not bundle the AWS CLI (Section 15.4 prose). Two ways to
get the encrypted dump onto your workstation:

**Path A — via the rustfs container's `mc`:**

```sh
# Inside `railway shell --service rustfs`:
mc alias set local http://127.0.0.1:9000 "$RUSTFS_ROOT_USER" "$RUSTFS_ROOT_PASSWORD"
mc cp "local/${{Backup__BucketName}}/backups/YYYY/MM/DD-HHMMSS.dump.gz.enc" /tmp/restore-incoming.dump.gz.enc
# Then `railway shell` to scp/copy the file off the container. Or use Path B below.
```

**Path B — via the RustFS web console:** open the console URL from Section 15.4,
navigate `backups/YYYY/MM/DD-HHMMSS.dump.gz.enc`, click Download. The file lands
on the operator's workstation directly.

`[!] verify against rustfs/rustfs container docs before executing` — the `mc`
alias step uses the loopback endpoint; the `RUSTFS_ADDRESS` env var in the
container is the canonical source of the actual address.

#### Step 2 — Decrypt with the `Backup__EncryptionKey`

The encryption format `[nonce(12)][tag(16)][ciphertext]` is read by
[BackupEncryption.DecryptAsync](../backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs).
The simplest decrypt path is a small `dotnet run`-style helper that imports the
same `BackupEncryption` class:

```csharp
// scratch/Decrypt.cs — one-off script; do not commit
var keyBase64 = Environment.GetEnvironmentVariable("Backup__EncryptionKey")!;
var key = IabConnect.Infrastructure.Backup.BackupEncryption.ParseConfiguredKey(keyBase64);
await using var cipher = File.OpenRead("/tmp/restore-incoming.dump.gz.enc");
await using var plain = File.Create("/tmp/restore-incoming.dump.gz");
await IabConnect.Infrastructure.Backup.BackupEncryption.DecryptAsync(cipher, plain, key);
```

> **Do NOT** invoke `openssl enc -d` here — the format is not compatible with OpenSSL's
> CLI defaults (AES-GCM with auto-detected nonce + tag is not a stock OpenSSL mode).
> Use the project's `BackupEncryption` API for symmetric tooling.

#### Step 3 — Gunzip

```sh
gunzip /tmp/restore-incoming.dump.gz
# → /tmp/restore-incoming.dump
```

#### Step 4 — Restore into a non-production target

Two recommended targets, in preference order:

(a) A **throwaway Railway service** `postgres-app-restore-test` provisioned with
the standard PostgreSQL plugin:

```sh
# In the Railway dashboard: New → Database → PostgreSQL, name it postgres-app-restore-test.
# Capture its ConnectionStrings__DefaultConnection-equivalent into a local env var.
PGPASSWORD="<restore-target-PGPASSWORD>" pg_restore \
  --clean --if-exists --no-password \
  --host postgres-app-restore-test.railway.internal --port 5432 \
  --username "<restore-target-PGUSER>" --dbname railway \
  /tmp/restore-incoming.dump
```

(b) A **local docker-compose Postgres** (offline verification, no Beta touch):

```sh
docker compose -f infra/docker-compose.yml up -d postgres
PGPASSWORD=postgres pg_restore --clean --if-exists --no-password \
  --host localhost --port 5433 --username postgres --dbname iabconnect \
  /tmp/restore-incoming.dump
```

`pg_restore` exit code 1 = warnings (e.g., "role already exists") — accepted as
success matches [PostgresBackupService.RestoreBackupAsync](../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs).

#### Step 5 — Validate the restore + cut traffic

Row-count + table-list sanity check before any traffic cut:

```sh
PGPASSWORD="<restore-target-PGPASSWORD>" psql \
  --host postgres-app-restore-test.railway.internal -U "<restore-target-PGUSER>" -d railway \
  -c "SELECT COUNT(*) FROM \"Members\"; SELECT COUNT(*) FROM \"Events\";"
```

Compare against the last-known-good row counts (capture them periodically when
healthy). Only then re-point `api.ConnectionStrings__DefaultConnection` at the
restored instance via Railway-dashboard env-var rotation + redeploy.

### 15.6 Real-restore evidence

`[!] needs-human-verify` — Harry's session populates this subsection after the
first end-to-end restore drill against the Beta deploy. Capture:

- Backup-file timestamp (redacted to month resolution: `2026-MM-DD-HHMMSS.dump.gz.enc`).
- Decryption time + gunzip time (wall-clock seconds, not credentials).
- `pg_restore` exit code + the count of restored rows in `Members` + `Events`
  before / after.
- Sign-off date (the operator who validated the procedure).

E19-S2 (Wave-10) repeats the drill as a Production-readiness gate.

### 15.7 Recovery procedures

**Hangfire `daily-pg-backup` job stuck "In Progress":** the
[PostgresBackupService.GetBackupsAsync auto-resolve at 10 minutes](../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs)
marks any record stuck > 10 min as Failed. If a successor run never appears at
03:00 UTC the next day, check the Hangfire dashboard (Dev only — Beta dashboards
are disabled per E12-S1) OR `railway logs --service api --since 24h | grep -E
'daily-pg-backup|Backup'`. Common causes: (a) `Backup__EncryptionKey` rotated but
not propagated to the `api` env-var; (b) `Backup__BucketName` bucket missing on
RustFS; (c) `pg_dump` binary missing from the api container (`postgresql-client-17`
package not installed — verify via `railway run --service api pg_dump --version`).

**Encryption-key rotation impact:** rotating `Backup__EncryptionKey` makes all
**pre-rotation** backups undecryptable with the new key. The old key MUST be
archived in the maintainer's password manager AND in a separate recovery vault
(e.g., 1Password vault `iabconnect/recovery`). A future story (deferred-work) may
add a key-versioning header to the on-disk format so multi-key decryption is
possible without manual key lookup; today's contract is single-key-at-a-time.

**RustFS bucket full / RustFS storage exhausted:** the prune job at 04:00 UTC
caps RustFS growth at ~30 daily dumps. If a backup fails with
`PutObject ... exceeded quota`, list the bucket directly + manually delete the
oldest objects to reclaim space, then investigate why the prune job did not run
(check Hangfire dashboard / Serilog ERROR stream for `PruneOldBackupsJob`
failures).

---

## 16. First Beta-Admin seeding (E15-S4)

> Story alignment: **E15-S4** — REQ-088 AC-10 / ADR-016 (custom Keycloak image
> with realm-import baked in). Closes Epic-15. Operator-facing reference for
> bootstrapping the first administrator account on a fresh Beta deploy. Read this
> after a green deploy from Section 10.4; the procedure produces the first user
> who can log in with the `admin` realm role and see the IAB Connect admin UI.

### 16.1 Goal + commitments

- **Goal**: deterministic, reproducible procedure for any operator (Harry, a
  co-maintainer, a fork's first deployer) to bootstrap the first IAB-Connect
  `admin`-role-holder on a fresh Beta deploy. The procedure is browser-driven
  through the Keycloak Admin Console; no SQL INSERTs, no realm-JSON edits, no
  dev-realm dumps.
- **RPO / RTO commitments for the seeding action itself**: ~5 min for an operator
  with the master-admin credentials already in hand; ~30 min including recovery
  of a lost `KEYCLOAK_ADMIN_PASSWORD` via the procedure in Section 16.7.
- **Source of authority**:
  [ADR-016](../_bmad-output/planning-artifacts/architecture.md#adr-016-custom-keycloak-image-with-spi-baked-in)
  ("realm import is the persistence shape for first-deploy seeding") +
  [E12-S3](../_bmad-output/implementation-artifacts/e12-s3-add-custom-keycloak-image-with-spi.md)
  (sanitized realm at `infra/keycloak/realms-beta/iabconnect-realm.json` ships
  with the image; no seed users baked in).

### 16.2 Prerequisites

Before starting:

- Beta deploy is green per Section 10.4 (login round-trip would-succeed-if-we-had-an-admin
  user — but we don't yet; this is the chicken-and-egg this section unwinds).
- `/health/detail` reports `database: Healthy` + `keycloak: Healthy` (Section 9).
- Sealed Railway env vars on the `keycloak` service (per Section 5.3):
  - `KEYCLOAK_ADMIN` = `admin`
  - `KEYCLOAK_ADMIN_PASSWORD` = strong-random-≥-16-chars (stored in operator's
    password manager).
- Keycloak Admin Console reachable at
  `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/admin/master/console/`.
- The operator's browser (private window recommended to avoid OIDC-session
  pollution from any prior dev session).

### 16.3 Verify the seven realm roles

The realm-import baked into the custom Keycloak image ships **exactly seven**
realm-level roles. Verify the deployed state matches the source-of-truth file.

Source-of-truth roles in
[infra/keycloak/realms-beta/iabconnect-realm.json](../infra/keycloak/realms-beta/iabconnect-realm.json)
lines 163-198:

| Role name | Used by |
|---|---|
| `mfa-required` | Keycloak conditional flow trigger (enforces MFA at login when assigned). NOT an application authorization role; not present in `IabConnect.Api.Authorization.Roles`. |
| `admin` | `[Roles.Admin](../backend/src/IabConnect.Api/Authorization/Roles.cs)` — `RequireAdmin` policy + all admin-only UI sections. |
| `vorstand` | `[Roles.Vorstand]` — board members. |
| `member` | `[Roles.Member]` — regular member. |
| `kassier` | `[Roles.Kassier]` — finance read+write policy. |
| `auditor` | `[Roles.Auditor]` — finance read-only policy. |
| `event-manager` | `[Roles.EventManager]` — `RequireEventStaff` set member. |

**Why the 7-vs-6 mismatch.** `Roles.cs` defines six **application** authorization
constants; the seventh realm role (`mfa-required`) is a Keycloak conditional
authentication trigger — not an authorization role — and intentionally does not
appear in the application-side enum. A future story adding "step-up MFA for
finance writes" would consume `mfa-required` via Keycloak's `Required Action`
flow, not via `[Authorize(Roles = "mfa-required")]`.

**Verification steps (browser, on the deployed Beta Keycloak Admin Console):**

1. Sign in to the Admin Console at
   `https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/admin/master/console/` using
   `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`. (You land in the **master** realm by default.)
2. Use the realm-picker (top-left) → select `iabconnect`.
3. Left nav → **Realm roles**. Confirm the table lists exactly the seven names
   above. `mfa-required` may show with a different default `Composite` / `Description`
   value — only the **name** is verified here.
4. `[!] needs-human-verify` — capture either a screenshot (saved to
   `docs/screenshots/16-3-realm-roles.png` and referenced here) OR a copy of the
   seven role names pasted into Section 16.3 as a `code-block`. Redact any
   user-PII or audit-log metadata that might be visible in the Admin Console
   chrome — only role names matter.

**Anti-patterns to avoid:**

- Do NOT delete `mfa-required` "to clean up the seven into six matching the
  application roles" — it is referenced by the conditional auth flow declared in
  the realm JSON (search for `"alias": "browser"` to find it).
- Do NOT add a new realm role here (e.g., a `super-admin` for elevated
  operations). New roles flow from a feature story + a coordinated update to
  `Roles.cs` + the realm JSON.

### 16.4 Create the first Beta-Admin user

1. In the `iabconnect` realm (left-nav realm-picker if you drifted back to
   master) → **Users**. The table should be empty (no seed users per
   `realms-beta` sanitisation in E12-S3 AC-5).
2. Click **Add user**. Fill:
   - **Username**: operator's preferred administrative handle. Convention is the
     operator's email address — but any unique string works.
   - **Email**: the operator's real email address.
   - **Email verified**: **ON** (toggle on). Skipping this forces an email-verify
     flow on first sign-in that the Beta Mailtrap sandbox catches silently.
   - **First name** / **Last name**: real names (these appear on member-list
     views).
   - Leave the rest at defaults.
3. Click **Create**. Keycloak navigates to the new user's detail page.
4. Open the **Credentials** tab → **Set password**.
   - Enter a strong random password (≥ 16 chars, mixed case + digits + symbol).
   - **Temporary**: **OFF** (toggle off). With Temporary ON, the operator is
     forced through a password-change flow on first sign-in which the IAB
     Connect frontend cannot complete (it does not route through Keycloak's
     password-change page).
   - Save the password.
   - **CRITICAL**: store the password in the operator's password manager
     IMMEDIATELY. There is no recovery path other than the master-admin
     reset described in Section 16.7.
5. Open the **Role mapping** tab. Click **Assign role**.
6. In the role-picker, filter by source `realm-roles`. Tick `admin`. Optionally
   also tick `vorstand` if the operator should also have the `RequireVorstand`
   permissions today. Click **Assign**.

### 16.5 Sign-in smoke test

1. Open a private browser window. Navigate to
   `https://${{web.RAILWAY_PUBLIC_DOMAIN}}/`.
2. Click **Sign in** (top-right). NextAuth redirects to the Keycloak login page
   at `${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect/protocol/openid-connect/auth?...`.
3. Enter the username + password from Section 16.4. Submit.
4. Keycloak redirects back to the IAB Connect frontend. The header should now
   show the operator's name + an avatar dropdown.
5. Navigate to **Settings** (left nav) — the route is guarded by the
   `RequireAdmin` policy. If the route loads and the settings form renders,
   the seeding is complete; the operator has effective `admin` privileges.

If sign-in fails at step 3 with `Invalid username or password`, the
**Temporary** toggle was likely left ON in Section 16.4 step 4 OR the
**Email verified** toggle was left OFF (Keycloak then asks for an email-verify
loop the frontend cannot complete). Return to the Admin Console, fix the
toggles, retry.

### 16.6 Adding additional Beta testers

Once the first admin user exists, additional testers can be onboarded via two
paths:

**Path A — Operator pre-creates each tester (recommended for closed Beta):**

1. Admin Console → `iabconnect` realm → Users → Add user. Same toggles as
   Section 16.4 step 2 (email verified ON; temporary OFF on password).
2. Assign realm role(s) appropriate to the tester. Typical: just `member`.
3. Communicate the username + password to the tester through a secure channel
   (Signal, password manager share link, etc.). NOT email.

**Path B — Self-service via SMTP-confirmed email (recommended when SMTP is wired):**

When the `keycloak` service has SMTP configured (per ADR-018 Mailtrap sandbox in
Beta, or real provider in Production), Keycloak's **Forgot password?** link on
the login page allows testers to set their own password if the operator has
created the account + assigned a role + ticked Email verified. The operator
shares the username; the tester runs the reset flow and lands on the frontend
signed-in.

In Beta the Mailtrap sandbox intercepts the password-reset emails — they do
NOT land in the tester's real inbox. The operator must forward the captured
email manually OR switch to a real provider before relying on Path B.

### 16.7 Anti-patterns + recovery

**Do NOT:**

- Commit the Beta-Admin password to the repo. The Sealed `KEYCLOAK_ADMIN_PASSWORD`
  is the only credential that ever lives anywhere persistent outside the
  operator's password manager.
- Seed via SQL INSERT into `postgres-kc`. The Keycloak password hashing scheme
  (Argon2id parameters + per-user salt + pepper) is not reproducible from outside
  Keycloak; a manual SQL insert would create an unusable user.
- Import a dev-realm dump (`infra/keycloak/realms/iabconnect-realm.json`) into
  the Beta `postgres-kc`. The dev realm ships demo seed users with known
  passwords — importing them into Beta would create six tester-visible accounts
  with leaked credentials.
- Run `DevelopmentDataSeeder.SeedAsync` against Beta. The seeder is gated to
  `env.IsDevelopment()` in [Program.cs](../backend/src/IabConnect.Api/Program.cs)
  with a regression test at
  [DevelopmentDataSeederGatingTests.cs](../backend/tests/IabConnect.Api.Tests/DevelopmentDataSeederGatingTests.cs).
  If you find yourself trying to force it, you're in the wrong document — that
  is Dev-only behaviour for the seeded `admin@iabconnect.ch`/
  `vorstand@iabconnect.ch`/`member@iabconnect.ch` Members.

**Recovery: lost `KEYCLOAK_ADMIN_PASSWORD`.**

If the master-realm admin password is lost AND the operator cannot recover it
from their password manager, Keycloak 26 supports the
`bootstrap-admin user --password:env` recovery flow against the running
container. The procedure is documented in Section 11.2 of this same doc
(Keycloak admin recovery). Follow that runbook — do NOT delete the
`postgres-kc` volume to "start fresh", that would destroy realm config and
every user account.

**Recovery: locked out of `admin` realm role.**

If the only `admin`-role-holder loses access (forgot password AND no master-admin
escalation) but the master-realm admin still works: log into the master realm,
navigate to `iabconnect` realm → Users → select the locked-out user → Credentials
→ Reset password. Set a temporary password, communicate it through a secure
channel, the user signs in and changes it.

---

## 17. Frontend public URLs: bake + redirect-URI verification (E16-S1)

> Story alignment: **E16-S1** — REQ-088 AC-7. Validates that the published
> `ghcr.io/htos/iabc-web:beta` container image bakes the live Beta `api`,
> `keycloak`, and document-host URLs into its static client bundle (no
> `localhost:` strings), and that the Keycloak realm's `iabconnect-frontend`
> client redirect URIs materialize to the deployed `web` Railway domain. Re-run
> whenever a GHA `NEXT_PUBLIC_*_BETA` repo variable rotates or whenever the
> Keycloak realm import changes.
>
> **Why this is its own section.** [Section 6.1](#61-build-time-baked-into-the-image-at-gha-docker-build)
> enumerates the build-time-baked variables; this section is the *post-publish*
> verification that the bake actually happened (variables can be missing at
> build time → empty strings inlined → silent runtime failure that only
> surfaces on the first browser login or first thumbnail render). [Section 6.3](#63-the-keycloak_issuer-parity-invariant)
> documents the issuer parity invariant; this section closes the bake-side of
> that invariant as a runtime fact. [Section 8.4](#84-internal-reachability-verification-deploy-log-inspection)
> confirms internal reachability; this section confirms the *correct URL was
> baked* into the published image.

### 17.1 Goal + commitments

This procedure proves five things:

1. The `:beta` image's `.next/static/` chunks contain the live `api` Railway
   domain as a baked literal — no `localhost`, no empty string, no stale fork
   URL.
2. The `:beta` image's chunks contain the live `keycloak` Railway domain (for
   OIDC discovery + password-reset deep links).
3. The `:beta` image's chunks contain the literal `"beta"` (`NEXT_PUBLIC_ENV_LABEL`),
   which is the BetaBanner activation signal.
4. The `frontend/Dockerfile` ARG↔ENV bridge for all 9 `NEXT_PUBLIC_*` is
   intact (regression-guarded by a Vitest test, not the live image).
5. The Keycloak realm's `iabconnect-frontend` client lists the live `web`
   Railway domain in `redirectUris` and `webOrigins` (so the OIDC callback is
   not rejected with `Invalid parameter: redirect_uri`).

What this section **does not** prove (deferred to later sections):

- The OIDC round-trip succeeds end-to-end → [Section 18](#18-end-to-end-oidc-verification-e16-s2) (E16-S2).
- Document upload/download to RustFS → [Section 19](#19-document-uploaddownload-verification-e16-s3) (E16-S3).

### 17.2 Prerequisites

Operator-side, before running this section:

- **Beta deploy GREEN** — Section 10 has been completed at least once and the
  three public services (`web`, `api`, `keycloak`) are reachable on their
  assigned Railway hostnames.
- **`docker` CLI** on the operator workstation (image extraction). Docker
  Desktop, Rancher Desktop, Podman with the `docker` alias, or Colima all
  work — anything that handles `docker pull` + `docker create` + `docker cp`.
- **`gh` CLI** authenticated against `htos/iab-connect` (`gh auth status`
  reports a logged-in user with read access to the repo). Used to fetch the
  current values of the `NEXT_PUBLIC_*_BETA` GHA repo variables.
- **`grep`** — POSIX-standard; on Windows use Git Bash, WSL, or the bundled
  `grep` from Git for Windows. `findstr` is NOT a drop-in substitute (no
  recursion, different regex dialect).
- **`kcadm.sh`** (optional, for path B of 17.4) — either installed locally
  from a Keycloak distribution or invoked inside the `keycloak` container
  via `railway shell -s keycloak`. The in-container path at
  `/opt/keycloak/bin/kcadm.sh` is the always-available option.

### 17.3 Image-side bake verification

Pull the current `:beta` image and extract its static chunks:

```sh
docker pull ghcr.io/htos/iabc-web:beta
CID=$(docker create ghcr.io/htos/iabc-web:beta)
docker cp "$CID:/app/.next/static" /tmp/iabc-web-static
docker rm "$CID" >/dev/null
```

Capture the current GHA repo variables (their values are the **source of
truth** for what should be baked):

```sh
API_URL=$(gh variable get NEXT_PUBLIC_API_URL_BETA --json value --jq .value)
KC_URL=$(gh variable get NEXT_PUBLIC_KEYCLOAK_URL_BETA --json value --jq .value)
KC_ISSUER=$(gh variable get NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA --json value --jq .value)
DOC_HOST=$(gh variable get NEXT_PUBLIC_DOCUMENT_HOST_BETA --json value --jq .value)
```

Run the five greps. Paste each result below the grep that produced it.

```sh
# AC-1: api Railway domain baked
grep -rl "$API_URL" /tmp/iabc-web-static
# Expected: ≥1 line listing a chunk under /tmp/iabc-web-static/chunks/*.js
#           AND/OR under /tmp/iabc-web-static/standalone/.next/static/chunks/*.js
# Paste result:
#   <operator fills>

# AC-2: zero localhost strings (most likely silent-failure mode)
grep -r "localhost:" /tmp/iabc-web-static | head
# Expected: zero output. ANY hit = a `_BETA` GHA variable is missing
#           OR an optional NEXT_PUBLIC_* fell back to its Dockerfile localhost
#           default (most likely culprit: NEXT_PUBLIC_DOCUMENT_HOST_BETA).
# Paste result:
#   <operator fills>

# AC-3: keycloak Railway domain baked
grep -rl "$KC_URL" /tmp/iabc-web-static
# Expected: ≥1 chunk file.
# Paste result:
#   <operator fills>

# AC-3b: keycloak issuer baked
grep -rl "$KC_ISSUER" /tmp/iabc-web-static
# Expected: ≥1 chunk file. (Distinct from AC-3 because issuer includes the
# /realms/<realm> suffix.)
# Paste result:
#   <operator fills>

# AC-4: "beta" env-label baked (BetaBanner activation signal)
grep -rl '"beta"' /tmp/iabc-web-static
# Expected: ≥1 chunk file in the BetaBanner-emitting bundle.
# Paste result:
#   <operator fills>
```

Cleanup:

```sh
rm -rf /tmp/iabc-web-static
```

**Drift resolution if any grep above failed.** The GHA repo variable is the
source of truth for the *image*. Update the variable in GitHub → Settings →
Secrets and variables → Actions, then re-trigger the build-images.yml
workflow on the `beta` branch. The next `:beta` image pulls the corrected
bake. Note: Railway service env vars on the `web` service do **nothing** for
`NEXT_PUBLIC_*` — those are build-time-baked, not runtime-read.

### 17.4 Keycloak realm redirect-URI verification

The realm import at
[infra/keycloak/realms-beta/iabconnect-realm.json:256-263](../infra/keycloak/realms-beta/iabconnect-realm.json#L256-L263)
declares the `iabconnect-frontend` client's `redirectUris` and `webOrigins`
as `${IABCONNECT_BETA_HOST}/*` + `${FRONTEND_PUBLIC_URL}/*` substitution
placeholders. The Keycloak service must supply both env vars at first start
so the realm-import resolves them; otherwise the runtime config carries the
literal `${...}` strings and every login attempt fails with
`Invalid parameter: redirect_uri`.

**Path A — Keycloak Admin Console (GUI).** Sign into the deployed Keycloak
Admin Console at `https://<keycloak>.up.railway.app/admin/`. Realm
`iabconnect` → Clients → `iabconnect-frontend` → Settings → scroll to
"Valid redirect URIs" and "Web origins".

```text
Expected Valid redirect URIs:
  <operator pastes the actual list — should include a line ending /*
   whose prefix equals https://<web>.up.railway.app>

Expected Web origins:
  <operator pastes the actual list — should include https://<web>.up.railway.app
   without a trailing /* — CORS spec rejects /* in webOrigins>
```

**Path B — `kcadm.sh` (CLI).** Either install locally, or use the in-container
path:

```sh
# Path B-local: install Keycloak distribution + kcadm.sh on workstation
kcadm.sh config credentials --server https://<keycloak>.up.railway.app \
  --realm master --user <bootstrap-admin>
kcadm.sh get clients -r iabconnect --query clientId=iabconnect-frontend \
  --fields redirectUris,webOrigins

# Path B-container: invoke inside the running keycloak service
railway shell -s keycloak --command "/opt/keycloak/bin/kcadm.sh \
  config credentials --server http://localhost:8080 --realm master \
  --user <bootstrap-admin> && /opt/keycloak/bin/kcadm.sh get clients \
  -r iabconnect --query clientId=iabconnect-frontend \
  --fields redirectUris,webOrigins"
# Paste resulting JSON:
#   <operator fills>
```

**Keycloak service substitution env vars.** In the Railway dashboard, navigate
to `keycloak` service → Variables. Confirm both `IABCONNECT_BETA_HOST` and
`FRONTEND_PUBLIC_URL` are set to `https://<web>.up.railway.app` (the live
public domain assigned by Railway to the `web` service, as recorded in
[Section 13.2](#132-service-inventory)).

```text
Operator paste:
  IABCONNECT_BETA_HOST = <fill>
  FRONTEND_PUBLIC_URL  = <fill>
```

**Drift resolution.** If Path A/B returns the literal `${IABCONNECT_BETA_HOST}`
or a stale URL, the env vars were missing at first realm-import time and the
realm cache has the unresolved value. Two options:

1. Set both env vars in Railway, then restart the `keycloak` service. The
   realm import re-runs on next start and the placeholders resolve.
2. If the realm is already in a usable state, manually edit the
   `iabconnect-frontend` client in the Admin Console to set the correct
   URIs. Note this edit is not persisted to git — re-run realm import on
   next deploy will overwrite it.

### 17.5 5-anchor parity table

Operator fills the table below. Each anchor should agree on the **single**
live value of the `api` Railway public domain. Discrepancies are the most
common Beta misconfigurations.

| # | Anchor | Source | Value (operator fills) |
|---|---|---|---|
| 1 | `frontend/.env.example:19` | repo placeholder (documentation only) | `http://localhost:5000` |
| 2 | GHA repo variable `NEXT_PUBLIC_API_URL_BETA` | `gh variable get NEXT_PUBLIC_API_URL_BETA --json value --jq .value` | |
| 3 | `frontend/Dockerfile:49` ARG default | (no default — strict, must be passed) | _(no default)_ |
| 4 | build-args in `.github/workflows/build-images.yml` for `:beta` tag | `gh workflow view build-images.yml --yaml \| grep NEXT_PUBLIC_API_URL` | |
| 5 | Baked literal in `:beta` image | grep result from 17.3 AC-1 | |
| 6 | **Inverse anchor**: backend `api` service `Frontend__BaseUrl` Railway env var (the `web` public domain, CORS strict-allowlist origin per [DependencyInjection.cs:106-132](../backend/src/IabConnect.Api/DependencyInjection.cs#L106-L132)) | Railway dashboard → `api` service → Variables | |

**Expected outcome.** Anchors 2 + 4 + 5 must be byte-identical. Anchor 1 is
documentation only (carries the dev fallback). Anchor 3 has no default
because the Dockerfile fail-fast guard requires it at build time. Anchor 6
is the *inverse* — it's the `web` Railway domain, not the `api` domain, and
it must equal what the backend allows as a CORS origin (verify against the
preflight test in [Section 8.5](#85-cors-allowlist-verification-beta-strict-allowlist-branch)).

**Mismatch resolution.** The GHA repo variable wins for the *image bake*;
the Railway service env var wins for the *runtime CORS allowlist*. If
anchors 2 and 5 disagree, the GHA variable was changed after the image was
built — re-trigger `build-images.yml` on the `beta` branch. If anchor 6
disagrees with the live `web` Railway domain, update the `Frontend__BaseUrl`
env var on the `api` service.

---

## 18. End-to-end OIDC verification (E16-S2)

> Story alignment: **E16-S2** — REQ-088 AC-5. Validates the runtime side of
> the realm-issuer parity invariant from Section 6.3 — that a real JWT
> issued by the deployed Keycloak carries an `iss` claim equal to the
> `api` service's `Keycloak__Authority` Railway env var — plus the rest of
> the OIDC round-trip: PKCE-S256 enforcement, CORS strict-allowlist
> runtime acceptance + hostile-origin rejection, HSTS + HTTPS-redirect on
> the api host, `/api/v1/identity/me` returning the expected claim
> projection, and a two-effect logout (NextAuth cookie + Keycloak SSO).
> Re-run whenever any of (Keycloak version, NextAuth-version, realm
> import JSON, `iabconnect-frontend` client config, or `Keycloak__*`
> Railway env vars on `api`) changes.
>
> **Why this is its own section.** Section 6.3 documents the issuer
> parity as a *static-configuration* invariant; this section closes the
> *runtime* half by reading the actual `iss` claim out of a live JWT.
> Section 8.5 documents the CORS allowlist; Section 8.6 documents
> HSTS + HTTPS-redirect; this section re-verifies both during the OIDC
> walkthrough because the redirect chain traverses both schemes and
> both origins, which is the only path where a misconfiguration
> actually breaks login (Sections 8.5/8.6 isolate each layer; this
> section exercises the integration).

### 18.1 Goal + commitments

This procedure proves seven things end-to-end:

1. A sign-in via the IAB Connect frontend redirects the browser to
   Keycloak, accepts credentials, returns the user to the frontend with
   an authenticated session, and renders a protected page.
2. The OIDC authorization request carries `code_challenge_method=S256` —
   PKCE-S256 is enforced (realm-import declaration is honored at runtime).
3. The resulting access-token's `iss` claim equals
   `Keycloak__Authority` on the `api` service — the *runtime* issuer
   parity that Section 6.3 only proves *statically*.
4. `GET /api/v1/identity/me` with that access token returns 200 with the
   6-field `UserProfileResponse` shape and the user's realm roles in the
   `roles` array.
5. The same endpoint without a bearer token returns 401 — the policy
   gate is real, not silent-`AllowAnonymous`.
6. CORS preflight from `https://<web>.up.railway.app` is accepted; the
   same preflight from `https://evil.example.com` is rejected (the
   strict-allowlist enforcement).
7. Logout terminates *both* the NextAuth session cookie *and* the
   Keycloak SSO session — a fresh sign-in prompts for credentials
   (no silent SSO re-auth).

What this section **does not** prove (out of scope):

- Document upload/download → [Section 19](#19-document-uploaddownload-verification-e16-s3) (E16-S3).
- Automated browser end-to-end test (Playwright against the live Beta
  target) — deferred to E16-FT-1 / future work.

### 18.2 Prerequisites

- **Beta deploy GREEN** — Section 10 has been completed; `web`, `api`,
  `keycloak` reachable on their Railway domains.
- **At least one Beta-Admin user seeded** — per [Section 16](#16-first-beta-admin-seeding-e15-s4)
  (E15-S4). The user must have the `admin` realm role assigned (or
  any user with `vorstand` + `member` if testing role-routing).
- **Section 17 verification green** — the `:beta` image bakes the live
  Railway URLs; misconfigured bakes break the OIDC redirect chain at
  step 1, not step 3.
- **A modern browser with DevTools** — Chrome, Firefox, or Edge.
  Recommend a fresh **Incognito / Private** window so existing
  SSO cookies don't mask Keycloak-side logout failures.
- **`node`** on the operator workstation for offline JWT decoding
  (the secure alternative to `jwt.io`). `node -e "..."` snippets below
  work on any version >= 18.

### 18.3 Sign-in walkthrough

Open a fresh Incognito window. Navigate to
`https://<web>.up.railway.app/login`. Open DevTools → **Network** tab,
check "**Preserve log**" so the redirect chain survives the navigation.

Click "Sign in". Expected redirect chain (paste into the block below):

```text
Operator paste — Network-tab redirect chain (4+ hops):
  GET  https://<web>.up.railway.app/login
       → 200 (login button)
  GET  https://<web>.up.railway.app/api/auth/signin/keycloak?callbackUrl=...
       → 302 to <keycloak>/protocol/openid-connect/auth?
              response_type=code
              &client_id=iabconnect-frontend
              &scope=openid+email+profile
              &code_challenge=<base64url>           ← required (AC-7)
              &code_challenge_method=S256          ← required (AC-7)
              &state=<random>
              &redirect_uri=https%3A%2F%2F<web>.up.railway.app%2Fapi%2Fauth%2Fcallback%2Fkeycloak
  POST <keycloak>/realms/iabconnect/login-actions/authenticate
       (username + password form)
       → 302 to https://<web>.up.railway.app/api/auth/callback/keycloak?code=...&state=...
  GET  https://<web>.up.railway.app/api/auth/callback/keycloak?code=...&state=...
       → 302 to https://<web>.up.railway.app/ (authenticated landing)
```

Confirm the `next-auth.session-token` cookie is now set on
`<web>.up.railway.app` with `HttpOnly` + `Secure` flags
(DevTools → Application → Cookies).

### 18.4 JWT claim verification (offline, secure)

In the DevTools Console, run:

```js
const sess = await (await fetch("/api/auth/session")).json();
const tok = sess.accessToken;
const payloadB64 = tok.split(".")[1];
const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
console.log("iss:", payload.iss);
console.log("aud:", payload.aud);
console.log("azp:", payload.azp);
console.log("sub:", payload.sub);
console.log("realm_access.roles:", payload.realm_access?.roles);
console.log("exp:", new Date(payload.exp * 1000).toISOString());
```

```text
Operator paste:
  iss:                 <fill — must equal Keycloak__Authority byte-for-byte>
  aud:                 <fill — must include "iabconnect-api">
  azp:                 <fill — typically "iabconnect-frontend">
  sub:                 <fill — Keycloak user UUID>
  realm_access.roles:  <fill — must include "admin" (or whatever role admin has)>
  exp:                 <fill — ISO timestamp in the near future>
```

> **Do not paste the access token into [jwt.io](https://jwt.io).** That
> site transmits the token to a third-party server. The `node -e` /
> DevTools `atob` paths above stay entirely on the operator's machine.

**Issuer parity check.** Compare the `iss` value above with the
`Keycloak__Authority` Railway env var on the `api` service
(Railway dashboard → `api` → Variables). Both must be the byte-identical
string `https://<keycloak>.up.railway.app/realms/iabconnect`. Any
difference fails the runtime half of the realm 3-anchor parity
documented at [Section 6.3](#63-the-keycloak_issuer-parity-invariant).

**Drift resolution.** If `iss` and `Keycloak__Authority` diverge,
the api service is rejecting tokens with `Bearer error="invalid_token"`
in its Railway logs. Update `Keycloak__Authority` on the `api` service
to match the `iss` value, restart the api service.

### 18.5 `/api/v1/identity/me` verification + CORS + HSTS

In the DevTools Console, run:

```js
const sess = await (await fetch("/api/auth/session")).json();
const resp = await fetch(`https://<api>.up.railway.app/api/v1/identity/me`, {
  headers: { Authorization: `Bearer ${sess.accessToken}` }
});
console.log("status:", resp.status);
console.log("content-type:", resp.headers.get("content-type"));
console.log("access-control-allow-origin:",
  resp.headers.get("access-control-allow-origin"));
console.log("body:", await resp.json());
```

```text
Operator paste:
  status:                        <fill — 200>
  content-type:                  application/json; charset=utf-8
  access-control-allow-origin:   <fill — must equal https://<web>.up.railway.app>
  body:
    {
      "userId":     "<Keycloak sub UUID>",
      "email":      "<admin email>",
      "name":       "<full name>",
      "givenName":  "<first name>",
      "familyName": "<last name>",
      "roles":      ["admin", ...]
    }
```

**Negative control — no bearer.** From a normal terminal (NOT the
browser, so no session cookie attaches):

```sh
curl -i https://<api>.up.railway.app/api/v1/identity/me
```

```text
Operator paste:
  Expected: HTTP/2 401
  <fill — actual response>
```

**Negative control — hostile CORS origin.** Browser preflight from a
non-allowlisted origin must be rejected. From a normal terminal:

```sh
curl -i -X OPTIONS \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: GET" \
  https://<api>.up.railway.app/api/v1/identity/me
```

```text
Operator paste:
  Expected: response does NOT include "Access-Control-Allow-Origin" header
            (or includes it set to the strict-allowlist value, NEVER echoing
             back the hostile origin)
  <fill — actual response>
```

**HSTS + HTTPS-redirect.**

```sh
# HTTP → 308 to HTTPS
curl -I http://<api>.up.railway.app/api/v1/identity/me
# Expected: HTTP/1.1 308 Permanent Redirect, Location: https://...

# HTTPS carries HSTS header
curl -I https://<api>.up.railway.app/api/v1/identity/me
# Expected: Strict-Transport-Security: max-age=...; includeSubDomains
```

```text
Operator paste:
  HTTP scheme:  <fill — 308 + Location: https://...>
  HSTS header:  <fill — Strict-Transport-Security: ...>
```

### 18.6 Logout verification (two-effect)

Click the user-menu Sign-out action in the IAB Connect frontend.
Verify both effects:

```text
Operator paste:
  Effect 1 (NextAuth-side):
    - DevTools → Application → Cookies: next-auth.session-token cookie is GONE
    - Refreshing any protected route redirects to /login (NOT silent re-auth)
    - <fill: confirmation Yes/No>

  Effect 2 (Keycloak-side):
    - Click "Sign in" again on /login
    - Keycloak prompts for credentials (NOT auto-skipping via SSO cookie)
    - <fill: confirmation Yes/No>
```

If Effect 2 fails (Keycloak auto-skips the credentials form), the
NextAuth session was cleared but the Keycloak SSO session is still alive
— a silent failure of the "logout terminates both" contract. Diagnose
via the `lib/auth.ts#logout` function: it must call NextAuth `signOut`
with a `callbackUrl` pointing at
`<NEXT_PUBLIC_KEYCLOAK_ISSUER>/protocol/openid-connect/logout?redirect_uri=<origin>`.
The Vitest regression test at
[`frontend/src/lib/auth.logout.test.ts`](../frontend/src/lib/auth.logout.test.ts)
guards this contract at CI time; if it regressed without the test
catching it, the test pattern needs strengthening.

### 18.7 Anti-patterns + recovery

- **Silent token-refresh masking issuer drift.** NextAuth's silent
  token refresh runs every 5 minutes by default. If `iss` changes
  between initial sign-in and the next refresh (because someone
  rotated the realm name), the refresh either succeeds with a new
  `iss` (drift now hidden) or fails silently (user sees stale
  session). Always take the JWT for AC-2 verification *immediately
  after sign-in*, before any refresh.
- **`aud` claim mismatch.** Keycloak's audience-resolver issues tokens
  whose `aud` typically equals the client_id of the requesting
  application (`iabconnect-frontend`). The backend JWT validator
  expects `aud` to include `iabconnect-api`. If the realm's
  audience-mapper isn't configured to add `iabconnect-api`, every
  request silently 401s with `Bearer error="invalid_token"
  error_description="The audience 'iabconnect-frontend' is invalid"`.
  Diagnose via Railway api-service logs; fix by adding an
  audience-mapper to the `iabconnect-frontend` client.
- **Clock skew between `<keycloak>` and `<api>` Railway services.**
  JWT `nbf` / `exp` claims are evaluated against the validator's
  clock. >60s skew rejects tokens. Railway services share a managed
  NTP source so this should not happen in practice, but it has shown
  up on fork deployments using self-managed hosts.
- **Cookie-domain / SameSite misconfiguration.** NextAuth defaults
  to `SameSite=Lax`, which works for same-origin OIDC. If the
  Keycloak callback domain differs from the `web` domain by more
  than a port or subpath, the session cookie will not be set on
  callback. Diagnose via DevTools → Network → callback response →
  `Set-Cookie` header sanity check.

**Recovery: locked out after logout fails.**

Clear cookies for both `<web>.up.railway.app` and
`<keycloak>.up.railway.app` in the browser; the next sign-in starts
fresh. The Keycloak SSO session expires server-side per
realm `ssoSessionMaxLifespan` (default 10h) regardless of the
browser-side cookie.

---

## 19. Document upload/download verification against RustFS (E16-S3)

> Story alignment: **E16-S3** — REQ-088 AC-3. Validates that authenticated
> document upload via the IAB Connect frontend persists into the RustFS
> `iabconnect-documents` bucket (NOT into `backups`), the download
> endpoint returns byte-identical bytes (SHA-256 equality), the Next.js
> `<Image>` component renders thumbnails through the configured remote
> pattern, and the **two-bucket separation invariant** introduced by
> E15-S3 holds — `iabconnect-documents` and `backups` live on the same
> RustFS volume but stay disjoint in their key namespaces.
>
> **Why this is its own section.** Section 15 (E15-S3) introduced the
> `backups` bucket and verified the backup-write path; this section
> closes the *other* side — the document-write path — and asserts the
> separation invariant from both directions. Section 17 (E16-S1)
> verified the bake of `NEXT_PUBLIC_DOCUMENT_HOST`; this section
> verifies the *runtime* path renders an actual image.

### 19.1 Goal + commitments

This procedure proves seven things:

1. An authenticated `vorstand` (or `admin`) uploads a deterministic test
   PNG via the frontend Documents UI. Upload returns HTTP 201; the
   document appears in the folder list.
2. The uploaded object exists in the RustFS `iabconnect-documents`
   bucket under key `documents/<documentId>/<random-guid>.png` with
   `Content-Type: image/png` and a content-length equal to the test
   artifact byte size.
3. The download endpoint returns byte-identical bytes (SHA-256
   equality) and the original `Content-Type` + `Content-Disposition`.
4. The Next.js `<Image>` component renders the thumbnail (HTTP 200
   `image/*`) — no `INVALID_IMAGE_OPTIMIZE_REQUEST` 400 error.
5. The `backups` bucket contains **zero** `documents/`-keyed objects;
   the `iabconnect-documents` bucket contains **zero** `pg_dump`-keyed
   objects (two-bucket separation invariant).
6. Two consecutive uploads of the same file produce two distinct
   objects (the `Guid.NewGuid()` salt in the storage key prevents
   silent dedup — `DocumentEndpoints.cs:395`).
7. A `member`-role-only user attempting to download a folder with no
   `Member: Read` permission receives HTTP 403 (folder-level access
   control enforced).

What this section does **not** prove (out of scope):

- Concurrent-upload race tests, >100 MB file tests — deferred.
- Member with `Member: Read` folder permission downloading
  successfully — covered by existing `DocumentEndpoints` unit tests
  in the backend test suite.

### 19.2 Test artifact

The verification uses the well-known canonical 1×1 transparent PNG:

```text
Base64 (single line):
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=

Decoded byte size: 68 bytes
SHA-256: 63ef318d96b5d0d0ceba6e04a4e622b1158335cdc67c49e27839132c6f655058
```

Reconstruct locally:

```sh
# Linux / macOS / Git Bash
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' \
  | base64 -d > hello-world.png

# Verify
sha256sum hello-world.png
# Expected: 63ef318d96b5d0d0ceba6e04a4e622b1158335cdc67c49e27839132c6f655058  hello-world.png
```

```powershell
# Windows PowerShell
$b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
[IO.File]::WriteAllBytes('hello-world.png', [Convert]::FromBase64String($b64))
Get-FileHash hello-world.png -Algorithm SHA256
# Expected Hash: 63EF318D96B5D0D0CEBA6E04A4E622B1158335CDC67C49E27839132C6F655058
```

### 19.3 Upload + RustFS-bucket verification (AC-1, AC-2)

Signed in as the Beta-Admin from §16, navigate to **Board → Documents**
(or **Admin → Documents** if the role assignments require). Create a
test folder (e.g. `e16-s3-verification-folder`) with no member-read
permissions — folder.permissions array stays empty, making the folder
admin-only-readable.

Click **Upload document**; select `hello-world.png` from §19.2; fill
`name = "E16-S3 test document"`; submit.

```text
Operator paste:
  Upload response status:  <fill — must be 201>
  documentId:              <fill — UUID from response body>
```

**Path A — RustFS web console.** Open `https://<rustfs>.up.railway.app`
(or the RustFS console URL recorded in §13.2). Sign in with the RustFS
root credentials from §3.3 / §5.4. Navigate to bucket
`iabconnect-documents` → expand `documents/<documentId>/`. Confirm one
object exists with `.png` extension, size 68 bytes (the artifact size
from §19.2), content-type `image/png`.

```text
Operator paste (RustFS web console):
  Object key:    documents/<documentId>/<random-guid>.png
  Object size:   <fill — must be 68>
  Content-Type:  <fill — must be image/png>
```

**Path B — `mc` inside the rustfs container.** Requires the rustfs
service image to bundle `mc` (MinIO Client). Verify reachability
before proceeding:

```sh
railway shell -s rustfs --command 'which mc'
# Expected output: /usr/bin/mc  (or similar path)
# If the command returns empty, mc is NOT bundled in the rustfs image;
# fall back to Path A or install mc on the operator workstation.
```

If `mc` is reachable:

```sh
railway shell -s rustfs --command \
  "mc alias set local http://localhost:9000 \$RUSTFS_ROOT_USER \$RUSTFS_ROOT_PASSWORD && \
   mc ls local/iabconnect-documents/documents/<documentId>/"
```

```text
Operator paste (mc):
  <fill — single PNG line with size + timestamp>
```

### 19.4 Download + SHA-256 verification (AC-3)

In the browser DevTools Console (with the active authenticated session
from §18):

```js
const sess = await (await fetch("/api/auth/session")).json();
const tok = sess.accessToken;
const documentId = "<paste documentId from §19.3>";
const resp = await fetch(
  `https://<api>.up.railway.app/api/v1/documents/${documentId}/download`,
  { headers: { Authorization: `Bearer ${tok}` } }
);
const blob = await resp.blob();
const buf = await blob.arrayBuffer();
const hash = await crypto.subtle.digest("SHA-256", buf);
const hex = Array.from(new Uint8Array(hash))
  .map(b => b.toString(16).padStart(2, "0"))
  .join("");
console.log("status:", resp.status);
console.log("content-type:", resp.headers.get("content-type"));
console.log("content-disposition:", resp.headers.get("content-disposition"));
console.log("size:", blob.size);
console.log("sha256:", hex);
```

```text
Operator paste:
  status:               <fill — must be 200>
  content-type:         image/png
  content-disposition:  <fill — should reference the document name>
  size:                 68
  sha256:               63ef318d96b5d0d0ceba6e04a4e622b1158335cdc67c49e27839132c6f655058
```

The SHA-256 must equal §19.2's expected hash byte-for-byte.

### 19.5 `next/image` host-allowlist verification (AC-5)

In the document-list UI, the uploaded PNG renders as a thumbnail via
the Next.js `<Image>` component. Open DevTools → **Network** tab →
filter to **Img** requests. Locate the request to
`<web>.up.railway.app/_next/image?url=...&w=...&q=...`. Decode the
`url=` query param (URL-decoded).

```text
Operator paste:
  next/image request URL:
    <fill — e.g. /_next/image?url=https%3A%2F%2F<host>%2F...&w=...&q=...>

  Decoded `url=` host:
    <fill — must match NEXT_PUBLIC_DOCUMENT_HOST_BETA>

  Response status:
    <fill — must be 200>

  Response content-type:
    <fill — must be image/*>
```

**The `INVALID_IMAGE_OPTIMIZE_REQUEST` failure mode.** If the response
is HTTP 400 with body `{ "error": "INVALID_IMAGE_OPTIMIZE_REQUEST" }`,
the `NEXT_PUBLIC_DOCUMENT_HOST_BETA` GHA repo variable is set to a host
not listed in the `next.config.ts` images.remotePatterns allowlist.

**Resolution:**

1. Identify the correct host that serves the document bytes — on the
   current Beta architecture (ADR-013, RustFS private-network), that is
   the **api Railway public domain** (which proxies the download
   endpoint), NOT the `<rustfs>.railway.internal` private hostname.
2. Update the GHA repo variable:
   ```sh
   gh variable set NEXT_PUBLIC_DOCUMENT_HOST_BETA \
     --body "<api>.up.railway.app"
   ```
3. Re-trigger the `build-images.yml` workflow on the `beta` branch.
4. Wait for the new `:beta` web image to publish; Railway pulls and
   redeploys.
5. Re-run §19.5 to confirm 200.

### 19.6 Negative-control + bucket-separation verification (AC-4, AC-6, AC-7, AC-8)

**AC-4 — two-bucket separation.** From inside the rustfs container
(or via the web console):

```sh
railway shell -s rustfs --command \
  "mc ls local/backups/ --recursive | grep -c 'documents/' || true"
# Expected: 0

railway shell -s rustfs --command \
  "mc ls local/iabconnect-documents/ --recursive | grep -c '\.dump\.gz\.enc' || true"
# Expected: 0
```

```text
Operator paste:
  backups/ contains documents/ keys:      <fill — must be 0>
  iabconnect-documents/ contains backup:  <fill — must be 0>
```

**AC-6 — authorization triple.** Three negative controls:

```sh
# (a) no JWT — must be 401
curl -i -X POST \
  -F "file=@hello-world.png" \
  -F "folderId=<any-uuid>" \
  https://<api>.up.railway.app/api/v1/documents/
# Expected: HTTP 401
```

```text
Operator paste (a):
  <fill — must be HTTP 401>
```

```text
(b) member role only → POST upload → must be HTTP 403
    Operator: sign in as a 'member'-only test user (create via Keycloak
    Admin Console → Users → Add user → Role mapping → assign only `member`).
    From DevTools Console:
      const sess = await (await fetch("/api/auth/session")).json();
      const tok = sess.accessToken;
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(68)]), "test.png");
      form.append("folderId", "<any-uuid>");
      fetch("https://<api>.up.railway.app/api/v1/documents/",
            { method: "POST", body: form, headers: { Authorization: `Bearer ${tok}` } })
        .then(r => console.log(r.status));
    Expected: 403

  Operator paste (b):  <fill>
```

```text
(c) documents module disabled → vorstand POST → must be HTTP 403
    Operator: as `admin`, navigate to Admin → Module Settings → toggle
    `Documents` module OFF. As `vorstand`, attempt upload.
    Expected: 403. Re-enable the module after the test.

  Operator paste (c):  <fill>
```

**AC-7 — storage-key uniqueness.** Re-upload `hello-world.png` to the
same folder a second time. Confirm:

- A second document row appears with a distinct `documentId`.
- RustFS bucket lists two objects under `documents/<id-1>/` and
  `documents/<id-2>/` (NOT a single deduped object).

```text
Operator paste:
  Second documentId:             <fill — distinct from first>
  Two distinct prefixes in mc:   <fill — both visible>
```

**AC-8 — folder-permission enforcement.** Sign in as a second user
with ONLY the `member` realm role (no `vorstand` / `admin`). Attempt
to download the document uploaded in §19.3 (the folder has no member
permissions). Expect HTTP 403.

```text
Operator paste:
  Status:  <fill — must be 403>
```

---

## Appendix: secrets-in-repo guard

The dev-agent ran the following greps at story-close and confirmed no operational Railway
tokens, no Sealed values, no Postgres passwords leaked into tracked files:

```sh
git grep -inE 'railway|RAILWAY_TOKEN' \
  -- ':(exclude)docs/*' ':(exclude)_bmad-output/*' ':(exclude)*.md' ':(exclude).github/*'
# Expected: zero operational hits (matches only in story / planning context).

git grep -inE 'NEXTAUTH_SECRET\s*=|CLIENT_SECRET\s*=|EncryptionKey\s*=|RUSTFS_ROOT_PASSWORD\s*=' \
  -- ':(exclude)*.env.example'
# Expected: zero hits assigning real-looking values. Placeholder strings like
# `__set_in_environment__` are OK and excluded.
```

The result of these greps at the close of E13 is captured in each story's Quality-Gates
table (AC-11 for E13-S1, AC-11 for E13-S2).
