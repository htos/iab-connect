using IabConnect.Application.Finance.Budgets.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

/// <summary>
/// REQ-044 (E6-S1): Update the amount / currency / notes of an existing budget.
/// The (ActivityArea, FiscalPeriod) pairing is immutable — delete and recreate to re-key.
/// </summary>
public sealed record UpdateBudgetCommand : IRequest<BudgetDto?>
{
    public required Guid Id { get; init; }
    public required decimal Amount { get; init; }
    public string? Currency { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
