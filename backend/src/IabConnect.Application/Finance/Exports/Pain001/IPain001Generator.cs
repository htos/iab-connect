namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: Generates and validates ISO 20022 pain.001 XML documents.
/// </summary>
public interface IPain001Generator
{
    /// <summary>
    /// Generates a pain.001.001.09 XML string from the given config and payment list.
    /// </summary>
    string Generate(Pain001Config config, IReadOnlyList<Pain001PaymentInfo> payments);

    /// <summary>
    /// Validates the config and payment list without generating XML.
    /// </summary>
    Pain001ValidationResult Validate(Pain001Config config, IReadOnlyList<Pain001PaymentInfo> payments);
}
