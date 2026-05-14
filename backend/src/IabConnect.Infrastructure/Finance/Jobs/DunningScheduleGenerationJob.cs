using Hangfire;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Common;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// Hangfire wrapper for the DunningScheduleGeneration background job.
/// Runs weekly. Idempotent and safe to retry.
/// </summary>
public sealed class DunningScheduleGenerationJob
{
    private readonly IDunningScheduleService _service;
    private readonly IModuleSettingsService _moduleSettings;
    private readonly ILogger<DunningScheduleGenerationJob> _logger;

    public DunningScheduleGenerationJob(
        IDunningScheduleService service,
        IModuleSettingsService moduleSettings,
        ILogger<DunningScheduleGenerationJob> logger)
    {
        _service = service;
        _moduleSettings = moduleSettings;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Generate Dunning Notices")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // REQ-087 (E10-S5): no dunning notices generated (and no dunning emails) while the
        // Finance module is disabled — the job no-ops cleanly instead of failing.
        if (!await _moduleSettings.IsEnabledAsync(ModuleKeys.Finance, cancellationToken))
        {
            _logger.LogInformation(
                "DunningScheduleGenerationJob: skipped — the Finance module is disabled");
            return;
        }

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
