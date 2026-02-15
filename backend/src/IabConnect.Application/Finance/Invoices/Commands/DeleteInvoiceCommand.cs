using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// Command to soft-delete a draft invoice (REQ-039)
/// </summary>
public sealed record DeleteInvoiceCommand(Guid Id, string UserName) : IRequest<Result>;
