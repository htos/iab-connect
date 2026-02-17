using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// DTO for invoice line item input
/// </summary>
public sealed record CreateInvoiceItemInput(
    string Description, decimal Quantity, decimal UnitPrice,
    Guid? TaxCodeId = null, bool IsGrossEntry = false, Guid? ActivityAreaId = null);

/// <summary>
/// Command to create an invoice with items (REQ-039)
/// </summary>
public sealed record CreateInvoiceCommand : IRequest<InvoiceDetailDto>
{
    public required DateTime Date { get; init; }
    public required DateTime DueDate { get; init; }
    public required string RecipientType { get; init; }
    public Guid? RecipientId { get; init; }
    public required string RecipientName { get; init; }
    public string? RecipientAddress { get; init; }
    public decimal TaxRate { get; init; }
    public string? Notes { get; init; }
    public string? PaymentTerms { get; init; }
    public Guid? TemplateId { get; init; }
    public required List<CreateInvoiceItemInput> Items { get; init; }
    public required string UserName { get; init; }
}
