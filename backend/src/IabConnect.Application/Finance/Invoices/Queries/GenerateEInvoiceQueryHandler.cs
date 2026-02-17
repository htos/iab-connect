using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// REQ-065: Handler for generating eInvoice XML documents.
/// Delegates to the appropriate IEInvoiceExporter based on requested format.
/// </summary>
public sealed class GenerateEInvoiceQueryHandler : IRequestHandler<GenerateEInvoiceQuery, EInvoiceResult?>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly ITaxCodeRepository _taxCodeRepository;
    private readonly IEnumerable<IEInvoiceExporter> _exporters;

    public GenerateEInvoiceQueryHandler(
        IInvoiceRepository invoiceRepository,
        IFinanceProfileRepository profileRepository,
        ITaxCodeRepository taxCodeRepository,
        IEnumerable<IEInvoiceExporter> exporters)
    {
        _invoiceRepository = invoiceRepository;
        _profileRepository = profileRepository;
        _taxCodeRepository = taxCodeRepository;
        _exporters = exporters;
    }

    public async Task<EInvoiceResult?> Handle(GenerateEInvoiceQuery request, CancellationToken ct)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Draft)
            throw new InvalidOperationException("Cannot export draft invoices as eInvoice.");

        var profile = await _profileRepository.GetActiveProfileAsync(ct);
        if (profile is null)
            throw new InvalidOperationException("No active finance profile found. An active finance profile is required for eInvoice export.");

        // Parse format
        if (!Enum.TryParse<EInvoiceFormat>(request.Format, ignoreCase: true, out var format))
            throw new ArgumentException($"Unsupported eInvoice format: {request.Format}. Supported: UBL, CII.");

        // Find matching exporter
        var exporter = _exporters.FirstOrDefault(e => e.Format == format)
            ?? throw new InvalidOperationException($"No exporter registered for format {format}.");

        // Load active tax codes for resolving item tax code references
        var taxCodes = await _taxCodeRepository.GetAllActiveAsync(ct);

        var xmlBytes = await exporter.ExportAsync(invoice, profile, taxCodes, ct);
        var fileName = $"{invoice.InvoiceNumber}_einvoice.xml";

        return new EInvoiceResult(xmlBytes, fileName, "application/xml");
    }
}
