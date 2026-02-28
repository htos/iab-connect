using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GetInvoicesQueryHandler : IRequestHandler<GetInvoicesQuery, PagedResult<InvoiceListDto>>
{
    private readonly IInvoiceRepository _repository;

    public GetInvoicesQueryHandler(IInvoiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<InvoiceListDto>> Handle(GetInvoicesQuery request, CancellationToken ct)
    {
        InvoiceStatus? invoiceStatus = null;
        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<InvoiceStatus>(request.Status, true, out var parsed))
            invoiceStatus = parsed;

        var invoices = await _repository.GetAllAsync(invoiceStatus, ct: ct);
        var dtos = invoices.Select(MapToListDto);

        // Apply additional filters from the filter string
        var filters = PaginationHelper.ParseFilter(request.Filter);
        if (filters.TryGetValue("dateFrom", out var df) && DateTime.TryParse(df, out var dateFrom))
            dtos = dtos.Where(i => i.Date >= dateFrom);
        if (filters.TryGetValue("dateTo", out var dt) && DateTime.TryParse(dt, out var dateTo))
            dtos = dtos.Where(i => i.Date <= dateTo);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "date", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "invoicenumber" => dtos.ApplySort(i => i.InvoiceNumber, desc),
            "duedate" => dtos.ApplySort(i => i.DueDate, desc),
            "total" => dtos.ApplySort(i => i.Total, desc),
            "status" => dtos.ApplySort(i => i.Status, desc),
            "createdat" => dtos.ApplySort(i => i.CreatedAt, desc),
            _ => dtos.ApplySort(i => i.Date, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
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
            inv.Notes, inv.PaymentTerms, inv.TemplateId,
            inv.CancellationReason, inv.CancelledAt,
            inv.Items.Select(i => new InvoiceItemDto(
                i.Id, i.Description, i.Quantity, i.UnitPrice, i.Amount,
                i.TaxCodeId, i.TaxRate, i.TaxAmount, i.NetAmount, i.GrossAmount, i.IsGrossEntry, i.ActivityAreaId)).ToList(),
            inv.CreatedAt, inv.CreatedBy, inv.UpdatedAt, inv.UpdatedBy);
}
