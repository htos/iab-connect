using System.Text.RegularExpressions;
using Codecrete.SwissQRBill.Generator;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-063: Utility for generating Swiss payment references from invoice numbers.
/// Supports QR-Reference (for QR-IBANs) and Creditor Reference / ISO 11649 (for regular IBANs).
/// </summary>
public static partial class SwissQrReferenceHelper
{
    /// <summary>
    /// Generates the appropriate payment reference based on the IBAN type.
    /// </summary>
    /// <param name="iban">The creditor's IBAN (spaces are stripped automatically).</param>
    /// <param name="invoiceNumber">The invoice number (e.g. "INV-2026-0001").</param>
    /// <returns>A valid QR-Reference (27 digits) or Creditor Reference (RF...).</returns>
    public static string GenerateReference(string iban, string invoiceNumber)
    {
        var cleanIban = iban.Replace(" ", "");

        if (Payments.IsQrIban(cleanIban))
        {
            return GenerateQrReference(invoiceNumber);
        }

        return GenerateCreditorReference(invoiceNumber);
    }

    /// <summary>
    /// Determines the reference type string for the QR-bill based on the IBAN.
    /// </summary>
    public static string GetReferenceType(string iban)
    {
        var cleanIban = iban.Replace(" ", "");
        return Payments.IsQrIban(cleanIban) ? "QRR" : "SCOR";
    }

    /// <summary>
    /// Generates a QR-Reference (26 numeric digits + 1 check digit = 27 digits)
    /// from an invoice number by extracting numeric characters.
    /// </summary>
    private static string GenerateQrReference(string invoiceNumber)
    {
        // Extract only numeric digits from the invoice number
        var numericOnly = NumericRegex().Replace(invoiceNumber, "");
        if (numericOnly.Length == 0)
            numericOnly = "0";

        // Pad to 26 digits (left-pad with zeros) or truncate from the right
        var padded = numericOnly.Length > 26
            ? numericOnly[^26..]
            : numericOnly.PadLeft(26, '0');

        return Payments.CreateQRReference(padded);
    }

    /// <summary>
    /// Generates a Creditor Reference (ISO 11649: "RF" + 2 check digits + reference)
    /// from the invoice number.
    /// </summary>
    private static string GenerateCreditorReference(string invoiceNumber)
    {
        // Remove spaces and special characters that are not alphanumeric
        var cleanRef = AlphanumericRegex().Replace(invoiceNumber, "");
        if (cleanRef.Length == 0)
            cleanRef = "0";

        // ISO 11649 reference can be up to 21 alphanumeric characters
        if (cleanRef.Length > 21)
            cleanRef = cleanRef[^21..];

        return Payments.CreateIso11649Reference(cleanRef);
    }

    [GeneratedRegex("[^0-9]")]
    private static partial Regex NumericRegex();

    [GeneratedRegex("[^A-Za-z0-9]")]
    private static partial Regex AlphanumericRegex();
}
