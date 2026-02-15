using System.Security.Cryptography;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Storage;

/// <summary>
/// REQ-061: Finance document storage implementation using S3-compatible storage (RustFS).
/// Wraps the generic IDocumentStorage with finance-specific validation and path conventions.
/// </summary>
public class FinanceDocumentStorage : IFinanceDocumentStorage
{
    private readonly IDocumentStorage _storage;
    private readonly ILogger<FinanceDocumentStorage> _logger;

    /// <summary>
    /// Maximum file size for receipt uploads: 10 MB
    /// </summary>
    private const long MaxFileSize = 10 * 1024 * 1024;

    /// <summary>
    /// Allowed content types for receipt uploads
    /// </summary>
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/tiff"
    };

    /// <summary>
    /// Allowed file extensions for receipt uploads
    /// </summary>
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".tiff",
        ".tif"
    };

    public FinanceDocumentStorage(
        IDocumentStorage storage,
        ILogger<FinanceDocumentStorage> logger)
    {
        _storage = storage;
        _logger = logger;
    }

    public ReceiptFileValidationResult ValidateFile(string fileName, string contentType, long fileSize)
    {
        if (fileSize <= 0)
            return new ReceiptFileValidationResult(false, "File is empty.");

        if (fileSize > MaxFileSize)
            return new ReceiptFileValidationResult(false, $"File size ({fileSize} bytes) exceeds maximum allowed size of {MaxFileSize / (1024 * 1024)} MB.");

        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(extension) || !AllowedExtensions.Contains(extension))
            return new ReceiptFileValidationResult(false, $"File extension '{extension}' is not allowed. Allowed: {string.Join(", ", AllowedExtensions)}");

        if (!AllowedContentTypes.Contains(contentType))
            return new ReceiptFileValidationResult(false, $"Content type '{contentType}' is not allowed. Allowed: {string.Join(", ", AllowedContentTypes)}");

        return new ReceiptFileValidationResult(true);
    }

    public async Task<ReceiptUploadResult> UploadReceiptAsync(
        Guid receiptId,
        string fileName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        // Sanitize the filename
        var sanitizedFileName = SanitizeFileName(fileName);
        var storagePath = $"finance-documents/receipts/{receiptId}/{sanitizedFileName}";

        // Read content into memory buffer to compute hash and upload
        using var memoryStream = new MemoryStream();
        await content.CopyToAsync(memoryStream, cancellationToken);
        var fileSize = memoryStream.Length;

        // Compute SHA256 hash
        memoryStream.Position = 0;
        var fileHash = await ComputeSha256Async(memoryStream, cancellationToken);

        // Upload to storage
        memoryStream.Position = 0;
        await _storage.UploadAsync(storagePath, memoryStream, contentType, cancellationToken);

        _logger.LogInformation(
            "Receipt file uploaded: {StoragePath}, Size: {FileSize}, Hash: {FileHash}",
            storagePath, fileSize, fileHash);

        return new ReceiptUploadResult(storagePath, fileHash, fileSize);
    }

    public async Task<Stream> DownloadReceiptAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        return await _storage.DownloadAsync(storagePath, cancellationToken);
    }

    public async Task DeleteReceiptAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        if (await _storage.ExistsAsync(storagePath, cancellationToken))
        {
            await _storage.DeleteAsync(storagePath, cancellationToken);
            _logger.LogInformation("Receipt file deleted from storage: {StoragePath}", storagePath);
        }
        else
        {
            _logger.LogWarning("Receipt file not found in storage for deletion: {StoragePath}", storagePath);
        }
    }

    public async Task<bool> ExistsAsync(string storagePath, CancellationToken cancellationToken = default)
    {
        return await _storage.ExistsAsync(storagePath, cancellationToken);
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var sanitized = new string(fileName.Where(c => !invalidChars.Contains(c)).ToArray());
        return string.IsNullOrWhiteSpace(sanitized) ? "receipt" : sanitized;
    }

    private static async Task<string> ComputeSha256Async(Stream stream, CancellationToken cancellationToken)
    {
        var hashBytes = await SHA256.HashDataAsync(stream, cancellationToken);
        return Convert.ToHexStringLower(hashBytes);
    }
}
