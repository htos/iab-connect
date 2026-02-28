using IabConnect.Application.Finance.TaxCodes.Commands;
using IabConnect.Application.Finance.TaxCodes.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for tax code management (REQ-062)
/// </summary>
public static class TaxCodeEndpoints
{
    public static void MapTaxCodeEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/tax-codes")
            .WithTags("Finance - Tax Codes");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetTaxCodes")
            .WithSummary("List active tax codes")
            .WithDescription("REQ-062: Returns all active (non-deleted) tax codes.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateTaxCode")
            .WithSummary("Create a tax code")
            .WithDescription("REQ-062: Creates a new configurable tax code. Rate is a decimal 0-1 (e.g. 0.081 for 8.1%).");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateTaxCode")
            .WithSummary("Update a tax code")
            .WithDescription("REQ-062: Updates an existing tax code.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteTaxCode")
            .WithSummary("Soft-delete a tax code")
            .WithDescription("REQ-062: Soft-deletes a tax code.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, int? page, int? pageSize, string? sort, string? filter, CancellationToken ct)
    {
        var taxCodes = await sender.Send(new GetTaxCodesQuery
        {
            Page = page ?? 1,
            PageSize = pageSize ?? 20,
            Sort = sort,
            Filter = filter
        }, ct);
        return Results.Ok(taxCodes);
    }

    private static async Task<IResult> Create(
        CreateTaxCodeRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateTaxCodeCommand
        {
            Code = request.Code,
            Label = request.Label,
            Rate = request.Rate,
            IsDefault = request.IsDefault
        }, ct);
        return Results.Created($"/api/v1/finance/tax-codes/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateTaxCodeRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateTaxCodeCommand
        {
            Id = id,
            Code = request.Code,
            Label = request.Label,
            Rate = request.Rate,
            IsDefault = request.IsDefault,
            IsActive = request.IsActive
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Tax code not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(Guid id, ISender sender, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteTaxCodeCommand(id), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Tax code not found." });
    }

    // DTOs
    public sealed record CreateTaxCodeRequest(string Code, string Label, decimal Rate, bool IsDefault);
    public sealed record UpdateTaxCodeRequest(string Code, string Label, decimal Rate, bool IsDefault, bool IsActive);
}
