using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// Command to mark an invoice as overdue (REQ-039)
/// </summary>
public sealed record MarkInvoiceAsOverdueCommand(Guid Id, string UserName) : IRequest<InvoiceDetailDto?>;
