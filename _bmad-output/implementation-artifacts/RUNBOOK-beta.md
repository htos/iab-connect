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
8. [Custom-domain migration](#8-custom-domain-migration)
9. [Production-gate NFR checklist](#9-production-gate-nfr-checklist)

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

### 3.1 Restore drill (rehearsal + captured log)

A backup file existing is **not** proof it restores. This drill rehearses §3 end-to-end against a **throwaway** target, then proves
the *data* came back — not just the schema — by smoke-testing a throwaway API pointed at the restored database. Run it periodically and
append one row to the drill log below; that log is the Production-readiness evidence (gate row in [§9](#9-production-gate-nfr-checklist)).

> The live drill requires a green Beta that has produced at least one real `daily-pg-backup` object. Until then this section is the
> procedure of record; the log table ships blank — **do not pre-fill it with example numbers.**

**Drill steps:**

1. **Locate yesterday's backup.** On the RustFS `backups` bucket, find `backups/<year>/<month>/<dd-HHmmss>.dump.gz.enc` for the previous
   UTC day (written by `daily-pg-backup` at `0 3 * * *` UTC). Use the RustFS web console or `mc ls` **on your workstation** — `mc` is
   **not** installed in the `api` image. `[!] verify before executing` the `mc` alias/credentials for your RustFS endpoint.
2. **Decrypt → gunzip → restore into a throwaway** exactly per [§3](#3-database-restore) steps 2–4 (C# `BackupEncryption`, **not**
   `openssl`; then `pg_restore --clean --if-exists` into a **throwaway** Postgres — never the live DB). `[!] verify` the `railway shell`
   + decrypt invocation for your host.
3. **Point a throwaway API at the restored DB.** Stand up a throwaway `api` (a temporary Railway service, or local Compose) whose
   `ConnectionStrings__DefaultConnection` targets the restored throwaway Postgres. Set `Database__AutoMigrate=false` on the drill API so
   the restore is validated **as-restored**, not silently migrated over. **Never** re-point the live `api` at the restored DB on the
   first pass.
4. **Run the smoke set** against the throwaway API and record each result (a–e):
   - **(a)** `GET /health/ready` → 200.
   - **(b)** `GET /health/detail` → all dependencies `Healthy` (the DB check proves the restored DB is reachable + schema-valid).
   - **(c)** `GET /about` → reachable (running `commitSha`).
   - **(d)** A browser login round-trip (or, if the throwaway has no Keycloak wired, an authenticated API call with a token from the
     live Keycloak).
   - **(e)** Spot-check row counts on critical tables (members / finance / events) — proves **data** restored, not just schema.
5. **Append a drill-log row** (below). Tear down the throwaway target.

**Drill log** — append one row per drill run; do not edit prior rows:

| Drill date | Backup object key (timestamp) | Backup age | Restore duration | Throwaway target | Smoke (a/b/c/d/e) | Operator | Notes |
|---|---|---|---|---|---|---|---|
| _(fill during the live drill)_ | | | | | | | |

> Caveats this drill exercises (cross-linked, not restated): the [ADR-019](../planning-artifacts/architecture.md) single-RustFS
> blast-radius (backups share the documents volume — off-site replication is the E19 Production follow-up) and the single-key-at-a-time
> `Backup__EncryptionKey` ([Incident 6.7](#67-backups-undecryptable-after-key-rotation) — a key rotated without archiving the old one
> makes pre-rotation backups undecryptable, which a drill surfaces).

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
| Rehearse a restore (drill + log) | [§3.1](#31-restore-drill-rehearsal--captured-log) → setup guide §15 |
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
| Custom-domain cutover | [§8](#8-custom-domain-migration) → setup guide §6.3 (five-anchor parity) |
| Production go/no-go | [§9](#9-production-gate-nfr-checklist) (NFR thresholds + cutover blockers) |

---

## 8. Custom-domain migration

This section rehearses a **future Production cutover** from the Railway-default `*.up.railway.app` domains to custom domains for the
three public services (`web`, `api`, `keycloak`). The Railway defaults keep serving throughout — you retire them **last**, only after
the custom domains are verified. Nothing here is destructive until that final step, and every step carries a rollback note.

> **Worked example:** an apex `example.org` with three subdomains — `app.example.org` (web), `api.example.org` (api),
> `auth.example.org` (keycloak). Independent (non-subdomain) domains work identically — each is just another Railway custom domain + a
> DNS record at your provider.

### 8.1 What changes — and why the build-time bake-ins are the trap

A custom-domain swap touches **runtime Railway variables** (edit + redeploy) **and** **build-time bake-ins** (which need a `web` image
rebuild). The single most common failure is updating the runtime side and forgetting that the two `NEXT_PUBLIC_*` values are frozen into
the `web` image at build time — a Railway-variable edit on them is a **no-op** (→ setup guide §6 Build-time vs runtime variables).

| Value | Service | Type | New value | Cutover action |
|---|---|---|---|---|
| `KC_HOSTNAME` | keycloak | runtime | `auth.example.org` (bare) | edit + redeploy |
| `IABCONNECT_BETA_HOST` | keycloak | runtime | `https://app.example.org` | edit + redeploy (re-applies `redirectUris[0]` / `webOrigins[0]`) |
| `FRONTEND_PUBLIC_URL` | keycloak | runtime | `https://app.example.org` | edit + redeploy (re-applies `redirectUris[1]` / `webOrigins[1]`) |
| `Keycloak__Authority` | api | runtime | `https://auth.example.org/realms/iabconnect` | edit + redeploy |
| `KeycloakAdmin__BaseUrl` | api | runtime | `https://auth.example.org` | edit + redeploy |
| `Frontend__BaseUrl` | api | runtime | `https://app.example.org` | edit + redeploy (drives CORS + absolute mail links) |
| `KEYCLOAK_ISSUER` | web | runtime | `https://auth.example.org/realms/iabconnect` | edit + redeploy |
| `NEXTAUTH_URL` | web | runtime | `https://app.example.org` | edit + redeploy (NextAuth callback URL — a stale value breaks login) |
| `NEXT_PUBLIC_API_URL_BETA` | GHA repo var → `iabc-web` image | **build-time** | `https://api.example.org` | update repo var + **rebuild `web`** |
| `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` | GHA repo var → `iabc-web` image | **build-time** | `https://auth.example.org/realms/iabconnect` | update repo var + **rebuild `web`** |

> The `web` service carries **both** kinds: two build-time `NEXT_PUBLIC_*` bakes **and** two runtime vars (`KEYCLOAK_ISSUER`,
> `NEXTAUTH_URL`). The rebuild in step 5 covers the bakes; the two runtime `web` vars are edited + redeployed like any other Railway
> variable. Missing `NEXTAUTH_URL` is a silent login break; missing `web.KEYCLOAK_ISSUER` breaks the five-anchor parity (§8.2).

> **Scheme + path rules (getting these wrong is the §6.2 / §6.3 incident):**
> - `KC_HOSTNAME` = the **bare hostname** (`auth.example.org`, no `https://`, no path).
> - `Keycloak__Authority`, `web.KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` = the **full issuer URL with the realm path**:
>   `https://auth.example.org/realms/iabconnect`.
> - `KeycloakAdmin__BaseUrl` = `https://auth.example.org` (scheme, **no** realm path).
> - `IABCONNECT_BETA_HOST`, `FRONTEND_PUBLIC_URL`, `Frontend__BaseUrl`, `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL_BETA` = full `https://`
>   origins (`https://app.example.org`, `https://api.example.org`).

### 8.2 The five-anchor issuer-parity invariant (restated for the cutover)

After the cutover, all five anchors must describe the **same** new Keycloak public URL — treat them as **one atomic change set**:

| # | Anchor | New value | Type |
|---|---|---|---|
| 1 | `api.Keycloak__Authority` | `https://auth.example.org/realms/iabconnect` | runtime |
| 2 | `web.KEYCLOAK_ISSUER` | `https://auth.example.org/realms/iabconnect` | runtime |
| 3 | `keycloak.KC_HOSTNAME` | `auth.example.org` (bare) | runtime |
| 4 | `api.KeycloakAdmin__BaseUrl` | `https://auth.example.org` | runtime |
| 5 | GHA `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` | `https://auth.example.org/realms/iabconnect` | **build-time → rebuild** |

A partial update is the [§6.2 "API won't go healthy"](#62-api-wont-go-healthy-keycloak--db-health-check-failing) incident (login starts
at issuer A, ends at issuer B → silent token rejection). Re-run the full 5-anchor diff → setup guide §6.3 after the cutover.

### 8.3 Ordered cutover checklist (each step reversible)

1. **Add the three custom domains in Railway** (dashboard → each public service → Settings → Networking → Custom Domain → add
   `app.`/`api.`/`auth.example.org`). Railway issues a CNAME target per domain. `[!] verify before executing` against your Railway
   dashboard version. *Rollback:* delete the custom domain in Railway — the `*.up.railway.app` default keeps serving.
2. **Create the DNS records** at your DNS provider: a `CNAME` for each subdomain → the Railway-issued target (an apex would use
   `ALIAS`/`ANAME`). Wait until Railway shows each domain **Active** (TLS cert issued). `[!] verify before executing` —
   `dig +short app.example.org CNAME` (and `api`/`auth`) should return the Railway target. *Rollback:* remove the DNS record.
3. **Keycloak first.** Set `keycloak.KC_HOSTNAME = auth.example.org` (bare), `keycloak.IABCONNECT_BETA_HOST = https://app.example.org`
   (scheme), and `keycloak.FRONTEND_PUBLIC_URL = https://app.example.org` (the realm import uses **both** host vars — `IABCONNECT_BETA_HOST`
   → `redirectUris[0]`/`webOrigins[0]` and `FRONTEND_PUBLIC_URL` → `redirectUris[1]`/`webOrigins[1]`; setup guide §5.3 line 499 names this
   the E19-S1 divergence point) → **redeploy `keycloak`** so the realm import re-applies the `iabconnect-frontend` client's redirect URIs +
   web origins. If the realm was already imported, also repair the client's Valid Redirect URIs / Web Origins in the Admin Console
   (Clients → `iabconnect-frontend` → Settings) → setup guide §5.3 / §17.4. *Rollback:* restore the previous `KC_HOSTNAME` /
   `IABCONNECT_BETA_HOST` / `FRONTEND_PUBLIC_URL` values + redeploy.
4. **API next.** Set `api.Keycloak__Authority = https://auth.example.org/realms/iabconnect`,
   `api.KeycloakAdmin__BaseUrl = https://auth.example.org`, and `api.Frontend__BaseUrl = https://app.example.org` → **redeploy `api`**.
   *Rollback:* restore the previous three values + redeploy.
5. **Update the web runtime vars + rebuild the web image (build-time bakes).** The `web` service needs **both**:
   - **Runtime vars** (edit + redeploy `web`): `web.KEYCLOAK_ISSUER = https://auth.example.org/realms/iabconnect` and
     `web.NEXTAUTH_URL = https://app.example.org`. **A stale `NEXTAUTH_URL` silently breaks login; a stale `web.KEYCLOAK_ISSUER` breaks
     the §8.2 parity.**
   - **Build-time bakes** (GHA repo var + rebuild): `NEXT_PUBLIC_API_URL_BETA = https://api.example.org` and
     `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA = https://auth.example.org/realms/iabconnect`, then trigger a `web` image rebuild (push to `beta`,
     or re-run [`build-images.yml`](../../.github/workflows/build-images.yml)). **A Railway-variable edit on the `NEXT_PUBLIC_*` values has
     no effect** — they are frozen at build time (→ setup guide §6).
   Do the runtime edits and the rebuild together so the single `web` redeploy picks up all four. *Rollback:* restore the previous runtime
   var values + the previous repo-variable values + rebuild.
6. **Browser smoke (mandatory).** From `https://app.example.org`: log in (full round-trip through `auth.example.org`); confirm
   `https://api.example.org/health/ready` is 200; confirm the CORS `Access-Control-Allow-Origin` echoes `https://app.example.org`; confirm
   `https://api.example.org/about` loads. This browser pass is the only way to catch cookie-domain / issuer / CORS bugs (→ setup guide
   §10.4). *Rollback:* if anything fails, revert the changed variables per the per-step rollback notes (the defaults are still live).
7. **Retire the old defaults (last, optional).** Once the custom domains are verified stable, you may remove the `*.up.railway.app`
   domains from the three services. *Rollback:* the defaults can be re-added in Railway at any time — keep them until you are confident.

### 8.4 Post-cutover verification

- Re-run the five-anchor parity diff (→ setup guide §6.3) — anchors 1/2/5 equal `https://auth.example.org/realms/iabconnect`, anchor 3
  equals `auth.example.org`, anchor 4 equals `https://auth.example.org`.
- A fresh browser login round-trips on `https://app.example.org`.
- `/health/ready` → 200; `/health/detail` → all dependencies `Healthy`.
- CORS: a request from `app.example.org` to `api.example.org` returns `Access-Control-Allow-Origin: https://app.example.org`; an unknown
  origin does not.
- `https://api.example.org/about` returns the running `commitSha`.

> Login fails with `Invalid parameter: redirect_uri` after the cutover → [Incident 6.3](#63-login-fails-with-invalid-parameter-redirect_uri).
> API won't go healthy → [Incident 6.2](#62-api-wont-go-healthy-keycloak--db-health-check-failing).

## 9. Production-gate NFR checklist

A documented go/no-go gate for a future **Production-Go-Live** decision. Two tables: (9.1) measurable NFR thresholds, each anchored to a
telemetry source the Beta deployment already produces; (9.2) the architectural cutover blockers. **Snapshot this section into your
go/no-go record per decision — do not tick the master copy here** (a ticked checklist becomes a one-decision artifact, not a reusable gate).

> Beta has **no APM / metrics aggregator** — Seq / Loki / Prometheus are out of Beta scope ([ADR-017](../planning-artifacts/architecture.md)).
> Thresholds that would need a percentile dashboard are marked **`[!] needs measurement tooling`** rather than implied to be measurable
> today; standing that tooling up is itself a Production-readiness item.

### 9.1 NFR thresholds

Proposed thresholds — the maintainer tunes the numbers; the **measurement source** column is the load-bearing part (every threshold must
be checkable from existing Beta telemetry).

| NFR | Proposed threshold | Rationale | Measurement source (existing Beta telemetry) | Measured value | Pass/Fail |
|---|---|---|---|---|---|
| **Uptime** | ≥ 99.5% rolling 30-day | Free-tier-monitor-observable floor; ~15–20 min detection floor (3×5-min poll) bounds the achievable SLA | E17-S4 external monitor dashboard (UptimeRobot / BetterStack / Uptime-Kuma) polling `/health/ready` → setup guide §27 | | |
| **Error-rate** | < 1% of requests (5xx) over rolling 7-day | Distinguishes a genuinely unstable service from incidental client errors | Serilog request log (E17-S2 `UseSerilogRequestLogging`, CorrelationId-enriched) via Railway Logs tab → setup guide §26; Railway Metrics tab for infra-level signal | | |
| **Response-time** | p95 < 800 ms for primary read endpoints — `[!] needs measurement tooling` | A user-perceptible-latency target; no percentile dashboard in Beta, so today this is a **sampled** read of the request logs, not a computed p95 | Serilog request log sampling (manual) → setup guide §26. `[!]` a percentile would need an APM/log-aggregator (Seq/Loki) | | |
| **Backup-success-rate** | ≥ 29 of 30 daily backups present **and** the most recent [§3.1](#31-restore-drill-rehearsal--captured-log) restore drill green | A backup that never restores is not a backup — success = object present **and** restorable | `daily-pg-backup` Hangfire job success/failure log lines (Railway Logs) + RustFS `backups/` object count vs. daily cadence; restorability from the §3.1 drill log | | |

### 9.2 Production-cutover blockers

Architectural items deferred to Production (each named in an ADR / E19 story). All must be resolved before go-live; this is the single
go/no-go home for them.

| Blocker | What must change | Source | Done |
|---|---|---|---|
| Retention enforcement re-enabled | `RetentionEnforcement__Enabled` `false` → `true` with audited default policies | [ADR-020](../planning-artifacts/architecture.md) | |
| Manual migration path | `Database__AutoMigrate` `true` → `false` (Production applies migrations deliberately, not on boot) | [ADR-015](../planning-artifacts/architecture.md) + E15-S2 | |
| Off-site backup replication | Replicate the `backups` bucket off the single RustFS volume (second Railway project / OSS S3 on Hetzner) — closes the single-failure-domain risk | [ADR-019](../planning-artifacts/architecture.md) | |
| Custom domain cutover | The [§8](#8-custom-domain-migration) cutover executed + verified on the Production domains | E19-S1 §8 | |
| Real outbound SMTP | Mailtrap Sandbox replaced by a delivering SMTP (self-hosted Postal) — see `SMTP-MIGRATION-POSTAL.md` | [ADR-018](../planning-artifacts/architecture.md) + E19-S4 | |
| Backup-restore drill green | A real [§3.1](#31-restore-drill-rehearsal--captured-log) drill executed against Beta with a captured-log row | E19-S2 §3.1 | |

### 9.3 How to read each source

- **Uptime %** — the external monitor's own dashboard reports it directly (the monitor account set up per setup guide §27 / E17-S4).
- **Request latency / 5xx** — open the `api` Logs tab on Railway; each request log line is CorrelationId-enriched (E17-S2). Sample or
  grep for status ≥ 500 and for slow requests. The Railway **Metrics** tab (per service) gives CPU / memory / network as infra context.
- **Backup success** — grep the `api` Logs for the `daily-pg-backup` job outcome lines, and count `backups/<yyyy>/<MM>/*.dump.gz.enc`
  objects on RustFS against the expected one-per-day cadence (30-day retention via `prune-old-backups`).
- **Restore evidence** — the [§3.1](#31-restore-drill-rehearsal--captured-log) drill log (backup timestamp, restore duration, smoke a–e).
