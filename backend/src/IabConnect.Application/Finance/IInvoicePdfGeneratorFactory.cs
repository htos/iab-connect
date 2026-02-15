namespace IabConnect.Application.Finance;

/// <summary>
/// REQ-063: Factory for selecting the appropriate invoice PDF generator
/// based on the active FinanceProfile (jurisdiction, IBAN, etc.).
/// </summary>
public interface IInvoicePdfGeneratorFactory
{
    /// <summary>
    /// Returns the appropriate <see cref="IInvoicePdfGenerator"/> based on
    /// the active FinanceProfile. For CH jurisdiction with IBAN, returns
    /// a Swiss QR-bill generator; otherwise, returns the base generator.
    /// </summary>
    Task<IInvoicePdfGenerator> GetGeneratorAsync();
}
