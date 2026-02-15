using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed class GetReceiptsQueryHandler : IRequestHandler<GetReceiptsQuery, List<ReceiptDto>>
{
    private readonly IReceiptRepository _repository;

    public GetReceiptsQueryHandler(IReceiptRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ReceiptDto>> Handle(GetReceiptsQuery request, CancellationToken ct)
    {
        var receipts = await _repository.GetAllAsync(ct);
        return receipts.Select(MapToDto).ToList();
    }

    internal static ReceiptDto MapToDto(Receipt r) =>
        new(r.Id, r.FileName, r.FilePath, r.ContentType, r.FileSize,
            r.FileHash, r.UploadedAt, r.UploadedBy, r.Notes,
            $"/api/v1/finance/receipts/{r.Id}/download");
}
