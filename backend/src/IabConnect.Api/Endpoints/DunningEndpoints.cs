using System.Security.Claims;
using IabConnect.Application.Finance.DunningNotices.Commands;
using IabConnect.Application.Finance.DunningNotices.Queries;
using MediatR;

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

    private static string GetUserName(HttpContext ctx) =>
        ctx.User.FindFirst("preferred_username")?.Value
        ?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
        ?? "system";

    private static async Task<IResult> GetAll(
        ISender sender, Guid? invoiceId, int? page, int? pageSize, string? sort, string? filter,
        CancellationToken ct)
    {
        var notices = await sender.Send(new GetDunningNoticesQuery(invoiceId)
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(notices);
    }

    private static async Task<IResult> Create(
        CreateDunningNoticeRequest request, ISender sender,
        HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateDunningNoticeCommand
        {
            InvoiceId = request.InvoiceId,
            Level = request.Level,
            DueDate = request.DueDate,
            Notes = request.Notes,
            UserName = GetUserName(httpContext)
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice not found." })
            : Results.Created($"/api/v1/finance/dunning/{dto.Id}", dto);
    }

    private static async Task<IResult> MarkAsSent(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new SendDunningNoticeCommand(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Dunning notice not found." })
            : Results.Ok(dto);
    }

    // DTOs
    public sealed record CreateDunningNoticeRequest(Guid InvoiceId, int Level, DateTime DueDate, string? Notes);
}
