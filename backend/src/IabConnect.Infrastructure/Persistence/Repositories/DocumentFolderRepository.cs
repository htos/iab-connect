using IabConnect.Domain.Documents;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class DocumentFolderRepository : IDocumentFolderRepository
{
    private readonly ApplicationDbContext _context;

    public DocumentFolderRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DocumentFolder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
    }

    public async Task<DocumentFolder?> GetByIdWithPermissionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders
            .Include(f => f.Permissions)
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentFolder>> GetRootFoldersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders
            .Include(f => f.Permissions)
            .Where(f => f.ParentFolderId == null)
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentFolder>> GetChildFoldersAsync(Guid parentId, CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders
            .Include(f => f.Permissions)
            .Where(f => f.ParentFolderId == parentId)
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentFolder>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders
            .Include(f => f.Permissions)
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentFolder>> GetAccessibleFoldersAsync(DocumentAccessRole userRole, CancellationToken cancellationToken = default)
    {
        if (userRole == DocumentAccessRole.Admin)
            return await GetAllAsync(cancellationToken);

        return await _context.DocumentFolders
            .Include(f => f.Permissions)
            .Where(f => f.Permissions.Any(p => p.Role == userRole || p.Role == DocumentAccessRole.Member))
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(DocumentFolder folder, CancellationToken cancellationToken = default)
    {
        await _context.DocumentFolders.AddAsync(folder, cancellationToken);
    }

    public void Update(DocumentFolder folder)
    {
        _context.DocumentFolders.Update(folder);
    }

    public void Remove(DocumentFolder folder)
    {
        _context.DocumentFolders.Remove(folder);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.DocumentFolders.AnyAsync(f => f.Id == id, cancellationToken);
    }

    public async Task<bool> HasDocumentsAsync(Guid folderId, CancellationToken cancellationToken = default)
    {
        return await _context.Documents.AnyAsync(d => d.FolderId == folderId, cancellationToken);
    }
}
