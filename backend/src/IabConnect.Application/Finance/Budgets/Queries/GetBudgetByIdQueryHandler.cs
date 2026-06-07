using IabConnect.Application.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

public sealed class GetBudgetByIdQueryHandler : IRequestHandler<GetBudgetByIdQuery, BudgetDto?>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;

    public GetBudgetByIdQueryHandler(
        IBudgetRepository budgetRepository,
        IActivityAreaRepository activityAreaRepository,
        IFiscalPeriodRepository fiscalPeriodRepository)
    {
        _budgetRepository = budgetRepository;
        _activityAreaRepository = activityAreaRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
    }

    public async Task<BudgetDto?> Handle(GetBudgetByIdQuery request, CancellationToken ct)
    {
        var budget = await _budgetRepository.GetByIdAsync(request.Id, ct);
        if (budget is null) return null;

        var area = await _activityAreaRepository.GetByIdAsync(budget.ActivityAreaId, ct);
        var period = await _fiscalPeriodRepository.GetByIdAsync(budget.FiscalPeriodId, ct);

        return BudgetMapper.ToDto(budget, area, period);
    }
}
