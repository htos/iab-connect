# Story 15.3: Daily PostgreSQL backup to RustFS

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **an operator**,
I want **a daily encrypted PostgreSQL dump of the application database written to RustFS under `s3://iab-connect-beta-rustfs/backups/yyyy/MM/dd-HHmmss.dump.gz.enc`, with a 30-day retention prune job, a Railway-compatible `pg_dump` execution path that doesn't depend on Docker-in-Docker, and a documented + tested manual restore procedure**,
so that **a Beta data loss is recoverable within 24 hours, the application's database state has a 24-hour RPO, and the same backup pipeline survives the Railway runtime where the api container has no `docker` CLI and no sibling Postgres container to exec into**.

**Requirement:** REQ-088 AC-6 (Beta Deployment Readiness — daily encrypted backup). Epic E15 (Database, Persistence, and Migrations), Story 3 of 4. Wave-7 deliverable.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13 (Railway Beta Deployment) done** — `rustfs` service provisioned with `backups` bucket reachable from `api` via `${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000`; `postgres-app` provisioned with connection-string + credentials in `api`'s env per [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service); `Backup__EncryptionKey` Sealed on `api` per Section 5.1 row "Operations".
- **E15-S1 (verify two-Postgres separation) done** — this story backs up `postgres-app` only (Keycloak schema is reproducible from the realm-import JSON, not backed up); E15-S1 establishes the connection-string contract.
- **E13-FT-6 docker-exec refactor (THIS STORY'S TASK 0/1)** — current [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) uses `Process.Start("docker", "exec ... pg_dump ...")` + `docker cp` for BOTH `CreateBackupAsync` AND `RestoreBackupAsync`. On Railway the `api` container has no Docker daemon, no `docker` CLI, and no sibling `iabconnect-postgres` container — the existing code throws `Win32Exception/Component not found` on every invocation. The refactor to direct `pg_dump` is **in-scope for this story as Task 0/1**, not a separate prerequisite.

**Downstream:**
- **E15-S4** (Beta seeding strategy) — references the manual-restore procedure documented in Task 8.
- **E19-S2** (Backup-restore drill) — fires the documented restore procedure against a real disaster scenario before Production cut-over.
- **E18-S1** (Beta runbook) — cites the failure-mode + alerting documented in Task 7.

**Wave context:** Wave 7 mid-epic. **Mixed artifacts**: backend source-code refactor + new dependencies (encryption/gzip wrappers + Hangfire recurring registrations) + Dockerfile change (install `postgresql-client`) + documentation update in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) as a new Section 15 (per A38 doc-bundle pattern + adjacency to Section 14 from E15-S1).

## Acceptance Criteria

1. **`PostgresBackupService` no longer depends on `docker exec` / `docker cp`** — direct `pg_dump` invocation against the connection-string-resolved host + port + database + credentials. Verified by:
   - `Process.Start` calls in [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) use `FileName = "pg_dump"` (or `"pg_restore"` for restore) directly, NOT `"docker"`.
   - All `_dockerContainer` references removed; `Backup__DockerContainer` config key removed from [backend/.env.example](../../backend/.env.example) lines 134-136.
   - Backend builds with zero warnings; `grep -rn 'docker' backend/src/IabConnect.Infrastructure/Backup/` returns only comments referencing the historical context, no live code.

2. **Backend Dockerfile installs `postgresql-client` matching PostgreSQL 17** — verified by:
   - [backend/Dockerfile](../../backend/Dockerfile) adds `RUN apt-get update && apt-get install -y postgresql-client-17 && rm -rf /var/lib/apt/lists/*` (or the Alpine equivalent if the base image is Alpine) in the runtime stage.
   - Image size growth: ~15 MB (acceptable; matches Postgres-client typical footprint).
   - Smoke test: `docker run --rm --entrypoint pg_dump iabc-api --version` outputs `pg_dump (PostgreSQL) 17.x`.

