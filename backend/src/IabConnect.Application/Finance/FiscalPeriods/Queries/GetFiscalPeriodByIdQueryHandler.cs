using IabConnect.Application.Finance.FiscalPeriods.Commands;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

public sealed class GetFiscalPeriodByIdQueryHandler
    : IRequestHandler<GetFiscalPeriodByIdQuery, FiscalPeriodDto?>
{
    private readonly IFiscalPeriodRepository _repository;

    public GetFiscalPeriodByIdQueryHandler(IFiscalPeriodRepository repository)
    {
        _repository = repository;
    }

    public async Task<FiscalPeriodDto?> Handle(GetFiscalPeriodByIdQuery request, CancellationToken ct)
    {
        var period = await _repository.GetByIdAsync(request.Id, ct);
        return period is null ? null : GenerateFiscalPeriodsCommandHandler.MapToDto(period);
    }
}
