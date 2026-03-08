namespace IabConnect.Domain.Operations;

/// <summary>
/// REQ-053: Represents a database backup record.
/// </summary>
public class BackupRecord
{
    public Guid Id { get; private set; }
    public string FileName { get; private set; } = null!;
    public long FileSizeBytes { get; private set; }
    public BackupType Type { get; private set; }
    public BackupStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public string CreatedBy { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public string? ErrorMessage { get; private set; }
    public DateTime? RestoredAt { get; private set; }
    public string? RestoredBy { get; private set; }

    private BackupRecord() { }

    public static BackupRecord Create(BackupType type, string createdBy, string? notes = null)
    {
        return new BackupRecord
        {
            Id = Guid.NewGuid(),
            FileName = $"iabconnect_backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.sql",
            Type = type,
            Status = BackupStatus.InProgress,
            Notes = notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };
    }

    public static BackupRecord CreateFromUpload(string fileName, long fileSizeBytes, string createdBy, string? notes = null)
    {
        return new BackupRecord
        {
            Id = Guid.NewGuid(),
            FileName = fileName,
            FileSizeBytes = fileSizeBytes,
            Type = BackupType.Upload,
            Status = BackupStatus.Completed,
            Notes = notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow
        };
    }

    public void MarkCompleted(long fileSizeBytes)
    {
        Status = BackupStatus.Completed;
        FileSizeBytes = fileSizeBytes;
        CompletedAt = DateTime.UtcNow;
    }

    public void MarkFailed(string errorMessage)
    {
        Status = BackupStatus.Failed;
        ErrorMessage = errorMessage;
        CompletedAt = DateTime.UtcNow;
    }

    public void MarkRestored(string restoredBy)
    {
        RestoredAt = DateTime.UtcNow;
        RestoredBy = restoredBy;
    }

    public bool IsStuck(TimeSpan timeout)
    {
        return Status == BackupStatus.InProgress && DateTime.UtcNow - CreatedAt > timeout;
    }
}

public enum BackupType
{
    Manual,
    Scheduled,
    Upload
}

public enum BackupStatus
{
    InProgress,
    Completed,
    Failed
}
