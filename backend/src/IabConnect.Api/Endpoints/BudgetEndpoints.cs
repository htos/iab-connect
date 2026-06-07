using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Budgets.Commands;
using IabConnect.Application.Finance.Budgets.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-044 (E6-S1): API endpoints for finance-planning budgets
/// (planned amount per cost center / ActivityArea per fiscal period).
/// </summary>
public static class BudgetEndpoints
{
    public static void MapBudgetEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/budgets")
            .WithTags("Finance - Budgets")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetBudgets")
            .WithSummary("List budgets")
            .WithDescription("REQ-044: Returns budgets, optionally filtered by cost center, fiscal period, or year.");

        // REQ-044 (E6-S3): budget-vs-actual (Soll/Ist) report — must precede the "/{id:guid}" route.
        group.MapGet("/budget-vs-actual", GetBudgetVsActual)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetBudgetVsActual")
            .WithSummary("Budget-vs-actual (Soll/Ist) report")
            .WithDescription("REQ-044: Per cost center, the budget (Soll), actual net cost (Ist), and variance for a fiscal period.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetBudgetById")
            .WithSummary("Get a budget by ID")
            .WithDescription("REQ-044: Returns a single budget by its ID.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateBudget")
            .WithSummary("Create a budget")
            .WithDescription("REQ-044: Creates a budget for a cost center and fiscal period. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateBudget")
            .WithSummary("Update a budget")
            .WithDescription("REQ-044: Updates a budget's amount, currency, or notes. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteBudget")
            .WithSummary("Delete a budget")
            .WithDescription("REQ-044: Soft-deletes a budget. Audited.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, Guid? activityAreaId, Guid? fiscalPeriodId, int? year, CancellationToken ct)
    {
        var budgets = await sender.Send(new GetBudgetsQuery
        {
            ActivityAreaId = activityAreaId,
            FiscalPeriodId = fiscalPeriodId,
            Year = year
        }, ct);
        return Results.Ok(budgets);
    }

    private static async Task<IResult> GetBudgetVsActual(
        ISender sender, Guid fiscalPeriodId, Guid? activityAreaId, CancellationToken ct)
    {
        var report = await sender.Send(new GetBudgetVsActualQuery(fiscalPeriodId, activityAreaId), ct);
        return report is null
            ? Results.NotFound(new { Message = "Fiscal period not found." })
            : Results.Ok(report);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var budget = await sender.Send(new GetBudgetByIdQuery(id), ct);
        return budget is null
            ? Results.NotFound(new { Message = "Budget not found." })
            : Results.Ok(budget);
    }

    private static async Task<IResult> Create(
        CreateBudgetRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateBudgetCommand
        {
            ActivityAreaId = request.ActivityAreaId,
            FiscalPeriodId = request.FiscalPeriodId,
            Amount = request.Amount,
            Currency = request.Currency,
            Notes = request.Notes,
            UserName = httpContext.GetUserName()
        }, ct);
        return Results.Created($"/api/v1/finance/budgets/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateBudgetRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateBudgetCommand
        {
            Id = id,
            Amount = request.Amount,
            Currency = request.Currency,
            Notes = request.Notes,
            UserName = httpContext.GetUserName()
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Budget not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteBudgetCommand(id, httpContext.GetUserName()), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Budget not found." });
    }

    // DTOs
    public sealed record CreateBudgetRequest(
        Guid ActivityAreaId, Guid FiscalPeriodId, decimal Amount, string? Currency, string? Notes);
    public sealed record UpdateBudgetRequest(
        decimal Amount, string? Currency, string? Notes);
}
