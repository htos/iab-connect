using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Queries;

public sealed class GetDunningNoticesQueryHandler : IRequestHandler<GetDunningNoticesQuery, List<DunningNoticeDto>>
{
    private readonly IDunningNoticeRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;

    public GetDunningNoticesQueryHandler(IDunningNoticeRepository repository, IInvoiceRepository invoiceRepository)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<List<DunningNoticeDto>> Handle(GetDunningNoticesQuery request, CancellationToken ct)
    {
        var notices = await _repository.GetAllAsync(ct);
        var invoiceIds = notices.Select(n => n.InvoiceId).Distinct().ToList();
        var invoices = new Dictionary<Guid, (string Number, string Recipient)>();
        foreach (var invId in invoiceIds)
        {
            var inv = await _invoiceRepository.GetByIdAsync(invId, ct);
            if (inv is not null)
                invoices[invId] = (inv.InvoiceNumber, inv.RecipientName);
        }
        return notices.Select(n =>
        {
            invoices.TryGetValue(n.InvoiceId, out var inv);
            return MapToDto(n, inv.Number, inv.Recipient);
        }).ToList();
    }

    internal static DunningNoticeDto MapToDto(DunningNotice n, string? invoiceNumber = null, string? recipientName = null) =>
        new(n.Id, n.InvoiceId, invoiceNumber, recipientName, n.Level, n.Date, n.DueDate,
            n.Status.ToString(), n.SentAt, n.Notes, n.CreatedBy);
}
