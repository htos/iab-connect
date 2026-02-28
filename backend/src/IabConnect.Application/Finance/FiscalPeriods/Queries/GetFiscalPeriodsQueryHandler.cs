using IabConnect.Application.Common;
using IabConnect.Application.Finance.FiscalPeriods.Commands;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

public sealed class GetFiscalPeriodsQueryHandler
    : IRequestHandler<GetFiscalPeriodsQuery, PagedResult<FiscalPeriodDto>>
{
    private readonly IFiscalPeriodRepository _repository;

    public GetFiscalPeriodsQueryHandler(IFiscalPeriodRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<FiscalPeriodDto>> Handle(GetFiscalPeriodsQuery request, CancellationToken ct)
    {
        var periods = await _repository.GetAllAsync(request.Year, ct);
        var dtos = periods.Select(GenerateFiscalPeriodsCommandHandler.MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "year", false);
        IEnumerable<FiscalPeriodDto> sorted = field.ToLowerInvariant() switch
        {
            "name" => dtos.ApplySort(p => p.Name, desc),
            "month" => dtos.ApplySort(p => p.Month, desc),
            "startdate" => dtos.ApplySort(p => p.StartDate, desc),
            _ => desc
                ? dtos.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month)
                : dtos.OrderBy(p => p.Year).ThenBy(p => p.Month)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }
}
