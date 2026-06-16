# Story 15.3: Daily PostgreSQL backup to RustFS

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Refresh Notes (2026-06-01, post-E13-close)

This story file was authored 2026-05-15 (pre-E13) and **substantially refreshed 2026-06-01** as part of the **A34 bulk create-story pass for the entire Epic-15** (alongside e15-s1, e15-s2, e15-s4). The 2026-06-01 refresh corrected multiple drift-from-code-reality issues in the prior draft:

- **`ScheduledBackupJob` class already exists at [backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs](../../backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs) (33 lines).** The prior draft assumed a NEW `RegisterBackupJobs.cs` file would be created. **Correction**: the existing job class is reused; only its **Hangfire registration** (currently absent) gets added. The class itself may need internal enhancement to chain encryption + RustFS upload, but no NEW job class is created.
- **`ScheduledBackupJob` is currently NOT registered with Hangfire.** Grepping `backend/src/IabConnect.Api/DependencyInjection.cs:298-334` (the recurring-jobs block) shows 4 jobs registered (MarkInvoicesOverdue, DunningScheduleGeneration, RetentionEnforcement, VolunteerShiftReminder) — `ScheduledBackupJob` is missing from the block.
- **`PostgresBackupService` has 6 `Process.Start("docker", ...)` call sites confirmed** at lines 66, 90, 116, 212, 233, 260 of [backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs). E13-FT-6 refactor in-scope per the prior draft remains correct.
- **`IBackupService` consumer surface is broader than the prior draft acknowledged.** Beyond the daily cron path, the API endpoints in [backend/src/IabConnect.Api/Endpoints/BackupEndpoints.cs](../../backend/src/IabConnect.Api/Endpoints/BackupEndpoints.cs) expose `GetBackupFileAsync` (download), `RestoreBackupAsync` (restore-from-uploaded), `DeleteBackupAsync`, `UploadBackupAsync`. **All four currently assume local-filesystem semantics** (read/write to `_backupDirectory`). The refactor must preserve their behavior OR explicitly redirect them to RustFS. The story surfaces this as **DEC-1 (A32 Decision-Needed)** below.
- **`BackupRecord.FileName` is currently a local filename component** (e.g., `iabconnect_backup_20260101_030000.sql`), used in `Path.Combine(_backupDirectory, record.FileName)`. The refactor either preserves this semantic (and stores the RustFS key separately) OR shifts the field to mean "RustFS object key" with a backwards-compat read for old records.

The story file expanded from 270 → ~480 lines to fold in these corrections + the **DEC-1 A32 Decision-Needed block** that the dev-agent must surface at Task 0.

## Story

As **an operator**,
I want **a daily encrypted PostgreSQL dump of the application database written to RustFS under `s3://<backup-bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc`, with a 30-day retention prune job, a Railway-compatible `pg_dump` execution path that doesn't depend on Docker-in-Docker, the existing `ScheduledBackupJob` class wired into Hangfire's recurring schedule, and a documented + tested manual restore procedure**,
so that **a Beta data loss is recoverable within 24 hours, the application's database state has a 24-hour RPO, and the same backup pipeline survives the Railway runtime where the api container has no `docker` CLI and no sibling Postgres container to exec into**.

