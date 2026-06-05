<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# RUNBOOK — IAB Connect Beta (Railway)

**Audience:** the on-call operator (today: the maintainer; tomorrow: any fork operator running the published images).
**Scope:** Beta on Railway. Local Docker Compose is out of scope (see `infra/docker-compose.yml` + `README.md`).

## How to use this runbook

This runbook is an **incident-first index**. It does **not** restate the full provisioning walkthrough — that lives in
[`docs/14_beta_railway_setup.md`](../../docs/14_beta_railway_setup.md) (the "setup guide"), which this runbook cross-links by
section number. Reach for this file when something is **already running and you need to act**: deploy a change, roll back a bad
deploy, restore the database, find logs, or work an incident. Each routine procedure is a short summary plus a setup-guide link;
each incident is a self-contained **Symptoms → Diagnose → Fix → Verify** playbook you can run top-to-bottom under pressure.

> Convention used below: `→ setup guide §N` means "open `docs/14_beta_railway_setup.md`, section N, for the detailed steps".
> A `[!] verify before executing` marker means the command targets a tool the authors did not exercise in-session — confirm it
> against that tool's current docs before you run it in a real incident.

## Table of contents

1. [Deploy](#1-deploy)
2. [Rollback](#2-rollback)
3. [Database restore](#3-database-restore)
4. [Logs](#4-logs)
5. [Bootstrap: first Beta-Admin](#5-bootstrap-first-beta-admin)
6. [Incident playbooks](#6-incident-playbooks)
7. [Quick reference](#7-quick-reference)
8. [Custom-domain migration](#8-custom-domain-migration) *(placeholder — authored by E19-S1)*
9. [Production-gate NFR checklist](#9-production-gate-nfr-checklist) *(placeholder — authored by E19-S3)*

---

## 1. Deploy

**Routine Beta deploy is push-to-deploy.** Push a commit to the `beta` branch → GitHub Actions
[`build-images.yml`](../../.github/workflows/build-images.yml) rebuilds the three application images (`api`, `web`, `keycloak`)
and publishes them to GHCR → Railway detects the new `:beta` image digest and redeploys the three image services.

- **Two tags per build** (per [ADR-014](../planning-artifacts/architecture.md)): `:beta` (moving — overwritten every `beta`
  push) and `:sha-<commit>` (immutable — one per build, the rollback artifact). **There is no `:latest`.**
- The running commit is cross-checkable at the API `/about` endpoint (E20-S3) — `commitSha` field.
- The two managed Postgres services and the RustFS volume service are **not** rebuilt by a push; they persist across deploys.

**Detailed first-deploy + pre-flight checklist + browser smoke:** → setup guide §10 (First end-to-end deploy).
**Per-service env vars that must be present for a deploy to go healthy:** → setup guide §5 (Railway variables per service).

> Manual redeploy (without a code change) is available from the Railway dashboard → service → **Deploy** → Redeploy. Use it to
> pick up a changed Railway Variable (variables are not baked into the image, so a redeploy is enough — except for build-time
> `NEXT_PUBLIC_*` values, which require an image rebuild; → setup guide §6 Build-time vs runtime variables).

---

## 2. Rollback

**Roll back by redeploying the previous good `:sha-<commit>` immutable tag.** The `:beta` moving tag is overwritten on every
push and is therefore **not** a rollback target.

1. Identify the last-good commit SHA. Sources: the API `/about` endpoint's `commitSha` from before the bad deploy, or the GHCR
   package's tag list, or the `beta` branch git history.
2. Railway dashboard → the affected service (`api` / `web` / `keycloak`) → **Settings** → **Source** → edit the image reference
   to `ghcr.io/htos/iabc-<service>:sha-<previous-commit>` (e.g. `ghcr.io/htos/iabc-keycloak:sha-<previous-commit>`).
3. **Redeploy.** Repeat for each service that needs rolling back (they version independently).

→ setup guide §11 (Recovery procedures) has the dashboard walkthrough and the per-service image URLs.

> A code rollback (`git revert` on `beta`) also works but takes a full CI rebuild (~minutes). The `:sha-` redeploy is the fast
> path because the immutable image already exists in GHCR.

---

## 3. Database restore

Daily encrypted backups of the application Postgres are written by the `daily-pg-backup` Hangfire job at `0 3 * * *` UTC to the
RustFS `backups` bucket as `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` ([ADR-019](../planning-artifacts/architecture.md)). Retention
is 30 days (`prune-old-backups` at `0 4 * * *` UTC).

**To restore a backup into a throwaway target and validate before cutting traffic:**

1. **Locate** the backup object on RustFS (`backups/<year>/<month>/<dd-HHmmss>.dump.gz.enc`) — RustFS web console or `mc ls`.
2. **Decrypt** with the application's C# `BackupEncryption` helper. The on-disk format is AES-256-GCM framed as
   `[12-byte nonce][16-byte tag][ciphertext]` — this is **not** an `openssl enc` recipe; do **not** try to decrypt with
   `openssl`. Use the in-repo helper / a small dotnet invocation against
   [`BackupEncryption`](../../backend/src/IabConnect.Infrastructure/Backup). `[!] verify before executing` the exact invocation
   for your restore host.
3. **Gunzip** the decrypted output to a `.dump` file.
4. **Restore** into a **throwaway** Postgres (a separate Railway Postgres or local Compose — never the live DB on the first
   pass):
   ```bash
   PGPASSWORD="<restore-target-password>" pg_restore \
     --clean --if-exists --no-password \
     --host <restore-target-host> --port 5432 \
     --username "<restore-target-user>" --dbname railway \
     /tmp/restore-incoming.dump
   ```
   `pg_restore` is available inside the `api` container (the runtime image installs `postgresql-client-17`, see
   [`backend/Dockerfile`](../../backend/Dockerfile)) — run it via `railway shell --service api` or from any host with the v17
   client. `[!] verify before executing` against your Railway CLI version.
5. **Validate** row counts / spot-check critical tables BEFORE pointing the live API at the restored database.

→ setup guide §15 (Daily PostgreSQL backup + restore) has the full step-by-step incl. the manual restore drill.

> **Blast-radius caveat (ADR-019):** backups live on the **same** RustFS instance as the primary documents. A catastrophic
> Railway-volume loss takes down primary docs **and** backups — an accepted Beta-phase risk. Off-site replication is an E19
> (production-readiness) concern.
> **Encryption-key caveat:** `Backup__EncryptionKey` is single-key-at-a-time. Rotating it makes all **pre-rotation** backups
> undecryptable with the new key. Archive the old key in a separate vault before rotating (→ setup guide §15 + §7 Secret
> rotation). See [Incident 6.7](#67-backups-undecryptable-after-key-rotation).

---

## 4. Logs

Serilog is **Console-only** in containers (Beta + Production), per E17-S1 + [ADR-017](../planning-artifacts/architecture.md).
There is **no file sink to `tail`** inside the container — all log data flows to the container's stdout and is captured by
Railway.

- **Railway dashboard** → service → **Logs** tab: streamed, searchable, enriched with `CorrelationId` (E17-S2 —
  `CorrelationIdMiddleware`) so you can trace one request across log lines.
- **Railway CLI:** `railway logs --service <api|web|keycloak>` (add your CLI's tail/follow flag). `[!] verify before executing`
  against your Railway CLI version.
- Each request log line carries a `CorrelationId`; the client also gets it back in the `X-Correlation-Id` response header, so a
  tester can quote it in a bug report and you can grep for it.

→ setup guide §25 (Serilog Console-only) + §26 (Structured logs with CorrelationId).

> Long-term log retention / aggregation (Seq, Loki) is **out of Beta scope** — Railway's log buffer is the system of record for
> Beta. If you need an incident's logs preserved, copy them out of the Logs tab before the buffer rolls.

---

## 5. Bootstrap: first Beta-Admin

The Beta realm ships with an **empty Users table** (the `realms-beta` import is sanitised — no seeded accounts). The first
Beta-Admin is created **manually via the Keycloak Admin Console**, not by code.

**Summary:** Keycloak Admin Console → realm `iabconnect` → **Users → Add user** (email as username, **Email verified ON**) →
**Credentials → Set password** (Temporary **OFF**, store in a password manager immediately) → **Role mapping → Assign role →
`admin`** (one of the seven realm roles: `mfa-required`, `admin`, `vorstand`, `member`, `kassier`, `auditor`, `event-manager`).

→ setup guide §16 (First Beta-Admin seeding) has the click-by-click steps + the role table.

**Anti-patterns (do NOT):**
- Do **not** `INSERT` a user into `postgres-kc` via SQL — Keycloak password hashing is non-reproducible.
- Do **not** run `DevelopmentDataSeeder` against Beta — it is gated to `IsDevelopment()` (regression test
  `DevelopmentDataSeederGatingTests`) and would create dev accounts with known credentials.
- Do **not** import a dev-realm dump into Beta — it would expose seeded tester accounts with leaked credentials.
- Do **not** delete the `postgres-kc` volume to "start fresh" — that destroys realm config and every account.

> Lost the master-realm admin password? → [Incident 6.1](#61-keycloak-wont-go-healthy-crash-loop) (Keycloak recovery via
> `kc.sh bootstrap-admin user`).

---

## 6. Incident playbooks

Each incident is **Symptoms → Diagnose → Fix → Verify**. Work them top-to-bottom.

### 6.1 Keycloak won't go healthy (crash-loop)

- **Symptoms:** the `keycloak` service's Deploys tab shows a restart loop; logs contain `KC-SERVICES` errors; login is down.
- **Diagnose:** open the `keycloak` Logs tab. Most common causes: (a) `KC_DB_URL` / `KC_DB_USERNAME` / `KC_DB_PASSWORD`
  reference unresolved (the `${{postgres-kc.*}}` Railway references didn't bind); (b) `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`
  missing on first boot; (c) the master-realm admin was lost.
- **Fix:**
  1. If a recent deploy caused it → roll back the `keycloak` service to its previous `:sha-` tag ([§2](#2-rollback)).
  2. If the DB env references are wrong → fix them in setup guide §5 (Railway variables, `keycloak` service) and redeploy.
  3. If the master admin is lost → open a shell on the running container and seed a recovery admin with Keycloak 26's
     `bootstrap-admin user` subcommand:
     ```bash
     export KC_BOOTSTRAP_ADMIN_PASSWORD='<new-strong-random>'
     kc.sh bootstrap-admin user --username recovery --password:env KC_BOOTSTRAP_ADMIN_PASSWORD
     ```
     (Verified form per setup guide §11.2 — note it is `bootstrap-admin user`, not bare `bootstrap-admin`, and there is no
     `--realm` flag.) `[!] verify before executing` against your Keycloak image version if it is not 26.x.
- **Verify:** the `keycloak` service reaches healthy; the Admin Console at `https://<keycloak-domain>/admin/` logs in.

### 6.2 API won't go healthy (Keycloak / DB health-check failing)

- **Symptoms:** the `api` service healthcheck returns 503; `/health/ready` is red; `/health/detail` shows a dependency
  `Unhealthy`.
- **Diagnose:** from inside the container, `railway shell --service api` then `curl -s http://localhost:8080/health/detail`
  (`[!] verify` the CLI shell command). Read the raw JSON, or pipe to `jq` **on your workstation** — `jq` is **not** installed
  in the `api` image (it ships only `curl` + `postgresql-client-17`), so an in-container `| jq` will fail. Common causes: (a)
  `Keycloak__Authority` does not equal the real Keycloak issuer; (b) the Keycloak discovery endpoint is unreachable from `api`;
  (c) `Frontend__BaseUrl` CORS mismatch.
- **Fix:** confirm the **five-anchor `Keycloak__Authority` parity invariant** — `api.Keycloak__Authority`,
  `web.KEYCLOAK_ISSUER`, `keycloak.KC_HOSTNAME`, `api.KeycloakAdmin__BaseUrl`, and the GHA
  `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` build var must all describe the same Keycloak public URL. Fix whichever drifted (→ setup
  guide §6 / §5) and redeploy.
- **Verify:** `/health/ready` returns 200; `/health/detail` shows all dependencies `Healthy`; login works.

### 6.3 Login fails with `Invalid parameter: redirect_uri`

- **Symptoms:** clicking login redirects to Keycloak, which returns `Invalid parameter: redirect_uri`; the user never reaches
  the app.
- **Diagnose:** the `iabconnect-frontend` client's allowed redirect URIs don't include the live `web` domain. Root cause is
  almost always the `IABCONNECT_BETA_HOST` Railway variable on the `keycloak` service unset, or set without the `https://`
  scheme — it resolves the `${IABCONNECT_BETA_HOST}` placeholder in the realm import into the client's `redirectUris[0]` and
  `webOrigins[0]`.
- **Fix:** set `keycloak.IABCONNECT_BETA_HOST` to `https://<web-public-domain>` (**with** the `https://` scheme — mandatory) →
  setup guide §5. Redeploy `keycloak` (the realm import re-applies). If the realm was already imported, also confirm/repair the
  client's Valid Redirect URIs in the Admin Console (Clients → `iabconnect-frontend` → Settings).
- **Verify:** Admin Console shows the client's Valid Redirect URIs include `https://<web-domain>/*`; a fresh login round-trips
  to the app.

### 6.4 Database connection refused / migration failure on boot

- **Symptoms:** `api` boot logs show `connection refused`, `host not found`, or `password authentication failed`; the service
  never goes healthy.
- **Diagnose:** inspect the resolved connection string —
  `railway run --service api bash -c 'echo $ConnectionStrings__DefaultConnection'` (`[!] verify` CLI form). Expected (redacted):
  `Host=postgres-app.railway.internal;Port=5432;Database=railway;Username=<redacted>;Password=<redacted>`.
  - `connection refused` → `${{postgres-app.RAILWAY_PRIVATE_DOMAIN}}` reference unresolved.
  - `host not found` → `postgres-app` service renamed/removed.
  - `password authentication failed` → the `${{postgres-app.PGPASSWORD}}` reference points at the wrong service.
- **Fix:** repair the `ConnectionStrings__DefaultConnection` Railway reference on the `api` service (→ setup guide §5 / §14) and
  redeploy. If the schema is behind, the auto-migrate path runs on boot (`Database__AutoMigrate`, E15-S2) — give the healthcheck
  its 60-second window (→ [Incident 6.6](#66-healthcheck-timeout-on-deploy)).
- **Verify:** the connection-string echo shows the correct private hostname + service; `api` reaches healthy; `/health/detail`
  DB check is `Healthy`.

### 6.5 Document upload fails / RustFS unreachable

- **Symptoms:** uploading or downloading a document fails with an S3 timeout or `403 Forbidden`.
- **Diagnose:** check the `api` Logs tab on the first request that touches storage — the S3 client should target
  `http://rustfs.railway.internal:9000/...`. Causes: (a) `DocumentStorage__ServiceUrl` points at the wrong host; (b)
  `DocumentStorage__AccessKey` / `__SecretKey` drifted from what RustFS expects.
- **Fix:** confirm the `api` storage variables (→ setup guide §5, `api` service) — `ServiceUrl` =
  `http://rustfs.railway.internal:9000`, access/secret keys match the `rustfs` service config. Redeploy `api`. Verify RustFS is
  itself up (`rustfs` service healthy; bucket exists).
- **Verify:** a document upload succeeds and the object appears in the RustFS bucket (web console or `mc ls`).

### 6.6 Healthcheck timeout on deploy

- **Symptoms:** a Railway deploy aborts after ~60 seconds with "Healthcheck failed", even though the app looks like it is
  starting.
- **Diagnose:** first-run cold starts can be slow — EF Core migrations on a cold DB, Keycloak realm import against an empty DB,
  or Keycloak discovery warm-up. The `api` healthcheckPath is `/health/ready` with a **60-second** timeout precisely to absorb
  first-startup migrations (→ setup guide §9 Health probes).
- **Fix:** if it is genuinely just slow first-boot, retry the deploy — the second boot (DB already migrated, realm already
  imported) is fast. If it times out repeatedly, exec in and call the healthcheck directly
  (`railway shell --service api; curl http://localhost:8080/health/ready`) to see which dependency is blocking, then work the
  matching incident (6.2 / 6.4).
- **Verify:** the deploy completes; `/health/ready` returns 200 within the window on a warm boot.

### 6.7 Backups undecryptable after key rotation

- **Symptoms:** restoring an older backup fails at the decrypt step with an authentication/decryption error.
- **Diagnose:** `Backup__EncryptionKey` was rotated; the old backups were encrypted with the **previous** key. The on-disk
  format is single-key-at-a-time (no key-version header), so the new key cannot decrypt pre-rotation objects.
- **Fix:** retrieve the **previous** `Backup__EncryptionKey` from the vault where it was archived at rotation time (→ setup
  guide §7 Secret rotation + §15) and decrypt with it. If the old key was not archived, those pre-rotation backups are
  unrecoverable — restore from the newest post-rotation backup instead.
- **Verify:** the decrypt step with the archived key succeeds; `pg_restore` proceeds; row counts validate.
- **Prevention:** before any `Backup__EncryptionKey` rotation, store the current value in a separate recovery vault. Treat the
  key as independent from the DB credentials and never log it.

---

## 7. Quick reference

| Need | Where |
|---|---|
| Routine deploy | [§1](#1-deploy) → setup guide §10 |
| Roll back a bad deploy | [§2](#2-rollback) → setup guide §11 |
| Restore the database | [§3](#3-database-restore) → setup guide §15 |
| Find logs | [§4](#4-logs) → setup guide §25/§26 |
| Create the first admin | [§5](#5-bootstrap-first-beta-admin) → setup guide §16 |
| Keycloak down | [§6.1](#61-keycloak-wont-go-healthy-crash-loop) → setup guide §11.2 |
| API down | [§6.2](#62-api-wont-go-healthy-keycloak--db-health-check-failing) → setup guide §6.3 |
| Login `redirect_uri` error | [§6.3](#63-login-fails-with-invalid-parameter-redirect_uri) → setup guide §5.3 |
| DB connection errors | [§6.4](#64-database-connection-refused--migration-failure-on-boot) → setup guide §14 |
| Uploads failing | [§6.5](#65-document-upload-fails--rustfs-unreachable) → setup guide §8 |
| Image tags | `:beta` (moving) + `:sha-<commit>` (rollback). No `:latest`. |
| Backup schedule | `daily-pg-backup` 03:00 UTC; `prune-old-backups` 04:00 UTC; 30-day retention |
| Running commit | API `/about` → `commitSha` |

---

## 8. Custom-domain migration

> **Placeholder — authored by E19-S1 (Production Readiness Preparation).**
> This section will cover migrating from the Railway-default domain to a custom domain: DNS records, Keycloak hostname change,
> redirect-URI updates, and the `Frontend__BaseUrl` / `NEXT_PUBLIC_API_URL` rebuild. Not yet authored.

## 9. Production-gate NFR checklist

> **Placeholder — authored by E19-S3 (Production Readiness Preparation).**
> This section will hold the NFR-threshold checklist (response-time targets, error-rate, backup-success-rate, uptime
> percentage) that gates a future Production-Go-Live decision. Not yet authored.
