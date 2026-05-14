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
        // REQ-024 (E3.S4 Round-3 R3-H-S4-1): the window-boundary timestamp uses the batch-start
        // clock so the GetRemindersDueAsync filter is consistent for the whole pass, but the
        // per-row audit-stamp (MarkReminderSentAsync) is now captured per-row immediately before
        // each mark — see the loop body below. Previously the per-row stamp reused the batch
        // capture, so a pass sending 200 reminders over 10 minutes recorded every row as "sent
        // at 09:00", losing audit fidelity.
        var batchStartUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var windowEnd = batchStartUtc + WindowSize;

        var due = await _assignments.GetRemindersDueAsync(batchStartUtc, windowEnd, cancellationToken);
        if (due.Count == 0)
        {
            _logger.LogInformation("Volunteer shift reminder pass: no rows in the next {WindowHours}h window", WindowSize.TotalHours);
            return 0;
        }

        var sent = 0;
        var skipped = 0;
        // R4-P-S4-4: count rows where the email was dispatched but MarkReminderSentAsync returned
        // false (the row was already marked by a concurrent pass). With DisableConcurrentExecution
        // now on the job this should stay 0, but surfacing it in the summary keeps a visible signal
        // if a duplicate-send ever slips through (e.g. a within-pass AutomaticRetry).
        var duplicateSends = 0;
        try
        {
            foreach (var row in due)
            {
                // Per-row guard: a single bad recipient must not stop the rest of the batch.
                try
                {
                    // REQ-024 (E3.S4 Round-3 R3-M-S4-5): member-status filter — Inactive and
                    // merged members must not receive reminders. The DB-side filter in
                    // GetRemindersDueAsync is preferred for performance but the in-memory check
                    // is the defense-in-depth guard so a future repository change can't silently
                    // re-enable reminders to retired-or-merged members.
                    var member = await _members.GetByIdAsync(row.Assignment.MemberId, cancellationToken);
                    if (member is null)
                    {
                        _logger.LogWarning(
                            "Volunteer reminder skipped: Member {MemberId} not found for assignment {AssignmentId}",
                            row.Assignment.MemberId, row.Assignment.Id);
                        skipped++;
                        continue;
                    }
                    if (member.Status != MembershipStatus.Active || member.MergedIntoMemberId.HasValue)
                    {
                        _logger.LogInformation(
                            "Volunteer reminder skipped: Member {MemberId} is not Active (Status={MemberStatus}, MergedIntoMemberId={MergedInto}); assignment {AssignmentId}",
                            member.Id, member.Status, member.MergedIntoMemberId, row.Assignment.Id);
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

                    // REQ-024 (E3.S4 Round-3 R3-H-S4-1): per-row clock sample so the audit
                    // timestamp reflects WHEN this specific row was sent, not the batch start.
                    // A 200-row pass over 10 minutes now records 200 distinct timestamps spread
                    // across the run instead of every row claiming the same start-of-batch tick.
                    var rowSentAtUtc = _timeProvider.GetUtcNow().UtcDateTime;
                    var marked = await _assignments.MarkReminderSentAsync(row.Assignment.Id, rowSentAtUtc, cancellationToken);
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
                        // R4-P-S4-4: also count it so the summary log surfaces the incident
                        // instead of silently under-reporting (the email DID go out).
                        duplicateSends++;
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
        }
        finally
        {
            // REQ-024 (E3.S4 Round-3 R3-M-S4-3): emit the summary in a finally block so partial
            // progress is recorded when an OperationCanceledException trips mid-batch. Without
            // this, a Hangfire job that's stopped mid-run leaves no breadcrumb of how many
            // reminders were dispatched before the cancel.
            _logger.LogInformation(
                "Volunteer shift reminder pass complete: {SentCount} sent, {SkippedCount} skipped, {DuplicateSendCount} duplicate-send(s), out of {DueCount} due",
                sent, skipped, duplicateSends, due.Count);
        }
        return sent;
    }
}
