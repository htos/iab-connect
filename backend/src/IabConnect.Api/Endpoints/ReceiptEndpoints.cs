using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for receipt management (REQ-043)
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
            .WithDescription("REQ-043: Returns all receipts.");

        group.MapPost("/", Upload)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UploadReceipt")
            .WithSummary("Upload a receipt")
            .WithDescription("REQ-043: Stores receipt metadata. File upload to storage is TODO.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetReceipt")
            .WithSummary("Get receipt info")
            .WithDescription("REQ-043: Returns receipt metadata.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteReceipt")
            .WithSummary("Delete a receipt")
            .WithDescription("REQ-043: Deletes a receipt. Audited.");
    }

    private static async Task<IResult> GetAll(
        IReceiptRepository repository,
        CancellationToken ct)
    {
        var receipts = await repository.GetAllAsync(ct);
        return Results.Ok(receipts.Select(r =>
            new ReceiptResponse(r.Id, r.FileName, r.FilePath,
                r.ContentType, r.FileSize, r.UploadedAt,
                r.UploadedBy, r.Notes)).ToList());
    }

    private static async Task<IResult> Upload(
        UploadReceiptRequest request,
        IReceiptRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        // TODO: Actual file upload to storage; for now store metadata only
        var receipt = Receipt.Create(
            request.FileName,
            $"receipts/{Guid.NewGuid()}/{request.FileName}",
            request.ContentType,
            request.FileSize,
            userName ?? "system",
            request.Notes);

        await repository.AddAsync(receipt, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Receipt '{receipt.FileName}' uploaded",
            entityType: "Receipt",
            entityId: receipt.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/receipts/{receipt.Id}",
            new ReceiptResponse(receipt.Id, receipt.FileName, receipt.FilePath,
                receipt.ContentType, receipt.FileSize, receipt.UploadedAt,
                receipt.UploadedBy, receipt.Notes));
    }

    private static async Task<IResult> GetById(
        Guid id,
        IReceiptRepository repository,
        CancellationToken ct)
    {
        var receipt = await repository.GetByIdAsync(id, ct);
        if (receipt is null)
            return Results.NotFound(new { Message = "Receipt not found." });

        return Results.Ok(new ReceiptResponse(receipt.Id, receipt.FileName, receipt.FilePath,
            receipt.ContentType, receipt.FileSize, receipt.UploadedAt,
            receipt.UploadedBy, receipt.Notes));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IReceiptRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var receipt = await repository.GetByIdAsync(id, ct);
        if (receipt is null)
            return Results.NotFound(new { Message = "Receipt not found." });

        var fileName = receipt.FileName;
        await repository.DeleteAsync(id, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Receipt '{fileName}' deleted",
            entityType: "Receipt",
            entityId: id.ToString(),
            ct: ct);

        return Results.NoContent();
    }

    // DTOs
    public sealed record UploadReceiptRequest(string FileName, string ContentType, long FileSize, string? Notes);
    public sealed record ReceiptResponse(Guid Id, string FileName, string FilePath,
        string ContentType, long FileSize, DateTime UploadedAt, string UploadedBy, string? Notes);
}
