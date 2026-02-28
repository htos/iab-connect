using Hangfire;
using IabConnect.Application.Finance.Jobs;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// Hangfire wrapper for the DunningScheduleGeneration background job.
/// Runs weekly. Idempotent and safe to retry.
/// </summary>
public sealed class DunningScheduleGenerationJob
{
    private readonly IDunningScheduleService _service;
    private readonly ILogger<DunningScheduleGenerationJob> _logger;

    public DunningScheduleGenerationJob(
        IDunningScheduleService service,
        ILogger<DunningScheduleGenerationJob> logger)
    {
        _service = service;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Generate Dunning Notices")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("DunningScheduleGenerationJob: Starting execution");

        try
        {
            var count = await _service.ExecuteAsync(cancellationToken);
            _logger.LogInformation("DunningScheduleGenerationJob: Completed — {Count} notice(s) created", count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DunningScheduleGenerationJob: Failed");
            throw; // let Hangfire retry
        }
    }
}
