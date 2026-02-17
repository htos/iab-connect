using IabConnect.Application.Finance.InvoiceTemplates.Queries;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

/// <summary>
/// Command to update an existing invoice template (REQ-064)
/// </summary>
public sealed record UpdateInvoiceTemplateCommand : IRequest<InvoiceTemplateDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public bool IsDefault { get; init; }
    public bool ShowVatId { get; init; } = true;
    public bool ShowTaxExemptionNote { get; init; }
    public string? TaxExemptionNote { get; init; }
    public bool ShowReverseChargeNote { get; init; }
    public string? ReverseChargeNote { get; init; }
    public bool ShowPaymentTerms { get; init; } = true;
    public string? DefaultPaymentTerms { get; init; }
    public bool ShowBankDetails { get; init; } = true;
    public string? LogoUrl { get; init; }
    public string? HeaderText { get; init; }
    public string? FooterText { get; init; }
    public string? LegalNotice { get; init; }
    public string Language { get; init; } = "en";
}
