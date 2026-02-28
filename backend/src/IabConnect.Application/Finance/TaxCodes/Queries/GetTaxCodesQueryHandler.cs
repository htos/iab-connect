using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Queries;

public sealed class GetTaxCodesQueryHandler : IRequestHandler<GetTaxCodesQuery, PagedResult<TaxCodeDto>>
{
    private readonly ITaxCodeRepository _repository;

    public GetTaxCodesQueryHandler(ITaxCodeRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<TaxCodeDto>> Handle(GetTaxCodesQuery request, CancellationToken ct)
    {
        var taxCodes = await _repository.GetAllActiveAsync(ct);
        var dtos = taxCodes.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "code", false);
        var sorted = field.ToLowerInvariant() switch
        {
            "rate" => dtos.ApplySort(tc => tc.Rate, desc),
            "label" => dtos.ApplySort(tc => tc.Label, desc),
            "createdat" => dtos.ApplySort(tc => tc.CreatedAt, desc),
            _ => dtos.ApplySort(tc => tc.Code, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static TaxCodeDto MapToDto(TaxCode tc) =>
        new(tc.Id, tc.Code, tc.Label, tc.Rate, tc.IsDefault, tc.IsActive, tc.CreatedAt, tc.UpdatedAt);
}
