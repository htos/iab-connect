using IabConnect.Application.Search;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-052: Global search endpoint – searches across Members, Events, Documents, Invoices, Sponsors, Blog.
/// </summary>
public static class SearchEndpoints
{
    public static WebApplication MapSearchEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/search")
            .WithTags("Search")
            .RequireAuthorization("RequireSearch");

        group.MapGet("", Search)
            .WithName("GlobalSearch")
            .WithSummary("REQ-052: Search across all modules");

        return app;
    }

    private static async Task<IResult> Search(
        string? query,
        string? scope,
        int? page,
        int? pageSize,
        IMediator mediator)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            return Results.BadRequest("Search query must be at least 2 characters.");

        var result = await mediator.Send(new GlobalSearchQuery
        {
            Query = query.Trim(),
            Scope = scope ?? "all",
            Page = page ?? 1,
            PageSize = pageSize ?? 20
        });

        return Results.Ok(result);
    }
}
