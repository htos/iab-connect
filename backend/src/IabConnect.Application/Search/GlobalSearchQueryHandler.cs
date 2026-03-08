using IabConnect.Application.Search;
using MediatR;

namespace IabConnect.Application.Search;

/// <summary>
/// REQ-052: Handles global search queries by delegating to IGlobalSearchService.
/// </summary>
public sealed class GlobalSearchQueryHandler(IGlobalSearchService searchService)
    : IRequestHandler<GlobalSearchQuery, GlobalSearchResult>
{
    public async Task<GlobalSearchResult> Handle(GlobalSearchQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query) || request.Query.Trim().Length < 2)
        {
            return new GlobalSearchResult
            {
                Items = [],
                TotalCount = 0,
                Page = request.Page,
                PageSize = request.PageSize,
                CountsByScope = new Dictionary<string, int>()
            };
        }

        return await searchService.SearchAsync(
            request.Query.Trim(),
            request.Scope,
            request.Page,
            request.PageSize,
            cancellationToken);
    }
}
