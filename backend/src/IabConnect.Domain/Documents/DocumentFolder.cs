using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// Document folder tree node for organizing documents
/// REQ-034: Ordnerstruktur
/// </summary>
public sealed class DocumentFolder : AggregateRoot
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public Guid? ParentFolderId { get; private set; }
    public DocumentFolder? ParentFolder { get; private set; }
    public int SortOrder { get; private set; }

    private readonly List<DocumentFolder> _childFolders = [];
    public IReadOnlyList<DocumentFolder> ChildFolders => _childFolders.AsReadOnly();

    private readonly List<Document> _documents = [];
    public IReadOnlyList<Document> Documents => _documents.AsReadOnly();

    private readonly List<FolderPermission> _permissions = [];
    public IReadOnlyList<FolderPermission> Permissions => _permissions.AsReadOnly();

    private DocumentFolder() : base() { }

    public static DocumentFolder Create(
        string name,
        string? description = null,
        Guid? parentFolderId = null,
        int sortOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Folder name is required.", nameof(name));

        var folder = new DocumentFolder
        {
            Name = name.Trim(),
            Description = description?.Trim(),
            ParentFolderId = parentFolderId,
            SortOrder = sortOrder
        };

        folder.AddDomainEvent(new DocumentFolderCreatedEvent(folder.Id, name));
        return folder;
    }

    public void Update(string name, string? description = null, int? sortOrder = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Folder name is required.", nameof(name));

        Name = name.Trim();
        Description = description?.Trim();
        if (sortOrder.HasValue)
            SortOrder = sortOrder.Value;
        SetUpdated();
    }

    public void Move(Guid? newParentFolderId)
    {
        if (newParentFolderId == Id)
            throw new InvalidOperationException("A folder cannot be its own parent.");

        ParentFolderId = newParentFolderId;
        SetUpdated();
    }

    public void SetPermission(DocumentAccessRole role, DocumentPermissionType permissionType)
    {
        var existing = _permissions.FirstOrDefault(p => p.Role == role);
        if (existing != null)
        {
            existing.UpdatePermission(permissionType);
        }
        else
        {
            _permissions.Add(FolderPermission.Create(Id, role, permissionType));
        }
        SetUpdated();
    }

    public void RemovePermission(DocumentAccessRole role)
    {
        var existing = _permissions.FirstOrDefault(p => p.Role == role);
        if (existing != null)
        {
            _permissions.Remove(existing);
            SetUpdated();
        }
    }

    public bool HasAccess(DocumentAccessRole userRole, DocumentPermissionType requiredPermission)
    {
        // Admin always has access
        if (userRole == DocumentAccessRole.Admin)
            return true;

        var permission = _permissions.FirstOrDefault(p => p.Role == userRole);
        if (permission == null)
            return false;

        return permission.PermissionType >= requiredPermission;
    }
}
