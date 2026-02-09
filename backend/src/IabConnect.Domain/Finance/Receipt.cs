using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-043: Receipt (Beleg) - uploaded document attached to a transaction.
/// </summary>
public class Receipt : Entity
{
    public string FileName { get; private set; } = string.Empty;
    public string FilePath { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long FileSize { get; private set; }
    public DateTime UploadedAt { get; private set; }
    public string UploadedBy { get; private set; } = string.Empty;
    public string? Notes { get; private set; }

    private Receipt() { }

    public static Receipt Create(
        string fileName,
        string filePath,
        string contentType,
        long fileSize,
        string uploadedBy,
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
            UploadedAt = DateTime.UtcNow,
            UploadedBy = uploadedBy,
            Notes = notes?.Trim()
        };
    }
}