3. **A daily encrypted backup runs at 03:00 UTC via Hangfire recurring job** — verified by:
   - New job registration `BackgroundJob.AddOrUpdate("daily-pg-backup", ...)` in a new file like `backend/src/IabConnect.Infrastructure/Backup/RegisterBackupJobs.cs` (or equivalent), called from the api startup pipeline (gated on `Beta` or `Production` env per ADR-020 — NOT enabled in Development).
   - Cron: `0 3 * * *` (daily 03:00 UTC); `RecurringJobOptions.TimeZone = TimeZoneInfo.Utc`.
   - On execution: takes a `pg_dump --format=custom --dbname=<resolved> --host=<resolved> --username=<resolved>` of `postgres-app`, gzips the output, encrypts with `Backup__EncryptionKey` using AES-256-GCM (per ADR-019), uploads to `s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc` via the existing `IAmazonS3` client (registered for RustFS in DI), records the backup metadata in the `BackupRecord` aggregate via the existing `ApplicationDbContext` `Set<BackupRecord>()` table.

4. **A daily prune job runs at 04:00 UTC removing objects older than 30 days** — verified by:
   - New `BackgroundJob.AddOrUpdate("prune-old-backups", ...)` cron `0 4 * * *`.
   - Job lists objects under `s3://<bucket>/backups/` via `ListObjectsV2Async`, filters by `LastModified < UtcNow - 30 days`, deletes each via `DeleteObjectAsync`. Logs the count of deleted objects.
   - Edge case: empty bucket or all-young objects → job logs `Pruned 0 objects, oldest kept: <timestamp>` and exits successfully.

5. **The encrypted backup is decryptable via the documented restore procedure** — verified by:
   - New integration test in [backend/tests/IabConnect.Infrastructure.Tests/](../../backend/tests/IabConnect.Infrastructure.Tests/) exercising the round-trip: encrypt-upload + download-decrypt against a Testcontainers PostgreSQL + Minio (S3-compatible) mock. Test asserts the decrypted dump is byte-identical to the source `pg_dump` output.
   - The restore procedure documented in Section 15 of [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) walks: download from RustFS → decrypt with `Backup__EncryptionKey` → gunzip → `pg_restore --clean --if-exists` into `postgres-app`.

6. **The manual restore is performed once against the Beta deploy as evidence** — verified by:
   - Harry's session: download the most recent backup, decrypt locally, restore into a throwaway `postgres-app-restore-test` Railway service (or via `railway run --service api psql` against a non-Beta-traffic-receiving instance), confirm the restore completes without errors.
   - Output of the restore run captured in Section 15.6 of the doc (with timestamps redacted to month resolution; never expose specific backup-file dates that hint at backup-cron timing).

7. **Backup-job failure produces a Hangfire-visible failure record + a Serilog ERROR log entry that downstream alerting (E17-S4) can consume** — verified by:
   - Inject a forced failure (e.g., `Backup__EncryptionKey` set to invalid base64): job throws + Hangfire dashboard (in Dev only per E12-S1 disclaimer) marks it Failed; `api` Serilog logs an ERROR with the exception message + the `BackupRecord.Id` for cross-reference.
   - Forward-link: E17-S4 (external uptime + alerting) consumes the Serilog ERROR stream via Seq or equivalent; this story does NOT wire the alerting, but its failure-surface is observable in the format E17-S4 will consume.

