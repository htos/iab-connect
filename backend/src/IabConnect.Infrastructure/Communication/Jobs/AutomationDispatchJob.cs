using Hangfire;
using IabConnect.Application.Common;
using IabConnect.Application.Communication.Automations;
using IabConnect.Domain.Common;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Communication.Jobs;

/// <summary>
/// REQ-028 (E5-S2): Hangfire wrapper for the recurring automation dispatch pass. Mirrors
/// <c>VolunteerShiftReminderJob</c>: <see cref="DisableConcurrentExecutionAttribute"/> serialises
/// the job against itself (no overlapping passes), <see cref="AutomaticRetryAttribute"/> retries a
/// whole-run failure (the per-recipient idempotency makes the retry safe — AC-3), and the job
/// no-ops cleanly when <c>Module:communication</c> is disabled. The actual logic lives in
/// <see cref="IAutomationExecutionService"/> so it is unit-testable.
/// </summary>
public sealed class AutomationDispatchJob
{
    private readonly IAutomationExecutionService _service;
    private readonly IModuleSettingsService _moduleSettings;
    private readonly ILogger<AutomationDispatchJob> _logger;

    public AutomationDispatchJob(
        IAutomationExecutionService service,
        IModuleSettingsService moduleSettings,
        ILogger<AutomationDispatchJob> logger)
    {
        _service = service;
        _moduleSettings = moduleSettings;
        _logger = logger;
    }

    [DisableConcurrentExecution(timeoutInSeconds: 10 * 60)]
    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Dispatch Communication Automations")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // REQ-087 (E10): no automation messages go out while the Communication module is disabled.
        if (!await _moduleSettings.IsEnabledAsync(ModuleKeys.Communication, cancellationToken))
        {
            _logger.LogInformation("AutomationDispatchJob: skipped — the Communication module is disabled");
            return;
        }

        _logger.LogInformation("AutomationDispatchJob: starting execution");
        try
        {
            var sent = await _service.ExecuteDueAsync(cancellationToken);
            _logger.LogInformation("AutomationDispatchJob: completed — {Count} message(s) sent", sent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AutomationDispatchJob: failed");
            throw;
        }
    }
}
