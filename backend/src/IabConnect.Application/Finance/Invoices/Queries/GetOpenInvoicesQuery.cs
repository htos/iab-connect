using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

/// <summary>
/// Query to get open invoices (Sent/Overdue) (REQ-039)
/// </summary>
public sealed record GetOpenInvoicesQuery : IRequest<List<InvoiceListDto>>;
