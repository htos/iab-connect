using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IabConnect.Application.Integration;
using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S3 seam, filled in E8-S4): the write-path dispatch service. For each active
/// subscription it persists a <see cref="WebhookDelivery"/> row as Pending — committing the claim +
/// the unique date-free <c>DedupKey</c> BEFORE the POST (claim-before-send, A66/A67) — then enqueues
/// a one-off Hangfire delivery job. It NEVER performs the HTTP POST inline and NEVER throws back into
/// the originating event/payment write (best-effort, out-of-band).
/// </summary>
public sealed class WebhookDispatchService : IWebhookDispatchService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IWebhookSubscriptionRepository _subscriptions;
    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IWebhookDeliveryEnqueuer _enqueuer;
    private readonly ILogger<WebhookDispatchService> _logger;

    public WebhookDispatchService(
        IWebhookSubscriptionRepository subscriptions,
        IWebhookDeliveryRepository deliveries,
        IWebhookDeliveryEnqueuer enqueuer,
        ILogger<WebhookDispatchService> logger)
    {
        _subscriptions = subscriptions;
        _deliveries = deliveries;
        _enqueuer = enqueuer;
        _logger = logger;
    }

    public async Task EmitAsync(string eventType, object payload, CancellationToken cancellationToken = default)
    {
        try
        {
            var subscriptions = await _subscriptions.GetActiveForEventTypeAsync(eventType, cancellationToken);
            if (subscriptions.Count == 0)
                return;

            var body = JsonSerializer.Serialize(payload, JsonOptions);
            var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();

            foreach (var subscription in subscriptions)
            {
                // Date-free dedup key (A67): same event → same subscription cannot be delivered twice.
                var dedupKey = $"{subscription.Id}|{eventType}|{payloadHash}";
                var delivery = WebhookDelivery.Pending(subscription.Id, eventType, subscription.TargetUrl, dedupKey, body);

                try
                {
                    // Claim-before-send (A66): commit the Pending row + unique key BEFORE enqueueing.
                    await _deliveries.AddAsync(delivery, cancellationToken);
                }
                catch (DbUpdateException)
                {
                    // Unique-key collision → this event was already claimed for this subscription. Abandon.
                    _logger.LogDebug("Webhook delivery already claimed for subscription {SubscriptionId}, event '{EventType}' — skipping duplicate.",
                        subscription.Id, eventType);
                    continue;
                }

                _enqueuer.Enqueue(delivery.Id);
            }
        }
        catch (Exception ex)
        {
            // Best-effort: never propagate into the originating write path.
            _logger.LogError(ex, "Webhook dispatch for event type '{EventType}' failed (originating write is unaffected).", eventType);
        }
    }
}
