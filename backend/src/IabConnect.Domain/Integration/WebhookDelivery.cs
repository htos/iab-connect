using IabConnect.Domain.Common;

namespace IabConnect.Domain.Integration;

/// <summary>REQ-058 (E8-S4): delivery lifecycle state.</summary>
public enum WebhookDeliveryStatus
{
    Pending,
    Delivered,
    Failed
}

/// <summary>
/// REQ-058 (E8-S4): a persisted webhook-delivery attempt record — the unit of the claim-before-send
/// idempotency model (A66) and the admin delivery history (AC-2/3).
///
/// <para><see cref="DedupKey"/> is date-free (A67: <c>subscriptionId|eventType|payloadHash</c>) and
/// uniquely indexed, so re-emitting the same event to the same subscription cannot create a duplicate
/// delivery. The row is persisted <see cref="WebhookDeliveryStatus.Pending"/> (committing the claim)
/// BEFORE the HTTP POST is enqueued.</para>
///
/// <para><see cref="Payload"/> holds the full body the job signs + sends; the history projection
/// omits it (AC-5 — metadata only, never the body or the secret in logs/UI).</para>
/// </summary>
public sealed class WebhookDelivery : Entity
{
    public Guid SubscriptionId { get; private set; }
    public string EventType { get; private set; } = string.Empty;

    /// <summary>Snapshot of the target URL at claim time (history "target" column).</summary>
    public string TargetUrl { get; private set; } = string.Empty;

    /// <summary>Date-free idempotency key; uniquely indexed.</summary>
    public string DedupKey { get; private set; } = string.Empty;

    /// <summary>Full JSON body to sign + POST. Omitted from the history projection (AC-5).</summary>
    public string Payload { get; private set; } = string.Empty;

    public WebhookDeliveryStatus Status { get; private set; } = WebhookDeliveryStatus.Pending;
    public int AttemptCount { get; private set; }
    public int? ResponseStatusCode { get; private set; }
    public string? Error { get; private set; }
    public DateTime? NextRetryAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastAttemptAt { get; private set; }

    private WebhookDelivery() { } // EF Core

    public static WebhookDelivery Pending(
        Guid subscriptionId, string eventType, string targetUrl, string dedupKey, string payload)
    {
        return new WebhookDelivery
        {
            SubscriptionId = subscriptionId,
            EventType = eventType,
            TargetUrl = targetUrl,
            DedupKey = dedupKey,
            Payload = payload,
            Status = WebhookDeliveryStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>Records the start of a delivery attempt (increments the counter + stamps the time).</summary>
    public void BeginAttempt()
    {
        AttemptCount++;
        LastAttemptAt = DateTime.UtcNow;
    }

    public void MarkDelivered(int statusCode)
    {
        Status = WebhookDeliveryStatus.Delivered;
        ResponseStatusCode = statusCode;
        Error = null;
        NextRetryAt = null;
    }

    public void MarkFailed(int? statusCode, string error, DateTime? nextRetryAt)
    {
        Status = WebhookDeliveryStatus.Failed;
        ResponseStatusCode = statusCode;
        Error = error.Length > 1000 ? error[..1000] : error;
        NextRetryAt = nextRetryAt;
    }
}
