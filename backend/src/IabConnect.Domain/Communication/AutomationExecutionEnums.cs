namespace IabConnect.Domain.Communication;

/// <summary>REQ-028 (E5-S2): status of a single automation dispatch run.</summary>
public enum AutomationExecutionStatus
{
    /// <summary>The run is in progress.</summary>
    Running = 0,

    /// <summary>The run finished (some recipients may have failed — see FailedCount).</summary>
    Completed = 1,

    /// <summary>The run hit a whole-run infrastructure failure and threw (Hangfire retries).</summary>
    Failed = 2
}

/// <summary>REQ-028 (E5-S2): per-recipient outcome within a dispatch run. Mirrors <see cref="EmailRecipientStatus"/>.</summary>
public enum AutomationRecipientStatus
{
    /// <summary>Created, not yet sent.</summary>
    Pending = 0,

    /// <summary>Sent successfully.</summary>
    Sent = 1,

    /// <summary>Send threw — recorded with the error message; the batch continued.</summary>
    Failed = 2,

    /// <summary>Skipped (e.g. no email / consent revoked between resolution and send).</summary>
    Skipped = 3
}
