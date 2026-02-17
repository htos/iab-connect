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
/// Query to get all invoice templates, optionally filtered by jurisdiction (REQ-064)
/// </summary>
public sealed record GetInvoiceTemplatesQuery(string? Jurisdiction = null) : IRequest<List<InvoiceTemplateDto>>;
