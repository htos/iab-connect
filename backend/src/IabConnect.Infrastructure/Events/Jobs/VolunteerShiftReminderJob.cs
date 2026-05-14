using Hangfire;
using IabConnect.Application.Common;
using IabConnect.Application.Events.Jobs;
using IabConnect.Domain.Common;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Events.Jobs;

/// <summary>
/// REQ-024 (E3.S4): Hangfire wrapper for the daily volunteer-shift reminder pass.
/// Mirrors the DunningScheduleGenerationJob shape. The actual logic lives in
/// <see cref="IVolunteerShiftReminderService"/> so it's unit-testable.
/// </summary>
public sealed class VolunteerShiftReminderJob
{
    private readonly IVolunteerShiftReminderService _service;
    private readonly IModuleSettingsService _moduleSettings;
    private readonly ILogger<VolunteerShiftReminderJob> _logger;

    public VolunteerShiftReminderJob(
        IVolunteerShiftReminderService service,
        IModuleSettingsService moduleSettings,
        ILogger<VolunteerShiftReminderJob> logger)
    {
        _service = service;
        _moduleSettings = moduleSettings;
        _logger = logger;
    }

    // R4-P-S4-4: DisableConcurrentExecution serialises this job against itself. The reminder
    // service sends each email BEFORE marking the row sent, so two overlapping passes (the daily
    // trigger overlapping an AutomaticRetry of a slow previous run, or a manual re-trigger) would
    // duplicate-mail every in-window recipient. The distributed lock makes the overlap window
    // impossible; the 10-minute timeout is well above the expected pass duration, after which a
    // genuinely stuck run is abandoned rather than blocking forever.
    [DisableConcurrentExecution(timeoutInSeconds: 10 * 60)]
    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Send Volunteer Shift Reminders")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // REQ-087 (E10-S5): no volunteer-shift reminder emails go out while the Events
        // module is disabled — the job no-ops cleanly instead of failing.
        if (!await _moduleSettings.IsEnabledAsync(ModuleKeys.Events, cancellationToken))
        {
            _logger.LogInformation(
                "VolunteerShiftReminderJob: skipped — the Events module is disabled");
            return;
        }

        _logger.LogInformation("VolunteerShiftReminderJob: starting execution");
        try
        {
            var count = await _service.ExecuteAsync(cancellationToken);
            _logger.LogInformation("VolunteerShiftReminderJob: completed — {Count} reminder(s) sent", count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "VolunteerShiftReminderJob: failed");
            throw;
        }
    }
}
