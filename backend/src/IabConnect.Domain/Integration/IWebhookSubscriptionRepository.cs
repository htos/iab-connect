namespace IabConnect.Domain.Integration;

/// <summary>
/// REQ-058 (E8-S3): repository for <see cref="WebhookSubscription"/>.
/// <see cref="GetActiveForEventTypeAsync"/> is the dispatch fan-out lookup (active subscriptions
/// whose whitelist includes the emitted event type).
/// </summary>
public interface IWebhookSubscriptionRepository
{
    Task<WebhookSubscription?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WebhookSubscription>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>Active subscriptions subscribed to <paramref name="eventType"/> — the dispatch fan-out set.</summary>
    Task<IReadOnlyList<WebhookSubscription>> GetActiveForEventTypeAsync(string eventType, CancellationToken cancellationToken = default);

    Task AddAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default);

    Task UpdateAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default);

    Task DeleteAsync(WebhookSubscription subscription, CancellationToken cancellationToken = default);
}
