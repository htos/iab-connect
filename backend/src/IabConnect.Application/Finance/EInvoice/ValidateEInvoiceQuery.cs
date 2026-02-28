using MediatR;

namespace IabConnect.Application.Finance.EInvoice;

/// <summary>
/// REQ-072: Query to validate an invoice's eInvoice XML against EN 16931 rules.
/// Generates UBL XML and validates it, returning only the validation result.
/// </summary>
public sealed record ValidateEInvoiceQuery(Guid InvoiceId) : IRequest<EInvoiceValidationResult?>;
