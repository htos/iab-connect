// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Security.Cryptography;
using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using IabConnect.Infrastructure.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Testcontainers.Minio;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Storage;

/// <summary>
/// REQ-088 AC-3 (E16-S3 / ADR-013): Testcontainers MinIO round-trip tests for
/// <see cref="S3DocumentStorage"/>. Validates that the S3-compatible client path
/// works against a real MinIO server (the closest in-process analogue of the
/// RustFS deployment on Beta), distinct from the Moq-only unit tests in
/// <see cref="IabConnect.Infrastructure.Tests.Backup.PruneOldBackupsJobTests"/>.
///
/// <para>The fixture provisions a single MinIO container per test class, creates the
/// configured bucket once, and exposes the resulting <see cref="IAmazonS3"/> client
/// + <see cref="DocumentStorageSettings"/> for the individual tests. Docker Desktop
/// (or another OCI runtime) must be available — local tests skip with a clear error
/// when Docker is unreachable.</para>
/// </summary>
public sealed class S3DocumentStorageIntegrationTests : IAsyncLifetime
{
    private const string BucketName = "iabconnect-documents";

    // Pin the upstream MinIO image tag. Testcontainers.Minio 4.10.0 requires an
    // explicit image arg; the parameterless ctor is obsolete (see Testcontainers
    // discussion #1470).
    private readonly MinioContainer _minio = new MinioBuilder("minio/minio:RELEASE.2024-12-13T22-19-12Z")
        .WithUsername("test-access-key")
        .WithPassword("test-secret-key-min-8-chars")
        .Build();

    private IAmazonS3 _s3 = null!;
    private DocumentStorageSettings _settings = null!;

    public async ValueTask InitializeAsync()
    {
        await _minio.StartAsync();

        _settings = new DocumentStorageSettings
        {
            ServiceUrl = _minio.GetConnectionString(),
            AccessKey = "test-access-key",
            SecretKey = "test-secret-key-min-8-chars",
            BucketName = BucketName,
            UseHttps = false,
        };

        _s3 = new AmazonS3Client(
            _settings.AccessKey,
            _settings.SecretKey,
            new AmazonS3Config
            {
                ServiceURL = _settings.ServiceUrl,
                ForcePathStyle = true,
                UseHttp = !_settings.UseHttps,
            });

        await _s3.PutBucketAsync(new PutBucketRequest { BucketName = BucketName }, CancellationToken.None);
    }

    public async ValueTask DisposeAsync()
    {
        _s3?.Dispose();
        await _minio.DisposeAsync();
    }

    private S3DocumentStorage NewStorage(DocumentStorageSettings? settingsOverride = null) =>
        new S3DocumentStorage(
            _s3,
            Options.Create(settingsOverride ?? _settings),
            NullLogger<S3DocumentStorage>.Instance);

    [Fact]
    public async Task UploadAndDownload_RoundTripsBytesIdentically()
    {
        var ct = TestContext.Current.CancellationToken;
        var payload = RandomNumberGenerator.GetBytes(1024);
        var key = $"documents/{Guid.NewGuid()}/{Guid.NewGuid()}.bin";
        var storage = NewStorage();

        using (var uploadStream = new MemoryStream(payload))
        {
            await storage.UploadAsync(key, uploadStream, "application/octet-stream", ct);
        }

        using var downloadStream = await storage.DownloadAsync(key, ct);
        using var captured = new MemoryStream();
        await downloadStream.CopyToAsync(captured, ct);
        var downloaded = captured.ToArray();

        downloaded.Should().HaveCount(payload.Length);
        Sha256(downloaded).Should().Be(Sha256(payload),
            "SHA-256 of downloaded bytes must equal SHA-256 of uploaded bytes");
    }

    [Fact]
    public async Task Upload_RespectsConfiguredBucketName()
    {
        var ct = TestContext.Current.CancellationToken;
        const string customBucket = "test-isolation-bucket-1";
        await _s3.PutBucketAsync(new PutBucketRequest { BucketName = customBucket }, ct);

        var custom = new DocumentStorageSettings
        {
            ServiceUrl = _settings.ServiceUrl,
            AccessKey = _settings.AccessKey,
            SecretKey = _settings.SecretKey,
            BucketName = customBucket,
            UseHttps = false,
        };
        var storage = NewStorage(custom);

        var key = $"documents/{Guid.NewGuid()}/{Guid.NewGuid()}.bin";
        using (var stream = new MemoryStream(new byte[] { 1, 2, 3, 4 }))
        {
            await storage.UploadAsync(key, stream, "application/octet-stream", ct);
        }

        var inCustom = await _s3.ListObjectsV2Async(
            new ListObjectsV2Request { BucketName = customBucket, Prefix = "documents/" }, ct);
        inCustom.S3Objects.Should().ContainSingle(o => o.Key == key);

        var inDefault = await _s3.ListObjectsV2Async(
            new ListObjectsV2Request { BucketName = BucketName, Prefix = "documents/" }, ct);
        inDefault.S3Objects.Should().NotContain(o => o.Key == key,
            "an upload routed to a custom bucket must NOT leak into the default bucket");
    }

    [Fact]
    public async Task Exists_ReturnsTrueAfterUpload_FalseForRandomKey()
    {
        var ct = TestContext.Current.CancellationToken;
        var storage = NewStorage();

        var uploadedKey = $"documents/{Guid.NewGuid()}/{Guid.NewGuid()}.bin";
        using (var stream = new MemoryStream(new byte[] { 9, 9, 9 }))
        {
            await storage.UploadAsync(uploadedKey, stream, "application/octet-stream", ct);
        }

        (await storage.ExistsAsync(uploadedKey, ct)).Should().BeTrue();
        (await storage.ExistsAsync($"documents/{Guid.NewGuid()}/never-uploaded.bin", ct))
            .Should().BeFalse();
    }

    [Fact]
    public async Task TwoBucket_IsolationInvariant_DocumentsBucketDoesNotLeakIntoBackupsBucket()
    {
        // REQ-088 AC-3 + A31 two-bucket distinct invariant: the document-storage path uses
        // bucket `iabconnect-documents`; the daily backup job uses bucket `backups` on the
        // SAME RustFS instance (per ADR-019 / E15-S3). A regression that hard-codes the
        // bucket name or shares a singleton settings instance across both consumers would
        // cause documents to surface in the backups listing — which is what this test
        // catches at unit level (Beta-side validation is in docs/14_beta_railway_setup.md §19.6).
        var ct = TestContext.Current.CancellationToken;
        const string backupsBucket = "backups";
        await _s3.PutBucketAsync(new PutBucketRequest { BucketName = backupsBucket }, ct);

        var docStorage = NewStorage();
        var docKey = $"documents/{Guid.NewGuid()}/round-trip.bin";
        using (var stream = new MemoryStream(new byte[] { 1, 2, 3 }))
        {
            await docStorage.UploadAsync(docKey, stream, "application/octet-stream", ct);
        }

        var backupsListing = await _s3.ListObjectsV2Async(
            new ListObjectsV2Request { BucketName = backupsBucket, Prefix = "documents/" }, ct);
        backupsListing.S3Objects.Should().BeEmpty(
            "the documents-storage path must NOT write into the backups bucket");

        var documentsListing = await _s3.ListObjectsV2Async(
            new ListObjectsV2Request { BucketName = BucketName, Prefix = "documents/" }, ct);
        documentsListing.S3Objects.Should().ContainSingle(o => o.Key == docKey);
    }

    private static string Sha256(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash);
    }
}
