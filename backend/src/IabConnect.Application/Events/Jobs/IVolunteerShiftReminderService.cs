namespace IabConnect.Application.Events.Jobs;

/// <summary>
/// REQ-024 (E3.S4): Service that drives the daily volunteer-shift reminder send.
/// The Hangfire wrapper in Infrastructure delegates to <see cref="ExecuteAsync"/>;
/// the count return supports the operational summary log line.
/// </summary>
public interface IVolunteerShiftReminderService
{
    /// <summary>
    /// Runs one pass of the reminder logic. Returns the count of reminders successfully sent.
    /// </summary>
    Task<int> ExecuteAsync(CancellationToken cancellationToken = default);
}
