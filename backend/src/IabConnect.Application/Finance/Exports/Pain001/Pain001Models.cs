namespace IabConnect.Application.Finance.Exports.Pain001;

/// <summary>
/// REQ-073: ISO 20022 pain.001 profile selection.
/// </summary>
public enum Pain001Profile
{
    /// <summary>Swiss Payment Standards (CHF, QR-reference)</summary>
    ChSps,

    /// <summary>Single Euro Payments Area (EUR, IBAN-based)</summary>
    Sepa
}

/// <summary>
/// REQ-073: Configuration for pain.001 XML generation (debtor / group header info).
/// </summary>
public sealed record Pain001Config
{
    public required string MessageId { get; init; }
    public required string InitiatingPartyName { get; init; }
    public required string DebtorName { get; init; }
    public required string DebtorIban { get; init; }
    public string? DebtorBic { get; init; }
    public required string DebtorStreet { get; init; }
    public required string DebtorCity { get; init; }
    public required string DebtorPostalCode { get; init; }
    public required string DebtorCountry { get; init; }
    public required string Currency { get; init; }
    public required Pain001Profile Profile { get; init; }
}

/// <summary>
/// REQ-073: Individual credit-transfer transaction info for pain.001.
/// </summary>
public sealed record Pain001PaymentInfo
{
    public Guid PaymentId { get; init; }
    public required string EndToEndId { get; init; }
    public decimal Amount { get; init; }
    public required string Currency { get; init; }
    public required string CreditorName { get; init; }
    public required string CreditorIban { get; init; }
    public string? CreditorBic { get; init; }
    public string? CreditorStreet { get; init; }
    public string? CreditorCity { get; init; }
    public string? CreditorPostalCode { get; init; }
    public string? CreditorCountry { get; init; }
    public string? RemittanceInfo { get; init; }
    public string? QrReference { get; init; }
    public string? CreditorReference { get; init; }
    public DateTimeOffset RequestedExecutionDate { get; init; }
}

/// <summary>
/// REQ-073: Result of pain.001 pre-generation validation.
/// </summary>
public sealed class Pain001ValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public List<string> Errors { get; init; } = [];
    public List<string> Warnings { get; init; } = [];
}

/// <summary>
/// REQ-073: Result of pain.001 export (XML content + metadata).
/// </summary>
public sealed class Pain001ExportResult
{
    public required string Xml { get; init; }
    public required string FileName { get; init; }
    public int PaymentCount { get; init; }
    public decimal TotalAmount { get; init; }
    public required Pain001ValidationResult Validation { get; init; }
}
