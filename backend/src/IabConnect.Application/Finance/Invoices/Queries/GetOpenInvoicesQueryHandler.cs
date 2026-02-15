using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GetOpenInvoicesQueryHandler : IRequestHandler<GetOpenInvoicesQuery, List<InvoiceListDto>>
{
    private readonly IInvoiceRepository _repository;

    public GetOpenInvoicesQueryHandler(IInvoiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<InvoiceListDto>> Handle(GetOpenInvoicesQuery request, CancellationToken ct)
    {
        var invoices = await _repository.GetOpenItemsAsync(ct);
        return invoices.Select(GetInvoicesQueryHandler.MapToListDto).ToList();
    }
}
