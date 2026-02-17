using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Invoices;

/// <summary>
/// REQ-065: Strategy interface for generating structured eInvoice documents.
/// Implementations provide format-specific exports (UBL, CII, etc.).
/// Designed as an extension point for future CIUS/country-specific variants.
/// </summary>
public interface IEInvoiceExporter
{
    /// <summary>
    /// The format this exporter produces.
    /// </summary>
    EInvoiceFormat Format { get; }

    /// <summary>
    /// Generates an eInvoice XML document for the given invoice.
    /// </summary>
    /// <param name="invoice">The invoice with items loaded.</param>
    /// <param name="profile">The active finance profile with organization/VAT data.</param>
    /// <param name="taxCodes">All tax codes for resolving codes on items.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>UTF-8 encoded XML bytes.</returns>
    Task<byte[]> ExportAsync(Invoice invoice, FinanceProfile profile, IReadOnlyList<TaxCode> taxCodes, CancellationToken ct = default);
}

/// <summary>
/// REQ-065: Supported eInvoice export formats.
/// </summary>
public enum EInvoiceFormat
{
    /// <summary>UBL 2.1 (OASIS) — EN 16931 compliant</summary>
    UBL,
    /// <summary>UN/CEFACT Cross Industry Invoice — EN 16931 compliant (future)</summary>
    CII
}
