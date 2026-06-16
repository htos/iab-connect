namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S4): performs a single persisted webhook delivery (loaded by id). Invoked by the
/// Hangfire <c>WebhookDeliveryJob</c>; signs the body, POSTs it (SSRF-guarded, short timeout), and
/// records the outcome on the delivery row + the subscription failure policy. Rethrows on failure so
/// Hangfire's <c>[AutomaticRetry]</c> owns the backoff.
/// </summary>
public interface IWebhookDeliveryService
{
    Task DeliverAsync(Guid deliveryId, CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-058 (E8-S4): enqueues a one-off delivery job (Hangfire <c>BackgroundJob.Enqueue</c>). Abstracted
/// so the dispatch claim-before-send path is unit-testable without Hangfire storage.
/// </summary>
public interface IWebhookDeliveryEnqueuer
{
    void Enqueue(Guid deliveryId);
}
