namespace IabConnect.Domain.Integration;

/// <summary>REQ-058 (E8-S4): repository for <see cref="WebhookDelivery"/> history rows.</summary>
public interface IWebhookDeliveryRepository
{
    Task<WebhookDelivery?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Most recent deliveries for one subscription, newest first.</summary>
    Task<IReadOnlyList<WebhookDelivery>> GetRecentForSubscriptionAsync(Guid subscriptionId, int limit, CancellationToken cancellationToken = default);

    /// <summary>Paged global (or per-subscription) delivery history, newest first.</summary>
    Task<(IReadOnlyList<WebhookDelivery> Items, int TotalCount)> GetPagedAsync(
        Guid? subscriptionId, int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>Persists a Pending row (the claim). Throws on a duplicate <c>DedupKey</c> (unique index).</summary>
    Task AddAsync(WebhookDelivery delivery, CancellationToken cancellationToken = default);

    Task UpdateAsync(WebhookDelivery delivery, CancellationToken cancellationToken = default);
}
