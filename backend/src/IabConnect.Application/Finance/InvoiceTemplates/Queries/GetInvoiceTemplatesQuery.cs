using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Queries;

public sealed record InvoiceTemplateDto(
    Guid Id, string Name, string Jurisdiction, string? CountryCode, bool IsDefault,
    bool ShowVatId, bool ShowTaxExemptionNote, string? TaxExemptionNote,
    bool ShowReverseChargeNote, string? ReverseChargeNote,
    bool ShowPaymentTerms, string? DefaultPaymentTerms, bool ShowBankDetails,
    string? LogoUrl, string? HeaderText, string? FooterText, string? LegalNotice,
    string Language);

/// <summary>
/// Query to get all invoice templates, optionally filtered by jurisdiction (REQ-064) with pagination
/// </summary>
public sealed record GetInvoiceTemplatesQuery(string? Jurisdiction = null) : IRequest<PagedResult<InvoiceTemplateDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
