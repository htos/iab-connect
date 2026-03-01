using IabConnect.Application.Finance.ExpenseClaims;
using IabConnect.Application.Finance.ExpenseClaims.Commands;
using IabConnect.Application.Finance.ExpenseClaims.Queries;
using MediatR;
using IabConnect.Api.Extensions;

namespace IabConnect.Api.Endpoints;

public static class ExpenseClaimEndpoints
{
    public static void MapExpenseClaimEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/expense-claims")
            .WithTags("Finance - Expense Claims");

        // Anyone with member role can create their own claims
        group.MapGet("/", GetAll).RequireAuthorization("RequireFinanceRead");
        group.MapGet("/{id:guid}", GetById).RequireAuthorization("RequireFinanceRead");
        group.MapPost("/", Create).RequireAuthorization("RequireMember");
        group.MapPut("/{id:guid}", Update).RequireAuthorization("RequireMember");
        group.MapDelete("/{id:guid}", Delete).RequireAuthorization("RequireMember");
        group.MapPost("/{id:guid}/submit", Submit).RequireAuthorization("RequireMember");
        group.MapPost("/{id:guid}/review", Review).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/approve", Approve).RequireAuthorization("RequireVorstand");
        group.MapPost("/{id:guid}/reject", Reject).RequireAuthorization("RequireFinanceWrite");
        group.MapPost("/{id:guid}/reimburse", Reimburse).RequireAuthorization("RequireFinanceWrite");
    }

    // GET all with optional filters
    private static async Task<IResult> GetAll(
        [AsParameters] ExpenseClaimFilterRequest filter,
        ISender sender)
    {
        IabConnect.Domain.Finance.ExpenseClaimStatus? parsedStatus = null;
        if (filter.Status is not null)
        {
            if (!Enum.TryParse<IabConnect.Domain.Finance.ExpenseClaimStatus>(filter.Status, true, out var s))
                return Results.BadRequest(new { Message = $"Invalid status value: {filter.Status}" });
            parsedStatus = s;
        }

        var query = new GetExpenseClaimsQuery(parsedStatus, filter.ClaimantId)
        {
            Page = filter.Page ?? 1,
            PageSize = filter.PageSize ?? 20,
            Sort = filter.Sort,
            Filter = filter.Filter
        };
        var result = await sender.Send(query);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetById(Guid id, ISender sender)
    {
        var result = await sender.Send(new GetExpenseClaimByIdQuery(id));
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Create(CreateExpenseClaimRequest request, HttpContext ctx, ISender sender)
    {
        var command = new CreateExpenseClaimCommand
        {
            Title = request.Title,
            Description = request.Description,
            Amount = request.Amount,
            Currency = request.Currency,
            Date = request.Date,
            ClaimantId = ctx.GetUserId(),
            ClaimantName = ctx.GetUserName(),
            ReceiptId = request.ReceiptId,
            UserName = ctx.GetUserName()
        };
        var result = await sender.Send(command);
        return Results.Created($"/api/v1/finance/expense-claims/{result.Id}", result);
    }

    private static async Task<IResult> Update(Guid id, UpdateExpenseClaimRequest request, HttpContext ctx, ISender sender)
    {
        var command = new UpdateExpenseClaimCommand
        {
            Id = id,
            Title = request.Title,
            Description = request.Description,
            Amount = request.Amount,
            Date = request.Date,
            ReceiptId = request.ReceiptId,
            UserName = ctx.GetUserName()
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Delete(Guid id, HttpContext ctx, ISender sender)
    {
        var command = new DeleteExpenseClaimCommand(id, ctx.GetUserName());
        var result = await sender.Send(command);
        return result ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> Submit(Guid id, HttpContext ctx, ISender sender)
    {
        var command = new SubmitExpenseClaimCommand(id, ctx.GetUserName());
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Review(Guid id, ReviewExpenseClaimRequest? request, HttpContext ctx, ISender sender)
    {
        var command = new ReviewExpenseClaimCommand(id, request?.Comment, ctx.GetUserName());
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Approve(Guid id, ApproveExpenseClaimRequest? request, HttpContext ctx, ISender sender)
    {
        var command = new ApproveExpenseClaimCommand(id, request?.Comment, ctx.GetUserName());
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Reject(Guid id, RejectExpenseClaimRequest request, HttpContext ctx, ISender sender)
    {
        var command = new RejectExpenseClaimCommand(id, request.Reason, ctx.GetUserName());
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> Reimburse(Guid id, ReimburseExpenseClaimRequest request, HttpContext ctx, ISender sender)
    {
        var command = new ReimburseExpenseClaimCommand
        {
            Id = id,
            Method = request.Method,
            Reference = request.Reference,
            Notes = request.Notes,
            UserName = ctx.GetUserName()
        };
        var result = await sender.Send(command);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    // Request records
    public sealed record ExpenseClaimFilterRequest(
        string? Status = null, Guid? ClaimantId = null,
        int? Page = null, int? PageSize = null, string? Sort = null, string? Filter = null);
    public sealed record CreateExpenseClaimRequest(string Title, string Description, decimal Amount, string Currency, DateTime Date, Guid? ReceiptId);
    public sealed record UpdateExpenseClaimRequest(string Title, string Description, decimal Amount, DateTime Date, Guid? ReceiptId);
    public sealed record ReviewExpenseClaimRequest(string? Comment);
    public sealed record ApproveExpenseClaimRequest(string? Comment);
    public sealed record RejectExpenseClaimRequest(string Reason);
    public sealed record ReimburseExpenseClaimRequest(string Method, string? Reference, string? Notes);
}
