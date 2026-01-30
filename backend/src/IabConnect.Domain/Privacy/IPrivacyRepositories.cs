namespace IabConnect.Domain.Privacy;

/// <summary>
/// Repository interface for consent management (REQ-012: DSGVO)
/// </summary>
public interface IConsentRepository
{
    /// <summary>
    /// Get all consents for a user
    /// </summary>
    Task<IReadOnlyList<Consent>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Get a specific consent for a user
    /// </summary>
    Task<Consent?> GetByUserAndTypeAsync(Guid userId, ConsentType type, CancellationToken ct = default);

    /// <summary>
    /// Add a new consent record
    /// </summary>
    Task AddAsync(Consent consent, CancellationToken ct = default);

    /// <summary>
    /// Update an existing consent record
    /// </summary>
    Task UpdateAsync(Consent consent, CancellationToken ct = default);

    /// <summary>
    /// Check if user has granted a specific consent
    /// </summary>
    Task<bool> HasConsentAsync(Guid userId, ConsentType type, CancellationToken ct = default);

    /// <summary>
    /// Get all users who have granted a specific consent type (for newsletter, etc.)
    /// </summary>
    Task<IReadOnlyList<Guid>> GetUsersWithConsentAsync(ConsentType type, CancellationToken ct = default);
}

/// <summary>
/// Repository interface for deletion requests (REQ-012: DSGVO)
/// </summary>
public interface IDeletionRequestRepository
{
    /// <summary>
    /// Get deletion request by ID
    /// </summary>
    Task<DeletionRequest?> GetByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Get all deletion requests for a user
    /// </summary>
    Task<IReadOnlyList<DeletionRequest>> GetByUserIdAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Get active deletion request for a user (pending or confirmed)
    /// </summary>
    Task<DeletionRequest?> GetActiveByUserIdAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Get all deletion requests with a specific status
    /// </summary>
    Task<IReadOnlyList<DeletionRequest>> GetByStatusAsync(DeletionRequestStatus status, CancellationToken ct = default);

    /// <summary>
    /// Get deletion request by confirmation token
    /// </summary>
    Task<DeletionRequest?> GetByTokenAsync(string token, CancellationToken ct = default);

    /// <summary>
    /// Add a new deletion request
    /// </summary>
    Task AddAsync(DeletionRequest request, CancellationToken ct = default);

    /// <summary>
    /// Update an existing deletion request
    /// </summary>
    Task UpdateAsync(DeletionRequest request, CancellationToken ct = default);
}
