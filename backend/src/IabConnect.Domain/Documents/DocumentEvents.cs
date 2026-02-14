using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// Domain events for document operations
/// </summary>
public record DocumentCreatedEvent(Guid DocumentId, string Name) : DomainEvent;

public record DocumentStatusChangedEvent(
    Guid DocumentId,
    DocumentStatus OldStatus,
    DocumentStatus NewStatus) : DomainEvent;

public record DocumentFolderCreatedEvent(Guid FolderId, string Name) : DomainEvent;
