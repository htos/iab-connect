using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GenerateInvoicePdfQueryHandler : IRequestHandler<GenerateInvoicePdfQuery, InvoicePdfResult?>
{
    private readonly IInvoiceRepository _repository;
    private readonly IInvoicePdfGeneratorFactory _pdfGeneratorFactory;
    private readonly IInvoiceTemplateRepository _templateRepository;
    private readonly IFinanceProfileRepository _profileRepository;

    public GenerateInvoicePdfQueryHandler(
        IInvoiceRepository repository,
        IInvoicePdfGeneratorFactory pdfGeneratorFactory,
        IInvoiceTemplateRepository templateRepository,
        IFinanceProfileRepository profileRepository)
    {
        _repository = repository;
        _pdfGeneratorFactory = pdfGeneratorFactory;
        _templateRepository = templateRepository;
        _profileRepository = profileRepository;
    }

    public async Task<InvoicePdfResult?> Handle(GenerateInvoicePdfQuery request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Draft)
            throw new InvalidOperationException("Cannot generate PDF for draft invoices.");

        // REQ-064: Resolve invoice template (explicit > default for jurisdiction)
        InvoiceTemplate? template = null;
        if (invoice.TemplateId.HasValue)
        {
            template = await _templateRepository.GetByIdAsync(invoice.TemplateId.Value, ct);
        }

        if (template is null)
        {
            var profile = await _profileRepository.GetActiveProfileAsync(ct);
            if (profile is not null)
            {
                template = await _templateRepository.GetDefaultForJurisdictionAsync(profile.Jurisdiction, ct);
            }
        }

        var pdfGenerator = await _pdfGeneratorFactory.GetGeneratorAsync();
        var pdfBytes = await pdfGenerator.GenerateInvoicePdfAsync(invoice, template);

        return new InvoicePdfResult(pdfBytes, $"{invoice.InvoiceNumber}.pdf");
    }
}
