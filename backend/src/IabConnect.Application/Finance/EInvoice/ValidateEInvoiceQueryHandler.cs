using System.Text;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.EInvoice;

/// <summary>
/// REQ-072: Handler that generates UBL XML for an invoice and validates it.
/// </summary>
public sealed class ValidateEInvoiceQueryHandler : IRequestHandler<ValidateEInvoiceQuery, EInvoiceValidationResult?>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly ITaxCodeRepository _taxCodeRepository;
    private readonly IEnumerable<IEInvoiceExporter> _exporters;
    private readonly IEInvoiceValidator _validator;

    public ValidateEInvoiceQueryHandler(
        IInvoiceRepository invoiceRepository,
        IFinanceProfileRepository profileRepository,
        ITaxCodeRepository taxCodeRepository,
        IEnumerable<IEInvoiceExporter> exporters,
        IEInvoiceValidator validator)
    {
        _invoiceRepository = invoiceRepository;
        _profileRepository = profileRepository;
        _taxCodeRepository = taxCodeRepository;
        _exporters = exporters;
        _validator = validator;
    }

    public async Task<EInvoiceValidationResult?> Handle(ValidateEInvoiceQuery request, CancellationToken ct)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return null;

        if (invoice.Status == InvoiceStatus.Draft)
            throw new InvalidOperationException("Cannot validate draft invoices as eInvoice.");

        var profile = await _profileRepository.GetActiveProfileAsync(ct);
        if (profile is null)
            throw new InvalidOperationException("No active finance profile found. An active finance profile is required for eInvoice validation.");

        // Use UBL exporter
        var exporter = _exporters.FirstOrDefault(e => e.Format == EInvoiceFormat.UBL)
            ?? throw new InvalidOperationException("No UBL exporter registered.");

        var taxCodes = await _taxCodeRepository.GetAllActiveAsync(ct);
        var xmlBytes = await exporter.ExportAsync(invoice, profile, taxCodes, ct);
        var ublXml = Encoding.UTF8.GetString(xmlBytes);

        return await _validator.ValidateAsync(ublXml, ct);
    }
}
