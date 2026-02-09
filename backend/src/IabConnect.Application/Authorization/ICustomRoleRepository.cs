using IabConnect.Domain.Authorization;

namespace IabConnect.Application.Authorization;

/// <summary>
/// Repository interface for custom roles (REQ-003, REQ-059)
/// </summary>
public interface ICustomRoleRepository
{
    /// <summary>
    /// Get all custom roles
    /// </summary>
    Task<List<CustomRole>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all active custom roles
    /// </summary>
    Task<List<CustomRole>> GetActiveAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a custom role by ID
    /// </summary>
    Task<CustomRole?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a custom role by name
    /// </summary>
    Task<CustomRole?> GetByNameAsync(string name, CancellationToken cancellationToken = default);

    /// <summary>
    /// Add a new custom role
    /// </summary>
    Task AddAsync(CustomRole customRole, CancellationToken cancellationToken = default);

    /// <summary>
    /// Update an existing custom role
    /// </summary>
    void Update(CustomRole customRole);

    /// <summary>
    /// Delete a custom role
    /// </summary>
    void Delete(CustomRole customRole);
}