8. **Cross-story orthogonal-AC verification** (per A31):
   - **Backup credential parity (3 anchors)**: `Backup__EncryptionKey` env var (Sealed on api, per [doc Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service)) ≡ encryption key used in `pg_dump` pipeline ≡ documented restore-procedure key reference. Drift = backups are encrypted with one key, decrypted with another = data lost.
   - **Bucket path parity**: `s3://<bucket-name>/backups/...` upload path matches `DocumentStorage__BucketName` for documents (`iabconnect-documents`) NO — backups go to the `backups` bucket per ADR-019, not the documents bucket. Two distinct buckets on the same RustFS instance. **NEW env var `Backup__BucketName`** added to api with default `backups` (matches the bucket the existing RustFS-init pattern creates). Documented in [doc Section 5.1 + new Section 15.2](../../docs/14_beta_railway_setup.md).
   - **Hangfire-job-vs-IsDevelopment gate**: backup jobs registered only when `ASPNETCORE_ENVIRONMENT != Development` (Beta + Production) per ADR-020 inverse — matches existing `RetentionEnforcement__Enabled` pattern at [backend/src/IabConnect.Api/DependencyInjection.cs:321-333](../../backend/src/IabConnect.Api/DependencyInjection.cs#L321-L333). Use the same gating mechanism + register adjacent to the existing job registrations.

9. **Documentation update**: [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) acquires a new section **"## 15. Daily PostgreSQL backup + restore (E15-S3)"** appended after Section 14 (E15-S1's verification section) with subsections:
   - 15.1 Cron schedule (03:00 UTC backup + 04:00 UTC prune).
   - 15.2 Required env vars + Sealed flags (`Backup__EncryptionKey`, `Backup__BucketName`).
   - 15.3 Storage path convention (`s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc`).
   - 15.4 Local listing + browsing via Railway CLI (`railway run --service api aws s3 ls s3://...`).
   - 15.5 Manual restore procedure (download → decrypt → gunzip → pg_restore).
   - 15.6 Real-restore evidence from Task 7 (Harry's executed run, redacted).
   - 15.7 Recovery procedure when `daily-pg-backup` is failing (Hangfire-job-stuck recovery, key-rotation impact, RustFS bucket-full recovery).
   - SPDX header on line 1 already in place from E13-S1.

10. **No secrets committed**: `Backup__EncryptionKey` value never appears in any tracked file; the doc records the env-var NAME + Sealed flag + the rotation procedure (with blast-radius — old backups remain decryptable only with the archived old key).

## Tasks / Subtasks

- [ ] **Task 0 — SPIKE: Railway-vs-Docker backup execution surface + dependency audit** (closes E13-FT-6 per A28 + A40)
  - [ ] 0.1 Verify E15-S1 done (postgres-app reachable from api via private network).
  - [ ] 0.2 Read [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) end-to-end. Inventory every `Process.Start("docker", ...)` call and every `_dockerContainer` reference. **6 docker-call sites** in current code: `CreateBackupAsync` (3 — exec/pg_dump, cp, exec/rm), `RestoreBackupAsync` (3 — cp-in, exec/pg_restore, exec/rm).
  - [ ] 0.3 Verify the API endpoint surface that consumes `IBackupService`: grep `backend/src/IabConnect.Api/Endpoints/` for `IBackupService` to find all endpoints — they continue to work post-refactor (only the implementation changes, not the interface).
  - [ ] 0.4 Decide encryption algorithm: AES-256-GCM (recommended — authenticated encryption, native .NET 10 `System.Security.Cryptography.AesGcm`, 12-byte nonce + 16-byte tag prepended to ciphertext). Document the chosen format in spike output: `<12-byte-nonce><16-byte-tag><ciphertext>`.
  - [ ] 0.5 Verify Dockerfile base-image package manager: backend base is `mcr.microsoft.com/dotnet/aspnet:10.0` on Ubuntu Noble (per [backend/Dockerfile](../../backend/Dockerfile)) — `apt-get install postgresql-client-17` is the right syntax. The Postgres 17 client lives in the `postgresql-client-17` apt package on Noble (verify against [https://www.postgresql.org/download/linux/ubuntu/](https://www.postgresql.org/download/linux/ubuntu/) at spike time; if unavailable, fall back to `postgresql-client` for whichever 17 the noble repo carries).
  - [ ] 0.6 Verify the existing `IAmazonS3` registration in [Infrastructure/DependencyInjection.cs#L258-L270](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L258-L270) is reusable for the `backups` bucket (it should be — same RustFS endpoint, different bucket; the S3 client is bucket-agnostic).
  - [ ] 0.7 Verify Hangfire scheduling: existing `RetentionEnforcementJob` at backend DI uses `RecurringJob.AddOrUpdate` — the same pattern applies; the project's Hangfire is already configured with PostgreSQL persistence (`postgres-app` schema gets the Hangfire tables).
  - [ ] 0.8 Spike output: `Refactor surface confirmed (6 docker-call sites + 1 config key + 1 Dockerfile package + 2 Hangfire jobs + 1 encryption pipeline + 1 RustFS upload) → proceed` OR `Blocker: <description> → escalate`.

- [ ] **Task 1 — Refactor PostgresBackupService to direct `pg_dump` / `pg_restore`** (AC-1)
  - [ ] 1.1 Remove `_dockerContainer` field + its constructor wiring.
  - [ ] 1.2 Rewrite `CreateBackupAsync`: parse the connection string (existing `ParseConnectionString` helper stays), build `ProcessStartInfo { FileName = "pg_dump", Arguments = $"--format=custom --file={filePath} --dbname={db} --host={host} --port={port} --username={user} --no-password", Environment = { ["PGPASSWORD"] = password } }`. Reads stderr to surface pg_dump errors as `record.MarkFailed(stderr)`.
  - [ ] 1.3 Rewrite `RestoreBackupAsync`: same shape but with `pg_restore --clean --if-exists --dbname={db} --host={host} --port={port} --username={user} --no-password {filePath}`. Exit code > 1 throws; exit code 0/1 (1 = warnings like "role already exists") succeeds.
  - [ ] 1.4 Remove the `docker cp` / `docker exec rm` cleanup paths — the new code writes pg_dump output directly to `_backupDirectory`, no in-container temp file.
  - [ ] 1.5 Remove `Backup__DockerContainer` from [backend/.env.example](../../backend/.env.example) lines 134-136 (and the rendered consumer comment).
  - [ ] 1.6 Update any in-code documentation comments to reflect the change.

- [ ] **Task 2 — Add `postgresql-client-17` to backend Dockerfile** (AC-2)
  - [ ] 2.1 In [backend/Dockerfile](../../backend/Dockerfile) runtime stage (after the base FROM, before USER): add `RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && rm -rf /var/lib/apt/lists/*`.
  - [ ] 2.2 Verify image still builds: `docker build -t iabc-api backend/`. Capture pre-vs-post size (expected +15-25 MB).
  - [ ] 2.3 Smoke test: `docker run --rm --entrypoint pg_dump iabc-api --version` outputs `pg_dump (PostgreSQL) 17.x`.

- [ ] **Task 3 — Add encryption + gzip wrapper around `pg_dump` output** (AC-3)
  - [ ] 3.1 Create `backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs` (new file) with two methods: `EncryptAsync(Stream plaintext, byte[] key, Stream ciphertext)` and `DecryptAsync(Stream ciphertext, byte[] key, Stream plaintext)`. Use `System.Security.Cryptography.AesGcm` with 12-byte random nonce + 16-byte tag; output format `<nonce><tag><ciphertext>`.
  - [ ] 3.2 Update `PostgresBackupService.CreateBackupAsync` to chain: `pg_dump → FileStream → GZipStream → BackupEncryption.EncryptAsync → upload to RustFS`. The local `_backupDirectory` becomes a scratch path only; final artifact lives on RustFS.
  - [ ] 3.3 `Backup__EncryptionKey` parsed as base64-decoded 32-byte key in the constructor; throws on construction if missing or wrong length (fail-fast — the job must not silently run with empty encryption).

- [ ] **Task 4 — Add RustFS S3 upload integration** (AC-3, AC-4)
  - [ ] 4.1 Inject `IAmazonS3` into `PostgresBackupService` constructor (existing registration; will resolve against RustFS).
  - [ ] 4.2 New private method `UploadToRustFSAsync(string objectKey, Stream content, CancellationToken ct)`: uses `_s3.PutObjectAsync` with `BucketName = _bucketName` (new env-var-derived field), `Key = objectKey`, `InputStream = content`. Object key format: `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC).
  - [ ] 4.3 Add `Backup__BucketName` to [backend/.env.example](../../backend/.env.example) (default `backups`) and to [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service) `api` Variables table.
  - [ ] 4.4 New private method `ListAndPruneAsync(TimeSpan retention)`: lists `backups/` prefix, filters `LastModified < UtcNow - retention`, deletes each + logs count.

- [ ] **Task 5 — Register Hangfire recurring jobs** (AC-3, AC-4, AC-8)
  - [ ] 5.1 Create `backend/src/IabConnect.Infrastructure/Backup/RegisterBackupJobs.cs` (new file) exporting `public static void Register(IServiceProvider services, IConfiguration configuration)`.
  - [ ] 5.2 Gate registration on `!IsDevelopment()` per ADR-020 inverse (matches existing `RegisterRetentionEnforcementJob` pattern at backend DI line ~321-333). Confirm gating against `IWebHostEnvironment.IsDevelopment()`.
  - [ ] 5.3 Register two jobs:
    - `RecurringJob.AddOrUpdate("daily-pg-backup", () => backupService.CreateBackupAsync("hangfire-cron", null, default), Cron.Daily(3, 0), TimeZoneInfo.Utc)`.
    - `RecurringJob.AddOrUpdate("prune-old-backups", () => backupService.ListAndPruneAsync(TimeSpan.FromDays(30)), Cron.Daily(4, 0), TimeZoneInfo.Utc)`.
  - [ ] 5.4 Call `RegisterBackupJobs.Register(...)` from `backend/src/IabConnect.Api/DependencyInjection.cs` adjacent to the existing `RegisterRetentionEnforcementJob` call.

- [ ] **Task 6 — Tests** (AC-5, AC-7)
  - [ ] 6.1 New test file `backend/tests/IabConnect.Infrastructure.Tests/Backup/PostgresBackupServiceTests.cs`. Use Testcontainers PostgreSQL + a Minio container (S3-compatible) as the mocked RustFS endpoint.
  - [ ] 6.2 Test 1: `CreateBackupAsync` produces a `.dump.gz.enc` object in Minio; download + decrypt + gunzip → byte-identical to a direct `pg_dump` of the same DB.
  - [ ] 6.3 Test 2: `RestoreBackupAsync` against the decrypted artifact restores the schema; row counts match pre-backup state.
  - [ ] 6.4 Test 3: `ListAndPruneAsync(TimeSpan.FromMilliseconds(1))` after a backup → object deleted; count returned = 1.
  - [ ] 6.5 Test 4: forced encryption failure (invalid key length) — constructor throws; doesn't silently disable encryption.
  - [ ] 6.6 Test 5: Hangfire job registration happens only in non-Development env (use `IWebHostEnvironment` mock).
  - [ ] 6.7 Run `dotnet test` from `backend/`; expect baseline 1976 + ~6 new ≈ 1982 tests green; zero warnings.

- [ ] **Task 7 — Failure-mode + alerting surface verification** (AC-7)
  - [ ] 7.1 Local smoke: docker-compose stack with api in Beta-shape per [README Option 4](../../README.md#option-4-local-beta-shape-testing-full-overlay). Trigger backup via Hangfire dashboard test-run.
  - [ ] 7.2 Force failure: temporarily set `Backup__EncryptionKey` to invalid base64. Re-run. Verify: Hangfire dashboard shows Failed job + Serilog ERROR log contains exception message + `BackupRecord.Id`.
  - [ ] 7.3 [!] Verify against a future E17-S4 alert integration — the Serilog ERROR format is consumable by Seq/equivalent. Mark `[!]` per A30 — full alert wiring is E17-S4's scope.

- [ ] **Task 8 — Manual restore evidence on Beta** (AC-6)
  - [ ] 8.1 [!] Harry's session: after `daily-pg-backup` has produced at least one backup on Beta, download via `railway run --service api aws s3 cp s3://${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000/backups/<latest>.dump.gz.enc /tmp/`.
  - [ ] 8.2 [!] Decrypt locally with `Backup__EncryptionKey`: small Python or .NET CLI helper (one-liner using the same `BackupEncryption` class via `dotnet run`-style) → gunzip → `.dump`.
  - [ ] 8.3 [!] Restore into a non-production target. Two options: (a) create a `postgres-app-restore-test` Railway service, `pg_restore` into it; (b) use a local docker-compose Postgres for offline verification. Document which path was taken.
  - [ ] 8.4 [!] Capture timestamps + the redacted output in Section 15.6 of the doc.

- [ ] **Task 9 — Doc Section 15 in `docs/14_beta_railway_setup.md`** (AC-9)
  - [ ] 9.1 Append Section 15 after Section 14 (from E15-S1). 7 subsections per AC-9. Maintain SPDX header (line 1, unchanged).
  - [ ] 9.2 Update Table of Contents.
  - [ ] 9.3 Per A42 (reread-as-a-stranger): cross-section consistency check (bucket name matches Section 5.1 + Section 5.4 RustFS-init; cron schedule matches AC-3/4 + Task 5.3 exactly).

- [ ] **Task 10 — Cross-story orthogonal-AC verification** (AC-8, per A31)
  - [ ] 10.1 Backup credential parity 3-anchor verified by reading the actual env-var value (Sealed) on Railway + the Section 5.1 row + the Section 15.5 restore-procedure key reference.
  - [ ] 10.2 Bucket-path parity: `backups` bucket distinct from `iabconnect-documents`; documented in Section 15.2 + Section 5.4.
  - [ ] 10.3 Hangfire-job-vs-IsDevelopment gate verified by grep of `RegisterBackupJobs.cs` + the adjacent `RegisterRetentionEnforcementJob.cs` (same gating).

- [ ] **Task 11 — Secrets-in-repo guard** (AC-10)
  - [ ] 11.1 `git grep -inE 'Backup__EncryptionKey\s*=' -- ':(exclude)*.env.example'` returns zero hits (Sealed value never lands in committed files).
  - [ ] 11.2 `git grep -inE 'AesGcm|AES-256-GCM' -- ':(exclude)backend/src/IabConnect.Infrastructure/Backup/*' ':(exclude)backend/tests/*'` returns zero (the encryption implementation stays in the dedicated module).

- [ ] **Task 12 — Quality-Gates Closing Check (per A29)**
  - [ ] 12.1 Complete the Quality-Gates table at the bottom with one row per AC sub-item.

## Dev Notes

### Why the refactor is in-scope for THIS story (not a separate pre-story)

E13 retro logged E13-FT-6 (PostgresBackupService docker-exec → Railway-incompatible) as deferred with the explicit guidance that E15-S3 spec MUST fold the refactor into Task 0/1 as prerequisite. Splitting into a separate "refactor only" story would:
- Produce a story with no business value (refactor with no behavior change is overhead).
- Leave PostgresBackupService in a half-state where the Beta deploy crashes the daily-pg-backup job on first cron — `[!]` failure with no recovery path until the next story lands.

Folding the refactor into Task 0/1 means E15-S3's `done` state is "backup pipeline works end-to-end on Beta" — that's the unit of value REQ-088 AC-6 specifies.

### Why AES-256-GCM (not PGP, not OpenSSL CBC, not custom)

- **Native .NET 10 support** — `System.Security.Cryptography.AesGcm` ships in the runtime; no third-party dependency.
- **Authenticated encryption** — the 16-byte GCM tag detects tampering at decrypt time. A corrupted RustFS-stored backup fails at decryption with a clear `AuthenticationTagMismatchException` rather than silently producing garbage.
- **Tightest format on disk** — 12-byte nonce + 16-byte tag overhead per backup (negligible for multi-MB dumps).
- **Maps cleanly to ADR-019** — the ADR-019 text describes "symmetric encryption" without prescribing algorithm; AES-256-GCM is the contemporary best-practice symmetric AEAD for at-rest storage.

Format on disk: `[12-byte nonce][16-byte tag][ciphertext]`. Decryption reads the first 28 bytes as nonce+tag, the rest as ciphertext.

### Why Hangfire (not a Kubernetes CronJob, not a separate Railway service)

The project already uses Hangfire for `RetentionEnforcementJob` and Hangfire's PostgreSQL persistence is wired against `postgres-app` per existing DI. Adding a new recurring job is one method call. A separate Railway service for the backup cron adds a new deployable + new Railway-bill line + new failure-mode + zero new capability.

### Why `postgres-app` is backed up but `postgres-kc` is NOT

- **`postgres-app` holds irreplaceable state**: Members, Events, EmailCampaigns, Audit logs, finance records. Loss = real data loss.
- **`postgres-kc` holds reproducible state**: realm config is reproducible from [infra/keycloak/realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json) (re-imported by `kc.sh start --optimized` on container restart); users created via Admin Console can be re-created if needed; the env-var-seeded master admin is in `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD`.
- **Backing up `postgres-kc` would leak credentials**: the realm DB contains hashed user passwords + client secrets in resolved form; encrypting + storing those increases the attacker surface for marginal recovery value.

If a future requirement demands Keycloak-state recovery (e.g., a Beta-tester user list grows large enough to be a real loss), add a separate E-future story scoping that backup deliberately.

### Why `Backup__BucketName` is a new env var (not hard-coded)

A fork's RustFS instance may use a different bucket name convention. Defaulting to `backups` matches the canonical project + the existing `rustfs-init` pattern, but allowing override keeps the fork story clean.

### LLM dev-agent guardrails

- **Do NOT** keep any `Process.Start("docker", ...)` calls in `PostgresBackupService`. The refactor removes ALL six; if any remains, the AC-1 grep check fails.
- **Do NOT** use OpenSSL CLI for encryption — invoking `openssl enc` adds a process boundary + cross-platform inconsistency. `System.Security.Cryptography.AesGcm` is the right primitive.
- **Do NOT** write the encryption key to a temp file, log it, or include it in any exception message. The key is constructor-loaded once and lives only in `_encryptionKey` private field.
- **Do NOT** allow the encryption-key constructor check to silently disable encryption on missing config — throw + crash the api startup. Backups without encryption are worse than no backups (false sense of security).
- **DO** preserve backward compatibility of `IBackupService` interface — only the implementation changes. All endpoint callers continue to work.
- **DO** test against Testcontainers Postgres + Minio for the round-trip; in-memory mocks won't catch the actual `pg_dump` binary path issues.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#adr-019-backup-destination] — backup-to-same-RustFS rationale.
- [Source: _bmad-output/planning-artifacts/architecture.md#adr-020-beta-mode-job-suppression] — Hangfire gating inverse pattern.
- [Source: _bmad-output/planning-artifacts/prd.md#L466-L472] — REQ-088 AC-6.
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1597-L1615] — Story E15-S3 source ACs.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#e13-ft-6] — E13-FT-6 docker-exec refactor closure.
- [Source: backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs] — current implementation, ~300 lines, 6 docker-call sites.
- [Source: backend/src/IabConnect.Infrastructure/DependencyInjection.cs] — existing `IAmazonS3` registration + Hangfire wire.
- [Source: docs/14_beta_railway_setup.md Section 5.1] — `Backup__EncryptionKey` Sealed env var on api.

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` · `[!] needs-human-verify` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | All `Process.Start("docker", ...)` calls removed from PostgresBackupService | | |
| 1 | `_dockerContainer` field + `Backup__DockerContainer` config removed | | |
| 1 | `grep -rn 'docker' backend/src/IabConnect.Infrastructure/Backup/` → comments only | | |
| 2 | Backend Dockerfile installs `postgresql-client-17` | | |
| 2 | Image grows ~15-25 MB; `pg_dump --version` reports 17.x | | |
| 3 | `daily-pg-backup` Hangfire job at 03:00 UTC registered (Beta + Production only) | | |
| 3 | Job chain: pg_dump → gzip → AES-256-GCM → RustFS upload | | |
| 3 | Object key format `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC) | | |
| 4 | `prune-old-backups` Hangfire job at 04:00 UTC registered | | |
| 4 | Prune deletes objects older than 30 days; logs count | | |
| 5 | Integration test: round-trip byte-identical | | |
| 5 | Restore procedure documented in Section 15.5 | | |
| 6 | [!] Harry's manual-restore evidence captured in Section 15.6 | | |
| 7 | Forced-failure smoke: Hangfire Failed + Serilog ERROR + BackupRecord.Id | | |
| 7 | [!] E17-S4 alert-format compatibility flagged forward | | |
| 8 | Backup credential parity 3-anchor verified | | |
| 8 | `backups` bucket distinct from `iabconnect-documents`; `Backup__BucketName` added | | |
| 8 | Hangfire-job-vs-IsDevelopment gate matches RetentionEnforcement pattern | | |
| 9 | docs/14_beta_railway_setup.md Section 15 appended (7 subsections) | | |
| 9 | Section 15 TOC entry added | | |
| 10 | `git grep` for `Backup__EncryptionKey` returns no real-value leaks | | |
| 10 | AES-256-GCM implementation isolated to BackupEncryption.cs | | |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Existing `BackupRecord` aggregate compatibility.** Current `PostgresBackupService.CreateBackupAsync` writes a `BackupRecord` row tracking file path + status. After the refactor, the file path is the RustFS object key (`backups/yyyy/MM/dd-HHmmss.dump.gz.enc`), NOT a local filesystem path. The `BackupRecord.FileName` field should hold the RustFS object key; existing `DownloadBackupAsync` (if it exists) needs the same shift. Inventory `BackupRecord`'s consumer endpoints at Task 0.3 and adjust.
- **Q2 — Backup file format vs the AC text.** Story AC-1 text quotes `.sql.gz.enc` (text SQL gzipped + encrypted); existing code uses `pg_dump --format=custom` which produces a binary archive (`.dump`). Custom format is more space-efficient + `pg_restore` is more robust for restore. Recommendation: keep custom format; rename file convention to `.dump.gz.enc`. ACs above codify this; if Harry prefers text format for grep-ability of backups, change to `pg_dump --format=plain` + filename `.sql.gz.enc`.
- **Q3 — `Backup__BucketName` default value.** AC-8 + Task 4.3 says default `backups`. Confirm this matches whatever the `rustfs-init` job (deferred to a future story per E13-S1 Section 3.3) creates. If `rustfs-init` doesn't exist yet, the api's S3 client should `CreateBucketAsync(bucket, IfNotExists)` on first run — add to AC if needed.
- **Q4 — Encryption-key rotation procedure.** Existing rotation runbook in [docs/14_beta_railway_setup.md Section 7](../../docs/14_beta_railway_setup.md#7-secret-rotation) row `Backup__EncryptionKey` says "archive the old key" — confirm the rotation also archives in a recoverable location (1Password / Bitwarden personal vault). Document at Section 15.7.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

### Completion Notes List

### File List

- [backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) — EDIT (remove 6 docker-call sites; rewrite Create/Restore for direct pg_dump/pg_restore + encryption + RustFS upload; AC-1, AC-3).
- [backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs](../../backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs) — NEW (AES-256-GCM encrypt/decrypt; AC-3).
- [backend/src/IabConnect.Infrastructure/Backup/RegisterBackupJobs.cs](../../backend/src/IabConnect.Infrastructure/Backup/RegisterBackupJobs.cs) — NEW (Hangfire recurring registrations + IsDevelopment gating; AC-3, AC-4, AC-8).
- [backend/src/IabConnect.Api/DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) — EDIT (call RegisterBackupJobs.Register adjacent to RegisterRetentionEnforcementJob; AC-3).
- [backend/Dockerfile](../../backend/Dockerfile) — EDIT (install `postgresql-client-17`; AC-2).
- [backend/.env.example](../../backend/.env.example) — EDIT (remove `Backup__DockerContainer`; add `Backup__BucketName=backups`; AC-1, AC-8).
- [backend/tests/IabConnect.Infrastructure.Tests/Backup/PostgresBackupServiceTests.cs](../../backend/tests/IabConnect.Infrastructure.Tests/Backup/PostgresBackupServiceTests.cs) — NEW (Testcontainers + Minio round-trip + prune + gate tests; AC-5, AC-7, AC-8).
- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT (append Section 15 + 7 subsections + TOC update; AC-9).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e15-s3 backlog → in-progress → review at story-close).
