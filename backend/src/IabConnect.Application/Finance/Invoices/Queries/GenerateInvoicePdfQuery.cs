using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// Result of PDF generation
/// </summary>
public sealed record InvoicePdfResult(byte[] PdfBytes, string FileName);

/// <summary>
/// Query to generate an invoice PDF (REQ-039)
/// </summary>
public sealed record GenerateInvoicePdfQuery(Guid InvoiceId) : IRequest<InvoicePdfResult?>;
