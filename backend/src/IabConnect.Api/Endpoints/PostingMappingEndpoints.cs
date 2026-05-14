using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Application.Finance.Accounting.PostingMappings;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-077/082: CRUD endpoints for posting mappings (subledger → GL account mappings).
/// </summary>
public static class PostingMappingEndpoints
{
    public static WebApplication MapPostingMappingEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/finance/posting-mappings")
            .WithTags("Finance - Posting Mappings")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", async (ISender sender, CancellationToken ct) =>
        {
            var mappings = await sender.Send(new GetPostingMappingsQuery(), ct);
            return Results.Ok(new { items = mappings });
        })
        .WithName("GetPostingMappings")
        .WithDescription("REQ-082: List all posting mappings")
        .RequireAuthorization("RequireFinanceRead");

        group.MapPost("/", async (CreatePostingMappingRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new CreatePostingMappingCommand
            {
                MappingType = body.MappingType,
                SourceId = body.SourceId,
                LedgerAccountId = body.LedgerAccountId,
                TaxLedgerAccountId = body.TaxLedgerAccountId,
                UserName = ctx.GetUserName()
            }, ct);
            return Results.Created($"/api/v1/finance/posting-mappings/{dto.Id}", dto);
        })
        .WithName("CreatePostingMapping")
        .WithDescription("REQ-082: Create a new posting mapping")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapPut("/{id:guid}", async (Guid id, UpdatePostingMappingRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new UpdatePostingMappingCommand
            {
                Id = id,
                LedgerAccountId = body.LedgerAccountId,
                TaxLedgerAccountId = body.TaxLedgerAccountId,
                UserName = ctx.GetUserName()
            }, ct);
            return dto is null
                ? Results.NotFound(new { Message = $"Posting mapping {id} not found." })
                : Results.Ok(dto);
        })
        .WithName("UpdatePostingMapping")
        .WithDescription("REQ-082: Update a posting mapping")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender, CancellationToken ct) =>
        {
            var result = await sender.Send(new DeletePostingMappingCommand { Id = id }, ct);
            return result ? Results.NoContent() : Results.NotFound(new { Message = $"Posting mapping {id} not found." });
        })
        .WithName("DeletePostingMapping")
        .WithDescription("REQ-082: Delete a posting mapping")
        .RequireAuthorization("RequireFinanceWrite");

        return app;
    }

    // Request DTOs
    public sealed record CreatePostingMappingRequest(
        string MappingType, Guid SourceId, Guid LedgerAccountId, Guid? TaxLedgerAccountId);

    public sealed record UpdatePostingMappingRequest(
        Guid LedgerAccountId, Guid? TaxLedgerAccountId);
}
