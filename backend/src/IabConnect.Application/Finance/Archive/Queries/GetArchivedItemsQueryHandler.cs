using MediatR;

namespace IabConnect.Application.Finance.Archive.Queries;

/// <summary>
/// REQ-070: Returns all archived items across Receipt, Invoice, and Transaction types.
/// </summary>
public sealed class GetArchivedItemsQueryHandler : IRequestHandler<GetArchivedItemsQuery, List<ArchivedItemDto>>
{
    private readonly IReceiptRepository _receiptRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ITransactionRepository _transactionRepository;

    public GetArchivedItemsQueryHandler(
        IReceiptRepository receiptRepository,
        IInvoiceRepository invoiceRepository,
        ITransactionRepository transactionRepository)
    {
        _receiptRepository = receiptRepository;
        _invoiceRepository = invoiceRepository;
        _transactionRepository = transactionRepository;
    }

    public async Task<List<ArchivedItemDto>> Handle(GetArchivedItemsQuery request, CancellationToken ct)
    {
        var receipts = await _receiptRepository.GetArchivedAsync(ct);
        var invoices = await _invoiceRepository.GetArchivedAsync(ct);
        var transactions = await _transactionRepository.GetArchivedAsync(ct);

        var items = new List<ArchivedItemDto>();

        items.AddRange(receipts.Select(r => new ArchivedItemDto(
            r.Id, "Receipt", r.FileName,
            r.IsArchived, r.ArchivedAt, r.ArchivedBy, r.ArchiveReason, r.RetainUntil)));

        items.AddRange(invoices.Select(i => new ArchivedItemDto(
            i.Id, "Invoice", i.InvoiceNumber,
            i.IsArchived, i.ArchivedAt, i.ArchivedBy, i.ArchiveReason, i.RetainUntil)));

        items.AddRange(transactions.Select(t => new ArchivedItemDto(
            t.Id, "Transaction", t.Description,
            t.IsArchived, t.ArchivedAt, t.ArchivedBy, t.ArchiveReason, t.RetainUntil)));

        return items.OrderByDescending(i => i.ArchivedAt).ToList();
    }
}
