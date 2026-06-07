using IabConnect.Api.Authentication;
using IabConnect.Api.RateLimiting;
using IabConnect.Application.Common;
using IabConnect.Domain.Blog;
using IabConnect.Domain.Events;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-058 (E8-S2): the external integration read API. A dedicated, versioned route group
/// (<c>/api/v1/external/*</c>) that consumes the E8-S1 enforcement seam: the <c>ApiKey</c>
/// authentication scheme, the <c>Scope:</c> authorization policy, the <c>Module:api</c> gate, and a
/// per-credential rate-limit policy.
///
/// <para><b>v1 surface is deliberately small (A68/A71):</b> only PUBLISHED Events and PUBLISHED Blog
/// posts — the only public, author-managed content aggregates. Members, finance, documents, audit,
/// users and registration data are HIGH-risk and excluded. Responses use whitelist-only
/// <c>External*Dto</c> records that omit contact/organizer/PII/internal-status fields by construction
/// — never the internal <c>EventDto</c> (which leaks contact/organizer) or <c>MemberDto</c>.</para>
/// </summary>
public static class ExternalApiEndpoints
{
    public static void MapExternalApiEndpoints(this IEndpointRouteBuilder app)
    {
        // Group-level: authenticate via the ApiKey scheme (S1), gate on the api module, and apply the
        // per-credential external rate-limit policy. Per-endpoint scope policies are added below.
        var external = app.MapGroup("/api/v1/external")
            .WithTags("External API")
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = ApiKeyDefaults.SchemeName })
            .RequireAuthorization("Module:api")
            .RequireRateLimiting(RateLimitingOptions.ExternalApiPolicyName);

        external.MapGet("/events", GetEvents)
            .WithName("ExternalListEvents")
            .WithSummary("List published events (external API).")
            .RequireAuthorization("Scope:events:read")
            .Produces<PagedResult<ExternalEventDto>>();

        external.MapGet("/events/{id:guid}", GetEventById)
            .WithName("ExternalGetEvent")
            .RequireAuthorization("Scope:events:read")
            .Produces<ExternalEventDto>()
            .Produces(StatusCodes.Status404NotFound);

        external.MapGet("/blog", GetBlogPosts)
            .WithName("ExternalListBlog")
            .WithSummary("List published blog posts (external API).")
            .RequireAuthorization("Scope:blog:read")
            .Produces<PagedResult<ExternalBlogPostDto>>();

        external.MapGet("/blog/{id:guid}", GetBlogPostById)
            .WithName("ExternalGetBlogPost")
            .RequireAuthorization("Scope:blog:read")
            .Produces<ExternalBlogPostDto>()
            .Produces(StatusCodes.Status404NotFound);
    }

    // --- Events ---

    private static async Task<IResult> GetEvents(
        IEventRepository repository,
        string? sort,
        string? filter,
        int? page,
        int? pageSize,
        CancellationToken ct)
    {
        // GetPublicEventsAsync returns PUBLISHED + Public-visibility events only — no draft leak.
        var events = await repository.GetPublicEventsAsync(null, null, ct);
        IEnumerable<ExternalEventDto> dtos = events.Select(MapEvent);

        var parsedFilter = PaginationHelper.ParseFilter(filter);
        if (parsedFilter.TryGetValue("language", out var lang))
            dtos = dtos.Where(d => string.Equals(d.ContentLanguage, lang, StringComparison.OrdinalIgnoreCase));
        if (parsedFilter.TryGetValue("category", out var category))
            dtos = dtos.Where(d => string.Equals(d.Category, category, StringComparison.OrdinalIgnoreCase));

        var (field, desc) = PaginationHelper.ParseSort(sort, "startDate", defaultDescending: false);
        dtos = SortEvents(dtos, field, desc);

        return Results.Ok(dtos.ToPagedResult(page ?? 1, pageSize ?? 20));
    }

    private static async Task<IResult> GetEventById(Guid id, IEventRepository repository, CancellationToken ct)
    {
        // Resolve from the published-public set only → 404 (not 403) for unpublished/nonexistent ids
        // so there is no existence oracle for private data.
        var events = await repository.GetPublicEventsAsync(null, null, ct);
        var match = events.FirstOrDefault(e => e.Id == id);
        return match is null ? Results.NotFound() : Results.Ok(MapEvent(match));
    }

    private static IEnumerable<ExternalEventDto> SortEvents(IEnumerable<ExternalEventDto> dtos, string field, bool desc)
        => (field.ToLowerInvariant(), desc) switch
        {
            ("title", true) => dtos.OrderByDescending(d => d.Title).ThenBy(d => d.Id),
            ("title", false) => dtos.OrderBy(d => d.Title).ThenBy(d => d.Id),
            (_, true) => dtos.OrderByDescending(d => d.StartDate).ThenBy(d => d.Id),
            (_, false) => dtos.OrderBy(d => d.StartDate).ThenBy(d => d.Id),
        };

    private static ExternalEventDto MapEvent(Event e) => new(
        e.Id,
        e.Title,
        e.Description,
        e.ShortDescription,
        e.StartDate,
        e.EndDate,
        e.IsAllDay,
        e.TimeZone,
        e.Location,
        e.LocationAddress,
        e.LocationUrl,
        e.Category.ToString(),
        e.Tags.ToList(),
        e.ImageUrl,
        e.ImageAltText,
        e.Cost,
        e.CostDescription,
        e.ContentLanguage);

    // --- Blog ---

    private static async Task<IResult> GetBlogPosts(
        IBlogPostRepository repository,
        string? sort,
        string? filter,
        int? page,
        int? pageSize,
        CancellationToken ct)
    {
        var posts = await repository.GetPublishedAsync(ct);
        IEnumerable<ExternalBlogPostDto> dtos = posts.Select(MapBlogPost);

        var parsedFilter = PaginationHelper.ParseFilter(filter);
        if (parsedFilter.TryGetValue("language", out var lang))
            dtos = dtos.Where(d => string.Equals(d.ContentLanguage, lang, StringComparison.OrdinalIgnoreCase));
        if (parsedFilter.TryGetValue("category", out var category))
            dtos = dtos.Where(d => string.Equals(d.Category, category, StringComparison.OrdinalIgnoreCase));

        var (field, desc) = PaginationHelper.ParseSort(sort, "publishedAt", defaultDescending: true);
        dtos = SortBlog(dtos, field, desc);

        return Results.Ok(dtos.ToPagedResult(page ?? 1, pageSize ?? 20));
    }

    private static async Task<IResult> GetBlogPostById(Guid id, IBlogPostRepository repository, CancellationToken ct)
    {
        var posts = await repository.GetPublishedAsync(ct);
        var match = posts.FirstOrDefault(p => p.Id == id);
        return match is null ? Results.NotFound() : Results.Ok(MapBlogPost(match));
    }

    private static IEnumerable<ExternalBlogPostDto> SortBlog(IEnumerable<ExternalBlogPostDto> dtos, string field, bool desc)
        => (field.ToLowerInvariant(), desc) switch
        {
            ("title", true) => dtos.OrderByDescending(d => d.Title).ThenBy(d => d.Id),
            ("title", false) => dtos.OrderBy(d => d.Title).ThenBy(d => d.Id),
            (_, true) => dtos.OrderByDescending(d => d.PublishedAt).ThenBy(d => d.Id),
            (_, false) => dtos.OrderBy(d => d.PublishedAt).ThenBy(d => d.Id),
        };

    private static ExternalBlogPostDto MapBlogPost(BlogPost p) => new(
        p.Id,
        p.Title,
        p.Slug,
        p.Excerpt ?? (p.Content.Length > 200 ? p.Content[..200] + "..." : p.Content),
        p.Content,
        p.Author,
        p.Category,
        p.Tags.ToList(),
        p.PublishedAt,
        p.ImageUrl,
        p.ContentLanguage);
}

/// <summary>
/// REQ-058 (E8-S2): whitelist-only external projection of <see cref="Event"/>. Deliberately omits
/// organizer identity, contact email/phone, internal status, audit timestamps, visibility and
/// soft-delete flags — only deliberately-public display fields are exposed.
/// </summary>
public sealed record ExternalEventDto(
    Guid Id,
    string Title,
    string Description,
    string? ShortDescription,
    DateTime StartDate,
    DateTime EndDate,
    bool IsAllDay,
    string TimeZone,
    string Location,
    string? LocationAddress,
    string? LocationUrl,
    string Category,
    List<string> Tags,
    string? ImageUrl,
    string? ImageAltText,
    decimal? Cost,
    string? CostDescription,
    string? ContentLanguage);

/// <summary>
/// REQ-058 (E8-S2): whitelist-only external projection of <see cref="BlogPost"/>. Omits the internal
/// status and created/updated timestamps; exposes only public publication fields.
/// </summary>
public sealed record ExternalBlogPostDto(
    Guid Id,
    string Title,
    string Slug,
    string Summary,
    string Content,
    string Author,
    string Category,
    List<string> Tags,
    DateTime? PublishedAt,
    string? ImageUrl,
    string? ContentLanguage);
