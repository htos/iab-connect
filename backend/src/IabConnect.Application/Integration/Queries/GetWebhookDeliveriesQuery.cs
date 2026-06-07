using IabConnect.Application.Common;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Queries;

/// <summary>
/// REQ-058 (E8-S4, AC-3/5): paged webhook delivery history (global, or filtered to one subscription).
/// The DTO carries metadata only — never the raw payload body or the signing secret.
/// </summary>
public sealed record GetWebhookDeliveriesQuery(Guid? SubscriptionId, int Page = 1, int PageSize = 20)
    : IRequest<PagedResult<WebhookDeliveryDto>>;

/// <summary>Metadata-only history projection (AC-5): no payload body, no secret.</summary>
public sealed record WebhookDeliveryDto(
    Guid Id,
    Guid SubscriptionId,
    string EventType,
    string TargetUrl,
    string Status,
    int AttemptCount,
    int? ResponseStatusCode,
    string? Error,
    DateTime CreatedAt,
    DateTime? LastAttemptAt,
    DateTime? NextRetryAt)
{
    public static WebhookDeliveryDto FromEntity(WebhookDelivery d) => new(
        d.Id, d.SubscriptionId, d.EventType, d.TargetUrl, d.Status.ToString(),
        d.AttemptCount, d.ResponseStatusCode, d.Error, d.CreatedAt, d.LastAttemptAt, d.NextRetryAt);
}

public sealed class GetWebhookDeliveriesQueryHandler
    : IRequestHandler<GetWebhookDeliveriesQuery, PagedResult<WebhookDeliveryDto>>
{
    private readonly IWebhookDeliveryRepository _repository;

    public GetWebhookDeliveriesQueryHandler(IWebhookDeliveryRepository repository) => _repository = repository;

    public async Task<PagedResult<WebhookDeliveryDto>> Handle(GetWebhookDeliveriesQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (items, total) = await _repository.GetPagedAsync(request.SubscriptionId, page, pageSize, ct);
        return new PagedResult<WebhookDeliveryDto>
        {
            Items = items.Select(WebhookDeliveryDto.FromEntity).ToList(),
            TotalCount = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
