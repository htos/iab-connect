// SPDX-License-Identifier: AGPL-3.0-or-later
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Backup;

/// <summary>
/// REQ-088 AC-6 (E15-S3 / ADR-019): Hangfire recurring job that prunes encrypted
/// PostgreSQL backups older than 30 days from RustFS, plus the local cache copies
/// under <c>Backup__Directory</c> (DEC-1 Option A — hybrid local + RustFS).
///
/// <para>Scheduled at 04:00 UTC daily by
/// <c>IabConnect.Api.DependencyInjection.RegisterDailyBackupJob</c>, one hour
/// after the <c>daily-pg-backup</c> job's 03:00 UTC run, so a same-day backup is
/// never deleted by the same day's prune even at clock-skew boundaries.</para>
///
/// <para>Hangfire job-not-gated semantics: this class is unconditionally
/// constructible (only env-var-derived config). The Beta-vs-Dev gating happens at
/// registration time in <c>RegisterDailyBackupJob</c> (Dev calls
/// <c>RemoveIfExists</c> on the schedule).</para>
/// </summary>
public sealed class PruneOldBackupsJob
{
    /// <summary>Retention window in days. Hard-coded to 30 per REQ-088 AC-6.</summary>
    public const int RetentionDays = 30;

    private readonly IAmazonS3 _s3;
    private readonly string _bucketName;
    private readonly string _backupDirectory;
    private readonly ILogger<PruneOldBackupsJob> _logger;
    private readonly TimeProvider _timeProvider;

    public PruneOldBackupsJob(
        IAmazonS3 s3,
        IConfiguration configuration,
        ILogger<PruneOldBackupsJob> logger,
        TimeProvider? timeProvider = null)
    {
        _s3 = s3;
        _bucketName = configuration.GetValue<string>("Backup:BucketName") ?? "backups";
        _backupDirectory = configuration.GetValue<string>("Backup:Directory")
            ?? Path.Combine(AppContext.BaseDirectory, "backups");
        _logger = logger;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task ExecuteAsync(CancellationToken ct)
    {
        var cutoff = _timeProvider.GetUtcNow().UtcDateTime.AddDays(-RetentionDays);
        _logger.LogInformation(
            "Starting backup-prune pass: deleting RustFS objects older than {Cutoff:o} from bucket {Bucket}",
            cutoff,
            _bucketName);

        var deletedRustFs = await PruneRustFsAsync(cutoff, ct);
        var deletedLocal = PruneLocalCache(cutoff);

        _logger.LogInformation(
            "Backup-prune pass complete: {RustFsCount} RustFS objects + {LocalCount} local files deleted (cutoff {Cutoff:o})",
            deletedRustFs,
            deletedLocal,
            cutoff);
    }

    private async Task<int> PruneRustFsAsync(DateTime cutoffUtc, CancellationToken ct)
    {
        var deleted = 0;
        string? continuationToken = null;
        do
        {
            var listReq = new ListObjectsV2Request
            {
                BucketName = _bucketName,
                Prefix = "backups/",
                ContinuationToken = continuationToken,
            };
            var listResp = await _s3.ListObjectsV2Async(listReq, ct);

            // E15-S3 boundary review P7: older AWS SDK versions could return a null
            // S3Objects collection on an empty bucket. Current SDK guarantees an empty
            // list but we defend against the surface anyway — a NRE here aborts the
            // entire prune pass and the next listing page would be missed.
            var page = listResp.S3Objects ?? new List<S3Object>();
            foreach (var obj in page)
            {
                // S3Object.LastModified is DateTime (UTC) per AWSSDK.S3 convention.
                // Normalize to Kind=Utc for the cutoff comparison.
                var lastModifiedUtc = DateTime.SpecifyKind(obj.LastModified, DateTimeKind.Utc);

                // E15-S3 boundary review P4: a default DateTime (0001-01-01) compares as
                // older than ANY cutoff and would trigger deletion of objects whose
                // metadata is missing or corrupted. Skip + warn — losing observability
                // about a malformed object is worse than briefly retaining one.
                if (lastModifiedUtc == DateTime.MinValue)
                {
                    _logger.LogWarning(
                        "Skipping RustFS backup object {Key} — LastModified missing or default (0001-01-01); cannot reason about retention",
                        obj.Key);
                    continue;
                }

                if (lastModifiedUtc < cutoffUtc)
                {
                    try
                    {
                        await _s3.DeleteObjectAsync(_bucketName, obj.Key, ct);
                        deleted++;
                        _logger.LogDebug("Deleted RustFS backup object {Key} (last-modified {LastModified:o})", obj.Key, lastModifiedUtc);
                    }
                    catch (Exception ex)
                    {
                        // Continue prune across remaining objects; surfacing a single
                        // delete failure should not stop the rest of the pass.
                        _logger.LogWarning(ex, "Failed to delete RustFS backup object {Key}", obj.Key);
                    }
                }
            }

            // E15-S3 boundary review P6: in AWSSDK.S3 3.7.x `IsTruncated` is bool
            // (non-nullable) — a missing field from a RustFS S3 adapter would
            // deserialize to default(bool)=false, ending the loop. If a future SDK
            // upgrade flips it to bool? a parallel null guard becomes necessary;
            // keep this assignment trivial for now so the breakage is loud
            // (compile-time) rather than silent.
            continuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : null;
        } while (continuationToken is not null);

        return deleted;
    }

    private int PruneLocalCache(DateTime cutoffUtc)
    {
        if (!Directory.Exists(_backupDirectory))
            return 0;

        var deleted = 0;
        foreach (var file in Directory.EnumerateFiles(_backupDirectory))
        {
            try
            {
                if (File.GetLastWriteTimeUtc(file) < cutoffUtc)
                {
                    File.Delete(file);
                    deleted++;
                    _logger.LogDebug("Deleted local cache backup {File}", file);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete local backup cache file {File}", file);
            }
        }
        return deleted;
    }
}
