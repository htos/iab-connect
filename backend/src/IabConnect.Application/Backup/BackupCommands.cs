using MediatR;
using IabConnect.Domain.Operations;

namespace IabConnect.Application.Backup;

/// <summary>
/// REQ-053: Command to create a database backup.
/// </summary>
public sealed record CreateBackupCommand(string CreatedBy, string? Notes) : IRequest<BackupDto>;

/// <summary>
/// REQ-053: Query to list all backups.
/// </summary>
public sealed record GetBackupsQuery : IRequest<List<BackupDto>>;

/// <summary>
/// REQ-053: Query to get a specific backup.
/// </summary>
public sealed record GetBackupByIdQuery(Guid Id) : IRequest<BackupDto?>;

/// <summary>
/// REQ-053: Command to delete a backup.
/// </summary>
public sealed record DeleteBackupCommand(Guid Id) : IRequest<bool>;

/// <summary>
/// REQ-053: Command to restore a database from a backup.
/// </summary>
public sealed record RestoreBackupCommand(Guid Id, string RestoredBy) : IRequest<BackupDto>;

/// <summary>
/// REQ-053: Command to upload a backup file.
/// </summary>
public sealed record UploadBackupCommand(Stream FileStream, string FileName, string UploadedBy, string? Notes) : IRequest<BackupDto>;

public sealed record BackupDto(
    Guid Id,
    string FileName,
    long FileSizeBytes,
    string Type,
    string Status,
    string? Notes,
    string CreatedBy,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    string? ErrorMessage,
    DateTime? RestoredAt,
    string? RestoredBy
)
{
    public static BackupDto FromEntity(BackupRecord entity) => new(
        entity.Id,
        entity.FileName,
        entity.FileSizeBytes,
        entity.Type.ToString(),
        entity.Status.ToString(),
        entity.Notes,
        entity.CreatedBy,
        entity.CreatedAt,
        entity.CompletedAt,
        entity.ErrorMessage,
        entity.RestoredAt,
        entity.RestoredBy
    );
}
