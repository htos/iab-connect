using MediatR;

namespace IabConnect.Application.Finance.Invoices.Queries;

public sealed class GetInvoiceByIdQueryHandler : IRequestHandler<GetInvoiceByIdQuery, InvoiceDetailDto?>
{
    private readonly IInvoiceRepository _repository;

    public GetInvoiceByIdQueryHandler(IInvoiceRepository repository)
    {
        _repository = repository;
    }

    public async Task<InvoiceDetailDto?> Handle(GetInvoiceByIdQuery request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null) return null;
        return GetInvoicesQueryHandler.MapToDetailDto(invoice);
    }
}
