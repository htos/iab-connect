namespace IabConnect.Domain.Integration;

/// <summary>
/// REQ-058 (E8-S1): repository for <see cref="ApiClient"/> credentials. <see cref="GetByPrefixAsync"/>
/// is the hot-path lookup the API-key authentication handler uses to find a candidate row by its
/// non-secret prefix before constant-time hash verification.
/// </summary>
public interface IApiClientRepository
{
    Task<ApiClient?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Finds a credential by its non-secret lookup prefix (auth hot path). Returns null if none.</summary>
    Task<ApiClient?> GetByPrefixAsync(string secretPrefix, CancellationToken cancellationToken = default);

    /// <summary>All credentials, newest first — the admin list surface.</summary>
    Task<IReadOnlyList<ApiClient>> GetAllAsync(CancellationToken cancellationToken = default);

    Task AddAsync(ApiClient client, CancellationToken cancellationToken = default);

    Task UpdateAsync(ApiClient client, CancellationToken cancellationToken = default);
}
