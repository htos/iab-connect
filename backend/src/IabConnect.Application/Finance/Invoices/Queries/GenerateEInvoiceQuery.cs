using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// REQ-065: Result of eInvoice XML generation.
/// </summary>
public sealed record EInvoiceResult(byte[] XmlBytes, string FileName, string ContentType);

/// <summary>
/// REQ-065: Query to generate an eInvoice XML document for a given invoice.
/// Feature-flagged at the API layer.
/// </summary>
public sealed record GenerateEInvoiceQuery(Guid InvoiceId, string Format = "UBL") : IRequest<EInvoiceResult?>;
