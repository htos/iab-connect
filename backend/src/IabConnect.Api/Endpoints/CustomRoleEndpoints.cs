using System.Security.Claims;
using System.Text.Json;
using IabConnect.Api.Extensions;
using IabConnect.Application.Audit;
using IabConnect.Application.Authorization;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Authorization;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for custom role management (REQ-003, REQ-059)
/// </summary>
public static class CustomRoleEndpoints
{
    public static void MapCustomRoleEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public read endpoint for active roles
        var publicGroup = routes.MapGroup("/api/v1/custom-roles")
            .WithTags("CustomRoles");

        publicGroup.MapGet("/active", GetActiveRoles)
            .WithName("GetActiveCustomRoles")
            .WithSummary("Get all active custom roles")
            .WithDescription("REQ-003: Returns all active custom roles. No authentication required.")
            .AllowAnonymous();

        // Admin-only management endpoints
        var adminGroup = routes.MapGroup("/api/v1/custom-roles")
            .WithTags("CustomRoles")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/", GetAllRoles)
            .WithName("GetAllCustomRoles")
            .WithSummary("Get all custom roles")
            .WithDescription("REQ-003: Returns all custom roles including inactive. Admin only.");

        adminGroup.MapGet("/{id:guid}", GetRoleById)
            .WithName("GetCustomRoleById")
            .WithSummary("Get a custom role by ID")
            .WithDescription("REQ-003: Returns a single custom role. Admin only.");

        adminGroup.MapPost("/", CreateRole)
            .WithName("CreateCustomRole")
            .WithSummary("Create a new custom role")
            .WithDescription("REQ-003: Creates a custom role linked to a base Keycloak role. Admin only.");

        adminGroup.MapPut("/{id:guid}", UpdateRole)
            .WithName("UpdateCustomRole")
            .WithSummary("Update a custom role")
            .WithDescription("REQ-003: Updates a custom role. Admin only.");

        adminGroup.MapDelete("/{id:guid}", DeleteRole)
            .WithName("DeleteCustomRole")
            .WithSummary("Delete a custom role")
            .WithDescription("REQ-003: Permanently deletes a custom role. Admin only.");
    }

    private static async Task<IResult> GetActiveRoles(
        ICustomRoleRepository repository,
        CancellationToken cancellationToken)
    {
        var roles = await repository.GetActiveAsync(cancellationToken);
        return Results.Ok(roles.Select(MapToResponse));
    }

    private static async Task<IResult> GetAllRoles(
        ICustomRoleRepository repository,
        CancellationToken cancellationToken)
    {
        var roles = await repository.GetAllAsync(cancellationToken);
        return Results.Ok(roles.Select(MapToResponse));
    }

    private static async Task<IResult> GetRoleById(
        Guid id,
        ICustomRoleRepository repository,
        CancellationToken cancellationToken)
    {
        var role = await repository.GetByIdAsync(id, cancellationToken);
        if (role is null)
            return Results.NotFound(new { Message = "Custom role not found" });

        return Results.Ok(MapToResponse(role));
    }

    private static async Task<IResult> CreateRole(
        CreateCustomRoleRequest request,
        ICustomRoleRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        // Check for duplicate name
        var existing = await repository.GetByNameAsync(request.Name, cancellationToken);
        if (existing is not null)
            return Results.Conflict(new { Message = $"A role with name '{request.Name}' already exists." });

        var userName = httpContext.GetUserName();

        var role = CustomRole.Create(
            request.Name,
            request.LinkedRole,
            request.Description,
            request.Color,
            request.SortOrder,
            userName);

        await repository.AddAsync(role, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Audit
        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Custom role '{role.Name}' created (linked to {role.LinkedRole})",
            entityType: "CustomRole",
            entityId: role.Id.ToString(),
            details: JsonSerializer.Serialize(new { role.Name, role.LinkedRole, role.Description }),
            ct: cancellationToken);

        return Results.Created($"/api/v1/custom-roles/{role.Id}", MapToResponse(role));
    }

    private static async Task<IResult> UpdateRole(
        Guid id,
        UpdateCustomRoleRequest request,
        ICustomRoleRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var role = await repository.GetByIdAsync(id, cancellationToken);
        if (role is null)
            return Results.NotFound(new { Message = "Custom role not found" });

        // Check for duplicate name (excluding current)
        var existing = await repository.GetByNameAsync(request.Name, cancellationToken);
        if (existing is not null && existing.Id != id)
            return Results.Conflict(new { Message = $"A role with name '{request.Name}' already exists." });

        var userName = httpContext.GetUserName();

        role.Update(
            request.Name,
            request.LinkedRole,
            request.Description,
            request.Color,
            request.SortOrder,
            request.IsActive,
            userName);

        repository.Update(role);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Audit
        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Custom role '{role.Name}' updated",
            entityType: "CustomRole",
            entityId: role.Id.ToString(),
            details: JsonSerializer.Serialize(new { role.Name, role.LinkedRole, role.IsActive }),
            ct: cancellationToken);

        return Results.Ok(MapToResponse(role));
    }

    private static async Task<IResult> DeleteRole(
        Guid id,
        ICustomRoleRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var role = await repository.GetByIdAsync(id, cancellationToken);
        if (role is null)
            return Results.NotFound(new { Message = "Custom role not found" });

        var roleName = role.Name;
        repository.Delete(role);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Audit
        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Custom role '{roleName}' deleted",
            entityType: "CustomRole",
            entityId: id.ToString(),
            ct: cancellationToken);

        return Results.NoContent();
    }

    private static CustomRoleResponse MapToResponse(CustomRole role)
    {
        return new CustomRoleResponse(
            role.Id,
            role.Name,
            role.Description,
            role.LinkedRole,
            role.IsActive,
            role.Color,
            role.SortOrder,
            role.CreatedAt,
            role.CreatedBy,
            role.UpdatedAt,
            role.UpdatedBy);
    }

    // DTOs
    public sealed record CustomRoleResponse(
        Guid Id,
        string Name,
        string? Description,
        BaseRole LinkedRole,
        bool IsActive,
        string Color,
        int SortOrder,
        DateTime CreatedAt,
        string? CreatedBy,
        DateTime? UpdatedAt,
        string? UpdatedBy);

    public sealed record CreateCustomRoleRequest(
        string Name,
        BaseRole LinkedRole,
        string? Description = null,
        string? Color = null,
        int SortOrder = 0);

    public sealed record UpdateCustomRoleRequest(
        string Name,
        BaseRole LinkedRole,
        string? Description = null,
        string? Color = null,
        int SortOrder = 0,
        bool IsActive = true);
}
