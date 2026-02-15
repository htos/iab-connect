using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// Command to update a draft invoice (REQ-039)
/// </summary>
public sealed record UpdateInvoiceCommand : IRequest<InvoiceDetailDto?>
{
    public required Guid Id { get; init; }
    public required DateTime Date { get; init; }
    public required DateTime DueDate { get; init; }
    public required string RecipientType { get; init; }
    public Guid? RecipientId { get; init; }
    public required string RecipientName { get; init; }
    public string? RecipientAddress { get; init; }
    public decimal TaxRate { get; init; }
    public string? Notes { get; init; }
    public required List<CreateInvoiceItemInput> Items { get; init; }
    public required string UserName { get; init; }
}
