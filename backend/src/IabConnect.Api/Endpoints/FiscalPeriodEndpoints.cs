using IabConnect.Application.Finance.FiscalPeriods;
using IabConnect.Application.Finance.FiscalPeriods.Commands;
using IabConnect.Application.Finance.FiscalPeriods.Queries;
using MediatR;
using System.Security.Claims;

namespace IabConnect.Api.Endpoints;

public static class FiscalPeriodEndpoints
{
    public static void MapFiscalPeriodEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/fiscal-periods")
            .WithTags("Finance - Fiscal Periods");

        group.MapGet("/", GetAll).RequireAuthorization("RequireFinanceRead");
        group.MapGet("/{id:guid}", GetById).RequireAuthorization("RequireFinanceRead");
        group.MapPost("/generate", Generate).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/lock", Lock).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/unlock", Unlock).RequireAuthorization("RequireAdmin");
        group.MapPost("/{id:guid}/close", Close).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/reopen", Reopen).RequireAuthorization("RequireAdmin");
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        [AsParameters] FiscalPeriodFilterRequest filter,
        ISender sender)
    {
        var query = new GetFiscalPeriodsQuery(filter.Year)
        {
            Page = filter.Page ?? 1,
            PageSize = filter.PageSize ?? 20,
            Sort = filter.Sort,
            Filter = filter.Filter
        };
        var result = await sender.Send(query);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender)
    {
        var query = new GetFiscalPeriodByIdQuery(id);
        var result = await sender.Send(query);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Generate(
        GeneratePeriodsRequest request,
        HttpContext ctx,
        ISender sender)
    {
        var command = new GenerateFiscalPeriodsCommand
        {
            Year = request.Year,
            UserName = GetUserName(ctx)
        };
        var result = await sender.Send(command);
        return Results.Ok(result);
    }

    private static async Task<IResult> Lock(
        Guid id,
        LockPeriodRequest? request,
        HttpContext ctx,
        ISender sender)
    {
        var command = new LockFiscalPeriodCommand
        {
            Id = id,
            Notes = request?.Notes,
            UserName = GetUserName(ctx)
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Unlock(
        Guid id,
        HttpContext ctx,
        ISender sender)
    {
        var command = new UnlockFiscalPeriodCommand
        {
            Id = id,
            UserName = GetUserName(ctx)
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Close(
        Guid id,
        ClosePeriodRequest? request,
        HttpContext ctx,
        ISender sender)
    {
        var command = new CloseFiscalPeriodCommand
        {
            Id = id,
            Notes = request?.Notes,
            UserName = GetUserName(ctx)
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Reopen(
        Guid id,
        HttpContext ctx,
        ISender sender)
    {
        var command = new ReopenFiscalPeriodCommand
        {
            Id = id,
            UserName = GetUserName(ctx)
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    // Request records
    public sealed record FiscalPeriodFilterRequest(
        int? Year = null, int? Page = null, int? PageSize = null,
        string? Sort = null, string? Filter = null);
    public sealed record GeneratePeriodsRequest(int Year);
    public sealed record LockPeriodRequest(string? Notes);
    public sealed record ClosePeriodRequest(string? Notes);
}
