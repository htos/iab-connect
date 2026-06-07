using IabConnect.Domain.Integration;

namespace IabConnect.Application.Integration;

/// <summary>REQ-058 (E8-S3): admin list/detail view of a webhook subscription. Never carries the secret.</summary>
public sealed record WebhookSubscriptionDto(
    Guid Id,
    string Name,
    string TargetUrl,
    IReadOnlyCollection<string> EventTypes,
    string Status,
    DateTime CreatedAt,
    DateTime? UpdatedAt)
{
    public static WebhookSubscriptionDto FromEntity(WebhookSubscription s) => new(
        s.Id,
        s.Name,
        s.TargetUrl,
        s.EventTypes,
        s.Status.ToString(),
        s.CreatedAt,
        s.UpdatedAt);
}

/// <summary>REQ-058 (E8-S3, AC-4): create/rotate response — the ONLY shape carrying the one-time cleartext signing secret.</summary>
public sealed record WebhookSubscriptionCreatedDto(
    Guid Id,
    string Name,
    string TargetUrl,
    IReadOnlyCollection<string> EventTypes,
    string Secret,
    DateTime CreatedAt);
