using Amazon.S3;
using Amazon.S3.Model;
using IabConnect.Application.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Storage;

/// <summary>
/// S3-compatible document storage implementation using RustFS
/// REQ-034: Document management storage
/// </summary>
public class S3DocumentStorage : IDocumentStorage
{
    private readonly IAmazonS3 _s3Client;
    private readonly DocumentStorageSettings _settings;
    private readonly ILogger<S3DocumentStorage> _logger;

    public S3DocumentStorage(
        IAmazonS3 s3Client,
        IOptions<DocumentStorageSettings> settings,
        ILogger<S3DocumentStorage> logger)
    {
        _s3Client = s3Client;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<string> UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var request = new PutObjectRequest
        {
            BucketName = _settings.BucketName,
            Key = key,
            InputStream = content,
            ContentType = contentType
        };

        await _s3Client.PutObjectAsync(request, cancellationToken);
        _logger.LogInformation("Uploaded document to storage: {Key}", key);
        return key;
    }

    public async Task<Stream> DownloadAsync(string key, CancellationToken cancellationToken = default)
    {
        var request = new GetObjectRequest
        {
            BucketName = _settings.BucketName,
            Key = key
        };

        var response = await _s3Client.GetObjectAsync(request, cancellationToken);
        return response.ResponseStream;
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        var request = new DeleteObjectRequest
        {
            BucketName = _settings.BucketName,
            Key = key
        };

        await _s3Client.DeleteObjectAsync(request, cancellationToken);
        _logger.LogInformation("Deleted document from storage: {Key}", key);
    }

    public async Task<string> GetPreSignedDownloadUrlAsync(string key, TimeSpan expiry, CancellationToken cancellationToken = default)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = _settings.BucketName,
            Key = key,
            Expires = DateTime.UtcNow.Add(expiry),
            Verb = HttpVerb.GET
        };

        var url = await _s3Client.GetPreSignedURLAsync(request);
        return url;
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new GetObjectMetadataRequest
            {
                BucketName = _settings.BucketName,
                Key = key
            };

            await _s3Client.GetObjectMetadataAsync(request, cancellationToken);
            return true;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task<StorageFileInfo?> GetFileInfoAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new GetObjectMetadataRequest
            {
                BucketName = _settings.BucketName,
                Key = key
            };

            var response = await _s3Client.GetObjectMetadataAsync(request, cancellationToken);
            return new StorageFileInfo(
                key,
                response.ContentLength,
                response.Headers.ContentType,
                response.LastModified);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
