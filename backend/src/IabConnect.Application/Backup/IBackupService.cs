using IabConnect.Domain.Operations;

namespace IabConnect.Application.Backup;

/// <summary>
/// REQ-053: Backup service interface for database backup operations.
/// </summary>
public interface IBackupService
{
    /// <summary>Creates a PostgreSQL backup (pg_dump).</summary>
    Task<BackupRecord> CreateBackupAsync(string createdBy, string? notes = null, CancellationToken ct = default);

    /// <summary>Lists all backup records.</summary>
    Task<List<BackupRecord>> GetBackupsAsync(CancellationToken ct = default);

    /// <summary>Gets a specific backup record.</summary>
    Task<BackupRecord?> GetBackupByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Deletes a backup record and its file.</summary>
    Task<bool> DeleteBackupAsync(Guid id, CancellationToken ct = default);

    /// <summary>Gets the backup file stream for download.</summary>
    Task<(Stream? Stream, string FileName)?> GetBackupFileAsync(Guid id, CancellationToken ct = default);

    /// <summary>Restores the database from a backup (pg_restore).</summary>
    Task<BackupRecord> RestoreBackupAsync(Guid id, string restoredBy, CancellationToken ct = default);

    /// <summary>Uploads a backup file and creates a record for it.</summary>
    Task<BackupRecord> UploadBackupAsync(Stream fileStream, string fileName, string uploadedBy, string? notes = null, CancellationToken ct = default);
}
