using IabConnect.Application.Backup;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Backup;

/// <summary>
/// REQ-053: Hangfire job for scheduled database backups.
/// </summary>
public sealed class ScheduledBackupJob
{
    private readonly IBackupService _backupService;
    private readonly ILogger<ScheduledBackupJob> _logger;

    public ScheduledBackupJob(
        IBackupService backupService,
        ILogger<ScheduledBackupJob> logger)
    {
        _backupService = backupService;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Starting scheduled database backup...");
        var record = await _backupService.CreateBackupAsync("system-scheduler", "Automatisches geplantes Backup", ct);

        if (record.Status == Domain.Operations.BackupStatus.Completed)
            _logger.LogInformation("Scheduled backup completed: {FileName} ({Size} bytes)", record.FileName, record.FileSizeBytes);
        else
            _logger.LogWarning("Scheduled backup failed: {Error}", record.ErrorMessage);
    }
}
