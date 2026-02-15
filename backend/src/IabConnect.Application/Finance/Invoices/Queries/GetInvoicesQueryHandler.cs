using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GetInvoicesQueryHandler : IRequestHandler<GetInvoicesQuery, List<InvoiceListDto>>
{
    private readonly IInvoiceRepository _repository;

    public GetInvoicesQueryHandler(IInvoiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<InvoiceListDto>> Handle(GetInvoicesQuery request, CancellationToken ct)
    {
        InvoiceStatus? invoiceStatus = null;
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<InvoiceStatus>(request.Status, true, out var parsed))
            invoiceStatus = parsed;

        var invoices = await _repository.GetAllAsync(invoiceStatus, ct);
        return invoices.Select(MapToListDto).ToList();
    }

    internal static InvoiceListDto MapToListDto(Invoice inv) =>
        new(inv.Id, inv.InvoiceNumber, inv.Date, inv.DueDate, inv.Status.ToString(),
            inv.RecipientType.ToString(), inv.RecipientName, inv.Total,
            inv.SubtotalNet, inv.TotalTax, inv.TotalGross,
            inv.CreatedAt, inv.CreatedBy);

    internal static InvoiceDetailDto MapToDetailDto(Invoice inv) =>
        new(inv.Id, inv.InvoiceNumber, inv.Date, inv.DueDate, inv.Status.ToString(),
            inv.RecipientType.ToString(), inv.RecipientId, inv.RecipientName,
            inv.RecipientAddress, inv.SubTotal, inv.TaxRate, inv.TaxAmount, inv.Total,
            inv.SubtotalNet, inv.TotalTax, inv.TotalGross,
            inv.Notes, inv.CancellationReason, inv.CancelledAt,
            inv.Items.Select(i => new InvoiceItemDto(
                i.Id, i.Description, i.Quantity, i.UnitPrice, i.Amount,
                i.TaxCodeId, i.TaxRate, i.TaxAmount, i.NetAmount, i.GrossAmount, i.IsGrossEntry)).ToList(),
            inv.CreatedAt, inv.CreatedBy, inv.UpdatedAt, inv.UpdatedBy);
}
