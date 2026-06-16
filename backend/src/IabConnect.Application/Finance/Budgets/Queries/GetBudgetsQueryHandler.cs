using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

public sealed class GetBudgetsQueryHandler : IRequestHandler<GetBudgetsQuery, List<BudgetDto>>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;

    public GetBudgetsQueryHandler(
        IBudgetRepository budgetRepository,
        IActivityAreaRepository activityAreaRepository,
        IFiscalPeriodRepository fiscalPeriodRepository)
    {
        _budgetRepository = budgetRepository;
        _activityAreaRepository = activityAreaRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
    }

    public async Task<List<BudgetDto>> Handle(GetBudgetsQuery request, CancellationToken ct)
    {
        var budgets = await _budgetRepository.GetAllAsync(ct);

        if (request.ActivityAreaId.HasValue)
            budgets = budgets.Where(b => b.ActivityAreaId == request.ActivityAreaId.Value).ToList();
        if (request.FiscalPeriodId.HasValue)
            budgets = budgets.Where(b => b.FiscalPeriodId == request.FiscalPeriodId.Value).ToList();

        var periods = (await _fiscalPeriodRepository.GetAllAsync(request.Year, ct))
            .ToDictionary(p => p.Id);
        var areas = (await _activityAreaRepository.GetAllActiveAsync(ct))
            .ToDictionary(a => a.Id);

        // Year filter applies via the fiscal period: keep only budgets whose period is in scope.
        if (request.Year.HasValue)
            budgets = budgets.Where(b => periods.ContainsKey(b.FiscalPeriodId)).ToList();

        return budgets
            .Select(b => BudgetMapper.ToDto(
                b,
                areas.GetValueOrDefault(b.ActivityAreaId),
                periods.GetValueOrDefault(b.FiscalPeriodId)))
            .ToList();
    }
}

/// <summary>
/// REQ-044 (E6-S1): Maps a <see cref="Budget"/> to its display DTO, enriching with the
/// cost-center (<see cref="ActivityArea"/>) and <see cref="FiscalPeriod"/> descriptors when available.
/// </summary>
internal static class BudgetMapper
{
    public static BudgetDto ToDto(Budget b, ActivityArea? area, FiscalPeriod? period) => new(
        b.Id,
        b.ActivityAreaId,
        area?.Name,
        area?.Code,
        b.FiscalPeriodId,
        period?.Name,
        period?.Year,
        period?.Month,
        b.Amount,
        b.Currency.ToString(),
        b.Notes,
        b.CreatedAt,
        b.CreatedBy,
        b.UpdatedAt,
        b.UpdatedBy);
}
