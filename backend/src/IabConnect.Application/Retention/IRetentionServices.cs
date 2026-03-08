using IabConnect.Domain.Operations;

namespace IabConnect.Application.Retention;

/// <summary>
/// REQ-057: Retention policy service interface.
/// </summary>
public interface IRetentionPolicyService
{
    Task<List<RetentionPolicy>> GetAllPoliciesAsync(CancellationToken ct = default);
    Task<RetentionPolicy?> GetPolicyByIdAsync(Guid id, CancellationToken ct = default);
    Task<RetentionPolicy?> GetPolicyByCategoryAsync(string dataCategory, CancellationToken ct = default);
    Task<RetentionPolicy> CreatePolicyAsync(RetentionPolicy policy, CancellationToken ct = default);
    Task<RetentionPolicy> UpdatePolicyAsync(RetentionPolicy policy, CancellationToken ct = default);
    Task SeedDefaultPoliciesAsync(CancellationToken ct = default);
}

/// <summary>
/// REQ-057: Retention enforcement service — runs scheduled cleanup/archival.
/// </summary>
public interface IRetentionEnforcementService
{
    /// <summary>
    /// Enforces all active retention policies. Returns number of records processed.
    /// </summary>
    Task<int> EnforceAllPoliciesAsync(CancellationToken ct = default);
}
