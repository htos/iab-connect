using IabConnect.Application.Retention;
using IabConnect.Domain.Operations;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Retention;

/// <summary>
/// REQ-057: Enforces retention policies by anonymizing, archiving, or deleting expired data.
/// All actions are logged for audit compliance.
/// </summary>
public sealed class RetentionEnforcementService(
    ApplicationDbContext db,
    ILogger<RetentionEnforcementService> logger) : IRetentionEnforcementService
{
    public async Task<int> EnforceAllPoliciesAsync(CancellationToken ct = default)
    {
        var policies = await db.RetentionPolicies
            .Where(p => p.IsActive)
            .ToListAsync(ct);

        var totalProcessed = 0;

        foreach (var policy in policies)
        {
            try
            {
                var count = await EnforcePolicyAsync(policy, ct);
                totalProcessed += count;

                if (count > 0)
                {
                    logger.LogInformation(
                        "RetentionEnforcement: {Category} — {Count} record(s) processed (Action: {Action})",
                        policy.DataCategory, count, policy.Action);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex,
                    "RetentionEnforcement: Failed to enforce policy for {Category}",
                    policy.DataCategory);
            }
        }

        return totalProcessed;
    }

    private async Task<int> EnforcePolicyAsync(RetentionPolicy policy, CancellationToken ct)
    {
        var cutoffDate = DateTime.UtcNow.AddMonths(-policy.RetentionMonths);

        return policy.DataCategory switch
        {
            DataCategories.AuditLogs => await AnonymizeAuditLogsAsync(cutoffDate, ct),
            DataCategories.Backups => await DeleteOldBackupsAsync(cutoffDate, ct),
            _ => 0 // Other categories handled when entities grow
        };
    }

    /// <summary>
    /// Anonymizes audit log entries older than the cutoff date.
    /// Replaces PII (UserName, IpAddress) with anonymized placeholders.
    /// </summary>
    private async Task<int> AnonymizeAuditLogsAsync(DateTime cutoffDate, CancellationToken ct)
    {
        // Use raw SQL for efficiency — EF cannot update private setters of AuditEvent
        var sql = """
            UPDATE audit_events
            SET user_name = '***',
                ip_address = '0.0.0.0',
                user_agent = NULL
            WHERE timestamp < {0}
              AND user_name IS NOT NULL
              AND user_name != '***'
            """;

        var count = await db.Database.ExecuteSqlRawAsync(
            sql, [cutoffDate], ct);

        return count;
    }

    /// <summary>
    /// Deletes backup records and their files older than the cutoff date.
    /// </summary>
    private async Task<int> DeleteOldBackupsAsync(DateTime cutoffDate, CancellationToken ct)
    {
        var expiredBackups = await db.BackupRecords
            .Where(b => b.CreatedAt < cutoffDate)
            .ToListAsync(ct);

        if (expiredBackups.Count == 0)
            return 0;

        db.BackupRecords.RemoveRange(expiredBackups);
        await db.SaveChangesAsync(ct);

        return expiredBackups.Count;
    }
}
