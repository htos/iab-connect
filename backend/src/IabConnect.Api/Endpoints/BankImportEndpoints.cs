using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for bank import management (REQ-041)
/// </summary>
public static class BankImportEndpoints
{
    public static void MapBankImportEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/bank-imports")
            .WithTags("Finance - Bank Imports");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetAllBankImports")
            .WithSummary("List all bank imports")
            .WithDescription("REQ-041: Returns all bank import sessions.");

        group.MapPost("/", Upload)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UploadBankImport")
            .WithSummary("Upload bank CSV data")
            .WithDescription("REQ-041: Imports bank transaction rows from a CSV-parsed payload. Audited.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetBankImport")
            .WithSummary("Get bank import with items")
            .WithDescription("REQ-041: Returns a bank import session with all its items.");

        group.MapPut("/{id:guid}/items/{itemId:guid}/match", MatchItem)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("MatchBankImportItem")
            .WithSummary("Match a bank import item to a payment")
            .WithDescription("REQ-041: Links a bank import item to an existing payment.");

        group.MapPut("/{id:guid}/items/{itemId:guid}/ignore", IgnoreItem)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("IgnoreBankImportItem")
            .WithSummary("Ignore a bank import item")
            .WithDescription("REQ-041: Marks a bank import item as ignored.");
    }

    private static async Task<IResult> GetAll(
        IBankImportRepository repository,
        CancellationToken ct)
    {
        var imports = await repository.GetAllAsync(ct);
        return Results.Ok(imports.Select(MapToResponse).ToList());
    }

    private static async Task<IResult> Upload(
        UploadBankImportRequest request,
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        var bankImport = BankImport.Create(request.FileName, userName ?? "system");

        foreach (var row in request.Rows)
        {
            var item = BankImportItem.Create(
                bankImport.Id, row.TransactionDate, row.Description,
                row.Amount, row.Iban, row.Reference);
            bankImport.AddItem(item);
        }

        await repository.AddAsync(bankImport, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Bank import '{bankImport.FileName}' uploaded with {request.Rows.Count} rows",
            entityType: "BankImport",
            entityId: bankImport.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/bank-imports/{bankImport.Id}",
            MapToResponse(bankImport));
    }

    private static async Task<IResult> GetById(
        Guid id,
        IBankImportRepository repository,
        CancellationToken ct)
    {
        var bankImport = await repository.GetByIdAsync(id, ct);
        if (bankImport is null)
            return Results.NotFound(new { Message = "Bank import not found." });

        return Results.Ok(MapToResponse(bankImport));
    }

    private static async Task<IResult> MatchItem(
        Guid id,
        Guid itemId,
        MatchItemRequest request,
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var bankImport = await repository.GetByIdAsync(id, ct);
        if (bankImport is null)
            return Results.NotFound(new { Message = "Bank import not found." });

        var item = bankImport.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null)
            return Results.NotFound(new { Message = "Bank import item not found." });

        item.MatchToPayment(request.PaymentId);

        // Check if all items are processed
        if (bankImport.Items.All(i => i.Status != BankImportItemStatus.Unmatched))
            bankImport.MarkAsProcessed();

        await repository.UpdateAsync(bankImport, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return Results.Ok(MapItemResponse(item));
    }

    private static async Task<IResult> IgnoreItem(
        Guid id,
        Guid itemId,
        IBankImportRepository repository,
        IUnitOfWork unitOfWork,
        CancellationToken ct)
    {
        var bankImport = await repository.GetByIdAsync(id, ct);
        if (bankImport is null)
            return Results.NotFound(new { Message = "Bank import not found." });

        var item = bankImport.Items.FirstOrDefault(i => i.Id == itemId);
        if (item is null)
            return Results.NotFound(new { Message = "Bank import item not found." });

        item.Ignore();

        // Check if all items are processed
        if (bankImport.Items.All(i => i.Status != BankImportItemStatus.Unmatched))
            bankImport.MarkAsProcessed();

        await repository.UpdateAsync(bankImport, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return Results.Ok(MapItemResponse(item));
    }

    private static BankImportResponse MapToResponse(BankImport bi) =>
        new(bi.Id, bi.ImportDate, bi.FileName, bi.Status.ToString(), bi.ImportedBy,
            bi.Items.Select(MapItemResponse).ToList());

    private static BankImportItemResponse MapItemResponse(BankImportItem item) =>
        new(item.Id, item.TransactionDate, item.Description, item.Amount,
            item.Iban, item.Reference, item.Status.ToString(), item.MatchedPaymentId);

    // DTOs
    public sealed record UploadBankImportRequest(string FileName, List<BankImportRowRequest> Rows);
    public sealed record BankImportRowRequest(DateTime TransactionDate, string Description,
        decimal Amount, string? Iban, string? Reference);
    public sealed record MatchItemRequest(Guid PaymentId);
    public sealed record BankImportResponse(Guid Id, DateTime ImportDate, string FileName,
        string Status, string ImportedBy, List<BankImportItemResponse> Items);
    public sealed record BankImportItemResponse(Guid Id, DateTime TransactionDate, string Description,
        decimal Amount, string? Iban, string? Reference, string Status, Guid? MatchedPaymentId);
}
