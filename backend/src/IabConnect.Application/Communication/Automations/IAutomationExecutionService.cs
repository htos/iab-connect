namespace IabConnect.Application.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S2): evaluates every Active automation definition's trigger against current data,
/// resolves recipients (consent re-resolved at run time), sends each due recipient their templated
/// message exactly once (idempotent), and records an <c>AutomationExecution</c> with per-recipient
/// status. Invoked by the recurring <c>AutomationDispatchJob</c>.
/// </summary>
public interface IAutomationExecutionService
{
    /// <summary>Run one dispatch pass. Returns the number of messages sent across all definitions.</summary>
    Task<int> ExecuteDueAsync(CancellationToken cancellationToken = default);
}
