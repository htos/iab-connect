using IabConnect.Domain.Common;

namespace IabConnect.Domain.Documents;

/// <summary>
/// Permission entry for a document folder
/// REQ-035: Dokumentrechte per Ordner
/// </summary>
public sealed class FolderPermission : Entity
{
    public Guid FolderId { get; private set; }
    public DocumentAccessRole Role { get; private set; }
    public DocumentPermissionType PermissionType { get; private set; }

    private FolderPermission() : base() { }

    public static FolderPermission Create(
        Guid folderId,
        DocumentAccessRole role,
        DocumentPermissionType permissionType)
    {
        return new FolderPermission
        {
            FolderId = folderId,
            Role = role,
            PermissionType = permissionType
        };
    }

    public void UpdatePermission(DocumentPermissionType permissionType)
    {
        PermissionType = permissionType;
    }
}
