using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

/// <summary>
/// REQ-044 (E6-S3): one cost-center row in the budget-vs-actual (Soll/Ist) report.
/// Budget = planned (Soll); Actual = net cost (Ist); Variance = Budget − Actual.
/// </summary>
public sealed record BudgetVsActualRow(
    Guid ActivityAreaId,
    string ActivityAreaCode,
    string ActivityAreaName,
    decimal Budget,
    decimal Actual,
    decimal Variance,
    decimal VariancePercent,
    string Currency);

/// <summary>
/// REQ-044 (E6-S3): the budget-vs-actual report for one fiscal period.
/// </summary>
public sealed record BudgetVsActualReportDto(
    Guid FiscalPeriodId,
    string FiscalPeriodName,
    int FiscalPeriodYear,
    int FiscalPeriodMonth,
    IReadOnlyList<BudgetVsActualRow> Rows);

/// <summary>
/// REQ-044 (E6-S3): query the Soll/Ist report for a fiscal period, optionally scoped to one cost center.
/// </summary>
public sealed record GetBudgetVsActualQuery(Guid FiscalPeriodId, Guid? ActivityAreaId)
    : IRequest<BudgetVsActualReportDto?>;
