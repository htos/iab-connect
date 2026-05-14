using IabConnect.Api.Authorization;
using IabConnect.Application.Authorization;
using IabConnect.Domain.Blog;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-047: Blog/News endpoints
/// Public read endpoints + admin CRUD
/// </summary>
public static class BlogEndpoints
{
    public static void MapBlogEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public endpoints (no auth)
        var publicGroup = routes.MapGroup("/api/v1/blog/public")
            .WithTags("Blog")
            .RequireModule("public_view"); // REQ-087 (E10-S5): public surface gated by the public_view module

        publicGroup.MapGet("/", GetPublicPosts)
            .WithName("GetPublicBlogPosts")
            .WithSummary("Get published blog posts");

        publicGroup.MapGet("/{id:guid}", GetPublicPost)
            .WithName("GetPublicBlogPost")
            .WithSummary("Get a published blog post by ID");

        // Admin endpoints
        var adminGroup = routes.MapGroup("/api/v1/blog")
            .WithTags("Blog Admin")
            .RequireAuthorization("RequireVorstand");

        adminGroup.MapGet("/", GetAll)
            .WithName("GetBlogPosts")
            .WithSummary("Get all blog posts (admin)");

        adminGroup.MapGet("/{id:guid}", GetById)
            .WithName("GetBlogPost")
            .WithSummary("Get blog post by ID (admin)");

        adminGroup.MapPost("/", Create)
            .WithName("CreateBlogPost")
            .WithSummary("Create a new blog post");

        adminGroup.MapPut("/{id:guid}", Update)
            .WithName("UpdateBlogPost")
            .WithSummary("Update a blog post");

        adminGroup.MapPost("/{id:guid}/publish", Publish)
            .WithName("PublishBlogPost")
            .WithSummary("Publish a blog post");

        adminGroup.MapPost("/{id:guid}/unpublish", Unpublish)
            .WithName("UnpublishBlogPost")
            .WithSummary("Unpublish a blog post");

        adminGroup.MapPost("/{id:guid}/archive", Archive)
            .WithName("ArchiveBlogPost")
            .WithSummary("Archive a blog post");

        adminGroup.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteBlogPost")
            .WithSummary("Delete a blog post");
    }

    // === Public ===

    private static async Task<IResult> GetPublicPosts(
        IBlogPostRepository repository,
        CancellationToken ct)
    {
        var posts = await repository.GetPublishedAsync(ct);
        return Results.Ok(posts.Select(MapToPublicDto));
    }

    private static async Task<IResult> GetPublicPost(
        Guid id,
        IBlogPostRepository repository,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null || post.Status != BlogPostStatus.Published)
            return Results.NotFound(new { Error = "Post not found" });
        return Results.Ok(MapToPublicDto(post));
    }

    // === Admin ===

    private static async Task<IResult> GetAll(
        [FromQuery] string? status,
        IBlogPostRepository repository,
        CancellationToken ct)
    {
        BlogPostStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<BlogPostStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var posts = await repository.GetAllAsync(statusFilter, ct);
        return Results.Ok(posts.Select(MapToAdminDto));
    }

    private static async Task<IResult> GetById(
        Guid id,
        IBlogPostRepository repository,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();
        return Results.Ok(MapToAdminDto(post));
    }

    private static async Task<IResult> Create(
        [FromBody] CreateBlogPostRequest request,
        HttpContext httpContext,
        IBlogPostRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        var post = BlogPost.Create(
            request.Title, request.Content, request.Excerpt,
            request.Author, request.Category, request.Tags,
            request.ImageUrl, userId);

        await repository.AddAsync(post, ct);
        await dbContext.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/blog/{post.Id}", MapToAdminDto(post));
    }

    private static async Task<IResult> Update(
        Guid id,
        [FromBody] UpdateBlogPostRequest request,
        HttpContext httpContext,
        IBlogPostRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        post.Update(request.Title, request.Content, request.Excerpt,
            request.Author, request.Category, request.Tags,
            request.ImageUrl, userId);

        repository.Update(post);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToAdminDto(post));
    }

    private static async Task<IResult> Publish(
        Guid id,
        HttpContext httpContext,
        IBlogPostRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        post.Publish(userId);
        repository.Update(post);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToAdminDto(post));
    }

    private static async Task<IResult> Unpublish(
        Guid id,
        HttpContext httpContext,
        IBlogPostRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        post.Unpublish(userId);
        repository.Update(post);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToAdminDto(post));
    }

    private static async Task<IResult> Archive(
        Guid id,
        HttpContext httpContext,
        IBlogPostRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        post.Archive(userId);
        repository.Update(post);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToAdminDto(post));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IBlogPostRepository repository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var post = await repository.GetByIdAsync(id, ct);
        if (post == null) return Results.NotFound();

        repository.Remove(post);
        await dbContext.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static PublicBlogPostDto MapToPublicDto(BlogPost p) => new(
        p.Id, p.Title, p.Slug, p.Excerpt ?? (p.Content.Length > 200 ? p.Content[..200] + "..." : p.Content),
        p.Content, p.Author, p.Category, p.Tags, p.PublishedAt, p.ImageUrl);

    private static BlogPostAdminDto MapToAdminDto(BlogPost p) => new(
        p.Id, p.Title, p.Slug, p.Content, p.Excerpt, p.Author, p.Category,
        p.Tags, p.ImageUrl, p.Status.ToString(), p.PublishedAt, p.CreatedAt, p.UpdatedAt);
}

public sealed record CreateBlogPostRequest(
    string Title,
    string Content,
    string? Excerpt,
    string Author,
    string Category,
    List<string>? Tags = null,
    string? ImageUrl = null);

public sealed record UpdateBlogPostRequest(
    string Title,
    string Content,
    string? Excerpt,
    string Author,
    string Category,
    List<string>? Tags = null,
    string? ImageUrl = null);

public sealed record PublicBlogPostDto(
    Guid Id,
    string Title,
    string Slug,
    string Excerpt,
    string Content,
    string Author,
    string Category,
    List<string> Tags,
    DateTime? PublishedAt,
    string? ImageUrl);

public sealed record BlogPostAdminDto(
    Guid Id,
    string Title,
    string Slug,
    string Content,
    string? Excerpt,
    string Author,
    string Category,
    List<string> Tags,
    string? ImageUrl,
    string Status,
    DateTime? PublishedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt);
