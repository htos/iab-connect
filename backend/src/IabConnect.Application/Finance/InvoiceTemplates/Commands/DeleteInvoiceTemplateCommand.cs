using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

/// <summary>
/// Command to delete an invoice template (REQ-064)
/// </summary>
public sealed record DeleteInvoiceTemplateCommand(Guid Id) : IRequest<bool>;
