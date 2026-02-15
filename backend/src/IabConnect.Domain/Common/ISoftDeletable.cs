namespace IabConnect.Domain.Common;

/// <summary>
/// Interface for entities that support soft deletion.
/// Finance data must not be hard-deleted per data retention policy (REQ-005).
/// </summary>
public interface ISoftDeletable
{
    bool IsDeleted { get; }
    DateTime? DeletedAt { get; }
}
