using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed class GetReceiptsQueryHandler : IRequestHandler<GetReceiptsQuery, PagedResult<ReceiptDto>>
{
    private readonly IReceiptRepository _repository;

    public GetReceiptsQueryHandler(IReceiptRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<ReceiptDto>> Handle(GetReceiptsQuery request, CancellationToken ct)
    {
        var receipts = await _repository.GetAllAsync(ct: ct);
        var dtos = receipts.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "uploadedAt", true);
        var sorted = field.ToLowerInvariant() switch
        {
            "filename" => dtos.ApplySort(r => r.FileName, desc),
            _ => dtos.ApplySort(r => r.UploadedAt, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static ReceiptDto MapToDto(Receipt r) =>
        new(r.Id, r.FileName, r.FilePath, r.ContentType, r.FileSize,
            r.FileHash, r.UploadedAt, r.UploadedBy, r.Notes,
            $"/api/v1/finance/receipts/{r.Id}/download");
}
