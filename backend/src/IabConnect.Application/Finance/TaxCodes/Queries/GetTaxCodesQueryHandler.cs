using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Queries;

public sealed class GetTaxCodesQueryHandler : IRequestHandler<GetTaxCodesQuery, List<TaxCodeDto>>
{
    private readonly ITaxCodeRepository _repository;

    public GetTaxCodesQueryHandler(ITaxCodeRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<TaxCodeDto>> Handle(GetTaxCodesQuery request, CancellationToken ct)
    {
        var taxCodes = await _repository.GetAllActiveAsync(ct);
        return taxCodes.Select(MapToDto).ToList();
    }

    internal static TaxCodeDto MapToDto(TaxCode tc) =>
        new(tc.Id, tc.Code, tc.Label, tc.Rate, tc.IsDefault, tc.IsActive, tc.CreatedAt, tc.UpdatedAt);
}
