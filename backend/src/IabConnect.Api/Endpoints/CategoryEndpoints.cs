using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

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
    }

    private static async Task<IResult> GetAll(
        ICategoryRepository repository,
        CancellationToken ct)
    {
        var categories = await repository.GetAllAsync(ct);
        var response = categories.Select(c => new CategoryResponse(
            c.Id, c.Name, c.Type.ToString(), c.Color, c.IsActive, c.CreatedAt, c.CreatedBy));
        return Results.Ok(response);
    }

    private static async Task<IResult> Create(
        CreateCategoryRequest request,
        ICategoryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<TransactionType>(request.Type, true, out var txType))
            return Results.BadRequest(new { Message = $"Invalid transaction type '{request.Type}'." });

        var category = Category.Create(request.Name, txType, request.Color, userName ?? "system");

        await repository.AddAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Category '{category.Name}' created",
            entityType: "Category",
            entityId: category.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/categories/{category.Id}",
            new CategoryResponse(category.Id, category.Name, category.Type.ToString(),
                category.Color, category.IsActive, category.CreatedAt, category.CreatedBy));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateCategoryRequest request,
        ICategoryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var category = await repository.GetByIdAsync(id, ct);
        if (category is null)
            return Results.NotFound(new { Message = "Category not found." });

        if (!Enum.TryParse<TransactionType>(request.Type, true, out var txType))
            return Results.BadRequest(new { Message = $"Invalid transaction type '{request.Type}'." });

        category.Update(request.Name, txType, request.Color);

        await repository.UpdateAsync(category, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Category '{category.Name}' updated",
            entityType: "Category",
            entityId: category.Id.ToString(),
            ct: ct);

        return Results.Ok(new CategoryResponse(category.Id, category.Name, category.Type.ToString(),
            category.Color, category.IsActive, category.CreatedAt, category.CreatedBy));
    }

    private static async Task<IResult> Delete(
        Guid id,
        ICategoryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var category = await repository.GetByIdAsync(id, ct);
        if (category is null)
            return Results.NotFound(new { Message = "Category not found." });

        var categoryName = category.Name;
        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Category '{categoryName}' deleted",
            entityType: "Category",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    // DTOs
    public sealed record CreateCategoryRequest(string Name, string Type, string Color);
    public sealed record UpdateCategoryRequest(string Name, string Type, string Color);
    public sealed record CategoryResponse(Guid Id, string Name, string Type, string Color,
        bool IsActive, DateTime CreatedAt, string CreatedBy);
}
