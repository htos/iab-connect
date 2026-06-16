namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S1): Lifecycle status of an automation definition. Only <see cref="Active"/>
/// definitions are eligible for execution by the S2 dispatch engine — Draft / Paused / Disabled
/// never fire. Transitions are guarded by the domain methods on <see cref="AutomationDefinition"/>
/// (mirrors the <see cref="EmailCampaignStatus"/> guard pattern).
/// </summary>
public enum AutomationStatus
{
    /// <summary>Newly created; not yet eligible to fire. Structural edits allowed.</summary>
    Draft = 0,

    /// <summary>Live; the S2 dispatch engine evaluates its trigger each run.</summary>
    Active = 1,

    /// <summary>Temporarily suspended; not firing. Structural edits allowed; can be resumed.</summary>
    Paused = 2,

    /// <summary>Permanently switched off; not firing. Can be re-activated.</summary>
    Disabled = 3
}

/// <summary>
/// REQ-028 (E5-S1, DEC-2): the v1 trigger-type set. Each type is evaluable by the S2 dispatch
/// engine from existing data via a per-type evaluator (scheduled polling — there is no
/// domain-event bus; architecture L664 sanctions polling). Adding a trigger type = add an enum
/// member here + an evaluator in S2.
/// </summary>
public enum AutomationTriggerType
{
    /// <summary>A member's account/membership was created (welcome journey). No offset.</summary>
    MemberJoined = 0,

    /// <summary>An event starts in <c>OffsetDays</c> days (event-reminder journey). Time-relative.</summary>
    EventUpcoming = 1,

    /// <summary>A membership renewal is due in <c>OffsetDays</c> days (renewal journey). Time-relative.</summary>
    MembershipRenewalDue = 2,

    /// <summary>Fired manually by an operator (ad-hoc journey). No offset.</summary>
    Manual = 3,

    /// <summary>Fires on a fixed schedule each dispatch run while active. No offset.</summary>
    Scheduled = 4
}
