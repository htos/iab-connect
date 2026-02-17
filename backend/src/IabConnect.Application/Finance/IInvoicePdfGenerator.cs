using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance;

/// <summary>
/// REQ-039: Generates PDF documents for invoices.
/// Designed for extensibility:
/// - REQ-063: Swiss QR-bill support (append QR payment slip)
/// - REQ-062: VAT summary section
/// - REQ-064: Jurisdiction-specific templates
/// </summary>
public interface IInvoicePdfGenerator
{
    /// <summary>
    /// Generates a PDF byte array for the given invoice.
    /// The invoice must include its line items.
    /// </summary>
    Task<byte[]> GenerateInvoicePdfAsync(Invoice invoice);

    /// <summary>
    /// REQ-064: Generates a PDF byte array using a specific invoice template
    /// for EU compliance fields and presentation settings.
    /// </summary>
    Task<byte[]> GenerateInvoicePdfAsync(Invoice invoice, InvoiceTemplate? template);
}
