using IabConnect.Application.Finance.InvoiceTemplates.Commands;
using IabConnect.Application.Finance.InvoiceTemplates.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for invoice template management (REQ-064)
/// </summary>
public static class InvoiceTemplateEndpoints
{
    public static void MapInvoiceTemplateEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/invoice-templates")
            .WithTags("Finance - Invoice Templates");

        group.MapGet("/", GetAll)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetInvoiceTemplates")
            .WithSummary("List invoice templates")
            .WithDescription("REQ-064: Returns all invoice templates, optionally filtered by jurisdiction.");

        group.MapGet("/{id:guid}", GetById)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetInvoiceTemplateById")
            .WithSummary("Get invoice template by ID")
            .WithDescription("REQ-064: Returns a single invoice template.");

        group.MapPost("/", Create)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("CreateInvoiceTemplate")
            .WithSummary("Create an invoice template")
            .WithDescription("REQ-064: Creates a new configurable invoice template with EU compliance fields.");

        group.MapPut("/{id:guid}", Update)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("UpdateInvoiceTemplate")
            .WithSummary("Update an invoice template")
            .WithDescription("REQ-064: Updates an existing invoice template.");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireFinanceWrite")
            .WithName("DeleteInvoiceTemplate")
            .WithSummary("Delete an invoice template")
            .WithDescription("REQ-064: Permanently deletes an invoice template.");
    }

    private static async Task<IResult> GetAll(
        ISender sender, string? jurisdiction = null, CancellationToken ct = default)
    {
        var templates = await sender.Send(new GetInvoiceTemplatesQuery(jurisdiction), ct);
        return Results.Ok(templates);
    }

    private static async Task<IResult> GetById(
        Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetInvoiceTemplateByIdQuery(id), ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice template not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Create(
        CreateInvoiceTemplateRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateInvoiceTemplateCommand
        {
            Name = request.Name,
            Jurisdiction = request.Jurisdiction,
            CountryCode = request.CountryCode,
            IsDefault = request.IsDefault,
            ShowVatId = request.ShowVatId,
            ShowTaxExemptionNote = request.ShowTaxExemptionNote,
            TaxExemptionNote = request.TaxExemptionNote,
            ShowReverseChargeNote = request.ShowReverseChargeNote,
            ReverseChargeNote = request.ReverseChargeNote,
            ShowPaymentTerms = request.ShowPaymentTerms,
            DefaultPaymentTerms = request.DefaultPaymentTerms,
            ShowBankDetails = request.ShowBankDetails,
            LogoUrl = request.LogoUrl,
            HeaderText = request.HeaderText,
            FooterText = request.FooterText,
            LegalNotice = request.LegalNotice,
            Language = request.Language
        }, ct);
        return Results.Created($"/api/v1/finance/invoice-templates/{dto.Id}", dto);
    }

    private static async Task<IResult> Update(
        Guid id, UpdateInvoiceTemplateRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateInvoiceTemplateCommand
        {
            Id = id,
            Name = request.Name,
            IsDefault = request.IsDefault,
            ShowVatId = request.ShowVatId,
            ShowTaxExemptionNote = request.ShowTaxExemptionNote,
            TaxExemptionNote = request.TaxExemptionNote,
            ShowReverseChargeNote = request.ShowReverseChargeNote,
            ReverseChargeNote = request.ReverseChargeNote,
            ShowPaymentTerms = request.ShowPaymentTerms,
            DefaultPaymentTerms = request.DefaultPaymentTerms,
            ShowBankDetails = request.ShowBankDetails,
            LogoUrl = request.LogoUrl,
            HeaderText = request.HeaderText,
            FooterText = request.FooterText,
            LegalNotice = request.LegalNotice,
            Language = request.Language
        }, ct);
        return dto is null
            ? Results.NotFound(new { Message = "Invoice template not found." })
            : Results.Ok(dto);
    }

    private static async Task<IResult> Delete(Guid id, ISender sender, CancellationToken ct)
    {
        var found = await sender.Send(new DeleteInvoiceTemplateCommand(id), ct);
        return found ? Results.NoContent() : Results.NotFound(new { Message = "Invoice template not found." });
    }

    // DTOs
    public sealed record CreateInvoiceTemplateRequest(
        string Name, string Jurisdiction, string? CountryCode, bool IsDefault,
        bool ShowVatId, bool ShowTaxExemptionNote, string? TaxExemptionNote,
        bool ShowReverseChargeNote, string? ReverseChargeNote,
        bool ShowPaymentTerms, string? DefaultPaymentTerms, bool ShowBankDetails,
        string? LogoUrl, string? HeaderText, string? FooterText, string? LegalNotice,
        string Language);

    public sealed record UpdateInvoiceTemplateRequest(
        string Name, bool IsDefault,
        bool ShowVatId, bool ShowTaxExemptionNote, string? TaxExemptionNote,
        bool ShowReverseChargeNote, string? ReverseChargeNote,
        bool ShowPaymentTerms, string? DefaultPaymentTerms, bool ShowBankDetails,
        string? LogoUrl, string? HeaderText, string? FooterText, string? LegalNotice,
        string Language);
}
