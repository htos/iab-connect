using IabConnect.Application.Finance.ActivityAreas.Commands;
using IabConnect.Application.Finance.ActivityAreas.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for activity area management (REQ-068)
/// </summary>
public static class ActivityAreaEndpoints
{
    public static void MapActivityAreaEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/activity-areas")
            .WithTags("Finance - Activity Areas")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetActivityAreas")
            .WithSummary("List active activity areas")
            .WithDescription("REQ-068: Returns all active (non-deleted) activity areas.");

        group.MapGet("/report", GetReport)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetActivityAreaReport")
            .WithSummary("P&L report by activity area")
            .WithDescription("REQ-068: Returns income, expense, and balance grouped by activity area.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateActivityArea")
            .WithSummary("Create an activity area")
            .WithDescription("REQ-068: Creates a new activity area / project tag.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateActivityArea")
            .WithSummary("Update an activity area")
            .WithDescription("REQ-068: Updates an existing activity area.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteActivityArea")
            .WithSummary("Soft-delete an activity area")
            .WithDescription("REQ-068: Soft-deletes an activity area.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var areas = await sender.Send(new GetActivityAreasQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(areas);
    }

    private static async Task<IResult> GetReport(
        ISender sender, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var report = await sender.Send(new GetActivityAreaReportQuery(from, to), ct);
        return Results.Ok(report);
    }

    private static async Task<IResult> Create(
        CreateActivityAreaRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateActivityAreaCommand
        {
            Name = request.Name,
            Code = request.Code,
            Description = request.Description,
            Color = request.Color,
            SortOrder = request.SortOrder
        }, ct);
        return Results.Created($"/api/v1/finance/activity-areas/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateActivityAreaRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateActivityAreaCommand
        {
            Id = id,
            Name = request.Name,
            Code = request.Code,
            Description = request.Description,
            Color = request.Color,
            SortOrder = request.SortOrder,
            IsActive = request.IsActive
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Activity area not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(Guid id, ISender sender, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteActivityAreaCommand(id), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Activity area not found." });
    }

    // DTOs
    public sealed record CreateActivityAreaRequest(string Name, string Code, string? Description, string? Color, int SortOrder);
    public sealed record UpdateActivityAreaRequest(string Name, string Code, string? Description, string? Color, int SortOrder, bool IsActive);
}
