using IabConnect.Domain.Documents;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class DocumentRepository : IDocumentRepository
{
    private readonly ApplicationDbContext _context;

    public DocumentRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Document?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Documents
            .Include(d => d.Tags)
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
    }

    public async Task<Document?> GetByIdWithVersionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Documents
            .Include(d => d.Versions)
            .Include(d => d.Tags)
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
    }

    public async Task<(IReadOnlyList<Document> Items, int TotalCount)> GetPagedAsync(
        DocumentFilterOptions filter,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Documents
            .Include(d => d.Tags)
            .AsQueryable();

        // Filter by folder
        if (filter.FolderId.HasValue)
            query = query.Where(d => d.FolderId == filter.FolderId.Value);

        // Filter by category
        if (filter.Category.HasValue)
            query = query.Where(d => d.Category == filter.Category.Value);

        // Filter by status
        if (filter.Status.HasValue)
            query = query.Where(d => d.Status == filter.Status.Value);

        // Filter by user role visibility
        if (filter.UserRole.HasValue && filter.UserRole.Value == DocumentAccessRole.Member)
        {
            query = query.Where(d => d.Status == DocumentStatus.Published);
            if (!filter.IncludeExpired)
                query = query.Where(d => d.ExpiresAt == null || d.ExpiresAt > DateTime.UtcNow);

            // REQ-035: Only show documents in folders where the member has at least Read permission
            query = query.Where(d =>
                _context.FolderPermissions.Any(p =>
                    p.FolderId == d.FolderId &&
                    (p.Role == DocumentAccessRole.Member) &&
                    p.PermissionType >= DocumentPermissionType.Read));
        }
        else if (filter.UserRole.HasValue && filter.UserRole.Value == DocumentAccessRole.Vorstand)
        {
            // Vorstand: show documents in folders where Vorstand or Member has access
            query = query.Where(d =>
                _context.FolderPermissions.Any(p =>
                    p.FolderId == d.FolderId &&
                    (p.Role == DocumentAccessRole.Member || p.Role == DocumentAccessRole.Vorstand) &&
                    p.PermissionType >= DocumentPermissionType.Read));
        }
        // Admin sees everything — no folder filter needed

        // Search term (name, description)
        if (!string.IsNullOrWhiteSpace(filter.SearchTerm))
        {
            var term = filter.SearchTerm.ToLower();
            query = query.Where(d =>
                d.Name.ToLower().Contains(term) ||
                (d.Description != null && d.Description.ToLower().Contains(term)));
        }

        // Filter by tags
        if (filter.Tags is { Count: > 0 })
        {
            var normalizedTags = filter.Tags.Select(t => t.ToLowerInvariant()).ToList();
            query = query.Where(d => d.Tags.Any(t => normalizedTags.Contains(t.Name)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((filter.Page - 1) * filter.PageSize)
            .Take(filter.PageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task AddAsync(Document document, CancellationToken cancellationToken = default)
    {
        await _context.Documents.AddAsync(document, cancellationToken);
    }

    public void Update(Document document)
    {
        _context.Documents.Update(document);
    }

    public void Remove(Document document)
    {
        _context.Documents.Remove(document);
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Documents.AnyAsync(d => d.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetAllTagsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Set<DocumentTag>()
            .Select(t => t.Name)
            .Distinct()
            .OrderBy(t => t)
            .ToListAsync(cancellationToken);
    }
}
