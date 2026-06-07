namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S2): persistence for automation dispatch runs + the idempotency pre-check.
/// </summary>
public interface IAutomationExecutionRepository
{
    /// <summary>True if an <see cref="AutomationRecipient"/> with this idempotency key already exists
    /// (the common-case duplicate guard; the unique index is the structural backstop).</summary>
    Task<bool> RecipientKeyExistsAsync(string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>The subset of the given keys that already exist (batched pre-check).</summary>
    Task<IReadOnlyCollection<string>> ExistingRecipientKeysAsync(
        IReadOnlyCollection<string> idempotencyKeys, CancellationToken cancellationToken = default);

    Task AddAsync(AutomationExecution execution, CancellationToken cancellationToken = default);

    /// <summary>Persist mutations to an already-tracked execution + its recipients (e.g. after marking sends).</summary>
    Task UpdateAsync(AutomationExecution execution, CancellationToken cancellationToken = default);

    /// <summary>Recent executions for a definition (most recent first) — S3's recent-execution panel.</summary>
    Task<IReadOnlyList<AutomationExecution>> GetRecentForDefinitionAsync(
        Guid definitionId, int limit = 10, CancellationToken cancellationToken = default);
}
