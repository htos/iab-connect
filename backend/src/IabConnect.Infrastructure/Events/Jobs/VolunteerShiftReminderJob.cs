using Hangfire;
using IabConnect.Application.Events.Jobs;
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
    private readonly ILogger<VolunteerShiftReminderJob> _logger;

    public VolunteerShiftReminderJob(
        IVolunteerShiftReminderService service,
        ILogger<VolunteerShiftReminderJob> logger)
    {
        _service = service;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Send Volunteer Shift Reminders")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
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
