namespace IabConnect.Domain.Documents;

/// <summary>
/// Repository interface for Document aggregate
/// REQ-034, REQ-035, REQ-036, REQ-037
/// </summary>
public interface IDocumentRepository
{
    Task<Document?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Document?> GetByIdWithVersionsAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Document> Items, int TotalCount)> GetPagedAsync(
        DocumentFilterOptions filter,
        CancellationToken cancellationToken = default);

    Task AddAsync(Document document, CancellationToken cancellationToken = default);
    void Update(Document document);
    void Remove(Document document);

    Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>REQ-037: Get all distinct tags</summary>
    Task<IReadOnlyList<string>> GetAllTagsAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Filter options for document queries
/// </summary>
public class DocumentFilterOptions
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? SearchTerm { get; set; }
    public Guid? FolderId { get; set; }
    public DocumentCategory? Category { get; set; }
    public DocumentStatus? Status { get; set; }
    public List<string>? Tags { get; set; }
    public DocumentAccessRole? UserRole { get; set; }
    public bool IncludeExpired { get; set; } = false;
}
