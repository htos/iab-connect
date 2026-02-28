namespace IabConnect.Domain.Common;

/// <summary>
/// REQ-070: Interface for entities that support revision-safe archival.
/// Swiss OR Art. 958f requires 10-year retention of financial documents.
/// </summary>
public interface IArchivable
{
    bool IsArchived { get; }
    DateTimeOffset? ArchivedAt { get; }
    string? ArchivedBy { get; }
    string? ArchiveReason { get; }
    DateTimeOffset RetainUntil { get; }

    /// <summary>
    /// Archives the entity, making it read-only.
    /// </summary>
    void Archive(string archivedBy, string reason, DateTimeOffset retainUntil);

    /// <summary>
    /// Restores the entity from archive (Admin only).
    /// </summary>
    void Restore(string restoredBy);
}
