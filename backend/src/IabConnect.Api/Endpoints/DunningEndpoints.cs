using System.Security.Claims;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for dunning notice management (REQ-042)
/// </summary>
public static class DunningEndpoints
{
    public static void MapDunningEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/dunning")
            .WithTags("Finance - Dunning");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetDunningNotices")
            .WithSummary("List all dunning notices")
            .WithDescription("REQ-042: Returns all dunning notices.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateDunningNotice")
            .WithSummary("Create a dunning notice")
            .WithDescription("REQ-042: Creates a new dunning notice for an overdue invoice. Audited.");

        group.MapPost("/{id:guid}/send", MarkAsSent)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("SendDunningNotice")
            .WithSummary("Mark dunning notice as sent")
            .WithDescription("REQ-042: Marks a dunning notice as sent. Audited.");
    }

    private static async Task<IResult> GetAll(
        IDunningNoticeRepository repository,
        CancellationToken ct)
    {
        var notices = await repository.GetAllAsync(ct);
        var response = notices.Select(MapToResponse);
        return Results.Ok(response);
    }

    private static async Task<IResult> Create(
        CreateDunningNoticeRequest request,
        IDunningNoticeRepository repository,
        IInvoiceRepository invoiceRepo,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        var invoice = await invoiceRepo.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null)
            return Results.NotFound(new { Message = "Invoice not found." });

        var notice = DunningNotice.Create(
            request.InvoiceId, request.Level, request.DueDate,
            request.Notes, userName ?? "system");

        await repository.AddAsync(notice, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Dunning notice level {notice.Level} created for invoice '{invoice.InvoiceNumber}'",
            entityType: "DunningNotice",
            entityId: notice.Id.ToString(),
            ct: ct);

        return Results.Created($"/api/v1/finance/dunning/{notice.Id}", MapToResponse(notice));
    }

    private static async Task<IResult> MarkAsSent(
        Guid id,
        IDunningNoticeRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        CancellationToken ct)
    {
        var notice = await repository.GetByIdAsync(id, ct);
        if (notice is null)
            return Results.NotFound(new { Message = "Dunning notice not found." });

        notice.MarkAsSent();

        await repository.UpdateAsync(notice, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Dunning notice level {notice.Level} marked as sent",
            entityType: "DunningNotice",
            entityId: notice.Id.ToString(),
            ct: ct);

        return Results.Ok(MapToResponse(notice));
    }

    private static DunningNoticeResponse MapToResponse(DunningNotice n) =>
        new(n.Id, n.InvoiceId, n.Level, n.Date, n.DueDate, n.Status.ToString(),
            n.SentAt, n.Notes, n.CreatedBy);

    // DTOs
    public sealed record CreateDunningNoticeRequest(Guid InvoiceId, int Level, DateTime DueDate, string? Notes);
    public sealed record DunningNoticeResponse(Guid Id, Guid InvoiceId, int Level, DateTime Date,
        DateTime DueDate, string Status, DateTime? SentAt, string? Notes, string CreatedBy);
}
