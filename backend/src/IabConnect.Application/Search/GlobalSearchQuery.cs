using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Search;

/// <summary>
/// REQ-052: Global search across all modules (Members, Events, Documents, Invoices, Sponsors, Blog)
/// </summary>
public sealed record GlobalSearchQuery : IRequest<GlobalSearchResult>
{
    /// <summary>Search term (min 2 chars)</summary>
    public required string Query { get; init; }

    /// <summary>Optional scope filter: all, members, events, documents, invoices, sponsors, blog</summary>
    public string Scope { get; init; } = "all";

    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record GlobalSearchResult
{
    public required IReadOnlyList<SearchResultItem> Items { get; init; }
    public required int TotalCount { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
    public required Dictionary<string, int> CountsByScope { get; init; }

    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}

public sealed record SearchResultItem
{
    /// <summary>Module: members, events, documents, invoices, sponsors, blog</summary>
    public required string Scope { get; init; }

    /// <summary>Entity ID</summary>
    public required Guid Id { get; init; }

    /// <summary>Display title (name, subject, etc.)</summary>
    public required string Title { get; init; }

    /// <summary>Short excerpt / subtitle for context</summary>
    public string? Subtitle { get; init; }

    /// <summary>Relevance score (higher = better match)</summary>
    public double Relevance { get; init; }
}
