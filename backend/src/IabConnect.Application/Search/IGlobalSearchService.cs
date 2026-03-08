namespace IabConnect.Application.Search;

/// <summary>
/// REQ-052: Global search service abstraction.
/// Performs full-text search across multiple entity tables using PostgreSQL tsvector/tsquery.
/// </summary>
public interface IGlobalSearchService
{
    /// <summary>
    /// Search across all or specific modules.
    /// </summary>
    /// <param name="query">User search term (min 2 chars)</param>
    /// <param name="scope">Module scope filter (all, members, events, documents, invoices, sponsors, blog)</param>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Results per page</param>
    /// <param name="ct">Cancellation token</param>
    Task<GlobalSearchResult> SearchAsync(string query, string scope, int page, int pageSize, CancellationToken ct = default);
}
