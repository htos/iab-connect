using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

public sealed class GetBudgetVsActualQueryHandler
    : IRequestHandler<GetBudgetVsActualQuery, BudgetVsActualReportDto?>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;
    private readonly IFinanceProfileRepository _financeProfileRepository;

    public GetBudgetVsActualQueryHandler(
        IBudgetRepository budgetRepository,
        ITransactionRepository transactionRepository,
        IFiscalPeriodRepository fiscalPeriodRepository,
        IActivityAreaRepository activityAreaRepository,
        IFinanceProfileRepository financeProfileRepository)
    {
        _budgetRepository = budgetRepository;
        _transactionRepository = transactionRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
        _activityAreaRepository = activityAreaRepository;
        _financeProfileRepository = financeProfileRepository;
    }

    public async Task<BudgetVsActualReportDto?> Handle(GetBudgetVsActualQuery request, CancellationToken ct)
    {
        var period = await _fiscalPeriodRepository.GetByIdAsync(request.FiscalPeriodId, ct);
        if (period is null) return null;

        // Soll: budgets for the period (optionally scoped to one cost center).
        var budgets = await _budgetRepository.GetByFiscalPeriodAsync(period.Id, ct);
        if (request.ActivityAreaId.HasValue)
            budgets = budgets.Where(b => b.ActivityAreaId == request.ActivityAreaId.Value).ToList();

        // Ist: net cost per cost center, summed in SQL over the period's date bounds.
        var actuals = await _transactionRepository.GetActualsByActivityAreaAsync(
            period.StartDate, period.EndDate, request.ActivityAreaId, ct);

        var budgetByArea = budgets.ToDictionary(b => b.ActivityAreaId);
        var actualByArea = actuals.ToDictionary(a => a.ActivityAreaId, a => a.Actual);

        var defaultCurrency = (await _financeProfileRepository.GetActiveProfileAsync(ct))?.Currency
            ?? FinanceCurrency.CHF;

        // Full-outer merge: a cost center with only a budget OR only actuals still produces a row.
        var areaIds = budgetByArea.Keys.Union(actualByArea.Keys).ToList();

        var rows = new List<BudgetVsActualRow>(areaIds.Count);
        foreach (var areaId in areaIds)
        {
            var area = await _activityAreaRepository.GetByIdAsync(areaId, ct);
            var budgetRow = budgetByArea.GetValueOrDefault(areaId);
            var budget = budgetRow?.Amount ?? 0m;
            var actual = actualByArea.GetValueOrDefault(areaId, 0m);
            var variance = budget - actual;
            // Divide-by-zero convention: no budget → 0% (cannot express variance as a % of zero plan).
            var variancePercent = budget == 0m ? 0m : Math.Round(variance / budget * 100m, 2);
            var currency = (budgetRow?.Currency ?? defaultCurrency).ToString();

            rows.Add(new BudgetVsActualRow(
                areaId,
                area?.Code ?? "",
                area?.Name ?? "",
                budget,
                actual,
                variance,
                variancePercent,
                currency));
        }

        rows = rows.OrderBy(r => r.ActivityAreaCode).ThenBy(r => r.ActivityAreaName).ToList();

        return new BudgetVsActualReportDto(
            period.Id, period.Name, period.Year, period.Month, rows);
    }
}
