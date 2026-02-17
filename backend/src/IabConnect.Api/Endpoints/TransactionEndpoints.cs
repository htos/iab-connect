using System.Security.Claims;
using IabConnect.Application.Finance.Transactions.Commands;
using IabConnect.Application.Finance.Transactions.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for financial transaction management (REQ-038)
/// </summary>
public static class TransactionEndpoints
{
    public static void MapTransactionEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/transactions")
            .WithTags("Finance - Transactions");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetTransactions")
            .WithSummary("List transactions with optional filters")
            .WithDescription("REQ-038: Returns transactions filtered by date range and type.");

        group.MapGet("/summary", GetSummary)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetTransactionSummary")
            .WithSummary("Get transaction summary totals")
            .WithDescription("REQ-038: Returns totalIncome, totalExpense, balance for a date range.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetTransactionById")
            .WithSummary("Get a transaction by ID")
            .WithDescription("REQ-038: Returns a single transaction.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateTransaction")
            .WithSummary("Create a transaction")
            .WithDescription("REQ-038: Creates a new financial transaction. Audited.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateTransaction")
            .WithSummary("Update a transaction")
            .WithDescription("REQ-038: Updates a financial transaction. Audited.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteTransaction")
            .WithSummary("Delete a transaction")
            .WithDescription("REQ-038: Deletes a financial transaction. Audited.");

        group.MapPost("/{id:guid}/receipt", AttachReceipt)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("AttachReceiptToTransaction")
            .WithSummary("Attach a receipt to a transaction")
            .WithDescription("REQ-061: Attaches an existing receipt to a transaction. Audited.");

        group.MapDelete("/{id:guid}/receipt", DetachReceipt)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DetachReceiptFromTransaction")
            .WithSummary("Detach receipt from a transaction")
            .WithDescription("REQ-061: Removes the receipt link from a transaction. Audited.");
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        ISender sender, DateTime? from, DateTime? to, string? type, CancellationToken ct)
    {
        var transactions = await sender.Send(new GetTransactionsQuery { From = from, To = to, Type = type }, ct);
        return Results.Ok(transactions);
    }

    private static async Task<IResult> GetSummary(
        ISender sender, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var summary = await sender.Send(new GetTransactionSummaryQuery { From = from, To = to }, ct);
        return Results.Ok(summary);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetTransactionByIdQuery(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Transaction not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Create(
        CreateTransactionRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateTransactionCommand
        {
            Date = request.Date,
            Description = request.Description,
            Amount = request.Amount,
            Type = request.Type,
            AccountId = request.AccountId,
            CategoryId = request.CategoryId,
            Reference = request.Reference,
            Notes = request.Notes,
            TaxCodeId = request.TaxCodeId,
            TaxRate = request.TaxRate,
            ActivityAreaId = request.ActivityAreaId,
            UserName = GetUserName(httpContext)
        }, ct);
        return Results.Created($"/api/v1/finance/transactions/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateTransactionRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateTransactionCommand
        {
            Id = id,
            Date = request.Date,
            Description = request.Description,
            Amount = request.Amount,
            Type = request.Type,
            AccountId = request.AccountId,
            CategoryId = request.CategoryId,
            Reference = request.Reference,
            Notes = request.Notes,
            TaxCodeId = request.TaxCodeId,
            TaxRate = request.TaxRate,
            ActivityAreaId = request.ActivityAreaId,
            UserName = GetUserName(httpContext)
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Transaction not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteTransactionCommand(id, GetUserName(httpContext)), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Transaction not found." });
    }

    private static async Task<IResult> AttachReceipt(
        Guid id, AttachReceiptRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new AttachReceiptToTransactionCommand(id, request.ReceiptId), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Transaction or receipt not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> DetachReceipt(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new DetachReceiptFromTransactionCommand(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Transaction not found." })
            : Results.Ok(dto);
    }

    // DTOs
    public sealed record CreateTransactionRequest(DateTime Date, string Description, decimal Amount,
        string Type, Guid AccountId, Guid? CategoryId, string? Reference, string? Notes,
        Guid? TaxCodeId = null, decimal? TaxRate = null, Guid? ActivityAreaId = null);
    public sealed record UpdateTransactionRequest(DateTime Date, string Description, decimal Amount,
        string Type, Guid AccountId, Guid? CategoryId, string? Reference, string? Notes,
        Guid? TaxCodeId = null, decimal? TaxRate = null, Guid? ActivityAreaId = null);
    public sealed record AttachReceiptRequest(Guid ReceiptId);
}