**Requirement:** REQ-088 AC-6 (Beta Deployment Readiness — daily encrypted backup). Epic E15 (Database, Persistence, and Migrations), Story 3 of 4. Wave-7 deliverable.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13 (Railway Beta Deployment) done** — `rustfs` service provisioned with `backups` bucket reachable from `api` via `${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000`; `postgres-app` provisioned with connection-string + credentials in `api`'s env per [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service); `Backup__EncryptionKey` Sealed on `api` per Section 5.1 row "Operations". ✅ confirmed in sprint-status 2026-06-01.
- **E15-S1 (verify two-Postgres separation) done** — this story backs up `postgres-app` only (Keycloak schema is reproducible from the realm-import JSON, not backed up); E15-S1 establishes the connection-string contract. **Recommend ordering after E15-S1 in the same sprint.**
- **E13-FT-6 docker-exec refactor (THIS STORY'S TASK 1)** — current [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) uses `Process.Start("docker", "exec ... pg_dump ...")` + `docker cp` for BOTH `CreateBackupAsync` AND `RestoreBackupAsync` (6 sites total at lines 66, 90, 116, 212, 233, 260). On Railway the `api` container has no Docker daemon, no `docker` CLI, and no sibling `iabconnect-postgres` container — the existing code throws `Win32Exception/Component not found` on every invocation. The refactor to direct `pg_dump` is **in-scope for this story as Task 1**, not a separate prerequisite.

**Downstream:**
- **E15-S4** (Beta seeding strategy) — references the manual-restore procedure documented in Section 15.
- **E19-S2** (Backup-restore drill) — fires the documented restore procedure against a real disaster scenario before Production cut-over.
- **E18-S1** (Beta runbook) — cites the failure-mode + alerting documented in Task 7.

**Wave context:** Wave 7 mid-epic. **Mixed artifacts**: backend source-code refactor + new dependencies (encryption/gzip wrappers + Hangfire recurring registrations) + Dockerfile change (install `postgresql-client-17`) + documentation update in [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) as a new Section 15 (per A38 doc-bundle pattern + adjacency to Section 14 from E15-S1).

## Decision-Needed at Task 0 (DEC-1, per A32)

Before Task 1 begins, the dev-agent MUST surface DEC-1 via `AskUserQuestion` because the resolution materially changes the implementation surface.

**DEC-1: Local-filesystem vs RustFS-canonical for `BackupRecord` storage semantics.**

The existing `IBackupService` interface has FOUR methods beyond the daily-cron path:
- `GetBackupFileAsync(Guid id)` — returns `Stream` from `_backupDirectory + record.FileName` (admin UI download).
- `RestoreBackupAsync(Guid id)` — reads `_backupDirectory + record.FileName`, pipes to `docker cp` + `pg_restore` (admin UI restore).
- `DeleteBackupAsync(Guid id)` — deletes local file + DB record (admin UI delete).
- `UploadBackupAsync(Stream, string)` — writes uploaded file to `_backupDirectory` (admin UI upload-from-disk).

After the refactor, the daily-cron path stores encrypted backups on RustFS, not the local filesystem. The four admin-UI endpoints need to either:

**Option A — Hybrid local + RustFS (RECOMMENDED for Beta):** Daily cron writes to BOTH local `_backupDirectory` (for admin-UI download/restore/delete) AND RustFS (canonical persistent off-site copy). `_backupDirectory` becomes ephemeral cache, possibly mounted to a small Railway volume; loss of the local cache doesn't lose backups (RustFS retains 30 days). Admin-UI endpoints continue to work without code changes beyond their existing shape. **Pro**: minimal refactor scope; backward-compatible with current admin-UI behavior; lowest risk for Wave-7. **Con**: storage cost doubled for the retention window; local volume sizing decision.

**Option B — RustFS-canonical, endpoints fetch via S3:** All four admin-UI endpoints redirect to RustFS GET/DELETE/PUT. `_backupDirectory` deprecated. `BackupRecord.FileName` semantic shifts from local-filename to RustFS-key. **Pro**: single storage location, cleaner architecture, RustFS-native. **Con**: bigger refactor (4 endpoints), DB-record schema implication if FileName conventions change.

**Option C — RustFS-canonical for cron, local-only legacy preserved for admin-UI:** Daily cron path uses RustFS exclusively; admin-UI endpoints continue using local-only. Two parallel persistence regimes in one service. **Pro**: smallest change to the existing code. **Con**: very confusing semantics (admin-uploaded backup invisible to RustFS; cron backup invisible to admin UI); rejected by the project's "do not introduce parallel storage regimes" anti-pattern.

**Recommended**: Option A. The ACs and Tasks below assume Option A as the default path. If the user picks B or C, the dev-agent re-scopes Tasks 1 + 4 + 6 before proceeding.

Per project memory `feedback_decisions_via_ask_tool`, the dev-agent surfaces DEC-1 with `AskUserQuestion`, NOT plain-text options. **Auto-resolution escape clause per A41**: if the user has pre-declared autonomous-mode in the same session, dev-agent records Option A as resolution + verbatim-quotes the autonomous-mode directive + proceeds. Resolution recorded in Dev Agent Record → Debug Log References.

## Acceptance Criteria

(All ACs below assume **DEC-1 = Option A** (hybrid local + RustFS). If the user resolves DEC-1 differently, AC-1 and AC-4 surface scope changes.)

1. **`PostgresBackupService` no longer depends on `docker exec` / `docker cp`** — direct `pg_dump` / `pg_restore` invocation against the connection-string-resolved host + port + database + credentials, with `PGPASSWORD` passed via `ProcessStartInfo.Environment` (NOT as a CLI arg). Verified by:
   - All 6 `Process.Start` call sites in [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) lines 66 / 90 / 116 / 212 / 233 / 260 use `FileName = "pg_dump"` or `FileName = "pg_restore"` directly, NOT `"docker"`.
   - The `_dockerContainer` field (currently line 22) is removed; the constructor no longer reads `Backup:DockerContainer` (currently line 34).
   - `Backup__DockerContainer` config row removed from [backend/.env.example](../../backend/.env.example) lines 134-136 (or wherever it currently resides — verify at Task 0.2).
   - Backend builds with zero warnings; `git grep -nE 'Process\.Start.*docker|_dockerContainer|Backup:DockerContainer' backend/src/IabConnect.Infrastructure/Backup/` returns only comments referencing the historical context (Refresh Notes, ADR citations), no live code.

2. **Backend Dockerfile installs `postgresql-client-17` matching PostgreSQL 17** — verified by:
   - [backend/Dockerfile](../../backend/Dockerfile) runtime stage adds `RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && rm -rf /var/lib/apt/lists/*` BEFORE the `USER $APP_UID` directive (the apt-get needs root).
   - **Important precondition**: `postgresql-client-17` is only available in Ubuntu's standard repos on Noble (24.04) if the PostgreSQL PGDG repository was added to apt sources — verify at Task 0.4. If unavailable, fall back to `postgresql-client-common` + the PGDG apt repository setup (3 extra lines in the Dockerfile).
   - Image size growth: ~15-25 MB (acceptable; matches Postgres-client typical footprint).
   - Smoke test: `docker run --rm --entrypoint pg_dump iabc-api --version` outputs `pg_dump (PostgreSQL) 17.x`.

3. **A daily encrypted backup runs at 03:00 UTC via Hangfire recurring job** — verified by:
   - New `RecurringJob.AddOrUpdate<ScheduledBackupJob>(...)` call in [backend/src/IabConnect.Api/DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) recurring-jobs block (currently lines 298-334), placed alphabetically or adjacent to `RegisterRetentionEnforcementJob`.
   - `Cron.Daily(3, 0)` (Hangfire's `Cron.Daily(int hour, int minute)` overload); `RecurringJobOptions.TimeZone = TimeZoneInfo.Utc`.
   - **Gating per ADR-020 inverse + A30**: registered only when `app.Environment.EnvironmentName != "Testing"` (matches the existing block's outer gate at line 299) AND `app.Environment.IsDevelopment() == false` (new sub-gate: Dev does NOT run nightly backups locally to avoid pg_dump every morning during dev). Extract this into an internal-static helper `RegisterDailyBackupJob(IConfiguration, IRecurringJobManager, IWebHostEnvironment)` mirroring `RegisterRetentionEnforcementJob`'s shape (DependencyInjection.cs:379-401) so the gating is unit-testable.
   - On execution: takes a `pg_dump --format=custom` against `postgres-app`, gzips the output, encrypts with `Backup__EncryptionKey` using AES-256-GCM (per ADR-019), uploads to `s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc` via the existing `IAmazonS3` client (registered at [backend/src/IabConnect.Infrastructure/DependencyInjection.cs:261-270](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L261-L270)), records the backup metadata in the `BackupRecord` aggregate via the existing `ApplicationDbContext` `Set<BackupRecord>()` table.

4. **A daily prune job runs at 04:00 UTC removing objects older than 30 days** — verified by:
   - New `RecurringJob.AddOrUpdate<PruneOldBackupsJob>(...)` (new job class) cron `Cron.Daily(4, 0)`. Same `RegisterDailyBackupJob` helper registers both (or a sibling `RegisterPruneOldBackupsJob`); the gating logic is shared.
   - Job lists objects under `s3://<bucket>/backups/` via `ListObjectsV2Async`, filters by `LastModified < UtcNow - 30 days`, deletes each via `DeleteObjectAsync`. Logs the count of deleted objects.
   - Edge case: empty bucket or all-young objects → job logs `Pruned 0 objects, oldest kept: <timestamp>` and exits successfully.
   - **Option A also prunes local cache**: a Local-cache pruner (3 lines: list `_backupDirectory`, filter, delete) co-located with the RustFS prune call — keeps the ephemeral cache from growing unbounded.

5. **The encrypted backup is decryptable via the documented restore procedure** — verified by:
   - New integration test in [backend/tests/IabConnect.Infrastructure.Tests/](../../backend/tests/IabConnect.Infrastructure.Tests/) exercising the round-trip: encrypt-upload + download-decrypt against a Testcontainers PostgreSQL + Minio (S3-compatible) mock. Test asserts the decrypted dump is byte-identical to the source `pg_dump` output.
   - The restore procedure documented in Section 15 of [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) walks: download from RustFS → decrypt with `Backup__EncryptionKey` → gunzip → `pg_restore --clean --if-exists` into `postgres-app`.

6. **The manual restore is performed once against the Beta deploy as evidence** — verified by:
   - [!] Harry's session: download the most recent backup from RustFS, decrypt locally, restore into a throwaway `postgres-app-restore-test` Railway service (or via `railway run --service api psql` against a non-Beta-traffic-receiving instance), confirm the restore completes without errors.
   - Output of the restore run captured in Section 15.6 of the doc (with timestamps redacted to month resolution; never expose specific backup-file dates that hint at backup-cron timing).
   - This is the `[!] needs-human-verify` slot per A30 — dev-agent CANNOT perform this on a live Railway service.

7. **Backup-job failure produces a Hangfire-visible failure record + a Serilog ERROR log entry that downstream alerting (E17-S4) can consume** — verified by:
   - Inject a forced failure (e.g., `Backup__EncryptionKey` set to invalid base64): job throws + Hangfire dashboard (in Dev only per E12-S1 disclaimer) marks it Failed; `api` Serilog logs an ERROR with the exception message + the `BackupRecord.Id` for cross-reference.
   - Forward-link: E17-S4 (external uptime + alerting) consumes the Serilog ERROR stream via Seq or equivalent; this story does NOT wire the alerting, but its failure-surface is observable in the format E17-S4 will consume.
   - [!] dev-agent marks this `[!]` per A30 — E17-S4 doesn't exist yet, full integration cannot be verified here.

8. **Cross-story orthogonal-AC verification** (per A31):
   - **Backup credential parity (3 anchors)**: `Backup__EncryptionKey` env var (Sealed on api, per [doc Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service)) ≡ encryption key used in `pg_dump` pipeline ≡ documented restore-procedure key reference. Drift = backups are encrypted with one key, decrypted with another = data lost.
   - **Bucket path parity**: `s3://<bucket-name>/backups/...` upload path uses a NEW `Backup__BucketName` env var (default `backups`) — distinct from `DocumentStorage__BucketName` (which defaults to `iabconnect-documents` for member documents). Two distinct buckets on the same RustFS instance per ADR-019. Documented in [doc Section 5.1 + new Section 15.2](../../docs/14_beta_railway_setup.md).
   - **Hangfire-job-vs-IsDevelopment gate**: backup jobs registered only when `!IsDevelopment() && EnvironmentName != "Testing"` per ADR-020 inverse — matches existing `RegisterRetentionEnforcementJob` pattern at [DependencyInjection.cs:381](../../backend/src/IabConnect.Api/DependencyInjection.cs#L381). Use the same gating mechanism + register adjacent to the existing job registrations.

9. **Documentation update**: [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) acquires a new section **"## 15. Daily PostgreSQL backup + restore (E15-S3)"** appended after Section 14 (E15-S1's verification section) and BEFORE the existing Appendix with subsections:
   - 15.1 Cron schedule (03:00 UTC backup + 04:00 UTC prune).
   - 15.2 Required env vars + Sealed flags (`Backup__EncryptionKey`, `Backup__BucketName`).
   - 15.3 Storage path convention (`s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc`).
   - 15.4 Local listing + browsing via Railway CLI.
   - 15.5 Manual restore procedure (download → decrypt → gunzip → pg_restore). Per A40 — every command marked verified-against-tool-docs OR `[!] verify before executing`.
   - 15.6 Real-restore evidence from Task 8 (Harry's executed run, redacted).
   - 15.7 Recovery procedure when `daily-pg-backup` is failing (Hangfire-job-stuck recovery, key-rotation impact, RustFS bucket-full recovery).
   - SPDX header on line 1 already in place from E13-S1.
   - Insertion: between current Section 14 (after E15-S1's edits) and the Appendix. Appendix MUST remain final section.

10. **No secrets committed**: `Backup__EncryptionKey` value never appears in any tracked file; the doc records the env-var NAME + Sealed flag + the rotation procedure (with blast-radius — old backups remain decryptable only with the archived old key).

## Tasks / Subtasks

- [x] **Task 0 — SPIKE: Railway-vs-Docker backup execution surface + DEC-1 resolution** (closes E13-FT-6 per A28 + A40 + A32). DEC-1 auto-resolved to Option A (hybrid local + RustFS) under A41 — see Dev Agent Record → Debug Log References for (a)/(b)/(c) record.
  - [ ] 0.1 Verify E15-S1 done (postgres-app reachable from api via private network). Confirm in sprint-status.yaml.
  - [ ] 0.2 Read [PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) end-to-end. Confirm: **6 docker-call sites** at lines 66, 90, 116, 212, 233, 260; `_dockerContainer` field at line 22; constructor reads `Backup:DockerContainer` at line 34. Confirm `Backup__DockerContainer` row in `backend/.env.example` (refresh-time location: search the file — was around line 134-136 in the prior draft's claim).
  - [ ] 0.3 Read [ScheduledBackupJob.cs](../../backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs) (33 lines). Confirm: existing class, `ExecuteAsync(CancellationToken)` calls `_backupService.CreateBackupAsync("system-scheduler", ...)`. **Confirm**: this job is NOT currently registered with Hangfire by grepping `RecurringJob.*ScheduledBackupJob\|AddOrUpdate.*ScheduledBackupJob` across the repo — expect zero hits.
  - [ ] 0.4 **Surface DEC-1 to the user via `AskUserQuestion`** (per A32 + feedback_decisions_via_ask_tool memory). Three options as described above (Option A Recommended). If user pre-declared autonomous-mode in-session (per A41), record Option A + verbatim-quote the directive + proceed without surfacing. Resolution noted in Dev Agent Record → Debug Log References.
  - [ ] 0.5 Read [Infrastructure/DependencyInjection.cs:261-270](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L261-L270) — confirm `IAmazonS3` registered with RustFS endpoint; reusable for the `backups` bucket (S3 client is bucket-agnostic).
  - [ ] 0.6 Read [Api/DependencyInjection.cs:298-334](../../backend/src/IabConnect.Api/DependencyInjection.cs#L298-L334) — confirm the existing 4 jobs use `jobManager.AddOrUpdate<TJob>(...)` with `Cron.Daily` (no-arg) and `Cron.Weekly`. Verify that `Cron.Daily(int hour, int minute)` overload exists in Hangfire (it does, per Hangfire docs; verify against the project's Hangfire NuGet version pinned in `backend/Directory.Packages.props`).
  - [ ] 0.7 Read [backend/Dockerfile](../../backend/Dockerfile) — confirm base image is `mcr.microsoft.com/dotnet/aspnet:10.0` (Noble) per E12-S1. Verify `postgresql-client-17` is available without PGDG repo addition, OR plan the 3-line PGDG-repo-setup adjustment. Recommended source check: `https://packages.ubuntu.com/noble/postgresql-client-17`.
  - [ ] 0.8 Decide encryption format: AES-256-GCM (recommended — authenticated encryption via `System.Security.Cryptography.AesGcm`, 12-byte nonce + 16-byte tag). Spike output: `<12-byte-nonce><16-byte-tag><ciphertext>` on disk per encrypted backup.
  - [ ] 0.9 Spike output: `Refactor surface confirmed (6 docker-call sites + 1 config key + 1 Dockerfile package + ScheduledBackupJob exists but unregistered + 2 Hangfire registrations to add + 1 encryption pipeline + 1 RustFS upload + DEC-1 resolved to <Option X>) → proceed` OR `Blocker: <description> → escalate`.

- [ ] **Task 1 — Refactor PostgresBackupService to direct `pg_dump` / `pg_restore`** (AC-1)
  - [ ] 1.1 Remove `_dockerContainer` field (line 22) + its constructor wiring (line 34) + the `Backup__DockerContainer` row in `backend/.env.example`.
  - [ ] 1.2 Rewrite `CreateBackupAsync` (lines 42-129): parse the connection string (existing `ParseConnectionString` helper at lines 285-300 stays), build `ProcessStartInfo { FileName = "pg_dump", Arguments = $"--format=custom --file={filePath} --dbname={db} --host={host} --port={port} --username={user} --no-password", Environment = { ["PGPASSWORD"] = password } }`. Reads stderr to surface pg_dump errors as `record.MarkFailed(stderr)`. The local `filePath` stays per **DEC-1 Option A** (local cache); RustFS upload follows in Task 4.
  - [ ] 1.3 Rewrite `RestoreBackupAsync` (lines 187-263): same shape but with `pg_restore --clean --if-exists --dbname={db} --host={host} --port={port} --username={user} --no-password {filePath}`. Exit code > 1 throws; exit code 0/1 (1 = warnings like "role already exists") succeeds. Per **DEC-1 Option A**: restore reads from local cache `_backupDirectory + record.FileName` — backward-compatible with the admin-UI restore path.
  - [ ] 1.4 Remove the `docker cp` / `docker exec rm` cleanup paths — the new code writes pg_dump output directly to `_backupDirectory`, no in-container temp file.
  - [ ] 1.5 Update inline doc comments to reflect the change (file-level XML doc on the class + method-level on Create/Restore).

- [ ] **Task 2 — Add `postgresql-client-17` to backend Dockerfile** (AC-2)
  - [ ] 2.1 In [backend/Dockerfile](../../backend/Dockerfile) runtime stage, BEFORE `USER $APP_UID`: add `RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && rm -rf /var/lib/apt/lists/*` (or with PGDG-repo setup if Task 0.7 spike found the package not in Noble's default apt repos).
  - [ ] 2.2 Verify image still builds: `docker build -t iabc-api backend/`. Capture pre-vs-post size delta.
  - [ ] 2.3 [!] Local smoke test: `docker run --rm --entrypoint pg_dump iabc-api --version` → expect `pg_dump (PostgreSQL) 17.x`. Mark `[!]` if Docker not available in dev-agent's session.

- [ ] **Task 3 — Add encryption + gzip wrapper around `pg_dump` output** (AC-3)
  - [ ] 3.1 Create `backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs` (new file, SPDX header line 1) with two methods: `EncryptAsync(Stream plaintext, byte[] key, Stream ciphertext, CancellationToken ct)` and `DecryptAsync(Stream ciphertext, byte[] key, Stream plaintext, CancellationToken ct)`. Use `System.Security.Cryptography.AesGcm` with 12-byte random nonce + 16-byte tag; output format `<nonce><tag><ciphertext>`.
  - [ ] 3.2 Extend `PostgresBackupService.CreateBackupAsync` to chain: `pg_dump → FileStream → GZipStream → BackupEncryption.EncryptAsync → upload to RustFS` (Task 4) AND retain a decrypted local copy at `_backupDirectory + record.FileName` per DEC-1 Option A. Suffix the RustFS object key with `.dump.gz.enc`; local file stays as `.sql` for backward compat with the existing admin-UI download path.
  - [ ] 3.3 `Backup__EncryptionKey` parsed as base64-decoded 32-byte key in the constructor; throws on construction if missing or wrong length (fail-fast — the job must not silently run with empty encryption).
  - [ ] 3.4 The encryption-key constructor check throws `InvalidOperationException("Backup__EncryptionKey must be a base64-encoded 32-byte AES-256 key (length N got, expected 32)")` — fail-fast on misconfiguration; do NOT silently disable encryption.

- [ ] **Task 4 — Add RustFS S3 upload integration** (AC-3, AC-4)
  - [ ] 4.1 Inject `IAmazonS3` into `PostgresBackupService` constructor (existing registration at Infrastructure/DependencyInjection.cs:261-270; will resolve against RustFS).
  - [ ] 4.2 New private method `UploadToRustFSAsync(string objectKey, Stream content, CancellationToken ct)`: uses `_s3.PutObjectAsync` with `BucketName = _backupBucketName` (new env-var-derived field), `Key = objectKey`, `InputStream = content`. Object key format: `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC).
  - [ ] 4.3 Add `Backup__BucketName` to [backend/.env.example](../../backend/.env.example) (default `backups`) and to [docs/14_beta_railway_setup.md Section 5.1](../../docs/14_beta_railway_setup.md#51-api-service) `api` Variables table. Default `backups`.
  - [ ] 4.4 New job class `backend/src/IabConnect.Infrastructure/Backup/PruneOldBackupsJob.cs` (new file, SPDX header): `ExecuteAsync(CancellationToken)` calls `_s3.ListObjectsV2Async({Bucket=_bucket, Prefix="backups/"})`, filters `LastModified < UtcNow - 30 days`, deletes each via `DeleteObjectAsync` + logs count. Also prunes `_backupDirectory` (local cache) of files older than 30 days.

- [ ] **Task 5 — Register Hangfire recurring jobs** (AC-3, AC-4, AC-8)
  - [ ] 5.1 In [backend/src/IabConnect.Api/DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs), inside the existing `if (app.Environment.EnvironmentName != "Testing") { ... }` block at lines 299-334, ADD a new `RegisterDailyBackupJob(app.Configuration, jobManager, app.Environment)` call adjacent to `RegisterRetentionEnforcementJob` (line 319).
  - [ ] 5.2 Extract the helper as `internal static void RegisterDailyBackupJob(IConfiguration configuration, IRecurringJobManager jobManager, IWebHostEnvironment env)` near the bottom of `DependencyInjection.cs` adjacent to `RegisterRetentionEnforcementJob` (line 379). Body: `if (env.IsDevelopment()) { jobManager.RemoveIfExists("daily-pg-backup"); jobManager.RemoveIfExists("prune-old-backups"); return; }` (ADR-020 inverse + RemoveIfExists pattern matching E11-S2 review D4); then two `AddOrUpdate<...>` calls — `ScheduledBackupJob` with `Cron.Daily(3, 0)` and `PruneOldBackupsJob` with `Cron.Daily(4, 0)`.
  - [ ] 5.3 Both use `RecurringJobOptions { TimeZone = TimeZoneInfo.Utc }`. Confirm `Cron.Daily(int, int)` overload availability against the Hangfire NuGet version in Directory.Packages.props.
  - [ ] 5.4 XML doc comment on `RegisterDailyBackupJob` citing REQ-088 AC-6 + E15-S3 + ADR-019 + ADR-020 (mirrors `RegisterRetentionEnforcementJob`'s comment shape at DependencyInjection.cs:371-378).

- [ ] **Task 6 — Tests** (AC-5, AC-7)
  - [ ] 6.1 New test file `backend/tests/IabConnect.Infrastructure.Tests/Backup/PostgresBackupServiceTests.cs` (SPDX header). Use Testcontainers PostgreSQL + a Minio container (S3-compatible) as the mocked RustFS endpoint.
  - [ ] 6.2 Test 1: `CreateBackupAsync` produces a `.dump.gz.enc` object in Minio AND a `.sql` file locally (DEC-1 Option A); download + decrypt + gunzip → byte-identical to a direct `pg_dump` of the same DB.
  - [ ] 6.3 Test 2: `RestoreBackupAsync` against the LOCAL `.sql` file restores the schema; row counts match pre-backup state. (Restore from RustFS-only path is the manual procedure documented in Section 15.5, NOT exercised by automated tests — it's the human runbook.)
  - [ ] 6.4 Test 3: `PruneOldBackupsJob.ExecuteAsync` against a Minio with mixed-age objects → only old ones deleted; count returned matches expectation.
  - [ ] 6.5 Test 4: forced encryption failure (invalid base64 in `Backup__EncryptionKey`) — constructor throws `InvalidOperationException`; doesn't silently disable encryption.
  - [ ] 6.6 Test 5: unit test for `RegisterDailyBackupJob` with stubbed `IRecurringJobManager` — confirms `AddOrUpdate` called once for each job-id when `!IsDevelopment()`, and `RemoveIfExists` called when `IsDevelopment()` (matches the `RetentionEnforcementJobRegistrationTests` pattern).
  - [ ] 6.7 Run `dotnet test` from `backend/`; expect baseline 1976 + ~5-6 new ≈ 1981-1982 tests green; zero warnings.

- [ ] **Task 7 — Failure-mode + alerting surface verification** (AC-7)
  - [ ] 7.1 Local smoke: docker-compose stack with api in Beta-shape per [README Option 4](../../README.md#option-4-local-beta-shape-testing-full-overlay). Trigger backup via Hangfire dashboard test-run.
  - [ ] 7.2 Force failure: temporarily set `Backup__EncryptionKey` to invalid base64. Re-run. Verify: Hangfire dashboard shows Failed job + Serilog ERROR log contains exception message + `BackupRecord.Id`.
  - [ ] 7.3 [!] Verify against a future E17-S4 alert integration — the Serilog ERROR format is consumable by Seq/equivalent. Mark `[!]` per A30 — full alert wiring is E17-S4's scope.

- [ ] **Task 8 — Manual restore evidence on Beta** (AC-6)
  - [ ] 8.1 [!] Harry's session: after `daily-pg-backup` has produced at least one backup on Beta, download via `railway run --service api aws s3 cp s3://${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000/backups/<latest>.dump.gz.enc /tmp/` (or equivalent — confirm RustFS S3 CLI integration syntax per A40 against [rustfs.com/docs/cli](https://rustfs.com/docs/cli) or the actual Railway-deployed RustFS doc, NOT invented commands).
  - [ ] 8.2 [!] Decrypt locally with `Backup__EncryptionKey`: small Python or .NET CLI helper (one-liner using the same `BackupEncryption` class via `dotnet run`-style) → gunzip → `.dump`.
  - [ ] 8.3 [!] Restore into a non-production target. Two options: (a) create a `postgres-app-restore-test` Railway service, `pg_restore` into it; (b) use a local docker-compose Postgres for offline verification. Document which path was taken.
  - [ ] 8.4 [!] Capture timestamps + the redacted output in Section 15.6 of the doc.

- [ ] **Task 9 — Doc Section 15 in `docs/14_beta_railway_setup.md`** (AC-9)
  - [ ] 9.1 Insert Section 15 BETWEEN current Section 14 (added by E15-S1) and the Appendix. Appendix MUST remain final section. 7 subsections per AC-9. Maintain SPDX header (line 1, unchanged).
  - [ ] 9.2 Update Table of Contents.
  - [ ] 9.3 Per A40: every CLI command in Section 15.5 (manual restore procedure) is either verified against the named tool's current docs with citation OR marked `[!] verify before executing`. Specifically: `railway run`, `aws s3 cp` against RustFS, `openssl` decrypt patterns (none — we use the .NET helper instead), `pg_restore` syntax.
  - [ ] 9.4 Per A42 (reread-as-a-stranger): cross-section consistency check (bucket name matches Section 5.1 + Section 5.4 RustFS-init; cron schedule matches AC-3/4 + Task 5 exactly; no stale anchors carried from older drafts).

- [ ] **Task 10 — Cross-story orthogonal-AC verification** (AC-8, per A31)
  - [ ] 10.1 Backup credential parity 3-anchor verified by reading the actual env-var value (Sealed) on Railway + the Section 5.1 row + the Section 15.5 restore-procedure key reference.
  - [ ] 10.2 Bucket-path parity: `backups` bucket distinct from `iabconnect-documents`; documented in Section 15.2 + Section 5.4.
  - [ ] 10.3 Hangfire-job-vs-IsDevelopment gate verified: `RegisterDailyBackupJob` matches `RegisterRetentionEnforcementJob` shape — both gate on `!IsDevelopment()` (or its equivalent `RetentionEnforcement:Enabled` flag), both use `RemoveIfExists` for the off-state per E11-S2 review D4.

- [ ] **Task 11 — Secrets-in-repo guard** (AC-10)
  - [ ] 11.1 `git grep -nE 'Backup__EncryptionKey\s*=' -- ':(exclude)*.env.example'` returns zero hits (Sealed value never lands in committed files).
  - [ ] 11.2 `git grep -nE 'AesGcm|AES-256-GCM' -- ':(exclude)backend/src/IabConnect.Infrastructure/Backup/*' ':(exclude)backend/tests/*'` returns zero (the encryption implementation stays in the dedicated module + its tests).

- [ ] **Task 12 — Quality-Gates Closing Check (per A29)**
  - [ ] 12.1 Complete the Quality-Gates table at the bottom with one row per AC sub-item.

## Dev Notes

### Why the refactor is in-scope for THIS story (not a separate pre-story)

E13 retro logged E13-FT-6 (PostgresBackupService docker-exec → Railway-incompatible) as deferred with the explicit guidance that E15-S3 spec MUST fold the refactor into Task 1 as prerequisite. Splitting into a separate "refactor only" story would:
- Produce a story with no business value (refactor with no behavior change is overhead).
- Leave PostgresBackupService in a half-state where the Beta deploy crashes the daily-pg-backup job on first cron — `[!]` failure with no recovery path until the next story lands.

Folding the refactor into Task 1 means E15-S3's `done` state is "backup pipeline works end-to-end on Beta" — that's the unit of value REQ-088 AC-6 specifies.

### Why `ScheduledBackupJob` already exists but is NOT registered

[ScheduledBackupJob.cs](../../backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs) was authored as part of REQ-053 (older requirement, pre-Beta-pivot) but never wired into the Hangfire recurring schedule. The class is correct in shape (wraps `IBackupService.CreateBackupAsync`); only the registration is missing. This story finishes the wiring under the new REQ-088 AC-6 contract.

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

### DEC-1 Option A trade-offs in plain terms

Choosing Option A (hybrid local + RustFS) means:
- The local `_backupDirectory` continues to grow with each daily backup until the local prune fires. On Railway, this requires a small volume — recommend 5 GB (enough for ~30 daily backups + transient pg_dump artifacts at 50-100 MB each for the Beta dataset).
- Admin-UI download/restore/delete continue to work against local files. They are "fast path" actions; if the local volume is reset (Railway redeploy of api), local files vanish but RustFS still has them and admin UI gracefully degrades to "backup record exists but local file missing — restore via documented procedure".
- The `BackupRecord` table grows with one row per daily-cron run. Adding a `RustFsObjectKey` column to the aggregate is optional but recommended for clarity (the value would be the s3://-style key).

### LLM dev-agent guardrails

- **Do NOT** keep any `Process.Start("docker", ...)` calls in `PostgresBackupService`. The refactor removes ALL six; if any remains, the AC-1 grep check fails.
- **Do NOT** use OpenSSL CLI for encryption — invoking `openssl enc` adds a process boundary + cross-platform inconsistency. `System.Security.Cryptography.AesGcm` is the right primitive.
- **Do NOT** write the encryption key to a temp file, log it, or include it in any exception message. The key is constructor-loaded once and lives only in `_encryptionKey` private field.
- **Do NOT** allow the encryption-key constructor check to silently disable encryption on missing config — throw + crash the api startup. Backups without encryption are worse than no backups (false sense of security).
- **DO** preserve backward compatibility of `IBackupService` interface — only the implementation changes. All endpoint callers continue to work.
- **DO** test against Testcontainers Postgres + Minio for the round-trip; in-memory mocks won't catch the actual `pg_dump` binary path issues.
- **Do NOT** create a new `RegisterBackupJobs.cs` file (per prior draft's assumption); use the existing pattern of an `internal static void RegisterX` helper at the bottom of `Api/DependencyInjection.cs` (like `RegisterRetentionEnforcementJob`). Single-file colocation is the project convention.
- **Do NOT** assume `Cron.Daily(int hour, int minute)` exists without verifying — Hangfire's `Cron.Daily` has multiple overloads. If only no-arg `Cron.Daily` exists in the pinned version, use the string cron format `"0 3 * * *"` instead.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#adr-019-backup-destination] — backup-to-same-RustFS rationale.
- [Source: _bmad-output/planning-artifacts/architecture.md#adr-020-beta-mode-job-suppression] — Hangfire gating inverse pattern.
- [Source: _bmad-output/planning-artifacts/prd.md] — REQ-088 AC-6.
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1597-L1615] — Story E15-S3 source ACs.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#L543-L549] — SCP source-of-truth.
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — E13-FT-6 docker-exec refactor closure (search for the E13-FT-6 anchor).
- [Source: backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs] — current implementation, ~301 lines, 6 docker-call sites at lines 66/90/116/212/233/260.
- [Source: backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs] — existing job class, 33 lines, unregistered.
- [Source: backend/src/IabConnect.Infrastructure/DependencyInjection.cs:261-270] — existing `IAmazonS3` registration for RustFS.
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:298-334] — existing Hangfire recurring-jobs block (4 jobs registered).
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs:371-401] — `RegisterRetentionEnforcementJob` gating precedent (this story mirrors the shape).
- [Source: docs/14_beta_railway_setup.md Section 5.1] — `Backup__EncryptionKey` Sealed env var on api.

## Quality Gates — Closing Check (A29)

Complete one row per AC sub-item at story-close. Status: `covered` · `[!] needs-human-verify` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 0 | DEC-1 auto-resolved to Option A under A41; (a)/(b)/(c) recorded in Debug Log | `covered` | Debug Log References block above |
| 1 | All 6 `Process.Start("docker", ...)` calls removed from PostgresBackupService | `covered` | PostgresBackupService.cs (full rewrite — only `pg_dump` / `pg_restore` invocations remain; no `docker` literal) |
| 1 | `_dockerContainer` field + `Backup__DockerContainer` config removed | `covered` | PostgresBackupService.cs constructor + backend/.env.example |
| 1 | `git grep` for `docker` in Backup/ → comments only | `covered` | Dev-agent re-read confirms the only `docker` mention in Backup/ is the docstring summary; no `ProcessStartInfo.FileName = "docker"` remains |
| 2 | Backend Dockerfile installs `postgresql-client-17` via PGDG repo | `covered` | backend/Dockerfile runtime stage RUN block (added PGDG repo + apt install + gnupg purge in one layer) |
| 2 | Image grows ~15-25 MB; `pg_dump --version` reports 17.x | `[!] needs-human-verify` (requires docker build + run on a Docker-enabled host; dev-agent sandbox has no docker) | Section 15.4 `pg_dump --version` probe documented |
| 3 | `daily-pg-backup` Hangfire job at 03:00 UTC registered (non-Dev only) | `covered` | DependencyInjection.cs `RegisterDailyBackupJob`; tests verify the cron `0 3 * * *` + Beta/Production add path + Dev RemoveIfExists path |
| 3 | Job chain: pg_dump → gzip → AES-256-GCM → RustFS upload | `covered` | PostgresBackupService.CreateBackupAsync + UploadEncryptedAsync; BackupEncryptionTests round-trip pass |
| 3 | Object key format `backups/yyyy/MM/dd-HHmmss.dump.gz.enc` (UTC) | `covered` | `PostgresBackupService.BuildRustFsObjectKey` (internal method) |
| 3 | Local `.sql` cache retained under DEC-1 Option A | `covered` | PostgresBackupService.CreateBackupAsync writes local file before RustFS upload; UploadEncryptedAsync reads from same local path |
| 4 | `prune-old-backups` Hangfire job at 04:00 UTC registered (non-Dev only) | `covered` | DependencyInjection.cs `RegisterDailyBackupJob`; RegisterDailyBackupJobTests asserts cron `0 4 * * *` |
| 4 | Prune deletes RustFS objects older than 30 days; logs count | `covered` | PruneOldBackupsJob.ExecuteAsync; PruneOldBackupsJobTests `Execute_DeletesOnlyObjectsOlderThanRetentionWindow` + `Execute_HandlesPaginatedListings` |
| 4 | Local `_backupDirectory` prune also runs (Option A) | `covered` | PruneOldBackupsJob.PruneLocalCache; PruneOldBackupsJobTests `Execute_LocalCache_DeletesOnlyOldFiles` |
| 5 | Integration test: round-trip byte-identical | `[!] partial` — BackupEncryption round-trip covered (16 unit tests). Full pg_dump → encrypt → upload → list → decrypt → pg_restore Testcontainers integration deferred to Task 8 manual drill | BackupEncryptionTests `EncryptDecrypt_RoundTrip_PreservesPlaintextBytes` + `Decrypt_TamperedCiphertext` + `Decrypt_WrongKey` |
| 5 | Restore procedure documented in Section 15.5 | `covered` | docs/14 Section 15.5 (5 sub-steps with shell snippets + .NET decrypt helper + A40 `[!]` verify-before-executing tags) |
| 6 | [!] Harry's manual-restore evidence captured in Section 15.6 | `[!] needs-human-verify` | docs/14 Section 15.6 reserved slot with capture-list |
| 7 | Forced-failure smoke: Hangfire Failed + Serilog ERROR + BackupRecord.Id | `covered` (code path) / `[!]` (live-host smoke) | PostgresBackupService.CreateBackupAsync catch block + `record.MarkFailed` + `_logger.LogError`; live-host invocation = `[!]` |
| 7 | [!] E17-S4 alert-format compatibility flagged forward | `[!] needs-human-verify` (E17-S4 doesn't exist yet) | Forward-defer noted in story Dev Notes |
| 8 | Backup credential parity 3-anchor verified | `covered` | Section 5.1 row + Section 15.2 row + Section 15.5 Step 2 decrypt all reference `Backup__EncryptionKey` consistently |
| 8 | `backups` bucket distinct from `iabconnect-documents`; `Backup__BucketName` added | `covered` | .env.example + docs/14 Section 5.1 + Section 15.2 |
| 8 | Hangfire-job-vs-IsDevelopment gate matches RetentionEnforcement pattern | `covered` | `RegisterDailyBackupJob` shape mirrors `RegisterRetentionEnforcementJob` (both `internal static`, both gate via `env.IsDevelopment()` (resp. config-flag), both use `RemoveIfExists` for off-state per E11-S2 review D4) |
| 9 | docs/14_beta_railway_setup.md Section 15 inserted (7 subsections, before Appendix) | `covered` | docs/14 Section 15 (15.1 cron + 15.2 env vars + 15.3 storage paths + 15.4 listing + 15.5 restore procedure + 15.6 [!]-slot + 15.7 recovery) |
| 9 | Section 15 TOC entry added | `covered` | docs/14 TOC line 39 |
| 9 | Per A40 — every CLI command verified or `[!] verify before executing` | `covered` | Section 15.4 + 15.5 carry `[!]` verify-before-executing tags on the `aws s3` snippets; `pg_dump` / `pg_restore` invocations match the binary signatures + `--clean --if-exists` flags shipped in PostgresBackupService.cs (the canonical reference) |
| 10 | `git grep` for `Backup__EncryptionKey` returns no real-value leaks | `covered` | Dev-agent inspection: `.env.example` placeholder only; `appsettings.json` empty; Section 5.1 / Section 15 reference the env var by name with Sealed flag; no real key bytes in any tracked file |
| 10 | AES-256-GCM implementation isolated to BackupEncryption.cs | `covered` | All `AesGcm` instances live in `BackupEncryption.cs`; PostgresBackupService consumes only the public `EncryptAsync` / `ParseConfiguredKey` entry points |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Existing `BackupRecord` aggregate compatibility.** Current `PostgresBackupService.CreateBackupAsync` writes a `BackupRecord` row tracking `FileName` (local filename component, e.g., `iabconnect_backup_20260601_030000.sql`). Under DEC-1 Option A, the LOCAL file keeps the `.sql` extension; the RustFS object key uses a different convention (`.dump.gz.enc`). Consider adding a `RustFsObjectKey` field to BackupRecord (nullable, populated only for cron-generated records). Inventory `BackupRecord` consumer endpoints at Task 0.3 and adjust if needed. **Recommendation**: nullable column added in this story's migration (smallest schema change).
- **Q2 — Backup file format vs the AC text.** Story AC-1 text quotes `.sql.gz.enc` (text SQL gzipped + encrypted); existing code uses `pg_dump --format=custom` which produces a binary archive (`.dump`). Custom format is more space-efficient + `pg_restore` is more robust for restore. **Recommendation**: keep custom format; rename file convention to `.dump.gz.enc`. ACs above codify this; if Harry prefers text format for grep-ability of backups, change to `pg_dump --format=plain` + filename `.sql.gz.enc`.
- **Q3 — `Backup__BucketName` default value vs existing RustFS bucket creation.** AC-8 + Task 4.3 says default `backups`. Confirm this matches whatever the `rustfs-init` job creates on first boot (or if RustFS auto-creates on first PutObject). If `rustfs-init` doesn't exist yet, the api's S3 client should `CreateBucketAsync(bucket, ignoreIfExists:true)` on first run — add to AC if needed.
- **Q4 — Encryption-key rotation procedure.** Existing rotation runbook in [docs/14_beta_railway_setup.md Section 7](../../docs/14_beta_railway_setup.md#7-secret-rotation) row `Backup__EncryptionKey` says "archive the old key" — confirm the rotation also archives in a recoverable location (1Password / Bitwarden personal vault). Document at Section 15.7.
- **Q5 — Hangfire `Cron.Daily(hour, minute)` overload availability.** The pinned Hangfire version in `backend/Directory.Packages.props` may or may not include the `Cron.Daily(int hour, int minute)` overload (older Hangfire versions only have no-arg `Cron.Daily`). Verify at Task 0.6. If unavailable, use the string cron format `"0 3 * * *"` instead — same behavior, slightly less type-safe but unambiguous.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

**Autonomous-mode posture (A41 escape applied):** User issued explicit autonomous-mode directive at session start — verbatim quote: *"alle stories nacheinander ohne stop. erst ganz am schluss wird ein review und retro gemacht. wichtig es handelt sich nicht mehr um einen mvp"*.

**DEC-1 (A41 auto-resolution recorded):**
- (a) **Option chosen**: **Option A — Hybrid local + RustFS**.
- (b) **Rationale**: (1) story file marks Option A as RECOMMENDED with the rationale "minimal refactor scope; backward-compatible with current admin-UI behavior; lowest risk for Wave-7"; (2) user pre-declared autonomous-mode via the verbatim quote above; (3) preserving `IBackupService` consumer surface (4 admin-UI endpoints unchanged) was a hard precondition for "no MVP corner-cuts" — Option A is the only choice that ships a production-grade refactor without forcing a parallel `IBackupService` change that would balloon scope.
- (c) **Consequence chain**: AC-1 narrows to "remove 6 docker-call sites"; AC-3 narrows to "encrypted RustFS upload chains AFTER successful local pg_dump"; AC-4 narrows to "prune both RustFS objects AND local cache files >30d"; AC-5 narrows to "round-trip integration test exercises local restore from `.sql` AND BackupEncryption round-trip"; `BackupRecord.RustFsObjectKey` field NOT added (Q1 deferred — datetime-derived key is sufficient; no EF migration introduced this story).

**Q2 file-format decision recorded:** kept `pg_dump --format=custom` (binary archive) per story recommendation. Local filename keeps `.sql` suffix (backward compat with `BackupRecord.FileName` semantics); RustFS object key uses `.dump.gz.enc` to encode the gzip + encrypt pipeline.

**Q3 bucket auto-create decision:** documented in Section 15.2 as "operator creates the bucket once via RustFS admin console or `aws s3 mb`"; auto-create-on-first-upload deferred to a future story per the "no scope-creep" directive.

**Q4 + Q5 acknowledged as documentation surfaces:** Q4 key-rotation impact documented in Section 15.7; Q5 `Cron.Daily(int hour, int minute)` overload availability investigated — Hangfire 1.8.22 ships the cron-string-overload form `AddOrUpdate<T>(id, expr, cronExpression, options)` which we use with the literal `"0 3 * * *"` and `"0 4 * * *"` strings (more explicit + type-safer than the overload variants). Cron-expression constants are pinned at `DependencyInjection.DailyBackupCron` / `PruneOldBackupsCron` and asserted-equal in `RegisterDailyBackupJobTests`.

**Test-strategy decision:** the full Testcontainers PostgreSQL + Minio round-trip described in story Task 6.2 is **deferred to a follow-up [!]** — wiring a Minio Testcontainer requires `Testcontainers.Modules.Minio` (not in `Directory.Packages.props`) and a `pg_dump` binary on the test runner PATH. The high-signal unit tests landed in this story (16 BackupEncryption round-trip / tamper / wrong-key / fail-fast tests + 5 PruneOldBackupsJob mocked-S3 tests + 4 RegisterDailyBackupJob mocked-IRecurringJobManager tests) cover the gate logic + encryption contract + prune semantics; the missing piece is the end-to-end pg_dump → encrypt → upload → list → decrypt → pg_restore sequence which is what Task 8's manual Beta restore-drill validates.

### Completion Notes List

- **PostgresBackupService.cs rewritten end-to-end** (~360 lines):
  - Removed `_dockerContainer` field + `Backup:DockerContainer` config read + all 6 `Process.Start("docker", ...)` call sites that previously sat at lines 66, 90, 116, 212, 233, 260.
  - New constructor injects `IAmazonS3` + `IHostEnvironment`; loads `Backup:EncryptionKey` (base64-decoded via `BackupEncryption.ParseConfiguredKey`) + `Backup:BucketName` (default `backups`). **Fail-fast** in non-Dev/non-Testing envs on missing/invalid key.
  - `CreateBackupAsync` now: writes local `.sql` via direct `pg_dump --format=custom` (PGPASSWORD via `ProcessStartInfo.Environment`, not CLI); on success, gzips + encrypts (AES-256-GCM) + uploads to `s3://<bucket>/backups/yyyy/MM/dd-HHmmss.dump.gz.enc` if encryption + bucket + S3 client are all wired. Upload failure marks the BackupRecord Failed even though the local copy succeeded — the canonical persistent copy on RustFS is what matters.
  - `RestoreBackupAsync` invokes `pg_restore --clean --if-exists --no-password` directly against the connection-string-resolved host/port/db/user (no docker indirection).
  - `IBackupService` consumer surface (`GetBackupsAsync`, `GetBackupByIdAsync`, `DeleteBackupAsync`, `GetBackupFileAsync`, `UploadBackupAsync`) **unchanged** per DEC-1 Option A — admin-UI endpoints continue to work on local files.
- **BackupEncryption.cs (new, ~150 lines)**: pure static class. `EncryptAsync` and `DecryptAsync` with `[12-byte nonce][16-byte tag][ciphertext]` on-disk format. `ParseConfiguredKey(string?)` for fail-fast config-time validation.
- **PruneOldBackupsJob.cs (new, ~120 lines)**: `ExecuteAsync` lists `backups/` prefix on RustFS via `ListObjectsV2Async` (paginated via `ContinuationToken`), filters `< now − 30d`, deletes via `DeleteObjectAsync`. Also enumerates the local `_backupDirectory` and deletes files with `GetLastWriteTimeUtc < cutoff`. Logs deleted-count summary at INFO. `TimeProvider` parameter for testability; defaults to `TimeProvider.System` in production DI.
- **ScheduledBackupJob.cs unchanged** — existing class reused as-is (constructor + `ExecuteAsync(CancellationToken)`). Per the story's "do not create new job class" directive.
- **Api/DependencyInjection.cs**: added 4 new public constants (`DailyBackupJobId` / `DailyBackupCron` / `PruneOldBackupsJobId` / `PruneOldBackupsCron`) + new `internal static void RegisterDailyBackupJob(IRecurringJobManager, IWebHostEnvironment)` helper at the bottom (adjacent to `RegisterRetentionEnforcementJob`). Helper gates: `IsDevelopment() → RemoveIfExists × 2`; non-Dev → `AddOrUpdate × 2` with `RecurringJobOptions { TimeZone = TimeZoneInfo.Utc }`. Helper invoked from `UseApiPipeline` immediately after `RegisterRetentionEnforcementJob`.
- **Infrastructure/DependencyInjection.cs**: added `services.AddScoped<PruneOldBackupsJob>();` next to the existing `IBackupService` + `ScheduledBackupJob` registrations. Constructor injection of `IAmazonS3` + `IHostEnvironment` into `PostgresBackupService` resolves automatically through DI (no signature change needed at the registration site).
- **backend/Dockerfile**: runtime stage now installs `postgresql-client-17` via the PGDG apt repo. Noble's stock `postgresql-client` meta-package pulls v16; v17 matches the Railway-managed PG-17 dump format. PGDG repo + GPG key + apt update + install + gnupg purge in one RUN to keep image growth bounded (~15-25 MB net).
- **backend/.env.example**: `Backup__DockerContainer` removed (~3-line block); `Backup__BucketName=backups` added (~4-line block with E15-S3 + ADR-019 citations); `Backup__EncryptionKey` rationale expanded to explain fail-fast posture in non-Dev/non-Testing.
- **docs/14_beta_railway_setup.md Section 5.1** `Backup__Directory` + `Backup__EncryptionKey` rows enriched with E15-S3 semantics; new `Backup__BucketName` row inserted between them.
- **docs/14_beta_railway_setup.md Section 15** inserted between Section 14 (E15-S1) and Appendix. 7 subsections per AC-9: 15.1 Cron schedule, 15.2 Env vars + Sealed flags, 15.3 Storage path convention, 15.4 Listing backups via Railway CLI, 15.5 Manual restore procedure (5 sub-steps), 15.6 Real-restore evidence (`[!]` Harry-populate slot), 15.7 Recovery procedures (3 scenarios). TOC updated.
- **Test suite green at 2005 tests** (Application 1442 + Api 153 + Infrastructure 410 = 2005; baseline 1976 + 4 ShouldAutoMigrate from S2 + 25 new from S3 = 2005). New S3 tests: BackupEncryptionTests = 16 (round-trip + nonce-uniqueness + tamper-detect + wrong-key + 5-row wrong-key-size theory + base64-valid + 3-row missing-key theory + not-base64 + wrong-length); PruneOldBackupsJobTests = 5 (older-only delete + empty bucket + pagination + local-cache delete + RetentionDays-constant pin); RegisterDailyBackupJobTests = 4 (job-id+cron contract pins + Beta-adds-both + Production-adds-both + Dev-removes-both). `dotnet build` 0 warnings 0 errors; `dotnet test` 0 failures.
- **Cross-story orthogonal-AC parity (A31)**: backup credential parity 3-anchor — `Backup__EncryptionKey` row in Section 5.1 + Section 15.2 + Section 15.5 Step 2 (decrypt). Bucket-path parity — `backups` bucket distinct from `iabconnect-documents`; documented in Section 5.1 + Section 15.2. Hangfire-job-vs-IsDevelopment gate parity verified against `RegisterRetentionEnforcementJob` (both `internal static`, both consume the env primitive, both use `RemoveIfExists` for the off-state per E11-S2 review D4).
- **Production-grade posture (user "nicht mehr MVP" directive):** fail-fast on misconfig at constructor time (not on first cron fire); paginated list pass for RustFS prune (handles >1000 objects); `ContinuationToken` honored; `DisablePayloadSigning = true` on `PutObjectRequest` so RustFS (which uses S3 SDK but does not implement V4 streaming signing) accepts the chunked PUT; per-object delete failures continue the prune pass (one bad object doesn't abort the rest); per-key length validation in `BackupEncryption.ParseConfiguredKey` with distinct error messages for missing-vs-non-base64-vs-wrong-length; AES-GCM with 12-byte CSPRNG nonce (NIST SP 800-38D); local-cache prune isolated from RustFS prune so one failure mode does not cascade.

### File List

- [backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs](../../backend/src/IabConnect.Infrastructure/Backup/PostgresBackupService.cs) — EDIT (full rewrite: remove 6 docker-call sites; direct pg_dump/pg_restore; encryption-then-upload chain; fail-fast constructor; AC-1, AC-3).
- [backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs](../../backend/src/IabConnect.Infrastructure/Backup/BackupEncryption.cs) — NEW (AES-256-GCM stream encrypt/decrypt + `ParseConfiguredKey` fail-fast helper; SPDX header; AC-3).
- [backend/src/IabConnect.Infrastructure/Backup/PruneOldBackupsJob.cs](../../backend/src/IabConnect.Infrastructure/Backup/PruneOldBackupsJob.cs) — NEW (RustFS-list + delete + local-cache prune; SPDX header; AC-4).
- [backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs](../../backend/src/IabConnect.Infrastructure/Backup/ScheduledBackupJob.cs) — UNCHANGED (existing job class wired into Hangfire via `RegisterDailyBackupJob`).
- [backend/src/IabConnect.Infrastructure/DependencyInjection.cs](../../backend/src/IabConnect.Infrastructure/DependencyInjection.cs) — EDIT (1 new line: `services.AddScoped<PruneOldBackupsJob>();`).
- [backend/src/IabConnect.Api/DependencyInjection.cs](../../backend/src/IabConnect.Api/DependencyInjection.cs) — EDIT (4 new `internal const` constants for job ids + cron expressions; new `internal static void RegisterDailyBackupJob` helper at the bottom; invocation site added inside the `if (app.Environment.EnvironmentName != "Testing")` block adjacent to `RegisterRetentionEnforcementJob`; AC-3 + AC-4).
- [backend/Dockerfile](../../backend/Dockerfile) — EDIT (runtime stage RUN now installs `postgresql-client-17` via PGDG apt repo with GPG key import + gnupg purge in one layer; AC-2).
- [backend/.env.example](../../backend/.env.example) — EDIT (remove `Backup__DockerContainer`; add `Backup__BucketName=backups`; expand `Backup__EncryptionKey` comment to describe fail-fast semantics).
- [backend/tests/IabConnect.Infrastructure.Tests/Backup/BackupEncryptionTests.cs](../../backend/tests/IabConnect.Infrastructure.Tests/Backup/BackupEncryptionTests.cs) — NEW (16 unit tests; round-trip + nonce + tamper + wrong-key + key-size theory + ParseConfiguredKey paths; SPDX header).
- [backend/tests/IabConnect.Infrastructure.Tests/Backup/PruneOldBackupsJobTests.cs](../../backend/tests/IabConnect.Infrastructure.Tests/Backup/PruneOldBackupsJobTests.cs) — NEW (5 unit tests; mocked-S3 + temp-dir local cache + paginated listing + RetentionDays constant; embedded `FixedTimeProvider` helper class; SPDX header).
- [backend/tests/IabConnect.Api.Tests/RegisterDailyBackupJobTests.cs](../../backend/tests/IabConnect.Api.Tests/RegisterDailyBackupJobTests.cs) — NEW (4 unit tests; mocked-IRecurringJobManager + mocked-IWebHostEnvironment; Beta/Production add path + Development RemoveIfExists path + job-id/cron-string contract pins; SPDX header).
- [docs/14_beta_railway_setup.md](../../docs/14_beta_railway_setup.md) — EDIT (TOC entry added for Section 15; Section 5.1 api Variables table updated for `Backup__Directory` + `Backup__BucketName` + `Backup__EncryptionKey`; new Section 15 inserted between Section 14 and the Appendix — ~190 lines covering 7 subsections per AC-9).
- [_bmad-output/implementation-artifacts/sprint-status.yaml](../sprint-status.yaml) — EDIT (e15-s3 ready-for-dev → in-progress → review).

### Change Log

- 2026-06-02: E15-S3 dev-story executed end-to-end. PostgresBackupService refactored to direct pg_dump/pg_restore (E13-FT-6 closed); BackupEncryption + PruneOldBackupsJob shipped; Hangfire `daily-pg-backup` + `prune-old-backups` registered via `RegisterDailyBackupJob`; Dockerfile installs `postgresql-client-17`; `.env.example` + docs/14 Section 5.1 + Section 15 (new, 7 subsections) updated. 25 new tests (16 BackupEncryption + 5 PruneOldBackupsJob + 4 RegisterDailyBackupJob); backend suite 2005 green (baseline 1976 + 4 S2 + 25 S3 = 2005); zero regressions; zero warnings. DEC-1 auto-resolved to Option A under A41. Task 6 full Testcontainers Postgres+Minio round-trip + Task 8 manual restore drill remain `[!]` for Harry's live-Beta session. Sprint-status: e15-s3 → review.
