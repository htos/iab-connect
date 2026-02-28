namespace IabConnect.Application.Finance.EInvoice;

/// <summary>
/// REQ-072: Validates eInvoice XML against EN 16931 business rules.
/// Implementations provide offline schema + business-rule validation.
/// </summary>
public interface IEInvoiceValidator
{
    /// <summary>
    /// Validates the given UBL XML string against EN 16931 baseline rules
    /// and any registered CIUS profiles.
    /// </summary>
    /// <param name="ublXml">UTF-8 encoded UBL 2.1 Invoice XML.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Validation result containing errors and warnings.</returns>
    Task<EInvoiceValidationResult> ValidateAsync(string ublXml, CancellationToken ct = default);
}
