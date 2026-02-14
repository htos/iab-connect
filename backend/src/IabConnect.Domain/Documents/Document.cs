using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// Document aggregate root with metadata, status workflow, and versioning
/// REQ-034, REQ-035, REQ-036, REQ-037
/// </summary>
public sealed class Document : AggregateRoot
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public DocumentCategory Category { get; private set; }
    public DocumentStatus Status { get; private set; }
    public Guid FolderId { get; private set; }
    public DocumentFolder? Folder { get; private set; }
    public string ContentType { get; private set; } = null!;
    public long FileSize { get; private set; }
    public DateTime? ExpiresAt { get; private set; }
    public Guid? ReviewedBy { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public Guid? PublishedBy { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    private readonly List<DocumentVersion> _versions = [];
    public IReadOnlyList<DocumentVersion> Versions => _versions.AsReadOnly();

    private readonly List<DocumentTag> _tags = [];
    public IReadOnlyList<DocumentTag> Tags => _tags.AsReadOnly();

    private Document() : base() { }

    public static Document Create(
        string name,
        Guid folderId,
        string contentType,
        long fileSize,
        DocumentCategory category = DocumentCategory.General,
        string? description = null,
        DateTime? expiresAt = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Document name is required.", nameof(name));
        if (fileSize <= 0)
            throw new ArgumentException("File size must be positive.", nameof(fileSize));

        var document = new Document
        {
            Name = name.Trim(),
            Description = description?.Trim(),
            Category = category,
            Status = DocumentStatus.Draft,
            FolderId = folderId,
            ContentType = contentType,
            FileSize = fileSize,
            ExpiresAt = expiresAt
        };

        document.AddDomainEvent(new DocumentCreatedEvent(document.Id, name));
        return document;
    }

    public void UpdateMetadata(
        string name,
        DocumentCategory category,
        string? description = null,
        DateTime? expiresAt = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Document name is required.", nameof(name));

        Name = name.Trim();
        Category = category;
        Description = description?.Trim();
        ExpiresAt = expiresAt;
        SetUpdated();
    }

    public void MoveToFolder(Guid folderId)
    {
        FolderId = folderId;
        SetUpdated();
    }

    // REQ-035: Workflow status transitions
    public void SubmitForReview()
    {
        if (Status != DocumentStatus.Draft)
            throw new InvalidOperationException($"Cannot submit for review: document is in '{Status}' status.");

        Status = DocumentStatus.Reviewed;
        AddDomainEvent(new DocumentStatusChangedEvent(Id, DocumentStatus.Draft, DocumentStatus.Reviewed));
    }

    public void Review(Guid reviewerId)
    {
        if (Status != DocumentStatus.Draft)
            throw new InvalidOperationException($"Cannot review: document is in '{Status}' status.");

        Status = DocumentStatus.Reviewed;
        ReviewedBy = reviewerId;
        ReviewedAt = DateTime.UtcNow;
        SetUpdated();
        AddDomainEvent(new DocumentStatusChangedEvent(Id, DocumentStatus.Draft, DocumentStatus.Reviewed));
    }

    public void Publish(Guid publisherId)
    {
        if (Status != DocumentStatus.Reviewed && Status != DocumentStatus.Draft)
            throw new InvalidOperationException($"Cannot publish: document is in '{Status}' status.");

        var oldStatus = Status;
        Status = DocumentStatus.Published;
        PublishedBy = publisherId;
        PublishedAt = DateTime.UtcNow;
        SetUpdated();
        AddDomainEvent(new DocumentStatusChangedEvent(Id, oldStatus, DocumentStatus.Published));
    }

    public void Archive()
    {
        if (Status == DocumentStatus.Archived)
            return;

        var oldStatus = Status;
        Status = DocumentStatus.Archived;
        SetUpdated();
        AddDomainEvent(new DocumentStatusChangedEvent(Id, oldStatus, DocumentStatus.Archived));
    }

    public void UnArchive()
    {
        if (Status != DocumentStatus.Archived)
            throw new InvalidOperationException("Document is not archived.");

        Status = DocumentStatus.Draft;
        SetUpdated();
    }

    // REQ-036: Versioning
    public DocumentVersion AddVersion(string storageKey, long fileSize, string contentType, string? comment = null)
    {
        var nextVersionNumber = _versions.Count > 0 ? _versions.Max(v => v.VersionNumber) + 1 : 1;

        var version = DocumentVersion.Create(
            Id,
            nextVersionNumber,
            storageKey,
            fileSize,
            contentType,
            comment);

        _versions.Add(version);
        FileSize = fileSize;
        ContentType = contentType;
        SetUpdated();

        return version;
    }

    public DocumentVersion? GetLatestVersion()
    {
        return _versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();
    }

    public DocumentVersion? GetVersion(int versionNumber)
    {
        return _versions.FirstOrDefault(v => v.VersionNumber == versionNumber);
    }

    /// <summary>
    /// REQ-036: Restore creates a new version from an old version's storage key
    /// </summary>
    public DocumentVersion RestoreVersion(int versionNumber, string newStorageKey, long fileSize, string contentType)
    {
        var oldVersion = GetVersion(versionNumber)
            ?? throw new InvalidOperationException($"Version {versionNumber} not found.");

        return AddVersion(newStorageKey, fileSize, contentType, $"Restored from version {versionNumber}");
    }

    // REQ-037: Tags
    public void AddTag(string tagName)
    {
        if (string.IsNullOrWhiteSpace(tagName))
            throw new ArgumentException("Tag name is required.", nameof(tagName));

        var normalizedTag = tagName.Trim().ToLowerInvariant();

        if (_tags.Any(t => t.Name == normalizedTag))
            return;

        _tags.Add(DocumentTag.Create(Id, normalizedTag));
        SetUpdated();
    }

    public void RemoveTag(string tagName)
    {
        var normalizedTag = tagName.Trim().ToLowerInvariant();
        var tag = _tags.FirstOrDefault(t => t.Name == normalizedTag);
        if (tag != null)
        {
            _tags.Remove(tag);
            SetUpdated();
        }
    }

    public void SetTags(IEnumerable<string> tagNames)
    {
        _tags.Clear();
        foreach (var tagName in tagNames)
        {
            AddTag(tagName);
        }
    }

    public bool IsExpired => ExpiresAt.HasValue && ExpiresAt.Value < DateTime.UtcNow;

    public bool IsVisibleTo(DocumentAccessRole userRole)
    {
        // Admins and Vorstand can see all statuses
        if (userRole == DocumentAccessRole.Admin || userRole == DocumentAccessRole.Vorstand)
            return true;

        // Members can only see published, non-expired documents
        return Status == DocumentStatus.Published && !IsExpired;
    }
}
