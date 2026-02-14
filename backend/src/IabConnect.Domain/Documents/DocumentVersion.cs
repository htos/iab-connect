using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// A specific version of a document with storage pointer
/// REQ-036: Versionierung
/// </summary>
public sealed class DocumentVersion : Entity
{
    public Guid DocumentId { get; private set; }
    public int VersionNumber { get; private set; }
    public string StorageKey { get; private set; } = null!;
    public long FileSize { get; private set; }
    public string ContentType { get; private set; } = null!;
    public string? Comment { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public Guid? UploadedBy { get; private set; }

    private DocumentVersion() : base() { }

    public static DocumentVersion Create(
        Guid documentId,
        int versionNumber,
        string storageKey,
        long fileSize,
        string contentType,
        string? comment = null)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
            throw new ArgumentException("Storage key is required.", nameof(storageKey));
        if (versionNumber < 1)
            throw new ArgumentException("Version number must be at least 1.", nameof(versionNumber));

        return new DocumentVersion
        {
            DocumentId = documentId,
            VersionNumber = versionNumber,
            StorageKey = storageKey,
            FileSize = fileSize,
            ContentType = contentType,
            Comment = comment?.Trim(),
            UploadedAt = DateTime.UtcNow
        };
    }

    public void SetUploadedBy(Guid userId)
    {
        UploadedBy = userId;
    }
}
