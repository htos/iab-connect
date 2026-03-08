using IabConnect.Application.Search;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Search;

/// <summary>
/// REQ-052: Global search implementation using PostgreSQL full-text search (tsvector/tsquery).
/// Performs ILIKE search across all configured entity tables and aggregates results.
/// </summary>
public sealed class PostgresGlobalSearchService(ApplicationDbContext db) : IGlobalSearchService
{
    private static readonly HashSet<string> ValidScopes = new(StringComparer.OrdinalIgnoreCase)
    {
        "all", "members", "events", "documents", "invoices", "sponsors", "blog"
    };

    public async Task<GlobalSearchResult> SearchAsync(
        string query, string scope, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        if (!ValidScopes.Contains(scope))
            scope = "all";

        var searchPattern = $"%{EscapeLikePattern(query)}%";
        var allResults = new List<SearchResultItem>();
        var countsByScope = new Dictionary<string, int>();

        var scopeSearchers = new Dictionary<string, Func<string, CancellationToken, Task<List<SearchResultItem>>>>
        {
            ["members"] = SearchMembersAsync,
            ["events"] = SearchEventsAsync,
            ["documents"] = SearchDocumentsAsync,
            ["invoices"] = SearchInvoicesAsync,
            ["sponsors"] = SearchSponsorsAsync,
            ["blog"] = SearchBlogAsync
        };

        if (scope == "all")
        {
            // Search all scopes sequentially — DbContext is not thread-safe
            foreach (var kvp in scopeSearchers)
            {
                var results = await kvp.Value(searchPattern, ct);
                allResults.AddRange(results);
                countsByScope[kvp.Key] = results.Count;
            }
        }
        else if (scopeSearchers.TryGetValue(scope, out var searcher))
        {
            var results = await searcher(searchPattern, ct);
            allResults.AddRange(results);
            countsByScope[scope] = results.Count;
        }

        // Sort by relevance (exact match > starts-with > contains)
        var normalizedQuery = query.ToLowerInvariant();
        var sorted = allResults
            .Select(r => (Item: r, Score: CalculateRelevance(r.Title, r.Subtitle, normalizedQuery)))
            .OrderByDescending(x => x.Score)
            .Select(x => x.Item with { Relevance = x.Score })
            .ToList();

        var totalCount = sorted.Count;
        var pagedItems = sorted
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new GlobalSearchResult
        {
            Items = pagedItems,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            CountsByScope = countsByScope
        };
    }

    private async Task<List<SearchResultItem>> SearchMembersAsync(string pattern, CancellationToken ct)
    {
        return await db.Members
            .Where(m => EF.Functions.ILike(m.FirstName + " " + m.LastName, pattern)
                     || EF.Functions.ILike(m.Email, pattern)
                     || (m.Phone != null && EF.Functions.ILike(m.Phone, pattern)))
            .Select(m => new SearchResultItem
            {
                Scope = "members",
                Id = m.Id,
                Title = m.FirstName + " " + m.LastName,
                Subtitle = m.Email,
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchEventsAsync(string pattern, CancellationToken ct)
    {
        return await db.Events
            .Where(e => EF.Functions.ILike(e.Title, pattern)
                     || EF.Functions.ILike(e.Description, pattern)
                     || EF.Functions.ILike(e.Location, pattern))
            .Select(e => new SearchResultItem
            {
                Scope = "events",
                Id = e.Id,
                Title = e.Title,
                Subtitle = e.Location + " · " + e.StartDate.ToString("dd.MM.yyyy"),
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchDocumentsAsync(string pattern, CancellationToken ct)
    {
        return await db.Documents
            .Where(d => EF.Functions.ILike(d.Name, pattern)
                     || (d.Description != null && EF.Functions.ILike(d.Description, pattern)))
            .Select(d => new SearchResultItem
            {
                Scope = "documents",
                Id = d.Id,
                Title = d.Name,
                Subtitle = d.Description,
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchInvoicesAsync(string pattern, CancellationToken ct)
    {
        return await db.Invoices
            .Where(i => EF.Functions.ILike(i.InvoiceNumber, pattern)
                     || EF.Functions.ILike(i.RecipientName, pattern)
                     || (i.Notes != null && EF.Functions.ILike(i.Notes, pattern)))
            .Select(i => new SearchResultItem
            {
                Scope = "invoices",
                Id = i.Id,
                Title = i.InvoiceNumber + " – " + i.RecipientName,
                Subtitle = i.Status.ToString() + " · " + i.Total.ToString("N2"),
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchSponsorsAsync(string pattern, CancellationToken ct)
    {
        return await db.Sponsors
            .Where(s => EF.Functions.ILike(s.CompanyName, pattern)
                     || (s.ContactPerson != null && EF.Functions.ILike(s.ContactPerson, pattern))
                     || (s.Email != null && EF.Functions.ILike(s.Email, pattern)))
            .Select(s => new SearchResultItem
            {
                Scope = "sponsors",
                Id = s.Id,
                Title = s.CompanyName,
                Subtitle = s.ContactPerson,
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    private async Task<List<SearchResultItem>> SearchBlogAsync(string pattern, CancellationToken ct)
    {
        return await db.BlogPosts
            .Where(b => EF.Functions.ILike(b.Title, pattern)
                     || EF.Functions.ILike(b.Content, pattern)
                     || (b.Excerpt != null && EF.Functions.ILike(b.Excerpt, pattern))
                     || EF.Functions.ILike(b.Author, pattern))
            .Select(b => new SearchResultItem
            {
                Scope = "blog",
                Id = b.Id,
                Title = b.Title,
                Subtitle = b.Excerpt ?? b.Author,
                Relevance = 0
            })
            .Take(50)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Calculate relevance score: exact matches score higher than partial.
    /// </summary>
    private static double CalculateRelevance(string title, string? subtitle, string query)
    {
        var lowerTitle = title.ToLowerInvariant();
        var lowerSubtitle = subtitle?.ToLowerInvariant() ?? "";

        if (lowerTitle == query) return 1.0;
        if (lowerTitle.StartsWith(query, StringComparison.Ordinal)) return 0.9;
        if (lowerTitle.Contains(query, StringComparison.Ordinal)) return 0.7;
        if (lowerSubtitle == query) return 0.6;
        if (lowerSubtitle.StartsWith(query, StringComparison.Ordinal)) return 0.5;
        if (lowerSubtitle.Contains(query, StringComparison.Ordinal)) return 0.3;
        return 0.1;
    }

    /// <summary>
    /// Escape special LIKE/ILIKE characters to prevent pattern injection.
    /// </summary>
    private static string EscapeLikePattern(string input)
    {
        return input
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
    }
}
