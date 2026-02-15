using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

public sealed class GetReceiptByIdQueryHandler : IRequestHandler<GetReceiptByIdQuery, ReceiptDto?>
{
    private readonly IReceiptRepository _repository;

    public GetReceiptByIdQueryHandler(IReceiptRepository repository)
    {
        _repository = repository;
    }

    public async Task<ReceiptDto?> Handle(GetReceiptByIdQuery request, CancellationToken ct)
    {
        var receipt = await _repository.GetByIdAsync(request.Id, ct);
        if (receipt is null) return null;
        return GetReceiptsQueryHandler.MapToDto(receipt);
    }
}
