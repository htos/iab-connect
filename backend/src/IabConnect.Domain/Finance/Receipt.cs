using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-043 / REQ-061: Receipt (Beleg) - uploaded document attached to a transaction.
/// Supports actual file upload to S3-compatible storage (RustFS).
/// </summary>
public class Receipt : Entity, ISoftDeletable
{
    public string FileName { get; private set; } = string.Empty;
    public string FilePath { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long FileSize { get; private set; }
    public string? FileHash { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public string UploadedBy { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private Receipt() { }

    public static Receipt Create(
        string fileName,
        string filePath,
        string contentType,
        long fileSize,
        string uploadedBy,
        string? fileHash = null,
        string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            throw new ArgumentException("FileName is required.", nameof(fileName));

        return new Receipt
        {
            FileName = fileName,
            FilePath = filePath,
            ContentType = contentType,
            FileSize = fileSize,
            FileHash = fileHash,
            UploadedAt = DateTime.UtcNow,
            UploadedBy = uploadedBy,
            Notes = notes?.Trim()
        };
    }

    /// <summary>
    /// Updates the storage metadata after a successful file upload.
    /// </summary>
    public void SetStorageMetadata(string storagePath, string fileHash, long fileSize)
    {
        FilePath = storagePath;
        FileHash = fileHash;
        FileSize = fileSize;
    }

    public void SoftDelete(string? deletedBy = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
