using System.Security.Claims;
using IabConnect.Application.Finance.Accounts.Commands;
using IabConnect.Application.Finance.Accounts.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for financial account management (REQ-038)
/// </summary>
public static class AccountEndpoints
{
    public static void MapAccountEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/accounts")
            .WithTags("Finance - Accounts");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetAccounts")
            .WithSummary("List all financial accounts")
            .WithDescription("REQ-038: Returns all financial accounts.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetAccountById")
            .WithSummary("Get a financial account by ID")
            .WithDescription("REQ-038: Returns a single financial account by its ID.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateAccount")
            .WithSummary("Create a financial account")
            .WithDescription("REQ-038: Creates a new financial account. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateAccount")
            .WithSummary("Update a financial account")
            .WithDescription("REQ-038: Updates a financial account. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteAccount")
            .WithSummary("Delete a financial account")
            .WithDescription("REQ-038: Deletes a financial account. Audited.");

        group.MapPost("/{id:guid}/activate", Activate)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("ActivateAccount")
            .WithSummary("Activate a financial account")
            .WithDescription("REQ-038: Activates a financial account. Audited.");

        group.MapPost("/{id:guid}/deactivate", Deactivate)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeactivateAccount")
            .WithSummary("Deactivate a financial account")
            .WithDescription("REQ-038: Deactivates a financial account. Audited.");
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var accounts = await sender.Send(new GetAccountsQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(accounts);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var account = await sender.Send(new GetAccountByIdQuery(id), ct);
        return account is null
            ? Results.NotFound(new { Message = "Account not found." })
            : Results.Ok(account);
    }

    private static async Task<IResult> Create(
        CreateAccountRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateAccountCommand
        {
            Name = request.Name,
            Number = request.Number,
            Type = request.Type,
            Description = request.Description,
            SortOrder = request.SortOrder,
            UserName = GetUserName(httpContext)
        }, ct);
        return Results.Created($"/api/v1/finance/accounts/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateAccountRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateAccountCommand
        {
            Id = id,
            Name = request.Name,
            Number = request.Number,
            Type = request.Type,
            Description = request.Description,
            SortOrder = request.SortOrder,
            UserName = GetUserName(httpContext)
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Account not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteAccountCommand(id, GetUserName(httpContext)), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Account not found." });
    }

    private static async Task<IResult> Activate(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new ActivateAccountCommand(id, GetUserName(httpContext)), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Account not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Deactivate(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new DeactivateAccountCommand(id, GetUserName(httpContext)), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Account not found." })
            : Results.Ok(dto);
    }

    // DTOs
    public sealed record CreateAccountRequest(string Name, string Number, string Type, string? Description, int SortOrder);
    public sealed record UpdateAccountRequest(string Name, string Number, string Type, string? Description, int SortOrder);
}
