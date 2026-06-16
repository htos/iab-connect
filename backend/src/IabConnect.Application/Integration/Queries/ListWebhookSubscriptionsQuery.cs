using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Queries;

/// <summary>REQ-058 (E8-S3, AC-1): list all webhook subscriptions for the admin surface. Never returns the secret.</summary>
public sealed record ListWebhookSubscriptionsQuery : IRequest<IReadOnlyList<WebhookSubscriptionDto>>;

public sealed class ListWebhookSubscriptionsQueryHandler
    : IRequestHandler<ListWebhookSubscriptionsQuery, IReadOnlyList<WebhookSubscriptionDto>>
{
    private readonly IWebhookSubscriptionRepository _repository;

    public ListWebhookSubscriptionsQueryHandler(IWebhookSubscriptionRepository repository)
        => _repository = repository;

    public async Task<IReadOnlyList<WebhookSubscriptionDto>> Handle(ListWebhookSubscriptionsQuery request, CancellationToken ct)
    {
        var subs = await _repository.GetAllAsync(ct);
        return subs.Select(WebhookSubscriptionDto.FromEntity).ToList();
    }
}
