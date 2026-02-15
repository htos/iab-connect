using System.Security.Claims;
using IabConnect.Application.Finance.Receipts.Commands;
using IabConnect.Application.Finance.Receipts.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for receipt management (REQ-043 / REQ-061)
/// Supports actual file upload/download via S3-compatible storage (RustFS).
/// </summary>
public static class ReceiptEndpoints
{
    public static void MapReceiptEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/receipts")
            .WithTags("Finance - Receipts");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetAllReceipts")
            .WithSummary("List all receipts")
            .WithDescription("REQ-043: Returns all receipts with download URLs.");

        group.MapPost("/", Upload)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UploadReceipt")
            .WithSummary("Upload a receipt")
            .WithDescription("REQ-061: Uploads a receipt file (PDF, JPG, PNG, TIFF; max 10 MB) with metadata.")
            .DisableAntiforgery();

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetReceipt")
            .WithSummary("Get receipt info")
            .WithDescription("REQ-043: Returns receipt metadata with download URL.");

        group.MapGet("/{id:guid}/download", Download)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("DownloadReceipt")
            .WithSummary("Download receipt file")
            .WithDescription("REQ-061: Downloads the actual receipt file from storage.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteReceipt")
            .WithSummary("Delete a receipt")
            .WithDescription("REQ-043: Soft-deletes receipt metadata and marks file for cleanup. Audited.");
    }

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(ISender sender, CancellationToken ct)
    {
        var receipts = await sender.Send(new GetReceiptsQuery(), ct);
        return Results.Ok(receipts);
    }

    private static async Task<IResult> Upload(
        IFormFile file, string? notes, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { Message = "No file provided." });

        await using var stream = file.OpenReadStream();
        var dto = await sender.Send(new UploadReceiptCommand
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            FileSize = file.Length,
            FileStream = stream,
            Notes = notes,
            UserName = GetUserName(httpContext)
        }, ct);
        return Results.Created($"/api/v1/finance/receipts/{dto.Id}", dto);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetReceiptByIdQuery(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Receipt not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Download(Guid id, ISender sender, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new DownloadReceiptQuery(id), ct);
            return result is null
                ? Results.NotFound(new { Message = "Receipt not found." })
                : Results.File(result.Stream, result.ContentType, result.FileName);
        }
        catch (Amazon.S3.AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return Results.NotFound(new { Message = "Receipt file not found in storage." });
        }
    }

    private static async Task<IResult> Delete(
        Guid id, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteReceiptCommand(id, GetUserName(httpContext)), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Receipt not found." });
    }
}
