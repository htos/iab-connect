using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.BankImports.Commands;
using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

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

        group.MapPut("/{id:guid}/items/{itemId:guid}/unmatch", UnmatchItem)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UnmatchBankImportItem")
            .WithSummary("Unmatch a bank import item")
            .WithDescription("REQ-041: Reverses a previous match, deleting any auto-created transaction.");

        group.MapPost("/import-camt", ImportCamt)
            .RequireAuthorization("RequireFinanceWrite")
            .DisableAntiforgery()
            .WithName("ImportCamtFile")
            .WithSummary("Import camt.053/054 XML file")
            .WithDescription("REQ-069: Imports bank transactions from an ISO 20022 camt.053 or camt.054 XML file with auto-matching.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var imports = await sender.Send(new GetBankImportsQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(imports);
    }

    private static async Task<IResult> Upload(
        UploadBankImportRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new ImportBankFileCommand
        {
            FileName = request.FileName,
            Rows = request.Rows.Select(r => new BankImportRowInput(
                r.TransactionDate, r.Description, r.Amount, r.Iban, r.Reference)).ToList(),
            UserName = httpContext.GetUserName()
        }, ct);
        return Results.Created($"/api/v1/finance/bank-imports/{dto.Id}", dto);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetBankImportByIdQuery(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Bank import not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> MatchItem(
        Guid id, Guid itemId, MatchItemRequest request,
        ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(
            new MatchBankImportItemCommand(id, itemId, request.PaymentId, httpContext.GetUserName()), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Bank import or item not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> IgnoreItem(
        Guid id, Guid itemId, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new IgnoreBankImportItemCommand(id, itemId), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Bank import or item not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> UnmatchItem(
        Guid id, Guid itemId, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        try
        {
            var dto = await sender.Send(
                new UnmatchBankImportItemCommand(id, itemId, httpContext.GetUserName()), ct);
            return dto is null
                ? Results.NotFound(new { Message = "Bank import or item not found." })
                : Results.Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Message = ex.Message });
        }
    }

    private static async Task<IResult> ImportCamt(
        IFormFile file, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { Message = "A camt XML file is required." });

        await using var stream = file.OpenReadStream();
        var dto = await sender.Send(new ImportCamtCommand
        {
            FileName = file.FileName,
            FileStream = stream,
            UserName = httpContext.GetUserName()
        }, ct);
        return Results.Created($"/api/v1/finance/bank-imports/{dto.Id}", dto);
    }

    // DTOs
    public sealed record UploadBankImportRequest(string FileName, List<BankImportRowRequest> Rows);
    public sealed record BankImportRowRequest(DateTime TransactionDate, string Description,
        decimal Amount, string? Iban, string? Reference);
    public sealed record MatchItemRequest(Guid PaymentId);
}
