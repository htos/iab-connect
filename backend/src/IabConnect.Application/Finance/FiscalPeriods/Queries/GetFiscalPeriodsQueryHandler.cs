using IabConnect.Application.Finance.FiscalPeriods.Commands;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

public sealed class GetFiscalPeriodsQueryHandler
    : IRequestHandler<GetFiscalPeriodsQuery, List<FiscalPeriodDto>>
{
    private readonly IFiscalPeriodRepository _repository;

    public GetFiscalPeriodsQueryHandler(IFiscalPeriodRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<FiscalPeriodDto>> Handle(GetFiscalPeriodsQuery request, CancellationToken ct)
    {
        var periods = await _repository.GetAllAsync(request.Year, ct);
        return periods.Select(GenerateFiscalPeriodsCommandHandler.MapToDto).ToList();
    }
}
