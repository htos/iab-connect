using IabConnect.Domain.Integration;

namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S1): the admin list/detail view of a credential. Exposes scopes + status +
/// <see cref="LastUsedAt"/> but <b>never</b> the secret or its hash.
/// </summary>
public sealed record ApiClientDto(
    Guid Id,
    string Name,
    IReadOnlyCollection<string> Scopes,
    bool IsRevoked,
    DateTime CreatedAt,
    DateTime? RevokedAt,
    DateTime? LastUsedAt)
{
    public static ApiClientDto FromEntity(ApiClient client) => new(
        client.Id,
        client.Name,
        client.Scopes,
        client.IsRevoked,
        client.CreatedAt,
        client.RevokedAt,
        client.LastUsedAt);
}

/// <summary>
/// REQ-058 (E8-S1): the create/rotate response — the ONLY DTO that carries the one-time cleartext
/// <see cref="Secret"/>. Returned exactly once; the secret is unreadable thereafter.
/// </summary>
public sealed record ApiClientCreatedDto(
    Guid Id,
    string Name,
    IReadOnlyCollection<string> Scopes,
    string Secret,
    DateTime CreatedAt);
