using IabConnect.Application.Finance.Budgets.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

/// <summary>
/// REQ-044 (E6-S1): Create a budget for a cost center (ActivityArea) in a fiscal period.
/// </summary>
public sealed record CreateBudgetCommand : IRequest<BudgetDto>
{
    public required Guid ActivityAreaId { get; init; }
    public required Guid FiscalPeriodId { get; init; }
    public required decimal Amount { get; init; }

    /// <summary>Optional. Defaults to the active finance profile's currency (DEC-4=a).</summary>
    public string? Currency { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
