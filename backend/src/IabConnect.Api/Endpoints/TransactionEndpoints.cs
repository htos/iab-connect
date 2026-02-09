using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

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
    }

    private static async Task<IResult> GetAll(
        ITransactionRepository repository,
        DateTime? from, DateTime? to, string? type,
        CancellationToken ct)
    {
        TransactionType? txType = null;
        if (!string.IsNullOrEmpty(type) && Enum.TryParse<TransactionType>(type, true, out var parsed))
            txType = parsed;

        var transactions = await repository.GetAllAsync(from, to, txType, ct);
        var response = transactions.Select(MapToResponse);
        return Results.Ok(response);
    }

    private static async Task<IResult> GetSummary(
        ITransactionRepository repository,
        DateTime? from, DateTime? to,
        CancellationToken ct)
    {
        var (totalIncome, totalExpense) = await repository.GetSummaryAsync(from, to, ct);
        return Results.Ok(new TransactionSummaryResponse(totalIncome, totalExpense, totalIncome - totalExpense));
    }

    private static async Task<IResult> GetById(
        Guid id,
        ITransactionRepository repository,
        CancellationToken ct)
    {
        var transaction = await repository.GetByIdAsync(id, ct);
        if (transaction is null)
            return Results.NotFound(new { Message = "Transaction not found." });

        return Results.Ok(MapToResponse(transaction));
    }

    private static async Task<IResult> Create(
        CreateTransactionRequest request,
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<TransactionType>(request.Type, true, out var txType))
            return Results.BadRequest(new { Message = $"Invalid transaction type '{request.Type}'." });

        var transaction = Transaction.Create(
            request.Date, request.Description, request.Amount, txType,
            request.AccountId, request.CategoryId, request.Reference,
            request.Notes, userName ?? "system");

        await repository.AddAsync(transaction, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Transaction '{transaction.Description}' ({transaction.Amount:N2}) created",
            entityType: "Transaction",
            entityId: transaction.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/transactions/{transaction.Id}", MapToResponse(transaction));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateTransactionRequest request,
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var transaction = await repository.GetByIdAsync(id, ct);
        if (transaction is null)
            return Results.NotFound(new { Message = "Transaction not found." });

        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        if (!Enum.TryParse<TransactionType>(request.Type, true, out var txType))
            return Results.BadRequest(new { Message = $"Invalid transaction type '{request.Type}'." });

        transaction.Update(
            request.Date, request.Description, request.Amount, txType,
            request.AccountId, request.CategoryId, request.Reference,
            request.Notes, userName ?? "system");

        await repository.UpdateAsync(transaction, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Transaction '{transaction.Description}' updated",
            entityType: "Transaction",
            entityId: transaction.Id.ToString(),
            ct: ct);

        return Results.Ok(MapToResponse(transaction));
    }

    private static async Task<IResult> Delete(
        Guid id,
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var transaction = await repository.GetByIdAsync(id, ct);
        if (transaction is null)
            return Results.NotFound(new { Message = "Transaction not found." });

        var description = transaction.Description;
        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Transaction '{description}' deleted",
            entityType: "Transaction",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    private static TransactionResponse MapToResponse(Transaction t) =>
        new(t.Id, t.Date, t.Description, t.Amount, t.Type.ToString(),
            t.AccountId, t.CategoryId, t.Reference, t.Notes, t.ReceiptId,
            t.CreatedAt, t.CreatedBy, t.UpdatedAt, t.UpdatedBy);

    // DTOs
    public sealed record CreateTransactionRequest(DateTime Date, string Description, decimal Amount,
        string Type, Guid AccountId, Guid? CategoryId, string? Reference, string? Notes);
    public sealed record UpdateTransactionRequest(DateTime Date, string Description, decimal Amount,
        string Type, Guid AccountId, Guid? CategoryId, string? Reference, string? Notes);
    public sealed record TransactionResponse(Guid Id, DateTime Date, string Description, decimal Amount,
        string Type, Guid AccountId, Guid? CategoryId, string? Reference, string? Notes, Guid? ReceiptId,
        DateTime CreatedAt, string CreatedBy, DateTime? UpdatedAt, string? UpdatedBy);
    public sealed record TransactionSummaryResponse(decimal TotalIncome, decimal TotalExpense, decimal Balance);
}
