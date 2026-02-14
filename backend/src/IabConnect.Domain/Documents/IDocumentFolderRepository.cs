namespace IabConnect.Domain.Documents;

/// <summary>
/// Repository interface for DocumentFolder aggregate
/// </summary>
public interface IDocumentFolderRepository
{
    Task<DocumentFolder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DocumentFolder?> GetByIdWithPermissionsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DocumentFolder>> GetRootFoldersAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DocumentFolder>> GetChildFoldersAsync(Guid parentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DocumentFolder>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DocumentFolder>> GetAccessibleFoldersAsync(DocumentAccessRole userRole, CancellationToken cancellationToken = default);
    Task AddAsync(DocumentFolder folder, CancellationToken cancellationToken = default);
    void Update(DocumentFolder folder);
    void Remove(DocumentFolder folder);
    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> HasDocumentsAsync(Guid folderId, CancellationToken cancellationToken = default);
}
