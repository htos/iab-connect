using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Queries;

/// <summary>
/// Query to get a single invoice template by Id (REQ-064)
/// </summary>
public sealed record GetInvoiceTemplateByIdQuery(Guid Id) : IRequest<InvoiceTemplateDto?>;
