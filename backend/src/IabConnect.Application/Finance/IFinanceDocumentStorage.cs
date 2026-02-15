namespace IabConnect.Application.Finance;

/// <summary>
/// REQ-061: Finance document storage abstraction for receipt file upload/download.
/// Wraps IDocumentStorage with finance-specific validation and path conventions.
/// </summary>
public interface IFinanceDocumentStorage
{
    /// <summary>
    /// Uploads a receipt file to storage.
    /// Validates file type and size before upload. Computes SHA256 hash.
    /// Storage path: finance-documents/receipts/{receiptId}/{filename}
    /// </summary>
    /// <returns>Result containing storage key and file hash</returns>
    Task<ReceiptUploadResult> UploadReceiptAsync(
        Guid receiptId,
        string fileName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Downloads a receipt file from storage
    /// </summary>
    Task<Stream> DownloadReceiptAsync(string storagePath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a receipt file from storage
    /// </summary>
    Task DeleteReceiptAsync(string storagePath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if a receipt file exists in storage
    /// </summary>
    Task<bool> ExistsAsync(string storagePath, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates the file type and size for receipt uploads
    /// </summary>
    ReceiptFileValidationResult ValidateFile(string fileName, string contentType, long fileSize);
}

/// <summary>
/// Result of a receipt file upload operation
/// </summary>
public sealed record ReceiptUploadResult(
    string StoragePath,
    string FileHash,
    long FileSize);

/// <summary>
/// Result of receipt file validation
/// </summary>
public sealed record ReceiptFileValidationResult(bool IsValid, string? ErrorMessage = null);
