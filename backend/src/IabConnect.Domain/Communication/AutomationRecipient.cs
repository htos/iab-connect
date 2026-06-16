using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-028 (E5-S2): one resolved recipient within an <see cref="AutomationExecution"/>. Mirrors
/// <see cref="EmailRecipient"/> (per-recipient status + timestamp + error). The
/// <see cref="IdempotencyKey"/> is globally unique (enforced by a unique index) — it is the
/// structural guard that makes a duplicate send for the same (definition, trigger-occurrence,
/// recipient) impossible across retries / overlapping runs (AC-3).
/// </summary>
public sealed class AutomationRecipient : Entity
{
    public Guid ExecutionId { get; private set; }

    /// <summary>Keycloak user id (null for members without a linked account).</summary>
    public Guid? UserId { get; private set; }

    /// <summary>Domain member id (null for non-member recipients).</summary>
    public Guid? MemberId { get; private set; }

    public string Email { get; private set; } = string.Empty;
    public string? FirstName { get; private set; }
    public string? LastName { get; private set; }

    public AutomationRecipientStatus Status { get; private set; }

    /// <summary>
    /// Deterministic per-(definition, trigger-occurrence, recipient) key — globally unique
    /// (DEC-2). Two dispatch attempts for the same occurrence produce the same key, so the second
    /// insert collides with the unique index.
    /// </summary>
    public string IdempotencyKey { get; private set; } = string.Empty;

    public DateTime? SentAt { get; private set; }
    public string? ErrorMessage { get; private set; }

    private AutomationRecipient() { } // EF Core

    private AutomationRecipient(
        Guid executionId, string idempotencyKey, Guid? userId, Guid? memberId,
        string email, string? firstName, string? lastName,
        AutomationRecipientStatus status, DateTime? sentAt, string? errorMessage)
    {
        ExecutionId = executionId;
        IdempotencyKey = idempotencyKey;
        UserId = userId;
        MemberId = memberId;
        Email = email;
        FirstName = firstName;
        LastName = lastName;
        Status = status;
        SentAt = sentAt;
        ErrorMessage = errorMessage;
    }

    /// <summary>
    /// REQ-028 (E5-S2, AC-3): create the recipient in <see cref="AutomationRecipientStatus.Pending"/>
    /// — the durable idempotency CLAIM. It is persisted (committing the unique key) BEFORE the send,
    /// so a crash mid-batch leaves the key on record and a retry's pre-check skips it rather than
    /// re-sending (at-most-once). The send then transitions it via <see cref="MarkSent"/>/<see cref="MarkFailed"/>.
    /// </summary>
    public static AutomationRecipient Pending(
        Guid executionId, string idempotencyKey, Guid? userId, Guid? memberId,
        string email, string? firstName, string? lastName)
        => new(executionId, idempotencyKey, userId, memberId, email, firstName, lastName,
            AutomationRecipientStatus.Pending, null, null);

    public static AutomationRecipient Sent(
        Guid executionId, string idempotencyKey, Guid? userId, Guid? memberId,
        string email, string? firstName, string? lastName, DateTime sentAtUtc)
        => new(executionId, idempotencyKey, userId, memberId, email, firstName, lastName,
            AutomationRecipientStatus.Sent, sentAtUtc, null);

    public static AutomationRecipient Failed(
        Guid executionId, string idempotencyKey, Guid? userId, Guid? memberId,
        string email, string? firstName, string? lastName, string errorMessage)
        => new(executionId, idempotencyKey, userId, memberId, email, firstName, lastName,
            AutomationRecipientStatus.Failed, null, errorMessage);

    public static AutomationRecipient Skipped(
        Guid executionId, string idempotencyKey, Guid? userId, Guid? memberId,
        string email, string? firstName, string? lastName, string reason)
        => new(executionId, idempotencyKey, userId, memberId, email, firstName, lastName,
            AutomationRecipientStatus.Skipped, null, reason);

    public void MarkSent(DateTime sentAtUtc)
    {
        Status = AutomationRecipientStatus.Sent;
        SentAt = sentAtUtc;
        ErrorMessage = null;
    }

    public void MarkFailed(string errorMessage)
    {
        Status = AutomationRecipientStatus.Failed;
        ErrorMessage = errorMessage;
    }

    public void MarkSkipped(string reason)
    {
        Status = AutomationRecipientStatus.Skipped;
        ErrorMessage = reason;
    }
}
