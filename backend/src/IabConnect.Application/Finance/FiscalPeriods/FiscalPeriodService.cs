namespace IabConnect.Application.Finance.FiscalPeriods;

public sealed class FiscalPeriodService : IFiscalPeriodService
{
    private readonly IFiscalPeriodRepository _repository;

    public FiscalPeriodService(IFiscalPeriodRepository repository)
    {
        _repository = repository;
    }

    public async Task EnsurePeriodNotLockedAsync(DateTime date, CancellationToken ct = default)
    {
        var period = await _repository.GetByDateAsync(date, ct);
        if (period is not null && !period.IsMutationAllowed)
        {
            throw new InvalidOperationException(
                $"Fiscal period {period.Name} is locked. Mutations are not allowed for dates in this period.");
        }
    }

    public async Task<bool> IsPeriodLockedAsync(DateTime date, CancellationToken ct = default)
    {
        var period = await _repository.GetByDateAsync(date, ct);
        return period is not null && !period.IsMutationAllowed;
    }
}
