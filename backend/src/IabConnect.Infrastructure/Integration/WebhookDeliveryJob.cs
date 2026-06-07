using Hangfire;
using IabConnect.Application.Integration;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S4, AC-1/2): Hangfire one-off delivery job (enqueued per delivery by the dispatch
/// service). Thin wrapper templated on <c>AutomationDispatchJob</c>: <c>[AutomaticRetry(5)]</c> owns
/// the retry backoff; <b>no</b> <c>[DisableConcurrentExecution]</c> — independent per-delivery jobs
/// must run in parallel (concurrency is bounded by the delivery row's claim, not the job).
/// </summary>
public sealed class WebhookDeliveryJob
{
    private readonly IWebhookDeliveryService _service;

    public WebhookDeliveryJob(IWebhookDeliveryService service) => _service = service;

    [AutomaticRetry(Attempts = 5)]
    [JobDisplayName("Deliver webhook {0}")]
    public Task ExecuteAsync(Guid deliveryId, CancellationToken ct) => _service.DeliverAsync(deliveryId, ct);
}

/// <summary>REQ-058 (E8-S4): enqueues the one-off delivery job via Hangfire (no recurring job → A44 stays at 7).</summary>
public sealed class WebhookDeliveryEnqueuer : IWebhookDeliveryEnqueuer
{
    public void Enqueue(Guid deliveryId)
        => BackgroundJob.Enqueue<WebhookDeliveryJob>(j => j.ExecuteAsync(deliveryId, CancellationToken.None));
}
