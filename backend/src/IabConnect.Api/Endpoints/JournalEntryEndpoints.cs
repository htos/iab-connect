using IabConnect.Api.Extensions;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Application.Finance.Accounting.JournalEntries.Commands;
using IabConnect.Application.Finance.Accounting.JournalEntries.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-076: Endpoints for journal entries (Buchungssätze).
/// </summary>
public static class JournalEntryEndpoints
{
    public static WebApplication MapJournalEntryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/finance/journal-entries")
            .WithTags("Finance - Journal Entries")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/", async (DateTime? from, DateTime? to, string? status, ISender sender, CancellationToken ct) =>
        {
            var entries = await sender.Send(new GetJournalEntriesQuery
            {
                From = from,
                To = to,
                Status = status
            }, ct);
            return Results.Ok(new { items = entries });
        })
        .WithName("GetJournalEntries")
        .WithDescription("REQ-076: List journal entries with optional filters")
        .RequireAuthorization("RequireFinanceRead");

        group.MapGet("/{id:guid}", async (Guid id, ISender sender, CancellationToken ct) =>
        {
            var entry = await sender.Send(new GetJournalEntryByIdQuery(id), ct);
            return entry is null
                ? Results.NotFound(new { Message = $"Journal entry {id} not found." })
                : Results.Ok(entry);
        })
        .WithName("GetJournalEntryById")
        .WithDescription("REQ-076: Get journal entry details with lines")
        .RequireAuthorization("RequireFinanceRead");

        group.MapGet("/by-source/{sourceType}/{sourceId:guid}", async (string sourceType, Guid sourceId, ISender sender, CancellationToken ct) =>
        {
            var entries = await sender.Send(new GetJournalEntriesBySourceQuery(sourceType, sourceId), ct);
            return Results.Ok(new { items = entries });
        })
        .WithName("GetJournalEntriesBySource")
        .WithDescription("REQ-083: Get journal entries linked to a source entity")
        .RequireAuthorization("RequireFinanceRead");

        group.MapPost("/", async (CreateJournalEntryRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var lines = body.Lines.Select(l => new CreateJournalEntryLineItem(
                l.LedgerAccountId, l.DebitAmount, l.CreditAmount,
                l.TaxCodeId, l.NetAmount, l.TaxAmount, l.ActivityAreaId)).ToList();

            var dto = await sender.Send(new CreateJournalEntryCommand
            {
                Date = body.Date,
                Description = body.Description,
                Reference = body.Reference,
                Lines = lines,
                UserName = ctx.GetUserName()
            }, ct);
            return Results.Created($"/api/v1/finance/journal-entries/{dto.Id}", dto);
        })
        .WithName("CreateJournalEntry")
        .WithDescription("REQ-076: Create a new manual journal entry (Draft)")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapPost("/{id:guid}/post", async (Guid id, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new PostJournalEntryCommand
            {
                Id = id,
                UserName = ctx.GetUserName()
            }, ct);
            return dto is null
                ? Results.NotFound(new { Message = $"Journal entry {id} not found." })
                : Results.Ok(dto);
        })
        .WithName("PostJournalEntry")
        .WithDescription("REQ-076: Post a draft journal entry (validates balanced)")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapPut("/{id:guid}", async (Guid id, UpdateJournalEntryRequest body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var lines = body.Lines.Select(l => new CreateJournalEntryLineItem(
                l.LedgerAccountId, l.DebitAmount, l.CreditAmount,
                l.TaxCodeId, l.NetAmount, l.TaxAmount, l.ActivityAreaId)).ToList();

            var dto = await sender.Send(new UpdateJournalEntryCommand
            {
                Id = id,
                Date = body.Date,
                Description = body.Description,
                Reference = body.Reference,
                Lines = lines,
                UserName = ctx.GetUserName()
            }, ct);
            return dto is null
                ? Results.NotFound(new { Message = $"Journal entry {id} not found." })
                : Results.Ok(dto);
        })
        .WithName("UpdateJournalEntry")
        .WithDescription("REQ-076: Update a draft journal entry")
        .RequireAuthorization("RequireFinanceWrite");

        group.MapPost("/{id:guid}/reverse", async (Guid id, ReverseJournalEntryRequest? body, ISender sender, HttpContext ctx, CancellationToken ct) =>
        {
            var dto = await sender.Send(new ReverseJournalEntryCommand
            {
                Id = id,
                Reason = body?.Reason,
                UserName = ctx.GetUserName()
            }, ct);
            return dto is null
                ? Results.NotFound(new { Message = $"Journal entry {id} not found." })
                : Results.Created($"/api/v1/finance/journal-entries/{dto.Id}", dto);
        })
        .WithName("ReverseJournalEntry")
        .WithDescription("REQ-078: Create a reversal (Storno) for a posted entry")
        .RequireAuthorization("RequireFinanceWrite");

        return app;
    }

    // Request DTOs
    public sealed record CreateJournalEntryRequest(
        DateTime Date, string Description, string? Reference,
        List<CreateJournalEntryLineRequest> Lines);

    public sealed record CreateJournalEntryLineRequest(
        Guid LedgerAccountId, decimal DebitAmount, decimal CreditAmount,
        Guid? TaxCodeId, decimal? NetAmount, decimal? TaxAmount, Guid? ActivityAreaId);

    public sealed record ReverseJournalEntryRequest(string? Reason);

    public sealed record UpdateJournalEntryRequest(
        DateTime Date, string Description, string? Reference,
        List<CreateJournalEntryLineRequest> Lines);
}
