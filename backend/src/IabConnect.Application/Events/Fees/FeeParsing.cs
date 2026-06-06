using IabConnect.Domain.Events;

namespace IabConnect.Application.Events.Fees;

/// <summary>
/// REQ-022 (E4-S1): The ISO currency codes an event fee may be priced in. Mirrors the Finance
/// module's supported set (CHF / EUR) WITHOUT the Events module taking a code dependency on the
/// Finance domain — E4-S2 maps the string to the Finance currency enum when it raises the invoice.
/// </summary>
public static class FeeCurrencies
{
    public static readonly string[] Supported = ["CHF", "EUR"];

    public static string SupportedList => string.Join(", ", Supported);

    public static bool IsSupported(string? currency) =>
        currency is not null && Supported.Contains(currency.Trim().ToUpperInvariant());
}

/// <summary>
/// REQ-022 (E4-S1): Helpers to parse/validate the <see cref="FeeApplicability"/> string carried by
/// the fee-category commands.
/// </summary>
public static class FeeApplicabilityParsing
{
    public static bool IsValid(string? value) =>
        value is not null && Enum.TryParse<FeeApplicability>(value, ignoreCase: false, out _);

    public static FeeApplicability Parse(string value) =>
        Enum.Parse<FeeApplicability>(value, ignoreCase: false);
}
