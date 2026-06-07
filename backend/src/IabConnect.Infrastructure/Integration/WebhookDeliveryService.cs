using System.Net.Http.Headers;
using System.Text;
using IabConnect.Application.Integration;
using IabConnect.Domain.Integration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S4): performs a single persisted webhook delivery. Loads the Pending row, skips a
/// paused/disabled subscription, SSRF-guards the target, signs the body (S3 signature), POSTs via the
/// named <c>"webhooks"</c> HttpClient, and records the outcome on both the delivery row and the
/// subscription failure policy. On a transport/HTTP failure it rethrows so Hangfire
/// <c>[AutomaticRetry]</c> owns the backoff. Logs carry metadata only — never the body or secret (AC-5).
/// </summary>
public sealed class WebhookDeliveryService : IWebhookDeliveryService
{
    public const string HttpClientName = "webhooks";

    private readonly IWebhookDeliveryRepository _deliveries;
    private readonly IWebhookSubscriptionRepository _subscriptions;
    private readonly IWebhookSecretService _secretService;
    private readonly IWebhookSignatureService _signatureService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly WebhookDeliveryOptions _options;
    private readonly ILogger<WebhookDeliveryService> _logger;

    public WebhookDeliveryService(
        IWebhookDeliveryRepository deliveries,
        IWebhookSubscriptionRepository subscriptions,
        IWebhookSecretService secretService,
        IWebhookSignatureService signatureService,
        IHttpClientFactory httpClientFactory,
        IOptions<WebhookDeliveryOptions> options,
        ILogger<WebhookDeliveryService> logger)
    {
        _deliveries = deliveries;
        _subscriptions = subscriptions;
        _secretService = secretService;
        _signatureService = signatureService;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task DeliverAsync(Guid deliveryId, CancellationToken cancellationToken = default)
    {
        var delivery = await _deliveries.GetByIdAsync(deliveryId, cancellationToken);
        if (delivery is null || delivery.Status == WebhookDeliveryStatus.Delivered)
            return; // nothing to do / already delivered (idempotent retry guard)

        var subscription = await _subscriptions.GetByIdAsync(delivery.SubscriptionId, cancellationToken);
        if (subscription is null || subscription.Status != WebhookSubscriptionStatus.Active)
        {
            delivery.MarkFailed(null, "Subscription is not active; delivery skipped.", null);
            await _deliveries.UpdateAsync(delivery, cancellationToken);
            return; // do not retry — the subscription was paused/disabled
        }

        delivery.BeginAttempt();

        if (!Uri.TryCreate(delivery.TargetUrl, UriKind.Absolute, out var uri)
            || await SsrfGuard.IsBlockedAsync(uri, cancellationToken))
        {
            delivery.MarkFailed(null, "Target URL is blocked by the SSRF guard.", null);
            subscription.RecordFailure(_options.PauseThreshold);
            await _deliveries.UpdateAsync(delivery, cancellationToken);
            await _subscriptions.UpdateAsync(subscription, cancellationToken);
            _logger.LogWarning("Webhook delivery {DeliveryId} blocked by SSRF guard.", delivery.Id);
            return; // do not retry a blocked target
        }

        try
        {
            var secret = _secretService.Reveal(subscription.SecretCipher);
            var signature = _signatureService.Sign(secret, delivery.Payload);

            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var content = new StringContent(delivery.Payload, Encoding.UTF8, "application/json");
            content.Headers.Add(IWebhookSignatureService.HeaderName, signature);
            content.Headers.Add("X-Webhook-Event", delivery.EventType);

            using var response = await client.PostAsync(uri, content, cancellationToken);
            var statusCode = (int)response.StatusCode;

            if (response.IsSuccessStatusCode)
            {
                delivery.MarkDelivered(statusCode);
                subscription.RecordSuccess();
                await _deliveries.UpdateAsync(delivery, cancellationToken);
                await _subscriptions.UpdateAsync(subscription, cancellationToken);
                return;
            }

            delivery.MarkFailed(statusCode, $"Receiver returned HTTP {statusCode}.", null);
            subscription.RecordFailure(_options.PauseThreshold);
            await _deliveries.UpdateAsync(delivery, cancellationToken);
            await _subscriptions.UpdateAsync(subscription, cancellationToken);
            _logger.LogWarning("Webhook delivery {DeliveryId} failed: HTTP {StatusCode}.", delivery.Id, statusCode);
            throw new WebhookDeliveryException($"Webhook delivery {delivery.Id} failed with HTTP {statusCode}.");
        }
        catch (WebhookDeliveryException)
        {
            throw; // already recorded above; rethrow for Hangfire retry
        }
        catch (Exception ex)
        {
            delivery.MarkFailed(null, ex.Message, null);
            subscription.RecordFailure(_options.PauseThreshold);
            await _deliveries.UpdateAsync(delivery, cancellationToken);
            await _subscriptions.UpdateAsync(subscription, cancellationToken);
            _logger.LogWarning("Webhook delivery {DeliveryId} failed: {Reason}.", delivery.Id, ex.GetType().Name);
            throw; // rethrow for Hangfire [AutomaticRetry]
        }
    }
}

/// <summary>REQ-058 (E8-S4): marks a non-2xx delivery so Hangfire retries (after the row is recorded).</summary>
public sealed class WebhookDeliveryException : Exception
{
    public WebhookDeliveryException(string message) : base(message) { }
}
