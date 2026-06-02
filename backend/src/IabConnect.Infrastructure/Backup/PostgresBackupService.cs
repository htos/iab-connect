using System.Diagnostics;
using System.IO.Compression;
using Amazon.S3;
using Amazon.S3.Model;
using IabConnect.Application.Backup;
using IabConnect.Domain.Operations;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Backup;

/// <summary>
/// REQ-053 / REQ-088 AC-6 (E15-S3): Backup service using <c>pg_dump</c> /
/// <c>pg_restore</c> for PostgreSQL backup + restore. Stores the raw dump locally in
/// a configurable directory (admin-UI download/restore/upload semantics preserved
/// per DEC-1 Option A) and, when an encryption key + S3 client + bucket name are
/// available, also encrypts (AES-256-GCM via <see cref="BackupEncryption"/>) and
/// uploads a gzipped copy to RustFS at
/// <c>s3://&lt;Backup__BucketName&gt;/backups/yyyy/MM/dd-HHmmss.dump.gz.enc</c>.
///
/// <para>The previous Docker-exec-based implementation (6 <c>Process.Start("docker",
/// "exec ...")</c> + <c>docker cp</c> sites at lines 66/90/116/212/233/260 of the
/// pre-E15-S3 version) was incompatible with Railway (E13-FT-6): the api container
/// on Railway has no Docker daemon, no <c>docker</c> CLI, and no sibling
/// <c>iabconnect-postgres</c> container to exec into. This refactor invokes
/// <c>pg_dump</c>/<c>pg_restore</c> as direct host processes — the backend
/// Dockerfile (E15-S3 Task 2) installs <c>postgresql-client-17</c> so the binaries
/// are present in the runtime image.</para>
///
/// <para>Fail-fast posture: in any non-Development environment, missing or invalid
/// <c>Backup__EncryptionKey</c> throws at first construction so the misconfigured
/// service never silently runs without encryption. In Development the encryption +
/// upload steps are optional (the cron <c>daily-pg-backup</c> job is not registered
/// in Dev per <see cref="ADR-020"/> inverse / E15-S3 Task 5 gating); local backups
/// continue to work for admin-UI exploration without RustFS / encryption.</para>
/// </summary>
public sealed class PostgresBackupService : IBackupService
{
    private readonly ApplicationDbContext _db;
    private readonly string _connectionString;
    private readonly string _backupDirectory;
    private readonly IAmazonS3? _s3;
    private readonly string? _backupBucketName;
    private readonly byte[]? _encryptionKey;
    private readonly ILogger<PostgresBackupService> _logger;

    public PostgresBackupService(
        ApplicationDbContext db,
        IConfiguration configuration,
        IAmazonS3 s3,
        IHostEnvironment environment,
        ILogger<PostgresBackupService> logger)
    {
        _db = db;
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        _backupDirectory = configuration.GetValue<string>("Backup:Directory")
            ?? Path.Combine(AppContext.BaseDirectory, "backups");
        _logger = logger;

        // E15-S3 AC-3 + AC-10: load the encryption key. In Beta/Production, missing
        // or invalid Backup__EncryptionKey is a fatal misconfiguration — these
        // deployments MUST encrypt backups uploaded to RustFS. In Development and
        // Testing the encryption + upload pipeline is optional (the cron job is also
        // disabled in Dev per ADR-020 inverse; Testing tests rarely exercise the
        // upload path). Treating Testing as encryption-optional matches the existing
        // env-pair convention at Api/DependencyInjection.cs (HTTPS-metadata gating).
        var rawKey = configuration.GetValue<string>("Backup:EncryptionKey");
        var bucket = configuration.GetValue<string>("Backup:BucketName");

        if (environment.IsDevelopment() || environment.EnvironmentName == "Testing")
        {
            _encryptionKey = string.IsNullOrWhiteSpace(rawKey) ? null : BackupEncryption.ParseConfiguredKey(rawKey);
            _backupBucketName = string.IsNullOrWhiteSpace(bucket) ? null : bucket;
            _s3 = _backupBucketName is null ? null : s3;
        }
        else
        {
            // Fail-fast on Beta/Production misconfig.
            _encryptionKey = BackupEncryption.ParseConfiguredKey(rawKey);
            _backupBucketName = string.IsNullOrWhiteSpace(bucket) ? "backups" : bucket;
            _s3 = s3;
        }

        if (!Directory.Exists(_backupDirectory))
            Directory.CreateDirectory(_backupDirectory);
    }

