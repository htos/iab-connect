namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S3): the write-path dispatch seam. Triggered by a direct, post-commit, best-effort
/// call from the originating write path (there is no domain-event bus — DEC-1 = A). It resolves the
/// active subscriptions for <paramref name="eventType"/> and hands each off for out-of-band delivery;
/// it MUST NOT perform the HTTP POST inline, and MUST NEVER throw back into / roll back the
/// originating event/payment write.
///
/// <para>E8-S3 defines this seam (resolve + sign); E8-S4 fills it with persisted delivery records +
/// retрying background delivery. Callers (the event/payment write paths) stay unchanged across S3→S4.</para>
/// </summary>
public interface IWebhookDispatchService
{
    /// <summary>
    /// Emits an event to all active subscriptions for <paramref name="eventType"/>. The
    /// <paramref name="payload"/> must be integration-safe (ids + non-sensitive fields, no PII).
    /// </summary>
    Task EmitAsync(string eventType, object payload, CancellationToken cancellationToken = default);
}
