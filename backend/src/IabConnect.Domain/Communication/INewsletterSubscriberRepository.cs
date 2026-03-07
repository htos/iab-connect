namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-029: Repository for external newsletter subscribers
/// </summary>
public interface INewsletterSubscriberRepository
{
    Task<NewsletterSubscriber?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<IReadOnlyList<NewsletterSubscriber>> GetActiveSubscribersAsync(CancellationToken ct = default);
    Task AddAsync(NewsletterSubscriber subscriber, CancellationToken ct = default);
    Task UpdateAsync(NewsletterSubscriber subscriber, CancellationToken ct = default);
}
