using IabConnect.Domain.Common;

namespace IabConnect.Domain.Integration;

/// <summary>
/// REQ-058 (E8-S1): a named external API credential. Authenticates external integrations to the
/// new external API (E8-S2) via a presented key, and limits what they may access through its
/// granted <see cref="Scopes"/>.
///
/// <para><b>Secret safety:</b> the raw secret is never stored on the entity — only its one-way
/// <see cref="SecretHash"/> (HMAC-SHA256(pepper, SHA256(secret)), the <c>Member.HashCalendarToken</c>
/// idiom) plus a non-secret <see cref="SecretPrefix"/> the auth handler uses to find the row without
/// scanning. The cleartext secret leaves the system exactly once — in the create/rotate response —
/// and is unreadable thereafter.</para>
/// </summary>
public sealed class ApiClient : Entity
{
    private readonly List<string> _scopes = [];

    public string Name { get; private set; } = string.Empty;

    /// <summary>Non-secret lookup id carried in the presented key (<c>iabc_{prefix}_{secret}</c>).</summary>
    public string SecretPrefix { get; private set; } = string.Empty;

    /// <summary>One-way hash of the raw secret — never the raw secret itself.</summary>
    public string SecretHash { get; private set; } = string.Empty;

    /// <summary>Granted scopes — a subset of <see cref="ApiScopes.All"/>.</summary>
    public IReadOnlyCollection<string> Scopes => _scopes.AsReadOnly();

    public bool IsRevoked { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? LastUsedAt { get; private set; }

    private ApiClient() { } // EF Core

    /// <summary>
    /// Factory — creates a new, non-revoked credential. The caller (an Infrastructure hashing
    /// service) generates the raw secret, derives <paramref name="secretPrefix"/> and
    /// <paramref name="secretHash"/>, and returns the cleartext to the user exactly once. Unknown
    /// scope strings are rejected (→ 400) so the closed <see cref="ApiScopes.All"/> set is enforced
    /// at the write boundary.
    /// </summary>
    public static ApiClient Create(
        string name,
        IEnumerable<string> scopes,
        string secretPrefix,
        string secretHash)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("API client name is required", nameof(name));
        if (string.IsNullOrWhiteSpace(secretPrefix))
            throw new ArgumentException("Secret prefix is required", nameof(secretPrefix));
        if (string.IsNullOrWhiteSpace(secretHash))
            throw new ArgumentException("Secret hash is required", nameof(secretHash));

        var scopeList = scopes?.Distinct().ToList() ?? [];
        var unknown = scopeList.Where(s => !ApiScopes.All.Contains(s)).ToList();
        if (unknown.Count > 0)
            throw new ArgumentException(
                $"Unknown API scope(s): {string.Join(", ", unknown)}. Valid scopes: {string.Join(", ", ApiScopes.All)}",
                nameof(scopes));

        var client = new ApiClient
        {
            Name = name.Trim(),
            SecretPrefix = secretPrefix,
            SecretHash = secretHash,
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };
        client._scopes.AddRange(scopeList);
        return client;
    }

    /// <summary>Revokes the credential so it can no longer authenticate. Idempotent-safe: throws if already revoked.</summary>
    public void Revoke()
    {
        if (IsRevoked)
            throw new InvalidOperationException("API client is already revoked.");
        IsRevoked = true;
        RevokedAt = DateTime.UtcNow;
    }

    /// <summary>Records a successful authentication timestamp (drives the admin "last used" column).</summary>
    public void RecordUse(DateTime usedAtUtc)
    {
        LastUsedAt = usedAtUtc;
    }
}
