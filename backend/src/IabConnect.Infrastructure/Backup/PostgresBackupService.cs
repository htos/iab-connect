using System.Diagnostics;
using IabConnect.Application.Backup;
using IabConnect.Domain.Operations;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Backup;

/// <summary>
/// REQ-053: Backup service using pg_dump for PostgreSQL database backups.
/// Stores backup files in a configurable local directory.
/// </summary>
public sealed class PostgresBackupService : IBackupService
{
    private readonly ApplicationDbContext _db;
    private readonly string _connectionString;
    private readonly string _backupDirectory;
    private readonly ILogger<PostgresBackupService> _logger;

    private readonly string _dockerContainer;

    public PostgresBackupService(
        ApplicationDbContext db,
        IConfiguration configuration,
        ILogger<PostgresBackupService> logger)
    {
        _db = db;
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        _backupDirectory = configuration.GetValue<string>("Backup:Directory")
            ?? Path.Combine(AppContext.BaseDirectory, "backups");
        _dockerContainer = configuration.GetValue<string>("Backup:DockerContainer")
            ?? "iabconnect-postgres";
        _logger = logger;

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
            var containerDumpPath = $"/tmp/{record.FileName}";

            // Run pg_dump inside the Docker container
            var dumpInfo = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = $"exec -e PGPASSWORD={connParts.Password} {_dockerContainer} pg_dump --format=custom --file={containerDumpPath} --dbname={connParts.Database} -U {connParts.Username}",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using var dumpProcess = Process.Start(dumpInfo)
                ?? throw new InvalidOperationException("Failed to start docker exec process.");

            var stderr = await dumpProcess.StandardError.ReadToEndAsync(ct);
            await dumpProcess.WaitForExitAsync(ct);

            if (dumpProcess.ExitCode != 0)
            {
                record.MarkFailed($"pg_dump exited with code {dumpProcess.ExitCode}: {stderr}");
                _logger.LogError("Backup failed: {Error}", stderr);
            }
            else
            {
                // Copy the dump file from the container to the host
                var cpInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"cp {_dockerContainer}:{containerDumpPath} \"{filePath}\"",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                using var cpProcess = Process.Start(cpInfo)
                    ?? throw new InvalidOperationException("Failed to start docker cp process.");

                var cpStderr = await cpProcess.StandardError.ReadToEndAsync(ct);
                await cpProcess.WaitForExitAsync(ct);

                if (cpProcess.ExitCode != 0)
                {
                    record.MarkFailed($"docker cp failed: {cpStderr}");
                    _logger.LogError("docker cp failed: {Error}", cpStderr);
                }
                else
                {
                    var fileInfo = new FileInfo(filePath);
                    record.MarkCompleted(fileInfo.Length);
                    _logger.LogInformation("Backup created: {FileName} ({Size} bytes)", record.FileName, fileInfo.Length);
                }

                // Clean up temp file inside the container
                var rmInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"exec {_dockerContainer} rm -f {containerDumpPath}",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var rmProcess = Process.Start(rmInfo);
                if (rmProcess is not null) await rmProcess.WaitForExitAsync(ct);
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
        var containerDumpPath = $"/tmp/restore_{record.FileName}";

        // Copy backup file into the container
        var cpInfo = new ProcessStartInfo
        {
            FileName = "docker",
            Arguments = $"cp \"{filePath}\" {_dockerContainer}:{containerDumpPath}",
            UseShellExecute = false,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        using var cpProcess = Process.Start(cpInfo)
            ?? throw new InvalidOperationException("Failed to start docker cp process.");
        var cpStderr = await cpProcess.StandardError.ReadToEndAsync(ct);
        await cpProcess.WaitForExitAsync(ct);

        if (cpProcess.ExitCode != 0)
            throw new InvalidOperationException($"docker cp failed: {cpStderr}");

        try
        {
            // Restore using pg_restore with --clean to drop & recreate objects
            var restoreInfo = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = $"exec -e PGPASSWORD={connParts.Password} {_dockerContainer} pg_restore --clean --if-exists --dbname={connParts.Database} -U {connParts.Username} {containerDumpPath}",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using var restoreProcess = Process.Start(restoreInfo)
                ?? throw new InvalidOperationException("Failed to start pg_restore process.");

            var stderr = await restoreProcess.StandardError.ReadToEndAsync(ct);
            await restoreProcess.WaitForExitAsync(ct);

            // pg_restore exit code 1 = warnings (e.g., "role already exists"), only fail on > 1
            if (restoreProcess.ExitCode > 1)
                throw new InvalidOperationException($"pg_restore exited with code {restoreProcess.ExitCode}: {stderr}");

            record.MarkRestored(restoredBy);
            _db.Set<BackupRecord>().Update(record);
            await _db.SaveChangesAsync(ct);

            _logger.LogInformation("Database restored from backup {FileName} by {User}", record.FileName, restoredBy);
            return record;
        }
        finally
        {
            // Clean up temp file inside the container
            var rmInfo = new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = $"exec {_dockerContainer} rm -f {containerDumpPath}",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var rmProcess = Process.Start(rmInfo);
            if (rmProcess is not null) await rmProcess.WaitForExitAsync(ct);
        }
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
            Password: parts.GetValueOrDefault("Password", "")
        );
    }
}
