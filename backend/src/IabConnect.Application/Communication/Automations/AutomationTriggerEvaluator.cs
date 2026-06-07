using IabConnect.Domain.Communication;

namespace IabConnect.Application.Communication.Automations;

/// <summary>REQ-028 (E5-S2): a recipient that is due for a trigger occurrence, with its deterministic key.</summary>
public sealed record DueOccurrence(ResolvedRecipient Recipient, string IdempotencyKey);

/// <summary>
/// REQ-028 (E5-S2, DEC-2): pure, per-trigger-type evaluator that turns a definition + its resolved
/// recipient set into the set of due occurrences (each with a deterministic idempotency key). No DB
/// access — fully unit-testable per trigger type.
///
/// <para><b>v1 granularity (documented):</b> occurrences are evaluated at recipient granularity.
/// <c>MemberJoined</c>, <c>EventUpcoming</c> and <c>MembershipRenewalDue</c> fire <b>once ever per
/// recipient</b> (the idempotency key carries no date, so an Active definition does not re-send on
/// subsequent polls); <c>Scheduled</c> fires once per run-day (its key carries the date by design);
/// <c>Manual</c> is never auto-fired by polling. <c>OffsetDays</c> is retained as definition metadata
/// (and surfaced in the UI label) but the v1 engine does <b>not</b> bind the time-relative triggers
/// to specific event/renewal records — that binding is a tracked future enhancement (E5-FT). Until
/// then a time-relative definition behaves as a one-time broadcast to its resolved segment, never a
/// daily resend.</para>
/// </summary>
public sealed class AutomationTriggerEvaluator
{
    public IReadOnlyList<DueOccurrence> ComputeDueOccurrences(
        AutomationDefinition definition,
        IReadOnlyList<ResolvedRecipient> recipients,
        DateTime nowUtc)
    {
        var type = definition.Trigger.Type;

        // Manual triggers are not auto-evaluated by the polling job.
        if (type == AutomationTriggerType.Manual)
            return [];

        var result = new List<DueOccurrence>(recipients.Count);
        foreach (var r in recipients)
        {
            var key = BuildKey(definition, type, r, nowUtc);
            if (key is not null)
                result.Add(new DueOccurrence(r, key));
        }
        return result;
    }

    private static string? BuildKey(
        AutomationDefinition definition, AutomationTriggerType type, ResolvedRecipient r, DateTime nowUtc)
    {
        var rk = RecipientKey(r);
        return type switch
        {
            // Fire once ever per recipient — the key carries no date, so an Active definition does
            // NOT re-send on subsequent polls. (v1: time-relative triggers are one-time broadcasts;
            // binding them to specific event/renewal records is a tracked follow-up — E5-FT.)
            AutomationTriggerType.MemberJoined => $"{definition.Id}|MemberJoined|{rk}",
            AutomationTriggerType.EventUpcoming => $"{definition.Id}|EventUpcoming|{rk}",
            AutomationTriggerType.MembershipRenewalDue => $"{definition.Id}|MembershipRenewalDue|{rk}",

            // Fires once per run-day per recipient (its date in the key is by design).
            AutomationTriggerType.Scheduled => $"{definition.Id}|Scheduled|{rk}|{nowUtc:yyyy-MM-dd}",

            _ => null
        };
    }

    /// <summary>Stable per-recipient identity for the key: Keycloak user id, else member id, else email.</summary>
    public static string RecipientKey(ResolvedRecipient r)
        => r.UserId?.ToString() ?? r.MemberId?.ToString() ?? r.Email.ToLowerInvariant();
}
