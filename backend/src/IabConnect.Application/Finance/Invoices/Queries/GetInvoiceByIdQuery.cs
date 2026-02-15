using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// Query to get an invoice by ID with items (REQ-039)
/// </summary>
public sealed record GetInvoiceByIdQuery(Guid Id) : IRequest<InvoiceDetailDto?>;
