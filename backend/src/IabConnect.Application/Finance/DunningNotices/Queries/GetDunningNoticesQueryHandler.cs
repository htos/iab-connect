using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.DunningNotices.Queries;

public sealed class GetDunningNoticesQueryHandler : IRequestHandler<GetDunningNoticesQuery, PagedResult<DunningNoticeDto>>
{
    private readonly IDunningNoticeRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;

    public GetDunningNoticesQueryHandler(IDunningNoticeRepository repository, IInvoiceRepository invoiceRepository)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
    }

    public async Task<PagedResult<DunningNoticeDto>> Handle(GetDunningNoticesQuery request, CancellationToken ct)
    {
        List<DunningNotice> notices;
        if (request.InvoiceId.HasValue)
        {
            notices = await _repository.GetByInvoiceIdAsync(request.InvoiceId.Value, ct);
        }
        else
        {
            notices = await _repository.GetAllAsync(ct);
        }

        var invoiceIds = notices.Select(n => n.InvoiceId).Distinct().ToList();
        var invoices = new Dictionary<Guid, (string Number, string Recipient)>();
        foreach (var invId in invoiceIds)
        {
            var inv = await _invoiceRepository.GetByIdAsync(invId, ct);
            if (inv is not null)
                invoices[invId] = (inv.InvoiceNumber, inv.RecipientName);
        }
        var dtos = notices.Select(n =>
        {
            invoices.TryGetValue(n.InvoiceId, out var inv);
            return MapToDto(n, inv.Number, inv.Recipient);
        });

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "date", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "level" => dtos.ApplySort(d => d.Level, desc),
            "duedate" => dtos.ApplySort(d => d.DueDate, desc),
            _ => dtos.ApplySort(d => d.Date, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static DunningNoticeDto MapToDto(DunningNotice n, string? invoiceNumber = null, string? recipientName = null) =>
        new(n.Id, n.InvoiceId, invoiceNumber, recipientName, n.Level, n.Date, n.DueDate,
            n.Status.ToString(), n.SentAt, n.Notes, n.CreatedBy);
}
