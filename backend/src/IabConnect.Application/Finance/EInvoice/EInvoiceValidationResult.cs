namespace IabConnect.Application.Finance.EInvoice;

/// <summary>
/// REQ-072: Result of eInvoice validation against EN 16931 business rules.
/// </summary>
public sealed class EInvoiceValidationResult
{
    public bool IsValid => Errors.Count == 0;
    public List<EInvoiceValidationError> Errors { get; init; } = [];
    public List<EInvoiceValidationWarning> Warnings { get; init; } = [];
}

/// <summary>
/// REQ-072: A single validation error from eInvoice business-rule checking.
/// </summary>
public sealed class EInvoiceValidationError
{
    public required string RuleId { get; init; }
    public required string Field { get; init; }
    public required string Message { get; init; }
    public string Severity { get; init; } = "Error";
}

/// <summary>
/// REQ-072: A single validation warning (non-blocking) from eInvoice checking.
/// </summary>
public sealed class EInvoiceValidationWarning
{
    public required string RuleId { get; init; }
    public required string Field { get; init; }
    public required string Message { get; init; }
}
