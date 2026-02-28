using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Queries;

public sealed class GetInvoiceTemplatesQueryHandler : IRequestHandler<GetInvoiceTemplatesQuery, PagedResult<InvoiceTemplateDto>>
{
    private readonly IInvoiceTemplateRepository _repository;

    public GetInvoiceTemplatesQueryHandler(IInvoiceTemplateRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<InvoiceTemplateDto>> Handle(GetInvoiceTemplatesQuery request, CancellationToken ct)
    {
        Jurisdiction? jurisdiction = null;
        if (!string.IsNullOrWhiteSpace(request.Jurisdiction) &&
            Enum.TryParse<Jurisdiction>(request.Jurisdiction, ignoreCase: true, out var parsed))
        {
            jurisdiction = parsed;
        }

        var templates = await _repository.GetAllAsync(jurisdiction, ct);
        var dtos = templates.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "name", false);
        var sorted = field.ToLowerInvariant() switch
        {
            "jurisdiction" => dtos.ApplySort(t => t.Jurisdiction, desc),
            _ => dtos.ApplySort(t => t.Name, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static InvoiceTemplateDto MapToDto(InvoiceTemplate t) =>
        new(t.Id, t.Name, t.Jurisdiction.ToString(), t.CountryCode, t.IsDefault,
            t.ShowVatId, t.ShowTaxExemptionNote, t.TaxExemptionNote,
            t.ShowReverseChargeNote, t.ReverseChargeNote,
            t.ShowPaymentTerms, t.DefaultPaymentTerms, t.ShowBankDetails,
            t.LogoUrl, t.HeaderText, t.FooterText, t.LegalNotice,
            t.Language);
}
