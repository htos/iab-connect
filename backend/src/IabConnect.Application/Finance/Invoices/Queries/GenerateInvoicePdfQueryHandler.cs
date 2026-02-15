using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GenerateInvoicePdfQueryHandler : IRequestHandler<GenerateInvoicePdfQuery, InvoicePdfResult?>
{
    private readonly IInvoiceRepository _repository;
    private readonly IInvoicePdfGeneratorFactory _pdfGeneratorFactory;

    public GenerateInvoicePdfQueryHandler(
        IInvoiceRepository repository,
        IInvoicePdfGeneratorFactory pdfGeneratorFactory)
    {
        _repository = repository;
        _pdfGeneratorFactory = pdfGeneratorFactory;
    }

    public async Task<InvoicePdfResult?> Handle(GenerateInvoicePdfQuery request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Draft)
            throw new InvalidOperationException("Cannot generate PDF for draft invoices.");

        var pdfGenerator = await _pdfGeneratorFactory.GetGeneratorAsync();
        var pdfBytes = await pdfGenerator.GenerateInvoicePdfAsync(invoice);

        return new InvoicePdfResult(pdfBytes, $"{invoice.InvoiceNumber}.pdf");
    }
}
