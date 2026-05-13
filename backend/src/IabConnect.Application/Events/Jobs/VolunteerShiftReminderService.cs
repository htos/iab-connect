using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Microsoft.Extensions.Logging;

namespace IabConnect.Application.Events.Jobs;

/// <summary>
/// REQ-024 (E3.S4): Selects volunteers whose shift starts in the next 36h and whose reminder
/// has not yet been sent, then dispatches the bilingual reminder email via
/// <see cref="IEventNotificationService"/>. Idempotent — relies on <c>ReminderSentAt</c> being
/// set by <see cref="IEventVolunteerAssignmentRepository.MarkReminderSentAsync"/> after each
/// successful send.
/// </summary>
public sealed class VolunteerShiftReminderService : IVolunteerShiftReminderService
{
    /// <summary>
    /// REQ-024 (E3.S4 review H-S4-4): The recurring job runs daily at 09:00 Europe/Zurich, so
    /// a 24h window would miss shifts that start between 09:01 and 23:59 of the following day.
    /// 36h ensures the next-day-evening shifts are reminded on the morning of the day before.
    /// </summary>
    private static readonly TimeSpan WindowSize = TimeSpan.FromHours(36);

    private readonly IEventVolunteerAssignmentRepository _assignments;
    private readonly IEventNotificationService _notifications;
    private readonly IMemberRepository _members;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<VolunteerShiftReminderService> _logger;

    public VolunteerShiftReminderService(
        IEventVolunteerAssignmentRepository assignments,
        IEventNotificationService notifications,
        IMemberRepository members,
        TimeProvider timeProvider,
        ILogger<VolunteerShiftReminderService> logger)
    {
        _assignments = assignments;
        _notifications = notifications;
        _members = members;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var windowEnd = nowUtc + WindowSize;

        var due = await _assignments.GetRemindersDueAsync(nowUtc, windowEnd, cancellationToken);
        if (due.Count == 0)
        {
            _logger.LogInformation("Volunteer shift reminder pass: no rows in the next {WindowHours}h window", WindowSize.TotalHours);
            return 0;
        }

        var sent = 0;
        var skipped = 0;
        foreach (var row in due)
        {
            // Per-row guard: a single bad recipient must not stop the rest of the batch.
            try
            {
                var member = await _members.GetByIdAsync(row.Assignment.MemberId, cancellationToken);
                if (member is null)
                {
                    _logger.LogWarning(
                        "Volunteer reminder skipped: Member {MemberId} not found for assignment {AssignmentId}",
                        row.Assignment.MemberId, row.Assignment.Id);
                    skipped++;
                    continue;
                }

                // REQ-024 (E3.S4 review H-S4-6): a null / empty email would throw inside the
                // SMTP layer; that throw is now propagated up by the notification service, which
                // would correctly NOT mark the row as sent — but every daily run would retry
                // the same broken row forever. Skip with a LogWarning AND leave ReminderSentAt
                // null so the row resurfaces if the operator fixes Member.Email.
                if (string.IsNullOrWhiteSpace(member.Email))
                {
                    _logger.LogWarning(
                        "Volunteer reminder skipped: Member {MemberId} has no email address (assignment {AssignmentId})",
                        member.Id, row.Assignment.Id);
                    skipped++;
                    continue;
                }

                // REQ-024 (E3.S4 review C2 + H-S4-1): the notification service is now strict —
                // it throws on SMTP failure instead of swallowing. We mark the row as sent ONLY
                // after a successful send so a transient outage is retried on the next run.
                await _notifications.SendVolunteerShiftReminderAsync(
                    row.Assignment, row.Shift, row.Role, row.Event, member, cancellationToken);

                var marked = await _assignments.MarkReminderSentAsync(row.Assignment.Id, nowUtc, cancellationToken);
                if (marked)
                {
                    sent++;
                }
                else
                {
                    // REQ-024 (E3.S4 review M-S4-1): a false return means the row was already
                    // marked (concurrent run / Hangfire retry) — the recipient may now have
                    // received a duplicate email. Log it loudly so ops can dedupe and tighten
                    // the cron-overlap guard if it keeps happening.
                    _logger.LogWarning(
                        "Volunteer reminder marked-sent returned no rows for assignment {AssignmentId}; possible duplicate-send",
                        row.Assignment.Id);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex,
                    "Volunteer reminder send failed for assignment {AssignmentId}; continuing with the rest",
                    row.Assignment.Id);
            }
        }

        _logger.LogInformation(
            "Volunteer shift reminder pass complete: {SentCount} sent, {SkippedCount} skipped, out of {DueCount} due",
            sent, skipped, due.Count);
        return sent;
    }
}
