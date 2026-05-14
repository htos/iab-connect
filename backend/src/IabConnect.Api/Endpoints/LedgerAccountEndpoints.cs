using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Application.Finance.Accounting.LedgerAccounts.Commands;
using IabConnect.Application.Finance.Accounting.LedgerAccounts.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-075: CRUD endpoints for ledger accounts (chart of accounts).
/// Only accessible when double-entry bookkeeping is enabled.
/// </summary>
public static class LedgerAccountEndpoints
{
    public static WebApplication MapLedgerAccountEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/finance/ledger-accounts")
            .WithTags("Finance - Ledger Accounts")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", async (ISender sender, CancellationToken ct) =>
        {
            var accounts = await sender.Send(new GetLedgerAccountsQuery(), ct);
            return Results.Ok(new { items = accounts });
        })
        .WithName("GetLedgerAccounts")
        .WithDescription("REQ-075: List all ledger accounts")
        .RequireAuthorization("RequireFinanceRead");

        group.MapPost("/", async (CreateLedgerAccountRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new CreateLedgerAccountCommand
            {
                Number = body.Number,
                Name = body.Name,
                AccountClass = body.AccountClass,
                NormalBalance = body.NormalBalance,
                Description = body.Description,
                ParentAccountId = body.ParentAccountId,
                SortOrder = body.SortOrder,
                UserName = ctx.GetUserName()
            }, ct);
            return Results.Created($"/api/v1/finance/ledger-accounts/{dto.Id}", dto);
        })
        .WithName("CreateLedgerAccount")
        .WithDescription("REQ-075: Create a new ledger account")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapPut("/{id:guid}", async (Guid id, UpdateLedgerAccountRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new UpdateLedgerAccountCommand
            {
                Id = id,
                Number = body.Number,
                Name = body.Name,
                AccountClass = body.AccountClass,
                NormalBalance = body.NormalBalance,
                Description = body.Description,
                ParentAccountId = body.ParentAccountId,
                SortOrder = body.SortOrder,
                UserName = ctx.GetUserName()
            }, ct);
            return dto is null
                ? Results.NotFound(new { Message = $"Ledger account {id} not found." })
                : Results.Ok(dto);
        })
        .WithName("UpdateLedgerAccount")
        .WithDescription("REQ-075: Update a ledger account")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var result = await sender.Send(new DeleteLedgerAccountCommand
            {
                Id = id,
                UserName = ctx.GetUserName()
            }, ct);
            return result ? Results.NoContent() : Results.NotFound(new { Message = $"Ledger account {id} not found." });
        })
        .WithName("DeleteLedgerAccount")
        .WithDescription("REQ-075: Soft-delete a ledger account")
        .RequireAuthorization("RequireFinanceWrite");

        return app;
    }

    // Request DTOs
    public sealed record CreateLedgerAccountRequest(
        string Number, string Name, string AccountClass, string NormalBalance,
        string? Description, Guid? ParentAccountId, int SortOrder);

    public sealed record UpdateLedgerAccountRequest(
        string Number, string Name, string AccountClass, string NormalBalance,
        string? Description, Guid? ParentAccountId, int SortOrder);
}
