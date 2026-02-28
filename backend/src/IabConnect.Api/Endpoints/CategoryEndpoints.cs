using System.Security.Claims;
using IabConnect.Application.Finance.Categories.Commands;
using IabConnect.Application.Finance.Categories.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for transaction category management (REQ-038)
/// </summary>
public static class CategoryEndpoints
{
    public static void MapCategoryEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/categories")
            .WithTags("Finance - Categories");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetCategories")
            .WithSummary("List all transaction categories")
            .WithDescription("REQ-038: Returns all transaction categories.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateCategory")
            .WithSummary("Create a transaction category")
            .WithDescription("REQ-038: Creates a new transaction category. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateCategory")
            .WithSummary("Update a transaction category")
            .WithDescription("REQ-038: Updates a transaction category. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteCategory")
            .WithSummary("Delete a transaction category")
            .WithDescription("REQ-038: Deletes a transaction category. Audited.");

        group.MapPost("/{id:guid}/activate", Activate)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("ActivateCategory")
            .WithSummary("Activate a transaction category")
            .WithDescription("REQ-038: Activates a transaction category. Audited.");

        group.MapPost("/{id:guid}/deactivate", Deactivate)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeactivateCategory")
            .WithSummary("Deactivate a transaction category")
            .WithDescription("REQ-038: Deactivates a transaction category. Audited.");
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var categories = await sender.Send(new GetCategoriesQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(categories);
    }

    private static async Task<IResult> Create(
        CreateCategoryRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateCategoryCommand
        {
            Name = request.Name,
            Type = request.Type,
            Color = request.Color,
            UserName = GetUserName(httpContext)
        }, ct);
        return Results.Created($"/api/v1/finance/categories/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateCategoryRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateCategoryCommand
        {
            Id = id,
            Name = request.Name,
            Type = request.Type,
            Color = request.Color
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Category not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteCategoryCommand(id, GetUserName(httpContext)), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Category not found." });
    }

    private static async Task<IResult> Activate(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new ActivateCategoryCommand(id, GetUserName(httpContext)), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Category not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Deactivate(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new DeactivateCategoryCommand(id, GetUserName(httpContext)), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Category not found." })
            : Results.Ok(dto);
    }

    // DTOs
    public sealed record CreateCategoryRequest(string Name, string Type, string Color);
    public sealed record UpdateCategoryRequest(string Name, string Type, string Color);
}
