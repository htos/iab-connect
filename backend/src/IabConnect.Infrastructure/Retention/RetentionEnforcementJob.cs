using Hangfire;
using IabConnect.Application.Retention;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Retention;

/// <summary>
/// REQ-057: Hangfire recurring job that enforces retention policies.
/// Runs weekly. Idempotent and safe to retry.
/// </summary>
public sealed class RetentionEnforcementJob(
    IRetentionEnforcementService enforcementService,
    ILogger<RetentionEnforcementJob> logger)
{
    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Enforce Retention Policies")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("RetentionEnforcementJob: Starting execution");

        try
        {
            var count = await enforcementService.EnforceAllPoliciesAsync(cancellationToken);
            logger.LogInformation(
                "RetentionEnforcementJob: Completed — {Count} record(s) processed", count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "RetentionEnforcementJob: Failed");
            throw; // let Hangfire retry
        }
    }
}
