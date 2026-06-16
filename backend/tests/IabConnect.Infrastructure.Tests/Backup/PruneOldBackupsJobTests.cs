// SPDX-License-Identifier: AGPL-3.0-or-later
using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using IabConnect.Infrastructure.Backup;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Backup;

/// <summary>
/// REQ-088 AC-6 (E15-S3 / ADR-019): unit tests for <see cref="PruneOldBackupsJob"/>.
/// Mock-only — no Testcontainers Postgres, no real Minio. Pure assertion that the
/// 30-day cutoff is honoured AND the list / delete dance is correctly driven.
/// </summary>
public sealed class PruneOldBackupsJobTests
{
    private const string Bucket = "backups";
    private static readonly DateTime _now = new(2026, 6, 2, 4, 0, 0, DateTimeKind.Utc);

    /// <summary>Minimal fixed-time provider. Avoids pulling Microsoft.Extensions.TimeProvider.Testing into Infrastructure.Tests.</summary>
    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private static FixedTimeProvider FakeNow(DateTime utc) => new(new DateTimeOffset(utc, TimeSpan.Zero));

    private static IConfiguration BuildConfig(string? backupDir = null) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Backup:BucketName"] = Bucket,
                ["Backup:Directory"] = backupDir,
            })
            .Build();

    private static S3Object Obj(string key, DateTime lastModified) => new()
    {
        Key = key,
        LastModified = lastModified,
        BucketName = Bucket,
    };

    [Fact]
    public async Task Execute_DeletesOnlyObjectsOlderThanRetentionWindow()
    {
        // Mix of old + young objects. Cutoff = now - 30 days.
        var oldEnough = _now.AddDays(-31);
        var ninthOf = _now.AddDays(-29);
        var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
        s3.Setup(m => m.ListObjectsV2Async(
                It.Is<ListObjectsV2Request>(r => r.BucketName == Bucket && r.Prefix == "backups/"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListObjectsV2Response
            {
                IsTruncated = false,
                S3Objects = new List<S3Object>
                {
                    Obj("backups/2026/05/01-030000.dump.gz.enc", oldEnough),
                    Obj("backups/2026/05/03-030000.dump.gz.enc", ninthOf),
                    Obj("backups/2026/04/30-030000.dump.gz.enc", oldEnough),
                },
            });
        s3.Setup(m => m.DeleteObjectAsync(Bucket, "backups/2026/05/01-030000.dump.gz.enc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse());
        s3.Setup(m => m.DeleteObjectAsync(Bucket, "backups/2026/04/30-030000.dump.gz.enc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse());

        var time = FakeNow(_now);
        var job = new PruneOldBackupsJob(s3.Object, BuildConfig(), NullLogger<PruneOldBackupsJob>.Instance, time);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        s3.Verify(m => m.DeleteObjectAsync(Bucket, "backups/2026/05/01-030000.dump.gz.enc", It.IsAny<CancellationToken>()), Times.Once);
        s3.Verify(m => m.DeleteObjectAsync(Bucket, "backups/2026/04/30-030000.dump.gz.enc", It.IsAny<CancellationToken>()), Times.Once);
        s3.Verify(m => m.DeleteObjectAsync(Bucket, "backups/2026/05/03-030000.dump.gz.enc", It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Execute_EmptyBucket_DoesNotCallDelete()
    {
        var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
        s3.Setup(m => m.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListObjectsV2Response { IsTruncated = false, S3Objects = new List<S3Object>() });

        var time = FakeNow(_now);
        var job = new PruneOldBackupsJob(s3.Object, BuildConfig(), NullLogger<PruneOldBackupsJob>.Instance, time);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        s3.Verify(
            m => m.DeleteObjectAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Execute_HandlesPaginatedListings()
    {
        // Two pages: first page returns one old + IsTruncated=true; second page returns one young.
        var oldEnough = _now.AddDays(-45);
        var young = _now.AddDays(-10);

        var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
        var seq = new MockSequence();
        s3.InSequence(seq).Setup(m => m.ListObjectsV2Async(
                It.Is<ListObjectsV2Request>(r => r.ContinuationToken == null),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListObjectsV2Response
            {
                IsTruncated = true,
                NextContinuationToken = "page-2",
                S3Objects = new List<S3Object> { Obj("backups/2026/04/15-030000.dump.gz.enc", oldEnough) },
            });
        s3.InSequence(seq).Setup(m => m.ListObjectsV2Async(
                It.Is<ListObjectsV2Request>(r => r.ContinuationToken == "page-2"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ListObjectsV2Response
            {
                IsTruncated = false,
                S3Objects = new List<S3Object> { Obj("backups/2026/05/23-030000.dump.gz.enc", young) },
            });
        s3.Setup(m => m.DeleteObjectAsync(Bucket, "backups/2026/04/15-030000.dump.gz.enc", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse());

        var time = FakeNow(_now);
        var job = new PruneOldBackupsJob(s3.Object, BuildConfig(), NullLogger<PruneOldBackupsJob>.Instance, time);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        s3.Verify(
            m => m.DeleteObjectAsync(Bucket, "backups/2026/04/15-030000.dump.gz.enc", It.IsAny<CancellationToken>()),
            Times.Once);
        // Young object on page 2 is NOT deleted.
        s3.Verify(
            m => m.DeleteObjectAsync(Bucket, "backups/2026/05/23-030000.dump.gz.enc", It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Execute_LocalCache_DeletesOnlyOldFiles()
    {
        // Build a temp directory with 2 old files + 1 young file. The job must delete
        // the 2 old, keep the young.
        var tempDir = Path.Combine(Path.GetTempPath(), $"iabconnect-prune-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(tempDir);
        try
        {
            var oldA = Path.Combine(tempDir, "iabconnect_backup_20260401_030000.sql");
            var oldB = Path.Combine(tempDir, "iabconnect_backup_20260415_030000.sql");
            var fresh = Path.Combine(tempDir, "iabconnect_backup_20260601_030000.sql");
            File.WriteAllText(oldA, "old-a");
            File.WriteAllText(oldB, "old-b");
            File.WriteAllText(fresh, "fresh");
            File.SetLastWriteTimeUtc(oldA, _now.AddDays(-45));
            File.SetLastWriteTimeUtc(oldB, _now.AddDays(-31));
            File.SetLastWriteTimeUtc(fresh, _now.AddDays(-5));

            var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
            s3.Setup(m => m.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ListObjectsV2Response { IsTruncated = false, S3Objects = new List<S3Object>() });

            var time = FakeNow(_now);
            var job = new PruneOldBackupsJob(s3.Object, BuildConfig(tempDir), NullLogger<PruneOldBackupsJob>.Instance, time);

            await job.ExecuteAsync(TestContext.Current.CancellationToken);

            File.Exists(oldA).Should().BeFalse("the 45-day-old file is past the 30-day cutoff");
            File.Exists(oldB).Should().BeFalse("the 31-day-old file is past the 30-day cutoff");
            File.Exists(fresh).Should().BeTrue("the 5-day-old file is within the retention window");
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, recursive: true);
            }
        }
    }

    [Fact]
    public void RetentionDays_IsLockedTo30()
    {
        // REQ-088 AC-6 mandates 30-day retention. A future change to this constant
        // is a contract change that needs an explicit story — this assertion makes
        // the contract visible to anyone editing the field.
        PruneOldBackupsJob.RetentionDays.Should().Be(30);
    }
}
