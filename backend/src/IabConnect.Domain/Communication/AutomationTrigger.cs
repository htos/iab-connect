namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S1, DEC-2): the trigger bound to an <see cref="AutomationDefinition"/> — a
/// <see cref="AutomationTriggerType"/> plus its parameters. Modeled as an EF-owned value so the
/// S2 polling job can compute "is this trigger due for recipient X now" from a single owned
/// shape. The only parameter in v1 is <see cref="OffsetDays"/> for time-relative triggers
/// (<see cref="AutomationTriggerType.EventUpcoming"/> / <see cref="AutomationTriggerType.MembershipRenewalDue"/>).
/// </summary>
public sealed class AutomationTrigger
{
    public AutomationTriggerType Type { get; private set; }

    /// <summary>
    /// Offset in days for time-relative triggers (e.g. "7 days before the event starts").
    /// Null/ignored for non-time-relative triggers (MemberJoined / Manual / Scheduled).
    /// </summary>
    public int? OffsetDays { get; private set; }

    private AutomationTrigger() { } // EF Core

    private AutomationTrigger(AutomationTriggerType type, int? offsetDays)
    {
        Type = type;
        OffsetDays = offsetDays;
    }

    /// <summary>True when this trigger type computes its due-window from an offset-in-days.</summary>
    public static bool IsTimeRelative(AutomationTriggerType type)
        => type is AutomationTriggerType.EventUpcoming or AutomationTriggerType.MembershipRenewalDue;

    public bool IsTimeRelative() => IsTimeRelative(Type);

    /// <summary>
    /// Factory with the same invariant the validator enforces: time-relative triggers require a
    /// non-negative offset; the other types must not carry one. Throws <see cref="ArgumentException"/>
    /// on an inconsistent combination so an invalid trigger can never be constructed.
    /// </summary>
    public static AutomationTrigger Create(AutomationTriggerType type, int? offsetDays)
    {
        if (IsTimeRelative(type))
        {
            if (!offsetDays.HasValue || offsetDays.Value < 0)
                throw new ArgumentException(
                    $"Trigger type {type} requires a non-negative OffsetDays.", nameof(offsetDays));
            return new AutomationTrigger(type, offsetDays);
        }

        // Non-time-relative triggers carry no offset.
        return new AutomationTrigger(type, null);
    }
}
