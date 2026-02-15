using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed class DownloadReceiptQueryHandler : IRequestHandler<DownloadReceiptQuery, ReceiptDownloadResult?>
{
    private readonly IReceiptRepository _repository;
    private readonly IFinanceDocumentStorage _documentStorage;

    public DownloadReceiptQueryHandler(
        IReceiptRepository repository,
        IFinanceDocumentStorage documentStorage)
    {
        _repository = repository;
        _documentStorage = documentStorage;
    }

    public async Task<ReceiptDownloadResult?> Handle(DownloadReceiptQuery request, CancellationToken ct)
    {
        var receipt = await _repository.GetByIdAsync(request.Id, ct);
        if (receipt is null) return null;

        if (string.IsNullOrEmpty(receipt.FilePath))
            return null;

        var stream = await _documentStorage.DownloadReceiptAsync(receipt.FilePath, ct);
        return new ReceiptDownloadResult(stream, receipt.ContentType, receipt.FileName);
    }
}
