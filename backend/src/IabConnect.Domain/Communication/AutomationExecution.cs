using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S2): one dispatch run for an <see cref="AutomationDefinition"/>. Mirrors
/// <see cref="EmailCampaign"/>'s execution/statistics shape: status + started/completed timestamps
/// + roll-up counts, with one <see cref="AutomationRecipient"/> per recipient handled in the run.
/// These rows are the data S3's recent-execution panel reads.
/// </summary>
public sealed class AutomationExecution : Entity
{
    public Guid DefinitionId { get; private set; }

    public AutomationExecutionStatus Status { get; private set; } = AutomationExecutionStatus.Running;

    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }

    public int TotalRecipients { get; private set; }
    public int SentCount { get; private set; }
    public int FailedCount { get; private set; }
    public int SkippedCount { get; private set; }

    private readonly List<AutomationRecipient> _recipients = [];
    public IReadOnlyList<AutomationRecipient> Recipients => _recipients.AsReadOnly();

    private AutomationExecution() { } // EF Core

    public static AutomationExecution Start(Guid definitionId) => new()
    {
        DefinitionId = definitionId,
        Status = AutomationExecutionStatus.Running,
        StartedAt = DateTime.UtcNow
    };

    public void AddRecipient(AutomationRecipient recipient)
    {
        _recipients.Add(recipient);
    }

    /// <summary>Roll up the per-recipient outcomes and mark the run Completed.</summary>
    public void Complete()
    {
        TotalRecipients = _recipients.Count;
        SentCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Sent);
        FailedCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Failed);
        SkippedCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Skipped);
        Status = AutomationExecutionStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }

    /// <summary>Mark the whole run Failed (an infrastructure error; Hangfire will retry).</summary>
    public void Fail()
    {
        TotalRecipients = _recipients.Count;
        SentCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Sent);
        FailedCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Failed);
        SkippedCount = _recipients.Count(r => r.Status == AutomationRecipientStatus.Skipped);
        Status = AutomationExecutionStatus.Failed;
        CompletedAt = DateTime.UtcNow;
    }
}