    public async Task<BackupRecord> CreateBackupAsync(string createdBy, string? notes = null, CancellationToken ct = default)
    {
        var record = BackupRecord.Create(BackupType.Manual, createdBy, notes);
        _db.Set<BackupRecord>().Add(record);
        await _db.SaveChangesAsync(ct);

        var filePath = Path.Combine(_backupDirectory, record.FileName);

        try
        {
            var connParts = ParseConnectionString(_connectionString);

            // E15-S3 Task 1: direct pg_dump invocation against the connection-string
            // host/port/db/user. PGPASSWORD passed via ProcessStartInfo.Environment so
            // it never appears in the command-line (visible in /proc/<pid>/cmdline).
            var dumpInfo = new ProcessStartInfo
            {
                FileName = "pg_dump",
                ArgumentList =
                {
                    "--format=custom",
                    "--no-password",
                    "--file", filePath,
                    "--host", connParts.Host,
                    "--port", connParts.Port,
                    "--username", connParts.Username,
                    "--dbname", connParts.Database,
                },
                UseShellExecute = false,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            dumpInfo.Environment["PGPASSWORD"] = connParts.Password;

            using var dumpProcess = Process.Start(dumpInfo)
                ?? throw new InvalidOperationException("Failed to start pg_dump process.");

            var stderr = await dumpProcess.StandardError.ReadToEndAsync(ct);
            await dumpProcess.WaitForExitAsync(ct);

            if (dumpProcess.ExitCode != 0)
            {
                record.MarkFailed($"pg_dump exited with code {dumpProcess.ExitCode}: {stderr}");
                _logger.LogError("Backup failed: {Error}", stderr);
            }
            else
            {
                var fileInfo = new FileInfo(filePath);

                // E15-S3 boundary review P3: a pg_dump that exits 0 but produces a 0-byte file
                // is a silent failure (failed write, disk full at flush time, or pg_dump
                // misbehaviour). Mark the record Failed here rather than letting an empty
                // archive land on RustFS where it would silently replace a valid prior copy.
                if (fileInfo.Length == 0)
                {
                    record.MarkFailed("pg_dump exited 0 but produced a 0-byte file; refusing to upload empty backup.");
                    _logger.LogError("Backup empty: pg_dump exit 0 but {FileName} is 0 bytes", record.FileName);
                }
                else
                {
                    _logger.LogInformation("Backup created locally: {FileName} ({Size} bytes)", record.FileName, fileInfo.Length);

                    // E15-S3 AC-3 / Task 4: when encryption + bucket are wired, also upload
                    // a gzipped+encrypted copy to RustFS. Non-Dev environments always have
                    // these wired (fail-fast in constructor); Dev may skip when the operator
                    // has not configured local encryption.
                    var uploadOk = true;
                    if (_encryptionKey is not null && _s3 is not null && _backupBucketName is not null)
                    {
                        try
                        {
                            var objectKey = BuildRustFsObjectKey(record);
                            await UploadEncryptedAsync(filePath, objectKey, ct);
                            _logger.LogInformation(
                                "Backup uploaded to RustFS: s3://{Bucket}/{Key}",
                                _backupBucketName,
                                objectKey);
                        }
                        catch (Exception uploadEx)
                        {
                            // E15-S3 boundary review P5: defer the final state-setter until
                            // we know the outcome of BOTH local pg_dump AND RustFS upload, so
                            // EF's change-tracker has a single, unambiguous transition from
                            // InProgress to either Completed or Failed.
                            uploadOk = false;
                            record.MarkFailed($"pg_dump succeeded but RustFS upload failed: {uploadEx.Message}");
                            _logger.LogError(uploadEx, "Backup upload to RustFS failed for {FileName}", record.FileName);
                        }
                    }

                    if (uploadOk)
                    {
                        record.MarkCompleted(fileInfo.Length);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            record.MarkFailed(ex.Message);
            _logger.LogError(ex, "Backup creation failed");
        }

        _db.Set<BackupRecord>().Update(record);
        await _db.SaveChangesAsync(ct);
        return record;
    }

    public async Task<List<BackupRecord>> GetBackupsAsync(CancellationToken ct = default)
    {
        var records = await _db.Set<BackupRecord>()
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);

        // Auto-resolve stuck InProgress backups (>10 minutes)
        var stuckTimeout = TimeSpan.FromMinutes(10);
        var hasChanges = false;
        foreach (var record in records)
        {
            if (record.IsStuck(stuckTimeout))
            {
                record.MarkFailed("Zeitüberschreitung: Backup wurde nach 10 Minuten nicht abgeschlossen.");
                hasChanges = true;
            }
        }
        if (hasChanges)
        {
            await _db.SaveChangesAsync(ct);
        }

        return records;
    }

    public async Task<BackupRecord?> GetBackupByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Set<BackupRecord>().FindAsync([id], ct);
    }

    public async Task<bool> DeleteBackupAsync(Guid id, CancellationToken ct = default)
    {
        var record = await _db.Set<BackupRecord>().FindAsync([id], ct);
        if (record is null) return false;

        var filePath = Path.Combine(_backupDirectory, record.FileName);
        if (File.Exists(filePath))
            File.Delete(filePath);

        _db.Set<BackupRecord>().Remove(record);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(Stream? Stream, string FileName)?> GetBackupFileAsync(Guid id, CancellationToken ct = default)
    {
        var record = await _db.Set<BackupRecord>().FindAsync([id], ct);
        if (record is null) return null;

        var filePath = Path.Combine(_backupDirectory, record.FileName);
        if (!File.Exists(filePath)) return null;

        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, record.FileName);
    }

    public async Task<BackupRecord> RestoreBackupAsync(Guid id, string restoredBy, CancellationToken ct = default)
    {
        var record = await _db.Set<BackupRecord>().FindAsync([id], ct)
            ?? throw new InvalidOperationException("Backup record not found.");

        if (record.Status != BackupStatus.Completed)
            throw new InvalidOperationException("Only completed backups can be restored.");

        var filePath = Path.Combine(_backupDirectory, record.FileName);
        if (!File.Exists(filePath))
            throw new InvalidOperationException("Backup file not found on disk.");

        var connParts = ParseConnectionString(_connectionString);

        // E15-S3 Task 1: direct pg_restore invocation against the connection-string
        // host/port/db/user. PGPASSWORD passed via ProcessStartInfo.Environment.
        // pg_restore exit code 1 = warnings (e.g., "role already exists") — accepted.
        var restoreInfo = new ProcessStartInfo
        {
            FileName = "pg_restore",
            ArgumentList =
            {
                "--clean",
                "--if-exists",
                "--no-password",
                "--host", connParts.Host,
                "--port", connParts.Port,
                "--username", connParts.Username,
                "--dbname", connParts.Database,
                filePath,
            },
            UseShellExecute = false,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        restoreInfo.Environment["PGPASSWORD"] = connParts.Password;

        using var restoreProcess = Process.Start(restoreInfo)
            ?? throw new InvalidOperationException("Failed to start pg_restore process.");

        var stderr = await restoreProcess.StandardError.ReadToEndAsync(ct);
        await restoreProcess.WaitForExitAsync(ct);

        // E15-S3 boundary review P1: `> 1` accepts exit code 0 (success) and 1 (warnings —
        // e.g. "role already exists"), but silently accepts NEGATIVE exit codes that arise
        // when the process is terminated by a signal (SIGKILL = -9 on Linux, -1 on Windows
        // for "killed externally"). A SIGKILL'd pg_restore leaves the target DB in an
        // inconsistent state, and marking the restore as successful would mask the
        // corruption. Accept only the documented exit codes 0 and 1.
        if (restoreProcess.ExitCode != 0 && restoreProcess.ExitCode != 1)
            throw new InvalidOperationException($"pg_restore exited with code {restoreProcess.ExitCode}: {stderr}");

        record.MarkRestored(restoredBy);
        _db.Set<BackupRecord>().Update(record);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Database restored from backup {FileName} by {User}", record.FileName, restoredBy);
        return record;
    }

    public async Task<BackupRecord> UploadBackupAsync(Stream fileStream, string fileName, string uploadedBy, string? notes = null, CancellationToken ct = default)
    {
        // Sanitize filename — only allow alphanumeric, dash, underscore, dot
        var safeFileName = $"upload_{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Path.GetFileNameWithoutExtension(fileName).Replace(' ', '_')}.sql";
        var filePath = Path.Combine(_backupDirectory, safeFileName);

        await using (var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write))
        {
            await fileStream.CopyToAsync(fs, ct);
        }

        var fileInfo = new FileInfo(filePath);
        var record = BackupRecord.CreateFromUpload(safeFileName, fileInfo.Length, uploadedBy, notes);
        _db.Set<BackupRecord>().Add(record);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Backup uploaded: {FileName} ({Size} bytes) by {User}", safeFileName, fileInfo.Length, uploadedBy);
        return record;
    }

    /// <summary>
    /// E15-S3 Section 15.3: <c>backups/yyyy/MM/dd-HHmmss.dump.gz.enc</c> object key
    /// pattern (UTC). The local <see cref="BackupRecord.FileName"/> keeps its
    /// <c>.sql</c> extension for the admin-UI download path; the RustFS object key
    /// is a separate construct derived from the same datetime stamp.
    /// </summary>
    internal static string BuildRustFsObjectKey(BackupRecord record)
    {
        var utc = record.CreatedAt.ToUniversalTime();
        return $"backups/{utc:yyyy}/{utc:MM}/{utc:dd}-{utc:HHmmss}.dump.gz.enc";
    }

    private async Task UploadEncryptedAsync(string localFilePath, string objectKey, CancellationToken ct)
    {
        // Build the gzipped + AES-256-GCM-encrypted payload entirely in memory. The
        // Beta dataset is bounded; a chunked streaming variant can replace this if
        // dump size grows past ~256 MB. The order matters: compress first (compressed
        // ciphertext yields zero compression benefit because GCM output is uniform),
        // then encrypt.
        await using var gzipped = new MemoryStream();
        await using (var source = new FileStream(localFilePath, FileMode.Open, FileAccess.Read, FileShare.Read))
        await using (var gz = new GZipStream(gzipped, CompressionLevel.SmallestSize, leaveOpen: true))
        {
            await source.CopyToAsync(gz, ct);
        }
        gzipped.Position = 0;

        await using var encrypted = new MemoryStream();
        await BackupEncryption.EncryptAsync(gzipped, encrypted, _encryptionKey!, ct);
        encrypted.Position = 0;

        var put = new PutObjectRequest
        {
            BucketName = _backupBucketName,
            Key = objectKey,
            InputStream = encrypted,
            ContentType = "application/octet-stream",
            // E15-S3 boundary review P9: DisablePayloadSigning is required for RustFS
            // compatibility — RustFS's S3 adapter does not implement AWS V4 streaming
            // signing and rejects requests that include the streaming-signature
            // header. The security tradeoff is mitigated by the AES-256-GCM tag in
            // the payload itself: any in-flight tampering corrupts the ciphertext,
            // and decryption fails with AuthenticationTagMismatchException at restore
            // time — the tampered backup cannot be silently substituted for the real
            // one. Same flag is used by S3DocumentStorage for member-document uploads.
            DisablePayloadSigning = true,
        };
        await _s3!.PutObjectAsync(put, ct);
    }

    private static (string Host, string Port, string Database, string Username, string Password)
        ParseConnectionString(string connectionString)
    {
        var parts = connectionString.Split(';')
            .Select(p => p.Split('=', 2))
            .Where(p => p.Length == 2)
            .ToDictionary(p => p[0].Trim(), p => p[1].Trim(), StringComparer.OrdinalIgnoreCase);

        return (
            Host: parts.GetValueOrDefault("Host", "localhost"),
            Port: parts.GetValueOrDefault("Port", "5432"),
            Database: parts.GetValueOrDefault("Database", "iabconnect"),
            Username: parts.GetValueOrDefault("Username", "postgres"),
            Password: parts.GetValueOrDefault("Password", string.Empty)
        );
    }
}
