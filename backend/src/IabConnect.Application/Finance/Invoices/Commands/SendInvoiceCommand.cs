using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// Command to mark an invoice as sent (REQ-039)
/// </summary>
public sealed record SendInvoiceCommand(Guid Id, string UserName) : IRequest<InvoiceDetailDto?>;
