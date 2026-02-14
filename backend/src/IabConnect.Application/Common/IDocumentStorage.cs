namespace IabConnect.Application.Common;

/// <summary>
/// Abstraction for S3-compatible document storage (RustFS)
/// REQ-034: Document management storage
/// </summary>
public interface IDocumentStorage
{
    /// <summary>
    /// Uploads a file to storage and returns the storage key
    /// </summary>
    Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default);

    /// <summary>
    /// Downloads a file from storage
    /// </summary>
    Task<Stream> DownloadAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a file from storage
    /// </summary>
    Task DeleteAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Generates a pre-signed URL for downloading
    /// </summary>
    Task<string> GetPreSignedDownloadUrlAsync(string key, TimeSpan expiry, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a file exists in storage
    /// </summary>
    Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets metadata about a stored file
    /// </summary>
    Task<StorageFileInfo?> GetFileInfoAsync(string key, CancellationToken cancellationToken = default);
}

/// <summary>
/// Information about a file in storage
/// </summary>
public record StorageFileInfo(
    string Key,
    long Size,
    string ContentType,
    DateTime LastModified);
