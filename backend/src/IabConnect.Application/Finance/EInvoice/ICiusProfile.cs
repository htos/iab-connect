using System.Xml.Linq;

namespace IabConnect.Application.Finance.EInvoice;

/// <summary>
/// REQ-072: Extension point for country-specific CIUS (Core Invoice Usage Specification) profiles.
/// Implementations provide additional validation rules on top of the EN 16931 baseline.
///
/// Examples of future implementations:
/// - XRechnung 3.0 (Germany)
/// - FatturaPA (Italy)
/// - Factur-X / ZUGFeRD (France/Germany)
/// - Swiss QR-bill profile
/// </summary>
public interface ICiusProfile
{
    /// <summary>
    /// The official CIUS profile identifier (used in CustomizationID).
    /// e.g., "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0"
    /// </summary>
    string ProfileId { get; }

    /// <summary>
    /// Human-readable description of this CIUS profile.
    /// e.g., "XRechnung 3.0"
    /// </summary>
    string Description { get; }

    /// <summary>
    /// Validates the UBL document against this CIUS profile's additional rules.
    /// Called after EN 16931 baseline validation passes.
    /// </summary>
    /// <param name="ublDocument">Parsed UBL invoice XML document.</param>
    /// <returns>Validation result with profile-specific errors/warnings.</returns>
    EInvoiceValidationResult Validate(XDocument ublDocument);
}
